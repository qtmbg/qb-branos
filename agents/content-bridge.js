// agents/content-bridge.js
// Chapter 5 · Step 5 · Content Bridge Agent · the Phase 03 fan-in.
//
// Takes a piece of content the founder pastes (runtime_args.source_content)
// and produces a production brief a beginner could execute on the platform
// they choose: numbered steps, platform settings, and the brand applied.
// When no source is pasted, it briefs from the foundation itself: a
// first-post brief for the founder's strongest channel. The FACELESS path
// is the default; likeness layers (UGC video, avatar) only enter when the
// founder names such a platform, and their briefs carry a consent
// reminder step.
//
// Rulings honored (chapter-5 authorization, 2026-07-04):
//   - tier_required 'starter' per the roadmap pricing block.
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependency on voice_guide_agent; visual_dna for the
//     brand-application block (palette and type are decided upstream).
//   - VENDOR DISCIPLINE: platform names come ONLY from the
//     OPERATOR_PLATFORMS constant below, carried verbatim from the legacy
//     standalone tool and marked for operator review. The model may not
//     invent or recommend vendors outside it. Third-party API wiring
//     (Canva, HeyGen, Creatify push) is a flagged follow-up needing
//     operator accounts; this agent produces the brief.
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs.
//
// Latency class: STANDARD (3000 max tokens, the logo-direction call shape).

const MAX_TOKENS = 3000;
const CLAUDE_TIMEOUT_MS = 60000; // step-5 Node runtime envelope (see agents/contract.js budgets)
const DEFAULT_BRAND_NAME = 'Your Brand';
const SOURCE_CONTENT_CAP = 8000;

// Operator-maintained platform inventory · carried verbatim from the
// legacy content-bridge.html tool. OPERATOR REVIEW REQUIRED before the
// prompt is signed: this list is an external-endorsement surface. The
// model chooses only from this set (or stays platform-neutral).
export const OPERATOR_PLATFORMS = {
  static:  ['Canva', 'Adobe Firefly', 'Glorify'],
  ugc:     ['HeyGen', 'Creatify', 'Synthesia'],
  avatar:  ['Tavus', 'D-ID'],
};

export const CONTENT_BRIDGE_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'colorTerritory',
  'alwaysNever',
  'antiVoice',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'content_bridge_agent',
  phase: '03',
  tier_required: 'starter',
  display_name: 'Content Bridge',
  description: 'Paste a piece of content and get a production brief a beginner could execute: the numbered steps, the platform settings, and your brand applied.',
  artifact_type: 'content_bridge_agent',
  version: 1,
  inputs: {
    qbp_fields: CONTENT_BRIDGE_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    artifact_dependencies: ['voice_guide_agent', 'visual_dna_synthesizer'],
    files: [],
    // source_content · the pasted piece (optional; absent means brief from
    // the foundation). target_platform · optional name from
    // OPERATOR_PLATFORMS; absent means the faceless, platform-neutral path.
    runtime_args: { feedback: 'optional', qbp_source: 'optional', source_content: 'optional', target_platform: 'optional' },
  },
  triggers: ['manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed'],
  // model omitted · resolves to the canonical Sonnet default.
  retry_budget: 0,
};

const MODEL = META.model || 'claude-sonnet-4-6';

// ─── The prompt · HELD FOR OPERATOR SIGN-OFF ────────────────────────────

const SYSTEM_PROMPT = `You are the Content Bridge Agent for Quantum Branding OS, the routing intelligence of Phase 03, Content Creation.

The founder has finished their foundation. They arrive with a Voice Guide (how the brand writes), a Visual DNA (its palette and type decisions), and the raw signals of their Quantum Brand Profile. They may also paste a piece of content and name a production platform. Your job is a production brief a person who has never opened that tool could execute: what the piece becomes, the exact steps, the settings, and the brand applied. You brief production. You do not produce media and you do not write new strategy.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic.

Ground rules:
- If a source piece is provided, the formatted piece is THAT content reflowed for production: pacing, emphasis, natural pauses marked with line breaks. Do not rewrite its argument; respect the voice it already carries.
- If no source is provided, draft a first post for the brand's strongest channel from the foundation, say so plainly in the opening, and brief its production.
- If a target platform is named in the input, brief for it. If none is named, stay platform-neutral and note in the opening that the steps generalize. NEVER name a platform that is not in the allowed list you are given. Never endorse: the platform is the founder's choice, the brief is yours.
- If the named platform clones a face or voice, the FIRST production step must be the consent check: confirm written consent from every person whose likeness or voice appears. Not a disclaimer, a step.
- Steps are beginner-proof: one action per step, in the order a first-time user meets them. Forbidden step filler: "familiarize yourself with the interface", "explore the options".
- The brand application comes from the dependency artifacts: the palette hexes and type decisions from the Visual DNA, the register from the Voice Guide. Quote them, do not invent.
- No invented statistics, testimonials, client names, or brand engagements. The piece argues from the foundation. Where a founder's own proof would go, mark a slot like [your example here] at most ONCE, never a fabricated number or quote.
- No invented capabilities: if you are unsure a platform has a feature, write the step tool-agnostically.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- The formatted piece: the source's own length, reflowed; or 80 to 150 words when drafting from the foundation.
- Step actions: one sentence. Step details: one sentence.
- Spec values and list items: one sentence each.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs · what this brief does, which platform it targets or that it is platform-neutral, and the faceless default if relevant",
  "executive_summary": "two short paragraphs · what the piece is, what it should achieve, who it reaches",
  "formatted_piece": "the source reflowed for production with line breaks as \\n\\n, or the from-foundation draft",
  "production_steps": [
    { "action": "one sentence", "detail": "one sentence" }
  ],
  "platform_settings": [
    { "label": "Format", "value": "..." },
    { "label": "Dimensions or duration", "value": "..." },
    { "label": "Style", "value": "..." },
    { "label": "Export", "value": "..." }
  ],
  "brand_application": [
    { "label": "Color", "items": ["the palette applied, from the Visual DNA"] },
    { "label": "Type and voice", "items": ["the type and register applied"] },
    { "label": "Guardrails", "items": ["what must not change"] }
  ],
  "always": ["three to six quality checks that must pass before publishing"],
  "never": ["three to six failures that send it back to production"]
}

production_steps has six to twelve items. If the QBP is sparse, lean on the archetype and the two dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of CONTENT_BRIDGE_FIELDS) {
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

function clampStr(v, max, fallback) {
  const s = (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
  return s.length > max ? s.slice(0, max - 1).trimEnd() : s;
}

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'What this brief does',   prose: clampStr(parsed.opening, 8000, 'The brief opening did not generate. Regenerate to produce it.') },
    { heading: 'Executive summary',      prose: clampStr(parsed.executive_summary, 8000, 'The summary did not generate. Regenerate to produce it.') },
    { heading: 'The formatted piece',    prose: clampStr(parsed.formatted_piece, 8000, 'The formatted piece did not generate. Regenerate to produce it.') },
  ];

  const steps = (Array.isArray(parsed.production_steps) ? parsed.production_steps : [])
    .slice(0, 15)
    .map(st => {
      const step = { action: clampStr(st?.action, 200, 'Produce the piece') };
      const detail = (typeof st?.detail === 'string' && st.detail.trim()) ? st.detail.trim() : '';
      if (detail) step.detail = clampStr(detail, 600, '');
      return step;
    });

  const settings = (Array.isArray(parsed.platform_settings) ? parsed.platform_settings : [])
    .slice(0, 12)
    .map(s => ({
      label: clampStr(s?.label, 60, 'Setting'),
      value: clampStr(s?.value, 300, 'Not decided in this run.'),
    }));

  const application = (Array.isArray(parsed.brand_application) ? parsed.brand_application : [])
    .slice(0, 8)
    .map(g => ({
      label: clampStr(g?.label, 200, 'Brand'),
      items: (Array.isArray(g?.items) ? g.items : [])
        .map(x => clampStr(String(x), 300, ''))
        .filter(x => x.length > 0)
        .slice(0, 12),
    }))
    .filter(g => g.items.length > 0);

  const data_blocks = [
    {
      type: 'numbered_procedure',
      title: 'The production steps',
      content: {
        steps: steps.length > 0 ? steps : [{ action: 'Regenerate to produce the production steps.' }],
      },
    },
    {
      type: 'spec_grid',
      title: 'Platform settings',
      content: {
        specs: settings.length > 0 ? settings : [{ label: 'Format', value: 'Regenerate to produce the platform settings.' }],
      },
    },
    {
      type: 'descriptor_list',
      title: 'Your brand, applied',
      content: {
        groups: application.length > 0 ? application : [{ label: 'Brand', items: ['Regenerate to produce the brand application.'] }],
      },
    },
    {
      type: 'always_never',
      title: 'The quality gate',
      content: {
        always: (Array.isArray(parsed.always) && parsed.always.length > 0 ? parsed.always : ['Check it against the voice guide before publishing'])
          .map(s => clampStr(String(s), 300, '')).filter(s => s.length > 0).slice(0, 10),
        never: (Array.isArray(parsed.never) && parsed.never.length > 0 ? parsed.never : ['Publish a piece that fails the brand palette'])
          .map(s => clampStr(String(s), 300, '')).filter(s => s.length > 0).slice(0, 10),
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '03 Content Creation · Content Bridge',
      title: `A production brief for ${safeBrand}`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: CONTENT_BRIDGE_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = CONTENT_BRIDGE_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('voice_guide_agent', dependencies?.voice_guide_agent),
    distillDependency('visual_dna_synthesizer', dependencies?.visual_dna_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the Voice Guide and Visual DNA are law):\n\n${depBlocks}`;

  // The allowed platform inventory rides in the user prompt so the model
  // can never name a vendor outside the operator-maintained constant.
  const allowed = [
    `Static design: ${OPERATOR_PLATFORMS.static.join(', ')}`,
    `UGC video (likeness · consent step required): ${OPERATOR_PLATFORMS.ugc.join(', ')}`,
    `Avatar (likeness · consent step required): ${OPERATOR_PLATFORMS.avatar.join(', ')}`,
  ].join('\n');
  userText += `\n\nAllowed platform inventory (choose only from this list, or stay platform-neutral):\n${allowed}`;

  const sourceContent = typeof runtime_args?.source_content === 'string' && runtime_args.source_content.trim()
    ? runtime_args.source_content.trim().slice(0, SOURCE_CONTENT_CAP)
    : null;
  if (sourceContent) {
    userText += `\n\nThe founder's pasted piece (reflow this for production, do not rewrite its argument):\n${sourceContent}`;
  } else {
    userText += `\n\nNo source piece was pasted. Draft a first post from the foundation and brief its production, saying so plainly in the opening.`;
  }

  const targetPlatform = typeof runtime_args?.target_platform === 'string' && runtime_args.target_platform.trim()
    ? runtime_args.target_platform.trim().slice(0, 60)
    : null;
  if (targetPlatform) {
    userText += `\n\nTarget platform named by the founder: ${targetPlatform}`;
  }

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
