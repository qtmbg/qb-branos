// agents/linkedin-strategy.js
// Chapter 5 · Step 2 · LinkedIn Strategy Agent.
//
// Reads the earned QBP plus the delivered foundation (Voice Guide, Soul
// Map, War Table are hard dependencies) and produces two systems in one
// artifact: the founder's personal profile rewritten with an eight-post
// arc, and the company page rewritten with a six-post arc, every post
// written in the brand voice. One artifact carries both systems as two
// content_pack blocks · the chapter-5 ruled default (one subject, one
// reading surface, no dispatch change).
//
// Rulings honored (chapter-5 authorization, 2026-07-04):
//   - tier_required 'starter' per the roadmap pricing block.
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependency on voice_guide_agent, same reasoning as
//     Newsletter Architecture: posts written outside the delivered voice
//     are generic copywriting, which the codex refuses.
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs.
//
// Latency class: HEAVY. Fourteen written posts plus two profile rewrites
// (8000 max tokens). Single attempt at a 120 000 ms in-call timeout, no
// inner retry (the contract's IN_CALL_WORST_MS model holds; the reaper
// owns retries).
//
// SCOPE CUT, documented: the legacy standalone tool generated 12 personal
// + 8 company posts at 12 000 tokens, which does not fit the runtime
// envelope at retry_budget 0. This agent ships 8 + 6 with tight post
// bodies (90 to 160 words); the Content Approval Loop and regenerate
// extend the arc.

const MAX_TOKENS = 8000;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';

export const LINKEDIN_STRATEGY_FIELDS = [
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
  slug: 'linkedin_strategy_agent',
  phase: '03',
  tier_required: 'starter',
  display_name: 'LinkedIn Strategy',
  description: 'Two systems in one run: your personal profile rewritten with a founder posting arc, and the company page rewritten with its own arc, every post written in your voice.',
  artifact_type: 'linkedin_strategy_agent',
  version: 1,
  inputs: {
    qbp_fields: LINKEDIN_STRATEGY_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    artifact_dependencies: ['voice_guide_agent', 'soul_map_synthesizer', 'war_table_synthesizer'],
    files: [],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  triggers: ['manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // model omitted · resolves to the canonical Sonnet default.
  retry_budget: 0,
};

const MODEL = META.model || 'claude-sonnet-4-6';

// ─── The prompt · HELD FOR OPERATOR SIGN-OFF ────────────────────────────

const SYSTEM_PROMPT = `You are the LinkedIn Strategy Agent for Quantum Branding OS, part of Phase 03, Content Creation.

The founder has finished their foundation. They arrive with a Voice Guide (how the brand writes), a Soul Map (who the brand is), a War Table (who it speaks to and what it fights), and the raw signals of their Quantum Brand Profile. Your job is two systems in one pass: the founder's PERSONAL presence, rewritten and armed with an eight-post arc, and the COMPANY page, rewritten and armed with a six-post arc. The personal account carries reach; the company page carries proof. They must sound like the same brand without repeating each other.

You are writing IN their voice. The Voice Guide in the dependency material is law: its register, its lexicon, its always and never. A post that would fail their guide gets rewritten before you return it.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, thrilled to announce, humbled, rocket ship.

Ground rules for the profiles:
- The personal headline is a claim, not a job title. It comes from the brand essence in the reader's language, under 120 characters.
- The About sections open inside the idea. Forbidden: "I help X do Y" as an opener, "passionate about", any sentence that could sit on a thousand profiles.
- The company page tagline and About position the brand against the anti-brand, plainly.
- Featured-section and banner guidance is one concrete instruction each, not options.

Ground rules for the posts:
- Personal arc: eight posts across four weeks, two per week, each tied to a content pillar you derive from the Soul Map and War Table. The arc has a shape: week one plants the flag, week two challenges the reader's false belief, week three shows the work, week four invites.
- Company arc: six posts across the same four weeks. Proof, method, and audience language. Never a press release.
- Every post is COMPLETE and ready to paste: a first line that earns the "see more" click, a body that develops one idea, a close that asks one small thing. 90 to 160 words.
- Hooks are first lines, not headlines. Forbidden hook filler: "I've been thinking", "Unpopular opinion", "Let that sink in".
- No invented stories, clients, metrics, or engagements. Every post argues from the foundation. Where a founder story would go, write the post so the founder can drop their own detail into a clearly marked slot like [your example here] at most ONCE per post.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Length rules (strict, they are the budget):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- Post bodies: 90 to 160 words, short paragraphs joined with \\n\\n.
- Spec values: one sentence each.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs · the two-system play: what personal carries, what the page carries, how they differ",
  "personal_profile": "two short paragraphs · the rewritten headline (quoted), the new About condensed, the featured and banner instruction",
  "company_page": "two short paragraphs · the rewritten tagline (quoted), the new About condensed, the follow strategy",
  "personal_posts": [
    { "kicker": "Week 1 · <pillar>", "hook": "the first line of the post", "post_type": "text | document | image note", "best_time": "day + window", "body": "the complete post, 90-160 words", "purpose": "one sentence", "cta": "one sentence, the small ask" }
  ],
  "company_posts": [
    { "kicker": "Week 1 · <pillar>", "hook": "...", "post_type": "...", "best_time": "...", "body": "...", "purpose": "...", "cta": "..." }
  ],
  "system_settings": [
    { "label": "Personal cadence", "value": "..." },
    { "label": "Company cadence", "value": "..." },
    { "label": "The pillars", "value": "..." },
    { "label": "Connection strategy", "value": "..." }
  ]
}

personal_posts has exactly EIGHT items. company_posts has exactly SIX. If the QBP is sparse, lean on the archetype and the three dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of LINKEDIN_STRATEGY_FIELDS) {
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

function packItems(posts, cap, weekFallback) {
  return (Array.isArray(posts) ? posts : []).slice(0, cap).map((p, i) => {
    const item = {
      kicker: clampStr(p?.kicker, 60, `Week ${Math.floor(i / 2) + 1}${weekFallback}`),
      title: clampStr(p?.hook, 200, `Post ${i + 1}`),
      meta: [
        clampStr(p?.post_type, 40, ''),
        clampStr(p?.best_time, 40, ''),
      ].filter(s => s.length > 0).slice(0, 6),
      body: clampStr(p?.body, 6000, 'This post did not generate. Regenerate to produce it.'),
      specs: [
        p?.purpose ? `Purpose: ${clampStr(p.purpose, 290, '')}` : '',
        p?.cta ? `The ask: ${clampStr(p.cta, 290, '')}` : '',
      ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
    };
    if (item.meta.length === 0) delete item.meta;
    if (item.specs.length === 0) delete item.specs;
    return item;
  });
}

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'The two-system play',        prose: clampStr(parsed.opening, 8000, 'The strategy did not generate. Regenerate to produce it.') },
    { heading: 'Your profile, rewritten',    prose: clampStr(parsed.personal_profile, 8000, 'The profile rewrite did not generate. Regenerate to produce it.') },
    { heading: 'The company page, rewritten', prose: clampStr(parsed.company_page, 8000, 'The page rewrite did not generate. Regenerate to produce it.') },
  ];

  const personal = packItems(parsed.personal_posts, 8, ' · founder');
  const company  = packItems(parsed.company_posts, 6, ' · page');

  const settings = (Array.isArray(parsed.system_settings) ? parsed.system_settings : [])
    .slice(0, 12)
    .map(s => ({
      label: clampStr(s?.label, 60, 'Setting'),
      value: clampStr(s?.value, 300, 'Not decided in this run.'),
    }));

  const data_blocks = [
    {
      type: 'content_pack',
      title: 'The founder arc · eight posts',
      content: {
        items: personal.length > 0 ? personal : [{ kicker: 'Week 1 · founder', title: 'The posts did not generate', body: 'Regenerate to produce the founder arc.' }],
      },
    },
    {
      type: 'content_pack',
      title: 'The company arc · six posts',
      content: {
        items: company.length > 0 ? company : [{ kicker: 'Week 1 · page', title: 'The posts did not generate', body: 'Regenerate to produce the company arc.' }],
      },
    },
    {
      type: 'spec_grid',
      title: 'The system settings',
      content: {
        specs: settings.length > 0 ? settings : [{ label: 'Cadence', value: 'Regenerate to produce the system settings.' }],
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '03 Content Creation · LinkedIn Strategy',
      title: `${safeBrand} on LinkedIn`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: LINKEDIN_STRATEGY_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = LINKEDIN_STRATEGY_FIELDS.map(k => {
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
