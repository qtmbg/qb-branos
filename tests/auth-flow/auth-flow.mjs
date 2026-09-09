/* QB BrandOS · sign-in flow regression
 *
 * Guards the failure that took the product down: every gated page
 * redirected anonymous visitors to /signal-scan.html?reason=signin, a page
 * with no sign-in form and no return_to handling, so the visitor landed on
 * question one of the diagnostic. Forever. The nav "Sign in" button pointed
 * at the gated app root, which did the same thing, and the diagnostic itself
 * never created an account, so nobody could get in at all.
 *
 * What this asserts:
 *   1. Every gated page sends an anonymous visitor to /login, once, with the
 *      destination carried in return_to, and the sign-in form is usable.
 *   2. No navigation chain revisits a URL (the loop detector) and none of
 *      them touches signal-scan.
 *   3. /login honours return_to, refuses off-site and self-referential
 *      values, and steps aside for an already-signed-in visitor.
 *   4. A paid tool sends an anonymous visitor to /login with reason=paywall.
 *   5. Finishing the diagnostic actually creates the account: the email step
 *      POSTs /api/send-magic-link.
 *   6. Marketing "Sign in" buttons point at /login, not the gated app root.
 *
 * Usage: node tests/auth-flow/server.mjs &   then   node tests/auth-flow/auth-flow.mjs
 * Env:   QB_BASE (default http://127.0.0.1:4321)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.QB_BASE || 'http://127.0.0.1:4321';
const results = [];
let failures = 0;

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} · ${name}${detail ? ' · ' + detail : ''}`);
}

// Every page load records its navigation chain so a loop is visible as a
// repeated URL rather than as a test that hangs.
async function newPage(browser, { session = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // No live third-party calls from a regression test.
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({ status: 401, body: '{}' }));
  await ctx.route('**/api/send-magic-link', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emailId: 'test' }) }));
  await ctx.route('**/api/send-welcome-email', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await ctx.route('**/api/qbp**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tier: 'free', qbp: {} }) }));
  await ctx.route('**/api/artifacts**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ artifacts: [] }) }));
  if (session) {
    await ctx.addInitScript(s => {
      try { localStorage.setItem('qb_session', JSON.stringify(s)); } catch (e) {}
    }, session);
  }
  const page = await ctx.newPage();
  const chain = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) chain.push(f.url().replace(BASE, '')); });
  return { ctx, page, chain };
}

const SESSION = { token: 'test-jwt', refreshToken: 'r', userId: '00000000-0000-4000-8000-000000000000', email: 't@example.com' };

const GATED = [
  ['/foundation', '%2Ffoundation'],
  ['/qbp',        '%2Fqbp'],
  ['/agents',     '%2Fagents'],
  ['/archive',    '%2Farchive'],
  ['/account',    '%2Faccount'],
  ['/paywall',    '%2Fpaywall'],
  ['/artifact?id=11111111-2222-4333-8444-555555555555', '%2Fartifact%3Fid%3D11111111-2222-4333-8444-555555555555'],
];

const browser = await chromium.launch();

// ── 1 + 2 · gated pages land on /login, once, and never loop ──────────────
for (const [path, encoded] of GATED) {
  const { ctx, page, chain } = await newPage(browser);
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const url = page.url().replace(BASE, '');

  check(`${path} · anonymous lands on /login`,
    url.startsWith('/login'), url);
  check(`${path} · destination carried in return_to`,
    url.includes('return_to=' + encoded), url);
  check(`${path} · never touches signal-scan`,
    !chain.some(u => u.includes('signal-scan')), chain.join(' → '));

  const seen = new Set();
  const repeat = chain.find(u => seen.has(u) || (seen.add(u) && false));
  check(`${path} · no URL visited twice`, !repeat, repeat ? `repeat: ${repeat}` : chain.join(' → '));

  const emailVisible = await page.locator('#login-email').isVisible().catch(() => false);
  check(`${path} · sign-in form is usable on arrival`, emailVisible);

  await ctx.close();
}

// ── 2b · /artifact with no id is a dead end by design, not a loop ─────────
{
  const { ctx, page, chain } = await newPage(browser);
  await page.goto(BASE + '/artifact', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  check('/artifact without an id stays put and reports not-found',
    page.url().replace(BASE, '').startsWith('/artifact') && chain.length === 1,
    chain.join(' → '));
  await ctx.close();
}

// ── 3a · /login honours a valid return_to for a signed-in visitor ─────────
{
  const { ctx, page } = await newPage(browser, {
    session: { token: 'test-jwt', refreshToken: 'r', userId: '00000000-0000-4000-8000-000000000000', email: 't@example.com' },
  });
  await page.goto(BASE + '/login?return_to=%2Fqbp', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  check('signed-in visitor is passed through to return_to',
    page.url().replace(BASE, '').startsWith('/qbp'), page.url().replace(BASE, ''));
  await ctx.close();
}

// ── 3b · open-redirect and self-loop guards ───────────────────────────────
for (const [raw, label] of [
  ['//evil.example/x', 'protocol-relative'],
  ['https://evil.example/x', 'absolute off-site'],
  ['/login', 'self-referential'],
  ['/login.html', 'self-referential (file form)'],
]) {
  const { ctx, page } = await newPage(browser, {
    session: { token: 'test-jwt', refreshToken: 'r', userId: '00000000-0000-4000-8000-000000000000', email: 't@example.com' },
  });
  await page.goto(BASE + '/login?return_to=' + encodeURIComponent(raw), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const landed = page.url();
  check(`return_to rejected · ${label}`,
    landed.startsWith(BASE + '/foundation'), landed.replace(BASE, ''));
  await ctx.close();
}

// ── 4 · a paid tool sends an anonymous visitor to /login, not the scan ────
{
  const { ctx, page, chain } = await newPage(browser);
  await page.goto(BASE + '/logo-direction-agent.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const url = page.url().replace(BASE, '');
  check('paid tool · anonymous lands on /login with reason=paywall',
    url.startsWith('/login') && url.includes('reason=paywall'), url);
  check('paid tool · destination carried in return_to',
    url.includes('logo-direction-agent'), url);
  check('paid tool · never touches signal-scan',
    !chain.some(u => u.includes('signal-scan')), chain.join(' → '));
  await ctx.close();
}

// ── 4b · a paying customer on a cold browser is not bounced to payment ────
// requireAccess() used to redirect on the strength of localStorage alone.
// pullQBPFromCloud() is async and a cold browser has no qb_user_tier yet,
// so every paid tool kicked paying customers to the plan picker on load.

async function paidToolWithProfile(profile, { abort = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => {
    try {
      localStorage.setItem('qb_session', JSON.stringify(s));
      localStorage.removeItem('qb_user_tier');
      localStorage.removeItem('qb_sub_status');
    } catch (e) {}
  }, SESSION);
  // Playwright matches routes in reverse registration order, so the
  // catch-all goes first and the specific profiles handler second.
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({ status: 200, body: '{}' }));
  await ctx.route('**://*.supabase.co/rest/v1/profiles**', r =>
    abort ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([profile]) }));
  const page = await ctx.newPage();
  await page.goto(BASE + '/logo-direction-agent.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  const url = page.url().replace(BASE, '');
  await ctx.close();
  return url;
}

{
  const paid = await paidToolWithProfile({ tier: 'pro', subscription_status: 'active', qbp: {}, first_name: 'P', tool_completions: {} });
  check('paid tool · active subscriber on a cold browser stays on the tool',
    paid.startsWith('/logo-direction-agent.html'), paid);

  const free = await paidToolWithProfile({ tier: 'free', subscription_status: 'inactive', qbp: {}, first_name: 'F', tool_completions: {} });
  check('paid tool · server-confirmed free tier still goes to the plan picker',
    free.startsWith('/payment.html') && free.includes('reason=upgrade'), free);

  const offline = await paidToolWithProfile(null, { abort: true });
  check('paid tool · unreachable profile leaves the customer in place',
    offline.startsWith('/logo-direction-agent.html'), offline);
}

// ── 4c · the payment page runs on the canonical session ───────────────────
// payment.html used to run its own email + password auth and write its own
// qb_session shape ({email, token, supabaseId}). No userId meant
// QB.isAuthed() read it as anonymous, so a paying customer was bounced
// off /foundation back to a sign-in wall.
{
  // Anonymous · picking a plan hands off to /login and carries the plan
  const { ctx, page } = await newPage(browser);
  await page.goto(BASE + '/payment.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  // Plan cards are div[role=button].plan-card, not <button>.
  await page.locator('.plan-card').first().click();
  await page.waitForTimeout(700);
  const u = page.url().replace(BASE, '');
  check('payment · anonymous plan pick goes to /login', u.startsWith('/login'), u);
  check('payment · the picked plan survives the sign-in hop',
    decodeURIComponent(u).includes('/payment.html?plan='), decodeURIComponent(u));
  await ctx.close();
}
{
  // Anonymous · deep link from the pricing page
  const { ctx, page } = await newPage(browser);
  await page.goto(BASE + '/payment.html?plan=pro&billing=annual', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const u = decodeURIComponent(page.url().replace(BASE, ''));
  check('payment · anonymous deep link goes to /login carrying plan and billing',
    u.startsWith('/login') && u.includes('plan=pro') && u.includes('billing=annual'), u);
  await ctx.close();
}
{
  // The old broken session shape must not read as signed in
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('qb_session', JSON.stringify({ email: 'legacy@example.com', token: 'tok', supabaseId: 'abc' })); } catch (e) {}
  });
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({ status: 200, body: '{}' }));
  const page = await ctx.newPage();
  await page.goto(BASE + '/payment.html?plan=starter', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const u = page.url().replace(BASE, '');
  check('payment · a session with no userId is treated as anonymous', u.startsWith('/login'), u);
  await ctx.close();
}
{
  // Signed in · straight to Stripe, no auth view in between
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => { try { localStorage.setItem('qb_session', JSON.stringify(s)); } catch (e) {} }, SESSION);
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({ status: 200, body: '{}' }));
  let checkoutCalled = false;
  await ctx.route('**/api/stripe/checkout', r => {
    checkoutCalled = true;
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ checkout_url: BASE + '/404.html?stripe=stub' }) });
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/payment.html?plan=pro', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  check('payment · signed-in deep link goes straight to Stripe checkout', checkoutCalled, page.url().replace(BASE, ''));
  await ctx.close();
}
{
  // Post-checkout return · server confirms the tier, session left alone
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => { try { localStorage.setItem('qb_session', JSON.stringify(s)); } catch (e) {} }, SESSION);
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({ status: 200, body: '{}' }));
  await ctx.route('**://*.supabase.co/rest/v1/profiles**', r => r.fulfill({ json: [{ tier: 'pro', subscription_status: 'active', qbp: {} }] }));
  const page = await ctx.newPage();
  await page.goto(BASE + '/payment.html?payment=success&plan=pro', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => ({
    tier: localStorage.getItem('qb_user_tier'),
    status: localStorage.getItem('qb_sub_status'),
    session: JSON.parse(localStorage.getItem('qb_session') || 'null'),
    body: document.body.innerText.slice(0, 200),
  }));
  check('payment · post-checkout uses the server-confirmed tier', state.tier === 'pro' && state.status === 'active', `${state.tier}/${state.status}`);
  check('payment · post-checkout leaves the session intact',
    !!(state.session && state.session.userId && state.session.token), JSON.stringify(state.session));
  check('payment · post-checkout shows the success view', /You're in|Enter QB BrandOS/i.test(state.body), state.body.slice(0, 80));
  await ctx.close();
}

// ── 4d · the revenue path, callback included ──────────────────────────────
// Synthetic callback (the token verify is stubbed) so the whole chain is
// covered without network: magic-link fragment → /auth-callback.html →
// session written → return_to honoured → checkout resumed with the plan
// the visitor picked. tests/auth-flow/round-trip.mjs runs the same chain
// against live Supabase with a real token.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const USER_ID = '00000000-0000-4000-8000-0000000000ff';

  // Reverse registration order: catch-all first, specific handler second.
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({ status: 200, body: '{}' }));
  await ctx.route('**://*.supabase.co/auth/v1/user', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: USER_ID, email: 'resume@example.com', user_metadata: { first_name: 'Resume' },
    }) }));

  let checkoutCalled = false;
  let bearer = null;
  await ctx.route('**/api/stripe/checkout', r => {
    checkoutCalled = true;
    bearer = r.request().headers()['authorization'] || null;
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ checkout_url: BASE + '/404.html?stripe=stub' }) });
  });

  const page = await ctx.newPage();
  // Seed the one-time destination the way /login does, with one write.
  await page.goto(BASE + '/404.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('qb_post_auth_return_to', '/payment.html?plan=pro&billing=annual'));

  const fragment = 'access_token=stub-access-token-long-enough-to-look-real'
                 + '&refresh_token=stub-refresh&expires_in=3600&token_type=bearer&type=magiclink';
  await page.goto(BASE + '/auth-callback.html#' + fragment, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);

  const session = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('qb_session') || 'null'); } catch (e) { return null; } });
  check('callback · session written with token and userId',
    !!(session && session.token && session.userId === USER_ID), session ? session.userId : 'none');
  check('callback · one-time return_to is consumed',
    await page.evaluate(() => !localStorage.getItem('qb_post_auth_return_to')));
  check('callback · signing in resumes the checkout the visitor asked for', checkoutCalled,
    page.url().replace(BASE, ''));
  check('callback · checkout carries the session token',
    !!(bearer && bearer.startsWith('Bearer ')), bearer ? 'bearer present' : 'missing');
  await ctx.close();
}

// ── 4e · the callback refuses to write a session with no user id ──────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  await page.goto(BASE + '/auth-callback.html#access_token=stub&refresh_token=r&token_type=bearer', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const stayed = page.url().includes('auth-callback');
  const session = await page.evaluate(() => localStorage.getItem('qb_session'));
  const shown = await page.locator('#err').isVisible().catch(() => false);
  check('callback · a verify response with no user id stops with an error', stayed && shown, page.url().replace(BASE, ''));
  check('callback · no half-built session is left behind', !session, session || 'none');
  await ctx.close();
}

// ── 5 · the diagnostic creates the account ────────────────────────────────
{
  const { ctx, page } = await newPage(browser);
  const posted = [];
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/')) posted.push(r.url().replace(BASE, '')); });

  await page.goto(BASE + '/signal-scan.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  check('signal scan · shared auth module is loaded',
    await page.evaluate(() => typeof window.QB?.sendMagicLink === 'function'));

  await page.getByRole('button', { name: /Start the scan/ }).click();
  // Seven single-choice questions, then one free-text question.
  for (let i = 0; i < 7; i++) {
    await page.locator('.option-btn').first().click();
    await page.waitForTimeout(320);
  }
  await page.locator('textarea').fill('A regression test brand.');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(300);

  await page.locator('input[type="email"]').fill('loop-regression@example.com');
  await page.getByRole('button', { name: /Send my report/ }).click();
  await page.waitForTimeout(1200);

  check('signal scan · email step POSTs /api/send-magic-link',
    posted.some(u => u.includes('/api/send-magic-link')), posted.join(', '));
  check('signal scan · email step still POSTs the welcome email',
    posted.some(u => u.includes('/api/send-welcome-email')), posted.join(', '));

  await page.waitForTimeout(3400);
  const notice = await page.getByText(/sign-in link is in your inbox/i).isVisible().catch(() => false);
  check('signal scan · results screen names the sign-in link', notice);
  await ctx.close();
}

// ── 6 · marketing "Sign in" buttons point at the sign-in surface ──────────
{
  const pages = ['index.html', 'ecosystem.html', 'tools.html', 'atelier.html', 'war-room.html'];
  let bad = [];
  for (const f of pages) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (/href="https:\/\/app\.quantumbranding\.ai"[^>]*>\s*<span[^>]*>Sign in/.test(src)) bad.push(f);
  }
  check('marketing · no "Sign in" button points at the gated app root',
    bad.length === 0, bad.join(', '));

  const repo = fs.readdirSync('.').filter(f => f.endsWith('.html'));
  const stale = repo.filter(f => /signal-scan\.html\?reason=signin/.test(fs.readFileSync(f, 'utf8')));
  check('no page redirects sign-in traffic into the diagnostic',
    stale.length === 0, stale.join(', '));
}

await browser.close();

const summary = { ranAt: new Date().toISOString(), base: BASE, total: results.length, failures, results };
fs.writeFileSync('tests/auth-flow/auth-flow.last-run.json', JSON.stringify(summary, null, 2));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
