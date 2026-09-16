#!/usr/bin/env node
/**
 * Generate /sitemap.xml from scripts/seo/urls.mjs.
 *
 * lastmod comes from the last git commit that touched the rendering file, not
 * from today's date. Bing reads lastmod as a claim about the content, and a
 * sitemap that swears every page changed this morning is a sitemap Bing learns
 * to discount. A true date is worth more than a fresh one.
 *
 * Usage: node scripts/gen-sitemap.mjs
 */
import { writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { URLS, BASE } from './seo/urls.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function gitLastmod(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      cwd: ROOT, encoding: 'utf8',
    }).trim();
    if (out) return out;
  } catch { /* fall through to mtime */ }
  return new Date().toISOString().slice(0, 10);
}

const missing = URLS.filter((u) => !existsSync(resolve(ROOT, u.file)));
if (missing.length) {
  console.error('Missing source files for sitemap entries:');
  for (const m of missing) console.error(`  ${m.path} -> ${m.file}`);
  process.exit(1);
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];
for (const u of URLS) {
  xml.push(
    '  <url>',
    `    <loc>${(BASE + u.path).replace(/&/g, '&amp;')}</loc>`,
    `    <lastmod>${gitLastmod(u.file)}</lastmod>`,
    `    <changefreq>${u.changefreq}</changefreq>`,
    `    <priority>${u.priority}</priority>`,
    '  </url>',
  );
}
xml.push('</urlset>', '');

const out = resolve(ROOT, 'sitemap.xml');
writeFileSync(out, xml.join('\n'));
console.log(`Wrote ${URLS.length} URLs to ${out}`);
