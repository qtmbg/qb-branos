// The Brand Profile page: empty, three free exercises in, and full on
// Starter. What is locked says why, in the words of the offer.
import {
  signIn, answer, supabaseClientStub, noRetiredWords, pageText, landedOn, json, noteAll,
  profile, QBP, NOTIFICATIONS, BRAND,
} from './_app/fixtures.mjs';

export const page = 'qbp.html';
export const title = 'empty, free with three exercises, Starter and full, locked sections, export';
export const session = true;

export async function walk(w) {
  await signIn(w);
  await supabaseClientStub(w);
  const qbp = await answer(w, /\/api\/qbp(\?|$)/, profile());
  await answer(w, /\/api\/notifications(\?|$)/, NOTIFICATIONS);
  noteAll(w, [QBP, BRAND]);
  // "Updated Nov 15, 2026" is painted by the page from a made-up timestamp.
  const noteUpdated = async () => {
    const t = (await w.page.locator('body').innerText()).split('\n').filter(l => /\d{4}/.test(l));
    t.forEach(l => w.note(l));
  };

  await w.step('empty: where to begin, and what Starter opens', async () => {
    await w.open();
    await noteUpdated();
    await w.see('Your QBP is empty.');
    await w.see('Start with the Archetype Compass or the Brand Soul Map. Each exercise fills part of this page.');
    await w.see('Begin the Archetype Compass');
    await w.see('Opens with Starter.');
    await w.see('Visual DNA and War Table open with Starter: the two exercises, their readings, and these sections of your QBP.');
    const locked = await w.page.getByText(await w.say('Opens with Starter.'), { exact: true }).count();
    w.check(locked === 2, `${locked} sections say they open with Starter; Visual DNA and War Table make two`);
    await noRetiredWords(w, 'qbp, empty');
  });

  await w.step('a free account cannot export: it is told what Starter gives', async () => {
    await w.page.locator('.qb-qbp-cover__export').first().click();
    await w.see('Open QBP export.');
    await w.see('Starter gives you the full QBP as a downloadable file.');
    await w.click('Not now');
    // The two locked sections are drawn with the same card, inline. The
    // modal is the one that sits directly on the page.
    w.check(await w.page.locator('body > .qb-paywall-modal').count() === 0, 'the modal stayed open');
  });

  await w.step('three free exercises in: the soul is written, the two Starter sections stay locked', async () => {
    qbp.set(profile({ qbp: QBP.ready }));
    await w.open();
    await noteUpdated();
    await w.see(`The Soul of ${BRAND}`);
    w.check((await pageText(w)).includes(QBP.ready.manifesto), 'the manifesto the founder wrote is not on the page');
    const locked = await w.page.getByText(await w.say('Opens with Starter.'), { exact: true }).count();
    w.check(locked === 2, `${locked} sections locked for a free account, expected 2`);
  });

  await w.step('a locked section leads to the paywall, with its reason', async () => {
    await w.page.getByText(await w.say('Upgrade to Starter'), { exact: true }).first().click();
    await landedOn(w, '/paywall');
    w.check(new URL(w.page.url()).searchParams.get('reason') === 'qbp_section', 'the paywall was not told which section');
  });

  await w.step('Starter, every exercise done: nothing is locked', async () => {
    qbp.set(profile({ tier: 'starter', qbp: QBP.full, lockedAt: new Date().toISOString() }));
    await w.open();
    await noteUpdated();
    await w.see(`The Visual Language of ${BRAND}`);
    w.check(await w.page.getByText(await w.say('Opens with Starter.'), { exact: true }).count() === 0, 'a Starter account still sees a locked section');
    await w.see('Export QBP');
    await noRetiredWords(w, 'qbp, Starter');
  });

  await w.step('export fails: the page says so', async () => {
    await answer(w, /\/api\/qbp\/export/, { __status: 500 });
    await w.page.locator('.qb-qbp-cover__export').first().click();
    await w.see('Export failed', { timeout: 6000 });
  });

  await w.step('export works: the page says what is coming and the file is fetched', async () => {
    const origin = new URL(w.page.url()).origin;
    await w.mock(/\/api\/qbp\/export/, route => json(route, { signed_url: `${origin}/404.html?from=export`, format: 'json' }));
    await w.open();
    await noteUpdated();
    await w.page.locator('.qb-qbp-cover__export').first().click();
    await w.see('Downloading as JSON.', { timeout: 6000 });
    await w.page.waitForURL(u => u.searchParams.get('from') === 'export', { timeout: 8000 });
  });
}
