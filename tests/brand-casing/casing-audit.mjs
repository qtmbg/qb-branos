/* BrandOS — product-name casing audit
 *
 * The product name carries meaning in its internal capital, so it never takes
 * a case transform. This renders every page and reads the text the browser
 * actually paints, which is what text-transform changes. Reading the markup
 * would miss the defect entirely: the HTML says "BrandOS" while the screen
 * says "BRANDOS".
 *
 * Fails when rendered text contains "BRANDOS" or "brandos" in any element.
 *
 * Usage: node tests/brand-casing/casing-audit.mjs
 *        node tests/brand-casing/casing-audit.mjs --base https://quantumbranding.ai
 * Exit:  0 clean · 1 violations found
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const WIDTHS = [390, 1280];
const argBase = process.argv.indexOf('--base');
const REMOTE = argBase > -1 ? process.argv[argBase + 1] : null;

// The name recased in any direction. Word-boundary guarded so "qb-brandos"
// inside a class or a URL cannot trip it; this reads text nodes only anyway.
const BAD = /\bBRANDOS\b|\bbrandos\b/;

const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.mjs':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon',
  '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.mp4':'video/mp4', '.woff2':'font/woff2' };

function serve(port) {
  const s = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    let f = path.join(ROOT, u);
    if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(port, () => r(s)));
}

const pages = [
  ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !/^(HEAD-SNIPPET|CHASSIS-MARKUP-SNIPPET)/.test(f)),
  ...fs.readdirSync(path.join(ROOT, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f),
];

const server = REMOTE ? null : await serve(4533);
const base = REMOTE || 'http://localhost:4533';
const browser = await chromium.launch();
const violations = [];

for (const page of pages) {
  for (const width of WIDTHS) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    await p.goto(`${base}/${page}`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(400);
    // innerText reflects the rendered result of text-transform; textContent does not.
    const hits = await p.evaluate(() => {
      const bad = /\bBRANDOS\b|\bbrandos\b/;
      const out = [];
      // innerText on script/style returns source code, not painted text.
      const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg', 'SVG']);
      for (const el of document.querySelectorAll('body *')) {
        if (el.children.length) continue;
        if (SKIP.has(el.tagName)) continue;
        const painted = el.innerText;
        if (painted && bad.test(painted)) {
          out.push({
            text: painted.trim().slice(0, 70),
            transform: getComputedStyle(el).textTransform,
            where: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
          });
        }
      }
      return out;
    });
    for (const h of hits) violations.push({ page, width, ...h });
    await p.close();
  }
}

await browser.close();
if (server) server.close();

const checked = pages.length * WIDTHS.length;
if (violations.length) {
  console.error(`casing-audit: FAIL · ${violations.length} violation(s) across ${checked} renders\n`);
  for (const v of violations) {
    console.error(`  ${v.page} @${v.width}px`);
    console.error(`    painted:   "${v.text}"`);
    console.error(`    element:   ${v.where}`);
    console.error(`    transform: ${v.transform}`);
  }
  console.error('\nFix: isolate the name in <span class="brandos-name">BrandOS</span>.');
  process.exit(1);
}
console.log(`casing-audit: PASS · ${checked} renders (${pages.length} pages x ${WIDTHS.join('/')}px), 0 violations`);
