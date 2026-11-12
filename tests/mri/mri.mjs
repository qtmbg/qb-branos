#!/usr/bin/env node
// tests/mri/mri.mjs
// Standing harness for Brand MRI: the engine, the tier rules, the copy, the
// page wiring and the money path.
//
//   node tests/mri/mri.mjs
//
// The browser scripts are plain scripts, so they are loaded into a bare
// object standing in for `window`. The server handlers are imported and
// called with real Request objects while fetch is stubbed, because the
// property that matters is which way each one fails.
//
// Nothing is truncated before comparison and no findings list is capped.

import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const failures = [];
const fail = m => failures.push(m);
const ok = m => console.log(`  ok · ${m}`);
let mark = 0;
const since = () => { mark = failures.length; };
const okIf = m => { if (failures.length === mark) ok(m); };

const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

function loadBrowser(...files) {
  const window = {};
  for (const f of files) new Function('window', 'module', read(f))(window, undefined);
  return window;
}

const W = loadBrowser('js/mri-i18n.js', 'js/mri.js', 'js/mri-tiers.js');
const { STRINGS, path: i18nPath, resolveLang, fmt } = W.MRI_I18N;
const ENGINE = W.MRI;
const TIERS = W.TIERS;

/* ───────────────────────────────────────────────────────────── */
console.log('\n1 · copy: two languages, one shape, the voice rules');
{
  since();
  const shape = o => Array.isArray(o) ? o.map(shape)
    : (o && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, shape(o[k])]))
    : typeof o;
  if (JSON.stringify(shape(STRINGS.en)) !== JSON.stringify(shape(STRINGS.fr))) fail('English and French trees differ in shape');
  okIf('English and French have the same keys, entry for entry');

  since();
  for (const l of ['en', 'fr']) {
    const s = STRINGS[l];
    if (s.questions.length !== 10) fail(`${l}: ${s.questions.length} questions, expected 10`);
    if (s.options.length !== 4) fail(`${l}: ${s.options.length} options, expected 4`);
    for (const p of ENGINE.PILLARS) {
      if (!s.pillars[p.id]) fail(`${l}: pillar ${p.id} has no name`);
      for (const lv of ['weak', 'mid', 'solid']) if (!s.advice[p.id] || !s.advice[p.id][lv]) fail(`${l}: no advice for ${p.id}/${lv}`);
    }
  }
  okIf('10 questions, 4 options, 5 pillars and 15 advice lines in each language');

  since();
  const leaves = (o, out = []) => {
    if (typeof o === 'string') out.push(o);
    else if (o && typeof o === 'object') for (const v of Object.values(o)) leaves(v, out);
    return out;
  };
  const BANNED = ['empower', 'unlock', 'supercharge', 'seamless', 'AI-powered', 'AI-driven', 'take to the next level',
    'stand out from the crowd', 'in order to', 'at the end of the day', 'world-class', 'best-in-class', 'cutting-edge',
    'robust', 'frictionless', 'effortless', 'leverage', 'journey', 'really', 'very', 'just', 'literally'];
  for (const text of leaves(STRINGS.en)) {
    for (const b of BANNED) if (new RegExp(`\\b${b}\\b`, 'i').test(text)) fail(`banned phrase "${b}" in: ${text}`);
  }
  for (const l of ['en', 'fr']) for (const text of leaves(STRINGS[l])) {
    if (text.includes('—')) fail(`${l}: em dash in: ${text}`);
    if (text.includes('!')) fail(`${l}: exclamation point in: ${text}`);
  }
  // The live French copy had lost its accents. These are the words it lost them on.
  // {placeholders} are keys, not copy, so they are removed before the check.
  const UNACCENTED = /\b(a qui|deja|recu|debloque|generique|identite|reseaux|precises|verifiables|prouve par|Plutot|meme promesse|a renforcer|difference)\b/;
  for (const text of leaves(STRINGS.fr)) if (UNACCENTED.test(text.replace(/\{\w+\}/g, ''))) fail(`French without accents: ${text}`);
  okIf('no banned phrase, no em dash, no exclamation point, French accents in place');

  since();
  if (resolveLang({ param: 'fr', stored: 'en', saved: 'en', nav: 'en-US' }) !== 'fr') fail('?lang= must win');
  if (resolveLang({ param: null, stored: 'fr', saved: 'en', nav: 'en-US' }) !== 'fr') fail('the site-wide choice must beat the saved diagnostic language');
  if (resolveLang({ param: null, stored: null, saved: 'fr', nav: 'en-US' }) !== 'fr') fail('the saved diagnostic language must beat the browser');
  if (resolveLang({ nav: 'fr-CA' }) !== 'fr') fail('a French browser must get French');
  if (resolveLang({ nav: 'de-DE' }) !== 'en') fail('every other browser must get English');
  if (resolveLang({ param: 'xx', nav: '' }) !== 'en') fail('an unknown ?lang= must fall through to English');
  if (fmt('a {x} b {y}', { x: 1 }) !== 'a 1 b {y}') fail('a missing value must leave its key visible');
  okIf('language resolves in order: address, site-wide choice, saved diagnostic, browser');
}

/* ───────────────────────────────────────────────────────────── */
console.log('\n2 · engine and report model');
const { scoreAnswers, sanitizeAnswers, tierFromSession, verifyPaidSession, PILLARS: SERVER_PILLARS } = await import('../../api/_lib/mri.js');
{
  since();
  const d = ENGINE.diagnose([7, 3, 7, 7, 3, 7, 3, 0, 0, 3]);
  if (d.global !== 40) fail(`known vector scored ${d.global}, expected 40`);
  if (d.tensions.map(p => p.id).join() !== 'differentiation,preuve,phrase') fail(`tensions out of order: ${d.tensions.map(p => p.id).join()}`);
  if (d.strongest.id !== 'logo') fail(`strongest is ${d.strongest.id}, expected logo`);
  for (const bad of [null, [], [1, 2, 3], [7, 3, 7, 7, 3, 7, 3, 0, 0, 5], [7, 3, 7, 7, 3, 7, 3, 0, 0, '3']]) {
    let threw = false;
    try { ENGINE.diagnose(bad); } catch { threw = true; }
    if (!threw) fail(`diagnose accepted ${JSON.stringify(bad)}`);
  }
  okIf('a known vector scores 40 with the right tensions, and malformed answers are refused');

  since();
  // Every possible sheet: 4^10 answer vectors. Browser and server must agree on all of them.
  const V = ENGINE.OPTION_VALUES;
  const a = new Array(10).fill(0);
  let n = 0, drift = 0, firstDrift = null;
  const ids = ENGINE.PILLARS.map(p => p.id).join();
  if (ids !== SERVER_PILLARS.map(p => p.id).join()) fail(`pillar ids differ: ${ids} vs ${SERVER_PILLARS.map(p => p.id).join()}`);
  for (let code = 0; code < 4 ** 10; code++) {
    let c = code;
    for (let i = 0; i < 10; i++) { a[i] = V[c & 3]; c >>= 2; }
    const b = ENGINE.diagnose(a);
    const s = scoreAnswers(a);
    n++;
    if (!s || s.global !== b.global || s.brake !== b.tensions[0].id || s.strongest !== b.strongest.id ||
        s.pillars.some((p, i) => p.score !== b.pillars[i].score)) { drift++; if (!firstDrift) firstDrift = a.slice(); }
  }
  if (drift) fail(`browser and server disagree on ${drift} of ${n} sheets, first: ${JSON.stringify(firstDrift)}`);
  okIf(`browser and server arithmetic agree on all ${n} possible answer sheets`);

  since();
  const samples = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], [7, 3, 7, 7, 3, 7, 3, 0, 0, 3], [10, 0, 0, 10, 3, 7, 7, 3, 10, 10], [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]];
  for (const sheet of samples) {
    const d2 = ENGINE.diagnose(sheet);
    const free = ENGINE.reportModel(d2, 'free');
    if (free.tensions || free.pillars || free.plan || free.sentence || free.review || free.reading) fail(`free tier shows paid content for ${sheet}`);
    const flash = ENGINE.reportModel(d2, 'flash');
    if (!flash.tensions || flash.tensions.length !== 3 || flash.pillars || flash.plan || flash.sentence) fail(`flash tier wrong shape for ${sheet}`);
    for (const tier of ['full', 'review']) {
      const m = ENGINE.reportModel(d2, tier);
      const shown = [...m.pillars.filter(p => p.advice).map(p => p.id), ...m.plan.filter(p => p.advice).map(p => p.id)];
      if (shown.length !== 5 || new Set(shown).size !== 5) fail(`${tier}: advice shown for [${shown}] on ${sheet}, expected each pillar once`);
      if (m.plan.length !== 3 || m.plan.some(p => p.exitTest.length !== 2)) fail(`${tier}: the plan needs three phases with a two-question exit test`);
      if (m.review !== (tier === 'review')) fail(`${tier}: review form flag is ${m.review}`);
    }
    if (ENGINE.reportModel(d2, 'nonsense').tier !== 'free') fail('an unknown tier must render as free');
  }
  okIf('each tier shows its own sections, and no advice line appears twice in one report');

  since();
  const R = STRINGS.en.result;
  const empty = ENGINE.sentence({ brand: 'Atelier Lumen', target: 'founders' }, R);
  if (empty.complete) fail('a sentence with no difference and no proof was reported complete');
  if (!empty.text.includes('[your difference]') || !empty.text.includes('[your proof]')) fail(`unfilled slots must show as bracketed placeholders: ${empty.text}`);
  const full = ENGINE.sentence({ brand: 'Atelier Lumen', target: 'founders', difference: 'the only studio that ships in ten days', proof: '120 projects' }, R);
  if (!full.complete || /[\[\]{}]/.test(full.text)) fail(`a filled sentence still carries a placeholder: ${full.text}`);
  okIf('the positioning sentence is a visible frame until the buyer fills it');
}

/* ───────────────────────────────────────────────────────────── */
console.log('\n3 · tiers: the address bar opens nothing');
{
  since();
  const prod = 'quantumbranding.ai';
  const cases = [
    ['no session',                         { sessions: [], demo: null, hostname: prod }, 'free'],
    ['?demo=full on production',           { sessions: [], demo: 'full', hostname: prod }, 'free'],
    ['?demo=review on www',                { sessions: [], demo: 'review', hostname: 'www.quantumbranding.ai' }, 'free'],
    ['?demo=full on app',                  { sessions: [], demo: 'full', hostname: 'app.quantumbranding.ai' }, 'free'],
    ['?demo=full on the vercel.app alias', { sessions: [], demo: 'full', hostname: 'qb-branos.vercel.app' }, 'free'],
    ['?demo=full on the team alias',       { sessions: [], demo: 'full', hostname: 'qb-branos-qtmbg.vercel.app' }, 'free'],
    ['?demo=full on the main branch alias', { sessions: [], demo: 'full', hostname: 'qb-branos-git-main-qtmbg.vercel.app' }, 'free'],
    ['?demo=full on an unlisted domain',   { sessions: [], demo: 'full', hostname: 'brand-mri.example' }, 'free'],
    ['?demo=full with no hostname',        { sessions: [], demo: 'full', hostname: '' }, 'free'],
    ['?demo=full on a lookalike host',     { sessions: [], demo: 'full', hostname: 'qb-branos-abc.vercel.app.evil.example' }, 'free'],
    ['?demo=full on a preview',            { sessions: [], demo: 'full', hostname: 'qb-branos-abc-qtmbg.vercel.app' }, 'full'],
    ['?demo=flash on localhost',           { sessions: [], demo: 'flash', hostname: 'localhost' }, 'flash'],
    ['unknown demo value on a preview',    { sessions: [], demo: 'admin', hostname: 'localhost' }, 'free'],
    ['one confirmed flash session',        { sessions: [{ tier: 'flash' }], demo: null, hostname: prod }, 'flash'],
    ['flash then upgrade',                 { sessions: [{ tier: 'flash' }, { tier: 'full' }], demo: null, hostname: prod }, 'full'],
    ['review beats full',                  { sessions: [{ tier: 'full' }, { tier: 'review' }], demo: null, hostname: prod }, 'review'],
    ['a re-test opens no report',          { sessions: [{ tier: 'retest' }], demo: null, hostname: prod }, 'free'],
    ['garbage in the session list',        { sessions: [null, {}, { tier: 'owner' }], demo: null, hostname: prod }, 'free'],
  ];
  for (const [label, ctx, expected] of cases) {
    const got = TIERS.resolveTier(ctx);
    if (got !== expected) fail(`"${label}" resolved to ${got}, expected ${expected}`);
  }
  okIf(`${cases.length} cases resolve to the tier a confirmed session grants, and nothing more`);

  since();
  const app = read('js/mri-app.js');
  const linkKeys = [...app.matchAll(/^\s{4}(\w+): 'https:\/\/buy\.stripe\.com\//gm)].map(m => m[1]);
  if (linkKeys.length !== 6) fail(`expected six payment links in mri-app.js, found ${linkKeys.length}`);
  for (const [tier, retest] of [['free', false], ['free', true], ['flash', false], ['full', false], ['review', false]]) {
    for (const o of TIERS.nextOffers(tier, retest)) {
      if (!linkKeys.includes(o.key)) fail(`offer "${o.key}" from ${tier} has no payment link`);
      if (!STRINGS.en.offers[o.key] || !STRINGS.fr.offers[o.key]) fail(`offer "${o.key}" has no copy`);
    }
  }
  if (TIERS.nextOffers('review', false).length) fail('the top tier must offer nothing further');
  okIf('every offer points at a payment link that exists and has copy in both languages');
}

/* ───────────────────────────────────────────────────────────── */
console.log('\n4 · page wiring');
{
  since();
  const html = read('mri.html');
  const app = read('js/mri-app.js');
  const idsInHtml = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const idsUsed = [...new Set([...app.matchAll(/\bel\('([^']+)'\)/g)].map(m => m[1]))];
  // Ids built at run time ('q' + i + 'set') are created by renderQuestions itself.
  for (const id of idsUsed) if (!idsInHtml.has(id)) fail(`mri-app.js reads #${id}, which mri.html does not define`);
  okIf(`all ${idsUsed.length} element ids the script reads exist in the page`);

  since();
  const keys = [...html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)].map(m => m[1]);
  for (const k of keys) for (const l of ['en', 'fr']) {
    if (typeof i18nPath(STRINGS[l], k) !== 'string') fail(`${l}: page key "${k}" resolves to no string`);
  }
  okIf(`all ${keys.length} text keys in the page resolve in both languages`);

  since();
  if (/\balert\s*\(/.test(app)) fail('mri-app.js still calls alert()');
  if (/mailto:/.test(app)) fail('mri-app.js still builds a mailto link');
  if (/\.innerHTML\b/.test(app)) fail('mri-app.js writes innerHTML');
  if (/get\(["']demo["']\)\s*\|\|\s*params\.get\(["']paid["']\)/.test(app)) fail('the paid parameter is read as a tier again');
  if (/d[ée]mo\)/i.test(html)) fail('a "(démo)" label is back in the page');
  if (!/<html lang="en">/.test(html)) fail('the static page must be English');
  if (!html.includes('<link rel="canonical" href="https://quantumbranding.ai/mri">')) fail('canonical must be https://quantumbranding.ai/mri');
  if (html.includes('—')) fail('em dash in mri.html');
  const scripts = [...html.matchAll(/<script src="\/([^"]+)"/g)].map(m => m[1]);
  const manifest = JSON.parse(read('scripts/public-files.json'));
  for (const s of scripts) if (!manifest.includes(s)) fail(`${s} is loaded by the page but missing from scripts/public-files.json`);
  const { URLS } = await import('../../scripts/seo/urls.mjs');
  if (!URLS.some(u => u.path === '/mri' && u.file === 'mri.html')) fail('/mri is missing from scripts/seo/urls.mjs');
  if (!read('sitemap.xml').includes('<loc>https://quantumbranding.ai/mri</loc>')) fail('/mri is missing from sitemap.xml');
  okIf('no alert, no mailto, no innerHTML, no demo label; scripts shipped; page in the sitemap');
}

/* ───────────────────────────────────────────────────────────── */
console.log('\n5 · payment check fails closed in every direction');
const realFetch = globalThis.fetch;
const restore = () => { globalThis.fetch = realFetch; };
const res = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const ENV = { STRIPE_SECRET_KEY: 'sk_test', RESEND_API_KEY: 're_test', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
const SID = 'cs_live_a1B2c3';
const paidSession = (linkTier, extra = {}) => ({
  id: SID, object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 7900, currency: 'usd',
  client_reference_id: 'v_0123456789abcdef0123', customer_details: { email: 'Buyer@Example.com' }, locale: 'en',
  metadata: { brand_mri_tier: linkTier }, ...extra,
});
{
  since();
  for (const [key, tier] of [['flash', 'flash'], ['full', 'full'], ['upgrade60', 'full'], ['review211', 'review'], ['reviewFull', 'review'], ['retest39', 'retest']]) {
    if (tierFromSession({ metadata: { brand_mri_tier: key } }) !== tier) fail(`link "${key}" must open "${tier}"`);
  }
  for (const s of [null, {}, { metadata: {} }, { metadata: { brand_mri_tier: 'owner' } }, { metadata: { product: 'platform' } }]) {
    if (tierFromSession(s) !== null) fail(`${JSON.stringify(s)} must open nothing`);
  }
  okIf('the six payment links map to their tiers and anything else maps to nothing');

  since();
  const cases = [
    ['no session id',            '',                 async () => res(200, paidSession('full')), ENV, 'bad_session_id'],
    ['a made-up id shape',       'full',             async () => res(200, paidSession('full')), ENV, 'bad_session_id'],
    ['path injection',           'cs_live_x/../y',   async () => res(200, paidSession('full')), ENV, 'bad_session_id'],
    ['unconfigured env',         SID,                async () => res(200, paidSession('full')), {}, 'not_configured'],
    ['Stripe does not know it',  SID,                async () => res(404, { error: {} }), ENV, 'not_found'],
    ['key lacks permission',     SID,                async () => res(403, { error: {} }), ENV, 'stripe_forbidden'],
    ['Stripe is down',           SID,                async () => res(500, 'oops'), ENV, 'stripe_unavailable'],
    ['fetch throws',             SID,                async () => { throw new Error('socket'); }, ENV, 'stripe_unavailable'],
    ['unparseable body',         SID,                async () => res(200, 'not json'), ENV, 'stripe_unavailable'],
    ['a different session back', SID,                async () => res(200, paidSession('full', { id: 'cs_live_other' })), ENV, 'stripe_unavailable'],
    ['unpaid session',           SID,                async () => res(200, paidSession('full', { payment_status: 'unpaid' })), ENV, 'unpaid'],
    ['expired, no payment',      SID,                async () => res(200, paidSession('full', { payment_status: 'no_payment_required' })), ENV, 'unpaid'],
    ['paid, but not an MRI link', SID,               async () => res(200, paidSession('full', { metadata: { product: 'platform' } })), ENV, 'not_mri'],
    ['paid, unknown MRI key',    SID,                async () => res(200, paidSession('owner')), ENV, 'not_mri'],
  ];
  for (const [label, id, impl, env, expected] of cases) {
    globalThis.fetch = impl;
    const r = await verifyPaidSession(env, id);
    restore();
    if (r.ok) fail(`"${label}" opened a tier · it must fail closed`);
    if (r.reason !== expected) fail(`"${label}" reported "${r.reason}", expected "${expected}"`);
  }
  okIf(`${cases.length} failure modes all resolve to ok:false with a distinct reason`);

  since();
  let asked = '';
  globalThis.fetch = async (url, opts) => { asked = `${url} ${opts.headers.Authorization}`; return res(200, paidSession('upgrade60')); };
  const good = await verifyPaidSession(ENV, SID);
  restore();
  if (!good.ok || good.tier !== 'full') fail(`a paid upgrade session was not recognised: ${JSON.stringify(good)}`);
  if (asked !== `https://api.stripe.com/v1/checkout/sessions/${SID} Bearer sk_test`) fail(`Stripe was asked the wrong thing: ${asked}`);
  okIf('a session Stripe reports as paid opens exactly its tier');
}

/* ───────────────────────────────────────────────────────────── */
console.log('\n6 · endpoints');
Object.assign(process.env, ENV, { STRIPE_WEBHOOK_SECRET: 'whsec_test', CRON_SECRET: 'cron_test' });
const ANSWERS = [7, 3, 7, 7, 3, 7, 3, 0, 0, 3];

// A small fake of the three services the handlers talk to.
function world({ session = null, sessionStatus = 200, ledgerRows = [], ledgerStatus = 201, resendStatus = 200 } = {}) {
  const calls = { mail: [], ledgerInserts: [], ledgerReads: [], stripe: [], other: [] };
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const body = opts.body ? (() => { try { return JSON.parse(opts.body); } catch { return opts.body; } })() : null;
    if (u === 'https://api.resend.com/emails') { calls.mail.push(body); return res(resendStatus, { id: 'mail_1' }); }
    if (u.startsWith('https://api.stripe.com/v1/checkout/sessions/')) { calls.stripe.push(u); return res(sessionStatus, session || { error: {} }); }
    if (u.startsWith('https://api.stripe.com/v1/subscriptions/')) { calls.stripe.push(u); return res(200, { items: { data: [{ price: { id: 'price_1Th8JkEHEAcWrG55Abr1OZXe' } }] } }); }
    if (u.includes('/rest/v1/mri_events')) {
      if ((opts.method || 'GET') === 'POST') { calls.ledgerInserts.push(body); return res(ledgerStatus, ''); }
      calls.ledgerReads.push(u);
      return res(200, typeof ledgerRows === 'function' ? ledgerRows(u) : ledgerRows);
    }
    calls.other.push({ u, method: opts.method || 'GET', body });
    if (u.includes('/rest/v1/stripe_events')) return res((opts.method || 'GET') === 'POST' ? 201 : 200, (opts.method || 'GET') === 'POST' ? '' : []);
    if (u.includes('/rest/v1/profiles')) return res(200, [{ id: 'u1' }]);
    return res(404, {});
  };
  return calls;
}
const post = (path, body, origin = 'https://quantumbranding.ai') => new Request(`https://quantumbranding.ai${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
});

const leadHandler = (await import('../../api/mri-lead.js')).default;
const verifyHandler = (await import('../../api/mri-verify.js')).default;
const eventHandler = (await import('../../api/mri-event.js')).default;
const digestHandler = (await import('../../api/cron/mri-digest.js')).default;
const webhookHandler = (await import('../../api/stripe-webhook.js')).default;

{
  since();
  let c = world();
  let r = await leadHandler(post('/api/mri-lead', { email: 'a@b.co', answers: ANSWERS }, 'https://evil.example'));
  if (r.status !== 403 || c.mail.length) fail(`a foreign origin got ${r.status} and ${c.mail.length} emails`);
  r = await leadHandler(post('/api/mri-lead', { email: 'not-an-email', answers: ANSWERS }));
  if (r.status !== 400 || c.mail.length) fail(`an invalid email got ${r.status} and ${c.mail.length} emails`);

  c = world();
  r = await leadHandler(post('/api/mri-lead', {
    type: 'lead', email: 'Founder@Example.com', brand: 'Atelier Lumen', website: 'https://atelierlumen.com', answers: ANSWERS,
    score: 99, frein: 'forged', tier: 'owner', lang: 'fr', visitor_id: 'v_0123456789abcdef0123', utm: { source: 'linkedin' }, focus: 'logo',
  }));
  const out = await r.json();
  if (r.status !== 200 || !out.ok || !out.scoreEmail) fail(`a valid lead answered ${r.status} ${JSON.stringify(out)}`);
  const [operator, visitor] = c.mail;
  if (!operator || operator.to[0] !== 'me@qtmbg.com' || operator.subject !== 'Brand MRI lead : Atelier Lumen (40/100)') fail(`operator email wrong: ${operator && operator.subject}`);
  // The email closes on a timestamp, and now and then its milliseconds hold
  // "99". That made this check cry wolf about one run in fifty. Every line is
  // still read in full; only the Date line is set aside.
  const claimed = operator ? operator.text.split('\n').filter(l => !l.startsWith('Date : ')).join('\n') : '';
  if (operator && claimed === operator.text) fail('the operator email has no Date line to set aside: this check needs a second look');
  if (claimed.includes('99') || claimed.includes('forged')) fail('the operator email repeats a score the browser claimed');
  if (visitor && (/\b99\b/.test(visitor.text) || visitor.text.includes('forged'))) fail('the visitor email repeats a score the browser claimed');
  if (operator && !operator.text.includes('Réponses (Q1 à Q10) : 7, 3, 7, 7, 3, 7, 3, 0, 0, 3')) fail('the operator email does not carry the ten answers');
  if (operator && !operator.text.includes('Source : linkedin')) fail('the operator email does not carry the source');
  if (!visitor || visitor.to[0] !== 'founder@example.com' || visitor.subject !== 'Votre score Brand MRI : 40/100') fail(`visitor email wrong: ${visitor && visitor.subject}`);
  if (visitor && !visitor.text.includes('Différenciation')) fail('the visitor email does not name the main brake in French');
  const row = c.ledgerInserts[0];
  if (!row || row.event !== 'completed' || row.score !== 40 || row.brake !== 'differentiation' || row.tier !== 'free' || row.data.answers.join() !== ANSWERS.join()) fail(`ledger row wrong: ${JSON.stringify(row)}`);
  okIf('a lead is refused from a foreign origin or with a bad email; a valid one emails both sides and is scored on the server');

  since();
  c = world();
  r = await leadHandler(post('/api/mri-lead', { email: 'old@client.co', brand: 'Old Script', score: 42, frein: 'Preuve', tier: 'free' }));
  if (r.status !== 200 || c.mail.length !== 1 || c.mail[0].subject !== 'Brand MRI lead : Old Script (42/100)') fail(`the previous script's payload was not handled as before: ${r.status}, ${c.mail.length} emails`);
  c = world({ ledgerRows: [{ id: 'x' }] });
  r = await leadHandler(post('/api/mri-lead', { email: 'a@b.co', answers: ANSWERS }));
  if (c.mail.length !== 1) fail(`a second completion inside ten minutes sent ${c.mail.length - 1} visitor emails, expected none`);
  c = world({ ledgerStatus: 404 });
  r = await leadHandler(post('/api/mri-lead', { email: 'a@b.co', answers: ANSWERS }));
  if (r.status !== 200 || c.mail.length !== 2) fail(`with no ledger table the lead must still be emailed to both sides: ${r.status}, ${c.mail.length}`);
  c = world({ resendStatus: 500 });
  r = await leadHandler(post('/api/mri-lead', { email: 'a@b.co', answers: ANSWERS }));
  if (r.status !== 502) fail(`a failed operator email must answer 502, got ${r.status}`);
  okIf('the previous payload still works, the visitor email is not repeated, a missing ledger loses nothing, a failed send is reported');

  since();
  const order = { type: 'review', session_id: SID, email: 'buyer@example.com', brand: 'Atelier Lumen', questions: 'Is my sentence too long?', answers: ANSWERS };
  for (const [label, w, status] of [
    ['unpaid session',   { session: paidSession('reviewFull', { payment_status: 'unpaid' }) }, 402],
    ['unknown session',  { sessionStatus: 404 }, 402],
    ['a Flash session',  { session: paidSession('flash') }, 402],
    ['a full session',   { session: paidSession('full') }, 402],
    ['Stripe down',      { sessionStatus: 500 }, 503],
  ]) {
    c = world(w);
    r = await leadHandler(post('/api/mri-lead', order));
    if (r.status !== status) fail(`review order on ${label} answered ${r.status}, expected ${status}`);
    if (c.mail.length) fail(`review order on ${label} reached the inbox`);
  }
  c = world({ session: paidSession('review211') });
  r = await leadHandler(post('/api/mri-lead', { ...order, questions: '' }));
  if (r.status !== 400 || c.mail.length) fail('a review order with no questions must be refused');
  r = await leadHandler(post('/api/mri-lead', order));
  if (r.status !== 200 || c.mail.length !== 1) fail(`a paid review order answered ${r.status} with ${c.mail.length} emails`);
  const m = c.mail[0];
  if (m && (m.subject !== 'Brand MRI review : Atelier Lumen' || !m.text.includes('Is my sentence too long?') || !m.text.includes('Score : 40/100') || !m.text.includes(SID))) fail('the review email lacks the questions, the diagnostic or the session');
  okIf('a review order reaches the inbox only for a paid review session, with questions and diagnostic');

  since();
  c = world({ session: paidSession('full'), ledgerRows: [{ lang: 'fr', email: 'buyer@example.com', brand: 'Atelier Lumen', website: 'https://a.co', score: 40, brake: 'differentiation', data: { answers: ANSWERS, phrase: 'p', target: 't' } }] });
  r = await verifyHandler(new Request(`https://quantumbranding.ai/api/mri-verify?session_id=${SID}`));
  let v = await r.json();
  if (!v.ok || v.tier !== 'full' || !v.restore || v.restore.answers.join() !== ANSWERS.join() || v.restore.lang !== 'fr') fail(`verify did not return tier and restore: ${JSON.stringify(v)}`);
  if (!c.ledgerInserts.some(x => x.event === 'paid' && x.stripe_session_id === SID && x.amount_total === 7900)) fail('verify did not record the sale');
  c = world({ session: paidSession('full', { payment_status: 'unpaid' }) });
  v = await (await verifyHandler(new Request(`https://quantumbranding.ai/api/mri-verify?session_id=${SID}`))).json();
  if (v.ok || v.tier || v.restore || c.ledgerInserts.length) fail(`verify leaked something for an unpaid session: ${JSON.stringify(v)}`);
  c = world({ session: paidSession('flash'), ledgerStatus: 409 });
  v = await (await verifyHandler(new Request(`https://quantumbranding.ai/api/mri-verify?session_id=${SID}`))).json();
  if (!v.ok || v.tier !== 'flash') fail('a sale already in the ledger must still verify');
  okIf('verify returns the tier and the stored diagnostic for a paid session, and nothing for an unpaid one');

  since();
  for (const ev of ['paid', 'completed', 'review_order', 'anything']) {
    c = world();
    await eventHandler(post('/api/mri-event', { event: ev, visitor_id: 'v_1' }));
    if (c.ledgerInserts.length) fail(`the browser was able to write a "${ev}" row`);
  }
  c = world();
  await eventHandler(post('/api/mri-event', { event: 'view', visitor_id: 'v_1' }, 'https://evil.example'));
  if (c.ledgerInserts.length) fail('a foreign origin wrote an event');
  c = world();
  const er = await eventHandler(post('/api/mri-event', { event: 'pay_click', visitor_id: 'v_1', target: 'flash', tier: 'owner', utm: { source: 'linkedin' } }));
  if (er.status !== 204 || c.ledgerInserts.length !== 1 || c.ledgerInserts[0].data.target !== 'flash' || c.ledgerInserts[0].tier !== 'free') fail(`pay_click not recorded as expected: ${JSON.stringify(c.ledgerInserts)}`);
  okIf('the browser can record view, start and pay_click, and can never write a sale or a completion');

  since();
  const sign = raw => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${createHmac('sha256', 'whsec_test').update(`${t}.${raw}`).digest('hex')}`; };
  const hook = (event, sig) => { const raw = JSON.stringify(event); return new Request('https://app.quantumbranding.ai/api/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': sig || sign(raw) }, body: raw }); };
  const evt = obj => ({ id: 'evt_1', type: 'checkout.session.completed', data: { object: obj } });

  c = world({ ledgerRows: u => u.includes('event=eq.completed') ? [{ lang: 'en', email: 'buyer@example.com', brand: 'Atelier Lumen', website: 'https://a.co', score: 40, brake: 'differentiation', data: { answers: ANSWERS } }] : [{ id: 1 }, { id: 2 }] });
  r = await webhookHandler(hook(evt(paidSession('reviewFull', { amount_total: 29000 }))));
  let w = await r.json();
  if (r.status !== 200 || w.product !== 'brand_mri' || !w.handled) fail(`MRI sale answered ${r.status} ${JSON.stringify(w)}`);
  const sale = c.mail.find(x => x.to[0] === 'me@qtmbg.com');
  const access = c.mail.find(x => x.to[0] === 'buyer@example.com');
  if (!sale || sale.subject !== 'Brand MRI vente : Atelier Lumen · rapport avec review vidéo · 290 $') fail(`sale email wrong: ${sale && sale.subject}`);
  if (sale && (!sale.text.includes('72 h ouvrées') || !sale.text.includes('Reviews payées sur 7 jours : 2 sur 5.') || !sale.text.includes('Score : 40/100'))) fail('the sale email lacks the review clock, the weekly count or the diagnostic');
  if (!access || !access.text.includes(`https://quantumbranding.ai/mri?paid=review&session_id=${SID}`)) fail('the buyer did not receive their access link');
  if (!c.ledgerInserts.some(x => x.event === 'paid' && x.tier === 'review' && x.stripe_session_id === SID)) fail('the webhook did not record the sale');

  c = world();
  r = await webhookHandler(hook(evt(paidSession('full')), 't=1,v1=00'));
  if (r.status !== 400 || c.mail.length || c.ledgerInserts.length) fail(`a bad signature answered ${r.status} and caused side effects`);

  c = world();
  r = await webhookHandler(hook(evt({ id: 'cs_live_foreign', mode: 'payment', payment_status: 'paid', metadata: { something: 'else' } })));
  w = await r.json();
  if (r.status !== 200 || w.ignored !== 'foreign_price' || c.mail.length || c.ledgerInserts.length || c.other.length) fail(`a foreign payment session must stay a strict no-op: ${JSON.stringify(w)}, ${c.other.length} writes`);

  c = world();
  r = await webhookHandler(hook(evt({ id: 'cs_live_sub', mode: 'subscription', subscription: 'sub_1', client_reference_id: 'u1', customer: 'cus_1', metadata: { tier_intent: 'starter' } })));
  const patched = c.other.find(x => x.u.includes('/rest/v1/profiles') && x.method === 'PATCH');
  if (r.status !== 200 || !patched || patched.body.tier !== 'starter' || c.mail.length) fail(`the BrandOS subscription path changed: ${r.status}, patch ${JSON.stringify(patched && patched.body)}`);

  c = world();
  r = await webhookHandler(hook(evt(paidSession('full', { payment_status: 'unpaid' }))));
  w = await r.json();
  if (r.status !== 200 || w.handled !== false || c.mail.length) fail('an unpaid MRI session must send nothing');
  okIf('webhook: an MRI sale alerts the inbox and the buyer; bad signature, foreign session and BrandOS subscription behave as before');

  since();
  const cron = (auth, ua = 'vercel-cron/1.0') => new Request('https://quantumbranding.ai/api/cron/mri-digest', { headers: { 'user-agent': ua, ...(auth ? { authorization: auth } : {}) } });
  c = world();
  for (const [label, req] of [['no bearer', cron(null)], ['wrong bearer', cron('Bearer nope')], ['wrong user agent', cron('Bearer cron_test', 'curl/8')]]) {
    r = await digestHandler(req);
    if (r.status !== 401) fail(`digest with ${label} answered ${r.status}`);
  }
  if (c.mail.length || c.ledgerReads.length) fail('an unauthorised digest call read the ledger or sent mail');
  const y = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - 6 * 3600000).toISOString();
  c = world({ ledgerRows: [
    { created_at: y, event: 'view', visitor_id: 'v_1', utm_source: 'linkedin' }, { created_at: y, event: 'view', visitor_id: 'v_1', utm_source: 'linkedin' },
    { created_at: y, event: 'view', visitor_id: 'v_2' }, { created_at: y, event: 'start', visitor_id: 'v_1' },
    { created_at: y, event: 'completed', visitor_id: 'v_1', brand: 'Atelier Lumen', website: 'https://a.co', score: 40, brake: 'differentiation', utm_source: 'linkedin' },
    { created_at: y, event: 'pay_click', visitor_id: 'v_1' }, { created_at: y, event: 'paid', visitor_id: 'v_1', tier: 'full', brand: 'Atelier Lumen', amount_total: 7900 },
  ] });
  r = await digestHandler(cron('Bearer cron_test'));
  const dg = await r.json();
  if (!dg.ok || !dg.sent || dg.yesterday.visits !== 2 || dg.yesterday.completions !== 1 || dg.yesterday.sales !== 1) fail(`digest counted wrong: ${JSON.stringify(dg)}`);
  const dm = c.mail[0];
  if (!dm || !/2 visites, 1 diagnostic, 1 vente$/.test(dm.subject) || !dm.text.includes('Atelier Lumen · https://a.co · 40/100 · frein : Différenciation · source : linkedin') || !dm.text.includes('Ventes : 1 (79 $)')) fail(`digest email wrong: ${dm && dm.subject}`);
  c = world({ ledgerRows: [] });
  r = await digestHandler(cron('Bearer cron_test'));
  const quiet = await r.json();
  const monday = new Date().getUTCDay() === 1;
  if (quiet.sent !== monday || c.mail.length !== (monday ? 1 : 0)) fail(`an empty day must be silent except on Mondays (today monday=${monday}, sent=${quiet.sent})`);
  c = world({ ledgerStatus: 404, ledgerRows: () => { throw new Error('unreachable'); } });
  globalThis.fetch = async () => res(404, {});
  r = await digestHandler(cron('Bearer cron_test'));
  const missing = await r.json();
  if (missing.ok || missing.reason !== 'table_missing') fail(`a missing ledger must be reported, got ${JSON.stringify(missing)}`);
  okIf('digest: refused without the cron secret, counts visitors once, lists brands and sales, stays quiet on an empty day');
}
restore();

/* ───────────────────────────────────────────────────────────── */
if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\nBrand MRI harness passed.');
