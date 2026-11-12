// Keeps scripts/public-files.json in step with the language files.
// The deployment ships only what that manifest lists, so a dictionary
// that is not listed is a page that stays in English in production.
//
//   node scripts/i18n/sync-manifest.mjs          add what is missing, drop what is gone
//   node scripts/i18n/sync-manifest.mjs --check  exit 1 when the manifest is out of step
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');
const manifestPath = path.join(ROOT, 'scripts/public-files.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const wanted = ['js/qb-i18n.js'];
const dir = path.join(ROOT, 'js/i18n');
for (const lang of fs.readdirSync(dir).sort()) {
  const sub = path.join(dir, lang);
  if (!fs.statSync(sub).isDirectory()) continue;
  for (const f of fs.readdirSync(sub).sort()) if (f.endsWith('.js')) wanted.push(`js/i18n/${lang}/${f}`);
}
const isLang = f => f === 'js/qb-i18n.js' || f.startsWith('js/i18n/');
const have = manifest.filter(isLang);
const missing = wanted.filter(f => !have.includes(f));
const stale = have.filter(f => !wanted.includes(f));

if (CHECK) {
  if (missing.length || stale.length) {
    if (missing.length) console.error('Not in the manifest:\n  ' + missing.join('\n  '));
    if (stale.length) console.error('In the manifest, not on disk:\n  ' + stale.join('\n  '));
    process.exit(1);
  }
  console.log(`Manifest lists all ${wanted.length} language files.`);
  process.exit(0);
}
const next = manifest.filter(f => !isLang(f)).concat(wanted).sort();
fs.writeFileSync(manifestPath, JSON.stringify(next, null, 2) + '\n');
console.log(`Manifest updated · ${missing.length} added, ${stale.length} removed, ${wanted.length} language files listed.`);
