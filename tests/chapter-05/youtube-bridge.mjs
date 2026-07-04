/* Chapter 5 · Steps 4-5 · YouTube Strategy + Content Bridge harness
 *
 * INVARIANTS:
 *   1. HAPPY x2, CONCURRENT: one Starter founder with the full delivered
 *      foundation fires youtube_strategy_agent (heavy) and
 *      content_bridge_agent (standard, with runtime source_content +
 *      target_platform through the dispatch extension) at once. Both
 *      settle delivered: YouTube = descriptor_list (3 series) +
 *      content_pack (3 episodes with cuts + repurpose extras) + spec_grid;
 *      Bridge = numbered_procedure + spec_grid + descriptor_list +
 *      always_never, and its formatted piece reflows the pasted source.
 *   2. TIER GATE (youtube): free founder 403, zero rows.
 *   3. CROSS-PHASE DEP (bridge): starter without voice_guide gets 422
 *      naming voice_guide_agent, zero rows.
 *   4. Teardown debris-free.
 *
 * Usage: node tests/chapter-05/youtube-bridge.mjs
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
const mk = (eyebrow, title, agent, heading, prose) => ({ schema_version: '1.0', header: { eyebrow, title, agent, generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading, prose }], data_blocks: [], footer: { qbp_fields_referenced: ['brandName'] } });
const SOUL_MAP = mk('01 Discovery · Soul Map', 'The Soul of Steadfield', 'soul_map_synthesizer', 'Essence', 'Steadfield grows things that take time.\n\nPrecise, warm, unhurried.');
const WAR_TABLE = mk('01 Discovery · War Table', 'The War Table for Steadfield', 'war_table_synthesizer', 'The audience', 'They measure in seasons, not sprints.\n\nThey fear patience looks like standing still.');
const VISUAL_DNA = mk('01 Discovery · Visual DNA', 'The Visual Language of Steadfield', 'visual_dna_synthesizer', 'The color system', 'Deep field green anchors; warm parchment carries.\n\nNeon purple stays forbidden.');
const VOICE_GUIDE = mk('02 Brand Creation · Voice Guide', 'How Steadfield Speaks', 'voice_guide_agent', 'The register', 'Calm sentences that finish. Field-guide warmth, no hype.\n\nShort words where they serve.');

async function makeUser(tier) {
  const email = `qb-ch5s45-${uuid().slice(0, 8)}@qb-harness.test`;
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
  const out = { harness: 'youtube-bridge', started_at: new Date().toISOString(), base_url: BASE };
  let starter = null, free = null, noVoice = null;
  try {
    // ── 1. HAPPY x2 concurrent ────────────────────────────────────────────
    starter = await makeUser('starter');
    await insertDelivered(starter.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    await insertDelivered(starter.id, 'war_table_synthesizer', WAR_TABLE, '01');
    await insertDelivered(starter.id, 'visual_dna_synthesizer', VISUAL_DNA, '01');
    await insertDelivered(starter.id, 'voice_guide_agent', VOICE_GUIDE, '02');
    const t0 = Date.now();
    const [yt, cb] = await Promise.all([
      dispatch(starter, 'youtube_strategy_agent'),
      dispatch(starter, 'content_bridge_agent', { source_content: SOURCE_PIECE, target_platform: 'Canva' }),
    ]);
    out.dispatch = { youtube: yt.http, bridge: cb.http };
    if (yt.http !== 202 || cb.http !== 202) throw new Error(`dispatch failed: yt=${yt.http} cb=${cb.http} ${JSON.stringify(yt.body).slice(0,120)} ${JSON.stringify(cb.body).slice(0,120)}`);
    const [ytRow, cbRow] = await Promise.all([
      pollDelivered(yt.body.artifact_id),
      pollDelivered(cb.body.artifact_id),
    ]);
    const wall = Date.now() - t0;
    const ytPack = (ytRow.content?.data_blocks || []).find(b => b.type === 'content_pack');
    const ytEpisodes = ytPack?.content?.items || [];
    const cbBlocks = (cbRow.content?.data_blocks || []).map(b => b.type);
    const cbSteps = cbRow.content?.data_blocks?.find(b => b.type === 'numbered_procedure')?.content?.steps || [];
    const cbFormatted = (cbRow.content?.body_sections || []).find(s => s.heading === 'The formatted piece')?.prose || '';
    out.happy = {
      wall_ms: wall,
      youtube: {
        status: ytRow.status, title: ytRow.content?.header?.title || null,
        episodes: ytEpisodes.length,
        episodes_have_extras: ytEpisodes.every(e => Array.isArray(e.extras) && e.extras.length >= 2),
        series_groups: (ytRow.content?.data_blocks || []).find(b => b.type === 'descriptor_list')?.content?.groups?.length ?? 0,
        delivered: ytRow.status === 'delivered' && ytEpisodes.length === 3,
      },
      bridge: {
        status: cbRow.status, title: cbRow.content?.header?.title || null,
        blocks: cbBlocks, steps: cbSteps.length,
        reflows_source: cbFormatted.toLowerCase().includes('patience'),
        delivered: cbRow.status === 'delivered' && cbBlocks.includes('numbered_procedure') && cbBlocks.includes('spec_grid') && cbBlocks.includes('always_never') && cbSteps.length >= 6,
      },
    };
    console.error(`[happy] wall=${wall}ms yt=${ytRow.status}(eps=${ytEpisodes.length}) cb=${cbRow.status}(steps=${cbSteps.length}, reflow=${out.happy.bridge.reflows_source})`);

    // ── 2. TIER GATE (youtube) ───────────────────────────────────────────
    free = await makeUser('free');
    const gate = await dispatch(free, 'youtube_strategy_agent');
    const freeCounts = await countRows(free.id, 'youtube_strategy_agent');
    out.tier_gate = { http: gate.http, rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient', no_rows: freeCounts.artifacts === 0 && freeCounts.dispatch_jobs === 0 };
    console.error(`[tier] http=${gate.http}`);

    // ── 3. CROSS-PHASE DEP (bridge, no voice guide) ──────────────────────
    noVoice = await makeUser('starter');
    await insertDelivered(noVoice.id, 'visual_dna_synthesizer', VISUAL_DNA, '01');
    const dep = await dispatch(noVoice, 'content_bridge_agent', { source_content: SOURCE_PIECE });
    const nvCounts = await countRows(noVoice.id, 'content_bridge_agent');
    out.cross_phase_dependency = {
      http: dep.http, missing_slug: dep.body?.missing_slug,
      named_422: dep.http === 422 && dep.body?.error === 'missing_dependency' && dep.body?.missing_slug === 'voice_guide_agent',
      no_rows: nvCounts.artifacts === 0 && nvCounts.dispatch_jobs === 0,
    };
    console.error(`[cross-phase-dep] http=${dep.http} missing=${dep.body?.missing_slug}`);
  } catch (e) {
    out.failure_reason = String(e?.message || e);
    console.error('FAILURE', out.failure_reason);
  } finally {
    const td = [];
    for (const u of [starter, free, noVoice]) if (u) td.push(await teardownUser(u));
    out.teardown = { users: td.length, debris_free: td.every(Boolean) };
  }

  out.pass = !out.failure_reason
    && out.happy?.youtube?.delivered && out.happy?.youtube?.episodes_have_extras && out.happy?.youtube?.series_groups === 3
    && out.happy?.bridge?.delivered && out.happy?.bridge?.reflows_source
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows
    && out.cross_phase_dependency?.named_422 && out.cross_phase_dependency?.no_rows
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-05/youtube-bridge.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
