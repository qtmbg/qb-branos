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
const collected = {};
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

async function visit(file, lang, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-US' });
  await ctx.addInitScript(() => { window.__QB_I18N_AUDIT = true; });
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
      bodyBg: bg, htmlBg, usesTokens,
    };
  });
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${slugFor(file)}.${lang}.${width}.png`), fullPage: false });
  await ctx.close();
  return { ...state, dictRequests };
}

const dark = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? (+m[1] + +m[2] + +m[3]) / 3 < 90 : false; };

for (const file of pages) {
  for (const width of WIDTHS) {
    // The language that is NOT the page's own is the one under test for
    // coverage. Most pages are written in English; mri.html is in French.
    const fr = await visit(file, 'fr', width);
    const en = COLLECT ? null : await visit(file, 'en', width);
    const add = (lang, what, detail) => findings.push({ page: file, width, lang, what, detail });
    if (!fr.runtime) { add('fr', 'runtime missing', 'js/qb-i18n.js did not load'); continue; }
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
    if (!fr.switches) add('fr', 'switch missing', 'no .qb-lang in the page');
    if (!en.switches) add('en', 'switch missing', 'no .qb-lang in the page');
    if (fr.usesTokens && !dark(fr.bodyBg) && !dark(fr.htmlBg)) add('fr', 'colours not reversed', `body ${fr.bodyBg} · html ${fr.htmlBg}`);
    if (native.dictRequests.length) add(native === en ? 'en' : 'fr', 'native page loaded a dictionary', native.dictRequests.join(' '));
    if (en.fixes) add('en', 'colour patched in English', `${en.fixes} element(s) carry data-qb-fix`);
    if (en.usesTokens && dark(en.bodyBg)) add('en', 'English page is dark', `body ${en.bodyBg}`);
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

if (!findings.length) { console.log(`i18n audit clean · ${pages.length} page(s) × ${WIDTHS.length} widths × 2 languages`); process.exit(0); }
const byPage = new Map();
for (const f of findings) { if (!byPage.has(f.page)) byPage.set(f.page, []); byPage.get(f.page).push(f); }
for (const [page, list] of byPage) {
  console.log(`\n${page} · ${list.length} finding(s)`);
  for (const f of list) console.log(`  [${f.lang} ${f.width}] ${f.what}: ${f.detail}`);
}
console.log(`\ni18n audit FAILED · ${findings.length} finding(s) on ${byPage.size} page(s)`);
process.exit(1);
