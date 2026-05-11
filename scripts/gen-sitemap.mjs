#!/usr/bin/env node
/**
 * Generate /sitemap.xml from the canonical page list.
 *
 * Usage: node scripts/gen-sitemap.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://quantumbranding.ai';
const today = new Date().toISOString().slice(0,10);

// path = url path relative to host. priority + changefreq tuned per surface tier.
const URLS = [
  // Tier 1: top-level surfaces
  { path:'/',                                priority:'1.0', changefreq:'weekly' },
  { path:'/signal-scan.html',                priority:'1.0', changefreq:'weekly' },

  // Tier 2: marketing / hub
  { path:'/ecosystem.html',                  priority:'0.9', changefreq:'weekly' },
  { path:'/tools.html',                      priority:'0.9', changefreq:'weekly' },
  { path:'/journey-guide.html',              priority:'0.8', changefreq:'monthly' },
  { path:'/payment.html',                    priority:'0.8', changefreq:'monthly' },
  { path:'/qb-branidos-hub.html',            priority:'0.7', changefreq:'monthly' },

  // Phase 01 — Discovery
  { path:'/the-profiles.html',               priority:'0.7', changefreq:'monthly' },
  { path:'/archetype-compass.html',          priority:'0.7', changefreq:'monthly' },
  { path:'/visual-dna.html',                 priority:'0.7', changefreq:'monthly' },
  { path:'/war-table.html',                  priority:'0.7', changefreq:'monthly' },
  { path:'/sensescape.html',                 priority:'0.7', changefreq:'monthly' },
  { path:'/brand-soul-map.html',             priority:'0.7', changefreq:'monthly' },

  // Phase 03 — Creation
  { path:'/logo-direction-agent.html',       priority:'0.6', changefreq:'monthly' },
  { path:'/logo-evaluation-agent.html',      priority:'0.6', changefreq:'monthly' },
  { path:'/voice-guide-agent.html',          priority:'0.6', changefreq:'monthly' },

  // Phase 04 — Content
  { path:'/instagram-seed-agent.html',       priority:'0.6', changefreq:'monthly' },
  { path:'/linkedin-strategy-agent.html',    priority:'0.6', changefreq:'monthly' },
  { path:'/youtube-strategy-agent.html',     priority:'0.6', changefreq:'monthly' },
  { path:'/newsletter-architecture-agent.html', priority:'0.6', changefreq:'monthly' },
  { path:'/content-bridge.html',             priority:'0.6', changefreq:'monthly' },
  { path:'/content-repurposing-engine.html', priority:'0.6', changefreq:'monthly' },
  { path:'/content-scheduler.html',          priority:'0.6', changefreq:'monthly' },

  // Phase 05 — Execution
  { path:'/predictive-panel..html',          priority:'0.6', changefreq:'monthly' },

  // Phase 06 — Intelligence
  { path:'/brand-performance-dashboard.html',priority:'0.6', changefreq:'monthly' },
  { path:'/quarterly-brand-review-agent.html', priority:'0.6', changefreq:'monthly' },

  // Legal
  { path:'/terms.html',                      priority:'0.3', changefreq:'yearly' },
  { path:'/privacy.html',                    priority:'0.3', changefreq:'yearly' },
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];
for(const u of URLS){
  const loc = BASE + u.path;
  xml.push(
    '  <url>',
    `    <loc>${loc.replace(/&/g,'&amp;')}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>${u.changefreq}</changefreq>`,
    `    <priority>${u.priority}</priority>`,
    '  </url>',
  );
}
xml.push('</urlset>', '');

const out = resolve(ROOT, 'sitemap.xml');
writeFileSync(out, xml.join('\n'));
console.log(`Wrote ${URLS.length} URLs to ${out}`);
