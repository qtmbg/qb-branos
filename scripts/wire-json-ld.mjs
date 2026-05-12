#!/usr/bin/env node
/**
 * Inject page-level JSON-LD structured data into every production HTML
 * page. Each block references the canonical Organization, WebSite, and
 * SoftwareApplication graph defined on index.html by @id, so search
 * engines build one connected entity graph instead of duplicating it.
 *
 * Page types:
 *   tool      SoftwareApplication, free, isPartOf #software
 *   page      WebPage, isPartOf #website
 *   skip      no JSON-LD (already has one, or utility/noindex)
 *
 * Usage: node scripts/wire-json-ld.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://quantumbranding.ai';
const ORG_ID = `${ORIGIN}/#organization`;
const SITE_ID = `${ORIGIN}/#website`;
const SOFTWARE_ID = `${ORIGIN}/#software`;

// slug, file, kind, label, description (override; falls back to <meta name="description">)
const PAGES = [
  // tools (the 20 agents)
  ['signal-scan',                     'tool',  'Signal Scan',                  'Free five-minute brand diagnostic. The entry point to QB BrandOS.'],
  ['the-profiles',                    'tool',  'The Profiles',                 'Identify your audience archetypes and map their beliefs, language, and platforms.'],
  ['archetype-compass',               'tool',  'Archetype Compass',            'Pinpoint the founder archetype that the brand should embody.'],
  ['visual-dna',                      'tool',  'Visual DNA',                   'Capture the visual codes that signal the brand without saying its name.'],
  ['war-table',                       'tool',  'The War Table',                'Map the competitive territory the brand is entering and the space it can own.'],
  ['sensescape',                      'tool',  'Sensescape',                   'Capture the multi-sensory texture of the brand: sound, motion, material, scent.'],
  ['brand-soul-map',                  'tool',  'Brand Soul Map',               'The deep discovery interview that locks the Quantum Brand Profile.'],
  ['logo-direction-agent',            'tool',  'Logo Direction',               'Generate logo direction prompts grounded in the locked Quantum Brand Profile.'],
  ['logo-evaluation-agent',           'tool',  'Logo Evaluation',              'Evaluate logo candidates against the brand DNA and audience archetypes.'],
  ['voice-guide-agent',               'tool',  'Voice Guide',                  'Generate the brand voice guide: anchors, mechanics, banned phrases, surface rules.'],
  ['instagram-seed-agent',            'tool',  'Instagram Seed',               'Plant the Instagram presence with a first-month content seed.'],
  ['linkedin-strategy-agent',         'tool',  'LinkedIn Strategy',            'Build a LinkedIn strategy that lands the brand in the right professional rooms.'],
  ['youtube-strategy-agent',          'tool',  'YouTube Strategy',             'Plot the YouTube content stack: short-form hooks, long-form anchors, shelf logic.'],
  ['newsletter-architecture-agent',   'tool',  'Newsletter Architecture',      'Design the newsletter rhythm, segments, and signature sections that compound.'],
  ['content-bridge',                  'tool',  'Content Bridge',               'Connect raw insight to publishable content across platforms.'],
  ['content-repurposing-engine',      'tool',  'Content Repurposing Engine',   'Turn one anchor piece into ten platform-native variations.'],
  ['content-scheduler',               'tool',  'Content Scheduler',            'Schedule the brand content cadence across platforms.'],
  ['predictive-panel.',               'tool',  'Predictive Panel',             'Pressure-test brand and content decisions before they ship.'],
  ['brand-performance-dashboard',     'tool',  'Brand Performance Dashboard',  'Track how the brand is performing across acquisition, engagement, and conversion.'],
  ['quarterly-brand-review-agent',    'tool',  'Quarterly Brand Review',       'Close the quarter with a structured brand review and feed the next QBP loop.'],

  // marketing + system pages
  ['ecosystem',                       'page',  'The QB Ecosystem',             'Tour the QB BrandOS ecosystem: six phases, twenty agents, one Quantum Brand Profile.'],
  ['payment',                         'page',  'Choose your plan',             'Choose the QB BrandOS plan that fits your stage: Free, Starter, Pro, or Agency.'],
  ['journey-guide',                   'page',  'Find your path',               'A guided path through QB BrandOS based on where you are starting from.'],
  ['qb-branidos-hub',                 'page',  'QB BrandOS Hub',               'The signed-in workspace for QB BrandOS: tools, agents, Quantum Brand Profile.'],
  ['terms',                           'page',  'Terms of Service',             'The terms governing your use of QB BrandOS.'],
  ['privacy',                         'page',  'Privacy Policy',               'How QB BrandOS collects, uses, and protects your data.'],
];

const MARKER = '<!-- QB JSON-LD -->';

function toolBlock(slug, label, description){
  const file = slug === 'predictive-panel.' ? 'predictive-panel..html' : `${slug}.html`;
  const url = `${ORIGIN}/${file}`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': label,
    'description': description,
    'url': url,
    'applicationCategory': 'BusinessApplication',
    'operatingSystem': 'Web',
    'isPartOf': { '@id': SOFTWARE_ID },
    'publisher': { '@id': ORG_ID },
    'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR' }
  }, null, 2);
}

function pageBlock(slug, label, description){
  const file = slug === 'predictive-panel.' ? 'predictive-panel..html' : `${slug}.html`;
  const url = `${ORIGIN}/${file}`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': label,
    'description': description,
    'url': url,
    'isPartOf': { '@id': SITE_ID },
    'publisher': { '@id': ORG_ID },
    'inLanguage': 'en'
  }, null, 2);
}

function inject(html, json){
  // Insert directly before </head>. If the marker already exists, no-op.
  if(html.includes(MARKER)) return null;
  const idx = html.toLowerCase().indexOf('</head>');
  if(idx < 0) return null;
  const block = `${MARKER}\n<script type="application/ld+json">\n${json}\n</script>\n`;
  return html.slice(0, idx) + block + html.slice(idx);
}

let wired = 0, skipped = 0;
for(const [slug, kind, label, description] of PAGES){
  const file = slug === 'predictive-panel.' ? 'predictive-panel..html' : `${slug}.html`;
  const path = resolve(ROOT, file);
  if(!existsSync(path)){ console.log(`SKIP missing  ${file}`); skipped++; continue; }

  const html = readFileSync(path, 'utf8');
  if(html.includes('application/ld+json')){
    console.log(`-    ${file} (already has JSON-LD)`); skipped++; continue;
  }

  const json = kind === 'tool' ? toolBlock(slug, label, description) : pageBlock(slug, label, description);
  const next = inject(html, json);
  if(next == null){ console.log(`SKIP no </head>  ${file}`); skipped++; continue; }
  writeFileSync(path, next);
  console.log(`OK   ${file}  (${kind})`);
  wired++;
}
console.log(`\nWired JSON-LD on ${wired} files, skipped ${skipped}.`);
