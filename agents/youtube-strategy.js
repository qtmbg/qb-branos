// agents/youtube-strategy.js
// Chapter 5 · Step 4 · YouTube Strategy Agent.
//
// Reads the earned QBP plus the delivered foundation (Voice Guide, Soul
// Map, War Table are hard dependencies) and produces a channel with a
// premise: positioning, three named series, and the first three episodes
// scripted word for word, each carrying two short-form cuts and a
// repurpose angle as extras. The scripts are the deliverable; the founder
// should be able to record episode one from this artifact alone.
//
// Rulings honored (chapter-5 authorization, 2026-07-04):
//   - tier_required 'starter' per the roadmap pricing block.
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependency on voice_guide_agent (spoken voice rides the
//     written register until a spoken guide exists).
//   - Thumbnail concepts are NEUTRAL image briefs: they never name a
//     third-party image generator (the anti-aggregator rule).
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs.
//
// Latency class: HEAVY. Single attempt at a 120 000 ms in-call timeout,
// no inner retry (the contract's IN_CALL_WORST_MS model holds).
//
// SCOPE CUT, documented: the legacy standalone tool generated six full
// scripts, eighteen reels, and per-video repurpose packs at 14 000 tokens
// in one call, which the contract's registration ceiling rejects at any
// retry budget. This agent ships THREE full episodes (250 to 400 words in
// beats), TWO cuts per episode, ONE repurpose angle per episode, inside
// 8 000 tokens; the Content Approval Loop and regenerate extend the season.

const MAX_TOKENS = 8000;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';

export const YOUTUBE_STRATEGY_FIELDS = [
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
  'paradox',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'youtube_strategy_agent',
  phase: '03',
  tier_required: 'starter',
  display_name: 'YouTube Strategy',
  description: 'A channel with a premise: positioning, three named series, and the first three episodes scripted word for word, each with its short-form cuts and repurpose angle.',
  artifact_type: 'youtube_strategy_agent',
  version: 1,
  inputs: {
    qbp_fields: YOUTUBE_STRATEGY_FIELDS.map(field => ({
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

const SYSTEM_PROMPT = `You are the YouTube Strategy Agent for Quantum Branding OS, part of Phase 03, Content Creation.

The founder has finished their foundation. They arrive with a Voice Guide (how the brand speaks), a Soul Map (who the brand is), a War Table (who it speaks to and what it fights), and the raw signals of their Quantum Brand Profile. Your job is a channel with a premise, not a channel with uploads: the positioning, three named series the brand can sustain, and the first three episodes scripted word for word so the founder can press record tomorrow.

You are writing IN their voice, spoken. The Voice Guide is law; scripts read aloud must sound like the brand, not like a video essay template.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, smash that, don't forget to like and subscribe.

Ground rules for the channel:
- The premise is one argument the channel keeps making, derived from the brand essence and the paradox. Say it in one sentence inside the opening, then defend it.
- Three series, each with a name the brand could trademark in tone, a one-line premise, a cadence, and three content pillars. The three series must cover: the method (how the brand thinks), the belief (what it fights), and the audience (their world in the brand's lens).

Ground rules for the episodes:
- One episode per series, scripted in BEATS: a cold-open hook (first 15 seconds, word for word), the opening (the promise), two acts (the development), and the close with one small ask. 250 to 400 words total per script, written to be SPOKEN.
- The hook earns the next 30 seconds without baiting. Forbidden: "in this video I'm going to", "what's up guys", any greeting before the idea.
- Thumbnail concepts are NEUTRAL image briefs: subject, composition, mood, palette words. Never name a software product. No text-heavy thumbnail instructions beyond four words.
- Two short-form cuts per episode: the strongest 30-second beat rewritten as a vertical script, platform-agnostic.
- One repurpose angle per episode: a one-paragraph note on where else this idea publishes and how it changes.
- No invented numbers, subscribers, or results. Founder-specific detail gets a marked [your example here] slot, at most one per script.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Length rules (strict, they are the budget):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- Scripts: 250 to 400 words in labeled beats, paragraphs joined with \\n\\n. Label beats inline like "Hook:", "Open:", "Act one:", "Act two:", "Close:".
- Cuts: 60 to 90 words each. Repurpose angles: one paragraph.
- Spec values: one sentence each.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs · the channel premise and the target viewer",
  "series_system": "two short paragraphs · why these three series and how they feed each other",
  "repurpose_flywheel": "two short paragraphs · how one episode becomes a week of content",
  "series": [
    { "name": "Series name", "premise": "one line", "cadence": "one line", "pillars": ["three", "content", "pillars"] }
  ],
  "episodes": [
    {
      "kicker": "Series · <series name>",
      "title": "the episode title",
      "duration": "target length",
      "format": "talking head | desk demo | voiceover",
      "body": "the full script in labeled beats, 250-400 words",
      "thumbnail_concept": "one to two sentences, neutral image brief",
      "title_variant_a": "an alternate title",
      "title_variant_b": "a second alternate",
      "description_line": "the first line of the video description",
      "tags_line": "six to eight comma-separated tags",
      "cuts": [
        { "label": "Cut 1 · vertical", "body": "60-90 word vertical script" },
        { "label": "Cut 2 · vertical", "body": "60-90 word vertical script" }
      ],
      "repurpose": { "label": "Repurpose angle", "body": "one paragraph" }
    }
  ],
  "channel_settings": [
    { "label": "Upload cadence", "value": "..." },
    { "label": "Episode length", "value": "..." },
    { "label": "Thumbnail system", "value": "..." },
    { "label": "Description template", "value": "..." }
  ]
}

series has exactly THREE items. episodes has exactly THREE items, one per series, kickers matching the series names. If the QBP is sparse, lean on the archetype and the three dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of YOUTUBE_STRATEGY_FIELDS) {
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

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'The channel premise',     prose: clampStr(parsed.opening, 8000, 'The premise did not generate. Regenerate to produce it.') },
    { heading: 'The series system',       prose: clampStr(parsed.series_system, 8000, 'The series system did not generate. Regenerate to produce it.') },
    { heading: 'The repurpose flywheel',  prose: clampStr(parsed.repurpose_flywheel, 8000, 'The flywheel did not generate. Regenerate to produce it.') },
  ];

  const series = (Array.isArray(parsed.series) ? parsed.series : []).slice(0, 3);
  const seriesGroups = series.map(s => ({
    label: clampStr(s?.name, 200, 'Series'),
    items: [
      clampStr(s?.premise, 300, ''),
      s?.cadence ? `Cadence: ${clampStr(s.cadence, 290, '')}` : '',
    ].concat(Array.isArray(s?.pillars) ? s.pillars.map(p => clampStr(String(p), 300, '')) : [])
      .filter(x => x.length > 0)
      .slice(0, 12),
  })).filter(g => g.items.length > 0);

  const episodes = (Array.isArray(parsed.episodes) ? parsed.episodes : []).slice(0, 3);
  const items = episodes.map((ep, i) => {
    const item = {
      kicker: clampStr(ep?.kicker, 60, `Episode 0${i + 1}`),
      title: clampStr(ep?.title, 200, `Episode ${i + 1}`),
      meta: [
        clampStr(ep?.duration, 40, ''),
        clampStr(ep?.format, 40, ''),
      ].filter(s => s.length > 0).slice(0, 6),
      body: clampStr(ep?.body, 6000, 'This script did not generate. Regenerate to produce it.'),
      specs: [
        ep?.thumbnail_concept ? `Thumbnail: ${clampStr(ep.thumbnail_concept, 289, '')}` : '',
        ep?.title_variant_a ? `Title variant A: ${clampStr(ep.title_variant_a, 283, '')}` : '',
        ep?.title_variant_b ? `Title variant B: ${clampStr(ep.title_variant_b, 283, '')}` : '',
        ep?.description_line ? `Description: ${clampStr(ep.description_line, 287, '')}` : '',
        ep?.tags_line ? `Tags: ${clampStr(ep.tags_line, 294, '')}` : '',
      ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
    };
    const extras = [];
    for (const cut of (Array.isArray(ep?.cuts) ? ep.cuts : []).slice(0, 4)) {
      const bodyTxt = clampStr(cut?.body, 2000, '');
      if (bodyTxt) extras.push({ label: clampStr(cut?.label, 80, 'Cut · vertical'), body: bodyTxt });
    }
    const rep = ep?.repurpose;
    const repBody = clampStr(rep?.body, 2000, '');
    if (repBody) extras.push({ label: clampStr(rep?.label, 80, 'Repurpose angle'), body: repBody });
    if (extras.length > 0) item.extras = extras.slice(0, 6);
    if (item.meta.length === 0) delete item.meta;
    if (item.specs.length === 0) delete item.specs;
    return item;
  });

  const settings = (Array.isArray(parsed.channel_settings) ? parsed.channel_settings : [])
    .slice(0, 12)
    .map(s => ({
      label: clampStr(s?.label, 60, 'Setting'),
      value: clampStr(s?.value, 300, 'Not decided in this run.'),
    }));

  const data_blocks = [
    {
      type: 'descriptor_list',
      title: 'Three series',
      content: {
        groups: seriesGroups.length > 0 ? seriesGroups : [{ label: 'The series did not generate', items: ['Regenerate to produce the series system.'] }],
      },
    },
    {
      type: 'content_pack',
      title: 'The first three episodes',
      content: {
        items: items.length > 0 ? items : [{
          kicker: 'Episode 01',
          title: 'The episodes did not generate',
          body: 'Regenerate to produce the three scripted episodes.',
        }],
      },
    },
    {
      type: 'spec_grid',
      title: 'Channel settings',
      content: {
        specs: settings.length > 0 ? settings : [{ label: 'Cadence', value: 'Regenerate to produce the channel settings.' }],
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '03 Content Creation · YouTube Strategy',
      title: `The ${safeBrand} channel`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: YOUTUBE_STRATEGY_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = YOUTUBE_STRATEGY_FIELDS.map(k => {
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

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the Voice Guide is law, spoken):\n\n${depBlocks}`;

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
