// Finds English strings that are rendered two different ways across the
// French dictionaries, and values that break the voice rules.
//
//   node scripts/i18n/consistency.mjs            report
//   node scripts/i18n/consistency.mjs --strict   exit 1 on any voice breach
//
// The same label reading two ways on two pages is how a translation starts
// to feel like several people wrote it. Scoped keys ("text @@ selector")
// are left out: they differ on purpose.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const LANG = 'fr';
const STRICT = process.argv.includes('--strict');
const dir = path.join(process.cwd(), 'js/i18n', LANG);
const norm = s => String(s).replace(/\s+/g, ' ').trim();
const byKey = new Map();          // key -> Map(value -> [files])
const breaches = [];

// Voice rules that can be checked by machine. Names in the left column are
// what the report prints.
const RULES = [
  ['em dash', /—/],
  ['exclamation point', /!/],
  ['straight apostrophe', /[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/],
  ['banned word', /\b(vraiment|très|littéralement|afin de|au final|booster|débloquer|sans effort|sans friction|de pointe|révolutionnaire|robuste|tirer parti|parcours)\b/i],
  ['name recased', /\bBRANDOS\b|\bbrandos\b|\bBrandos\b|Brand OS\b|QB BrandOS/],
];

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
  const sandbox = { QBI18N: {
    add(_l, o) {
      for (const [k, v] of Object.entries(o)) {
        if (v === true || v === 1 || v == null) continue;
        const key = norm(k), val = String(v);
        for (const [name, re] of RULES) {
          // The homepage title tag keeps its em dash, as in English.
          if (name === 'em dash' && key.includes('—') && /BrandOS by Quantum Branding/.test(key)) continue;
          if (re.test(val)) breaches.push({ file: f, rule: name, key, val });
        }
        if (key.includes(' @@ ')) continue;
        if (!byKey.has(key)) byKey.set(key, new Map());
        const m = byKey.get(key);
        if (!m.has(val)) m.set(val, []);
        m.get(val).push(f);
      }
    },
    include() {}, css() {},
  } };
  vm.runInNewContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
}

const split = [...byKey].filter(([, m]) => m.size > 1);
for (const [key, m] of split) {
  console.log(`\n${JSON.stringify(key)}`);
  for (const [val, files] of m) console.log(`   ${JSON.stringify(val)}  ←  ${files.join(', ')}`);
}
console.log(`\n${split.length} string(s) rendered more than one way.`);
if (breaches.length) {
  console.log('\nVoice breaches:');
  for (const b of breaches) console.log(`  [${b.rule}] ${b.file}: ${JSON.stringify(b.val)}`);
}
console.log(`${breaches.length} voice breach(es).`);
process.exit(STRICT && breaches.length ? 1 : 0);
