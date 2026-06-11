/* Chapter 4 · Step 1 · Logo Direction Agent harness
 *
 * INVARIANTS:
 *   1. A Starter-tier founder with a delivered Phase 01 foundation
 *      dispatches logo_direction_agent through production /api/agents/run
 *      and receives a delivered, schema-valid artifact.
 *   2. TIER GATE (chapter-4 ruling 2): a free-tier founder is rejected
 *      403 tier_insufficient with named detail BEFORE any row is written.
 *   3. A founder without the delivered dependencies fails with
 *      missing_dependency (user-fixable, no notification).
 *   4. Latency capture for the AGENT_OBSERVED_LATENCY_MS entry.
 *
 * Founder-initiated only (ruling 3): the harness dispatches with
 * trigger 'manual'. Self-teardown per the step-3E pattern.
 *
 * Usage: node tests/chapter-04/logo-direction-agent.mjs
 * Env: /tmp/.env.qb-branos.live-backup
 */

import fs from 'node:fs';

const ENV_PATH = '/tmp/.env.qb-branos.live-backup';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const AGENT = 'logo_direction_agent';
const HAPPY_RUNS = 3;

const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, 'utf8').split('\n')
    .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]])
);
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY, AK = env.SUPABASE_ANON_KEY;
const svc = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' };
const uuid = () => crypto.randomUUID();

const QBP = {
  brandName: 'Steadfield',
  brandEssence: 'Patient growth, measured in seasons.',
  archetypePrimary: 'Sage',
  archetypeSecondary: 'Creator',
  archetypeVisualImplications: 'Calm authority. Generous whitespace. Editorial restraint.',
  colorTerritory: 'warm earth tones, deep green anchors',
  forbiddenColor: 'neon purple',
  visualTerritoryNote: 'Looks like a well-set field guide, not a startup deck.',
  typographyNote: 'Serif display with quiet humanist body.',
  antiVoice: 'No hype. No buzzwords.',
  antiBrand: 'Hustle-culture productivity apps.',
  paradox: 'Ancient patience, modern tools.',
};

// Synthetic delivered Phase 01 artifacts · realistic shapes so the
// agent's dependency distillation has real material to read.
const SOUL_MAP_CONTENT = {
  schema_version: '1.0',
  header: { eyebrow: '01 Discovery · Soul Map', title: 'The Soul of Steadfield', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 },
  body_sections: [
    { heading: 'Essence', prose: 'Steadfield grows things that take time. The brand is the patient counterweight to a culture of instant everything.\n\nIt speaks like a field guide: precise, warm, unhurried.' },
    { heading: 'The paradox', prose: 'Ancient patience, modern tools. The tension is the brand.\n\nEvery surface should hold both: something old in the bones, something sharp in the finish.' },
  ],
  data_blocks: [
    { type: 'always_never', title: 'Voice', content: { always: ['Speak in seasons', 'Cite the soil'], never: ['Promise overnight results', 'Borrow hustle language'] } },
  ],
  footer: { qbp_fields_referenced: ['brandName', 'archetypePrimary'] },
};
const VISUAL_DNA_CONTENT = {
  schema_version: '1.0',
  header: { eyebrow: '01 Discovery · Visual DNA', title: 'The Visual Language of Steadfield', agent: 'visual_dna_synthesizer', generated_at: new Date().toISOString(), version: 1 },
  body_sections: [
    { heading: 'The color system', prose: 'Deep field green anchors the system; warm parchment carries it.\n\nThe forbidden neon purple stays forbidden.' },
  ],
  data_blocks: [
    { type: 'palette', title: 'Color system', content: { swatches: [
      { label: 'Primary', hex: '#1F5B47', rationale: 'Field green, the anchor.' },
      { label: 'Secondary', hex: '#EFE6D5', rationale: 'Parchment warmth.' },
      { label: 'Accent', hex: '#C97B3D', rationale: 'Harvest ochre.' },
      { label: 'Neutral', hex: '#2D2A26', rationale: 'Soil ink.' } ] } },
    { type: 'type_pairing', title: 'Type direction', content: {
      display: { family: 'Fraunces', weight: '600', rationale: 'A serif with soil under its nails.' },
      body: { family: 'Inter', weight: '400', rationale: 'Quiet, legible, modern.' } } },
  ],
  footer: { qbp_fields_referenced: ['colorTerritory', 'typographyNote'] },
};

async function must(r, what) { if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`); return r; }

async function makeUser(tier) {
  const email = `qb-ch4s1-${uuid().slice(0, 8)}@qb-harness.test`;
  const password = `Qb-${uuid()}`;
  const u = await (await must(await fetch(`${SU}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) }), 'createUser')).json();
  await must(await fetch(`${SU}/rest/v1/profiles`, { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: u.id, email, tier, qbp: QBP }) }), 'profile');
  const tok = (await (await must(await fetch(`${SU}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: AK, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }), 'signin')).json()).access_token;
  return { id: u.id, token: tok };
}

async function insertDelivered(userId, type, content, version) {
  const r = await must(await fetch(`${SU}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, artifact_type: type, status: 'delivered', version, phase: '01', content }),
  }), `insert ${type}`);
  return (await r.json())[0];
}

async function dispatch(user, withDispatchRow = true, version = 1) {
  let dispatchId = null, artifactId = null;
  if (withDispatchRow) {
    const dj = await (await must(await fetch(`${SU}/rest/v1/dispatch_jobs`, { method: 'POST', headers: { ...svc, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, kind: 'manual', status: 'producing', agents_count: 1, agents_settled: 0, trigger: 'manual', agent_version: 1 }) }), 'dispatch')).json();
    dispatchId = dj[0].id;
    const art = await (await must(await fetch(`${SU}/rest/v1/artifacts`, { method: 'POST', headers: { ...svc, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, artifact_type: AGENT, status: 'queued', version, phase: '02', content: {}, dispatch_id: dispatchId }) }), 'artifact')).json();
    artifactId = art[0].id;
  }
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/agents/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ user_id: user.id, agent_slug: AGENT, dispatch_id: dispatchId, artifact_id: artifactId, trigger: 'manual', runtime_args: { qbp_source: 'current' } }),
  });
  const body = await r.json().catch(() => ({}));
  return { http: r.status, body, wall_ms: Date.now() - t0, dispatchId, artifactId };
}

async function teardownUser(user) {
  await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc }).catch(() => {});
  await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/rest/v1/dispatch_jobs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
  await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
  const arts = await (await fetch(`${SU}/rest/v1/artifacts?user_id=eq.${user.id}&select=id`, { headers: svc })).json();
  const gone = !(await fetch(`${SU}/auth/v1/admin/users/${user.id}`, { headers: svc })).ok;
  return arts.length === 0 && gone;
}

async function main() {
  const startedAt = new Date().toISOString();
  const out = { harness: 'logo-direction-agent', started_at: startedAt, base_url: BASE };
  let starter = null, free = null, bare = null;
  try {
    // ── 1. Happy path · starter tier, delivered foundation ──────────────
    starter = await makeUser('starter');
    await insertDelivered(starter.id, 'soul_map_synthesizer', SOUL_MAP_CONTENT, 1);
    await insertDelivered(starter.id, 'visual_dna_synthesizer', VISUAL_DNA_CONTENT, 1);
    const happy = [];
    for (let i = 1; i <= HAPPY_RUNS; i++) {
      const res = await dispatch(starter, true, i);
      const row = await (await fetch(`${SU}/rest/v1/artifacts?id=eq.${res.artifactId}&select=status,content`, { headers: svc })).json();
      happy.push({
        run: i, http: res.http, delivered: row?.[0]?.status === 'delivered',
        duration_ms: res.body?.duration_ms ?? null, wall_ms: res.wall_ms,
        directions: row?.[0]?.content?.data_blocks?.[0]?.content?.groups?.length ?? 0,
      });
      console.error(`[happy ${i}] http=${res.http} delivered=${happy[i - 1].delivered} duration_ms=${happy[i - 1].duration_ms} directions=${happy[i - 1].directions}`);
      if (!happy[i - 1].delivered) throw new Error(`happy run ${i} failed: ${JSON.stringify(res.body).slice(0, 300)}`);
    }
    out.happy_runs = happy;

    // ── 2. Tier gate · free tier rejected pre-row ───────────────────────
    free = await makeUser('free');
    await insertDelivered(free.id, 'soul_map_synthesizer', SOUL_MAP_CONTENT, 1);
    await insertDelivered(free.id, 'visual_dna_synthesizer', VISUAL_DNA_CONTENT, 1);
    const gate = await dispatch(free, false); // no rows pre-created
    const freeRuns = await (await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${free.id}&select=id`, { headers: svc })).json();
    out.tier_gate = {
      http: gate.http,
      error: gate.body?.error,
      detail: gate.body?.detail,
      rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient',
      no_rows_written: Array.isArray(freeRuns) && freeRuns.length === 0,
    };
    console.error(`[tier-gate] http=${gate.http} error=${gate.body?.error} no_rows=${out.tier_gate.no_rows_written}`);

    // ── 3. Missing dependency ────────────────────────────────────────────
    bare = await makeUser('starter'); // no foundation artifacts
    const dep = await dispatch(bare, true, 1);
    out.missing_dependency = {
      http: dep.http, error: dep.body?.error,
      correct: dep.http === 200 && dep.body?.error === 'missing_dependency',
    };
    console.error(`[missing-dep] http=${dep.http} error=${dep.body?.error}`);
  } catch (e) {
    out.failure_reason = String(e?.message || e);
  } finally {
    const td = [];
    for (const u of [starter, free, bare]) if (u) td.push(await teardownUser(u));
    out.teardown = { users: td.length, debris_free: td.every(Boolean) };
  }

  const happyOk = (out.happy_runs || []).length === HAPPY_RUNS && out.happy_runs.every(r => r.delivered && r.directions === 3);
  out.pass = !out.failure_reason && happyOk
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows_written
    && out.missing_dependency?.correct
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-04/logo-direction-agent.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
