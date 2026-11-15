// Visual DNA, print view: the sheet behind a Starter exercise.
//
// The Starter gate first, then the sheet empty (nothing in the profile),
// filled from the profile, filled from a ?qbp= link, and the two ways it
// prints. The fields this sheet reads (colorDirection, typographyDirection,
// visualFeel, visualEnergy, visualDensity, visualEra, visualDNA) are written
// by no tool in the repo today, so "filled" is seeded here.
export const page = 'visual-dna-pdf.html';
export const title = 'Starter gate, empty and filled sheet, cover and colophon, link data shown as text, print';
export const session = true;    // the sheet belongs to a Starter exercise
export const timeout = 90;

const norm = s => String(s).replace(/\s+/g, ' ').trim();

const BRAND = 'Maison Levain';
const PROFILE = {
  brandName: BRAND,
  colorDirection: 'Walk color: warm flour white and oven black.',
  typographyDirection: 'Walk type: a soft serif.',
  visualFeel: 'Walk feel: unhurried.',
  visualEnergy: 'Walk energy: slow.',
  visualDensity: 'Walk density: airy.',
  visualEra: 'Walk era: timeless.',
};
// Markup carried in a link. It must be shown as text and never run.
const MARKUP = '<img src=x onerror="window.__ran=1">';
const LINKED = { brandName: BRAND, visualDNA: 'Walk statement: flour, steel and morning light.', colorDirection: MARKUP };
const DATA = [...Object.values(PROFILE), ...Object.values(LINKED), `${PROFILE.colorDirection} · ${PROFILE.typographyDirection}`, 'Lea Martin'];
const DIMENSIONS = ['Color Direction', 'Typography', 'Visual Feel', 'Energy', 'Density', 'Era'];

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
    w.check(free.pathname === '/payment.html' && free.searchParams.get('reason') === 'upgrade' && free.searchParams.get('tool') === 'visual-dna',
      `a signed-in free account landed on ${free.pathname}${free.search}, not the plan page for Visual DNA`);

    await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  });

  await w.step('empty: cover', async () => {
    await w.open();
    await need('Visual DNA · Collapse', { within: '.cover' });
    w.check(new URL(p.url()).pathname === '/visual-dna-pdf.html', 'a Starter account did not stay on the sheet');
    w.check(await p.title() === await w.say('Visual DNA report · BrandOS'), `title tag: ${await p.title()}`);
    await expect('Visual DNA - Print Preview', { within: '.controls' });
    await expect('↓ Save as PDF', { within: '.controls' });
    await expect('Your Brand', { within: '.cover' });
    await expect('Visual Language Report', { within: '.cover' });
    await expect('Generated', { within: '.cover' });
    await expect(await today(), { within: '.cover' });
    await expect('For', { within: '.cover' });
    await expect('Founder', { within: '.cover' });
    // Cover meta: the method, by name.
    w.check(/^(Methodology|Méthode)\s*The Collapse$/.test(await text('.cover .meta > div:last-child')), 'the cover meta does not read method, then The Collapse: ' + await text('.cover .meta > div:last-child'));
  });

  await w.step('empty: pages and closing', async () => {
    await expect('Visual Intelligence');
    await expect('01 · Visual Summary');
    await expect('The visual world'); await expect('that is distinctly yours');
    await expect('Visual DNA Statement');
    await expect('Your visual language - synthesized from your selections - defines the aesthetic world your brand inhabits.');
    await expect('02 · Visual Dimensions');
    await expect('Your aesthetic'); await expect('coordinates');
    // Nothing in the profile: each section says so instead of standing empty.
    await expect('No visual dimensions recorded.', { within: '#dim-grid' });
    await expect('03 · Color Direction');
    await expect('The palette'); await expect('of your world');
    await expect('No color direction recorded.', { within: '#color-section' });
    await expect('04 · What this opens');
    await expect('How this feeds into your brand system');
    await expect('Your Visual DNA flows directly into Logo Direction and Logo Evaluation. Your aesthetic language is now embedded in your Quantum Brand Profile - informing decisions without requiring you to explain yourself twice.');
    const numbers = await p.evaluate(() => [...document.querySelectorAll('.page .pn')].map(e => e.textContent.trim()));
    w.check(numbers.join() === '01 / 02,02 / 02', `the two sheets are numbered ${numbers.join(' and ')}`);

    await expect('Document Complete', { within: '.closing' });
    await expect('Your visual world'); await expect('is now operational.');
    await expect("Visual DNA feeds Logo Direction and Logo Evaluation. The aesthetic coordinates you've defined will shape every visual decision from here forward.");
    await expect('Continue to Build →');
    w.check(await p.locator('.closing a').first().getAttribute('href') === 'https://quantumbranding.ai/os', 'the closing link does not point at BrandOS');
    // Colophon: the method, The Collapse, the cycle beneath, then who made it.
    const colophon = norm(await p.locator('.closing > div').last().evaluate(el => el.previousElementSibling.innerText));
    w.check(/^(METHODOLOGY|MÉTHODE) The Collapse Observe · Collapse · Build · Hold quantumbranding\.ai (CREATED BY|CRÉÉ PAR) Nizzar Ben Chekroune$/.test(colophon), `colophon reads: ${colophon}`);
    // The numbered phases are retired, and so is every tool a founder cannot reach.
    const painted = await p.evaluate(() => document.body.innerText);
    w.check(!/phase\s*0?\d/i.test(painted), 'the sheet still names a numbered phase');
    w.check(!/content tool|every piece of content/i.test(painted), 'the sheet still promises the content tools');
    await translated('empty sheet');
  });

  await w.step('filled from the profile', async () => {
    await seed(PROFILE);
    await w.open();
    await need(BRAND, { painted: true, within: '.cover' });
    for (const sel of ['#cover-brand', '#page-brand', '#page-brand-2', '#close-brand']) w.check(await text(sel) === BRAND, `${sel} does not carry the brand`);
    // With no statement of its own, the sheet joins color and type.
    w.check(await text('#visual-dna-statement') === `${PROFILE.colorDirection} · ${PROFILE.typographyDirection}`, `statement: ${await text('#visual-dna-statement')}`);
    w.check(await count('#dim-grid .dim-card') === 6, `six dimensions expected, ${await count('#dim-grid .dim-card')} shown`);
    const values = [PROFILE.colorDirection, PROFILE.typographyDirection, PROFILE.visualFeel, PROFILE.visualEnergy, PROFILE.visualDensity, PROFILE.visualEra];
    for (let i = 0; i < 6; i++) {
      const card = p.locator('#dim-grid .dim-card').nth(i);
      w.check(await text(card.locator('.dim-label')) === await w.say(DIMENSIONS[i]), `dimension ${i + 1} is labelled ${await text(card.locator('.dim-label'))}`);
      w.check(await text(card.locator('.dim-value')) === values[i], `dimension ${i + 1} does not carry its value`);
    }
    await expect('Color Intelligence', { within: '#color-section' });
    w.check(await text('#color-section .dna-summary-text') === PROFILE.colorDirection, 'the color section does not carry the color direction');
    await absent('No visual dimensions recorded.');
    await absent('No color direction recorded.');
    await translated('sheet filled from the profile');
  });

  await w.step('filled from a link, named', async () => {
    await w.open(link(LINKED) + '&fn=Lea&ln=Martin');
    await need(LINKED.visualDNA, { painted: true });
    w.check(await text('#meta-for') === 'Lea Martin', `the cover is made out to ${await text('#meta-for')}`);
    w.check(await text('#visual-dna-statement') === LINKED.visualDNA, 'the statement in the link is not the one shown');
    // The link wins over the profile in storage: one dimension, not six.
    w.check(await count('#dim-grid .dim-card') === 1, `one dimension came in the link, ${await count('#dim-grid .dim-card')} shown`);
    // What a link carries is text. It is shown as written and never run.
    w.check(await text('#dim-grid .dim-value') === MARKUP && await text('#color-section .dna-summary-text') === MARKUP, 'markup in the link is not shown as text');
    w.check(await count('#dim-grid img, #color-section img') === 0 && !(await p.evaluate(() => window.__ran)), 'markup in the link was run as markup');
    await translated('sheet filled from a link');
  });

  await w.step('print', async () => {
    await w.click('↓ Save as PDF');
    w.check(await p.evaluate(() => window.__printed) === 1, 'Save as PDF did not open the print dialog');
    // ?autoprint=1 prints on its own once the sheet has settled.
    await w.open('autoprint=1');
    await need('Visual DNA · Collapse', { within: '.cover' });
    await p.waitForFunction(() => window.__printed === 1, null, { timeout: 5000 }).catch(() => {});
    w.check(await p.evaluate(() => window.__printed) === 1, 'autoprint did not open the print dialog once');
  });
}
