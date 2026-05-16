// QB BrandOS · POST /api/agents/rerun
//
// Per PR #78 audit item 3 (structural call B). Routes Console rerun CTAs
// through the contract-conformant runtime path instead of the legacy
// /api/artifacts/[id]/regenerate endpoint, so reruns during the step 5 →
// step 6 gap write agent_runs and dispatch_jobs rows that conform to the
// §3.5 contract (model field, retry_budget=0 semantics, structured
// error_payload, agent_version writes).
//
// This is effectively the minimum-viable surface of §13 step 7 (regenerate
// endpoint refactor). When step 7 opens, its spec starts from this
// endpoint and hardens it (full Content-Approval-Loop semantics, feedback
// runtime_args, etc); /api/artifacts/[id]/regenerate retires at that point.
//
// Flow per spec §5.3:
//   1. Verify JWT, extract user_id
//   2. Parse body { artifact_id, qbp_source } · qbp_source defaults 'current'
//   3. Load source artifact, verify ownership + status='delivered'
//   4. Resolve agent_slug from artifacts.artifact_type, look up META
//   5. Insert dispatch_jobs row · kind='regenerate', agents_count=1,
//      trigger='regenerate', agent_version=META.version
//   6. Insert new artifacts row · version=source.version+1,
//      parent_artifact_id=source.id, status='queued', dispatch_id=new
//   7. context.waitUntil(fetch /api/agents/run with JWT) · same-user JWT
//      flows through · /api/agents/run authMode='user', force_error
//      stays HMAC-gated and ignored (per PR #75 fix)
//   8. Return 202 with { ok, dispatch_id, artifact_id, version }
//
// /api/agents/run does NOT insert artifact rows · it PATCHes the existing
// row through queued → generating → delivered/failed. This endpoint owns
// the artifact-creation step; the runtime owns the lifecycle thereafter.

import { cors, json, resolveUser, svcHeaders, requireEnv } from '../_lib/auth.js';
import { AGENTS } from '../../agents/registry.js';

export const config = { runtime: 'edge' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' }, corsH);

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  // ─── 1. JWT verify ─────────────────────────────────────────────────────
  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);
  const userId = authResult.user.id;

  // Pass the original Authorization header through to /api/agents/run so
  // the runtime sees the same JWT and resolves authMode='user'.
  const authHeader = req.headers.get('authorization') || '';

  // ─── 2. Parse body ─────────────────────────────────────────────────────
  let body;
  try { body = await req.json(); }
  catch { return json(400, { error: 'invalid_body' }, corsH); }

  const { artifact_id, qbp_source } = body || {};
  if (!artifact_id || !UUID_RE.test(artifact_id)) {
    return json(400, { error: 'invalid_artifact_id' }, corsH);
  }
  const resolvedSource = qbp_source === 'original' ? 'original' : 'current';

  // ─── 3. Load source artifact ──────────────────────────────────────────
  const srcRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?id=eq.${encodeURIComponent(artifact_id)}` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&select=id,user_id,artifact_type,phase,version,status`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!srcRes.ok) return json(500, { error: 'source_lookup_failed' }, corsH);
  const srcRows = await srcRes.json().catch(() => []);
  const source = srcRows?.[0];
  if (!source) return json(404, { error: 'artifact_not_found' }, corsH);
  if (source.status !== 'delivered') {
    return json(409, { error: 'source_not_delivered', current_status: source.status }, corsH);
  }

  // ─── 4. Resolve agent META ────────────────────────────────────────────
  const slug = source.artifact_type;
  const agent = AGENTS[slug];
  if (!agent) return json(400, { error: 'unknown_agent', agent_slug: slug }, corsH);

  // ─── 5. Insert dispatch_jobs row ──────────────────────────────────────
  const djRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/dispatch_jobs`,
    {
      method: 'POST',
      headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        kind: 'regenerate',
        status: 'producing',
        agents_count: 1,
        agents_settled: 0,
        trigger: 'regenerate',
        agent_version: agent.META.version,
      }),
    }
  );
  if (!djRes.ok) {
    const t = await djRes.text().catch(() => '');
    return json(500, { error: 'dispatch_insert_failed', detail: t.slice(0, 200) }, corsH);
  }
  const dj = (await djRes.json().catch(() => []))?.[0];
  const dispatchId = dj?.id;
  if (!dispatchId) return json(500, { error: 'dispatch_insert_returned_no_id' }, corsH);

  // ─── 6. Insert new artifacts row ─────────────────────────────────────
  const artRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts`,
    {
      method: 'POST',
      headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        artifact_type: slug,
        status: 'queued',
        version: (Number(source.version) || 1) + 1,
        parent_artifact_id: source.id,
        phase: source.phase || agent.META.phase,
        content: {},
        error: null,
        dispatch_id: dispatchId,
      }),
    }
  );
  if (!artRes.ok) {
    const t = await artRes.text().catch(() => '');
    return json(500, { error: 'artifact_insert_failed', detail: t.slice(0, 200) }, corsH);
  }
  const newArt = (await artRes.json().catch(() => []))?.[0];
  if (!newArt?.id) return json(500, { error: 'artifact_insert_returned_no_id' }, corsH);

  // ─── 7. Fire /api/agents/run via waitUntil (Option A pattern) ────────
  // Same-origin call · the runtime sees the user's JWT and resolves
  // authMode='user'. force_error is gated to authMode='service' and stays
  // un-honored here (the rerun path never triggers synthetic failures).
  const base = new URL(req.url).origin;
  const runBody = JSON.stringify({
    user_id: userId,
    agent_slug: slug,
    dispatch_id: dispatchId,
    artifact_id: newArt.id,
    trigger: 'regenerate',
    runtime_args: { qbp_source: resolvedSource },
    source_artifact_id: source.id,
  });

  const runFetch = fetch(`${base}/api/agents/run`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: runBody,
  }).catch(e => {
    // Logged for operator visibility · the artifact row stays in queued
    // state and the reaper (§5.5) picks it up at the next tick.
    console.error('[agents/rerun] runFetch threw', e?.message);
  });

  // context.waitUntil keeps the Edge function alive past the 202 return
  // so the runFetch can establish + complete · the Option A defense
  // against the PR #59 parent-context-teardown cancellation. Without
  // this, the same fire-and-forget pattern that PR #59 produced 6/10
  // stuck rate on would silently fail here.
  try {
    if (context && typeof context.waitUntil === 'function') {
      context.waitUntil(runFetch);
    } else {
      // Local dev / non-Vercel runtimes: no waitUntil available · await
      // the call so the response is delayed but correct. Production
      // Vercel always supplies context.waitUntil; this branch is purely
      // a local-test safety net.
      await runFetch;
    }
  } catch (e) {
    console.error('[agents/rerun] waitUntil hookup failed', e?.message);
  }

  // ─── 8. Return 202 ─────────────────────────────────────────────────────
  return json(202, {
    ok: true,
    dispatch_id: dispatchId,
    artifact_id: newArt.id,
    version: newArt.version,
    agent_slug: slug,
    qbp_source: resolvedSource,
  }, corsH);
}
