// agents/war-table.js
// Chapter 2 · Step 3 · phase B · War Table Synthesizer retrofitted to the §3.5 contract.
//
// Behavior preserved from api/agents/war-table-synthesizer.js. Surface
// change only.
//
// Methodology call · qbp_fields requirements:
//   War Table's prompt says "If the QBP is mostly empty, lean on archetype
//   signals." archetypePrimary is the strategic floor · without it,
//   positioning placements and priorities are derived from nothing.
//   Declared as required:true. Every other field handles absence via the
//   prompt's fallback path and is declared required:false.
//
// artifact_dependencies note: the spec §3.2 example mentions "War Table
// reads the latest delivered Soul Map" as an artifact_dependency. The
// production code does NOT read Soul Map's delivered artifact content; it
// reads Soul Map's QBP fields (paradox, antiBrand, alwaysNever, manifesto)
// directly. artifact_dependencies is therefore [] in Chapter 2. The spec
// example is illustrative; the dependency between agents is at the QBP
// level, not the artifact level. Flagged in the verification report.

const MAX_TOKENS = 2400;
const CLAUDE_TIMEOUT_MS = 24000;
const DEFAULT_BRAND_NAME = 'Your Brand';

export const WAR_TABLE_FIELDS = [
  'brandName',
  'warTableBrief',
  'warTableTopInitiatives',
  'warTablePosture',
  'warTablePrinciples',
  'warTableNextHandoff',
  'audienceFears',
  'audienceDesires',
  'audienceLanguage',
  'audienceFriction',
  'paradox',
  'antiBrand',
  'alwaysNever',
  'manifesto',
  'archetypePrimary',
  'archetypeSecondary',
  'archetypeMarketLandscape',
  'archetypeStrategicMoat',
  'archetypeCentralParadox',
];

// archetypePrimary is the strategic floor (see header comment).
const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'war_table_synthesizer',
  phase: '01',
  tier_required: 'starter',
  display_name: 'War Table Synthesizer',
  description: 'Reads the strategic position: positioning map, binding commitments, three priorities.',
  artifact_type: 'war_table_synthesizer',
  version: 1,
  inputs: {
    qbp_fields: WAR_TABLE_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    artifact_dependencies: [],
    files: [],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  triggers: ['lock', 'manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // model field omitted · resolves to the canonical default below.
  // Per §5.2.1 (amended in step 4 amendment): latency × (retry_budget + 1)
  // must fit inside the 22 000 ms Edge budget. War Table's observed 17 s
  // worst case × 2 = 34 s would exceed the budget at retry_budget: 1.
  // Schema-invalid recovery is deferred to the reaper layer (§5.5).
  retry_budget: 0,
};

// Resolved from META.model with the canonical default fallback. See
// agents/contract.js DEFAULT_MODEL.
const MODEL = META.model || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are the War Table Synthesizer for Quantum Branding OS.

Produce the textual body of a War Table artifact: a strategic position read on the brand. Combine a positioning map, a binding always/never list, and three ranked priorities · each anchored in the user's QBP signals.

Voice: calm, editorial, direct. No marketing language, no jargon, no AI talk. Address the user as "you / your brand". Be concise. Do not pad.

Length rules (strict):
- Each prose field: ONE short paragraph, 2-3 sentences. No more.
- Each priority and placement rationale: ONE short sentence. No more.
- Always and Never items: ONE short imperative each (under 12 words).

Positioning map discipline:
- Choose two meaningful axes (e.g. Mass ↔ Bespoke, Quiet ↔ Loud, Heritage ↔ Modern, Function ↔ Emotion, Insider ↔ Open). Pick whichever two best reveal position.
- 3 or 4 placements total. EXACTLY ONE has "is_self": true. Others are competitors or category archetypes with "is_self": false.
- Every x and y is a number 0.0-1.0.
- If archetypeMarketLandscape.occupiers names competitors, use those names verbatim.

Always / Never: each list contains exactly 3 items.

Priorities: exactly THREE, ranked 1-2-3. Ordered by urgency × leverage.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "one short paragraph framing the strategic position",
  "field_rationale": "one short paragraph on why these two axes reveal the position",
  "paradox_rationale": "one short paragraph on the productive tension",
  "commitments_rationale": "one short paragraph on why these commitments and what they cost",
  "priorities_rationale": "one short paragraph on why these three and why this order",
  "decisions_ahead": "three short decisions joined with \\n\\n",
  "positioning_map": {
    "x_axis": { "low": "...", "high": "..." },
    "y_axis": { "low": "...", "high": "..." },
    "placements": [
      { "label": "Competitor or archetype name", "x": 0.30, "y": 0.55, "is_self": false },
      { "label": "Your Brand", "x": 0.82, "y": 0.30, "is_self": true }
    ]
  },
  "always_never": {
    "always": ["imperative", "imperative", "imperative"],
    "never":  ["imperative", "imperative", "imperative"]
  },
  "priorities": [
    { "rank": 1, "label": "concrete priority", "rationale": "one short sentence" },
    { "rank": 2, "label": "concrete priority", "rationale": "one short sentence" },
    { "rank": 3, "label": "concrete priority", "rationale": "one short sentence" }
  ]
}

If the QBP is mostly empty, lean on archetype signals. Still produce all required structure. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickWarTableInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of WAR_TABLE_FIELDS) {
    const v = safe[k];
    let isPresent;
    if (typeof v === 'string') {
      isPresent = v.trim().length > 0;
    } else if (typeof v === 'number') {
      isPresent = Number.isFinite(v);
    } else if (Array.isArray(v)) {
      isPresent = v.length > 0;
    } else if (v && typeof v === 'object') {
      isPresent = Object.keys(v).length > 0;
    } else {
      isPresent = false;
    }
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
    { heading: 'Opening',              prose: parsed.opening },
    { heading: 'The field',            prose: parsed.field_rationale },
    { heading: 'The paradox',          prose: parsed.paradox_rationale },
    { heading: 'Binding commitments',  prose: parsed.commitments_rationale },
    { heading: 'Three priorities',     prose: parsed.priorities_rationale },
    { heading: 'Decisions ahead',      prose: parsed.decisions_ahead },
  ];

  const data_blocks = [
    {
      type: 'positioning_map',
      title: 'The field',
      content: parsed.positioning_map && typeof parsed.positioning_map === 'object'
        ? parsed.positioning_map
        : {},
    },
    {
      type: 'always_never',
      title: 'Always / Never',
      content: parsed.always_never && typeof parsed.always_never === 'object'
        ? parsed.always_never
        : { always: [], never: [] },
    },
    {
      type: 'priority_list',
      title: 'Strategic priorities',
      content: { items: Array.isArray(parsed.priorities) ? parsed.priorities : [] },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '01 Discovery · War Table',
      title: `The Strategic Position of ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: WAR_TABLE_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickWarTableInput(qbp);

  const userBlocks = WAR_TABLE_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const userText = `User's Phase 01 strategic signals:\n\n${userBlocks}\n\nReturn only the JSON object described in your instructions.`;

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

export { run as runWarTableSynthesizer };
