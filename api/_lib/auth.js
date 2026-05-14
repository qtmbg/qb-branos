// QB BrandOS — Shared request helpers (auth + CORS + JSON + Supabase REST).
// Pure ESM. Edge-runtime safe.

const ALLOWED_ORIGINS = new Set([
  'https://quantumbranding.ai',
  'https://www.quantumbranding.ai',
  'https://app.quantumbranding.ai',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

export function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://quantumbranding.ai';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function svcHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Resolve the user identified by the inbound JWT.
 *
 * @returns {Promise<{ok:true,user:object,token:string} | {ok:false,status:number,error:string}>}
 */
export async function resolveUser(req, env) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: 'Missing authorization' };

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, status: 401, error: 'Invalid session' };
  const user = await res.json();
  if (!user?.id) return { ok: false, status: 401, error: 'Invalid session' };
  return { ok: true, user, token };
}

/**
 * Read the user's profile row (tier, email, name, qbp).
 * Returns null on miss without throwing.
 */
export async function readProfile(userId, env) {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles` +
    `?select=id,email,first_name,tier,tier_started_at,foundation_locked_at,qbp,updated_at` +
    `&id=eq.${encodeURIComponent(userId)}`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return rows?.[0] || null;
}

export function requireEnv(env, ...names) {
  for (const n of names) {
    if (!env[n]) return n;
  }
  return null;
}
