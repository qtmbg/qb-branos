// QB BrandOS · POST /api/files/sign-url
//
// Chapter 3 · Step 3C · per chapter-03/step-3-spec.md §1 (Bucket + RLS)
// and §3 sub-PR 3C.
//
// Mints a 1-hour signed READ URL for a single user-uploads path. Two
// auth paths:
//   A) User JWT: bearer Supabase JWT. The endpoint verifies the JWT via
//      /auth/v1/user (NOT self-decoded · per chapter-2 #105 cure) and
//      confirms the path's first folder segment equals the resolved
//      user's UUID.
//   B) Inter-edge HMAC: X-Inter-Edge-Signature + X-Inter-Edge-Timestamp
//      with INTER_EDGE_SECRET. The body MUST include user_id; the
//      endpoint confirms the path's first folder segment equals body
//      user_id. Used by dispatchers (rerun, lock-foundation, chain-
//      trigger) that already verified user JWT upstream and now need
//      to embed signed URLs in runtime_args.files.
//
// In both paths, the endpoint refuses to sign any path whose first
// folder segment does not match the verified user id. Service role
// is used ONLY for the Storage admin call · ownership is enforced
// at the application layer before the bypass-RLS call.
//
// Body:
//   { path: "user-uploads/{user_id}/{file_id}.{ext}", ttl_seconds?: 3600 }
//   user_id required ONLY when using HMAC auth path.
//
// Returns 200 { ok, signed_url, expires_at, path }
//          400 invalid body / invalid path / mismatched user
//          401 unauthorized
//          404 file not found
//          503 config_missing
//
// Edge runtime · pure ESM · no deps.

import { BUCKET, SIGNED_URL_TTL_SECONDS, parseUserUploadPath } from './_lib/file-config.js';

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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Inter-Edge-Signature, X-Inter-Edge-Timestamp',
    'Vary': 'Origin',
  };
}

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

// JWT verification via /auth/v1/user round-trip. NEVER self-decode JWT
// payload · per chapter-2 #105 cure.
async function verifyUserJwt(req, supaUrl, anonKey) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, reason: 'no-token' };
  const r = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { ok: false, reason: 'invalid-session' };
  const user = await r.json().catch(() => null);
  if (!user?.id) return { ok: false, reason: 'invalid-session' };
  return { ok: true, user_id: user.id };
}

// HMAC verification · mirrors api/agents/run.js verifyInterEdge exactly.
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

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsH });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const INTER_EDGE_SECRET = process.env.INTER_EDGE_SECRET;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
    return json(503, { ok: false, error: 'config_missing' }, corsH);
  }

  // Read raw body once · HMAC needs it before JSON parse.
  let rawBody;
  try { rawBody = await req.text(); }
  catch { return json(400, { ok: false, error: 'invalid_body', stage: 'body-read' }, corsH); }

  let body;
  try { body = JSON.parse(rawBody); }
  catch { return json(400, { ok: false, error: 'invalid_body', stage: 'json-parse' }, corsH); }

  const { path, user_id: bodyUserId, ttl_seconds } = body || {};

  if (typeof path !== 'string' || !path) {
    return json(400, { ok: false, error: 'invalid_path' }, corsH);
  }

  const parsed = parseUserUploadPath(path);
  if (!parsed) {
    return json(400, { ok: false, error: 'invalid_path', detail: 'path must be user-uploads/{user_id}/{file_segment}' }, corsH);
  }

  // ─── Auth · user JWT first, HMAC fallback ──────────────────────────
  let verifiedUserId = null;
  const userAuth = await verifyUserJwt(req, SUPABASE_URL, SUPABASE_ANON_KEY);
  if (userAuth.ok) {
    verifiedUserId = userAuth.user_id;
  } else {
    const serviceAuth = await verifyInterEdge(req, rawBody, INTER_EDGE_SECRET);
    if (!serviceAuth.ok) {
      return json(401, {
        ok: false,
        error: 'unauthorized',
        detail: serviceAuth.reason || userAuth.reason,
      }, corsH);
    }
    // Service path requires body.user_id; the dispatcher upstream has
    // already verified the user owns the file. We trust that and use
    // body.user_id to enforce the path-matches-user invariant below.
    if (typeof bodyUserId !== 'string' || !bodyUserId) {
      return json(400, { ok: false, error: 'invalid_user_id', detail: 'service path requires body.user_id' }, corsH);
    }
    verifiedUserId = bodyUserId;
  }

  // ─── Ownership check ───────────────────────────────────────────────
  // The path's first folder segment MUST equal the verified user id.
  // Same shape the bucket RLS enforces, asserted here at the application
  // layer because the next call uses service role (which bypasses RLS).
  if (parsed.userId !== verifiedUserId) {
    return json(401, {
      ok: false,
      error: 'unauthorized',
      detail: 'path does not belong to caller',
    }, corsH);
  }

  // ─── Mint signed URL via Supabase Storage admin API ────────────────
  const ttl = Number.isInteger(ttl_seconds) && ttl_seconds > 0 && ttl_seconds <= SIGNED_URL_TTL_SECONDS
    ? ttl_seconds
    : SIGNED_URL_TTL_SECONDS;

  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodeURI(parsed.objectName)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: ttl }),
    }
  );

  if (!signRes.ok) {
    const body = await signRes.text().catch(() => '');
    if (signRes.status === 404) {
      return json(404, { ok: false, error: 'file_not_found', path }, corsH);
    }
    console.error('[files/sign-url] sign failed', signRes.status, body.slice(0, 300));
    return json(500, { ok: false, error: 'sign_failed', status: signRes.status }, corsH);
  }

  const signData = await signRes.json().catch(() => ({}));
  // Supabase returns { signedURL: "/object/sign/{bucket}/{path}?token=..." }
  // The full URL is SUPABASE_URL + signedURL.
  const relative = signData.signedURL || signData.signedUrl || '';
  if (!relative) {
    return json(500, { ok: false, error: 'sign_no_url' }, corsH);
  }
  const signed_url = `${SUPABASE_URL}${relative}`;
  const expires_at = new Date(Date.now() + ttl * 1000).toISOString();

  return json(200, {
    ok: true,
    signed_url,
    expires_at,
    ttl_seconds: ttl,
    path: `${BUCKET}/${parsed.objectName}`,
  }, corsH);
}
