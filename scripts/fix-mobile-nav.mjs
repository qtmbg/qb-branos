#!/usr/bin/env node
/**
 * Mobile nav overflow fix.
 *
 * Every Phase 01-06 tool page renders a nav row of:
 *   [Sign in] [Start free] [hamburger]
 *
 * At <1000px the hamburger is shown but the two CTA buttons are NOT
 * hidden, so the row exceeds 390px viewport by 12-49px depending on
 * font + padding tokens. Most pages hide the visible overflow via
 * body { overflow-x: hidden }, but the layout is still wrong and
 * sensescape leaks because it has no such body rule.
 *
 * Fix: inject one media-query rule into every tool page's <style>
 * block before </style>, hiding the nav CTAs at <1000px. The hamburger
 * + mobile menu carry the CTAs at that breakpoint.
 *
 * Usage: node scripts/fix-mobile-nav.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  'the-profiles','archetype-compass','visual-dna','war-table','brand-soul-map',
  'logo-direction-agent','logo-evaluation-agent','voice-guide-agent',
  'instagram-seed-agent','linkedin-strategy-agent','youtube-strategy-agent',
  'newsletter-architecture-agent','content-bridge','content-repurposing-engine','content-scheduler',
  'predictive-panel.','brand-performance-dashboard','quarterly-brand-review-agent',
];

const MARKER = '/* QB mobile nav fix */';
const RULE = `${MARKER}
@media (max-width:999px){
  .nav-wrap .nav-actions > a,
  .nav .nav-actions > a { display:none !important; }
}
`;

let touched = 0, skipped = 0;
for(const slug of PAGES){
  const file = slug === 'predictive-panel.' ? 'predictive-panel..html' : `${slug}.html`;
  const path = resolve(ROOT, file);
  if(!existsSync(path)){ console.log(`SKIP missing ${file}`); skipped++; continue; }

  let html = readFileSync(path, 'utf8');
  if(html.includes(MARKER)){ console.log(`-    ${file} (already fixed)`); continue; }

  // Inject before the FIRST </style> in <head>. We find the first </style>
  // because tool pages have inline JS that may contain literal </style> strings
  // for PDF export, and we don't want to land in JS.
  const idx = html.toLowerCase().indexOf('</style>');
  if(idx < 0){ console.log(`SKIP no </style> ${file}`); skipped++; continue; }

  html = html.slice(0, idx) + RULE + html.slice(idx);
  writeFileSync(path, html);
  console.log(`OK   ${file}`);
  touched++;
}
console.log(`\nFixed mobile nav on ${touched} files.`);
