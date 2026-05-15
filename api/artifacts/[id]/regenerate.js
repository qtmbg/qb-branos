// QB BrandOS — POST /api/artifacts/[id]/regenerate
// Triggers a new run of the agent that produced the source artifact.
// Tier-gating + in-flight detection here. The actual agent execution
// flows through /api/agents/dispatch, which handles version bump,
// parent_artifact_id linkage, schema validation, and artifact_runs logging.

import { cors, json, resolveUser, readProfile, svcHeaders, requireEnv } from '../../_lib/auth.js';
import { canRegenerate, lockedArtifactPayload } from '../../_lib/tier-gating.js';

export const config = { runtime: 'edge' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractIdFromPath(req) {
  const path = new URL(req.url).pathname;
  const m = path.match(/\/api\/artifacts\/([^\/?]+)\/regenerate$/);
  return m ? m[1] : '';
}

export default async function handler(req) {
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

  const id = extractIdFromPath(req);
  if (!id || !UUID_RE.test(id)) {
    return json(404, { error: 'Artifact not found' }, corsH);
  }

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);

  const profile = await readProfile(authResult.user.id, env);
  if (!profile) return json(404, { error: 'Profile not found' }, corsH);

  // Source artifact: ownership + agent slug + phase.
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?select=id,user_id,artifact_type,phase&id=eq.${encodeURIComponent(id)}`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!r.ok) return json(500, { error: 'Could not load artifact' }, corsH);
  const rows = await r.json().catch(() => []);
  const source = rows?.[0];
  if (!source || source.user_id !== authResult.user.id) {
    return json(404, { error: 'Artifact not found' }, corsH);
  }

  if (!canRegenerate(profile.tier, source.artifact_type, source.phase)) {
    return json(402, lockedArtifactPayload({
      id: source.id,
      title: null,
      agent_slug: source.artifact_type,
      phase: source.phase,
    }, 'regenerate'), corsH);
  }

  // In-flight detection: refuse if any row for the same (user_id, artifact_type)
  // is currently queued or generating. Prevents queue pollution.
  const inFlightRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${authResult.user.id}` +
    `&artifact_type=eq.${encodeURIComponent(source.artifact_type)}` +
    `&status=in.(queued,generating)` +
    `&select=id,status&limit=1`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (inFlightRes.ok) {
    const inFlight = await inFlightRes.json().catch(() => []);
    if (Array.isArray(inFlight) && inFlight.length > 0) {
      return json(409, {
        error: 'previous_run_in_flight',
        current_status: inFlight[0].status,
      }, corsH);
    }
  }

  // Hand off to /api/agents/dispatch on the same origin. Dispatch handles
  // the new version row, parent_artifact_id linkage, validate-before-save,
  // and artifact_runs row writes.
  const base = new URL(req.url).origin;
  const dispatchRes = await fetch(`${base}/api/agents/dispatch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authResult.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: authResult.user.id,
      qbp: profile.qbp || {},
      agentName: source.artifact_type,
    }),
  });
  const dispatchData = await dispatchRes.json().catch(() => ({}));

  if (!dispatchRes.ok || !dispatchData.ok) {
    console.error('[regenerate] dispatch failed', dispatchRes.status, JSON.stringify(dispatchData).slice(0, 300));
    return json(502, {
      error: 'dispatch_failed',
      detail: dispatchData?.error || `status ${dispatchRes.status}`,
    }, corsH);
  }

  return json(200, {
    new_artifact_id: dispatchData.artifact_id,
    version: dispatchData.version,
    status: dispatchData.status || 'queued',
  }, corsH);
}
