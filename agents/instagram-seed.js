// agents/instagram-seed.js
// Chapter 5 · Step 3 · Instagram Seed Agent.
//
// Reads the earned QBP plus the delivered foundation (Voice Guide, Soul
// Map, Visual DNA are hard dependencies) and produces the founder's first
// twelve posts, sequenced as a four-arc launch story (Identity, Belief,
// Work, Community · three posts per arc), each with its hook, complete
// caption, neutral visual brief, and hashtags. Visual DNA rides in the
// dependency set because the visual briefs and the grid aesthetic build
// on the delivered palette and type decisions, not on taste.
//
// Rulings honored (chapter-5 authorization, 2026-07-04):
//   - tier_required 'starter' per the roadmap pricing block.
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependency on voice_guide_agent (captions are written
//     IN the delivered voice).
//   - Image briefs are NEUTRAL: they describe the image, they never name
//     a third-party image generator (the anti-aggregator rule).
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs.
//
// Latency class: HEAVY. Twelve written captions (6500 max tokens).
// Single attempt at a 120 000 ms in-call timeout, no inner retry (the
// contract's IN_CALL_WORST_MS model holds; the reaper owns retries).
// Caption length is capped by the prompt (60 to 120 words) so the pack
// fits the budget.

const MAX_TOKENS = 6500;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';

export const INSTAGRAM_SEED_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'colorTerritory',
  'forbiddenColor',
  'visualTerritoryNote',
  'antiVoice',
  'antiBrand',
  'alwaysNever',
  'audienceLanguage',
  'paradox',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'instagram_seed_agent',
  phase: '03',
  tier_required: 'starter',
  display_name: 'Instagram Seed',
  description: 'Your first twelve posts, written end to end and sequenced as a four-arc launch story, with hooks, captions, visual briefs and hashtags ready to post.',
  artifact_type: 'instagram_seed_agent',
  version: 1,
  inputs: {
    qbp_fields: INSTAGRAM_SEED_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    artifact_dependencies: ['voice_guide_agent', 'soul_map_synthesizer', 'visual_dna_synthesizer'],
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

const SYSTEM_PROMPT = `You are the Instagram Seed Agent for Quantum Branding OS, part of Phase 03, Content Creation.

The founder has finished their foundation. They arrive with a Voice Guide (how the brand writes), a Soul Map (who the brand is), a Visual DNA (its palette and type direction), and the raw signals of their Quantum Brand Profile. Your job is their first twelve posts, written end to end and sequenced as a launch story a stranger could follow: who this brand is, what it believes, how it works, and who belongs with it.

You are writing IN their voice. The Voice Guide in the dependency material is law. The Visual DNA is equally law for every visual brief: the palette and type decisions are made; briefs build on them, they do not relitigate them.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, aesthetic as a noun, vibes.

Ground rules for the twelve seeds (the arc is fixed):
- Arc 1 · Identity, posts 1-3: who this brand is and why it exists.
- Arc 2 · Belief, posts 4-6: what it believes that the reader's feed does not, from the anti-brand and the paradox.
- Arc 3 · Work, posts 7-9: how it works, the method shown plainly.
- Arc 4 · Community, posts 10-12: who belongs here and the invitation.
- Every caption is COMPLETE and ready to paste: a first line that stops the scroll without baiting it, a body that develops one idea in the brand voice, a close with one small ask. 60 to 120 words, line breaks where the voice breathes.
- Visual briefs are NEUTRAL image descriptions a founder could hand to any designer, photographer, or image tool: subject, composition, palette from the Visual DNA, mood. NEVER name a software product or generator in a brief. Respect the forbidden color absolutely.
- Hashtags: up to ten per post, specific over broad, no banned-word hashtags, lowercase.
- No invented followers, results, or testimonials. Where a founder-specific detail belongs, mark the slot [your example here] at most once per caption.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Forbidden filler, named: "content that resonates", "authentic connection", "double tap if", "link in bio" as a close on more than TWO of the twelve, and any caption that could be pasted onto another brand's grid unchanged.

Length rules (strict, they are the budget):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- Caption bodies: 60 to 120 words.
- Hooks, briefs, and CTAs: one sentence each. Briefs may run to two.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs · the launch story in brief: what these twelve posts do as a sequence",
  "reading_the_arcs": "two short paragraphs · how the four arcs build on each other and on the foundation",
  "profile_prep": "two short paragraphs · the bio line (quoted), the grid's first impression, what to set before post one",
  "posts": [
    {
      "kicker": "Arc 1 · Identity",
      "title": "a short post title for the founder's planning, not shown in the caption",
      "post_type": "single image | carousel | reel note",
      "hook": "the caption's first line",
      "body": "the complete caption, 60-120 words, line breaks as \\n\\n",
      "visual_brief": "one to two sentences · neutral image description on the Visual DNA palette",
      "cta": "one sentence, the small ask",
      "hashtags": ["up", "to", "ten", "lowercase", "tags"]
    }
  ],
  "grid_aesthetic": [
    { "label": "Palette mood", "value": "..." },
    { "label": "Composition rhythm", "value": "..." },
    { "label": "Type on image", "value": "..." },
    { "label": "Cadence", "value": "..." }
  ]
}

posts has exactly TWELVE items, three per arc, kickers exactly "Arc 1 · Identity", "Arc 2 · Belief", "Arc 3 · Work", "Arc 4 · Community". If the QBP is sparse, lean on the archetype and the three dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of INSTAGRAM_SEED_FIELDS) {
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

const ARC_KICKERS = ['Arc 1 · Identity', 'Arc 2 · Belief', 'Arc 3 · Work', 'Arc 4 · Community'];

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'Opening',                    prose: clampStr(parsed.opening, 8000, 'The launch story did not generate. Regenerate to produce it.') },
    { heading: 'Reading the four arcs',      prose: clampStr(parsed.reading_the_arcs, 8000, 'The arc reading did not generate. Regenerate to produce it.') },
    { heading: 'Profile prep before post one', prose: clampStr(parsed.profile_prep, 8000, 'The profile prep did not generate. Regenerate to produce it.') },
  ];

  const posts = (Array.isArray(parsed.posts) ? parsed.posts : []).slice(0, 12);
  const items = posts.map((p, i) => {
    const item = {
      kicker: clampStr(p?.kicker, 60, ARC_KICKERS[Math.min(Math.floor(i / 3), 3)]),
      title: clampStr(p?.title, 200, `Post ${i + 1}`),
      meta: [clampStr(p?.post_type, 40, '')].filter(s => s.length > 0),
      body: clampStr(p?.body, 6000, 'This caption did not generate. Regenerate to produce it.'),
      specs: [
        p?.hook ? `Hook: ${clampStr(p.hook, 293, '')}` : '',
        p?.visual_brief ? `Visual brief: ${clampStr(p.visual_brief, 285, '')}` : '',
        p?.cta ? `The ask: ${clampStr(p.cta, 291, '')}` : '',
      ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
      tags: (Array.isArray(p?.hashtags) ? p.hashtags : [])
        .map(t => clampStr(String(t).replace(/^#/, '').toLowerCase(), 40, ''))
        .filter(t => t.length > 0)
        .slice(0, 10),
    };
    if (item.meta.length === 0) delete item.meta;
    if (item.specs.length === 0) delete item.specs;
    if (item.tags.length === 0) delete item.tags;
    return item;
  });

  const aesthetic = (Array.isArray(parsed.grid_aesthetic) ? parsed.grid_aesthetic : [])
    .slice(0, 12)
    .map(s => ({
      label: clampStr(s?.label, 60, 'Decision'),
      value: clampStr(s?.value, 300, 'Not decided in this run.'),
    }));

  const data_blocks = [
    {
      type: 'content_pack',
      title: 'The twelve seeds',
      content: {
        items: items.length > 0 ? items : [{
          kicker: ARC_KICKERS[0],
          title: 'The seeds did not generate',
          body: 'Regenerate to produce the twelve-post launch story.',
        }],
      },
    },
    {
      type: 'spec_grid',
      title: 'The grid aesthetic',
      content: {
        specs: aesthetic.length > 0 ? aesthetic : [{ label: 'Palette mood', value: 'Regenerate to produce the grid decisions.' }],
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '03 Content Creation · Instagram Seed',
      title: `Twelve seeds for ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: INSTAGRAM_SEED_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = INSTAGRAM_SEED_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('voice_guide_agent', dependencies?.voice_guide_agent),
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('visual_dna_synthesizer', dependencies?.visual_dna_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the Voice Guide is law for captions; the Visual DNA is law for briefs):\n\n${depBlocks}`;

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
