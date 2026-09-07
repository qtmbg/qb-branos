/* Minimal static server that replays the vercel.json route table so the
 * auth-flow test drives the same URLs production serves. Not a Vercel
 * emulator: it handles the `routes` array's src/dest/status entries and
 * the filesystem handle, which is all the sign-in flow touches.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveFile(res, rel) {
  const abs = path.join(ROOT, decodeURIComponent(rel));
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));
  return true;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;
  let search = url.search;

  for (const route of config.routes) {
    if (route.handle === 'filesystem') {
      if (serveFile(res, pathname)) return;
      continue;
    }
    if (!route.src) continue;
    // Host-conditional routes are apex-only in this harness.
    if (route.has) continue;
    const re = new RegExp('^' + route.src + '$');
    const m = pathname.match(re);
    if (!m) continue;

    if (route.status && route.headers && route.headers.Location) {
      res.writeHead(route.status, { Location: route.headers.Location });
      res.end();
      return;
    }
    if (route.status && !route.dest) { res.writeHead(route.status); res.end(); return; }
    if (route.dest) {
      let dest = route.dest.replace(/\$(\d+)/g, (_, i) => m[Number(i)] || '');
      if (dest.startsWith('/api/')) {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'api not served by the test harness' }));
        return;
      }
      const q = dest.indexOf('?');
      const destPath = q === -1 ? dest : dest.slice(0, q);
      if (serveFile(res, destPath)) return;
      if (route.status) { res.writeHead(route.status); res.end(); return; }
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

const port = Number(process.env.PORT || 4321);
server.listen(port, () => console.log('harness listening on http://127.0.0.1:' + port));
