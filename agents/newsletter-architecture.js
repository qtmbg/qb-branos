// agents/newsletter-architecture.js
// Chapter 5 · Step 1 · Newsletter Architecture Agent · the first Phase 03 agent.
//
// Reads the earned QBP plus the delivered foundation (Voice Guide, Soul
// Map, and War Table artifacts are hard dependencies) and produces the
// founder's owned channel: a named newsletter with its positioning,
// format, cadence, and growth plan, plus the first four issues written in
// the brand's voice and ready to send. The four-issue arc is fixed by the
// methodology: manifesto, belief challenge, framework reveal,
// transformation story.
//
// Rulings honored (chapter-5 authorization, 2026-07-04):
//   - tier_required 'starter' per the roadmap pricing block (Phase 03
//     content agents ship in Starter and up) · enforcement at dispatch.
//   - founder-initiated only: triggers ['manual', 'regenerate'], no chain.
//   - First cross-phase dependency in the framework: voice_guide_agent
//     (Phase 02) is a hard dependency, because the issues are written IN
//     the voice and writing them without the delivered guide is generic
//     copywriting, which the codex refuses.
//   - PROMPT HELD: registered and dispatchable for harness verification,
//     Console-invisible (PROMPT_HOLD_SLUGS) until the operator signs.
//
// Latency class: HEAVY. Four written issues need more output than the
// Phase 02 agents (6500 max tokens vs 3000). The call is a SINGLE attempt
// with a 120 000 ms in-call timeout and no inner retry loop, which keeps
// the true worst case inside the contract's IN_CALL_WORST_MS model
// (120 600 ms); a timeout surfaces edge_timeout and the reaper owns the
// retry per §5.5. Issue length is capped by the prompt's length rules
// (180 to 280 words per issue) so the pack fits the budget; the Content
// Approval Loop expands or reworks issues on regenerate.
//
// Methodology call · qbp_fields requirements:
//   archetypePrimary is the methodological floor, same reasoning as the
//   Phase 02 agents. Everything else degrades gracefully through the
//   prompt's fallback paths and the three dependency artifacts.

const MAX_TOKENS = 6500;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';

export const NEWSLETTER_ARCHITECTURE_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'manifesto',
  'antiVoice',
  'antiBrand',
  'alwaysNever',
  'audienceLanguage',
  'audienceDesires',
  'audienceFears',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'newsletter_architecture_agent',
  phase: '03',
  tier_required: 'starter',
  display_name: 'Newsletter Architecture',
  description: 'Turns your foundation into an owned channel: a named newsletter with its positioning, format, cadence and growth plan, plus the first four issues written and ready to send.',
  artifact_type: 'newsletter_architecture_agent',
  version: 1,
  inputs: {
    qbp_fields: NEWSLETTER_ARCHITECTURE_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    // Hard dependencies · the issues are written in the delivered voice,
    // about the delivered soul, for the delivered audience. A founder
    // without these gets missing_dependency and the Console routes them
    // back to the exercise that produces the missing artifact.
    artifact_dependencies: ['voice_guide_agent', 'soul_map_synthesizer', 'war_table_synthesizer'],
    files: [],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  // Founder-initiated only, per the standing Phase 02 ruling carried
  // forward: paid work fires when the founder asks for it.
  triggers: ['manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // model omitted · resolves to the canonical Sonnet default.
  retry_budget: 0,
};

const MODEL = META.model || 'claude-sonnet-4-6';

// ─── The prompt · HELD FOR OPERATOR SIGN-OFF ────────────────────────────
// The first Phase 03 artifact a paying founder reads. The prompt is
// product. It ships to main for harness verification; the agent stays
// Console-invisible until the operator signs this text.

const SYSTEM_PROMPT = `You are the Newsletter Architecture Agent for Quantum Branding OS, the first agent of Phase 03, Content Creation.

The founder has finished their foundation. They arrive with a Voice Guide (how the brand writes), a Soul Map (who the brand is), a War Table (who it speaks to and what it fights), and the raw signals of their Quantum Brand Profile. Your job is to give them the one channel no algorithm can take away: a named newsletter with its positioning decided, its format settled, and the first four issues written word for word, ready to send.

You are writing IN their voice, not about it. The Voice Guide in the dependency material is law: its register, its lexicon, its always and never. If a sentence you write would fail their guide, rewrite it before returning.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, game-changing, newsletter-y filler like "welcome to my corner of the internet".

Ground rules for the architecture:
- Name the newsletter. The name comes from the brand's own material: its essence, its paradox, a phrase from the Soul Map. Two or three words. Not "The [Brand] Newsletter" unless nothing better is earned.
- Position it against the inbox the reader already has: why this survives the unsubscribe purge, said plainly.
- The format is a decision, not options. One cadence, one length, one structure. Decide and say why in one breath.
- The platform recommendation is one platform with one reason. Weigh deliverability and owning the list over dashboard polish.

Ground rules for the four issues (the arc is fixed):
- Issue 1 · Manifesto: the brand plants its flag and defines its reader.
- Issue 2 · Belief challenge: take the reader's central fear or false belief head on, from the War Table audience material.
- Issue 3 · Framework reveal: give the brand's method away plainly. Generosity earns authority.
- Issue 4 · Transformation story: what changes for the reader who stays. No invented case studies, no fake names, no fabricated numbers. The transformation is argued from the foundation, not testified.
- Every issue is COMPLETE: it opens, it develops one idea, it closes with a small next step. Written in the brand voice, using the audience's own language from the War Table where it earns its place.
- Forbidden filler, named: "in today's fast-paced world", "I hope this finds you well", "let's dive in", and any opening that delays the idea. Open inside the idea.

Length rules (strict, they are the budget):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- Each issue body: 180 to 280 words, in 3-5 short paragraphs joined with \\n\\n.
- Subject lines: under 8 words, no clickbait.
- Spec values and step details: one sentence each.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "name": "the newsletter's name, two or three words",
  "tagline": "one line under the name, under 12 words",
  "opening": "two short paragraphs · why this newsletter exists and who it is for, the positioning argued",
  "format_and_cadence": "two short paragraphs · the format decided: cadence, length, structure, and why this fits this audience",
  "growth_plan": "two short paragraphs · how the list grows without ads: the growth mechanic, the platform recommendation with its one reason, and the three-email welcome sequence in one sentence each",
  "issues": [
    {
      "kicker": "Issue 01 · Manifesto",
      "subject": "the subject line",
      "read_time": "N min read",
      "send_note": "best send day and time, short",
      "body": "the complete issue, 180-280 words, 3-5 short paragraphs joined with \\n\\n",
      "purpose": "one sentence · what this issue does strategically",
      "growth_hook": "one sentence · the share or forward mechanic inside this issue",
      "ps": "an optional one-line P.S. in the voice, or empty string"
    },
    { "kicker": "Issue 02 · Belief challenge", "subject": "...", "read_time": "...", "send_note": "...", "body": "...", "purpose": "...", "growth_hook": "...", "ps": "" },
    { "kicker": "Issue 03 · Framework reveal", "subject": "...", "read_time": "...", "send_note": "...", "body": "...", "purpose": "...", "growth_hook": "...", "ps": "" },
    { "kicker": "Issue 04 · Transformation story", "subject": "...", "read_time": "...", "send_note": "...", "body": "...", "purpose": "...", "growth_hook": "...", "ps": "" }
  ],
  "format_decisions": [
    { "label": "Cadence", "value": "..." },
    { "label": "Length", "value": "..." },
    { "label": "Register", "value": "..." },
    { "label": "Platform", "value": "..." }
  ],
  "setup_steps": [
    { "action": "...", "detail": "one sentence" },
    { "action": "...", "detail": "one sentence" },
    { "action": "...", "detail": "one sentence" }
  ]
}

If the QBP is sparse, lean on the archetype and the three dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of NEWSLETTER_ARCHITECTURE_FIELDS) {
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

// Distill a dependency artifact to the parts the prompt needs. Three
// dependencies ride in this prompt, so each digest is capped harder than
// the Phase 02 agents cap theirs; the voice's rules and the audience's
// language survive the cut, rendering metadata does not.
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

// HEAVY-CLASS CALL · one attempt, no inner retry. A 6500-token generation
// can run past the fleet's 60 s envelope, so this agent runs a single
// 120 000 ms attempt instead of the standard two 60 s attempts; the true
// worst case stays inside the contract's IN_CALL_WORST_MS model and the
// reaper owns retries beyond it.
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

// Clamp helpers · a chatty model can never produce a shape the schema
// rejects. Every string lands non-empty and inside its cap.
function clampStr(v, max, fallback) {
  const s = (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
  return s.length > max ? s.slice(0, max - 1).trimEnd() : s;
}

const ISSUE_KICKERS = [
  'Issue 01 · Manifesto',
  'Issue 02 · Belief challenge',
  'Issue 03 · Framework reveal',
  'Issue 04 · Transformation story',
];

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'Why this newsletter exists', prose: clampStr(parsed.opening, 8000, 'The positioning argument did not generate. Regenerate to produce it.') },
    { heading: 'The format and cadence',     prose: clampStr(parsed.format_and_cadence, 8000, 'The format decision did not generate. Regenerate to produce it.') },
    { heading: 'The growth plan',            prose: clampStr(parsed.growth_plan, 8000, 'The growth plan did not generate. Regenerate to produce it.') },
  ];

  const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).slice(0, 4);
  const items = issues.map((it, i) => {
    const item = {
      kicker: clampStr(it?.kicker, 60, ISSUE_KICKERS[i] || `Issue 0${i + 1}`),
      title: clampStr(it?.subject, 200, `Issue ${i + 1}`),
      meta: [
        clampStr(it?.read_time, 40, ''),
        clampStr(it?.send_note, 40, ''),
      ].filter(s => s.length > 0).slice(0, 6),
      body: clampStr(it?.body, 6000, 'This issue did not generate. Regenerate to produce it.'),
      specs: [
        it?.purpose ? `Purpose: ${clampStr(it.purpose, 290, '')}` : '',
        it?.growth_hook ? `Growth hook: ${clampStr(it.growth_hook, 285, '')}` : '',
      ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
    };
    const ps = (typeof it?.ps === 'string' && it.ps.trim()) ? it.ps.trim() : '';
    if (ps) item.extras = [{ label: 'P.S.', body: clampStr(ps, 2000, '') }].filter(e => e.body.length > 0);
    if (item.meta.length === 0) delete item.meta;
    if (item.specs.length === 0) delete item.specs;
    return item;
  });

  const decisions = (Array.isArray(parsed.format_decisions) ? parsed.format_decisions : [])
    .slice(0, 12)
    .map(s => ({
      label: clampStr(s?.label, 60, 'Decision'),
      value: clampStr(s?.value, 300, 'Not decided in this run.'),
    }));

  const steps = (Array.isArray(parsed.setup_steps) ? parsed.setup_steps : [])
    .slice(0, 15)
    .map(st => {
      const step = { action: clampStr(st?.action, 200, 'Set up the send') };
      const detail = (typeof st?.detail === 'string' && st.detail.trim()) ? st.detail.trim() : '';
      if (detail) step.detail = clampStr(detail, 600, '');
      return step;
    });

  const data_blocks = [
    {
      type: 'content_pack',
      title: 'The first four issues',
      content: {
        items: items.length > 0 ? items : [{
          kicker: ISSUE_KICKERS[0],
          title: 'The issues did not generate',
          body: 'Regenerate to produce the four-issue arc.',
        }],
      },
    },
    {
      type: 'spec_grid',
      title: 'The format decisions',
      content: {
        specs: decisions.length > 0 ? decisions : [{ label: 'Format', value: 'Regenerate to produce the format decisions.' }],
      },
    },
    {
      type: 'numbered_procedure',
      title: 'Setting up the send',
      content: {
        steps: steps.length > 0 ? steps : [{ action: 'Regenerate to produce the setup steps.' }],
      },
    },
  ];

  const name = clampStr(parsed.name, 160, `The ${safeBrand} letter`);
  const tagline = (typeof parsed.tagline === 'string' && parsed.tagline.trim())
    ? clampStr(parsed.tagline, 300, '')
    : '';

  const header = {
    eyebrow: '03 Content Creation · Newsletter Architecture',
    title: name,
    agent: META.slug,
    generated_at: new Date().toISOString(),
    version: 1,
  };
  if (tagline) header.subtitle = tagline;

  return {
    schema_version: '1.0',
    header,
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: NEWSLETTER_ARCHITECTURE_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = NEWSLETTER_ARCHITECTURE_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('voice_guide_agent', dependencies?.voice_guide_agent),
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('war_table_synthesizer', dependencies?.war_table_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the Voice Guide is law for every sentence you write):\n\n${depBlocks}`;

  // Content Approval Loop · runtime_args.feedback is the founder's
  // revision note from the prior round (cap lives at the surface layer
  // per the chapter-2 adjudication).
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
