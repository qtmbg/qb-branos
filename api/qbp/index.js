// QB BrandOS — GET /api/qbp
// Vercel Edge Function. Returns the user's live QBP document, lock state,
// and last-updated timestamp. No tier check: QBP is readable on all tiers.

import { cors, json, resolveUser, readProfile, svcHeaders, requireEnv } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

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

  // Best-effort: pull the latest qbp_revisions timestamp for the user. If the
  // table lookup fails (RLS, transient), fall back to profiles.updated_at.
  let lastRevisionAt = null;
  try {
    const r = await fetch(
      `${env.SUPABASE_URL}/rest/v1/qbp_revisions` +
      `?select=created_at&user_id=eq.${encodeURIComponent(authResult.user.id)}` +
      `&order=created_at.desc&limit=1`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      lastRevisionAt = rows?.[0]?.created_at || null;
    }
  } catch (_) {
    // intentional swallow; updated_at is the fallback
  }

  return json(200, {
    qbp: profile.qbp || {},
    foundation_locked_at: profile.foundation_locked_at || null,
    last_updated: lastRevisionAt || profile.updated_at || null,
  }, corsH);
}
