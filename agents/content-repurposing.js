// agents/content-repurposing.js
// Chapter 6 · Step 1 · Content Repurposing Engine · the first Phase 04 agent.
//
// Takes one piece the founder pastes (runtime_args.source_content) and
// rewrites it for six surfaces in the delivered brand voice, each with its
// format notes and posting guidance. One piece in, a week of content out.
// When no source is pasted, the strongest dependency material becomes the
// source and the opening says so plainly.
//
// Rulings honored (chapter-6 authorization, 2026-07-04):
//   - tier_required 'starter' (Phase 04 executes the Starter content
//     story; the roadmap's Pro list claims only the Phase 05 intelligence
//     agents).
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependency on voice_guide_agent.
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs.
//
// Latency class: HEAVY. Six rewritten pieces (6000 max tokens). Single
// attempt at a 120 000 ms in-call timeout, no inner retry (the contract's
// IN_CALL_WORST_MS model holds; the reaper owns retries).

const MAX_TOKENS = 6000;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';
const SOURCE_CONTENT_CAP = 8000;

export const CONTENT_REPURPOSING_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'antiVoice',
  'alwaysNever',
  'audienceLanguage',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'content_repurposing_agent',
  phase: '04',
  tier_required: 'starter',
  display_name: 'Content Repurposing Engine',
  description: 'One piece in, a week of content out: your source rewritten for six surfaces in your voice, each with its format notes and posting guidance.',
  artifact_type: 'content_repurposing_agent',
  version: 1,
  inputs: {
    qbp_fields: CONTENT_REPURPOSING_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    artifact_dependencies: ['voice_guide_agent', 'soul_map_synthesizer'],
    files: [],
    runtime_args: { feedback: 'optional', qbp_source: 'optional', source_content: 'optional' },
  },
  triggers: ['manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // model omitted · resolves to the canonical Sonnet default.
  retry_budget: 0,
};

const MODEL = META.model || 'claude-sonnet-4-6';

// ─── The prompt · HELD FOR OPERATOR SIGN-OFF ────────────────────────────

const SYSTEM_PROMPT = `You are the Content Repurposing Engine for Quantum Branding OS, the first agent of Phase 04, Execution.

The founder has finished their foundation and started producing. They arrive with a Voice Guide (how the brand writes), a Soul Map (who the brand is), and one piece of content they pasted. Your job is translation, not invention: the same idea, rewritten for six different surfaces, each in the form that surface rewards, all in the brand voice.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, repurpose as a word inside any rewritten piece.

Ground rules:
- The source's ARGUMENT is sacred. Every derivative carries the same idea; what changes is form, length, entry point, and the surface's native rhythm. If a derivative would need a different idea to work, say so in its guidance instead of inventing one.
- The six surfaces, fixed: a LinkedIn post, an Instagram caption, an X thread opener (the first three posts of a thread), a newsletter section, a YouTube community post, and a 45-second short-form script.
- Each derivative is COMPLETE and ready to paste, in the brand voice per the Voice Guide.
- Each derivative names what changed in translation and why, in one sentence, and gives one sentence of posting guidance.
- If no source was pasted, use the strongest material from the dependency artifacts as the source and say so plainly in the opening.
- No invented stories, numbers, or engagements. Founder-specific detail gets a marked [your example here] slot, at most one per derivative.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Forbidden filler, named: "here's the thing", "let me explain", "thread below", and any opener that delays the idea.

Length rules (strict, they are the budget):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- Derivative bodies: 60 to 180 words each, matched to the surface (the thread opener runs shortest, the newsletter section longest).
- Guidance and change notes: one sentence each.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "reading_the_source": "two short paragraphs · what the source argues and which of its lines carry the most weight",
  "repurpose_logic": "two short paragraphs · what survives translation untouched and what must change per surface",
  "derivatives": [
    {
      "kicker": "LinkedIn post",
      "title": "a working title for the founder's planning",
      "format_note": "one phrase, the surface's form",
      "body": "the complete rewritten piece, 60-180 words",
      "what_changed": "one sentence",
      "guidance": "one sentence, when and how to post it"
    },
    { "kicker": "Instagram caption", "title": "...", "format_note": "...", "body": "...", "what_changed": "...", "guidance": "..." },
    { "kicker": "X thread opener", "title": "...", "format_note": "...", "body": "...", "what_changed": "...", "guidance": "..." },
    { "kicker": "Newsletter section", "title": "...", "format_note": "...", "body": "...", "what_changed": "...", "guidance": "..." },
    { "kicker": "YouTube community post", "title": "...", "format_note": "...", "body": "...", "what_changed": "...", "guidance": "..." },
    { "kicker": "Short-form script", "title": "...", "format_note": "...", "body": "...", "what_changed": "...", "guidance": "..." }
  ],
  "always": ["three to six repurposing disciplines this brand must always keep"],
  "never": ["three to six translation failures that must never ship"]
}

derivatives has exactly SIX items with the fixed kickers above. If the QBP is sparse, lean on the archetype and the dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of CONTENT_REPURPOSING_FIELDS) {
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

const DEP_DIGEST_CAP = 1500;
function distillDependency(slug, dep) {
  const content = dep?.content;
  if (!content || typeof content !== 'object') return `${slug}: <not available>`;
  const sections = (content.body_sections || [])
    .map(s => `${s.heading}: ${s.prose}`)
    .join('\n');
  const blocks = (content.data_blocks || [])
    .map(b => `${b.type}: ${JSON.stringify(b.content)}`)
    .join('\n');
  const digest = `${sections}\n${blocks}`.slice(0, DEP_DIGEST_CAP);
  return `${slug} (delivered artifact):\n${digest}`;
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

// HEAVY-CLASS CALL · one attempt, no inner retry (see header comment).
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
      return { ok: false, timeout: true, status: 0, body: '' };
    }
    return { ok: false, status: 0, body: (e && e.message) || '' };
  }
  clearTimeout(timer);

  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text().catch(() => '') };
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

function clampStr(v, max, fallback) {
  const s = (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
  return s.length > max ? s.slice(0, max - 1).trimEnd() : s;
}

const SURFACE_KICKERS = [
  'LinkedIn post', 'Instagram caption', 'X thread opener',
  'Newsletter section', 'YouTube community post', 'Short-form script',
];

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'Reading the source',   prose: clampStr(parsed.reading_the_source, 8000, 'The source reading did not generate. Regenerate to produce it.') },
    { heading: 'The repurpose logic',  prose: clampStr(parsed.repurpose_logic, 8000, 'The repurpose logic did not generate. Regenerate to produce it.') },
  ];

  const derivatives = (Array.isArray(parsed.derivatives) ? parsed.derivatives : []).slice(0, 6);
  const items = derivatives.map((d, i) => {
    const item = {
      kicker: clampStr(d?.kicker, 60, SURFACE_KICKERS[i] || `Surface ${i + 1}`),
      title: clampStr(d?.title, 200, `Piece ${i + 1}`),
      meta: [clampStr(d?.format_note, 40, '')].filter(s => s.length > 0),
      body: clampStr(d?.body, 6000, 'This derivative did not generate. Regenerate to produce it.'),
      specs: [
        d?.what_changed ? `What changed: ${clampStr(d.what_changed, 286, '')}` : '',
        d?.guidance ? `Guidance: ${clampStr(d.guidance, 290, '')}` : '',
      ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
    };
    if (item.meta.length === 0) delete item.meta;
    if (item.specs.length === 0) delete item.specs;
    return item;
  });

  const data_blocks = [
    {
      type: 'content_pack',
      title: 'Six surfaces',
      content: {
        items: items.length > 0 ? items : [{
          kicker: SURFACE_KICKERS[0],
          title: 'The derivatives did not generate',
          body: 'Regenerate to produce the six rewritten pieces.',
        }],
      },
    },
    {
      type: 'always_never',
      title: 'Repurposing discipline',
      content: {
        always: (Array.isArray(parsed.always) && parsed.always.length > 0 ? parsed.always : ['Keep the source argument intact'])
          .map(s => clampStr(String(s), 300, '')).filter(s => s.length > 0).slice(0, 10),
        never: (Array.isArray(parsed.never) && parsed.never.length > 0 ? parsed.never : ['Ship a derivative with a different idea'])
          .map(s => clampStr(String(s), 300, '')).filter(s => s.length > 0).slice(0, 10),
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '04 Execution · Content Repurposing',
      title: `One piece, six surfaces, for ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: CONTENT_REPURPOSING_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = CONTENT_REPURPOSING_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('voice_guide_agent', dependencies?.voice_guide_agent),
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the Voice Guide is law for every derivative):\n\n${depBlocks}`;

  const sourceContent = typeof runtime_args?.source_content === 'string' && runtime_args.source_content.trim()
    ? runtime_args.source_content.trim().slice(0, SOURCE_CONTENT_CAP)
    : null;
  if (sourceContent) {
    userText += `\n\nThe founder's source piece (translate this, do not replace its argument):\n${sourceContent}`;
  } else {
    userText += `\n\nNo source piece was pasted. Use the strongest material from the dependency artifacts as the source and say so plainly in the opening.`;
  }

  const feedback = typeof runtime_args?.feedback === 'string' && runtime_args.feedback.trim()
    ? runtime_args.feedback.trim()
    : null;
  if (feedback) {
    userText += `\n\nRevision feedback from the founder (apply concretely):\n${feedback}`;
  }

  userText += '\n\nReturn only the JSON object described in your instructions.';

  const claudeRes = await callClaude({ apiKey: anthropicKey, system: SYSTEM_PROMPT, userContent: userText });

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
