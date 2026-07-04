// agents/predictive-panel.js
// Chapter 7 · Step 3 · Predictive Panel · Phase 05 complete.
//
// A probabilistic forecasting panel for a launch. The founder pastes the
// launch concept (runtime_args.source_content: what is launching, the
// price, the channel); the panel runs structured scenario simulations
// against synthetic personas built from the delivered War Table audience
// and returns a verdict with probabilities, high-confidence zones,
// failure points, and a readiness checklist. Probabilities, not
// predictions. Scenarios, not single outcomes. When no concept is
// pasted, the panel simulates the core offer from the foundation and
// says so plainly in the opening.
//
// Rulings honored (chapter-7 authorization, 2026-07-04):
//   - tier_required 'pro' (the roadmap's Pro list claims Predictive
//     Panel by name).
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependencies on the Phase 01 foundation.
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs. The prompt
//     descends from the legacy predictive-panel..html tool (the double dot
//     in that filename is intentional; do not fix it).
//   - Scenario probabilities are simulation outputs, clearly framed as
//     such. They are not invented social proof and never cite fabricated
//     engagements or client results.
//
// Latency class: HEAVY. Single attempt at a 120 000 ms in-call timeout,
// no inner retry (the reaper owns retries).

const MAX_TOKENS = 5000;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';
const SOURCE_CONTENT_CAP = 8000;

export const PREDICTIVE_PANEL_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'paradox',
  'alwaysNever',
  'audienceLanguage',
  'audienceDesires',
  'audienceFears',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'predictive_panel_agent',
  phase: '05',
  tier_required: 'pro',
  display_name: 'Predictive Panel',
  description: 'Your launch, simulated before you spend a dollar: a verdict with probabilities, the scenarios, the failure points, and the readiness checklist.',
  artifact_type: 'predictive_panel_agent',
  version: 1,
  inputs: {
    qbp_fields: PREDICTIVE_PANEL_FIELDS.map(field => ({
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

const SYSTEM_PROMPT = `You are the Predictive Panel for Quantum Branding OS, part of Phase 05, Intelligence.

You are a probabilistic forecasting system for brand and product launches. You do not give opinions. You run structured scenario simulations against synthetic personas built from the delivered audience profile and assign probabilities to outcomes. You think in probabilities, not predictions. In scenarios, not single outcomes. In combinations, not isolated variables. Your output tells a founder what is likely to happen and why, before they spend a dollar.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, guaranteed, foolproof, can't fail.

Ground rules:
- Every probability is a SIMULATION OUTPUT from the panel, framed as such. Never present one as observed market data, and never cite a fabricated client result, testimonial, or engagement.
- The panel personas derive from the War Table audience material, not from generic market archetypes. Segment the persona into real behavioral sub-groups.
- Scenario probabilities are internally consistent and roughly sum to 100 across the scenario set.
- Failure points are specific: what breaks, what triggers it, how to reduce it. Never "marketing might not work."
- The verdict is one of three calls: GO, CONDITIONAL GO with the pivot named, or NO-GO with the fundamental issue named. Commit to one.
- If NO launch concept was pasted, simulate the core offer as the foundation describes it and say so plainly in the opening.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Length rules (strict):
- the_verdict and final_directive: exactly TWO short paragraphs each, joined with \\n\\n. Each paragraph 2-4 sentences.
- Scenario and failure bodies: 2-4 sentences. Read values: one clause or sentence, under 280 characters.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "the_verdict": "two short paragraphs · the call, the core finding behind it, and what the panel showed in aggregate",
  "final_directive": "two short paragraphs · written directly to the founder, what to do with the finding and the single most important action before launch",
  "the_read": [
    { "label": "Verdict", "value": "GO | CONDITIONAL GO · <the pivot> | NO-GO · <the issue>" },
    { "label": "Overall confidence", "value": "NN/100 · one clause on the driver" },
    { "label": "Brand fit", "value": "NN/100 · does the launch align with the identity and is the price coherent" },
    { "label": "Price read", "value": "on target | slightly high | slightly low | too high | too low · one clause from the panel" },
    { "label": "Channel read", "value": "how the launch channel fits the persona's discovery behavior" },
    { "label": "The edge", "value": "the single highest-probability, highest-impact advantage to double down on" }
  ],
  "scenarios": [
    { "kicker": "Probability NN%", "title": "scenario name, specific not generic", "body": "2-4 sentences · what happens and what must be true for it to unfold", "high_confidence": true }
  ],
  "failure_points": [
    { "kicker": "Risk · NN%", "title": "what breaks, specifically", "body": "2-4 sentences · the trigger and the mitigation" }
  ],
  "panel_findings": {
    "high_confidence_zones": ["finding that holds across all scenarios, with its probability and the commercial implication in the same line"],
    "persona_segments": ["segment name · share of panel · how it responds · its conversion read"]
  },
  "readiness": [
    { "action": "specific readiness check", "detail": "ready | needs work | critical gap · one clause" }
  ]
}

the_read has exactly SIX entries in the order above. scenarios has four to six covering best case through worst case. failure_points has three to five. high_confidence_zones has three to six. persona_segments has three to five. readiness has six to ten items. If the QBP is sparse, lean on the archetype and the dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of PREDICTIVE_PANEL_FIELDS) {
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

const READ_LABELS = ['Verdict', 'Overall confidence', 'Brand fit', 'Price read', 'Channel read', 'The edge'];

function toItems(arr, fallbackKicker, fallbackTitle, fallbackBody, max) {
  const items = (Array.isArray(arr) ? arr : []).slice(0, max).map((it, i) => {
    const item = {
      kicker: clampStr(it?.kicker, 60, fallbackKicker),
      title: clampStr(it?.title, 200, `${fallbackTitle} ${i + 1}`),
      body: clampStr(it?.body, 6000, fallbackBody),
    };
    if (it?.high_confidence === true) item.meta = ['high confidence'];
    return item;
  });
  return items.length > 0 ? items : [{ kicker: fallbackKicker, title: fallbackTitle, body: fallbackBody }];
}

function toStringList(arr, fallback) {
  const list = (Array.isArray(arr) ? arr : [])
    .map(s => clampStr(String(s), 300, '')).filter(s => s.length > 0).slice(0, 12);
  return list.length > 0 ? list : [fallback];
}

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'The verdict',          prose: clampStr(parsed.the_verdict, 8000, 'The verdict did not generate. Regenerate to produce it.') },
    { heading: 'The final directive',  prose: clampStr(parsed.final_directive, 8000, 'The final directive did not generate. Regenerate to produce it.') },
  ];

  const read = (Array.isArray(parsed.the_read) ? parsed.the_read : []).slice(0, 6)
    .map((r, i) => ({
      label: clampStr(r?.label, 60, READ_LABELS[i] || `Read ${i + 1}`),
      value: clampStr(r?.value, 300, 'Not readable in this run.'),
    }));

  const findings = (parsed.panel_findings && typeof parsed.panel_findings === 'object') ? parsed.panel_findings : {};

  const readiness = (Array.isArray(parsed.readiness) ? parsed.readiness : []).slice(0, 15)
    .map(st => {
      const step = { action: clampStr(st?.action, 200, 'Check launch readiness') };
      const detail = (typeof st?.detail === 'string' && st.detail.trim()) ? st.detail.trim() : '';
      if (detail) step.detail = clampStr(detail, 600, '');
      return step;
    });

  const data_blocks = [
    {
      type: 'spec_grid',
      title: "The panel's read",
      content: { specs: read.length > 0 ? read : [{ label: 'Verdict', value: 'Regenerate to produce the read.' }] },
    },
    {
      type: 'content_pack',
      title: 'The scenarios',
      content: { items: toItems(parsed.scenarios, 'Scenario', 'The scenarios did not generate', 'Regenerate to produce the scenario simulations.', 6) },
    },
    {
      type: 'content_pack',
      title: 'The failure points',
      content: { items: toItems(parsed.failure_points, 'Risk', 'The failure points did not generate', 'Regenerate to produce the failure analysis.', 5) },
    },
    {
      type: 'descriptor_list',
      title: 'What the panel showed',
      content: {
        groups: [
          { label: 'High-confidence zones', items: toStringList(findings.high_confidence_zones, 'Regenerate to produce the high-confidence zones.') },
          { label: 'Persona segments', items: toStringList(findings.persona_segments, 'Regenerate to produce the segment readings.') },
        ],
      },
    },
    {
      type: 'numbered_procedure',
      title: 'Launch readiness',
      content: { steps: readiness.length > 0 ? readiness : [{ action: 'Regenerate to produce the readiness checklist.' }] },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '05 Intelligence · Predictive Panel',
      title: `The ${safeBrand} launch panel`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: PREDICTIVE_PANEL_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = PREDICTIVE_PANEL_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('war_table_synthesizer', dependencies?.war_table_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the panel personas derive from the War Table audience):\n\n${depBlocks}`;

  const sourceContent = typeof runtime_args?.source_content === 'string' && runtime_args.source_content.trim()
    ? runtime_args.source_content.trim().slice(0, SOURCE_CONTENT_CAP)
    : null;
  if (sourceContent) {
    userText += `\n\nThe founder's launch concept (what is launching, the price, the channel, the context):\n${sourceContent}`;
  } else {
    userText += `\n\nNo launch concept was pasted. Simulate the core offer as the foundation describes it and say so plainly in the opening.`;
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
