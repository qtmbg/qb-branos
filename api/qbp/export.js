// QB BrandOS — POST /api/qbp/export
// Vercel Edge Function. Generates a downloadable QBP file, uploads it to a
// per-user folder in Supabase Storage (qbp-exports bucket), and returns a
// 1-hour signed URL.
//
// PDF generation note: pure-Edge PDF libraries that work without a build
// step are limited, and the repo discipline is "no build, minimal deps".
// Per CHAPTER_01_SPEC step 7.3 ("If neither option works cleanly in Edge
// runtime within the scope of this step, fall back to: build the QBP as
// a downloadable JSON file with a `.json` extension for now"), this
// implementation ships JSON. PDF rendering is logged as deferred to a
// Chapter 1 polish pass and tracked in the step-7 verification report.

import { cors, json, resolveUser, readProfile, svcHeaders, requireEnv } from '../_lib/auth.js';
import { canExportQbp, exportGatedPayload } from '../_lib/tier-gating.js';

export const config = { runtime: 'edge' };

const BUCKET = 'qbp-exports';
const SIGNED_URL_EXPIRES_S = 3600; // 1 hour

function slugify(s) {
  return String(s || 'brand')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'brand';
}

function isoDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function ensureBucket(env) {
  // Create the bucket if it does not exist. Idempotent on the storage API.
  // Bucket is private; access is granted via signed URLs only.
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  if (r.ok) return true;
  // Storage REST returns HTTP 400 with body.statusCode === '404' when the
  // bucket is missing — not a real HTTP 404. Always attempt creation when
  // GET is not 200; POST is idempotent (returns 409 with name=Duplicate
  // when the bucket already exists, which a follow-up GET resolves).

  const create = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: 10485760,
    }),
  });
  if (create.ok) return true;

  // Race or pre-existing bucket — verify with a fresh GET.
  const verify = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  return verify.ok;
}

async function uploadFile(env, path, bodyText, contentType) {
  const url = `${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: bodyText,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`upload ${r.status} ${t.slice(0, 300)}`);
  }
}

async function createSignedUrl(env, path) {
  const r = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRES_S }),
    }
  );
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`sign ${r.status} ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  // Supabase returns { signedURL: '/object/sign/...?token=...' } (relative);
  // prepend the storage origin so the caller has an absolute URL.
  const signed = data.signedURL || data.signedUrl || '';
  if (!signed) throw new Error('sign: empty signedURL');
  return `${env.SUPABASE_URL}/storage/v1${signed}`;
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

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);

  const profile = await readProfile(authResult.user.id, env);
  if (!profile) return json(404, { error: 'Profile not found' }, corsH);

  if (!canExportQbp(profile.tier)) {
    return json(402, exportGatedPayload(), corsH);
  }

  const bucketOk = await ensureBucket(env);
  if (!bucketOk) {
    return json(500, { error: 'Storage bucket unavailable' }, corsH);
  }

  const brandSlug = slugify(profile.qbp?.brandName || profile.first_name || 'brand');
  const filename = `qbp-${brandSlug}-${isoDate()}.json`;
  const objectPath = `${authResult.user.id}/${Date.now()}-${filename}`;

  const bodyJson = JSON.stringify({
    schema_version: '1.0',
    exported_at: new Date().toISOString(),
    user_id: authResult.user.id,
    brand_name: profile.qbp?.brandName || null,
    foundation_locked_at: profile.foundation_locked_at || null,
    qbp: profile.qbp || {},
  }, null, 2);

  try {
    await uploadFile(env, objectPath, bodyJson, 'application/json');
  } catch (e) {
    console.error('[qbp/export] upload failed', e?.message);
    return json(500, { error: 'Upload failed' }, corsH);
  }

  let signed_url;
  try {
    signed_url = await createSignedUrl(env, objectPath);
  } catch (e) {
    console.error('[qbp/export] sign failed', e?.message);
    return json(500, { error: 'Could not sign URL' }, corsH);
  }

  return json(200, {
    signed_url,
    expires_at: new Date(Date.now() + SIGNED_URL_EXPIRES_S * 1000).toISOString(),
    filename,
    format: 'json',
    format_note: 'PDF export deferred to Chapter 1 polish pass; JSON ships full QBP content.',
  }, corsH);
}
