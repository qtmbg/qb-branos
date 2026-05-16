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
function retryBadge(rolling, thresholds) {
  const avg = rolling?.schema_retry_avg_7d;
  if (rolling?.runs_7d === 0 || avg == null) {
    return el('span', { class: 'agent-badge agent-badge_muted' }, 'no recent data');
  }
  let state = 'monochrome';
  if (avg > thresholds.retry_rose) state = 'rose';
  else if (avg >= thresholds.retry_gold) state = 'gold';
  return el('span', {
    class: `agent-badge agent-badge_retry agent-badge_${state}`,
    title: state === 'rose'
      ? 'Schema retries above threshold. Investigate model drift or prompt rot.'
      : state === 'gold'
        ? 'Schema retries elevated. Watch for drift.'
        : 'Schema retries steady.',
  }, `retry avg ${fmtAvg(avg)} · 7d`);
}
function latencyBadge(rolling, thresholds) {
  const avg = rolling?.duration_avg_7d_ms;
  if (rolling?.success_runs_7d === 0 || avg == null) {
    return el('span', { class: 'agent-badge agent-badge_muted' }, 'no recent data');
  }
  let state = 'monochrome';
  if (avg > thresholds.latency_rose_ms) state = 'rose';
  else if (avg >= thresholds.latency_gold_ms) state = 'gold';
  return el('span', {
    class: `agent-badge agent-badge_latency agent-badge_${state}`,
    title: state === 'rose'
      ? 'Latency at or above 23 s · within 2 s of the Edge ceiling. Reduce prompt, switch models, or defer to streaming.'
      : state === 'gold'
        ? 'Within Edge budget but approaching the ceiling. Watch for sustained drift.'
        : 'Latency steady.',
  }, `avg ${fmtMs(avg)} · 7d`);
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

/* ─── Phase view · Phase 01 row ──────────────────────────── */
function phaseAgentRow(agent, opts) {
  const row = el('div', { class: 'agent-row agent-row_phase' });

  const header = el('div', { class: 'agent-row_header' }, [
    healthDot(agent.health),
    el('div', { class: 'agent-row_name' }, [
      el('div', { class: 'agent-row_name-title' }, agent.display_name),
      el('div', { class: 'agent-row_name-meta' },
        `${agent.model.startsWith('claude-haiku') ? 'Haiku' : 'Sonnet'} · retry_budget ${agent.retry_budget}`),
    ]),
    statusPill(agent.latest_run?.status || agent.latest_artifact?.status || 'queued'),
  ]);

  const description = el('p', { class: 'agent-row_description' }, agent.description);

  const meta = el('div', { class: 'agent-row_meta' }, [
    agent.latest_run?.completed_at
      ? `Last run ${fmtRelativeTime(agent.latest_run.completed_at)}`
      : agent.latest_run?.started_at
        ? `Started ${fmtRelativeTime(agent.latest_run.started_at)}`
        : 'No runs yet',
  ]);

  // Failure copy (user-fixable or generic) below the meta line.
  const errStatus = agent.permanently_failed_dispatch_id ? 'failed_permanently'
    : (agent.latest_artifact?.status === 'failed' || agent.latest_run?.status === 'failed') ? 'failed'
    : null;
  if (errStatus) {
    const copy = userActionCopy(agent, agent.latest_run?.error_payload) || genericFailedCopy(errStatus);
    row.dataset.failed = '1';
    row.appendChild(header);
    row.appendChild(description);
    row.appendChild(meta);
    row.appendChild(el('div', { class: 'agent-row_failure-copy' }, copy));
    // Manual retry CTA for permanent failure per §5.5.
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
    return row;
  }

  row.appendChild(header);
  row.appendChild(description);
  row.appendChild(meta);
  const ctas = rerunCtas(agent, opts);
  if (ctas) row.appendChild(el('div', { class: 'agent-row_ctas' }, [ctas]));
  return row;
}

/* ─── Phase view · locked phase card ─────────────────────── */
function lockedPhaseCard(card) {
  return el('div', { class: 'phase-section phase-section_locked' }, [
    el('div', { class: 'phase-section_header' }, [
      el('span', { class: 'qb-tag is-soft' }, [
        el('span', { class: 'qb-tag_content' }, `Phase ${card.phase}`),
      ]),
      el('h3', { class: 'phase-section_title' }, card.label),
    ]),
    el('div', { class: 'phase-section_locked-copy' }, 'Unlocks when Starter tier is active'),
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

  // Per-row latency + retry · the row's own duration_ms and schema_retry_count,
  // not the rolling average. The rolling-average badges live on the Phase view's
  // aggregate health dot; per-row badges show point-in-time values.
  const badges = el('div', { class: 'run-row_badges' }, [
    el('span', { class: 'agent-badge agent-badge_latency agent-badge_monochrome' },
      `${fmtMs(run.duration_ms)}`),
    el('span', { class: 'agent-badge agent-badge_retry agent-badge_monochrome' },
      `retry ${run.schema_retry_count ?? 0}`),
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
  const closeBtn = el('button', {
    class: 'replay-modal_close', type: 'button', 'aria-label': 'Close replay panel',
    on: { click: () => backdrop.remove() },
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
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      backdrop.remove();
      document.removeEventListener('keydown', onEsc);
    }
  });

  document.body.appendChild(backdrop);
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

export function renderConsole(container, payload, opts) {
  clear(container);

  const session = opts?.session;
  const tier = String(payload?.user?.tier || 'free').toLowerCase();
  const firstName = payload?.user?.first_name || 'there';
  const foundationLocked = Boolean(payload?.user?.foundation_locked_at);
  const agentsBySlug = Object.fromEntries((payload.agents || []).map(a => [a.slug, a]));
  const thresholds = payload.thresholds || {
    retry_gold: 0.1, retry_rose: 0.5, latency_gold_ms: 20_000, latency_rose_ms: 23_000,
  };

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

    // Phase 01 section · live agents.
    viewMount.appendChild(el('section', { class: 'phase-section phase-section_active' }, [
      el('div', { class: 'phase-section_header' }, [
        el('span', { class: 'qb-tag is-teal' }, [
          el('span', { class: 'qb-tag_content' }, 'Phase 01'),
        ]),
        el('h2', { class: 'phase-section_title' }, PHASE_LABELS['01']),
      ]),
      el('div', { class: 'phase-section_agents' }, (payload.agents || []).map(a =>
        phaseAgentRow(a, {
          onRerun: ({ agent, source }) => triggerRerun(agent, source),
        })
      )),
    ]));

    // Locked phase cards · Phase 02-05.
    for (const card of (payload.locked_phase_cards || [])) {
      viewMount.appendChild(lockedPhaseCard(card));
    }
  }

  function paintRunHistoryView() {
    const list = payload.recent_runs || [];
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

    // Use the legacy dispatch path for now · /api/agents/run requires
    // an artifact_id + dispatch_id which the regenerate flow creates.
    // Until §13 step 7 (regenerate endpoint refactor) lands, route
    // through the existing /api/artifacts/[id]/regenerate which is the
    // Chapter 1 surface that produces a new artifact version.
    if (!agent.latest_artifact?.id) {
      alert('No prior artifact to regenerate.');
      return;
    }
    try {
      const r = await fetch(`/api/artifacts/${agent.latest_artifact.id}/regenerate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ qbp_source: source }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(`Rerun failed: ${d?.error || r.status}`);
        return;
      }
      // Reload the Console to reflect the new in-flight artifact.
      location.reload();
    } catch (e) {
      alert(`Rerun failed: ${e?.message || e}`);
    }
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
      .agent-row_failure-copy { background: rgba(184, 112, 77, 0.08); border-left: 3px solid var(--rose-deep, #B8704D); padding: 0.6em 0.8em; margin-top: 0.6em; font-size: 0.9em; border-radius: 0.3em; }
      .agent-row_ctas { margin-top: 0.8em; }
      .agent-rerun-ctas { display: flex; gap: 0.6em; flex-wrap: wrap; }
      @media (max-width: 480px) { .agent-rerun-ctas { flex-direction: column; align-items: stretch; } }

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
