/* QB BrandOS · WCAG 2.1 A/AA audit (chapter-4 deferral, cured chapter-7)
 *
 * Visits every production surface in headless Chromium at 390px and 1280px,
 * injects axe-core 4.x, and runs the WCAG 2.0/2.1 level A + AA rule set on
 * each. The app half (foundation, agents, archive, qbp, account, artifact)
 * runs under a seeded starter identity injected as qb_session, torn down
 * debris-free. Findings are deduped by (rule, impact) across the whole
 * surface and bucketed: critical/serious = blocking, moderate/minor =
 * advisory. Per-page violation nodes are kept (trimmed) so a fixer can
 * jump straight to the selector.
 *
 * Usage: node tests/site-audit/wcag-audit.mjs
 * Deps:  axe-core installed locally (npm i axe-core --no-save); playwright.
 * Env:   .env.qb-branos.live or QB_ENV_FILE (app half; public half runs w/o).
 * Out:   chapter-07/qa/wcag/wcag-report.json
 */

import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const AXE_SRC = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const WIDTHS = [390, 1280];
const SETTLE_MS = 2500;
const OUT = 'chapter-07/qa/wcag/wcag-report.json';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Public surface (mirrors tests/site-audit/audit.mjs PUBLIC_ROUTES).
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

async function makeSeed() {
  const email = `qb-wcag-${uuid().slice(0, 8)}@qb-harness.test`;
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

async function auditRoute(browser, route, { width, session }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  if (session) {
    await ctx.addInitScript(s => { try { localStorage.setItem('qb_session', s); } catch (e) {} },
      JSON.stringify({ token: session.token, userId: session.id, refreshToken: session.refreshToken }));
  }
  const page = await ctx.newPage();
  const rec = { route, width, httpStatus: null, violations: [], navError: null };
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    rec.httpStatus = resp?.status() ?? null;
    await sleep(SETTLE_MS);
    await page.addScriptTag({ content: AXE_SRC });
    const results = await page.evaluate(async (tags) => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return r.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
        nodes: v.nodes.slice(0, 6).map(n => ({
          target: n.target, impact: n.impact,
          summary: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 260),
          html: (n.html || '').slice(0, 160),
        })),
        nodeCount: v.nodes.length,
      }));
    }, WCAG_TAGS);
    rec.violations = results;
  } catch (e) {
    rec.navError = String(e?.message || e).slice(0, 200);
  }
  await ctx.close();
  return rec;
}

async function main() {
  const report = { harness: 'wcag-audit', started_at: new Date().toISOString(), base: BASE, axe: '4.x', tags: WCAG_TAGS, pages: [], appAudited: false };
  const browser = await chromium.launch({ headless: true });
  let seed = null;
  try {
    for (const route of PUBLIC_ROUTES) {
      for (const width of WIDTHS) {
        const rec = await auditRoute(browser, route, { width });
        report.pages.push(rec);
        const n = rec.violations.reduce((s, v) => s + (v.impact === 'critical' || v.impact === 'serious' ? 1 : 0), 0);
        console.error(`[wcag] ${route} @${width} · ${rec.violations.length} rules (${n} crit/serious)${rec.navError ? ' NAV-ERR ' + rec.navError : ''}`);
      }
    }
    if (HAS_ENV) {
      seed = await makeSeed();
      report.appAudited = true;
      const appRoutes = [...APP_ROUTES, `/artifact?id=${seed.artifactId}`];
      for (const route of appRoutes) {
        for (const width of WIDTHS) {
          const rec = await auditRoute(browser, route, { width, session: seed });
          rec.app = true;
          report.pages.push(rec);
          const n = rec.violations.reduce((s, v) => s + (v.impact === 'critical' || v.impact === 'serious' ? 1 : 0), 0);
          console.error(`[wcag·app] ${route} @${width} · ${rec.violations.length} rules (${n} crit/serious)${rec.navError ? ' NAV-ERR ' + rec.navError : ''}`);
        }
      }
    } else {
      console.error('[wcag] no env. app half skipped');
    }
  } finally {
    if (seed) report.teardown = { debris_free: await teardownSeed(seed) };
    await browser.close().catch(() => {});
  }

  // Dedupe by rule id across the whole surface; bucket by worst impact.
  const byRule = {};
  for (const p of report.pages) {
    for (const v of p.violations) {
      const k = v.id;
      byRule[k] = byRule[k] || { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, pages: new Set(), totalNodes: 0 };
      byRule[k].pages.add(`${p.route}@${p.width}`);
      byRule[k].totalNodes += v.nodeCount;
      const rank = { critical: 4, serious: 3, moderate: 2, minor: 1 };
      if ((rank[v.impact] || 0) > (rank[byRule[k].impact] || 0)) byRule[k].impact = v.impact;
    }
  }
  const rules = Object.values(byRule).map(r => ({ ...r, pages: [...r.pages].sort(), pageCount: r.pages.size }))
    .sort((a, b) => ({ critical: 4, serious: 3, moderate: 2, minor: 1 }[b.impact] - { critical: 4, serious: 3, moderate: 2, minor: 1 }[a.impact]) || b.totalNodes - a.totalNodes);
  report.summary = {
    pagesAudited: report.pages.length,
    navErrors: report.pages.filter(p => p.navError).length,
    blocking: rules.filter(r => r.impact === 'critical' || r.impact === 'serious'),
    advisory: rules.filter(r => r.impact === 'moderate' || r.impact === 'minor'),
    blockingCount: rules.filter(r => r.impact === 'critical' || r.impact === 'serious').length,
    advisoryCount: rules.filter(r => r.impact === 'moderate' || r.impact === 'minor').length,
  };
  report.pass = report.summary.blockingCount === 0 && report.summary.navErrors === 0;
  report.completed_at = new Date().toISOString();
  fs.mkdirSync('chapter-07/qa/wcag', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.error(`\n=== WCAG SUMMARY ===`);
  console.error(`pages audited: ${report.summary.pagesAudited} · nav errors: ${report.summary.navErrors}`);
  console.error(`BLOCKING rules (critical/serious): ${report.summary.blockingCount}`);
  for (const r of report.summary.blocking) console.error(`  [${r.impact}] ${r.id} · ${r.totalNodes} nodes on ${r.pageCount} views · ${r.help}`);
  console.error(`ADVISORY rules (moderate/minor): ${report.summary.advisoryCount}`);
  for (const r of report.summary.advisory) console.error(`  [${r.impact}] ${r.id} · ${r.totalNodes} nodes on ${r.pageCount} views`);
  console.error(`\nreport -> ${OUT}`);
  process.exit(report.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
