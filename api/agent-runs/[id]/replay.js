// QB BrandOS · GET /api/agent-runs/[id]/replay
// Per CHAPTER_02_SPEC §5.3.1 · GET-only read surface that returns the
// frozen inputs for any agent_runs row the caller owns.
//
// Response shape:
//   {
//     id, agent_slug, agent_version, trigger, model,
//     qbp_snapshot, file_refs, runtime_args,
//     started_at, completed_at, duration_ms,
//     tokens_in, tokens_out, schema_retry_count,
//     artifact_id, artifact_version, artifact_status,
//     status, error_payload
//   }
//
// RLS-scoped to the caller via user_id filter on agent_runs.

import { cors, json, resolveUser, svcHeaders, requireEnv } from '../../_lib/auth.js';

export const config = { runtime: 'edge' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractIdFromPath(req) {
  const path = new URL(req.url).pathname;
  const m = path.match(/\/api\/agent-runs\/([^\/?]+)\/replay$/);
  return m ? m[1] : '';
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' }, corsH);

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  const runId = extractIdFromPath(req);
  if (!runId || !UUID_RE.test(runId)) {
    return json(404, { error: 'Run not found' }, corsH);
  }

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);
  const userId = authResult.user.id;

  // RLS scope · the SELECT filters on user_id even though we read with
  // service role · prevents leaking other users' runs.
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/agent_runs` +
    `?id=eq.${encodeURIComponent(runId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&select=id,agent_slug,agent_version,trigger,model,qbp_snapshot,file_refs,runtime_args,` +
    `started_at,completed_at,duration_ms,tokens_in,tokens_out,schema_retry_count,` +
    `artifact_id,status,error_payload,dispatch_id`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!r.ok) {
    return json(500, { error: 'Could not load run' }, corsH);
  }
  const rows = await r.json().catch(() => []);
  const run = rows?.[0];
  if (!run) return json(404, { error: 'Run not found' }, corsH);

  // Join artifact metadata (version + status) so the replay panel can
  // render the "produced version N" header.
  let artifact = null;
  if (run.artifact_id) {
    const ar = await fetch(
      `${env.SUPABASE_URL}/rest/v1/artifacts` +
      `?id=eq.${encodeURIComponent(run.artifact_id)}` +
      `&select=id,version,status`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    if (ar.ok) {
      const arows = await ar.json().catch(() => []);
      artifact = arows?.[0] || null;
    }
  }

  return json(200, {
    ok: true,
    id: run.id,
    agent_slug: run.agent_slug,
    agent_version: run.agent_version,
    trigger: run.trigger,
    model: run.model,
    qbp_snapshot: run.qbp_snapshot,
    file_refs: run.file_refs,
    runtime_args: run.runtime_args,
    started_at: run.started_at,
    completed_at: run.completed_at,
    duration_ms: run.duration_ms,
    tokens_in: run.tokens_in,
    tokens_out: run.tokens_out,
    schema_retry_count: run.schema_retry_count,
    status: run.status,
    error_payload: run.error_payload,
    artifact_id: run.artifact_id,
    artifact_version: artifact?.version || null,
    artifact_status: artifact?.status || null,
    dispatch_id: run.dispatch_id,
  }, corsH);
}
