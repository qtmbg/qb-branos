#!/usr/bin/env node
// tests/one-price/one-price.mjs
// Recut Phase 5 · standing harness for the one-price money path.
//
//   node tests/one-price/one-price.mjs
//
// Entitlement is tested behaviourally with fetch stubbed, because the
// only property that matters is which way it fails. Checkout and the
// webhook are asserted at source level: both are Edge handlers whose
// real behaviour needs Stripe, and the invariants worth protecting are
// structural.
//
// Nothing is truncated before comparison and no findings list is capped.

import { readFileSync } from 'node:fs';

const failures = [];
const fail = m => failures.push(m);
const ok = m => console.log(`  ok · ${m}`);
let mark = 0;
const since = () => { mark = failures.length; };
const okIf = m => { if (failures.length === mark) ok(m); };

const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
const realFetch = globalThis.fetch;
const stub = (impl) => { globalThis.fetch = impl; };
const restore = () => { globalThis.fetch = realFetch; };

const { ownsPlatform } = await import('../../api/_lib/entitlements.js');

console.log('\n1 · entitlement fails closed in every direction');
{
  since();
  const cases = [
    ['no user id',        async () => ({ ok: true, status: 200, json: async () => [{ id: 'x' }] }), null, ENV, 'no_user'],
    ['unconfigured env',  async () => ({ ok: true, status: 200, json: async () => [{ id: 'x' }] }), 'u1', {}, 'not_configured'],
    ['table missing',     async () => ({ ok: false, status: 404, json: async () => ({}) }),         'u1', ENV, 'table_missing'],
    ['server error',      async () => ({ ok: false, status: 500, json: async () => ({}) }),         'u1', ENV, 'lookup_failed_500'],
    ['fetch throws',      async () => { throw new Error('socket'); },                                'u1', ENV, 'lookup_threw'],
    ['unparseable body',  async () => ({ ok: true, status: 200, json: async () => ({ not: 'array' }) }), 'u1', ENV, 'lookup_unparseable'],
    ['no purchase row',   async () => ({ ok: true, status: 200, json: async () => [] }),            'u1', ENV, 'not_purchased'],
  ];
  for (const [label, impl, user, env, expected] of cases) {
    stub(impl);
    const r = await ownsPlatform(user, env);
    restore();
    if (r.owned) fail(`"${label}" granted the entitlement · it must fail closed`);
    if (r.reason !== expected) fail(`"${label}" reported reason "${r.reason}", expected "${expected}"`);
  }
  okIf(`${cases.length} failure modes all resolve to owned:false with a distinct reason`);

  since();
  stub(async () => ({ ok: true, status: 200, json: async () => [{ id: 'p1' }] }));
  const good = await ownsPlatform('u1', ENV);
  restore();
  if (!good.owned || good.reason !== 'purchased') fail(`a real purchase was not recognised: ${JSON.stringify(good)}`);
  okIf('a real purchase row grants the entitlement');

  since();
  // The brand key must reach the query, or every brand shares one purchase.
  let seen = '';
  stub(async (url) => { seen = String(url); return { ok: true, status: 200, json: async () => [] }; });
  await ownsPlatform('u1', ENV, 'second-brand');
  restore();
  if (!seen.includes('brand_key=eq.second-brand')) fail(`the brand key never reached the query: ${seen}`);
  if (!seen.includes('user_id=eq.u1')) fail(`the user id never reached the query: ${seen}`);
  okIf('the lookup is scoped by both user and brand');
}

console.log('\n2 · checkout cannot charge the wrong price');
{
  const src = read('api/stripe/checkout.js');

  since();
  // A subscription price falling back to a hard-coded default was
  // survivable. A one-time charge falling back takes real money for the
  // wrong thing, so the Platform id must have no fallback.
  const line = (src.match(/^const PLATFORM_PRICE_ID = .*$/m) || [''])[0];
  if (!line) fail('PLATFORM_PRICE_ID is gone from checkout.js');
  else if (/\|\|\s*'price_/.test(line)) fail(`PLATFORM_PRICE_ID has a hard-coded fallback price: ${line.trim()}`);
  else okIf('PLATFORM_PRICE_ID has no fallback · unset means unsellable');

  since();
  if (!/const isPlatform = Boolean\(PLATFORM_PRICE_ID\)/.test(src)) {
    fail('isPlatform no longer requires PLATFORM_PRICE_ID to be set · an empty env would match an empty price_id');
  }
  okIf('an unset price id cannot match an empty request');

  since();
  if (!/form\.set\('mode', isPlatform \? 'payment' : 'subscription'\)/.test(src)) {
    fail('the Platform no longer creates a payment-mode session');
  }
  okIf('the Platform checks out in payment mode, tiers stay on subscription');

  since();
  for (const key of ["metadata[product]", "metadata[brand_key]"]) {
    if (!src.includes(key)) fail(`checkout no longer sets ${key}, which the webhook keys on`);
  }
  okIf('checkout stamps product and brand_key into the session metadata');
}

console.log('\n3 · the webhook claims only its own payment sessions');
{
  const src = read('api/stripe-webhook.js');

  since();
  if (!/obj\.metadata\?\.product !== 'platform'/.test(src)) {
    fail('the webhook no longer checks metadata.product · it would claim other products\' payment sessions on a shared Stripe account');
  }
  okIf('a payment session is claimed only when metadata.product is platform');

  since();
  if (!/resolution=merge-duplicates/.test(src)) {
    fail('the purchase insert is no longer idempotent · a Stripe retry would write a second entitlement');
  }
  okIf('the purchase insert is idempotent against Stripe retries');

  since();
  // 404 means the table is absent, which retrying cannot fix.
  if (!/insRes\.status === 404/.test(src)) {
    fail('a missing platform_purchases table would put the webhook in a permanent retry loop');
  }
  okIf('a missing table ends the delivery instead of looping');
}

console.log('\n4 · migration 024 exists and is safe');
{
  since();
  const sql = read('supabase/migrations/024_platform_purchases.sql');
  for (const [need, probe] of [
    ['row level security', 'enable row level security'],
    ['a select-own policy', 'auth.uid() = user_id'],
    ['session idempotency', 'platform_purchases_session_unique'],
    ['the brand key column', 'brand_key'],
  ]) {
    if (!sql.includes(probe)) fail(`migration 024 is missing ${need}`);
  }
  // The 2026-09-16 incident was an anon hole on a table that looked
  // harmless. This one holds payment records.
  if (/to anon/.test(sql)) fail('migration 024 grants something to anon');
  okIf('RLS on, select-own only, no anon grant, unique on session');
}

console.log('');
if (failures.length) {
  console.error(`one-price: FAILED · ${failures.length} problem${failures.length === 1 ? '' : 's'}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('one-price: GREEN');
