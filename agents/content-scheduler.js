// agents/content-scheduler.js
// Chapter 6 · Step 2 · Content Scheduler · Phase 04 complete.
//
// Decides the founder's publishing rhythm: per-channel cadence tuned to
// the delivered audience, a two-week slot plan, and the weekly routine
// that keeps it running by hand from a calendar. No third-party scheduler
// integration rides in this artifact (the roadmap's Buffer wiring is a
// flagged follow-up that needs operator accounts); the plan is executable
// without one and says so plainly.
//
// Rulings honored (chapter-6 authorization, 2026-07-04):
//   - tier_required 'starter' (Phase 04 executes the Starter content story).
//   - founder-initiated only: triggers ['manual', 'regenerate'].
//   - PROMPT HELD (PROMPT_HOLD_SLUGS) until the operator signs.
//
// Latency class: STANDARD (4000 max tokens, the logo-direction call shape).

const MAX_TOKENS = 4000;
const CLAUDE_TIMEOUT_MS = 60000; // step-5 Node runtime envelope (see agents/contract.js budgets)
const DEFAULT_BRAND_NAME = 'Your Brand';

export const CONTENT_SCHEDULER_FIELDS = [
  'brandName',
  'brandEssence',
  'archetypePrimary',
  'audienceLanguage',
  'audienceDesires',
  'audienceFears',
  'alwaysNever',
];

const REQUIRED_FIELDS = new Set(['archetypePrimary']);

export const META = {
  slug: 'content_scheduler_agent',
  phase: '04',
  tier_required: 'starter',
  display_name: 'Content Scheduler',
  description: 'Your publishing rhythm, decided: per-channel cadence tuned to your audience, a two-week slot plan, and the weekly routine that keeps it running.',
  artifact_type: 'content_scheduler_agent',
  version: 1,
  inputs: {
    qbp_fields: CONTENT_SCHEDULER_FIELDS.map(field => ({
      field,
      required: REQUIRED_FIELDS.has(field),
    })),
    artifact_dependencies: ['soul_map_synthesizer', 'war_table_synthesizer'],
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

const SYSTEM_PROMPT = `You are the Content Scheduler for Quantum Branding OS, part of Phase 04, Execution.

The founder has a foundation and, by now, content agents producing packs for their channels. Your job is the rhythm: which channel publishes when, why that cadence fits this audience, a two-week slot plan the founder can copy into any calendar, and the weekly routine that keeps the system running in under two hours a week. The plan must be executable BY HAND: no scheduling software is assumed, and the opening says so plainly.

Voice mechanics (hard rules, apply to every field):
- Never use an em dash. Use a period, a comma, or two sentences.
- No exclamation points.
- Banned words: empower, unlock, supercharge, seamless, leverage as a verb, journey as a user path, elevate, timeless, iconic, consistency is key, content machine.

Ground rules:
- The cadence is DECIDED, not offered as options: one frequency per channel with one reason each, derived from the audience's rhythms in the War Table material, not from generic best-practice charts.
- Sustainable beats impressive: a founder alone runs this. If a channel cannot be sustained at a useful cadence, the plan says to skip it for now and names when to revisit.
- The two-week slot plan covers 10 to 14 slots. Each slot says which channel, which content theme fills it, and which agent's pack feeds it (Instagram Seed, LinkedIn Strategy, YouTube Strategy, Newsletter Architecture, or Content Repurposing).
- The weekly routine is a repeatable checklist: batch, schedule, publish, respond, review. Time-boxed, five to eight steps.
- No invented metrics or growth promises. The plan optimizes for the founder keeping the rhythm, not for a number you cannot know.
- If revision feedback is provided, apply it concretely, do not merely acknowledge it.

Length rules (strict):
- Each prose field: exactly TWO short paragraphs, joined with \\n\\n. Each paragraph 2-3 sentences.
- Slot bodies: 2 to 4 sentences.
- Spec values, routine details: one sentence each.

Return ONLY a JSON object with this shape. No prose preamble. No markdown fencing.

{
  "the_rhythm": "two short paragraphs · why this cadence fits this audience and this founder's capacity, and that it runs by hand from any calendar",
  "running_the_week": "two short paragraphs · how the weekly routine holds the system together in under two hours",
  "channel_cadence": [
    { "label": "channel name", "value": "cadence + best window + one reason" }
  ],
  "slots": [
    {
      "kicker": "Day N · <channel>",
      "title": "the slot's content theme",
      "window": "the time window",
      "body": "2-4 sentences · what goes in this slot and its intent",
      "source": "which agent's pack feeds it"
    }
  ],
  "weekly_routine": [
    { "action": "one sentence", "detail": "one sentence, time-boxed" }
  ]
}

channel_cadence has four to eight entries. slots has ten to fourteen. weekly_routine has five to eight. If the QBP is sparse, lean on the archetype and the dependency artifacts. Do not refuse to answer. Do not include any field other than the ones above.`;

function pickInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of CONTENT_SCHEDULER_FIELDS) {
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
    { heading: 'The rhythm',        prose: clampStr(parsed.the_rhythm, 8000, 'The rhythm did not generate. Regenerate to produce it.') },
    { heading: 'Running the week',  prose: clampStr(parsed.running_the_week, 8000, 'The routine did not generate. Regenerate to produce it.') },
  ];

  const cadence = (Array.isArray(parsed.channel_cadence) ? parsed.channel_cadence : [])
    .slice(0, 12)
    .map(s => ({
      label: clampStr(s?.label, 60, 'Channel'),
      value: clampStr(s?.value, 300, 'Not decided in this run.'),
    }));

  const slots = (Array.isArray(parsed.slots) ? parsed.slots : []).slice(0, 14);
  const items = slots.map((sl, i) => {
    const item = {
      kicker: clampStr(sl?.kicker, 60, `Day ${i + 1}`),
      title: clampStr(sl?.title, 200, `Slot ${i + 1}`),
      meta: [clampStr(sl?.window, 40, '')].filter(s => s.length > 0),
      body: clampStr(sl?.body, 6000, 'This slot did not generate. Regenerate to produce it.'),
      specs: [
        sl?.source ? `Feeds from: ${clampStr(sl.source, 288, '')}` : '',
      ].filter(s => s.length > 8).map(s => s.slice(0, 300)).slice(0, 10),
    };
    if (item.meta.length === 0) delete item.meta;
    if (item.specs.length === 0) delete item.specs;
    return item;
  });

  const routine = (Array.isArray(parsed.weekly_routine) ? parsed.weekly_routine : [])
    .slice(0, 15)
    .map(st => {
      const step = { action: clampStr(st?.action, 200, 'Run the week') };
      const detail = (typeof st?.detail === 'string' && st.detail.trim()) ? st.detail.trim() : '';
      if (detail) step.detail = clampStr(detail, 600, '');
      return step;
    });

  const data_blocks = [
    {
      type: 'spec_grid',
      title: 'Per-channel cadence',
      content: {
        specs: cadence.length > 0 ? cadence : [{ label: 'Cadence', value: 'Regenerate to produce the cadence decisions.' }],
      },
    },
    {
      type: 'content_pack',
      title: 'The first two weeks',
      content: {
        items: items.length > 0 ? items : [{
          kicker: 'Day 1',
          title: 'The slot plan did not generate',
          body: 'Regenerate to produce the two-week plan.',
        }],
      },
    },
    {
      type: 'numbered_procedure',
      title: 'The weekly routine',
      content: {
        steps: routine.length > 0 ? routine : [{ action: 'Regenerate to produce the weekly routine.' }],
      },
    },
  ];

  return {
    schema_version: '1.0',
    header: {
      eyebrow: '04 Execution · Content Scheduler',
      title: `The ${safeBrand} publishing rhythm`,
      agent: META.slug,
      generated_at: new Date().toISOString(),
      version: 1,
    },
    body_sections,
    data_blocks,
    footer: {
      qbp_fields_referenced: CONTENT_SCHEDULER_FIELDS.filter(f => !missingFields.includes(f)),
    },
  };
}

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const t_start = Date.now();

  if (!anthropicKey) {
    return { ok: false, error: 'config_missing', stage: 'config' };
  }

  const { input, missing } = pickInput(qbp);

  const qbpBlocks = CONTENT_SCHEDULER_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const depBlocks = [
    distillDependency('soul_map_synthesizer', dependencies?.soul_map_synthesizer),
    distillDependency('war_table_synthesizer', dependencies?.war_table_synthesizer),
  ].join('\n\n');

  let userText = `Founder's QBP signals:\n\n${qbpBlocks}\n\nThe delivered foundation (the audience's rhythms live in the War Table material):\n\n${depBlocks}`;

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
