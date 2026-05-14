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
const MAX_TOKENS = 4000;
const CLAUDE_TIMEOUT_MS = 22000;
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

You receive a user's raw Phase 01 visual signals — Visual DNA keep/discard counts, Sensescape color and typography notes, and archetype visual implications. Your job is to produce the textual body of a synthesis artifact that recommends a concrete visual direction: a four-swatch palette and a display + body type pairing, each grounded in the user's QBP signals.

Voice and style:
- Calm, editorial, direct. No marketing language, no jargon, no AI talk.
- Address the user using "you" and "your brand."
- Translate signals into concrete visual specifics. Prefer named materials and physical references over abstractions.
- Each prose section is two to four paragraphs separated by \\n\\n inside the JSON string.

Palette discipline:
- Exactly four swatches: Primary, Secondary, Accent, Neutral. No fewer, no more.
- Hex values must match /^#[0-9A-Fa-f]{6}$/ (six-digit hex, leading #).
- Choose hex values that are plausible reads of the user's color signals. If the user named "ink-deep" or "cream", choose hex values that physically match. Do not invent flashy palettes when the brand reads as restrained.
- Each rationale is one or two sentences tying the hex back to a QBP signal.

Type pairing discipline:
- Recommend real, licensable typeface families. Examples of acceptable families: Fraunces, Inter, JetBrains Mono, EB Garamond, Cormorant Garamond, Playfair Display, Lora, Space Grotesk, Söhne, Söhne Mono, GT America, Söhne Breit, Public Sans, Source Serif Pro, Söhne Schmal, DM Sans, DM Serif Display, IBM Plex Sans, IBM Plex Serif, IBM Plex Mono, Archivo, Atkinson Hyperlegible, Caveat. Avoid fictional fonts and avoid niche unlicensable cuts.
- "weight" is a string. Use "400", "500", "600", "700" or a named weight ("Regular", "Medium", "Semibold", "Bold").
- Each rationale is one or two sentences tying the choice back to register, voice, or archetype.

Return ONLY a JSON object with this exact shape. No prose preamble. No markdown fencing. No commentary.

{
  "opening": "Three paragraphs framing the brand's visual posture. Paragraph one names the dominant register. Paragraph two traces a tension the visual identity holds. Paragraph three identifies the visual commitment the brand is making.",
  "color_rationale": "Two to four paragraphs on why this color territory, what it does in the world, what it refuses. Reference the actual hex values in the palette block.",
  "typography_rationale": "Two to four paragraphs on the type direction. Why this display family carries weight. Why this body family reads cleanly. What register the pairing speaks in.",
  "anti_patterns": "Two to four paragraphs on what this brand will not look like. Source from forbiddenColor, antiVoice, and the visual idioms the archetype is tempted by but must refuse.",
  "decisions_ahead": "Three concrete visual decisions the founder will face next. Each decision named in one or two sentences. Not abstract themes; specific decisions a person makes.",
  "palette": [
    { "label": "Primary",   "hex": "#XXXXXX", "rationale": "..." },
    { "label": "Secondary", "hex": "#XXXXXX", "rationale": "..." },
    { "label": "Accent",    "hex": "#XXXXXX", "rationale": "..." },
    { "label": "Neutral",   "hex": "#XXXXXX", "rationale": "..." }
  ],
  "type_pairing": {
    "display": { "family": "...", "weight": "...", "rationale": "..." },
    "body":    { "family": "...", "weight": "...", "rationale": "..." }
  }
}

Rules:
- Every prose field must be non-empty.
- The palette must have exactly four entries in the order Primary, Secondary, Accent, Neutral.
- Every hex must be six-digit hex (e.g. "#2D1521"). No three-digit shorthand. No named colors.
- If the QBP is mostly empty, lean on archetype implications and ship a defensible "Not yet captured" rationale string for whichever fields are blank. Still produce four valid hex values — pick a restrained, defensible default palette rather than refusing to answer.
- Do not invent quotes, awards, partnerships, or facts the user did not provide.
- Do not flatter or compliment the brand.
- Do not include any field other than the ones above.`;

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
