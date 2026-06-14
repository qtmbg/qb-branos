/* QB BrandOS · Agent Console renderer
   Spec reference: CHAPTER_02_SPEC.md §6 (Agent Console surface),
                   §6.6.1 schema_retry badge, §6.6.2 latency badge,
                   §6.6.3 aggregate health dot + badge layout,
                   §5.8.1 user-action copy, §5.3.1 replay panel.

   Exports:
     renderConsole(container, payload, opts)
     renderConsoleLoading(container)
     renderConsoleError(container, error)

   The Console has two views toggled at the top: Phase view (default,
   glance density · per-agent aggregate health dot + status text) and
   Run history view (chronological agent_runs with status pill,
   timestamp, latency badge, retry badge, rerun CTAs).

   Click on a Run history row opens the replay panel modal with
   qbp_snapshot, runtime_args, file_refs, agent_version, model.
*/

const PHASE_LABELS = {
  '01': 'Discovery',
  '02': 'Brand Creation',
  '03': 'Content',
  '04': 'Execution',
  '05': 'Intelligence',
};

// Tier ladder · mirrors CANONICAL_TIERS in agents/contract.js. The client
// pre-gates a paid agent's card so a free founder sees an upgrade
// affordance instead of a Run button; the server tier gate
// (api/agents/dispatch.js) is the real wall and fails closed regardless.
const TIER_LADDER = ['free', 'starter', 'pro', 'agency', 'atelier'];
function tierAllows(userTier, requiredTier) {
  if (!requiredTier) return true;
  const u = TIER_LADDER.indexOf(String(userTier || 'free').toLowerCase());
  const r = TIER_LADDER.indexOf(String(requiredTier).toLowerCase());
  if (u === -1 || r === -1) return false; // unknown tier · fail closed in the UI
  return u >= r;
}

// Agents that require a logo image attached before a first run. Mirrors
// each agent's META.inputs.files[optional:false] of type 'logo-image'.
const LOGO_FILE_AGENTS = new Set(['logo_evaluation_agent']);

// Surface-layer Content Approval Loop cap (chapter-2 adjudication: no loop
// counter at the framework layer; the cap renders at the surface and is
// advisory · the API permits more). Founder-facing refinement rounds.
const CAL_MAX_ROUNDS = 3;

// §5.8.1 canonical user-action copy. The Console renders these for
// user-fixable error codes only · transient + operator codes render
// the generic copy below.
const USER_ACTION_COPY = {
  qbp_field_missing: (agent, exercises) =>
    `${agent} cannot run yet. Complete ${exercises || 'the relevant exercise'} to provide the missing fields, then re-run.`,
  missing_dependency: (agent, upstream) =>
    `${agent} is waiting on ${upstream || 'an upstream agent'}. It will run automatically once ${upstream || 'the upstream'} delivers.`,
  missing_inputs: (agent) =>
    `${agent} needs a file you haven't uploaded yet. Add the required file, then re-run.`,
};

// Founder-facing copy for the dispatch entry's 4xx codes (POST
// /api/agents/dispatch). Maps the named server error to a plain next step.
// missing_dependency on the dispatch path is a first-run precondition (the
// founder has not finished Phase 01), so the copy routes them back rather
// than promising an automatic run.
function dispatchErrorCopy(agent, body) {
  const name = agent.display_name;
  switch (body?.error) {
    case 'tier_insufficient':
    case 'tier_unverified':
      return `${name} is part of a paid plan. Upgrade to run it.`;
    case 'missing_dependency': {
      const slug = body.missing_slug ? prettyDep(body.missing_slug) : 'your foundation';
      return `${name} needs ${slug} first. Finish that Phase 01 exercise, then run this.`;
    }
    case 'missing_inputs':
      return LOGO_FILE_AGENTS.has(agent.slug)
        ? `${name} needs a logo image. Attach one, then run.`
        : `${name} needs a file you haven't attached yet.`;
    case 'dispatch_in_flight':
      return `${name} is already running. Watch this card for the result.`;
    default:
      return `Could not start ${name}: ${body?.detail || body?.error || 'unknown error'}`;
  }
}

// soul_map_synthesizer -> "your Soul Map", etc. Plain founder language for
// the dependency the first run is missing.
const DEP_PRETTY = {
  soul_map_synthesizer: 'your Soul Map',
  visual_dna_synthesizer: 'your Visual DNA',
  war_table_synthesizer: 'your War Table',
};
function prettyDep(slug) {
  return DEP_PRETTY[slug] || slug.replace(/_/g, ' ').replace(/ synthesizer$/, '');
}

const TRANSIENT_COPY = 'Run failed. The system is retrying automatically.';
const PERMANENTLY_FAILED_COPY = 'Run failed after multiple attempts. Try a manual rerun.';
const OPERATOR_ONLY_COPY = 'Temporarily unavailable. Try again later.';

/* ─── DOM helpers ────────────────────────────────────────── */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class')        node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'on')      Object.entries(v).forEach(([ev, fn]) => node.addEventListener(ev, fn));
    else if (k in node && k !== 'href') node[k] = v;
    else                      node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

/* ─── formatters ─────────────────────────────────────────── */
function fmtRelativeTime(iso) {
  if (!iso) return '·';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '·';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'moments ago';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
function fmtMs(ms) {
  if (ms == null) return '·';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
function fmtAvg(n, fixed = 2) {
  if (n == null || Number.isNaN(n)) return null;
  return Number(n).toFixed(fixed);
}

/* ─── §6.6.3 aggregate health dot ────────────────────────── */
const HEALTH_PALETTE = {
  green:   'var(--phase-discovery, #5B7E6A)',
  yellow:  'var(--gold-deep, #B89540)',
  red:     'var(--rose-deep, #B8704D)',
  neutral: 'rgba(45, 21, 33, 0.4)',
};
const HEALTH_LABEL = {
  green:   'Healthy',
  yellow:  'Watch · one threshold elevated',
  red:     'Action · threshold exceeded or recent failure',
  neutral: 'No recent data',
};
function healthDot(state = 'neutral') {
  return el('span', {
    class: 'agent-health-dot',
    title: HEALTH_LABEL[state] || HEALTH_LABEL.neutral,
    style: {
      display: 'inline-block',
      width: '12px', height: '12px', borderRadius: '999px',
      background: HEALTH_PALETTE[state] || HEALTH_PALETTE.neutral,
      verticalAlign: 'middle',
      marginInlineEnd: '0.6em',
      flexShrink: '0',
    },
    'aria-label': HEALTH_LABEL[state] || HEALTH_LABEL.neutral,
  });
}

/* ─── §6.6.1 retry badge + §6.6.2 latency badge ──────────── */
/* Threshold decisions are made server-side and shipped as discrete state
   strings ('monochrome' | 'gold' | 'rose' | null). The client paints what
   the server decided · no threshold comparison in the browser. Same state
   field on health.dot drives the Phase view aggregate dot. */
const RETRY_BADGE_TITLE = {
  rose:       'Schema retries above threshold. Investigate model drift or prompt rot.',
  gold:       'Schema retries elevated. Watch for drift.',
  monochrome: 'Schema retries steady.',
};
const LATENCY_BADGE_TITLE = {
  rose:       'Latency at or above 23 s · within 2 s of the Edge ceiling. Reduce prompt, switch models, or defer to streaming.',
  gold:       'Within Edge budget but approaching the ceiling. Watch for sustained drift.',
  monochrome: 'Latency steady.',
};

function retryBadge(rolling, agentHealth) {
  // Aggregate retry badge on Phase / Run history headers · reads
  // agent.health.retry_state (server-decided) plus rolling avg for display.
  const state = agentHealth?.retry_state;
  if (!state) {
    return el('span', { class: 'agent-badge agent-badge_muted' }, 'no recent data');
  }
  return el('span', {
    class: `agent-badge agent-badge_retry agent-badge_${state}`,
    title: RETRY_BADGE_TITLE[state] || RETRY_BADGE_TITLE.monochrome,
  }, `retry avg ${fmtAvg(rolling?.schema_retry_avg_7d)} · 7d`);
}
function latencyBadge(rolling, agentHealth) {
  const state = agentHealth?.latency_state;
  if (!state) {
    return el('span', { class: 'agent-badge agent-badge_muted' }, 'no recent data');
  }
  return el('span', {
    class: `agent-badge agent-badge_latency agent-badge_${state}`,
    title: LATENCY_BADGE_TITLE[state] || LATENCY_BADGE_TITLE.monochrome,
  }, `avg ${fmtMs(rolling?.duration_avg_7d_ms)} · 7d`);
}

/* ─── status pill ─────────────────────────────────────────── */
function statusPill(status) {
  const map = {
    succeeded:   { label: 'Delivered',  classMod: 'is-teal' },
    delivered:   { label: 'Delivered',  classMod: 'is-teal' },
    started:     { label: 'Producing',  classMod: 'is-butter' },
    generating:  { label: 'Producing',  classMod: 'is-butter' },
    queued:      { label: 'Queued',     classMod: 'is-soft' },
    failed:      { label: 'Failed',     classMod: 'is-rose' },
    failed_permanently: { label: 'Permanently failed', classMod: 'is-rose' },
  };
  const cfg = map[status] || { label: status || 'unknown', classMod: 'is-soft' };
  const tag = el('span', { class: `qb-tag ${cfg.classMod}` }, [
    el('span', { class: 'qb-tag_content' }, cfg.label),
  ]);
  return tag;
}

/* ─── §5.8.1 user-action copy resolver ───────────────────── */
function userActionCopy(agent, errorPayload) {
  if (!errorPayload?.code) return null;
  const code = errorPayload.code;
  if (code === 'qbp_field_missing') {
    const exercises = (errorPayload.missing_fields || []).slice(0, 2).join(', ');
    return USER_ACTION_COPY.qbp_field_missing(agent.display_name, exercises || null);
  }
  if (code === 'missing_dependency') {
    return USER_ACTION_COPY.missing_dependency(agent.display_name, errorPayload.missing_slug || null);
  }
  if (code === 'missing_inputs') {
    return USER_ACTION_COPY.missing_inputs(agent.display_name);
  }
  return null; // not user-fixable
}
function genericFailedCopy(status) {
  if (status === 'failed_permanently') return PERMANENTLY_FAILED_COPY;
  return TRANSIENT_COPY;
}

/* ─── rerun CTAs (§6.4) ───────────────────────────────────── */
function rerunCtas(agent, opts) {
  if (!agent.latest_artifact || agent.latest_artifact.status !== 'delivered') return null;
  const wrap = el('div', { class: 'agent-rerun-ctas' });

  const primary = el('button', {
    class: 'qb-button is-primary is-sm',
    type: 'button',
    title: 'Rerun this agent against your live QBP. Default for most reruns.',
    on: { click: () => opts.onRerun({ agent, source: 'current' }) },
  }, [el('span', { class: 'qb-button_content' }, 'Rerun · current QBP')]);

  const hasSnapshot = Boolean(agent.latest_run?.id);
  const secondary = el('button', {
    class: 'qb-button is-secondary is-sm',
    type: 'button',
    disabled: !hasSnapshot,
    title: hasSnapshot
      ? 'Rerun against the QBP snapshot that produced this artifact.'
      : 'No QBP snapshot available · this is a Chapter 1 legacy artifact.',
    on: { click: hasSnapshot ? () => opts.onRerun({ agent, source: 'original' }) : null },
  }, [el('span', { class: 'qb-button_content' }, 'Rerun · original QBP')]);

  wrap.appendChild(primary);
  wrap.appendChild(secondary);
  return wrap;
}

/* ─── first-run CTA (chapter-4 step-4 founder dispatch entry) ─ */
// Rendered when an agent has no delivered artifact and nothing in flight:
// the founder's first press. POSTs to /api/agents/dispatch via opts.onDispatch.
// For agents that require a logo image (logo_evaluation_agent), a file input
// gates the Run button until a vision-readable image is attached. Client
// checks are advisory; the dispatch endpoint re-validates MIME + 5 MB + owner.
function firstRunCta(agent, opts) {
  const needsFile = LOGO_FILE_AGENTS.has(agent.slug);
  const wrap = el('div', { class: 'agent-first-run' });
  let attached = null;

  const runBtn = el('button', {
    class: 'qb-button is-primary is-sm',
    type: 'button',
    disabled: needsFile,
    title: needsFile
      ? 'Attach a logo image, then run the first evaluation.'
      : 'Run this agent for the first time against your live QBP.',
    on: { click: () => opts.onDispatch({ agent, file: attached }) },
  }, [el('span', { class: 'qb-button_content' }, needsFile ? 'Run evaluation' : 'Run')]);

  if (needsFile) {
    const note = el('div', { class: 'agent-first-run_note' });
    const input = el('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/webp',
      class: 'agent-first-run_file',
      'aria-label': `Attach a logo image for ${agent.display_name}`,
      on: {
        change: (e) => {
          const f = e.target.files && e.target.files[0];
          const check = f ? validateLogoFile(f) : { ok: false, msg: '' };
          if (f && !check.ok) {
            attached = null;
            runBtn.disabled = true;
            note.textContent = check.msg;
            note.dataset.err = '1';
            e.target.value = '';
            return;
          }
          attached = f || null;
          runBtn.disabled = !attached;
          note.textContent = attached ? `Attached ${attached.name}` : '';
          delete note.dataset.err;
        },
      },
    });
    wrap.appendChild(el('label', { class: 'agent-first-run_file-label' }, [
      'Attach a logo image (PNG, JPEG or WebP, up to 5 MB)', input,
    ]));
    wrap.appendChild(note);
  }

  wrap.appendChild(runBtn);
  return wrap;
}

// Advisory client-side logo-file check, mirroring the dispatch endpoint's
// vision discipline (VISION_READABLE_MIME + 5 MB). SVG gets the same
// PNG-export instruction the server returns, before the upload.
const VISION_CLIENT_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const VISION_CLIENT_CAP_BYTES = 5 * 1024 * 1024;
function validateLogoFile(file) {
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    return { ok: false, msg: 'SVG cannot be read. Export your logo as PNG and attach that file.' };
  }
  if (!VISION_CLIENT_MIME.has(file.type)) {
    return { ok: false, msg: 'Use a PNG, JPEG or WebP image.' };
  }
  if (file.size > VISION_CLIENT_CAP_BYTES) {
    return { ok: false, msg: 'That image is over 5 MB. Export a smaller PNG and attach that.' };
  }
  return { ok: true, msg: '' };
}

/* ─── Content Approval Loop · feedback box on delivered artifacts ─ */
// chapter-4 step-4 call 5. Renders under the rerun CTAs on a delivered
// artifact: a feedback textarea wired to the rerun path's runtime_args.feedback
// (the server pipe is ready in /api/agents/rerun + /api/agents/dispatch).
// The three-round cap is a surface-layer advisory (round count tracked in
// the renderConsole session); a determined founder can still rerun.
function calFeedbackBox(agent, opts) {
  const round = opts.revisionRound || 0;
  const wrap = el('details', { class: 'agent-cal' });
  wrap.appendChild(el('summary', { class: 'agent-cal_summary' }, 'Refine with feedback'));

  if (round >= CAL_MAX_ROUNDS) {
    wrap.appendChild(el('p', { class: 'agent-cal_note' },
      `You have used your ${CAL_MAX_ROUNDS} refinement rounds for this artifact. Rerun starts a fresh take.`));
    return wrap;
  }

  const ta = el('textarea', {
    class: 'agent-cal_input qb-field',
    rows: '3',
    placeholder: 'What should change? Be specific. The agent applies this concretely.',
    'aria-label': `Revision feedback for ${agent.display_name}`,
  });
  const send = el('button', {
    class: 'qb-button is-primary is-sm',
    type: 'button',
    title: 'Rerun this agent with your feedback applied.',
    on: {
      click: () => {
        const fb = ta.value.trim();
        if (!fb) { ta.focus(); return; }
        opts.onRefine({ agent, feedback: fb });
      },
    },
  }, [el('span', { class: 'qb-button_content' },
    round > 0 ? `Refine · round ${round + 1} of ${CAL_MAX_ROUNDS}` : 'Refine')]);

  wrap.appendChild(ta);
  wrap.appendChild(el('div', { class: 'agent-cal_actions' }, [send]));
  return wrap;
}

/* ─── tier-locked agent card (free founder, paid agent) ──────── */
// A paid agent the founder's tier cannot run yet. Shows the agent and an
// upgrade affordance instead of a Run button. The server tier gate is the
// real wall; this is the founder-facing pre-empt.
function tierLockedAgentRow(agent, userTier) {
  const row = el('div', { class: 'agent-row agent-row_phase agent-row_tier-locked' });
  row.appendChild(el('div', { class: 'agent-row_header' }, [
    el('span', { class: 'agent-locked-glyph', 'aria-hidden': 'true' }, '◐'),
    el('div', { class: 'agent-row_name' }, [
      el('div', { class: 'agent-row_name-title' }, agent.display_name),
      el('div', { class: 'agent-row_name-meta' },
        `Requires ${String(agent.tier_required || 'starter').replace(/^\w/, c => c.toUpperCase())} tier`),
    ]),
  ]));
  row.appendChild(el('p', { class: 'agent-row_description' }, agent.description));
  row.appendChild(el('div', { class: 'agent-row_ctas' }, [
    el('a', {
      class: 'qb-button is-primary is-sm',
      href: '/payment.html',
    }, [el('span', { class: 'qb-button_content' }, 'Upgrade to run')]),
  ]));
  return row;
}

/* ─── Phase view · Phase 01 row ──────────────────────────── */
function phaseAgentRow(agent, opts) {
  const row = el('div', { class: 'agent-row agent-row_phase' });

  const inflight = Boolean(agent.inflight_dispatch_id);
  const hasDelivered = Boolean(agent.latest_artifact && agent.latest_artifact.status === 'delivered');
  // inflight is the authoritative producing signal · override the pill so a
  // queued-while-prior-delivered dispatch reads "Producing", not "Delivered".
  const pillStatus = inflight ? 'generating'
    : (agent.latest_run?.status || agent.latest_artifact?.status || 'queued');

  const header = el('div', { class: 'agent-row_header' }, [
    healthDot(agent.health?.dot || 'neutral'),
    el('div', { class: 'agent-row_name' }, [
      el('div', { class: 'agent-row_name-title' }, agent.display_name),
      el('div', { class: 'agent-row_name-meta' },
        `${agent.model.startsWith('claude-haiku') ? 'Haiku' : 'Sonnet'} · retry_budget ${agent.retry_budget}`),
    ]),
    statusPill(pillStatus),
  ]);

  const description = el('p', { class: 'agent-row_description' }, agent.description);

  const meta = el('div', { class: 'agent-row_meta' }, [
    agent.latest_run?.completed_at
      ? `Last run ${fmtRelativeTime(agent.latest_run.completed_at)}`
      : agent.latest_run?.started_at
        ? `Started ${fmtRelativeTime(agent.latest_run.started_at)}`
        : 'No runs yet',
  ]);

  // §6.6.1 + §6.6.2 rolling-average badges. Only present when the agent has
  // completed runs in the 7-day window · the badge state (monochrome / gold /
  // rose) is decided server-side and painted verbatim, matching the
  // aggregate dot's threshold logic.
  const rollingBadges = (agent.rolling?.runs_7d && agent.health?.latency_state)
    ? el('div', { class: 'agent-row_rolling' }, [
        latencyBadge(agent.rolling, agent.health),
        retryBadge(agent.rolling, agent.health),
      ])
    : null;

  // Failure copy (user-fixable or generic) below the meta line. An inflight
  // dispatch supersedes a stale failure (the founder already pressed run again).
  const errStatus = inflight ? null
    : agent.permanently_failed_dispatch_id ? 'failed_permanently'
    : (agent.latest_artifact?.status === 'failed' || agent.latest_run?.status === 'failed') ? 'failed'
    : null;
  if (errStatus) {
    // A failed first-run manual dispatch settles to dispatch_jobs.status
    // 'partial' (single-agent), which the reaper never retries, so the
    // generic "the system is retrying automatically" copy would lie. For a
    // first run with no delivered artifact, point at the Run button instead.
    // User-fixable copy (qbp/dependency/inputs) still wins where it applies.
    let copy = userActionCopy(agent, agent.latest_run?.error_payload);
    if (!copy) {
      copy = (!hasDelivered && opts.onDispatch)
        ? 'Run did not finish. Press Run to try again.'
        : genericFailedCopy(errStatus);
    }
    row.dataset.failed = '1';
    row.appendChild(header);
    row.appendChild(description);
    row.appendChild(meta);
    if (rollingBadges) row.appendChild(rollingBadges);
    row.appendChild(el('div', { class: 'agent-row_failure-copy' }, copy));
    // Recovery CTA. A failed run with a prior delivered artifact reruns from
    // it; a failed FIRST run (no delivered artifact) re-dispatches through the
    // founder entry, reusing the file-attach affordance where required.
    if (hasDelivered) {
      if (errStatus === 'failed_permanently') {
        row.appendChild(el('div', { class: 'agent-row_ctas' }, [
          el('button', {
            class: 'qb-button is-primary is-sm',
            type: 'button',
            on: { click: () => opts.onRerun({ agent, source: 'current' }) },
          }, [el('span', { class: 'qb-button_content' }, 'Retry manually')]),
        ]));
      } else {
        const ctas = rerunCtas(agent, opts);
        if (ctas) row.appendChild(el('div', { class: 'agent-row_ctas' }, [ctas]));
      }
    } else if (opts.onDispatch) {
      row.appendChild(el('div', { class: 'agent-row_ctas' }, [firstRunCta(agent, opts)]));
    }
    return row;
  }

  row.appendChild(header);
  row.appendChild(description);
  row.appendChild(meta);
  if (rollingBadges) row.appendChild(rollingBadges);

  if (inflight) {
    // Producing state · a disabled affordance so the optimistic flip
    // survives a repaint and the founder sees work in progress.
    row.appendChild(el('div', { class: 'agent-row_ctas' }, [
      el('button', { class: 'qb-button is-secondary is-sm', type: 'button', disabled: true },
        [el('span', { class: 'qb-button_content' }, 'Producing…')]),
    ]));
    return row;
  }

  if (hasDelivered) {
    const ctas = rerunCtas(agent, opts);
    if (ctas) row.appendChild(el('div', { class: 'agent-row_ctas' }, [ctas]));
    if (opts.onRefine) row.appendChild(calFeedbackBox(agent, opts));
  } else if (opts.onDispatch) {
    // First-run entry · the founder's first press for this agent.
    row.appendChild(el('div', { class: 'agent-row_ctas' }, [firstRunCta(agent, opts)]));
  }
  return row;
}

/* ─── Phase view · locked phase card ─────────────────────── */
// Phase-to-chapter mapping for tier-active locked-row copy. Phase 02
// ships in Chapter 4 (Brand Creation); Phase 03/04/05 ship in 5/6/7.
const PHASE_CHAPTER = { '02': 4, '03': 5, '04': 6, '05': 7 };

// §6.3 + step 9 §3.2 · tier-aware locked-row copy. Free users see the
// upsell narrative (Starter unlock); Starter+ users see the build-ahead
// narrative (chapter in which this phase ships). Empty/unknown tier
// defaults to the Free copy.
function lockedPhaseCopy(card, userTier) {
  const tier = String(userTier || 'free').toLowerCase();
  if (tier === 'free') {
    return 'Unlocks when Starter tier is active';
  }
  const chapter = PHASE_CHAPTER[card.phase];
  return chapter
    ? `Available in Chapter ${chapter} · ${card.label} phase`
    : 'Coming soon';
}

function lockedPhaseCard(card, userTier) {
  return el('div', { class: 'phase-section phase-section_locked' }, [
    el('div', { class: 'phase-section_header' }, [
      el('span', { class: 'qb-tag is-soft' }, [
        el('span', { class: 'qb-tag_content' }, `Phase ${card.phase}`),
      ]),
      el('h3', { class: 'phase-section_title' }, card.label),
    ]),
    el('div', { class: 'phase-section_locked-copy' }, lockedPhaseCopy(card, userTier)),
    el('ul', { class: 'phase-section_locked-agents' }, card.agents.map(a =>
      el('li', { class: 'phase-section_locked-agent' }, [
        el('span', { class: 'agent-locked-glyph', 'aria-hidden': 'true' }, '◐'),
        a.display_name,
      ])
    )),
  ]);
}

/* ─── Run history view · row ─────────────────────────────── */
function runHistoryRow(run, agentsBySlug, thresholds, opts) {
  const agent = agentsBySlug[run.agent_slug] || { display_name: run.agent_slug, slug: run.agent_slug };
  const row = el('div', {
    class: 'run-row',
    tabindex: '0',
    role: 'button',
    'aria-label': `Replay details for ${agent.display_name}`,
    on: {
      click: () => opts.onOpenReplay(run.id),
      keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onOpenReplay(run.id); } },
    },
  });

  const top = el('div', { class: 'run-row_top' }, [
    el('div', { class: 'run-row_agent' }, agent.display_name),
    statusPill(run.status),
    el('span', { class: 'run-row_time' }, fmtRelativeTime(run.completed_at || run.started_at)),
  ]);

  // Per-row latency + retry · the row's own duration_ms and schema_retry_count
  // checked against the same §6.6.1 / §6.6.2 thresholds the aggregate dot uses.
  // Server decides the state (run.retry_state, run.latency_state); client
  // paints it. A single slow run shows rose even when the rolling average is
  // steady · operators see exactly where individual outliers fall.
  const latencyState = run.latency_state || 'monochrome';
  const retryState   = run.retry_state   || 'monochrome';
  const badges = el('div', { class: 'run-row_badges' }, [
    el('span', {
      class: `agent-badge agent-badge_latency agent-badge_${latencyState}`,
      title: LATENCY_BADGE_TITLE[latencyState] || LATENCY_BADGE_TITLE.monochrome,
    }, `${fmtMs(run.duration_ms)}`),
    el('span', {
      class: `agent-badge agent-badge_retry agent-badge_${retryState}`,
      title: RETRY_BADGE_TITLE[retryState] || RETRY_BADGE_TITLE.monochrome,
    }, `retry ${run.schema_retry_count ?? 0}`),
  ]);

  row.appendChild(top);
  row.appendChild(badges);

  if (run.status === 'failed' || run.status === 'failed_permanently') {
    const copy = userActionCopy(agent, run.error_payload) || genericFailedCopy(run.status);
    row.appendChild(el('div', { class: 'run-row_failure-copy' }, copy));
  }
  return row;
}

/* ─── Replay modal ───────────────────────────────────────── */
async function openReplayModal(runId, session) {
  // Step 10B · capture the focus-source element BEFORE the async fetch so
  // we can restore focus to the triggering row on close. Keyboard
  // activation (Enter / Space) reliably leaves the row as activeElement;
  // mouse clicks may not focus the row, in which case restore is a no-op
  // (focus returns to body, which is the pre-modal state anyway).
  const focusSource = document.activeElement;

  // Fetch the run detail.
  let res, data;
  try {
    res = await fetch(`/api/agent-runs/${runId}/replay`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    alert(`Could not load replay details: ${e?.message || e}`);
    return;
  }
  if (!res.ok || !data.ok) {
    alert(`Could not load replay details: ${data?.error || 'unknown'}`);
    return;
  }

  const backdrop = el('div', { class: 'replay-backdrop' });
  const modal = el('div', { class: 'qb-card replay-modal', role: 'dialog', 'aria-modal': 'true' });

  // Step 10B · single close path. All three triggers (× button, backdrop
  // click, Escape) route through closeModal() so focus restore + listener
  // cleanup happen exactly once regardless of how the modal closes.
  function closeModal() {
    backdrop.remove();
    document.removeEventListener('keydown', onEsc);
    if (focusSource && typeof focusSource.focus === 'function' && document.contains(focusSource)) {
      try { focusSource.focus(); } catch {}
    }
  }
  function onEsc(e) {
    if (e.key === 'Escape') closeModal();
  }

  const closeBtn = el('button', {
    class: 'replay-modal_close', type: 'button', 'aria-label': 'Close replay panel',
    on: { click: closeModal },
  }, '×');

  const header = el('div', { class: 'replay-modal_header' }, [
    el('span', { class: 'qb-tag is-soft' }, [
      el('span', { class: 'qb-tag_content' }, `Phase ${data.agent_slug?.includes('_synthesizer') ? '01' : '?'} · Replay`),
    ]),
    el('h2', { class: 'replay-modal_title' }, `${data.agent_slug} · v${data.artifact_version || '·'}`),
    el('div', { class: 'replay-modal_meta' },
      `${data.status} · ${fmtRelativeTime(data.started_at)} · ${fmtMs(data.duration_ms)} · ${data.model || 'default model'}`),
  ]);

  const inputsBlock = el('div', { class: 'replay-modal_section' }, [
    el('h3', { class: 'replay-modal_section-title' }, 'Frozen inputs'),
    el('div', { class: 'replay-modal_field' }, [
      el('span', { class: 'replay-modal_field-label' }, 'agent_version'),
      el('code', { class: 'replay-modal_field-value' }, String(data.agent_version)),
    ]),
    el('div', { class: 'replay-modal_field' }, [
      el('span', { class: 'replay-modal_field-label' }, 'trigger'),
      el('code', { class: 'replay-modal_field-value' }, String(data.trigger || '·')),
    ]),
    el('div', { class: 'replay-modal_field' }, [
      el('span', { class: 'replay-modal_field-label' }, 'model'),
      el('code', { class: 'replay-modal_field-value' }, String(data.model || '·')),
    ]),
    el('div', { class: 'replay-modal_field' }, [
      el('span', { class: 'replay-modal_field-label' }, 'tokens'),
      el('code', { class: 'replay-modal_field-value' },
        `${data.tokens_in ?? '?'} in · ${data.tokens_out ?? '?'} out`),
    ]),
    el('div', { class: 'replay-modal_field' }, [
      el('span', { class: 'replay-modal_field-label' }, 'schema_retry_count'),
      el('code', { class: 'replay-modal_field-value' }, String(data.schema_retry_count ?? 0)),
    ]),
  ]);

  const snapshotBlock = el('details', { class: 'replay-modal_collapsible' }, [
    el('summary', {}, `qbp_snapshot (${data.qbp_snapshot ? Object.keys(data.qbp_snapshot).length : 0} keys)`),
    el('pre', { class: 'replay-modal_json' },
      JSON.stringify(data.qbp_snapshot || {}, null, 2)),
  ]);

  const runtimeArgsBlock = el('details', { class: 'replay-modal_collapsible' }, [
    el('summary', {}, 'runtime_args'),
    el('pre', { class: 'replay-modal_json' },
      JSON.stringify(data.runtime_args || {}, null, 2)),
  ]);

  const fileRefsBlock = el('details', { class: 'replay-modal_collapsible' }, [
    el('summary', {}, `file_refs (${Array.isArray(data.file_refs) ? data.file_refs.length : 0})`),
    el('pre', { class: 'replay-modal_json' },
      JSON.stringify(data.file_refs || [], null, 2)),
  ]);

  const errorBlock = data.error_payload
    ? el('details', { class: 'replay-modal_collapsible' }, [
        el('summary', {}, 'error_payload'),
        el('pre', { class: 'replay-modal_json' },
          JSON.stringify(data.error_payload, null, 2)),
      ])
    : null;

  modal.appendChild(closeBtn);
  modal.appendChild(header);
  modal.appendChild(inputsBlock);
  modal.appendChild(snapshotBlock);
  modal.appendChild(runtimeArgsBlock);
  modal.appendChild(fileRefsBlock);
  if (errorBlock) modal.appendChild(errorBlock);

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', onEsc);

  document.body.appendChild(backdrop);

  // Step 10B · focus the close button on open so keyboard users get
  // a clear signal that the modal is interactive. Tab continues from
  // there into the modal content; Shift+Tab cycles back to closeBtn.
  // (Full focus trap deferred to step 15 WCAG audit.)
  closeBtn.focus();
}

/* ─── view switching ─────────────────────────────────────── */
function viewToggle(currentView, onChange) {
  const wrap = el('div', { class: 'console-view-toggle', role: 'tablist' });
  for (const view of ['phase', 'runs']) {
    const isActive = view === currentView;
    const btn = el('button', {
      type: 'button',
      role: 'tab',
      'aria-selected': String(isActive),
      class: `console-view-toggle_btn ${isActive ? 'is-active' : ''}`,
      on: { click: () => onChange(view) },
    }, view === 'phase' ? 'Phase view' : 'Run history');
    wrap.appendChild(btn);
  }
  return wrap;
}

/* ─── public renders ─────────────────────────────────────── */
export function renderConsoleLoading(container) {
  clear(container);
  container.appendChild(el('div', { class: 'console-shell' }, [
    el('div', { class: 'console-loading' }, 'Loading your agents…'),
  ]));
}

export function renderConsoleError(container, error) {
  clear(container);
  container.appendChild(el('div', { class: 'console-shell' }, [
    el('div', { class: 'console-error' }, [
      el('h2', {}, 'Something went wrong.'),
      el('p', {}, String(error?.message || error || 'Unknown error')),
      el('button', {
        type: 'button',
        class: 'qb-button is-secondary',
        on: { click: () => location.reload() },
      }, [el('span', { class: 'qb-button_content' }, 'Reload')]),
    ]),
  ]));
}

// Step 9C · poll fallback cadence matches the bell. The Realtime manager
// owns the realtime ↔ poll state machine; this is the consumer-side
// cadence when state='poll'.
const PHASE_POLL_MS = 30_000;

export function renderConsole(container, payload, opts) {
  clear(container);

  const session = opts?.session;
  // `payload` mutates on Realtime-triggered refetch (step 9C). All
  // helpers below close over `payload` via this `let` so paintView()
  // always reads the latest state.
  let livePayload = payload;
  let tier = String(payload?.user?.tier || 'free').toLowerCase();
  const firstName = payload?.user?.first_name || 'there';
  const foundationLocked = Boolean(payload?.user?.foundation_locked_at);
  let agentsBySlug = Object.fromEntries((payload.agents || []).map(a => [a.slug, a]));
  const thresholds = payload.thresholds || {
    retry_gold: 0.1, retry_rose: 0.5, latency_gold_ms: 20_000, latency_rose_ms: 23_000,
  };
  // Surface-layer Content Approval Loop round count, keyed by agent slug.
  // Advisory only (chapter-2 adjudication); persists across in-session
  // refetches, resets on full reload.
  const revisionRounds = {};

  const shell = el('div', { class: 'console-shell' });

  // ─── Header ──────────────────────────────────────────────
  shell.appendChild(el('header', { class: 'console-header' }, [
    el('span', { class: 'qb-tag is-soft' }, [
      el('span', { class: 'qb-tag_content' }, 'QB BrandOS · Agent Console'),
    ]),
    el('h1', { class: 'console-header_title' }, 'Your workforce'),
    el('p', { class: 'console-header_subtitle' },
      foundationLocked
        ? `${firstName === 'there' ? 'Hello' : firstName}, here is what is running on your behalf.`
        : 'Complete your foundation to put your agents to work.'),
  ]));

  let currentView = 'phase';
  const viewMount = el('div', { class: 'console-views' });
  shell.appendChild(viewToggle(currentView, switchView));
  shell.appendChild(viewMount);

  function switchView(view) {
    currentView = view;
    // Re-render toggle to update is-active state.
    shell.replaceChild(viewToggle(currentView, switchView), shell.children[1]);
    paintView();
  }

  function paintView() {
    clear(viewMount);
    if (currentView === 'phase') {
      paintPhaseView();
    } else {
      paintRunHistoryView();
    }
  }

  function paintPhaseView() {
    if (!foundationLocked) {
      viewMount.appendChild(el('div', { class: 'console-empty' }, [
        el('h2', {}, 'Lock your foundation to see your agents at work.'),
        el('a', {
          class: 'qb-button is-primary',
          href: '/foundation',
        }, [el('span', { class: 'qb-button_content' }, 'Go to foundation')]),
      ]));
      return;
    }

    // Live agents grouped by phase. Phase 01 (Discovery) and, since
    // chapter-4 step 4, Phase 02 (Brand Creation) render as live sections.
    // Each card decides its own affordance: first-run, producing, rerun +
    // refine, or (for a paid agent above the founder's tier) an upgrade row.
    const agents = livePayload.agents || [];
    const byPhase = {};
    for (const a of agents) {
      const p = a.phase || '01';
      (byPhase[p] = byPhase[p] || []).push(a);
    }
    for (const phase of Object.keys(byPhase).sort()) {
      const tagClass = phase === '01' ? 'is-teal' : 'is-gold';
      viewMount.appendChild(el('section', { class: 'phase-section phase-section_active' }, [
        el('div', { class: 'phase-section_header' }, [
          el('span', { class: `qb-tag ${tagClass}` }, [
            el('span', { class: 'qb-tag_content' }, `Phase ${phase}`),
          ]),
          el('h2', { class: 'phase-section_title' }, PHASE_LABELS[phase] || `Phase ${phase}`),
        ]),
        el('div', { class: 'phase-section_agents' }, byPhase[phase].map(renderAgentCard)),
      ]));
    }

    // Locked phase cards · Phase 03-05 (Phase 02 retired at step 4, now live).
    // Tier-aware copy per step 9 §3.2.
    for (const card of (livePayload.locked_phase_cards || [])) {
      viewMount.appendChild(lockedPhaseCard(card, tier));
    }
  }

  // Per-agent card dispatcher · tier pre-empt then the full live card.
  // The pre-empt mirrors the server tier gate exactly: it fires only for
  // phase >= '02' (api/agents/run.js + dispatch.js gate that range). Phase
  // 01 agents are never gated at dispatch, so they render normally for every
  // tier even where their META declares a higher tier_required.
  function renderAgentCard(agent) {
    const tierGated = String(agent.phase || '01') >= '02';
    if (tierGated && !tierAllows(tier, agent.tier_required)) {
      return tierLockedAgentRow(agent, tier);
    }
    return phaseAgentRow(agent, {
      onRerun:    ({ agent, source }) => triggerRerun(agent, source),
      onDispatch: ({ agent, file }) => triggerDispatch(agent, file),
      onRefine:   ({ agent, feedback }) => triggerRefine(agent, feedback),
      revisionRound: revisionRounds[agent.slug] || 0,
    });
  }

  function paintRunHistoryView() {
    const list = livePayload.recent_runs || [];
    if (list.length === 0) {
      viewMount.appendChild(el('div', { class: 'console-empty' }, [
        el('p', {}, 'Your run history will populate after your first agent completes.'),
      ]));
      return;
    }
    viewMount.appendChild(el('div', { class: 'run-list' },
      list.map(r => runHistoryRow(r, agentsBySlug, thresholds, {
        onOpenReplay: (runId) => openReplayModal(runId, session),
      }))
    ));
  }

  async function triggerRerun(agent, source) {
    if (!session?.token) {
      alert('Sign in required to rerun.');
      return;
    }
    const confirmMsg = source === 'original'
      ? `Rerun ${agent.display_name} with the original QBP snapshot?`
      : `Rerun ${agent.display_name} with your current QBP?`;
    if (!confirm(confirmMsg)) return;

    // Per PR #78 audit item 3 · routes through /api/agents/rerun, the
    // contract-conformant path. Server creates the new artifact + dispatch
    // rows, then context.waitUntil()'s a child fetch to /api/agents/run.
    // agent_runs gets the §3.5-conformant shape (agent_version, qbp_snapshot,
    // schema_retry_count, error_payload jsonb). /api/artifacts/[id]/regenerate
    // is no longer the rerun path; retires fully in §13 step 7.
    if (!agent.latest_artifact?.id) {
      alert('No prior artifact to regenerate.');
      return;
    }
    try {
      const r = await fetch('/api/agents/rerun', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          artifact_id: agent.latest_artifact.id,
          qbp_source: source,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`Rerun failed: ${d?.error || r.status}`);
        return;
      }
      // 202 expected · the run is in-flight on a child Edge invocation.
      // Reload to surface the new artifact row with status='queued'.
      location.reload();
    } catch (e) {
      alert(`Rerun failed: ${e?.message || e}`);
    }
  }

  // chapter-4 step-4 · founder first-run dispatch. POSTs to
  // /api/agents/dispatch (the contract-conformant first-run entry). For
  // logo_evaluation_agent the attached image is uploaded to the user's
  // storage first, then passed as files:[{path,type:'logo-image'}]. On 202
  // the card flips optimistically to producing and the existing realtime /
  // poll refetch reconciles with server truth (no hard reload).
  async function triggerDispatch(agent, file) {
    if (!session?.token) { alert('Sign in to run your agents.'); return; }

    let files;
    if (LOGO_FILE_AGENTS.has(agent.slug)) {
      if (!file) { alert(`${agent.display_name} needs a logo image. Attach one, then run.`); return; }
      const check = validateLogoFile(file);
      if (!check.ok) { alert(check.msg); return; }
      let objPath;
      try {
        objPath = await uploadLogoImage(file);
      } catch (e) {
        alert(`Could not upload your logo: ${e?.message || e}`);
        return;
      }
      files = [{ path: objPath, type: 'logo-image' }];
    }

    let res, body;
    try {
      res = await fetch('/api/agents/dispatch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(files ? { agent_slug: agent.slug, files } : { agent_slug: agent.slug }),
      });
      body = await res.json().catch(() => ({}));
    } catch (e) {
      alert(`Could not start ${agent.display_name}: ${e?.message || e}`);
      return;
    }

    if (res.status === 202) {
      // Optimistic flip · the agent is a live reference in livePayload.agents.
      agent.inflight_dispatch_id = body.dispatch_id || 'pending';
      paintView();
      refetchAndRepaint();
      return;
    }
    // 4xx → founder-facing copy mapped from the named dispatch error.
    alert(dispatchErrorCopy(agent, body));
  }

  // chapter-4 step-4 · Content Approval Loop. Sends founder feedback through
  // the rerun path (runtime_args.feedback), bumps the surface-layer round
  // count, and reconciles via refetch. The cap is advisory (the API allows
  // more); the surface stops offering the box at CAL_MAX_ROUNDS.
  async function triggerRefine(agent, feedback) {
    if (!session?.token) { alert('Sign in to refine.'); return; }
    if (!agent.latest_artifact?.id) { alert('No delivered artifact to refine yet.'); return; }
    let res, body;
    try {
      res = await fetch('/api/agents/rerun', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ artifact_id: agent.latest_artifact.id, qbp_source: 'current', feedback }),
      });
      body = await res.json().catch(() => ({}));
    } catch (e) {
      alert(`Could not send your feedback: ${e?.message || e}`);
      return;
    }
    if (!res.ok) { alert(dispatchErrorCopy(agent, body)); return; }
    revisionRounds[agent.slug] = (revisionRounds[agent.slug] || 0) + 1;
    agent.inflight_dispatch_id = body.dispatch_id || 'pending';
    paintView();
    refetchAndRepaint();
  }

  // Direct storage upload for a single logo image, mirroring the harness +
  // qb-file-upload path: POST the bytes to the user's namespace in the
  // user-uploads bucket under the JWT. Returns the bucket-relative object
  // path ({userId}/{uuid}.{ext}) the dispatch endpoint signs server-side.
  async function uploadLogoImage(file) {
    const QB = window.QB || {};
    const supaUrl = QB.SUPA_URL, anon = QB.SUPA_KEY;
    const userId = session.userId || session.user?.id;
    if (!supaUrl || !anon || !userId) throw new Error('storage not configured');
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[file.type] || 'png';
    const objPath = `${userId}/${crypto.randomUUID()}.${ext}`;
    const r = await fetch(`${supaUrl}/storage/v1/object/user-uploads/${objPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}`, apikey: anon, 'Content-Type': file.type },
      body: file,
    });
    if (!r.ok) throw new Error(`upload ${r.status}`);
    return objPath;
  }

  // Step 9C · Realtime subscription via the shared QBRealtimeManager.
  // Phase view refetches /api/agents/console on notification arrival
  // (chain_ready / dispatch_failed events) so agent state is live.
  // Falls back to 30 s poll when the manager state is 'poll' (Realtime
  // unavailable or SUBSCRIBED grace timeout). Manager owns the state
  // machine + Supabase client; this consumer owns its own fetch.
  let phasePollHandle = null;
  let refetchInFlight = false;

  async function refetchAndRepaint() {
    if (!session?.token || refetchInFlight) return;
    refetchInFlight = true;
    try {
      const r = await fetch('/api/agents/console', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!r.ok) return; // silent · the next event or poll re-tries
      const fresh = await r.json().catch(() => null);
      if (!fresh || !fresh.ok) return;
      livePayload = fresh;
      tier = String(fresh?.user?.tier || 'free').toLowerCase();
      agentsBySlug = Object.fromEntries((fresh.agents || []).map(a => [a.slug, a]));
      paintView();
    } catch {
      // Network errors are non-fatal · next event or poll re-tries
    } finally {
      refetchInFlight = false;
    }
  }

  const mgr = window.QBRealtimeManager;
  if (mgr && session?.token) {
    mgr.start({ authToken: session.token });
    mgr.onNotification(() => refetchAndRepaint());
    mgr.onState(s => {
      if (s === 'realtime') {
        if (phasePollHandle) { clearInterval(phasePollHandle); phasePollHandle = null; }
      } else if (s === 'poll') {
        if (phasePollHandle === null) {
          phasePollHandle = setInterval(refetchAndRepaint, PHASE_POLL_MS);
        }
      }
    });
  }

  // Initial paint.
  paintView();

  container.appendChild(shell);

  // Inject Console-specific styles inline so the page is self-contained.
  // Token + component CSS provide the base; these are the Console deltas.
  if (!document.getElementById('qb-agents-console-styles')) {
    document.head.appendChild(el('style', { id: 'qb-agents-console-styles' }, `
      .console-shell { max-width: 880px; margin: 0 auto; padding: var(--space-xl, 2rem) var(--space-l, 1.5rem); }
      .console-header { text-align: left; margin-bottom: var(--space-l, 1.5rem); }
      .console-header_title { font-family: var(--font-display, 'Fraunces', serif); font-weight: 600; font-size: var(--step-3, 2.4rem); margin: 0.4em 0 0.2em; line-height: 1.1; }
      .console-header_subtitle { color: rgba(45, 21, 33, 0.7); font-size: var(--step-0, 1rem); margin: 0; }

      .console-view-toggle { display: flex; gap: 0.5rem; margin-bottom: var(--space-m, 1rem); border-bottom: 1px solid rgba(45, 21, 33, 0.12); }
      .console-view-toggle_btn { background: transparent; border: none; padding: 0.7rem 1rem; font: inherit; cursor: pointer; color: rgba(45, 21, 33, 0.55); border-bottom: 2px solid transparent; transition: color 0.2s, border-color 0.2s; }
      .console-view-toggle_btn.is-active { color: var(--ink); border-bottom-color: var(--ink); font-weight: 500; }

      .phase-section { margin-bottom: var(--space-l, 1.5rem); }
      .phase-section_header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: var(--space-s, 0.75rem); }
      .phase-section_title { font-family: var(--font-display, 'Fraunces', serif); font-weight: 500; font-size: var(--step-2, 1.6rem); margin: 0; }
      .phase-section_locked { opacity: 0.7; }
      .phase-section_locked-copy { font-size: 0.9em; color: rgba(45, 21, 33, 0.65); margin-bottom: 0.6em; }
      .phase-section_locked-agents { list-style: none; padding: 0; margin: 0; }
      .phase-section_locked-agent { display: flex; align-items: center; gap: 0.5em; padding: 0.4em 0; color: rgba(45, 21, 33, 0.75); border-bottom: 1px dashed rgba(45, 21, 33, 0.12); }
      .agent-locked-glyph { color: rgba(45, 21, 33, 0.5); }

      .phase-section_agents { display: flex; flex-direction: column; gap: var(--space-s, 0.75rem); }
      .agent-row { background: var(--cream-card, #F5EFE6); border: 2px solid var(--ink); border-radius: var(--radius-card, 0.8rem); padding: 1rem 1.2rem; box-shadow: 0 9px var(--ink); }
      @media (min-width: 640px) { .agent-row { box-shadow: 0 16px var(--ink); } }
      .agent-row_header { display: flex; align-items: center; gap: 0.6rem; }
      .agent-row_name { flex-grow: 1; }
      .agent-row_name-title { font-weight: 500; font-size: var(--step-1, 1.2rem); }
      .agent-row_name-meta { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.75em; color: rgba(45, 21, 33, 0.6); margin-top: 0.1em; }
      .agent-row_description { color: rgba(45, 21, 33, 0.75); font-size: 0.95em; margin: 0.6em 0 0; }
      .agent-row_meta { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.75em; color: rgba(45, 21, 33, 0.55); margin-top: 0.5em; }
      .agent-row_rolling { display: flex; gap: 0.4em; flex-wrap: wrap; margin-top: 0.45em; }
      .agent-row_failure-copy { background: rgba(184, 112, 77, 0.08); border-left: 3px solid var(--rose-deep, #B8704D); padding: 0.6em 0.8em; margin-top: 0.6em; font-size: 0.9em; border-radius: 0.3em; }
      .agent-row_ctas { margin-top: 0.8em; }
      .agent-rerun-ctas { display: flex; gap: 0.6em; flex-wrap: wrap; }
      @media (max-width: 480px) { .agent-rerun-ctas { flex-direction: column; align-items: stretch; } }

      .agent-first-run { display: flex; flex-direction: column; gap: 0.5em; align-items: flex-start; }
      .agent-first-run_file-label { display: flex; flex-direction: column; gap: 0.3em; font-size: 0.82em; color: rgba(45, 21, 33, 0.7); }
      .agent-first-run_file { font: inherit; font-size: 0.85em; }
      .agent-first-run_note { font-size: 0.78em; color: rgba(45, 21, 33, 0.6); }
      .agent-first-run_note[data-err] { color: var(--rose-deep, #B8704D); }

      .agent-row_tier-locked { opacity: 0.85; }
      .agent-row_tier-locked .agent-row_header { gap: 0.5em; }

      .agent-cal { margin-top: 0.7em; border-top: 1px dashed rgba(45, 21, 33, 0.14); padding-top: 0.6em; }
      .agent-cal_summary { cursor: pointer; font-size: 0.85em; color: rgba(45, 21, 33, 0.72); }
      .agent-cal_input { width: 100%; margin-top: 0.5em; font: inherit; font-size: 0.9em; padding: 0.5em 0.6em; border: 1.5px solid rgba(45, 21, 33, 0.25); border-radius: 0.4em; background: var(--cream, #FBF7F0); resize: vertical; }
      .agent-cal_actions { margin-top: 0.5em; }
      .agent-cal_note { font-size: 0.82em; color: rgba(45, 21, 33, 0.6); margin: 0.5em 0 0; }

      .agent-badge { display: inline-block; font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.7em; padding: 0.2em 0.5em; border-radius: 0.3em; background: rgba(45, 21, 33, 0.06); }
      .agent-badge_muted { color: rgba(45, 21, 33, 0.5); }
      .agent-badge_monochrome { color: var(--ink); }
      .agent-badge_gold { color: var(--gold-deep, #B89540); }
      .agent-badge_rose { color: var(--rose-deep, #B8704D); font-weight: 500; }

      .run-list { display: flex; flex-direction: column; gap: 0.5rem; }
      .run-row { background: var(--cream-card, #F5EFE6); border: 1px solid rgba(45, 21, 33, 0.12); border-radius: 0.5rem; padding: 0.8em 1em; cursor: pointer; transition: background 0.15s; }
      .run-row:hover, .run-row:focus { background: var(--cream-warm, #EFE7DA); outline: none; }
      .run-row_top { display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap; }
      .run-row_agent { font-weight: 500; flex-grow: 1; }
      .run-row_time { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.75em; color: rgba(45, 21, 33, 0.55); }
      .run-row_badges { display: flex; gap: 0.5em; margin-top: 0.4em; }
      .run-row_failure-copy { margin-top: 0.4em; font-size: 0.85em; color: rgba(45, 21, 33, 0.7); border-left: 2px solid var(--rose-deep, #B8704D); padding-left: 0.6em; }

      .replay-backdrop { position: fixed; inset: 0; background: rgba(45, 21, 33, 0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100; }
      .replay-modal { background: var(--cream); max-width: 720px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; position: relative; }
      .replay-modal_close { position: absolute; top: 0.6em; right: 0.8em; background: none; border: none; font-size: 1.6em; cursor: pointer; color: rgba(45, 21, 33, 0.6); padding: 0; line-height: 1; }
      .replay-modal_close:hover { color: var(--ink); }
      .replay-modal_header { margin-bottom: 1.2em; }
      .replay-modal_title { font-family: var(--font-display, 'Fraunces', serif); font-weight: 500; font-size: var(--step-2, 1.6rem); margin: 0.4em 0 0.2em; }
      .replay-modal_meta { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.8em; color: rgba(45, 21, 33, 0.65); }
      .replay-modal_section { margin-bottom: 1.2em; }
      .replay-modal_section-title { font-size: 0.9em; margin: 0 0 0.6em; color: rgba(45, 21, 33, 0.7); text-transform: uppercase; letter-spacing: 0.05em; }
      .replay-modal_field { display: flex; gap: 1em; padding: 0.3em 0; border-bottom: 1px dashed rgba(45, 21, 33, 0.1); }
      .replay-modal_field-label { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.8em; color: rgba(45, 21, 33, 0.6); min-width: 12em; }
      .replay-modal_field-value { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.85em; }
      .replay-modal_collapsible { margin-top: 0.8em; border-top: 1px solid rgba(45, 21, 33, 0.1); padding-top: 0.6em; }
      .replay-modal_collapsible summary { cursor: pointer; font-weight: 500; padding: 0.3em 0; }
      .replay-modal_json { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 0.75em; background: rgba(45, 21, 33, 0.04); padding: 0.6em 0.8em; border-radius: 0.3em; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }

      .console-loading, .console-empty, .console-error { text-align: center; padding: var(--space-xl, 2rem); }
      .console-empty h2 { font-family: var(--font-display, 'Fraunces', serif); font-weight: 500; margin-bottom: 1em; }

      @media (prefers-reduced-motion: reduce) {
        .console-view-toggle_btn, .run-row { transition: none; }
      }
    `));
  }
}
