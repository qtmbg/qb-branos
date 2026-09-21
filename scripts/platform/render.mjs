#!/usr/bin/env node
// scripts/platform/render.mjs
// The Platform · renderer and layout guard. Recut Phase 4.
//
//   node scripts/platform/render.mjs <platform.html> [out.pdf]
//
// Derived from docs/clients/rapp-esen/render.mjs, which already did the
// one thing that matters: it reports every .page that would clip its A4
// sheet BEFORE writing the PDF. That report is the reason the client
// document has no cut lines, and it is promoted here from a script
// someone remembers to run into a check the build depends on.
//
// Exit 1 when any page overflows, naming each offender. A silent clip is
// the failure mode this exists to prevent, so nothing is capped and no
// list is truncated.

import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/platform/render.mjs <platform.html> [out.pdf]'); process.exit(2); }
const abs = path.resolve(src);
const out = process.argv[3] || abs.replace(/\.html$/, '.pdf');
const writePdf = process.env.PLATFORM_NO_PDF !== '1';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await page.goto(pathToFileURL(abs).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(700);
await page.emulateMedia({ media: 'print' });

const report = await page.evaluate(() => {
  // 297mm expressed in CSS px at 96dpi. The 1mm of slack absorbs
  // sub-pixel rounding in the layout engine; anything beyond that is a
  // real clip, because .page sets overflow:hidden.
  const sheet = 297 / 25.4 * 96;
  return [...document.querySelectorAll('.page')].map((el, i) => ({
    n: i + 1,
    label: el.querySelector('.rf span')?.textContent
        || el.querySelector('h1')?.textContent?.trim().slice(0, 40)
        || el.className,
    over: Math.round(Math.max(el.scrollHeight, el.getBoundingClientRect().height) - sheet),
    h: Math.round(el.scrollHeight),
  }));
});

console.log(`pages: ${report.length}`);
const bad = report.filter(r => r.over > 2);
if (bad.length) {
  console.log('OVERFLOW:');
  for (const b of bad) console.log(`  p${b.n} (${b.label}) +${b.over}px  h=${b.h}`);
} else {
  console.log('no overflow');
}

if (writePdf) {
  await page.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  console.log('pdf →', out);
}
await browser.close();

if (bad.length) {
  console.error(`render: FAILED · ${bad.length} page${bad.length === 1 ? '' : 's'} clip the sheet`);
  process.exit(1);
}
console.log('render: GREEN · every page fits A4');
