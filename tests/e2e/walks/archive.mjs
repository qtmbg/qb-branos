// The archive: empty before the lock, stuck after it, then the full tree
// with a delivered reading, a locked one, one still generating, one failed,
// earlier versions underneath, and work from before locks were recorded.
import {
  signIn, answer, supabaseClientStub, noteAll, noteDates, noRetiredWords, pageText,
  profile, QBP, archiveTree, NOTIFICATIONS, BRAND, ago, HOUR, DAY, uid,
} from './_app/fixtures.mjs';

export const page = 'archive.html';
export const title = 'empty, stuck, the tree with every artifact state, locked row, error';
export const session = true;

export async function walk(w) {
  await signIn(w);
  await supabaseClientStub(w);
  const qbp = await answer(w, /\/api\/qbp(\?|$)/, profile());
  const arts = await answer(w, /\/api\/artifacts(\?|$)/, { ok: true, chains: [], legacy: [] });
  await answer(w, /\/api\/notifications(\?|$)/, NOTIFICATIONS);
  const tree = archiveTree();
  noteAll(w, [tree, BRAND]);

  await w.step('empty, foundation not locked: what fills it', async () => {
    await w.open();
    await noteDates(w, [ago(3 * HOUR), ago(26 * HOUR), ago(40 * DAY), ago(2 * DAY)]);
    await w.see('Every artifact produced for your brand.');
    await w.see('Your archive fills once your foundation is locked.');
    await w.see('Start with the Brand Soul Map. Locking your foundation produces the readings you read here.');
    w.check(await w.page.locator('.qb-archive-empty a.qb-button').getAttribute('href') === '/foundation', 'the empty archive does not send to the foundation');
  });

  await w.step('locked but nothing arrived: where to run them again', async () => {
    qbp.set(profile({ lockedAt: ago(2 * DAY) }));
    await w.open();
    await w.see('Your foundation is locked but no artifacts have arrived.');
    await w.see('Something went wrong while your readings were produced. Open the Console to run them again, or write to me@qtmbg.com.');
    w.check(await w.page.locator('.qb-archive-empty a.qb-button').getAttribute('href') === '/agents', 'the stuck archive does not send to the Console');
  });

  await w.step('the tree: counts, the lock, every state', async () => {
    arts.set(tree);
    await w.open();
    // 4 readings, each with one earlier version, one queued, two earlier: 11. Two locked.
    await w.see('11 artifacts · 2 locked');
    w.check(await w.page.locator('.qb-archive-chain').count() === 2, 'the two locks are not shown as two groups');
    await w.see('Locked recently · 1 agent');
    await w.see(`The Soul of ${BRAND}`);
    await w.see(`What ${BRAND} Has Not Decided`);
    const pills = (await w.page.locator('.qb-archive-chain .qb-status-pill').allInnerTexts()).map(t => t.trim().toLowerCase());
    for (const en of ['Failed', 'Generating', 'Queued', 'Locked']) {
      const painted = (await w.say(en)).toLowerCase();
      w.check(pills.includes(painted), `no row shows the state ${en}`);
    }
    w.check(await w.page.locator('.qb-archive-chain-child').count() === 4, 'the earlier versions are not nested under their reading');
    await w.see('Earlier work');
    await w.see('Artifacts produced before runs were grouped by lock.');
    await w.see(`A Mark for ${BRAND}`);
  });

  await w.step('each row is captioned with its movement, never a phase', async () => {
    const captions = (await w.page.locator('.qb-artifact-row__meta span:first-child').allInnerTexts()).map(c => c.toLowerCase());
    w.check(captions.filter(c => c === 'observe').length === 4, `Observe captions: ${captions.join(',')}`);
    w.check(captions.filter(c => c === 'collapse').length === 5, `Collapse captions: ${captions.join(',')}`);
    w.check(captions.filter(c => c === 'build').length === 2, `Build captions: ${captions.join(',')}`);
    await noRetiredWords(w, 'archive');
  });

  await w.step('a delivered row opens the artifact; one in production goes nowhere', async () => {
    const delivered = w.page.locator('.qb-archive-chain .qb-artifact-row').first();
    w.check(await delivered.getAttribute('href') === `/artifact?id=${uid(1)}`, 'the delivered reading does not link to its artifact');
    const pending = w.page.locator('.qb-artifact-row.is-pending').first();
    w.check(await pending.getAttribute('href') === null, 'a reading still in production is a link');
  });

  await w.step('a locked row says what Starter adds', async () => {
    await w.page.locator('.qb-artifact-row.is-locked').first().click();
    await w.see('Open the rest of your foundation.', { within: '.qb-paywall-modal' });
    await w.see('The Visual DNA and War Table exercises, the Sensescape, Visual DNA and War Table readings, the three Build agents and the full QBP export.', { within: '.qb-paywall-modal' });
    await w.see('Starter, $97 / month. Cancel anytime.', { within: '.qb-paywall-modal' });
    await w.click('Not now');
    w.check(await w.page.locator('.qb-paywall-modal').count() === 0, 'the modal stayed open');
  });

  await w.step('the server fails: the page says so', async () => {
    arts.set({ __status: 500, error: 'Could not list artifacts' });
    await w.open();
    await w.see('Your archive could not load.');
    await w.see('HTTP 500: Could not list artifacts');
    await w.see('Try again');
  });
}
