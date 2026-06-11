// QB BrandOS · Reaper cron handler.
//
// GET /api/cron/reaper
//   user-agent: vercel-cron/1.0
//   authorization: Bearer <CRON_SECRET>
//
//   → 200 { ok, rows_examined, rows_retried, rows_flipped,
//           race_recoveries, race_partials_notified,
//           ghost_dispatches_detected, errors }
//   → 401 { error: 'unauthorized_cron_trigger', reason }
//
// The reaper is the retry safety net for the agent framework. Every
// /api/agents/run invocation is single-shot inside its own Node serverless
// budget (maxDuration 300 s per chapter-3 step 5; the pre-step-5 envelope
// was the 25 000 ms Edge budget); transient failures (edge_timeout,
// model_call_failed, schema_validation_failed) write `failed` immediately.
// The reaper picks those rows up at the next cron tick and re-fires
// `/api/agents/run` inside its own fresh invocation. The reaper itself
// runs on the Node runtime since step 5: it awaits refire responses
// inline, and a refired run may now legitimately exceed the old Edge
// window.
//
// State machine per CHAPTER_02_SPEC §5.5 + step-6 spec §6.2:
//   1. Read dispatch_jobs where status='producing'.
//   2. For each row, compute elapsed = now() - coalesce(last_retry_at, created_at).
//   3. Skip rows whose elapsed has not crossed the next backoff threshold:
//        retry_count=0 → fire if elapsed >= 60 s
//        retry_count=1 → fire if elapsed >= 120 s
//        retry_count=2 → fire if elapsed >= 300 s
//        retry_count=3 → terminal-flip check only (no fire).
//   4. Identify stuck children. A child is stuck under any of:
//        (a) agent_runs.status='failed' with error_payload.code in the
//            retry-eligible set (edge_timeout, model_call_failed,
//            schema_validation_failed). User-fixable codes are skipped.
//        (b) artifacts.status='generating' with the latest agent_runs row
//            in status='started' for more than RUN_ORPHAN_WINDOW_MS.
//        (c) artifacts.status='queued' AND no agent_runs row exists AND
//            dispatch is older than RUN_ORPHAN_WINDOW_MS. The PR #59 / #68
//            ghost case.
//   5. Re-fire /api/agents/run for each retry-eligible stuck child, signed
//      with INTER_EDGE_SECRET HMAC per §5.6 (Path 2 in step-6 spec §6.3).
//   6. Atomically increment dispatch_jobs.retry_count + write last_retry_at.
//      One increment per cron tick per dispatch, regardless of child count.
//   7. Terminal flip · retry_count=3 + elapsed >= 300 s since last_retry_at
//      → dispatch_jobs.status='failed_permanently', emit exactly one
//      dispatch_failed notification (in-app row + email).
//
// Auth: trigger path uses verifyCronTrigger from api/_lib/inter-edge-auth.js
// (CRON_SECRET). Outgoing child fetches use signInterEdge from
// api/_lib/dispatch-pattern.js (INTER_EDGE_SECRET). Two distinct secrets,
// per §6.3.

import { svcHeaders, requireEnv, json } from '../_lib/auth.js';
import { signInterEdge } from '../_lib/dispatch-pattern.js';
import { verifyCronTrigger } from '../_lib/inter-edge-auth.js';
import { emitDispatchFailed } from '../_lib/notifications.js';

// Chapter 3 step 5 · the reaper migrates with the runtime it supervises.
// It awaits each refire response (Promise.allSettled below); post-step-5 a
// refired run can take longer than the old 25 s Edge window, which would
// have cut the cron invocation mid-tick. Node maxDuration absorbs it.
export const config = { runtime: 'nodejs', maxDuration: 300 };

// ─── Backoff schedule ───────────────────────────────────────────────────
// Per step-6 spec §3 amendment + §6.2 step 2. Indexed by retry_count.
// 60 s → 120 s → 300 s. After retry 3, the +300 s window is reused as the
// terminal-flip gate (spec §6.4 trace 4).

const BACKOFF_SECONDS = [60, 120, 300];
// Step 5 re-derivation: the flip gate must exceed run.js maxDuration
// (300 s) so a final refire launched at last_retry_at cannot still be
// legitimately executing when the dispatch is declared dead. 330 s
// matches RUN_ORPHAN_WINDOW_MS. (Pre-step-5: 300 s against ≤25 s runs.)
const TERMINAL_FLIP_SECONDS = 330;

// Codes that the reaper retries. Mirrors §5.8 retry-eligible set.
const RETRYABLE_CODES = new Set([
  'edge_timeout',
  'model_call_failed',
  'schema_validation_failed',
]);

// Codes that the reaper explicitly does NOT retry. User-fixable per §5.8.
// Stuck child with one of these codes is left alone.
const USER_FIXABLE_CODES = new Set([
  'qbp_field_missing',
  'missing_inputs',
  'missing_dependency',
]);

// Run orphan window. A run in status='started' past this window is
// orphaned: the invocation cannot legitimately still be running. Step 5
// re-derivation: the runtime's maxDuration is 300 s, so a legitimate run
// can still be in flight up to that long; the window is maxDuration plus
// a 30 s scheduling margin. (Pre-step-5 this was the 25 000 ms Edge
// ceiling.) Classifying a live run as orphaned re-fires it mid-flight and
// double-executes the agent, so this constant must always exceed the
// run.js maxDuration.
const RUN_ORPHAN_WINDOW_MS = 330_000;

// Cap rows we touch in a single cron tick. The partial index on
// (status, last_retry_at) where status='producing' keeps the read cheap,
// but a defensive cap stops a stampede from blowing the cron budget if a
// deploy-wide misconfiguration ever fills the table.
const MAX_ROWS_PER_TICK = 50;

// ─── Supabase REST helpers ──────────────────────────────────────────────

async function fetchProducingDispatches({ supaUrl, serviceKey }) {
  const url = `${supaUrl}/rest/v1/dispatch_jobs` +
    `?status=eq.producing` +
    `&select=id,user_id,kind,trigger,retry_count,last_retry_at,created_at,parent_agent_slug` +
    `&order=created_at.asc&limit=${MAX_ROWS_PER_TICK}`;
  const r = await fetch(url, { headers: svcHeaders(serviceKey) });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`dispatch_jobs_read_failed: ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function fetchArtifactsForDispatch({ supaUrl, serviceKey, dispatchId }) {
  const url = `${supaUrl}/rest/v1/artifacts` +
    `?dispatch_id=eq.${encodeURIComponent(dispatchId)}` +
    `&select=id,artifact_type,status,version,parent_artifact_id,user_id,phase,created_at,updated_at` +
    `&order=created_at.asc`;
  const r = await fetch(url, { headers: svcHeaders(serviceKey) });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`artifacts_read_failed: ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
}

async function fetchLatestAgentRunForArtifact({ supaUrl, serviceKey, artifactId }) {
  const url = `${supaUrl}/rest/v1/agent_runs` +
    `?artifact_id=eq.${encodeURIComponent(artifactId)}` +
    `&select=id,status,started_at,completed_at,error_payload,trigger,runtime_args` +
    `&order=started_at.desc&limit=1`;
  const r = await fetch(url, { headers: svcHeaders(serviceKey) });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return rows?.[0] || null;
}

async function incrementDispatchRetry({ supaUrl, serviceKey, dispatchId, nextRetryCount }) {
  const r = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({
        retry_count: nextRetryCount,
        last_retry_at: new Date().toISOString(),
      }),
    }
  );
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`dispatch_retry_patch_failed: ${r.status} ${t.slice(0, 200)}`);
  }
}

// Conditional terminal flip. The status=eq.producing filter makes the
// UPDATE a compare-and-set: only a row still in 'producing' flips to
// 'failed_permanently'. Without it, a terminal state written by the run
// handler's settleDispatch between the reaper's children-read and this
// PATCH gets silently overwritten · a dispatch that actually delivered
// would be re-labelled failed_permanently and the user would get a
// dispatch_failed notification for a success.
//
// Returns the number of rows flipped (0 = lost the race · caller
// re-reads the row's current status to classify the race).
async function flipDispatchToFailedPermanently({ supaUrl, serviceKey, dispatchId }) {
  const r = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}&status=eq.producing`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'failed_permanently' }),
    }
  );
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`dispatch_terminal_flip_failed: ${r.status} ${t.slice(0, 200)}`);
  }
  // A 2xx with an unparseable body must NOT read as "zero rows": the row
  // may in fact have flipped, and returning 0 would skip the
  // notification for a dispatch that is now failed_permanently and will
  // never be re-examined (the sweep reads only status=producing). Throw
  // into the caller's terminal-flip error handling instead.
  const rows = await r.json().catch(() => null);
  if (!Array.isArray(rows)) {
    throw new Error('dispatch_terminal_flip_parse_failed: 2xx with unparseable body');
  }
  return rows.length;
}

// Single-row status read used to classify a lost terminal-flip race.
async function fetchDispatchStatus({ supaUrl, serviceKey, dispatchId }) {
  const r = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}&select=status`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`dispatch_status_read_failed: ${r.status} ${t.slice(0, 200)}`);
  }
  const rows = await r.json().catch(() => []);
  return rows?.[0]?.status ?? null;
}

// Reset a child artifact so the re-fire of /api/agents/run can pick it
// up. The run handler transitions queued → generating → delivered/failed,
// so the reaper sets status='queued' before re-firing whether the prior
// state was failed (mode a) or generating (mode b · orphaned). Ghost
// dispatches (mode c) are already 'queued', so the patch is a no-op
// without erroring.
async function resetArtifactForRetry({ supaUrl, serviceKey, artifactId }) {
  await fetch(
    `${supaUrl}/rest/v1/artifacts?id=eq.${encodeURIComponent(artifactId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'queued',
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

// ─── Stuck-child classifier ────────────────────────────────────────────
// Returns one of:
//   { stuck: false }
//   { stuck: true, mode: 'failed-retryable', reason }       (a)
//   { stuck: true, mode: 'orphaned-started', reason }       (b)
//   { stuck: true, mode: 'ghost-dispatch', reason }         (c)
//   { stuck: true, mode: 'failed-user-fixable', skip: true } (a) but user-action

function classifyChild({ artifact, latestRun, dispatchAgeMs }) {
  // (a) Most recent run failed with a known code.
  if (latestRun && latestRun.status === 'failed') {
    const code = latestRun.error_payload?.code || '';
    if (USER_FIXABLE_CODES.has(code)) {
      return { stuck: true, mode: 'failed-user-fixable', skip: true, reason: code };
    }
    if (RETRYABLE_CODES.has(code)) {
      return { stuck: true, mode: 'failed-retryable', reason: code };
    }
    // Unknown failure code · don't retry blindly. Operator-investigates.
    return { stuck: true, mode: 'failed-unknown', skip: true, reason: code || 'unknown' };
  }

  // (b) Artifact is generating + most recent run is started past the
  // orphan window.
  if (artifact.status === 'generating' && latestRun && latestRun.status === 'started') {
    const startedAt = latestRun.started_at ? Date.parse(latestRun.started_at) : NaN;
    if (Number.isFinite(startedAt) && (Date.now() - startedAt) > RUN_ORPHAN_WINDOW_MS) {
      return { stuck: true, mode: 'orphaned-started', reason: 'edge_timeout_orphan' };
    }
    return { stuck: false };
  }

  // (c) Ghost dispatch · artifact queued + no agent_runs row + dispatch
  // older than the orphan window. The §6.2 step 3 condition for the PR #59 / #68
  // failure mechanism (parent Edge tore down before the child wrote a
  // started row).
  if (artifact.status === 'queued' && !latestRun && dispatchAgeMs > RUN_ORPHAN_WINDOW_MS) {
    return { stuck: true, mode: 'ghost-dispatch', reason: 'ghost_dispatch' };
  }

  return { stuck: false };
}

// ─── Re-fire one stuck child ───────────────────────────────────────────
// Signs the HMAC envelope per §5.6 and POSTs /api/agents/run. The child
// runs a fresh Node invocation with its own maxDuration budget. We do
// NOT await the child's terminal outcome · the run handler owns the
// lifecycle and writes delivered or failed server-side.

async function refireChild({ baseUrl, interEdgeSecret, artifact, latestRun, dispatch }) {
  // Reset the artifact row so /api/agents/run sees it as queued.
  await resetArtifactForRetry({
    supaUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    artifactId: artifact.id,
  });

  // Carry the original qbp_source through. Default to 'current' when the
  // prior run did not record runtime_args (ghost-dispatch case).
  const priorArgs = latestRun?.runtime_args && typeof latestRun.runtime_args === 'object'
    ? latestRun.runtime_args
    : {};
  const qbpSource = priorArgs.qbp_source === 'original' ? 'original' : 'current';

  const body = JSON.stringify({
    user_id: artifact.user_id || dispatch.user_id,
    agent_slug: artifact.artifact_type,
    dispatch_id: dispatch.id,
    artifact_id: artifact.id,
    trigger: dispatch.trigger || dispatch.kind || 'manual',
    runtime_args: { qbp_source: qbpSource },
    source_artifact_id: artifact.parent_artifact_id || null,
  });

  const sigHeaders = await signInterEdge(body, interEdgeSecret);
  const headers = {
    'Content-Type': 'application/json',
    ...sigHeaders,
  };

  // Step 5 · fire-and-release. The child run handler owns the lifecycle
  // and writes delivered or failed server-side; post-migration its
  // invocation can legitimately run for minutes, and awaiting the
  // terminal response from inside a one-minute cron would blow the
  // reaper's own budget (the kill-before-accounting blocker from the
  // pre-merge audit). We wait only long enough to know the request was
  // accepted, then abandon the response; aborting the client fetch does
  // not abort the serverless invocation.
  const FIRE_ACK_TIMEOUT_MS = 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRE_ACK_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/agents/run`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, artifact_id: artifact.id };
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') {
      // Request sent; response abandoned by design. The child runs on.
      return { ok: true, status: 'fired_async', artifact_id: artifact.id };
    }
    console.error('[reaper] child refire threw', artifact.artifact_type, e?.message);
    return { ok: false, error: 'fetch_threw', artifact_id: artifact.id };
  }
}

// ─── Per-dispatch sweep ────────────────────────────────────────────────

async function processDispatch({ dispatch, env, baseUrl, summary }) {
  const supaUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const interEdgeSecret = env.INTER_EDGE_SECRET;

  const lastAttemptIso = dispatch.last_retry_at || dispatch.created_at;
  const lastAttemptMs = Date.parse(lastAttemptIso);
  if (!Number.isFinite(lastAttemptMs)) return;
  const elapsedSec = (Date.now() - lastAttemptMs) / 1000;
  const dispatchAgeMs = Date.now() - Date.parse(dispatch.created_at);
  const retryCount = Number.isInteger(dispatch.retry_count) ? dispatch.retry_count : 0;

  // ─── Backoff gate ────────────────────────────────────────────────────
  if (retryCount < BACKOFF_SECONDS.length) {
    const threshold = BACKOFF_SECONDS[retryCount];
    if (elapsedSec < threshold) {
      return; // Not yet · wait for the next tick.
    }
  } else {
    // retry_count >= 3 · terminal-flip gate only.
    if (elapsedSec < TERMINAL_FLIP_SECONDS) return;

    // Read children one last time. If they all transitioned to delivered
    // since the last retry, flag the dispatch as a race recovery and do
    // NOT flip (the run handler's settleDispatch should have moved it
    // off 'producing' already, but the read here is defensive).
    let children;
    try {
      children = await fetchArtifactsForDispatch({ supaUrl, serviceKey, dispatchId: dispatch.id });
    } catch (e) {
      summary.errors.push({ dispatch_id: dispatch.id, stage: 'terminal-children-read', detail: e?.message });
      return;
    }
    const anyOutstanding = (children || []).some(a => a.status !== 'delivered');
    if (!anyOutstanding) return;

    // Terminal flip + one dispatch_failed notification. The flip is a
    // conditional UPDATE (status=eq.producing); zero rows back means a
    // terminal state landed between the children-read above and this
    // write. Re-read to classify the race:
    //   completed          → genuine recovery · no notification.
    //   failed_permanently → another tick already flipped + notified.
    //   partial            → a child failure settled concurrently. This
    //     path is the system's only dispatch_failed emitter and the
    //     sweep never re-reads non-producing rows, so skipping here
    //     would silence a genuine failure forever. Fall through and
    //     notify (without counting a flip · the row stays 'partial').
    try {
      const flipped = await flipDispatchToFailedPermanently({ supaUrl, serviceKey, dispatchId: dispatch.id });
      if (flipped === 0) {
        const current = await fetchDispatchStatus({ supaUrl, serviceKey, dispatchId: dispatch.id });
        if (current !== 'partial') {
          summary.race_recoveries += 1;
          return;
        }
        summary.race_partials_notified += 1;
      } else {
        summary.rows_flipped += 1;
      }
    } catch (e) {
      summary.errors.push({ dispatch_id: dispatch.id, stage: 'terminal-flip', detail: e?.message });
      return;
    }

    const failedChild = (children || []).find(a => a.status !== 'delivered') || {};
    let reasonCode = 'transient_failure';
    if (failedChild.id) {
      const lastRun = await fetchLatestAgentRunForArtifact({
        supaUrl, serviceKey, artifactId: failedChild.id,
      });
      if (lastRun?.error_payload?.code) reasonCode = lastRun.error_payload.code;
    }

    try {
      await emitDispatchFailed({
        env,
        userId: dispatch.user_id,
        dispatchId: dispatch.id,
        agentSlug: failedChild.artifact_type || dispatch.parent_agent_slug || null,
        reason: reasonCode,
      });
    } catch (e) {
      summary.errors.push({ dispatch_id: dispatch.id, stage: 'notification', detail: e?.message });
    }
    return;
  }

  // ─── Retry tick · gather children, classify, refire ──────────────────
  let artifacts;
  try {
    artifacts = await fetchArtifactsForDispatch({ supaUrl, serviceKey, dispatchId: dispatch.id });
  } catch (e) {
    summary.errors.push({ dispatch_id: dispatch.id, stage: 'children-read', detail: e?.message });
    return;
  }

  if (!artifacts || artifacts.length === 0) return;

  const childRefires = [];
  let sawGhost = false;

  for (const artifact of artifacts) {
    if (artifact.status === 'delivered') continue;

    const latestRun = await fetchLatestAgentRunForArtifact({
      supaUrl, serviceKey, artifactId: artifact.id,
    });
    const verdict = classifyChild({ artifact, latestRun, dispatchAgeMs });

    if (!verdict.stuck) continue;
    if (verdict.skip) continue; // user-fixable or unknown · leave for user/operator

    if (verdict.mode === 'ghost-dispatch') sawGhost = true;
    childRefires.push({ artifact, latestRun, verdict });
  }

  if (sawGhost) summary.ghost_dispatches_detected += 1;

  if (childRefires.length === 0) return;

  // Step 5 · CLAIM FIRST. The retry increment moves ahead of the refires.
  // Post-migration a refired run can take minutes; if the accounting only
  // landed after the awaited refires, a platform kill mid-await would lose
  // it: retry_count/last_retry_at never advance, the 3-retry cap is
  // breached with uncounted Claude calls, and the next tick's backoff gate
  // reads stale values while this tick is still in flight (the
  // overlapping-tick double-fire). Claiming first makes the accounting
  // durable before any child fires; a kill after the claim costs at most
  // one already-counted refire round. Per §6.2 step 5, still one increment
  // per cron tick per dispatch.
  try {
    await incrementDispatchRetry({
      supaUrl, serviceKey, dispatchId: dispatch.id, nextRetryCount: retryCount + 1,
    });
    summary.rows_retried += 1;
  } catch (e) {
    summary.errors.push({ dispatch_id: dispatch.id, stage: 'retry-increment', detail: e?.message });
    // No claim, no fire. Refiring without durable accounting is exactly
    // the unbounded-retry hole the claim-first ordering closes.
    return;
  }

  // Re-fire all retry-eligible children in parallel (fire-and-release ·
  // see refireChild).
  const refires = childRefires.map(({ artifact, latestRun }) =>
    refireChild({ baseUrl, interEdgeSecret, artifact, latestRun, dispatch })
  );
  await Promise.allSettled(refires);
}

// ─── Handler ──────────────────────────────────────────────────────────

// Step 5 · Web-standard handler on the Node runtime (method exports;
// see api/agents/run.js note). Vercel cron invokes GET.
async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ─── Auth · Path 1 ──────────────────────────────────────────────────
  const triggerCheck = verifyCronTrigger(req);
  if (!triggerCheck.ok) {
    console.warn('[reaper] rejected trigger', JSON.stringify({
      reason: triggerCheck.reason,
      ua: triggerCheck.ua || '',
      ip_prefix: triggerCheck.ipPrefix || '',
    }));
    return json(401, {
      ok: false,
      error: 'unauthorized_cron_trigger',
      reason: triggerCheck.reason,
    });
  }

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    INTER_EDGE_SECRET: process.env.INTER_EDGE_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  };

  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'INTER_EDGE_SECRET');
  if (missing) {
    console.error('[reaper] missing env', missing);
    return json(503, { ok: false, error: 'config_missing', detail: missing });
  }

  const baseUrl = new URL(req.url).origin;

  const summary = {
    rows_examined: 0,
    rows_retried: 0,
    rows_flipped: 0,
    race_recoveries: 0,
    race_partials_notified: 0,
    ghost_dispatches_detected: 0,
    errors: [],
  };

  let dispatches;
  try {
    dispatches = await fetchProducingDispatches({
      supaUrl: env.SUPABASE_URL,
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
  } catch (e) {
    console.error('[reaper] dispatch read failed', e?.message);
    return json(500, {
      ok: false,
      error: 'dispatch_read_failed',
      detail: String(e?.message || '').slice(0, 200),
    });
  }

  summary.rows_examined = dispatches.length;

  for (const dispatch of dispatches) {
    try {
      await processDispatch({ dispatch, env, baseUrl, summary });
    } catch (e) {
      console.error('[reaper] processDispatch threw', dispatch.id, e?.message);
      summary.errors.push({ dispatch_id: dispatch.id, stage: 'process', detail: e?.message });
    }
  }

  return json(200, { ok: true, ...summary });
}

export const GET = handler;
export const POST = handler;
