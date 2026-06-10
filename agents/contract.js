// agents/contract.js
// Chapter 2 · Step 3
//
// The agent contract validator. Asserts that an agent module's META
// object conforms to CHAPTER_02_SPEC §3.5 + §11.12.1 assertion 1.
//
// Pure ESM. No deps. Works in Edge runtime, Node, and the conformance
// test. The registry calls validateAgentMeta() at module load and
// refuses to register any agent whose META does not pass.

export const CANONICAL_TRIGGERS = ['lock', 'chain', 'manual', 'regenerate', 'scheduled'];
export const CANONICAL_PHASES   = ['00', '01', '02', '03', '04', '05'];
export const CANONICAL_TIERS    = ['free', 'starter', 'pro', 'agency', 'atelier'];
export const CANONICAL_FILE_SOURCES = ['user-upload', 'agent-output'];

// Per §3.5 (amended in step 3 phase B): each agent may declare which
// Anthropic model serves its run(). Matches ALLOWED_MODELS in
// api/claude.js. Agents that omit `model` resolve to DEFAULT_MODEL at
// callClaude time. The validator only enforces "if present, must be
// in the canonical set" · absence is allowed (and idiomatic for
// agents on the default).
export const CANONICAL_MODELS = [
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  // Legacy IDs retained while tools migrate
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
];
export const DEFAULT_MODEL = 'claude-sonnet-4-6';

// Per §3.5 (amended): schema-validate-and-retry budget. Default 1. The
// framework safety net beneath per-agent prompt tightening · a transient
// model schema miss self-corrects without a user-visible failure. Agents
// can override (e.g. Sensescape ships retry_budget:0 per §5.2.1 latency
// constraint).
export const DEFAULT_RETRY_BUDGET = 1;
export const MAX_RETRY_BUDGET = 5;

// Per §5.2.1 latency-budget pre-check. Edge function wall-clock ceiling is
// 25 000 ms; we reserve 3 000 ms for fetch handshake + shutdown so the
// effective per-dispatch budget is 22 000 ms. An agent's worst-case wall
// time is observed_latency × (retry_budget + 1). Exceeding the threshold
// triggers a warning at registry load (also fired through §5.8.2 operator
// channel when wired).
export const LATENCY_BUDGET_WARNING_MS = 22_000;
export const EDGE_FUNCTION_CEILING_MS = 25_000;

// Hand-maintained per-agent observed latency, sourced from each agent's
// verification report. Step 5+ replaces this with a live query on the
// last 50 agent_runs rows. The constant is a step-4 placeholder per §5.2.1.
//
// Sources:
//   soul_map_synthesizer  · step-3 phase A live happy-path · ~14-15 s
//   sensescape_synthesizer · step-3 phase B finishing (Pass 2 worst case) · 12.7 s
//   visual_dna_synthesizer · step-3 phase B live happy-path · ~22.9 s
//   war_table_synthesizer  · step-3 phase B live happy-path · ~17.0 s
export const AGENT_OBSERVED_LATENCY_MS = {
  soul_map_synthesizer:    15_000,
  sensescape_synthesizer:  12_700,
  visual_dna_synthesizer:  22_900,
  war_table_synthesizer:   17_000,
};

// Per §5.8.1: qbp_field → human-readable exercise name. Used to fill the
// {exercise name} placeholder in the canonical user-action copy for the
// qbp_field_missing code. Missing entries fall back to "the relevant
// exercise."
export const QBP_FIELD_TO_EXERCISE = {
  // Soul Map fields
  brandName:         'Soul Map exercise',
  brandEssence:      'Soul Map exercise',
  spark:             'Soul Map exercise',
  archetype:         'Soul Map exercise',
  manifesto:         'Soul Map exercise',
  antiBrand:         'Soul Map exercise',
  paradox:           'Soul Map exercise',
  alwaysNever:       'Soul Map exercise',
  // Sensescape fields
  colorTerritory:        'Sensescape exercise',
  forbiddenColor:        'Sensescape exercise',
  visualTerritoryNote:   'Sensescape exercise',
  typographyNote:        'Sensescape exercise',
  antiVoice:             'Sensescape exercise',
  brandObject:           'Sensescape exercise',
  brandMoment:           'Sensescape exercise',
  signatureGesture:      'Sensescape exercise',
  soundSignature:        'Sensescape exercise',
  sensescapeRawAnswers:  'Sensescape exercise',
  // Visual DNA exercise outputs
  visualDnaKeepCount:     'Visual DNA exercise',
  visualDnaDiscardRate:   'Visual DNA exercise',
  visualDnaKeptImages:    'Visual DNA exercise',
  visualDnaFastDiscards:  'Visual DNA exercise',
  // Archetype Compass fields
  archetypePrimary:                  'Archetype Compass exercise',
  archetypeSecondary:                'Archetype Compass exercise',
  archetypeVisualImplications:       'Archetype Compass exercise',
  archetypeVisualImplicationsFull:   'Archetype Compass exercise',
  archetypeMarketLandscape:          'Archetype Compass exercise',
  archetypeStrategicMoat:            'Archetype Compass exercise',
  archetypeCentralParadox:           'Archetype Compass exercise',
  // War Table exercise outputs
  warTableBrief:           'War Table exercise',
  warTableTopInitiatives:  'War Table exercise',
  warTablePosture:         'War Table exercise',
  warTablePrinciples:      'War Table exercise',
  warTableNextHandoff:     'War Table exercise',
  // Audience block
  audienceFears:    'Audience block in the War Table exercise',
  audienceDesires:  'Audience block in the War Table exercise',
  audienceLanguage: 'Audience block in the War Table exercise',
  audienceFriction: 'Audience block in the War Table exercise',
};

// The canonical error_codes vocabulary, per §11.12.1. Agents may
// declare a subset · the conformance test only runs the codes the
// agent declares. New codes can be added by extending this list AND
// the spec §11.12.1 enum together.
export const CANONICAL_ERROR_CODES = [
  'missing_inputs',
  'qbp_field_missing',
  'missing_dependency',
  'model_call_failed',
  'schema_validation_failed',
  'edge_timeout',
  'config_missing',
];

const SLUG_RE = /^[a-z0-9_]+$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isPositiveInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}
function isStringArray(v) {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
}

// Validates a META object against the §3.5 + §11.12.1 contract.
// Returns { ok: bool, errors: [{ path, message }] }.
//
// The validator is strict on type and shape but does NOT enforce that
// declared error_codes have matching fixtures · that is the conformance
// suite's job (assertion 3).
export function validateAgentMeta(meta) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });

  if (!isPlainObject(meta)) {
    err('', 'META must be a plain object');
    return { ok: false, errors };
  }

  // slug
  if (!isNonEmptyString(meta.slug)) {
    err('slug', 'must be a non-empty string');
  } else if (!SLUG_RE.test(meta.slug)) {
    err('slug', 'must be lowercase a-z, 0-9, and underscore only (canonical underscored)');
  }

  // phase
  if (!CANONICAL_PHASES.includes(meta.phase)) {
    err('phase', `must be one of ${JSON.stringify(CANONICAL_PHASES)}`);
  }

  // tier_required
  if (!CANONICAL_TIERS.includes(meta.tier_required)) {
    err('tier_required', `must be one of ${JSON.stringify(CANONICAL_TIERS)}`);
  }

  // display_name, description, artifact_type
  if (!isNonEmptyString(meta.display_name)) err('display_name', 'must be a non-empty string');
  if (!isNonEmptyString(meta.description))  err('description',  'must be a non-empty string');
  if (!isNonEmptyString(meta.artifact_type)) err('artifact_type', 'must be a non-empty string');

  // version
  if (!isPositiveInt(meta.version)) {
    err('version', 'must be a positive integer');
  }

  // inputs
  if (!isPlainObject(meta.inputs)) {
    err('inputs', 'must be a plain object');
  } else {
    const i = meta.inputs;

    // Per §3.2 (amended): qbp_fields is an array of { field, required }.
    // The string-array form is no longer accepted.
    if (!Array.isArray(i.qbp_fields)) {
      err('inputs.qbp_fields', 'must be an array (may be empty)');
    } else {
      i.qbp_fields.forEach((f, idx) => {
        const p = `inputs.qbp_fields[${idx}]`;
        if (!isPlainObject(f))            err(p, 'each qbp_fields entry must be an object { field, required }');
        if (!isNonEmptyString(f?.field))  err(`${p}.field`, 'must be a non-empty string');
        if (typeof f?.required !== 'boolean') err(`${p}.required`, 'must be a boolean');
      });
    }

    if (!isStringArray(i.artifact_dependencies)) {
      err('inputs.artifact_dependencies', 'must be an array of strings (may be empty)');
    }

    if (!Array.isArray(i.files)) {
      err('inputs.files', 'must be an array (may be empty)');
    } else {
      i.files.forEach((f, idx) => {
        const p = `inputs.files[${idx}]`;
        if (!isPlainObject(f))                       err(p, 'each file entry must be an object');
        if (!isNonEmptyString(f?.type))              err(`${p}.type`, 'must be a non-empty string');
        if (!CANONICAL_FILE_SOURCES.includes(f?.source)) {
          err(`${p}.source`, `must be one of ${JSON.stringify(CANONICAL_FILE_SOURCES)}`);
        }
        if (typeof f?.optional !== 'boolean')        err(`${p}.optional`, 'must be a boolean');
      });
    }

    if (!isPlainObject(i.runtime_args)) {
      err('inputs.runtime_args', 'must be a plain object (may be empty)');
    }
  }

  // triggers
  if (!Array.isArray(meta.triggers) || meta.triggers.length === 0) {
    err('triggers', 'must be a non-empty array');
  } else {
    meta.triggers.forEach((t, idx) => {
      if (!CANONICAL_TRIGGERS.includes(t)) {
        err(`triggers[${idx}]`, `${JSON.stringify(t)} not in canonical enum ${JSON.stringify(CANONICAL_TRIGGERS)}`);
      }
    });
  }

  // error_codes · per §11.12.1. Required for conformance test; the spec
  // example in §3.5 omits this field, which is a documented gap (see
  // step-3 verification report). For now we require it as a string array
  // whose entries are within CANONICAL_ERROR_CODES.
  if (!isStringArray(meta.error_codes) || meta.error_codes.length === 0) {
    err('error_codes', 'must be a non-empty string array (per §11.12.1)');
  } else {
    meta.error_codes.forEach((c, idx) => {
      if (!CANONICAL_ERROR_CODES.includes(c)) {
        err(`error_codes[${idx}]`, `${JSON.stringify(c)} not in canonical set ${JSON.stringify(CANONICAL_ERROR_CODES)}`);
      }
    });
  }

  // retry_budget · optional per §3.5 (amended). Integer in [0, MAX_RETRY_BUDGET].
  // Default DEFAULT_RETRY_BUDGET (1) when absent. Validator only checks bounds
  // when the field is present; latency-budget pre-check (§5.2.1) is a
  // separate function called from the registry.
  if (meta.retry_budget !== undefined) {
    if (!Number.isInteger(meta.retry_budget) || meta.retry_budget < 0 || meta.retry_budget > MAX_RETRY_BUDGET) {
      err('retry_budget', `must be an integer in [0, ${MAX_RETRY_BUDGET}] when declared`);
    }
  }

  // model · optional per §3.5. If present, must be in CANONICAL_MODELS.
  // Absence resolves to DEFAULT_MODEL ('claude-sonnet-4-6') at callClaude
  // time inside each agent module. The validator does NOT require model
  // because Soul Map / Visual DNA / War Table run on the default and
  // omitting the field is idiomatic. Sensescape declares Haiku explicitly
  // (see step-3 phase B verification report).
  if (meta.model !== undefined && !CANONICAL_MODELS.includes(meta.model)) {
    err('model', `${JSON.stringify(meta.model)} not in canonical set ${JSON.stringify(CANONICAL_MODELS)}`);
  }

  // artifact_type vs slug · spec §3.1 says artifact_type is the value
  // written to artifacts.artifact_type. For Chapter 1 + Chapter 2,
  // every agent uses slug == artifact_type. Warn but do not fail if they
  // diverge so future agents (e.g. an agent that produces multiple
  // artifact types) can still register.
  if (isNonEmptyString(meta.slug)
      && isNonEmptyString(meta.artifact_type)
      && meta.slug !== meta.artifact_type) {
    // not an error · informational only. The conformance test surfaces
    // it as a note. We attach it under a non-error key so callers can
    // filter on errors.length without losing the signal.
    errors.push({ path: 'artifact_type', message: `NOTE: artifact_type (${meta.artifact_type}) differs from slug (${meta.slug}). Allowed but unusual.`, level: 'note' });
  }

  const hardErrors = errors.filter(e => e.level !== 'note');
  return { ok: hardErrors.length === 0, errors };
}

// Convenience used by the registry to fail fast on import.
export function assertAgentMetaOrThrow(meta, originLabel) {
  const { ok, errors } = validateAgentMeta(meta);
  if (!ok) {
    const summary = errors
      .filter(e => e.level !== 'note')
      .map(e => `  · ${e.path}: ${e.message}`)
      .join('\n');
    throw new Error(`Agent contract violation in ${originLabel || meta?.slug || '<unknown>'}:\n${summary}`);
  }

  // §5.2.1 two-layer enforcement: hard-fail registration when
  // (retry_budget + 1) × observed_latency exceeds EDGE_FUNCTION_CEILING_MS.
  // The warning threshold (LATENCY_BUDGET_WARNING_MS) is non-fatal and
  // routed through the operator notification channel by the registry; the
  // ceiling check throws here because at that point the agent cannot fit
  // inside a single Edge invocation regardless of operator awareness.
  const check = checkLatencyBudget(meta);
  if (typeof check.worstCaseMs === 'number' && check.worstCaseMs > EDGE_FUNCTION_CEILING_MS) {
    throw new Error(
      `Agent registration rejected in ${originLabel || meta?.slug || '<unknown>'}: ` +
      `worst-case wall ${check.worstCaseMs}ms exceeds Edge ceiling ${EDGE_FUNCTION_CEILING_MS}ms ` +
      `at retry_budget=${meta?.retry_budget ?? DEFAULT_RETRY_BUDGET}. ` +
      `Drop retry_budget to 0 + tighten the prompt, OR defer to the streaming runtime (§5.2.1).`
    );
  }
}

// Per §5.2.1 latency-budget pre-check. Returns { withinBudget, worstCaseMs,
// budgetMs, message }. `withinBudget=false` means the operator should
// either drop retry_budget to 0 + tighten the prompt, OR defer to streaming
// when it lands. Caller decides what to do with the signal (log, fire
// operator notification, throw). The contract module is pure · no side
// effects.
export function checkLatencyBudget(meta) {
  const slug = meta?.slug;
  const retryBudget = Number.isInteger(meta?.retry_budget) ? meta.retry_budget : DEFAULT_RETRY_BUDGET;
  const observed = AGENT_OBSERVED_LATENCY_MS[slug];
  if (typeof observed !== 'number') {
    return {
      withinBudget: true,
      worstCaseMs: null,
      budgetMs: LATENCY_BUDGET_WARNING_MS,
      message: `no AGENT_OBSERVED_LATENCY_MS entry for ${slug || '<unknown>'} · pre-check skipped`,
    };
  }
  const worstCaseMs = observed * (retryBudget + 1);
  const withinBudget = worstCaseMs <= LATENCY_BUDGET_WARNING_MS;
  return {
    withinBudget,
    worstCaseMs,
    budgetMs: LATENCY_BUDGET_WARNING_MS,
    message: withinBudget
      ? `${slug} · worst case ${worstCaseMs}ms within ${LATENCY_BUDGET_WARNING_MS}ms budget`
      : `${slug} · worst case ${worstCaseMs}ms exceeds ${LATENCY_BUDGET_WARNING_MS}ms budget at retry_budget=${retryBudget} · drop retry_budget to 0 + tighten prompt, OR defer to streaming runtime`,
  };
}
