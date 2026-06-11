// agents/soul-map.js
// Chapter 2 · Step 3 · Soul Map Synthesizer retrofitted to the §3.5 contract.
//
// Behavior preserved from api/agents/soul-map-synthesizer.js. The
// retrofit reshapes the module surface only:
//   - META object per §3.5 + §11.12.1
//   - run({ qbp, dependencies, files, runtime_args, anthropicKey })
//   - canonical error codes per §11.12.1
//
// The legacy run signature accepted { qbp, anthropicKey }; the new run
// accepts dependencies, files, runtime_args too. They default to empty
// so api/agents/dispatch.js (which still ships the old call shape) keeps
// working without behavior change · this is the step 3 acceptance criterion
// "NO behavior change yet" from §13 build sequence.
//
// Spec amendment (step 3 amendment PR): §3.2 now models qbp_fields as
// typed entries `{ field, required }`. Soul Map declares every field as
// required:false so the runtime hands sparse QBPs through to the agent,
// which renders "Not yet captured" placeholders rather than refusing.

const MAX_TOKENS = 4000;
const CLAUDE_TIMEOUT_MS = 60000; // step 5 · Node runtime envelope (was the Edge-era value; see agents/contract.js budgets)
const DEFAULT_BRAND_NAME = 'Your Brand';

const SOUL_MAP_FIELDS = [
  'brandName',
  'brandEssence',
  'spark',
  'archetype',
  'manifesto',
  'antiBrand',
  'paradox',
  'alwaysNever',
];

export const META = {
  slug: 'soul_map_synthesizer',
  phase: '01',
  tier_required: 'free',
  display_name: 'Soul Map Synthesizer',
  description: 'Distills your brand essence into a readable Soul Map.',
  artifact_type: 'soul_map_synthesizer',
  version: 1,
  inputs: {
    // Per §3.2 (amended): qbp_fields entries are { field, required }.
    // Soul Map degrades gracefully on missing fields by rendering
    // "Not yet captured" placeholders, so every field is required:false.
    // The eight fields below mirror SOUL_MAP_FIELDS; Soul Map reads all
    // eight, the runtime hands them through, the agent function decides
    // how to handle absences.
    qbp_fields: [
      { field: 'brandName',    required: false },
      { field: 'brandEssence', required: false },
      { field: 'spark',        required: false },
      { field: 'archetype',    required: false },
      { field: 'manifesto',    required: false },
      { field: 'antiBrand',    required: false },
      { field: 'paradox',      required: false },
      { field: 'alwaysNever',  required: false },
    ],
    artifact_dependencies: [],
    // Forward-compat for Chapter 3 asset layer. Chapter 2 agents take
    // no files; the runtime accepts the declaration as documentation.
    files: [],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  triggers: ['lock', 'manual', 'regenerate'],
  error_codes: [
    'config_missing',     // ANTHROPIC_API_KEY missing or otherwise unconfigured
    'edge_timeout',       // Claude call exceeded CLAUDE_TIMEOUT_MS
    'model_call_failed',  // Claude returned non-2xx OR returned text we could not parse
  ],
  // model field omitted · resolves to the canonical default below.
  // Per §5.2.1, step-5 values: latency × (retry_budget + 1) must fit
  // inside the 60 000 ms Node budget. Soul Map's observed 15 s
  // worst case × 2 = 30 s would exceed the budget at retry_budget: 1.
  // Schema-invalid recovery is deferred to the reaper layer (§5.5):
  // the runtime writes failed, the reaper re-fires /api/agents/run as a
  // fresh Edge invocation within the 30s cron window.
  retry_budget: 0,
};

// Resolved from META.model with the canonical default fallback. See
// agents/contract.js DEFAULT_MODEL.
const MODEL = META.model || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are the Soul Map Synthesizer for Quantum Branding OS.

You receive a user's raw Phase 01 Soul Map answers. Your job is to produce the textual body of a synthesis artifact: a calm, editorial reflection that gives the user a clearer mirror of their own brand identity than they gave themselves.

Voice and style:
- Calm, editorial, direct. No marketing language, no jargon, no AI talk.
- Address the user using "you" and "your brand."
- Reflect what the user actually said with greater clarity and precision.
- Surface patterns or tensions they may not have noticed.

Return ONLY a JSON object with this exact shape. No prose preamble. No markdown fencing. No commentary.

{
  "essence": "Two to four sentences distilled from brandEssence and spark. Plain prose. No headings inside.",
  "paradox": "Two to four sentences expressing the central productive tension this brand holds.",
  "manifesto": "Three to six sentences. A refined version of the user's manifesto, in their voice, sharpened.",
  "archetype": "Two to four sentences on the primary archetype and how it shows up in this specific brand.",
  "what_we_are_reading": "One paragraph naming a pattern or tension you observe across the user's answers. Speak as the synthesizer.",
  "what_we_refuse": "Two to four sentences distilling antiBrand into a clear refusal statement.",
  "always": [
    "Three to seven short statements of what this brand always does. Each item one short sentence."
  ],
  "never": [
    "Three to seven short statements of what this brand never does. Each item one short sentence."
  ]
}

Rules:
- Every prose field must be non-empty. Never return an empty string.
- "always" and "never" must each contain at least three and at most seven non-empty items.
- If a source QBP field is missing, write "Not yet captured. Return to the Soul Map to add this." for that prose field rather than inventing content. For "always" and "never" lists with no source content, return three placeholder items each reading "Not yet captured. Return to the Soul Map to add this."
- Do not invent details the user did not provide.
- Do not flatter or compliment the brand.
- Do not use marketing openers like "Your brand is..." or "You are...".
- Do not include any field other than the ones above.`;

function pickSoulMapInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of SOUL_MAP_FIELDS) {
    const v = safe[k];
    const isPresent = typeof v === 'string'
      ? v.trim().length > 0
      : v && typeof v === 'object' && Object.keys(v).length > 0;
    if (isPresent) out[k] = v;
    else missing.push(k);
  }
  return { input: out, missing };
}

function defensiveParseJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, reason: 'empty-text' };
  }
  let raw = text.trim();
  const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (_) {}

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = raw.substring(start, end + 1);
    try {
      return { ok: true, value: JSON.parse(slice) };
    } catch (_) {}
  }
  return { ok: false, reason: 'parse-failed', raw };
}

async function callClaude({ apiKey, system, userText }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: userText }],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') {
      return { ok: false, retryable: false, timeout: true, status: 0, body: '' };
    }
    return { ok: false, retryable: true, status: 0, body: (e && e.message) || '' };
  }
  clearTimeout(timer);

  if (res.status === 429 || res.status >= 500) {
    return { ok: false, retryable: true, status: res.status, body: await res.text().catch(() => '') };
  }
  if (!res.ok) {
    return { ok: false, retryable: false, status: res.status, body: await res.text().catch(() => '') };
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  const usage = data?.usage || {};
  return {
    ok: true,
    text,
    raw: data,
    tokens_in: usage.input_tokens ?? null,
    tokens_out: usage.output_tokens ?? null,
  };
}

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'Essence',              prose: parsed.essence },
    { heading: 'Paradox',              prose: parsed.paradox },
    { heading: 'Manifesto',            prose: parsed.manifesto },
    { heading: 'Archetype',            prose: parsed.archetype },
    { heading: 'What we are reading',  prose: parsed.what_we_are_reading },
    { heading: 'What we refuse',       prose: parsed.what_we_refuse },
  ];

  const data_blocks = [
    {
      type: 'always_never',
      title: 'Binding commitments',
      content: {
        always: Array.isArray(parsed.always) ? parsed.always : [],
        never:  Array.isArray(parsed.never)  ? parsed.never  : [],
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '01 Discovery · Soul Axis',
      title: `The Soul of ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: SOUL_MAP_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

// The contract-conformant entry point.
//
// Inputs:
//   qbp           · profiles.qbp object
//   dependencies  · map of upstream artifact contents (unused by Soul Map)
//   files         · array of file refs (unused in Chapter 2)
//   runtime_args  · optional { feedback, qbp_source, ... }
//   anthropicKey  · ANTHROPIC_API_KEY string
//
// Returns:
//   { ok: true,  content, missing, meta }
//   { ok: false, error, stage }      · error is one of META.error_codes
export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickSoulMapInput(qbp);

  const userBlocks = SOUL_MAP_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const userText = `User's raw Phase 01 Soul Map answers:\n\n${userBlocks}\n\nReturn only the JSON object described in your instructions.`;

  let claudeRes;
  for (let attempt = 0; attempt < 2; attempt++) {
    claudeRes = await callClaude({ apiKey: anthropicKey, system: SYSTEM_PROMPT, userText });
    if (claudeRes.ok) break;
    if (!claudeRes.retryable) break;
    await new Promise(r => setTimeout(r, 600));
  }

  if (!claudeRes.ok) {
    if (claudeRes.timeout) {
      return { ok: false, error: 'edge_timeout', stage: 'claude-call' };
    }
    return {
      ok: false,
      error: 'model_call_failed',
      stage: 'claude-call',
      detail: `status=${claudeRes.status} body=${(claudeRes.body || '').slice(0, 200)}`,
    };
  }

  const parsed = defensiveParseJson(claudeRes.text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: 'model_call_failed',
      stage: 'json-parse',
      detail: (claudeRes.text || '').slice(0, 400),
    };
  }

  const content = assembleArtifact({
    parsed: parsed.value,
    brandName: (qbp && typeof qbp === 'object') ? qbp.brandName : '',
    missingFields: missing,
  });

  return {
    ok: true,
    content,
    missing,
    meta: {
      agent_slug: META.slug,
      phase: META.phase,
      model: MODEL,
      tokens_in: claudeRes.tokens_in,
      tokens_out: claudeRes.tokens_out,
      duration_ms: Date.now() - t_start,
    },
  };
}

