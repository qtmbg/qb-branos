#!/usr/bin/env node
/**
 * QB OG image generator.
 * Renders scripts/og-template.html with per-page params via Playwright
 * and saves PNGs to /img/brand/og/.
 *
 * Usage: node scripts/gen-og-images.mjs
 */
import { chromium } from '/Users/drazicq/drazicq/node_modules/playwright/index.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = resolve(__dirname, '..');
const TEMPLATE = resolve(__dirname, 'og-template.html');
const OUT_DIR  = resolve(ROOT, 'img', 'brand', 'og');

if(!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// slug = filename minus .html, with the predictive-panel double-dot kept.
// h supports *emphasis* markers.
const PAGES = [
  // Marketing / infra
  { slug:'index',              e:'Quantum Branding · home',         a:'gold',          h:'Idea in. *Brand out.*' },
  { slug:'signal-scan',        e:'Free brand diagnostic',           a:'gold',          h:'*Signal Scan.* Eight questions. Five minutes.', s:'tight' },
  { slug:'ecosystem',          e:'QB BrandOS · ecosystem',          a:'gold',          h:'The brand *operating system.*', s:'small' },
  { slug:'payment',            e:'Access · QB BrandOS',             a:'gold',          h:'*Pick your plan.* Open the system.', s:'tight' },
  { slug:'tools',              e:'QB BrandOS · tools',              a:'gold',          h:'Twenty *agents.* Six phases.' },
  { slug:'journey-guide',      e:'QB BrandOS · journey guide',      a:'gold',          h:'Your guided *journey.*' },
  { slug:'qb-branidos-hub',    e:'QB BrandOS · command center',     a:'gold',          h:'Your *command center.*' },

  // Phase 01 — Discovery
  { slug:'the-profiles',       e:'Phase 01 · the profiles',         a:'discovery',     h:'*Three* full personas. Now, next, north star.', s:'tight' },
  { slug:'archetype-compass',  e:'Phase 01 · archetype compass',    a:'discovery',     h:'Twelve archetypes. *One* north.' },
  { slug:'visual-dna',         e:'Phase 01 · visual DNA',           a:'discovery',     h:'Trust your eye. *Build the look.*', s:'tight' },
  { slug:'war-table',          e:'Phase 01 · the war table',        a:'discovery',     h:'The *competitive* ground truth.' },
  { slug:'sensescape',         e:'Phase 01 · sensescape',           a:'discovery',     h:'Before a brand speaks, *it is felt.*', s:'tight' },
  { slug:'brand-soul-map',     e:'Phase 01 · brand soul map',       a:'discovery',     h:'Find the *true* center.' },

  // Phase 03 — Brand creation
  { slug:'logo-direction-agent',  e:'Phase 03 · logo direction',    a:'creation',      h:'Direction *before* design.' },
  { slug:'logo-evaluation-agent', e:'Phase 03 · logo evaluation',   a:'creation',      h:'Evaluate *every* mark.' },
  { slug:'voice-guide-agent',     e:'Phase 03 · voice guide',       a:'creation',      h:'*Voice* in writing.' },

  // Phase 04 — Content
  { slug:'instagram-seed-agent',       e:'Phase 04 · instagram seed',    a:'content',  h:'*Seed* a feed that holds.' },
  { slug:'linkedin-strategy-agent',    e:'Phase 04 · linkedIn strategy', a:'content',  h:'*LinkedIn* with weight.' },
  { slug:'youtube-strategy-agent',     e:'Phase 04 · youTube strategy',  a:'content',  h:'A *YouTube* with a spine.' },
  { slug:'newsletter-architecture-agent', e:'Phase 04 · newsletter',     a:'content',  h:'*Newsletter* architecture.' },
  { slug:'content-bridge',             e:'Phase 04 · content bridge',    a:'content',  h:'Bridge to *content.*' },
  { slug:'content-repurposing-engine', e:'Phase 04 · repurposing',       a:'content',  h:'Repurpose *with* intent.' },
  { slug:'content-scheduler',          e:'Phase 04 · scheduler',         a:'content',  h:'*Schedule* the season.' },

  // Phase 05 — Execution
  { slug:'predictive-panel.',  e:'Phase 05 · predictive panel',     a:'execution',    h:'Predict the *next* signal.' },

  // Phase 06 — Intelligence
  { slug:'brand-performance-dashboard',  e:'Phase 06 · dashboard',     a:'intelligence', h:'Performance on *one* page.' },
  { slug:'quarterly-brand-review-agent', e:'Phase 06 · QBR review',    a:'intelligence', h:'*Quarterly* review.' },

  // Legal / utility
  { slug:'terms',              e:'Quantum Branding · legal',        a:'ink',          h:'Terms of *service.*' },
  { slug:'privacy',            e:'Quantum Branding · legal',        a:'ink',          h:'Privacy *policy.*' },
  { slug:'404',                e:'Quantum Branding · 404',          a:'ink',          h:'Lost *signal.*' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

let okCount = 0;
for(const p of PAGES){
  const params = new URLSearchParams({ e: p.e, a: p.a, h: p.h });
  if(p.s) params.set('s', p.s);
  if(p.d) params.set('d', p.d);
  const url = pathToFileURL(TEMPLATE).href + '?' + params.toString();

  await page.goto(url, { waitUntil: 'networkidle' });
  // Make sure Fraunces variable-font axes load before snapping.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 120));
  });

  const out = resolve(OUT_DIR, `${p.slug}.png`);
  await page.screenshot({ path: out, omitBackground: false, clip: { x:0, y:0, width:1200, height:630 } });
  console.log(`  og/${p.slug}.png`);
  okCount++;
}

await browser.close();
console.log(`\nGenerated ${okCount} OG images in ${OUT_DIR}`);
