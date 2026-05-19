// QB BrandOS. Lock Foundation.
// Vercel Edge Function
//
// POST /api/lock-foundation
//   Authorization: Bearer <supabase-access-token>
//   Body: (none)
//
//   → 202 { ok: true, lockedAt, dispatch_id, artifacts } on success
//   → 200 { ok: true, lockedAt, alreadyLocked: true }     on repeat-lock
//   → { ok: false, error } on failure
//
// Locks the user's Phase 01 foundation:
//   1. Verifies the Supabase JWT.
//   2. Verifies Phase 01 is complete (the three free-tier exercises must
//      be present in profiles.tool_completions).
//   3. Reads the user's qbp snapshot.
//   4. Writes foundation_locked_at = now() and foundation_lock_qbp = qbp
//      to profiles.
//   5. Pre-inserts a dispatch_jobs row (status='producing') plus four
//      artifacts rows (one per Phase 01 agent, status='queued',
//      dispatch_id set, version=1). See CHAPTER_02_SPEC §5.1 + step-6
//      spec §4.2 for the Option A invariants the shared helper enforces.
//   6. Fires four /api/agents/run child fetches inside context.waitUntil
//      so the Edge function stays alive past the 202 return until the
//      children establish. The parent does not observe child outcomes;
//      /api/agents/run owns the lifecycle and writes delivered / failed
//      per the §3.5 contract. The reaper (sub-PR 6C) picks up any rows
//      that get stuck.
//   7. Sends a confirmation email via Resend.
//
// Idempotent: re-calling on a locked profile returns the existing lockedAt
// without re-running the dispatch or re-sending the email.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY (optional · email is non-blocking)

import { sendEmail, renderTemplate, EMAIL_TEMPLATES } from './_lib/email.js';
import { svcHeaders } from './_lib/auth.js';
import {
  preInsertDispatch,
  fireChildRuns,
  holdOpenForChildren,
  rollbackDispatchJob,
} from './_lib/dispatch-pattern.js';
import { AGENTS, listAgentSlugs } from '../agents/registry.js';

export const config = { runtime: 'edge' };

// Free tier must complete the three free-tier exercises to lock.
// Visual DNA and War Table are paid-tier exercises and intentionally NOT
// required for lock. The lock dispatches all four synthesizers regardless;
// Visual DNA and War Table run against whatever data exists in qbp at lock
// time and are tier-gated at read. Post-upgrade, those exercises become
// completable and trigger artifact regeneration with the new data.
const REQUIRED_TOOLS = ['archetype-compass', 'soul-map', 'sensescape'];
const FOUNDATION_URL = 'https://app.quantumbranding.ai/foundation';

const ALLOWED_ORIGINS = new Set([
  'https://quantumbranding.ai',
  'https://www.quantumbranding.ai',
  'https://app.quantumbranding.ai',
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://quantumbranding.ai';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResp(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

async function sendLockEmail({ email, firstName }) {
  const vars = { first_name: firstName || 'there', foundation_url: FOUNDATION_URL };
  const tpl = EMAIL_TEMPLATES.FOUNDATION_LOCKED;
  const result = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: renderTemplate(tpl.html, vars),
    text: renderTemplate(tpl.text, vars),
    refId: tpl.refId,
  });
  if (!result.ok) {
    console.error('[lock-foundation] email send failed', result.status || '', String(result.error || '').slice(0, 300));
  }
  return result;
}

// In-flight check · sub-PR 6A spec §4.2 invariant 4. Repeat lock from the
// same user within 60 s with an active dispatch returns 409 carrying the
// existing dispatch_id. Prevents double-lock races from spamming
// dispatch_jobs + artifacts rows when the dashboard re-fires the lock
// during a refresh window.
async function findInflightLock({ supaUrl, serviceKey, userId }) {
  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
  const r = await fetch(
    `${supaUrl}/rest/v1/dispatch_jobs` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&kind=eq.lock` +
    `&status=eq.producing` +
    `&created_at=gte.${encodeURIComponent(sixtySecondsAgo)}` +
    `&select=id,created_at&order=created_at.desc&limit=1`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return rows?.[0] || null;
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsH });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsH });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
    return jsonResp(503, { ok: false, error: 'Lock service not configured' }, corsH);
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResp(401, { ok: false, error: 'Missing authorization' }, corsH);
  }

  // Step 1: resolve the JWT to a user.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    return jsonResp(401, { ok: false, error: 'Invalid session' }, corsH);
  }
  const user = await userRes.json();
  if (!user?.id) {
    return jsonResp(401, { ok: false, error: 'Invalid session' }, corsH);
  }

  // Step 2: read the profile. RLS limits to the caller's own row.
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=email,first_name,qbp,tool_completions,foundation_locked_at&id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );
  if (!profRes.ok) {
    return jsonResp(500, { ok: false, error: 'Profile read failed' }, corsH);
  }
  const profiles = await profRes.json();
  const profile = profiles?.[0];
  if (!profile) {
    return jsonResp(404, { ok: false, error: 'Profile not found' }, corsH);
  }

  // Idempotent: if already locked, return current state. No dispatch fan-out.
  if (profile.foundation_locked_at) {
    return jsonResp(
      200,
      { ok: true, lockedAt: profile.foundation_locked_at, alreadyLocked: true },
      corsH
    );
  }

  // Step 3: enforce Phase 01 completion.
  const completions = profile.tool_completions && typeof profile.tool_completions === 'object'
    ? profile.tool_completions
    : {};
  const missing = REQUIRED_TOOLS.filter(t => !completions[t]);
  if (missing.length > 0) {
    return jsonResp(
      409,
      { ok: false, error: 'Phase 01 incomplete', missing },
      corsH
    );
  }

  // Step 3b: idempotency window. Repeat lock from same user within 60 s
  // with an active 'producing' lock dispatch returns 409 with the existing
  // dispatch_id. The dashboard can poll on that id to track the in-flight
  // run instead of triggering a duplicate.
  const inflight = await findInflightLock({
    supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId: user.id,
  });
  if (inflight) {
    return jsonResp(
      409,
      { ok: false, error: 'lock_in_flight', dispatch_id: inflight.id },
      corsH
    );
  }

  // Step 4: lock. PATCH writes both columns in one request; RLS ensures
  // only the user's own row can be touched.
  const lockedAt = new Date().toISOString();
  const lockQbp = profile.qbp && typeof profile.qbp === 'object' ? profile.qbp : {};

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        foundation_locked_at: lockedAt,
        foundation_lock_qbp: lockQbp,
      }),
    }
  );
  if (!patchRes.ok) {
    const errText = await patchRes.text().catch(() => '');
    console.error('[lock-foundation] patch failed', patchRes.status, errText.slice(0, 300));
    return jsonResp(500, { ok: false, error: 'Lock write failed' }, corsH);
  }

  // Step 5: pre-insert dispatch_jobs + the four artifacts rows. If either
  // insert fails, the helper rolls back the dispatch row and throws. The
  // profile.foundation_locked_at stays set: the user is locked, but the
  // Console will see no in-flight dispatch and the operator can re-fire
  // via the rerun path if needed. Spec §4.2 invariant 1: pre-insert
  // happens BEFORE any child fetch fires.
  // Step 8C fix · filter to agents that opt into the 'lock' trigger.
  // Without this, chain-only agents (META.triggers=['chain'], e.g. the
  // synthetic chain_test_agent under CHAIN_TEST_AGENT=1) get dispatched
  // at lock time and fail with missing_dependency because their upstream
  // deps haven't delivered yet. Chain-triggered agents must be fired by
  // chain-trigger.js after their deps deliver, not by the lock fan-out.
  const slugs = listAgentSlugs().filter(slug => {
    const triggers = AGENTS[slug]?.META?.triggers;
    return Array.isArray(triggers) && triggers.includes('lock');
  });
  const artifactInputs = slugs.map(slug => {
    const agent = AGENTS[slug];
    return {
      slug,
      phase: agent.META.phase,
      version: 1,
      parent_artifact_id: null,
    };
  });

  let dispatchId;
  let artifactMap;
  try {
    const result = await preInsertDispatch({
      supaUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: user.id,
      kind: 'lock',
      trigger: 'lock',
      agentVersion: null,
      artifacts: artifactInputs,
    });
    dispatchId = result.dispatchId;
    artifactMap = result.artifacts;
  } catch (e) {
    console.error('[lock-foundation] pre-insert failed', e?.message);
    return jsonResp(500, {
      ok: false,
      error: 'dispatch_preinsert_failed',
      detail: String(e?.message || '').slice(0, 200),
    }, corsH);
  }

  // Step 6: confirmation email. Non-blocking. We do not fail the lock if
  // the email send fails; the dashboard is the source of truth.
  if (RESEND_API_KEY && profile.email) {
    await sendLockEmail({
      email: profile.email,
      firstName: profile.first_name || '',
    });
  }

  // Step 7: fire the four child runs. Spec §4.2 invariant 3: child fetches
  // go inside context.waitUntil(Promise.allSettled([...])). The same-user
  // JWT flows through so /api/agents/run resolves authMode='user'.
  const baseUrl = new URL(req.url).origin;
  const children = slugs.map(slug => ({
    user_id: user.id,
    agent_slug: slug,
    dispatch_id: dispatchId,
    artifact_id: artifactMap[slug].id,
    trigger: 'lock',
    runtime_args: { qbp_source: 'current' },
  }));

  let childPromises;
  try {
    childPromises = await fireChildRuns({
      baseUrl,
      children,
      userAuthHeader: auth,
    });
  } catch (e) {
    // fireChildRuns synchronously builds the promise list; a throw here
    // means the helper inputs were malformed. Roll the dispatch back so
    // the Console does not strand on a producing row with no children.
    console.error('[lock-foundation] fireChildRuns setup failed', e?.message);
    await rollbackDispatchJob({
      supaUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, dispatchId,
    });
    return jsonResp(500, {
      ok: false,
      error: 'dispatch_fire_failed',
      detail: String(e?.message || '').slice(0, 200),
    }, corsH);
  }

  // Hold the Edge function open so the child fetches can establish past
  // the 202 return. context.waitUntil keeps the runtime alive; the local
  // dev fallback awaits the promise inline.
  const localPending = holdOpenForChildren({ childPromises });

  // Spec §4.2 invariant 4: return 202 BEFORE any child resolves. The
  // Console sees dispatch_jobs.status='producing' and four queued
  // artifacts rows; the children flip them to delivered or failed
  // server-side.
  const artifactsResponse = slugs.map(slug => ({
    slug,
    id: artifactMap[slug].id,
    version: artifactMap[slug].version,
  }));

  // Local dev safety net: if context.waitUntil was unavailable, wait for
  // the children before returning so the response carries final state.
  if (localPending) {
    await localPending;
  }

  return jsonResp(
    202,
    {
      ok: true,
      lockedAt,
      dispatch_id: dispatchId,
      artifacts: artifactsResponse,
    },
    corsH
  );
}
