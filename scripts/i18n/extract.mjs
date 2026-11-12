// Lists strings in a page's SOURCE that have no dictionary entry yet.
//
//   node scripts/i18n/extract.mjs sensescape.html
//   node scripts/i18n/extract.mjs --lang en mri.html js/mri-app.js
//   node scripts/i18n/extract.mjs --dict archive js/qb-archive.js
//
// The render audit (tests/i18n/i18n-audit.mjs --collect) sees what a page
// paints on load. This reads what it could paint later: string literals in
// scripts, JSX text, and static markup. It over-reports on purpose. A
// translator reads the list and decides what a visitor can see. Anything
// already covered by the dictionaries (exact, scoped or pattern) is left out.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i > -1 ? args.splice(i, 2)[1] : null; };
const LANG = opt('--lang') || 'fr';
const DICT = opt('--dict');
const files = args;
if (!files.length) { console.error('usage: extract.mjs [--lang fr] [--dict slug] <file...>'); process.exit(2); }

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const exact = new Set(), patterns = [];
function loadDict(slug) {
  const f = path.join('js/i18n', LANG, slug + '.js');
  if (!fs.existsSync(f)) return;
  const sandbox = { QBI18N: {
    add(_l, o) { for (const k of Object.keys(o)) {
      const key = norm(k.split(' @@ ')[0]);
      if (/\{\d+\}/.test(key)) patterns.push(new RegExp('^' + key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d+\}/g, '(.+?)') + '$'));
      else exact.add(key);
    } },
    include(_l, s) { loadDict(s); }, css() {},
  } };
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
}
const slugFor = file => file.replace(/\.+html$/, '').replace(/\//g, '-');
loadDict('common'); loadDict('shared');
if (DICT) loadDict(DICT);
for (const f of files) if (f.endsWith('.html')) loadDict(slugFor(f));

const covered = s => { const n = norm(s); return exact.has(n) || patterns.some(r => r.test(n)); };
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&rarr;/g, '→').replace(/&larr;/g, '←')
  .replace(/&middot;/g, '·').replace(/&copy;/g, '©').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/&hellip;/g, '…').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
  .replace(/&times;/g, '×').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

// Looks like something a person reads, not an identifier, selector or path.
function prose(s) {
  const n = norm(s);
  if (n.length < 2 || !/[A-Za-zÀ-ɏ]{2,}/.test(n)) return false;
  if (/^(https?:|\/|\.\/|#|\.[a-z]|data:|mailto:)/i.test(n)) return false;
  if (/^[a-z0-9_.:\/-]+$/.test(n)) return false;                 // slug, key, class, path
  if (/^[A-Z0-9_]+$/.test(n) && n.length > 4 && n.includes('_')) return false; // CONSTANT_NAME
  if (/[{};]\s*$/.test(n) || /^\s*[.#@]?[\w-]+\s*\{/.test(n)) return false;   // css or code
  if (/^(application|text|image)\/[\w.+-]+$/.test(n)) return false;
  if (/^[\w-]+(\s[\w-]+)*$/.test(n) && n === n.toLowerCase() && !n.includes(' ')) return false;
  return true;
}

const out = [];
const seen = new Set();
function push(file, line, kind, text) {
  const n = norm(text);
  if (!prose(n) || covered(n)) return;
  const id = n;
  if (seen.has(id)) return;
  seen.add(id);
  out.push({ file, line, kind, text: n });
}
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

function scanScript(file, src, offsetLine, babel) {
  // String literals. Template literals report ${...} as {0}, {1}, ... so the
  // entry can be written as a pattern.
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(src))) {
    let raw = m[1] ?? m[2] ?? m[3];
    let kind = 'string';
    if (m[3] != null) {
      let i = 0;
      raw = raw.replace(/\$\{[^}]*\}/g, () => `{${i++}}`);
      kind = i ? 'template' : 'string';
    }
    raw = raw.replace(/\\n/g, ' ').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    // A literal that holds markup: report its text runs, as the DOM will have them.
    if (/<[a-z][^>]*>/i.test(raw)) {
      for (const run of raw.split(/<[^>]+>/)) push(file, offsetLine + lineOf(src, m.index) - 1, 'markup-in-' + kind, decode(run));
    } else push(file, offsetLine + lineOf(src, m.index) - 1, kind, decode(raw));
  }
  if (babel) {
    const jsx = />([^<>{}`;=]*[A-Za-zÀ-ɏ]{2,}[^<>{}`;=]*)</g;
    while ((m = jsx.exec(src))) push(file, offsetLine + lineOf(src, m.index) - 1, 'jsx-text', decode(m[1]));
  }
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!file.endsWith('.html')) { scanScript(file, src, 1, false); continue; }
  // Scripts.
  const sre = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = sre.exec(src))) {
    if (/\bsrc=/.test(m[1]) || /application\/ld\+json/.test(m[1])) continue;
    scanScript(file, m[2], lineOf(src, m.index), /text\/babel/.test(m[1]));
  }
  // Static markup: text runs and the attributes the runtime translates.
  const markup = src.replace(/<script\b[\s\S]*?<\/script>/gi, m0 => m0.replace(/[^\n]/g, ' '))
                    .replace(/<style\b[\s\S]*?<\/style>/gi, m0 => m0.replace(/[^\n]/g, ' '))
                    .replace(/<!--[\s\S]*?-->/g, m0 => m0.replace(/[^\n]/g, ' '));
  const tre = />([^<]+)</g;
  while ((m = tre.exec(markup))) push(file, lineOf(markup, m.index), 'text', decode(m[1]));
  const are = /\b(placeholder|title|aria-label|alt|data-label|data-tooltip|data-tip)="([^"]*)"/g;
  while ((m = are.exec(markup))) push(file, lineOf(markup, m.index), m[1], decode(m[2]));
  const mre = /<meta\s+(?:name|property)="(description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)"\s+content="([^"]*)"/g;
  while ((m = mre.exec(markup))) push(file, lineOf(markup, m.index), 'meta', decode(m[2]));
}

for (const c of out) console.log(`${c.file}:${c.line}\t${c.kind}\t${JSON.stringify(c.text)}`);
console.error(`${out.length} uncovered candidate(s) in ${files.length} file(s)`);
