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
import { providerFor, hasKeyFor, pickModel, callModel, GOOGLE_MODELS, effectiveProvider, FALLBACK_ANTHROPIC_MODEL } from '../../agents/model-call.js';
import { OPERATOR_ONLY_SLUGS } from '../../api/_lib/operator-only.js';

const failures = [];
const fail = m => failures.push(m);
const ok = m => console.log(`  ok · ${m}`);
let mark = 0;
const since = () => { mark = failures.length; };
const okIf = m => { if (failures.length === mark) ok(m); };
const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const modelOf = slug => AGENTS[slug].META.model || DEFAULT_MODEL;
// Never hard-code a Google id here. Google retires them: the three this
// fleet shipped with were all withdrawn, and a test pinned to one of
// them would have gone quietly meaningless instead of failing.
const G = [...GOOGLE_MODELS][0];

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
  // Withdrawn by Google and verified 404 on 2026-09-23. Listing one of
  // these again would 404 every public agent in production.
  const RETIRED = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  for (const r of RETIRED) {
    if (GOOGLE_MODELS.has(r)) fail(`${r} is retired by Google and would 404 every public agent`);
    if (CANONICAL_MODELS.includes(r)) fail(`${r} is retired and must not be canonical`);
  }
  // `-latest` aliases re-point without notice, which breaks the voice
  // and schema guarantees this fleet makes.
  for (const g of GOOGLE_MODELS) if (g.endsWith('-latest')) fail(`${g} is a floating alias; pin an explicit version`);
  okIf('no retired id and no floating alias is routed to Google');

  since();
  for (const g of GOOGLE_MODELS) if (!CANONICAL_MODELS.includes(g)) fail(`${g} routes to Google but is not canonical, so META validation would reject it`);
  okIf('every Google id is canonical');
}

console.log('\n2 · each agent needs its own provider key, not Anthropic\'s');
{
  since();
  // A Gemini agent IS satisfied by an Anthropic key, deliberately: the
  // fallback below means funding either account yields a working
  // product instead of a fleet split across two.
  if (!hasKeyFor(G, { anthropicKey: 'a' })) fail('a Gemini agent rejected an Anthropic key, so funding one account leaves half the fleet dead');
  if (!hasKeyFor(G, { geminiKey: 'g' })) fail('a Gemini agent rejected a Google key');
  if (hasKeyFor('claude-sonnet-4-6', { geminiKey: 'g' })) fail('a Claude agent was satisfied by a Google key');
  if (!hasKeyFor('claude-sonnet-4-6', { anthropicKey: 'a' })) fail('a Claude agent rejected an Anthropic key');
  if (hasKeyFor('claude-sonnet-4-6', {})) fail('no key at all was accepted');
  okIf('the key check follows the model, in both directions');

  since();
  // The whole point of the move: an empty Anthropic account must not
  // stop the free path.
  const res = await callModel({ model: G, system: 's', userContent: 'u' });
  if (res.ok) fail('a Gemini call succeeded with no key at all');
  if (!String(res.body).includes('no key for provider google')) fail(`the missing-key failure was not named: ${JSON.stringify(res)}`);
  if (res.retryable) fail('a missing key was marked retryable; it will never succeed on a retry');
  okIf('with no key at all, the call fails named and not as retryable');
}

console.log('\n2b · funding either account yields a working fleet');
{
  since();
  const g = G;
  if (effectiveProvider(g, { geminiKey: 'g', anthropicKey: 'a' }) !== 'google') fail('a present Google key was not preferred');
  if (effectiveProvider(g, { anthropicKey: 'a' }) !== 'anthropic') fail('a Google agent did not fall back when only an Anthropic key was present');
  if (effectiveProvider(g, {}) !== 'google') fail('with no keys the reported provider should stay the declared one');
  if (effectiveProvider('claude-sonnet-4-6', { geminiKey: 'g' }) !== 'anthropic') fail('an Anthropic agent fell back to Google · brand data must never reach Google unintentionally');
  okIf('Google preferred when keyed, Anthropic fallback when not, never the reverse');

  since();
  // The fallback substitutes the MODEL too. A Gemini id sent to
  // Anthropic is a 404, which would look like an outage.
  if (!/claude/.test(FALLBACK_ANTHROPIC_MODEL)) fail(`the fallback model is not a Claude id: ${FALLBACK_ANTHROPIC_MODEL}`);
  const src = readFileSync(new URL('../../agents/model-call.js', import.meta.url), 'utf8');
  if (!/\[effectiveModel\]/.test(src)) fail('the fallback swaps provider but not model · a Gemini id would be sent to Anthropic');
  if (!/console\.warn\(`\[model-call\] GEMINI_API_KEY absent/.test(src)) fail('the fallback is silent · a free tier quietly running on Sonnet is a bill nobody chose');
  okIf('the fallback swaps the model too, and says so loudly');
}

console.log('\n3 · model_override is validated, not trusted');
{
  since();
  if (pickModel(G, { model_override: 'claude-sonnet-4-6' }) !== 'claude-sonnet-4-6') {
    fail('a canonical override was ignored, so the paid path cannot upgrade to Sonnet');
  }
  okIf('a canonical override is honoured · the purchase path can re-run on Sonnet');

  since();
  for (const junk of ['gpt-5', '../../etc', '', '   ', null, undefined, 42, {}]) {
    const got = pickModel(G, { model_override: junk });
    if (got !== G) fail(`override ${JSON.stringify(junk)} was accepted and resolved to ${got}`);
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

console.log('\n6 · the tier decision is recorded where it is made');
{
  since();
  // Which Google tier the key is on changes what happens to customer
  // prompts, so the decision is written at the call site rather than
  // living only in a commit message.
  const src = read('agents/model-call.js');
  for (const probe of ['FREE TIER', 'operator decision']) {
    if (!src.includes(probe)) fail(`agents/model-call.js lost the tier decision ("${probe}")`);
  }
  okIf('the tier decision is documented at the call site');
}

const KEY = process.env.GEMINI_API_KEY || '';
console.log(`\n7 · live Google call ${KEY ? '' : '(SKIPPED · no GEMINI_API_KEY)'}`);
if (KEY) {
  since();
  // The check that would have caught the retirement. Every id this fleet
  // routes to Google must actually answer.
  for (const g of GOOGLE_MODELS) {
    const probe = await callModel({ model: g, system: 'Reply with only {"ok":true}', userContent: 'ping', geminiKey: KEY, maxTokens: 800 });
    if (!probe.ok) {
      // 503 is Google capacity, not a dead id. Named, not silently passed.
      const transient = /high demand|503/i.test(String(probe.body));
      const line = `${g} did not answer: ${String(probe.body).slice(0, 80)}`;
      if (transient) console.log(`     note · ${line} (capacity, not retirement)`);
      else fail(line);
    } else {
      console.log(`     ${g} answered`);
    }
  }
  okIf('every routed Google id answers');

  since();
  const r = await callModel({
    model: G,
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
