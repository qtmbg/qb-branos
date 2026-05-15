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
}
