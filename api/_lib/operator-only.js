// api/_lib/operator-only.js
// Recut 2026-09-20 · docs/strategy/brandos-recut-v1.md Part 12, Phase 1.
//
// The seven content agents (Phase 03 and Phase 04) leave the public
// product. They are NOT deleted and NOT unregistered: they stay in
// agents/registry.js so assertAgentMetaOrThrow keeps validating them at
// module load, and the operator keeps dispatching them normally. Every
// other account is answered as though they do not exist.
//
// Why a user-id allowlist and not an env flag: an env flag is global, so
// flipping it for the operator would expose the agents to everyone. The
// allowlist is per-account, which is the actual requirement.
//
// process.env is read INSIDE the exported functions, never at module
// init. Vercel Edge evaluates top-level process.env reads against the
// build-time snapshot, which is the chapter-3 step-3E bug that made
// FILE_TEST_AGENT present at handler-call time but absent from the
// registry map. Same trap, same avoidance. See agents/registry.js.
//
// Fails closed. With OPERATOR_USER_IDS unset, nobody is the operator and
// all seven agents are invisible to every caller including the operator.
// That is the correct default for a fresh or misconfigured deploy.

export const OPERATOR_ONLY_SLUGS = new Set([
  // Phase 03 · Content
  'newsletter_architecture_agent',
  'linkedin_strategy_agent',
  'instagram_seed_agent',
  'youtube_strategy_agent',
  'content_bridge_agent',
  // Phase 04 · Execution
  'content_repurposing_agent',
  'content_scheduler_agent',
]);

/**
 * Is this user id on the operator allowlist?
 * OPERATOR_USER_IDS is a comma-separated list of Supabase user ids.
 * @param {string} userId
 * @returns {boolean}
 */
export function isOperator(userId) {
  if (!userId) return false;
  const raw = (process.env.OPERATOR_USER_IDS || '').trim();
  if (!raw) return false;
  const id = String(userId).trim();
  return raw.split(',').some(entry => entry.trim() === id);
}

/**
 * Should this (slug, user) pair be answered as a non-existent agent?
 *
 * Callers must return their EXISTING unknown-agent response, byte for
 * byte. A distinct error code would confirm the agent exists and merely
 * is not permitted, which is the one thing this gate is for.
 *
 * @param {string} slug
 * @param {string} userId
 * @returns {boolean}
 */
export function isOperatorOnlyHidden(slug, userId) {
  return OPERATOR_ONLY_SLUGS.has(slug) && !isOperator(userId);
}
