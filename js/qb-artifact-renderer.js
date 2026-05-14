/* QB BrandOS — Artifact reading-surface renderer
   Last updated: 2026-05-14
   Spec reference: CHAPTER_01_SPEC.md §3 (components), §7 (schema),
                   §9 (states), §12 (design system).

   One template, every agent. The renderer is a pure function of the
   schema-conforming content object delivered by /api/artifacts/[id].
   No agent-specific branches.

   Exports five render functions:
     renderArtifact(container, content, opts)
     renderLocked(container, artifactMeta, paywallUrl)
     renderFailed(container, artifactMeta, opts)
     renderNotFound(container)
     renderLoading(container)
*/

import { validateArtifact, ILLUSTRATION_INVENTORY } from '/js/qb-artifact-schema.js';
import {
  createPaywallModal, createShareControls, createTag, createStatusPill,
} from '/js/qb-components.js';

const RESTRICTED_MD_BOLD  = /\*\*([^*]+)\*\*/g;
const RESTRICTED_MD_ITAL  = /(?<!\*)\*([^*\n]+)\*(?!\*)/g;

const ILLUSTRATION_SLOT_SET = new Set(ILLUSTRATION_INVENTORY);

/* ─── DOM helpers ─────────────────────────────────────────── */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class')        node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html')    node.innerHTML = v;     // trusted-source-only callers
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
function clear(container) { while (container.firstChild) container.removeChild(container.firstChild); }
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Restricted markdown: paragraphs (\n\n), **bold**, *italic*. No
   headings, no lists, no links, no images, no raw HTML. The schema
   validator enforces this at write time; the renderer enforces it
   at read time as defense in depth. */
function renderProse(prose) {
  const safe = escapeHtml(String(prose || ''));
  const paragraphs = safe.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const html = paragraphs.map(p => {
    let inner = p
      .replace(RESTRICTED_MD_BOLD, '<strong>$1</strong>')
      .replace(RESTRICTED_MD_ITAL, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return `<p>${inner}</p>`;
  }).join('');
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return wrap;
}

function formatDateRich(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) { return ''; }
}
function prettyAgent(slug) {
  if (typeof slug !== 'string') return '';
  return slug
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/Dna/g, 'DNA')
    .replace(/Qbp/g, 'QBP');
}

/* ─── Header ──────────────────────────────────────────────── */
function buildHeader(header) {
  return el('header', { class: 'qb-artifact-header' }, [
    el('div', { class: 'qb-artifact-header__eyebrow' }, header.eyebrow || ''),
    el('h1',  { class: 'qb-artifact-header__title' }, header.title || ''),
    header.subtitle ? el('p', { class: 'qb-artifact-header__subtitle' }, header.subtitle) : null,
    el('div', { class: 'qb-artifact-header__meta' }, [
      el('span', { class: 'qb-artifact-header__agent' }, prettyAgent(header.agent || '')),
      el('span', { class: 'qb-artifact-header__dot' }),
      el('span', { class: 'qb-artifact-header__date' }, formatDateRich(header.generated_at)),
      header.version
        ? el('span', { class: 'qb-artifact-header__version' }, `v${header.version}`)
        : null,
    ]),
  ]);
}

/* ─── Illustration ────────────────────────────────────────── */
function buildIllustration(slot) {
  if (!slot || !ILLUSTRATION_SLOT_SET.has(slot)) return null;
  const figure = el('figure', { class: 'qb-artifact-section__illustration' }, [
    el('img', {
      src: `/img/illus/${slot}.png`,
      srcset: `/img/illus/${slot}.webp 1x, /img/illus/${slot}.png 2x`,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
    }),
  ]);
  return figure;
}

/* ─── Body section ────────────────────────────────────────── */
function buildBodySection(section) {
  return el('section', { class: 'qb-artifact-section' }, [
    el('h2', { class: 'qb-artifact-section__heading' }, section.heading || ''),
    Object.assign(renderProse(section.prose || ''), { className: 'qb-artifact-section__prose' }),
    section.pull_quote
      ? el('blockquote', { class: 'qb-artifact-section__pull-quote' }, section.pull_quote)
      : null,
    buildIllustration(section.illustration_slot),
  ]);
}

/* ─── Data blocks ─────────────────────────────────────────── */
function buildPalette(block) {
  const swatches = Array.isArray(block.content?.swatches) ? block.content.swatches : [];
  return el('div', { class: 'qb-data-block qb-palette' }, [
    el('h3', { class: 'qb-data-block__title' }, block.title || 'Palette'),
    el('div', { class: 'qb-palette__swatches' }, swatches.map(sw => el('div', { class: 'qb-palette__swatch' }, [
      el('div', { class: 'qb-palette__chip', style: { background: sw.hex || '#000' } }),
      el('div', { class: 'qb-palette__label' }, sw.label || ''),
      el('div', { class: 'qb-palette__hex' }, (sw.hex || '').toUpperCase()),
      el('p',   { class: 'qb-palette__rationale' }, sw.rationale || ''),
    ]))),
  ]);
}

function buildTypePairing(block) {
  const c = block.content || {};
  const display = c.display || {};
  const body    = c.body    || {};

  // Inline `font-family` only as a hint; do not auto-load arbitrary
  // Google Fonts at render time. The page-level type ladder carries
  // the actual fonts (Fraunces, Inter, JetBrains Mono).
  function panel(role, slot) {
    const style = slot.family
      ? { fontFamily: `'${slot.family.replace(/'/g, '')}', serif`, fontWeight: slot.weight || '400' }
      : {};
    return el('div', { class: `qb-type-pairing__panel qb-type-pairing__${role}` }, [
      el('span', { class: 'qb-type-pairing__role' }, role.charAt(0).toUpperCase() + role.slice(1)),
      el('p',    { class: 'qb-type-pairing__sample', style }, slot.family || '—'),
      el('p',    { class: 'qb-type-pairing__weight' }, slot.weight ? `Weight ${slot.weight}` : ''),
      el('p',    { class: 'qb-type-pairing__rationale' }, slot.rationale || ''),
    ]);
  }

  return el('div', { class: 'qb-data-block qb-type-pairing' }, [
    el('h3', { class: 'qb-data-block__title' }, block.title || 'Type direction'),
    el('div', { class: 'qb-type-pairing__pair' }, [
      panel('display', display),
      panel('body',    body),
    ]),
  ]);
}

function buildPositioningMap(block) {
  const c = block.content || {};
  const placements = Array.isArray(c.placements) ? c.placements : [];

  // SVG approach: a 100×100 viewBox keeps positioning numeric and
  // the rendered chart scales with the container. The container caps
  // at 480 px on desktop, full width on mobile.
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'qb-positioning-map__svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-label', `${c.x_axis?.low || ''} to ${c.x_axis?.high || ''} on x; ${c.y_axis?.low || ''} to ${c.y_axis?.high || ''} on y`);

  // Background field
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
  bg.setAttribute('width', '100'); bg.setAttribute('height', '100');
  bg.setAttribute('class', 'qb-positioning-map__bg');
  svg.appendChild(bg);

  // Cross-hair axes through the middle for orientation.
  const xLine = document.createElementNS(NS, 'line');
  xLine.setAttribute('x1', '0'); xLine.setAttribute('x2', '100');
  xLine.setAttribute('y1', '50'); xLine.setAttribute('y2', '50');
  xLine.setAttribute('class', 'qb-positioning-map__axis');
  const yLine = document.createElementNS(NS, 'line');
  yLine.setAttribute('x1', '50'); yLine.setAttribute('x2', '50');
  yLine.setAttribute('y1', '0');  yLine.setAttribute('y2', '100');
  yLine.setAttribute('class', 'qb-positioning-map__axis');
  svg.appendChild(xLine); svg.appendChild(yLine);

  // Placements
  placements.forEach((p, i) => {
    const cx = Math.max(0, Math.min(1, Number(p.x) || 0)) * 100;
    // Invert y: spec has high=top, but SVG y grows downward.
    const cy = (1 - Math.max(0, Math.min(1, Number(p.y) || 0))) * 100;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `qb-positioning-map__placement${p.is_self ? ' is-self' : ''}`);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', cx.toFixed(2));
    dot.setAttribute('cy', cy.toFixed(2));
    dot.setAttribute('r', p.is_self ? '3.4' : '1.8');
    dot.setAttribute('class', 'qb-positioning-map__dot');
    g.appendChild(dot);
    // Label: kept inside the SVG so it scales with the chart. Position
    // text below the dot; alignment per dot's x position keeps text in-frame.
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', cx.toFixed(2));
    lbl.setAttribute('y', (cy + (p.is_self ? 7 : 5)).toFixed(2));
    lbl.setAttribute('text-anchor', cx < 18 ? 'start' : cx > 82 ? 'end' : 'middle');
    lbl.setAttribute('class', 'qb-positioning-map__label');
    lbl.textContent = p.label || '';
    g.appendChild(lbl);
    svg.appendChild(g);
  });

  const chart = el('div', { class: 'qb-positioning-map__chart' });
  chart.appendChild(svg);

  // Axis labels around the SVG (DOM so they wrap with CSS).
  const xLowLabel  = el('div', { class: 'qb-positioning-map__axis-label is-x-low'  }, c.x_axis?.low  || '');
  const xHighLabel = el('div', { class: 'qb-positioning-map__axis-label is-x-high' }, c.x_axis?.high || '');
  const yLowLabel  = el('div', { class: 'qb-positioning-map__axis-label is-y-low'  }, c.y_axis?.low  || '');
  const yHighLabel = el('div', { class: 'qb-positioning-map__axis-label is-y-high' }, c.y_axis?.high || '');

  return el('div', { class: 'qb-data-block qb-positioning-map' }, [
    el('h3', { class: 'qb-data-block__title' }, block.title || 'The field'),
    el('div', { class: 'qb-positioning-map__frame' }, [
      yHighLabel,
      el('div', { class: 'qb-positioning-map__row' }, [
        yLowLabel,
        chart,
      ]),
      el('div', { class: 'qb-positioning-map__x-row' }, [
        xLowLabel,
        xHighLabel,
      ]),
    ]),
  ]);
}

function buildAlwaysNever(block) {
  const c = block.content || {};
  const always = Array.isArray(c.always) ? c.always : [];
  const never  = Array.isArray(c.never)  ? c.never  : [];
  function col(label, items, modifier) {
    return el('div', { class: `qb-always-never__column ${modifier}` }, [
      el('h4', { class: 'qb-always-never__column-title' }, label),
      el('ul', { class: 'qb-always-never__list' },
        items.map(t => el('li', { class: 'qb-always-never__item' }, t))),
    ]);
  }
  return el('div', { class: 'qb-data-block qb-always-never' }, [
    el('h3', { class: 'qb-data-block__title' }, block.title || 'Always / Never'),
    el('div', { class: 'qb-always-never__columns' }, [
      col('Always', always, 'qb-always-never__column--always'),
      col('Never',  never,  'qb-always-never__column--never'),
    ]),
  ]);
}

function buildPriorityList(block) {
  const items = Array.isArray(block.content?.items) ? block.content.items : [];
  return el('div', { class: 'qb-data-block qb-priority-list' }, [
    el('h3', { class: 'qb-data-block__title' }, block.title || 'Strategic priorities'),
    el('ol', { class: 'qb-priority-list__items' },
      items.map(it => el('li', { class: 'qb-priority-list__item' }, [
        el('span', { class: 'qb-priority-list__rank' }, String(it.rank ?? '')),
        el('div',  { class: 'qb-priority-list__body' }, [
          el('h4', { class: 'qb-priority-list__label' }, it.label || ''),
          el('p',  { class: 'qb-priority-list__rationale' }, it.rationale || ''),
        ]),
      ]))),
  ]);
}

function buildDescriptorList(block) {
  const groups = Array.isArray(block.content?.groups) ? block.content.groups : [];
  return el('div', { class: 'qb-data-block qb-descriptor-list' }, [
    el('h3', { class: 'qb-data-block__title' }, block.title || 'Descriptors'),
    el('div', { class: 'qb-descriptor-list__groups' }, groups.map(g => el('div', { class: 'qb-descriptor-list__group' }, [
      el('h4', { class: 'qb-descriptor-list__group-label' }, g.label || ''),
      el('ul', { class: 'qb-descriptor-list__items' },
        (Array.isArray(g.items) ? g.items : []).map(item => el('li', {}, item))),
    ]))),
  ]);
}

const DATA_BLOCK_BUILDERS = {
  palette: buildPalette,
  type_pairing: buildTypePairing,
  positioning_map: buildPositioningMap,
  always_never: buildAlwaysNever,
  priority_list: buildPriorityList,
  descriptor_list: buildDescriptorList,
};

/* ─── Footer ──────────────────────────────────────────────── */
function buildFooter(footer) {
  const f = footer || {};
  const fields = Array.isArray(f.qbp_fields_referenced) ? f.qbp_fields_referenced : [];
  const related = Array.isArray(f.related_artifacts) ? f.related_artifacts : [];
  return el('footer', { class: 'qb-artifact-footer' }, [
    fields.length ? el('div', { class: 'qb-artifact-footer__fields' }, [
      el('h3', { class: 'qb-artifact-footer__title' }, 'QBP fields referenced'),
      el('ul', { class: 'qb-artifact-footer__list' },
        fields.map(name => el('li', {}, name))),
    ]) : null,
    related.length ? el('div', { class: 'qb-artifact-footer__related' }, [
      el('h3', { class: 'qb-artifact-footer__title' }, 'Related artifacts'),
      el('ul', { class: 'qb-artifact-footer__list' },
        related.map(r => el('li', {}, [
          el('a', { href: `/artifact/${r.id}` }, r.title || r.id),
        ]))),
    ]) : null,
  ]);
}

/* ─── Public: renderArtifact ──────────────────────────────── */
export function renderArtifact(container, content, opts = {}) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('renderArtifact: container must be an HTMLElement');
  }
  // Defense in depth: re-validate client-side. If the database row drifted
  // post-write, render the failed state rather than a broken article.
  const v = validateArtifact(content);
  if (!v.valid) {
    return renderFailed(container, {
      title: content?.header?.title || null,
      agent_slug: content?.header?.agent || null,
      phase: opts.phase || null,
    }, { reason: 'schema_drift', validatorErrors: v.errors });
  }

  clear(container);
  const article = el('article', { class: 'qb-artifact-article' }, [
    buildHeader(content.header || {}),
    el('div', { class: 'qb-artifact-body' },
      (content.body_sections || []).map(buildBodySection)),
    el('div', { class: 'qb-artifact-blocks' },
      (content.data_blocks || []).map(b => {
        const builder = DATA_BLOCK_BUILDERS[b?.type];
        return builder ? builder(b) : null;
      })),
    buildFooter(content.footer || {}),
    createShareControls({
      artifactId: opts.artifactId || '',
      canDownloadPdf: !!opts.canDownloadPdf,
      canShareEmail:  !!opts.canShareEmail,
      onAction: opts.onShareAction || function () {},
    }),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderLocked ────────────────────────────────── */
export function renderLocked(container, artifactMeta = {}, paywallUrl = '/paywall?reason=artifact') {
  clear(container);
  const fakeHeader = {
    eyebrow: artifactMeta.phase
      ? `Phase ${artifactMeta.phase} · Locked`
      : 'Locked',
    title: artifactMeta.title || 'This artifact is locked.',
    agent: artifactMeta.agent_slug || '',
    generated_at: artifactMeta.generated_at || new Date().toISOString(),
    version: 1,
  };
  const frosted = el('div', { class: 'qb-artifact-locked-frost' }, [
    createPaywallModal({
      reason: 'artifact',
      eyebrow: 'Locked',
      headline: 'Unlock the rest of your foundation.',
      body: artifactMeta.lockedBody
        || 'Visual DNA, War Table, three remaining synthesis artifacts, and QBP export.',
      price: 'Starter, $97 / month. Cancel anytime.',
      primaryCta: 'Upgrade to Starter',
      secondaryCta: 'Back to Foundation',
      onPrimary: () => { window.location.href = paywallUrl; },
      onSecondary: () => { window.location.href = '/foundation'; },
    }),
  ]);
  const article = el('article', { class: 'qb-artifact-article is-locked' }, [
    buildHeader(fakeHeader),
    frosted,
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderFailed ────────────────────────────────── */
export function renderFailed(container, artifactMeta = {}, opts = {}) {
  clear(container);
  const fakeHeader = {
    eyebrow: 'Failed',
    title: artifactMeta.title || 'This artifact did not generate cleanly.',
    agent: artifactMeta.agent_slug || '',
    generated_at: new Date().toISOString(),
    version: 1,
  };

  const actions = el('div', { class: 'qb-artifact-failed__actions' }, [
    opts.canRegenerate
      ? el('button', {
          class: 'qb-button is-primary',
          type: 'button',
          on: { click: opts.onRegenerate || (() => {}) },
        }, [el('span', { class: 'qb-button_content' }, 'Try regenerating')])
      : null,
    el('a', {
      class: 'qb-button is-secondary',
      href: 'mailto:me@qtmbg.com?subject=Artifact%20generation%20failed',
    }, [el('span', { class: 'qb-button_content' }, 'Contact support')]),
  ]);

  const article = el('article', { class: 'qb-artifact-article is-failed' }, [
    buildHeader(fakeHeader),
    el('div', { class: 'qb-artifact-failed__body' }, [
      el('p', {}, 'This artifact did not generate successfully. We have been notified.'),
      opts.reason === 'schema_drift'
        ? el('p', { class: 'qb-artifact-failed__detail' }, 'The stored content does not match the current schema. Regenerating will produce a clean version.')
        : null,
      actions,
    ]),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderNotFound ──────────────────────────────── */
export function renderNotFound(container) {
  clear(container);
  const article = el('article', { class: 'qb-artifact-article is-not-found' }, [
    el('div', { class: 'qb-empty-state is-cold-start' }, [
      el('div', { class: 'qb-empty-state__eyebrow' }, 'Lost'),
      el('h1',  { class: 'qb-empty-state__headline' }, 'This artifact does not exist.'),
      el('p',   { class: 'qb-empty-state__body' }, 'It may have been removed, or the link is wrong.'),
      el('a',   { class: 'qb-button is-primary', href: '/foundation' }, [
        el('span', { class: 'qb-button_content' }, 'Back to Foundation'),
      ]),
    ]),
  ]);
  container.appendChild(article);
  return article;
}

/* ─── Public: renderLoading ───────────────────────────────── */
export function renderLoading(container) {
  clear(container);
  const article = el('article', { class: 'qb-artifact-article is-loading' }, [
    el('div', { class: 'qb-artifact-skeleton' }, [
      el('div', { class: 'qb-artifact-skeleton__eyebrow' }),
      el('div', { class: 'qb-artifact-skeleton__title' }),
      el('div', { class: 'qb-artifact-skeleton__title qb-artifact-skeleton__title--short' }),
      el('div', { class: 'qb-artifact-skeleton__section' }, [
        el('div', { class: 'qb-artifact-skeleton__heading' }),
        el('div', { class: 'qb-artifact-skeleton__line' }),
        el('div', { class: 'qb-artifact-skeleton__line' }),
        el('div', { class: 'qb-artifact-skeleton__line qb-artifact-skeleton__line--short' }),
      ]),
      el('div', { class: 'qb-artifact-skeleton__section' }, [
        el('div', { class: 'qb-artifact-skeleton__heading' }),
        el('div', { class: 'qb-artifact-skeleton__line' }),
        el('div', { class: 'qb-artifact-skeleton__line' }),
      ]),
    ]),
  ]);
  container.appendChild(article);
  return article;
}

const ArtifactRenderer = { renderArtifact, renderLocked, renderFailed, renderNotFound, renderLoading };
export default ArtifactRenderer;
