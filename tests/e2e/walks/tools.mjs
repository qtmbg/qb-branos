// Tools: fourteen cards in four movements, the filters, what each card says
// about access, and where each card leads.
//
// The expected table below is docs/brand/copy-facts.md: which tool sits in
// which movement, what is free, what opens with Starter, and that Hold is
// not open yet. A card that drifts from it fails here.
export const page = 'tools.html';
export const title = 'fourteen cards, filters, access labels, every link resolves';

const TOOLS = [
  { name: 'Signal Scan',            movement: 'observe',  label: 'Observe · Free',      href: 'signal-scan.html' },
  { name: 'Archetype Compass',      movement: 'collapse', label: 'Collapse · Free',     href: 'archetype-compass.html' },
  { name: 'Brand Soul Map',         movement: 'observe',  label: 'Observe · Free',      href: 'brand-soul-map.html' },
  { name: 'Sensescape',             movement: 'observe',  label: 'Observe · Free',      href: 'sensescape.html' },
  { name: 'Visual DNA',             movement: 'collapse', label: 'Collapse · Starter',  href: 'visual-dna.html' },
  { name: 'War Table',              movement: 'collapse', label: 'Collapse · Starter',  href: 'war-table.html' },
  { name: 'The Profiles',           movement: 'observe',  label: 'Observe · Free',      href: 'the-profiles.html' },
  { name: 'Brand Document',         movement: 'build',    label: 'Build · Free',        href: 'brand-document.html' },
  { name: 'Logo Direction',         movement: 'build',    label: 'Build · Starter',     href: 'logo-direction-agent.html' },
  { name: 'Logo Evaluation',        movement: 'build',    label: 'Build · Starter',     href: 'logo-evaluation-agent.html' },
  { name: 'Voice Guide',            movement: 'build',    label: 'Build · Starter',     href: 'voice-guide-agent.html' },
  { name: 'Performance Dashboard',  movement: 'hold',     label: 'Hold · Not open yet', href: null },
  { name: 'Quarterly Brand Review', movement: 'hold',     label: 'Hold · Not open yet', href: null },
  { name: 'Predictive Panel',       movement: 'hold',     label: 'Hold · Not open yet', href: null },
];
const COUNT = { all: 14, observe: 4, collapse: 3, build: 4, hold: 3 };

export async function walk(w) {
  const p = w.page;
  // A target that is not there fails in seconds, never by waiting out a default.
  const T = 4000;
  p.setDefaultTimeout(T);
  p.setDefaultNavigationTimeout(8000);
  const see = (text, opts = {}) => w.see(text, { timeout: T, ...opts });
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const said = async english => flat(await w.say(english));
  const cards = () => p.evaluate(() => [...document.querySelectorAll('.tool-card')].map(c => ({
    name: c.querySelector('.card-name').innerText.replace(/\s+/g, ' ').trim(),
    // The label is set in upper case by CSS; the text node is what the dictionary holds.
    label: c.querySelector('.card-phase').textContent.replace(/\s+/g, ' ').trim(),
    movement: c.getAttribute('data-category'),
    href: c.querySelector('a.card-cta') ? c.querySelector('a.card-cta').getAttribute('href') : null,
    cta: c.querySelector('a.card-cta') ? c.querySelector('a.card-cta').textContent.replace(/\s+/g, ' ').trim() : null,
    desc: c.querySelector('.card-desc').textContent.replace(/\s+/g, ' ').trim(),
    shown: c.getClientRects().length > 0,
  })));
  let origin = '';

  await w.step('open', async () => {
    await w.open();
    origin = new URL(p.url()).origin;
    await see('Four movements.');
    await see('One brand.');
    w.check((await p.locator('.tools-hero_eye').innerText()).includes('BrandOS'), 'the eyebrow recased the product name');
  });

  await w.step('fourteen cards, each in its movement, each saying what it costs', async () => {
    const list = await cards();
    w.check(list.length === TOOLS.length, `the page shows ${list.length} cards, the facts sheet has ${TOOLS.length} tools`);
    for (let i = 0; i < TOOLS.length; i++) {
      const want = TOOLS[i], got = list[i] || {};
      w.check(got.name === await said(want.name), `card ${i + 1} is ${JSON.stringify(got.name)}, expected ${want.name}`);
      w.check(got.movement === want.movement, `${want.name} sits in ${got.movement}, the facts sheet says ${want.movement}`);
      w.check(got.label === await said(want.label), `${want.name} is labelled ${JSON.stringify(got.label)}, expected ${want.label}`);
      w.check(got.href === want.href, `${want.name} links to ${got.href}, expected ${want.href}`);
    }
    const sense = list.find(c => c.name === 'Sensescape') || { desc: '' };
    w.check(sense.desc.endsWith(await said('The exercise is free. Its reading opens with Starter.')) || sense.desc === await said('Map how your brand feels, sounds, smells, and moves. Full sensory identity. The exercise is free. Its reading opens with Starter.'),
      `Sensescape does not say its reading opens with Starter: ${sense.desc}`);
    const text = flat(await p.locator('main').innerText());
    w.check(!/Phase\s*0\d|discovery|découverte/i.test(text), 'the retired phase vocabulary is still painted');
    w.check(!/every exercise is free|the foundation is free/i.test(text), 'the page says every exercise is free');
  });

  await w.step('the structured data lists the same fourteen', async () => {
    const ld = await p.evaluate(() => {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { const j = JSON.parse(s.textContent); if (j['@type'] === 'ItemList') return j; } catch (e) {}
      }
      return null;
    });
    w.check(!!ld, 'no ItemList in the structured data');
    if (!ld) return;
    w.check(ld.numberOfItems === TOOLS.length, `numberOfItems is ${ld.numberOfItems}`);
    w.check(ld.itemListElement.length === TOOLS.length, `the list holds ${ld.itemListElement.length} items`);
    w.check(ld.itemListElement.map(i => i.name).join('|') === TOOLS.map(t => t.name).join('|'), `the list names are ${ld.itemListElement.map(i => i.name).join(', ')}`);
  });

  await w.step('filters', async () => {
    for (const f of ['observe', 'collapse', 'build', 'hold', 'all']) {
      await p.locator(`.filter-pill[data-filter="${f}"]`).click();
      await p.waitForTimeout(150);
      const shown = (await cards()).filter(c => c.shown);
      w.check(shown.length === COUNT[f], `filter "${f}" shows ${shown.length} cards, expected ${COUNT[f]}`);
      w.check(f === 'all' || shown.every(c => c.movement === f), `filter "${f}" shows a card from another movement`);
      w.check(await p.locator('.filter-pill.active').count() === 1 && await p.locator(`.filter-pill[data-filter="${f}"].active`).count() === 1, `filter "${f}" is not the one marked active`);
    }
    await see('All', { within: '.filter-bar' });
  });

  await w.step('every card link resolves to a real page', async () => {
    const list = await cards();
    const links = list.filter(c => c.href);
    w.check(links.length === TOOLS.filter(t => t.href).length, `${links.length} cards carry a link`);
    for (const c of links) {
      const res = await p.request.get(`${origin}/${c.href.replace(/^\//, '')}`);
      const body = res.ok() ? await res.text() : '';
      w.check(res.ok(), `${c.name} links to ${c.href}, which answers ${res.status()}`);
      w.check(/<title>[^<]+<\/title>/.test(body), `${c.name} links to ${c.href}, which is not a page`);
    }
    const hold = list.filter(c => c.movement === 'hold');
    w.check(hold.length === 3 && hold.every(c => c.href === null && c.cta === null), 'a Hold card still carries a call to action');
    w.check(await p.locator('main a[href*="dashboard"], main a[href*="quarterly"], main a[href*="panel"]').count() === 0, 'the page still links to a Hold tool');
    const cta = await p.locator('.bottom-cta-btn').getAttribute('href');
    w.check((await p.request.get(`${origin}/${cta}`)).ok(), `the closing button links to ${cta}, which does not resolve`);
  });

  await w.step('a card opens its tool', async () => {
    await Promise.all([p.waitForURL(/archetype-compass\.html/), p.locator('.tool-card a.card-cta[href="archetype-compass.html"]').click()]);
    await p.waitForFunction(() => !!window.QBI18N, null, { timeout: T });
    w.check(await p.evaluate(() => document.documentElement.lang) === w.lang, 'the language did not follow to the tool');
    await w.open();
    await see('Four movements.');
  });
}
