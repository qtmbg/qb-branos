// Reading an artifact: a delivered one with every block, one stored before
// the movements replaced the phases, a locked one, a missing one, a server
// failure, and the share actions.
import {
  signIn, answer, supabaseClientStub, noteAll, noteDates, noRetiredWords, pageText, landedOn,
  profile, QBP, NOTIFICATIONS, artifactContent, BRAND, ago, DAY, uid,
} from './_app/fixtures.mjs';

export const page = 'artifact.html';
export const title = 'delivered, old eyebrow, locked, missing, server error, copy link, print';
export const session = true;

export async function walk(w) {
  await signIn(w);
  await supabaseClientStub(w);
  await answer(w, /\/api\/qbp(\?|$)/, profile({ tier: 'starter', qbp: QBP.full, lockedAt: ago(2 * DAY) }));
  await answer(w, /\/api\/notifications(\?|$)/, NOTIFICATIONS);
  const content = artifactContent();
  noteAll(w, [content, BRAND]);
  const art = await answer(w, /\/api\/artifacts\/[0-9a-f-]{36}/, { content });

  await w.step('a delivered reading: header, prose, every block', async () => {
    await w.open(`id=${uid(4)}`);
    await noteDates(w, [ago(4 * DAY)]);
    // The title is the agent's, and French paints it through a pattern.
    await w.see(`The Strategic Position of ${BRAND}`);
    const text = await pageText(w);
    for (const said of ['Maison Orage holds a narrow ground and holds it well.', 'Retire the second range', 'storm blue', '#22384A', 'Fraunces']) {
      w.check(text.includes(said), `the reading does not show ${JSON.stringify(said)}`);
    }
    // The agent stores "Collapse · War Table"; the page paints it in capitals.
    const eyebrow = (await w.page.locator('.qb-artifact-header__eyebrow, .qb-rs-tag').first().innerText()).trim().toLowerCase();
    w.check(eyebrow === 'collapse · war table', `the eyebrow reads ${JSON.stringify(eyebrow)}`);
    await w.see('QBP fields referenced');
    await noRetiredWords(w, 'artifact, delivered');
  });

  await w.step('an artifact stored with a phase number paints its movement', async () => {
    for (const [stored, painted] of [
      ['01 Discovery · War Table', 'collapse · war table'],
      ['01 Discovery · Soul Axis', 'observe ·'],
      ['02 Brand Creation · Voice Guide', 'build ·'],
    ]) {
      art.set({ content: artifactContent({ eyebrow: stored }) });
      await w.open(`id=${uid(4)}`);
      const eyebrow = (await w.page.locator('.qb-artifact-header__eyebrow, .qb-rs-tag').first().innerText()).trim().toLowerCase();
      w.check(eyebrow.startsWith(painted), `stored ${JSON.stringify(stored)} paints ${JSON.stringify(eyebrow)}`);
      await noRetiredWords(w, `artifact stored as "${stored}"`);
    }
  });

  await w.step('copy link puts this address on the clipboard', async () => {
    art.set({ content });
    await w.open(`id=${uid(4)}`);
    await w.click('Copy link');
    await w.see('Link copied', { timeout: 5000 });
    const clip = await w.page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (clip !== null) w.check(clip === w.page.url(), `the clipboard holds ${JSON.stringify(clip)}`);
  });

  await w.step('print asks the browser to print', async () => {
    await w.page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await w.click('Print');
    w.check(await w.page.evaluate(() => window.__printed) === 1, 'Print did not call the browser');
  });

  await w.step('a locked reading: what Starter opens, and the way there', async () => {
    art.set({ __status: 402, artifact_meta: { agent_slug: 'sensescape_synthesizer', title: `The Sensory World of ${BRAND}`, phase: '01' }, upgrade_url: '/paywall?reason=artifact&agent=sensescape_synthesizer' });
    await w.open(`id=${uid(2)}`);
    await w.see(`The Sensory World of ${BRAND}`);
    await w.see('Open the rest of your foundation.');
    await w.see('Upgrade to Starter');
    await noRetiredWords(w, 'artifact, locked');
    await w.click('Upgrade to Starter');
    await landedOn(w, '/paywall');
    w.check(new URL(w.page.url()).searchParams.get('agent') === 'sensescape_synthesizer', 'the paywall was not told which reading');
  });

  await w.step('missing, malformed address, server failure: each says what happened', async () => {
    art.set({ __status: 404 });
    await w.open(`id=${uid(9)}`);
    await w.see('This artifact does not exist.');
    await w.see('It may have been removed, or the link is wrong.');
    await w.open('id=not-an-id');
    await w.see('This artifact does not exist.');
    art.set({ __status: 500 });
    await w.open(`id=${uid(9)}`);
    await w.see('This artifact could not be shown.');
    await w.see('Something went wrong on the way. Reload the page, or write to me@qtmbg.com.');
  });
}
