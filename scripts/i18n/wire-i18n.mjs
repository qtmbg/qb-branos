// Wires the language runtime into every public page. Idempotent.
//
//   node scripts/i18n/wire-i18n.mjs          write
//   node scripts/i18n/wire-i18n.mjs --check  exit 1 when a page is unwired
//
// The tag goes right after <meta charset> so it runs before anything paints.
// data-page names the dictionary file, so a rewrite (/scan, /panel) still
// loads the right one.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');

export function publicPages(root = ROOT) {
  return [
    ...fs.readdirSync(root).filter(f => f.endsWith('.html') && !/^(HEAD-SNIPPET|CHASSIS-MARKUP-SNIPPET)/.test(f)),
    ...fs.readdirSync(path.join(root, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f),
  ].sort();
}
export function slugFor(file) {
  return file.replace(/\.+html$/, '').replace(/\//g, '-');
}

const missing = [];
let wrote = 0;
for (const file of publicPages()) {
  const full = path.join(ROOT, file);
  const html = fs.readFileSync(full, 'utf8');
  const tag = `<script src="/js/qb-i18n.js" data-page="${slugFor(file)}"></script>`;
  if (html.includes(tag)) continue;
  if (CHECK) { missing.push(file); continue; }
  const stale = /<script src="\/js\/qb-i18n\.js"[^>]*><\/script>\n?/;
  let next = html.replace(stale, '');
  const m = /<meta charset=[^>]*>/i.exec(next);
  if (!m) { missing.push(file + ' (no <meta charset>)'); continue; }
  const at = m.index + m[0].length;
  next = next.slice(0, at) + '\n' + tag + next.slice(at);
  fs.writeFileSync(full, next);
  wrote++;
}
if (missing.length) { console.error('Unwired pages:\n  ' + missing.join('\n  ')); process.exit(1); }
console.log(CHECK ? 'All pages wired.' : `Wired ${wrote} page(s).`);
