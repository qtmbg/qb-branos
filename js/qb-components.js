/* QB BrandOS — Component library (vanilla DOM factories)
   Last updated: 2026-05-14
   Spec reference: CHAPTER_01_SPEC.md §3.

   Every factory returns a ready-to-append HTMLElement. Pure vanilla.
   No frameworks. Consumes /css/qb-tokens.css + /css/qb-components.css.

   Import either as named factories or as the default `QBComponents`
   object grouping all of them.
*/

const PHASE_KEYS = new Set(['00', '01', '02', '03', '04', '05']);
const PHASE_MOD = {
  '00': 'is-discovery',
  '01': 'is-discovery',
  '02': 'is-creation',
  '03': 'is-content',
  '04': 'is-execution',
  '05': 'is-intelligence',
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class')        node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'on')      Object.entries(v).forEach(([ev, fn]) => node.addEventListener(ev, fn));
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k in node)       node[k] = v;
    else                       node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function escapeText(s) {
  return String(s || '');
}

function safeHref(href) {
  if (typeof href !== 'string') return null;
  if (/^(https?:|\/|#)/.test(href)) return href;
  return null;
}

/* =====================================================
   createTag
   ===================================================== */
export function createTag({ children, modifier } = {}) {
  return el('div', { class: modifier ? `qb-tag ${modifier}` : 'qb-tag' }, [
    el('span', { class: 'qb-tag_content' }, children),
  ]);
}

/* =====================================================
   createCard
   ===================================================== */
export function createCard({ children, modifier } = {}) {
  return el('div', { class: modifier ? `qb-card ${modifier}` : 'qb-card' }, children);
}

/* =====================================================
   createPillButton — the 3D two-layer pill
   Internal helper; not a spec component itself, but reused by
   every spec component that needs a primary or secondary CTA.
   ===================================================== */
function createPillButton({ label, href, onClick, variant = 'primary', size, expand, disabled, ariaLabel } = {}) {
  const cls = ['qb-button'];
  if (variant === 'primary')   cls.push('is-primary');
  if (variant === 'secondary') cls.push('is-secondary');
  if (size === 'sm')           cls.push('is-sm');
  if (size === 'lg')           cls.push('is-lg');
  if (expand)                  cls.push('is-expand');
  if (disabled)                cls.push('is-disabled');

  const content = el('span', { class: 'qb-button_content' }, label);
  const tag = href ? 'a' : 'button';
  const attrs = { class: cls.join(' ') };
  if (ariaLabel) attrs['aria-label'] = ariaLabel;

  if (tag === 'a') {
    const safe = safeHref(href);
    if (safe) attrs.href = safe;
  } else {
    attrs.type = 'button';
    if (disabled) attrs.disabled = true;
  }
  const node = el(tag, attrs, [content]);
  if (onClick && !disabled) node.addEventListener('click', onClick);
  return node;
}

/* =====================================================
   createPhaseCard
   ===================================================== */
export function createPhaseCard({ phase, name, state, count, total, lockReason, ctaLabel, ctaHref, onCta } = {}) {
  if (!state) throw new Error('createPhaseCard: state is required');
  if (!PHASE_KEYS.has(String(phase))) throw new Error(`createPhaseCard: invalid phase ${phase}`);

  const cls = ['qb-phase-card'];
  cls.push(PHASE_MOD[phase]);
  cls.push(`is-${state}`);

  const eyebrow = el('div', { class: 'qb-phase-card__eyebrow' }, `${phase} ${name || ''}`.trim());
  const title   = el('h3',  { class: 'qb-phase-card__title' }, name || `Phase ${phase}`);

  let meta;
  if (state === 'available' && typeof count === 'number' && typeof total === 'number') {
    meta = el('div', { class: 'qb-phase-card__meta' }, `${count} of ${total} exercises complete`);
  } else if (state === 'complete') {
    meta = el('div', { class: 'qb-phase-card__meta' }, 'Locked. Artifacts delivered.');
  } else if (state === 'locked') {
    meta = el('div', { class: 'qb-phase-card__meta' }, lockReason || 'Unlock with the next tier.');
  }

  const ctaWrap = el('div', { class: 'qb-phase-card__cta' }, [
    createPillButton({
      label: ctaLabel || (state === 'available' ? 'Continue' : state === 'complete' ? 'View artifacts' : 'Upgrade'),
      href: ctaHref,
      onClick: onCta,
      variant: state === 'available' ? 'primary' : (state === 'locked' ? 'secondary' : 'primary'),
      size: 'sm',
    }),
  ]);

  return el('section', { class: cls.join(' '), dataset: { phase, state } }, [eyebrow, title, meta, ctaWrap]);
}

/* =====================================================
   createExerciseCard
   ===================================================== */
export function createExerciseCard({ slug, name, description, state, lastSavedAt, locked, ctaLabel, ctaHref, onCta } = {}) {
  if (!state) throw new Error('createExerciseCard: state is required');
  const cls = ['qb-exercise-card', `is-${state}`];
  if (locked) cls.push('is-locked');

  const nameEl = el('h3', { class: 'qb-exercise-card__name' }, name || slug || 'Exercise');
  const descEl = description ? el('p', { class: 'qb-exercise-card__desc' }, description) : null;
  const row = el('div', { class: 'qb-exercise-card__row' }, [
    createStatusPill({ status: locked ? 'locked' : (state === 'complete' ? 'delivered' : state === 'in-progress' ? 'generating' : 'queued') }),
    lastSavedAt ? el('span', { class: 'qb-exercise-card__meta' }, `Last saved ${formatDateLight(lastSavedAt)}`) : null,
  ]);
  const ctaWrap = el('div', { class: 'qb-exercise-card__cta' }, [
    createPillButton({
      label: ctaLabel || (locked ? 'Upgrade' : state === 'not-started' ? 'Begin' : state === 'in-progress' ? 'Continue' : 'Review'),
      href: ctaHref,
      onClick: onCta,
      variant: locked ? 'secondary' : 'primary',
      size: 'sm',
    }),
  ]);

  return el('article', { class: cls.join(' '), dataset: { slug: slug || '' } }, [nameEl, descEl, row, ctaWrap]);
}

function formatDateLight(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (_) { return ''; }
}

/* =====================================================
   createArtifactRow
   ===================================================== */
export function createArtifactRow({ id, title, phase, agentSlug, generatedAt, status, locked, href, onClick } = {}) {
  const cls = ['qb-artifact-row'];
  if (locked) cls.push('is-locked');
  const tag = href ? 'a' : 'div';
  const attrs = { class: cls.join(' '), dataset: { id: id || '' } };
  if (tag === 'a') {
    const safe = safeHref(href);
    if (safe) attrs.href = safe;
  }

  const titleEl = el('h3', { class: 'qb-artifact-row__title' }, title || 'Artifact');
  const meta = el('div', { class: 'qb-artifact-row__meta' }, [
    phase ? el('span', {}, `Phase ${phase}`) : null,
    phase ? el('span', { class: 'qb-artifact-row__meta-dot' }) : null,
    agentSlug ? el('span', {}, agentSlug.replace(/_/g, ' ')) : null,
    generatedAt ? el('span', { class: 'qb-artifact-row__meta-dot' }) : null,
    generatedAt ? el('span', {}, formatDateLight(generatedAt)) : null,
  ]);
  const left = el('div', {}, [titleEl, meta]);
  const right = createStatusPill({ status: locked ? 'locked' : status });

  const node = el(tag, attrs, [left, right]);
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

/* =====================================================
   createLockFoundationCta
   ===================================================== */
export function createLockFoundationCta({ enabled, onClick, label, disabledReason } = {}) {
  const hint = !enabled && disabledReason
    ? el('p', { class: 'qb-lock-foundation-cta__hint' }, disabledReason)
    : null;
  const cta = createPillButton({
    label: label || 'Lock my foundation',
    onClick: enabled ? onClick : null,
    variant: 'primary',
    size: 'lg',
    expand: false,
    disabled: !enabled,
    ariaLabel: 'Lock my foundation',
  });
  return el('div', { class: 'qb-lock-foundation-cta' }, [hint, cta]);
}

/* =====================================================
   createPaywallModal
   ===================================================== */
export function createPaywallModal({ reason, eyebrow, headline, body, price, primaryCta, secondaryCta, onPrimary, onSecondary } = {}) {
  const sheet = el('div', { class: 'qb-paywall-modal__sheet' }, [
    el('div', { class: 'qb-paywall-modal__eyebrow' }, eyebrow || 'Locked'),
    el('h2',  { class: 'qb-paywall-modal__headline' }, headline || 'Unlock the rest of your foundation.'),
    el('p',   { class: 'qb-paywall-modal__body' }, body || 'Visual DNA, War Table, three more synthesis artifacts, and your QBP export.'),
    el('div', { class: 'qb-paywall-modal__price' }, price || 'Starter, $97 / month. Cancel anytime.'),
    el('div', { class: 'qb-paywall-modal__actions' }, [
      createPillButton({ label: primaryCta || 'Upgrade to Starter', onClick: onPrimary, variant: 'primary', expand: true }),
      el('button', { class: 'qb-paywall-modal__secondary', type: 'button', on: { click: onSecondary || (() => {}) } }, secondaryCta || 'Not now'),
    ]),
  ]);
  return el('div', { class: 'qb-paywall-modal', role: 'dialog', 'aria-modal': 'true', dataset: { reason: reason || '' } }, [sheet]);
}

/* =====================================================
   createEmptyState
   ===================================================== */
export function createEmptyState({ variant, eyebrow, headline, body, ctaLabel, ctaHref, onCta } = {}) {
  const cls = ['qb-empty-state'];
  if (variant) cls.push(`is-${variant}`);
  const children = [
    eyebrow  ? el('div', { class: 'qb-empty-state__eyebrow' }, eyebrow)  : null,
    headline ? el('h2',  { class: 'qb-empty-state__headline' }, headline) : null,
    body     ? el('p',   { class: 'qb-empty-state__body' }, body)         : null,
  ];
  if (ctaLabel) {
    children.push(createPillButton({ label: ctaLabel, href: ctaHref, onClick: onCta, variant: 'primary', size: 'sm' }));
  }
  return el('div', { class: cls.join(' ') }, children);
}

/* =====================================================
   createTierBadge
   ===================================================== */
export function createTierBadge({ tier } = {}) {
  const t = String(tier || 'free').toLowerCase();
  const label = t.charAt(0).toUpperCase() + t.slice(1);
  return el('span', { class: `qb-tier-badge is-${t}` }, label);
}

/* =====================================================
   createShareControls
   ===================================================== */
export function createShareControls({ artifactId, canDownloadPdf, canShareEmail, onAction } = {}) {
  function btn(action, label, disabled) {
    const cls = ['qb-share-controls__btn'];
    if (disabled) cls.push('is-disabled');
    return el('button', {
      type: 'button',
      class: cls.join(' '),
      dataset: { action, artifactId: artifactId || '' },
      'aria-disabled': disabled ? 'true' : 'false',
      on: { click: (e) => { if (!disabled && typeof onAction === 'function') onAction(action, e); } },
    }, label);
  }
  return el('div', { class: 'qb-share-controls' }, [
    btn('copy-link', 'Copy link', false),
    btn('print',     'Print',     false),
    btn('download',  'Download PDF', !canDownloadPdf),
    btn('email',     'Share via email', !canShareEmail),
  ]);
}

/* =====================================================
   createQbpSection
   ===================================================== */
export function createQbpSection({ title, eyebrow, prose, exerciseLink, exerciseLabel, isEmpty, emptyHint } = {}) {
  const children = [
    eyebrow ? el('div', { class: 'qb-qbp-section__eyebrow' }, eyebrow) : null,
    title   ? el('h2',  { class: 'qb-qbp-section__title' }, title) : null,
  ];
  if (isEmpty) {
    const linkText = exerciseLabel || (exerciseLink ? exerciseLink : 'the exercise');
    const empty = el('p', { class: 'qb-qbp-section__empty' }, [
      emptyHint || 'This will populate when you complete ',
      exerciseLink ? el('a', { href: safeHref(exerciseLink) || '#' }, linkText) : el('span', {}, linkText),
      el('span', {}, '.'),
    ]);
    children.push(empty);
  } else if (prose) {
    children.push(el('p', { class: 'qb-qbp-section__prose' }, prose));
  }
  return el('section', { class: 'qb-qbp-section' }, children);
}

/* =====================================================
   createStatusPill
   ===================================================== */
export function createStatusPill({ status } = {}) {
  const s = String(status || 'queued').toLowerCase();
  const labels = { queued: 'Queued', generating: 'Generating', delivered: 'Ready', failed: 'Failed', locked: 'Locked', 'not-started': 'Not started', 'in-progress': 'In progress', complete: 'Complete' };
  const label = labels[s] || s;
  // Map exercise-level statuses to artifact vocab for the pill class.
  const cls = s === 'not-started' ? 'is-queued'
    : s === 'in-progress' ? 'is-generating'
    : s === 'complete'    ? 'is-delivered'
    : `is-${s}`;
  return el('span', { class: `qb-status-pill ${cls}`, dataset: { status: s } }, [
    el('span', { class: 'qb-status-pill__dot' }),
    el('span', {}, label),
  ]);
}

/* =====================================================
   Default export
   ===================================================== */
const QBComponents = {
  createTag,
  createCard,
  createPhaseCard,
  createExerciseCard,
  createArtifactRow,
  createLockFoundationCta,
  createPaywallModal,
  createEmptyState,
  createTierBadge,
  createShareControls,
  createQbpSection,
  createStatusPill,
};
export default QBComponents;
