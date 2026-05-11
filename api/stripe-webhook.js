// QB BrandOS — Stripe Webhook Handler
// Vercel Edge Function
//
// Handles three subscription lifecycle events:
//   checkout.session.completed       — first successful payment
//   customer.subscription.updated    — tier change, payment-method update, status change
//   customer.subscription.deleted    — cancellation
//
// On each event, the matching public.profiles row is updated by email
// (lookup the Stripe customer to get the email, then PATCH the row).
//
// Required env vars (set in Vercel Project Settings):
//   STRIPE_WEBHOOK_SECRET       — from Stripe Dashboard → Developers → Webhooks
//   STRIPE_SECRET_KEY           — restricted key with read access to customers + subscriptions
//   SUPABASE_URL                — https://yushbxjwfhuokaezoioe.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   — bypasses RLS to update any profile row
//
// Stripe Dashboard setup:
//   1. Developers → Webhooks → Add endpoint
//   2. Endpoint URL: https://app.quantumbranding.ai/api/stripe-webhook
//   3. Events: checkout.session.completed, customer.subscription.created,
//              customer.subscription.updated, customer.subscription.deleted
//   4. Copy the signing secret into STRIPE_WEBHOOK_SECRET on Vercel.

export const config = { runtime: 'edge' };

// Price ID → tier mapping. Sourced from payment.html:1740-1742.
// Update here when Stripe prices change. Unknown price IDs leave tier untouched.
const TIER_BY_PRICE = {
  'price_1TGZtpEHEAcWrG55WWEgeFAv': 'starter',
  'price_1TGZtsEHEAcWrG55IaXsFRd9': 'pro',
  'price_1TGZtvEHEAcWrG55Ti8Db9mX': 'agency',
};

// Stripe signature header: t=<unix>,v1=<hex>. Tolerance 5 min replay window.
async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map(p => {
      const idx = p.indexOf('=');
      return idx === -1 ? [p, ''] : [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time compare
  if (sigHex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < sigHex.length; i++) {
    diff |= sigHex.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

async function fetchStripe(path, secret) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` }
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Stripe ${path} ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

async function updateProfileByEmail(email, updates, supabaseUrl, serviceKey) {
  if (!email || !supabaseUrl || !serviceKey) return false;
  const url = `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Supabase PATCH ${r.status}: ${body.slice(0, 200)}`);
  }
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

function statusLabel(stripeStatus) {
  // Stripe statuses: incomplete, incomplete_expired, trialing, active,
  // past_due, canceled, unpaid, paused. Collapse to the three the app cares about.
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'canceled' || stripeStatus === 'unpaid') return 'canceled';
  return stripeStatus || 'inactive';
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL          = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[stripe-webhook] Missing env vars');
    return new Response('Webhook not configured', { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  const valid = await verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const obj = event?.data?.object;
  if (!obj) {
    return new Response(JSON.stringify({ received: true, ignored: 'no data.object' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // First successful payment for this customer. Bootstrap stripe_customer_id
        // and the active tier in one shot.
        const email = obj.customer_details?.email || obj.customer_email;
        const customerId = obj.customer;
        if (!email) {
          console.warn('[stripe-webhook] checkout.session.completed without email');
          break;
        }

        let tier;
        if (obj.subscription) {
          const sub = await fetchStripe(`/subscriptions/${obj.subscription}`, STRIPE_SECRET_KEY);
          const priceId = sub.items?.data?.[0]?.price?.id;
          tier = TIER_BY_PRICE[priceId];
        }

        const updates = {
          stripe_customer_id: customerId || null,
          subscription_status: 'active',
        };
        if (tier) updates.tier = tier;

        const matched = await updateProfileByEmail(email, updates, SUPABASE_URL, SUPABASE_SERVICE_KEY);
        if (!matched) console.warn(`[stripe-webhook] no profile matched email=${email}`);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Tier change, status change, or payment-method update.
        const customerId = obj.customer;
        const priceId = obj.items?.data?.[0]?.price?.id;
        const tier = TIER_BY_PRICE[priceId];

        // Look up the customer to get the email we matched on at checkout.
        const cust = await fetchStripe(`/customers/${customerId}`, STRIPE_SECRET_KEY);
        const email = cust.email;
        if (!email) {
          console.warn(`[stripe-webhook] customer ${customerId} has no email`);
          break;
        }

        const updates = {
          stripe_customer_id: customerId,
          subscription_status: statusLabel(obj.status),
        };
        if (tier) updates.tier = tier;

        const matched = await updateProfileByEmail(email, updates, SUPABASE_URL, SUPABASE_SERVICE_KEY);
        if (!matched) console.warn(`[stripe-webhook] no profile matched email=${email}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const customerId = obj.customer;
        const cust = await fetchStripe(`/customers/${customerId}`, STRIPE_SECRET_KEY);
        const email = cust.email;
        if (!email) break;

        await updateProfileByEmail(
          email,
          { tier: 'free', subscription_status: 'canceled' },
          SUPABASE_URL,
          SUPABASE_SERVICE_KEY
        );
        break;
      }

      default:
        // Other events arrive only if the webhook is configured to send them.
        // We acknowledge them so Stripe stops retrying.
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[stripe-webhook]', e?.message || e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
