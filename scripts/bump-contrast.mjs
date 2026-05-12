#!/usr/bin/env node
/**
 * Bump text contrast on .hero_meta + .footer_col-title across all pages.
 *
 * Lighthouse flags these as 3.16-3.24:1 on cream backgrounds (WCAG AA
 * body text requires 4.5:1). Cause: both rules use color: var(--ink-50)
 * which is rgba(45,21,33,0.5).
 *
 * Bumping to var(--ink-75) (0.75 opacity) takes contrast to ~5.2:1 and
 * passes AA. No brand-token changes; only the consumed opacity step.
 *
 * Surgical scope: only those two selectors. Other --ink-50 usages
 * (decorative labels, footnotes) are left untouched.
 *
 * Usage: node scripts/bump-contrast.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Match a CSS rule block starting with one of the target selectors and
// rewrite color: var(--ink-50) -> var(--ink-75) inside that block only.
function bumpInBlock(html, selectorRegex){
  // Find each block: selector { ... }  (non-greedy until })
  return html.replace(new RegExp(`(${selectorRegex.source}\\s*\\{[^}]*?)color\\s*:\\s*var\\(--ink-50\\)`, 'g'),
    (_match, prefix) => `${prefix}color: var(--ink-75)`);
}

let touched = 0;
for(const f of readdirSync(ROOT)){
  if(!f.endsWith('.html')) continue;
  if(f === 'HEAD-SNIPPET.html' || f === 'CHASSIS-MARKUP-SNIPPET.html') continue;

  const path = join(ROOT, f);
  const before = readFileSync(path, 'utf8');
  let html = before;

  html = bumpInBlock(html, /\.hero_meta/);
  html = bumpInBlock(html, /\.footer_col-title/);

  if(html !== before){
    writeFileSync(path, html);
    const heroFix  = (html.match(/\.hero_meta\s*\{[^}]*--ink-75/g) || []).length;
    const footFix  = (html.match(/\.footer_col-title\s*\{[^}]*--ink-75/g) || []).length;
    console.log(`OK   ${f.padEnd(40)} hero_meta=${heroFix}  footer_col-title=${footFix}`);
    touched++;
  }
}
console.log(`\nBumped contrast on ${touched} files.`);
