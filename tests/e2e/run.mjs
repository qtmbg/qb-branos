/* BrandOS · end-to-end run
 *
 * Runs every walk in tests/e2e/walks in English and in French and reports
 * what broke. No real backend is touched: model, email, payment and storage
 * calls are answered by the walk.
 *
 * Usage: node tests/e2e/run.mjs                       every walk, both languages
 *        node tests/e2e/run.mjs signal-scan war-table  named walks
 *        node tests/e2e/run.mjs --lang fr signal-scan  one language
 *        node tests/e2e/run.mjs --shots <dir> ...      screenshot a failing step
 *        node tests/e2e/run.mjs --notes ...            also print console and dialog notes
 * Exit:  0 all walks pass · 1 any failure
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve, launch } from '../i18n/_browser.mjs';
import { runWalk } from './_walk.mjs';

const args = process.argv.slice(2);
const take = name => { const i = args.indexOf(name); return i > -1 ? args.splice(i, 2)[1] : null; };
const only = take('--lang');
const shotsDir = take('--shots');
const showNotes = args.includes('--notes');
const names = args.filter(a => !a.startsWith('--'));
const dir = path.join(process.cwd(), 'tests/e2e/walks');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()
  .filter(f => !names.length || names.includes(f.replace(/\.mjs$/, '')));
if (!files.length) { console.error('No walk matches. Walks live in tests/e2e/walks/<name>.mjs'); process.exit(1); }
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const server = await serve(0);
const port = server.address().port;
const browser = await launch();
let failed = 0, ran = 0;
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  for (const lang of only ? [only] : ['en', 'fr']) {
    ran++;
    const t0 = Date.now();
    const { failures, notes } = await runWalk(mod, lang, { browser, port, shotsDir });
    const label = `${f.replace(/\.mjs$/, '')} [${lang}] · ${mod.title || mod.page}`;
    if (failures.length) {
      failed++;
      console.log(`FAIL  ${label}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      for (const x of failures) console.log(`        ${x}`);
    } else console.log(`pass  ${label}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (showNotes) for (const n of notes) console.log(`        note · ${n}`);
  }
}
await browser.close();
server.close();
console.log(failed ? `\nend-to-end FAILED · ${failed} of ${ran} run(s)` : `\nend-to-end passed · ${ran} run(s), ${files.length} walk(s) × ${only ? 1 : 2} language(s)`);
process.exit(failed ? 1 : 0);
