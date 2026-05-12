#!/usr/bin/env node
/**
 * Make Google Fonts CSS non-render-blocking.
 *
 * Each tool page ships:
 *   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">
 *
 * That blocks first paint for ~600-1500ms. Lighthouse calls it out as
 * the dominant LCP regression on index and ecosystem.
 *
 * Swap pattern:
 *   <link rel="preload" href="..." as="style" onload="this.onload=null;this.rel='stylesheet'">
 *   <noscript><link rel="stylesheet" href="..."></noscript>
 *
 * Browsers preload the CSS in parallel without blocking render. When
 * loaded, the onload handler upgrades it to a real stylesheet. JS-off
 * users still get the font via the noscript fallback.
 *
 * font-display: swap is already in the URL query so text uses fallback
 * font instantly and swaps when the web font lands.
 *
 * Usage: node scripts/unblock-fonts.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '<!-- QB fonts unblocked -->';

// Matches: <link rel="stylesheet" ... href="https://fonts.googleapis.com/...">
// Tolerates attribute order and href before/after rel.
const RE = /<link\s+(?=[^>]*\bhref="(https:\/\/fonts\.googleapis\.com\/[^"]+)")(?=[^>]*\brel="stylesheet")[^>]*>/gi;

let touched = 0, skipped = 0;
for(const f of readdirSync(ROOT)){
  if(!f.endsWith('.html')) continue;
  if(f === 'HEAD-SNIPPET.html' || f === 'CHASSIS-MARKUP-SNIPPET.html') continue;

  const path = join(ROOT, f);
  let html = readFileSync(path, 'utf8');
  if(html.includes(MARKER)){ console.log(`-    ${f} (already done)`); continue; }

  let count = 0;
  html = html.replace(RE, (_match, href) => {
    count++;
    return `${MARKER}\n<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">\n<noscript><link rel="stylesheet" href="${href}"></noscript>`;
  });

  if(count > 0){
    writeFileSync(path, html);
    console.log(`OK   ${f.padEnd(38)} (${count} link${count>1?'s':''})`);
    touched++;
  } else {
    skipped++;
  }
}

console.log(`\nUnblocked fonts on ${touched} files, ${skipped} had no matching link.`);
