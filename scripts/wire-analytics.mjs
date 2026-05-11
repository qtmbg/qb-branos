#!/usr/bin/env node
/**
 * Inject Vercel Web Analytics + Speed Insights script tags on every
 * production HTML page. Scripts are no-ops until enabled in the Vercel
 * dashboard, so the tags are safe to ship in advance.
 *
 * Usage: node scripts/wire-analytics.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  'index','signal-scan','ecosystem','payment','tools','journey-guide','qb-branidos-hub',
  'the-profiles','archetype-compass','visual-dna','war-table','sensescape','brand-soul-map',
  'logo-direction-agent','logo-evaluation-agent','voice-guide-agent',
  'instagram-seed-agent','linkedin-strategy-agent','youtube-strategy-agent',
  'newsletter-architecture-agent','content-bridge','content-repurposing-engine','content-scheduler',
  'predictive-panel.','brand-performance-dashboard','quarterly-brand-review-agent',
  'terms','privacy','404','tools',
  // utility pages
  'auth-callback',
];

const MARKER = '<!-- QB analytics -->';
const BLOCK = `${MARKER}
<script defer src="/_vercel/insights/script.js"></script>
<script defer src="/_vercel/speed-insights/script.js"></script>
`;

let touched = 0, skipped = 0;
for(const slug of PAGES){
  const file = slug === 'predictive-panel.' ? 'predictive-panel..html' : `${slug}.html`;
  const path = resolve(ROOT, file);
  if(!existsSync(path)){ console.log(`SKIP missing  ${file}`); skipped++; continue; }

  let html = readFileSync(path, 'utf8');
  if(html.includes(MARKER)){ console.log(`-    ${file} (already wired)`); continue; }

  if(!/<\/body>/i.test(html)){ console.log(`SKIP no </body>  ${file}`); skipped++; continue; }
  html = html.replace(/<\/body>/i, BLOCK + '</body>');
  writeFileSync(path, html);
  console.log(`OK   ${file}`);
  touched++;
}
console.log(`\nWired analytics on ${touched} files, skipped ${skipped}.`);
