// QB BrandOS — Chapter 4 · Stripe webhook foreign-event gate harness
//
// Runs api/stripe-webhook.js in-process with a stubbed fetch layer and a
// locally signed Stripe signature. Proves the price gate:
//   NEGATIVE  foreign price (incl. the retired EUR set) → 200, zero rows written
//   NEGATIVE  one-time payment session (foreign product shape) → 200, zero rows
//   NEGATIVE  unhandled event type → 200, zero rows
//   POSITIVE  QB monthly price → processes normally (claim row + profile PATCH)
//   POSITIVE  QB yearly price → processes normally, proving the six-ID set
//
// No network access. Run: node tests/chapter-04/stripe-webhook-price-gate.mjs

import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Env must exist before the handler module evaluates its price map.
const WEBHOOK_SECRET = 'whsec_harness_local_only';
process.env.STRIPE_WEBHOOK_SECRET     = WEBHOOK_SECRET;
process.env.STRIPE_SECRET_KEY         = 'rk_harness_local_only';
process.env.SUPABASE_URL              = 'https://supabase.harness.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_harness_local_only';
delete process.env.STRIPE_STARTER_PRICE_ID;
delete process.env.STRIPE_PRO_PRICE_ID;
delete process.env.STRIPE_AGENCY_PRICE_ID;

const { default: handler } = await import('../../api/stripe-webhook.js');

// ── fetch interception ──────────────────────────────────────────────────────
const calls = [];
let subStub = null; // subscription object returned for /v1/subscriptions/*

globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  calls.push({ url: String(url), method, body: opts.body || null });

  const u = String(url);
  if (u.startsWith('https://api.stripe.com/v1/subscriptions/')) {
    return new Response(JSON.stringify(subStub || {}), { status: 200 });
  }
  if (u.startsWith('https://api.stripe.com/v1/customers/')) {
    return new Response(JSON.stringify({ id: 'cus_harness', email: 'harness-user@qb.test' }), { status: 200 });
  }
  if (u.includes('/rest/v1/stripe_events') && method === 'POST') {
    return new Response('', { status: 201 });
  }
  if (u.includes('/rest/v1/stripe_events') && method === 'GET') {
    return new Response(JSON.stringify([]), { status: 200 });
  }
  if (u.includes('/rest/v1/profiles') && method === 'PATCH') {
    return new Response(JSON.stringify([{ id: 'u_harness' }]), { status: 200 });
  }
  return new Response('unmatched harness route', { status: 500 });
};

const isSupabaseWrite = (c) =>
  c.url.startsWith(process.env.SUPABASE_URL) && c.method !== 'GET';

// ── request builder with a real v1 signature ────────────────────────────────
function signedRequest(event) {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
  return new Request('https://local.harness/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${t},v1=${v1}` },
    body,
  });
}

// ── scenarios ───────────────────────────────────────────────────────────────
const QB_PRO_MONTHLY    = 'price_1Th8MKEHEAcWrG55hxpLVfCZ';
const QB_STARTER_YEARLY = 'price_1Th8LVEHEAcWrG552aPNKRpD';
const RETIRED_EUR_PRO   = 'price_1TGZtsEHEAcWrG55IaXsFRd9';

const results = [];
let n = 0;

async function run(name, event, sub, expect) {
  n += 1;
  calls.length = 0;
  subStub = sub;
  const res = await handler(signedRequest(event));
  const json = await res.json().catch(() => ({}));
  const writes = calls.filter(isSupabaseWrite);
  const patches = writes.filter(c => c.url.includes('/rest/v1/profiles'));
  const patchedTier = patches.length
    ? (JSON.parse(patches[0].body || '{}').tier ?? null)
    : null;

  const checks = [
    ['status', res.status, expect.status],
    ['rows_written', writes.length, expect.writes],
    ['patched_tier', patchedTier, expect.tier ?? null],
  ];
  if (expect.ignored !== undefined) checks.push(['ignored', json.ignored ?? null, expect.ignored]);

  const failures = checks.filter(([, got, want]) => got !== want);
  const pass = failures.length === 0;
  results.push({ name, pass, status: res.status, body: json, rows_written: writes.length, patched_tier: patchedTier });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${n}] ${name}`);
  console.log(`      status=${res.status} rows_written=${writes.length} patched_tier=${patchedTier ?? 'none'} body=${JSON.stringify(json)}`);
  for (const [k, got, want] of failures) console.log(`      MISMATCH ${k}: got ${got}, want ${want}`);
}

// NEGATIVE 1 · foreign subscription event carrying the retired EUR Pro price
await run(
  'negative · subscription.updated with retired EUR price (foreign)',
  {
    id: 'evt_harness_neg1', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_foreign1', customer: 'cus_foreign', status: 'active',
      items: { data: [{ price: { id: RETIRED_EUR_PRO } }] } } },
  },
  null,
  { status: 200, writes: 0, ignored: 'foreign_price' }
);

// NEGATIVE 2 · one-time payment checkout (the shape of the account's non-QB products)
await run(
  'negative · checkout.session.completed mode=payment (foreign one-time product)',
  {
    id: 'evt_harness_neg2', type: 'checkout.session.completed',
    data: { object: { id: 'cs_foreign1', mode: 'payment', customer: 'cus_foreign',
      customer_details: { email: 'tarot-buyer@example.com' } } },
  },
  null,
  { status: 200, writes: 0, ignored: 'foreign_price' }
);

// NEGATIVE 3 · event type this handler never processes
await run(
  'negative · invoice.paid (unhandled type)',
  {
    id: 'evt_harness_neg3', type: 'invoice.paid',
    data: { object: { id: 'in_foreign1', customer: 'cus_foreign' } },
  },
  null,
  { status: 200, writes: 0, ignored: 'foreign_price' }
);

// POSITIVE 1 · QB checkout completes on the Pro monthly price
await run(
  'positive · checkout.session.completed with QB Pro monthly price',
  {
    id: 'evt_harness_pos1', type: 'checkout.session.completed',
    data: { object: { id: 'cs_qb1', mode: 'subscription', subscription: 'sub_qb1',
      customer: 'cus_qb1', client_reference_id: 'u_harness',
      metadata: { tier_intent: 'pro', user_id: 'u_harness' } } },
  },
  { id: 'sub_qb1', items: { data: [{ price: { id: QB_PRO_MONTHLY } }] } },
  { status: 200, writes: 2, tier: 'pro' }
);

// POSITIVE 2 · QB subscription event on the Starter yearly price (six-ID set proof)
await run(
  'positive · subscription.updated with QB Starter yearly price',
  {
    id: 'evt_harness_pos2', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_qb2', customer: 'cus_qb2', status: 'active',
      items: { data: [{ price: { id: QB_STARTER_YEARLY } }] } } },
  },
  null,
  { status: 200, writes: 2, tier: 'starter' }
);

const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} scenarios pass`);

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'stripe-webhook-price-gate.last-run.json'),
  JSON.stringify({ ran_at: new Date().toISOString(), passed, total: results.length, results }, null, 2));

process.exit(passed === results.length ? 0 : 1);
