/* QB BrandOS — QBP rendering surface
   Last updated: 2026-05-14
   Spec reference: CHAPTER_01_SPEC.md §3.10 (qb-qbp-section component),
                   §5.3 (GET /api/qbp), §5.4 (POST /api/qbp/export),
                   §8.4 (paywall reasons), §9.7 (empty), §10.3 (canon
                   tier-gating for QBP export).

   The QBP page is the founder-facing read of the user's accumulated
   Phase 01 inputs. Read-only: QBP is immutable once foundation_locked_at
   is set; pre-lock it shows draft status. The page renders four
   sections — Soul Axis, Sensescape, Visual DNA, War Table — each
   computed from a discrete slice of QBP fields. Each section computes
   its own empty state independently per spec §9.7.

   Exports:
     renderQbp(container, qbp, opts)
     renderQbpLoading(container)
     renderQbpError(container, error)
*/

import { createPaywallModal, createTierBadge } from '/js/qb-components.js';

const SECTIONS = [
  { id: 'soul-axis',   label: 'Soul Axis' },
  { id: 'sensescape',  label: 'Sensescape' },
  { id: 'visual-dna',  label: 'Visual DNA' },
  { id: 'war-table',   label: 'War Table' },
];

const PAID_TIERS = new Set(['starter', 'pro', 'agency', 'atelier']);

/* ─── DOM helpers ─────────────────────────────────────────── */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class')        node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'on')      Object.entries(v).forEach(([ev, fn]) => node.addEventListener(ev, fn));
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
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
function isStr(v)   { return typeof v === 'string' && v.trim().length > 0; }
function isArr(v)   { return Array.isArray(v) && v.length > 0; }
function isObjPop(v){ return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0; }
function safe(s)    { return String(s == null ? '' : s); }

function paragraphs(text) {
  return safe(text)
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => el('p', { class: 'qb-qbp-prose__p' }, p));
}
function formatDateLight(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) { return ''; }
}
function brandName(qbp) {
  return isStr(qbp?.brandName) ? qbp.brandName.trim() : 'Your Brand';
}

/* ─── Section header + empty / locked / sub-block helpers ─── */
function sectionHeader(eyebrow, title) {
  return el('header', { class: 'qb-qbp-section__header' }, [
    el('div', { class: 'qb-qbp-section__eyebrow' }, eyebrow),
    el('h2',  { class: 'qb-qbp-section__title' }, title),
  ]);
}
function sectionEmpty(prompt, exerciseHref, exerciseLabel) {
  return el('div', { class: 'qb-qbp-section__empty' }, [
    el('p', {}, [
      safe(prompt) + ' ',
      el('a', { href: exerciseHref }, exerciseLabel || exerciseHref),
      el('span', {}, '.'),
    ]),
  ]);
}
function sectionLocked(sectionId) {
  const sheet = createPaywallModal({
    reason: 'qbp_section',
    eyebrow: 'Locked',
    headline: 'Available with Starter.',
    body: 'Visual DNA and War Table are locked on free. Upgrade to read them.',
    price: 'Starter, $97 / month. Cancel anytime.',
    primaryCta: 'Unlock with Starter',
    secondaryCta: 'Back to top',
    onPrimary: () => { window.location.href = `/paywall?reason=qbp_section&section=${sectionId}`; },
    onSecondary: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); },
  });
  return el('div', { class: 'qb-qbp-section__locked' }, [sheet]);
}
function subBlock(label, valueOrChildren, opts = {}) {
  const children = Array.isArray(valueOrChildren) ? valueOrChildren : [valueOrChildren];
  return el('div', { class: 'qb-qbp-subblock' + (opts.modifier ? ` ${opts.modifier}` : '') }, [
    el('div', { class: 'qb-qbp-subblock__label' }, label),
    el('div', { class: 'qb-qbp-subblock__body' }, children),
  ]);
}
function subEmpty(prompt) {
  return el('p', { class: 'qb-qbp-subblock__empty' }, prompt);
}

/* ─── Section 1: Soul Axis ────────────────────────────────── */
function renderSoulAxis(qbp) {
  const hasAny = isStr(qbp.brandEssence) || isStr(qbp.manifesto) || isStr(qbp.paradox)
              || isStr(qbp.antiBrand) || isArr(qbp.always) || isArr(qbp.never)
              || isObjPop(qbp.alwaysNever)
              || isStr(qbp.archetype) || isStr(qbp.archetypePrimary);

  const children = [];
  if (!hasAny) {
    children.push(sectionEmpty(
      'This will populate when you complete the Brand Soul Map. Go to',
      '/brand-soul-map.html', 'the Brand Soul Map'
    ));
    return el('section', { id: 'soul-axis', class: 'qb-qbp-section' }, [
      sectionHeader('Soul Axis', 'The Soul of ' + brandName(qbp)),
      ...children,
    ]);
  }

  // Essence
  children.push(subBlock(
    'Essence',
    isStr(qbp.brandEssence) ? paragraphs(qbp.brandEssence) : subEmpty('Return to the Brand Soul Map to capture brand essence.')
  ));
  // Paradox
  children.push(subBlock(
    'Paradox',
    isStr(qbp.paradox) ? paragraphs(qbp.paradox) : subEmpty('Paradox not yet named.')
  ));
  // Manifesto
  children.push(subBlock(
    'Manifesto',
    isStr(qbp.manifesto) ? paragraphs(qbp.manifesto) : subEmpty('Manifesto not yet written.')
  ));
  // Anti-brand
  children.push(subBlock(
    'Anti-brand',
    isStr(qbp.antiBrand) ? paragraphs(qbp.antiBrand) : subEmpty('What this brand refuses, not yet captured.')
  ));

  // Archetype block
  const primary   = isStr(qbp.archetypePrimary)   ? qbp.archetypePrimary
                  : isStr(qbp.archetype)          ? qbp.archetype : '';
  const secondary = isStr(qbp.archetypeSecondary) ? qbp.archetypeSecondary : '';
  const tension   = isStr(qbp.archetypeTension)   ? qbp.archetypeTension   : '';
  const headline  = isStr(qbp.archetypeHeadline)  ? qbp.archetypeHeadline  : '';
  const epigraph  = isStr(qbp.archetypeEpigraph)  ? qbp.archetypeEpigraph  : '';

  if (primary || secondary || tension || headline || epigraph) {
    const card = el('div', { class: 'qb-qbp-archetype' }, [
      primary   ? el('div', { class: 'qb-qbp-archetype__primary' },   primary)   : null,
      secondary ? el('div', { class: 'qb-qbp-archetype__secondary' }, ['Secondary: ', el('strong', {}, secondary)]) : null,
      tension   ? el('div', { class: 'qb-qbp-archetype__tension' },   ['Tension: ',   el('strong', {}, tension)])   : null,
      headline  ? el('p',   { class: 'qb-qbp-archetype__headline' },  headline)  : null,
      epigraph  ? el('blockquote', { class: 'qb-qbp-archetype__epigraph' }, epigraph) : null,
    ]);
    children.push(subBlock('Archetype', card));
  } else {
    children.push(subBlock('Archetype', subEmpty('Take the Archetype Compass to anchor this section.')));
  }

  // Always / Never
  let always = isArr(qbp.always) ? qbp.always
            : (isObjPop(qbp.alwaysNever) && isArr(qbp.alwaysNever.always)) ? qbp.alwaysNever.always : [];
  let never  = isArr(qbp.never)  ? qbp.never
            : (isObjPop(qbp.alwaysNever) && isArr(qbp.alwaysNever.never))  ? qbp.alwaysNever.never  : [];
  if (always.length || never.length) {
    const cols = el('div', { class: 'qb-qbp-always-never__columns' }, [
      el('div', { class: 'qb-qbp-always-never__col qb-qbp-always-never__col--always' }, [
        el('h4', { class: 'qb-qbp-always-never__h' }, 'Always'),
        always.length
          ? el('ul', {}, always.map(t => el('li', {}, t)))
          : subEmpty('No always commitments yet.'),
      ]),
      el('div', { class: 'qb-qbp-always-never__col qb-qbp-always-never__col--never' }, [
        el('h4', { class: 'qb-qbp-always-never__h' }, 'Never'),
        never.length
          ? el('ul', {}, never.map(t => el('li', {}, t)))
          : subEmpty('No never commitments yet.'),
      ]),
    ]);
    children.push(subBlock('Binding commitments', cols, { modifier: 'is-wide' }));
  }

  return el('section', { id: 'soul-axis', class: 'qb-qbp-section' }, [
    sectionHeader('Soul Axis', 'The Soul of ' + brandName(qbp)),
    el('div', { class: 'qb-qbp-section__body' }, children),
  ]);
}

/* ─── Section 2: Sensescape ───────────────────────────────── */
function renderSensescape(qbp) {
  const hasAny = ['colorTerritory','forbiddenColor','soundSignature','brandObject','brandMoment',
                  'signatureGesture','antiVoice','typographyNote','visualTerritoryNote']
                  .some(k => isStr(qbp[k]));

  if (!hasAny) {
    return el('section', { id: 'sensescape', class: 'qb-qbp-section' }, [
      sectionHeader('Sensescape', 'The Sensory World'),
      sectionEmpty(
        'This will populate when you complete the Sensescape exercise. Go to',
        '/sensescape.html', 'Sensescape'
      ),
    ]);
  }

  const blocks = [];
  // Sight
  const sightParts = [];
  if (isStr(qbp.colorTerritory))    sightParts.push(subBlock('Color territory',     paragraphs(qbp.colorTerritory)));
  if (isStr(qbp.forbiddenColor))    sightParts.push(subBlock('Forbidden color',     paragraphs(qbp.forbiddenColor)));
  if (isStr(qbp.visualTerritoryNote)) sightParts.push(subBlock('Visual territory',  paragraphs(qbp.visualTerritoryNote)));
  if (isStr(qbp.typographyNote))    sightParts.push(subBlock('Typography note',     paragraphs(qbp.typographyNote)));
  if (sightParts.length) blocks.push(el('div', { class: 'qb-qbp-sense-group' }, [
    el('h3', { class: 'qb-qbp-sense-group__h' }, 'Sight'),
    ...sightParts,
  ]));

  // Sound
  const soundParts = [];
  if (isStr(qbp.soundSignature)) soundParts.push(subBlock('Sound signature', paragraphs(qbp.soundSignature)));
  if (isStr(qbp.antiVoice))      soundParts.push(subBlock('Anti-voice',      paragraphs(qbp.antiVoice)));
  if (soundParts.length) blocks.push(el('div', { class: 'qb-qbp-sense-group' }, [
    el('h3', { class: 'qb-qbp-sense-group__h' }, 'Sound'),
    ...soundParts,
  ]));

  // Touch
  const touchParts = [];
  if (isStr(qbp.brandObject))      touchParts.push(subBlock('Brand object',       paragraphs(qbp.brandObject)));
  if (isStr(qbp.brandMoment))      touchParts.push(subBlock('Brand moment',       paragraphs(qbp.brandMoment)));
  if (isStr(qbp.signatureGesture)) touchParts.push(subBlock('Signature gesture',  paragraphs(qbp.signatureGesture)));
  if (touchParts.length) blocks.push(el('div', { class: 'qb-qbp-sense-group' }, [
    el('h3', { class: 'qb-qbp-sense-group__h' }, 'Touch'),
    ...touchParts,
  ]));

  // Note: Sensescape exercise does not write explicit smell/taste fields.
  // The synthesizer derives them at artifact-generation time. This page
  // displays only what the user provided.

  return el('section', { id: 'sensescape', class: 'qb-qbp-section' }, [
    sectionHeader('Sensescape', 'The Sensory World of ' + brandName(qbp)),
    el('div', { class: 'qb-qbp-section__body' }, blocks),
  ]);
}

/* ─── Section 3: Visual DNA ───────────────────────────────── */
function renderVisualDna(qbp, opts) {
  const tier = String(opts?.tier || 'free').toLowerCase();
  const isLockedTier = !PAID_TIERS.has(tier);

  if (isLockedTier) {
    return el('section', { id: 'visual-dna', class: 'qb-qbp-section is-locked' }, [
      sectionHeader('Visual DNA', 'The Visual Language'),
      sectionLocked('visual_dna'),
    ]);
  }

  const has = ['visualDnaKeepCount','visualDnaDiscardRate','visualDnaKeptImages','visualDnaFastDiscards']
    .some(k => qbp[k] != null);
  if (!has) {
    return el('section', { id: 'visual-dna', class: 'qb-qbp-section' }, [
      sectionHeader('Visual DNA', 'The Visual Language'),
      sectionEmpty(
        'This will populate when you complete the Visual DNA exercise. Go to',
        '/visual-dna.html', 'Visual DNA'
      ),
    ]);
  }

  const keep      = qbp.visualDnaKeepCount;
  const discardR  = qbp.visualDnaDiscardRate;
  const kept      = isArr(qbp.visualDnaKeptImages) ? qbp.visualDnaKeptImages.length : 0;
  const fastDisc  = isArr(qbp.visualDnaFastDiscards) ? qbp.visualDnaFastDiscards.length : 0;

  const stats = el('div', { class: 'qb-qbp-vdna-stats' }, [
    Number.isFinite(keep) ? subBlock('Kept images', String(keep)) : null,
    Number.isFinite(discardR) ? subBlock('Discard rate', `${discardR}%`) : null,
    kept     > 0 ? subBlock('Signature keeps',  String(kept))     : null,
    fastDisc > 0 ? subBlock('Fast discards (R1)', String(fastDisc)) : null,
  ]);

  const handoff = el('p', { class: 'qb-qbp-handoff' }, [
    'Your full palette and typography direction live in the Visual DNA artifact. ',
    el('a', { href: '/archive' }, 'Open the archive'),
    el('span', {}, ' to read it.'),
  ]);

  return el('section', { id: 'visual-dna', class: 'qb-qbp-section' }, [
    sectionHeader('Visual DNA', 'The Visual Language of ' + brandName(qbp)),
    el('div', { class: 'qb-qbp-section__body' }, [stats, handoff]),
  ]);
}

/* ─── Section 4: War Table ────────────────────────────────── */
function renderWarTable(qbp, opts) {
  const tier = String(opts?.tier || 'free').toLowerCase();
  const isLockedTier = !PAID_TIERS.has(tier);

  if (isLockedTier) {
    return el('section', { id: 'war-table', class: 'qb-qbp-section is-locked' }, [
      sectionHeader('War Table', 'Strategic Position'),
      sectionLocked('war_table'),
    ]);
  }

  const has = isStr(qbp.warTablePosture) || isArr(qbp.warTableTopInitiatives)
           || isArr(qbp.warTablePrinciples) || isObjPop(qbp.warTableBrief)
           || ['audienceFears','audienceDesires','audienceLanguage','audienceFriction'].some(k => isStr(qbp[k]));
  if (!has) {
    return el('section', { id: 'war-table', class: 'qb-qbp-section' }, [
      sectionHeader('War Table', 'Strategic Position'),
      sectionEmpty(
        'This will populate when you complete the War Table exercise. Go to',
        '/war-table.html', 'War Table'
      ),
    ]);
  }

  const blocks = [];
  if (isStr(qbp.warTablePosture)) {
    blocks.push(subBlock('Posture', paragraphs(qbp.warTablePosture)));
  }
  if (isObjPop(qbp.warTableBrief)) {
    const b = qbp.warTableBrief;
    const briefRows = [];
    if (isStr(b.challenge))  briefRows.push(subBlock('Challenge',  paragraphs(b.challenge)));
    if (isStr(b.goal))       briefRows.push(subBlock('Goal',       paragraphs(b.goal)));
    if (isStr(b.constraint)) briefRows.push(subBlock('Constraint', paragraphs(b.constraint)));
    if (briefRows.length) {
      blocks.push(el('div', { class: 'qb-qbp-sense-group' }, [
        el('h3', { class: 'qb-qbp-sense-group__h' }, 'The brief'),
        ...briefRows,
      ]));
    }
  }
  if (isArr(qbp.warTableTopInitiatives)) {
    const list = el('ol', { class: 'qb-qbp-priorities' },
      qbp.warTableTopInitiatives.map(t => el('li', {}, t)));
    blocks.push(subBlock('Top initiatives', list));
  }
  if (isArr(qbp.warTablePrinciples)) {
    const list = el('ul', { class: 'qb-qbp-principles' },
      qbp.warTablePrinciples.map(p => el('li', {}, String(p))));
    blocks.push(subBlock('Operating principles', list));
  }

  // Audience block
  const audKeys = [
    { k: 'audienceFears',    label: 'Audience fears' },
    { k: 'audienceDesires',  label: 'Audience desires' },
    { k: 'audienceLanguage', label: 'Audience language' },
    { k: 'audienceFriction', label: 'Audience friction' },
  ];
  const audBlocks = audKeys.filter(({k}) => isStr(qbp[k]))
    .map(({k,label}) => subBlock(label, paragraphs(qbp[k])));
  if (audBlocks.length) {
    blocks.push(el('div', { class: 'qb-qbp-sense-group' }, [
      el('h3', { class: 'qb-qbp-sense-group__h' }, 'Audience'),
      ...audBlocks,
    ]));
  }

  blocks.push(el('p', { class: 'qb-qbp-handoff' }, [
    'Your full positioning map and ranked priorities live in the War Table artifact. ',
    el('a', { href: '/archive' }, 'Open the archive'),
    el('span', {}, ' to read it.'),
  ]));

  return el('section', { id: 'war-table', class: 'qb-qbp-section' }, [
    sectionHeader('War Table', 'The Strategic Position of ' + brandName(qbp)),
    el('div', { class: 'qb-qbp-section__body' }, blocks),
  ]);
}

/* ─── Cover + chrome ──────────────────────────────────────── */
function buildCover(qbp, opts) {
  const locked   = !!opts?.foundationLockedAt;
  const status   = locked ? 'Locked' : 'Draft';
  const statusCls = locked ? 'is-locked' : 'is-draft';
  const tierLabel = String(opts?.tier || 'free').toLowerCase();
  const lastUpd   = opts?.lastUpdated;

  const exportBtn = el('button', {
    class: 'qb-qbp-cover__export qb-button is-sm' + (opts?.canExport ? ' is-primary' : ' is-secondary'),
    type: 'button',
    on: { click: () => opts?.onExportClick && opts.onExportClick() },
  }, [el('span', { class: 'qb-button_content' }, opts?.canExport ? 'Export QBP' : 'Export · Starter')]);

  return el('header', { class: 'qb-qbp-cover' }, [
    el('div', { class: 'qb-qbp-cover__top' }, [
      el('div', { class: 'qb-qbp-cover__eyebrow' }, 'Quantum Brand Profile'),
      exportBtn,
    ]),
    el('h1',  { class: 'qb-qbp-cover__brand' }, brandName(qbp)),
    el('div', { class: 'qb-qbp-cover__meta' }, [
      el('span', { class: `qb-qbp-cover__status ${statusCls}` }, status),
      createTierBadge({ tier: tierLabel }),
      lastUpd ? el('span', { class: 'qb-qbp-cover__date' }, `Updated ${formatDateLight(lastUpd)}`) : null,
    ]),
  ]);
}

function buildToc() {
  return el('nav', { class: 'qb-qbp-toc', 'aria-label': 'Table of contents' }, [
    el('div', { class: 'qb-qbp-toc__eyebrow' }, 'Contents'),
    el('ol', { class: 'qb-qbp-toc__list' },
      SECTIONS.map((s, i) => el('li', {}, [
        el('a', { href: `#${s.id}` }, [
          el('span', { class: 'qb-qbp-toc__index' }, String(i + 1).padStart(2, '0')),
          el('span', { class: 'qb-qbp-toc__label' }, s.label),
        ]),
      ]))),
  ]);
}

function buildEmptyBanner() {
  return el('div', { class: 'qb-qbp-empty-banner' }, [
    el('h2', {}, 'Your QBP is empty.'),
    el('p',  {}, 'Start with the Archetype Compass or the Brand Soul Map. Each exercise adds a section here.'),
    el('div', { class: 'qb-qbp-empty-banner__actions' }, [
      el('a', { class: 'qb-button is-primary is-sm', href: '/archetype-compass.html' },
        [el('span', { class: 'qb-button_content' }, 'Begin the Archetype Compass')]),
      el('a', { class: 'qb-button is-secondary is-sm', href: '/brand-soul-map.html' },
        [el('span', { class: 'qb-button_content' }, 'Or the Brand Soul Map')]),
    ]),
  ]);
}

function buildFooter(opts) {
  const exportLabel = opts?.canExport ? 'Export QBP' : 'Export · Starter';
  return el('footer', { class: 'qb-qbp-footer' }, [
    el('div', { class: 'qb-qbp-footer__copy' }, [
      el('p', {}, 'Generated by Quantum Branding.'),
      el('p', { class: 'qb-qbp-footer__note' }, 'The QBP is your live brand document. Updates as you complete exercises.'),
    ]),
    el('button', {
      class: 'qb-button is-primary',
      type: 'button',
      on: { click: () => opts?.onExportClick && opts.onExportClick() },
    }, [el('span', { class: 'qb-button_content' }, exportLabel)]),
  ]);
}

/* ─── Public: renderQbp ───────────────────────────────────── */
export function renderQbp(container, qbp, opts) {
  if (!(container instanceof HTMLElement)) {
    throw new Error('renderQbp: container must be an HTMLElement');
  }
  qbp = qbp && typeof qbp === 'object' ? qbp : {};
  opts = opts || {};

  // Detect whether the QBP carries ANY of the keys the four sections render.
  const QBP_KEYS = [
    'brandEssence','manifesto','paradox','antiBrand','alwaysNever','always','never',
    'archetype','archetypePrimary','archetypeSecondary','archetypeHeadline','archetypeEpigraph',
    'colorTerritory','forbiddenColor','typographyNote','antiVoice','brandObject','brandMoment',
    'signatureGesture','soundSignature','visualTerritoryNote',
    'visualDnaKeepCount','visualDnaDiscardRate','visualDnaKeptImages','visualDnaFastDiscards',
    'warTablePosture','warTableTopInitiatives','warTablePrinciples','warTableBrief',
    'audienceFears','audienceDesires','audienceLanguage','audienceFriction',
  ];
  const isCompletelyEmpty = QBP_KEYS.every(k => {
    const v = qbp[k];
    return !(isStr(v) || isArr(v) || isObjPop(v) || (typeof v === 'number' && Number.isFinite(v)));
  });

  clear(container);
  const article = el('article', { class: 'qb-qbp-article' }, [
    buildCover(qbp, opts),
    isCompletelyEmpty ? buildEmptyBanner() : null,
    buildToc(),
    el('div', { class: 'qb-qbp-sections' }, [
      renderSoulAxis(qbp),
      renderSensescape(qbp),
      renderVisualDna(qbp, opts),
      renderWarTable(qbp, opts),
    ]),
    buildFooter(opts),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderQbpLoading ────────────────────────────── */
export function renderQbpLoading(container) {
  clear(container);
  const skel = el('article', { class: 'qb-qbp-article is-loading' }, [
    el('header', { class: 'qb-qbp-cover' }, [
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--eyebrow' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--brand' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--meta' }),
    ]),
    el('nav', { class: 'qb-qbp-toc' }, [
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--toc-line' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--toc-line' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--toc-line' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--toc-line' }),
    ]),
    el('section', { class: 'qb-qbp-section' }, [
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--heading' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--line' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--line' }),
      el('div', { class: 'qb-qbp-skeleton qb-qbp-skeleton--line qb-qbp-skeleton--short' }),
    ]),
  ]);
  container.appendChild(skel);
  return skel;
}

/* ─── Public: renderQbpError ──────────────────────────────── */
export function renderQbpError(container, error) {
  clear(container);
  const msg = (error && error.message) || String(error || 'Unknown error');
  const article = el('article', { class: 'qb-qbp-article is-error' }, [
    el('header', { class: 'qb-qbp-cover' }, [
      el('div', { class: 'qb-qbp-cover__eyebrow' }, 'Lost'),
      el('h1',  { class: 'qb-qbp-cover__brand' }, 'Your QBP could not load.'),
    ]),
    el('div', { class: 'qb-qbp-error__body' }, [
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

const QbpRenderer = { renderQbp, renderQbpLoading, renderQbpError };
export default QbpRenderer;
