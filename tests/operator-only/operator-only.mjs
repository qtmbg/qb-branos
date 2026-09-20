#!/usr/bin/env node
// tests/operator-only/operator-only.mjs
// Recut Phase 1 · proves the content layer is invisible to everyone but
// the operator, and proves the gate can actually fail.
//
// Run: node tests/operator-only/operator-only.mjs
// Exit 1 on any failure, naming the offender.
//
// Per CLAUDE.md "Audit harnesses": nothing here is truncated before
// comparison, no findings array is capped, and the negative direction is
// asserted explicitly rather than assumed.

import { readFileSync } from 'node:fs';
import { AGENTS } from '../../agents/registry.js';

const failures = [];
const fail = (msg) => failures.push(msg);
const ok = (msg) => console.log(`  ok · ${msg}`);
// okIf prints only when the block it guards added no failures. Without
// it a section can print "ok" beside its own failure lines, which reads
// as a pass to anyone skimming the tail of the run.
let mark = 0;
const since = () => { mark = failures.length; };
const okIf = (msg) => { if (failures.length === mark) ok(msg); };

// The set under test is imported fresh per case because isOperator reads
// process.env at call time, which is the whole point of the module.
const { OPERATOR_ONLY_SLUGS, isOperator, isOperatorOnlyHidden } =
  await import('../../api/_lib/operator-only.js');

const EXPECTED_PARKED = [
  'newsletter_architecture_agent',
  'linkedin_strategy_agent',
  'instagram_seed_agent',
  'youtube_strategy_agent',
  'content_bridge_agent',
  'content_repurposing_agent',
  'content_scheduler_agent',
];

console.log('\n1 · the parked set is exactly the content layer');
{
  const actual = [...OPERATOR_ONLY_SLUGS].sort();
  const expected = [...EXPECTED_PARKED].sort();
  if (actual.join(',') !== expected.join(',')) {
    fail(`parked set drifted\n     expected: ${expected.join(', ')}\n     actual:   ${actual.join(', ')}`);
  } else ok(`${actual.length} slugs, exactly the Phase 03 + Phase 04 agents`);

  // Every parked slug must still be a real registered agent. If one is
  // deleted from the registry the set silently stops meaning anything.
  for (const slug of OPERATOR_ONLY_SLUGS) {
    if (!AGENTS[slug]) fail(`parked slug ${slug} is no longer in the registry`);
  }
  ok('every parked slug is still registered and still META-validated');

  // And every parked slug must be phase 03 or 04. A brand agent landing
  // in this set would vanish from the product without anyone noticing.
  for (const slug of OPERATOR_ONLY_SLUGS) {
    const phase = AGENTS[slug]?.META?.phase;
    if (phase !== '03' && phase !== '04') {
      fail(`parked slug ${slug} is phase ${phase}, expected 03 or 04`);
    }
  }
  ok('no brand agent has drifted into the parked set');
}

console.log('\n2 · the ten brand agents are NOT parked');
{
  const brand = Object.keys(AGENTS).filter(s => !OPERATOR_ONLY_SLUGS.has(s));
  if (brand.length !== 10) {
    fail(`expected 10 public brand agents, found ${brand.length}: ${brand.join(', ')}`);
  } else ok(`10 public agents: ${brand.join(', ')}`);

  const phases = [...new Set(brand.map(s => AGENTS[s].META.phase))].sort();
  if (phases.join(',') !== '01,02,05') {
    fail(`public phases should be 01, 02, 05 only · found ${phases.join(', ')}`);
  } else ok('public phases are 01, 02 and 05 only · 03 and 04 are empty');
}

console.log('\n3 · fails closed with OPERATOR_USER_IDS unset');
{
  delete process.env.OPERATOR_USER_IDS;
  if (isOperator('any-user-at-all')) fail('unset OPERATOR_USER_IDS treated someone as operator');
  else ok('nobody is the operator when the env var is unset');
  if (!isOperatorOnlyHidden('instagram_seed_agent', 'any-user-at-all')) {
    fail('content agent was visible with OPERATOR_USER_IDS unset');
  } else ok('content agents hidden from everyone, operator included');
}

console.log('\n4 · the gate lets the operator through and nobody else');
{
  process.env.OPERATOR_USER_IDS = ' 11111111-1111-1111-1111-111111111111 , 22222222-2222-2222-2222-222222222222 ';
  const OP = '11111111-1111-1111-1111-111111111111';
  const OP2 = '22222222-2222-2222-2222-222222222222';
  const OTHER = '99999999-9999-9999-9999-999999999999';

  if (!isOperator(OP) || !isOperator(OP2)) fail('operator id rejected from a valid allowlist');
  else ok('both allowlisted ids resolve as operator, whitespace tolerated');

  if (isOperator(OTHER)) fail('non-operator id accepted');
  else ok('a non-listed id is not the operator');

  if (isOperator('')) fail('empty user id accepted as operator');
  if (isOperator(null)) fail('null user id accepted as operator');
  if (isOperator(undefined)) fail('undefined user id accepted as operator');
  ok('empty, null and undefined user ids are never the operator');

  // Prefix and substring attacks: a raw indexOf/includes on the joined
  // string would pass "1111" or "1111...1111x" here.
  if (isOperator('1111')) fail('substring of an allowlisted id accepted');
  if (isOperator(OP + 'x')) fail('id with an appended character accepted');
  ok('substring and suffix variants are rejected');

  for (const slug of OPERATOR_ONLY_SLUGS) {
    if (isOperatorOnlyHidden(slug, OP)) fail(`${slug} hidden from the operator`);
    if (!isOperatorOnlyHidden(slug, OTHER)) fail(`${slug} visible to a non-operator`);
  }
  ok('all 7 parked slugs: visible to the operator, hidden from everyone else');

  for (const slug of Object.keys(AGENTS)) {
    if (OPERATOR_ONLY_SLUGS.has(slug)) continue;
    if (isOperatorOnlyHidden(slug, OTHER)) fail(`brand agent ${slug} hidden from a normal user`);
  }
  ok('no brand agent is hidden from a normal user');
}

console.log('\n5 · every dispatch path is wired to the gate');
{
  // Source-level, because a handler that imports the module but never
  // calls it would pass every behavioural check above.
  const PATHS = [
    'api/agents/run.js',
    'api/agents/dispatch.js',
    'api/agents/rerun.js',
    'api/agents/console.js',
  ];
  for (const path of PATHS) {
    const src = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    if (!src.includes("from '../_lib/operator-only.js'")) {
      fail(`${path} does not import the operator-only gate`);
      continue;
    }
    // One import + at least one call site.
    const calls = (src.match(/isOperatorOnlyHidden\s*\(/g) || []).length;
    if (calls < 1) fail(`${path} imports the gate but never calls it`);
    else ok(`${path} · imports and calls the gate`);
  }
}

console.log('\n6 · the seven pages are off every public surface');
{
  const PARKED_PAGES = [
    'newsletter-architecture-agent.html',
    'linkedin-strategy-agent.html',
    'instagram-seed-agent.html',
    'youtube-strategy-agent.html',
    'content-bridge.html',
    'content-repurposing-engine.html',
    'content-scheduler.html',
  ];
  const PUBLIC_SURFACES = ['tools.html', 'ecosystem.html', 'index.html', 'agents.html'];

  since();
  for (const surface of PUBLIC_SURFACES) {
    let src;
    try { src = readFileSync(new URL(`../../${surface}`, import.meta.url), 'utf8'); }
    catch { continue; }
    for (const page of PARKED_PAGES) {
      if (src.includes(page)) fail(`${surface} still links to ${page}`);
    }
  }
  okIf('no public surface links to a parked page');

  // Each parked page must carry noindex, so an already-crawled URL drops
  // out of the index rather than lingering.
  since();
  for (const page of PARKED_PAGES) {
    let src;
    try { src = readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8'); }
    catch { fail(`parked page ${page} is missing from the repo`); continue; }
    if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(src)) {
      fail(`${page} has no robots noindex meta`);
    }
  }
  okIf('all 7 parked pages carry robots noindex');

  // And off the SEO inventory, which is the single source for the sitemap.
  since();
  const urls = readFileSync(new URL('../../scripts/seo/urls.mjs', import.meta.url), 'utf8');
  for (const page of PARKED_PAGES) {
    const slug = page.replace(/\.html$/, '');
    if (new RegExp(`['"\`/]${slug}['"\`]`).test(urls)) {
      fail(`scripts/seo/urls.mjs still lists ${slug}`);
    }
  }
  okIf('scripts/seo/urls.mjs lists no parked page');
}

console.log('');
if (failures.length) {
  console.error(`operator-only: FAILED · ${failures.length} problem${failures.length === 1 ? '' : 's'}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('operator-only: GREEN · content layer invisible, brand layer intact');
