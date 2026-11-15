// The page a magic link opens: no token, a session that cannot be
// verified, a session with no user, the happy path, and a link clicked twice.
// Supabase is mocked: no session is ever verified against a real backend.
import { json, go, landedOn, supabaseClientStub, USER, TOKEN } from './_app/fixtures.mjs';

export const page = 'auth-callback.html';
export const title = 'no token, unverifiable session, sign-in, link clicked twice';

export async function walk(w) {
  // Each visit carries its own query: a change of hash alone would not
  // reload the page, and the callback only runs on load.
  w.note(USER.email);
  w.note(USER.firstName);
  // What Supabase answers when the callback asks who this token belongs to.
  let who = { status: 200, body: { id: USER.id, email: USER.email, user_metadata: { first_name: USER.firstName } } };
  const merges = [];
  await w.mock(/supabase\.co\/auth\/v1\/user/, route => json(route, who.body, who.status));
  await w.mock(/supabase\.co\/rest\/v1\/rpc\/merge_/, route => { merges.push(route.request().url()); return json(route, {}); });
  // The foundation page, where a good link ends, loads its storage client
  // from a CDN. It gets a stand-in, so nothing leaves the machine.
  await supabaseClientStub(w);
  const session = () => w.page.evaluate(() => JSON.parse(localStorage.getItem('qb_session') || 'null'));
  // The success message shows for under a second before the page moves on,
  // so this visit is not given time to settle first.
  const visit = n => w.page.goto(`${new URL(w.page.url()).origin}/auth-callback.html?visit=${n}&lang=${w.lang}#access_token=${TOKEN}&refresh_token=walk`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  const arrived = async () => {
    await landedOn(w, '/foundation');
    await w.page.waitForFunction(() => !!window.QBI18N, null, { timeout: 8000 });
    await w.see('Your foundation starts with one question.');
  };

  await w.step('no token in the link', async () => {
    await w.open();
    await w.see('Something went wrong');
    await w.see('Try requesting a new link, or');
    await w.see('go back home');
    await w.see('No token in the URL. The link may have expired or already been used.');
    w.check(await session() === null, 'a session was written with no token');
  });

  await w.step('a token Supabase does not recognise', async () => {
    who = { status: 401, body: { msg: 'invalid JWT' } };
    await go(w, `/auth-callback.html?visit=1#access_token=${TOKEN}&refresh_token=walk`);
    await w.see('Something went wrong');
    await w.see('Could not verify session.');
    w.check(await session() === null, 'a session was written for a token that was refused');
  });

  await w.step('a verified token with no user behind it', async () => {
    who = { status: 200, body: {} };
    await go(w, `/auth-callback.html?visit=2#access_token=${TOKEN}&refresh_token=walk`);
    await w.see('Session verified but returned no user id.');
    w.check(await session() === null, 'a session with no user id was written');
  });

  await w.step('a good link signs in and opens the foundation', async () => {
    who = { status: 200, body: { id: USER.id, email: USER.email, user_metadata: { first_name: USER.firstName } } };
    // Work done before signing in is pushed to the profile, not dropped.
    await w.page.evaluate(() => {
      localStorage.setItem('qb_qbp', JSON.stringify({ brandName: 'Maison Orage' }));
      localStorage.setItem('qb_completions', JSON.stringify({ 'soul-map': { completedAt: 1 } }));
      localStorage.removeItem('qb_post_auth_return_to');
    });
    w.note('Maison Orage');
    await visit(3);
    await w.see("You're in.", { timeout: 4000 });
    await w.see('Opening your page…', { timeout: 2000 });
    await arrived();
    const s = await session();
    w.check(s && s.token === TOKEN && s.userId === USER.id && s.email === USER.email, `the session was not saved whole: ${JSON.stringify(s)}`);
    w.check(merges.some(u => u.includes('merge_qbp')) && merges.some(u => u.includes('merge_completions')), `work done before sign-in was not pushed: ${JSON.stringify(merges)}`);
  });

  await w.step('the same link clicked a second time', async () => {
    await visit(4);
    await w.see('Already signed in. Taking you back…', { timeout: 4000 });
    await arrived();
  });
}
