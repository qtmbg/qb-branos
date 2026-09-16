#!/usr/bin/env node
/**
 * Bing readiness audit for quantumbranding.ai.
 *
 * Bing is stricter than Google about self-consistency. It reads the description
 * almost verbatim into the snippet, it drops pages whose canonical disagrees
 * with the sitemap, and Copilot grounds its answers in whatever JSON-LD and
 * heading structure it can parse. So the things this harness checks are the
 * things that decide whether a page is usable, not stylistic preferences.
 *
 * Two severities:
 *   ERROR  breaks discovery or indexing. Exits 1.
 *   WARN   costs quality. Exits 0 unless --strict.
 *
 * Usage:
 *   node tests/seo-bing/bing-audit.mjs                      # local files
 *   node tests/seo-bing/bing-audit.mjs --base https://quantumbranding.ai
 *   node tests/seo-bing/bing-audit.mjs --strict
 *
 * NOTE ON COMPARISONS: nothing here is truncated before it is tested, and no
 * findings array is capped. Slicing happens only when printing a human-readable
 * line, and every such slice is marked.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { URLS, BASE } from '../../scripts/seo/urls.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const baseIdx = argv.indexOf('--base');
const REMOTE = baseIdx >= 0 ? argv[baseIdx + 1].replace(/\/$/, '') : null;

const errors = [];
const warns = [];
const err = (page, msg) => errors.push({ page, msg });
const warn = (page, msg) => warns.push({ page, msg });

/** Only for printing. Never feed a truncated string back into a test. */
const preview = (s, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

const attr = (html, re) => {
  const m = html.match(re);
  return m ? m[1] : null;
};
const decode = (s) => s
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function loadPage(u) {
  if (!REMOTE) {
    const path = resolve(ROOT, u.file);
    if (!existsSync(path)) { err(u.path, `source file missing: ${u.file}`); return null; }
    return { html: readFileSync(path, 'utf8'), status: 200, finalUrl: BASE + u.path };
  }
  const url = REMOTE + u.path;
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    err(u.path, `sitemap URL redirects (HTTP ${res.status} -> ${res.headers.get('location')}). A sitemap must list final URLs.`);
    return null;
  }
  if (res.status !== 200) { err(u.path, `HTTP ${res.status}`); return null; }
  return { html: await res.text(), status: res.status, finalUrl: url };
}

// ---------------------------------------------------------------- key file
function auditIndexNowKey() {
  const files = readdirSync(ROOT).filter((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
  if (files.length !== 1) {
    err('indexnow', `expected exactly one key file at the repo root, found ${files.length}${files.length ? `: ${files.join(', ')}` : ''}`);
    return;
  }
  const file = files[0];
  const body = readFileSync(resolve(ROOT, file), 'utf8').trim();
  if (body !== file.replace(/\.txt$/, '')) {
    err('indexnow', `${file} contents "${body}" do not equal the filename stem`);
  }
}

// ---------------------------------------------------------------- sitemap
function auditSitemap() {
  const path = resolve(ROOT, 'sitemap.xml');
  if (!existsSync(path)) { err('sitemap.xml', 'missing'); return; }
  const xml = readFileSync(path, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
  const inventory = URLS.map((u) => BASE + u.path);

  for (const loc of locs) {
    if (!inventory.includes(loc)) err('sitemap.xml', `lists a URL that is not in the inventory: ${loc}`);
  }
  for (const want of inventory) {
    if (!locs.includes(want)) err('sitemap.xml', `inventory URL is not in the sitemap: ${want}`);
  }
  const seen = new Set();
  for (const loc of locs) {
    if (seen.has(loc)) err('sitemap.xml', `duplicate <loc>: ${loc}`);
    seen.add(loc);
  }
  for (const m of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m[1])) err('sitemap.xml', `lastmod is not an ISO date: ${m[1]}`);
  }
}

// ---------------------------------------------------------------- robots
function auditRobots() {
  const path = resolve(ROOT, 'robots.txt');
  if (!existsSync(path)) { err('robots.txt', 'missing'); return; }
  const txt = readFileSync(path, 'utf8');
  if (!txt.includes(`Sitemap: ${BASE}/sitemap.xml`)) err('robots.txt', 'no absolute Sitemap directive');
  if (!/^User-agent:\s*bingbot/mi.test(txt)) warn('robots.txt', 'no explicit bingbot group');

  // A page we ask Bing to index must not also be Disallowed.
  const disallowed = [...txt.matchAll(/^Disallow:\s*(\S+)\s*$/gmi)].map((m) => m[1]);
  for (const u of URLS) {
    for (const d of disallowed) {
      if (d !== '/' && u.path.startsWith(d)) {
        err(u.path, `sitemapped but Disallowed in robots.txt by "${d}"`);
      }
    }
  }
}

// ---------------------------------------------------------------- pages
async function auditPages() {
  const titles = new Map();
  const descriptions = new Map();

  for (const u of URLS) {
    const page = await loadPage(u);
    if (!page) continue;
    const { html } = page;

    const title = attr(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!title || !title.trim()) err(u.path, 'no <title>');
    else {
      const t = decode(title.trim());
      if (t.length > 65) warn(u.path, `title is ${t.length} chars, Bing truncates near 65: "${preview(t)}" (preview truncated for display only)`);
      if (titles.has(t)) err(u.path, `duplicate title, shared with ${titles.get(t)}`);
      else titles.set(t, u.path);
    }

    const descRaw = attr(html, /<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/i);
    if (!descRaw) err(u.path, 'no <meta name="description">');
    else {
      const d = decode(descRaw).trim();
      if (!d) err(u.path, 'empty meta description');
      if (d.length > 160) warn(u.path, `description is ${d.length} chars, Bing truncates near 160`);
      if (d.length && d.length < 70) warn(u.path, `description is only ${d.length} chars, too thin to answer a query`);
      if (descriptions.has(d)) err(u.path, `duplicate description, shared with ${descriptions.get(d)}`);
      else descriptions.set(d, u.path);
    }

    const canon = attr(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i);
    if (!canon) err(u.path, 'no canonical link');
    else if (decode(canon) !== BASE + u.path) {
      err(u.path, `canonical "${decode(canon)}" disagrees with the sitemap entry "${BASE + u.path}"`);
    }

    const ogTitle = attr(html, /<meta\s+property="og:title"\s+content="([\s\S]*?)"\s*\/?>/i);
    const ogDesc = attr(html, /<meta\s+property="og:description"\s+content="([\s\S]*?)"\s*\/?>/i);
    if (!ogTitle) warn(u.path, 'no og:title');
    if (!ogDesc) warn(u.path, 'no og:description');

    const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
    if (!blocks.length) err(u.path, 'no JSON-LD');
    blocks.forEach((b, i) => {
      try { JSON.parse(b[1]); }
      catch (e) { err(u.path, `JSON-LD block ${i + 1} does not parse: ${e.message}`); }
    });

    const h1s = [...html.matchAll(/<h1[\s>]/gi)];
    if (h1s.length === 0) warn(u.path, 'no <h1>, so Bing has to guess the page subject');
    else if (h1s.length > 1) warn(u.path, `${h1s.length} <h1> elements, the page claims more than one subject`);

    if (!/lang="[a-z]{2}/i.test(html)) warn(u.path, 'no lang attribute on <html>');
  }
}

// ---------------------------------------------------------------- run
auditIndexNowKey();
auditSitemap();
auditRobots();
await auditPages();

const where = REMOTE ? `remote (${REMOTE})` : 'local files';
console.log(`Bing readiness audit · ${URLS.length} URLs · ${where}\n`);

if (warns.length) {
  console.log(`WARN (${warns.length}):`);
  for (const w of warns) console.log(`  ${w.page}\n    ${w.msg}`);
  console.log('');
}
if (errors.length) {
  console.log(`ERROR (${errors.length}):`);
  for (const e of errors) console.log(`  ${e.page}\n    ${e.msg}`);
  console.log('');
}

const failed = errors.length > 0 || (STRICT && warns.length > 0);
console.log(failed
  ? `FAIL · ${errors.length} error(s), ${warns.length} warning(s)${STRICT ? ' (strict)' : ''}`
  : `PASS · 0 errors, ${warns.length} warning(s)`);
process.exit(failed ? 1 : 0);
