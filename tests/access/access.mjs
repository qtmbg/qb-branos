/* BrandOS · access test
 *
 * What a free account and a Starter account can open, checked against the
 * offer in docs/brand/copy-facts.md. The product once told a free account
 * that Visual DNA and War Table were locked while letting it open both by
 * direct link. This keeps the three places that decide access in step:
 *
 *   1. qb-cloud.js hasAccess()            the client gate
 *   2. the tool pages                     each gated page calls requireAccess
 *   3. js/qb-foundation.js                what /foundation shows as locked
 *
 * No browser, no network.
 * Usage: node tests/access/access.mjs
 * Exit:  0 pass · 1 fail
 */
import fs from 'node:fs';
import vm from 'node:vm';

const fails = [];
const ok = (cond, label) => { if (!cond) fails.push(label); };

const FREE = ['signal-scan', 'archetype-compass', 'soul-map', 'sensescape', 'profiles', 'brand-document'];
const STARTER_ONLY = ['visual-dna', 'war-table', 'logo-direction', 'logo-evaluation', 'voice-guide'];
const HOLD = ['dashboard', 'quarterly', 'panel'];

// 1. The client gate, run for real with a stubbed browser.
const store = {};
const win = {
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  location: { pathname: '/', search: '', hostname: 'localhost', href: 'http://localhost/' },
  document: { addEventListener() {}, readyState: 'complete', cookie: '' },
  navigator: {}, addEventListener() {}, console,
  fetch: () => Promise.reject(new Error('no network in this test')),
  setTimeout, clearTimeout,
};
win.window = win;
try { vm.runInContext(fs.readFileSync('qb-cloud.js', 'utf8'), vm.createContext(win)); }
catch (e) { fails.push(`qb-cloud.js did not load: ${e.message}`); }
const has = win.QB_HAS_ACCESS;
ok(typeof has === 'function', 'qb-cloud.js exposes QB_HAS_ACCESS');

if (typeof has === 'function') {
  const as = (tier, status) => { delete store.qb_user_tier; delete store.qb_sub_status; if (tier) store.qb_user_tier = tier; if (status) store.qb_sub_status = status; };
  as(null, null);
  for (const f of FREE) ok(has(f) === true, `free account opens ${f}`);
  for (const f of STARTER_ONLY) ok(has(f) === false, `free account cannot open ${f}`);
  for (const f of HOLD) ok(has(f) === false, `free account cannot open ${f} (Hold)`);
  as('starter', 'active');
  for (const f of FREE.concat(STARTER_ONLY)) ok(has(f) === true, `Starter opens ${f}`);
  for (const f of HOLD) ok(has(f) === false, `Starter cannot open ${f} (Hold is not open yet)`);
  as('starter', 'inactive');
  for (const f of STARTER_ONLY) ok(has(f) === false, `a lapsed Starter cannot open ${f}`);
  for (const f of FREE) ok(has(f) === true, `a lapsed Starter still opens ${f}`);
}

// 2. Every gated tool page asks the gate before it renders.
const PAGES = {
  'visual-dna.html': 'visual-dna', 'war-table.html': 'war-table',
  'logo-direction-agent.html': 'logo-direction', 'logo-evaluation-agent.html': 'logo-evaluation', 'voice-guide-agent.html': 'voice-guide',
  'brand-performance-dashboard.html': 'dashboard', 'quarterly-brand-review-agent.html': 'quarterly', 'predictive-panel..html': 'panel',
};
for (const [file, id] of Object.entries(PAGES)) {
  const html = fs.readFileSync(file, 'utf8');
  ok(new RegExp(`QB\\.requireAccess\\(\\s*["']${id}["']`).test(html), `${file} calls QB.requireAccess("${id}")`);
}
// A free tool must not gate itself by mistake.
for (const file of ['signal-scan.html', 'archetype-compass.html', 'brand-soul-map.html', 'sensescape.html', 'the-profiles.html', 'brand-document.html']) {
  ok(!/QB\.requireAccess\(/.test(fs.readFileSync(file, 'utf8')), `${file} is free and does not call the gate`);
}

// 3. /foundation locks the same two exercises.
const foundation = fs.readFileSync('js/qb-foundation.js', 'utf8');
const locked = [...foundation.matchAll(/slug:\s*'([a-z-]+)'[\s\S]*?tierLocked:\s*(true|false)/g)].filter(m => m[2] === 'true').map(m => m[1]).sort();
ok(JSON.stringify(locked) === JSON.stringify(['visual-dna', 'war-table']), `/foundation locks exactly Visual DNA and War Table (found: ${locked.join(', ') || 'none'})`);

if (fails.length) { console.log(fails.map(f => 'FAIL · ' + f).join('\n')); console.log(`\naccess test FAILED · ${fails.length} failure(s)`); process.exit(1); }
console.log('access test passed · free, Starter and Hold agree across the gate, the pages and /foundation');
