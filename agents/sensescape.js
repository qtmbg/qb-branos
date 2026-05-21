// agents/sensescape.js
// Chapter 2 · Step 3 · phase B · Sensescape Synthesizer retrofitted to the §3.5 contract.
//
// Behavior preserved from api/agents/sensescape-synthesizer.js. Surface
// change only: META + run({ qbp, dependencies, files, runtime_args,
// anthropicKey }) + canonical error codes.
//
// Methodology call · qbp_fields requirements:
//   Sensescape's existing prompt handles missing fields per-section with
//   "Not yet captured. Return to the Sensescape exercise to add this."
//   placeholders. The agent is designed to render an honest partial
//   synthesis from sparse input · same pattern as Soul Map. All fields
//   are therefore declared required:false. Surfaced in the verification
//   report; flag if a stricter floor is intended.

const MAX_TOKENS = 4000;
const CLAUDE_TIMEOUT_MS = 22000;
const DEFAULT_BRAND_NAME = 'Your Brand';

export const SENSESCAPE_FIELDS = [
  'brandName',
  'colorTerritory',
  'forbiddenColor',
  'visualTerritoryNote',
  'typographyNote',
  'antiVoice',
  'brandObject',
  'brandMoment',
  'signatureGesture',
  'soundSignature',
  'sensescapeRawAnswers',
];

const SENSES = ['Sight', 'Sound', 'Touch', 'Smell', 'Taste'];

export const META = {
  slug: 'sensescape_synthesizer',
  phase: '01',
  tier_required: 'starter',
  display_name: 'Sensescape Synthesizer',
  description: 'Translates raw sensory answers into a five-sense reading of the brand.',
  artifact_type: 'sensescape_synthesizer',
  version: 1,
  inputs: {
    qbp_fields: SENSESCAPE_FIELDS.map(field => ({ field, required: false })),
    artifact_dependencies: [],
    files: [],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  triggers: ['lock', 'manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // Sensescape's prompt is the heaviest of the four Phase 01 agents
  // (8 prose sections of 2-4 paragraphs each + 5 descriptor groups).
  // On Sonnet 4.6 it consistently exceeds the 25 s Vercel Edge budget
  // (verified in step-3 phase B · three live timeouts at both 22 s and
  // 24 s ceilings, the latter on a funded key). Haiku 4.5 is ~3-4x
  // faster on similarly-shaped editorial prose. Per-agent model
  // selection is methodology metadata, not implementation detail.
  model: 'claude-haiku-4-5-20251001',
  // Per §5.2.1 latency-budget pre-check: Sensescape worst case 12.7s × 2
  // = 25.4s exceeds the 22 000 ms warning AND 25 000 ms Edge ceiling.
  // Ships retry_budget:0 until step 6+ streaming runtime dissolves the
  // per-call wall constraint. Documented in §12 known debt.
  retry_budget: 0,
};

// Resolved at module load, used by callClaude. Falls back to the
// canonical default if a future META omits `model`.
const MODEL = META.model || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are the Sensescape Synthesizer for Quantum Branding OS.

REQUIRED OUTPUT SCHEMA (read this first; everything below restates it):

{
  "opening": "<2-3 paragraphs · string with \\n\\n separators>",
  "sight": "<2-3 paragraphs · string>",
  "sound": "<2-3 paragraphs · string>",
  "touch": "<2-3 paragraphs · string>",
  "smell": "<2-3 paragraphs · string>",
  "taste": "<2-3 paragraphs · string>",
  "anti_patterns": "<2-3 paragraphs · string>",
  "decisions_ahead": "<3 concrete decisions joined with \\n\\n · string>",
  "descriptors": {
    "Sight": ["item1", "item2", "item3"],
    "Sound": ["item1", "item2", "item3"],
    "Touch": ["item1", "item2", "item3"],
    "Smell": ["item1", "item2", "item3"],
    "Taste": ["item1", "item2", "item3"]
  }
}

ALL 8 PROSE FIELDS AND ALL 5 DESCRIPTOR GROUPS ARE MANDATORY. Each descriptor group has 3 to 5 non-empty items. Empty arrays are invalid. Missing fields are invalid.

EXAMPLE OF VALID OUTPUT (use this structure verbatim, fill the strings with content drawn from the user's QBP):

{
  "opening": "Your brand reads like a quiet room with a single warm lamp. The dominant register is restraint, but not coldness. There is care here.\\n\\nA thread runs from the brass weather instrument on the teak desk into the rustle of a hardcover book opening; the same hand made both choices.\\n\\nThe sensory commitment is to slow attention. The brand asks the reader to lean in, not the other way around.",
  "sight": "Cold seafoam green meets oxidized brass under soft ivory paper. The palette is editorial weight, not graphic punch.\\n\\nTypography wears Fraunces or EB Garamond at headline, Inter at body. Generous margins. The reader can breathe.",
  "sound": "A low piano chord held for four seconds. The rustle of a hardcover book opening.\\n\\nNo exclamation points. No hype. The voice never raises its hand.",
  "touch": "A brass weather instrument on a teak desk. Functional, well-made, quietly authoritative.\\n\\nThe signature gesture is a slow nod, a deliberate pause before answering. The brand pauses before it speaks.",
  "smell": "Beeswax on warm wood. The faint smoke of a recently extinguished candle in a small library.\\n\\nDerived from the object register. Brass implies polish. Teak implies oil-finished wood. Library implies dust and leather.",
  "taste": "Earl Grey with a thin slice of lemon, the bergamot taking the lead. Bitter chocolate at 70%.\\n\\nDerived from the color territory. Seafoam reads as cool herbal. Ink reads as deep cocoa.",
  "anti_patterns": "Not chrome. Not gradients. Not motivational typography set in oversized weights.\\n\\nNot the language of urgency. Not the cult of speed for its own sake.",
  "decisions_ahead": "Decide the studio's daylight palette under cloud cover.\\n\\nDecide whether the brand mark uses the brass color in print or only in screen.\\n\\nDecide the one piece of music that opens every long-form video.",
  "descriptors": {
    "Sight": ["seafoam", "oxidized brass", "soft ivory", "editorial margin"],
    "Sound": ["low piano", "hardcover rustle", "no exclamation"],
    "Touch": ["brass instrument", "teak desk", "slow nod"],
    "Smell": ["beeswax", "extinguished candle", "old leather"],
    "Taste": ["earl grey", "bergamot", "bitter chocolate"]
  }
}

Now apply the same structure to THIS user's input. Voice and methodology rules below.

Voice and style:
- Calm, editorial, direct. No marketing language, no jargon, no AI talk.
- Address the user using "you" and "your brand."
- Translate raw answers into sensory specifics. Avoid abstractions ("calm", "elegant"); favor concrete physical detail ("brushed brass on cold stone", "footsteps on bleached oak").
- Each prose section is two to three paragraphs, separated by \\n\\n inside the JSON string.

The user's Sensescape exercise emphasizes sight, sound, and touch (an object, a moment, a gesture). Smell and taste are usually implied rather than stated. When the QBP lacks direct signal for a sense, derive it from the strongest adjacent signal · the object can imply smell, the color territory can imply taste, the signature gesture can imply touch · and say so plainly.

The 8 required body sections, numbered:
1. opening
2. sight
3. sound
4. smell
5. taste
6. touch
7. anti_patterns
8. decisions_ahead

All 8 are mandatory. Omitting any one returns invalid output.

Rules:
- Every prose field must be non-empty. Never return an empty string.
- Each "descriptors" group MUST contain 3 to 5 non-empty items. Empty arrays are invalid output. There are exactly 5 descriptor groups (Sight, Sound, Touch, Smell, Taste); each one must have 3-5 items, each item one to three words.
- If a QBP field is missing, write "Not yet captured. Return to the Sensescape exercise to add this." for the affected prose field, and use the same placeholder repeated three times for the affected descriptor group. Placeholder counts as a valid item · empty arrays are still invalid.
- Do not invent quotes, awards, partnerships, or facts the user did not provide.
- Do not flatter or compliment the brand.
- Do not include any field other than the ones above.

Return ONLY a JSON object matching the schema above. No prose preamble. No markdown fencing. No commentary.

Before returning, verify:
- All 8 body sections present with non-empty prose
- All 5 descriptor groups present, each with 3-5 non-empty items
- No empty arrays anywhere`;

function pickSensescapeInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of SENSESCAPE_FIELDS) {
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
    { heading: 'Opening',                 prose: parsed.opening },
    { heading: 'Sight',                   prose: parsed.sight },
    { heading: 'Sound',                   prose: parsed.sound },
    { heading: 'Touch',                   prose: parsed.touch },
    { heading: 'Smell',                   prose: parsed.smell },
    { heading: 'Taste',                   prose: parsed.taste },
    { heading: 'What this brand is not',  prose: parsed.anti_patterns },
    { heading: 'Decisions ahead',         prose: parsed.decisions_ahead },
  ];

  const groups = [];
  const descriptors = (parsed.descriptors && typeof parsed.descriptors === 'object')
    ? parsed.descriptors
    : {};
  for (const sense of SENSES) {
    const items = descriptors[sense];
    if (Array.isArray(items) && items.length > 0) {
      groups.push({ label: sense, items: items.filter(s => typeof s === 'string' && s.trim().length > 0) });
    }
  }

  const data_blocks = [
    {
      type: 'descriptor_list',
      title: 'Sensory descriptors',
      content: { groups },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '01 Discovery · Sensescape',
      title: `The Sensory World of ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: SENSESCAPE_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickSensescapeInput(qbp);

  const userBlocks = SENSESCAPE_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const userText = `User's raw Phase 01 Sensescape answers:\n\n${userBlocks}\n\nReturn only the JSON object described in your instructions.`;

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

