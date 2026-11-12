/* BrandOS · language audit
 *
 * Renders every public page in both languages and reads what the browser
 * paints. A page fails when:
 *
 *   French  · any painted text or translated attribute has no dictionary
 *             entry (it would show in English)
 *           · <html lang> is not "fr", or the page background did not
 *             reverse to ink (token pages only)
 *           · the EN / FR switch is missing
 *   Both    · the name BrandOS is painted in any other casing
 *           · the page redirected somewhere other than /login
 *
 * Pages that need a signed-in session redirect to /login and are listed as
 * not audited. The list is printed every run so the gap stays visible.
 *   English · anything changed: a dictionary was requested, a colour was
 *             patched, <html lang> moved, or the switch is missing
 *
 * Text is compared whole. Nothing is sliced before a test and no findings
 * list is capped.
 *
 * Usage: node tests/i18n/i18n-audit.mjs                 all pages
 *        node tests/i18n/i18n-audit.mjs index.html ...   named pages
 *        node tests/i18n/i18n-audit.mjs --collect index.html
 *              print the missing strings as JSON, for a translator
 *        node tests/i18n/i18n-audit.mjs --shots <dir> index.html
 *              also save a screenshot per page, language and width
 * Exit:  0 clean · 1 findings
 */
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, publicPages, slugFor } from './_browser.mjs';

const args = process.argv.slice(2);
const COLLECT = args.includes('--collect');
const shotAt = args.indexOf('--shots');
const SHOTS = shotAt > -1 ? args[shotAt + 1] : null;
const named = args.filter((a, i) => !a.startsWith('--') && !(shotAt > -1 && i === shotAt + 1));
const pages = named.length ? named : publicPages();
const WIDTHS = COLLECT ? [1280] : [390, 1280];
const server = await serve(0);
const PORT = server.address().port;
const browser = await launch();
const findings = [];
const needSession = [];
const collected = {};
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

async function visit(file, lang, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-US' });
  await ctx.addInitScript(() => {
    window.__QB_I18N_AUDIT = true;
    // Paid tools redirect an anonymous browser to /login, and the audit
    // would then read the login page under the tool's name. A local tier
    // lets each tool render its own first screen. This is the client gate
    // only; the server gate is not involved in a static render.
    try { localStorage.setItem('qb_user_tier', 'agency'); localStorage.setItem('qb_sub_status', 'active'); } catch (e) {}
  });
  const p = await ctx.newPage();
  const dictRequests = [];
  p.on('request', r => { if (/\/js\/i18n\//.test(r.url())) dictRequests.push(r.url()); });
  await p.goto(`http://localhost:${PORT}/${file}?lang=${lang}`, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(500);
  // Scroll the whole page so reveal-on-scroll content renders.
  await p.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(300);
  const landed = new URL(p.url()).pathname;
  const state = await p.evaluate(() => {
    const q = window.QBI18N;
    const bg = getComputedStyle(document.body).backgroundColor;
    const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    const usesTokens = getComputedStyle(document.documentElement).getPropertyValue('--cream').trim() !== '';
    return {
      runtime: !!q,
      source: q && q.source,
      htmlLang: document.documentElement.getAttribute('lang'),
      misses: q ? q.misses() : [],
      switches: document.querySelectorAll('.qb-lang').length,
      fixes: document.querySelectorAll('[data-qb-fix]').length,
      // The product name never takes a case transform, in either language.
      // innerText is what the browser paints, after text-transform.
      recased: [...document.querySelectorAll('body *')]
        .filter(el => !el.children.length && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName))
        .map(el => (el.innerText || '').trim().replace(/\s+/g, ' '))
        .filter(txt => /\bBRANDOS\b|\bbrandos\b/.test(txt)),
      bodyBg: bg, htmlBg, usesTokens,
    };
  });
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${slugFor(file)}.${lang}.${width}.png`), fullPage: false });
  await ctx.close();
  return { ...state, dictRequests, landed };
}

// A transparent ground is not a dark one: rgba(0, 0, 0, 0) is no colour at all.
const dark = c => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || '');
  if (!m || (m[4] !== undefined && +m[4] === 0)) return false;
  return (+m[1] + +m[2] + +m[3]) / 3 < 90;
};

for (const file of pages) {
  for (const width of WIDTHS) {
    // The language that is NOT the page's own is the one under test for
    // coverage. Most pages are written in English; mri.html is in French.
    const fr = await visit(file, 'fr', width);
    const en = COLLECT ? null : await visit(file, 'en', width);
    const add = (lang, what, detail) => findings.push({ page: file, width, lang, what, detail });
    if (!fr.runtime) { add('fr', 'runtime missing', 'js/qb-i18n.js did not load'); continue; }
    // A page that sent the browser somewhere else was not audited at all.
    const want = '/' + file.replace(/\.html$/, '');
    const same = l => l === '/' + file || l === want || (file === 'index.html' && l === '/');
    if (!same(fr.landed)) {
      // Account pages need a real session and send everyone else to /login.
      // That is their job, so it is reported as a gap in coverage, loudly,
      // and not as a defect of the page. Any other redirect is a finding.
      if (fr.landed === '/login') { needSession.push(file); continue; }
      add('fr', 'redirected', `asked for /${file}, landed on ${fr.landed}; this page was not audited`);
      continue;
    }
    const target = fr.source === 'fr' ? en : fr;      // the translated rendering
    const native = fr.source === 'fr' ? fr : en;      // the as-written rendering
    const tLang = fr.source === 'fr' ? 'en' : 'fr';
    if (COLLECT) {
      const set = collected[file] || (collected[file] = new Map());
      for (const m of fr.misses) set.set(m.text, m.at);
      continue;
    }
    for (const m of target.misses) add(tLang, 'untranslated', `${JSON.stringify(m.text)}  at  ${m.at}`);
    if (fr.htmlLang !== 'fr') add('fr', 'html lang', `expected "fr", got ${JSON.stringify(fr.htmlLang)}`);
    if (en.htmlLang !== 'en') add('en', 'html lang', `expected "en", got ${JSON.stringify(en.htmlLang)}`);
    for (const txt of fr.recased) add('fr', 'BrandOS recased', JSON.stringify(txt));
    for (const txt of en.recased) add('en', 'BrandOS recased', JSON.stringify(txt));
    if (!fr.switches) add('fr', 'switch missing', 'no .qb-lang in the page');
    if (!en.switches) add('en', 'switch missing', 'no .qb-lang in the page');
    // Reversal is judged against the English rendering of the same page.
    // A page whose English ground is already dark (the PDF viewers) keeps it.
    const enLight = !dark(en.bodyBg) && !dark(en.htmlBg);
    if (fr.usesTokens && enLight && !dark(fr.bodyBg) && !dark(fr.htmlBg)) add('fr', 'colours not reversed', `body ${fr.bodyBg} · html ${fr.htmlBg}`);
    if (native.dictRequests.length) add(native === en ? 'en' : 'fr', 'native page loaded a dictionary', native.dictRequests.join(' '));
    if (en.fixes) add('en', 'colour patched in English', `${en.fixes} element(s) carry data-qb-fix`);
  }
}

await browser.close();
server.close();

if (COLLECT) {
  const out = {};
  for (const [file, set] of Object.entries(collected)) out[file] = [...set].map(([text, at]) => ({ text, at }));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const gap = [...new Set(needSession)];
if (gap.length) {
  console.log(`Not audited, these need a signed-in session (${gap.length}): ${gap.join(', ')}`);
  console.log('Their strings live in js/i18n/fr/shared.js and were checked in a signed-in walk when written.\n');
}
if (!findings.length) {
  console.log(`i18n audit clean · ${pages.length - gap.length} of ${pages.length} page(s) rendered × ${WIDTHS.length} widths × 2 languages`);
  process.exit(0);
}
const byPage = new Map();
for (const f of findings) { if (!byPage.has(f.page)) byPage.set(f.page, []); byPage.get(f.page).push(f); }
for (const [page, list] of byPage) {
  console.log(`\n${page} · ${list.length} finding(s)`);
  for (const f of list) console.log(`  [${f.lang} ${f.width}] ${f.what}: ${f.detail}`);
}
console.log(`\ni18n audit FAILED · ${findings.length} finding(s) on ${byPage.size} page(s)`);
process.exit(1);
