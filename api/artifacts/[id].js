// QB BrandOS — GET /api/artifacts/[id]
// Returns the full artifact row for the authenticated user. Tier-gating
// is enforced server-side. Locked artifacts return 402 with header
// metadata only (never the content body).

import { cors, json, resolveUser, readProfile, svcHeaders, requireEnv } from '../_lib/auth.js';
import { canReadArtifact, lockedArtifactPayload } from '../_lib/tier-gating.js';

export const config = { runtime: 'edge' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractIdFromPath(req) {
  const path = new URL(req.url).pathname;
  const m = path.match(/\/api\/artifacts\/([^\/?]+)$/);
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

  const id = extractIdFromPath(req);
  if (!id || !UUID_RE.test(id)) {
    // Do not leak whether the id is malformed vs missing — same response.
    return json(404, { error: 'Artifact not found' }, corsH);
  }

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);

  const profile = await readProfile(authResult.user.id, env);
  if (!profile) return json(404, { error: 'Profile not found' }, corsH);

  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/artifacts` +
    `?select=id,user_id,artifact_type,phase,status,version,parent_artifact_id,content,error,created_at,updated_at` +
    `&id=eq.${encodeURIComponent(id)}`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!r.ok) {
    return json(500, { error: 'Could not load artifact' }, corsH);
  }
  const rows = await r.json().catch(() => []);
  const row = rows?.[0];

  // 404 on missing OR not-owned. Same response so existence is not leaked.
  if (!row || row.user_id !== authResult.user.id) {
    return json(404, { error: 'Artifact not found' }, corsH);
  }

  if (!canReadArtifact(profile.tier, row.artifact_type)) {
    return json(402, lockedArtifactPayload({
      id: row.id,
      title: row.content?.header?.title || null,
      agent_slug: row.artifact_type,
      phase: row.phase,
    }, 'artifact'), corsH);
  }

  return json(200, {
    id: row.id,
    artifact_type: row.artifact_type,
    agent_slug: row.artifact_type,
    phase: row.phase,
    status: row.status,
    version: row.version,
    parent_artifact_id: row.parent_artifact_id,
    content: row.content,
    error: row.error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }, corsH);
}
