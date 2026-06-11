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
// FOREIGN-EVENT GATE: this Stripe account is shared with non-QB products,
// so events for foreign prices arrive routinely. Any event whose price is
// not in the six-ID QB set (QB_PRICE_IDS) is a strict no-op: one log line,
// zero rows written, 200 returned so Stripe stops retrying.
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

// Price ID → tier mapping. The canonical USD price set, six IDs. Monthly IDs
// are env-overridable so preview/staging can wire test-mode prices without
// rebuilding (same env names as api/stripe/checkout.js). Yearly IDs map to
// the same tiers for entitlement; the checkout endpoint sells monthly only
// until the annual path is ruled.
const TIER_BY_PRICE = {
  [process.env.STRIPE_STARTER_PRICE_ID || 'price_1Th8JkEHEAcWrG55Abr1OZXe']: 'starter',
  'price_1Th8LVEHEAcWrG552aPNKRpD': 'starter', // yearly
  [process.env.STRIPE_PRO_PRICE_ID     || 'price_1Th8MKEHEAcWrG55hxpLVfCZ']: 'pro',
  'price_1Th8N8EHEAcWrG55fk6a9vzt': 'pro',     // yearly
  [process.env.STRIPE_AGENCY_PRICE_ID  || 'price_1Th8OWEHEAcWrG55FNZKvxXY']: 'agency',
  'price_1Th8QBEHEAcWrG55dNLosLZm': 'agency',  // yearly
};

// The full QB price set. Any event carrying a price outside this set belongs
// to one of the other products on this shared Stripe account.
const QB_PRICE_IDS = new Set(Object.keys(TIER_BY_PRICE));

/**
 * Resolve the price ID carried by a Stripe event and test it against the QB
 * price set. The account is shared with non-QB products, so foreign events
 * arrive routinely. Anything outside QB_PRICE_IDS is dropped by the caller:
 * one log line, zero rows written, 200 back to Stripe.
 */
async function resolveQbPrice(event, stripeKey) {
  const obj = event?.data?.object || {};
  switch (event.type) {
    case 'checkout.session.completed': {
      // QB sells subscriptions only. One-time payment sessions belong to
      // the other products on this account.
      if (obj.mode !== 'subscription') return { qb: false, reason: 'non_subscription_mode' };
      if (!obj.subscription) return { qb: false, reason: 'no_subscription_on_session' };
      const sub = await fetchStripe(`/subscriptions/${obj.subscription}`, stripeKey);
      const priceId = sub?.items?.data?.[0]?.price?.id || null;
      return { qb: QB_PRICE_IDS.has(priceId), priceId, sub };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const priceId = obj?.items?.data?.[0]?.price?.id || null;
      return { qb: QB_PRICE_IDS.has(priceId), priceId };
    }
    default:
      // Event types this handler never processes carry no QB entitlement
      // change. Acknowledge without writing a stripe_events row.
      return { qb: false, reason: 'unhandled_event_type' };
  }
}

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

async function updateProfileById(userId, updates, supabaseUrl, serviceKey) {
  if (!userId || !supabaseUrl || !serviceKey) return false;
  const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
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

/**
 * Record the Stripe event in stripe_events for idempotency. Returns true if
 * this is the first time we have processed event_id (insert succeeded);
 * false if we have already processed it (unique violation, code 23505).
 */
async function claimStripeEvent(event, supabaseUrl, serviceKey) {
  const r = await fetch(`${supabaseUrl}/rest/v1/stripe_events`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify({
      event_id: event.id,
      event_type: event.type,
      payload: event,
    }),
  });
  // With resolution=ignore-duplicates, a duplicate insert returns 201 with
  // an empty body. To detect duplicates, check the Content-Range header
  // which is empty for a real insert and absent for an ignored duplicate.
  // Fallback: try a SELECT to confirm the row exists and was just created.
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error('[stripe-webhook] event claim failed', r.status, t.slice(0, 200));
    // Treat as not-claimed so the handler still runs. Worst case is duplicate
    // processing, which the per-event handlers tolerate.
    return true;
  }
  // We can't reliably distinguish first-insert from duplicate-ignored via the
  // response alone, so we do a follow-up read to check received_at. If the
  // row's received_at is more than 5 s old, we have processed this event
  // before and should skip.
  try {
    const ck = await fetch(
      `${supabaseUrl}/rest/v1/stripe_events?event_id=eq.${encodeURIComponent(event.id)}&select=received_at`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (ck.ok) {
      const rows = await ck.json().catch(() => []);
      const receivedAt = rows?.[0]?.received_at;
      if (receivedAt) {
        const ageMs = Date.now() - new Date(receivedAt).getTime();
        if (ageMs > 5000) {
          // Old row → this event was already processed in a prior request.
          return false;
        }
      }
    }
  } catch (_) {
    // intentional swallow; first-time-through path is the safe assumption
  }
  return true;
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

  // ── Foreign-event gate ────────────────────────────────────────────────
  // Strict no-op for any event whose price is not in the six-ID QB set.
  // Runs before the idempotency claim so foreign events write zero rows.
  let gate;
  try {
    gate = await resolveQbPrice(event, STRIPE_SECRET_KEY);
  } catch (e) {
    // Transient Stripe error while resolving. 500 so Stripe retries.
    console.error('[stripe-webhook] gate resolve failed', e?.message || e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!gate.qb) {
    console.log(`[stripe-webhook] ignored foreign event type=${event.type} id=${event.id} price=${gate.priceId || 'none'} reason=${gate.reason || 'price_not_in_qb_set'}`);
    return new Response(JSON.stringify({ received: true, ignored: 'foreign_price' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Idempotency: skip if we have already processed this Stripe event id.
  const fresh = await claimStripeEvent(event, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  if (!fresh) {
    return new Response(JSON.stringify({ received: true, deduped: true, event_id: event.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // First successful payment for this customer. Bootstrap stripe_customer_id
        // and the active tier. Prefer client_reference_id (the user id we set
        // at checkout) over an email lookup — it is unambiguous.
        const userId = obj.client_reference_id || null;
        const tierIntent = obj.metadata?.tier_intent || null;
        const customerId = obj.customer;

        // The gate already resolved the subscription's price. The price is
        // the truth; tier_intent metadata is the audit fallback.
        const tier = TIER_BY_PRICE[gate.priceId] || tierIntent;

        const updates = {
          stripe_customer_id: customerId || null,
          subscription_status: 'active',
        };
        if (tier) {
          updates.tier = tier;
          updates.tier_started_at = new Date().toISOString();
        }

        let matched = false;
        if (userId) {
          matched = await updateProfileById(userId, updates, SUPABASE_URL, SUPABASE_SERVICE_KEY);
        }
        if (!matched) {
          // Fallback to email match for legacy checkout sessions that did
          // not include client_reference_id.
          const email = obj.customer_details?.email || obj.customer_email;
          if (email) {
            matched = await updateProfileByEmail(email, updates, SUPABASE_URL, SUPABASE_SERVICE_KEY);
          }
        }
        if (!matched) {
          console.warn(`[stripe-webhook] no profile matched checkout user_id=${userId} email=${obj.customer_details?.email || ''}`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Tier change, status change, or payment-method update.
        // Per spec 7.8: only flip tier when status is active. Other statuses
        // (canceled, past_due, paused) do not change tier yet — the grace
        // period for downgrade is deferred to Chapter 10.
        const customerId = obj.customer;
        const tier = TIER_BY_PRICE[gate.priceId];

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
        if (tier && (obj.status === 'active' || obj.status === 'trialing')) {
          updates.tier = tier;
          updates.tier_started_at = new Date().toISOString();
        }

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
