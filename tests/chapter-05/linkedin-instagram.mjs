/* Chapter 5 · Steps 2-3 · LinkedIn Strategy + Instagram Seed harness
 *
 * INVARIANTS:
 *   1. HAPPY x2, CONCURRENT: one Starter founder with the full delivered
 *      foundation (voice_guide + soul_map + war_table + visual_dna) fires
 *      BOTH agents at once through POST /api/agents/dispatch (the
 *      single-in-flight guard is per (user, agent), so two different
 *      agents may produce concurrently). Both settle delivered with their
 *      declared block shapes: LinkedIn = 2 content_packs (8 + 6 posts) +
 *      spec_grid; Instagram = content_pack (12 posts) + spec_grid.
 *   2. TIER GATE (linkedin): free founder 403, zero rows.
 *   3. CROSS-PHASE DEP (instagram): starter with Phase 01 but no
 *      voice_guide gets 422 naming voice_guide_agent, zero rows.
 *   4. Teardown debris-free.
 *
 * Usage: node tests/chapter-05/linkedin-instagram.mjs
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
  colorTerritory: 'warm earth tones, deep green anchors', forbiddenColor: 'neon purple',
  visualTerritoryNote: 'Looks like a well-set field guide, not a startup deck.',
  paradox: 'Ancient patience, modern tools.',
};
const mk = (eyebrow, title, agent, heading, prose, blocks = []) => ({ schema_version: '1.0', header: { eyebrow, title, agent, generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading, prose }], data_blocks: blocks, footer: { qbp_fields_referenced: ['brandName'] } });
const SOUL_MAP = mk('01 Discovery · Soul Map', 'The Soul of Steadfield', 'soul_map_synthesizer', 'Essence', 'Steadfield grows things that take time.\n\nPrecise, warm, unhurried.');
const WAR_TABLE = mk('01 Discovery · War Table', 'The War Table for Steadfield', 'war_table_synthesizer', 'The audience', 'They measure in seasons, not sprints.\n\nThey fear patience looks like standing still.');
const VISUAL_DNA = mk('01 Discovery · Visual DNA', 'The Visual Language of Steadfield', 'visual_dna_synthesizer', 'The color system', 'Deep field green anchors; warm parchment carries.\n\nNeon purple stays forbidden.');
const VOICE_GUIDE = mk('02 Brand Creation · Voice Guide', 'How Steadfield Speaks', 'voice_guide_agent', 'The register', 'Calm sentences that finish. Field-guide warmth, no hype.\n\nShort words where they serve.');

async function makeUser(tier) {
  const email = `qb-ch5s23-${uuid().slice(0, 8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier, qbp: QBP }) }), 'profile');
  const tok = (await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json()).access_token;
  return { id: u.id, token: tok };
}
async function insertDelivered(userId, type, content, phase) {
  await must(await fetch(`${SU}/rest/v1/artifacts`, { method: 'POST', headers: { ...svc, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, artifact_type: type, status: 'delivered', version: 1, phase, content }) }), `insert ${type}`);
}
async function dispatch(user, agent) {
  const r = await fetch(`${BASE}/api/agents/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ agent_slug: agent }) });
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
  const out = { harness: 'linkedin-instagram', started_at: new Date().toISOString(), base_url: BASE };
  let starter = null, free = null, noVoice = null;
  try {
    // ── 1. HAPPY x2 concurrent ────────────────────────────────────────────
    starter = await makeUser('starter');
    await insertDelivered(starter.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    await insertDelivered(starter.id, 'war_table_synthesizer', WAR_TABLE, '01');
    await insertDelivered(starter.id, 'visual_dna_synthesizer', VISUAL_DNA, '01');
    await insertDelivered(starter.id, 'voice_guide_agent', VOICE_GUIDE, '02');
    const t0 = Date.now();
    const [li, ig] = await Promise.all([
      dispatch(starter, 'linkedin_strategy_agent'),
      dispatch(starter, 'instagram_seed_agent'),
    ]);
    out.dispatch = { linkedin: li.http, instagram: ig.http };
    if (li.http !== 202 || ig.http !== 202) throw new Error(`dispatch failed: li=${li.http} ig=${ig.http} ${JSON.stringify(li.body).slice(0,120)} ${JSON.stringify(ig.body).slice(0,120)}`);
    const [liRow, igRow] = await Promise.all([
      pollDelivered(li.body.artifact_id),
      pollDelivered(ig.body.artifact_id),
    ]);
    const wall = Date.now() - t0;
    const liPacks = (liRow.content?.data_blocks || []).filter(b => b.type === 'content_pack');
    const igPack = (igRow.content?.data_blocks || []).find(b => b.type === 'content_pack');
    out.happy = {
      wall_ms: wall,
      linkedin: {
        status: liRow.status, title: liRow.content?.header?.title || null,
        packs: liPacks.length, founder_posts: liPacks[0]?.content?.items?.length ?? 0,
        company_posts: liPacks[1]?.content?.items?.length ?? 0,
        delivered: liRow.status === 'delivered' && liPacks.length === 2
          && liPacks[0]?.content?.items?.length === 8 && liPacks[1]?.content?.items?.length === 6,
      },
      instagram: {
        status: igRow.status, title: igRow.content?.header?.title || null,
        posts: igPack?.content?.items?.length ?? 0,
        bodies_substantive: (igPack?.content?.items || []).every(i => (i.body || '').length > 200),
        delivered: igRow.status === 'delivered' && igPack?.content?.items?.length === 12,
      },
    };
    console.error(`[happy] wall=${wall}ms li=${liRow.status}(${out.happy.linkedin.founder_posts}+${out.happy.linkedin.company_posts}) ig=${igRow.status}(${out.happy.instagram.posts})`);

    // ── 2. TIER GATE (linkedin) ──────────────────────────────────────────
    free = await makeUser('free');
    const gate = await dispatch(free, 'linkedin_strategy_agent');
    const freeCounts = await countRows(free.id, 'linkedin_strategy_agent');
    out.tier_gate = { http: gate.http, error: gate.body?.error, rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient', no_rows: freeCounts.artifacts === 0 && freeCounts.dispatch_jobs === 0 };
    console.error(`[tier] http=${gate.http}`);

    // ── 3. CROSS-PHASE DEP (instagram, no voice guide) ───────────────────
    noVoice = await makeUser('starter');
    await insertDelivered(noVoice.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    await insertDelivered(noVoice.id, 'visual_dna_synthesizer', VISUAL_DNA, '01');
    const dep = await dispatch(noVoice, 'instagram_seed_agent');
    const nvCounts = await countRows(noVoice.id, 'instagram_seed_agent');
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
    && out.happy?.linkedin?.delivered && out.happy?.instagram?.delivered && out.happy?.instagram?.bodies_substantive
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows
    && out.cross_phase_dependency?.named_422 && out.cross_phase_dependency?.no_rows
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-05/linkedin-instagram.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
