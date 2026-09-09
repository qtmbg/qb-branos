/* QB BrandOS · live sign-in round trip
 *
 * Proves a person can actually get in, against the real auth backend:
 *   mint a magic link  →  follow it  →  land on /auth-callback.html
 *   →  session written  →  bounced to the destination that was asked for.
 *
 * The action_link is minted with the production redirect_to (the only value
 * on the Supabase allowlist), then the fragment it returns is replayed
 * against the local harness so the destination hop stays local. The token
 * itself is real and is verified by the real /auth/v1/user endpoint.
 *
 * Creates one throwaway user and deletes it at the end, pass or fail.
 *
 * Usage: node tests/auth-flow/server.mjs &   then   node tests/auth-flow/round-trip.mjs
 * Env:   .env.qb-branos.live (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.QB_BASE || 'http://127.0.0.1:4321';
const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';

if (!fs.existsSync(ENV_PATH)) {
  console.log(`SKIP · ${ENV_PATH} not found, live round trip needs the service role key`);
  process.exit(0);
}
for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const SUPA = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) { console.log('SKIP · SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(0); }

const admin = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const EMAIL = `qb-roundtrip-${Date.now()}@example.com`;
let userId = null;
let failures = 0;
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} · ${name}${detail ? ' · ' + detail : ''}`);
};

try {
  // 1 · mint the link exactly the way /api/send-magic-link does
  const genRes = await fetch(`${SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: admin,
    body: JSON.stringify({
      type: 'magiclink', email: EMAIL,
      redirect_to: 'https://quantumbranding.ai/auth-callback.html',
      data: { first_name: 'Roundtrip', signup_source: 'auth-flow-test' },
    }),
  });
  const gen = await genRes.json();
  userId = gen.id || null;
  check('magic link minted for a brand-new address', genRes.ok && !!gen.action_link, `status ${genRes.status}`);
  check('the address became a user', !!userId, userId || 'no id');

  // 2 · follow it. GoTrue answers with the tokens in the fragment.
  const follow = await fetch(gen.action_link, { redirect: 'manual' });
  const location = follow.headers.get('location') || '';
  check('link redirects to the production callback', location.startsWith('https://quantumbranding.ai/auth-callback.html#'), `${follow.status}`);
  const fragment = location.split('#')[1] || '';
  check('fragment carries an access token', /access_token=/.test(fragment));

  // 3 · replay the fragment against the callback page and watch where it goes
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // Seed the one-time destination the way /login does: a single write on
  // this origin. addInitScript would re-run on every navigation and mask
  // the callback consuming the key.
  await page.goto(`${BASE}/404.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('qb_post_auth_return_to', '/qbp'));

  const chain = [];
  page.on('request', r => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) chain.push(r.url().replace(BASE, '').split('#')[0]); });

  await page.goto(`${BASE}/auth-callback.html#${fragment}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(u => !u.toString().includes('auth-callback'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);

  const landed = page.url().replace(BASE, '');
  check('callback bounces to the destination that was asked for', landed.startsWith('/qbp'), landed);

  const session = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('qb_session') || 'null'); } catch (e) { return null; } });
  check('session written with a token and a user id', !!(session && session.token && session.userId), session ? `userId ${session.userId}` : 'none');
  check('session user matches the address that was mailed', session && session.email === EMAIL, session ? session.email : 'none');
  check('one-time return_to is consumed', await page.evaluate(() => !localStorage.getItem('qb_post_auth_return_to')));
  check('no URL visited twice on the way in', new Set(chain).size === chain.length, chain.join(' → '));

  // 4 · a signed-in visitor asking for /login is passed straight through
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/login?return_to=%2Ffoundation`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(700);
  check('signed-in visitor is never shown the sign-in wall again',
    p2.url().replace(BASE, '').startsWith('/foundation'), p2.url().replace(BASE, ''));

  await browser.close();
} finally {
  if (userId) {
    const del = await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin });
    console.log(`cleanup · throwaway user deleted (status ${del.status})`);
  }
}

fs.writeFileSync('tests/auth-flow/round-trip.last-run.json',
  JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, total: results.length, failures, results }, null, 2));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
