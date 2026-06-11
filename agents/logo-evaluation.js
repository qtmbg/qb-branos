// agents/logo-evaluation.js
// Chapter 4 · Step 2 · Logo Evaluation Agent · the second Phase 02 agent.
//
// Reads the founder's UPLOADED logo through Claude vision and evaluates
// it against the earned foundation: the delivered Soul Map and Visual
// DNA artifacts plus the QBP signals. Returns verdicts a founder can act
// on, ranked, with the reasoning attached. It judges the mark they have;
// it does not design a new one (that is Logo Direction's job).
//
// Pre-rulings honored (chapter-4 step-2 authorization, 2026-06-11):
//   - file input: png/jpeg/webp only, 5 MB cap. SVG and every other MIME
//     rejected at dispatch (api/agents/rerun.js) with a founder-facing
//     detail that instructs exporting as PNG. SVG support is DEFERRED
//     DEBT (3Z §9 forward risk, re-logged here).
//   - uploaded files are agent-read only · never rendered inline in any
//     DOM, ever.
//   - tier starter+, fail closed (the phase >= '02' dispatch gate).
//   - triggers manual + regenerate · no chain, no lock fan-out.
//   - Sonnet default. CAL feedback per the Logo Direction pattern.
//   - PROMPT HELD: merges behind PROMPT_HOLD_SLUGS, Console-invisible
//     until the operator signs the prompt.

const MAX_TOKENS = 3000;
const CLAUDE_TIMEOUT_MS = 60000; // step-5 Node runtime envelope (see agents/contract.js budgets)
const DEFAULT_BRAND_NAME = 'Your Brand';

// The vision-readable set, mirrored from agents/contract.js
// VISION_READABLE_MIME. Mirrored rather than imported so the agent module
// stays dependency-light; the authoritative dispatch-time enforcement
// lives in api/agents/rerun.js against the contract constant.
const READABLE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const LOGO_EVALUATION_FIELDS = [
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
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'logo_evaluation_agent',
  phase: '02',
  tier_required: 'starter',
  display_name: 'Logo Evaluation Agent',
  description: 'Reads your uploaded logo against your foundation and returns ranked, actionable verdicts: what the mark gets right, where it works against you, and what to change first.',
  artifact_type: 'logo_evaluation_agent',
  version: 1,
  inputs: {
    qbp_fields: LOGO_EVALUATION_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    // The evaluation is grounded in the delivered foundation, same
    // reasoning as Logo Direction: judging a mark without the visual
    // system and soul map is generic design critique, which the codex
    // refuses.
    artifact_dependencies: ['soul_map_synthesizer', 'visual_dna_synthesizer'],
    // REQUIRED file · the whole point of this agent. optional: false
    // makes run.js validateInputs fail missing_inputs when absent.
    files: [{ type: 'logo-image', source: 'user-upload', optional: false }],
    runtime_args: { feedback: 'optional', qbp_source: 'optional' },
  },
  // Founder-initiated only · per the standing ruling, no chain, no lock.
  triggers: ['manual', 'regenerate'],
  error_codes: ['config_missing', 'edge_timeout', 'model_call_failed', 'missing_inputs'],
  // model omitted · resolves to the canonical Sonnet default.
  // File-present class under the step-5 envelope: vision read plus two
  // distilled dependency artifacts. Observed entry in
  // AGENT_OBSERVED_LATENCY_MS comes from the step-2 verification runs.
  retry_budget: 0,
};

const MODEL = META.model || 'claude-sonnet-4-6';

// ─── The prompt · HELD FOR OPERATOR SIGN-OFF ────────────────────────────
// Verdicts are the product here. A founder pays for "change these three
// things, in this order, because of who your brand is" · not for scores.

const SYSTEM_PROMPT = `You are the Logo Evaluation Agent for Quantum Branding OS, part of Phase 02, Brand Creation.

The founder has uploaded their logo. They also arrive with an earned foundation: a Soul Map (who the brand is), a Visual DNA (its palette and type direction), and the raw signals of their Quantum Brand Profile. Your job is to evaluate the mark they have against the brand they built. You judge fit, not fashion. You do not redesign the logo and you do not invent a new one.

Voice: calm, editorial, direct. You are a thoughtful design director giving a founder an honest read, not a critic scoring entries. No marketing language, no jargon, no AI talk. Address the founder as "you / your brand." Sentence fragments are welcome. Do not pad. Honesty over comfort: if the mark works against the foundation, say so plainly and say why.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, memorable.

Ground rules for the evaluation:
- Look at the image first. Describe what is actually there: the forms, the type, the color, the weight, the negative space. Every judgment must cite something visible in the mark or something written in the foundation. Never invent details that are not in the image.
- Judge against THEIR foundation, not against taste. The archetype, the palette, the type direction, the forbidden color, the anti-brand: these are the standards. A mark that would be strong for another brand can still be wrong for this one, and you must say which case this is.
- Verdicts must be actionable. Every problem you name comes with the change that addresses it and the reason the foundation demands it. "The wordmark is set in a geometric sans while your type direction is a warm serif; commission the wordmark in your display face" is a verdict. A score without a direction is forbidden.
- Forbidden filler, named: "clean and modern", "could be more unique", "stands out", "works well overall", and any sentence that could be pasted under a different brand's logo unchanged. If a sentence survives that swap test, cut it.
- Rank the changes. The founder should know what to fix first and what can wait. First-ranked means: highest damage to foundation fit, or cheapest meaningful win.
- Credit what works. If the mark already honors the foundation somewhere, name it specifically so the founder protects it through revisions.
- If the image is not a logo (a photo, a screenshot, a document), say so plainly in the opening, set what_works and what_fights to what you can honestly observe, and rank a single change: upload the actual mark.
- If revision feedback is provided, treat it as the founder's note from the last round: apply it concretely, do not merely acknowledge it.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph is 2-3 sentences. No more.
- Each list item: one or two sentences, specific, citing the mark or the foundation.
- Ranked changes: rationale is one or two sentences naming the foundation signal it serves.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "opening": "two short paragraphs · the honest read: what this mark is and whether it belongs to this brand",
  "what_the_mark_says": "two short paragraphs · what the mark actually communicates as drawn, before any comparison to the foundation",
  "what_works": ["two to five specific observations that honor the foundation, each citing the mark and the signal it serves"],
  "what_fights": ["two to five specific conflicts with the foundation, each citing the mark and the signal it breaks"],
  "changes": [
    { "rank": 1, "label": "short imperative", "rationale": "one or two sentences naming the foundation signal this serves" },
    { "rank": 2, "label": "...", "rationale": "..." },
    { "rank": 3, "label": "...", "rationale": "..." }
  ],
  "keep_through_revisions": "two short paragraphs · what must survive any redesign, and the test the founder should hold every revision against"
}

Provide three to five ranked changes. If the QBP is sparse, lean on the archetype and the two dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of LOGO_EVALUATION_FIELDS) {
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

  const body_sections = [
    { heading: 'The honest read',          prose: parsed.opening },
    { heading: 'What the mark says',       prose: parsed.what_the_mark_says },
    { heading: 'Keep through revisions',   prose: parsed.keep_through_revisions },
  ];

  const changes = Array.isArray(parsed.changes) ? parsed.changes : [];
  const data_blocks = [
    {
      type: 'priority_list',
      title: 'What to change, in order',
      content: {
        items: changes.slice(0, 10).map((c, i) => ({
          rank: Number.isInteger(c?.rank) && c.rank >= 1 ? c.rank : i + 1,
          label: String(c?.label || `Change ${i + 1}`),
          rationale: String(c?.rationale || ''),
        })),
      },
    },
    {
      type: 'descriptor_list',
      title: 'The verdict, itemized',
      content: {
        groups: [
          {
            label: 'What works',
            items: (Array.isArray(parsed.what_works) && parsed.what_works.length > 0
              ? parsed.what_works : ['<no observations returned>']).map(String).slice(0, 12),
          },
          {
            label: 'What fights the foundation',
            items: (Array.isArray(parsed.what_fights) && parsed.what_fights.length > 0
              ? parsed.what_fights : ['<no observations returned>']).map(String).slice(0, 12),
          },
        ],
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '02 Brand Creation · Logo Evaluation',
      title: `The Verdict on ${safeBrand}'s Mark`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: LOGO_EVALUATION_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  // The logo is the required input. run.js validateInputs gates absence
  // by type; this defensive check also rejects an entry that is present
  // but not vision-readable (the dispatch entry enforces MIME, this is
  // the belt to that braces).
  const logo = (Array.isArray(files) ? files : []).find(f =>
    f && f.type === 'logo-image'
    && typeof f.signed_url === 'string' && f.signed_url
    && READABLE_MIME.has(f.mime)
  ) || null;
  if (!logo) {
    return {
      ok: false,
      error: 'missing_inputs',
      stage: 'file-validation',
      detail: 'logo-image is missing or not vision-readable (PNG, JPEG, or WebP within 5 MB) · export your logo as PNG and upload that file',
    };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = LOGO_EVALUATION_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('visual_dna_synthesizer', dependencies?.visual_dna_synthesizer),
  ].join('\n\n');

  let userText = `The image above is the founder's uploaded logo. Evaluate it against the foundation below.\n\nFounder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered Phase 01 foundation:\n\n${depBlocks}`;

  // Content Approval Loop · the Logo Direction pattern.
  const feedback = typeof runtime_args?.feedback === 'string' && runtime_args.feedback.trim()
    ? runtime_args.feedback.trim()
    : null;
  if (feedback) {
    userText += `\n\nRevision feedback from the founder (apply concretely):\n${feedback}`;
  }

  userText += '\n\nReturn only the JSON object described in your instructions.';

  const userContent = [
    { type: 'image', source: { type: 'url', url: logo.signed_url } },
    { type: 'text', text: userText },
  ];

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
