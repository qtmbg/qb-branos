// QB BrandOS — Chapter 4 · Pricing swap verification (short of payment)
//
// Against production, post-deploy:
//   1. Unauthenticated 401 probes: /api/agents/run, /api/agents/console,
//      /api/stripe/checkout (registry merge gate post-deploy half rides along).
//   2. One real checkout session per tier and interval (3 monthly + 3 yearly)
//      through the live entry path (POST /api/stripe/checkout) in the request
//      shape payment.html sends, asserting currency=usd and the exact
//      canonical amount.
//   3. One session in the request shape js/qb-paywall.js sends (bare price_id,
//      default success/cancel URLs) — the foundation upgrade path.
//   4. Every session expired via the Stripe API immediately after inspection.
//
// Proves configuration, not settlement. PL-001 with a live card stays the launch gate.
// Run: node tests/chapter-04/checkout-session-verification.mjs

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ENV_PATH = '/tmp/.env.qb-branos.live-backup';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';

const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, 'utf8').split('\n')
    .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]])
);
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY, AK = env.SUPABASE_ANON_KEY, STRIPE = env.STRIPE_SECRET_KEY;
const svc = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' };

const TIERS = [
  { tier: 'starter', billing: 'monthly', price_id: 'price_1Th8JkEHEAcWrG55Abr1OZXe', amount: 9700 },
  { tier: 'pro',     billing: 'monthly', price_id: 'price_1Th8MKEHEAcWrG55hxpLVfCZ', amount: 24700 },
  { tier: 'agency',  billing: 'monthly', price_id: 'price_1Th8OWEHEAcWrG55FNZKvxXY', amount: 149700 },
  { tier: 'starter', billing: 'yearly',  price_id: 'price_1Th8LVEHEAcWrG552aPNKRpD', amount: 96000 },
  { tier: 'pro',     billing: 'yearly',  price_id: 'price_1Th8N8EHEAcWrG55fk6a9vzt', amount: 246000 },
  { tier: 'agency',  billing: 'yearly',  price_id: 'price_1Th8QBEHEAcWrG55dNLosLZm', amount: 1490400 },
];

const out = { harness: 'checkout-session-verification', started_at: new Date().toISOString(), base_url: BASE, probes: [], sessions: [] };
let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` · ${detail}` : ''}`);
  if (!ok) failures += 1;
  return ok;
};

// ── 1 · unauthenticated probes ──────────────────────────────────────────────
for (const [label, method, path] of [
  ['POST /api/agents/run unauthenticated', 'POST', '/api/agents/run'],
  ['GET /api/agents/console unauthenticated', 'GET', '/api/agents/console'],
  ['POST /api/stripe/checkout unauthenticated', 'POST', '/api/stripe/checkout'],
]) {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
  out.probes.push({ label, status: r.status });
  check(label, r.status === 401, `status=${r.status}`);
  if (r.status === 500) console.log('      500 FUNCTION_INVOCATION_FAILED would mean revert immediately');
}

// ── 2 · test founder ────────────────────────────────────────────────────────
const email = `pricing-verify-${Date.now()}@qbharness.test`;
const password = crypto.randomUUID() + 'Aa1!';
const u = await (await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
if (!u?.id) { console.log('FAIL  createUser', JSON.stringify(u).slice(0, 200)); process.exit(1); }
const tok = (await (await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).access_token;
if (!tok) { console.log('FAIL  signin'); process.exit(1); }

// ── 3 · sessions through the live entry paths, then expire ─────────────────
async function verifySession(label, body, amount) {
  const r = await fetch(`${BASE}/api/stripe/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  const rec = { label, price_id: body.price_id, status: r.status, session_id: j.session_id || null, amount_total: j.amount_total ?? null, currency: j.currency || null };

  check(`${label} · session created via live entry path`, r.status === 200 && !!j.session_id, `status=${r.status} session=${j.session_id || 'none'}`);
  check(`${label} · currency=usd`, j.currency === 'usd', `currency=${j.currency}`);
  check(`${label} · amount_total=${amount}`, j.amount_total === amount, `amount_total=${j.amount_total} ($${(j.amount_total ?? 0) / 100})`);

  if (j.session_id) {
    const ex = await fetch(`https://api.stripe.com/v1/checkout/sessions/${j.session_id}/expire`, {
      method: 'POST', headers: { Authorization: `Bearer ${STRIPE}` },
    });
    const exj = await ex.json().catch(() => ({}));
    rec.expired = exj?.status === 'expired';
    rec.expire_http = ex.status;
    check(`${label} · session expired`, exj?.status === 'expired', `http=${ex.status} session_status=${exj?.status || exj?.error?.message?.slice(0, 80)}`);
  }
  out.sessions.push(rec);
}

// 3a · per tier and interval, in the request shape payment.html sends
for (const t of TIERS) {
  await verifySession(`${t.tier} ${t.billing}`, {
    price_id: t.price_id,
    success_url: `${BASE}/payment.html?payment=success&plan=${t.tier}`,
    cancel_url: `${BASE}/payment.html`,
  }, t.amount);
}

// 3b · foundation upgrade path, in the request shape js/qb-paywall.js sends:
// bare price_id, server-default success/cancel URLs.
await verifySession('founder-path starter (qb-paywall shape)', {
  price_id: 'price_1Th8JkEHEAcWrG55Abr1OZXe',
}, 9700);

// ── 4 · cleanup ─────────────────────────────────────────────────────────────
await fetch(`${SU}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: svc });
const gone = !(await fetch(`${SU}/auth/v1/admin/users/${u.id}`, { headers: svc })).ok;
check('test founder deleted', gone);

out.finished_at = new Date().toISOString();
out.failures = failures;
const here = dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(join(here, 'checkout-session-verification.last-run.json'), JSON.stringify(out, null, 2));
console.log(`\n${failures === 0 ? 'GREEN' : `RED · ${failures} failures`}`);
process.exit(failures === 0 ? 0 : 1);
