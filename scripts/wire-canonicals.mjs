#!/usr/bin/env node
/**
 * Add or normalize <link rel="canonical"> on every production page.
 *
 * Rules:
 *   - Canonical host is always quantumbranding.ai (NOT app.quantumbranding.ai).
 *   - Per-page canonical points at the file's URL.
 *   - If a canonical already exists, rewrite to the canonical host.
 *   - If none exists, inject one before </head>.
 *
 * Usage: node scripts/wire-canonicals.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://quantumbranding.ai';

const PAGES = [
  ['index','/'],
  ['signal-scan','/signal-scan.html'],
  ['ecosystem','/ecosystem.html'],
  ['payment','/payment.html'],
  ['tools','/tools.html'],
  // /journey-guide and /qb-branidos-hub deprecated in step 12.
  // Source files archived under /_archive/chapter-1-deprecations/ in step 16.
  ['foundation','/foundation.html'],
  ['archive','/archive.html'],
  ['qbp','/qbp.html'],
  ['paywall','/paywall.html'],
  ['account','/account.html'],
  ['the-profiles','/the-profiles.html'],
  ['archetype-compass','/archetype-compass.html'],
  ['visual-dna','/visual-dna.html'],
  ['war-table','/war-table.html'],
  ['sensescape','/sensescape.html'],
  ['brand-soul-map','/brand-soul-map.html'],
  ['logo-direction-agent','/logo-direction-agent.html'],
  ['logo-evaluation-agent','/logo-evaluation-agent.html'],
  ['voice-guide-agent','/voice-guide-agent.html'],
  ['instagram-seed-agent','/instagram-seed-agent.html'],
  ['linkedin-strategy-agent','/linkedin-strategy-agent.html'],
  ['youtube-strategy-agent','/youtube-strategy-agent.html'],
  ['newsletter-architecture-agent','/newsletter-architecture-agent.html'],
  ['content-bridge','/content-bridge.html'],
  ['content-repurposing-engine','/content-repurposing-engine.html'],
  ['content-scheduler','/content-scheduler.html'],
  ['predictive-panel.','/predictive-panel..html'],
  ['brand-performance-dashboard','/brand-performance-dashboard.html'],
  ['quarterly-brand-review-agent','/quarterly-brand-review-agent.html'],
  ['terms','/terms.html'],
  ['privacy','/privacy.html'],
  ['404','/404.html'],
];

let touched = 0;
for(const [slug, urlPath] of PAGES){
  const file = slug === 'predictive-panel.' ? 'predictive-panel..html' : `${slug}.html`;
  const path = resolve(ROOT, file);
  if(!existsSync(path)){ console.log(`SKIP missing  ${file}`); continue; }

  let html = readFileSync(path, 'utf8');
  const before = html;
  const canonical = BASE + urlPath;
  const tag = `<link rel="canonical" href="${canonical}">`;

  const re = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
  if(re.test(html)){
    html = html.replace(re, tag);
  } else {
    html = html.replace(/<\/head>/i, `${tag}\n</head>`);
  }

  if(html !== before){
    writeFileSync(path, html);
    console.log(`OK   ${file.padEnd(38)} -> ${canonical}`);
    touched++;
  }
}
console.log(`\nWired canonicals on ${touched} files.`);
