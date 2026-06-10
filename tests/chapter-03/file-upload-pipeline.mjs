/* Chapter 3 · Step 3E · repro gate · file-upload-pipeline
 *
 * Per chapter-03/step-3-spec.md §3 sub-PR 3E + Call 6 (synthetic
 * file_test_agent) adjudication.
 *
 * INVARIANT:
 *   A user-uploaded file flows end-to-end through:
 *     upload (service-role write to user-uploads bucket) →
 *     sign (POST /api/files/sign-url via HMAC) →
 *     dispatch (POST /api/agents/run with runtime_args.files via HMAC) →
 *     run (file_test_agent receives runtime_args.files, echoes content) →
 *     artifact (rows[0].content.body_sections[0].prose contains the
 *               file-test-json marker with matching file_id + signed_url_present:true)
 *
 * Requires FILE_TEST_AGENT=1 to be set in Vercel Production env. The
 * synthetic file_test_agent loads only under that strict-equality flag.
 * Operator routes the flag set + remove, same as chain_test_agent.
 *
 * Usage:
 *   node tests/chapter-03/file-upload-pipeline.mjs
 *
 * Required env (sourced from /tmp/.env.qb-branos.live-backup):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTER_EDGE_SECRET
 */

import fs from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = env.SUPABASE_ANON_KEY;
const BASE = process.env.BASE_URL || 'https://quantumbranding.ai';
const POLL_INTERVAL_MS = 3_000;
const POLL_BUDGET_MS = 60_000;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY');
  process.exit(2);
}

// Auth path: user JWT (the primary user-facing path). The /api/files/sign-url
// and /api/agents/run endpoints both verify JWT via /auth/v1/user round-trip.
// The harness creates a test user, signs in to get an access_token, and
// uses that JWT for both endpoints. Service role is used only for setup
// (creating dispatch_jobs + artifact rows · which are normally inserted
// by api/agents/rerun.js, bypassed here so the harness tests run.js
// directly with file plumbing in isolation).

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

function uuid() { return crypto.randomUUID(); }

const TEST_PASSWORD = 'qbinv-3e-' + uuid();

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s3e-${tag}-${ts}-${Math.random().toString(36).slice(2, 8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      email, email_confirm: true, password: TEST_PASSWORD,
      user_metadata: { signup_source: 'c3-s3e-file-upload-pipeline' },
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`createUser failed: ${r.status} ${body.slice(0, 200)}`);
  }
  const d = await r.json();
  return { id: d.id, email };
}

async function signIn(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`signIn failed: ${r.status} ${body.slice(0, 200)}`);
  }
  const d = await r.json();
  if (!d.access_token) throw new Error('signIn: no access_token in response');
  return d.access_token;
}

async function ensureProfile(userId, email) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: userId, email, tier: 'free' }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`ensureProfile failed: ${r.status} ${body.slice(0, 200)}`);
  }
}

async function uploadFile(token, userId) {
  // Upload using the user's JWT (matches the production UI flow via
  // supabase-js · RLS enforces user_id ownership on the INSERT).
  // 1x1 PNG bytes (smallest possible valid PNG).
  const onePixelPng = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cf' +
    'c0c0c0c000000005000100a5f645400000000049454e44ae426082',
    'hex'
  );
  const fileId = uuid();
  const path = `${userId}/${fileId}.png`;

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/user-uploads/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'false',
    },
    body: onePixelPng,
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`uploadFile failed: ${r.status} ${body.slice(0, 200)}`);
  }
  return { file_id: fileId, path, fullPath: `user-uploads/${path}` };
}

async function signUrl(token, path) {
  const body = JSON.stringify({ path });
  const r = await fetch(`${BASE}/api/files/sign-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`signUrl failed: ${r.status} ${text.slice(0, 200)}`);
  }
  return r.json();
}

async function insertDispatch(userId, agentSlug) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      kind: 'manual',
      status: 'producing',
      agents_count: 1,
      agents_settled: 0,
      trigger: 'manual',
      agent_version: 1,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`insertDispatch failed: ${r.status} ${text.slice(0, 200)}`);
  }
  const rows = await r.json();
  return rows[0];
}

async function insertArtifact(userId, dispatchId, agentSlug) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      artifact_type: agentSlug,
      status: 'queued',
      version: 1,
      phase: '00',
      content: {},
      dispatch_id: dispatchId,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`insertArtifact failed: ${r.status} ${text.slice(0, 200)}`);
  }
  const rows = await r.json();
  return rows[0];
}

async function dispatchAgent({ token, userId, agentSlug, dispatchId, artifactId, runtimeArgs }) {
  const body = JSON.stringify({
    user_id: userId,
    agent_slug: agentSlug,
    dispatch_id: dispatchId,
    artifact_id: artifactId,
    trigger: 'manual',
    runtime_args: runtimeArgs,
  });
  const r = await fetch(`${BASE}/api/agents/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  const respText = await r.text().catch(() => '');
  return { status: r.status, ok: r.ok, body: respText };
}

async function readArtifact(artifactId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts?id=eq.${artifactId}&select=id,status,content,version,updated_at`, { headers: svc });
  if (!r.ok) throw new Error(`readArtifact failed: ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}

async function pollUntilDelivered(artifactId, budgetMs) {
  const deadline = Date.now() + budgetMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await readArtifact(artifactId);
    if (last && (last.status === 'delivered' || last.status === 'failed')) return last;
    await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
  }
  return last;
}

// ─── Self-teardown · zero debris, pass or fail ───────────────────────────
// The harness deletes every row and object it created, then verifies
// absence. Failures are recorded loudly in the output JSON instead of
// being swallowed (the pre-2026-06-10 teardown used .catch(() => {}),
// which left the question of leftover debris unanswerable from the
// run output).

async function teardownRun({ user, uploaded, dispatch, artifact }) {
  const steps = [];
  const step = async (label, fn) => {
    try {
      const detail = await fn();
      steps.push({ label, ok: true, ...(detail || {}) });
    } catch (e) {
      steps.push({ label, ok: false, error: String(e?.message || e).slice(0, 200) });
    }
  };

  // Child rows first, then the artifact/dispatch pair, then storage,
  // then the auth user (profiles cascade from auth admin delete).
  if (dispatch?.id) {
    await step('delete agent_runs by dispatch_id', async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_runs?dispatch_id=eq.${dispatch.id}`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
  }
  if (artifact?.id) {
    await step('delete artifacts row', async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts?id=eq.${artifact.id}`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
  }
  if (dispatch?.id) {
    await step('delete dispatch_jobs row', async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs?id=eq.${dispatch.id}`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
  }
  if (uploaded?.path) {
    await step('delete storage object', async () => {
      // Storage REST requires BOTH apikey and Authorization headers.
      // Bearer-only returns 400 "Invalid Compact JWS" · the silent-leak
      // shape that produced 73-byte orphan PNGs in user-uploads.
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/user-uploads/${uploaded.path}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        if (!/not.?found/i.test(body)) throw new Error(`status ${r.status} ${body.slice(0, 120)}`);
      }
      return { status: r.status };
    });
  }
  if (user?.id) {
    await step('delete auth user (cascades profile)', async () => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
      if (!r.ok && r.status !== 404) throw new Error(`status ${r.status}`);
      return { status: r.status };
    });
  }

  // Verify absence of everything this run created.
  const leftovers = [];
  const expectEmpty = async (label, url) => {
    try {
      const r = await fetch(url, { headers: svc });
      const rows = r.ok ? await r.json() : [];
      if (Array.isArray(rows) && rows.length > 0) leftovers.push({ label, count: rows.length });
    } catch { /* verification read failed · do not mask the teardown result */ }
  };
  if (artifact?.id) await expectEmpty('artifacts', `${SUPABASE_URL}/rest/v1/artifacts?id=eq.${artifact.id}&select=id`);
  if (dispatch?.id) {
    await expectEmpty('dispatch_jobs', `${SUPABASE_URL}/rest/v1/dispatch_jobs?id=eq.${dispatch.id}&select=id`);
    await expectEmpty('agent_runs', `${SUPABASE_URL}/rest/v1/agent_runs?dispatch_id=eq.${dispatch.id}&select=id`);
  }
  if (uploaded?.path && user?.id) {
    await step('verify storage object gone (list by prefix)', async () => {
      // The list endpoint returns real data either way · no ambiguous
      // 400-means-maybe-gone reads.
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/user-uploads`, {
        method: 'POST',
        headers: svc,
        body: JSON.stringify({ prefix: user.id, limit: 100 }),
      });
      if (!r.ok) throw new Error(`list failed: ${r.status}`);
      const objects = await r.json();
      if (Array.isArray(objects) && objects.length > 0) {
        leftovers.push({ label: 'storage objects under user prefix', count: objects.length });
        return { remaining: objects.map(o => o.name) };
      }
      return { remaining: [] };
    });
  }
  if (user?.id) {
    await step('verify auth user gone', async () => {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { headers: svc });
      if (r.ok) { leftovers.push({ label: 'auth user', count: 1 }); return { status: r.status, leftover: true }; }
      return { status: r.status };
    });
  }

  return {
    steps,
    leftovers,
    debris_free: leftovers.length === 0 && steps.every(s => s.ok),
  };
}

function extractFileTestJson(content) {
  const prose = content?.body_sections?.[0]?.prose || '';
  const m = prose.match(/<!--\s*file-test-json:\s*(\{.*\})\s*-->/);
  if (!m) return null;
  try { return JSON.parse(m[1]); }
  catch { return null; }
}

async function main() {
  const startedAt = new Date().toISOString();
  let user, uploaded, signed, dispatch, artifact, finalArtifact;
  const log = [];
  let pass = false;
  let failureReason = null;
  let dispatchResp = null;

  try {
    log.push('[1/9] Create user + profile');
    user = await createUser('g1');
    await ensureProfile(user.id, user.email);
    log.push(`  user_id=${user.id}`);

    log.push('[2/9] Sign in test user (JWT auth path)');
    const token = await signIn(user.email);
    log.push(`  JWT obtained (len=${token.length})`);

    log.push('[3/9] Upload synthetic 1x1 PNG via user JWT (RLS-enforced)');
    uploaded = await uploadFile(token, user.id);
    log.push(`  path=${uploaded.fullPath} file_id=${uploaded.file_id}`);

    log.push('[4/9] Sign URL via /api/files/sign-url (user JWT)');
    signed = await signUrl(token, uploaded.fullPath);
    log.push(`  signed_url present: ${!!signed.signed_url} ttl=${signed.ttl_seconds}s`);

    log.push('[5/9] Insert dispatch_jobs row');
    dispatch = await insertDispatch(user.id, 'file_test_agent');
    log.push(`  dispatch_id=${dispatch.id}`);

    log.push('[6/9] Insert artifact row (status=queued)');
    artifact = await insertArtifact(user.id, dispatch.id, 'file_test_agent');
    log.push(`  artifact_id=${artifact.id}`);

    log.push('[7/9] POST /api/agents/run with runtime_args.files (user JWT)');
    const runtimeArgs = {
      qbp_source: 'current',
      files: [{
        type: 'sample',
        file_id: uploaded.file_id,
        path: uploaded.fullPath,
        signed_url: signed.signed_url,
        mime: 'image/png',
      }],
    };
    dispatchResp = await dispatchAgent({
      token,
      userId: user.id,
      agentSlug: 'file_test_agent',
      dispatchId: dispatch.id,
      artifactId: artifact.id,
      runtimeArgs,
    });
    log.push(`  /api/agents/run status=${dispatchResp.status}`);
    if (!dispatchResp.ok) {
      throw new Error(`dispatch failed: ${dispatchResp.status} ${dispatchResp.body.slice(0, 300)}`);
    }

    log.push('[8/9] Poll artifact for delivered state');
    finalArtifact = await pollUntilDelivered(artifact.id, POLL_BUDGET_MS);
    log.push(`  final status: ${finalArtifact?.status || 'unknown'}`);

    log.push('[9/9] Verify echoed file metadata in artifact content');
    if (!finalArtifact || finalArtifact.status !== 'delivered') {
      throw new Error(`artifact did not reach delivered: ${finalArtifact?.status}`);
    }
    const traceJson = extractFileTestJson(finalArtifact.content);
    if (!traceJson) throw new Error('file-test-json marker missing from artifact prose');

    const echoedFile = traceJson.files?.[0];
    if (!echoedFile) throw new Error('no files in echoed runtime_args');

    const checks = {
      type_matches: echoedFile.type === 'sample',
      file_id_matches: echoedFile.file_id === uploaded.file_id,
      path_matches: echoedFile.path === uploaded.fullPath,
      mime_matches: echoedFile.mime === 'image/png',
      signed_url_present: echoedFile.signed_url_present === true,
    };

    pass = Object.values(checks).every(v => v === true);
    if (!pass) {
      failureReason = `assertions failed: ${JSON.stringify(checks)}`;
    }

    var assertions = checks;
  } catch (e) {
    pass = false;
    failureReason = e?.message || String(e);
    log.push(`ERROR: ${failureReason}`);
  } finally {
    var teardown = await teardownRun({ user, uploaded, dispatch, artifact });
    log.push(`[teardown] debris_free=${teardown.debris_free}${teardown.leftovers.length ? ` leftovers=${JSON.stringify(teardown.leftovers)}` : ''}`);
  }

  const out = {
    harness: 'file-upload-pipeline',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    base_url: BASE,
    pass,
    failure_reason: failureReason,
    invariant: 'upload → sign → dispatch → runtime_args.files → agent echoes file metadata in artifact',
    assertions: typeof assertions !== 'undefined' ? assertions : null,
    file_uploaded: uploaded ? { file_id: uploaded.file_id, path: uploaded.fullPath } : null,
    signed_url_obtained: !!signed?.signed_url,
    dispatch_response_status: dispatchResp?.status || null,
    final_artifact_status: finalArtifact?.status || null,
    teardown: typeof teardown !== 'undefined' ? teardown : null,
    log,
  };
  fs.writeFileSync('tests/chapter-03/file-upload-pipeline.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
