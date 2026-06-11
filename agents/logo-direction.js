// agents/logo-direction.js
// Chapter 4 · Step 1 · Logo Direction Agent · the first Phase 02 agent.
//
// Reads the earned QBP plus the delivered Phase 01 foundation (Soul Map +
// Visual DNA artifacts are hard dependencies) and produces three named
// logo directions a founder can take to a designer, or into the Logo
// Evaluation Agent later in this chapter. It recommends direction; it
// does not draw marks.
//
// Rulings honored (chapter-4 step-1 authorization, 2026-06-11):
//   - tier_required 'starter' · enforcement at dispatch (run.js + rerun.js
//     check profiles.tier for phase >= '02' agents, fail closed).
//   - founder-initiated only: triggers ['manual', 'regenerate'], no chain.
//   - files slot reuses the step-4 reference-image template (optional
//     inspiration image read through Claude vision).
//   - PROMPT HELD: the agent is registered and dispatchable for harness
//     verification but stays out of the Console (PROMPT_HOLD_SLUGS in
//     api/agents/console.js) until the operator signs the prompt.
//
// Methodology call · qbp_fields requirements:
//   archetypePrimary is the methodological floor, same reasoning as
//   Visual DNA: direction without an archetype is generic advice, which
//   the codex refuses. Everything else degrades gracefully through the
//   prompt's fallback paths and the two dependency artifacts.

const MAX_TOKENS = 3000;
const CLAUDE_TIMEOUT_MS = 60000; // step-5 Node runtime envelope (see agents/contract.js budgets)
const DEFAULT_BRAND_NAME = 'Your Brand';

export const LOGO_DIRECTION_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'archetypeSecondary',
  'archetypeVisualImplications',
  'colorTerritory',
  'forbiddenColor',
  'visualTerritoryNote',
  'typographyNote',
  'antiVoice',
  'antiBrand',
  'paradox',
  'alwaysNever',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'logo_direction_agent',
  phase: '02',
  tier_required: 'starter',
  display_name: 'Logo Direction Agent',
  description: 'Distills your foundation into three named logo directions with the qualities, anti-patterns, and designer brief for each.',
  artifact_type: 'logo_direction_agent',
  version: 1,
  inputs: {
    qbp_fields: LOGO_DIRECTION_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    // Hard dependencies · the direction is grounded in the delivered
    // foundation, not re-derived from raw QBP alone. Founders without a
    // delivered Soul Map + Visual DNA get missing_dependency and the
    // Console routes them back to Phase 01.
    artifact_dependencies: ['soul_map_synthesizer', 'visual_dna_synthesizer'],
    // Step-4 files-slot template · an optional inspiration or reference
    // image, read through Claude vision. Same vision discipline as
    // visual_dna: png/jpeg/webp within the 5 MB cap, enforced at the
    // dispatch entry.
    files: [{ type: 'reference-image', source: 'user-upload', optional: true }],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  // Founder-initiated only, per ruling 3. No 'chain' and no 'lock':
  // Phase 02 work fires when the founder asks for it.
  triggers: ['manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // model omitted · resolves to the canonical Sonnet default.
  // Per §5.2.1 step-5 values: observed 32-36 s on the step-1 verification
  // runs (two distilled dependency artifacts in the input, 3000 max
  // tokens out), inside the 60 000 ms budget at retry_budget 0 with ~24 s
  // headroom at observed max. Entry in AGENT_OBSERVED_LATENCY_MS.
  retry_budget: 0,
};

const MODEL = META.model || 'claude-sonnet-4-6';

// ─── The prompt · HELD FOR OPERATOR SIGN-OFF ────────────────────────────
// This is the first artifact a paying founder sees from Phase 02. The
// prompt is product. Per the step-1 authorization it ships to main for
// harness verification but the agent stays Console-invisible until the
// operator signs this text.

const SYSTEM_PROMPT = `You are the Logo Direction Agent for Quantum Branding OS, the first agent of Phase 02, Brand Creation.

The founder has finished Phase 01. They arrive with an earned foundation: a Soul Map (who the brand is), a Visual DNA (its palette and type direction), and the raw signals of their Quantum Brand Profile. Your job is to turn that foundation into three distinct, nameable logo directions a designer could start sketching from tomorrow. You recommend direction. You do not draw, and you do not describe finished logos.

Voice: calm, editorial, direct. You are a thoughtful design director, not a pitch deck. No marketing language, no jargon, no AI talk. Address the founder as "you / your brand." Sentence fragments are welcome. Do not pad.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic.

Ground rules for the directions:
- Exactly THREE directions. Each gets a short, memorable name (two or three words, sentence case), a concept paragraph, and four to six visual qualities.
- The three must be genuinely different routes, not three flavors of one idea. A useful spread: one direction that takes the archetype literally, one that takes it laterally, one that resolves the brand's central tension or paradox.
- Every direction must trace back to something the founder actually gave you: the archetype, the palette, the type direction, a phrase from their Soul Map. Quote or reference their own material where it earns its place. Never invent facts about the brand.
- Respect the Visual DNA. The palette and type pairing in the dependency artifact are decisions already made; directions build on them, they do not relitigate them. If a direction pushes against the palette, say so explicitly and say why it might be worth it.
- Respect the forbidden: the forbidden color, the anti-voice, the anti-brand. These are hard walls.
- If a reference image is attached, read it as inspiration the founder chose: name what it gets right for this brand and let at most one direction lean into it. The QBP and the delivered foundation win on any disagreement.
- If revision feedback is provided, treat it as the founder's direction note from the last round: apply it concretely, do not merely acknowledge it.

What good looks like: specific over generic, always. "A wordmark with a clipped descender that echoes the forbidden-color discipline" is direction. "A modern, versatile logo that stands the test of time" is filler and is forbidden.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph is 2-3 sentences. No more.
- Each direction concept: ONE paragraph of 3-4 sentences.
- Each visual quality: a short phrase, not a sentence.
- Always/never items: short imperative phrases.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs · what the foundation says about the mark this brand needs",
  "reading_the_foundation": "two short paragraphs · the specific signals you are building from, citing the founder's own material",
  "directions": [
    { "name": "Two or three words", "concept": "one paragraph, 3-4 sentences", "qualities": ["four", "to", "six", "short phrases"] },
    { "name": "...", "concept": "...", "qualities": ["..."] },
    { "name": "...", "concept": "...", "qualities": ["..."] }
  ],
  "always": ["three to six short imperatives the mark must always honor"],
  "never": ["three to six short imperatives the mark must never break"],
  "designer_brief": "two short paragraphs · how to hand these directions to a designer: what to ask for, what to refuse, what to test the sketches against"
}

If the QBP is sparse, lean on the archetype and the two dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of LOGO_DIRECTION_FIELDS) {
    const v = safe[k];
    let isPresent;
    if (typeof v === 'string') isPresent = v.trim().length > 0;
    else if (typeof v === 'number') isPresent = Number.isFinite(v);
    else if (Array.isArray(v)) isPresent = v.length > 0;
    else if (v && typeof v === 'object') isPresent = Object.keys(v).length > 0;
    else isPresent = false;
    if (isPresent) out[k] = v;
    else missing.push(k);
  }
  return { input: out, missing };
}

// Distill a dependency artifact to the parts the prompt needs. Full
// artifacts can be large; the directions need the prose spine and the
// decided visual system, not the rendering metadata.
function distillDependency(slug, dep) {
  const content = dep?.content;
  if (!content || typeof content !== 'object') return `${slug}: <not available>`;
  const sections = (content.body_sections || [])
    .map(s => `${s.heading}: ${s.prose}`)
    .join('\n');
  const blocks = (content.data_blocks || [])
    .map(b => `${b.type}: ${JSON.stringify(b.content)}`)
    .join('\n');
  return `${slug} (delivered artifact):\n${sections}\n${blocks}`;
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
    try {
      return { ok: true, value: JSON.parse(raw.substring(start, end + 1)) };
    } catch (_) {}
  }
  return { ok: false, reason: 'parse-failed', raw };
}

async function callClaude({ apiKey, system, userContent }) {
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
        messages: [{ role: 'user', content: userContent }],
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
    tokens_in: usage.input_tokens ?? null,
    tokens_out: usage.output_tokens ?? null,
  };
}

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'Opening',                  prose: parsed.opening },
    { heading: 'Reading the foundation',   prose: parsed.reading_the_foundation },
    { heading: 'Briefing your designer',   prose: parsed.designer_brief },
  ];

  const directions = Array.isArray(parsed.directions) ? parsed.directions : [];
  const data_blocks = [
    {
      type: 'descriptor_list',
      title: 'Three directions',
      content: {
        groups: directions.map(d => ({
          label: String(d?.name || 'Direction'),
          items: [String(d?.concept || '')].concat(
            Array.isArray(d?.qualities) ? d.qualities.map(String) : []
          ).filter(s => s.length > 0).slice(0, 12),
        })),
      },
    },
    {
      type: 'always_never',
      title: 'The mark, always and never',
      content: {
        always: (Array.isArray(parsed.always) ? parsed.always : ['Stay legible at 16 pixels']).map(String).slice(0, 10),
        never:  (Array.isArray(parsed.never)  ? parsed.never  : ['Chase a trend']).map(String).slice(0, 10),
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '02 Brand Creation · Logo Direction',
      title: `A Mark for ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: LOGO_DIRECTION_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = LOGO_DIRECTION_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('visual_dna_synthesizer', dependencies?.visual_dna_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered Phase 01 foundation:\n\n${depBlocks}`;

  // Content Approval Loop · runtime_args.feedback is the founder's
  // revision note from the prior round (call 6 default; cap lives at the
  // surface layer per the chapter-2 adjudication).
  const feedback = typeof runtime_args?.feedback === 'string' && runtime_args.feedback.trim()
    ? runtime_args.feedback.trim()
    : null;
  if (feedback) {
    userText += `\n\nRevision feedback from the founder (apply concretely):\n${feedback}`;
  }

  userText += '\n\nReturn only the JSON object described in your instructions.';

  // Step-4 files-slot template · optional reference image through vision.
  const referenceImage = (Array.isArray(files) ? files : []).find(f =>
    f && f.type === 'reference-image'
    && typeof f.signed_url === 'string' && f.signed_url
    && ['image/png', 'image/jpeg', 'image/webp'].includes(f.mime)
  ) || null;

  const userContent = referenceImage
    ? [
        { type: 'image', source: { type: 'url', url: referenceImage.signed_url } },
        {
          type: 'text',
          text: `${userText}\n\nAn inspiration image the founder attached is included. Read what it gets right for this brand; at most one direction may lean into it. The QBP and the delivered foundation win on any disagreement.`,
        },
      ]
    : userText;

  let claudeRes;
  for (let attempt = 0; attempt < 2; attempt++) {
    claudeRes = await callClaude({ apiKey: anthropicKey, system: SYSTEM_PROMPT, userContent });
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
