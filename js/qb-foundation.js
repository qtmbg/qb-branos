/* BrandOS — Foundation page renderer
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

   Lock CTA dispatches POST /api/foundation/lock. Realtime notifications
   refresh artifacts; bounded polling covers a failed subscription.

   Exports:
     computeFoundationState({ qbp, artifacts, foundationLockedAt, tier })
     renderFoundation(container, state, opts)
     renderFoundationLoading(container)
     renderFoundationError(container, error)
     startArtifactPolling(opts) -> stop function
*/

import {
  createExerciseCard, createPhaseCard, createArtifactRow, createTierBadge,
  createPaywallModal, createLockFoundationCta, STARTER_ADDS, STARTER_PRICE_LINE,
} from '/js/qb-components.js';
import { createJobRefresh } from './qb-job-refresh.js';

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

/* The three free exercises required to lock the foundation. */
const REQUIRED_FREE_SLUGS = new Set(['archetype-compass','brand-soul-map','sensescape']);

/* What a founder reads for each reading while it is produced. */
const READING_NAMES = {
  soul_map_synthesizer:   'Soul Map',
  sensescape_synthesizer: 'Sensescape',
  visual_dna_synthesizer: 'Visual DNA',
  war_table_synthesizer:  'War Table',
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
      el('span', { class: 'qb-foundation-nav__wordmark qb-lockup' }, [
        el('span', { class: 'qb-lockup_name brandos-name' }, 'BrandOS'),
        el('span', { class: 'qb-lockup_by' }, 'by Quantum Branding'),
      ]),
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

/* ─── Step 12 · upgrade-success banner ──────────────────────── */
// Tier-aware celebratory banner for the post-Stripe-checkout moment.
// Eyebrow + Fraunces headline + body + dismiss button. Gold accent on
// qb-card shell per spec §2.4 (adj #4 default). Bodies follow Nizzar's
// rule (adj #2 override): (1) confirm decision was right, (2) name what
// is now open, (3) point at the single next action on the foundation
// page today.
/* One paid plan is sold, so one banner. It says what Starter opens and
   nothing else: no Pro, no Agency, no client workspaces, no white-label.
   An account on a dormant tier that lands here reads the same true list
   under a neutral line, because "Starter is live." would not be its plan. */
const UPGRADE_BANNER_COPY = {
  headline: 'Your tools are open.',
  body: 'The Visual DNA and War Table exercises, the three other foundation readings, the Build agents and the full QBP export are open. Visual DNA and War Table are next, on this page.',
};

function buildUpgradeSuccessBanner({ tier, onDismiss }) {
  const copy = {
    eyebrow: String(tier || 'starter').toLowerCase() === 'starter' ? 'Starter is live.' : 'Your plan is live.',
    headline: UPGRADE_BANNER_COPY.headline,
    body: UPGRADE_BANNER_COPY.body,
  };
  const closeBtn = el('button', {
    type: 'button',
    class: 'qb-foundation-upgrade-success__close',
    'aria-label': 'Dismiss upgrade confirmation',
    on: { click: () => { if (typeof onDismiss === 'function') onDismiss(); } },
  }, '×');
  return el('section', {
    class: 'qb-foundation-upgrade-success qb-card',
    role: 'status',
    'aria-live': 'polite',
  }, [
    closeBtn,
    el('span', { class: 'qb-tag is-gold' }, [
      el('span', { class: 'qb-tag_content' }, copy.eyebrow),
    ]),
    el('h2', { class: 'qb-foundation-upgrade-success__headline' }, copy.headline),
    el('p',  { class: 'qb-foundation-upgrade-success__body' }, copy.body),
  ]);
}

/* ─── Movement roadmap ───────────────────────────────────── */
/* Three cards for the four movements: the foundation (Observe and
   Collapse), Build, Hold. The phase key only picks the card colour.
   The foundation card reads "locked" only once it is locked: it used to
   say "Locked. Artifacts delivered." as soon as the three exercises were
   done, before anything had been locked or produced. */
function buildPhaseRoadmap(state, opts = {}) {
  const locked = state.bucket === 'locked';
  const count = state.requiredExercises.filter(e => e.state === 'complete').length;
  const next = state.exercises.find(e => e.state !== 'complete' && !e.locked);

  const cards = [
    createPhaseCard({
      phase: '01',
      eyebrow: 'Observe · Collapse',
      name: 'The foundation',
      state: locked ? 'complete' : 'available',
      count,
      total: state.requiredExercises.length,
      ctaLabel: locked ? 'Open the archive' : 'Continue',
      ctaHref: locked ? '/archive' : (next?.href || '/foundation'),
    }),
    state.isPaid
      ? createPhaseCard({
          phase: '02',
          eyebrow: 'Build',
          name: 'The Build agents',
          state: 'available',
          note: 'Logo Direction, Logo Evaluation, Voice Guide.',
          ctaLabel: 'Open the Console',
          ctaHref: '/agents',
        })
      : createPhaseCard({
          phase: '02',
          eyebrow: 'Build',
          name: 'The Build agents',
          state: 'locked',
          lockReason: 'Opens with Starter.',
          ctaLabel: 'Upgrade',
          onCta: () => openPaywall('phase_02', opts),
        }),
    createPhaseCard({
      phase: '05',
      eyebrow: 'Hold',
      name: 'The Hold tools',
      state: 'locked',
      lockReason: 'Not open yet.',
      ctaLabel: 'Not open yet',
      ctaDisabled: true,
    }),
  ];

  return el('section', { class: 'qb-foundation-roadmap' }, [
    el('div', { class: 'qb-foundation-roadmap__eyebrow' }, 'The four movements'),
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
    headline: 'Open the rest of your foundation.',
    body: STARTER_ADDS,
    price: STARTER_PRICE_LINE,
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
  return [hero, buildPhaseRoadmap(state, opts)];
}

/* ─── In-progress state ──────────────────────────────────── */
function renderInProgress(state, opts) {
  const completeCount = state.requiredExercises.filter(e => e.state === 'complete').length;
  const totalCount    = state.requiredExercises.length;
  const hero = el('section', { class: 'qb-foundation-hero is-in-progress' }, [
    el('div', { class: 'qb-foundation-hero__copy' }, [
      el('div', { class: 'qb-foundation-hero__eyebrow' }, 'The foundation'),
      el('h1',  { class: 'qb-foundation-hero__title' }, 'Continue your foundation.'),
      el('p',   { class: 'qb-foundation-hero__body' },
        'Archetype Compass, Brand Soul Map and Sensescape are what it takes to lock your foundation. After lock, your readings are produced.'),
      buildProgressBar(completeCount, totalCount),
    ]),
  ]);
  return [hero, buildExerciseList(state, opts), buildPhaseRoadmap(state, opts)];
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
        'Once locked, your foundation answers become immutable. Your readings are produced, and an email reaches you as each one is ready, within minutes.'),
      el('div', { class: 'qb-foundation-hero__actions' }, [
        createLockFoundationCta({
          enabled: true,
          label: 'Lock my foundation',
          onClick: () => triggerLockConfirmation(opts),
        }),
      ]),
    ]),
  ]);
  return [hero, buildExerciseList(state, opts), buildPhaseRoadmap(state, opts)];
}

function triggerLockConfirmation(opts) {
  const overlay = createPaywallModal({
    reason: 'lock_confirm',
    eyebrow: 'Confirm',
    headline: 'Lock your foundation?',
    body: 'Once you lock your foundation, your answers become immutable. Your readings are produced, and an email reaches you as each one is ready, within minutes.',
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
    el('div', { class: 'qb-foundation-queue__agent' }, READING_NAMES[agentSlug] || agentSlug.replace(/_/g, ' ')),
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
        el('h1',  { class: 'qb-foundation-hero__title' }, 'Your readings are being prepared.'),
        el('p',   { class: 'qb-foundation-hero__body' },
          `We will email you when each one is ready. ${state.foundationLockedAt ? `Foundation locked at ${formatDateLight(state.foundationLockedAt)}.` : ''}`),
        queue,
      ]),
    ]);
    return [hero, buildPhaseRoadmap(state, opts)];
  }

  // 12.6.B / 12.6.C — All delivered
  const isPaid = state.isPaid;
  const eyebrow = 'Foundation locked';
  // "Your Soul Map is ready." only when it is: a failed run used to read
  // as ready too.
  const soulReady = state.byAgent.get('soul_map_synthesizer')?.status === 'delivered';
  const headline = isPaid ? 'Your foundation is built.'
    : soulReady ? 'Your Soul Map is ready.'
    : 'Your foundation is locked.';
  const body = isPaid
    ? 'Read each one. Your QBP is your living document.'
    : 'The three other readings open with Starter.';

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
          'Build is open: Logo Direction, Logo Evaluation and Voice Guide. Your QBP keeps growing as you complete the Visual DNA and War Table exercises.'),
      ])
    : el('section', { class: 'qb-foundation-upgrade-banner' }, [
        el('div', { class: 'qb-foundation-upgrade-banner__copy' }, [
          el('h2', { class: 'qb-foundation-upgrade-banner__title' },
            'Open the rest of your foundation.'),
          el('p',  { class: 'qb-foundation-upgrade-banner__body' },
            'Starter opens the Sensescape, Visual DNA and War Table readings, plus the Visual DNA and War Table exercises.'),
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

  return [hero, tiles, banner, buildPhaseRoadmap(state, opts)];
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

  let banner = null;
  if (opts.banner) {
    if (opts.banner.variant === 'upgrade-success') {
      // Step 12 · post-Stripe-checkout celebratory banner. Tier-aware
      // copy from UPGRADE_BANNER_COPY. Dismiss callback wired by the
      // foundation.html script block (clears bannerSpec + re-renders).
      banner = buildUpgradeSuccessBanner({
        tier: opts.banner.tier || state.tier,
        onDismiss: opts.banner.onDismiss,
      });
    } else {
      // Legacy simple banner (used post-lock for "your foundation is locked"
      // and other status messages).
      banner = buildBanner(opts.banner.text, opts.banner.modifier || '');
    }
  }

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
const POLL_MAX_MS = 5 * 60_000;

export function startArtifactPolling({ token, onUpdate, onStuck, initialArtifacts }) {
  let stopped = false;
  let previousRows = JSON.stringify(initialArtifacts);
  const unsubscribers = [];
  const watcher = createJobRefresh({ initialActive: true, activeInterval: 10_000, refresh: async () => {
    if (stopped) return null;
    try {
      const r = await fetch('/api/artifacts?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json().catch(() => null);
        if (stopped || !Array.isArray(d?.artifacts)) return null;
        const rows = d.artifacts;
        const inFlight = rows.some(a => a.status === 'queued' || a.status === 'generating');
        const nextRows = JSON.stringify(rows);
        if (nextRows !== previousRows && typeof onUpdate === 'function') onUpdate(rows);
        previousRows = nextRows;
        if (!inFlight) stop();
        return inFlight;
      }
    } catch { /* bounded fallback handles transient failures */ }
    return null;
  } });
  // Preserve the existing five-minute watchdog for an active foundation.
  const deadline = setTimeout(() => {
    stop();
    if (typeof onStuck === 'function') onStuck();
  }, POLL_MAX_MS);
  const mgr = window.QBRealtimeManager;
  if (mgr) {
    mgr.start({ authToken: token });
    unsubscribers.push(mgr.onNotification(() => watcher.refresh()));
    unsubscribers.push(mgr.onState(state => {
      watcher.setMode(state);
      if (state === 'realtime') watcher.refresh();
    }));
  } else watcher.setMode('poll');

  function stop() {
    stopped = true;
    watcher.destroy();
    clearTimeout(deadline);
    unsubscribers.forEach(unsubscribe => unsubscribe());
  }
  return stop;
}

const FoundationRenderer = {
  computeFoundationState,
  renderFoundation,
  renderFoundationLoading,
  renderFoundationError,
  startArtifactPolling,
};
export default FoundationRenderer;
