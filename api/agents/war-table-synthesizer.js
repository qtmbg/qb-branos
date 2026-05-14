// QB BrandOS — War Table Synthesizer
// Vercel Edge Function (importable module + 405 default handler)
//
// Reads the locked Phase 01 strategic signals — War Table initiatives,
// audience block, Soul Map paradox/antiBrand/alwaysNever, and archetype
// market/moat data — to produce a positioning_map + always_never +
// priority_list under a calm editorial envelope.
//
// War Table is structurally the heaviest of the four Phase 01 agents:
// 6 prose sections + 3 data blocks (positioning_map with 2-8 placements,
// always_never lists, ranked priorities). Prompt is tight from the start
// to stay inside the 24 s Edge timeout — same lesson as Visual DNA.
//
// The HTTP route exists only so this file can sit next to dispatch.js —
// direct invocation is blocked. Invoke via /api/agents/dispatch.

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2800;
const CLAUDE_TIMEOUT_MS = 24000;
const AGENT_SLUG = 'war_table_synthesizer';
const PHASE = '01';
const DEFAULT_BRAND_NAME = 'Your Brand';

// War Table exercise (war-table.html → saveToQBP / persistAudience / write
// dossier) plus the adjacent strategic signals from Soul Map and the
// archetype block. The exercise alone does not write competitor data or
// paradox/anti-brand fields — those come from Soul Map and archetype.
export const WAR_TABLE_FIELDS = [
  'brandName',
  // War Table exercise outputs
  'warTableBrief',
  'warTableTopInitiatives',
  'warTablePosture',
  'warTablePrinciples',
  'warTableNextHandoff',
  // Audience block (written by War Table)
  'audienceFears',
  'audienceDesires',
  'audienceLanguage',
  'audienceFriction',
  // Soul Map strategic signals
  'paradox',
  'antiBrand',
  'alwaysNever',
  'manifesto',
  // Archetype market and moat context
  'archetypePrimary',
  'archetypeSecondary',
  'archetypeMarketLandscape',
  'archetypeStrategicMoat',
  'archetypeCentralParadox',
];

const SYSTEM_PROMPT = `You are the War Table Synthesizer for Quantum Branding OS.

Produce the textual body of a War Table artifact: a strategic position read on the brand. Combine a positioning map, a binding always/never list, and three ranked priorities — each anchored in the user's QBP signals.

Voice: calm, editorial, direct. No marketing language, no jargon, no AI talk. Address the user as "you / your brand". Be concise. Do not pad.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph is 2-3 sentences. No more.
- Each priority and placement rationale: ONE short sentence. No more.
- Always and Never items: ONE short imperative each.

Positioning map discipline:
- Choose two meaningful axes for this brand's category. Patterns to consider: Mass ↔ Bespoke, Quiet ↔ Loud, Heritage ↔ Modern, Function ↔ Emotion, Insider ↔ Open. Pick whichever two best reveal the strategic position.
- Place between 2 and 8 entities on the map total. EXACTLY ONE must be the user's brand with "is_self": true. All other placements are competitors or category archetypes with "is_self": false.
- Every "x" and "y" value is a number between 0.0 and 1.0 inclusive.
- If the QBP names competitors (e.g. archetypeMarketLandscape.occupiers), use those names verbatim. Otherwise place 3-4 representative category archetypes (named honestly, e.g. "Generic homeware brand", "Polished design gallery").
- The user's brand placement is the synthesis insight, not flattery. Place it honestly.

Always / Never discipline:
- Each list contains 3 to 7 items.
- Items are short imperatives (under 12 words), not adjectives.

Priority discipline:
- Exactly THREE priorities. Ranks 1, 2, 3 in that order.
- Ordered by urgency × leverage. The top priority is what the next quarter is for.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs framing the strategic position",
  "field_rationale": "two short paragraphs on how the competitive field is shaped and why these two axes matter",
  "paradox_rationale": "two short paragraphs on the productive tension this brand holds and why it cannot be resolved",
  "commitments_rationale": "two short paragraphs on why these always/never commitments, what they cost",
  "priorities_rationale": "two short paragraphs on why these three priorities, why this order",
  "decisions_ahead": "three short strategic decisions joined with \\n\\n",
  "positioning_map": {
    "x_axis": { "low": "...", "high": "..." },
    "y_axis": { "low": "...", "high": "..." },
    "placements": [
      { "label": "Competitor or archetype name", "x": 0.30, "y": 0.55, "is_self": false },
      { "label": "Your brand name or 'Your Brand'", "x": 0.82, "y": 0.30, "is_self": true }
    ]
  },
  "always_never": {
    "always": ["short imperative", "short imperative", "short imperative"],
    "never":  ["short imperative", "short imperative", "short imperative"]
  },
  "priorities": [
    { "rank": 1, "label": "Concrete priority in 4-10 words", "rationale": "one short sentence" },
    { "rank": 2, "label": "Concrete priority in 4-10 words", "rationale": "one short sentence" },
    { "rank": 3, "label": "Concrete priority in 4-10 words", "rationale": "one short sentence" }
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
      agent: AGENT_SLUG,
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

export async function runWarTableSynthesizer({ qbp, anthropicKey }) {
  if (!anthropicKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY missing', stage: 'config' };
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

export const WAR_TABLE_AGENT = {
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
