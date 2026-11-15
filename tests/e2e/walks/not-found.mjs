// The page shown for an address that does not exist: it says so, and
// every way out leads to a real page.
export const page = '404.html';
export const title = 'says what happened, every way out leads somewhere';
export const timeout = 60;

import fs from 'node:fs';

// The walk runs on a plain file server. Production answers some short
// addresses through vercel.json (/os redirects to /foundation, /scan is
// served by signal-scan.html). A link is followed the way production
// would follow it.
const ROUTES = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).routes || [];
function resolve(path, hops = 0) {
  if (hops > 4) return path;
  const clean = path.split('?')[0].split('#')[0];
  for (const r of ROUTES) {
    if (r.has || !r.src) continue;
    let re;
    try { re = new RegExp('^' + r.src + '$'); } catch (e) { continue; }
    if (!re.test(clean)) continue;
    if (r.status === 301 && r.headers && r.headers.Location) return resolve(r.headers.Location, hops + 1);
    if (r.dest && r.status !== 404 && r.status !== 410) return r.dest;
    break;
  }
  return clean;
}

export async function walk(w) {
  const p = w.page;
  await w.step('the page says what happened', async () => {
    await w.open();
    await w.see('That page is');
    await w.see('not here');
    const t = await p.evaluate(() => document.body.innerText);
    w.check(/BrandOS/.test(t) && !/BRANDOS|Brand OS/.test(t), 'the product name is recased');
    w.check(!/Phase 0\d/i.test(t), 'the page names a phase');
  });

  await w.step('every way out leads to a page that exists', async () => {
    const origin = new URL(p.url()).origin;
    const hrefs = await p.evaluate(() => [...document.querySelectorAll('main a[href]')].map(a => a.getAttribute('href')));
    w.check(hrefs.length >= 2, `the page offers ${hrefs.length} way(s) out`);
    for (const href of hrefs) {
      if (/^(mailto:|https?:\/\/(?!quantumbranding\.ai|app\.quantumbranding\.ai))/.test(href)) continue;
      // Links to the live site are followed on this server, by their path.
      const asked = href.replace(/^https?:\/\/(app\.)?quantumbranding\.ai/, '') || '/';
      const path = resolve(asked.startsWith('/') ? asked : '/' + asked);
      const res = await p.request.get(origin + path).catch(() => null);
      w.check(!!res && res.status() === 200, `${href} answers ${res ? res.status() : 'nothing'}`);
    }
  });
}
