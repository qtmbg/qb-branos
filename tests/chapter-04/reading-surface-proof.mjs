/* Chapter 4 -> 5 gate · Reading-surface visual proof
 *
 * Seeds a clearly-marked QA identity, dispatches all three Phase 02 agents
 * through the production founder dispatch entry (REAL generated content, not
 * fixtures), then renders each delivered artifact through the ACTUAL
 * production reading surface (https://quantumbranding.ai/artifact?id=...,
 * the deployed artifact.html + js/qb-artifact-renderer.js) in headless
 * Chromium, at mobile (390px) and desktop (1280px) widths. Six full-page
 * screenshots land in chapter-04/qa/reading-surface/. The seed identity is
 * torn down and debris is asserted.
 *
 * The three dependency artifacts are seeded fixtures (they are INPUTS the
 * agents read); the three Phase 02 OUTPUTS are real model generations.
 *
 * Usage: node tests/chapter-04/reading-surface-proof.mjs
 * Env: .env.qb-branos.live (repo root, gitignored) or QB_ENV_FILE.
 */

import fs from 'node:fs';
import { chromium } from 'playwright';

const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const LOGO_FIXTURE = 'img/brand/mark-app-icon-1024.png';
const OUT_DIR = 'chapter-04/qa/reading-surface';
const POLL_TIMEOUT_MS = 150_000;
const POLL_INTERVAL_MS = 3_000;
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function must(r, what) { if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text().catch(()=> '')).slice(0,200)}`); return r; }

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
};
const SOUL_MAP = { schema_version: '1.0', header: { eyebrow: '01 Discovery · Soul Map', title: 'The Soul of Steadfield', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading: 'Essence', prose: 'Steadfield grows things that take time.\n\nIt speaks like a field guide: precise, warm, unhurried.' }], data_blocks: [], footer: { qbp_fields_referenced: ['brandName'] } };
const VISUAL_DNA = { schema_version: '1.0', header: { eyebrow: '01 Discovery · Visual DNA', title: 'The Visual Language of Steadfield', agent: 'visual_dna_synthesizer', generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading: 'The color system', prose: 'Deep field green anchors the system; warm parchment carries it.\n\nThe forbidden neon purple stays forbidden.' }], data_blocks: [{ type: 'palette', title: 'Color system', content: { swatches: [ { label: 'Primary', hex: '#1F5B47', rationale: 'Field green.' }, { label: 'Secondary', hex: '#EFE6D5', rationale: 'Parchment.' }, { label: 'Accent', hex: '#C97B3D', rationale: 'Ochre.' }, { label: 'Neutral', hex: '#2D2A26', rationale: 'Soil ink.' } ] } }], footer: { qbp_fields_referenced: ['colorTerritory'] } };
const WAR_TABLE = { schema_version: '1.0', header: { eyebrow: '01 Discovery · War Table', title: 'The War Table for Steadfield', agent: 'war_table_synthesizer', generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading: 'The audience', prose: 'They measure in seasons, not sprints.\n\nThey fear that patience looks like standing still.' }], data_blocks: [{ type: 'priority_list', title: 'Top initiatives', content: { items: [{ label: 'Name the long game', detail: 'Borrow the reader own words for compounding.' }] } }], footer: { qbp_fields_referenced: ['audienceLanguage'] } };
const DEPS = {
  logo_direction_agent: { soul_map_synthesizer: SOUL_MAP, visual_dna_synthesizer: VISUAL_DNA },
  logo_evaluation_agent: { soul_map_synthesizer: SOUL_MAP, visual_dna_synthesizer: VISUAL_DNA },
  voice_guide_agent: { soul_map_synthesizer: SOUL_MAP, war_table_synthesizer: WAR_TABLE },
};
const NEEDS_FILE = new Set(['logo_evaluation_agent']);
const AGENTS = ['logo_direction_agent', 'logo_evaluation_agent', 'voice_guide_agent'];

async function makeUser() {
  const email = `qb-ch5gate-readingproof-${uuid().slice(0,8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier: 'starter', foundation_locked_at: new Date().toISOString(), qbp: QBP }) }), 'profile');
  const tok = await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json();
  return { id: u.id, email, token: tok.access_token, refreshToken: tok.refresh_token };
}
async function insertDelivered(userId, type, content) {
  await must(await fetch(`${SU}/rest/v1/artifacts`, { method: 'POST', headers: { ...svc, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, artifact_type: type, status: 'delivered', version: 1, phase: '01', content }) }), `insert ${type}`);
}
async function uploadLogo(user) {
  const objPath = `${user.id}/${uuid()}.png`;
  await must(await fetch(`${SU}/storage/v1/object/user-uploads/${objPath}`, { method: 'POST', headers: { Authorization: `Bearer ${user.token}`, apikey: AK, 'Content-Type': 'image/png' }, body: fs.readFileSync(LOGO_FIXTURE) }), 'upload');
  return objPath;
}
async function dispatch(user, agent, files) {
  const r = await fetch(`${BASE}/api/agents/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify(files ? { agent_slug: agent, files } : { agent_slug: agent }) });
  return { http: r.status, body: await r.json().catch(() => ({})) };
}
async function pollDelivered(artifactId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const rows = await (await fetch(`${SU}/rest/v1/artifacts?id=eq.${artifactId}&select=status`, { headers: svc })).json();
    const s = rows?.[0]?.status;
    if (s === 'delivered' || s === 'failed') return s;
    await sleep(POLL_INTERVAL_MS);
  }
  return 'timeout';
}
async function teardownUser(user) {
  await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(()=>{});
  await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/dispatch_jobs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  const list = await (await fetch(`${SU}/storage/v1/object/list/user-uploads`, { method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 50 }) })).json();
  for (const o of (Array.isArray(list) ? list : [])) await fetch(`${SU}/storage/v1/object/user-uploads/${user.id}/${o.name}`, { method: 'DELETE', headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
  await fetch(`${SU}/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(()=>{});
  await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
  const arts = await (await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}&select=id`, { headers: svc })).json();
  const objs = await (await fetch(`${SU}/storage/v1/object/list/user-uploads`, { method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 10 }) })).json();
  const gone = !(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { headers: svc })).ok;
  return (Array.isArray(arts) ? arts.length === 0 : false) && (Array.isArray(objs) ? objs.length === 0 : true) && gone;
}

async function main() {
  const out = { harness: 'reading-surface-proof', started_at: new Date().toISOString(), base_url: BASE, shots: [] };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let user = null, browser = null;
  try {
    user = await makeUser();
    out.seed_identity = user.email;
    for (const [type, content] of Object.entries({ soul_map_synthesizer: SOUL_MAP, visual_dna_synthesizer: VISUAL_DNA, war_table_synthesizer: WAR_TABLE })) {
      await insertDelivered(user.id, type, content);
    }
    const logoPath = await uploadLogo(user);

    // Dispatch all three (real production generations), collect artifact ids.
    const ids = {};
    for (const agent of AGENTS) {
      const files = NEEDS_FILE.has(agent) ? [{ path: logoPath, type: 'logo-image' }] : undefined;
      const d = await dispatch(user, agent, files);
      if (d.http !== 202 || !d.body?.artifact_id) throw new Error(`dispatch ${agent} failed: ${d.http} ${JSON.stringify(d.body).slice(0,200)}`);
      ids[agent] = d.body.artifact_id;
      console.error(`[dispatch] ${agent} -> 202 artifact=${d.body.artifact_id}`);
    }
    const settled = {};
    for (const agent of AGENTS) { settled[agent] = await pollDelivered(ids[agent]); console.error(`[settle] ${agent} -> ${settled[agent]}`); }
    out.delivered = settled;
    if (Object.values(settled).some(s => s !== 'delivered')) throw new Error(`not all delivered: ${JSON.stringify(settled)}`);

    // Render each through the live production reading surface.
    browser = await chromium.launch({ headless: true });
    const sessionJson = JSON.stringify({ token: user.token, userId: user.id, refreshToken: user.refreshToken });
    for (const agent of AGENTS) {
      for (const { label, w } of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900}, deviceScaleFactor: 2 });
        await ctx.addInitScript(s => { try { localStorage.setItem('qb_session', s); } catch (e) {} }, sessionJson);
        const page = await ctx.newPage();
        const url = `${BASE}/artifact?id=${ids[agent]}`;
        let ok = false, err = null;
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
          await page.waitForSelector('.qb-rs-title', { timeout: 45_000 });
          await page.evaluate(() => document.fonts && document.fonts.ready).catch(()=>{});
          await sleep(700); // settle reveal animations
          ok = true;
        } catch (e) { err = String(e?.message || e).slice(0, 160); }
        const file = `${OUT_DIR}/${agent.replace('_agent','')}-${label}.png`;
        await page.screenshot({ path: file, fullPage: true }).catch(e => { err = (err||'') + ' shot:' + e.message; });
        const title = await page.evaluate(() => document.querySelector('.qb-rs-title')?.textContent || null).catch(()=>null);
        out.shots.push({ agent, width: w, file, rendered: ok, title, err });
        console.error(`[shot] ${file} rendered=${ok} title=${JSON.stringify(title)} ${err?('err='+err):''}`);
        await ctx.close();
      }
    }
  } catch (e) {
    out.failure_reason = String(e?.message || e);
    console.error('FAILURE', out.failure_reason);
  } finally {
    if (browser) await browser.close().catch(()=>{});
    if (user) out.teardown_debris_free = await teardownUser(user);
  }
  out.pass = !out.failure_reason && out.shots.length === 6 && out.shots.every(s => s.rendered && s.title) && out.teardown_debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-04/reading-surface-proof.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
