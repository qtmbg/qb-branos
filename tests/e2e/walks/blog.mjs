// Blog: the index lists four posts, each card opens its post, each post
// leads back to the index, and no post still teaches the retired six phases.
//
// In production /blog is a Vercel route onto blog/index.html. The test
// server has no such route, so the walk answers /blog the same way.
export const page = 'blog/index.html';
export const title = 'index to each post and back, titles agree, four movements';

const POSTS = [
  { href: '/blog/what-is-the-collapse',         title: 'What is The Collapse?',               cta: '/signal-scan.html' },
  { href: '/blog/five-minute-brand-diagnostic', title: 'The five-minute brand diagnostic',    cta: '/signal-scan.html' },
  { href: '/blog/the-four-doors',               title: 'The four doors into a brand system',  cta: '/signal-scan.html' },
  // The address keeps its first name so no link breaks. The article is the four movements.
  { href: '/blog/six-phases-idea-to-orbit',     title: 'Four movements from idea to orbit',   cta: '/ecosystem.html#what' },
];
const HOLD = 'The loop closes. The Performance Dashboard reads what the market observed. The Quarterly Brand Review forces the honest retrospective. And the Predictive Panel simulates buyer response to the next move before money leaves the account. Hold is not open yet. The first three movements are.';
const RETIRED = /six[- ]phases?|phase 0\d|twenty agents|vingt agents|content creation|création de contenu|white-label output|sortie en marque blanche/i;

export async function walk(w) {
  const p = w.page;
  // A target that is not there fails in seconds, never by waiting out a default.
  const T = 4000;
  p.setDefaultTimeout(T);
  p.setDefaultNavigationTimeout(8000);
  const see = (text, opts = {}) => w.see(text, { timeout: T, ...opts });
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const said = async english => flat(await w.say(english));
  // A headline is split by an <em> and ends with a period the card title does not carry.
  const bare = s => flat(s).replace(/\.$/, '').replace(/\s+/g, '');
  let origin = '';
  const ready = () => p.waitForFunction(() => !!window.QBI18N && document.readyState !== 'loading', null, { timeout: T });
  const untranslated = async () => (w.lang === 'fr' ? p.evaluate(() => window.QBI18N.misses().map(m => m.text)) : []);

  await w.mock(/\/blog\/?(\?.*)?$/, async route => {
    const res = await p.request.get(`${origin}/blog/index.html`);
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: await res.text() });
  });

  await w.step('the index', async () => {
    await w.open();
    origin = new URL(p.url()).origin;
    await see('Read before');
    await see('you build.');
    const cards = await p.evaluate(() => [...document.querySelectorAll('.post-card')].map(a => ({
      href: a.getAttribute('href'), title: a.querySelector('h2').textContent.replace(/\s+/g, ' ').trim() })));
    w.check(cards.length === POSTS.length, `the index lists ${cards.length} posts`);
    for (let i = 0; i < POSTS.length; i++) {
      w.check((cards[i] || {}).href === POSTS[i].href, `card ${i + 1} leads to ${(cards[i] || {}).href}`);
      w.check((cards[i] || {}).title === await said(POSTS[i].title), `card ${i + 1} is titled ${JSON.stringify((cards[i] || {}).title)}`);
    }
    w.check(!RETIRED.test(flat(await p.locator('main').innerText())), 'the index still uses the retired vocabulary');
    const meta = await p.evaluate(() => document.querySelector('meta[name="description"]').getAttribute('content'));
    w.check(!RETIRED.test(meta), `the index description still says: ${meta}`);
  });

  for (const post of POSTS) {
    await w.step(`open ${post.href} and come back`, async () => {
      const card = p.locator(`.post-card[href="${post.href}"]`);
      const cardTitle = flat(await card.locator('h2').textContent());
      await Promise.all([p.waitForURL(u => u.pathname === post.href), card.click()]);
      await ready();
      await p.waitForTimeout(500);
      w.check(await p.evaluate(() => document.documentElement.lang) === w.lang, `${post.href} opened in another language`);
      const h1 = await p.locator('h1.doc-h1').textContent();
      w.check(bare(h1) === bare(cardTitle), `the post is headed ${JSON.stringify(flat(h1))}, its card says ${JSON.stringify(cardTitle)}`);
      const head = await p.evaluate(() => {
        let ld = {};
        for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { const j = JSON.parse(s.textContent); if (j['@type'] === 'Article') ld = j; } catch (e) {} }
        return { title: document.title, ld, canonical: document.querySelector('link[rel="canonical"]').getAttribute('data-src') || document.querySelector('link[rel="canonical"]').getAttribute('href') };
      });
      w.check(flat(head.title) === await said(`${post.title} · BrandOS`), `the tab title is ${JSON.stringify(head.title)}`);
      w.check(head.ld.headline === post.title, `the structured data headline is ${JSON.stringify(head.ld.headline)}`);
      w.check(head.canonical === `https://quantumbranding.ai${post.href}`, `the canonical address is ${head.canonical}`);
      const body = flat(await p.locator('article').innerText());
      w.check(!RETIRED.test(body), `${post.href} still uses the retired vocabulary`);
      w.check(!RETIRED.test(head.ld.description || ''), `${post.href} structured data still says: ${head.ld.description}`);
      w.check(body.length > 1200, `${post.href} is nearly empty (${body.length} characters)`);
      const missed = await untranslated();
      w.check(missed.length === 0, `untranslated on ${post.href}: ${JSON.stringify(missed)}`);
      const cta = await p.locator('.cta-block a').getAttribute('href');
      w.check(cta === post.cta, `the closing button leads to ${cta}`);
      w.check((await p.request.get(origin + cta.split('#')[0])).ok(), `the closing button leads to ${cta}, which does not resolve`);
      await Promise.all([p.waitForURL(u => /^\/blog\/?$/.test(u.pathname)), p.locator('.doc-eyebrow a').click()]);
      await ready();
      await see('Read before');
    });
  }

  await w.step('the four movements post says Hold is not open', async () => {
    await p.goto(`${origin}/blog/six-phases-idea-to-orbit?lang=${w.lang}`, { waitUntil: 'domcontentloaded' });
    await ready();
    await p.waitForTimeout(500);
    for (const m of ['Observe', 'Collapse', 'Build', 'Hold']) await see(m, { within: 'article' });
    const body = flat(await p.locator('article').innerText());
    w.check(body.includes(await said(HOLD)), 'the post does not say Hold is not open yet');
    await p.goto(`${origin}/blog/index.html?lang=${w.lang}`, { waitUntil: 'domcontentloaded' });
    await ready();
    await p.waitForTimeout(500);
    await see('Read before');
  });
}
