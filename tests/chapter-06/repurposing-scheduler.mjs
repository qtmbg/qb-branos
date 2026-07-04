/* Chapter 6 · Steps 1-2 · Content Repurposing + Content Scheduler harness
 *
 * INVARIANTS:
 *   1. HAPPY x2, CONCURRENT: one Starter founder with the delivered
 *      foundation (soul map, war table, voice guide) fires
 *      content_repurposing_agent (heavy, with runtime source_content
 *      through the dispatch extension) and content_scheduler_agent
 *      (standard) at once. Both settle delivered: Repurposing =
 *      content_pack with the six fixed surface kickers + always_never,
 *      and at least one derivative reflows the pasted source; Scheduler =
 *      spec_grid (4-12 cadence entries) + content_pack (10-14 slots) +
 *      numbered_procedure (5+ routine steps).
 *   2. TIER GATE (repurposing): free founder 403, zero rows.
 *   3. CROSS-PHASE DEP (scheduler): starter without war_table gets 422
 *      naming war_table_synthesizer, zero rows.
 *   4. Teardown debris-free.
 *
 * Usage: node tests/chapter-06/repurposing-scheduler.mjs
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
const SOURCE_PIECE = 'Patience is not the absence of speed. It is the presence of direction.\n\nEvery quarter we are asked why we are not louder. The answer is in the fields we tend: things that compound do not announce themselves. They accrue.\n\nIf you are building something that outlasts the quarter, you already know this. The work is to keep knowing it when the chart looks flat.';
const SURFACE_KICKERS = ['LinkedIn post', 'Instagram caption', 'X thread opener', 'Newsletter section', 'YouTube community post', 'Short-form script'];
const mk = (eyebrow, title, agent, heading, prose) => ({ schema_version: '1.0', header: { eyebrow, title, agent, generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading, prose }], data_blocks: [], footer: { qbp_fields_referenced: ['brandName'] } });
const SOUL_MAP = mk('01 Discovery · Soul Map', 'The Soul of Steadfield', 'soul_map_synthesizer', 'Essence', 'Steadfield grows things that take time.\n\nPrecise, warm, unhurried.');
const WAR_TABLE = mk('01 Discovery · War Table', 'The War Table for Steadfield', 'war_table_synthesizer', 'The audience', 'They measure in seasons, not sprints.\n\nThey read early on weekdays and fear patience looks like standing still.');
const VOICE_GUIDE = mk('02 Brand Creation · Voice Guide', 'How Steadfield Speaks', 'voice_guide_agent', 'The register', 'Calm sentences that finish. Field-guide warmth, no hype.\n\nShort words where they serve.');

async function makeUser(tier) {
  const email = `qb-ch6s12-${uuid().slice(0, 8)}@qb-harness.test`;
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

async function main() {
  const out = { harness: 'repurposing-scheduler', started_at: new Date().toISOString(), base_url: BASE };
  let starter = null, free = null, noWarTable = null;
  try {
    // ── 1. HAPPY x2 concurrent ────────────────────────────────────────────
    starter = await makeUser('starter');
    await insertDelivered(starter.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    await insertDelivered(starter.id, 'war_table_synthesizer', WAR_TABLE, '01');
    await insertDelivered(starter.id, 'voice_guide_agent', VOICE_GUIDE, '02');
    const t0 = Date.now();
    const [rp, sc] = await Promise.all([
      dispatch(starter, 'content_repurposing_agent', { source_content: SOURCE_PIECE }),
      dispatch(starter, 'content_scheduler_agent'),
    ]);
    out.dispatch = { repurposing: rp.http, scheduler: sc.http };
    if (rp.http !== 202 || sc.http !== 202) throw new Error(`dispatch failed: rp=${rp.http} sc=${sc.http} ${JSON.stringify(rp.body).slice(0,120)} ${JSON.stringify(sc.body).slice(0,120)}`);
    const [rpRow, scRow] = await Promise.all([
      pollDelivered(rp.body.artifact_id),
      pollDelivered(sc.body.artifact_id),
    ]);
    const wall = Date.now() - t0;
    const rpPack = (rpRow.content?.data_blocks || []).find(b => b.type === 'content_pack');
    const rpItems = rpPack?.content?.items || [];
    const rpKickers = rpItems.map(it => it.kicker);
    const scBlocks = (scRow.content?.data_blocks || []).map(b => b.type);
    const scCadence = scRow.content?.data_blocks?.find(b => b.type === 'spec_grid')?.content?.specs || [];
    const scSlots = scRow.content?.data_blocks?.find(b => b.type === 'content_pack')?.content?.items || [];
    const scRoutine = scRow.content?.data_blocks?.find(b => b.type === 'numbered_procedure')?.content?.steps || [];
    out.happy = {
      wall_ms: wall,
      repurposing: {
        status: rpRow.status, title: rpRow.content?.header?.title || null,
        derivatives: rpItems.length,
        kickers_fixed_six: SURFACE_KICKERS.every(k => rpKickers.includes(k)),
        reflows_source: rpItems.some(it => (it.body || '').toLowerCase().includes('patience')),
        has_always_never: (rpRow.content?.data_blocks || []).some(b => b.type === 'always_never'),
        delivered: rpRow.status === 'delivered' && rpItems.length === 6,
      },
      scheduler: {
        status: scRow.status, title: scRow.content?.header?.title || null,
        blocks: scBlocks, cadence_entries: scCadence.length, slots: scSlots.length, routine_steps: scRoutine.length,
        delivered: scRow.status === 'delivered' && ['spec_grid', 'content_pack', 'numbered_procedure'].every(t => scBlocks.includes(t)),
      },
    };
    console.error(`[happy] wall=${wall}ms rp=${rpRow.status}(derivatives=${rpItems.length}, reflow=${out.happy.repurposing.reflows_source}) sc=${scRow.status}(slots=${scSlots.length}, routine=${scRoutine.length})`);

    // ── 2. TIER GATE (repurposing) ───────────────────────────────────────
    free = await makeUser('free');
    const gate = await dispatch(free, 'content_repurposing_agent', { source_content: SOURCE_PIECE });
    const freeCounts = await countRows(free.id, 'content_repurposing_agent');
    out.tier_gate = { http: gate.http, rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient', no_rows: freeCounts.artifacts === 0 && freeCounts.dispatch_jobs === 0 };
    console.error(`[tier] http=${gate.http}`);

    // ── 3. CROSS-PHASE DEP (scheduler, no war table) ─────────────────────
    noWarTable = await makeUser('starter');
    await insertDelivered(noWarTable.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    const dep = await dispatch(noWarTable, 'content_scheduler_agent');
    const nwCounts = await countRows(noWarTable.id, 'content_scheduler_agent');
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
    for (const u of [starter, free, noWarTable]) if (u) td.push(await teardownUser(u));
    out.teardown = { users: td.length, debris_free: td.every(Boolean) };
  }

  out.pass = !out.failure_reason
    && out.happy?.repurposing?.delivered && out.happy?.repurposing?.kickers_fixed_six && out.happy?.repurposing?.reflows_source && out.happy?.repurposing?.has_always_never
    && out.happy?.scheduler?.delivered && out.happy.scheduler.cadence_entries >= 4 && out.happy.scheduler.slots >= 10 && out.happy.scheduler.slots <= 14 && out.happy.scheduler.routine_steps >= 5
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows
    && out.cross_phase_dependency?.named_422 && out.cross_phase_dependency?.no_rows
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-06/repurposing-scheduler.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
