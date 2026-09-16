#!/usr/bin/env node
/**
 * Push URLs to Bing (and every other IndexNow participant) the moment they
 * change, instead of waiting for a crawler to come back on its own schedule.
 *
 * IndexNow is Microsoft's push protocol. It is the one discovery lever that is
 * Bing-specific, free, and immediate. It removes crawl lag. It does not buy
 * ranking, and spraying the whole site at it every day devalues the signal, so
 * the default mode submits only what actually changed.
 *
 * Ownership is proved by a key file served at the site root. Both the key and
 * its location travel with every request.
 *
 * Usage:
 *   node scripts/seo/indexnow-submit.mjs --changed            # since HEAD~1
 *   node scripts/seo/indexnow-submit.mjs --changed --since HEAD~5
 *   node scripts/seo/indexnow-submit.mjs --all                # full inventory
 *   node scripts/seo/indexnow-submit.mjs /blog/the-four-doors # explicit paths
 *   node scripts/seo/indexnow-submit.mjs --all --dry-run
 *
 * Exit codes: 0 submitted or nothing to do, 1 rejected or misconfigured.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { URLS, BASE } from './urls.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const HOST = new URL(BASE).host;
const MAX_BATCH = 10000; // IndexNow's documented per-call ceiling.

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f, fallback) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

/** The key is whatever 8-128 hex file sits at the repo root. One file, one key. */
function readKey() {
  const candidates = readdirSync(ROOT).filter((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one IndexNow key file at the repo root, found ${candidates.length}` +
      (candidates.length ? `: ${candidates.join(', ')}` : '. Create one with a 32-hex name whose contents are the same 32 hex characters.'),
    );
  }
  const file = candidates[0];
  const key = readFileSync(resolve(ROOT, file), 'utf8').trim();
  const expected = file.replace(/\.txt$/, '');
  if (key !== expected) {
    throw new Error(`Key file ${file} contains "${key}". Contents must equal the filename without .txt.`);
  }
  return { key, keyLocation: `${BASE}/${file}` };
}

function changedPaths(since) {
  const out = execFileSync('git', ['diff', '--name-only', `${since}..HEAD`], {
    cwd: ROOT, encoding: 'utf8',
  });
  const touched = new Set(out.split('\n').map((l) => l.trim()).filter(Boolean));
  return URLS.filter((u) => touched.has(u.file)).map((u) => u.path);
}

function resolvePaths() {
  const explicit = argv.filter((a) => a.startsWith('/'));
  if (explicit.length) {
    const known = new Set(URLS.map((u) => u.path));
    const unknown = explicit.filter((p) => !known.has(p));
    if (unknown.length) {
      throw new Error(`Not in the public URL inventory: ${unknown.join(', ')}. Add them to scripts/seo/urls.mjs first.`);
    }
    return explicit;
  }
  if (has('--all')) return URLS.map((u) => u.path);
  return changedPaths(valueOf('--since', 'HEAD~1'));
}

async function main() {
  const { key, keyLocation } = readKey();
  const paths = resolvePaths();

  if (!paths.length) {
    console.log('No inventoried page changed. Nothing submitted.');
    return;
  }
  if (paths.length > MAX_BATCH) {
    throw new Error(`${paths.length} URLs exceeds the IndexNow batch ceiling of ${MAX_BATCH}.`);
  }

  const urlList = paths.map((p) => BASE + p);
  const body = { host: HOST, key, keyLocation, urlList };

  console.log(`IndexNow -> ${ENDPOINT}`);
  console.log(`  host        ${HOST}`);
  console.log(`  keyLocation ${keyLocation}`);
  console.log(`  urls        ${urlList.length}`);
  for (const u of urlList) console.log(`    ${u}`);

  if (has('--dry-run')) {
    console.log('\nDry run. Nothing sent.');
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  // 200 accepted. 202 accepted, key validation pending. Everything else is a
  // real failure and the message from the endpoint is the only useful clue.
  if (res.status === 200 || res.status === 202) {
    console.log(`\nAccepted (HTTP ${res.status}). ${text || 'No body.'}`);
    return;
  }
  console.error(`\nRejected (HTTP ${res.status}). ${text || 'No body.'}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
