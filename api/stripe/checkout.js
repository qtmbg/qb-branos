// QB BrandOS — POST /api/stripe/checkout
// Creates a Stripe Checkout Session for any of the three tiers, monthly or
// yearly. The full six-ID canonical USD price set is sellable as of the
// annual checkout ruling (operator, 2026-06-12). The webhook recognizes
// the same six IDs.
//
// The Checkout Session sets `client_reference_id` to the user id so the
// webhook (api/stripe-webhook.js) can map back without an email lookup.
// `metadata.tier_intent` records the target tier for audit; the interval
// is auditable from the price ID on the session itself.

import { cors, json, resolveUser, readProfile, requireEnv } from '../_lib/auth.js';

export const config = { runtime: 'edge' };

const TIER_BY_PRICE = {
  [process.env.STRIPE_STARTER_PRICE_ID        || 'price_1Th8JkEHEAcWrG55Abr1OZXe']: 'starter',
  [process.env.STRIPE_STARTER_ANNUAL_PRICE_ID || 'price_1Th8LVEHEAcWrG552aPNKRpD']: 'starter',
  [process.env.STRIPE_PRO_PRICE_ID            || 'price_1Th8MKEHEAcWrG55hxpLVfCZ']: 'pro',
  [process.env.STRIPE_PRO_ANNUAL_PRICE_ID     || 'price_1Th8N8EHEAcWrG55fk6a9vzt']: 'pro',
  [process.env.STRIPE_AGENCY_PRICE_ID         || 'price_1Th8OWEHEAcWrG55FNZKvxXY']: 'agency',
  [process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID  || 'price_1Th8QBEHEAcWrG55dNLosLZm']: 'agency',
};

// All three tiers sellable as of the USD pricing swap run (operator ruling,
// 2026-06-11). The earlier Chapter 10 deferral for Pro and Agency is closed.
const ENABLED_TIERS = new Set(['starter', 'pro', 'agency']);

const DEFAULT_SUCCESS = 'https://app.quantumbranding.ai/foundation?upgrade=success';
const DEFAULT_CANCEL  = 'https://app.quantumbranding.ai/paywall?cancelled=1';

function isHttpUrl(s) {
  return typeof s === 'string' && /^https?:\/\//.test(s);
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
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);

  let body;
  try { body = await req.json(); }
  catch { return json(400, { error: 'Invalid body' }, corsH); }

  const price_id    = String(body?.price_id || '').trim();
  const success_url = isHttpUrl(body?.success_url) ? body.success_url : DEFAULT_SUCCESS;
  const cancel_url  = isHttpUrl(body?.cancel_url)  ? body.cancel_url  : DEFAULT_CANCEL;

  if (!price_id) return json(400, { error: 'price_id is required' }, corsH);

  const tier = TIER_BY_PRICE[price_id];
  if (!tier) return json(400, { error: 'unknown_price_id' }, corsH);

  if (!ENABLED_TIERS.has(tier)) {
    return json(501, { error: 'tier_not_yet_available', tier }, corsH);
  }

  const profile = await readProfile(authResult.user.id, env);
  const email = profile?.email || authResult.user.email || '';

  // application/x-www-form-urlencoded — Stripe's API expects this content type.
  // Nested arrays use the [n] index syntax.
  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', price_id);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', success_url);
  form.set('cancel_url', cancel_url);
  form.set('client_reference_id', authResult.user.id);
  form.set('metadata[user_id]', authResult.user.id);
  form.set('metadata[tier_intent]', tier);
  if (email) form.set('customer_email', email);
  form.set('allow_promotion_codes', 'true');

  const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!sessionRes.ok) {
    const t = await sessionRes.text().catch(() => '');
    console.error('[checkout] stripe', sessionRes.status, t.slice(0, 400));
    return json(502, { error: 'stripe_error', status: sessionRes.status }, corsH);
  }
  const session = await sessionRes.json();

  if (!session?.url) {
    console.error('[checkout] missing session.url', JSON.stringify(session).slice(0, 200));
    return json(502, { error: 'stripe_returned_no_url' }, corsH);
  }

  // amount_total and currency ride along so callers and verification
  // harnesses can inspect the configured charge without a Stripe read key.
  return json(200, {
    checkout_url: session.url,
    session_id: session.id,
    amount_total: session.amount_total ?? null,
    currency: session.currency || null,
  }, corsH);
}
