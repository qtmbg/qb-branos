/* Chapter 4 · Step 4 · Founder dispatch entry harness
 *
 * Exercises POST /api/agents/dispatch (api/agents/dispatch.js), the
 * first-run entry that lets a founder fire a Phase 02 agent from the
 * product with no prior artifact. Asserts the four ruled constraints.
 *
 * INVARIANTS:
 *   1. HAPPY (all three Phase 02 agents): a Starter founder with a
 *      delivered foundation fires logo_direction_agent, logo_evaluation_agent
 *      (with an uploaded logo PNG), and voice_guide_agent through the new
 *      entry. Each returns 202 and settles to a delivered, schema-valid
 *      artifact.
 *   2a. DOUBLE-FIRE (sequential): a second request while the first is
 *       producing returns 409 dispatch_in_flight (named). Exactly ONE
 *       dispatch row exists for that (user, agent).
 *   2b. DOUBLE-FIRE (simultaneous race): two requests fired at once yield
 *       exactly one 202 and one 409, and exactly one dispatch row + one
 *       artifact. Proves the DB unique-index backstop: a race cannot slip
 *       two dispatches through.
 *   3. TIER GATE: a free-tier founder is rejected 403 tier_insufficient
 *      before any row is written.
 *   4. MISSING DEPENDENCY: a starter founder without the delivered
 *      foundation gets 422 missing_dependency (named slug), zero rows.
 *   5. Teardown debris-free (rows, users, storage objects).
 *
 * Usage: node tests/chapter-04/founder-dispatch-entry.mjs
 * Env: .env.qb-branos.live (repo root, gitignored · vercel env pull) or QB_ENV_FILE, else process.env.
 */

import fs from 'node:fs';

const ENV_PATH = process.env.QB_ENV_FILE || '.env.qb-branos.live';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const LOGO_FIXTURE = 'img/brand/mark-app-icon-1024.png'; // a real logo PNG, in-repo
const POLL_TIMEOUT_MS = 150_000;
const POLL_INTERVAL_MS = 3_000;

const fileEnv = fs.existsSync(ENV_PATH)
  ? Object.fromEntries(
      fs.readFileSync(ENV_PATH, 'utf8').split('\n')
        .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]])
    )
  : {};
const env = { ...process.env, ...fileEnv };
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY, AK = env.SUPABASE_ANON_KEY;
if (!SU || !SK || !AK) {
  console.error(`MISSING ENV · need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY.
Place them in ${ENV_PATH} or export them. Cannot run live verification without them.`);
  process.exit(2);
}
const svc = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' };
const uuid = () => crypto.randomUUID();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
const SOUL_MAP_CONTENT = {
  schema_version: '1.0',
  header: { eyebrow: '01 Discovery · Soul Map', title: 'The Soul of Steadfield', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 },
  body_sections: [{ heading: 'Essence', prose: 'Steadfield grows things that take time.\n\nIt speaks like a field guide: precise, warm, unhurried.' }],
  data_blocks: [], footer: { qbp_fields_referenced: ['brandName'] },
};
const VISUAL_DNA_CONTENT = {
  schema_version: '1.0',
  header: { eyebrow: '01 Discovery · Visual DNA', title: 'The Visual Language of Steadfield', agent: 'visual_dna_synthesizer', generated_at: new Date().toISOString(), version: 1 },
  body_sections: [{ heading: 'The color system', prose: 'Deep field green anchors the system; warm parchment carries it.\n\nThe forbidden neon purple stays forbidden.' }],
  data_blocks: [{ type: 'palette', title: 'Color system', content: { swatches: [
    { label: 'Primary', hex: '#1F5B47', rationale: 'Field green.' },
    { label: 'Secondary', hex: '#EFE6D5', rationale: 'Parchment.' },
    { label: 'Accent', hex: '#C97B3D', rationale: 'Ochre.' },
    { label: 'Neutral', hex: '#2D2A26', rationale: 'Soil ink.' } ] } }],
  footer: { qbp_fields_referenced: ['colorTerritory'] },
};
const WAR_TABLE_CONTENT = {
  schema_version: '1.0',
  header: { eyebrow: '01 Discovery · War Table', title: 'The War Table for Steadfield', agent: 'war_table_synthesizer', generated_at: new Date().toISOString(), version: 1 },
  body_sections: [{ heading: 'The audience', prose: 'They measure in seasons, not sprints.\n\nThey fear that patience looks like standing still.' }],
  data_blocks: [{ type: 'priority_list', title: 'Top initiatives', content: { items: [
    { label: 'Name the long game', detail: 'Borrow the reader’s own words for compounding.' } ] } }],
  footer: { qbp_fields_referenced: ['audienceLanguage'] },
};

const DEPS = {
  logo_direction_agent: { soul_map_synthesizer: SOUL_MAP_CONTENT, visual_dna_synthesizer: VISUAL_DNA_CONTENT },
  logo_evaluation_agent: { soul_map_synthesizer: SOUL_MAP_CONTENT, visual_dna_synthesizer: VISUAL_DNA_CONTENT },
  voice_guide_agent: { soul_map_synthesizer: SOUL_MAP_CONTENT, war_table_synthesizer: WAR_TABLE_CONTENT },
};

async function must(r, what) { if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`); return r; }

async function makeUser(tier) {
  const email = `qb-ch4s4-${uuid().slice(0, 8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier, qbp: QBP }) }), 'profile');
  const tok = (await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json()).access_token;
  return { id: u.id, token: tok };
}

async function insertDelivered(userId, type, content) {
  await must(await fetch(`${SU}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId, artifact_type: type, status: 'delivered', version: 1, phase: '01', content }),
  }), `insert ${type}`);
}
async function seedDeps(userId, agent) {
  for (const [type, content] of Object.entries(DEPS[agent])) await insertDelivered(userId, type, content);
}

async function uploadLogo(user) {
  const objPath = `${user.id}/${uuid()}.png`;
  await must(await fetch(`${SU}/storage/v1/object/user-uploads/${objPath}`, {
    method: 'POST', headers: { Authorization: `Bearer ${user.token}`, apikey: AK, 'Content-Type': 'image/png' },
    body: fs.readFileSync(LOGO_FIXTURE),
  }), 'upload');
  return objPath;
}

// Fire the founder dispatch entry. files: [{path, type}] (unsigned · the
// endpoint signs them, like rerun.js).
async function dispatch(user, agent, files = []) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/agents/dispatch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ agent_slug: agent, files }),
  });
  const body = await r.json().catch(() => ({}));
  return { http: r.status, body, wall_ms: Date.now() - t0 };
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
  const runs = await (await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${userId}&agent_slug=eq.${agent}&select=id`, { headers: svc })).json();
  return { artifacts: arts?.length ?? -1, dispatch_jobs: djs?.length ?? -1, agent_runs: runs?.length ?? -1 };
}

async function teardownUser(user) {
  await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/dispatch_jobs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  const list = await (await fetch(`${SU}/storage/v1/object/list/user-uploads`, { method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 50 }) })).json();
  for (const o of (Array.isArray(list) ? list : [])) {
    await fetch(`${SU}/storage/v1/object/user-uploads/${user.id}/${o.name}`, { method: 'DELETE', headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
  }
  await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
  const arts = await (await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}&select=id`, { headers: svc })).json();
  const objs = await (await fetch(`${SU}/storage/v1/object/list/user-uploads`, { method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 10 }) })).json();
  const gone = !(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { headers: svc })).ok;
  return arts.length === 0 && (Array.isArray(objs) ? objs.length === 0 : true) && gone;
}

const deliveredOk = (row) => row?.status === 'delivered' && row?.content && typeof row.content === 'object'
  && !!row.content.header && Array.isArray(row.content.body_sections);

async function main() {
  const out = { harness: 'founder-dispatch-entry', started_at: new Date().toISOString(), base_url: BASE };
  const users = {};
  try {
    // ── 1. HAPPY · all three Phase 02 agents through the new entry ────────
    users.happy = await makeUser('starter');
    await seedDeps(users.happy.id, 'logo_direction_agent');   // soul_map + visual_dna
    await insertDelivered(users.happy.id, 'war_table_synthesizer', WAR_TABLE_CONTENT); // for voice_guide
    const logoPath = await uploadLogo(users.happy);

    const fired = {
      logo_direction_agent: await dispatch(users.happy, 'logo_direction_agent'),
      logo_evaluation_agent: await dispatch(users.happy, 'logo_evaluation_agent', [{ path: logoPath, type: 'logo-image' }]),
      voice_guide_agent: await dispatch(users.happy, 'voice_guide_agent'),
    };
    out.happy = {};
    for (const [agent, f] of Object.entries(fired)) {
      out.happy[agent] = { http: f.http, accepted_202: f.http === 202, artifact_id: f.body?.artifact_id || null, version: f.body?.version };
      console.error(`[happy:${agent}] http=${f.http} artifact=${f.body?.artifact_id || f.body?.error}`);
    }
    // Poll all three to terminal concurrently.
    const settled = await Promise.all(Object.entries(fired).map(async ([agent, f]) => {
      if (f.http !== 202 || !f.body?.artifact_id) return [agent, { status: 'not-dispatched' }];
      return [agent, await pollDelivered(f.body.artifact_id)];
    }));
    for (const [agent, row] of settled) {
      out.happy[agent].final_status = row.status;
      out.happy[agent].delivered = deliveredOk(row);
      console.error(`[happy:${agent}] final=${row.status} delivered=${out.happy[agent].delivered}`);
    }

    // ── 2a. DOUBLE-FIRE sequential · 409 while producing, one dispatch ───
    users.racer = await makeUser('starter');
    await seedDeps(users.racer.id, 'logo_direction_agent');
    const first = await dispatch(users.racer, 'logo_direction_agent');
    const second = await dispatch(users.racer, 'logo_direction_agent'); // while first is producing
    const seqCounts = await countRows(users.racer.id, 'logo_direction_agent');
    out.double_fire_sequential = {
      first_http: first.http, second_http: second.http,
      second_error: second.body?.error, second_detail: second.body?.detail,
      named_409: second.http === 409 && second.body?.error === 'dispatch_in_flight',
      exactly_one_dispatch: seqCounts.dispatch_jobs === 1,
      exactly_one_artifact: seqCounts.artifacts === 1,
      counts: seqCounts,
    };
    console.error(`[double-fire-seq] first=${first.http} second=${second.http}(${second.body?.error}) dispatch_rows=${seqCounts.dispatch_jobs}`);

    // ── 2b. DOUBLE-FIRE simultaneous race · DB-index backstop ────────────
    users.racer2 = await makeUser('starter');
    await seedDeps(users.racer2.id, 'logo_direction_agent');
    const [raceA, raceB] = await Promise.all([
      dispatch(users.racer2, 'logo_direction_agent'),
      dispatch(users.racer2, 'logo_direction_agent'),
    ]);
    const raceCounts = await countRows(users.racer2.id, 'logo_direction_agent');
    const https = [raceA.http, raceB.http].sort();
    out.double_fire_race = {
      https: https, errors: [raceA.body?.error, raceB.body?.error],
      one_202_one_409: https[0] === 202 && https[1] === 409,
      exactly_one_dispatch: raceCounts.dispatch_jobs === 1,
      exactly_one_artifact: raceCounts.artifacts === 1,
      counts: raceCounts,
    };
    console.error(`[double-fire-race] https=${JSON.stringify(https)} dispatch_rows=${raceCounts.dispatch_jobs} artifacts=${raceCounts.artifacts}`);

    // ── 3. TIER GATE · free tier 403, zero rows ──────────────────────────
    users.free = await makeUser('free');
    await seedDeps(users.free.id, 'logo_direction_agent'); // deps present · tier gate must fire first regardless
    const gate = await dispatch(users.free, 'logo_direction_agent');
    const freeCounts = await countRows(users.free.id, 'logo_direction_agent');
    out.tier_gate = {
      http: gate.http, error: gate.body?.error, detail: gate.body?.detail,
      rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient',
      no_rows_written: freeCounts.dispatch_jobs === 0 && freeCounts.artifacts === 0 && freeCounts.agent_runs === 0,
      counts: freeCounts,
    };
    console.error(`[tier-gate] http=${gate.http} error=${gate.body?.error} rows=${JSON.stringify(freeCounts)}`);

    // ── 4. MISSING DEPENDENCY · starter, no foundation, 422, zero rows ───
    users.bare = await makeUser('starter');
    const dep = await dispatch(users.bare, 'logo_direction_agent');
    const bareCounts = await countRows(users.bare.id, 'logo_direction_agent');
    out.missing_dependency = {
      http: dep.http, error: dep.body?.error, missing_slug: dep.body?.missing_slug,
      named_422: dep.http === 422 && dep.body?.error === 'missing_dependency' && !!dep.body?.missing_slug,
      no_rows_written: bareCounts.dispatch_jobs === 0 && bareCounts.artifacts === 0 && bareCounts.agent_runs === 0,
      counts: bareCounts,
    };
    console.error(`[missing-dep] http=${dep.http} error=${dep.body?.error} slug=${dep.body?.missing_slug}`);
  } catch (e) {
    out.failure_reason = String(e?.message || e);
    console.error('FAILURE', out.failure_reason);
  } finally {
    const td = [];
    for (const u of Object.values(users)) if (u) td.push(await teardownUser(u));
    out.teardown = { users: td.length, debris_free: td.every(Boolean) };
  }

  const h = out.happy || {};
  out.pass = !out.failure_reason
    && h.logo_direction_agent?.delivered && h.logo_evaluation_agent?.delivered && h.voice_guide_agent?.delivered
    && out.double_fire_sequential?.named_409 && out.double_fire_sequential?.exactly_one_dispatch && out.double_fire_sequential?.exactly_one_artifact
    && out.double_fire_race?.one_202_one_409 && out.double_fire_race?.exactly_one_dispatch && out.double_fire_race?.exactly_one_artifact
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows_written
    && out.missing_dependency?.named_422 && out.missing_dependency?.no_rows_written
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-04/founder-dispatch-entry.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
