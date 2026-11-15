// The ship gate: an operator's checklist. Four tiers, each locked until
// the one before it is closed. The state is kept in this browser.
import { noRetiredWords, pageText, OPERATOR_ONLY_NAMES } from './_app/fixtures.mjs';

export const page = 'war-room.html';
export const title = 'four tiers, gating, status line, saved state, reset';

export async function walk(w) {
  const tier = n => w.page.locator('#tiers .tier').nth(n);
  const locked = n => tier(n).getAttribute('data-locked');
  const checkAll = async n => {
    const total = await tier(n).locator('.task_chk').count();
    // Each tick re-renders the list, so the next box is found again each time.
    for (let i = 0; i < total; i++) await tier(n).locator('.task_chk').nth(i).check();
    return total;
  };

  await w.step('open: nothing done, three tiers locked', async () => {
    await w.open();
    await w.see('What is missing');
    await w.see('Not ready. Tier 00 must close before anything else.');
    await w.see('Security gate');
    await w.see('Post-launch backlog');
    w.check(await w.page.locator('#tiers .tier').count() === 4, 'the page does not show four tiers');
    w.check(await locked(0) === '0', 'Tier 00 is locked on a fresh page');
    for (const n of [1, 2, 3]) w.check(await locked(n) === '1', `tier ${n} is open before the one before it is closed`);
    w.check(await w.page.locator('#shipStatus').getAttribute('data-state') === 'red', 'the status is not red on a fresh page');
  });

  await w.step('the page carries no retired vocabulary and no operator-only agent', async () => {
    await noRetiredWords(w, 'ship gate');
    const text = await pageText(w);
    for (const name of OPERATOR_ONLY_NAMES) w.check(!text.includes(name), `the page names ${name}, an operator-only agent`);
  });

  await w.step('close Tier 00: security clean, Tier 01 opens', async () => {
    const total = await checkAll(0);
    w.check(total === 6, `Tier 00 has ${total} tasks, the header says 6`);
    await w.see('Security clean. Tier 01 transaction chain is still open.');
    w.check(await locked(1) === '0', 'Tier 01 stayed locked after Tier 00 closed');
    w.check(await locked(2) === '1', 'Tier 02 opened before Tier 01 closed');
    // "6 of 6": the count is two text nodes, the number and the rest.
    w.check(await tier(0).locator('.tier_count strong').innerText() === '6', 'the Tier 00 count is not 6');
    await w.see('of 6', { within: '#tiers .tier:nth-child(1)' });
  });

  await w.step('close Tier 01: it can take money', async () => {
    const total = await checkAll(1);
    w.check(total === 8, `Tier 01 has ${total} tasks, the header says 8`);
    await w.see('Can take money. Polish remaining in Tier 02.');
    w.check(await w.page.locator('#shipStatus').getAttribute('data-state') === 'amber', 'the status is not amber with two tiers closed');
  });

  await w.step('close Tier 02: ship ready, the backlog opens', async () => {
    const total = await checkAll(2);
    w.check(total === 8, `Tier 02 has ${total} tasks, the header says 8`);
    await w.see('Ship ready. Tiers 00, 01, and 02 are closed.');
    w.check(await w.page.locator('#shipStatus').getAttribute('data-state') === 'green', 'the status is not green with three tiers closed');
    w.check(await locked(3) === '0', 'the backlog stayed locked after the three gates closed');
    w.check(await tier(3).locator('.task_chk').count() === 11, 'the backlog does not hold the 11 tasks its header counts');
  });

  await w.step('the state is saved: a reload keeps it', async () => {
    await w.open();
    await w.see('Ship ready. Tiers 00, 01, and 02 are closed.');
    w.check(await tier(0).locator('.task_chk:checked').count() === 6, 'the ticks were lost on reload');
  });

  await w.step('unticking one box closes what came after', async () => {
    await tier(0).locator('.task_chk').first().uncheck();
    await w.see('Not ready. Tier 00 must close before anything else.');
    w.check(await locked(1) === '1', 'Tier 01 stayed open after Tier 00 reopened');
  });

  await w.step('reset: back to nothing done', async () => {
    // The runner accepts the confirm dialog.
    await w.click('Reset all checks');
    await w.see('Not ready. Tier 00 must close before anything else.');
    w.check(await w.page.locator('#tiers .task_chk:checked').count() === 0, 'reset left boxes ticked');
    w.check(await w.page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('qb_shipgate_v2')).done)) === '{}', 'reset did not clear the saved state');
  });
}
