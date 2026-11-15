// The account page: what a free and a Starter account see, where the
// upgrade leads, the billing portal when it answers and when it does not,
// signing out, and the page when the profile cannot be read.
import {
  signIn, answer, supabaseClientStub, noRetiredWords, pageText, landedOn, json,
  profile, QBP, NOTIFICATIONS, USER, ago, DAY,
} from './_app/fixtures.mjs';

export const page = 'account.html';
export const title = 'free and Starter, upgrade link, billing portal and its failure, sign out, load error';
export const session = true;

export async function walk(w) {
  await signIn(w);
  await supabaseClientStub(w);
  const qbp = await answer(w, /\/api\/qbp(\?|$)/, profile());
  await answer(w, /\/api\/notifications(\?|$)/, NOTIFICATIONS);

  await w.step('a free account: plan, and where the upgrade leads', async () => {
    await w.open();
    await w.see('Your account');
    await w.see(USER.email, { painted: true });
    await w.see('Upgrade to Starter');
    const href = await w.page.locator('.qb-account a.qb-button').first().getAttribute('href');
    w.check(href === '/paywall', `the upgrade goes to ${href}, not /paywall`);
    w.check(await w.page.getByText(await w.say('Manage subscription'), { exact: true }).count() === 0, 'a free account is offered the billing portal');
    await noRetiredWords(w, 'account, free');
  });

  await w.step('a Starter account: active since, and the portal button', async () => {
    qbp.set(profile({ tier: 'starter', qbp: QBP.full, lockedAt: ago(2 * DAY) }));
    await w.open();
    await w.see('Manage subscription');
    // The date is painted by the page in the reader's language.
    const since = await w.page.evaluate(iso => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), ago(41 * DAY));
    w.note(since);
    const text = await pageText(w);
    w.check(text.includes(since), `the page does not show the start date ${since}`);
    w.check(await w.page.getByText(await w.say('Upgrade to Starter'), { exact: true }).count() === 0, 'a Starter account is still asked to upgrade');
    await noRetiredWords(w, 'account, Starter');
  });

  await w.step('the billing portal does not answer: the page says so and the button comes back', async () => {
    const portal = await answer(w, /\/api\/billing-portal/, { __status: 500, error: 'portal_down' });
    await w.click('Manage subscription');
    await w.see('The billing portal is unavailable right now. Email me@qtmbg.com and we’ll sort it.');
    await w.see('Manage subscription');
    w.check(portal.calls.length === 1 && portal.calls[0].method === 'POST', 'the portal was not asked once, by POST');
  });

  await w.step('the billing portal answers: the browser goes where it says', async () => {
    const origin = new URL(w.page.url()).origin;
    await w.mock(/\/api\/billing-portal/, route => json(route, { url: `${origin}/404.html?from=portal` }));
    await w.click('Manage subscription');
    await w.page.waitForURL(u => u.searchParams.get('from') === 'portal', { timeout: 8000 });
  });

  await w.step('sign out: the server is told, the session is dropped, the browser is on the home page', async () => {
    await w.open();
    const told = [];
    await w.mock(/\/auth\/v1\/logout/, route => { told.push(route.request().method()); return json(route, {}); });
    // The walk signs in again on every page load, so the session is read
    // at the moment the page lets go of it, before the home page loads.
    await w.page.evaluate(() => {
      const logout = window.QB.logout;
      window.QB.logout = function () { const r = logout.apply(this, arguments); sessionStorage.setItem('walk_session_after_logout', localStorage.getItem('qb_session') || ''); return r; };
    });
    await w.click('Sign out');
    await landedOn(w, '/');
    w.check(told.length === 1 && told[0] === 'POST', `the auth server was told ${told.length} time(s) to end the session`);
    const left = await w.page.evaluate(() => sessionStorage.getItem('walk_session_after_logout'));
    let kept = {};
    try { kept = JSON.parse(left || '{}') || {}; } catch (e) {}
    w.check(left !== null && !kept.token, 'the page kept the session token after signing out');
  });

  await w.step('the profile cannot be read: the page says so and offers to try again', async () => {
    qbp.set({ __status: 500, error: 'down' });
    await w.open();
    await w.see('Could not load your account. Reload and try again.');
    await w.see('Try again');
  });
}
