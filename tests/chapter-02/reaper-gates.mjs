/* Chapter 2 · Step 6C acceptance gates (all seven).
 *
 * Verifies the reaper state machine per chapter-02/step-6-spec.md §6.4
 * against the production Vercel cron tick. We do NOT have CRON_SECRET
 * locally so the reaper cannot be triggered manually; instead the
 * harness inserts dispatch states with manipulated timestamps and
 * waits up to ~90 s per gate for the Vercel cron to fire the reaper.
 *
 * Strategy per gate:
 *   - Create a fresh test user.
 *   - Insert dispatch_jobs + artifacts + agent_runs in the exact state
 *     the gate prescribes, with timestamps that simulate elapsed time.
 *   - Poll dispatch_jobs (and notifications for gate 4) every 5 s for
 *     up to 90 s, watching for the expected state transition.
 *   - PASS on transition observed, FAIL on timeout.
 *   - Clean up the test user.
 *
 * Gate map per §6.4 of the spec:
 *   1. Retry 1 · stuck dispatch at elapsed >= 60 s → retry_count 0 → 1
 *   2. Retry 2 · last_retry_at + 120 s → retry_count 1 → 2
 *   3. Retry 3 · last_retry_at + 300 s → retry_count 2 → 3
 *   4. Terminal flip · retry_count=3 + 300 s → failed_permanently + 1
 *      dispatch_failed notification
 *   5. User-fixable non-retry · qbp_field_missing failure does NOT
 *      retry; retry_count stays 0
 *   6. Ghost dispatch · artifact queued + no agent_runs + dispatch
 *      older than 25 s → reaper retries
 *   7. Trigger auth · unauthenticated GET returns 401; authenticated
 *      cron tick (verified implicitly through gates 1-6) returns 200
 *
 * Inherits PR #90 harness hardening: fetch timeouts, classify-detail
 * logging, inter-run cooldown.
 *
 * Usage:
 *   node tests/chapter-02/reaper-gates.mjs
 *
 * Reads /tmp/.env.qb-branos.live-backup.
 */

import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = env.SUPABASE_ANON_KEY;
const BASE         = process.env.REAPER_BASE || 'https://quantumbranding.ai';

const FETCH_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;
const POLL_BUDGET_MS   = 90_000;

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const PASSWORD = 'qbverify-6c-' + Math.random().toString(36).slice(2, 10) + '-X1!';

const TARGET_SLUGS = [
  'soul_map_synthesizer',
  'sensescape_synthesizer',
  'visual_dna_synthesizer',
  'war_table_synthesizer',
];

async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts?.timeoutMs || FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s6c-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s6c-gates' } }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function deleteUser(userId) {
  await tfetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function insertDispatch(userId, { kind, createdAtIso, lastRetryAtIso, retryCount, status }) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, kind, status: status || 'producing',
      agents_count: TARGET_SLUGS.length, agents_settled: 0,
      trigger: kind, retry_count: retryCount ?? 0,
      last_retry_at: lastRetryAtIso || null,
      created_at: createdAtIso || undefined,
    }),
  });
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error('dispatch insert failed: ' + JSON.stringify(rows));
  return rows[0];
}

async function patchDispatch(dispatchId, patch) {
  await tfetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs?id=eq.${dispatchId}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function insertArtifact(userId, dispatchId, slug, status) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, artifact_type: slug, status: status || 'queued', version: 1,
      phase: '01', content: {}, error: null, dispatch_id: dispatchId,
    }),
  });
  const rows = await r.json();
  return rows[0];
}

async function insertAgentRun(userId, dispatchId, artifactId, slug, { status, errorCode, durationMs }) {
  const completedAt = new Date();
  const startedAt = new Date(completedAt.getTime() - (durationMs || 12_000));
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/agent_runs`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, agent_slug: slug, agent_version: 1,
      trigger: 'lock', dispatch_id: dispatchId, artifact_id: artifactId,
      qbp_snapshot: {}, file_refs: [], runtime_args: { qbp_source: 'current' },
      started_at: startedAt.toISOString(), completed_at: completedAt.toISOString(),
      status: status || 'failed', model: 'claude-sonnet-4-6',
      duration_ms: durationMs || 12_000, schema_retry_count: 0,
      error_payload: errorCode ? { code: errorCode, stage: 'claude-call' } : null,
    }),
  });
  return (await r.json())?.[0];
}

async function readDispatch(dispatchId) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs?id=eq.${dispatchId}&select=id,status,retry_count,last_retry_at`, { headers: svc });
  const rows = await r.json();
  return rows?.[0] || null;
}

async function readNotificationsForUser(userId) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${userId}&select=id,kind,payload,read_at,created_at&order=created_at.asc`, { headers: svc });
  return r.ok ? (await r.json().catch(() => [])) : [];
}

// Poll dispatch state until the predicate matches or budget expires.
async function pollDispatch(dispatchId, predicate, label) {
  const start = Date.now();
  let lastSeen = null;
  while (Date.now() - start < POLL_BUDGET_MS) {
    const d = await readDispatch(dispatchId);
    if (d) {
      lastSeen = d;
      if (predicate(d)) return { matched: true, dispatch: d, elapsedMs: Date.now() - start };
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { matched: false, dispatch: lastSeen, elapsedMs: Date.now() - start, label };
}

function nowIsoMinus(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function logResult(gate, passed, detail) {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  Gate ${gate}: ${detail}`);
}

// ─── Gate 1 · retry 1 trace ────────────────────────────────────────────────
async function gate1(userId) {
  console.log('\n── Gate 1 · retry 1 trace (elapsed ≥ 60 s since created_at) ──');
  const dispatch = await insertDispatch(userId, { kind: 'lock', createdAtIso: nowIsoMinus(65), retryCount: 0 });
  // 4 children · 3 delivered, 1 failed with edge_timeout (retry-eligible)
  for (let i = 0; i < TARGET_SLUGS.length; i++) {
    const slug = TARGET_SLUGS[i];
    const isStuck = i === 0;
    const art = await insertArtifact(userId, dispatch.id, slug, isStuck ? 'failed' : 'delivered');
    await insertAgentRun(userId, dispatch.id, art.id, slug, {
      status: isStuck ? 'failed' : 'succeeded',
      errorCode: isStuck ? 'edge_timeout' : null,
    });
  }
  const res = await pollDispatch(dispatch.id, d => d.retry_count === 1, 'retry_count == 1');
  const passed = res.matched && res.dispatch?.retry_count === 1 && res.dispatch?.last_retry_at != null;
  logResult(1, passed, passed
    ? `retry_count flipped 0→1 in ${res.elapsedMs}ms, last_retry_at written`
    : `timeout after ${res.elapsedMs}ms · final state ${JSON.stringify(res.dispatch)}`);
  return { dispatchId: dispatch.id, passed };
}

// ─── Gate 2 · retry 2 trace ────────────────────────────────────────────────
async function gate2(userId, prevDispatchId) {
  console.log('\n── Gate 2 · retry 2 trace (elapsed ≥ 120 s since last_retry_at) ──');
  // Reuse the dispatch from gate 1 but patch last_retry_at backwards
  const dispatch = await insertDispatch(userId, { kind: 'lock', createdAtIso: nowIsoMinus(300), lastRetryAtIso: nowIsoMinus(125), retryCount: 1 });
  for (let i = 0; i < TARGET_SLUGS.length; i++) {
    const slug = TARGET_SLUGS[i];
    const isStuck = i === 0;
    const art = await insertArtifact(userId, dispatch.id, slug, isStuck ? 'failed' : 'delivered');
    await insertAgentRun(userId, dispatch.id, art.id, slug, {
      status: isStuck ? 'failed' : 'succeeded',
      errorCode: isStuck ? 'edge_timeout' : null,
    });
  }
  const res = await pollDispatch(dispatch.id, d => d.retry_count === 2, 'retry_count == 2');
  const passed = res.matched && res.dispatch?.retry_count === 2;
  logResult(2, passed, passed
    ? `retry_count flipped 1→2 in ${res.elapsedMs}ms`
    : `timeout · final ${JSON.stringify(res.dispatch)}`);
  return { passed };
}

// ─── Gate 3 · retry 3 trace ────────────────────────────────────────────────
async function gate3(userId) {
  console.log('\n── Gate 3 · retry 3 trace (elapsed ≥ 300 s since last_retry_at) ──');
  const dispatch = await insertDispatch(userId, { kind: 'lock', createdAtIso: nowIsoMinus(600), lastRetryAtIso: nowIsoMinus(305), retryCount: 2 });
  for (let i = 0; i < TARGET_SLUGS.length; i++) {
    const slug = TARGET_SLUGS[i];
    const isStuck = i === 0;
    const art = await insertArtifact(userId, dispatch.id, slug, isStuck ? 'failed' : 'delivered');
    await insertAgentRun(userId, dispatch.id, art.id, slug, {
      status: isStuck ? 'failed' : 'succeeded',
      errorCode: isStuck ? 'edge_timeout' : null,
    });
  }
  const res = await pollDispatch(dispatch.id, d => d.retry_count === 3, 'retry_count == 3');
  const passed = res.matched && res.dispatch?.retry_count === 3;
  logResult(3, passed, passed
    ? `retry_count flipped 2→3 in ${res.elapsedMs}ms`
    : `timeout · final ${JSON.stringify(res.dispatch)}`);
  return { passed };
}

// ─── Gate 4 · terminal flip + notification ─────────────────────────────────
async function gate4(userId) {
  console.log('\n── Gate 4 · terminal flip (retry_count=3 + elapsed ≥ 300 s) ──');
  const dispatch = await insertDispatch(userId, { kind: 'lock', createdAtIso: nowIsoMinus(900), lastRetryAtIso: nowIsoMinus(305), retryCount: 3 });
  for (let i = 0; i < TARGET_SLUGS.length; i++) {
    const slug = TARGET_SLUGS[i];
    const isStuck = i === 0;
    const art = await insertArtifact(userId, dispatch.id, slug, isStuck ? 'failed' : 'delivered');
    await insertAgentRun(userId, dispatch.id, art.id, slug, {
      status: isStuck ? 'failed' : 'succeeded',
      errorCode: isStuck ? 'edge_timeout' : null,
    });
  }
  const res = await pollDispatch(dispatch.id, d => d.status === 'failed_permanently', "status == 'failed_permanently'");
  let notifFound = false;
  let notifCount = 0;
  if (res.matched) {
    const notifs = await readNotificationsForUser(userId);
    const dispatchFails = notifs.filter(n => n.kind === 'dispatch_failed' && n.payload?.dispatch_id === dispatch.id);
    notifFound = dispatchFails.length >= 1;
    notifCount = dispatchFails.length;
  }
  const passed = res.matched && notifFound;
  logResult(4, passed, passed
    ? `status='failed_permanently' in ${res.elapsedMs}ms, ${notifCount} dispatch_failed notification(s)`
    : res.matched
      ? `status flipped but no notification found · count=${notifCount}`
      : `timeout · final ${JSON.stringify(res.dispatch)}`);
  return { passed, dispatchId: dispatch.id };
}

// ─── Gate 5 · user-fixable non-retry ───────────────────────────────────────
async function gate5(userId) {
  console.log('\n── Gate 5 · user-fixable code (qbp_field_missing) NOT retried ──');
  const dispatch = await insertDispatch(userId, { kind: 'lock', createdAtIso: nowIsoMinus(180), retryCount: 0 });
  for (let i = 0; i < TARGET_SLUGS.length; i++) {
    const slug = TARGET_SLUGS[i];
    const isStuck = i === 0;
    const art = await insertArtifact(userId, dispatch.id, slug, isStuck ? 'failed' : 'delivered');
    await insertAgentRun(userId, dispatch.id, art.id, slug, {
      status: isStuck ? 'failed' : 'succeeded',
      errorCode: isStuck ? 'qbp_field_missing' : null,
    });
  }
  // Wait ~90s · two cron ticks. retry_count MUST stay 0.
  await new Promise(r => setTimeout(r, POLL_BUDGET_MS));
  const d = await readDispatch(dispatch.id);
  const passed = d?.retry_count === 0 && d?.status === 'producing';
  logResult(5, passed, passed
    ? `retry_count stayed 0 across ~90s, status still 'producing' (not retried)`
    : `retry_count=${d?.retry_count} status=${d?.status} · user-fixable code was unexpectedly retried`);
  return { passed };
}

// ─── Gate 6 · ghost dispatch detection ─────────────────────────────────────
async function gate6(userId) {
  console.log('\n── Gate 6 · ghost dispatch (queued artifact, no agent_runs, dispatch > 25s) ──');
  const dispatch = await insertDispatch(userId, { kind: 'lock', createdAtIso: nowIsoMinus(40), retryCount: 0 });
  // Insert artifacts in queued status but ZERO agent_runs rows
  for (const slug of TARGET_SLUGS) {
    await insertArtifact(userId, dispatch.id, slug, 'queued');
  }
  const res = await pollDispatch(dispatch.id, d => d.retry_count === 1, 'retry_count == 1 (ghost retried)');
  const passed = res.matched;
  logResult(6, passed, passed
    ? `ghost dispatch retried · retry_count 0→1 in ${res.elapsedMs}ms`
    : `timeout · ghost not detected · final ${JSON.stringify(res.dispatch)}`);
  return { passed };
}

// ─── Gate 7 · trigger auth (401 path) ──────────────────────────────────────
async function gate7() {
  console.log('\n── Gate 7 · trigger auth · unauthenticated returns 401 ──');
  // No auth headers
  const r1 = await tfetch(`${BASE}/api/cron/reaper`);
  // Bad bearer
  const r2 = await tfetch(`${BASE}/api/cron/reaper`, { headers: { Authorization: 'Bearer wrong-token' } });
  // Bad user-agent (no Vercel cron UA) · still 401 because the secret/ua combo must match
  const r3 = await tfetch(`${BASE}/api/cron/reaper`, { headers: { Authorization: 'Bearer x', 'User-Agent': 'curl/test' } });
  const passNoAuth = r1.status === 401;
  const passBadBearer = r2.status === 401;
  const passBadUA = r3.status === 401;
  const passed = passNoAuth && passBadBearer && passBadUA;
  logResult(7, passed, `no-auth=${r1.status}, bad-bearer=${r2.status}, bad-ua=${r3.status} · all expect 401`);
  console.log('  (200 path implicitly verified by gates 1-6 above; real Vercel cron tick fires the reaper with the real CRON_SECRET)');
  return { passed };
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log(`reaper-gates · 7 gates against ${BASE}`);
  console.log(`Poll budget per gate: ${POLL_BUDGET_MS}ms · poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log('');

  // Gate 7 (auth 401) first · no DB state needed
  const g7 = await gate7();

  // Gates 1-6 use one fresh user each for clean isolation
  const results = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: g7.passed };

  let user1; try {
    user1 = await createUser('g1');
    const g1 = await gate1(user1.id);
    results[1] = g1.passed;
  } catch (e) { console.log(`  ERROR  Gate 1: ${e?.message || e}`); }
  finally { if (user1?.id) await deleteUser(user1.id); }

  let user2; try {
    user2 = await createUser('g2');
    const g2 = await gate2(user2.id);
    results[2] = g2.passed;
  } catch (e) { console.log(`  ERROR  Gate 2: ${e?.message || e}`); }
  finally { if (user2?.id) await deleteUser(user2.id); }

  let user3; try {
    user3 = await createUser('g3');
    const g3 = await gate3(user3.id);
    results[3] = g3.passed;
  } catch (e) { console.log(`  ERROR  Gate 3: ${e?.message || e}`); }
  finally { if (user3?.id) await deleteUser(user3.id); }

  let user4; try {
    user4 = await createUser('g4');
    const g4 = await gate4(user4.id);
    results[4] = g4.passed;
  } catch (e) { console.log(`  ERROR  Gate 4: ${e?.message || e}`); }
  finally { if (user4?.id) await deleteUser(user4.id); }

  let user5; try {
    user5 = await createUser('g5');
    const g5 = await gate5(user5.id);
    results[5] = g5.passed;
  } catch (e) { console.log(`  ERROR  Gate 5: ${e?.message || e}`); }
  finally { if (user5?.id) await deleteUser(user5.id); }

  let user6; try {
    user6 = await createUser('g6');
    const g6 = await gate6(user6.id);
    results[6] = g6.passed;
  } catch (e) { console.log(`  ERROR  Gate 6: ${e?.message || e}`); }
  finally { if (user6?.id) await deleteUser(user6.id); }

  console.log('\n── Summary ──────────────────────────────────────────');
  for (let g = 1; g <= 7; g++) {
    console.log(`  Gate ${g}: ${results[g] ? 'PASS' : 'FAIL'}`);
  }
  const all = Object.values(results).every(Boolean);
  console.log(`\nOverall: ${all ? 'PASS · all seven gates green' : 'FAIL · at least one gate failed'}`);

  fs.writeFileSync('tests/chapter-02/reaper-gates.last-run.json',
    JSON.stringify({ base: BASE, results, all_pass: all }, null, 2));
  if (!all) process.exitCode = 1;
})();
