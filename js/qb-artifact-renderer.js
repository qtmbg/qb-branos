/* QB BrandOS — Artifact reading-surface renderer
   Last updated: 2026-06-14 · designed component set (Chapter 5 gate)
   Visual spec: docs/design/reading-surface-reference.html
   CSS: /css/qb-reading-surface.css (scoped under .qb-rs)

   One template, every agent. renderArtifact is a pure function of the
   schema-conforming content object delivered by /api/artifacts/[id]. No
   agent-specific branches. The renderer composes a small set of designed
   components (masthead, standfirst, prose-section, card family, principles
   two-up, chips, actions); every schema data_block type maps onto one.

   Binding rules enforced structurally here:
     - No multi-column text. descriptor groups are full-width stacked cards
       (one per group); always/never is a two-up that stacks below 620px.
       No block emits parallel columns of wrapping prose.
     - No bullet dots. List items use the spec-line treatment (hairline top
       rule + accent square marker) or the typed +/em markers for
       always/never. The CSS owns the markers.

   Exports:
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
function zeroPad(n) {
  const num = Number(n);
  return Number.isFinite(num) ? String(num).padStart(2, '0') : String(n ?? '');
}

/* Restricted markdown: paragraphs (\n\n), **bold**, *italic*. No headings,
   lists, links, images, or raw HTML. The schema validator enforces this at
   write time; the renderer enforces it at read time as defense in depth. */
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
  const wrap = el('div', { class: 'qb-rs-prose' });
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

/* ─── Header (state renderers only · qb-components.css) ────── */
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

/* ─── Masthead (.qb-rs) ───────────────────────────────────── */
function buildMasthead(header) {
  const meta = [
    prettyAgent(header.agent || ''),
    formatDateRich(header.generated_at),
    header.version ? `v${header.version}` : null,
  ].filter(Boolean).join(' · ');
  return el('header', { class: 'qb-rs-masthead' }, [
    header.eyebrow ? el('span', { class: 'qb-rs-tag' }, header.eyebrow) : null,
    el('h1', { class: 'qb-rs-title' }, header.title || ''),
    el('p', { class: 'qb-rs-meta' }, meta),
    el('hr', { class: 'qb-rs-rule' }),
  ]);
}

/* ─── Standfirst (optional · header.subtitle) ─────────────── */
function buildStandfirst(header) {
  if (!header || !header.subtitle) return null;
  return el('p', { class: 'qb-rs-standfirst' }, header.subtitle);
}

/* ─── Illustration ────────────────────────────────────────── */
function buildIllustration(slot) {
  if (!slot || !ILLUSTRATION_SLOT_SET.has(slot)) return null;
  return el('figure', { class: 'qb-rs-illus' }, [
    el('img', {
      src: `/img/illus/${slot}.png`,
      srcset: `/img/illus/${slot}.webp 1x, /img/illus/${slot}.png 2x`,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
    }),
  ]);
}

/* ─── Prose section ───────────────────────────────────────── */
/* The agents emit a single short heading per body_section, which is the
   reference's eyebrow text; render it as the gold-deep eyebrow, then prose
   at the 62ch measure. (The reference also pairs a Fraunces h2 with each
   eyebrow; that second-level text is not in the agent output and would need
   a prompt change, out of scope here.) */
function buildBodySection(section) {
  return el('section', { class: 'qb-rs-section' }, [
    section.heading ? el('span', { class: 'qb-rs-eyebrow' }, section.heading) : null,
    renderProse(section.prose || ''),
    section.pull_quote
      ? el('blockquote', { class: 'qb-rs-pull-quote' }, section.pull_quote)
      : null,
    buildIllustration(section.illustration_slot),
  ]);
}

/* ─── Card family ─────────────────────────────────────────── */
function specLines(items, accentNote) {
  return el('ul', { class: 'qb-rs-specs' },
    items.filter(s => String(s || '').length > 0)
      .map(s => el('li', {}, String(s))));
}
function buildCard({ num, name, concept, specLabel, specs, accent }) {
  return el('article', { class: 'qb-rs-card', dataset: { accent: String(accent) } }, [
    el('div', { class: 'qb-rs-card-head' }, [
      num != null ? el('span', { class: 'qb-rs-card-num' }, num) : null,
      el('span', { class: 'qb-rs-card-name' }, name || ''),
    ]),
    concept ? el('p', { class: 'qb-rs-card-concept' }, concept) : null,
    (specs && specs.length)
      ? el('div', {}, [
          specLabel ? el('p', { class: 'qb-rs-spec-label' }, specLabel) : null,
          specLines(specs),
        ])
      : null,
  ]);
}

/* descriptor_list · one full-width card per group. If the first item is a
   long concept (the "directions" shape: items[0] is the concept paragraph,
   the rest are short qualities), it becomes the card concept and the rest
   spec-lines; otherwise all items are spec-lines. Never columns. */
function splitConcept(items) {
  const arr = (Array.isArray(items) ? items : []).map(String).filter(s => s.length > 0);
  if (arr.length >= 2 && arr[0].length > 130) {
    return { concept: arr[0], specs: arr.slice(1) };
  }
  return { concept: null, specs: arr };
}
function buildDescriptorList(block) {
  const groups = Array.isArray(block.content?.groups) ? block.content.groups : [];
  return el('div', { class: 'qb-rs-cards' }, groups.map((g, i) => {
    const { concept, specs } = splitConcept(g.items);
    return buildCard({
      num: zeroPad(i + 1),
      name: g.label || `Item ${i + 1}`,
      concept,
      specLabel: concept ? 'Qualities' : null,
      specs,
      accent: i % 3,
    });
  }));
}

/* priority_list · keep the numbered treatment, one full-width card per
   item, rank as the big accent numeral. Never columns. */
function buildPriorityList(block) {
  const items = Array.isArray(block.content?.items) ? block.content.items : [];
  return el('div', { class: 'qb-rs-cards' }, items.map((it, i) => {
    const rank = Number.isInteger(it.rank) && it.rank >= 1 ? it.rank : i + 1;
    return buildCard({
      num: zeroPad(rank),
      name: it.label || `Change ${rank}`,
      concept: it.rationale || '',
      specs: null,
      accent: (rank - 1) % 3,
    });
  }));
}

/* always_never · principles two-up (stacks below 620px). Typed +/em markers
   in teal-deep / rose-deep, owned by the CSS. */
function buildAlwaysNever(block) {
  const c = block.content || {};
  const always = Array.isArray(c.always) ? c.always : [];
  const never  = Array.isArray(c.never)  ? c.never  : [];
  function pcard(label, items, mod) {
    return el('div', { class: `qb-rs-pcard ${mod}` }, [
      el('h3', {}, label),
      el('ul', {}, items.filter(t => String(t || '').length > 0).map(t => el('li', {}, String(t)))),
    ]);
  }
  return el('div', { class: 'qb-rs-principles' }, [
    pcard('Always', always, 'is-always'),
    pcard('Never',  never,  'is-never'),
  ]);
}

/* palette · visual swatch tiles (stack on mobile). Not prose columns. */
function buildPalette(block) {
  const swatches = Array.isArray(block.content?.swatches) ? block.content.swatches : [];
  return el('div', { class: 'qb-rs-palette' }, swatches.map(sw => el('div', { class: 'qb-rs-swatch' }, [
    el('div', { class: 'qb-rs-swatch-chip', style: { background: sw.hex || '#000' } }),
    el('div', { class: 'qb-rs-swatch-body' }, [
      el('div', { class: 'qb-rs-swatch-label' }, sw.label || ''),
      el('div', { class: 'qb-rs-swatch-hex' }, (sw.hex || '').toUpperCase()),
      el('p',   { class: 'qb-rs-swatch-rationale' }, sw.rationale || ''),
    ]),
  ])));
}

/* type_pairing · two panels (stack below 620px). */
function buildTypePairing(block) {
  const c = block.content || {};
  function panel(role, slot) {
    slot = slot || {};
    const style = slot.family
      ? { fontFamily: `'${String(slot.family).replace(/'/g, '')}', serif` }
      : {};
    return el('div', { class: 'qb-rs-panel' }, [
      el('span', { class: 'qb-rs-panel-role' }, role),
      el('p', { class: 'qb-rs-panel-sample', style }, slot.family || '—'),
      el('p', { class: 'qb-rs-panel-weight' }, slot.weight ? `Weight ${slot.weight}` : ''),
      el('p', { class: 'qb-rs-panel-rationale' }, slot.rationale || ''),
    ]);
  }
  return el('div', { class: 'qb-rs-pairing' }, [
    panel('Display', c.display),
    panel('Body',    c.body),
  ]);
}

/* positioning_map · SVG chart in a card. */
function buildPositioningMap(block) {
  const c = block.content || {};
  const placements = Array.isArray(c.placements) ? c.placements : [];
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-label', `${c.x_axis?.low || ''} to ${c.x_axis?.high || ''} on x; ${c.y_axis?.low || ''} to ${c.y_axis?.high || ''} on y`);
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
  bg.setAttribute('width', '100'); bg.setAttribute('height', '100');
  bg.setAttribute('class', 'qb-rs-map-bg');
  svg.appendChild(bg);
  for (const [x1, y1, x2, y2] of [[0, 50, 100, 50], [50, 0, 50, 100]]) {
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
    ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    ln.setAttribute('class', 'qb-rs-map-axis');
    svg.appendChild(ln);
  }
  placements.forEach(p => {
    const cx = Math.max(0, Math.min(1, Number(p.x) || 0)) * 100;
    const cy = (1 - Math.max(0, Math.min(1, Number(p.y) || 0))) * 100;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `qb-rs-map-placement${p.is_self ? ' is-self' : ''}`);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', cx.toFixed(2)); dot.setAttribute('cy', cy.toFixed(2));
    dot.setAttribute('r', p.is_self ? '3.4' : '1.8');
    dot.setAttribute('class', 'qb-rs-map-dot');
    g.appendChild(dot);
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', cx.toFixed(2));
    lbl.setAttribute('y', (cy + (p.is_self ? 7 : 5)).toFixed(2));
    lbl.setAttribute('text-anchor', cx < 18 ? 'start' : cx > 82 ? 'end' : 'middle');
    lbl.setAttribute('class', 'qb-rs-map-label');
    lbl.textContent = p.label || '';
    g.appendChild(lbl);
    svg.appendChild(g);
  });
  const card = el('div', { class: 'qb-rs-map' });
  card.appendChild(svg);
  if (c.x_axis?.low || c.x_axis?.high) {
    card.appendChild(el('div', { class: 'qb-rs-map-axis-row' }, [
      el('span', { class: 'qb-rs-map-axis-label' }, c.x_axis?.low || ''),
      el('span', { class: 'qb-rs-map-axis-label' }, c.x_axis?.high || ''),
    ]));
  }
  return card;
}

/* content_pack · ordered compound records with long-form bodies (posts,
   newsletter issues, video scripts, repurposed pieces, scheduled slots).
   One full-width stacked card per item, per the reference treatment:
   accent index numeral rotation, kicker chip, Fraunces title, mono meta
   chips, prose body at the reading measure, spec-lines, tag chips, and
   nested extras. Never columns of wrapping text. */
function buildContentPack(block) {
  const items = Array.isArray(block.content?.items) ? block.content.items : [];
  return el('div', { class: 'qb-rs-cards' }, items.map((it, i) => {
    const card = el('article', { class: 'qb-rs-card', dataset: { accent: String(i % 3) } });
    card.appendChild(el('div', { class: 'qb-rs-card-head' }, [
      el('span', { class: 'qb-rs-card-num' }, zeroPad(i + 1)),
      el('span', { class: 'qb-rs-card-name' }, it.title || `Piece ${i + 1}`),
    ]));
    if (it.kicker || (it.meta && it.meta.length)) {
      card.appendChild(el('div', { class: 'qb-rs-pack-chips' }, [
        it.kicker ? el('span', { class: 'qb-rs-pack-kicker' }, it.kicker) : null,
        ...(Array.isArray(it.meta) ? it.meta : []).map(m => el('span', { class: 'qb-rs-chip' }, m)),
      ]));
    }
    card.appendChild(Object.assign(renderProse(it.body || ''), { className: 'qb-rs-prose qb-rs-pack-body' }));
    if (Array.isArray(it.specs) && it.specs.length) {
      card.appendChild(specLines(it.specs));
    }
    if (Array.isArray(it.extras) && it.extras.length) {
      card.appendChild(el('div', { class: 'qb-rs-pack-extras' }, it.extras.map(ex =>
        el('div', { class: 'qb-rs-pack-extra' }, [
          el('p', { class: 'qb-rs-spec-label' }, ex.label || ''),
          Object.assign(renderProse(ex.body || ''), { className: 'qb-rs-prose qb-rs-pack-extra-body' }),
        ])
      )));
    }
    if (Array.isArray(it.tags) && it.tags.length) {
      card.appendChild(el('div', { class: 'qb-rs-chips qb-rs-pack-tags' },
        it.tags.map(t => el('span', { class: 'qb-rs-chip' }, t))));
    }
    return card;
  }));
}

/* numbered_procedure · do-this-then-that. One card, ordered rows with the
   accent step numeral, action lead, detail after. Spec-line rhythm. */
function buildNumberedProcedure(block) {
  const steps = Array.isArray(block.content?.steps) ? block.content.steps : [];
  return el('div', { class: 'qb-rs-card qb-rs-proc' }, [
    el('ol', { class: 'qb-rs-proc-steps' }, steps.map((st, i) =>
      el('li', { class: 'qb-rs-proc-step' }, [
        el('span', { class: 'qb-rs-proc-num' }, zeroPad(i + 1)),
        el('div', { class: 'qb-rs-proc-body' }, [
          el('p', { class: 'qb-rs-proc-action' }, st.action || ''),
          st.detail ? el('p', { class: 'qb-rs-proc-detail' }, st.detail) : null,
        ]),
      ]))),
  ]);
}

/* spec_grid · label/value tiles, two-up above 620px, stacked below. */
function buildSpecGrid(block) {
  const specs = Array.isArray(block.content?.specs) ? block.content.specs : [];
  return el('div', { class: 'qb-rs-grid' }, specs.map(s =>
    el('div', { class: 'qb-rs-grid-tile' }, [
      el('span', { class: 'qb-rs-grid-label' }, s.label || ''),
      el('p', { class: 'qb-rs-grid-value' }, s.value || ''),
    ])));
}

const DATA_BLOCK_BUILDERS = {
  palette: buildPalette,
  type_pairing: buildTypePairing,
  positioning_map: buildPositioningMap,
  always_never: buildAlwaysNever,
  priority_list: buildPriorityList,
  descriptor_list: buildDescriptorList,
  content_pack: buildContentPack,
  numbered_procedure: buildNumberedProcedure,
  spec_grid: buildSpecGrid,
};

/* Each data block sits in its own section: the block title is the Fraunces
   h2 (the reference's data-block-section heading), then the component. */
function buildDataBlockSection(block) {
  const builder = DATA_BLOCK_BUILDERS[block?.type];
  if (!builder) return null;
  return el('section', { class: 'qb-rs-section' }, [
    block.title ? el('h2', { class: 'qb-rs-h2' }, block.title) : null,
    builder(block),
  ]);
}

/* ─── Footer · QBP chips ──────────────────────────────────── */
function buildChips(footer) {
  const f = footer || {};
  const fields = Array.isArray(f.qbp_fields_referenced) ? f.qbp_fields_referenced : [];
  if (!fields.length) return null;
  return el('section', { class: 'qb-rs-section qb-rs-qbp' }, [
    el('span', { class: 'qb-rs-eyebrow' }, 'QBP fields referenced'),
    el('div', { class: 'qb-rs-chips' }, fields.map(name => el('span', { class: 'qb-rs-chip' }, name))),
  ]);
}

/* ─── Actions · pill buttons (reference treatment) ────────── */
function buildActions(opts) {
  const onAction = typeof opts.onShareAction === 'function' ? opts.onShareAction : () => {};
  const defs = [
    { action: 'download', label: 'Download PDF', when: !!opts.canDownloadPdf },
    { action: 'copy-link', label: 'Copy link', when: true },
    { action: 'print', label: 'Print', when: true },
    { action: 'email', label: 'Email', when: !!opts.canShareEmail },
  ].filter(d => d.when);
  if (!defs.length) return null;
  // Primary = Download PDF when available, else the first action (Copy link).
  let primaryAssigned = false;
  return el('div', { class: 'qb-rs-actions' }, defs.map(d => {
    const isPrimary = !primaryAssigned && (d.action === 'download' || (!opts.canDownloadPdf && d.action === 'copy-link'));
    if (isPrimary) primaryAssigned = true;
    return el('button', {
      class: `qb-rs-btn${isPrimary ? ' is-primary' : ''}`,
      type: 'button',
      on: { click: (ev) => onAction(d.action, ev) },
    }, d.label);
  }));
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
  const article = el('article', { class: 'qb-rs' }, [
    buildMasthead(content.header || {}),
    buildStandfirst(content.header || {}),
    ...(content.body_sections || []).map(buildBodySection),
    ...(content.data_blocks || []).map(buildDataBlockSection),
    buildChips(content.footer || {}),
    buildActions(opts),
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
