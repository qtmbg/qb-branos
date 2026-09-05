import { chromium } from 'playwright';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const name = process.argv[2] || 'plateforme-de-marque';
const src = 'file://' + path.join(dir, name + '.html');
const out = path.join(dir, name + '.pdf');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await page.goto(src, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

await page.emulateMedia({ media: 'print' });
const report = await page.evaluate(() => {
  const mm = 296 / 25.4 * 96;
  return [...document.querySelectorAll('.page')].map((el, i) => ({
    n: i + 1,
    label: el.querySelector('.rf span')?.textContent || el.className,
    over: Math.round(Math.max(el.scrollHeight, el.getBoundingClientRect().height) - mm),
    h: Math.round(el.scrollHeight),
  }));
});
const bad = report.filter(r => r.over > 2);
console.log(`pages: ${report.length}`);
if (bad.length) { console.log('OVERFLOW:'); bad.forEach(b => console.log(`  p${b.n} (${b.label}) +${b.over}px  h=${b.h}`)); }
else console.log('no overflow');

await page.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log('pdf →', out);
