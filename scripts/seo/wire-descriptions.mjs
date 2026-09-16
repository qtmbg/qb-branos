#!/usr/bin/env node
/**
 * Give every agent surface a real description.
 *
 * Thirteen inventoried pages shipped with no <meta name="description"> and a
 * boilerplate og:description. Bing writes snippets from the description far
 * more closely than Google does, and Copilot reads the same text when it
 * decides whether a page answers the question it was asked. A page with no
 * description is a page that has to argue for itself in a sentence Bing wrote.
 *
 * Each entry below names the tool, says what comes out of it, and stays inside
 * the ~155 characters Bing renders.
 *
 * Idempotent. Run it again after editing the table and it rewrites in place.
 * Usage: node scripts/seo/wire-descriptions.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = process.argv.includes('--check');

const DESCRIPTIONS = {
  'logo-direction-agent.html':
    'Turn a locked Brand Profile into logo direction prompts you can hand to a designer or a generator. Phase 03 inside BrandOS, no brief writing needed.',
  'logo-evaluation-agent.html':
    'Score logo candidates against your brand DNA and audience archetypes, then read a written verdict on which one holds. Phase 03 inside BrandOS.',
  'voice-guide-agent.html':
    'Generate a working brand voice guide: anchors, mechanics, banned phrases, and rules per surface, all drawn from your Brand Profile.',
  'instagram-seed-agent.html':
    'Plant an Instagram presence with a first-month content seed built from your Brand Profile. Hooks, posts, and a cadence you can publish against.',
  'linkedin-strategy-agent.html':
    'Build a LinkedIn strategy that puts your brand in the right professional rooms. Positioning, post formats, and a rhythm drawn from your Brand Profile.',
  'youtube-strategy-agent.html':
    'Plot a YouTube content stack from your Brand Profile: short-form hooks, long-form anchors, and the shelf logic that keeps a viewer moving.',
  'newsletter-architecture-agent.html':
    'Design a newsletter that compounds. Rhythm, segments, and signature sections drawn from your Brand Profile. Phase 04 inside BrandOS.',
  'content-bridge.html':
    'Carry raw insight into publishable content across platforms. The Content Bridge turns what you already know into posts that sound like your brand.',
  'content-repurposing-engine.html':
    'Turn one anchor piece into ten platform-native variations, each written in your own brand voice. The repurposing engine inside BrandOS.',
  'content-scheduler.html':
    'Set the publishing cadence for your brand across platforms. The Content Scheduler builds a calendar your Brand Profile can sustain.',
  'predictive-panel..html':
    'Pressure-test a brand or content decision before it ships. The Predictive Panel runs it past a synthetic audience built from your Brand Profile.',
  'brand-performance-dashboard.html':
    'Track brand performance across acquisition, engagement, and conversion, read against the Brand Profile you locked. Phase 06 inside BrandOS.',
  'quarterly-brand-review-agent.html':
    'Close the quarter with a structured brand review. What held, what drifted, what changes next, fed straight back into your Brand Profile.',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

let changed = 0;
let problems = 0;

for (const [file, desc] of Object.entries(DESCRIPTIONS)) {
  const path = resolve(ROOT, file);
  let html = readFileSync(path, 'utf8');
  const before = html;
  const value = esc(desc);

  if (desc.length > 160) {
    console.error(`  TOO LONG (${desc.length}) ${file}`);
    problems++;
  }

  // 1. <meta name="description">: replace if present, otherwise insert after <title>.
  if (/<meta\s+name="description"/i.test(html)) {
    html = html.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${value}">`);
  } else if (/<\/title>/i.test(html)) {
    html = html.replace(/(<\/title>)/i, `$1\n<meta name="description" content="${value}">`);
  } else {
    console.error(`  NO <title> to anchor to: ${file}`);
    problems++;
  }

  // 2. og:description and twitter:description carry the same sentence.
  html = html.replace(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${value}">`);
  html = html.replace(/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${value}">`);

  if (html !== before) {
    if (!CHECK) writeFileSync(path, html);
    changed++;
    console.log(`  ${CHECK ? 'would rewrite' : 'rewrote'} ${file} (${desc.length} chars)`);
  } else {
    console.log(`  unchanged ${file}`);
  }
}

console.log(`\n${changed} file(s) ${CHECK ? 'pending' : 'written'}, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
