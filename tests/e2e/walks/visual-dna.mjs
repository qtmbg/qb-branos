// Visual DNA: the Starter gate, the studio, three rounds of keep and
// discard, the finals, the reveal, the capture form and the report.
// The exercise shows two hundred images. The walk keeps eight of them in
// round one, six in round two and four in round three, so the finals have
// two pairs and the report has numbers that can be checked.
export const page = 'visual-dna.html';
export const title = 'Starter gate, studio, three rounds, finals, reveal, capture, report, saved to the profile';
export const session = true;    // the exercise opens with Starter, so the founder is signed in
export const timeout = 420;     // seconds; the three interstitials alone take 27

const SESSION = 'Maison Levain, autumn';
const FIRST = 'Lea';
const COMPANY = 'Maison Levain';
const EMAIL = 'lea@example.com';

export async function walk(w) {
  const p = w.page;
  w.note(SESSION); w.note(FIRST); w.note(COMPANY); w.note(EMAIL); w.note(COMPANY.toUpperCase());

  // The helper gives every page load a paid tier. While the flag below is
  // set, the tier keys are dropped and kept out, so the page opens as a
  // free account, with or without a session.
  await p.addInitScript(() => {
    let mode = null;
    try { mode = sessionStorage.getItem('walk_free'); } catch (e) {}
    if (!mode) return;
    const blocked = mode === 'anon' ? ['qb_user_tier', 'qb_sub_status', 'qb_session'] : ['qb_user_tier', 'qb_sub_status'];
    const setItem = Storage.prototype.setItem;
    if (mode === 'session') setItem.call(localStorage, 'qb_session', JSON.stringify({ token: 'walk', userId: '00000000-0000-4000-8000-000000000000' }));
    blocked.forEach(k => localStorage.removeItem(k));
    Storage.prototype.setItem = function (k, v) { if (this === localStorage && blocked.includes(k)) return; return setItem.call(this, k, v); };
  });
  const landAsFree = async (mode, target) => {
    await p.evaluate(m => sessionStorage.setItem('walk_free', m), mode);
    await p.goto(target, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await p.waitForURL(u => u.pathname !== new URL(target).pathname, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(400);
    const landed = new URL(p.url());
    await p.evaluate(() => sessionStorage.removeItem('walk_free')).catch(() => {});
    return landed;
  };

  await w.step('a free account is sent away', async () => {
    await w.open();
    const target = p.url();
    const here = new URL(target);
    const anon = await landAsFree('anon', target);
    w.check(anon.pathname === '/login', `with no session the browser landed on ${anon.pathname}${anon.search}, not /login`);
    w.check(anon.searchParams.get('return_to') === here.pathname + here.search, `return_to is ${anon.searchParams.get('return_to')}`);
    const profile = route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ qbp: {}, first_name: null, tier: 'free', subscription_status: 'inactive', tool_completions: {} }]) });
    await p.route(/supabase\.co\/rest\/v1\/profiles/, profile);
    const free = await landAsFree('session', target);
    await p.unroute(/supabase\.co\/rest\/v1\/profiles/, profile);
    w.check(free.pathname === '/payment.html', `a signed-in free account landed on ${free.pathname}${free.search}, not /payment.html`);
    w.check(free.searchParams.get('reason') === 'upgrade' && free.searchParams.get('tool') === 'visual-dna', `plan page query is ${free.search}`);
  });

  await w.step('the studio: what the exercise is, in the words of the movements', async () => {
    await w.open();
    await w.see('Collapse · Visual DNA · Build the look');
    await w.see('Build the look.');
    const text = await p.evaluate(() => document.body.innerText);
    w.check(!/Phase 0\d/i.test(text), 'the studio still names a phase');
    await w.fill('.vd-session-input', SESSION);
    await p.locator('.vd-intro_cta button').click();
    await w.see('Calibration Phase');
    await w.see('Discard');
    await w.see('Keep');
    await p.locator('.phase-intro button').click();
    await p.locator('.swipe-card img').first().waitFor({ state: 'visible', timeout: 8000 });
  });

  // One decision. Waits until the next card is on the stage, or the round is over.
  const decide = async keep => {
    const before = await p.locator('.swipe-card img').first().getAttribute('src').catch(() => null);
    await p.keyboard.press(keep ? 'ArrowRight' : 'ArrowLeft');
    await p.waitForFunction(b => {
      if (document.querySelector('.phase-transition, .phase-finals, .phase-reveal, .finals-half')) return true;
      const c = document.querySelector('.swipe-card img');
      return !!c && c.getAttribute('src') !== b;
    }, before, { timeout: 5000 });
  };
  const round = async (label, total, keeps) => {
    const counter = (await p.locator('.round-progress .rp-label').last().innerText()).trim();
    w.check(counter === `0 / ${total}`, `${label} opens on ${JSON.stringify(counter)}, expected 0 / ${total}`);
    for (let i = 0; i < total; i++) await decide(i < keeps);
  };

  await w.step('round one: two hundred images, eight kept', async () => {
    w.check(await p.locator('.swipe-card img').first().evaluate(img => img.complete && img.naturalWidth > 0), 'the first image did not load');
    await round('round one', 200, 8);
    await p.locator('.phase-transition').waitFor({ state: 'visible', timeout: 5000 });
  });

  await w.step('round two: only what was kept comes back', async () => {
    await p.locator('.swipe-card img').first().waitFor({ state: 'visible', timeout: 14000 });
    await round('round two', 8, 6);
    await p.locator('.phase-transition').waitFor({ state: 'visible', timeout: 5000 });
  });

  await w.step('round three: six left, four kept', async () => {
    await p.locator('.swipe-card img').first().waitFor({ state: 'visible', timeout: 14000 });
    await round('round three', 6, 4);
    await p.locator('.phase-transition').waitFor({ state: 'visible', timeout: 5000 });
  });

  await w.step('the finals: two pairs, one pick each', async () => {
    await p.locator('.finals-half').first().waitFor({ state: 'visible', timeout: 14000 });
    w.check(await p.locator('.finals-half').count() === 2, 'a final does not show two images');
    await p.locator('.finals-half').first().click();
    await p.locator('.finals-half').first().waitFor({ state: 'visible', timeout: 5000 });
    await p.locator('.finals-half').last().click();
  });

  await w.step('the reveal: the two that survived', async () => {
    await p.locator('.reveal-tile').first().waitFor({ state: 'visible', timeout: 8000 });
    w.check(await p.locator('.reveal-tile').count() === 2, `the reveal shows ${await p.locator('.reveal-tile').count()} image(s), two were picked`);
    await w.click('Proceed to diagnostics →');
  });

  await w.step('the capture form: a name and a real address, or no report', async () => {
    const submit = p.locator('form button[type="submit"], .vd-form button').last();
    w.check(await submit.isDisabled(), 'the report can be asked for with an empty form');
    await w.fill('#vd-firstName', FIRST);
    await w.fill('#vd-email', 'lea@');
    w.check(await submit.isDisabled(), 'the report can be asked for with a broken address');
    await w.fill('#vd-company', COMPANY);
    await w.fill('#vd-email', EMAIL);
    w.check(!(await submit.isDisabled()), 'the report cannot be asked for with a valid form');
    await submit.click();
    await w.see('Processing…', { timeout: 3000 });
  });

  await w.step('the report: six sections, the numbers of this run', async () => {
    await w.see('Analysis Ready.', { timeout: 8000 });
    for (const section of ['Sec 01. The Eye Chooses', 'Sec 02. The Visual Signature', 'Sec 03. Subconscious Bias', 'Sec 04. Rejection Taxonomy', 'Sec 05. Energetic Synthesis', 'Sec 06. Final Brief']) await w.see(section);
    await w.see('Acceptance Rate');
    const text = await p.evaluate(() => document.body.innerText);
    // Eight kept out of two hundred in round one is four per cent.
    w.check(/\b4\s?%/.test(text), 'the acceptance rate of this run (4 %) is not on the report');
    w.check(text.includes(COMPANY), 'the report does not name the client');
    w.check(!/Phase 0\d/i.test(text), 'the report still names a phase');
  });

  await w.step('the profile holds what the exercise found', async () => {
    const qbp = await p.evaluate(() => JSON.parse(localStorage.getItem('qb_qbp') || '{}'));
    w.check(!!qbp.visualDnaCompletedAt, 'the profile does not say the exercise is done');
    w.check(qbp.visualDnaKeepCount > 0 && Number.isFinite(qbp.visualDnaDiscardRate), `the profile holds keep ${qbp.visualDnaKeepCount}, discard rate ${qbp.visualDnaDiscardRate}`);
    w.check(Array.isArray(qbp.visualDnaKeptImages) && qbp.visualDnaKeptImages.length > 0, 'the profile does not hold the kept images');
    w.check(qbp.brandName === COMPANY, `the profile's brand is ${JSON.stringify(qbp.brandName)}`);
  });
}
