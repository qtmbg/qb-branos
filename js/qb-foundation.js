/* QB BrandOS — Foundation page renderer
   Last updated: 2026-05-14
   Spec reference: CHAPTER_01_SPEC.md §2.3 (/foundation route),
                   §3.2 (qb-phase-card), §3.3 (qb-exercise-card),
                   §3.5 (qb-lock-foundation-cta), §5.2 (lock-foundation),
                   §8 (paywall), §9 (states), §12 (design system).

   The post-login landing page. Routes the user to one of four
   primary states based on QBP + artifacts + foundation_locked_at:
     cold        — nothing complete, no lock
     in-progress — some exercises complete, no lock
     lock-ready  — all free-tier exercises complete, no lock yet
     locked      — foundation_locked_at present (3 sub-states)

   Lock CTA dispatches POST /api/foundation/lock, polls artifacts
   every 10 s until all settle. Polling pauses when the tab hides.

   Exports:
     computeFoundationState({ qbp, artifacts, foundationLockedAt, tier })
     renderFoundation(container, state, opts)
     renderFoundationLoading(container)
     renderFoundationError(container, error)
     startArtifactPolling(opts) -> stop function
*/

import {
  createExerciseCard, createPhaseCard, createArtifactRow, createTierBadge,
  createPaywallModal, createLockFoundationCta,
} from '/js/qb-components.js';

const PAID_TIERS = new Set(['starter','pro','agency','atelier']);

const PHASE_01_EXERCISES = [
  {
    slug: 'archetype-compass',
    name: 'Archetype Compass',
    description: 'Name the operating archetype that runs the brand.',
    href: '/archetype-compass.html',
    completeKey: (q) => Boolean(q?.archetypeCompassComplete) || Boolean(q?.archetypePrimary) || Boolean(q?.archetype),
    progressKey: (q) => Boolean(q?.archetypeRawAnswers),
    tierLocked: false,
  },
  {
    slug: 'brand-soul-map',
    name: 'Brand Soul Map',
    description: 'Essence, paradox, manifesto, binding commitments.',
    href: '/brand-soul-map.html',
    completeKey: (q) => Boolean(q?.brandEssence) && Boolean(q?.manifesto),
    progressKey: (q) => Boolean(q?.brandEssence) || Boolean(q?.manifesto) || Boolean(q?.paradox) || Boolean(q?.antiBrand),
    tierLocked: false,
  },
  {
    slug: 'sensescape',
    name: 'Sensescape',
    description: 'How the brand sounds, looks, feels, smells, tastes.',
    href: '/sensescape.html',
    completeKey: (q) => Boolean(q?.sensescapeCompletedAt),
    progressKey: (q) => Boolean(q?.colorTerritory) || Boolean(q?.soundSignature) || Boolean(q?.brandObject) || Boolean(q?.signatureGesture),
    tierLocked: false,
  },
  {
    slug: 'visual-dna',
    name: 'Visual DNA',
    description: 'Image keep / discard signal for palette + type direction.',
    href: '/visual-dna.html',
    completeKey: (q) => Boolean(q?.visualDnaCompletedAt),
    progressKey: (q) => Number.isFinite(Number(q?.visualDnaKeepCount)),
    tierLocked: true,
  },
  {
    slug: 'war-table',
    name: 'War Table',
    description: 'Strategic position, audience signals, top initiatives.',
    href: '/war-table.html',
    completeKey: (q) => Boolean(q?.warTableCompletedAt),
    progressKey: (q) => Boolean(q?.warTablePosture) || Boolean(q?.warTableTopInitiatives) || Boolean(q?.audienceFears),
    tierLocked: true,
  },
];

/* The four free-tier exercises required to lock the foundation. */
const REQUIRED_FREE_SLUGS = new Set(['archetype-compass','brand-soul-map','sensescape']);

const PHASE_ROADMAP = [
  { phase: '01', name: 'Discovery',     comingSoon: false },
  { phase: '02', name: 'Brand Creation', comingSoon: true },
  { phase: '03', name: 'Content',       comingSoon: true },
  { phase: '04', name: 'Execution',     comingSoon: true },
  { phase: '05', name: 'Intelligence',  comingSoon: true },
];

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

/* ─── Public: computeFoundationState ──────────────────────── */
export function computeFoundationState({ qbp, artifacts, foundationLockedAt, tier }) {
  const q = qbp || {};
  const t = String(tier || 'free').toLowerCase();
  const isPaid = PAID_TIERS.has(t);

  // Per-exercise state
  const exercises = PHASE_01_EXERCISES.map(ex => {
    const isLocked = ex.tierLocked && !isPaid;
    const isComplete = ex.completeKey(q);
    const isInProgress = !isComplete && ex.progressKey(q);
    let state = 'not-started';
    if (isComplete)        state = 'complete';
    else if (isInProgress) state = 'in-progress';
    return { ...ex, state, locked: isLocked };
  });

  const requiredExercises = exercises.filter(e => REQUIRED_FREE_SLUGS.has(e.slug));
  const allRequiredComplete = requiredExercises.every(e => e.state === 'complete');
  const anyComplete = exercises.some(e => e.state === 'complete');

  // Artifact state
  const allArtifacts = Array.isArray(artifacts) ? artifacts : [];
  // Latest delivered / failed / generating per agent_slug (newest version per slug).
  const byAgent = new Map();
  for (const a of allArtifacts) {
    const cur = byAgent.get(a.agent_slug);
    if (!cur || (Number(a.version) || 0) > (Number(cur.version) || 0)) {
      byAgent.set(a.agent_slug, a);
    }
  }
  const latestArtifacts = Array.from(byAgent.values());
  const inFlight = latestArtifacts.some(a => a.status === 'queued' || a.status === 'generating');
  const allSettled = latestArtifacts.length > 0 && !inFlight;

  // Bucket
  let bucket;
  if (foundationLockedAt)                              bucket = 'locked';
  else if (!anyComplete)                                bucket = 'cold';
  else if (allRequiredComplete)                         bucket = 'lock-ready';
  else                                                   bucket = 'in-progress';

  return {
    qbp: q,
    artifacts: allArtifacts,
    latestArtifacts,
    byAgent,
    foundationLockedAt,
    tier: t,
    isPaid,
    exercises,
    requiredExercises,
    allRequiredComplete,
    anyComplete,
    inFlight,
    allSettled,
    bucket,
    brandName: typeof q.brandName === 'string' && q.brandName.trim()
      ? q.brandName.trim()
      : 'Your Brand',
  };
}

/* ─── Page chrome ─────────────────────────────────────────── */
function buildNav({ tier, activeKey = 'foundation' }) {
  const items = [
    { key: 'foundation', label: 'Foundation', href: '/foundation' },
    { key: 'archive',    label: 'Archive',    href: '/archive' },
    { key: 'qbp',        label: 'QBP',        href: '/qbp' },
    { key: 'account',    label: 'Account',    href: '/account' },
  ];
  const links = el('div', { class: 'qb-nav__links' },
    items.map(it => el('a', {
      class: `qb-nav__link ${it.key === activeKey ? 'is-active' : ''}`.trim(),
      href: it.href,
    }, it.label)));
  links.appendChild(createTierBadge({ tier }));

  return el('header', { class: 'qb-nav qb-foundation-nav' }, [
    el('a', { class: 'qb-nav__brand', href: '/foundation' }, [
      el('span', { class: 'qb-foundation-nav__wordmark' }, 'quantum branding'),
    ]),
    links,
    el('button', {
      class: 'qb-nav__hamburger',
      type: 'button',
      'aria-label': 'Open menu',
      on: { click: () => links.classList.toggle('is-open') },
    }, [el('span', { class: 'qb-nav__hamburger-bar' })]),
  ]);
}

function buildBanner(text, modifier = '') {
  return el('div', { class: `qb-foundation-banner ${modifier}`.trim() }, [
    el('p', { class: 'qb-foundation-banner__text' }, text),
  ]);
}

/* ─── Phase roadmap ──────────────────────────────────────── */
function buildPhaseRoadmap(state) {
  const phase01State =
    state.bucket === 'locked' ? 'complete'
    : state.allRequiredComplete ? 'complete'
    : state.anyComplete ? 'available'
    : 'available';

  const cards = PHASE_ROADMAP.map(p => {
    if (p.phase === '01') {
      const count = state.requiredExercises.filter(e => e.state === 'complete').length;
      return createPhaseCard({
        phase: '01',
        name: 'Discovery',
        state: phase01State,
        count,
        total: state.requiredExercises.length,
        ctaLabel: phase01State === 'complete' ? 'View artifacts' : 'Continue',
        ctaHref: phase01State === 'complete' ? '/archive' : (state.exercises.find(e => e.state !== 'complete' && !e.locked)?.href || '/foundation'),
      });
    }
    return createPhaseCard({
      phase: p.phase,
      name: p.name,
      state: 'locked',
      lockReason: 'Coming in a future chapter',
      ctaLabel: 'Coming soon',
      ctaHref: '#',
    });
  });

  return el('section', { class: 'qb-foundation-roadmap' }, [
    el('div', { class: 'qb-foundation-roadmap__eyebrow' }, 'Your journey'),
    el('div', { class: 'qb-foundation-roadmap__grid' }, cards),
  ]);
}

/* ─── Exercise list ──────────────────────────────────────── */
function buildExerciseList(state, opts) {
  const cards = state.exercises.map(ex => createExerciseCard({
    slug: ex.slug,
    name: ex.name,
    description: ex.description,
    state: ex.state,
    locked: ex.locked,
    ctaLabel: ex.locked ? 'Upgrade'
      : ex.state === 'complete'     ? 'Review'
      : ex.state === 'in-progress'  ? 'Continue'
      : 'Begin',
    ctaHref: ex.locked ? null : ex.href,
    onCta: ex.locked ? () => openPaywall(ex.slug, opts) : null,
  }));
  return el('section', { class: 'qb-foundation-exercises' },
    [el('div', { class: 'qb-foundation-exercises__grid' }, cards)]);
}

/* ─── Paywall ────────────────────────────────────────────── */
function openPaywall(reasonSlug, opts) {
  const overlay = createPaywallModal({
    reason: reasonSlug || 'artifact',
    eyebrow: 'Locked',
    headline: 'Unlock the rest of your foundation.',
    body: 'Visual DNA, War Table, three remaining synthesis artifacts, and your QBP export — all on Starter.',
    price: 'Starter, $97 / month. Cancel anytime.',
    primaryCta: 'Upgrade to Starter',
    secondaryCta: 'Not now',
    onPrimary: () => (opts.onUpgradeClick ? opts.onUpgradeClick() : (window.location.href = `/paywall?reason=${reasonSlug || 'artifact'}`)),
    onSecondary: () => overlay.remove(),
  });
  document.body.appendChild(overlay);
}

/* ─── Cold-start state ───────────────────────────────────── */
function renderCold(state, opts) {
  const hero = el('section', { class: 'qb-foundation-hero is-cold' }, [
    el('div', { class: 'qb-foundation-hero__copy' }, [
      el('div', { class: 'qb-foundation-hero__eyebrow' }, 'Begin'),
      el('h1',  { class: 'qb-foundation-hero__title' }, 'Your foundation starts with one question.'),
      el('p',   { class: 'qb-foundation-hero__body' },
        'Identity comes before tactics. Start with the Brand Soul Map, or take the Signal Scan if you want a diagnostic first.'),
      el('div', { class: 'qb-foundation-hero__actions' }, [
        el('a', { class: 'qb-button is-primary', href: '/brand-soul-map.html' },
          [el('span', { class: 'qb-button_content' }, 'Begin the Brand Soul Map')]),
        el('a', { class: 'qb-button', href: '/signal-scan.html' },
          [el('span', { class: 'qb-button_content' }, 'Take the Signal Scan')]),
      ]),
    ]),
    el('figure', { class: 'qb-foundation-hero__illustration qb-illus-card' }, [
      el('img', {
        src: '/img/illus/blank-slate.webp',
        alt: '',
        loading: 'eager',
        decoding: 'async',
      }),
    ]),
  ]);
  return [hero, buildPhaseRoadmap(state)];
}

/* ─── In-progress state ──────────────────────────────────── */
function renderInProgress(state, opts) {
  const completeCount = state.requiredExercises.filter(e => e.state === 'complete').length;
  const totalCount    = state.requiredExercises.length;
  const hero = el('section', { class: 'qb-foundation-hero is-in-progress' }, [
    el('div', { class: 'qb-foundation-hero__copy' }, [
      el('div', { class: 'qb-foundation-hero__eyebrow' }, 'Phase 01 · Discovery'),
      el('h1',  { class: 'qb-foundation-hero__title' }, 'Continue your foundation.'),
      el('p',   { class: 'qb-foundation-hero__body' },
        'Complete the Phase 01 exercises to lock your foundation. After lock, your synthesis artifacts are produced.'),
      buildProgressBar(completeCount, totalCount),
    ]),
  ]);
  return [hero, buildExerciseList(state, opts), buildPhaseRoadmap(state)];
}

function buildProgressBar(complete, total) {
  const segs = [];
  for (let i = 0; i < total; i++) {
    segs.push(el('span', {
      class: 'qb-foundation-progress__seg' + (i < complete ? ' is-filled' : ''),
    }));
  }
  return el('div', { class: 'qb-foundation-progress' }, [
    el('div', { class: 'qb-foundation-progress__bar' }, segs),
    el('div', { class: 'qb-foundation-progress__label' },
      `${complete} of ${total} exercises complete`),
  ]);
}

/* ─── Lock-ready state ───────────────────────────────────── */
function renderLockReady(state, opts) {
  const hero = el('section', { class: 'qb-foundation-hero is-lock-ready' }, [
    el('div', { class: 'qb-foundation-hero__copy' }, [
      el('div', { class: 'qb-foundation-hero__eyebrow' }, 'Ready'),
      el('h1',  { class: 'qb-foundation-hero__title' }, 'Your foundation is ready to lock.'),
      el('p',   { class: 'qb-foundation-hero__body' },
        'Once locked, your Phase 01 answers become immutable. Your synthesis artifacts will be produced and delivered to your inbox within minutes.'),
      el('div', { class: 'qb-foundation-hero__actions' }, [
        createLockFoundationCta({
          enabled: true,
          label: 'Lock my foundation',
          onClick: () => triggerLockConfirmation(opts),
        }),
      ]),
    ]),
  ]);
  return [hero, buildExerciseList(state, opts), buildPhaseRoadmap(state)];
}

function triggerLockConfirmation(opts) {
  const overlay = createPaywallModal({
    reason: 'lock_confirm',
    eyebrow: 'Confirm',
    headline: 'Lock your foundation?',
    body: 'Once you lock your foundation, your Phase 01 answers become immutable. Your synthesis artifacts will be produced and emailed to you within minutes.',
    price: '',
    primaryCta: 'Yes, lock my foundation',
    secondaryCta: 'Not yet',
    onPrimary: () => { overlay.remove(); if (opts.onLockClick) opts.onLockClick(); },
    onSecondary: () => { overlay.remove(); },
  });
  // Hide the empty price slot on the confirm variant.
  const priceNode = overlay.querySelector('.qb-paywall-modal__price');
  if (priceNode) priceNode.remove();
  document.body.appendChild(overlay);
}

/* ─── Locked state — sub-states ──────────────────────────── */
function buildQueueRow(agentSlug, row) {
  const statusLabel =
    !row                                  ? 'Queued'
    : row.status === 'queued'              ? 'Queued'
    : row.status === 'generating'          ? 'Generating'
    : row.status === 'delivered'           ? 'Delivered'
    : row.status === 'failed'              ? 'Failed'
    :                                        row.status;
  const statusClass = `is-${(row?.status || 'queued')}`;

  return el('div', { class: 'qb-foundation-queue__row', dataset: { agent: agentSlug } }, [
    el('div', { class: 'qb-foundation-queue__agent' }, agentSlug.replace(/_/g, ' ')),
    el('span', { class: `qb-status-pill ${statusClass}` }, [
      el('span', { class: 'qb-status-pill__dot' }),
      el('span', {}, statusLabel),
    ]),
  ]);
}

function renderLocked(state, opts) {
  if (state.inFlight) {
    // 12.6.A — Generating
    const queue = el('div', { class: 'qb-foundation-queue' },
      ['soul_map_synthesizer','sensescape_synthesizer','visual_dna_synthesizer','war_table_synthesizer']
        .map(slug => buildQueueRow(slug, state.byAgent.get(slug))));
    const hero = el('section', { class: 'qb-foundation-hero is-producing' }, [
      el('div', { class: 'qb-foundation-hero__copy' }, [
        el('div', { class: 'qb-foundation-hero__eyebrow' }, 'Producing'),
        el('h1',  { class: 'qb-foundation-hero__title' }, 'Your artifacts are being prepared.'),
        el('p',   { class: 'qb-foundation-hero__body' },
          `We will email you when each one is ready. ${state.foundationLockedAt ? `Foundation locked at ${formatDateLight(state.foundationLockedAt)}.` : ''}`),
        queue,
      ]),
    ]);
    return [hero, buildPhaseRoadmap(state)];
  }

  // 12.6.B / 12.6.C — All delivered
  const isPaid = state.isPaid;
  const eyebrow = 'Foundation locked';
  const headline = isPaid ? 'Your foundation is built.' : 'Your Soul Map is ready.';
  const body = isPaid
    ? 'Read each artifact. Your QBP is your living document.'
    : 'The rest of your foundation is locked. Unlock with Starter to read.';

  const hero = el('section', { class: 'qb-foundation-hero is-delivered' }, [
    el('div', { class: 'qb-foundation-hero__copy' }, [
      el('div', { class: 'qb-foundation-hero__eyebrow' }, eyebrow),
      el('h1',  { class: 'qb-foundation-hero__title' }, headline),
      el('p',   { class: 'qb-foundation-hero__body' }, body),
    ]),
  ]);

  const tiles = el('section', { class: 'qb-foundation-tiles' }, [
    el('div', { class: 'qb-foundation-tiles__grid' },
      ['soul_map_synthesizer','sensescape_synthesizer','visual_dna_synthesizer','war_table_synthesizer']
        .map(slug => {
          const row = state.byAgent.get(slug);
          if (!row) return null;
          return createArtifactRow({
            id: row.id,
            title: row.title,
            phase: row.phase,
            agentSlug: row.agent_slug,
            generatedAt: row.created_at,
            status: row.status,
            locked: !!row.locked,
            href: row.locked ? null : `/artifact?id=${encodeURIComponent(row.id)}`,
            onClick: row.locked ? (e) => { e.preventDefault(); openPaywall('artifact', opts); } : null,
          });
        })),
  ]);

  const banner = isPaid
    ? el('section', { class: 'qb-foundation-next' }, [
        el('p', { class: 'qb-foundation-next__text' },
          'Phase 02 unlocks in a future chapter. Your QBP keeps accumulating as you complete the Visual DNA and War Table exercises.'),
      ])
    : el('section', { class: 'qb-foundation-upgrade-banner' }, [
        el('div', { class: 'qb-foundation-upgrade-banner__copy' }, [
          el('h2', { class: 'qb-foundation-upgrade-banner__title' },
            'Unlock the rest of your foundation.'),
          el('p',  { class: 'qb-foundation-upgrade-banner__body' },
            'Starter unlocks the Sensescape, Visual DNA, and War Table artifacts, plus the Visual DNA and War Table exercises.'),
        ]),
        el('div', { class: 'qb-foundation-upgrade-banner__cta' }, [
          el('button', {
            type: 'button',
            class: 'qb-button is-primary is-lg',
            on: { click: () => opts.onUpgradeClick && opts.onUpgradeClick() },
          }, [el('span', { class: 'qb-button_content' }, 'Upgrade to Starter')]),
          el('p', { class: 'qb-foundation-upgrade-banner__price' }, '$97 / month. Cancel anytime.'),
        ]),
      ]);

  return [hero, tiles, banner, buildPhaseRoadmap(state)];
}

function formatDateLight(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (_) { return ''; }
}

/* ─── Public: renderFoundation ───────────────────────────── */
export function renderFoundation(container, state, opts = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new Error('renderFoundation: container must be an HTMLElement');
  }
  clear(container);

  let body;
  if      (state.bucket === 'cold')        body = renderCold(state, opts);
  else if (state.bucket === 'in-progress') body = renderInProgress(state, opts);
  else if (state.bucket === 'lock-ready')  body = renderLockReady(state, opts);
  else if (state.bucket === 'locked')      body = renderLocked(state, opts);

  const banner = opts.banner
    ? buildBanner(opts.banner.text, opts.banner.modifier || '')
    : null;

  const article = el('article', { class: 'qb-foundation', dataset: { bucket: state.bucket, tier: state.tier } }, [
    buildNav({ tier: state.tier, activeKey: 'foundation' }),
    banner,
    el('div', { class: 'qb-foundation__inner' }, body),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderFoundationLoading ────────────────────── */
export function renderFoundationLoading(container) {
  clear(container);
  const article = el('article', { class: 'qb-foundation is-loading' }, [
    buildNav({ tier: 'free' }),
    el('div', { class: 'qb-foundation__inner' }, [
      el('section', { class: 'qb-foundation-hero' }, [
        el('div', { class: 'qb-foundation-hero__copy' }, [
          el('div', { class: 'qb-artifact-skeleton__eyebrow' }),
          el('div', { class: 'qb-artifact-skeleton__title' }),
          el('div', { class: 'qb-artifact-skeleton__title qb-artifact-skeleton__title--short' }),
        ]),
      ]),
    ]),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderFoundationError ──────────────────────── */
export function renderFoundationError(container, error) {
  clear(container);
  const msg = (error && error.message) || String(error || 'Unknown error');
  const article = el('article', { class: 'qb-foundation is-error' }, [
    buildNav({ tier: 'free' }),
    el('div', { class: 'qb-foundation__inner' }, [
      el('section', { class: 'qb-foundation-hero' }, [
        el('div', { class: 'qb-foundation-hero__copy' }, [
          el('div', { class: 'qb-foundation-hero__eyebrow' }, 'Lost'),
          el('h1',  { class: 'qb-foundation-hero__title' }, 'Your foundation could not load.'),
          el('p',   { class: 'qb-foundation-hero__body' }, msg),
          el('button', {
            class: 'qb-button is-primary',
            type: 'button',
            on: { click: () => window.location.reload() },
          }, [el('span', { class: 'qb-button_content' }, 'Try again')]),
        ]),
      ]),
    ]),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: startArtifactPolling ───────────────────────── */
const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_MS = 5 * 60_000;

export function startArtifactPolling({ token, onUpdate, onStuck }) {
  let stopped = false;
  let timer = null;
  const startedAt = Date.now();

  async function tick() {
    if (stopped) return;
    if (document.hidden) {
      // Pause: rearm a short tick to re-check visibility soon.
      timer = setTimeout(tick, 1000);
      return;
    }
    try {
      const r = await fetch('/api/artifacts?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        const rows = Array.isArray(d.artifacts) ? d.artifacts : [];
        const inFlight = rows.some(a => a.status === 'queued' || a.status === 'generating');
        if (typeof onUpdate === 'function') onUpdate(rows);
        if (!inFlight) {
          stopped = true;
          return;
        }
      }
    } catch (_) { /* swallow transient errors; retry */ }

    if (Date.now() - startedAt >= POLL_MAX_MS) {
      stopped = true;
      if (typeof onStuck === 'function') onStuck();
      return;
    }
    timer = setTimeout(tick, POLL_INTERVAL_MS);
  }

  // Kick off after a short head-start so the initial render finishes first.
  timer = setTimeout(tick, POLL_INTERVAL_MS);

  return function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

const FoundationRenderer = {
  computeFoundationState,
  renderFoundation,
  renderFoundationLoading,
  renderFoundationError,
  startArtifactPolling,
};
export default FoundationRenderer;
