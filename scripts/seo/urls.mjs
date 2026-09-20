/**
 * Public URL inventory for quantumbranding.ai.
 *
 * Single source of truth for three consumers:
 *   scripts/gen-sitemap.mjs        writes sitemap.xml
 *   scripts/seo/indexnow-submit.mjs  pushes URLs to Bing via IndexNow
 *   tests/seo-bing/bing-audit.mjs  proves every entry is live and self-consistent
 *
 * RULES
 *   - `path` must equal the page's own <link rel="canonical"> exactly. A sitemap
 *     entry that does not match its canonical teaches Bing that the site
 *     disagrees with itself, and Bing drops the weaker of the two.
 *   - `file` is the repo file that renders the path. It supplies lastmod from
 *     git, so lastmod is a fact rather than today's date.
 *   - Gated and utility surfaces (foundation, account, paywall, archive, qbp,
 *     artifact, login, agents console, war-room, PDF renderers) stay out. They
 *     are Disallowed in robots.txt and have nothing to rank.
 */

export const BASE = 'https://quantumbranding.ai';

export const URLS = [
  // Tier 1. Entry surfaces. These carry the entity and the diagnostic.
  { path: '/',                             file: 'index.html',                        priority: '1.0', changefreq: 'weekly',  tier: 'entry' },
  { path: '/signal-scan.html',             file: 'signal-scan.html',                  priority: '1.0', changefreq: 'weekly',  tier: 'entry' },

  // Tier 2. Explanation and commerce.
  { path: '/ecosystem.html',               file: 'ecosystem.html',                    priority: '0.9', changefreq: 'weekly',  tier: 'explain' },
  { path: '/tools.html',                   file: 'tools.html',                        priority: '0.9', changefreq: 'weekly',  tier: 'explain' },
  { path: '/atelier',                      file: 'atelier.html',                      priority: '0.8', changefreq: 'monthly', tier: 'explain' },
  { path: '/payment.html',                 file: 'payment.html',                      priority: '0.8', changefreq: 'monthly', tier: 'commerce' },

  // Tier 3. Editorial. The answer surface Copilot reads from.
  { path: '/blog',                             file: 'blog/index.html',                        priority: '0.8', changefreq: 'weekly',  tier: 'editorial' },
  { path: '/blog/what-is-the-collapse',        file: 'blog/what-is-the-collapse.html',         priority: '0.8', changefreq: 'monthly', tier: 'editorial' },
  { path: '/blog/five-minute-brand-diagnostic',file: 'blog/five-minute-brand-diagnostic.html', priority: '0.7', changefreq: 'monthly', tier: 'editorial' },
  { path: '/blog/the-four-doors',              file: 'blog/the-four-doors.html',               priority: '0.7', changefreq: 'monthly', tier: 'editorial' },
  { path: '/blog/six-phases-idea-to-orbit',    file: 'blog/six-phases-idea-to-orbit.html',     priority: '0.7', changefreq: 'monthly', tier: 'editorial' },

  // Tier 4. Phase 01, Discovery.
  { path: '/the-profiles.html',            file: 'the-profiles.html',                 priority: '0.7', changefreq: 'monthly', tier: 'tool' },
  { path: '/archetype-compass.html',       file: 'archetype-compass.html',            priority: '0.7', changefreq: 'monthly', tier: 'tool' },
  { path: '/visual-dna.html',              file: 'visual-dna.html',                   priority: '0.7', changefreq: 'monthly', tier: 'tool' },
  { path: '/war-table.html',               file: 'war-table.html',                    priority: '0.7', changefreq: 'monthly', tier: 'tool' },
  { path: '/sensescape.html',              file: 'sensescape.html',                   priority: '0.7', changefreq: 'monthly', tier: 'tool' },
  { path: '/brand-soul-map.html',          file: 'brand-soul-map.html',               priority: '0.7', changefreq: 'monthly', tier: 'tool' },

  // Tier 4. Phase 03, Creation.
  { path: '/logo-direction-agent.html',    file: 'logo-direction-agent.html',         priority: '0.6', changefreq: 'monthly', tier: 'tool' },
  { path: '/logo-evaluation-agent.html',   file: 'logo-evaluation-agent.html',        priority: '0.6', changefreq: 'monthly', tier: 'tool' },
  { path: '/voice-guide-agent.html',       file: 'voice-guide-agent.html',            priority: '0.6', changefreq: 'monthly', tier: 'tool' },

  // Tier 4. Phase 04, Content.

  // Tier 4. Phase 05, Execution.
  { path: '/predictive-panel..html',       file: 'predictive-panel..html',            priority: '0.6', changefreq: 'monthly', tier: 'tool' },

  // Tier 4. Phase 06, Intelligence.
  { path: '/brand-performance-dashboard.html',  file: 'brand-performance-dashboard.html',  priority: '0.6', changefreq: 'monthly', tier: 'tool' },
  { path: '/quarterly-brand-review-agent.html', file: 'quarterly-brand-review-agent.html', priority: '0.6', changefreq: 'monthly', tier: 'tool' },

  // Tier 5. Legal.
  { path: '/terms.html',                   file: 'terms.html',                        priority: '0.3', changefreq: 'yearly',  tier: 'legal' },
  { path: '/privacy.html',                 file: 'privacy.html',                      priority: '0.3', changefreq: 'yearly',  tier: 'legal' },
];

export const absolute = (p) => BASE + p;
