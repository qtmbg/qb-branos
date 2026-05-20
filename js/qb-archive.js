/* QB BrandOS — Brand Archive renderer
   Last updated: 2026-05-14
   Spec reference: CHAPTER_01_SPEC.md §3.4 (qb-artifact-row),
                   §5.5 (GET /api/artifacts), §5.10 (tier-gating),
                   §9.4 (empty), §12 (design system).

   Renders the filterable list of every artifact produced for the
   user. One render function for the page; filters are client-side
   (no re-fetch per change) and state syncs to the URL hash so
   filtered views are shareable. Locked rows surface artifact meta
   but not content — click triggers a paywall, not navigation.

   Exports:
     renderArchive(container, artifacts, opts)
     renderArchiveLoading(container)
     renderArchiveError(container, error)
     renderArchiveEmpty(container, opts)
     humanizeAgentSlug(slug)
*/

import { createArtifactRow, createPaywallModal } from '/js/qb-components.js';

const PHASE_LABELS = {
  '00': 'Acquisition',
  '01': 'Discovery',
  '02': 'Brand Creation',
  '03': 'Content',
  '04': 'Execution',
  '05': 'Intelligence',
};
const PHASE_ENABLED = new Set(['01']); // Chapter 1 only enables Phase 01.

const AGENT_HUMAN = {
  soul_map_synthesizer:   'Soul Map Synthesizer',
  sensescape_synthesizer: 'Sensescape Synthesizer',
  visual_dna_synthesizer: 'Visual DNA Synthesizer',
  war_table_synthesizer:  'War Table Synthesizer',
};

/* ─── DOM helpers ─────────────────────────────────────────── */
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
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
function clear(c) { while (c.firstChild) c.removeChild(c.firstChild); }

export function humanizeAgentSlug(slug) {
  if (!slug || typeof slug !== 'string') return 'Agent';
  if (AGENT_HUMAN[slug]) return AGENT_HUMAN[slug];
  return slug
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/Dna/g, 'DNA')
    .replace(/Qbp/g, 'QBP');
}

function fallbackTitle(row) {
  const agentLabel = humanizeAgentSlug(row.agent_slug);
  if (row.status === 'queued')     return `${agentLabel} (waiting)`;
  if (row.status === 'generating') return `${agentLabel} (generating)`;
  if (row.status === 'failed')     return `${agentLabel} (failed)`;
  return agentLabel;
}

function resolveTitle(row) {
  // The API returns title computed from content.header.title with a
  // status-aware fallback already. We still re-resolve here so the
  // gallery (which builds rows from local fixtures) ships labels too.
  if (typeof row.title === 'string' && row.title && !/^Artifact( \(.+\))?$/.test(row.title)) {
    return row.title;
  }
  return fallbackTitle(row);
}

/* ─── URL hash state ──────────────────────────────────────── */
function readHashState() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const params = new URLSearchParams(raw);
  return {
    phase:    params.get('phase')    || 'all',
    agent:    params.get('agent')    || 'all',
    status:   params.get('status')   || 'all',
    versions: params.get('versions') === 'all' ? 'all' : 'latest',
  };
}
function writeHashState(state) {
  const params = new URLSearchParams();
  if (state.phase    !== 'all')   params.set('phase',    state.phase);
  if (state.agent    !== 'all')   params.set('agent',    state.agent);
  if (state.status   !== 'all')   params.set('status',   state.status);
  if (state.versions === 'all')   params.set('versions', 'all');
  const next = params.toString();
  const target = next ? `#${next}` : '#';
  if (target !== (window.location.hash || '#')) {
    history.replaceState(null, '', target);
  }
}

/* ─── Filter machinery ────────────────────────────────────── */
function uniqueAgentSlugs(artifacts) {
  const seen = new Set();
  for (const a of artifacts) if (a.agent_slug) seen.add(a.agent_slug);
  return Array.from(seen);
}

function applyFilters(artifacts, state) {
  let rows = artifacts.slice();

  if (state.versions === 'latest') {
    // Group by agent_slug, keep highest version per group.
    const bySlug = new Map();
    for (const a of rows) {
      const cur = bySlug.get(a.agent_slug);
      if (!cur || (Number(a.version) || 0) > (Number(cur.version) || 0)) {
        bySlug.set(a.agent_slug, a);
      }
    }
    rows = Array.from(bySlug.values());
  }

  if (state.phase !== 'all') {
    rows = rows.filter(a => String(a.phase || '') === state.phase);
  }
  if (state.agent !== 'all') {
    rows = rows.filter(a => a.agent_slug === state.agent);
  }
  if (state.status !== 'all') {
    rows = rows.filter(a => {
      if (state.status === 'locked') return !!a.locked;
      return a.status === state.status;
    });
  }

  // Default sort: created_at desc.
  rows.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  return rows;
}

/* ─── Filter bar ──────────────────────────────────────────── */
function buildFilterBar({ artifacts, state, onChange }) {
  const presentAgentSlugs = uniqueAgentSlugs(artifacts);

  function pill(label, active, onClick, disabled = false) {
    const cls = ['qb-archive-pill'];
    if (active)   cls.push('is-active');
    if (disabled) cls.push('is-disabled');
    const node = el('button', {
      type: 'button',
      class: cls.join(' '),
      'aria-pressed': active ? 'true' : 'false',
      disabled,
    }, label);
    if (!disabled) node.addEventListener('click', onClick);
    return node;
  }

  // Phase group
  const phaseGroup = el('div', { class: 'qb-archive-filter-group', dataset: { filter: 'phase' } }, [
    el('span', { class: 'qb-archive-filter-group__label' }, 'Phase'),
    el('div',  { class: 'qb-archive-filter-group__pills' }, [
      pill('All',           state.phase === 'all', () => onChange({ phase: 'all' })),
      ...['01','02','03','04','05'].map(p => pill(
        `${p} ${PHASE_LABELS[p]}`,
        state.phase === p,
        () => onChange({ phase: p }),
        !PHASE_ENABLED.has(p),
      )),
    ]),
  ]);

  // Agent group — only agents that produced ≥1 artifact for this user.
  const agentPills = presentAgentSlugs.length ? [
    pill('All', state.agent === 'all', () => onChange({ agent: 'all' })),
    ...presentAgentSlugs.map(slug => pill(
      humanizeAgentSlug(slug),
      state.agent === slug,
      () => onChange({ agent: slug }),
    )),
  ] : [pill('All', true, () => {}, true)];

  const agentGroup = el('div', { class: 'qb-archive-filter-group', dataset: { filter: 'agent' } }, [
    el('span', { class: 'qb-archive-filter-group__label' }, 'Agent'),
    el('div',  { class: 'qb-archive-filter-group__pills' }, agentPills),
  ]);

  // Status group
  const statusOptions = [
    ['all',        'All'],
    ['delivered',  'Delivered'],
    ['generating', 'Generating'],
    ['failed',     'Failed'],
    ['locked',     'Locked'],
  ];
  const statusGroup = el('div', { class: 'qb-archive-filter-group', dataset: { filter: 'status' } }, [
    el('span', { class: 'qb-archive-filter-group__label' }, 'Status'),
    el('div',  { class: 'qb-archive-filter-group__pills' },
      statusOptions.map(([v, label]) =>
        pill(label, state.status === v, () => onChange({ status: v })))),
  ]);

  // Reset
  const anyActive = state.phase !== 'all' || state.agent !== 'all' || state.status !== 'all';
  const reset = anyActive
    ? el('button', {
        type: 'button',
        class: 'qb-archive-filter-reset',
        on: { click: () => onChange({ phase: 'all', agent: 'all', status: 'all' }) },
      }, 'Clear filters')
    : null;

  return el('div', { class: 'qb-archive-filter-bar' }, [phaseGroup, agentGroup, statusGroup, reset]);
}

/* ─── Version toggle ──────────────────────────────────────── */
function buildVersionToggle({ state, onChange, totalCount, filteredCount }) {
  function btn(label, value, active) {
    const cls = ['qb-archive-toggle-btn'];
    if (active) cls.push('is-active');
    return el('button', {
      type: 'button',
      class: cls.join(' '),
      on: { click: () => onChange({ versions: value }) },
    }, label);
  }
  return el('div', { class: 'qb-archive-toolbar' }, [
    el('div', { class: 'qb-archive-counts' },
      `${filteredCount} of ${totalCount} artifacts`),
    el('div', { class: 'qb-archive-toggle' }, [
      btn('Latest versions', 'latest', state.versions === 'latest'),
      btn('Show all',        'all',    state.versions === 'all'),
    ]),
  ]);
}

/* ─── Page header ─────────────────────────────────────────── */
function buildHeader({ totalCount, lockedCount }) {
  return el('header', { class: 'qb-archive-header' }, [
    el('div', { class: 'qb-archive-header__eyebrow' }, 'Brand Archive'),
    el('h1',  { class: 'qb-archive-header__title' }, 'Every artifact produced for your brand.'),
    el('p',   { class: 'qb-archive-header__subtitle' },
      'Locked artifacts show their shape. Upgrade to read the body.'),
    el('div', { class: 'qb-archive-header__counts' },
      `${totalCount} artifact${totalCount === 1 ? '' : 's'} · ${lockedCount} locked`),
  ]);
}

/* ─── Row click handlers ──────────────────────────────────── */
function openPaywallFor(row) {
  const overlay = createPaywallModal({
    reason: 'artifact',
    eyebrow: 'Locked',
    headline: 'Unlock the rest of your foundation.',
    body: `${humanizeAgentSlug(row.agent_slug)} and the other paid synthesis artifacts unlock with Starter.`,
    price: 'Starter, $97 / month. Cancel anytime.',
    primaryCta: 'Upgrade to Starter',
    secondaryCta: 'Not now',
    onPrimary:   () => { window.location.href = `/paywall?reason=artifact&agent=${encodeURIComponent(row.agent_slug || '')}`; },
    onSecondary: () => { overlay.remove(); },
  });
  document.body.appendChild(overlay);
}

function rowHrefAndHandler(row) {
  // Generating / queued rows: no navigation. Failed and delivered: navigate
  // to /artifact?id=<id>. Locked: paywall.
  if (row.locked) {
    return {
      href: undefined,
      onClick: (ev) => { ev.preventDefault(); openPaywallFor(row); },
    };
  }
  if (row.status === 'queued' || row.status === 'generating') {
    return {
      href: undefined,
      onClick: (ev) => { ev.preventDefault(); /* no-op */ },
    };
  }
  return {
    href: `/artifact?id=${encodeURIComponent(row.id)}`,
    onClick: undefined,
  };
}

/* ─── List ────────────────────────────────────────────────── */
function buildList(rows) {
  if (!rows.length) {
    return el('div', { class: 'qb-archive-empty' }, [
      el('p', {}, 'No artifacts match these filters.'),
    ]);
  }
  const list = el('div', { class: 'qb-archive-list' });
  for (const row of rows) {
    const { href, onClick } = rowHrefAndHandler(row);
    const node = createArtifactRow({
      id:          row.id,
      title:       resolveTitle(row),
      phase:       row.phase || null,
      agentSlug:   row.agent_slug || '',
      generatedAt: row.created_at,
      status:      row.status,
      locked:      !!row.locked,
      href,
      onClick,
    });
    // Mark generating / queued rows non-interactive at the CSS layer too.
    if (row.status === 'queued' || row.status === 'generating') {
      node.classList.add('is-pending');
      node.setAttribute('aria-disabled', 'true');
    }
    list.appendChild(node);
  }
  return list;
}

/* ─── Public: renderArchive ───────────────────────────────── */
export function renderArchive(container, artifacts, opts = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new Error('renderArchive: container must be an HTMLElement');
  }
  const all = Array.isArray(artifacts) ? artifacts : [];
  let state = { ...readHashState(), ...(opts.initialState || {}) };

  function render() {
    clear(container);

    const totalCount = all.length;
    const lockedCount = all.filter(a => a.locked).length;
    const filtered = applyFilters(all, state);
    const filteredCount = filtered.length;

    const article = el('article', { class: 'qb-archive' }, [
      buildHeader({ totalCount, lockedCount }),
      buildFilterBar({
        artifacts: all,
        state,
        onChange: (patch) => { state = { ...state, ...patch }; writeHashState(state); render(); },
      }),
      buildVersionToggle({
        state,
        totalCount, filteredCount,
        onChange: (patch) => { state = { ...state, ...patch }; writeHashState(state); render(); },
      }),
      buildList(filtered),
    ]);
    container.appendChild(article);
  }

  render();

  // Re-render on back/forward (hash changes triggered by other tabs etc.).
  if (!container.__qbHashHooked) {
    container.__qbHashHooked = true;
    window.addEventListener('hashchange', () => {
      const next = readHashState();
      if (
        next.phase !== state.phase || next.agent !== state.agent ||
        next.status !== state.status || next.versions !== state.versions
      ) {
        state = next;
        render();
      }
    });
  }
}

/* ─── Public: renderArchiveLoading ────────────────────────── */
export function renderArchiveLoading(container) {
  clear(container);
  const article = el('article', { class: 'qb-archive is-loading' }, [
    el('header', { class: 'qb-archive-header' }, [
      el('div', { class: 'qb-artifact-skeleton__eyebrow' }),
      el('div', { class: 'qb-artifact-skeleton__title' }),
      el('div', { class: 'qb-artifact-skeleton__title qb-artifact-skeleton__title--short' }),
    ]),
    el('div', { class: 'qb-archive-list is-skeleton' },
      [0,1,2,3,4].map(() => el('div', { class: 'qb-archive-skel-row' }, [
        el('div', { class: 'qb-artifact-skeleton__heading' }),
        el('div', { class: 'qb-artifact-skeleton__line qb-artifact-skeleton__line--short' }),
      ]))),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderArchiveError ──────────────────────────── */
export function renderArchiveError(container, error) {
  clear(container);
  const msg = (error && error.message) || String(error || 'Unknown error');
  const article = el('article', { class: 'qb-archive is-error' }, [
    el('header', { class: 'qb-archive-header' }, [
      el('div', { class: 'qb-archive-header__eyebrow' }, 'Lost'),
      el('h1',  { class: 'qb-archive-header__title' }, 'Your archive could not load.'),
    ]),
    el('div', { class: 'qb-archive-empty' }, [
      el('p', {}, msg),
      el('button', {
        class: 'qb-button is-primary',
        type: 'button',
        on: { click: () => window.location.reload() },
      }, [el('span', { class: 'qb-button_content' }, 'Try again')]),
    ]),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderArchiveEmpty ──────────────────────────── */
export function renderArchiveEmpty(container, opts = {}) {
  clear(container);
  const lockedAt = opts.foundationLockedAt || null;

  let eyebrow, headline, body, ctaLabel, ctaHref;
  if (!lockedAt) {
    // No lock yet → normal cold-start empty state.
    eyebrow = 'Empty';
    headline = 'Your archive will fill as your foundation is built.';
    body = 'Start with the Brand Soul Map. Each completed exercise produces a synthesis artifact you can read here.';
    ctaLabel = 'Go to Foundation';
    ctaHref  = '/foundation';
  } else {
    // Locked but no artifacts → unusual state.
    eyebrow = 'Stuck';
    headline = 'Your foundation is locked but no artifacts have arrived.';
    body = 'Something went wrong during synthesis. The retry surface on Foundation can re-dispatch the agents.';
    ctaLabel = 'Open Foundation';
    ctaHref  = '/foundation';
  }

  const article = el('article', { class: 'qb-archive is-empty' }, [
    el('header', { class: 'qb-archive-header' }, [
      el('div', { class: 'qb-archive-header__eyebrow' }, 'Brand Archive'),
      el('h1',  { class: 'qb-archive-header__title' }, 'Every artifact produced for your brand.'),
    ]),
    el('div', { class: 'qb-archive-empty' }, [
      el('div', { class: 'qb-archive-empty__eyebrow' }, eyebrow),
      el('h2',  { class: 'qb-archive-empty__headline' }, headline),
      el('p',   { class: 'qb-archive-empty__body' }, body),
      el('a',   { class: 'qb-button is-primary', href: ctaHref },
        [el('span', { class: 'qb-button_content' }, ctaLabel)]),
    ]),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Tree-view formatters (step 11) ────────────────────────── */
// Format the lock_at ISO timestamp as "Locked 2026-05-15 · N agents".
// Falls back to "Locked recently" when lock_at is null (rare; means the
// lock dispatch row couldn't be located but the chain has artifacts).
function chainHeaderLabel(chain) {
  const ts = chain?.lock_at ? new Date(chain.lock_at) : null;
  const dateStr = ts && !Number.isNaN(ts.getTime())
    ? `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}`
    : null;
  const lockPart = dateStr ? `Locked ${dateStr}` : 'Locked recently';
  const agentsPart = `${chain.agents_count || 0} agent${chain.agents_count === 1 ? '' : 's'}`;
  return `${lockPart} · ${agentsPart}`;
}

// Recursive · render a chain artifact node + any parent_artifact_id-linked
// children indented underneath. Uses createArtifactRow for consistency
// with the flat list; children get a left-indent class.
function buildChainArtifactNode(node, agentSlug, depth = 0) {
  const row = {
    id: node.id,
    title: typeof node.title === 'string' && node.title ? node.title : humanizeAgentSlug(agentSlug),
    agent_slug: agentSlug,
    phase: '01',
    status: node.status,
    version: node.version,
    created_at: node.delivered_at,
    locked: !!node.locked,
  };
  const { href, onClick } = rowHrefAndHandler(row);
  const rowNode = createArtifactRow({
    id: row.id,
    title: row.title,
    phase: row.phase,
    agentSlug: row.agent_slug,
    generatedAt: row.created_at,
    status: row.status,
    locked: row.locked,
    href,
    onClick,
  });
  if (row.status === 'queued' || row.status === 'generating') {
    rowNode.classList.add('is-pending');
    rowNode.setAttribute('aria-disabled', 'true');
  }
  if (depth > 0) {
    rowNode.classList.add('qb-archive-chain-child');
    rowNode.style.marginLeft = `${depth * 24}px`;
  }
  const wrap = el('div', { class: 'qb-archive-chain-node-wrap' }, [rowNode]);
  for (const child of (node.children || [])) {
    wrap.appendChild(buildChainArtifactNode(child, agentSlug, depth + 1));
  }
  return wrap;
}

function buildChainCard(chain) {
  const headerLabel = chainHeaderLabel(chain);
  const header = el('header', { class: 'qb-archive-chain__header' }, [
    el('span', { class: 'qb-tag is-soft' }, [
      el('span', { class: 'qb-tag_content' }, 'Chain'),
    ]),
    el('h2', { class: 'qb-archive-chain__title' }, headerLabel),
  ]);
  const body = el('div', { class: 'qb-archive-chain__body' });
  for (const node of (chain.nodes || [])) {
    for (const art of (node.artifacts || [])) {
      body.appendChild(buildChainArtifactNode(art, node.agent_slug, 0));
    }
  }
  return el('article', { class: 'qb-archive-chain qb-card' }, [header, body]);
}

function buildEarlierWorkSection(legacy) {
  if (!Array.isArray(legacy) || legacy.length === 0) return null;
  const list = el('div', { class: 'qb-archive-list' });
  for (const item of legacy) {
    const row = {
      id: item.id,
      title: typeof item.title === 'string' && item.title ? item.title : humanizeAgentSlug(item.artifact_type),
      agent_slug: item.artifact_type,
      phase: null,
      status: item.status,
      version: item.version,
      created_at: item.created_at,
      locked: !!item.locked,
    };
    const { href, onClick } = rowHrefAndHandler(row);
    const node = createArtifactRow({
      id: row.id,
      title: row.title,
      phase: row.phase,
      agentSlug: row.agent_slug,
      generatedAt: row.created_at,
      status: row.status,
      locked: row.locked,
      href,
      onClick,
    });
    if (row.status === 'queued' || row.status === 'generating') {
      node.classList.add('is-pending');
      node.setAttribute('aria-disabled', 'true');
    }
    list.appendChild(node);
  }
  return el('section', { class: 'qb-archive-legacy' }, [
    el('h3', { class: 'qb-archive-legacy__title' }, 'Earlier work'),
    el('p',  { class: 'qb-archive-legacy__subhead' },
      'Artifacts from before chain history started tracking.'),
    list,
  ]);
}

/* ─── Public: renderArchiveTree (step 11) ─────────────────────── */
// Renders the chain-grouped tree shape returned by /api/artifacts?mode=chains.
// Replaces buildList for the tree-only render per Nizzar adj #2.
//
// opts: { tier, foundationLockedAt, session }
//   - session is used for the optional Realtime hook + refetch
export function renderArchiveTree(container, response, opts = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new Error('renderArchiveTree: container must be an HTMLElement');
  }
  const session = opts.session || null;
  let live = response || { chains: [], legacy: [] };
  let refetchInFlight = false;

  function totalArtifactCount(resp) {
    const chainTotal = (resp.chains || []).reduce((acc, ch) => {
      let n = 0;
      for (const node of (ch.nodes || [])) {
        for (const a of (node.artifacts || [])) {
          n += 1;
          const stack = [...(a.children || [])];
          while (stack.length) { n += 1; const c = stack.shift(); stack.push(...(c.children || [])); }
        }
      }
      return acc + n;
    }, 0);
    return chainTotal + (resp.legacy || []).length;
  }
  function lockedArtifactCount(resp) {
    let n = 0;
    for (const ch of (resp.chains || [])) {
      for (const node of (ch.nodes || [])) {
        for (const a of (node.artifacts || [])) {
          if (a.locked) n += 1;
          const stack = [...(a.children || [])];
          while (stack.length) { const c = stack.shift(); if (c.locked) n += 1; stack.push(...(c.children || [])); }
        }
      }
    }
    for (const l of (resp.legacy || [])) if (l.locked) n += 1;
    return n;
  }

  function render() {
    clear(container);
    const totalCount = totalArtifactCount(live);
    const lockedCount = lockedArtifactCount(live);
    const article = el('article', { class: 'qb-archive' }, [
      buildHeader({ totalCount, lockedCount }),
    ]);
    for (const chain of (live.chains || [])) {
      article.appendChild(buildChainCard(chain));
    }
    const earlierWork = buildEarlierWorkSection(live.legacy || []);
    if (earlierWork) article.appendChild(earlierWork);
    container.appendChild(article);
  }

  async function refetchAndRepaint() {
    if (!session?.token || refetchInFlight) return;
    refetchInFlight = true;
    try {
      const r = await fetch('/api/artifacts?mode=chains', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!r.ok) return;
      const fresh = await r.json().catch(() => null);
      if (!fresh || !fresh.ok) return;
      live = fresh;
      render();
    } catch {
      // Silent · next event or poll re-tries
    } finally {
      refetchInFlight = false;
    }
  }

  // Step 11 §3.3 · Realtime subscription via shared qb-realtime-manager.
  // Inherits the step 9C canonical pattern: on chain_ready / dispatch_failed
  // notification, refetch + repaint. Poll-fallback at 30s when state=poll.
  const mgr = (typeof window !== 'undefined') ? window.QBRealtimeManager : null;
  let pollHandle = null;
  if (mgr && session?.token) {
    mgr.start({ authToken: session.token });
    mgr.onNotification(() => refetchAndRepaint());
    mgr.onState(s => {
      if (s === 'realtime') {
        if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
      } else if (s === 'poll') {
        if (pollHandle === null) pollHandle = setInterval(refetchAndRepaint, 30_000);
      }
    });
  }

  render();
}

const ArchiveRenderer = {
  renderArchive, renderArchiveTree, renderArchiveLoading, renderArchiveError, renderArchiveEmpty,
  humanizeAgentSlug,
};
export default ArchiveRenderer;
