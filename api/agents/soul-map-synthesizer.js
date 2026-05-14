// QB BrandOS — Soul Map Synthesizer
// Vercel Edge Function (importable module + 405 default handler)
//
// Reads the locked Phase 01 QBP, calls Claude to produce the textual body
// of the synthesis (prose sections + always/never list), then assembles a
// server-controlled envelope conforming to the artifact content schema in
// CHAPTER_01_SPEC §7 (validator at js/qb-artifact-schema.js).
//
// The HTTP route exists only so this file can sit next to dispatch.js —
// direct invocation is blocked. Invoke via /api/agents/dispatch.

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;
const CLAUDE_TIMEOUT_MS = 22000;
const AGENT_SLUG = 'soul_map_synthesizer';
const PHASE = '01';
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

// Trust the text body first, strip a ```json fence if present, fall back
// to a brace slice. Any failure returns { ok: false } with the original
// text so the caller can log it.
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
      agent: AGENT_SLUG,
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

export async function runSoulMapSynthesizer({ qbp, anthropicKey }) {
  if (!anthropicKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY missing', stage: 'config' };
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

export const SOUL_MAP_AGENT = {
  slug: AGENT_SLUG,
  phase: PHASE,
  artifactType: AGENT_SLUG, // canonical: artifact_type aligns with agent slug
};

export default async function handler() {
  return new Response(
    JSON.stringify({ ok: false, error: 'Not directly invocable. Use /api/agents/dispatch.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
