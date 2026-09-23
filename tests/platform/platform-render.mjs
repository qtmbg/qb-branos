#!/usr/bin/env node
// tests/platform/platform-render.mjs
// The Platform · standing harness. Recut Phase 4.
//
//   node tests/platform/platform-render.mjs
//
// Two failure modes are asserted, because the document is a paid object
// and both of them make it not worth paying for:
//
//   1. OVERFLOW · a page clips its A4 sheet. .page sets overflow:hidden,
//      so a clip is silent in the PDF and only visible on paper. This is
//      the check promoted out of a private client rendering reference.
//   2. UNDER-FILL · pages left mostly blank. The first build of this
//      renderer produced pages 45% full, which reads as a draft. Fill is
//      a quality property here, not a cosmetic one.
//
// Nothing is truncated before comparison and no findings list is capped.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPlatform } from '../../scripts/platform/build.mjs';

const FIXTURE = new URL('./fixtures/foundation.json', import.meta.url);
// Density is judged only on GENERATED content pages. The cover is a
// poster, the door is a closing page, and How to read this, Contents and
// Monday are fixed editorial spreads that are meant to breathe. Holding
// those to a fill target would push the harness to make them worse.
//
// The floor is 55 rather than something higher because the packer
// balances deliberately: content needing 1.2 pages becomes two pages at
// about 60% each, not one at 95% and one at 25%. Even pages are the
// better document, and the orphan check below is the one that actually
// catches ugliness.
const EXEMPT_FROM_FILL = new Set(['cover', 'The door', 'How to read this', 'Contents', 'Monday']);
const MEAN_FILL_FLOOR = 55;   // per cent, across generated content pages
const PAGE_FILL_FLOOR = 25;   // no single content page below this
const A4_MM = 297;

const failures = [];
const fail = m => failures.push(m);
const ok = m => console.log(`  ok · ${m}`);

const foundation = JSON.parse(readFileSync(FIXTURE, 'utf8'));

console.log('\n1 · the build is deterministic');
{
  const a = buildPlatform(foundation);
  const b = buildPlatform(foundation);
  // issued_at is pinned in the fixture, so two builds must be identical.
  if (a !== b) fail('two builds of the same foundation differ; the document is not reproducible');
  else ok(`identical across two builds · ${(a.match(/class="page/g) || []).length} pages`);
}

console.log('\n2 · the codex holds in the generated page text');
{
  const html = buildPlatform(foundation);
  const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  if (text.includes('—')) fail('the generated document contains an em dash in page text');
  else ok('no em dash in the generated page text');

  if (/!/.test(text)) fail('the generated document contains an exclamation point');
  else ok('no exclamation point');

  // CLAUDE.md check 4 · the name never takes a case transform.
  for (const bad of ['BRANDOS', 'brandos', 'Brandos', 'Brand OS', 'QB BrandOS']) {
    if (text.includes(bad)) fail(`the document renders the product name as "${bad}"`);
  }
  if (!text.includes('BrandOS')) fail('the document never names the product');
  else ok('the product name is correct and never recased');

  const BANNED = ['empower', 'unlock', 'supercharge', 'seamless', 'frictionless',
                  'world-class', 'best-in-class', 'cutting-edge', 'effortless'];
  const hits = BANNED.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(text));
  if (hits.length) fail(`banned words in the generated document: ${hits.join(', ')}`);
  else ok('no banned words');
}

console.log('\n3 · an incomplete foundation degrades instead of inventing');
{
  const partial = { ...foundation, artifacts: { soul_map_synthesizer: foundation.artifacts.soul_map_synthesizer } };
  const html = buildPlatform(partial);
  const pages = (html.match(/class="page/g) || []).length;
  if (pages < 4) fail(`a one-artifact foundation produced only ${pages} pages`);
  for (const absent of ['The palette', 'The voice', 'The open questions']) {
    if (html.includes(`<h2>${absent}</h2>`)) fail(`"${absent}" was rendered although its artifact was never delivered`);
  }
  ok(`a one-artifact foundation builds ${pages} honest pages and invents nothing`);

  const empty = buildPlatform({ qbp: {}, artifacts: {} });
  if (!empty.includes('Your Brand')) fail('an empty foundation lost the brand-name fallback');
  ok('an empty foundation still builds without throwing');
}

console.log('\n4 · every page fits A4, and none is left near-empty');
{
  const dir = mkdtempSync(path.join(tmpdir(), 'qb-platform-'));
  const file = path.join(dir, 'platform.html');
  writeFileSync(file, buildPlatform(foundation));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.emulateMedia({ media: 'print' });

  const report = await page.evaluate((A4) => {
    const sheet = A4 / 25.4 * 96;
    const toMm = px => px / (96 / 25.4);
    return [...document.querySelectorAll('.page')].map((el, i) => {
      const kids = [...el.children].filter(c => !c.classList.contains('rf'));
      const last = kids[kids.length - 1];
      const used = last ? last.getBoundingClientRect().bottom - el.getBoundingClientRect().top : 0;
      return {
        n: i + 1,
        label: el.querySelector('.rf span')?.textContent || 'cover',
        over: Math.round(Math.max(el.scrollHeight, el.getBoundingClientRect().height) - sheet),
        fill: Math.round(toMm(used) / A4 * 100),
      };
    });
  }, A4_MM);
  await browser.close();

  for (const r of report) {
    console.log(`     p${String(r.n).padStart(2)} ${String(r.label).padEnd(17)} ${String(r.fill).padStart(3)}%`);
  }

  const clipped = report.filter(r => r.over > 2);
  if (clipped.length) {
    for (const c of clipped) fail(`p${c.n} (${c.label}) clips the sheet by ${c.over}px`);
  } else ok(`${report.length} pages, none clipping A4`);

  const body = report.filter(r => !EXEMPT_FROM_FILL.has(r.label));
  const mean = Math.round(body.reduce((s, r) => s + r.fill, 0) / body.length);
  if (mean < MEAN_FILL_FLOOR) fail(`mean content fill is ${mean}%, below the ${MEAN_FILL_FLOOR}% floor · the document reads as a draft`);
  else ok(`mean content fill ${mean}% across ${body.length} generated pages`);

  const sparse = body.filter(r => r.fill < PAGE_FILL_FLOOR);
  if (sparse.length) {
    for (const sp of sparse) fail(`p${sp.n} (${sp.label}) is only ${sp.fill}% full · an orphaned page`);
  } else ok(`no content page below ${PAGE_FILL_FLOOR}%`);
}

console.log('');
if (failures.length) {
  console.error(`platform-render: FAILED · ${failures.length} problem${failures.length === 1 ? '' : 's'}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('platform-render: GREEN');
