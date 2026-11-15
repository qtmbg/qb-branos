// Sign-in: the email form, each entry reason, validation, the error state
// and the "link sent" state. No email is sent: /api/send-magic-link is mocked.
import { json, signIn, landedOn } from './_app/fixtures.mjs';

export const page = 'login.html';
export const title = 'email form, reason banners, validation, link sent, send error';

const EMAIL = 'ada@maison-orage.example';

export async function walk(w) {
  // One mocked endpoint, switched between a refusal and a success.
  let mail = { status: 502, body: { ok: false, error: 'Could not send email' } };
  const sent = [];
  await w.mock('**/api/send-magic-link', route => {
    sent.push(JSON.parse(route.request().postData() || '{}'));
    return json(route, mail.body, mail.status);
  });

  await w.step('open: the plain sign-in form', async () => {
    await w.open();
    await w.see('One link. No password.');
    await w.see('Enter your email. A sign-in link lands in your inbox and works for 60 minutes.');
    await w.see('Send my sign-in link →');
    await w.see('free Signal Scan');
    w.check(await w.page.locator('#login-sent').isHidden(), 'the sent state is showing before anything was sent');
  });

  await w.step('validation: an address that is not one', async () => {
    await w.fill('#login-email', 'not-an-email');
    await w.click('Send my sign-in link →');
    await w.see('That email does not look right.');
    w.check(sent.length === 0, 'a bad address reached the server');
  });

  await w.step('error state: the server refuses', async () => {
    await w.fill('#login-fname', 'Ada');
    await w.fill('#login-email', EMAIL);
    await w.click('Send my sign-in link →');
    await w.see('Could not send email');
    await w.see('Send my sign-in link →');
    w.check(await w.page.locator('#login-submit').isEnabled(), 'the button stayed disabled after a failed send');
    w.check(sent.length === 1 && sent[0].email === EMAIL && sent[0].firstName === 'Ada', `the request did not carry the form: ${JSON.stringify(sent)}`);
  });

  await w.step('sent state: the link is on its way', async () => {
    mail = { status: 200, body: { ok: true } };
    await w.click('Send my sign-in link →');
    await w.see('Check your inbox.');
    await w.see(`The link is on its way to ${EMAIL}.`);
    await w.see('Open it in this browser so the work you already did stays attached to your profile. Check spam if it has not landed in two minutes.');
    w.check(await w.page.locator('#login-form').isHidden(), 'the form is still showing after the link was sent');
    w.check(await w.page.locator('#login-aside').isHidden(), 'the Signal Scan aside is still showing after the link was sent');
    w.check(await w.page.evaluate(() => localStorage.getItem('qb_post_auth_return_to')) === '/foundation', 'the return target was not kept for the callback');
  });

  await w.step('use a different email: back to the form', async () => {
    await w.click('Use a different email');
    await w.see('One link. No password.');
    w.check(await w.page.locator('#login-email').inputValue() === '', 'the email field was not cleared');
  });

  await w.step('reason: a tool that needs an account', async () => {
    await w.open('reason=paywall&return_to=%2Flogo-direction-agent.html');
    await w.see('Account needed');
    await w.see('This tool runs on your Brand Profile.');
    await w.see('Sign in first. If your plan covers this tool, it opens with your own brand data behind it. If it does not, the next page says what does. New email addresses get an account on the spot.');
  });

  await w.step('reason: the session ended', async () => {
    await w.open('reason=expired');
    await w.see('Session ended');
    await w.see('Time to sign in again.');
    await w.see('Sessions close after a while. Enter your email for a fresh link. Your work is on the server, nothing was lost.');
  });

  await w.step('an address in the link is filled in', async () => {
    await w.page.evaluate(() => { localStorage.removeItem('qb_pending_signup'); });
    w.note('grace@maison-orage.example');
    await w.open('reason=signin&email=grace%40maison-orage.example');
    w.check(await w.page.locator('#login-email').inputValue() === 'grace@maison-orage.example', 'the address from the link was not filled in');
  });

  await w.step('a hostile return_to is ignored', async () => {
    await w.open('return_to=%2F%2Fevil.example%2Fsteal');
    await w.fill('#login-email', EMAIL);
    await w.click('Send my sign-in link →');
    await w.see('Check your inbox.');
    w.check(await w.page.evaluate(() => localStorage.getItem('qb_post_auth_return_to')) === '/foundation', 'an off-site return_to was kept');
  });

  await w.step('no account, on a Starter exercise: sent here, told why', async () => {
    // The runner seeds a paid tier in localStorage. This visitor has none.
    await signIn(w, { anonymous: true });
    for (const tool of ['visual-dna.html', 'war-table.html']) {
      await w.page.goto(`${new URL(w.page.url()).origin}/${tool}?lang=${w.lang}`, { waitUntil: 'commit', timeout: 10000 });
      await landedOn(w, '/login');
      await w.page.waitForFunction(() => !!window.QBI18N, null, { timeout: 8000 });
      const here = new URL(w.page.url());
      w.check(here.searchParams.get('reason') === 'paywall', `${tool}: landed on login without the reason (${here.search})`);
      w.check((here.searchParams.get('return_to') || '').startsWith('/' + tool), `${tool}: the way back was lost (${here.search})`);
      await w.see('Account needed');
      await w.see('Sign in first. If your plan covers this tool, it opens with your own brand data behind it. If it does not, the next page says what does. New email addresses get an account on the spot.');
    }
  });
}
