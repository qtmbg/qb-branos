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
const INTER_EDGE_SECRET = env.INTER_EDGE_SECRET;
const BASE = process.env.BASE_URL || 'https://quantumbranding.ai';
const POLL_INTERVAL_MS = 3_000;
const POLL_BUDGET_MS = 60_000;

if (!SUPABASE_URL || !SERVICE_KEY || !INTER_EDGE_SECRET) {
  console.error('Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + INTER_EDGE_SECRET');
  process.exit(2);
}

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

function uuid() { return crypto.randomUUID(); }

async function signInterEdge(rawBody) {
  const ts = String(Date.now());
  const hmac = crypto.createHmac('sha256', INTER_EDGE_SECRET);
  hmac.update(`${ts}.${rawBody}`);
  return {
    'X-Inter-Edge-Signature': hmac.digest('hex'),
    'X-Inter-Edge-Timestamp': ts,
  };
}

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s3e-${tag}-${ts}-${Math.random().toString(36).slice(2, 8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      email, email_confirm: true, password: 'qbinv-3e-' + uuid(),
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

async function uploadFile(userId) {
  // 1x1 PNG bytes (smallest possible valid PNG). Embed as binary upload.
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
      Authorization: `Bearer ${SERVICE_KEY}`,
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

async function signUrl(userId, path) {
  const body = JSON.stringify({ path, user_id: userId });
  const sigHeaders = await signInterEdge(body);
  const r = await fetch(`${BASE}/api/files/sign-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sigHeaders },
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

async function dispatchAgent({ userId, agentSlug, dispatchId, artifactId, runtimeArgs }) {
  const body = JSON.stringify({
    user_id: userId,
    agent_slug: agentSlug,
    dispatch_id: dispatchId,
    artifact_id: artifactId,
    trigger: 'manual',
    runtime_args: runtimeArgs,
  });
  const sigHeaders = await signInterEdge(body);
  const r = await fetch(`${BASE}/api/agents/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sigHeaders },
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

async function deleteFile(path) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/user-uploads/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => {});
}

async function deleteUser(userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
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
    log.push('[1/8] Create user + profile');
    user = await createUser('g1');
    await ensureProfile(user.id, user.email);
    log.push(`  user_id=${user.id}`);

    log.push('[2/8] Upload synthetic 1x1 PNG via service role');
    uploaded = await uploadFile(user.id);
    log.push(`  path=${uploaded.fullPath} file_id=${uploaded.file_id}`);

    log.push('[3/8] Sign URL via /api/files/sign-url (HMAC)');
    signed = await signUrl(user.id, uploaded.fullPath);
    log.push(`  signed_url present: ${!!signed.signed_url} ttl=${signed.ttl_seconds}s`);

    log.push('[4/8] Insert dispatch_jobs row');
    dispatch = await insertDispatch(user.id, 'file_test_agent');
    log.push(`  dispatch_id=${dispatch.id}`);

    log.push('[5/8] Insert artifact row (status=queued)');
    artifact = await insertArtifact(user.id, dispatch.id, 'file_test_agent');
    log.push(`  artifact_id=${artifact.id}`);

    log.push('[6/8] POST /api/agents/run with runtime_args.files (HMAC)');
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

    log.push('[7/8] Poll artifact for delivered state');
    finalArtifact = await pollUntilDelivered(artifact.id, POLL_BUDGET_MS);
    log.push(`  final status: ${finalArtifact?.status || 'unknown'}`);

    log.push('[8/8] Verify echoed file metadata in artifact content');
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
    if (uploaded?.path) await deleteFile(uploaded.path);
    if (user?.id) await deleteUser(user.id);
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
    log,
  };
  fs.writeFileSync('tests/chapter-03/file-upload-pipeline.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
