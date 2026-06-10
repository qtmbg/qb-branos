// agents/visual-dna.js
// Chapter 2 · Step 3 · phase B · Visual DNA Synthesizer retrofitted to the §3.5 contract.
//
// Behavior preserved from api/agents/visual-dna-synthesizer.js. Surface
// change only.
//
// Methodology call · qbp_fields requirements:
//   The agent's prompt says "If QBP is mostly empty, lean on archetype
//   signals." archetypePrimary is the methodological floor · without it,
//   palette and type recommendations are derived from nothing. Declared
//   as required:true. Every other field handles absence via the prompt's
//   fallback path and is declared required:false.

const MAX_TOKENS = 2400;
const CLAUDE_TIMEOUT_MS = 24000;
const DEFAULT_BRAND_NAME = 'Your Brand';

export const VISUAL_DNA_FIELDS = [
  'brandName',
  'visualDnaKeepCount',
  'visualDnaDiscardRate',
  'visualDnaKeptImages',
  'visualDnaFastDiscards',
  'colorTerritory',
  'forbiddenColor',
  'visualTerritoryNote',
  'typographyNote',
  'antiVoice',
  'archetypePrimary',
  'archetypeSecondary',
  'archetypeVisualImplications',
  'archetypeVisualImplicationsFull',
];

// archetypePrimary is the methodological floor (see header comment).
const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'visual_dna_synthesizer',
  phase: '01',
  tier_required: 'starter',
  display_name: 'Visual DNA Synthesizer',
  description: 'Recommends a four-swatch palette and a display+body type pairing grounded in your archetype.',
  artifact_type: 'visual_dna_synthesizer',
  version: 1,
  inputs: {
    qbp_fields: VISUAL_DNA_FIELDS.map(field => ({
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
  // must fit inside the 22 000 ms Edge budget. Visual DNA's observed
  // 22.9 s worst case × 2 = 45.8 s far exceeds the budget at
  // retry_budget: 1 (the heaviest violation of the four agents). Schema-
  // invalid recovery is deferred to the reaper layer (§5.5).
  retry_budget: 0,
};

// Resolved from META.model with the canonical default fallback. See
// agents/contract.js DEFAULT_MODEL.
const MODEL = META.model || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are the Visual DNA Synthesizer for Quantum Branding OS.

Produce the textual body of a Visual DNA artifact: a four-swatch palette plus a display + body type pairing, grounded in the user's QBP signals.

Voice: calm, editorial, direct. No marketing language, no jargon, no AI talk. Address the user as "you / your brand". Be concise. Do not pad.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph is 2-3 sentences. No more.
- Each palette and type-pairing rationale: ONE short sentence. No more.

Palette:
- Exactly four swatches in this order: Primary, Secondary, Accent, Neutral.
- Each hex matches /^#[0-9A-Fa-f]{6}$/. Six digits, leading #.
- Hex values must be plausible reads of the user's color signals. Restrained palettes for restrained brands.

Type pairing:
- Recommend real licensable families (Fraunces, Inter, EB Garamond, Söhne, DM Serif, IBM Plex, Playfair Display, Lora, Space Grotesk, etc.). No fictional fonts.
- "weight" is a string ("400", "500", "Medium", "Semibold", etc.).

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs",
  "color_rationale": "two short paragraphs",
  "typography_rationale": "two short paragraphs",
  "anti_patterns": "two short paragraphs",
  "decisions_ahead": "three short decisions joined with \\n\\n",
  "palette": [
    { "label": "Primary",   "hex": "#XXXXXX", "rationale": "one sentence" },
    { "label": "Secondary", "hex": "#XXXXXX", "rationale": "one sentence" },
    { "label": "Accent",    "hex": "#XXXXXX", "rationale": "one sentence" },
    { "label": "Neutral",   "hex": "#XXXXXX", "rationale": "one sentence" }
  ],
  "type_pairing": {
    "display": { "family": "...", "weight": "...", "rationale": "one sentence" },
    "body":    { "family": "...", "weight": "...", "rationale": "one sentence" }
  }
}

If QBP is mostly empty, lean on archetype signals. Still produce four valid hex values. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickVisualDnaInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of VISUAL_DNA_FIELDS) {
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
    { heading: 'Opening',                prose: parsed.opening },
    { heading: 'The color system',       prose: parsed.color_rationale },
    { heading: 'The typography',         prose: parsed.typography_rationale },
    { heading: 'What this brand is not', prose: parsed.anti_patterns },
    { heading: 'Decisions ahead',        prose: parsed.decisions_ahead },
  ];

  const swatches = Array.isArray(parsed.palette) ? parsed.palette : [];
  const data_blocks = [
    {
      type: 'palette',
      title: 'Color system',
      content: { swatches },
    },
    {
      type: 'type_pairing',
      title: 'Type direction',
      content: parsed.type_pairing && typeof parsed.type_pairing === 'object'
        ? parsed.type_pairing
        : {},
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '01 Discovery · Visual DNA',
      title: `The Visual Language of ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: VISUAL_DNA_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickVisualDnaInput(qbp);

  const userBlocks = VISUAL_DNA_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const userText = `User's Phase 01 visual signals:\n\n${userBlocks}\n\nReturn only the JSON object described in your instructions.`;

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

