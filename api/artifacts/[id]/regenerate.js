// QB BrandOS · POST /api/artifacts/[id]/regenerate
//
// Refactored to Option A per chapter-02/step-6-spec.md §5. Single-agent
// dispatch through the shared dispatch-pattern helper · same invariants
// as /api/lock-foundation. The endpoint is kept alive until step 14 per
// the spec adjudication, with an X-Deprecated header on every response
// so any remaining caller surfaces in observability between this merge
// and the step 14 sweep. Audit at PR #83 time showed zero active callers;
// Console rerun CTAs route through /api/agents/rerun.
//
// Body: { qbp_source?: 'current' | 'original' }
//   - 'current'  (default): /api/agents/run reads profiles.qbp at dispatch time
//   - 'original': /api/agents/run reads profiles.foundation_lock_qbp · 422
//                 with error.code='no_original_snapshot' if foundation_lock_qbp
//                 is null (Chapter 1 legacy artifact).
//
// Flow:
//   1. Verify caller JWT, load profile.
//   2. Look up source artifact (ownership + agent slug + phase).
//   3. Tier-gating.
//   4. In-flight detection (same user + slug currently queued or generating).
//   5. qbp_source resolution · 422 here if 'original' AND no lock snapshot.
//   6. Compute next version = max(existing version for user+slug) + 1.
//   7. preInsertDispatch · dispatch_jobs (status='producing', kind='regenerate',
//      agents_count=1) + one artifacts row (status='queued', parent_artifact_id
//      = source.id, version = next).
//   8. fireChildRuns([one child]) with the user's JWT pass-through.
//   9. holdOpenForChildren · Vercel waitUntil.
//  10. Return 202 with { ok, dispatch_id, artifact_id, version, qbp_source }.

import { cors, json, resolveUser, readProfile, svcHeaders, requireEnv } from '../../_lib/auth.js';
import { canRegenerate, lockedArtifactPayload } from '../../_lib/tier-gating.js';
import {
  preInsertDispatch,
  fireChildRuns,
  holdOpenForChildren,
  rollbackDispatchJob,
} from '../../_lib/dispatch-pattern.js';

export const config = { runtime: 'edge' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEPRECATION_HEADER = 'replaced by /api/agents/rerun, retires step 14';

function extractIdFromPath(req) {
  const path = new URL(req.url).pathname;
  const m = path.match(/\/api\/artifacts\/([^\/?]+)\/regenerate$/);
  return m ? m[1] : '';
}

// Every response from this endpoint carries the deprecation header so log
// scrapers can detect remaining callers before step 14. Wraps the json()
// helper from auth.js · same shape, plus one header.
function withDeprecation(response) {
  const h = new Headers(response.headers);
  h.set('X-Deprecated', DEPRECATION_HEADER);
  return new Response(response.body, { status: response.status, headers: h });
}
function jsonD(status, body, corsH) {
  return withDeprecation(json(status, body, corsH));
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') {
    return withDeprecation(new Response(null, { status: 204, headers: corsH }));
  }
  if (req.method !== 'POST') {
    return jsonD(405, { error: 'method_not_allowed' }, corsH);
  }

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return jsonD(503, { error: `not_configured: ${missing}` }, corsH);

  const id = extractIdFromPath(req);
  if (!id || !UUID_RE.test(id)) {
    return jsonD(404, { error: 'artifact_not_found' }, corsH);
  }

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return jsonD(authResult.status, { error: authResult.error }, corsH);
  const userId = authResult.user.id;
  const userJwt = authResult.token;

  const profile = await readProfile(userId, env);
  if (!profile) return jsonD(404, { error: 'profile_not_found' }, corsH);

  // 2. Source artifact · ownership + agent slug + phase.
  const srcRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?select=id,user_id,artifact_type,phase&id=eq.${encodeURIComponent(id)}`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!srcRes.ok) return jsonD(500, { error: 'source_lookup_failed' }, corsH);
  const srcRows = await srcRes.json().catch(() => []);
  const source = srcRows?.[0];
  if (!source || source.user_id !== userId) {
    return jsonD(404, { error: 'artifact_not_found' }, corsH);
  }

  // 3. Tier-gating.
  if (!canRegenerate(profile.tier, source.artifact_type, source.phase)) {
    return jsonD(402, lockedArtifactPayload({
      id: source.id,
      title: null,
      agent_slug: source.artifact_type,
      phase: source.phase,
    }, 'regenerate'), corsH);
  }

  // 4. In-flight detection · refuse if any row for the same (user_id,
  // artifact_type) is currently queued or generating. Prevents queue
  // pollution from a double-click.
  const inFlightRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${userId}` +
    `&artifact_type=eq.${encodeURIComponent(source.artifact_type)}` +
    `&status=in.(queued,generating,producing,started)` +
    `&select=id,status&limit=1`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (inFlightRes.ok) {
    const inFlight = await inFlightRes.json().catch(() => []);
    if (Array.isArray(inFlight) && inFlight.length > 0) {
      return jsonD(409, {
        error: 'previous_run_in_flight',
        current_status: inFlight[0].status,
      }, corsH);
    }
  }

  // 5. qbp_source resolution. Body is optional; default 'current'.
  let body = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const qbpSource = body && body.qbp_source === 'original' ? 'original' : 'current';
  if (qbpSource === 'original') {
    // foundation_lock_qbp is null for Chapter 1 legacy artifacts. Refuse here
    // so /api/agents/run does not receive an empty snapshot. Spec §5.3.
    const lockRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?select=foundation_lock_qbp&id=eq.${userId}`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    const lockRows = lockRes.ok ? (await lockRes.json().catch(() => [])) : [];
    const lockSnap = lockRows?.[0]?.foundation_lock_qbp;
    if (!lockSnap || (typeof lockSnap === 'object' && Object.keys(lockSnap).length === 0)) {
      return jsonD(422, {
        ok: false,
        error: { code: 'no_original_snapshot', message: 'foundation_lock_qbp is empty; use qbp_source=current' },
      }, corsH);
    }
  }

  // 6. Next version · max existing version for (user_id, artifact_type) + 1.
  const verRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${userId}` +
    `&artifact_type=eq.${encodeURIComponent(source.artifact_type)}` +
    `&select=version&order=version.desc&limit=1`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  const verRows = verRes.ok ? (await verRes.json().catch(() => [])) : [];
  const nextVersion = (verRows?.[0]?.version || 0) + 1;

  // 7. Pre-insert dispatch_jobs + the new artifact row. Spec §4.2 invariant
  // 1: pre-insert happens BEFORE any child fetch fires.
  let dispatchId;
  let artifactMap;
  try {
    const result = await preInsertDispatch({
      supaUrl: env.SUPABASE_URL,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
      userId,
      kind: 'regenerate',
      trigger: 'regenerate',
      agentVersion: null,
      artifacts: [{
        slug: source.artifact_type,
        version: nextVersion,
        parent_artifact_id: source.id,
        phase: source.phase,
      }],
    });
    dispatchId = result.dispatchId;
    artifactMap = result.artifacts;
  } catch (e) {
    console.error('[regenerate] pre-insert failed', e?.message);
    return jsonD(500, {
      ok: false,
      error: 'dispatch_preinsert_failed',
      detail: String(e?.message || '').slice(0, 200),
    }, corsH);
  }

  // 8. Fire one child run via /api/agents/run. JWT pass-through so the
  // runtime resolves authMode='user' and writes qbp_snapshot from the
  // user's actual qbp (or foundation_lock_qbp per qbp_source).
  const baseUrl = new URL(req.url).origin;
  const children = [{
    user_id: userId,
    agent_slug: source.artifact_type,
    dispatch_id: dispatchId,
    artifact_id: artifactMap[source.artifact_type].id,
    trigger: 'regenerate',
    runtime_args: { qbp_source: qbpSource },
    source_artifact_id: source.id,
  }];

  let childPromises;
  try {
    childPromises = await fireChildRuns({
      baseUrl,
      children,
      userAuthHeader: `Bearer ${userJwt}`,
    });
  } catch (e) {
    console.error('[regenerate] fireChildRuns setup failed', e?.message);
    await rollbackDispatchJob({
      supaUrl: env.SUPABASE_URL,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
      dispatchId,
    });
    return jsonD(500, {
      ok: false,
      error: 'dispatch_fire_failed',
      detail: String(e?.message || '').slice(0, 200),
    }, corsH);
  }

  // 9. Hold the Edge function open via waitUntil.
  const localPending = holdOpenForChildren({ childPromises });

  // 10. Return 202 before the child resolves. Console sees:
  //   - dispatch_jobs.status = 'producing'
  //   - new artifact row in 'queued' with parent_artifact_id = source.id
  //   - readLatestDeliveredArtifact still returns v1 (delivered)
  //   - inflight_dispatch_id from v2 surfaces independently (Case C resolution)
  const newArt = artifactMap[source.artifact_type];

  if (localPending) await localPending;

  return jsonD(202, {
    ok: true,
    dispatch_id: dispatchId,
    artifact_id: newArt.id,
    version: newArt.version,
    qbp_source: qbpSource,
  }, corsH);
}
