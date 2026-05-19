// QB BrandOS · Shared dispatch pattern helper · Option A.
//
// Single source of truth for the four-step dispatch invariants laid down
// in CHAPTER_02_SPEC §5.1 and step-6 spec §4.2:
//
//   1. Pre-insert dispatch_jobs row (status='producing').
//   2. Pre-insert the artifact row(s) (status='queued', dispatch_id set).
//   3. Fire child /api/agents/run fetches via @vercel/functions waitUntil().
//   4. Return 202 from the caller before any child resolves.
//
// Used by:
//   - api/lock-foundation.js (agentsCount=4, kind='lock')
//   - api/artifacts/[id]/regenerate.js (agentsCount=1, kind='regenerate'),
//     wired in sub-PR 6B.
//
// Child fetches go out signed with inter-edge HMAC per §5.6 so the
// runtime sees authMode='service'. The lock-foundation caller passes a
// same-user JWT through instead, keeping authMode='user' on the child
// side. Both modes are first-class in /api/agents/run.
//
// Edge-runtime safe. Pure ESM. waitUntil is the Vercel-canonical import
// from @vercel/functions per docs verified 2026-05-19. The handler
// signature is `handler(request)` with no second arg on Vercel Edge.
// The Cloudflare-Workers `context.waitUntil` pattern is NOT used here.

import { svcHeaders } from './auth.js';
import { waitUntil } from '@vercel/functions';

// ─── HMAC envelope for inter-edge calls ──────────────────────────────────
//
// Mirrors verifyInterEdge in api/agents/run.js · same ts.body string,
// same SHA-256 hex digest. The receiving handler reads x-inter-edge-
// signature + x-inter-edge-timestamp and rejects on mismatch.

export async function signInterEdge(rawBody, secret) {
  const ts = String(Date.now());
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    'X-Inter-Edge-Signature': hex,
    'X-Inter-Edge-Timestamp': ts,
  };
}

// ─── Dispatch row insert ────────────────────────────────────────────────

async function insertDispatchJob({ supaUrl, serviceKey, payload }) {
  const r = await fetch(`${supaUrl}/rest/v1/dispatch_jobs`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`dispatch_insert_failed: ${r.status} ${t.slice(0, 200)}`);
  }
  const rows = await r.json().catch(() => []);
  const id = rows?.[0]?.id;
  if (!id) throw new Error('dispatch_insert_returned_no_id');
  return id;
}

// ─── Artifact rows insert ───────────────────────────────────────────────
//
// Inputs is a list of { slug, phase, version, parent_artifact_id }. The
// helper writes one artifacts row per slug with status='queued' and the
// supplied dispatch_id. Returns a map { [slug]: { id, version } }.
//
// Failure mode: if any insert fails, the caller is responsible for
// rolling back the dispatch_jobs row (see rollbackDispatchJob below).

async function insertArtifactRows({ supaUrl, serviceKey, userId, dispatchId, slugs }) {
  const out = {};
  for (const entry of slugs) {
    const r = await fetch(`${supaUrl}/rest/v1/artifacts`, {
      method: 'POST',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        artifact_type: entry.slug,
        status: 'queued',
        version: entry.version,
        parent_artifact_id: entry.parent_artifact_id || null,
        phase: entry.phase,
        content: {},
        error: null,
        dispatch_id: dispatchId,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`artifact_insert_failed (${entry.slug}): ${r.status} ${t.slice(0, 200)}`);
    }
    const rows = await r.json().catch(() => []);
    const row = rows?.[0];
    if (!row?.id) throw new Error(`artifact_insert_returned_no_id (${entry.slug})`);
    out[entry.slug] = { id: row.id, version: row.version };
  }
  return out;
}

// ─── Rollback ───────────────────────────────────────────────────────────

export async function rollbackDispatchJob({ supaUrl, serviceKey, dispatchId }) {
  if (!dispatchId) return;
  try {
    await fetch(
      `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}`,
      {
        method: 'DELETE',
        headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      }
    );
  } catch (e) {
    console.error('[dispatch-pattern] rollback failed', e?.message);
  }
}

// ─── Pre-insert: dispatch + artifacts atomically (caller view) ──────────
//
// On any failure, the dispatch row gets rolled back and the helper throws.
// The caller surfaces a 5xx. No partial state visible to the Console.

export async function preInsertDispatch({
  supaUrl,
  serviceKey,
  userId,
  kind,
  trigger,
  agentVersion,
  artifacts,
  // Chain orchestration (step 8A) · all optional, all NULL on user-
  // triggered paths (rerun, regenerate). Lock-foundation passes none
  // and the helper self-seeds chain_id = dispatchId post-insert.
  parentAgentSlug,
  agentSlug,
  chainId,
  chainDepth,
}) {
  const dispatchPayload = {
    user_id: userId,
    kind,
    status: 'producing',
    agents_count: artifacts.length,
    agents_settled: 0,
    trigger: trigger || kind,
    retry_count: 0,
    last_retry_at: null,
  };
  if (agentVersion != null)    dispatchPayload.agent_version    = agentVersion;
  if (parentAgentSlug != null) dispatchPayload.parent_agent_slug = parentAgentSlug;
  if (agentSlug != null)       dispatchPayload.agent_slug        = agentSlug;
  if (chainId != null)         dispatchPayload.chain_id          = chainId;
  if (chainDepth != null)      dispatchPayload.chain_depth       = chainDepth;

  const dispatchId = await insertDispatchJob({
    supaUrl, serviceKey, payload: dispatchPayload,
  });

  // Lock-foundation root · seed chain_id = dispatchId so the tree's root
  // node is self-referential. Reruns/regenerates do NOT inherit chain_id
  // (chain_id stays NULL for those paths · user-triggered, not chain-
  // triggered).
  if (kind === 'lock' && chainId == null) {
    try {
      await fetch(`${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(dispatchId)}`, {
        method: 'PATCH',
        headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
        body: JSON.stringify({ chain_id: dispatchId }),
      });
    } catch (e) {
      console.error('[dispatch-pattern] chain_id self-seed PATCH failed', e?.message);
      // Non-fatal · chain orchestration still functions with chain_id=NULL
      // on the root, just loses the "what fired in this lock run" group query.
    }
  }

  let artifactMap;
  try {
    artifactMap = await insertArtifactRows({
      supaUrl, serviceKey, userId, dispatchId, slugs: artifacts,
    });
  } catch (e) {
    await rollbackDispatchJob({ supaUrl, serviceKey, dispatchId });
    throw e;
  }

  return { dispatchId, artifacts: artifactMap };
}

// ─── Child fetch dispatch ───────────────────────────────────────────────
//
// Builds one fetch promise per child agent. Caller wraps the returned
// promise list in context.waitUntil(Promise.allSettled([...])) so the
// Edge function stays alive past the 202 return.
//
// authMode='user' path: pass userAuthHeader so /api/agents/run resolves
// the JWT and writes the run with that user's identity. The lock and
// regenerate flows both use this path.
//
// authMode='service' path: pass interEdgeSecret so the helper signs the
// HMAC envelope and /api/agents/run accepts the call without a JWT. The
// reaper uses this path (sub-PR 6C).

export async function fireChildRuns({
  baseUrl,
  children,
  userAuthHeader,
  interEdgeSecret,
}) {
  const promises = children.map(async (child) => {
    const body = JSON.stringify({
      user_id: child.user_id,
      agent_slug: child.agent_slug,
      dispatch_id: child.dispatch_id,
      artifact_id: child.artifact_id,
      trigger: child.trigger,
      runtime_args: child.runtime_args || {},
      source_artifact_id: child.source_artifact_id || null,
    });

    const headers = { 'Content-Type': 'application/json' };

    if (userAuthHeader) {
      headers.Authorization = userAuthHeader;
    } else if (interEdgeSecret) {
      const sigHeaders = await signInterEdge(body, interEdgeSecret);
      Object.assign(headers, sigHeaders);
    } else {
      throw new Error('fireChildRuns: must supply userAuthHeader or interEdgeSecret');
    }

    try {
      return await fetch(`${baseUrl}/api/agents/run`, {
        method: 'POST',
        headers,
        body,
      });
    } catch (e) {
      console.error('[dispatch-pattern] child fetch threw', child.agent_slug, e?.message);
      return null;
    }
  });

  return promises;
}

// ─── waitUntil hookup ───────────────────────────────────────────────────
//
// Vercel Edge runtime exposes waitUntil through the @vercel/functions
// package, not through a context arg on the handler. The handler
// signature is `handler(request)` (single arg). The import-based pattern
// works in prod; the typeof-check fallback awaits inline for local-dev
// environments where @vercel/functions noops or throws.

export function holdOpenForChildren({ childPromises }) {
  const all = Promise.allSettled(childPromises);
  if (typeof waitUntil === 'function') {
    try {
      waitUntil(all);
      return null;
    } catch (e) {
      // Local dev fallback when @vercel/functions cannot register
      // (e.g. vercel dev outside an active request context).
      return all;
    }
  }
  return all;
}
