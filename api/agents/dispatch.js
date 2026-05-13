// QB BrandOS — Agent Dispatch
// Vercel Edge Function
//
// POST /api/agents/dispatch
//   Authorization: Bearer <supabase-access-token>
//   Body: { userId, qbp, agentName }
//
// 1. Verifies the JWT and matches it against body.userId.
// 2. Validates agentName against the AGENT_REGISTRY.
// 3. Service-role upserts a 'producing' row into public.artifacts.
// 4. Synchronously runs the agent (Sonnet via direct anthropic.com call;
//    no in-project /api/claude hop — saves a function invocation and lets
//    us keep this on Edge for the 25s budget).
// 5. Service-role updates the artifact row to 'ready' (with content) or
//    'failed' (with error message). Fire-and-forget "artifact ready"
//    email on success.
//
// Day 3 ships one agent: soul-map-synthesizer. The dispatch shape carries
// no agent-specific logic — every future synthesizer plugs into
// AGENT_REGISTRY without touching this file's flow.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY      JWT verification.
//   SUPABASE_SERVICE_ROLE_KEY            Artifact writes (bypasses RLS).
//   ANTHROPIC_API_KEY                    Agent model call.
//   RESEND_API_KEY                       Optional; "artifact ready" email.

import { runSoulMapSynthesizer } from './soul-map-synthesizer.js';

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

const AGENT_REGISTRY = {
  'soul-map-synthesizer': {
    artifactType: 'soul-map-synthesis',
    run: runSoulMapSynthesizer,
  },
};

async function upsertProducing({ supaUrl, serviceKey, userId, artifactType }) {
  // ON CONFLICT (user_id, artifact_type) DO UPDATE — Postgres upsert via
  // PostgREST: Prefer: resolution=merge-duplicates with the unique key.
  const res = await fetch(
    `${supaUrl}/rest/v1/artifacts?on_conflict=user_id,artifact_type`,
    {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        artifact_type: artifactType,
        status: 'producing',
        content: {},
        error: null,
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`producing upsert failed: ${res.status} ${errText.slice(0, 300)}`);
  }
  const rows = await res.json().catch(() => []);
  return rows?.[0] || null;
}

async function patchArtifact({ supaUrl, serviceKey, userId, artifactType, patch }) {
  const res = await fetch(
    `${supaUrl}/rest/v1/artifacts?user_id=eq.${encodeURIComponent(userId)}&artifact_type=eq.${encodeURIComponent(artifactType)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[dispatch] artifact patch failed', res.status, errText.slice(0, 300));
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
  if (!agentName || !AGENT_REGISTRY[agentName]) return json(400, { ok: false, error: 'Unknown agentName' }, corsH);
  if (qbp && typeof qbp !== 'object') return json(400, { ok: false, error: 'qbp must be an object' }, corsH);

  // Resolve the JWT and confirm it matches the claimed userId. The body's
  // userId is allowed for clarity in logs and webhook payloads, but the
  // JWT is authoritative — RLS on artifacts would catch a mismatch anyway,
  // but we want a clean 401 here rather than a downstream RLS error.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json(401, { ok: false, error: 'Invalid session' }, corsH);
  const user = await userRes.json();
  if (!user?.id) return json(401, { ok: false, error: 'Invalid session' }, corsH);
  if (user.id !== userId) return json(403, { ok: false, error: 'userId does not match session' }, corsH);

  const registry = AGENT_REGISTRY[agentName];
  const artifactType = registry.artifactType;

  // Step 1: producing row. If this fails we bail before paying for a model
  // call — the dashboard would have no way to surface the result.
  try {
    await upsertProducing({ supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId, artifactType });
  } catch (e) {
    console.error('[dispatch] producing-upsert error', e && e.message);
    return json(500, { ok: false, error: 'Could not start synthesis', stage: 'producing-upsert' }, corsH);
  }

  // Step 2: run the agent. Synchronous on Edge — 25s budget covers the
  // Sonnet call comfortably for Day 3. If it exceeds, the request 504s and
  // the row stays 'producing'; dashboard surfaces a Retry after 60s.
  let result;
  try {
    result = await registry.run({ qbp: qbp || {}, anthropicKey: ANTHROPIC_API_KEY });
  } catch (e) {
    result = { ok: false, error: e && e.message || 'Agent threw', stage: 'agent-throw' };
  }

  if (!result || !result.ok) {
    await patchArtifact({
      supaUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId,
      artifactType,
      patch: {
        status: 'failed',
        error: `${result?.stage || 'unknown'}: ${result?.error || 'agent failed'}`,
        content: { error: result?.error || 'agent failed', stage: result?.stage || 'unknown', detail: result?.detail || null },
      },
    });
    return json(200, { ok: false, error: result?.error || 'Agent failed', stage: result?.stage || 'unknown' }, corsH);
  }

  // Step 3: ready. Stamp content + status. If the agent flagged missing
  // fields we surface them in the artifact so the dashboard can prompt
  // the user to go back and fill them in.
  const contentToWrite = result.missing && result.missing.length
    ? { ...result.content, _meta: { missing_inputs: result.missing } }
    : result.content;

  await patchArtifact({
    supaUrl: SUPABASE_URL,
    serviceKey: SERVICE_KEY,
    userId,
    artifactType,
    patch: { status: 'ready', error: null, content: contentToWrite },
  });

  // Step 4: artifact-ready email. Fire-and-forget. We re-fetch the user's
  // first_name from profiles via service role so the email reads warmer.
  if (RESEND_API_KEY) {
    try {
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=email,first_name&id=eq.${encodeURIComponent(userId)}`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' } }
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

  return json(200, { ok: true, agentName, artifactType, missing: result.missing || [] }, corsH);
}
