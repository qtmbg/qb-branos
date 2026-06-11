// agents/voice-guide.js
// Chapter 4 · Step 3 · Voice Guide Agent · the third Phase 02 agent.
//
// Text-only, no files slot. Reads the earned QBP voice signals plus the
// delivered Soul Map and War Table artifacts (the voice's soul and its
// audience) and produces the brand's voice guide: rules concrete enough
// that a stranger could ghostwrite from them tomorrow.
//
// Pre-rulings honored (chapter-4 step-3 authorization, 2026-06-11):
//   - text-only agent, no files slot.
//   - tier starter+, fail closed (the standing phase >= '02' gate).
//   - triggers manual + regenerate · no chain, no lock fan-out.
//   - Sonnet default. CAL feedback per the Logo Direction pattern.
//   - PROMPT HELD: merges behind PROMPT_HOLD_SLUGS, Console-invisible
//     until the operator signs the prompt.
//
// Craft note, binding: this agent defines how the brand speaks, so its
// own output must demonstrate the discipline it prescribes. The Soul Map
// voice signals and the anti-voice are hard walls. "Warm but
// professional" is the named forbidden filler class.

const MAX_TOKENS = 3000;
const CLAUDE_TIMEOUT_MS = 60000; // step-5 Node runtime envelope (see agents/contract.js budgets)
const DEFAULT_BRAND_NAME = 'Your Brand';

export const VOICE_GUIDE_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'archetypeSecondary',
  'manifesto',
  'antiVoice',
  'antiBrand',
  'paradox',
  'alwaysNever',
  'audienceLanguage',
  'audienceDesires',
  'audienceFears',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'voice_guide_agent',
  phase: '02',
  tier_required: 'starter',
  display_name: 'Voice Guide Agent',
  description: 'Turns your foundation into a working voice guide: the register, the lexicon, the sentence mechanics, and the hard walls, concrete enough that anyone could write as your brand.',
  artifact_type: 'voice_guide_agent',
  version: 1,
  inputs: {
    qbp_fields: VOICE_GUIDE_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    // The voice is grounded in who the brand is (Soul Map) and who it
    // speaks to (War Table audience block). Same hard-dependency
    // reasoning as the other Phase 02 agents: voice without the
    // foundation is generic copywriting advice, which the codex refuses.
    artifact_dependencies: ['soul_map_synthesizer', 'war_table_synthesizer'],
    files: [],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  // Founder-initiated only · per the standing ruling, no chain, no lock.
  triggers: ['manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // model omitted · resolves to the canonical Sonnet default.
  // Text-only class under the step-5 envelope. Observed entry in
  // AGENT_OBSERVED_LATENCY_MS comes from the step-3 verification runs.
  retry_budget: 0,
};

const MODEL = META.model || 'claude-sonnet-4-6';

// ─── The prompt · HELD FOR OPERATOR SIGN-OFF ────────────────────────────
// The voice guide is the discipline made writable. Its own prose is the
// first proof: every sentence it returns must already obey the rules it
// hands the founder.

const SYSTEM_PROMPT = `You are the Voice Guide Agent for Quantum Branding OS, part of Phase 02, Brand Creation.

The founder has finished Phase 01. They arrive with a Soul Map (who the brand is), a War Table (who it speaks to and what it fights), and the raw signals of their Quantum Brand Profile. Your job is to turn that foundation into a working voice guide: rules concrete enough that a stranger could ghostwrite as this brand tomorrow and a reader could not tell the difference.

You are writing the discipline, so you must demonstrate it. Every sentence you return is a sample of the standard you prescribe. If your own prose would fail the guide you are writing, rewrite before returning.

Voice: calm, editorial, direct. You are a thoughtful editor handing over a house style, not a consultant presenting a framework. No marketing language, no jargon, no AI talk. Address the founder as "you / your brand." Sentence fragments are welcome. Do not pad.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, authentic, engaging.

Ground rules for the guide:
- The Soul Map voice signals and the anti-voice are HARD WALLS. Every rule you write must be traceable to them, the archetype, the manifesto, or the audience language. Quote the founder's own phrases where they earn their place. Never invent facts about the brand.
- Rules must be executable, not aspirational. A rule passes only if a stranger could apply it to a blank page without asking a follow-up question. "Open with the reader's problem in their own words, then answer it in one sentence" is executable. "Be conversational" is not.
- Forbidden filler, named: "warm but professional" and its whole class. Any pair of adjectives that could describe a thousand brands ("friendly yet credible", "bold but approachable", "casual and trustworthy") is banned from your output. If a rule reads like a horoscope, replace it with a mechanic: sentence length, word choice, what gets cut, what opens, what closes.
- Show, then tell. Every register rule comes with a one-line example written IN the brand's voice, and where it sharpens the rule, the same line written in the anti-voice so the founder sees the wall.
- The lexicon is specific: words and phrases this brand uses because of who it is, and words it never uses because of the anti-voice and the anti-brand. Each entry earns one short reason.
- Audience calibration: use the War Table audience language. The guide should tell the writer which of the reader's own words to borrow and which of their fears never to poke for effect.
- If revision feedback is provided, treat it as the founder's note from the last round: apply it concretely, do not merely acknowledge it.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph is 2-3 sentences. No more.
- Each rule, lexicon entry, or always/never item: one short line, mechanic first, reason after.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs · what this voice is and where it comes from in the foundation",
  "the_register": "two short paragraphs · the sound of the brand: pace, sentence shape, temperature, with one in-voice example line",
  "rules": [
    { "rule": "one executable mechanic", "example": "one line written in the brand's voice demonstrating it" },
    { "rule": "...", "example": "..." }
  ],
  "lexicon_use": ["five to eight words or phrases this brand uses, each with a short reason"],
  "lexicon_never": ["five to eight words or phrases this brand never uses, each with a short reason traced to the anti-voice or anti-brand"],
  "always": ["three to six short imperatives the voice must always honor"],
  "never": ["three to six short imperatives the voice must never break"],
  "ghostwriter_test": "two short paragraphs · how the founder checks any piece of writing against this guide: the three questions to ask, and what to do when a sentence fails"
}

Provide four to seven rules. If the QBP is sparse, lean on the archetype and the two dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of VOICE_GUIDE_FIELDS) {
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

  const rules = Array.isArray(parsed.rules) ? parsed.rules : [];

  const body_sections = [
    { heading: 'Where this voice comes from', prose: parsed.opening },
    { heading: 'The register',                prose: parsed.the_register },
    { heading: 'The ghostwriter test',        prose: parsed.ghostwriter_test },
  ];

  const data_blocks = [
    {
      type: 'descriptor_list',
      title: 'The working rules',
      content: {
        groups: [
          {
            label: 'Write by these mechanics',
            items: rules.slice(0, 12).map(r =>
              `${String(r?.rule || '')} · e.g. ${String(r?.example || '')}`.trim()
            ).filter(s => s.length > 8),
          },
          {
            label: 'Words and phrases we use',
            items: (Array.isArray(parsed.lexicon_use) && parsed.lexicon_use.length > 0
              ? parsed.lexicon_use : ['<no lexicon returned>']).map(String).slice(0, 12),
          },
          {
            label: 'Words and phrases we never use',
            items: (Array.isArray(parsed.lexicon_never) && parsed.lexicon_never.length > 0
              ? parsed.lexicon_never : ['<no lexicon returned>']).map(String).slice(0, 12),
          },
        ],
      },
    },
    {
      type: 'always_never',
      title: 'The voice, always and never',
      content: {
        always: (Array.isArray(parsed.always) ? parsed.always : ['Speak plainly']).map(String).slice(0, 10),
        never:  (Array.isArray(parsed.never)  ? parsed.never  : ['Borrow hype']).map(String).slice(0, 10),
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '02 Brand Creation · Voice Guide',
      title: `How ${safeBrand} Speaks`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: VOICE_GUIDE_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = VOICE_GUIDE_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('war_table_synthesizer', dependencies?.war_table_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered Phase 01 foundation:\n\n${depBlocks}`;

  // Content Approval Loop · the Logo Direction pattern.
  const feedback = typeof runtime_args?.feedback === 'string' && runtime_args.feedback.trim()
    ? runtime_args.feedback.trim()
    : null;
  if (feedback) {
    userText += `\n\nRevision feedback from the founder (apply concretely):\n${feedback}`;
  }

  userText += '\n\nReturn only the JSON object described in your instructions.';

  let claudeRes;
  for (let attempt = 0; attempt < 2; attempt++) {
    claudeRes = await callClaude({ apiKey: anthropicKey, system: SYSTEM_PROMPT, userContent: userText });
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
