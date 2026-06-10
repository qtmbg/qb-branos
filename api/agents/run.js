// api/agents/run.js
// Chapter 2 · Step 4 · the agent runtime per CHAPTER_02_SPEC.md §5.2.
//
// Replaces api/agents/dispatch.js as the canonical execution path. The
// 12-step runtime:
//
//   1. Verify caller (JWT user OR inter-edge HMAC service call · §5.6)
//   2. Look up agent META from agents/registry.js
//   3. Resolve QBP source (current vs original · §3.2 + §5.2 step 3)
//   4. Read inputs · validate required qbp_fields, dependencies, files
//   5. If any required input missing → fail with the matching code
//   6. Insert agent_runs row (qbp_snapshot, file_refs, runtime_args,
//      agent_version) + propagate agent_version to dispatch_jobs
//   7. Flip artifact status='generating'
//   8. Run agent with schema-validate-and-retry loop (META.model,
//      META.retry_budget · per-attempt schema_retry_count counter)
//   9. On success: PATCH artifact delivered + content, close run
//      succeeded, send artifact-ready email
//   10. On failure: PATCH artifact failed + error_payload, close run
//       failed
//   11. Update dispatch_jobs.agents_settled + flip status
//   12. Return run summary
//
// Per §5.8 failure surface:
//   - User-fixable codes (missing_inputs, qbp_field_missing,
//     missing_dependency) write to artifacts.status='failed' + log
//     error_payload; NO notifications (user sees Console row only).
//   - Transient codes (edge_timeout, model_call_failed,
//     schema_validation_failed) fail this run; the reaper retries up
//     to 3 then emits dispatch_failed at failed_permanently.
//   - Operator-only codes (config_missing) fire the §5.8.2 operator
//     notification channel immediately; user sees generic "Temporarily
//     unavailable" copy.

export const config = { runtime: 'edge' };

import { AGENTS, LATENCY_BUDGET_WARNINGS, getAgent } from '../../agents/registry.js';
import { DEFAULT_RETRY_BUDGET, DEFAULT_MODEL } from '../../agents/contract.js';
import { validateArtifact } from '../../js/qb-artifact-schema.js';
import { sendEmail, renderTemplate, EMAIL_TEMPLATES, getAgentEmailVars } from '../_lib/email.js';
import { sendOperatorNotification } from '../_lib/operator-notify.js';
import { triggerChainIfReady } from '../_lib/chain-trigger.js';
import { waitUntil } from '@vercel/functions';

const ARTIFACT_URL_BASE = 'https://app.quantumbranding.ai/artifact';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Inter-Edge-Signature, X-Inter-Edge-Timestamp',
    'Vary': 'Origin',
  };
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function svcHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// ─── 1. Caller verification ────────────────────────────────────────────────
// Two paths per §5.6:
//   A) User session: bearer Supabase JWT, body.user_id matches the JWT user.
//   B) Inter-edge service call: X-Inter-Edge-Signature header is the
//      HMAC-SHA256 of the body using INTER_EDGE_SECRET; X-Inter-Edge-Timestamp
//      is fresh (within 5 minutes) to prevent replay.

async function verifyUserJwt(req, body, supaUrl, anonKey) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, reason: 'no-token' };

  const r = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { ok: false, reason: 'invalid-session' };
  const user = await r.json().catch(() => null);
  if (!user?.id) return { ok: false, reason: 'invalid-session' };
  if (body.user_id && user.id !== body.user_id) return { ok: false, reason: 'user-mismatch' };
  return { ok: true, user_id: user.id };
}

async function verifyInterEdge(req, rawBody, secret) {
  if (!secret) return { ok: false, reason: 'inter-edge-not-configured' };
  const sig = req.headers.get('x-inter-edge-signature') || '';
  const ts = req.headers.get('x-inter-edge-timestamp') || '';
  if (!sig || !ts) return { ok: false, reason: 'no-signature' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
    return { ok: false, reason: 'stale-timestamp' };
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  if (expectedHex !== sig.toLowerCase()) {
    return { ok: false, reason: 'signature-mismatch' };
  }
  return { ok: true, service: true };
}

// ─── 3. QBP source resolution ──────────────────────────────────────────────
// runtime_args.qbp_source · 'current' (default) reads the user's live
// profiles.qbp. 'original' reads the qbp_snapshot from the source artifact's
// agent_runs row · only meaningful on regenerate triggers.

async function resolveQbpSource({ supaUrl, serviceKey, userId, runtime_args, sourceArtifactId }) {
  const mode = runtime_args?.qbp_source === 'original' ? 'original' : 'current';

  if (mode === 'original' && sourceArtifactId) {
    const runRes = await fetch(
      `${supaUrl}/rest/v1/agent_runs` +
      `?artifact_id=eq.${encodeURIComponent(sourceArtifactId)}` +
      `&status=eq.succeeded` +
      `&select=qbp_snapshot&order=completed_at.desc&limit=1`,
      { headers: svcHeaders(serviceKey) }
    );
    if (runRes.ok) {
      const rows = await runRes.json().catch(() => []);
      const snapshot = rows?.[0]?.qbp_snapshot;
      if (snapshot && typeof snapshot === 'object') {
        return { qbp: snapshot, mode: 'original' };
      }
    }
    // Fall through to current if no snapshot available · the Console
    // surface disables the "original QBP" pill in that case per §6.4,
    // so this path is defensive.
  }

  const profRes = await fetch(
    `${supaUrl}/rest/v1/profiles?select=qbp&id=eq.${encodeURIComponent(userId)}`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!profRes.ok) {
    // Degrading to an empty QBP silently turns a transient read failure
    // into a user-facing qbp_field_missing. Keep the fallback, log the
    // cause. Loud per silent-fail cleanup.
    console.error('[agents/run] qbp profile read failed', userId, profRes.status);
    return { qbp: {}, mode: 'current' };
  }
  const profiles = await profRes.json().catch(() => []);
  const qbp = profiles?.[0]?.qbp || {};
  return { qbp, mode: 'current' };
}

// ─── 4. Input validation ───────────────────────────────────────────────────
// Returns { ok: true } OR { ok: false, code, missing_fields?, missing_slug? }

function validateInputs({ meta, qbp, dependencies, files }) {
  const requiredQbpFields = (meta.inputs?.qbp_fields || [])
    .filter(f => f && f.required === true)
    .map(f => f.field);
  const missingQbpFields = requiredQbpFields.filter(field => {
    const v = qbp?.[field];
    if (v == null) return true;
    if (typeof v === 'string') return v.trim().length === 0;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  });
  if (missingQbpFields.length > 0) {
    return { ok: false, code: 'qbp_field_missing', missing_fields: missingQbpFields };
  }

  const deps = meta.inputs?.artifact_dependencies || [];
  const missingDeps = deps.filter(slug => !(dependencies?.[slug]?.delivered));
  if (missingDeps.length > 0) {
    return { ok: false, code: 'missing_dependency', missing_slug: missingDeps[0] };
  }

  const requiredFiles = (meta.inputs?.files || []).filter(f => f && f.optional === false);
  const missingFiles = requiredFiles.filter(f => {
    return !(files || []).some(actual => actual?.type === f.type);
  });
  if (missingFiles.length > 0) {
    return { ok: false, code: 'missing_inputs', missing_files: missingFiles.map(f => f.type) };
  }

  return { ok: true };
}

// ─── 5/6. agent_runs + dispatch_jobs writes ────────────────────────────────

async function loadDependencies({ supaUrl, serviceKey, userId, depSlugs }) {
  const out = {};
  for (const slug of depSlugs) {
    const r = await fetch(
      `${supaUrl}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&artifact_type=eq.${encodeURIComponent(slug)}` +
      `&status=eq.delivered` +
      `&select=id,content,version&order=version.desc&limit=1`,
      { headers: svcHeaders(serviceKey) }
    );
    if (!r.ok) {
      // A failed read silently classifies the dependency as undelivered,
      // surfacing user-fixable missing_dependency for what is actually a
      // transient infra failure. Keep the fallback, log the cause.
      console.error('[agents/run] dependency read failed', slug, r.status);
      out[slug] = { delivered: false };
      continue;
    }
    const rows = await r.json().catch(() => []);
    if (rows?.length > 0) {
      out[slug] = { delivered: true, ...rows[0] };
    } else {
      out[slug] = { delivered: false };
    }
  }
  return out;
}

async function openAgentRun({ supaUrl, serviceKey, payload }) {
  const r = await fetch(`${supaUrl}/rest/v1/agent_runs`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error('[agents/run] agent_runs open failed', r.status, t.slice(0, 300));
    return null;
  }
  const rows = await r.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row ? row.id : null;
}

async function closeAgentRun({ supaUrl, serviceKey, runId, patch }) {
  if (!runId) return;
  const r = await fetch(
    `${supaUrl}/rest/v1/agent_runs?id=eq.${encodeURIComponent(runId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }
  );
  if (!r.ok) {
    // A run that never closes reads as 'started' forever; the reaper's
    // classifier then treats the artifact as orphaned (mode b) and
    // spuriously retries delivered work. Loud per silent-fail cleanup.
    const t = await r.text().catch(() => '');
    console.error('[agents/run] agent_runs close failed', runId, r.status, t.slice(0, 300));
  }
}

async function patchArtifact({ supaUrl, serviceKey, artifactId, patch }) {
  const r = await fetch(
    `${supaUrl}/rest/v1/artifacts?id=eq.${encodeURIComponent(artifactId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }
  );
  if (!r.ok) {
    // This is the user-visible status transition (generating →
    // delivered/failed). A swallowed failure strands the artifact in
    // its prior state with no trace. Loud per silent-fail cleanup.
    const t = await r.text().catch(() => '');
    console.error('[agents/run] artifact patch failed', artifactId, patch?.status, r.status, t.slice(0, 300));
  }
}

async function propagateDispatchAgentVersion({ supaUrl, serviceKey, dispatchId, agentVersion }) {
  if (!dispatchId) return;
  // PATCH only when dispatch_jobs.agent_version is null. The per-run
  // version always lives on agent_runs.agent_version; dispatch_jobs
  // stores the highest version among the dispatched set per §4.2.
  // For Chapter 2 with version-1 agents, this is effectively a one-time
  // write per dispatch row.
  const cur = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}&select=agent_version`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!cur.ok) {
    console.error('[agents/run] agent_version read failed', dispatchId, cur.status);
    return;
  }
  const rows = await cur.json().catch(() => []);
  const existing = rows?.[0]?.agent_version;
  if (existing != null && existing >= agentVersion) return;
  const w = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({ agent_version: agentVersion }),
    }
  );
  if (!w.ok) {
    console.error('[agents/run] agent_version propagate failed', dispatchId, w.status);
  }
}

async function settleDispatch({ supaUrl, serviceKey, dispatchId, terminalOk }) {
  if (!dispatchId) return;
  // Read dispatch + all child artifacts; if every child has reached a
  // terminal state, flip dispatch status to completed/partial.
  const djRes = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}` +
    `&select=agents_count,agents_settled,status`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!djRes.ok) {
    // An aborted settle leaves the dispatch in 'producing'; the reaper
    // later terminal-flips it and the user gets dispatch_failed for
    // delivered work. Loud per silent-fail cleanup.
    console.error('[agents/run] settle read failed', dispatchId, djRes.status);
    return;
  }
  const dj = (await djRes.json().catch(() => []))?.[0];
  if (!dj) return;

  const settled = (Number(dj.agents_settled) || 0) + 1;
  const total   = Number(dj.agents_count) || 0;

  let patch = { agents_settled: settled };
  if (total > 0 && settled >= total) {
    // Read all child artifacts to compute terminal status.
    const childRes = await fetch(
      `${supaUrl}/rest/v1/artifacts?dispatch_id=eq.${encodeURIComponent(dispatchId)}&select=status`,
      { headers: svcHeaders(serviceKey) }
    );
    if (!childRes.ok) {
      console.error('[agents/run] settle children read failed', dispatchId, childRes.status);
    }
    const children = childRes.ok ? (await childRes.json().catch(() => [])) : [];
    const anyFailed = children.some(c => c.status === 'failed');
    const allDelivered = children.length > 0 && children.every(c => c.status === 'delivered');
    patch.status = allDelivered ? 'completed' : (anyFailed ? 'partial' : 'completed');
    patch.completed_at = new Date().toISOString();
  }

  const w = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }
  );
  if (!w.ok) {
    const t = await w.text().catch(() => '');
    console.error('[agents/run] settle write failed', dispatchId, w.status, t.slice(0, 300));
  }
}

// ─── 8. Schema-validate-and-retry loop ─────────────────────────────────────
// Per §5.2 step 8 (amended): increments schema_retry_count per Claude
// call attempt, not per final outcome.

async function runWithSchemaRetry({ agent, runArgs, retryBudget, forceError }) {
  let schema_retry_count = 0;
  let lastFailure = null;

  for (let attempt = 0; attempt <= retryBudget; attempt++) {
    // Test-only error injection. Gated by REPRO_SECRET on the caller; the
    // runtime trusts the body once the inter-edge HMAC is verified.
    if (forceError === 'edge_timeout') {
      return { ok: false, error: 'edge_timeout', stage: 'claude-call', schema_retry_count };
    }
    if (forceError === 'model_call_failed') {
      return { ok: false, error: 'model_call_failed', stage: 'claude-call',
               detail: 'test-force-error', schema_retry_count };
    }
    if (forceError === 'schema_validation_failed') {
      // Return a malformed artifact to exercise the retry loop AND the
      // final schema_validation_failed code when budget exhausted.
      schema_retry_count++;
      lastFailure = { ok: false, error: 'schema_validation_failed', stage: 'schema-validation',
                      detail: 'test-force-error', schema_retry_count };
      continue;
    }

    let result;
    try {
      result = await agent.run(runArgs);
    } catch (e) {
      return { ok: false, error: 'model_call_failed', stage: 'agent-throw',
               detail: String(e?.message || e).slice(0, 400), schema_retry_count };
    }

    // Surface-immediately codes: no retry value, exit the loop.
    if (!result?.ok) {
      return { ...result, schema_retry_count };
    }

    // Schema-validate. Per-attempt count increments only when the agent
    // returned ok:true (we're testing schema fidelity at this point).
    const validation = validateArtifact(result.content);
    if (validation.valid) {
      return { ...result, content: validation.content, schema_retry_count };
    }

    schema_retry_count++;
    lastFailure = {
      ok: false,
      error: 'schema_validation_failed',
      stage: 'schema-validation',
      detail: JSON.stringify(validation.errors).slice(0, 600),
      schema_retry_count,
    };
    // Loop continues if attempts remain.
  }

  return lastFailure;
}

// ─── Operator-notify helper for module-load latency warnings ──────────────
// Fires once per cold-boot. The registry collected warnings into
// LATENCY_BUDGET_WARNINGS at module load; the runtime fires them on the
// first dispatch so they reach the operator channel from a context with
// fetch available.
let _latencyWarningsFiredAt = 0;
async function fireRegistryLatencyWarnings() {
  if (LATENCY_BUDGET_WARNINGS.length === 0) return;
  if (_latencyWarningsFiredAt > 0) return; // already fired this boot
  _latencyWarningsFiredAt = Date.now();
  for (const w of LATENCY_BUDGET_WARNINGS) {
    // No await · operator-notify dedup handles repeats.
    sendOperatorNotification({
      reason: 'latency_budget_warning',
      agent_slug: w.slug,
      stage: 'registry-load',
      env_hint: `retry_budget=${w.retryBudget}, observed_avg_latency_ms=${w.observedLatencyMs}`,
      context: w.message,
    }).catch(e => console.error('[agents/run] latency-warning notify failed', e?.message));
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────

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
  const INTER_EDGE_SECRET = process.env.INTER_EDGE_SECRET;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
    return json(503, { ok: false, error: 'config_missing', stage: 'env' }, corsH);
  }

  // Read raw body once (HMAC verification needs it before JSON parse).
  let rawBody;
  try { rawBody = await req.text(); }
  catch { return json(400, { ok: false, error: 'invalid_body', stage: 'body-read' }, corsH); }

  let body;
  try { body = JSON.parse(rawBody); }
  catch { return json(400, { ok: false, error: 'invalid_body', stage: 'json-parse' }, corsH); }

  const { user_id, agent_slug, dispatch_id, artifact_id, trigger, runtime_args = {},
          source_artifact_id, force_error } = body || {};

  // ─── 1. Caller verification ────────────────────────────────────────────
  const userAuth = await verifyUserJwt(req, body, SUPABASE_URL, SUPABASE_ANON_KEY);
  let authMode = 'user';
  if (!userAuth.ok) {
    const serviceAuth = await verifyInterEdge(req, rawBody, INTER_EDGE_SECRET);
    if (!serviceAuth.ok) {
      return json(401, { ok: false, error: 'unauthorized',
                          stage: 'auth', detail: serviceAuth.reason || userAuth.reason }, corsH);
    }
    authMode = 'service';
  }

  if (!user_id || !UUID_RE.test(user_id)) {
    return json(400, { ok: false, error: 'invalid_user_id', stage: 'validate' }, corsH);
  }
  if (artifact_id && !UUID_RE.test(artifact_id)) {
    return json(400, { ok: false, error: 'invalid_artifact_id', stage: 'validate' }, corsH);
  }
  if (dispatch_id && !UUID_RE.test(dispatch_id)) {
    return json(400, { ok: false, error: 'invalid_dispatch_id', stage: 'validate' }, corsH);
  }

  // ─── 2. Resolve agent ──────────────────────────────────────────────────
  // getAgent reads test-agent env flags at REQUEST time per the chapter-3
  // step-3E flag-runtime-fix (Vercel Edge build-time vs runtime env-access
  // split). Real agents resolve from the frozen AGENTS map.
  const agent = getAgent(agent_slug);
  if (!agent) {
    return json(400, { ok: false, error: 'unknown_agent', stage: 'registry',
                        detail: `slug=${agent_slug}` }, corsH);
  }
  const meta = agent.META;

  // Fire the registry's collected latency warnings (one-time per boot).
  fireRegistryLatencyWarnings();

  // Fast-fail config_missing · ANTHROPIC_API_KEY is required for every
  // dispatch. Operator-notify fires immediately per §5.8.2.
  if (!ANTHROPIC_API_KEY) {
    sendOperatorNotification({
      reason: 'config_missing',
      agent_slug,
      stage: 'env',
      env_hint: 'ANTHROPIC_API_KEY',
      context: `dispatch_id=${dispatch_id || '<none>'}`,
    }).catch(e => console.error('[agents/run] config-missing notify failed', e?.message));
    return json(503, { ok: false, error: 'config_missing', stage: 'env' }, corsH);
  }

  // ─── 3. Resolve QBP source ────────────────────────────────────────────
  const { qbp, mode: qbpMode } = await resolveQbpSource({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId: user_id,
    runtime_args, sourceArtifactId: source_artifact_id,
  });

  // ─── 4. Load + validate inputs ────────────────────────────────────────
  const depSlugs = (meta.inputs?.artifact_dependencies || []);
  const dependencies = depSlugs.length > 0
    ? await loadDependencies({ supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY,
                                userId: user_id, depSlugs })
    : {};
  // Chapter 3 step 3D · runtime_args.files plumbing per Call 3 default.
  // The dispatcher (api/agents/rerun.js · or future endpoints) is
  // responsible for signing URLs and embedding them in runtime_args.files
  // before calling this endpoint. We trust the upstream auth (the JWT or
  // HMAC verified at this endpoint already gates dispatch). The validateInputs
  // call below asserts required-by-meta files are present by `type`; the
  // file_refs write at agent_runs captures the frozen inputs for replay.
  const files = Array.isArray(runtime_args?.files) ? runtime_args.files : [];

  const inputCheck = validateInputs({ meta, qbp, dependencies, files });

  // ─── 6. Open agent_runs row (always, even on missing_inputs · the run
  // row is the audit + replay record).
  const agentRunPayload = {
    user_id,
    artifact_id: artifact_id || null,
    agent_slug,
    agent_version: meta.version,
    trigger: trigger || 'manual',
    dispatch_id: dispatch_id || null,
    qbp_snapshot: qbp,
    file_refs: files,
    runtime_args,
    started_at: new Date().toISOString(),
    status: 'started',
    model: meta.model || DEFAULT_MODEL,
  };
  const runId = await openAgentRun({ supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY,
                                       payload: agentRunPayload });

  // Propagate agent_version to dispatch_jobs (per §11.12.1 a4).
  await propagateDispatchAgentVersion({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY,
    dispatchId: dispatch_id, agentVersion: meta.version,
  });

  // ─── 5. Fail early on missing inputs ──────────────────────────────────
  if (!inputCheck.ok) {
    const errorPayload = {
      code: inputCheck.code,
      stage: 'input-validation',
      missing_fields: inputCheck.missing_fields,
      missing_slug: inputCheck.missing_slug,
      missing_files: inputCheck.missing_files,
    };
    if (artifact_id) {
      await patchArtifact({
        supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact_id,
        patch: { status: 'failed', updated_at: new Date().toISOString() },
      });
    }
    await closeAgentRun({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, runId,
      patch: {
        status: 'failed',
        error_payload: errorPayload,
        completed_at: new Date().toISOString(),
        duration_ms: 0,
      },
    });
    await settleDispatch({ supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY,
                            dispatchId: dispatch_id, terminalOk: false });
    return json(200, { ok: false, error: inputCheck.code, stage: 'input-validation',
                        agent_runs_id: runId, ...errorPayload }, corsH);
  }

  // ─── 7. Flip artifact to generating ───────────────────────────────────
  if (artifact_id) {
    await patchArtifact({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact_id,
      patch: { status: 'generating', updated_at: new Date().toISOString() },
    });
  }

  // ─── 8. Run with schema-validate-and-retry ────────────────────────────
  const retryBudget = Number.isInteger(meta.retry_budget) ? meta.retry_budget : DEFAULT_RETRY_BUDGET;
  const t_run_start = Date.now();

  // test_force_error hook · gated to authMode==='service' only. The hook
  // exists so the §11.12.1 a3-live conformance suite can deterministically
  // trigger edge_timeout / model_call_failed / schema_validation_failed
  // paths without waiting for production to produce them. User-path callers
  // (JWT auth) cannot pass it. Service-path callers must hold INTER_EDGE_SECRET
  // to sign the inter-edge HMAC, which gates the conformance runner only.
  // Without this gate a hostile user could spam /api/agents/run with
  // test_force_error to churn dispatch_jobs through reaper retries.
  const forceError = authMode === 'service'
    ? (force_error || runtime_args?.test_force_error || null)
    : null;

  const result = await runWithSchemaRetry({
    agent,
    runArgs: { qbp, dependencies, files, runtime_args, anthropicKey: ANTHROPIC_API_KEY },
    retryBudget,
    forceError,
  });
  const duration_ms = Date.now() - t_run_start;

  // ─── 9 + 10. Persist outcome ──────────────────────────────────────────
  if (!result || !result.ok) {
    // Failure path · artifact failed, run failed, error_payload structured.
    const errorPayload = {
      code: result?.error || 'unknown',
      stage: result?.stage || 'unknown',
      detail: result?.detail || null,
      schema_retry_count: result?.schema_retry_count ?? 0,
    };
    if (artifact_id) {
      await patchArtifact({
        supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact_id,
        patch: { status: 'failed', updated_at: new Date().toISOString() },
      });
    }
    await closeAgentRun({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, runId,
      patch: {
        status: 'failed',
        error_payload: errorPayload,
        completed_at: new Date().toISOString(),
        duration_ms,
        schema_retry_count: result?.schema_retry_count ?? 0,
      },
    });
    await settleDispatch({ supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY,
                            dispatchId: dispatch_id, terminalOk: false });
    return json(200, { ok: false, error: errorPayload.code, stage: errorPayload.stage,
                        agent_runs_id: runId, schema_retry_count: errorPayload.schema_retry_count },
                  corsH);
  }

  // ─── 9. Success ───────────────────────────────────────────────────────
  if (artifact_id) {
    await patchArtifact({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, artifactId: artifact_id,
      patch: {
        status: 'delivered',
        content: result.content,
        updated_at: new Date().toISOString(),
      },
    });
  }
  await closeAgentRun({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, runId,
    patch: {
      status: 'succeeded',
      completed_at: new Date().toISOString(),
      duration_ms,
      tokens_in: result.meta?.tokens_in ?? null,
      tokens_out: result.meta?.tokens_out ?? null,
      schema_retry_count: result.schema_retry_count ?? 0,
    },
  });

  // Artifact-ready email · best-effort, non-blocking.
  if (RESEND_API_KEY && artifact_id && authMode === 'user') {
    sendReadyEmailBestEffort({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId: user_id,
      agentSlug: agent_slug, artifactId: artifact_id,
    }).catch(e => console.error('[agents/run] artifact-ready email failed', artifact_id, e?.message));
  }

  // ─── 11. Settle dispatch ──────────────────────────────────────────────
  await settleDispatch({ supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY,
                          dispatchId: dispatch_id, terminalOk: true });

  // ─── 11.5 Chain orchestration (step 8A) ──────────────────────────────
  // After successful delivery, fire any downstream agents whose
  // dependencies are now satisfied. Fan-out happens inside waitUntil so
  // the parent's 202 response is not blocked. DB-enforced idempotency
  // via the unique partial index on dispatch_jobs (chain_id, agent_slug)
  // where kind='chain' (migration 016).
  try {
    const chainBaseUrl = new URL(req.url).origin;
    waitUntil(
      triggerChainIfReady({
        supaUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        baseUrl: chainBaseUrl,
        userId: user_id,
        upstreamSlug: agent_slug,
        parentDispatchId: dispatch_id,
        interEdgeSecret: INTER_EDGE_SECRET,
        resendKey: RESEND_API_KEY,
      }).catch(e => {
        console.error('[run] chain-trigger threw', e?.message);
      })
    );
  } catch (e) {
    console.error('[run] chain-trigger setup threw', e?.message);
  }

  // ─── 12. Return ──────────────────────────────────────────────────────
  return json(200, {
    ok: true,
    agent_slug,
    artifact_id: artifact_id || null,
    agent_runs_id: runId,
    status: 'delivered',
    schema_retry_count: result.schema_retry_count ?? 0,
    qbp_source: qbpMode,
    duration_ms,
  }, corsH);
}

async function sendReadyEmailBestEffort({ supaUrl, serviceKey, userId, agentSlug, artifactId }) {
  const profRes = await fetch(
    `${supaUrl}/rest/v1/profiles?select=email,first_name&id=eq.${encodeURIComponent(userId)}`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!profRes.ok) return;
  const profile = (await profRes.json().catch(() => []))?.[0];
  if (!profile?.email) return;
  const agentVars = getAgentEmailVars(agentSlug);
  if (!agentVars) return;
  const vars = {
    ...agentVars,
    first_name: profile.first_name || 'there',
    artifact_url: `${ARTIFACT_URL_BASE}?id=${encodeURIComponent(artifactId)}`,
  };
  const tpl = EMAIL_TEMPLATES.ARTIFACT_READY;
  await sendEmail({
    to: profile.email,
    subject: tpl.subjectFor(vars),
    html: renderTemplate(tpl.html, vars),
    text: renderTemplate(tpl.text, vars),
    refId: tpl.refId,
  });
}
