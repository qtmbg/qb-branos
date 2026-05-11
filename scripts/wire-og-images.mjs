#!/usr/bin/env node
/**
 * Wire each HTML page to use its per-page OG image.
 *
 * For each page:
 *   - If <meta property="og:image"> exists, point it at /img/brand/og/<slug>.png.
 *   - Same for og:image:secure_url, twitter:image, og:image:alt.
 *   - Ensure og:image:width=1200 + og:image:height=630.
 *   - If no OG image meta exists at all, inject a minimal OG/Twitter block
 *     before </head> using <title> and <meta name="description"> as source.
 *
 * Usage: node scripts/wire-og-images.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OG_DIR = resolve(ROOT, 'img', 'brand', 'og');
const BASE_URL = 'https://quantumbranding.ai';

// Only wire pages we actually generated cards for.
const PAGES = [
  'index','signal-scan','ecosystem','payment','tools','journey-guide','qb-branidos-hub',
  'the-profiles','archetype-compass','visual-dna','war-table','sensescape','brand-soul-map',
  'logo-direction-agent','logo-evaluation-agent','voice-guide-agent',
  'instagram-seed-agent','linkedin-strategy-agent','youtube-strategy-agent',
  'newsletter-architecture-agent','content-bridge','content-repurposing-engine','content-scheduler',
  'predictive-panel.',
  'brand-performance-dashboard','quarterly-brand-review-agent',
  'terms','privacy','404',
];

let touched = 0;
let skipped = 0;
const report = [];

for(const slug of PAGES){
  const file = slug === 'predictive-panel.' ? 'predictive-panel..html' : `${slug}.html`;
  const path = resolve(ROOT, file);
  if(!existsSync(path)){ report.push(`SKIP missing  ${file}`); skipped++; continue; }
  if(!existsSync(resolve(OG_DIR, `${slug}.png`))){ report.push(`SKIP no-card  ${file}`); skipped++; continue; }

  let html = readFileSync(path, 'utf8');
  const og = `${BASE_URL}/img/brand/og/${slug}.png`;
  const before = html;
  let changes = [];

  // Replace any existing og:image URL.
  const ogImgRe = /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i;
  if(ogImgRe.test(html)){
    html = html.replace(ogImgRe, `<meta property="og:image" content="${og}">`);
    changes.push('og:image');
  }
  // og:image:secure_url (rare but possible)
  html = html.replace(/<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/?>/i,
                      `<meta property="og:image:secure_url" content="${og}">`);

  // twitter:image
  const twImgRe = /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i;
  if(twImgRe.test(html)){
    html = html.replace(twImgRe, `<meta name="twitter:image" content="${og}">`);
    changes.push('twitter:image');
  }

  // Ensure og:image:width / og:image:height after og:image (some pages lack them).
  if(/<meta\s+property="og:image"/i.test(html) && !/og:image:width/i.test(html)){
    html = html.replace(/(<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>)/i,
                        `$1\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`);
    changes.push('+dimensions');
  }

  // If no og:image exists at all, inject a full minimal block before </head>.
  if(!/<meta\s+property="og:image"/i.test(html)){
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch  = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const title = (titleMatch ? titleMatch[1] : 'Quantum Branding').trim();
    const desc  = (descMatch ? descMatch[1] : 'QB BrandOS · the brand operating system. From idea to orbit.').trim();
    const urlPath = slug === 'index' ? '/' : `/${file}`;
    const url = BASE_URL + urlPath;

    const block = `
<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Quantum Branding">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(desc)}">
<meta name="twitter:image" content="${og}">
`;
    html = html.replace(/<\/head>/i, block + '</head>');
    changes.push('injected');
  }

  // If twitter:image absent but og:image present, also inject twitter:image.
  if(!/<meta\s+name="twitter:image"/i.test(html)){
    html = html.replace(/(<meta\s+property="og:image:height"\s+content="630"\s*\/?>)/i,
                        `$1\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${og}">`);
    if(html !== before) changes.push('+twitter');
  }

  if(html !== before){
    writeFileSync(path, html);
    report.push(`OK  ${file.padEnd(38)} ${changes.join(', ')}`);
    touched++;
  } else {
    report.push(`-   ${file.padEnd(38)} no change`);
  }
}

function escapeAttr(s){ return s.replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

console.log(report.join('\n'));
console.log(`\nTouched ${touched} files, skipped ${skipped}.`);
