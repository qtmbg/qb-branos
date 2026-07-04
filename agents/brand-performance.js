// agents/brand-performance.js
// Chapter 7 · Step 1 · Brand Performance Dashboard · the first Phase 05 agent.
//
// Reads the founder's pasted performance data (runtime_args.source_content)
// through the brand lens: five health scores, named signals with evidence
// and a recommendation each, per-platform readings, and the next 30 days
// as a checklist. Numbers are not the output. Brand signals are.
// When no data is pasted, the artifact becomes the measurement scaffold:
// what to track per channel and how to collect it by hand, said plainly
// in the opening. The founder with zero data still leaves with a system.
//
// Rulings honored (chapter-7 authorization, 2026-07-04):
//   - tier_required 'pro' (the roadmap's Pro list claims the Phase 05
//     intelligence agents).
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - Cross-phase dependencies on the Phase 01 foundation.
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs. The prompt
//     descends from the legacy brand-performance-dashboard.html tool.
//
// Latency class: HEAVY. Single attempt at a 120 000 ms in-call timeout,
// no inner retry (the reaper owns retries).

const MAX_TOKENS = 6000;
const CLAUDE_TIMEOUT_MS = 120000; // heavy class · single attempt (see header)
const DEFAULT_BRAND_NAME = 'Your Brand';
const SOURCE_CONTENT_CAP = 8000;

export const BRAND_PERFORMANCE_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'antiVoice',
  'alwaysNever',
  'audienceLanguage',
  'audienceDesires',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'brand_performance_agent',
  phase: '05',
  tier_required: 'pro',
  display_name: 'Brand Performance Dashboard',
  description: 'Your performance data read through the brand lens: five health scores, named signals with evidence and one action each, and the next 30 days decided.',
  artifact_type: 'brand_performance_agent',
  version: 1,
  inputs: {
    qbp_fields: BRAND_PERFORMANCE_FIELDS.map(field => ({
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

const SYSTEM_PROMPT = `You are the Brand Performance Dashboard for Quantum Branding OS, the first agent of Phase 05, Intelligence.

The founder has been publishing and arrives with pasted performance data. Your function is to read that data through the lens of their brand identity, not as a metrics analyst but as a brand strategist. Numbers are not your output. Brand signals are: what the data means for identity, positioning, voice coherence, and the next 30 days.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, skyrocket, crush it, growth hack, virality guaranteed.

Ground rules:
- Every score, signal, and reading traces to the pasted data or to the delivered foundation. Never invent a metric, a follower count, or an engagement number that is not in the input.
- Signals are NAMED phenomena, specific to this brand's data: on-identity resonance, off-identity engagement, audience drift, voice drift, offer signal, breakthrough moment. Each carries its evidence from the input and one concrete action.
- Engagement that pulls away from the brand's identity is a warning, not a win. Say so when the data shows it.
- If NO performance data was pasted, the artifact becomes the measurement scaffold instead: the opening says so plainly, scores read "not yet measurable" with what to track in the value, signals become the signals to watch for, and the 30-day checklist becomes the by-hand measurement setup. Do not fabricate a reading from data that does not exist.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- Signal bodies: 2-4 sentences. Evidence and recommendation: one sentence each.
- Score and reading values: one clause or sentence, under 280 characters.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "executive_read": "two short paragraphs · the real story this data tells about the brand, not the metrics",
  "patterns_read": "two short paragraphs · what is working and why it is on-identity, what gets engagement but drifts, and the most powerful unexplored territory",
  "health_scores": [
    { "label": "Overall", "value": "NN/100 · one clause on why" },
    { "label": "Brand coherence", "value": "..." },
    { "label": "Voice consistency", "value": "..." },
    { "label": "Audience alignment", "value": "..." },
    { "label": "Momentum", "value": "..." }
  ],
  "signals": [
    {
      "kicker": "signal type, e.g. Voice drift · High",
      "title": "the signal's name, a specific phenomenon",
      "body": "2-4 sentences · what is actually happening and what it means in brand identity terms",
      "evidence": "one sentence · the data points from the input that support it",
      "recommendation": "one sentence · the concrete action"
    }
  ],
  "platform_readings": [
    { "label": "platform name", "value": "health 0-100 · the dominant pattern · the next move" }
  ],
  "next_30_days": [
    { "action": "one sentence", "detail": "one sentence" }
  ],
  "qbp_update_flags": ["findings that suggest the brand profile itself needs updating; empty array if it holds"]
}

health_scores has exactly FIVE entries in the order above. signals has four to eight. platform_readings has one entry per platform in the pasted data (one generic entry if no data). next_30_days has exactly five steps: the single biggest move, the content focus, the platform focus, what to stop, what to test. qbp_update_flags has zero to six. If the QBP is sparse, lean on the archetype and the dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of BRAND_PERFORMANCE_FIELDS) {
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

const SCORE_LABELS = ['Overall', 'Brand coherence', 'Voice consistency', 'Audience alignment', 'Momentum'];

function toSpecs(arr, fallbackLabel, fallbackValue, max) {
  const specs = (Array.isArray(arr) ? arr : []).slice(0, max).map((s, i) => ({
    label: clampStr(s?.label, 60, `${fallbackLabel} ${i + 1}`),
    value: clampStr(s?.value, 300, fallbackValue),
  }));
  return specs.length > 0 ? specs : [{ label: fallbackLabel, value: fallbackValue }];
}

function assembleArtifact({ parsed, brandName, missingFields }) {
  const safeBrand = (typeof brandName === 'string' && brandName.trim())
    ? brandName.trim()
    : DEFAULT_BRAND_NAME;

  const body_sections = [
    { heading: 'The executive read', prose: clampStr(parsed.executive_read, 8000, 'The executive read did not generate. Regenerate to produce it.') },
    { heading: 'The patterns',       prose: clampStr(parsed.patterns_read, 8000, 'The pattern reading did not generate. Regenerate to produce it.') },
  ];

  const scores = (Array.isArray(parsed.health_scores) ? parsed.health_scores : []).slice(0, 5)
    .map((s, i) => ({
      label: clampStr(s?.label, 60, SCORE_LABELS[i] || `Score ${i + 1}`),
      value: clampStr(s?.value, 300, 'Not readable in this run.'),
    }));

  const signals = (Array.isArray(parsed.signals) ? parsed.signals : []).slice(0, 8);
  const items = signals.map((sg, i) => {
    const item = {
      kicker: clampStr(sg?.kicker, 60, `Signal ${i + 1}`),
      title: clampStr(sg?.title, 200, `Signal ${i + 1}`),
      body: clampStr(sg?.body, 6000, 'This signal did not generate. Regenerate to produce it.'),
      specs: [
        sg?.evidence ? `Evidence: ${clampStr(sg.evidence, 290, '')}` : '',
        sg?.recommendation ? `Do this: ${clampStr(sg.recommendation, 291, '')}` : '',
      ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
    };
    if (item.specs.length === 0) delete item.specs;
    return item;
  });

  const steps = (Array.isArray(parsed.next_30_days) ? parsed.next_30_days : []).slice(0, 15)
    .map(st => {
      const step = { action: clampStr(st?.action, 200, 'Decide the next move') };
      const detail = (typeof st?.detail === 'string' && st.detail.trim()) ? st.detail.trim() : '';
      if (detail) step.detail = clampStr(detail, 600, '');
      return step;
    });

  const data_blocks = [
    {
      type: 'spec_grid',
      title: 'Health scores',
      content: { specs: scores.length > 0 ? scores : [{ label: 'Health', value: 'Regenerate to produce the scores.' }] },
    },
    {
      type: 'content_pack',
      title: 'The signals',
      content: {
        items: items.length > 0 ? items : [{
          kicker: 'Signal',
          title: 'The signals did not generate',
          body: 'Regenerate to produce the brand signals.',
        }],
      },
    },
    {
      type: 'spec_grid',
      title: 'Platform readings',
      content: { specs: toSpecs(parsed.platform_readings, 'Platform', 'No platform data in this run.', 12) },
    },
    {
      type: 'numbered_procedure',
      title: 'The next 30 days',
      content: { steps: steps.length > 0 ? steps : [{ action: 'Regenerate to produce the 30-day plan.' }] },
    },
  ];

  const flags = (Array.isArray(parsed.qbp_update_flags) ? parsed.qbp_update_flags : [])
    .map(s => clampStr(String(s), 300, '')).filter(s => s.length > 0).slice(0, 6);
  if (flags.length > 0) {
    data_blocks.push({
      type: 'descriptor_list',
      title: 'Profile update flags',
      content: { groups: [{ label: 'What this quarter of data suggests updating', items: flags }] },
    });
  }

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '05 Intelligence · Brand Performance',
      title: `The ${safeBrand} performance read`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: BRAND_PERFORMANCE_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = BRAND_PERFORMANCE_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('war_table_synthesizer', dependencies?.war_table_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (identity is the lens for every reading):\n\n${depBlocks}`;

  const sourceContent = typeof runtime_args?.source_content === 'string' && runtime_args.source_content.trim()
    ? runtime_args.source_content.trim().slice(0, SOURCE_CONTENT_CAP)
    : null;
  if (sourceContent) {
    userText += `\n\nThe founder's pasted performance data (every reading traces here):\n${sourceContent}`;
  } else {
    userText += `\n\nNo performance data was pasted. Produce the measurement scaffold instead and say so plainly in the opening.`;
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
