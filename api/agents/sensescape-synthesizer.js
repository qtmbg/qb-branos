// QB BrandOS — Sensescape Synthesizer
// Vercel Edge Function (importable module + 405 default handler)
//
// Reads the locked Phase 01 QBP sensescape fields, calls Claude to produce
// the textual body of the synthesis (per-sense prose + sensory descriptor
// groups), then assembles a server-controlled envelope conforming to the
// artifact content schema in CHAPTER_01_SPEC §7.
//
// The HTTP route exists only so this file can sit next to dispatch.js —
// direct invocation is blocked. Invoke via /api/agents/dispatch.

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;
const CLAUDE_TIMEOUT_MS = 22000;
const AGENT_SLUG = 'sensescape_synthesizer';
const PHASE = '01';
const DEFAULT_BRAND_NAME = 'Your Brand';

// QBP fields the Sensescape exercise writes (see sensescape.html → saveToQBP).
// Order is the order they appear in the user prompt for the model.
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

const SYSTEM_PROMPT = `You are the Sensescape Synthesizer for Quantum Branding OS.

You receive a user's raw Phase 01 Sensescape answers. Your job is to produce the textual body of a synthesis artifact: a calm, editorial reflection of the multi-sensory texture of this brand. The reader should feel the brand, not just read about it.

Voice and style:
- Calm, editorial, direct. No marketing language, no jargon, no AI talk.
- Address the user using "you" and "your brand."
- Translate raw answers into sensory specifics. Avoid abstractions ("calm", "elegant"); favor concrete physical detail ("brushed brass on cold stone", "footsteps on bleached oak").
- Each prose section is two to four paragraphs, separated by \\n\\n inside the JSON string.

The user's Sensescape exercise emphasizes sight, sound, and touch (an object, a moment, a gesture). Smell and taste are usually implied rather than stated. When the QBP lacks direct signal for a sense, derive it from the strongest adjacent signal — the object can imply smell, the color territory can imply taste, the signature gesture can imply touch — and say so plainly.

Return ONLY a JSON object with this exact shape. No prose preamble. No markdown fencing. No commentary.

{
  "opening": "Three paragraphs framing the overall sensory world of the brand. The first paragraph names the dominant register. The second paragraph traces a single thread from one sense into another. The third paragraph identifies the sensory commitment the brand is making by being this way.",
  "sight": "Two to four paragraphs on how the brand looks. Source from colorTerritory, forbiddenColor, visualTerritoryNote, typographyNote.",
  "sound": "Two to four paragraphs on how the brand sounds. Source from soundSignature, antiVoice.",
  "touch": "Two to four paragraphs on how the brand feels in the hand. Source from brandObject, brandMoment, signatureGesture.",
  "smell": "Two to four paragraphs on what the brand smells like. Where no direct signal exists, derive from object, place, or color.",
  "taste": "Two to four paragraphs on what the brand tastes like. Where no direct signal exists, derive from object, place, or color.",
  "anti_patterns": "Two to four paragraphs on what this brand explicitly is not, sensorially. Source from forbiddenColor, antiVoice, and any other 'never' signal.",
  "decisions_ahead": "Three concrete decisions the founder will face next in the sensory layer of the brand. Each decision named in one or two sentences. Examples: 'Decide the studio's daylight palette under cloud cover.' Not abstract themes; specific decisions a person makes.",
  "descriptors": {
    "Sight": ["short", "phrases", "three to five items"],
    "Sound": ["..."],
    "Touch": ["..."],
    "Smell": ["..."],
    "Taste": ["..."]
  }
}

Rules:
- Every prose field must be non-empty. Never return an empty string.
- Each "descriptors" group must contain at least three and at most five items. Each item is one to three words.
- If a QBP field is missing, write "Not yet captured. Return to the Sensescape exercise to add this." for the affected prose field, and use the same placeholder repeated three times for the affected descriptor group.
- Do not invent quotes, awards, partnerships, or facts the user did not provide.
- Do not flatter or compliment the brand.
- Do not include any field other than the ones above.`;

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

  // Build descriptor_list.groups from the model's descriptors object.
  // Skip any group whose items array is empty.
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
      agent: AGENT_SLUG,
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

export async function runSensescapeSynthesizer({ qbp, anthropicKey }) {
  if (!anthropicKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY missing', stage: 'config' };
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
      error: `Claude call failed (status ${claudeRes.status})`,
      stage: 'claude-call',
      detail: (claudeRes.body || '').slice(0, 400),
    };
  }

  const parsed = defensiveParseJson(claudeRes.text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: 'Could not parse synthesized JSON',
      stage: 'json-parse',
      detail: (claudeRes.text || '').slice(0, 800),
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
      agent_slug: AGENT_SLUG,
      phase: PHASE,
      model: MODEL,
      tokens_in: claudeRes.tokens_in,
      tokens_out: claudeRes.tokens_out,
    },
  };
}

export const SENSESCAPE_AGENT = {
  slug: AGENT_SLUG,
  phase: PHASE,
  artifactType: AGENT_SLUG,
};

export default async function handler() {
  return new Response(
    JSON.stringify({ ok: false, error: 'Not directly invocable. Use /api/agents/dispatch.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
