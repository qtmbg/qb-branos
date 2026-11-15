// War Table, print view: the sheet behind a Starter exercise.
//
// The Starter gate first, then the sheet empty (nothing in the profile),
// filled from the profile the War Table writes, filled from a ?qbp= link,
// and the two ways it prints.
export const page = 'war-table-pdf.html';
export const title = 'Starter gate, empty and filled sheet, cover and colophon, link data shown as text, print';
export const session = true;    // the sheet belongs to a Starter exercise
export const timeout = 90;

const norm = s => String(s).replace(/\s+/g, ' ').trim();

const BRAND = 'Maison Levain';
const TOP = ['Alpha', 'Beta', 'Gamma'];            // what the War Table saves: its three highest scores
// Markup carried in a link. It must be shown as text and never run.
const MARKUP = '<img src=x onerror="window.__ran=1">';
const LINKED = {
  brandName: BRAND,
  strategicPriorities: ['Walk priority from the link', MARKUP],
  competitorLandscape: 'Walk landscape: two bakeries and a supermarket aisle.',
};
const DATA = [BRAND, ...TOP, ...LINKED.strategicPriorities, LINKED.competitorLandscape, 'Lea Martin', 'Acme Studio'];

export async function walk(w) {
  const p = w.page;

  // w.see matches through XPath, whose normalize-space leaves a no-break
  // space alone. French lines that carry one (before ? : ;) are read here.
  const shows = async (written, { painted = false, within = 'body', exact = true, timeout = 8000 } = {}) => {
    const text = norm(painted ? written : await w.say(written));
    try {
      await p.waitForFunction(([t, sel, ex]) => {
        const n = s => s.replace(/\s+/g, ' ').trim();
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node; (node = tw.nextNode());) {
          const v = n(node.data);
          if (!v || !(ex ? v === t : v.includes(t))) continue;
          const el = node.parentElement;
          if (el && el.closest(sel) && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden') return true;
        }
        return false;
      }, [text, within, exact], { timeout });
      return true;
    } catch (e) { return false; }
  };
  // need() waits for the sheet; expect() reads a sheet that is already there.
  const expect = async (written, opts = {}) => w.check(await shows(written, { timeout: 2500, ...opts }), `not on screen: ${JSON.stringify(written)}`);
  const need = async (written, opts) => { if (!(await shows(written, opts))) throw new Error(`not on screen: ${JSON.stringify(written)}`); };
  const absent = async (written, opts = {}) => w.check(!(await shows(written, { timeout: 300, ...opts })), `should not be on screen: ${JSON.stringify(written)}`);
  // Short waits: a missing element fails the step in seconds.
  const text = sel => (typeof sel === 'string' ? p.locator(sel).first() : sel).textContent({ timeout: 3000 }).then(norm);
  const field = i => p.locator('#page-content .field').nth(i).locator('.fv');
  const count = sel => p.locator(sel).count();
  const link = profile => 'qbp=' + encodeURIComponent(Buffer.from(JSON.stringify(profile), 'utf8').toString('base64'));
  const seed = profile => p.evaluate(v => { if (v) localStorage.setItem('qb_qbp', JSON.stringify(v)); else localStorage.removeItem('qb_qbp'); }, profile);
  DATA.forEach(d => w.note(d));

  // The runner reads untranslated text off the last page only. This walk
  // loads the sheet several times, so each load is read before it goes.
  const translated = async where => {
    const misses = await p.evaluate(() => (window.QBI18N.lang === window.QBI18N.source ? [] : window.QBI18N.misses().map(m => m.text)));
    const left = misses.filter(t => !DATA.some(d => norm(t).includes(d) || d.includes(norm(t))));
    w.check(left.length === 0, `${where}: painted with no entry in this language: ${left.join(' | ')}`);
  };
  // The date is written by the page with the en-GB locale and translated by pattern.
  const today = () => p.evaluate(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

  // The sheet prints through window.print(); the walk counts the calls.
  await p.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

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
    w.check(anon.pathname === '/login' && anon.searchParams.get('reason') === 'paywall', `with no session the browser landed on ${anon.pathname}${anon.search}, not the sign-in page`);
    w.check(anon.searchParams.get('return_to') === here.pathname + here.search, `return_to is ${anon.searchParams.get('return_to')}`);

    const profile = route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ qbp: {}, first_name: null, tier: 'free', subscription_status: 'inactive', tool_completions: {} }]) });
    await p.route(/supabase\.co\/rest\/v1\/profiles/, profile);
    const free = await landAsFree('session', target);
    await p.unroute(/supabase\.co\/rest\/v1\/profiles/, profile);
    w.check(free.pathname === '/payment.html' && free.searchParams.get('reason') === 'upgrade' && free.searchParams.get('tool') === 'war-table',
      `a signed-in free account landed on ${free.pathname}${free.search}, not the plan page for the War Table`);

    await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  });

  await w.step('empty: cover', async () => {
    await w.open();
    await need('War Table · Strategic Priorities', { within: '.cover' });
    w.check(new URL(p.url()).pathname === '/war-table-pdf.html', 'a Starter account did not stay on the sheet');
    w.check(await p.title() === await w.say('War Table report · BrandOS'), `title tag: ${await p.title()}`);
    await expect('War Table Report', { within: '.controls' });
    await expect('↓ Save as PDF', { within: '.controls' });
    await expect('Your Brand', { within: '.cover' });
    await expect('Strategic Brand Report', { within: '.cover' });
    await expect('Generated', { within: '.cover' });
    await expect(await today(), { within: '.cover' });
    await expect('For', { within: '.cover' });
    await expect('Founder', { within: '.cover' });
    // Cover meta: the method, by name.
    w.check(/^(Methodology|Méthode)\s*The Collapse$/.test(await text('.cover .meta > div:last-child')), 'the cover meta does not read method, then The Collapse: ' + await text('.cover .meta > div:last-child'));
  });

  await w.step('empty: page and closing', async () => {
    await expect('Strategic Intelligence', { within: '#main-page' });
    await expect('01 · Strategic Priorities');
    await expect('Where you'); await expect('commit your force');
    await expect('No priorities yet. Finish the War Table and your three highest-scoring initiatives appear here.');
    w.check(await count('#page-content .fl') === 0, 'a priority is listed although the profile is empty');
    await absent('02 · Competitive Landscape');
    w.check(norm(await p.locator('#main-page .pnum').innerText()) === '01 / 02' && norm(await p.locator('.closing .pnum').innerText()) === '02 / 02', 'the two sheets are not numbered 01 / 02 and 02 / 02');

    await expect('Document Complete', { within: '.closing' });
    await expect('Your brand intelligence'); await expect('is building.');
    await expect('Each foundation exercise adds a layer to your Quantum Brand Profile. Every output flows automatically into the tools that follow. Nothing gets repeated. Everything compounds.');
    w.check(await p.locator('.closing a').first().getAttribute('href') === 'https://quantumbranding.ai/os', 'the closing link does not point at BrandOS');
    await expect('Continue in BrandOS →');
    // Colophon: the method, The Collapse, the cycle beneath, then who made it.
    const colophon = norm(await p.locator('.closing > div').last().evaluate(el => el.previousElementSibling.innerText));
    w.check(/^(METHODOLOGY|MÉTHODE) The Collapse Observe · Collapse · Build · Hold quantumbranding\.ai (CREATED BY|CRÉÉ PAR) Nizzar Ben Chekroune$/.test(colophon), `colophon reads: ${colophon}`);
    // The numbered phases are retired from everything a visitor reads.
    const painted = await p.evaluate(() => document.body.innerText);
    w.check(!/phase\s*0?\d/i.test(painted), 'the sheet still names a numbered phase');
    await translated('empty sheet');
  });

  await w.step('filled from the profile the War Table writes', async () => {
    await seed({ brandName: BRAND, warTableTopInitiatives: TOP });
    await w.open();
    await need(BRAND, { painted: true, within: '.cover' });
    for (const sel of ['#cover-brand', '#pb-brand', '#close-brand']) w.check(await text(sel) === BRAND, `${sel} does not carry the brand`);
    w.check(await count('#page-content .field') === 3, `three priorities expected, ${await count('#page-content .field')} shown`);
    for (let i = 0; i < 3; i++) {
      await expect(`Priority ${i + 1}`, { within: '#page-content' });
      w.check(await text(field(i)) === TOP[i], `priority ${i + 1} is not ${TOP[i]}`);
    }
    w.check(await count('#page-content .field.fa') === 1, 'the first priority is not the accented one');
    await absent('No priorities yet. Finish the War Table and your three highest-scoring initiatives appear here.');
    await absent('02 · Competitive Landscape');
    await translated('sheet filled from the profile');
  });

  await w.step('filled from a link, named and for a company', async () => {
    await w.open(link(LINKED) + '&fn=Lea&ln=Martin&co=' + encodeURIComponent('Acme Studio'));
    await need('Walk priority from the link', { painted: true });
    w.check(await text('#meta-for') === 'Lea Martin', `the cover is made out to ${await text('#meta-for')}`);
    await expect('Acme Studio · Brand Intelligence', { within: '.cover' });
    // The link wins over the profile in storage.
    w.check(await count('#page-content .field') === 2, `two priorities came in the link, ${await count('#page-content .field')} shown`);
    // What a link carries is text. It is shown as written and never run.
    w.check(await text(field(1)) === MARKUP, 'markup in the link is not shown as text');
    w.check(await count('#page-content img') === 0 && !(await p.evaluate(() => window.__ran)), 'markup in the link was run as markup');
    await expect('02 · Competitive Landscape');
    await expect('Who shares'); await expect('your territory');
    await expect('Landscape Intelligence');
    await expect(LINKED.competitorLandscape, { painted: true });
    await translated('sheet filled from a link');
  });

  await w.step('print', async () => {
    await w.click('↓ Save as PDF');
    w.check(await p.evaluate(() => window.__printed) === 1, 'Save as PDF did not open the print dialog');
    // ?autoprint=1 prints on its own once the sheet has settled.
    await w.open('autoprint=1');
    await need('War Table · Strategic Priorities', { within: '.cover' });
    await p.waitForFunction(() => window.__printed === 1, null, { timeout: 5000 }).catch(() => {});
    w.check(await p.evaluate(() => window.__printed) === 1, 'autoprint did not open the print dialog once');
  });
}
