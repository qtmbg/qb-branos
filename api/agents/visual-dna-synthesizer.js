// QB BrandOS — Visual DNA Synthesizer
// Vercel Edge Function (importable module + 405 default handler)
//
// Produces a palette + type-pairing recommendation for the brand by
// cross-pollinating Visual DNA exercise signals (keep/discard counts),
// Sensescape color and type signals, and archetype visual implications.
//
// NOTE on field set: visual-dna.html writes only quantitative outputs
// (keep count, image IDs, discard rate). The image catalog tags are
// session-random and not persisted, so kept-image IDs alone do not
// resolve to a color or typeface. The synthesizer therefore reads the
// adjacent QBP signals — colorTerritory, forbiddenColor, typographyNote,
// archetype implications — to inform palette and type direction. This
// widens VISUAL_DNA_FIELDS beyond just visualDna* keys; see report.
//
// The HTTP route exists only so this file can sit next to dispatch.js —
// direct invocation is blocked. Invoke via /api/agents/dispatch.

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2400;
const CLAUDE_TIMEOUT_MS = 24000;
const AGENT_SLUG = 'visual_dna_synthesizer';
const PHASE = '01';
const DEFAULT_BRAND_NAME = 'Your Brand';

export const VISUAL_DNA_FIELDS = [
  'brandName',
  // Visual DNA exercise outputs (quantitative)
  'visualDnaKeepCount',
  'visualDnaDiscardRate',
  'visualDnaKeptImages',
  'visualDnaFastDiscards',
  // Sensescape color and type signals (richest source for visual inference)
  'colorTerritory',
  'forbiddenColor',
  'visualTerritoryNote',
  'typographyNote',
  'antiVoice',
  // Archetype visual register
  'archetypePrimary',
  'archetypeSecondary',
  'archetypeVisualImplications',
  'archetypeVisualImplicationsFull',
];

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
      agent: AGENT_SLUG,
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

export async function runVisualDnaSynthesizer({ qbp, anthropicKey }) {
  if (!anthropicKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY missing', stage: 'config' };
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

export const VISUAL_DNA_AGENT = {
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
