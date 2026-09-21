#!/usr/bin/env node
// tests/model-routing/model-routing.mjs
// Standing harness for the two-provider model layer, 2026-09-21.
//
//   node tests/model-routing/model-routing.mjs
//
// With GEMINI_API_KEY set it also makes one live call and checks the
// answer against the voice codex. Without it, everything else runs.
//
// The thing this guards: eighteen agents used to carry their own copy of
// the model call, seventeen byte-identical, so a provider change meant
// eighteen chances to diverge. There is now one adapter, and these
// assertions are what keep it that way.

import { readFileSync } from 'node:fs';
import { AGENTS } from '../../agents/registry.js';
import { CANONICAL_MODELS, DEFAULT_MODEL } from '../../agents/contract.js';
import { providerFor, hasKeyFor, pickModel, callModel, GOOGLE_MODELS } from '../../agents/model-call.js';
import { OPERATOR_ONLY_SLUGS } from '../../api/_lib/operator-only.js';

const failures = [];
const fail = m => failures.push(m);
const ok = m => console.log(`  ok · ${m}`);
let mark = 0;
const since = () => { mark = failures.length; };
const okIf = m => { if (failures.length === mark) ok(m); };
const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const modelOf = slug => AGENTS[slug].META.model || DEFAULT_MODEL;

console.log('\n1 · the provider is decided by the model id');
{
  since();
  if (providerFor('claude-sonnet-4-6') !== 'anthropic') fail('a Claude id did not route to Anthropic');
  for (const g of GOOGLE_MODELS) if (providerFor(g) !== 'google') fail(`${g} did not route to Google`);
  // An unknown id must not silently reach Google, where the free tier
  // trains on whatever it is sent.
  if (providerFor('something-unknown') !== 'anthropic') fail('an unknown model id routed to Google');
  okIf(`${GOOGLE_MODELS.size} Google ids route to Google, everything else to Anthropic`);

  since();
  for (const g of GOOGLE_MODELS) if (!CANONICAL_MODELS.includes(g)) fail(`${g} routes to Google but is not canonical, so META validation would reject it`);
  okIf('every Google id is canonical');
}

console.log('\n2 · each agent needs its own provider key, not Anthropic\'s');
{
  since();
  if (hasKeyFor('gemini-2.5-flash', { anthropicKey: 'a' })) fail('a Gemini agent was satisfied by an Anthropic key');
  if (!hasKeyFor('gemini-2.5-flash', { geminiKey: 'g' })) fail('a Gemini agent rejected a Google key');
  if (hasKeyFor('claude-sonnet-4-6', { geminiKey: 'g' })) fail('a Claude agent was satisfied by a Google key');
  if (!hasKeyFor('claude-sonnet-4-6', { anthropicKey: 'a' })) fail('a Claude agent rejected an Anthropic key');
  if (hasKeyFor('claude-sonnet-4-6', {})) fail('no key at all was accepted');
  okIf('the key check follows the model, in both directions');

  since();
  // The whole point of the move: an empty Anthropic account must not
  // stop the free path.
  const res = await callModel({ model: 'gemini-2.5-flash', system: 's', userContent: 'u', apiKey: 'anthropic-only' });
  if (res.ok) fail('a Gemini call succeeded with no Google key');
  if (!String(res.body).includes('no key for provider google')) fail(`the missing-key failure was not named: ${JSON.stringify(res)}`);
  if (res.retryable) fail('a missing key was marked retryable; it will never succeed on a retry');
  okIf('a missing Google key fails named, and not as retryable');
}

console.log('\n3 · model_override is validated, not trusted');
{
  since();
  if (pickModel('gemini-2.5-flash', { model_override: 'claude-sonnet-4-6' }) !== 'claude-sonnet-4-6') {
    fail('a canonical override was ignored, so the paid path cannot upgrade to Sonnet');
  }
  okIf('a canonical override is honoured · the purchase path can re-run on Sonnet');

  since();
  for (const junk of ['gpt-5', '../../etc', '', '   ', null, undefined, 42, {}]) {
    const got = pickModel('gemini-2.5-flash', { model_override: junk });
    if (got !== 'gemini-2.5-flash') fail(`override ${JSON.stringify(junk)} was accepted and resolved to ${got}`);
  }
  okIf('non-canonical, empty and non-string overrides all fall back to the agent model');
}

console.log('\n4 · the fleet is on the providers the recut chose');
{
  since();
  const pub = Object.keys(AGENTS).filter(s => !OPERATOR_ONLY_SLUGS.has(s));
  const wrong = pub.filter(s => providerFor(modelOf(s)) !== 'google');
  if (wrong.length) fail(`public agents not on Google: ${wrong.map(s => `${s} (${modelOf(s)})`).join(', ')}`);
  else okIf(`all ${pub.length} public agents run the free path on Google`);

  since();
  const opOnly = [...OPERATOR_ONLY_SLUGS].filter(s => AGENTS[s]);
  const drifted = opOnly.filter(s => providerFor(modelOf(s)) !== 'anthropic');
  if (drifted.length) fail(`operator-only agents moved off Anthropic: ${drifted.join(', ')}`);
  else okIf(`all ${opOnly.length} operator-only agents stay on Anthropic`);
}

console.log('\n5 · there is exactly one model call in the codebase');
{
  since();
  const offenders = [];
  for (const slug of Object.keys(AGENTS)) {
    const file = `agents/${slug.replace(/_synthesizer$/, '').replace(/_/g, '-')}.js`;
    let src;
    try { src = read(file); } catch { continue; }
    if (src.includes('api.anthropic.com')) offenders.push(`${file} calls Anthropic directly`);
    if (src.includes('generativelanguage.googleapis.com')) offenders.push(`${file} calls Google directly`);
    if (/async function callClaude/.test(src)) offenders.push(`${file} still has its own callClaude`);
  }
  for (const o of offenders) fail(o);
  okIf('no agent reaches a provider except through agents/model-call.js');

  since();
  // run.js must gate on the agent's own provider, or an empty Anthropic
  // account blocks the Gemini agents it was supposed to unblock.
  const runSrc = read('api/agents/run.js');
  if (!/hasKeyFor\(resolvedModel/.test(runSrc)) fail('api/agents/run.js no longer gates on the agent\'s own provider key');
  if (!/geminiKey: GEMINI_API_KEY/.test(runSrc)) fail('api/agents/run.js does not pass the Google key to agents');
  okIf('the runtime gate and key handoff are provider-aware');
}

console.log('\n6 · the paid-tier requirement is recorded where it is made');
{
  since();
  // Not decoration. Google's free tier trains on prompts and lets human
  // reviewers read them, which is disqualifying for brand positioning.
  // Whoever next edits this file has to meet that sentence.
  const src = read('agents/model-call.js');
  for (const probe of ['PAID TIER ONLY', 'ai.google.dev/gemini-api/terms', 'human']) {
    if (!src.includes(probe)) fail(`agents/model-call.js lost the paid-tier rationale ("${probe}")`);
  }
  okIf('the paid-tier requirement and its reason are documented at the call site');
}

const KEY = process.env.GEMINI_API_KEY || '';
console.log(`\n7 · live Google call ${KEY ? '' : '(SKIPPED · no GEMINI_API_KEY)'}`);
if (KEY) {
  since();
  const r = await callModel({
    model: 'gemini-2.5-flash',
    system: 'Reply with only a JSON object {"line": "..."} . Never use an em dash. No exclamation points.',
    userContent: 'Write one sentence about a brand that refuses to compete on price.',
    geminiKey: KEY, maxTokens: 200,
  });
  if (!r.ok) fail(`live Google call failed: ${JSON.stringify(r).slice(0, 300)}`);
  else {
    console.log(`     text: ${r.text.trim().slice(0, 160)}`);
    console.log(`     tokens in/out: ${r.tokens_in}/${r.tokens_out}`);
    if (r.provider !== 'google') fail(`provider reported as ${r.provider}`);
    if (r.tokens_in == null) fail('usage was not mapped from usageMetadata');
    if (r.text.includes('—')) fail('the live Google answer contains an em dash · the voice codex does not survive the provider move as-is');
  }
  okIf('a live Google call returns usable, codex-clean text with usage mapped');
}

console.log('');
if (failures.length) {
  console.error(`model-routing: FAILED · ${failures.length} problem${failures.length === 1 ? '' : 's'}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('model-routing: GREEN');
