// Shared by the i18n harnesses: a static server over the repo root and a
// Chromium handle. The repo convention is `playwright`; when it is not
// installed, QB_PLAYWRIGHT can point at a playwright-core entry file and
// the system Chrome is used.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = process.cwd();
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
  '.webp':'image/webp', '.ico':'image/x-icon', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.mp4':'video/mp4', '.woff2':'font/woff2' };

// Port 0 asks the OS for a free port, so several runs can share a machine.
export function serve(port = 0) {
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

export async function launch() {
  let pw;
  try { pw = await import('playwright'); }
  catch (e) {
    const alt = process.env.QB_PLAYWRIGHT;
    if (!alt) throw new Error('playwright is not installed. Install it, or set QB_PLAYWRIGHT to a playwright-core index.js.');
    pw = await import(pathToFileURL(alt).href);
  }
  const chromium = pw.chromium || pw.default.chromium;
  try { return await chromium.launch(); }
  catch (e) { return await chromium.launch({ channel: 'chrome' }); }
}

export function publicPages() {
  return [
    ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !/^(HEAD-SNIPPET|CHASSIS-MARKUP-SNIPPET)/.test(f)),
    ...fs.readdirSync(path.join(ROOT, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f),
  ].sort();
}
export const slugFor = file => file.replace(/\.+html$/, '').replace(/\//g, '-');
