/* Chapter 7 close · Whole-system E2E + visual proof
 *
 * One QA founder walks the ENTIRE system in phase order, all seventeen
 * production agents generating for real. The QBP is the only fixture:
 * Phase 01 generates from it, and every later phase reads the REAL
 * delivered artifacts of the phases before it. Each delivered artifact
 * is then rendered through the deployed production reading surface
 * (artifact.html + qb-artifact-renderer.js) in headless Chromium at
 * 390px and 1280px, full-page screenshots landing in
 * chapter-07/qa/reading-surface/.
 *
 * INVARIANTS:
 *   1. All 17 agents dispatch 202 and settle delivered (no failed, no
 *      timeout), phase by phase: 01 (4) → 02 (3, logo evaluation with a
 *      real uploaded mark) → 03 (5) → 04 (2) → 05 (3).
 *   2. Every delivered artifact renders on the production reading
 *      surface (the .qb-rs-title selector appears) at both widths.
 *   3. Per-agent duration_ms recorded from agent_runs (the run handler's
 *      own wall clock) before teardown.
 *   4. Teardown debris-free: auth user, profiles, artifacts,
 *      dispatch_jobs, agent_runs, storage objects all gone.
 *
 * Usage: node tests/chapter-07/whole-system-e2e.mjs
 * Env: .env.qb-branos.live or QB_ENV_FILE.
 */

import fs from 'node:fs';
import { chromium } from 'playwright';

const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const LOGO_FIXTURE = 'img/brand/mark-app-icon-1024.png';
const OUT_DIR = 'chapter-07/qa/reading-surface';
const POLL_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 4_000;
const WIDTHS = [{ label: '390', w: 390 }, { label: '1280', w: 1280 }];

const fileEnv = fs.existsSync(ENV_PATH)
  ? Object.fromEntries(fs.readFileSync(ENV_PATH, 'utf8').split('\n')
      .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]]))
  : {};
const env = { ...process.env, ...fileEnv };
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY, AK = env.SUPABASE_ANON_KEY;
if (!SU || !SK || !AK) { console.error('MISSING ENV'); process.exit(2); }
const svc = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' };
const uuid = () => crypto.randomUUID();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function must(r, what) { if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`); return r; }

const QBP = {
  brandName: 'Steadfield', brandEssence: 'Patient growth, measured in seasons.',
  archetypePrimary: 'Sage', archetypeSecondary: 'Creator',
  archetypeVisualImplications: 'Calm authority. Generous whitespace. Editorial restraint.',
  colorTerritory: 'warm earth tones, deep green anchors', forbiddenColor: 'neon purple',
  visualTerritoryNote: 'Looks like a well-set field guide, not a startup deck.',
  typographyNote: 'Serif display with quiet humanist body.', antiVoice: 'No hype. No buzzwords.',
  antiBrand: 'Hustle-culture productivity apps.', paradox: 'Ancient patience, modern tools.',
  alwaysNever: 'Always plain. Never loud.',
  audienceLanguage: 'They say "compounding", "the long game", "in season".',
  audienceDesires: 'To build something that outlasts the quarter.',
  audienceFears: 'That patience reads as standing still.',
  manifesto: 'We grow things that take time.',
  spark: 'A field guide for founders who refuse the sprint.',
};
const SOURCE_PIECE = 'Patience is not the absence of speed. It is the presence of direction.\n\nThings that compound do not announce themselves. They accrue.\n\nIf you are building something that outlasts the quarter, the work is to keep knowing it when the chart looks flat.';
const PERF_DATA = 'PERIOD: June 2026. LinkedIn: 9 posts, the "Patience is direction" essay took 41 reactions and 12 founder replies; two trend posts stalled under 5. Newsletter: 4 issues, 52% open, one long reply thread on pricing. Instagram: saves outperform likes on field-notes carousels. Long plain posts carry; loud hooks stall.';
const QUARTER_DATA = 'QUARTER: Q2 2026. Produced 24 LinkedIn posts, 12 newsletter issues, 14 Instagram posts. Top: seasons essays, field-notes carousels. Lowest: trend-reactive posts. Newsletter 340 to 610. Business: 3 consulting inquiries, 1 closed. Depth beat frequency; the daily cadence broke twice. The voice settled. Next goal: first paid product.';
const LAUNCH_CONCEPT = 'Launching: the Steadfield Field Guide, a paid digital guide. Price: 49 dollars one-time. Channel: the newsletter first, then LinkedIn. Competition: generic productivity courses at 99 to 299 dollars. Audience: 610 newsletter readers, mostly patient-growth founders.';

// Phase order · every later stage reads the REAL artifacts of the earlier ones.
const STAGES = [
  { phase: '01', agents: [
    { slug: 'soul_map_synthesizer' },
    { slug: 'sensescape_synthesizer' },
    { slug: 'visual_dna_synthesizer' },
    { slug: 'war_table_synthesizer' },
  ]},
  { phase: '02', agents: [
    { slug: 'logo_direction_agent' },
    { slug: 'voice_guide_agent' },
    { slug: 'logo_evaluation_agent', needsLogo: true },
  ]},
  { phase: '03', agents: [
    { slug: 'newsletter_architecture_agent' },
    { slug: 'linkedin_strategy_agent' },
    { slug: 'instagram_seed_agent' },
    { slug: 'youtube_strategy_agent' },
    { slug: 'content_bridge_agent', extra: { source_content: SOURCE_PIECE, target_platform: 'Canva' } },
  ]},
  { phase: '04', agents: [
    { slug: 'content_repurposing_agent', extra: { source_content: SOURCE_PIECE } },
    { slug: 'content_scheduler_agent' },
  ]},
  { phase: '05', agents: [
    { slug: 'brand_performance_agent', extra: { source_content: PERF_DATA } },
    { slug: 'quarterly_review_agent', extra: { source_content: QUARTER_DATA } },
    { slug: 'predictive_panel_agent', extra: { source_content: LAUNCH_CONCEPT } },
  ]},
];

async function makeUser() {
  const email = `qb-e2e-${uuid().slice(0, 8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier: 'pro', qbp: QBP }) }), 'profile');
  const tok = await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json();
  return { id: u.id, email, token: tok.access_token, refreshToken: tok.refresh_token };
}
async function uploadLogo(user) {
  const objPath = `${user.id}/${uuid()}.png`;
  await must(await fetch(`${SU}/storage/v1/object/user-uploads/${objPath}`, { method: 'POST', headers: { Authorization: `Bearer ${user.token}`, apikey: AK, 'Content-Type': 'image/png' }, body: fs.readFileSync(LOGO_FIXTURE) }), 'upload');
  return objPath;
}
async function dispatch(user, agent, extra = {}) {
  const r = await fetch(`${BASE}/api/agents/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ agent_slug: agent, ...extra }) });
  return { http: r.status, body: await r.json().catch(() => ({})) };
}
async function pollStatus(artifactId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const rows = await (await fetch(`${SU}/rest/v1/artifacts?id=eq.${artifactId}&select=status`, { headers: svc })).json();
    const s = rows?.[0]?.status;
    if (s === 'delivered' || s === 'failed') return s;
    await sleep(POLL_INTERVAL_MS);
  }
  return 'timeout';
}
async function teardown(user) {
  const list = await (await fetch(`${SU}/storage/v1/object/list/user-uploads`, { method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 50 }) })).json();
  for (const o of (Array.isArray(list) ? list : [])) await fetch(`${SU}/storage/v1/object/user-uploads/${user.id}/${o.name}`, { method: 'DELETE', headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
  await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/dispatch_jobs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
  const arts = await (await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}&select=id`, { headers: svc })).json();
  const objs = await (await fetch(`${SU}/storage/v1/object/list/user-uploads`, { method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 10 }) })).json();
  const gone = !(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { headers: svc })).ok;
  return (Array.isArray(arts) ? arts.length === 0 : false) && (Array.isArray(objs) ? objs.length === 0 : false) && gone;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = { harness: 'whole-system-e2e', started_at: new Date().toISOString(), base_url: BASE, stages: {}, screenshots: {} };
  let user = null, browser = null;
  const ids = {};
  try {
    user = await makeUser();
    out.seed_identity = user.email;
    const logoPath = await uploadLogo(user);
    const t0 = Date.now();

    for (const stage of STAGES) {
      const st = Date.now();
      const dispatched = [];
      for (const a of stage.agents) {
        const extra = { ...(a.extra || {}) };
        if (a.needsLogo) extra.files = [{ path: logoPath, type: 'logo-image' }];
        const d = await dispatch(user, a.slug, extra);
        if (d.http !== 202 || !d.body?.artifact_id) throw new Error(`dispatch ${a.slug} failed: ${d.http} ${JSON.stringify(d.body).slice(0, 200)}`);
        ids[a.slug] = d.body.artifact_id;
        dispatched.push(a.slug);
        console.error(`[phase ${stage.phase}] dispatch ${a.slug} -> 202`);
      }
      const settled = {};
      await Promise.all(dispatched.map(async slug => { settled[slug] = await pollStatus(ids[slug]); console.error(`[phase ${stage.phase}] ${slug} -> ${settled[slug]}`); }));
      out.stages[stage.phase] = { agents: settled, wall_ms: Date.now() - st };
      const bad = Object.entries(settled).filter(([, s]) => s !== 'delivered');
      if (bad.length) {
        // Capture forensics BEFORE the finally-block teardown erases them.
        const failedRuns = await (await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}&status=eq.failed&select=agent_slug,error_payload`, { headers: svc })).json().catch(() => []);
        out.failures = failedRuns;
        throw new Error(`phase ${stage.phase} not fully delivered: ${JSON.stringify(bad)}`);
      }
    }
    out.total_generation_wall_ms = Date.now() - t0;

    // Per-agent runtime wall clocks, recorded before teardown.
    const runs = await (await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}&select=agent_slug,status,duration_ms&order=agent_slug`, { headers: svc })).json();
    out.agent_durations_ms = Object.fromEntries((runs || []).map(r => [r.agent_slug, r.duration_ms]));

    // Visual proof through the deployed reading surface.
    browser = await chromium.launch({ headless: true });
    const sessionJson = JSON.stringify({ token: user.token, userId: user.id, refreshToken: user.refreshToken });
    for (const [slug, artifactId] of Object.entries(ids)) {
      for (const { label, w } of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
        await ctx.addInitScript(s => { try { localStorage.setItem('qb_session', s); } catch (e) {} }, sessionJson);
        const page = await ctx.newPage();
        let ok = false, err = null;
        try {
          await page.goto(`${BASE}/artifact?id=${artifactId}`, { waitUntil: 'networkidle', timeout: 60_000 });
          await page.waitForSelector('.qb-rs-title', { timeout: 45_000 });
          await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
          await sleep(700);
          ok = true;
        } catch (e) { err = String(e?.message || e).slice(0, 160); }
        const file = `${OUT_DIR}/${slug.replace(/_agent$|_synthesizer$/, '')}-${label}.png`;
        await page.screenshot({ path: file, fullPage: true }).catch(e => { err = (err || '') + ' shot:' + e.message; });
        out.screenshots[`${slug}-${label}`] = { ok, file, err };
        console.error(`[shot] ${slug} @${label} ${ok ? 'OK' : 'ERR ' + err}`);
        await ctx.close();
      }
    }
  } catch (e) {
    out.failure_reason = String(e?.message || e);
    console.error('FAILURE', out.failure_reason);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (user) out.teardown = { debris_free: await teardown(user) };
  }

  const allDelivered = Object.values(out.stages).length === 5
    && Object.values(out.stages).every(s => Object.values(s.agents).every(v => v === 'delivered'));
  const allShots = Object.values(out.screenshots).length === 34
    && Object.values(out.screenshots).every(s => s.ok);
  out.pass = !out.failure_reason && allDelivered && allShots && out.teardown?.debris_free === true;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-07/whole-system-e2e.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
