/* Chapter 4 · Step 2 · Logo Evaluation Agent harness
 *
 * INVARIANTS:
 *   1. HAPPY: a Starter-tier founder with a delivered foundation uploads
 *      a real logo image (PNG), dispatches logo_evaluation_agent through
 *      production /api/agents/run with the signed file, and receives a
 *      delivered, schema-valid artifact with ranked changes.
 *   2. TIER GATE: a free-tier founder is rejected 403 tier_insufficient
 *      before any row is written.
 *   3. MIME REJECTION (pre-ruled): an SVG sent to the dispatch entry
 *      (/api/agents/rerun, files slot) returns the named 400 instructing
 *      PNG export. Tested against the rerun path using the happy run's
 *      delivered artifact as the source.
 *   4. MISSING DEPENDENCY: a starter founder without the delivered
 *      foundation fails with missing_dependency.
 *   5. Teardown debris-free (rows, users, storage objects).
 *
 * Usage: node tests/chapter-04/logo-evaluation-agent.mjs
 * Env: /tmp/.env.qb-branos.live-backup
 */

import fs from 'node:fs';

const ENV_PATH = '/tmp/.env.qb-branos.live-backup';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
const AGENT = 'logo_evaluation_agent';
const LOGO_FIXTURE = 'img/brand/mark-app-icon-1024.png'; // a real logo PNG, in-repo

const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, 'utf8').split('\n')
    .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m => [m[1], m[2]])
);
const SU = env.SUPABASE_URL, SK = env.SUPABASE_SERVICE_ROLE_KEY, AK = env.SUPABASE_ANON_KEY;
const svc = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Accept: 'application/json' };
const uuid = () => crypto.randomUUID();

const QBP = {
  brandName: 'Steadfield', brandEssence: 'Patient growth, measured in seasons.',
  archetypePrimary: 'Sage', archetypeSecondary: 'Creator',
  archetypeVisualImplications: 'Calm authority. Generous whitespace. Editorial restraint.',
  colorTerritory: 'warm earth tones, deep green anchors', forbiddenColor: 'neon purple',
  visualTerritoryNote: 'Looks like a well-set field guide, not a startup deck.',
  typographyNote: 'Serif display with quiet humanist body.', antiVoice: 'No hype. No buzzwords.',
  antiBrand: 'Hustle-culture productivity apps.', paradox: 'Ancient patience, modern tools.',
};
const SOUL_MAP_CONTENT = {
  schema_version: '1.0',
  header: { eyebrow: '01 Discovery · Soul Map', title: 'The Soul of Steadfield', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 },
  body_sections: [{ heading: 'Essence', prose: 'Steadfield grows things that take time.\n\nIt speaks like a field guide: precise, warm, unhurried.' }],
  data_blocks: [],
  footer: { qbp_fields_referenced: ['brandName'] },
};
const VISUAL_DNA_CONTENT = {
  schema_version: '1.0',
  header: { eyebrow: '01 Discovery · Visual DNA', title: 'The Visual Language of Steadfield', agent: 'visual_dna_synthesizer', generated_at: new Date().toISOString(), version: 1 },
  body_sections: [{ heading: 'The color system', prose: 'Deep field green anchors the system; warm parchment carries it.\n\nThe forbidden neon purple stays forbidden.' }],
  data_blocks: [
    { type: 'palette', title: 'Color system', content: { swatches: [
      { label: 'Primary', hex: '#1F5B47', rationale: 'Field green.' },
      { label: 'Secondary', hex: '#EFE6D5', rationale: 'Parchment.' },
      { label: 'Accent', hex: '#C97B3D', rationale: 'Ochre.' },
      { label: 'Neutral', hex: '#2D2A26', rationale: 'Soil ink.' } ] } },
  ],
  footer: { qbp_fields_referenced: ['colorTerritory'] },
};

async function must(r, what) { if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`); return r; }

async function makeUser(tier) {
  const email = `qb-ch4s2-${uuid().slice(0, 8)}@qb-harness.test`;
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

async function uploadAndSign(user, bytes, ext, mime) {
  const objPath = `${user.id}/${uuid()}.${ext}`;
  await must(await fetch(`${SU}/storage/v1/object/user-uploads/${objPath}`, {
    method: 'POST', headers: { Authorization: `Bearer ${user.token}`, apikey: AK, 'Content-Type': mime }, body: bytes,
  }), 'upload');
  const signed = await (await must(await fetch(`${BASE}/api/files/sign-url`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ path: objPath }),
  }), 'sign')).json();
  return { objPath, signed_url: signed.signed_url, mime };
}

async function dispatch(user, fileEntry, withRows = true) {
  let dispatchId = null, artifactId = null;
  if (withRows) {
    const dj = await (await must(await fetch(`${SU}/rest/v1/dispatch_jobs`, { method: 'POST', headers: { ...svc, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, kind: 'manual', status: 'producing', agents_count: 1, agents_settled: 0, trigger: 'manual', agent_version: 1 }) }), 'dispatch')).json();
    dispatchId = dj[0].id;
    const art = await (await must(await fetch(`${SU}/rest/v1/artifacts`, { method: 'POST', headers: { ...svc, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, artifact_type: AGENT, status: 'queued', version: 1, phase: '02', content: {}, dispatch_id: dispatchId }) }), 'artifact')).json();
    artifactId = art[0].id;
  }
  const files = fileEntry ? [{ type: 'logo-image', file_id: uuid(), path: `user-uploads/${fileEntry.objPath}`, mime: fileEntry.mime, signed_url: fileEntry.signed_url }] : [];
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/agents/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ user_id: user.id, agent_slug: AGENT, dispatch_id: dispatchId, artifact_id: artifactId, trigger: 'manual', runtime_args: { qbp_source: 'current', files } }),
  });
  const body = await r.json().catch(() => ({}));
  return { http: r.status, body, wall_ms: Date.now() - t0, dispatchId, artifactId };
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

async function main() {
  const out = { harness: 'logo-evaluation-agent', started_at: new Date().toISOString(), base_url: BASE };
  let starter = null, free = null, bare = null;
  try {
    // ── 1. HAPPY · real logo PNG through production ──────────────────────
    starter = await makeUser('starter');
    await insertDelivered(starter.id, 'soul_map_synthesizer', SOUL_MAP_CONTENT);
    await insertDelivered(starter.id, 'visual_dna_synthesizer', VISUAL_DNA_CONTENT);
    const logoPng = fs.readFileSync(LOGO_FIXTURE);
    const logoFile = await uploadAndSign(starter, logoPng, 'png', 'image/png');
    const happy = await dispatch(starter, logoFile);
    const row = await (await fetch(`${SU}/rest/v1/artifacts?id=eq.${happy.artifactId}&select=status,content`, { headers: svc })).json();
    const content = row?.[0]?.content || {};
    const changes = content?.data_blocks?.[0]?.content?.items || [];
    out.happy = {
      http: happy.http, delivered: row?.[0]?.status === 'delivered',
      duration_ms: happy.body?.duration_ms ?? null, wall_ms: happy.wall_ms,
      ranked_changes: changes.length,
      file_refs_ok: null,
    };
    const runRow = await (await fetch(`${SU}/rest/v1/agent_runs?artifact_id=eq.${happy.artifactId}&select=file_refs&order=started_at.desc&limit=1`, { headers: svc })).json();
    out.happy.file_refs_ok = runRow?.[0]?.file_refs?.[0]?.type === 'logo-image';
    console.error(`[happy] http=${happy.http} delivered=${out.happy.delivered} duration_ms=${out.happy.duration_ms} changes=${out.happy.ranked_changes} file_refs=${out.happy.file_refs_ok}`);
    if (!out.happy.delivered) throw new Error(`happy failed: ${JSON.stringify(happy.body).slice(0, 300)}`);

    // ── 2. TIER GATE · free tier 403, zero rows ──────────────────────────
    free = await makeUser('free');
    const gate = await dispatch(free, null, false);
    const freeRuns = await (await fetch(`${SU}/rest/v1/agent_runs?user_id=eq.${free.id}&select=id`, { headers: svc })).json();
    out.tier_gate = {
      http: gate.http, error: gate.body?.error, detail: gate.body?.detail,
      rejected_403: gate.http === 403 && gate.body?.error === 'tier_insufficient',
      no_rows_written: Array.isArray(freeRuns) && freeRuns.length === 0,
    };
    console.error(`[tier-gate] http=${gate.http} error=${gate.body?.error}`);

    // ── 3. MIME REJECTION · SVG to the dispatch entry, named 400 ─────────
    const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1F5B47"/></svg>');
    const svgFile = await uploadAndSign(starter, svgBytes, 'svg', 'image/svg+xml');
    const rr = await fetch(`${BASE}/api/agents/rerun`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${starter.token}` },
      body: JSON.stringify({ artifact_id: happy.artifactId, files: [{ path: svgFile.objPath, type: 'logo-image' }] }),
    });
    const rrBody = await rr.json().catch(() => ({}));
    out.mime_rejection = {
      http: rr.status, error: rrBody?.error, detail: rrBody?.detail,
      named_400: rr.status === 400 && /export your logo as PNG/.test(rrBody?.detail || ''),
    };
    console.error(`[mime] http=${rr.status} detail=${rrBody?.detail}`);

    // ── 4. MISSING DEPENDENCY ────────────────────────────────────────────
    bare = await makeUser('starter');
    const bareLogo = await uploadAndSign(bare, logoPng, 'png', 'image/png');
    const dep = await dispatch(bare, bareLogo);
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

  out.pass = !out.failure_reason
    && out.happy?.delivered && out.happy?.ranked_changes >= 3 && out.happy?.file_refs_ok
    && out.tier_gate?.rejected_403 && out.tier_gate?.no_rows_written
    && out.mime_rejection?.named_400
    && out.missing_dependency?.correct
    && out.teardown.debris_free;
  out.completed_at = new Date().toISOString();
  fs.writeFileSync('tests/chapter-04/logo-evaluation-agent.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
