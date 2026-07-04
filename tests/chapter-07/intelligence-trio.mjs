/* Chapter 7 · Steps 1-3 · Phase 05 intelligence trio harness
 *
 * INVARIANTS:
 *   1. HAPPY x3, CONCURRENT: one Pro founder with the delivered Phase 01
 *      foundation fires brand_performance_agent (with pasted performance
 *      data), quarterly_review_agent (with the pasted quarter), and
 *      predictive_panel_agent (with the pasted launch concept) at once.
 *      All three settle delivered with their block contracts:
 *      Performance = spec_grid (5 scores) + content_pack (4+ signals) +
 *      spec_grid + numbered_procedure (5 steps); Quarterly = spec_grid
 *      (5 grades) + content_pack + always_never + content_pack (8+
 *      initiatives) + spec_grid (6 direction entries); Predictive =
 *      spec_grid (6 reads) + content_pack (4+ scenarios) + content_pack
 *      + descriptor_list (2 groups) + numbered_procedure (6+ checks).
 *   2. TIER GATE (performance): STARTER founder 403, zero rows. Starter
 *      is the strongest insufficient tier, so this proves the pro gate
 *      specifically, not merely the free gate.
 *   3. CROSS-PHASE DEP (predictive): pro founder without war_table gets
 *      422 naming war_table_synthesizer, zero rows.
 *   4. Teardown debris-free.
 *
 * Usage: node tests/chapter-07/intelligence-trio.mjs
 * Env: .env.qb-branos.live or QB_ENV_FILE.
 */

import fs from 'node:fs';

const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const POLL_TIMEOUT_MS = 210_000;
const POLL_INTERVAL_MS = 4_000;

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
  archetypePrimary: 'Sage', antiVoice: 'No hype. No buzzwords.',
  antiBrand: 'Hustle-culture productivity apps.', alwaysNever: 'Always plain. Never loud.',
  audienceLanguage: 'They say "compounding", "the long game", "in season".',
  audienceDesires: 'To build something that outlasts the quarter.',
  audienceFears: 'That patience reads as standing still.',
  manifesto: 'We grow things that take time.',
  colorTerritory: 'warm earth tones, deep green anchors',
  paradox: 'Ancient patience, modern tools.',
};
const PERF_DATA = 'PERIOD: June 2026.\nLinkedIn: 9 posts. Top: "Patience is direction" essay, 41 reactions, 12 replies from founders. Low: two reactive trend posts, under 5 reactions each. Newsletter: 4 issues, open rate 52%, one reply thread on pricing. Instagram: 6 posts, saves outperform likes on the field-notes carousels. Observation: long, plain posts carry; loud hooks stall.';
const QUARTER_DATA = 'QUARTER: Q2 2026.\nProduced: 24 LinkedIn posts, 12 newsletter issues, 14 Instagram posts. Top performers: the seasons essays and the field-notes carousels. Lowest: trend-reactive posts. Key metric: newsletter grew 340 to 610. Business: 3 consulting inquiries, 1 closed. What worked: plain long-form. What did not: daily cadence, broke twice. Biggest lesson: depth beats frequency. Feeling: the voice settled. Next goal: first paid product.';
const LAUNCH_CONCEPT = 'Launching: the Steadfield Field Guide, a paid digital guide. Price: 49 dollars one-time. Channel: the newsletter first, then LinkedIn. Competition: generic productivity courses at 99 to 299 dollars. Context: audience of 610 newsletter readers, mostly patient-growth founders.';
const mk = (eyebrow, title, agent, heading, prose) => ({ schema_version: '1.0', header: { eyebrow, title, agent, generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading, prose }], data_blocks: [], footer: { qbp_fields_referenced: ['brandName'] } });
const SOUL_MAP = mk('01 Discovery · Soul Map', 'The Soul of Steadfield', 'soul_map_synthesizer', 'Essence', 'Steadfield grows things that take time.\n\nPrecise, warm, unhurried.');
const WAR_TABLE = mk('01 Discovery · War Table', 'The War Table for Steadfield', 'war_table_synthesizer', 'The audience', 'They measure in seasons, not sprints.\n\nThey read early on weekdays and fear patience looks like standing still.');

async function makeUser(tier) {
  const email = `qb-ch7s13-${uuid().slice(0, 8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier, qbp: QBP }) }), 'profile');
  const tok = (await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json()).access_token;
  return { id: u.id, token: tok };
}
async function insertDelivered(userId, type, content, phase) {
  await must(await fetch(`${SU}/rest/v1/artifacts`, { method: 'POST', headers: { ...svc, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, artifact_type: type, status: 'delivered', version: 1, phase, content }) }), `insert ${type}`);
}
async function dispatch(user, agent, extra = {}) {
  const r = await fetch(`${BASE}/api/agents/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ agent_slug: agent, ...extra }) });
  return { http: r.status, body: await r.json().catch(() => ({})) };
}
async function pollDelivered(artifactId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const rows = await (await fetch(`${SU}/rest/v1/artifacts?id=eq.${artifactId}&select=status,content`, { headers: svc })).json();
    const row = rows?.[0];
    if (row && (row.status === 'delivered' || row.status === 'failed')) return row;
    await sleep(POLL_INTERVAL_MS);
  }
  return { status: 'timeout', content: {} };
}
async function countRows(userId, agent) {
  const arts = await (await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${userId}&artifact_type=eq.${agent}&select=id`, { headers: svc })).json();
  const djs = await (await fetch(`${SU}/rest/v1/dispatch_jobs?user_id=eq.${userId}&kind=eq.manual&select=id`, { headers: svc })).json();
  return { artifacts: arts?.length ?? -1, dispatch_jobs: djs?.length ?? -1 };
}
async function teardownUser(user) {
  await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/dispatch_jobs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
  const arts = await (await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}&select=id`, { headers: svc })).json();
  const gone = !(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { headers: svc })).ok;
  return (Array.isArray(arts) ? arts.length === 0 : false) && gone;
}
const blocksOf = row => (row.content?.data_blocks || []);
const firstBlock = (row, type, title) => blocksOf(row).find(b => b.type === type && (!title || b.title === title));

async function main() {
  const out = { harness: 'intelligence-trio', started_at: new Date().toISOString(), base_url: BASE };
  let pro = null, starter = null, noWarTable = null;
  try {
    // ── 1. HAPPY x3 concurrent ────────────────────────────────────────────
    pro = await makeUser('pro');
    await insertDelivered(pro.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    await insertDelivered(pro.id, 'war_table_synthesizer', WAR_TABLE, '01');
    const t0 = Date.now();
    const [bp, qr, pp] = await Promise.all([
      dispatch(pro, 'brand_performance_agent', { source_content: PERF_DATA }),
      dispatch(pro, 'quarterly_review_agent', { source_content: QUARTER_DATA }),
      dispatch(pro, 'predictive_panel_agent', { source_content: LAUNCH_CONCEPT }),
    ]);
    out.dispatch = { performance: bp.http, quarterly: qr.http, predictive: pp.http };
    if (bp.http !== 202 || qr.http !== 202 || pp.http !== 202) throw new Error(`dispatch failed: bp=${bp.http} qr=${qr.http} pp=${pp.http} ${JSON.stringify(bp.body).slice(0,120)} ${JSON.stringify(qr.body).slice(0,120)} ${JSON.stringify(pp.body).slice(0,120)}`);
    const [bpRow, qrRow, ppRow] = await Promise.all([
      pollDelivered(bp.body.artifact_id),
      pollDelivered(qr.body.artifact_id),
      pollDelivered(pp.body.artifact_id),
    ]);
    const wall = Date.now() - t0;

    const bpScores = firstBlock(bpRow, 'spec_grid', 'Health scores')?.content?.specs || [];
    const bpSignals = firstBlock(bpRow, 'content_pack', 'The signals')?.content?.items || [];
    const bpSteps = firstBlock(bpRow, 'numbered_procedure')?.content?.steps || [];
    out.happy = { wall_ms: wall };
    out.happy.performance = {
      status: bpRow.status, title: bpRow.content?.header?.title || null,
      scores: bpScores.length, signals: bpSignals.length, steps: bpSteps.length,
      delivered: bpRow.status === 'delivered' && bpScores.length === 5 && bpSignals.length >= 4 && bpSteps.length === 5,
    };
    const qrTypes = blocksOf(qrRow).map(b => b.type);
    const qrGrades = firstBlock(qrRow, 'spec_grid', "The quarter's grades")?.content?.specs || [];
    const qrInitiatives = firstBlock(qrRow, 'content_pack', 'Q+1 initiatives')?.content?.items || [];
    const qrDirection = firstBlock(qrRow, 'spec_grid', 'The Q+1 direction')?.content?.specs || [];
    out.happy.quarterly = {
      status: qrRow.status, title: qrRow.content?.header?.title || null,
      grades: qrGrades.length, initiatives: qrInitiatives.length, direction: qrDirection.length,
      has_always_never: qrTypes.includes('always_never'),
      delivered: qrRow.status === 'delivered' && qrGrades.length === 5 && qrInitiatives.length >= 8 && qrDirection.length === 6 && qrTypes.includes('always_never'),
    };
    const ppRead = firstBlock(ppRow, 'spec_grid', "The panel's read")?.content?.specs || [];
    const ppScenarios = firstBlock(ppRow, 'content_pack', 'The scenarios')?.content?.items || [];
    const ppGroups = firstBlock(ppRow, 'descriptor_list')?.content?.groups || [];
    const ppReadiness = firstBlock(ppRow, 'numbered_procedure')?.content?.steps || [];
    out.happy.predictive = {
      status: ppRow.status, title: ppRow.content?.header?.title || null,
      reads: ppRead.length, scenarios: ppScenarios.length, groups: ppGroups.length, readiness: ppReadiness.length,
      delivered: ppRow.status === 'delivered' && ppRead.length === 6 && ppScenarios.length >= 4 && ppGroups.length === 2 && ppReadiness.length >= 6,
    };
    console.error(`[happy] wall=${wall}ms bp=${bpRow.status}(signals=${bpSignals.length}) qr=${qrRow.status}(initiatives=${qrInitiatives.length}) pp=${ppRow.status}(scenarios=${ppScenarios.length})`);

    // ── 2. TIER GATE (performance, starter is insufficient for pro) ─────
    starter = await makeUser('starter');
    const gate = await dispatch(starter, 'brand_performance_agent', { source_content: PERF_DATA });
    const stCounts = await countRows(starter.id, 'brand_performance_agent');
    out.tier_gate = { http: gate.http, rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient', no_rows: stCounts.artifacts === 0 && stCounts.dispatch_jobs === 0 };
    console.error(`[tier] http=${gate.http}`);

    // ── 3. CROSS-PHASE DEP (predictive, no war table) ────────────────────
    noWarTable = await makeUser('pro');
    await insertDelivered(noWarTable.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    const dep = await dispatch(noWarTable, 'predictive_panel_agent', { source_content: LAUNCH_CONCEPT });
    const nwCounts = await countRows(noWarTable.id, 'predictive_panel_agent');
    out.cross_phase_dependency = {
      http: dep.http, missing_slug: dep.body?.missing_slug,
      named_422: dep.http === 422 && dep.body?.error === 'missing_dependency' && dep.body?.missing_slug === 'war_table_synthesizer',
      no_rows: nwCounts.artifacts === 0 && nwCounts.dispatch_jobs === 0,
    };
    console.error(`[cross-phase-dep] http=${dep.http} missing=${dep.body?.missing_slug}`);
  } catch (e) {
    out.failure_reason = String(e?.message || e);
    console.error('FAILURE', out.failure_reason);
  } finally {
    const td = [];
    for (const u of [pro, starter, noWarTable]) if (u) td.push(await teardownUser(u));
    out.teardown = { users: td.length, debris_free: td.every(Boolean) };
  }

  out.pass = !out.failure_reason
    && out.happy?.performance?.delivered
    && out.happy?.quarterly?.delivered
    && out.happy?.predictive?.delivered
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows
    && out.cross_phase_dependency?.named_422 && out.cross_phase_dependency?.no_rows
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-07/intelligence-trio.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
