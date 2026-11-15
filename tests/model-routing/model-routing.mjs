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
import { providerFor, hasKeyFor, pickModel, callModel, GOOGLE_MODELS, effectiveProvider, FALLBACK_ANTHROPIC_MODEL, GOOGLE_MIN_OUTPUT, GOOGLE_THINKING } from '../../agents/model-call.js';
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

console.log('\n2c · a Google call has room to answer');
{
  // Gemini counts its reasoning against maxOutputTokens. Seen live on 15
  // November 2026: a long answer with a cap of 8,192 came back cut after
  // 1,742 characters because the thoughts had spent the rest. An agent's
  // own cap (3,000 to 6,500) would cut far sooner.
  since();
  const realFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }], usageMetadata: {} }), { status: 200 });
  };
  try {
    const r = await callModel({ model: G, system: 's', userContent: 'u', geminiKey: 'g', maxTokens: 3000 });
    const cfg = sent?.generationConfig || {};
    if (!r.ok) fail(`the mocked Google call failed: ${JSON.stringify(r).slice(0, 200)}`);
    if (!(GOOGLE_MIN_OUTPUT >= 16384)) fail(`GOOGLE_MIN_OUTPUT is ${GOOGLE_MIN_OUTPUT}; thoughts alone were seen to spend about 7,700 tokens`);
    if (cfg.maxOutputTokens !== GOOGLE_MIN_OUTPUT) fail(`an agent asking for 3000 tokens was sent maxOutputTokens ${cfg.maxOutputTokens}, so its reasoning can starve its answer`);
    if (JSON.stringify(cfg.thinkingConfig) !== JSON.stringify(GOOGLE_THINKING)) fail(`the agent call carries thinkingConfig ${JSON.stringify(cfg.thinkingConfig)}`);
    if (cfg.responseMimeType !== 'application/json') fail('the agent call lost JSON mode');
  } finally { globalThis.fetch = realFetch; }
  okIf('an agent call is sent with the output floor, the thinking level and JSON mode');
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

console.log('\n4 · the whole fleet is on Google');
{
  // Operator decision, 15 November 2026: nothing may wait on the Anthropic
  // account. The public agents moved at the recut, the seven operator-only
  // agents on this date. An agent that resolves to a Claude id fails the
  // moment that account is empty, which is how the seven stood for weeks.
  since();
  const pub = Object.keys(AGENTS).filter(s => !OPERATOR_ONLY_SLUGS.has(s));
  const wrong = pub.filter(s => providerFor(modelOf(s)) !== 'google');
  if (wrong.length) fail(`public agents not on Google: ${wrong.map(s => `${s} (${modelOf(s)})`).join(', ')}`);
  else okIf(`all ${pub.length} public agents run on Google`);

  since();
  const opOnly = [...OPERATOR_ONLY_SLUGS].filter(s => AGENTS[s]);
  const stuck = opOnly.filter(s => providerFor(modelOf(s)) !== 'google');
  if (stuck.length) fail(`operator-only agents still wait on Anthropic: ${stuck.map(s => `${s} (${modelOf(s)})`).join(', ')}`);
  else okIf(`all ${opOnly.length} operator-only agents run on Google`);

  since();
  // An agent with no META.model resolves to the Sonnet default by omission.
  // Only an agent that makes no model call may leave it out.
  const silent = Object.keys(AGENTS).filter(s => !AGENTS[s].META.model);
  const calling = silent.filter(s => {
    const file = `agents/${s.replace(/_synthesizer$/, '').replace(/_/g, '-')}.js`;
    try { return /callModel\(/.test(read(file)); } catch { return false; }
  });
  if (calling.length) fail(`these agents call a model but name none, so they resolve to Anthropic: ${calling.join(', ')}`);
  else okIf('no agent reaches Anthropic by leaving its model out');
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

console.log('\n6b · the tool pages go through Google, in the shape they already speak');
{
  // Owner decision, 15 November 2026. The pages call /api/claude with an
  // Anthropic body and read an Anthropic answer; the route decides who
  // answers. Every upstream call below is answered here, none leaves.
  const { TOOL_PROVIDER, GOOGLE_TOOL_MODELS, toolProvider, toGoogleContents, unwrapJsonFence } = await import('../../api/_lib/tool-provider.js');
  const route = await import('../../api/claude.js');
  const handler = route.POST;

  since();
  // Edge must begin answering within about 25 seconds and this route answers
  // only when the model is done. On Edge a long reading came back as a 504
  // page (seen live, 15 November 2026). It has to stay a Node function with
  // room to finish, and must not also export a default handler, which the
  // Node runtime would call with (req, res).
  if (route.config?.runtime !== 'nodejs') fail(`api/claude.js runs on "${route.config?.runtime}"; on Edge a long answer is cut at about 25 seconds`);
  if (!(route.config?.maxDuration >= 120)) fail(`api/claude.js has maxDuration ${route.config?.maxDuration}; a long reading needs more`);
  if (typeof route.POST !== 'function' || typeof route.OPTIONS !== 'function') fail('api/claude.js does not export POST and OPTIONS');
  if (route.default) fail('api/claude.js still has a default export beside POST');
  const gem = await import('../../api/gemini.js');
  if (gem.config?.runtime !== 'nodejs' || typeof gem.POST !== 'function' || gem.default) fail('api/gemini.js is not a Node function with a POST export');
  okIf('the tool route is a Node function with room for a long answer');

  since();
  if (TOOL_PROVIDER !== 'google') fail(`TOOL_PROVIDER is "${TOOL_PROVIDER}". If that is deliberate, the legal pages and this section change with it.`);
  if ([...GOOGLE_TOOL_MODELS].sort().join() !== [...GOOGLE_MODELS].sort().join()) fail('the tool route and agents/model-call.js disagree on the Google ids');
  if (toolProvider({ geminiKey: 'g', anthropicKey: 'a' }) !== 'google') fail('with both keys the tools did not go to Google');
  if (toolProvider({ anthropicKey: 'a' }) !== 'anthropic') fail('with no Google key the tools did not fall back to Anthropic');
  if (toolProvider({}) !== null) fail('with no key at all a provider was still named');
  okIf('Google answers the tools; Anthropic only when the Google key is absent');

  since();
  const c = toGoogleContents([
    { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } }, { type: 'text', text: 'read this mark' }] },
    { role: 'assistant', content: 'noted' },
  ]);
  if (c[0].role !== 'user' || c[1].role !== 'model') fail('roles were not mapped (assistant must become model)');
  if (c[0].parts[0]?.inlineData?.mimeType !== 'image/jpeg' || c[0].parts[0]?.inlineData?.data !== 'QUJD') fail('a base64 image block did not become inlineData, so Logo Evaluation would send no image');
  if (c[0].parts[1]?.text !== 'read this mark' || c[1].parts[0]?.text !== 'noted') fail('text was lost in translation');
  if (unwrapJsonFence('```json\n{"a":1}\n```') !== '{"a":1}') fail('a fenced JSON answer kept its fence');
  if (unwrapJsonFence('Use this:\n```css\na{}\n```') !== 'Use this:\n```css\na{}\n```') fail('prose with a code block was altered');
  okIf('text, images and roles translate; only a whole-answer JSON fence is removed');

  // The handler itself, with the network answered locally.
  const realFetch = globalThis.fetch;
  const env = { g: process.env.GEMINI_API_KEY, a: process.env.ANTHROPIC_API_KEY };
  const call = async (body, headers = {}) => {
    const res = await handler(new Request('https://x.test/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: res.status, data: await res.json() };
  };
  const ask = { model: 'claude-sonnet-4-6', max_tokens: 3000, system: 'Return JSON.', messages: [{ role: 'user', content: 'hello' }] };
  try {
    since();
    process.env.GEMINI_API_KEY = 'test-google'; process.env.ANTHROPIC_API_KEY = 'test-anthropic';
    let seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n{"ok":true}\n```' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } }), { status: 200 });
    };
    let r = await call(ask, { 'X-QB-Lang': 'fr' });
    if (seen.length !== 1 || !seen[0].url.includes('generativelanguage.googleapis.com')) fail(`the tool call went to ${seen.map(x => x.url).join(', ') || 'nowhere'}, not to Google`);
    else {
      if (seen[0].url.includes('claude')) fail('a Claude id was sent to Google');
      if (seen[0].headers['x-goog-api-key'] !== 'test-google') fail('the Google key was not the one sent');
      if (!/Return JSON\./.test(seen[0].body.systemInstruction?.parts?.[0]?.text || '')) fail('the system prompt did not reach Google');
      if (seen[0].body.systemInstruction.parts[0].text === 'Return JSON.') fail('a French reader got no language directive on the Google path');
      if (seen[0].body.generationConfig.maxOutputTokens !== GOOGLE_MIN_OUTPUT) fail(`the tool call was sent maxOutputTokens ${seen[0].body.generationConfig.maxOutputTokens}; the page's own cap would let the reasoning starve the answer`);
      if (JSON.stringify(seen[0].body.generationConfig.thinkingConfig) !== JSON.stringify(GOOGLE_THINKING)) fail('the tool call does not carry the thinking level');
    }
    if (r.status !== 200 || r.data?.content?.[0]?.text !== '{"ok":true}') fail(`the answer is not in the shape the pages read: ${JSON.stringify(r.data)}`);
    if (r.data?.usage?.input_tokens !== 7) fail('usage was not mapped');
    okIf('a tool call reaches Google and comes back as content[0].text');

    since();
    seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push(String(url));
      return seen.length < 3
        ? new Response(JSON.stringify({ error: { message: 'high demand' } }), { status: 503 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'third answered' }] } }] }), { status: 200 });
    };
    r = await call(ask);
    if (seen.length !== 3 || new Set(seen).size !== 3) fail(`a capacity refusal did not walk the three ids (calls: ${seen.length}, distinct: ${new Set(seen).size})`);
    if (r.data?.content?.[0]?.text !== 'third answered') fail('the walk did not return the model that answered');
    okIf('a capacity refusal walks to the next Google id');

    since();
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 });
    r = await call(ask);
    if (r.status !== 429 || typeof r.data?.error?.message !== 'string' || /quota/.test(r.data.error.message)) fail(`a refusal is not a fixed sentence under error.message: ${JSON.stringify(r.data)}`);
    globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 });
    r = await call(ask);
    if (r.status !== 502 || !/SAFETY/.test(r.data?.error?.message || '')) fail('an empty answer was passed on as a success');
    okIf('a refusal or an empty answer reaches the page as error.message');

    since();
    globalThis.fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
    r = await call(ask);
    if (r.status !== 504 || !/took too long/.test(r.data?.error?.message || '')) fail(`a call that runs out of time is not said plainly: ${r.status} ${JSON.stringify(r.data)}`);
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    r = await call(ask);
    if (r.status !== 502 || !/could not be reached/.test(r.data?.error?.message || '')) fail(`a network failure is not said plainly: ${r.status} ${JSON.stringify(r.data)}`);
    okIf('running out of time and losing the network are each said in one sentence');

    since();
    delete process.env.GEMINI_API_KEY;
    seen = [];
    globalThis.fetch = async (url, init) => { seen.push({ url: String(url), body: JSON.parse(init.body) }); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'from claude' }] }), { status: 200 }); };
    r = await call(ask);
    if (seen.length !== 1 || !seen[0].url.includes('api.anthropic.com')) fail('with no Google key the call did not go to Anthropic');
    else if (seen[0].body.model !== 'claude-sonnet-4-6') fail('the Anthropic path lost the model the page asked for');
    if (r.data?.content?.[0]?.text !== 'from claude') fail('the Anthropic answer was not passed through');
    okIf('with no Google key the same call is answered by Anthropic, unchanged');

    // Last, because it changes what this process sends from here on.
    since();
    process.env.GEMINI_API_KEY = 'test-google';
    seen = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push(body);
      return body.generationConfig.thinkingConfig
        ? new Response(JSON.stringify({ error: { message: 'Unknown name "thinkingConfig"' } }), { status: 400 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'answered without it' }] } }] }), { status: 200 });
    };
    r = await call(ask);
    if (r.data?.content?.[0]?.text !== 'answered without it' || seen.length !== 2) fail(`an id that refuses thinkingConfig was not asked again without it (calls: ${seen.length}, answer: ${JSON.stringify(r.data).slice(0, 120)})`);
    r = await call(ask);
    if (seen.length !== 3 || seen[2].generationConfig.thinkingConfig) fail('after a refusal the field is still sent, so every call pays a failed request first');
    okIf('an id that refuses the thinking level is asked again without it, once');
  } finally {
    globalThis.fetch = realFetch;
    if (env.g === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = env.g;
    if (env.a === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = env.a;
  }
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
