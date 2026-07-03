/* QB BrandOS · whole-site mechanics audit
 *
 * Visits every production page in headless Chromium at 390px and 1280px and
 * collects the mechanical defects a founder would hit:
 *   - console errors + uncaught page errors
 *   - failed same-origin network requests (>=400 or aborted)
 *   - missing images (naturalWidth === 0)
 *   - horizontal overflow at 390px (the mobile-first breach)
 *   - suspicious CTAs (visible <a href="#"> / empty / javascript:)
 *   - legacy chassis debris (duplicate navs, theme-toggle, legacy .btn classes)
 *   - the banner system constant missing on marketing/tool pages
 *   - render-blocking Google Fonts links (HEAD-SNIPPET regression)
 * Then dedupes every same-origin href seen anywhere and GET-checks each once
 * (the dead-link ledger).
 *
 * App pages (foundation, agents, archive, qbp, account, artifact) are audited
 * with a seeded starter identity (locked foundation + one delivered artifact),
 * injected as qb_session; the seed user is torn down debris-free.
 *
 * Usage: node tests/site-audit/audit.mjs
 * Output: tests/site-audit/audit-report.json (gitignored artifacts: .last-run)
 * Env: .env.qb-branos.live or QB_ENV_FILE (only needed for the app-page half;
 *      without it the public half still runs).
 */

import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const WIDTHS = [390, 1280];
const SETTLE_MS = 2500;

const BANNER_CONSTANT = 'Signal Scan is live';

// Public routes: clean paths from vercel.json + direct .html for the rest.
const PUBLIC_ROUTES = [
  '/', '/ecosystem.html', '/scan', '/tools', '/atelier', '/war-room',
  '/paywall', '/payment.html', '/terms', '/privacy', '/panel',
  '/the-profiles.html', '/archetype-compass.html',
  '/brand-soul-map.html', '/sensescape.html', '/visual-dna.html', '/war-table.html',
  '/brand-document.html', '/brand-performance-dashboard.html',
  '/content-bridge.html', '/content-repurposing-engine.html', '/content-scheduler.html',
  '/instagram-seed-agent.html', '/linkedin-strategy-agent.html', '/youtube-strategy-agent.html',
  '/newsletter-architecture-agent.html', '/quarterly-brand-review-agent.html',
  '/logo-direction-agent.html', '/logo-evaluation-agent.html', '/voice-guide-agent.html',
  '/404.html',
];
// Marketing/tool pages that must carry the banner constant (app + legal + 404 excluded).
// /war-room is Ship Gate, an operator dashboard, not a marketing surface: exempt.
const BANNER_EXEMPT = new Set(['/paywall', '/payment.html', '/terms', '/privacy', '/404.html', '/war-room']);

const APP_ROUTES = ['/foundation', '/agents', '/archive', '/qbp', '/account'];

const fileEnv = fs.existsSync(ENV_PATH)
  ? Object.fromEntries(fs.readFileSync(ENV_PATH, 'utf8').split('\n')
      .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]]))
  : {};
const env = { ...process.env, ...fileEnv };
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY, AK = env.SUPABASE_ANON_KEY;
const HAS_ENV = !!(SU && SK && AK);
const svc = HAS_ENV ? { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' } : null;
const uuid = () => crypto.randomUUID();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function must(r, what) { if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`); return r; }

/* ── seed identity for the app half ────────────────────────── */
async function makeSeed() {
  const email = `qb-siteaudit-${uuid().slice(0, 8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier: 'starter', foundation_locked_at: new Date().toISOString(), qbp: { brandName: 'Steadfield', brandEssence: 'Patient growth.', archetypePrimary: 'Sage' } }) }), 'profile');
  const art = await (await must(await fetch(`${SU}/rest/v1/artifacts`, { method: 'POST', headers: { ...svc, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: u.id, artifact_type: 'soul_map_synthesizer', status: 'delivered', version: 1, phase: '01', content: { schema_version: '1.0', header: { eyebrow: '01 Discovery · Soul Map', title: 'The Soul of Steadfield', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading: 'Essence', prose: 'Steadfield grows things that take time.\n\nPrecise, warm, unhurried.' }], data_blocks: [], footer: { qbp_fields_referenced: ['brandName'] } } }) }), 'artifact')).json();
  const tok = await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json();
  return { id: u.id, email, token: tok.access_token, refreshToken: tok.refresh_token, artifactId: art[0].id };
}
async function teardownSeed(user) {
  await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/dispatch_jobs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/notifications?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
  return !(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { headers: svc })).ok;
}

/* ── per-page inspection (runs in the page) ─────────────────── */
function pageProbe() {
  const out = {};
  const doc = document;
  out.title = doc.title || null;
  out.h1 = doc.querySelector('h1')?.textContent?.trim().slice(0, 120) || null;

  // Horizontal overflow (mobile breach when width is 390)
  const se = doc.scrollingElement || doc.documentElement;
  out.scrollWidth = se.scrollWidth;
  out.clientWidth = se.clientWidth;

  // Missing images (loaded but zero natural width, or errored)
  out.brokenImages = [...doc.querySelectorAll('img')]
    .filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src'))
    .map(i => i.getAttribute('src')).slice(0, 20);

  // Suspicious visible CTAs
  out.suspiciousCtas = [...doc.querySelectorAll('a')]
    .filter(a => {
      const href = (a.getAttribute('href') || '').trim();
      const bad = href === '' || href === '#' || href.startsWith('javascript:');
      if (!bad) return false;
      const r = a.getBoundingClientRect();
      const style = getComputedStyle(a);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    })
    .map(a => ({ text: (a.textContent || '').trim().slice(0, 60), href: a.getAttribute('href') || '' }))
    .slice(0, 20);

  // All same-origin hrefs for the dead-link ledger
  out.hrefs = [...new Set([...doc.querySelectorAll('a[href]')]
    .map(a => a.getAttribute('href'))
    .filter(h => h && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('tel:') && !h.startsWith('javascript:'))
    .map(h => { try { return new URL(h, location.href).href; } catch { return null; } })
    .filter(h => h && h.startsWith(location.origin))
    .map(h => h.split('#')[0]))];

  // Legacy chassis debris
  out.legacy = {
    themeToggle: !!doc.querySelector('.theme-toggle'),
    legacyHeaderNav: !!doc.querySelector('header.nav'),
    navCount: doc.querySelectorAll('nav, .nav-wrap, header.nav').length,
    visibleNavCount: [...doc.querySelectorAll('nav, .nav-wrap, header.nav')].filter(n => {
      const r = n.getBoundingClientRect(); const s = getComputedStyle(n);
      return r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    }).length,
    legacyBtnCount: doc.querySelectorAll('.btn-primary, .btn-secondary, .cta-primary, .cta-secondary, .option-btn, .btn-ghost').length,
    qbButtonCount: doc.querySelectorAll('.qb-button').length,
  };

  out.hasBanner = (doc.body.textContent || '').includes('Signal Scan is live');

  // Render-blocking Google Fonts links (should be preload+onload per HEAD-SNIPPET)
  out.blockingFontLinks = [...doc.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"]')]
    .filter(l => !l.hasAttribute('data-nonblocking'))
    .length;

  out.darkTheme = !!doc.querySelector('[data-theme="dark"]');
  return out;
}

async function auditPage(browser, route, { width, session }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  if (session) {
    await ctx.addInitScript(s => { try { localStorage.setItem('qb_session', s); } catch (e) {} },
      JSON.stringify({ token: session.token, userId: session.id, refreshToken: session.refreshToken }));
  }
  const page = await ctx.newPage();
  const consoleErrors = [], pageErrors = [], failedRequests = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => pageErrors.push(String(e?.message || e).slice(0, 300)));
  page.on('response', r => {
    try {
      const u = new URL(r.url());
      if (r.status() >= 400 && (u.origin === new URL(BASE).origin || u.hostname.endsWith('.supabase.co'))) {
        failedRequests.push({ status: r.status(), url: r.url().slice(0, 180) });
      }
    } catch (_) {}
  });
  page.on('requestfailed', r => {
    try {
      const u = new URL(r.url());
      if (u.origin === new URL(BASE).origin) failedRequests.push({ status: 'failed', url: r.url().slice(0, 180), err: r.failure()?.errorText });
    } catch (_) {}
  });

  const rec = { route, width, finalUrl: null, httpStatus: null };
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    rec.httpStatus = resp?.status() ?? null;
    await sleep(SETTLE_MS);
    rec.finalUrl = page.url();
    Object.assign(rec, await page.evaluate(pageProbe));
  } catch (e) {
    rec.navError = String(e?.message || e).slice(0, 200);
  }
  rec.consoleErrors = [...new Set(consoleErrors)].slice(0, 15);
  rec.pageErrors = [...new Set(pageErrors)].slice(0, 10);
  rec.failedRequests = failedRequests.slice(0, 20);
  await ctx.close();
  return rec;
}

/* ── main ───────────────────────────────────────────────────── */
async function main() {
  const report = { started_at: new Date().toISOString(), base: BASE, pages: [], linkCheck: {}, appAudited: false };
  const browser = await chromium.launch({ headless: true });
  let seed = null;

  try {
    // Public half
    for (const route of PUBLIC_ROUTES) {
      for (const width of WIDTHS) {
        const rec = await auditPage(browser, route, { width });
        report.pages.push(rec);
        console.error(`[public] ${route} @${width} · http=${rec.httpStatus} cerr=${rec.consoleErrors.length} perr=${rec.pageErrors.length} fail=${rec.failedRequests.length} overflow=${width === 390 && rec.scrollWidth > rec.clientWidth + 1}`);
      }
    }

    // App half (seeded)
    if (HAS_ENV) {
      seed = await makeSeed();
      report.appAudited = true;
      const appRoutes = [...APP_ROUTES, `/artifact?id=${seed.artifactId}`];
      for (const route of appRoutes) {
        for (const width of WIDTHS) {
          const rec = await auditPage(browser, route, { width, session: seed });
          rec.app = true;
          report.pages.push(rec);
          console.error(`[app] ${route} @${width} · http=${rec.httpStatus} cerr=${rec.consoleErrors.length} perr=${rec.pageErrors.length} fail=${rec.failedRequests.length}`);
        }
      }
    } else {
      console.error('[app] SKIPPED · no env file');
    }

    // Dead-link ledger: dedupe every same-origin href seen, GET each once.
    const allHrefs = [...new Set(report.pages.flatMap(p => p.hrefs || []))];
    console.error(`[links] checking ${allHrefs.length} unique internal URLs`);
    for (const href of allHrefs) {
      try {
        const r = await fetch(href, { method: 'GET', redirect: 'follow' });
        report.linkCheck[href] = r.status;
      } catch (e) {
        report.linkCheck[href] = `ERR ${String(e?.message || e).slice(0, 80)}`;
      }
    }
  } finally {
    await browser.close().catch(() => {});
    if (seed) report.seedTeardownDebrisFree = await teardownSeed(seed);
  }

  // Summary
  const deadLinks = Object.entries(report.linkCheck).filter(([, s]) => s !== 200 && s !== 401 && s !== 402);
  report.summary = {
    pagesAudited: report.pages.length,
    pagesWithConsoleErrors: report.pages.filter(p => p.consoleErrors?.length).length,
    pagesWithPageErrors: report.pages.filter(p => p.pageErrors?.length).length,
    pagesWithFailedRequests: report.pages.filter(p => p.failedRequests?.length).length,
    mobileOverflowPages: report.pages.filter(p => p.width === 390 && p.scrollWidth > p.clientWidth + 1).map(p => p.route),
    brokenImagePages: report.pages.filter(p => p.brokenImages?.length).map(p => ({ route: p.route, imgs: p.brokenImages })),
    suspiciousCtaPages: report.pages.filter(p => p.suspiciousCtas?.length).map(p => ({ route: p.route, n: p.suspiciousCtas.length })),
    legacyDebrisPages: report.pages.filter(p => p.width === 1280 && p.legacy && (p.legacy.themeToggle || p.legacy.legacyHeaderNav || p.legacy.legacyBtnCount > 0)).map(p => ({ route: p.route, ...p.legacy })),
    missingBannerPages: report.pages.filter(p => p.width === 1280 && !p.app && !BANNER_EXEMPT.has(p.route) && p.hasBanner === false).map(p => p.route),
    blockingFontPages: report.pages.filter(p => p.width === 1280 && p.blockingFontLinks > 0).map(p => p.route),
    darkThemePages: report.pages.filter(p => p.width === 1280 && p.darkTheme).map(p => p.route),
    deadLinks: Object.fromEntries(deadLinks),
  };
  report.completed_at = new Date().toISOString();
  fs.mkdirSync('tests/site-audit', { recursive: true });
  fs.writeFileSync('tests/site-audit/audit-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
