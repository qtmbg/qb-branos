// agents/quarterly-review.js
// Chapter 7 · Step 2 · Quarterly Brand Review · Phase 05.
//
// The agent that makes the system self-evolving. Reads the founder's
// pasted quarter (runtime_args.source_content) through the brand lens,
// grades it honestly, extracts the learnings, decides what to carry and
// what to leave, proposes profile recalibrations, and writes the Q+1
// strategic direction. When no quarter data is pasted, the artifact
// becomes the baseline review: the first quarter's plan built from the
// foundation, said plainly in the opening.
//
// Rulings honored (chapter-7 authorization, 2026-07-04):
//   - tier_required 'pro' (the roadmap's Pro list claims the Phase 05
//     intelligence agents, and Quarterly Brand Review by name).
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependencies on the Phase 01 foundation.
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs. The prompt
//     descends from the legacy quarterly-brand-review-agent.html tool.
//   - QBP updates are PROPOSED in the artifact, never auto-applied. The
//     founder applies them by hand; the system does not rewrite its own
//     spine without a human reading the reasoning.
//
// Latency class: HEAVY (8000 max tokens, the youtube-strategy call shape).
// Single attempt at a 120 000 ms in-call timeout, no inner retry.

const MAX_TOKENS = 8000;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';
const SOURCE_CONTENT_CAP = 8000;

export const QUARTERLY_REVIEW_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'manifesto',
  'antiBrand',
  'alwaysNever',
  'audienceDesires',
  'audienceFears',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'quarterly_review_agent',
  phase: '05',
  tier_required: 'pro',
  display_name: 'Quarterly Brand Review',
  description: 'The quarter graded honestly, the learnings extracted, the profile recalibrations proposed, and the next 90 days decided. The brand gets smarter each quarter.',
  artifact_type: 'quarterly_review_agent',
  version: 1,
  inputs: {
    qbp_fields: QUARTERLY_REVIEW_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    artifact_dependencies: ['soul_map_synthesizer', 'war_table_synthesizer'],
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

const SYSTEM_PROMPT = `You are the Quarterly Brand Review for Quantum Branding OS, part of Phase 05, Intelligence.

Your function makes the system self-evolving. You read what happened this quarter through the brand lens, grade it honestly, update what the brand knows about itself, and produce the strategic direction for the next 90 days. The founder reads this once and runs the next quarter on it.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, pivot to greatness, learnings-rich, synergy.

Ground rules:
- Honest, not harsh, not soft. A grade the founder can trust is worth more than a grade that flatters.
- Every learning, grade, and initiative traces to the pasted quarter data or to the delivered foundation. Never invent a metric, an outcome, or an engagement that is not in the input.
- Profile updates are PROPOSALS with evidence, not edicts. Only include genuine updates; if the profile holds, return an empty array and say the identity held.
- Carry-forward and leave-behind are specific: an asset, a content type, an angle, a behavior. Never "keep doing great work."
- Initiatives are banded now, next, later, park. Each names its platform, the pillar it serves, its effort, and how the founder will know it worked.
- If NO quarter data was pasted, the artifact becomes the baseline review: the opening says so plainly, grades read "first quarter, not yet gradable" with what would earn an A in the value, learnings become the assumptions to test, and the initiatives plan the first quarter instead of correcting one.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Length rules (strict):
- quarter_story and closing_directive: exactly TWO short paragraphs each, joined with \\n\\n. Each paragraph 2-4 sentences, written with real strategic authority.
- Learning and initiative bodies: 2-4 sentences. Grades, direction values: one clause or sentence, under 280 characters.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "quarter_story": "two short paragraphs · the honest story of the quarter, what the brand became, what it proved, what it must leave behind",
  "closing_directive": "two short paragraphs · the strategic directive for the next 90 days, written directly to the founder, what the brand is betting on",
  "grades": [
    { "label": "Overall", "value": "A|B|C|D · one clause on why" },
    { "label": "Brand coherence", "value": "..." },
    { "label": "Content quality", "value": "..." },
    { "label": "Audience alignment", "value": "..." },
    { "label": "Commercial progress", "value": "..." }
  ],
  "learnings": [
    { "title": "the learning, specific", "body": "2-4 sentences · the evidence from the quarter and what it changes going forward" }
  ],
  "carry_forward": ["specific asset, content type, angle, or behavior to double down on"],
  "leave_behind": ["specific thing to stop or retire, with the honest reason in the same line"],
  "qbp_updates": [
    { "field": "the profile field, e.g. Brand essence, Voice, Primary persona", "change": "strengthen | evolve | add | recalibrate", "body": "2-3 sentences · current reading, proposed reading, and the quarter's evidence for the change" }
  ],
  "initiatives": [
    { "band": "Now | Next | Later | Park", "title": "initiative name", "body": "2-4 sentences · why this, why now, traced to the quarter's learnings", "platform": "which platform or channel", "pillar": "the content pillar it serves", "effort": "low | medium | high", "success_metric": "one sentence · how the founder knows it worked" }
  ],
  "direction": [
    { "label": "Q+1 theme", "value": "one sentence" },
    { "label": "North star", "value": "the one outcome that makes Q+1 a success" },
    { "label": "Binding constraint", "value": "Time | Money | Clarity | Team | Trust · one clause on why" },
    { "label": "Lead format", "value": "the format to lead with" },
    { "label": "Territory", "value": "the content angle to own" },
    { "label": "Platform priority", "value": "ranked platforms with one reason each" }
  ]
}

grades has exactly FIVE entries in the order above. learnings has four to six. carry_forward and leave_behind have three to six each. qbp_updates has zero to five, genuine updates only. initiatives has eight to twelve across all four bands. direction has exactly SIX entries in the order above. If the QBP is sparse, lean on the archetype and the dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of QUARTERLY_REVIEW_FIELDS) {
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

const GRADE_LABELS = ['Overall', 'Brand coherence', 'Content quality', 'Audience alignment', 'Commercial progress'];
const DIRECTION_LABELS = ['Q+1 theme', 'North star', 'Binding constraint', 'Lead format', 'Territory', 'Platform priority'];

function toStringList(arr, fallback) {
  const list = (Array.isArray(arr) ? arr : [])
    .map(s => clampStr(String(s), 300, '')).filter(s => s.length > 0).slice(0, 10);
  return list.length > 0 ? list : [fallback];
}

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: "The quarter's story",    prose: clampStr(parsed.quarter_story, 8000, 'The quarter story did not generate. Regenerate to produce it.') },
    { heading: 'The closing directive',  prose: clampStr(parsed.closing_directive, 8000, 'The closing directive did not generate. Regenerate to produce it.') },
  ];

  const grades = (Array.isArray(parsed.grades) ? parsed.grades : []).slice(0, 5)
    .map((g, i) => ({
      label: clampStr(g?.label, 60, GRADE_LABELS[i] || `Grade ${i + 1}`),
      value: clampStr(g?.value, 300, 'Not gradable in this run.'),
    }));

  const learnings = (Array.isArray(parsed.learnings) ? parsed.learnings : []).slice(0, 6)
    .map((l, i) => ({
      kicker: `Learning ${i + 1}`,
      title: clampStr(l?.title, 200, `Learning ${i + 1}`),
      body: clampStr(l?.body, 6000, 'This learning did not generate. Regenerate to produce it.'),
    }));

  const updates = (Array.isArray(parsed.qbp_updates) ? parsed.qbp_updates : []).slice(0, 5)
    .map(u => ({
      kicker: clampStr(u?.change, 60, 'Recalibrate'),
      title: clampStr(u?.field, 200, 'Profile field'),
      body: clampStr(u?.body, 6000, 'This proposal did not generate. Regenerate to produce it.'),
    }));

  const initiatives = (Array.isArray(parsed.initiatives) ? parsed.initiatives : []).slice(0, 12)
    .map((n, i) => {
      const item = {
        kicker: clampStr(n?.band, 60, 'Next'),
        title: clampStr(n?.title, 200, `Initiative ${i + 1}`),
        meta: [clampStr(n?.effort, 40, '')].filter(s => s.length > 0),
        body: clampStr(n?.body, 6000, 'This initiative did not generate. Regenerate to produce it.'),
        specs: [
          n?.platform ? `Platform: ${clampStr(n.platform, 290, '')}` : '',
          n?.pillar ? `Pillar: ${clampStr(n.pillar, 292, '')}` : '',
          n?.success_metric ? `Worked when: ${clampStr(n.success_metric, 288, '')}` : '',
        ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
      };
      if (item.meta.length === 0) delete item.meta;
      if (item.specs.length === 0) delete item.specs;
      return item;
    });

  const direction = (Array.isArray(parsed.direction) ? parsed.direction : []).slice(0, 6)
    .map((d, i) => ({
      label: clampStr(d?.label, 60, DIRECTION_LABELS[i] || `Direction ${i + 1}`),
      value: clampStr(d?.value, 300, 'Not decided in this run.'),
    }));

  const data_blocks = [
    {
      type: 'spec_grid',
      title: "The quarter's grades",
      content: { specs: grades.length > 0 ? grades : [{ label: 'Overall', value: 'Regenerate to produce the grades.' }] },
    },
    {
      type: 'content_pack',
      title: 'What the quarter taught',
      content: {
        items: learnings.length > 0 ? learnings : [{
          kicker: 'Learning',
          title: 'The learnings did not generate',
          body: 'Regenerate to produce the quarter learnings.',
        }],
      },
    },
    {
      type: 'always_never',
      title: 'Carry forward, leave behind',
      content: {
        always: toStringList(parsed.carry_forward, 'Keep the identity anchored while the data accrues'),
        never: toStringList(parsed.leave_behind, 'Retire nothing until the evidence says so'),
      },
    },
    {
      type: 'content_pack',
      title: 'Q+1 initiatives',
      content: {
        items: initiatives.length > 0 ? initiatives : [{
          kicker: 'Now',
          title: 'The initiatives did not generate',
          body: 'Regenerate to produce the Q+1 initiatives.',
        }],
      },
    },
    {
      type: 'spec_grid',
      title: 'The Q+1 direction',
      content: { specs: direction.length > 0 ? direction : [{ label: 'Q+1 theme', value: 'Regenerate to produce the direction.' }] },
    },
  ];

  if (updates.length > 0) {
    data_blocks.push({
      type: 'content_pack',
      title: 'Profile recalibration proposals',
      content: { items: updates },
    });
  }

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '05 Intelligence · Quarterly Review',
      title: `The ${safeBrand} quarterly review`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: QUARTERLY_REVIEW_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = QUARTERLY_REVIEW_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('war_table_synthesizer', dependencies?.war_table_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the identity the quarter is graded against):\n\n${depBlocks}`;

  const sourceContent = typeof runtime_args?.source_content === 'string' && runtime_args.source_content.trim()
    ? runtime_args.source_content.trim().slice(0, SOURCE_CONTENT_CAP)
    : null;
  if (sourceContent) {
    userText += `\n\nThe founder's pasted quarter (what happened, in their words and numbers):\n${sourceContent}`;
  } else {
    userText += `\n\nNo quarter data was pasted. Produce the baseline review instead and say so plainly in the opening.`;
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
