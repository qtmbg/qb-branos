// QB BrandOS — Agent Dispatch
// Vercel Edge Function
//
// POST /api/agents/dispatch
//   Authorization: Bearer <supabase-access-token>
//   Body: { userId, qbp, agentName }
//
// Flow:
// 1. Verify JWT, match it against body.userId.
// 2. Validate agentName against the AGENT_REGISTRY (canonical slugs).
// 3. Idempotent artifact create: if a 'queued' or 'generating' row exists
//    for this user_id + artifact_type, reuse it. Otherwise insert a new
//    row with the correct version (parent_artifact_id set when superseding
//    an older delivered/failed row).
// 4. Open an artifact_runs row with status='started', then synchronously
//    run the agent.
// 5. Validate the agent's content against js/qb-artifact-schema.js.
//    - valid:   patch artifact to 'delivered', close the run as 'succeeded'
//    - invalid: patch artifact to 'failed' (no content saved), close the
//               run as 'failed' with the validator error list.
// 6. Fire-and-forget artifact-ready email on success.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY      JWT verification.
//   SUPABASE_SERVICE_ROLE_KEY            Artifact writes (bypasses RLS).
//   ANTHROPIC_API_KEY                    Agent model call.
//   RESEND_API_KEY                       Optional; artifact-ready email.

import { runSoulMapSynthesizer } from './soul-map-synthesizer.js';
import { runSensescapeSynthesizer } from './sensescape-synthesizer.js';
import { runVisualDnaSynthesizer } from './visual-dna-synthesizer.js';
import { runWarTableSynthesizer } from './war-table-synthesizer.js';
import { validateArtifact } from '../../js/qb-artifact-schema.js';

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = new Set([
  'https://quantumbranding.ai',
  'https://www.quantumbranding.ai',
  'https://app.quantumbranding.ai',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://quantumbranding.ai';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Canonical agent slugs. artifact_type stores the same slug so the row
// can be reverse-mapped to its producing agent without a join. Inbound
// aliases (kebab variants from older callers) are accepted at the
// request boundary and normalized to the canonical underscore form.
const AGENT_REGISTRY = {
  soul_map_synthesizer: {
    slug: 'soul_map_synthesizer',
    artifactType: 'soul_map_synthesizer',
    phase: '01',
    run: runSoulMapSynthesizer,
  },
  sensescape_synthesizer: {
    slug: 'sensescape_synthesizer',
    artifactType: 'sensescape_synthesizer',
    phase: '01',
    run: runSensescapeSynthesizer,
  },
  visual_dna_synthesizer: {
    slug: 'visual_dna_synthesizer',
    artifactType: 'visual_dna_synthesizer',
    phase: '01',
    run: runVisualDnaSynthesizer,
  },
  war_table_synthesizer: {
    slug: 'war_table_synthesizer',
    artifactType: 'war_table_synthesizer',
    phase: '01',
    run: runWarTableSynthesizer,
  },
};

const AGENT_NAME_ALIASES = {
  'soul-map-synthesizer': 'soul_map_synthesizer',
  'sensescape-synthesizer': 'sensescape_synthesizer',
  'visual-dna-synthesizer': 'visual_dna_synthesizer',
  'war-table-synthesizer': 'war_table_synthesizer',
};

function resolveAgent(agentName) {
  if (!agentName || typeof agentName !== 'string') return null;
  const canonical = AGENT_NAME_ALIASES[agentName] || agentName;
  return AGENT_REGISTRY[canonical] || null;
}

function svcHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function findOrCreateArtifact({ supaUrl, serviceKey, userId, registry }) {
  const inFlightRes = await fetch(
    `${supaUrl}/rest/v1/artifacts` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&artifact_type=eq.${encodeURIComponent(registry.artifactType)}` +
    `&status=in.(queued,generating)` +
    `&select=id,version,status&order=created_at.desc&limit=1`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!inFlightRes.ok) {
    throw new Error(`inflight-lookup failed: ${inFlightRes.status}`);
  }
  const inFlight = await inFlightRes.json().catch(() => []);
  if (Array.isArray(inFlight) && inFlight.length > 0) {
    return { id: inFlight[0].id, version: inFlight[0].version, reused: true };
  }

  const latestRes = await fetch(
    `${supaUrl}/rest/v1/artifacts` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&artifact_type=eq.${encodeURIComponent(registry.artifactType)}` +
    `&select=id,version&order=version.desc&limit=1`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!latestRes.ok) {
    throw new Error(`latest-lookup failed: ${latestRes.status}`);
  }
  const latest = await latestRes.json().catch(() => []);
  const latestRow = Array.isArray(latest) && latest.length > 0 ? latest[0] : null;
  const nextVersion = latestRow ? (Number(latestRow.version) || 1) + 1 : 1;
  const parent = latestRow ? latestRow.id : null;

  const insRes = await fetch(`${supaUrl}/rest/v1/artifacts`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      artifact_type: registry.artifactType,
      status: 'queued',
      version: nextVersion,
      parent_artifact_id: parent,
      phase: registry.phase,
      content: {},
      error: null,
    }),
  });
  if (!insRes.ok) {
    const t = await insRes.text().catch(() => '');
    throw new Error(`insert failed: ${insRes.status} ${t.slice(0, 300)}`);
  }
  const rows = await insRes.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { id: row.id, version: row.version, reused: false };
}

async function patchArtifact({ supaUrl, serviceKey, artifactId, patch }) {
  const res = await fetch(
    `${supaUrl}/rest/v1/artifacts?id=eq.${encodeURIComponent(artifactId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[dispatch] artifact patch failed', res.status, t.slice(0, 300));
  }
}

async function openArtifactRun({ supaUrl, serviceKey, artifactId, agentSlug, model }) {
  const res = await fetch(`${supaUrl}/rest/v1/artifact_runs`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify({
      artifact_id: artifactId,
      agent_slug: agentSlug,
      status: 'started',
      model: model || null,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[dispatch] run-open failed', res.status, t.slice(0, 300));
    return null;
  }
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row ? row.id : null;
}

async function closeArtifactRun({ supaUrl, serviceKey, runId, patch }) {
  if (!runId) return;
  const res = await fetch(
    `${supaUrl}/rest/v1/artifact_runs?id=eq.${encodeURIComponent(runId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[dispatch] run-close failed', res.status, t.slice(0, 300));
  }
}

function readyEmailHtml({ firstName }) {
  const safeName = String(firstName || '').replace(/[<>&"]/g, '');
  const greeting = safeName ? `Hi ${safeName},` : 'Hi there,';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Soul Map synthesis is ready</title></head>
<body style="margin:0;padding:0;background:#FBF5E6;color:#2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="540" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;width:100%;background:#F2EBD3;border:2px solid #2D1521;border-radius:18px;">
      <tr><td style="padding:32px 32px 8px;">
        <p style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#B58840;margin:0 0 12px;font-weight:700;">Artifact ready</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.15;color:#2D1521;margin:0 0 24px;letter-spacing:-0.01em;">Your Soul Map synthesis is <em style="color:#B58840;">ready</em>.</h1>
      </td></tr>
      <tr><td style="padding:0 32px 32px;font-size:16px;line-height:1.6;color:#2D1521;">
        <p style="margin:0 0 16px;">${greeting}</p>
        <p style="margin:0 0 16px;">Your Soul Map synthesis is complete. It is waiting for you in your dashboard.</p>
        <p style="margin:0 0 24px;">This is the first of your brand artifacts. The others are being produced now.</p>
        <p style="margin:0 0 32px;">
          <a href="https://quantumbranding.ai/dashboard" style="display:inline-block;padding:14px 24px;background:#B58840;color:#FBF5E6;text-decoration:none;font-weight:600;border-radius:999px;border:2px solid #2D1521;">View it</a>
        </p>
        <p style="margin:0;">Nizzar</p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;border-top:1px solid rgba(45,21,33,0.10);font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;color:rgba(45,21,33,0.50);">
        Quantum Branding · quantumbranding.ai
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function readyEmailText({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  return `${greeting}

Your Soul Map synthesis is complete. It is waiting for you in your dashboard.

This is the first of your brand artifacts. The others are being produced now.

View it: https://quantumbranding.ai/dashboard

Nizzar

Quantum Branding
quantumbranding.ai`;
}

async function sendReadyEmail({ resendKey, email, firstName }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Quantum Branding <auth@quantumbranding.ai>',
        to: [email],
        reply_to: 'me@qtmbg.com',
        subject: 'Your Soul Map synthesis is ready',
        html: readyEmailHtml({ firstName }),
        text: readyEmailText({ firstName }),
        headers: {
          'List-Unsubscribe': '<mailto:me@qtmbg.com?subject=unsubscribe>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Entity-Ref-ID': 'qb-brandos-artifact-ready',
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[dispatch] resend failed', res.status, t.slice(0, 300));
    }
  } catch (e) {
    console.error('[dispatch] resend threw', e && e.message);
  }
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsH });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY || !ANTHROPIC_API_KEY) {
    return json(503, { ok: false, error: 'Dispatch service not configured' }, corsH);
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { ok: false, error: 'Missing authorization' }, corsH);

  let body;
  try { body = await req.json(); }
  catch { return json(400, { ok: false, error: 'Invalid body' }, corsH); }

  const { userId, qbp, agentName } = body || {};
  if (!userId || !UUID_RE.test(userId)) return json(400, { ok: false, error: 'Invalid userId' }, corsH);
  const registry = resolveAgent(agentName);
  if (!registry) {
    return json(400, { ok: false, error: 'unknown_agent', agent_slug: agentName || null }, corsH);
  }
  if (qbp && typeof qbp !== 'object') return json(400, { ok: false, error: 'qbp must be an object' }, corsH);

  // Resolve the JWT and confirm it matches the claimed userId.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json(401, { ok: false, error: 'Invalid session' }, corsH);
  const user = await userRes.json();
  if (!user?.id) return json(401, { ok: false, error: 'Invalid session' }, corsH);
  if (user.id !== userId) return json(403, { ok: false, error: 'userId does not match session' }, corsH);

  // Step 1: artifact row. Idempotent reuse of any in-flight row.
  let artifact;
  try {
    artifact = await findOrCreateArtifact({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId, registry,
    });
  } catch (e) {
    console.error('[dispatch] artifact-create error', e && e.message);
    return json(500, { ok: false, error: 'Could not start synthesis', stage: 'artifact-create' }, corsH);
  }

  if (artifact.reused) {
    return json(200, {
      ok: true,
      agentName: registry.slug,
      artifactType: registry.artifactType,
      artifact_id: artifact.id,
      version: artifact.version,
      status: 'in_flight',
      message: 'Reused existing in-flight artifact.'
    }, corsH);
  }

  // Step 2: open run row + flip artifact to 'generating'.
  const runStartedAt = Date.now();
  const runId = await openArtifactRun({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY,
    artifactId: artifact.id, agentSlug: registry.slug, model: 'claude-sonnet-4-6',
  });
  await patchArtifact({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact.id,
    patch: { status: 'generating' },
  });

  // Step 3: run the agent.
  let result;
  try {
    result = await registry.run({ qbp: qbp || {}, anthropicKey: ANTHROPIC_API_KEY });
  } catch (e) {
    result = { ok: false, error: (e && e.message) || 'Agent threw', stage: 'agent-throw' };
  }
  const duration_ms = Date.now() - runStartedAt;

  if (!result || !result.ok) {
    const isTimeout = result?.error === 'edge_timeout';
    const failureLabel = isTimeout ? 'edge_timeout'
      : `${result?.stage || 'unknown'}: ${result?.error || 'agent failed'}`;
    await patchArtifact({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact.id,
      patch: { status: 'failed', error: failureLabel, content: {} },
    });
    await closeArtifactRun({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, runId,
      patch: {
        status: 'failed',
        error: JSON.stringify({
          stage: result?.stage || 'unknown',
          error: result?.error || 'agent failed',
          detail: result?.detail || null,
        }).slice(0, 1000),
        duration_ms,
      },
    });
    return json(200, { ok: false, error: failureLabel, stage: result?.stage || 'unknown' }, corsH);
  }

  // Step 4: validate content against the artifact schema BEFORE save.
  const validation = validateArtifact(result.content);
  if (!validation.valid) {
    console.error('[dispatch] schema validation failed', JSON.stringify(validation.errors).slice(0, 600));
    await patchArtifact({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact.id,
      patch: { status: 'failed', error: 'schema_validation_failed', content: {} },
    });
    await closeArtifactRun({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, runId,
      patch: {
        status: 'failed',
        error: JSON.stringify({
          stage: 'schema-validation',
          missing_inputs: result.missing || [],
          errors: validation.errors,
        }).slice(0, 1000),
        duration_ms,
        tokens_in: result.meta?.tokens_in ?? null,
        tokens_out: result.meta?.tokens_out ?? null,
      },
    });
    return json(200, { ok: false, error: 'schema_validation_failed', stage: 'schema-validation' }, corsH);
  }

  // Step 5: save. Schema-validated content. Status=delivered.
  await patchArtifact({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact.id,
    patch: { status: 'delivered', error: null, content: validation.content },
  });
  await closeArtifactRun({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, runId,
    patch: {
      status: 'succeeded',
      error: (result.missing && result.missing.length)
        ? JSON.stringify({ missing_inputs: result.missing }).slice(0, 1000)
        : null,
      duration_ms,
      tokens_in: result.meta?.tokens_in ?? null,
      tokens_out: result.meta?.tokens_out ?? null,
    },
  });

  // Step 6: artifact-ready email. Fire-and-forget.
  if (RESEND_API_KEY) {
    try {
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=email,first_name&id=eq.${encodeURIComponent(userId)}`,
        { headers: svcHeaders(SERVICE_KEY) }
      );
      const profiles = profRes.ok ? await profRes.json().catch(() => []) : [];
      const profile = profiles?.[0];
      if (profile?.email) {
        await sendReadyEmail({
          resendKey: RESEND_API_KEY,
          email: profile.email,
          firstName: profile.first_name || '',
        });
      }
    } catch (e) {
      console.error('[dispatch] ready-email lookup threw', e && e.message);
    }
  }

  return json(200, {
    ok: true,
    agentName: registry.slug,
    artifactType: registry.artifactType,
    artifact_id: artifact.id,
    version: artifact.version,
    status: 'delivered',
    missing: result.missing || [],
  }, corsH);
}
