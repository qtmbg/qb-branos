// QB BrandOS · chain-trigger.js
//
// Chapter 2 · Step 8A · chain orchestration logic.
// Spec reference: chapter-02/step-8-spec.md §2.3-2.5 + §4.2.
//
// Called from /api/agents/run after a successful delivery. Looks up
// downstream agents whose inputs.dependencies include the just-
// delivered slug, checks satisfaction + tier-gate + depth-cap, and
// fires chain-triggered child runs via the same dispatch-pattern
// helper. DB-enforced idempotency via the unique partial index on
// (chain_id, agent_slug) WHERE kind='chain' (migration 016).
//
// Edge-runtime safe. Pure ESM.

import { svcHeaders } from './auth.js';
import {
  preInsertDispatch,
  fireChildRuns,
  holdOpenForChildren,
  rollbackDispatchJob,
} from './dispatch-pattern.js';
import { AGENTS, listAgentSlugs } from '../../agents/registry.js';

const CHAIN_DEPTH_CAP = 8;

// Resend operator-email helper · best-effort, non-blocking.
async function emailDepthExceeded({ resendKey, parentDispatchId, downstreamSlug, attemptedDepth }) {
  if (!resendKey) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'QB BrandOS <ops@quantumbranding.ai>',
        to: ['me@qtmbg.com'],
        subject: `QB BrandOS · chain depth exceeded (framework defect-class event)`,
        text: `Chain trigger refused.\n\n` +
              `Parent dispatch: ${parentDispatchId}\n` +
              `Downstream agent: ${downstreamSlug}\n` +
              `Attempted chain_depth: ${attemptedDepth} (cap: ${CHAIN_DEPTH_CAP})\n\n` +
              `This is a framework-bug-class event · investigate the agent registry ` +
              `dependency graph for cycles or transitive loops.`,
      }),
    });
  } catch (e) {
    console.error('[chain-trigger] depth-exceeded email send failed', e?.message);
  }
}

// Read the latest delivered artifact for each requested slug under the
// given user_id. Returns { [slug]: { id, version, updated_at } | null }.
async function readLatestDelivered({ supaUrl, serviceKey, userId, slugs }) {
  const out = {};
  await Promise.all(slugs.map(async slug => {
    const r = await fetch(
      `${supaUrl}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&artifact_type=eq.${encodeURIComponent(slug)}` +
      `&status=eq.delivered` +
      `&select=id,version,updated_at` +
      `&order=version.desc&limit=1`,
      { headers: svcHeaders(serviceKey) }
    );
    if (!r.ok) { out[slug] = null; return; }
    const rows = await r.json().catch(() => []);
    out[slug] = rows?.[0] || null;
  }));
  return out;
}

// Read profile.tier for tier-gating · returns 'free' if profile missing.
async function readTier({ supaUrl, serviceKey, userId }) {
  const r = await fetch(
    `${supaUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=tier`,
    { headers: svcHeaders(serviceKey) }
  );
  if (!r.ok) return 'free';
  const rows = await r.json().catch(() => []);
  return rows?.[0]?.tier || 'free';
}

// Simple tier-rank check · 'starter' or higher passes the gate for any
// agent that declares tier_required='starter'. 'free' fails.
const TIER_RANK = { free: 0, starter: 1, pro: 2, agency: 3, enterprise: 4 };
function canRun(profileTier, agentTierRequired) {
  const pr = TIER_RANK[profileTier] ?? 0;
  const ar = TIER_RANK[agentTierRequired] ?? 1; // default 'starter' floor
  return pr >= ar;
}

/**
 * triggerChainIfReady · called after a successful /api/agents/run delivery.
 *
 * @param {Object} args
 * @param {string} args.supaUrl
 * @param {string} args.serviceKey
 * @param {string} args.baseUrl
 * @param {string} args.userId
 * @param {string} args.upstreamSlug · slug of the agent that just delivered
 * @param {string} args.parentDispatchId · the upstream agent's dispatch_jobs.id
 * @param {string} args.interEdgeSecret · for signing chain-fired child fetches
 * @param {string} [args.resendKey]
 *
 * @returns {Promise<{candidates: string[], fired: string[], idempotent_skips: string[], depth_exceeded: string[], tier_blocked: string[], deps_unsatisfied: string[]}>}
 */
export async function triggerChainIfReady({
  supaUrl,
  serviceKey,
  baseUrl,
  userId,
  upstreamSlug,
  parentDispatchId,
  interEdgeSecret,
  resendKey,
}) {
  const summary = {
    candidates: [],
    fired: [],
    idempotent_skips: [],
    depth_exceeded: [],
    tier_blocked: [],
    deps_unsatisfied: [],
  };

  // 1. Look up the parent dispatch · need chain_id + chain_depth
  let parentDispatch;
  try {
    const r = await fetch(
      `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${encodeURIComponent(parentDispatchId)}&select=id,chain_id,chain_depth`,
      { headers: svcHeaders(serviceKey) }
    );
    if (!r.ok) return summary;
    const rows = await r.json().catch(() => []);
    parentDispatch = rows?.[0];
  } catch {
    return summary;
  }
  if (!parentDispatch) return summary;

  const rootChainId = parentDispatch.chain_id || parentDispatch.id;
  const childDepth = (parentDispatch.chain_depth ?? 0) + 1;

  // 2. Candidate downstream agents · those whose INPUTS.dependencies
  //    include upstreamSlug
  const allSlugs = listAgentSlugs();
  const candidates = allSlugs.filter(slug => {
    if (slug === upstreamSlug) return false;
    const agent = AGENTS[slug];
    const deps = agent?.META?.inputs?.artifact_dependencies || [];
    return Array.isArray(deps) && deps.includes(upstreamSlug)
      && Array.isArray(agent?.META?.triggers) && agent.META.triggers.includes('chain');
  });
  summary.candidates = candidates;
  if (candidates.length === 0) return summary;

  // 3. Read tier for gating
  const tier = await readTier({ supaUrl, serviceKey, userId });

  // 4. For each candidate · check deps satisfaction + tier-gate + depth-cap
  const childrenToFire = [];
  for (const downstreamSlug of candidates) {
    const agent = AGENTS[downstreamSlug];
    const deps = agent?.META?.inputs?.artifact_dependencies || [];
    const required = agent?.META?.tier_required || 'starter';

    // Tier-gate short-circuit
    if (!canRun(tier, required)) {
      summary.tier_blocked.push(downstreamSlug);
      continue;
    }

    // Depth-cap guard · before any DB writes
    if (childDepth > CHAIN_DEPTH_CAP) {
      summary.depth_exceeded.push(downstreamSlug);
      console.error(
        `[chain-depth-exceeded] parent=${parentDispatchId} downstream=${downstreamSlug} ` +
        `attempted_depth=${childDepth} cap=${CHAIN_DEPTH_CAP}`
      );
      // Operator email · best-effort
      emailDepthExceeded({
        resendKey, parentDispatchId, downstreamSlug, attemptedDepth: childDepth,
      }).catch(() => {});
      continue;
    }

    // Deps satisfaction · all deps must have latest delivered
    const depState = await readLatestDelivered({ supaUrl, serviceKey, userId, slugs: deps });
    const unsatisfied = deps.filter(d => !depState[d]);
    if (unsatisfied.length > 0) {
      summary.deps_unsatisfied.push(downstreamSlug);
      continue;
    }

    childrenToFire.push({ slug: downstreamSlug, agent, deps, depState });
  }

  if (childrenToFire.length === 0) return summary;

  // 5. For each survivor · attempt preInsertDispatch with kind='chain'.
  //    Catch unique-violation (23505 from PostgREST) for idempotency.
  const childPromisesAll = [];
  for (const child of childrenToFire) {
    const downstreamSlug = child.slug;
    // Compute next version for the downstream agent · max+1 globally
    let nextVersion = 1;
    try {
      const r = await fetch(
        `${supaUrl}/rest/v1/artifacts` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&artifact_type=eq.${encodeURIComponent(downstreamSlug)}` +
        `&select=version&order=version.desc&limit=1`,
        { headers: svcHeaders(serviceKey) }
      );
      const rows = r.ok ? (await r.json().catch(() => [])) : [];
      nextVersion = (rows?.[0]?.version || 0) + 1;
    } catch {}

    let result;
    try {
      result = await preInsertDispatch({
        supaUrl, serviceKey, userId,
        kind: 'chain',
        trigger: 'chain',
        agentVersion: child.agent?.META?.version ?? null,
        parentAgentSlug: upstreamSlug,
        agentSlug: downstreamSlug,
        chainId: rootChainId,
        chainDepth: childDepth,
        artifacts: [{
          slug: downstreamSlug,
          phase: child.agent?.META?.phase ?? '01',
          version: nextVersion,
          parent_artifact_id: null,
        }],
      });
    } catch (e) {
      // PostgREST 23505 surfaces as "duplicate key value violates unique
      // constraint" in the error message. Detect + skip silently · this
      // is the canonical idempotency path per spec §2.4.
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('23505') || msg.includes('duplicate key') || msg.includes('unique constraint')) {
        summary.idempotent_skips.push(downstreamSlug);
        console.log(`[chain-idempotent-skip] chain_id=${rootChainId} downstream=${downstreamSlug}`);
        continue;
      }
      console.error(`[chain-trigger] preInsertDispatch failed for ${downstreamSlug}: ${e?.message}`);
      continue;
    }

    summary.fired.push(downstreamSlug);

    // Build the child-fetch entry for fireChildRuns. Service-role HMAC
    // path (no user JWT available · /api/agents/run resolves to service
    // authMode for chain triggers).
    childPromisesAll.push({
      user_id: userId,
      agent_slug: downstreamSlug,
      dispatch_id: result.dispatchId,
      artifact_id: result.artifacts[downstreamSlug].id,
      trigger: 'chain',
      runtime_args: { qbp_source: 'current' },
      source_artifact_id: null,
    });
  }

  if (childPromisesAll.length === 0) return summary;

  // 6. Fire the chain-triggered child runs via HMAC envelope.
  try {
    const promises = await fireChildRuns({
      baseUrl, children: childPromisesAll, interEdgeSecret,
    });
    // Keep the parent Edge function alive past 202 return.
    holdOpenForChildren({ childPromises: promises });
  } catch (e) {
    console.error(`[chain-trigger] fireChildRuns setup failed: ${e?.message}`);
  }

  return summary;
}
