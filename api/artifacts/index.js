// QB BrandOS — GET /api/artifacts
// Returns the user's artifact list with computed `locked` flags. Never
// returns `content` (see /api/artifacts/[id] for the body).

import { cors, json, resolveUser, readProfile, svcHeaders, requireEnv } from '../_lib/auth.js';
import { canReadArtifact } from '../_lib/tier-gating.js';

export const config = { runtime: 'edge' };

const PHASE_RE = /^(00|01|02|03|04|05)$/;
const STATUS_RE = /^(queued|generating|delivered|failed)$/;

function titleFromContent(content, status) {
  if (status === 'queued' || status === 'generating') return 'Artifact (generating)';
  if (status === 'failed') return 'Artifact (failed)';
  if (content && typeof content === 'object' && content?.header?.title) {
    return String(content.header.title);
  }
  return 'Artifact';
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

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);

  const profile = await readProfile(authResult.user.id, env);
  if (!profile) return json(404, { error: 'Profile not found' }, corsH);

  const url = new URL(req.url);
  const phase = url.searchParams.get('phase') || '';
  const status = url.searchParams.get('status') || '';
  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  limit = Math.min(limit, 200);

  if (phase && !PHASE_RE.test(phase)) {
    return json(400, { error: 'Invalid phase' }, corsH);
  }
  if (status && !STATUS_RE.test(status)) {
    return json(400, { error: 'Invalid status' }, corsH);
  }

  const params = new URLSearchParams({
    select: 'id,artifact_type,phase,status,version,content,created_at,updated_at',
    user_id: `eq.${authResult.user.id}`,
    order: 'created_at.desc',
    limit: String(limit),
  });
  if (phase) params.set('phase', `eq.${phase}`);
  if (status) params.set('status', `eq.${status}`);

  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/artifacts?${params.toString()}`, {
    headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error('[artifacts] list fetch', r.status, t.slice(0, 200));
    return json(500, { error: 'Could not list artifacts' }, corsH);
  }
  const rows = await r.json().catch(() => []);

  const artifacts = rows.map(row => ({
    id: row.id,
    title: titleFromContent(row.content, row.status),
    agent_slug: row.artifact_type,
    phase: row.phase || null,
    status: row.status,
    version: row.version,
    created_at: row.created_at,
    locked: !canReadArtifact(profile.tier, row.artifact_type),
  }));

  return json(200, { artifacts }, corsH);
}
