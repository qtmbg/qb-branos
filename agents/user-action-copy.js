// agents/user-action-copy.js
// Chapter 2 · Step 4 · §5.8.1 canonical user-action copy resolver.
//
// When the runtime emits a user-fixable error code, the Console row
// renders the matching copy from this module. The copy is locked here
// so every surface (Console row, future email, future tooltips) renders
// the same words. The runtime writes the code to
// `agent_runs.error_payload.code`; surfaces read the code and call
// resolveUserActionCopy() with the agent's META and the error context.
//
// Per §5.8.1:
//   - missing_inputs:        Chapter 3+ file upload prerequisite
//   - qbp_field_missing:     a required QBP field is empty or absent
//   - missing_dependency:    a required upstream artifact is not delivered

import { QBP_FIELD_TO_EXERCISE } from './contract.js';

// Locked copy templates. Placeholders use {curly} braces and are filled
// by the resolver. No surface should hand-author replacement copy; if
// the methodology changes, update this module and every consumer
// re-reads the canonical string.
const TEMPLATES = {
  missing_inputs:
    "**{agent}** needs a file you haven't uploaded yet. Add the required file under the agent's input panel, then re-run.",
  qbp_field_missing:
    "**{agent}** cannot run yet. Complete **{exercise}** to provide the missing fields, then re-run.",
  missing_dependency:
    "**{agent}** is waiting on **{upstream}**. It will run automatically once **{upstream}** delivers.",
};

// Resolves canonical user-action copy for a user-fixable error code.
//
// Inputs:
//   code            · canonical error code from agents/contract.js
//                     CANONICAL_ERROR_CODES. Only the three user-fixable
//                     codes return non-null copy; everything else returns
//                     null (the runtime's failure surface for non-user-
//                     fixable codes lives on the Agent Console row itself).
//   agentMeta       · the agent's META object (uses display_name).
//   ctx             · { missingFields?, upstreamMeta? }
//                     - missingFields: array of qbp_field names that
//                       failed the required check. Used to resolve the
//                       {exercise} placeholder when multiple fields map
//                       to the same exercise (collapses to one name).
//                       When multiple exercises are missing, the copy
//                       lists them with " and ".
//                     - upstreamMeta: the dependency agent's META, used
//                       for {upstream} placeholder.
//
// Returns: string with no remaining placeholders, OR null when the code
// is not in TEMPLATES (operator-only and transient codes return null).
export function resolveUserActionCopy(code, agentMeta, ctx = {}) {
  const template = TEMPLATES[code];
  if (!template) return null;

  const agent = agentMeta?.display_name || agentMeta?.slug || 'This agent';

  if (code === 'missing_inputs') {
    return template.replace('{agent}', agent);
  }

  if (code === 'qbp_field_missing') {
    const fields = Array.isArray(ctx.missingFields) ? ctx.missingFields : [];
    const exercises = [...new Set(fields.map(f => QBP_FIELD_TO_EXERCISE[f] || 'the relevant exercise'))];
    const exerciseLabel = exercises.length === 0
      ? 'the relevant exercise'
      : exercises.length === 1
        ? exercises[0]
        : exercises.length === 2
          ? `${exercises[0]} and ${exercises[1]}`
          : `${exercises.slice(0, -1).join(', ')}, and ${exercises[exercises.length - 1]}`;
    return template.replace('{agent}', agent).replace('{exercise}', exerciseLabel);
  }

  if (code === 'missing_dependency') {
    const upstream = ctx.upstreamMeta?.display_name || ctx.upstreamMeta?.slug || 'an upstream agent';
    return template
      .replace('{agent}', agent)
      .replace(/\{upstream\}/g, upstream);
  }

  return null;
}

// Set of codes that the user can resolve themselves (vs. operator-only
// or transient codes that the runtime/reaper handle). Surfaces can use
// this to decide whether to render a CTA or the generic "Temporarily
// unavailable" copy from §5.8.2.
export const USER_FIXABLE_CODES = new Set(Object.keys(TEMPLATES));

// Generic copy for transient and operator-only states per §5.8.2.
// Renders on Console rows for: edge_timeout, model_call_failed,
// schema_validation_failed (before failed_permanently), config_missing.
// The Console row never shows technical detail to the user; that detail
// lives in agent_runs.error_payload for operator debugging.
export const TRANSIENT_COPY = "Run failed. The system is retrying automatically.";
export const PERMANENTLY_FAILED_COPY = "Run failed after multiple attempts. Try again manually, or contact support if this persists.";
export const OPERATOR_ONLY_COPY = "Temporarily unavailable. Try again later.";
