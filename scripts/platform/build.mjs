// scripts/platform/build.mjs
// The Platform · builds the $79 A4 document from a delivered foundation.
// Recut Phase 4 · docs/strategy/brandos-recut-v1.md Part 12.
//
//   node scripts/platform/build.mjs <foundation.json> [out.html]
//
// The product boundary this file implements, from Part 8 of the strategy
// note: THE SCREEN SHOWS WHAT WAS DECIDED, THE DOCUMENT SHOWS WHY. The
// app already shows every conclusion for free. What is sold here is the
// reasoning between the conclusions, which is why this renders the full
// body_sections prose of each artifact rather than a summary of it.
//
// Pagination is deterministic, not measured. Each page takes a character
// budget and long prose splits at paragraph boundaries, so the same
// foundation always produces the same document and the render harness
// (scripts/platform/render.mjs) can assert that no page clips its sheet.
// A budget overrun is a build-time decision, never a silent overflow.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Pagination is a greedy height packer, not one section per page.
// Costs are estimated in millimetres from the chassis type scale, and
// the renderer (scripts/platform/render.mjs) is the check on them: if a
// page clips, a cost here is wrong. Estimating rather than measuring
// keeps the build deterministic and offline, so the same foundation
// always produces the same document.
//
// Body box = 297 A4 minus 15mm top pad minus 19mm bottom pad and foot,
// then 10mm of margin against estimation error. 242 overflowed a page by
// 17px on the fixture; 236 was the first clean value, and 232 keeps four
// more millimetres of slack so a slightly denser real foundation does
// not clip. The renderer is the check: raise this only with its output.
const PAGE_CAPACITY_MM = 232;

const COST = {
  // Calibrated against rendered output, not derived from first
  // principles. The first pass used 92 chars per line and produced
  // pages 45% full, because Inter at 9.5pt across the 176mm measure
  // actually sets nearer 108 characters. Re-calibrate by running
  // tests/platform/platform-render.mjs, which reports mean fill and
  // fails both on overflow and on pages left too empty to be worth
  // printing.
  charsPerLine: 108,    // t-body 9.5pt across the 176mm measure
  lineMm: 4.9,          // 9.5pt x 1.48 line-height
  paraGap: 2.1,         // --s-2xs
  h2: 8.4,
  h3: 5.4,
  opener: 19,           // eyebrow + h1
  leadLineMm: 5.6,      // t-lead 11pt x 1.5
  cardPad: 7.4,         // --s-2xs top + --s-xs bottom + border
  listItem: 1.4,        // li margin
  rule: 10,
  swatchRow: 34,
};

const proseCost = (text, perLine = COST.charsPerLine, lineMm = COST.lineMm) =>
  Math.ceil(String(text).length / perLine) * lineMm + COST.paraGap;

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
  'family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..800,50..100,0..1;' +
  '1,9..144,300..800,50..100,0..1&family=Inter:wght@400..800&' +
  'family=JetBrains+Mono:wght@400..700&display=swap">';

// ─── helpers ────────────────────────────────────────────────────────────

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// The codex forbids the em dash in page text. A generated document is
// page text, and a model can still emit one despite the prompt, so the
// last line of defence is here: rewrite rather than ship a violation.
const deEmDash = (v) => String(v ?? '').replace(/\s*—\s*/g, '. ').replace(/\.\s*\.\s*/g, '. ');

const clean = (v) => esc(deEmDash(v));

// Split paragraphs into page-sized chunks without breaking a paragraph.
// A single paragraph longer than the budget gets its own page rather
// than being cut, which is the honest failure: the harness then reports
// the overflow and the budget or the prompt gets fixed.
// A flow block is one indivisible piece of the document with an
// estimated height. Pages are filled by packing blocks until the next
// one will not fit.
function block(html, cost, opts = {}) {
  return { html, cost, ...opts };
}

function proseBlocks(heading, prose, tag = 'h2') {
  const out = [];
  const cost = tag === 'h3' ? COST.h3 : COST.h2;
  if (heading) out.push(block(`<${tag}>${clean(heading)}</${tag}>`, cost, { keepWithNext: true }));
  for (const para of paragraphs(prose)) {
    out.push(block(`<p>${clean(para)}</p>`, proseCost(para)));
  }
  return out;
}

function paragraphs(prose) {
  return String(prose ?? '')
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Balanced packer. A purely greedy fill maximises each page and pushes
// the remainder onto a near-empty last sheet: the first version left
// pages at 17% and 8%, which reads as a mistake rather than as
// whitespace. So the page count is decided first, from the total cost,
// and the content is then spread evenly across that many pages.
//
// A block marked keepWithNext never ends a page alone, so a heading
// cannot be orphaned at the foot of a sheet.
function packPages(blocks, { opener, capacity = PAGE_CAPACITY_MM }) {
  const total = blocks.reduce((n, b) => n + b.cost, 0) + (opener ? opener.cost : 0);
  const sheets = Math.max(1, Math.ceil(total / capacity));
  // Spread across the sheets the content actually needs, never above the
  // real capacity. The 6mm of headroom lets a block that lands just over
  // the balanced target stay put instead of starting a new page.
  const target = Math.min(capacity, total / sheets + 6);

  const pages = [];
  let cur = [];
  let used = opener ? opener.cost : 0;
  let isFirst = true;

  const flush = () => {
    if (!cur.length) return;
    pages.push({ blocks: cur, opener: isFirst ? opener : null });
    isFirst = false;
    cur = [];
    used = 0;
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const pairCost = b.keepWithNext && blocks[i + 1] ? b.cost + blocks[i + 1].cost : b.cost;
    // Never exceed the hard capacity; prefer the balanced target while
    // pages remain to be filled.
    const limit = pages.length < sheets - 1 ? target : capacity;
    if (cur.length && used + pairCost > limit) flush();
    cur.push(b);
    used += b.cost;
  }
  flush();
  return pages;
}

// ─── page primitives ────────────────────────────────────────────────────

let PAGE_NO = 0;
const pageFoot = (label) => {
  PAGE_NO += 1;
  return `<div class="rf"><span>${clean(label)}</span><b>${String(PAGE_NO).padStart(2, '0')}</b></div>`;
};

function renderPage({ opener, blocks, foot, cls = '' }) {
  return `<section class="page ${cls}">
  ${opener ? opener.html : ''}
  ${blocks.map(b => b.html).join('\n  ')}
  ${pageFoot(foot)}
</section>`;
}

function page({ cls = '', eyebrow, h1, lead, body = '', foot }) {
  return `<section class="page ${cls}">
  ${eyebrow ? `<div class="eyebrow">${clean(eyebrow)}</div>` : ''}
  ${h1 ? `<h1>${h1}</h1>` : ''}
  ${lead ? `<p class="lead">${clean(lead)}</p>` : ''}
  ${body}
  ${pageFoot(foot)}
</section>`;
}

// ─── the document ───────────────────────────────────────────────────────

function coverPage(brand, generatedAt) {
  PAGE_NO += 1; // the cover counts in the sequence but carries no foot
  // Ivory with a gold italic, matching the client-document cover. The
  // chassis already owns .cover and sets background:var(--paper), so
  // page--ink here would only half-apply: ink text colour on an ivory
  // sheet. The markup below matches the chassis .k/.v meta structure
  // rather than inventing a second one.
  return `<section class="page cover">
  <div class="cover-top">
    <div class="cover-lockup">
      <span class="brandos-name">BrandOS</span>
      <span class="cover-by">by Quantum Branding</span>
    </div>
    <div class="micro">The Collapse</div>
  </div>
  <div>
    <h1 class="cover-h1">${clean(brand)}<br><em>brand platform</em></h1>
  </div>
  <div class="cover-meta">
    <div><span class="k">Methodology</span><span class="v">The Collapse</span></div>
    <div><span class="k">Cycle</span><span class="v">Observe, Collapse,<br>Build, Hold</span></div>
    <div><span class="k">Issued</span><span class="v">${clean(generatedAt)}</span></div>
    <div><span class="k">Version</span><span class="v">1.0</span></div>
  </div>
</section>`;
}

// Required by the strategy note Part 6.1: the document teaches its own
// reading. Written once here, costs nothing per customer, and removes a
// large share of the "beautiful but unusable" problem without a call.
function howToReadPage() {
  const body = `<div class="g2">
    <div class="card card--flat">
      <h3>A decision</h3>
      <p class="small">A sentence that closes something. It reads flat and final because it is. You can act on it without asking anyone.</p>
    </div>
    <div class="card card--flat">
      <h3>A description</h3>
      <p class="small">A sentence that reports what your answers contained. It is evidence for a decision, not a decision itself.</p>
    </div>
    <div class="card card--flat">
      <h3>An instruction</h3>
      <p class="small">A sentence that tells you or someone working for you what to do. Everything in the last two sections is one of these.</p>
    </div>
    <div class="card card--flat card--warm">
      <h3>An open question</h3>
      <p class="small">A decision your exercises did not force. It is named as a decision, not as a gap, so you can see what you would be choosing.</p>
    </div>
  </div>
  <div class="rule"></div>
  <p>Read it once end to end before you use any part of it. The order is the method: what you brought, what got decided, what it becomes, and what is still open. A section makes a different kind of sense out of sequence.</p>
  <p>Then work backwards. The last two sections are the ones you act on this week. Everything before them exists so that those two can be short.</p>`;
  return page({
    eyebrow: 'Before you start',
    h1: 'How to read <em>this.</em>',
    lead: 'Four kinds of sentence appear in this document. Telling them apart is most of the work.',
    body,
    foot: 'How to read this',
  });
}

function contentsPage(entries) {
  const rows = entries.map((e, i) =>
    `<tr><td class="micro">${String(i + 1).padStart(2, '0')}</td><td><strong>${clean(e.title)}</strong><br><span class="small muted">${clean(e.note)}</span></td></tr>`
  ).join('\n');
  return page({
    eyebrow: 'Contents',
    h1: 'What is <em>inside.</em>',
    body: `<table class="t-compact"><tbody>${rows}</tbody></table>`,
    foot: 'Contents',
  });
}

// Each artifact's body_sections ARE the reasoning. This is the part the
// screen does not show and the part the $79 buys.
//
// A page-opening division is a MOVEMENT, not an artifact. Grouping this
// way was not cosmetic: one page per artifact left every sheet about
// half full, because a single agent's output is roughly half a page.
// Four movements also matches the architecture the site now runs on.
function movementPages({ movement, numeral, title, note, members, artifacts }) {
  const opener = {
    cost: COST.opener + (note ? proseCost(note, 92, COST.leadLineMm) : 0),
    html: `<div class="eyebrow">${clean(movement)} · ${clean(numeral)}</div>
  <h1>${title}</h1>
  ${note ? `<p class="lead">${clean(note)}</p>` : ''}`,
  };

  const blocks = [];
  members.forEach((m, i) => {
    const content = artifacts[m.key]?.content;
    if (i > 0) blocks.push(block('<div class="rule"></div>', COST.rule));
    blocks.push(block(`<h2>${clean(m.label)}</h2>`, COST.h2, { keepWithNext: true }));
    if (!content) {
      // Never invent a section to fill a gap. Say what is missing.
      blocks.push(block(
        `<div class="card card--warm"><p class="small">This section could not be written, because the underlying exercise was not delivered. Nothing has been invented to fill the space.</p></div>`, 20));
      return;
    }
    for (const sec of (content.body_sections || [])) {
      blocks.push(...proseBlocks(sec.heading, sec.prose, 'h3'));
    }
    for (const b of (content.data_blocks || [])) {
      blocks.push(...dataBlocks(b));
    }
  });

  return packPages(blocks, { opener }).map(pg =>
    renderPage({ opener: pg.opener, blocks: pg.blocks, foot: movement })
  );
}

// Data blocks become flow blocks with their own estimated heights, so
// they pack alongside prose instead of each claiming a page.
function dataBlocks(b) {
  const title = b.title || b.type;
  const head = block(`<h3>${clean(title)}</h3>`, COST.h3, { keepWithNext: true });

  if (b.type === 'priority_list') {
    const items = b.content?.items || [];
    return [head, ...items.map(it => block(
      `<div class="card card--flat" style="margin-bottom:var(--s-2xs)">
        <h3>${String(it.rank).padStart(2, '0')} · ${clean(it.label)}</h3>
        <p class="small">${clean(it.rationale)}</p>
      </div>`,
      COST.cardPad + COST.h3 + proseCost(it.rationale, 118, 4.4)
    ))];
  }

  if (b.type === 'descriptor_list') {
    const out = [head];
    for (const g of (b.content?.groups || [])) {
      const items = (g.items || []);
      out.push(block(`<p class="micro">${clean(g.label)}</p>`, COST.h3, { keepWithNext: true }));
      out.push(block(
        `<ul class="clean">${items.map(x => `<li>${clean(x)}</li>`).join('')}</ul>`,
        items.reduce((n, x) => n + proseCost(x, 102, 4.6) + COST.listItem, 0)
      ));
    }
    return out;
  }

  if (b.type === 'always_never') {
    const c = b.content || {};
    const a = c.always || [], n = c.never || [];
    const rows = Math.max(a.length, n.length);
    return [head, block(
      `<div class="g2">
        <div class="card card--flat"><h3>Always</h3><ul class="clean">${a.map(x => `<li>${clean(x)}</li>`).join('')}</ul></div>
        <div class="card card--flat card--warm"><h3>Never</h3><ul class="clean">${n.map(x => `<li>${clean(x)}</li>`).join('')}</ul></div>
      </div>`,
      COST.cardPad + COST.h3 + rows * (COST.lineMm + COST.listItem) + 4
    )];
  }

  if (b.type === 'palette') {
    const sw = (b.content?.swatches || []);
    return [head, block(
      `<div class="g4">${sw.map(x =>
        `<div class="card card--flat" style="padding:0;overflow:hidden">
           <div style="height:22mm;background:${esc(x.hex || '#EDEBE1')}"></div>
           <div style="padding:var(--s-2xs)"><strong class="small">${clean(x.name || x.hex)}</strong><br><span class="micro">${clean(x.hex)}</span></div>
         </div>`).join('')}</div>`,
      COST.swatchRow * Math.ceil(sw.length / 4) + 4
    )];
  }

  // Anything unrecognised renders as labelled prose rather than being
  // dropped, so a new block type degrades instead of disappearing.
  const text = JSON.stringify(b.content);
  return [head, block(`<p class="small">${clean(text)}</p>`, proseCost(text, 124, 4.4))];
}

// Required by the strategy note Part 6.1, the back half of the pair.
function mondayPage(open) {
  const top = (open || []).slice(0, 3);
  const items = top.length
    ? top.map(o => `<li><strong>${clean(o.label)}.</strong> ${clean(o.rationale)}</li>`).join('')
    : '<li><strong>Nothing is blocking you.</strong> The exercises settled what they were built to settle.</li>';
  return page({
    eyebrow: 'Monday',
    h1: 'What to do <em>first.</em>',
    lead: 'Three things, in this order. Everything else in this document can wait until they are done.',
    body: `<ol>${items}</ol>
    <div class="rule"></div>
    <h2>Then hand it over</h2>
    <p>Send the Build section to whoever makes things for you. A designer needs the logo direction and the palette. A writer needs the voice. Neither needs the rest, and giving them the rest slows them down.</p>
    <h2>Then leave it alone</h2>
    <p>A brand platform is not improved by being revisited weekly. Put a date ninety days out and look at it then, against what actually happened.</p>`,
    foot: 'Monday',
  });
}

// The door. No price, no calendar, no package, per Part 6 of the note.
function doorPage(open) {
  const needsPerson = (open || []).length > 0;
  return page({
    cls: 'page--ink',
    eyebrow: 'The last page',
    h1: needsPerson ? 'What a document <em>cannot do.</em>' : 'Where this <em>leaves you.</em>',
    lead: needsPerson
      ? 'Some of what is still open will not be settled by another exercise.'
      : 'Your exercises settled what they were built to settle.',
    body: needsPerson
      ? `<p>The open questions in this document are not gaps in the work. They are the decisions your own answers did not force, and a few of them need someone to argue the other side before you can close them.</p>
         <p>That is the part a system does not do. If you want it, write to <strong>me@qtmbg.com</strong> with this document attached and say which question you are stuck on. You will get a reply from Nizzar, not from a form.</p>
         <div class="rule"></div>
         <p class="micro">BrandOS is a product of Quantum Branding, the independent practice founded by Nizzar Ben Chekroune. thequantumbranding.com</p>`
      : `<p>Take it to the people who build. Come back in ninety days with what happened.</p>
         <div class="rule"></div>
         <p class="micro">BrandOS is a product of Quantum Branding, the independent practice founded by Nizzar Ben Chekroune. thequantumbranding.com</p>`,
    foot: 'The door',
  });
}

// ─── entry point ────────────────────────────────────────────────────────

export function buildPlatform(foundation) {
  PAGE_NO = 0;
  const qbp = foundation?.qbp || {};
  const art = foundation?.artifacts || {};
  const brand = (typeof qbp.brandName === 'string' && qbp.brandName.trim()) ? qbp.brandName.trim() : 'Your Brand';
  const issued = foundation?.issued_at || new Date().toISOString().slice(0, 10);

  const openItems =
    (art.open_questions_agent?.content?.data_blocks || [])
      .find(b => b.type === 'priority_list')?.content?.items || [];

  const MOVEMENTS = [
    { movement: 'Observe',  numeral: 'I',   title: 'What you <em>brought.</em>',
      note: 'Your own answers, read back to you and traced to what they decided.',
      members: [
        { key: 'soul_map_synthesizer',   label: 'The soul map' },
        { key: 'sensescape_synthesizer', label: 'The sensescape' },
      ] },
    { movement: 'Collapse', numeral: 'II',  title: 'What got <em>decided.</em>',
      note: 'One direction in each place a direction was needed, and the ones it rules out.',
      members: [
        { key: 'visual_dna_synthesizer', label: 'The palette' },
        { key: 'war_table_synthesizer',  label: 'The position' },
      ] },
    { movement: 'Build',    numeral: 'III', title: 'What it <em>becomes.</em>',
      note: 'The decision as an object. Something a designer can work from and a writer can write to.',
      members: [
        { key: 'logo_direction_agent', label: 'The logo brief' },
        { key: 'voice_guide_agent',    label: 'The voice' },
      ] },
    { movement: 'Open',     numeral: 'IV',  title: 'What this does <em>not settle.</em>',
      note: 'The honest audit. What your answers decided, and what they left open.',
      members: [
        { key: 'open_questions_agent', label: 'The open questions' },
      ] },
  ];

  // A movement whose artifacts were all undelivered is dropped rather
  // than rendered empty.
  const present = MOVEMENTS
    .map(m => ({ ...m, members: m.members.filter(x => art[x.key]?.content) }))
    .filter(m => m.members.length > 0);

  const pages = [];
  pages.push(coverPage(brand, issued));
  pages.push(howToReadPage());
  pages.push(contentsPage([
    ...present.map(m => ({ title: m.title.replace(/<[^>]+>/g, ''), note: m.note })),
    { title: 'What to do first', note: 'Three things, in order, for the week after you read this.' },
  ]));
  for (const m of present) {
    pages.push(...movementPages({ ...m, artifacts: art }));
  }
  pages.push(mondayPage(openItems));
  pages.push(doorPage(openItems));

  const css = readFileSync(path.join(HERE, 'chassis.css'), 'utf8');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${esc(brand)} brand platform · BrandOS</title>
${FONT_LINK}
<style>
${css}
/* Document-local · only what the chassis does not already own. */
.cover-lockup{height:auto; font-family:var(--f-display); font-size:12pt; line-height:1.05;
  font-variation-settings:"wght" 720,"opsz" 72,"SOFT" 60;}
.cover-by{display:block; font-family:var(--f-mono); font-size:6.4pt; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ink-62); margin-top:1.4mm;}
/* CLAUDE.md check 4 · the name never takes a case transform, in CSS or prose. */
.brandos-name, .qb-lockup_name{text-transform:none !important;}
.t-compact{width:100%; border-collapse:collapse;}
.t-compact td{padding:2.4mm 0; border-bottom:0.3mm solid var(--ink-12); vertical-align:top;}
.t-compact td:first-child{width:12mm; color:var(--ink-50);}
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('build.mjs')) {
  const src = process.argv[2];
  if (!src) { console.error('usage: node scripts/platform/build.mjs <foundation.json> [out.html]'); process.exit(2); }
  const foundation = JSON.parse(readFileSync(src, 'utf8'));
  const html = buildPlatform(foundation);
  const out = process.argv[3] || src.replace(/\.json$/, '.html');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(out, html);
  console.log(`platform built → ${out} · ${(html.match(/class="page/g) || []).length} pages`);
}
