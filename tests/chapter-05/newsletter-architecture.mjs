/* Chapter 5 · Step 1 · Newsletter Architecture Agent harness
 *
 * INVARIANTS:
 *   1. HAPPY: a Starter founder with the delivered foundation (Voice
 *      Guide + Soul Map + War Table) fires newsletter_architecture_agent
 *      first-run through production POST /api/agents/dispatch and receives
 *      a delivered, schema-valid artifact carrying the four-issue
 *      content_pack, the spec_grid, and the numbered_procedure. Heavy
 *      class: the poll allows 210 s.
 *   2. TIER GATE: a free founder is rejected 403 tier_insufficient, zero rows.
 *   3. CROSS-PHASE DEPENDENCY: a starter founder WITH Phase 01 artifacts
 *      but WITHOUT the delivered Phase 02 voice_guide_agent gets 422
 *      missing_dependency naming voice_guide_agent, zero rows. The first
 *      cross-phase gate in the framework, asserted explicitly.
 *   4. Teardown debris-free.
 *
 * Usage: node tests/chapter-05/newsletter-architecture.mjs
 * Env: .env.qb-branos.live (repo root, gitignored) or QB_ENV_FILE.
 */

import fs from 'node:fs';

const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const AGENT = 'newsletter_architecture_agent';
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
};
const SOUL_MAP = { schema_version: '1.0', header: { eyebrow: '01 Discovery · Soul Map', title: 'The Soul of Steadfield', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading: 'Essence', prose: 'Steadfield grows things that take time.\n\nPrecise, warm, unhurried.' }], data_blocks: [], footer: { qbp_fields_referenced: ['brandName'] } };
const WAR_TABLE = { schema_version: '1.0', header: { eyebrow: '01 Discovery · War Table', title: 'The War Table for Steadfield', agent: 'war_table_synthesizer', generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading: 'The audience', prose: 'They measure in seasons, not sprints.\n\nThey fear that patience looks like standing still.' }], data_blocks: [], footer: { qbp_fields_referenced: ['audienceLanguage'] } };
const VOICE_GUIDE = { schema_version: '1.0', header: { eyebrow: '02 Brand Creation · Voice Guide', title: 'How Steadfield Speaks', agent: 'voice_guide_agent', generated_at: new Date().toISOString(), version: 1 }, body_sections: [{ heading: 'The register', prose: 'Calm sentences that finish. Field-guide warmth, no hype.\n\nShort words where they serve, always plain.' }], data_blocks: [{ type: 'always_never', title: 'The voice, always and never', content: { always: ['Speak plainly', 'Borrow the reader’s words'], never: ['Manufacture urgency', 'Borrow hype'] } }], footer: { qbp_fields_referenced: ['antiVoice'] } };

async function makeUser(tier) {
  const email = `qb-ch5s1-${uuid().slice(0, 8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier, qbp: QBP }) }), 'profile');
  const tok = (await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json()).access_token;
  return { id: u.id, token: tok };
}
async function insertDelivered(userId, type, content, phase) {
  await must(await fetch(`${SU}/rest/v1/artifacts`, { method: 'POST', headers: { ...svc, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, artifact_type: type, status: 'delivered', version: 1, phase, content }) }), `insert ${type}`);
}
async function dispatch(user) {
  const r = await fetch(`${BASE}/api/agents/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ agent_slug: AGENT }) });
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
async function countRows(userId) {
  const arts = await (await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${userId}&artifact_type=eq.${AGENT}&select=id`, { headers: svc })).json();
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
  const out = { harness: 'newsletter-architecture', started_at: new Date().toISOString(), base_url: BASE };
  let starter = null, free = null, noVoice = null;
  try {
    // ── 1. HAPPY · full foundation, heavy first run ───────────────────────
    starter = await makeUser('starter');
    await insertDelivered(starter.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    await insertDelivered(starter.id, 'war_table_synthesizer', WAR_TABLE, '01');
    await insertDelivered(starter.id, 'voice_guide_agent', VOICE_GUIDE, '02');
    const t0 = Date.now();
    const happy = await dispatch(starter);
    if (happy.http !== 202) throw new Error(`happy dispatch: ${happy.http} ${JSON.stringify(happy.body).slice(0, 200)}`);
    const row = await pollDelivered(happy.body.artifact_id);
    const wall = Date.now() - t0;
    const blocks = (row.content?.data_blocks || []).map(b => b.type);
    const issues = row.content?.data_blocks?.find(b => b.type === 'content_pack')?.content?.items || [];
    out.happy = {
      http: happy.http, final_status: row.status, wall_ms: wall,
      title: row.content?.header?.title || null,
      blocks, issue_count: issues.length,
      issue_bodies_substantive: issues.every(i => (i.body || '').length > 400),
      delivered: row.status === 'delivered' && blocks.includes('content_pack') && blocks.includes('spec_grid') && blocks.includes('numbered_procedure') && issues.length === 4,
    };
    console.error(`[happy] status=${row.status} wall=${wall}ms title=${JSON.stringify(out.happy.title)} issues=${issues.length} blocks=${blocks.join(',')}`);

    // ── 2. TIER GATE ─────────────────────────────────────────────────────
    free = await makeUser('free');
    const gate = await dispatch(free);
    const freeCounts = await countRows(free.id);
    out.tier_gate = { http: gate.http, error: gate.body?.error, rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient', no_rows: freeCounts.artifacts === 0 && freeCounts.dispatch_jobs === 0 };
    console.error(`[tier] http=${gate.http} error=${gate.body?.error}`);

    // ── 3. CROSS-PHASE DEPENDENCY · Phase 01 done, Voice Guide missing ───
    noVoice = await makeUser('starter');
    await insertDelivered(noVoice.id, 'soul_map_synthesizer', SOUL_MAP, '01');
    await insertDelivered(noVoice.id, 'war_table_synthesizer', WAR_TABLE, '01');
    const dep = await dispatch(noVoice);
    const nvCounts = await countRows(noVoice.id);
    out.cross_phase_dependency = {
      http: dep.http, error: dep.body?.error, missing_slug: dep.body?.missing_slug,
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
    && out.happy?.delivered && out.happy?.issue_bodies_substantive
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows
    && out.cross_phase_dependency?.named_422 && out.cross_phase_dependency?.no_rows
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.mkdirSync('tests/chapter-05', { recursive: true });
  fs.writeFileSync('tests/chapter-05/newsletter-architecture.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
