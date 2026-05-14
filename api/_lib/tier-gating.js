// QB BrandOS — Tier gating (single source of truth)
// Pure ESM. No deps. Edge-runtime safe.
//
// Specification: CHAPTER_01_SPEC.md §5.10.
//
// Every Chapter 1 endpoint that gates by tier MUST import these helpers.
// No tier-check logic should be duplicated inline in an endpoint.

export const TIERS = ['free', 'starter', 'pro', 'agency', 'atelier'];

// Tiers that can read paid Phase 01 artifacts (everything except Soul Map).
const PAID_TIERS = new Set(['starter', 'pro', 'agency', 'atelier']);

// Tiers that can read Phase 02 agents (Logo Direction, Voice Guide, etc.).
const PHASE_02_TIERS = PAID_TIERS;

// Tiers that can read Phase 05 specific agents (Predictive Panel, Quarterly Review).
const PRO_PLUS_TIERS = new Set(['pro', 'agency', 'atelier']);

// Agents that are universally readable across tiers (free included).
const ALWAYS_FREE_AGENTS = new Set(['soul_map_synthesizer']);

// Pro+ exclusive agent slugs (Phase 05 specifically).
const PRO_PLUS_AGENTS = new Set(['predictive_panel', 'quarterly_review_agent']);

function normalizeTier(tier) {
  if (typeof tier !== 'string') return 'free';
  const t = tier.trim().toLowerCase();
  return TIERS.includes(t) ? t : 'free';
}

/**
 * Decide whether a user on `tier` may read the artifact body of an agent.
 *
 * @param {string} tier        One of TIERS. Anything outside is treated as 'free'.
 * @param {string} agent_slug  Canonical underscore slug, e.g. 'soul_map_synthesizer'.
 * @returns {boolean}
 */
export function canReadArtifact(tier, agent_slug) {
  if (ALWAYS_FREE_AGENTS.has(agent_slug)) return true;
  return PAID_TIERS.has(normalizeTier(tier));
}

/**
 * Decide whether a user on `tier` may export the QBP as a downloadable file.
 *
 * @param {string} tier
 * @returns {boolean}
 */
export function canExportQbp(tier) {
  return PAID_TIERS.has(normalizeTier(tier));
}

/**
 * Decide whether a user on `tier` may trigger a regenerate run for an artifact.
 *
 * @param {string} tier
 * @param {string} agent_slug
 * @param {string} phase  '00'-'05' or null. When omitted, phase is inferred from
 *                        the agent slug where possible.
 * @returns {boolean}
 */
export function canRegenerate(tier, agent_slug, phase) {
  const t = normalizeTier(tier);

  // Pro+ exclusive Phase 05 agents.
  if (PRO_PLUS_AGENTS.has(agent_slug)) return PRO_PLUS_TIERS.has(t);

  // Free can only regenerate Soul Map.
  if (t === 'free') return ALWAYS_FREE_AGENTS.has(agent_slug);

  // Phase-based defaults for paid tiers.
  if (phase === '05') return PRO_PLUS_TIERS.has(t);

  // Phase 01, 02, 03, 04 + unknown phase: any paid tier may regenerate.
  return PAID_TIERS.has(t);
}

/**
 * Convenience: turn a `canRead` failure into the spec-mandated 402 payload.
 *
 * @param {object} artifact_meta  { id, title, agent_slug, phase }
 * @param {string} reason         'artifact' | 'qbp_export' | 'phase_02' etc.
 * @returns {object}
 */
export function lockedArtifactPayload(artifact_meta, reason = 'artifact') {
  const slug = artifact_meta?.agent_slug || '';
  return {
    error: 'artifact_locked',
    artifact_meta: {
      id: artifact_meta?.id || null,
      title: artifact_meta?.title || null,
      agent_slug: slug,
      phase: artifact_meta?.phase || null,
    },
    upgrade_url: `/paywall?reason=${encodeURIComponent(reason)}&agent=${encodeURIComponent(slug)}`,
  };
}

export function exportGatedPayload() {
  return {
    error: 'export_gated',
    upgrade_url: '/paywall?reason=qbp_export',
  };
}
