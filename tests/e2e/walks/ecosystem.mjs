// Ecosystem: the persona tabs, the FAQ, the pricing cards and where every
// link on the page leads. The expected copy below is the offer as
// docs/brand/copy-facts.md states it: what is free, what Starter adds, that
// Hold is not open yet, and that no agency plan is sold.
export const page = 'ecosystem.html';
export const title = 'persona tabs, FAQ, pricing cards, Hold not open, every link';

const PERSONAS = [
  { title: ['I have an idea.', 'No brand yet.'],
    text: 'You start at the beginning. The system walks you through identity, sensory mapping, visual language, and strategy. You emerge with a complete, live brand. No prior assets needed.',
    cta: 'Start from zero', href: 'signal-scan.html?door=blank', tag: '01 · The Blank Slate' },
  { title: ['I have a brand.', 'Something feels off.'],
    text: 'The tools audit what you have and tell you what to keep, fix, or rebuild. A scored diagnostic, a logo evaluation, a voice guide. Precise verdict, clear path forward.',
    cta: 'Audit your brand', href: 'signal-scan.html?door=doubt', tag: '02 · The Doubter' },
  { title: ['Competition is', 'coming fast.'],
    text: 'Skip to strategy. The War Table opens with Starter. It scores and ranks your next moves: what to do now, next, and never. The Predictive Panel, which simulates market response before you spend, is not open yet.',
    cta: 'Enter strategic mode', href: 'signal-scan.html?door=scale', tag: '03 · The Player' },
  { title: ['I build brands', 'for clients.'],
    text: 'BrandOS sells one plan, and it is not an agency plan. No client workspaces, no white-label. If you build for clients, write to me@qtmbg.com and say what you need.',
    cta: 'Write to Nizzar', href: 'mailto:me@qtmbg.com', tag: '04 · The Multi-Brand' },
];

const FREE = [
  'Signal Scan diagnostic',
  'Three foundation exercises: Archetype Compass, Brand Soul Map, Sensescape',
  'The Profiles',
  'Your Soul Map reading',
  'Brand Document',
  'Cloud-synced Brand Profile',
];
const STARTER = [
  'The two other foundation exercises: Visual DNA, War Table',
  'The three other foundation readings: Sensescape, Visual DNA, War Table',
  'The three Build agents: Logo Direction, Logo Evaluation, Voice Guide',
  'Full Brand Profile (QBP) export',
  'Full refund within 14 days of your first payment',
  'Cancel anytime',
];
const FREE_LEAD = 'Signal Scan, three foundation exercises, The Profiles, your Soul Map reading and the Brand Document are free, forever. Starter opens the rest of the foundation and the Build agents.';

export async function walk(w) {
  const p = w.page;
  // A target that is not there fails in seconds, never by waiting out a default.
  const T = 4000;
  p.setDefaultTimeout(T);
  p.setDefaultNavigationTimeout(8000);
  const see = (text, opts = {}) => w.see(text, { timeout: T, ...opts });
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const tight = s => String(s).replace(/\s+/g, '');
  const said = async english => flat(await w.say(english));
  const textOf = async sel => flat(await p.locator(sel).first().textContent());
  // w.see matches through XPath, whose normalize-space leaves the no-break
  // space French sets before : ; ? and $. This folds it on both sides.
  const shows = async (written, within = 'main') => {
    const want = await said(written);
    await p.waitForFunction(([sel, text]) => {
      const root = document.querySelector(sel);
      if (!root) return false;
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (n.data.replace(/\s+/g, ' ').trim() === text && n.parentElement && n.parentElement.getClientRects().length) return true;
      }
      return false;
    }, [within, want], { timeout: T }).catch(() => { throw new Error(`not painted: ${JSON.stringify(want)}`); });
  };
  let origin = '';

  await w.step('open', async () => {
    await w.open();
    origin = new URL(p.url()).origin;
    await see('Answer questions,');
    await see('get a brand');
    await shows('Free forever tier · No credit card · 5 minutes to your first result', '.hero');
    await shows('Free · 5 minutes · Instant score', '#scanner');
    await shows('Answer eight questions. Get a score out of 100, read across six dimensions.', '#scanner');
    w.check(await p.locator('#videoEmbed').count() === 0, 'the play button with no video behind it is back on the page');
  });

  await w.step('the pills: ten agents, and Hold said to be closed', async () => {
    const pills = await p.locator('.agent-cluster .agent-pill').allInnerTexts();
    w.check(pills.length === 13, `the cluster shows ${pills.length} pills`);
    w.check(!pills.some(t => /hub/i.test(t)), 'the hub is shown among the tools');
    for (const name of ['Performance Dashboard', 'Quarterly Brand Review', 'Predictive Panel']) {
      w.check(pills.map(flat).includes(await said(name)), `the pills do not name ${name}`);
    }
    w.check(await textOf('.agent-cluster_count strong') === '10', `the count under the pills is ${await textOf('.agent-cluster_count strong')}`);
    await shows('The three Hold tools are not open yet.', '.hero');
  });

  await w.step('persona tabs', async () => {
    await p.locator('#personaTags').scrollIntoViewIfNeeded();
    for (const i of [1, 2, 3, 0]) {
      const want = PERSONAS[i];
      await p.locator(`.persona-tag[data-p="${i}"]`).click();
      await p.waitForFunction(n => document.getElementById('personaStage').getAttribute('data-p') === String(n), i, { timeout: T });
      w.check(tight(await p.locator('#pTitle').textContent()) === tight(await said(want.title[0]) + await said(want.title[1])), `persona ${i + 1} title is ${await textOf('#pTitle')}`);
      w.check(await textOf('#pText') === await said(want.text), `persona ${i + 1} text is ${await textOf('#pText')}`);
      w.check(await textOf('#pCta') === await said(want.cta), `persona ${i + 1} button says ${await textOf('#pCta')}`);
      w.check(await p.locator('#pLink').getAttribute('href') === want.href, `persona ${i + 1} button leads to ${await p.locator('#pLink').getAttribute('href')}`);
      w.check(await textOf('#personaStageTag') === await said(want.tag), `persona ${i + 1} tag is ${await textOf('#personaStageTag')}`);
      w.check(await p.locator('.persona-tag.active').count() === 1 && await p.locator(`.persona-tag[data-p="${i}"].active`).count() === 1, `tab ${i + 1} is not the active one`);
      w.check(await p.locator('.persona-avatar.active').count() === 1 && await p.locator(`.persona-avatar[data-avatar="${i}"].active`).count() === 1, `the picture did not follow tab ${i + 1}`);
    }
    await see('I have an idea.');
    w.check(await p.locator('a[href*="calendly"]').count() === 0, 'a booking link for an agency plan is still on the page');
    w.check(await p.locator('#pLink').getAttribute('target') === null, 'the persona button kept a new-tab target');
  });

  await w.step('Hold is described, and not offered', async () => {
    await shows('Performance Dashboard, Quarterly Brand Review, Predictive Panel. The system measures itself and tells you what to scale, fix, kill. Hold is not open yet.');
    await see('Not open yet');
    await shows('Hold · Not open yet');
    await shows('The Predictive Panel runs a brand move past simulated buyers and returns a confidence score, the friction points, and a verdict. It sits in Hold, and Hold is not open yet.');
    w.check(await p.locator('main a[href*="brand-performance-dashboard"], main a[href*="quarterly-brand-review"], main a[href*="predictive-panel"], main a[href$="/panel"]').count() === 0, 'the page still links to a Hold tool');
  });

  await w.step('pricing cards', async () => {
    const card = n => p.locator('#pricing .price-card').nth(n);
    await p.locator('#pricing').scrollIntoViewIfNeeded();
    w.check(await p.locator('#pricing .price-card').count() === 2, `${await p.locator('#pricing .price-card').count()} plans are shown, two exist`);
    await shows(FREE_LEAD, '#pricing');
    const lists = await p.evaluate(() => [...document.querySelectorAll('#pricing .price-card')].map(c => ({
      name: c.querySelector('.price-name').textContent.replace(/\s+/g, ' ').trim(),
      amount: c.querySelector('.price-amount').textContent.replace(/\s+/g, ' ').trim(),
      period: c.querySelector('.price-period').textContent.replace(/\s+/g, ' ').trim(),
      feats: [...c.querySelectorAll('.price-feat')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
      href: c.querySelector('a.qb-button').getAttribute('href'),
    })));
    const want = [
      { name: 'Brand Profile', amount: '$0', period: '/ forever', feats: FREE, href: 'https://app.quantumbranding.ai/brand-soul-map.html' },
      { name: 'Starter', amount: '$97', period: '/ month', feats: STARTER, href: 'https://app.quantumbranding.ai/payment.html?plan=starter' },
    ];
    for (let i = 0; i < want.length; i++) {
      const got = lists[i] || { feats: [] };
      w.check(got.name === await said(want[i].name), `plan ${i + 1} is named ${got.name}`);
      w.check(got.amount === await said(want[i].amount), `${want[i].name} costs ${got.amount}`);
      w.check(got.period === await said(want[i].period), `${want[i].name} is billed ${got.period}`);
      w.check(got.href === want[i].href, `${want[i].name} button leads to ${got.href}`);
      w.check(got.feats.length === want[i].feats.length, `${want[i].name} lists ${got.feats.length} lines, the offer has ${want[i].feats.length}`);
      for (let k = 0; k < want[i].feats.length; k++) {
        w.check(got.feats[k] === await said(want[i].feats[k]), `${want[i].name} line ${k + 1} is ${JSON.stringify(got.feats[k])}`);
      }
    }
    await shows('Everything in Brand Profile, plus your full foundation and the Build agents.', '#pricing');
    w.check(await p.locator('#pricing a[href^="mailto:"]').getAttribute('href') === 'mailto:me@qtmbg.com', 'the door to Nizzar is not me@qtmbg.com');
    const text = flat(await p.locator('main').innerText());
    w.check(!/Phase\s*0\d/i.test(text), 'a numbered phase is still painted');
    w.check(!/every exercise is free|the foundation is free|chaque exercice est gratuit|la fondation est gratuite/i.test(text), 'the page says every exercise is free');
    w.check(!/30\+|Content Engine|Moteur de contenu/i.test(text), 'the page still promises content output');
  });

  await w.step('FAQ: one answer open at a time, and the same words as the structured data', async () => {
    const items = p.locator('.faq-item');
    const n = await items.count();
    w.check(n === 7, `the FAQ holds ${n} questions`);
    const ld = await p.evaluate(() => {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { const j = JSON.parse(s.textContent); if (j['@type'] === 'FAQPage') return j.mainEntity.map(q => [q.name, q.acceptedAnswer.text]); } catch (e) {}
      }
      return [];
    });
    w.check(ld.length === n, `the structured data holds ${ld.length} questions`);
    await items.first().scrollIntoViewIfNeeded();
    for (let i = 0; i < n; i++) {
      await items.nth(i).locator('.faq-q').click();
      await p.waitForFunction(k => document.querySelectorAll('.faq-item')[k].classList.contains('open'), i, { timeout: T });
      w.check(await p.locator('.faq-item.open').count() === 1, `opening question ${i + 1} left ${await p.locator('.faq-item.open').count()} answers open`);
      await p.waitForFunction(k => document.querySelectorAll('.faq-item')[k].querySelector('.faq-a').getBoundingClientRect().height > 8, i, { timeout: T });
      const q = flat(await items.nth(i).locator('.faq-q').evaluate(b => b.firstChild.data));
      const a = flat(await items.nth(i).locator('.faq-a-inner').textContent());
      if (ld[i]) {
        w.check(q === await said(ld[i][0]), `question ${i + 1} reads ${JSON.stringify(q)}, the structured data says ${JSON.stringify(ld[i][0])}`);
        w.check(a === await said(ld[i][1]), `answer ${i + 1} reads ${JSON.stringify(a)}, the structured data says ${JSON.stringify(ld[i][1])}`);
      }
    }
    await items.nth(n - 1).locator('.faq-q').click();
    await p.waitForFunction(() => document.querySelectorAll('.faq-item.open').length === 0, null, { timeout: T });
  });

  await w.step('every link leads somewhere', async () => {
    const hrefs = await p.evaluate(() => [...document.querySelectorAll('body a[href]')].map(a => a.getAttribute('href')));
    const seen = new Set();
    for (const href of hrefs) {
      if (seen.has(href)) continue;
      seen.add(href);
      if (href.startsWith('#')) {
        w.check(href === '#' || await p.locator(`[id="${href.slice(1)}"]`).count() === 1, `${href} points at nothing on the page`);
        continue;
      }
      if (href.startsWith('mailto:')) { w.check(href.split('?')[0] === 'mailto:me@qtmbg.com', `a second address is on the page: ${href}`); continue; }
      const u = new URL(href, `${origin}/ecosystem.html`);
      const ours = u.origin === origin || /(^|\.)quantumbranding\.ai$/.test(u.hostname);
      if (!ours) continue;                              // press, social, the practice
      const path = /^\/blog\/?$/.test(u.pathname) ? '/blog/index.html' : u.pathname;   // the one Vercel route with no file of its name
      const res = await p.request.get(origin + path);
      w.check(res.ok(), `${href} answers ${res.status()}`);
    }
  });
}
