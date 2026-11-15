// The foundation page, state by state: nothing started, in progress, ready
// to lock, the lock itself, readings being produced, delivered on a free
// account, a failed reading, Starter just bought, a dormant tier, an error.
// Every API answer is made up here.
import {
  signIn, answer, supabaseClientStub, noteAll, noteDates, noRetiredWords, pageText,
  profile, QBP, artifactList, NOTIFICATIONS, FILES, BRAND, ago, HOUR, DAY,
} from './_app/fixtures.mjs';

export const page = 'foundation.html';
export const title = 'cold, in progress, lock, producing, delivered, failed, Starter, error';
export const session = true;

const ADDS = 'The Visual DNA and War Table exercises, the Sensescape, Visual DNA and War Table readings, the three Build agents and the full QBP export.';

export async function walk(w) {
  await signIn(w);
  await supabaseClientStub(w, FILES);
  const LOCKED_AT = ago(2 * DAY);
  const qbp = await answer(w, /\/api\/qbp(\?|$)/, profile());
  const arts = await answer(w, /\/api\/artifacts(\?|$)/, { artifacts: [] });
  const lock = await answer(w, /\/api\/lock-foundation/, { ok: true });
  const checkout = await answer(w, /\/api\/stripe\/checkout/, { __status: 502, error: 'stripe_error' });
  const rerun = await answer(w, /\/api\/agents\/rerun/, { __status: 202, ok: true });
  await answer(w, /\/api\/notifications(\?|$)/, NOTIFICATIONS);
  noteAll(w, [QBP.full, QBP.ready, BRAND]);
  const cards = () => w.page.locator('.qb-foundation-roadmap .qb-phase-card');

  await w.step('nothing started: where to begin, and the three movement cards', async () => {
    await w.open();
    await noteDates(w, [ago(3 * HOUR), LOCKED_AT]);
    await w.see('Your foundation starts with one question.');
    await w.see('Begin the Brand Soul Map');
    await w.see('The four movements');
    w.check(await cards().count() === 3, `the roadmap shows ${await cards().count()} cards, not three`);
    await w.see('The foundation');
    await w.see('0 of 3 exercises complete');
    await w.see('The Build agents');
    await w.see('Opens with Starter.');
    await w.see('The Hold tools');
    await w.see('Not open yet.');
    w.check(await cards().nth(2).locator('.qb-button').isDisabled(), 'the Hold card offers a button that can be pressed');
    await noRetiredWords(w, 'foundation, nothing started');
  });

  await w.step('in progress: one of three, and two exercises that need Starter', async () => {
    qbp.set(profile({ qbp: QBP.started }));
    await w.open();
    await w.see('Continue your foundation.');
    await w.see('Archetype Compass, Brand Soul Map and Sensescape are what it takes to lock your foundation. After lock, your readings are produced.');
    await w.see('1 of 3 exercises complete', { within: '.qb-foundation-progress' });
    w.check(await w.page.locator('.qb-exercise-card').count() === 5, 'the foundation does not list its five exercises');
    w.check(await w.page.locator('.qb-exercise-card.is-locked').count() === 2, 'Visual DNA and War Table are not both shown locked on a free account');
    const lockedNames = await w.page.locator('.qb-exercise-card.is-locked .qb-exercise-card__name').allInnerTexts();
    w.check(lockedNames.join(',') === 'Visual DNA,War Table', `the locked exercises are ${lockedNames.join(',')}`);
    await noRetiredWords(w, 'foundation, in progress');
  });

  await w.step('a locked exercise says what Starter adds, and the price', async () => {
    await w.page.locator('.qb-exercise-card.is-locked .qb-button').first().click();
    await w.see('Open the rest of your foundation.', { within: '.qb-paywall-modal' });
    await w.see(ADDS, { within: '.qb-paywall-modal' });
    await w.see('Starter, $97 / month. Cancel anytime.', { within: '.qb-paywall-modal' });
    await w.click('Not now');
    w.check(await w.page.locator('.qb-paywall-modal').count() === 0, 'the modal stayed open after "Not now"');
  });

  await w.step('ready to lock: three of three', async () => {
    qbp.set(profile({ qbp: QBP.ready }));
    await w.open();
    await w.see('Your foundation is ready to lock.');
    await w.see('Once locked, your foundation answers become immutable. Your readings are produced, and an email reaches you as each one is ready, within minutes.');
    await w.see('3 of 3 exercises complete');
    // Not locked yet, so the card must not say it is.
    w.check(!(await cards().first().innerText()).includes(await w.say('Foundation locked.')), 'the foundation card reads as locked before the lock');
  });

  await w.step('lock: confirm, then the readings are being produced', async () => {
    await w.click('Lock my foundation');
    await w.see('Lock your foundation?');
    await w.see('Once you lock your foundation, your answers become immutable. Your readings are produced, and an email reaches you as each one is ready, within minutes.');
    // What the server answers once the lock is written.
    qbp.set(profile({ qbp: QBP.ready, lockedAt: LOCKED_AT }));
    arts.set(artifactList(['generating', 'queued', 'queued', 'queued']));
    await w.click('Yes, lock my foundation');
    await w.see('Your foundation is locked. Your readings are being prepared.');
    await w.see('Your readings are being prepared.');
    w.check(lock.calls.length === 1 && lock.calls[0].method === 'POST', `the lock was not posted once: ${lock.calls.length} call(s)`);
    const rows = await w.page.locator('.qb-foundation-queue__agent').allInnerTexts();
    w.check(rows.length === 4 && rows[0].toLowerCase() === 'soul map', `the queue does not name the four readings: ${rows.join(' | ')}`);
    await w.see('Generating', { within: '.qb-foundation-queue' });
    await w.see('Queued', { within: '.qb-foundation-queue' });
    await w.see('Foundation locked.', { within: '.qb-foundation-roadmap' });
  });

  await w.step('delivered, free account: one reading to read, three that need Starter', async () => {
    arts.set(artifactList(['delivered', 'delivered', 'delivered', 'delivered'], [1, 2, 3]));
    await w.open();
    await w.see('Your Soul Map is ready.');
    await w.see('The three other readings open with Starter.');
    const tiles = w.page.locator('.qb-foundation-tiles .qb-artifact-row');
    w.check(await tiles.count() === 4, 'the four readings are not listed');
    w.check(await tiles.locator('xpath=self::*[contains(@class,"is-locked")]').count() === 3, 'three readings are not shown locked');
    w.check((await tiles.first().getAttribute('href') || '').startsWith('/artifact?id='), 'the Soul Map reading is not a link to the artifact');
    // The caption is the movement, never a phase number.
    const captions = await w.page.locator('.qb-artifact-row__meta span:first-child').allInnerTexts();
    w.check(captions.map(c => c.toLowerCase()).join(',') === 'observe,observe,collapse,collapse', `the readings are captioned ${captions.join(',')}`);
    await w.see('Starter opens the Sensescape, Visual DNA and War Table readings, plus the Visual DNA and War Table exercises.');
    await w.see('$97 / month. Cancel anytime.');
    await noRetiredWords(w, 'foundation, delivered on a free account');
  });

  await w.step('a locked reading opens the same offer', async () => {
    await w.page.locator('.qb-foundation-tiles .qb-artifact-row.is-locked').first().click();
    await w.see(ADDS, { within: '.qb-paywall-modal' });
    await w.click('Not now');
  });

  await w.step('upgrade, and the checkout refuses: the page says so', async () => {
    await w.click('Upgrade to Starter', { within: '.qb-foundation-upgrade-banner' });
    await w.see('Checkout failed: stripe_error');
    w.check(checkout.calls.length === 1 && /price_1Th8JkEHEAcWrG55Abr1OZXe/.test(checkout.calls[0].body || ''), 'the checkout was not asked for the Starter price');
  });

  await w.step('a failed Soul Map is not announced as ready', async () => {
    arts.set(artifactList(['failed', 'delivered', 'delivered', 'delivered'], [1, 2, 3]));
    await w.open();
    await w.see('Your foundation is locked.');
    w.check(!(await pageText(w)).includes(await w.say('Your Soul Map is ready.')), 'a failed Soul Map reads as ready');
    await w.see('Failed', { within: '.qb-foundation-tiles' });
  });

  await w.step('Starter, just bought: what opened, the bell, the files', async () => {
    qbp.set(profile({ tier: 'starter', qbp: QBP.full, lockedAt: LOCKED_AT }));
    arts.set(artifactList(['delivered', 'delivered', 'delivered', 'delivered']));
    await w.open('upgrade=success');
    await w.see('Starter is live.');
    await w.see('Your tools are open.');
    await w.see('The Visual DNA and War Table exercises, the three other foundation readings, the Build agents and the full QBP export are open. Visual DNA and War Table are next, on this page.');
    w.check(!/upgrade=success/.test(w.page.url()), 'the upgrade flag stayed in the address');
    await w.see('Your foundation is built.');
    await w.see('Build is open: Logo Direction, Logo Evaluation and Voice Guide. Your QBP keeps growing as you complete the Visual DNA and War Table exercises.');
    w.check(await w.page.locator('.qb-foundation-tiles .qb-artifact-row.is-locked').count() === 0, 'a reading is still locked on Starter');
    await w.see('Logo Direction, Logo Evaluation, Voice Guide.');
    w.check(await cards().nth(1).locator('a.qb-button').getAttribute('href') === '/agents', 'the Build card does not open the Console');
    await w.see('Not open yet.');
  });

  await w.step('the bell lists what happened', async () => {
    await w.page.locator('.qb-notification-bell_trigger').click();
    await w.see('Artifact ready');
    await w.see('Soul Map Synthesizer is ready to open.');
    await w.see('Dispatch failed');
    await w.see('War Table Synthesizer could not finish after retries. Open the Console to rerun.');
    await w.see('A chain finished. Open the Console to review.');
    w.check(await w.page.locator('.qb-notification-bell_badge').innerText() === '2', 'the bell does not count two unread');
    await w.page.keyboard.press('Escape');
  });

  await w.step('the files card: what is uploaded, and attaching one to Visual DNA', async () => {
    await w.see('Brand references');
    await w.see('orage-mark-draft.png');
    await w.see('orage-brand-notes.pdf');
    // Only an image the agent can read carries the attach button.
    w.check(await w.page.locator('.qb-file-row_attach').count() === 1, 'the attach button is not on the image alone');
    await w.click('Attach to Visual DNA');
    await w.see('Visual DNA is rereading with your image. The new version lands in your Console.');
    w.check(rerun.calls.length === 1 && /reference-image/.test(rerun.calls[0].body || ''), 'the rerun did not carry the image');
  });

  await w.step('the confirmation can be dismissed', async () => {
    await w.page.locator('.qb-foundation-upgrade-success__close').click();
    await w.gone('Starter is live.');
    await noRetiredWords(w, 'foundation, on Starter');
  });

  await w.step('a dormant tier is told nothing that is not sold', async () => {
    qbp.set(profile({ tier: 'agency', qbp: QBP.full, lockedAt: LOCKED_AT }));
    await w.open('upgrade=success');
    await w.see('Your plan is live.');
    await w.see('Your tools are open.');
    await noRetiredWords(w, 'foundation, dormant tier');
  });

  await w.step('the server fails: the page says what and offers a retry', async () => {
    qbp.set({ __status: 500, error: 'Profile read failed' });
    await w.open();
    await w.see('Your foundation could not load.');
    await w.see('Profile read failed');
    await w.see('Try again');
  });
}
