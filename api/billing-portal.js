// QB BrandOS — Stripe Billing Portal session creator
// Vercel Edge Function
//
// POST /api/billing-portal
//   Authorization: Bearer <supabase-access-token>
//   { return_url?: string }
//
//   → { url } on success
//   → 401 / 404 / 500 otherwise
//
// Required env vars:
//   STRIPE_SECRET_KEY   — restricted key with billing_portal:write
//   SUPABASE_URL        — for the auth + profile lookup
//   SUPABASE_ANON_KEY   — public anon key (used as apikey header alongside the
//                         user JWT; RLS keeps the profile lookup to that user)
//
// Stripe Dashboard setup:
//   1. Settings → Billing → Customer Portal → enable and configure
//   2. Allowed return URLs: https://app.quantumbranding.ai/os

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      }
    });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL      = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Billing portal not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const returnUrl = body.return_url || 'https://app.quantumbranding.ai/os';

  // Step 1: ask Supabase who this token belongs to. The /auth/v1/user endpoint
  // validates the JWT and returns the auth.user row.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const user = await userRes.json();
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Step 2: read the profile row for this user. RLS restricts to their own row
  // (auth.uid() = id) so we pass the user's own token through.
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=stripe_customer_id&id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    }
  );
  if (!profRes.ok) {
    return new Response(JSON.stringify({ error: 'Profile lookup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const profiles = await profRes.json();
  const stripeCustomerId = profiles?.[0]?.stripe_customer_id;
  if (!stripeCustomerId) {
    return new Response(JSON.stringify({ error: 'No active subscription' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Step 3: create a portal session. Stripe expects x-www-form-urlencoded.
  const form = new URLSearchParams();
  form.set('customer', stripeCustomerId);
  form.set('return_url', returnUrl);

  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  if (!portalRes.ok) {
    const bodyText = await portalRes.text().catch(() => '');
    console.error('[billing-portal] Stripe', portalRes.status, bodyText.slice(0, 200));
    return new Response(JSON.stringify({ error: 'Stripe portal error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const portal = await portalRes.json();
  return new Response(JSON.stringify({ url: portal.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
