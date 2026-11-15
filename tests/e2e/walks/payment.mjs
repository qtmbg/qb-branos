// Payment: the one plan, the hand-off to sign-in, the round trip through
// checkout, the return from a cancelled checkout, and every answer the
// endpoint can give (api/stripe/checkout.js, api/_lib/auth.js).
//
// Nothing reaches Stripe. The endpoint is answered here, and the "Stripe"
// the page is sent to is this same page with ?payment=success, which is
// where the real success_url points.
export const page = 'payment.html';
export const title = 'plans, signed out, checkout success, cancel, every checkout error';
export const session = true;

const STARTER_PRICE = 'price_1Th8JkEHEAcWrG55Abr1OZXe';

// docs/brand/copy-facts.md, "The offer". The page must list exactly this.
const FEATURES = [
  'The two other foundation exercises: Visual DNA, War Table',
  'The three other foundation readings: Sensescape, Visual DNA, War Table',
  'The three Build agents: Logo Direction, Logo Evaluation, Voice Guide',
  'Full Brand Profile (QBP) export',
  'Full refund within 14 days of your first payment',
  'Cancel anytime',
];
const FREE_LINE = 'Free, and staying free: Signal Scan, three foundation exercises (Archetype Compass, Brand Soul Map, Sensescape), The Profiles, the Soul Map reading and the Brand Document';

const NOT_ACCEPTED = 'The checkout request was not accepted. Write to me@qtmbg.com.';
const STRIPE_DOWN = 'Stripe could not start the checkout. Try again in a moment.';
const ERRORS = [
  { name: '401 no authorization',   status: 401, body: { error: 'Missing authorization' },  says: 'Your session is closed. Sign in, then try again.' },
  { name: '401 invalid session',    status: 401, body: { error: 'Invalid session' },        says: 'Your session has expired. Sign in again, then try again.' },
  { name: '400 invalid body',       status: 400, body: { error: 'Invalid body' },           says: NOT_ACCEPTED },
  { name: '400 no price id',        status: 400, body: { error: 'price_id is required' },   says: NOT_ACCEPTED },
  { name: '400 unknown price id',   status: 400, body: { error: 'unknown_price_id' },       says: NOT_ACCEPTED },
  { name: '405 wrong method',       status: 405, body: { error: 'Method not allowed' },     says: NOT_ACCEPTED },
  { name: '501 tier not open',      status: 501, body: { error: 'tier_not_yet_available', tier: 'pro' }, says: 'This plan is not open yet.' },
  { name: '502 stripe error',       status: 502, body: { error: 'stripe_error', status: 500 }, says: STRIPE_DOWN },
  { name: '502 stripe sent no url', status: 502, body: { error: 'stripe_returned_no_url' }, says: STRIPE_DOWN },
  { name: '503 not configured',     status: 503, body: { error: 'Not configured: STRIPE_SECRET_KEY' }, says: 'Checkout is not available right now. Write to me@qtmbg.com.' },
  { name: '500 with no JSON',       status: 500, raw: 'FUNCTION_INVOCATION_FAILED',         says: 'The checkout did not answer (HTTP 500). Try again in a moment.' },
  { name: '200 with no url',        status: 200, body: {},                                  says: 'The checkout did not answer (HTTP 200). Try again in a moment.' },
  { name: 'network failure',        abort: true,                                            says: 'No connection. Check your network, then try again.' },
];

export async function walk(w) {
  const p = w.page;
  // A target that is not there fails in seconds, never by waiting out a default.
  const T = 4000;
  p.setDefaultTimeout(T);
  p.setDefaultNavigationTimeout(8000);
  const see = (text, opts = {}) => w.see(text, { timeout: T, ...opts });
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  // w.see matches through XPath, whose normalize-space leaves the no-break
  // space French sets before : ; ? and $. This folds it on both sides.
  const shows = async (written, within = '#app') => {
    const want = flat(await w.say(written));
    await p.waitForFunction(([sel, text]) => {
      const root = document.querySelector(sel);
      if (!root) return false;
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (n.data.replace(/\s+/g, ' ').trim() === text && n.parentElement && n.parentElement.getClientRects().length) return true;
      }
      return false;
    }, [within, want], { timeout: T }).catch(() => { throw new Error(`not painted: ${JSON.stringify(want)}`); });
  };
  const appText = async () => flat(await p.locator('#app').innerText());
  const stub = name => `<!doctype html><html lang="${w.lang}"><head><meta charset="utf-8"><title>${name}</title></head><body>${name}</body></html>`;

  const calls = [];
  let answer = { status: 500, raw: 'no answer set' };
  await w.mock('**/api/stripe/checkout', async route => {
    const req = route.request();
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
    calls.push({ method: req.method(), auth: req.headers()['authorization'], lang: req.headers()['x-qb-lang'], body });
    const a = answer;
    if (a.abort) return route.abort('failed');
    if (a.delay) await new Promise(r => setTimeout(r, a.delay));
    await route.fulfill({ status: a.status, contentType: a.raw ? 'text/plain' : 'application/json', body: a.raw || JSON.stringify(a.body) });
  });
  // The two places the page hands the visitor to. Their own walks cover them.
  await w.mock(/\/login\?/, route => route.fulfill({ status: 200, contentType: 'text/html', body: stub('sign in') }));
  await w.mock(/\/foundation(\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'text/html', body: stub('foundation') }));
  // Lets one load start signed out: the harness writes the session on every
  // load, and the deep link acts before any step could remove it.
  await p.addInitScript(() => { try { if (sessionStorage.getItem('walk_signed_out')) localStorage.removeItem('qb_session'); } catch (e) {} });

  let origin = '';
  const plans = async () => { await see('Open your full foundation'); };

  await w.step('the plan, as the facts sheet states it', async () => {
    await w.open();
    origin = new URL(p.url()).origin;
    await plans();
    await shows('Three foundation exercises are free. Starter opens the other two, the readings and the Build agents.');
    await see('Starter', { within: '.plan-card' });
    await shows('$97', '.plan-card');
    await shows('/ month', '.plan-card');
    await shows('Everything in Brand Profile, plus your full foundation and the Build agents.');
    for (const f of FEATURES) await shows(f, '.feature-list');
    w.check(await p.locator('.feature-row').count() === FEATURES.length, `the plan lists ${await p.locator('.feature-row').count()} features, the offer has ${FEATURES.length}`);
    await shows(FREE_LINE);
    const card = p.locator('.plan-card');
    w.check(await card.getAttribute('role') === 'button', 'the plan card is not on sale (role is not "button")');
    w.check(flat(await card.getAttribute('aria-label')) === flat(await w.say('Starter, $97 per month')), `plan label is ${await card.getAttribute('aria-label')}`);
    w.check((await p.locator('.logo-text').innerText()).trim() === 'BrandOS', 'the mark above the plan is not "BrandOS"');
    const text = await appText();
    w.check(!/Phase\s*0\d/i.test(text), 'a numbered phase is still painted');
    w.check(!/API key|clé API/i.test(text), 'the plans view mentions an API key');
    w.check(await p.locator('#app a[href^="mailto:me@qtmbg.com"]').count() === 1, 'the door to Nizzar is not a mail link to me@qtmbg.com');
    w.check(await p.locator('#app a[href^="/login"]').getAttribute('href') === '/login?reason=signin&return_to=%2Ffoundation', 'the sign-in link does not return to /foundation');
  });

  await w.step('signed out: the card hands over to sign-in, with the plan', async () => {
    await p.evaluate(() => localStorage.removeItem('qb_session'));
    await Promise.all([p.waitForURL(/\/login\?/), p.locator('.plan-card').click()]);
    const u = new URL(p.url());
    w.check(u.searchParams.get('reason') === 'signin', `sign-in reason is ${u.searchParams.get('reason')}`);
    w.check(u.searchParams.get('return_to') === '/payment.html?plan=starter', `return_to is ${u.searchParams.get('return_to')}`);
    w.check(calls.length === 0, 'checkout was called for a signed-out visitor');
  });

  await w.step('signed out: an old deep link does the same', async () => {
    await p.evaluate(() => sessionStorage.setItem('walk_signed_out', '1'));
    await p.goto(`${origin}/payment.html?plan=agency&lang=${w.lang}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await p.waitForURL(/\/login\?/);
    w.check(new URL(p.url()).searchParams.get('return_to') === '/payment.html?plan=starter', `a retired plan link returns to ${new URL(p.url()).searchParams.get('return_to')}`);
    w.check(calls.length === 0, 'checkout was called for a signed-out deep link');
    await p.evaluate(() => sessionStorage.removeItem('walk_signed_out'));
  });

  await w.step('signed in: checkout, then back from Stripe', async () => {
    await w.open();
    await plans();
    answer = { status: 200, delay: 900, body: { checkout_url: `${origin}/payment.html?payment=success&plan=starter` } };
    await p.locator('.plan-card').click();
    await see('Redirecting to checkout');
    await see('You will complete payment securely on Stripe.');
    await p.waitForURL(/payment=success/);
    await p.waitForFunction(() => !!window.QBI18N, null, { timeout: T });
    await see("You're in.");
    await see('Your account is active. Your Brand Profile is waiting in the system.');
    await see('Enter BrandOS →');
    const c = calls[calls.length - 1];
    w.check(calls.length === 1, `checkout was called ${calls.length} times`);
    w.check(c.method === 'POST', `checkout method is ${c.method}`);
    w.check(c.auth === 'Bearer walk', `checkout authorization is ${c.auth}`);
    w.check(c.lang === w.lang, `checkout was told the language is ${c.lang}`);
    w.check(c.body.price_id === STARTER_PRICE, `checkout price is ${c.body.price_id}`);
    w.check(c.body.success_url === 'https://app.quantumbranding.ai/payment.html?payment=success&plan=starter', `success_url is ${c.body.success_url}`);
    w.check(c.body.cancel_url === 'https://app.quantumbranding.ai/payment.html', `cancel_url is ${c.body.cancel_url}`);
    const local = await p.evaluate(() => ({ tier: localStorage.getItem('qb_user_tier'), status: localStorage.getItem('qb_sub_status') }));
    w.check(local.tier === 'starter' && local.status === 'active', `after success the local hint is ${JSON.stringify(local)}`);
    w.check(!/API key|clé API/i.test(await appText()), 'the success view still promises an API key');
    await Promise.all([p.waitForURL(/\/foundation/), w.click('Enter BrandOS →', { timeout: T })]);
  });

  await w.step('cancelled at Stripe: back on the plans, nothing charged', async () => {
    const before = calls.length;
    await w.open();                                   // cancel_url is this page, bare
    await plans();
    w.check(calls.length === before, 'returning from a cancelled checkout called the endpoint again');
    w.check(await p.locator('.plan-card').getAttribute('role') === 'button', 'the plan cannot be chosen again after a cancel');
    w.check(await p.locator('.center-view').count() === 0, 'a result view is shown after a cancel');
  });

  for (const e of ERRORS) {
    await w.step(`error · ${e.name}`, async () => {
      answer = e;
      const before = calls.length;
      await p.locator('.plan-card').click();
      await see('Something went wrong');
      await shows(e.says);
      w.check(calls.length === before + 1, 'the endpoint was not called exactly once');
      const text = await appText();
      w.check(!/_/.test(text.replace(/me@qtmbg\.com/g, '')), `a raw error code is painted: ${text}`);
      await w.click('← Try again', { timeout: T });
      await plans();
    });
  }

  await w.step('signed in: a retired plan link checks out Starter', async () => {
    answer = { status: 502, body: { error: 'stripe_error', status: 500 } };
    for (const plan of ['platform', 'pro', 'agency', 'starter']) {
      const before = calls.length;
      await w.open(`plan=${plan}`);
      await see('Something went wrong');
      w.check(calls.length === before + 1, `?plan=${plan} did not start a checkout`);
      w.check(calls[calls.length - 1].body.price_id === STARTER_PRICE, `?plan=${plan} asked for ${calls[calls.length - 1].body.price_id}`);
      w.check(calls[calls.length - 1].body.success_url.endsWith('&plan=starter'), `?plan=${plan} returns as ${calls[calls.length - 1].body.success_url}`);
    }
    await shows(STRIPE_DOWN);
    await w.click('← Try again', { timeout: T });
    await plans();
  });
}
