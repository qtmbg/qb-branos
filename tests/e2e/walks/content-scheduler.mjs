// Content Scheduler (operator-only): queue a post, import a pack of
// "POST 1:" blocks, send to Buffer through every failure and a retry, read
// the scheduled list, reload.
//
// What this page does not have, so the walk cannot cover it: an approval
// loop (nothing is generated here, so nothing is revised), a copy or export
// button, and a reachable theme toggle (the canonical chassis hides the
// tool's own header, toggle included; the last step asserts exactly that).
export const page = 'content-scheduler.html';
export const title = 'queue, bulk import, Buffer send with each failure, retry, reload';

const POSTS = [
  'Monday opens with the founder story in three lines.',
  'Wednesday shows the workshop table before the launch.',
  'Friday closes the week with one question for readers.',
];
const BULK = POSTS.map((text, i) => `POST ${i + 1}:\n${text}`).join('\n\n');
const SINGLE = 'A single post written by hand, long enough to keep.';
const PROFILE = 'profile-7f3a';
const TOKEN = 'walk-token';
const DATE = '2031-03-14';

const pad = n => String(n).padStart(2, '0');
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function walk(w) {
  const p = w.page;
  const queue = () => p.evaluate(() => state.queue.map(q => ({ text: q.text, platform: q.platform, profileId: q.profileId, date: q.date, time: q.time, status: q.status, error: q.error })));
  // w.see compares through XPath normalize-space, which keeps the no-break
  // space French sets before a colon. Playwright's own text match folds it.
  const seen = async (english, timeout = 8000) => {
    await p.getByText(await w.say(english), { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout });
  };
  const scheduleAll = p.locator('#btn-schedule-all');

  // Buffer, answered here. Every call is kept so the walk can read what left the page.
  let buffer = 'network';
  const sent = [];
  await w.mock(/api\.bufferapp\.com/, async route => {
    sent.push(new URLSearchParams(route.request().postData() || ''));
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (buffer === 'network') return route.abort();
    if (buffer === 'http500') return json(500, {});
    if (buffer === 'http502') return json(502, {});
    if (buffer === 'refused') return json(200, { success: false });
    return json(200, { success: true, updates: [{ id: 'buf-' + sent.length }] });
  });

  await w.step('open, empty', async () => {
    await w.open();
    await w.see('Connect Buffer');
    await w.see('Queue (0)');
    await w.see('Scheduled (0)');
    await w.see('The room is empty');
    w.check((await queue()).length === 0, 'the queue did not start empty');
  });

  await w.step('validation: nothing is queued or connected from empty fields', async () => {
    await w.click('Connect');
    await w.see('Connect Buffer');
    w.check(await p.evaluate(() => state.connected) === false, 'an empty token connected');
    await w.click('Add First Post');
    await w.see('Draft a Concept');
    await w.click('Add to Queue');
    await w.see('Queue (0)');
    w.check((await queue()).length === 0, 'an empty post was queued');
  });

  await w.step('add one post, best times follow the platform', async () => {
    await w.fill('#add-text', SINGLE);
    await p.locator('#add-platform').selectOption('linkedin_personal');
    const best = await p.locator('#add-time option').evaluateAll(opts => opts.filter(o => /★/.test(o.textContent)).map(o => o.value));
    w.check(best.join() === '07:30,12:00,17:30', `LinkedIn Personal best times are ${best.join()}, expected 07:30,12:00,17:30`);
    await p.locator('#add-time').selectOption('12:00');
    await w.click('Add to Queue');
    await w.see('Queue (1)');
    await w.see(SINGLE, { painted: true });
    await w.see('queued');
  });

  await w.step('a post with no profile and no date is not ready, and says so', async () => {
    await w.see('⚠ No profile ID - add before scheduling');
    await w.see('⚠ No date selected - required before scheduling');
    await w.see('0 posts ready to schedule');
    w.check(await scheduleAll.isDisabled(), '"Schedule All" is enabled with nothing ready');
  });

  await w.step('type the profile id key by key, pick a date', async () => {
    await p.locator('.q-profile').first().click();
    await p.keyboard.type(PROFILE, { delay: 15 });
    await p.keyboard.press('Tab');
    await p.waitForTimeout(200);
    const [post] = await queue();
    w.check(post.profileId === PROFILE, `typed "${PROFILE}", the queue kept "${post.profileId}"`);
    await p.locator('.q-date').first().fill(DATE);
    await p.waitForTimeout(200);
    await w.gone('⚠ No profile ID - add before scheduling');
    await w.gone('⚠ No date selected - required before scheduling');
    await w.see('1 post ready to schedule');
    await seen(`Date: ${DATE}`);
    await seen('Time: 12:00');
    w.check(!(await scheduleAll.isDisabled()), '"Schedule All" stayed disabled with one post ready');
  });

  await w.step('sending needs a token', async () => {
    await w.click('Schedule All');
    await w.see('Add your Buffer access token first.');
    w.check(sent.length === 0, 'Buffer was called with no token');
    await w.fill('#token-input', TOKEN);
    await w.click('Connect');
    await w.see('Buffer connected');
    await w.gone('Add your Buffer access token first.');
  });

  await w.step('bulk import of three "POST n:" blocks', async () => {
    await w.click('Bulk Import');
    await w.see('Bulk Import System');
    await w.fill('#bulk-text', BULK);
    await p.locator('#bulk-platform').selectOption('instagram');
    await w.fill('#bulk-profile-id', PROFILE);
    await w.click('Parse & Queue');
    await w.see('Queue (4)');
    await w.see('4 posts ready to schedule');
    const imported = (await queue()).slice(1);
    w.check(imported.length === 3, `three blocks were pasted, ${imported.length} were queued`);
    w.check(imported.map(q => q.text).join('|') === POSTS.join('|'), `the "POST n:" headings were not stripped cleanly: ${JSON.stringify(imported.map(q => q.text))}`);
    // The page says it spaces posts 3 days apart, and gives each the platform's best times in turn.
    const today = new Date();
    const want = [0, 3, 6].map(n => { const d = new Date(today); d.setDate(d.getDate() + n); return isoDay(d); });
    w.check(imported.map(q => q.date).join() === want.join(), `dates are ${imported.map(q => q.date).join()}, expected ${want.join()} (3 days apart)`);
    w.check(imported.map(q => q.time).join() === '08:00,12:00,17:00', `times are ${imported.map(q => q.time).join()}, expected Instagram's best times in order`);
    w.check(imported.every(q => q.platform === 'instagram' && q.profileId === PROFILE), 'the default platform or the global profile id was not applied');
    for (const text of POSTS) await w.see(text, { painted: true });
  });

  const failure = async (mode, message) => {
    buffer = mode;
    const before = sent.length;
    await w.click('Schedule All');
    await seen(message);
    await w.see('Schedule All');
    const q = await queue();
    w.check(sent.length - before === 4, `${mode}: ${sent.length - before} call(s) reached Buffer, expected 4`);
    w.check(q.every(x => x.status === 'error'), `${mode}: statuses are ${q.map(x => x.status).join()}, expected four errors`);
    w.check(await p.locator('.q-profile').count() === 4, `${mode}: a failed post lost its fields and cannot be corrected`);
    await w.see('4 posts ready to schedule');
    w.check(!(await scheduleAll.isDisabled()), `${mode}: "Schedule All" is disabled, so a failed post cannot be sent again`);
  };

  await w.step('Buffer unreachable', () => failure('network', 'Error: Failed to fetch'));
  await w.step('Buffer answers 500', () => failure('http500', 'Error: HTTP 500'));
  await w.step('Buffer answers 502', () => failure('http502', 'Error: HTTP 502'));
  await w.step('Buffer refuses the post', () => failure('refused', 'Error: Unknown error'));

  await w.step('retry, all four are sent', async () => {
    buffer = 'ok';
    const before = sent.length;
    await w.click('Schedule All');
    await w.see('Scheduled (4)');
    await w.see('0 posts ready to schedule');
    const q = await queue();
    w.check(q.every(x => x.status === 'scheduled' && !x.error), `statuses are ${q.map(x => x.status).join()}, expected four scheduled`);
    w.check(await scheduleAll.isDisabled(), '"Schedule All" is enabled with nothing left to send');
    const calls = sent.slice(before);
    w.check(calls.length === 4, `${calls.length} call(s) reached Buffer, expected 4`);
    w.check(calls.map(c => c.get('text')).join('|') === [SINGLE, ...POSTS].join('|'), 'the text sent to Buffer is not the text in the queue');
    w.check(calls.every(c => c.get('profile_ids[]') === PROFILE && c.get('access_token') === TOKEN), 'profile id or token missing from a Buffer call');
    // The moment is read in the browser's own time zone, as the page reads it.
    // Node and Chromium can disagree on a future date where daylight rules moved.
    const first = await p.evaluate(day => String(new Date(day + 'T12:00:00').getTime() / 1000), DATE);
    w.check(calls[0].get('scheduled_at') === first, `scheduled_at is ${calls[0].get('scheduled_at')}, expected ${first} (${DATE} at 12:00)`);
    w.check(await p.locator('.btn-remove').count() === 0, 'a sent post can still be removed from the queue');
  });

  await w.step('the scheduled list', async () => {
    await w.click('Scheduled (4)');
    await w.see('✓ SENT TO BUFFER');
    const rows = await p.evaluate(() => state.scheduled.map(s => ({ date: s.date, time: s.time, id: s.bufferId })));
    w.check(rows.length === 4, `${rows.length} scheduled row(s), expected 4`);
    for (const r of rows) await seen(`Scheduled for ${r.date} at ${r.time} · System ID: ${r.id}`);
    for (const text of [SINGLE, ...POSTS]) await w.see(text, { painted: true });
  });

  await w.step('add and remove a post', async () => {
    await w.click('Add Post');
    await w.fill('#add-text', 'One more post, to be removed again.');
    await w.click('Add to Queue');
    await w.see('Queue (5)');
    await p.locator('.btn-remove').first().click();
    await w.see('Queue (4)');
    await w.gone('One more post, to be removed again.');
  });

  await w.step('reload: token, queue and scheduled list are kept', async () => {
    await w.open();
    await w.see('Buffer connected');
    await w.see('Queue (4)');
    await w.see('Scheduled (4)');
    w.check((await queue()).every(x => x.status === 'scheduled'), 'the queue did not come back as it was saved');
  });

  await w.step('change token', async () => {
    await w.click('Change token');
    await w.see('Connect Buffer');
    w.check(await p.evaluate(() => localStorage.getItem('qb_buffer_token')) === null, 'the token was not forgotten');
  });

  await w.step('theme toggle', async () => {
    // The tool's own header carries the toggle and the canonical chassis
    // hides that header. Either it is hidden whole, or the toggle works.
    const toggle = p.locator('#btn-theme');
    if (await toggle.isVisible()) {
      const before = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await toggle.click();
      w.check(await p.evaluate(() => document.documentElement.getAttribute('data-theme')) !== before, 'the theme toggle did not change data-theme');
    } else {
      w.check(!(await p.locator('#app > header.header').isVisible()), 'the theme toggle is hidden but its header is not');
    }
  });
}
