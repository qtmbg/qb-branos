/* Chapter 3 · Step 4 · Real-agent file read · latency gate harness
 *
 * INVARIANT:
 *   A founder-uploaded reference image reaches a REAL production agent
 *   (visual_dna_synthesizer) through the signed-URL vision path, the
 *   agent delivers, and the file-present latency preserves the agent's
 *   pre-step-4 headroom.
 *
 * LATENCY GATE (redefined for the step-5 Node envelope, binding):
 *   The runtime is Node serverless with maxDuration 300 000 ms and a
 *   60 000 ms in-call Claude timeout (retry_budget 0). GATE, two parts:
 *     1. ZERO timeouts across the file-present runs.
 *     2. p95 file-present duration_ms <= 35 000 ms.
 *   Reasoning: post-migration file-absent p95 measured 27 701 ms; the
 *   vision read costs ~4-5 s. 35 000 ms covers baseline p95 plus the
 *   vision cost plus jitter while preserving a 25 s (42%) margin
 *   against the in-call timeout and an 88% margin against maxDuration.
 *   Above 35 s, something beyond the expected vision cost is wrong.
 *   RED = HOLD, surface the numbers.
 *
 * What it runs against production (or QB_BASE override, e.g. a preview
 * deployment of the step-4 branch · data path is production Supabase
 * either way):
 *   - FILE_PRESENT_RUNS dispatches of visual_dna with a real 512x512 PNG
 *     attached via runtime_args.files (signed URL, user-JWT path)
 *   - FILE_ABSENT_RUNS dispatches with no files (baseline)
 *   - 1 rerun-path run (POST /api/agents/rerun with files[]) · the
 *     production founder entry, validates + signs server-side
 *   - negative: rerun with an SVG as reference-image → 400
 *   - negative: rerun with a > 5 MB PNG as reference-image → 400
 *   - agent_runs.file_refs captured on a file-present run
 *
 * Self-teardown per the step-3E pattern: deletes every row and object it
 * created, verifies absence, reports debris_free. Pass or fail.
 *
 * Usage:
 *   node tests/chapter-03/file-upload-real-agent.mjs
 *   QB_BASE=https://<preview>.vercel.app node tests/chapter-03/file-upload-real-agent.mjs
 *
 * Env: /tmp/.env.qb-branos.live-backup (SUPABASE_URL, SERVICE_ROLE, ANON).
 */

import fs from 'node:fs';
import { deflateSync } from 'node:zlib';

const ENV_PATH = '/tmp/.env.qb-branos.live-backup';
const BASE = process.env.QB_BASE || 'https://quantumbranding.ai';
// Optional Cookie header for protected preview deployments (the Vercel
// share-link JWT). Empty for production.
const BASE_COOKIE = process.env.QB_COOKIE || '';
const baseCookie = BASE_COOKIE ? { Cookie: BASE_COOKIE } : {};
const AGENT = 'visual_dna_synthesizer';
const FILE_PRESENT_RUNS = 5;
const FILE_ABSENT_RUNS = 2;
const HEADROOM_GATE_MS = 35_000; // p95 file-present gate · step-5 envelope (see header)
const VISION_CAP_BYTES = 5 * 1024 * 1024;

// ─── env ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const txt = fs.readFileSync(ENV_PATH, 'utf8');
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in', ENV_PATH);
  process.exit(1);
}
const svc = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function uuid() { return crypto.randomUUID(); }

// ─── PNG generator · real decodable image, no deps ───────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makeSolidPng(width, height, r, g, b) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  const scanline = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x++) {
    scanline[1 + x * 3] = r; scanline[2 + x * 3] = g; scanline[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => scanline));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Supabase helpers (step-3E harness shapes) ────────────────────────────

async function createUser(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ email, password: `Qb-${uuid()}`, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`createUser failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return r.json();
}

async function setPassword(userId, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: svc,
    body: JSON.stringify({ password }),
  });
  if (!r.ok) throw new Error(`setPassword failed: ${r.status}`);
}

async function signIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`signIn failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  const d = await r.json();
  if (!d.access_token) throw new Error('signIn: no access_token');
  return d.access_token;
}

const TEST_QBP = {
  brandName: 'Steadfield',
  archetypePrimary: 'Sage',
  archetypeSecondary: 'Creator',
  archetypeVisualImplications: 'Calm authority. Generous whitespace. Editorial restraint.',
  colorTerritory: 'warm earth tones, deep green anchors',
  forbiddenColor: 'neon purple',
  visualTerritoryNote: 'Looks like a well-set field guide, not a startup deck.',
  typographyNote: 'Serif display with quiet humanist body.',
  antiVoice: 'No hype. No exclamation marks. No buzzwords.',
};

async function ensureProfile(userId, email) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: userId, email, tier: 'free', qbp: TEST_QBP }),
  });
  if (!r.ok) throw new Error(`ensureProfile failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
}

async function uploadObject(token, path, bytes, contentType) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/user-uploads/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!r.ok) throw new Error(`upload ${path} failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
}

async function signUrl(token, path) {
  const r = await fetch(`${BASE}/api/files/sign-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...baseCookie },
    body: JSON.stringify({ path }),
  });
  if (!r.ok) throw new Error(`signUrl failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return r.json();
}

async function insertDispatch(userId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, kind: 'manual', status: 'producing',
      agents_count: 1, agents_settled: 0, trigger: 'manual', agent_version: 1,
    }),
  });
  if (!r.ok) throw new Error(`insertDispatch failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return (await r.json())[0];
}

async function insertArtifact(userId, dispatchId, version) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, artifact_type: AGENT, status: 'queued', version,
      phase: '01', content: {}, dispatch_id: dispatchId,
    }),
  });
  if (!r.ok) throw new Error(`insertArtifact failed: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return (await r.json())[0];
}

async function dispatchRun({ token, userId, dispatchId, artifactId, files }) {
  const runtime_args = { qbp_source: 'current' };
  if (files && files.length) runtime_args.files = files;
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/agents/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...baseCookie },
    body: JSON.stringify({
      user_id: userId, agent_slug: AGENT, dispatch_id: dispatchId,
      artifact_id: artifactId, trigger: 'manual', runtime_args,
    }),
  });
  const wall_ms = Date.now() - t0;
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body, wall_ms };
}

async function readArtifactStatus(artifactId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts?id=eq.${artifactId}&select=status,version`, { headers: svc });
  const rows = r.ok ? await r.json().catch(() => []) : [];
  return rows?.[0] || null;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

// ─── teardown · zero debris, pass or fail ─────────────────────────────────

async function teardownRun({ user, dispatchIds, artifactIds }) {
  const steps = [];
  const step = async (label, fn) => {
    try { const d = await fn(); steps.push({ label, ok: true, ...(d || {}) }); }
    catch (e) { steps.push({ label, ok: false, error: String(e?.message || e).slice(0, 200) }); }
  };

  for (const id of dispatchIds) {
    await step(`delete agent_runs · dispatch ${id.slice(0, 8)}`, async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_runs?dispatch_id=eq.${id}`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
  }
  if (artifactIds.length) {
    await step('delete artifacts rows', async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts?id=in.(${artifactIds.join(',')})`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
    // Rerun-path artifacts reference ours as parent and carry our user_id.
    await step('delete remaining user artifacts', async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
  }
  if (dispatchIds.length) {
    await step('delete dispatch_jobs rows', async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
  }
  await step('delete agent_runs by remaining artifacts', async () => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_runs?user_id=eq.${user.id}`, { method: 'DELETE', headers: svc });
    if (!r.ok && r.status !== 404 && r.status !== 400) return { status: r.status, note: 'agent_runs may key by artifact only' };
    return { status: r.status };
  });

  // Storage: list our prefix, delete every object found.
  await step('delete storage objects under user prefix', async () => {
    const list = await fetch(`${SUPABASE_URL}/storage/v1/object/list/user-uploads`, {
      method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 100 }),
    });
    const objects = list.ok ? await list.json().catch(() => []) : [];
    for (const o of objects) {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/user-uploads/${user.id}/${o.name}`, {
        method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        if (!/not.?found/i.test(body)) throw new Error(`delete ${o.name}: ${r.status} ${body.slice(0, 100)}`);
      }
    }
    return { deleted: objects.length };
  });

  await step('delete auth user (cascades profile)', async () => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
    if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
    return { status: r.status };
  });

  // Verify absence.
  const leftovers = [];
  const expectEmpty = async (label, url) => {
    const r = await fetch(url, { headers: svc });
    const rows = r.ok ? await r.json().catch(() => []) : [];
    if (Array.isArray(rows) && rows.length > 0) leftovers.push({ label, count: rows.length });
  };
  await expectEmpty('artifacts', `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${user.id}&select=id`);
  await expectEmpty('dispatch_jobs', `${SUPABASE_URL}/rest/v1/dispatch_jobs?user_id=eq.${user.id}&select=id`);
  await step('verify storage prefix empty', async () => {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/user-uploads`, {
      method: 'POST', headers: svc, body: JSON.stringify({ prefix: user.id, limit: 100 }),
    });
    if (!r.ok) throw new Error(`list failed: ${r.status}`);
    const objects = await r.json();
    if (objects.length > 0) { leftovers.push({ label: 'storage objects', count: objects.length }); return { remaining: objects.map(o => o.name) }; }
    return { remaining: [] };
  });
  await step('verify auth user gone', async () => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { headers: svc });
    if (r.ok) { leftovers.push({ label: 'auth user', count: 1 }); return { leftover: true }; }
    return { status: r.status };
  });

  return { steps, leftovers, debris_free: leftovers.length === 0 && steps.every(s => s.ok) };
}

// ─── main ────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();
  const log = [];
  const say = (s) => { log.push(s); console.error(s); };

  let user = null;
  const dispatchIds = [];
  const artifactIds = [];
  const filePresent = [];
  const fileAbsent = [];
  let rerunResult = null;
  let fileRefsCheck = null;
  let negatives = {};
  let failureReason = null;
  let teardown = null;

  try {
    say(`[0] base=${BASE} agent=${AGENT}`);

    // 1. user + profile + JWT
    const email = `qb-step4-${uuid().slice(0, 8)}@qb-harness.test`;
    const password = `Qb-${uuid()}`;
    user = await createUser(email);
    await setPassword(user.id, password);
    await ensureProfile(user.id, email);
    const token = await signIn(email, password);
    say(`[1] user ${user.id}`);

    // 2. upload reference PNG (512x512 solid deep green) + negative objects
    const png = makeSolidPng(512, 512, 31, 91, 71);
    const pngId = uuid();
    const pngPath = `${user.id}/${pngId}.png`;
    await uploadObject(token, pngPath, png, 'image/png');
    say(`[2] reference image uploaded · ${png.length} bytes · ${pngPath}`);

    const svgPath = `${user.id}/${uuid()}.svg`;
    await uploadObject(token, svgPath, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'), 'image/svg+xml');
    const bigPath = `${user.id}/${uuid()}.png`;
    const big = Buffer.concat([png, Buffer.alloc(VISION_CAP_BYTES, 7)]); // valid PNG header, > 5 MB
    await uploadObject(token, bigPath, big, 'image/png');
    say(`[2b] negative objects uploaded · svg + ${big.length}-byte png`);

    // 3. signed URL for the reference image
    const signed = await signUrl(token, pngPath);
    if (!signed?.signed_url) throw new Error('sign-url returned no signed_url');
    const fileEntry = {
      type: 'reference-image', file_id: pngId,
      path: `user-uploads/${pngPath}`, mime: 'image/png', signed_url: signed.signed_url,
    };
    say('[3] signed URL obtained');

    // 4. file-present runs
    let version = 0;
    for (let i = 1; i <= FILE_PRESENT_RUNS; i++) {
      const dj = await insertDispatch(user.id); dispatchIds.push(dj.id);
      const art = await insertArtifact(user.id, dj.id, ++version); artifactIds.push(art.id);
      const res = await dispatchRun({ token, userId: user.id, dispatchId: dj.id, artifactId: art.id, files: [fileEntry] });
      const row = await readArtifactStatus(art.id);
      const rec = { run: i, status: res.status, delivered: row?.status === 'delivered', duration_ms: res.body?.duration_ms ?? null, wall_ms: res.wall_ms };
      filePresent.push(rec);
      say(`[4.${i}] file-present · http=${rec.status} delivered=${rec.delivered} duration_ms=${rec.duration_ms} wall_ms=${rec.wall_ms}`);
      if (!rec.delivered) throw new Error(`file-present run ${i} did not deliver: ${JSON.stringify(res.body).slice(0, 300)}`);
    }

    // 5. file_refs capture on the last file-present artifact
    {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_runs?artifact_id=eq.${artifactIds[artifactIds.length - 1]}&select=file_refs&order=started_at.desc&limit=1`, { headers: svc });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      const refs = rows?.[0]?.file_refs;
      fileRefsCheck = {
        present: Array.isArray(refs) && refs.length === 1,
        file_id_matches: refs?.[0]?.file_id === pngId,
        type_matches: refs?.[0]?.type === 'reference-image',
      };
      say(`[5] agent_runs.file_refs · ${JSON.stringify(fileRefsCheck)}`);
    }

    // 6. file-absent baseline runs
    for (let i = 1; i <= FILE_ABSENT_RUNS; i++) {
      const dj = await insertDispatch(user.id); dispatchIds.push(dj.id);
      const art = await insertArtifact(user.id, dj.id, ++version); artifactIds.push(art.id);
      const res = await dispatchRun({ token, userId: user.id, dispatchId: dj.id, artifactId: art.id, files: null });
      const row = await readArtifactStatus(art.id);
      const rec = { run: i, status: res.status, delivered: row?.status === 'delivered', duration_ms: res.body?.duration_ms ?? null, wall_ms: res.wall_ms };
      fileAbsent.push(rec);
      say(`[6.${i}] file-absent · http=${rec.status} delivered=${rec.delivered} duration_ms=${rec.duration_ms} wall_ms=${rec.wall_ms}`);
      if (!rec.delivered) throw new Error(`file-absent run ${i} did not deliver: ${JSON.stringify(res.body).slice(0, 300)}`);
    }

    // 7. rerun path (the production founder entry)
    {
      const r = await fetch(`${BASE}/api/agents/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...baseCookie },
        body: JSON.stringify({ artifact_id: artifactIds[0], files: [{ path: pngPath, type: 'reference-image' }] }),
      });
      const body = await r.json().catch(() => ({}));
      let deliveredArtifact = null;
      if (r.status === 202 && body?.artifact_id) {
        artifactIds.push(body.artifact_id);
        for (let t = 0; t < 30; t++) {
          await new Promise(rs => setTimeout(rs, 2000));
          const row = await readArtifactStatus(body.artifact_id);
          if (row?.status === 'delivered' || row?.status === 'failed') { deliveredArtifact = row; break; }
        }
      }
      if (body?.dispatch_id) dispatchIds.push(body.dispatch_id);
      rerunResult = { status: r.status, artifact_id: body?.artifact_id || null, final_status: deliveredArtifact?.status || null };
      say(`[7] rerun path · http=${r.status} final=${rerunResult.final_status}`);
      if (r.status !== 202 || rerunResult.final_status !== 'delivered') {
        throw new Error(`rerun path failed: ${JSON.stringify({ status: r.status, body }).slice(0, 300)}`);
      }
    }

    // 8. negatives · both must 400 before any dispatch
    {
      const svgRes = await fetch(`${BASE}/api/agents/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...baseCookie },
        body: JSON.stringify({ artifact_id: artifactIds[0], files: [{ path: svgPath, type: 'reference-image' }] }),
      });
      const svgBody = await svgRes.json().catch(() => ({}));
      const bigRes = await fetch(`${BASE}/api/agents/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...baseCookie },
        body: JSON.stringify({ artifact_id: artifactIds[0], files: [{ path: bigPath, type: 'reference-image' }] }),
      });
      const bigBody = await bigRes.json().catch(() => ({}));
      negatives = {
        svg_rejected: svgRes.status === 400 && /reference-image must be one of/.test(svgBody?.detail || ''),
        svg_detail: svgBody?.detail || `status=${svgRes.status}`,
        oversize_rejected: bigRes.status === 400 && /vision cap/.test(bigBody?.detail || ''),
        oversize_detail: bigBody?.detail || `status=${bigRes.status}`,
      };
      say(`[8] negatives · svg_rejected=${negatives.svg_rejected} oversize_rejected=${negatives.oversize_rejected}`);
    }
  } catch (e) {
    failureReason = String(e?.message || e);
  } finally {
    if (user?.id) teardown = await teardownRun({ user, dispatchIds, artifactIds });
  }

  // ─── latency gate ────────────────────────────────────────────────────
  const fpDur = filePresent.filter(r => typeof r.duration_ms === 'number').map(r => r.duration_ms).sort((a, b) => a - b);
  const faDur = fileAbsent.filter(r => typeof r.duration_ms === 'number').map(r => r.duration_ms).sort((a, b) => a - b);
  const latency = {
    file_present: { n: fpDur.length, p50_ms: percentile(fpDur, 50), p95_ms: percentile(fpDur, 95), min_ms: fpDur[0] ?? null, max_ms: fpDur[fpDur.length - 1] ?? null },
    file_absent: { n: faDur.length, p50_ms: percentile(faDur, 50), p95_ms: percentile(faDur, 95), min_ms: faDur[0] ?? null, max_ms: faDur[faDur.length - 1] ?? null },
    gate_threshold_ms: HEADROOM_GATE_MS,
    zero_timeouts: filePresent.every(r => r.delivered),
    gate_pass: fpDur.length >= FILE_PRESENT_RUNS
      && filePresent.every(r => r.delivered)
      && percentile(fpDur, 95) <= HEADROOM_GATE_MS,
  };

  const pass = !failureReason
    && filePresent.length === FILE_PRESENT_RUNS && filePresent.every(r => r.delivered)
    && fileAbsent.length === FILE_ABSENT_RUNS && fileAbsent.every(r => r.delivered)
    && rerunResult?.final_status === 'delivered'
    && fileRefsCheck?.present && fileRefsCheck?.file_id_matches && fileRefsCheck?.type_matches
    && negatives.svg_rejected && negatives.oversize_rejected
    && latency.gate_pass;

  const out = {
    harness: 'file-upload-real-agent',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    base_url: BASE,
    agent: AGENT,
    pass,
    failure_reason: failureReason,
    latency,
    file_present_runs: filePresent,
    file_absent_runs: fileAbsent,
    rerun_path: rerunResult,
    file_refs_check: fileRefsCheck,
    negatives,
    teardown,
    log,
  };
  fs.writeFileSync('tests/chapter-03/file-upload-real-agent.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
