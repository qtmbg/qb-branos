// agents/model-call.js
// One model call for the whole fleet. Recut follow-up, 2026-09-21.
//
// Eighteen agents each carried their own copy of callClaude and
// seventeen of them were byte-identical, so a provider change meant
// eighteen edits and eighteen chances to diverge. This is that function,
// once, with a provider chosen from the model id.
//
// WHY GOOGLE AT ALL. Under the recut the foundation runs free, so model
// cost is the main variable cost of the free tier. Gemini Flash is a
// fraction of Sonnet for work the free path does not need Sonnet for.
//
// FREE TIER, by operator decision 2026-09-23. Google's free tier uses
// prompts and responses to improve their products. That is accepted
// here: the free path costs nothing to run, which is the point. The
// seven operator-only agents stayed on Anthropic until 15 November 2026,
// when the operator moved them here too: with the Anthropic account
// empty they could not run at all. Every production agent is on Google.
//
// WHAT CHANGED SINCE. This note once ended "nothing a customer paid for
// is generated this way". That was true of the $79 document, which was
// to re-run the agents on Sonnet through model_override. The paid plan
// is now Starter (3 October 2026), its agents are these same agents, and
// nothing sets model_override, so Starter work is generated on Google's
// free tier too. By operator decision of 15 November 2026 the tool pages
// follow (api/_lib/tool-provider.js) until revenue covers Anthropic.
// privacy.html lists Google as a processor. By operator decision the
// legal pages do not describe this use; they may not claim the opposite.
//
// The response shape is identical whichever provider answers, so every
// caller downstream is unchanged: { ok, text, raw, tokens_in, tokens_out }
// on success, { ok:false, retryable, timeout, status, body } on failure.

import { CANONICAL_MODELS } from './contract.js';
import { withLanguage } from './lang.js';

// Verified live against the production key on 2026-09-23. The three ids
// this file shipped with (gemini-2.5-flash, -flash-lite and 2.0-flash)
// are RETIRED: Google answers 404 "no longer available to new users".
// Every agent would have 404'd the moment the key was set.
//
// The `-latest` aliases are deliberately excluded. They re-point without
// notice, and this fleet makes voice and schema guarantees that a silent
// model swap would break.
export const GOOGLE_MODELS = new Set([
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
]);

// What a Google-routed agent runs on when no Google key is present.
export const FALLBACK_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export function providerFor(model) {
  return GOOGLE_MODELS.has(model) ? 'google' : 'anthropic';
}

/**
 * Is the key this model needs actually present?
 * Agents call this in place of the old `if (!anthropicKey)` check, so an
 * agent on Gemini fails config_missing when GEMINI_API_KEY is absent
 * rather than when ANTHROPIC_API_KEY is.
 */
export function hasKeyFor(model, { anthropicKey, geminiKey } = {}) {
  // A Google agent is satisfied by an Anthropic key, because of the
  // fallback below. Without this, funding one account would leave the
  // other half of the fleet dead and the operator chasing two keys to
  // get a working product.
  if (providerFor(model) === 'google') return Boolean(geminiKey || anthropicKey);
  return Boolean(anthropicKey);
}

/**
 * Which provider will actually serve this call, given the keys present.
 *
 * A Google-routed agent falls back to Anthropic when GEMINI_API_KEY is
 * absent and an Anthropic key is there. The fallback exists so that
 * funding EITHER account produces a working product: the alternative is
 * an operator with one funded account and a fleet split across two.
 *
 * It is loud, because the cost profile changes when it fires. Sonnet is
 * materially more expensive than Flash, and a free tier quietly running
 * on Sonnet is a bill nobody chose.
 */
export function effectiveProvider(model, { anthropicKey, geminiKey } = {}) {
  const want = providerFor(model);
  if (want === 'google' && !geminiKey && anthropicKey) return 'anthropic';
  return want;
}

async function callAnthropic({ model, system, text, apiKey, maxTokens, signal }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: text }],
    }),
    signal,
  });
  return res;
}

// ROOM TO ANSWER. Gemini counts its own reasoning against maxOutputTokens.
// Seen live on 15 November 2026: a long answer asked for with a cap of
// 8,192 came back cut after 1,742 characters, finishReason MAX_TOKENS,
// because the thoughts had spent the rest. So a caller's cap is a floor
// here, never the ceiling: the prompt sets the length. Flash models take
// up to 65,536 output tokens.
export const GOOGLE_MIN_OUTPUT = 32768;

// LESS REASONING. These calls write a structured reading from a brief that
// is already decided, so the default level buys latency more than quality:
// the same 800-token answer took between 10 and 34 seconds. LOW is accepted
// by every Flash id in Google's table. An id that refuses the field answers
// 400; googleRequest then asks again without it and stops sending it.
export const GOOGLE_THINKING = { thinkingLevel: 'LOW' };
let thinkingAccepted = true;

/**
 * One generateContent call, shared by the agents and the tool route
 * (api/claude.js). `build(thinking)` returns the request body with or
 * without thinkingConfig.
 */
export async function googleRequest({ model, apiKey, build, signal }) {
  const post = thinking => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(build(thinking)), signal }
  );
  const res = await post(thinkingAccepted);
  if (res.status !== 400 || !thinkingAccepted) return res;
  const plain = await post(false);
  if (plain.ok) {
    thinkingAccepted = false;
    console.warn(`[model-call] ${model} refused thinkingConfig; sending without it from now on`);
  }
  return plain;
}

// WHICH ID IS ASKED FIRST, AND FOR HOW LONG. Google's free tier often holds
// a request open without answering, or refuses for capacity, on one id
// while another answers at once. Seen live on 15 November 2026: the
// preferred id sat on every call for as long as it was allowed, while the
// next id answered the same request in 2 to 20 seconds.
//   · An id that just stalled or refused is asked last for five minutes,
//     so one bad id costs one caller one wait. It is never dropped.
//   · An earlier id is given long enough to answer when healthy (a long
//     reading arrived within 35 seconds) and no longer.
// The memory is per warm instance. A cold start forgets, which is fine.
const REST_MS = 5 * 60 * 1000;
const restUntil = new Map();
export function restGoogleId(id, now = Date.now()) { restUntil.set(id, now + REST_MS); }
export function forgetGoogleHealth() { restUntil.clear(); }
export function byHealth(preferred, now = Date.now()) {
  const resting = m => (restUntil.get(m) || 0) > now;
  return [...preferred.filter(m => !resting(m)), ...preferred.filter(resting)];
}
// Read at call time so a test can shorten it.
export const googleStallMs = position => (Number(process.env.QB_GOOGLE_STALL_MS) || 45000) * [1, 4 / 3, 8 / 3][Math.min(position, 2)];

/**
 * Ask Google ids in turn. A capacity refusal (429, 503) or a stall rests
 * that id and moves to the next. `limitMs(position, isLast)` is how long
 * each one gets. Resolves { res, servedBy }, with res null when every id
 * stalled. Throws AbortError only when the caller's own signal fired.
 */
export async function googleWalk({ chain, apiKey, build, signal, limitMs }) {
  let res = null, servedBy = null;
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    const last = i === chain.length - 1;
    const attempt = new AbortController();
    const whole = () => attempt.abort();
    if (signal) { if (signal.aborted) attempt.abort(); else signal.addEventListener('abort', whole, { once: true }); }
    const timer = setTimeout(() => attempt.abort(), limitMs(i, last));
    try {
      res = await googleRequest({ model: id, apiKey, build, signal: attempt.signal });
    } catch (e) {
      if (!(e && e.name === 'AbortError') || (signal && signal.aborted)) throw e;
      console.warn(`[model-call] ${id} did not answer in ${Math.round(limitMs(i, last))} ms; ${last ? 'no routed model is left' : 'trying the next routed model'}`);
      restGoogleId(id);
      res = null;
      continue;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', whole);
    }
    servedBy = id;
    // Only capacity walks. A 4xx is a real rejection and the next model
    // would reject it too.
    if (res.status !== 429 && res.status !== 503) break;
    restGoogleId(id);
    if (!last) console.warn(`[model-call] ${id} returned ${res.status}; trying the next routed model`);
  }
  return { res, servedBy };
}

// The body an agent sends to Google, with or without thinkingConfig.
const googleBody = ({ system, text, maxTokens }) => thinking => ({
  contents: [{ role: 'user', parts: [{ text }] }],
  ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  generationConfig: {
    maxOutputTokens: Math.max(maxTokens, GOOGLE_MIN_OUTPUT),
    ...(thinking ? { thinkingConfig: GOOGLE_THINKING } : {}),
    // Every agent prompt ends "return only the JSON object". Asking
    // for JSON at the API level removes the fenced-markdown failure
    // mode the defensive parser exists to survive. The parser stays
    // as the backstop.
    responseMimeType: 'application/json',
  },
});

/**
 * @param {object}  o
 * @param {string}  o.model        canonical model id; picks the provider
 * @param {string}  o.system       system prompt
 * @param {string} [o.userContent] user message (the fleet's name for it)
 * @param {string} [o.userText]    same thing, soul-map's name for it
 * @param {string} [o.apiKey]      Anthropic key
 * @param {string} [o.geminiKey]   Google key, paid tier
 * @param {string} [o.lang]        language the reader gets ('en' or 'fr'); see agents/lang.js
 */
export async function callModel({
  model, system, userContent, userText, apiKey, geminiKey, maxTokens = 3000, timeoutMs = 60000, lang,
}) {
  // English leaves the prompt byte-identical. Any other language appends
  // one directive, so every agent answers in the reader's language without
  // a second copy of its prompt.
  system = withLanguage(system, lang);
  const wanted = providerFor(model);
  const provider = effectiveProvider(model, { anthropicKey: apiKey, geminiKey });
  const fellBack = provider !== wanted;
  // Substituting a model, not just a provider: a Gemini id means nothing
  // to Anthropic.
  const effectiveModel = fellBack ? FALLBACK_ANTHROPIC_MODEL : model;
  if (fellBack) {
    console.warn(`[model-call] GEMINI_API_KEY absent · ${model} falling back to ${effectiveModel}. This costs materially more per call.`);
  }
  const key = provider === 'google' ? geminiKey : apiKey;
  const text = userContent ?? userText ?? '';

  // Named rather than left to a 401, so a misconfigured deploy reads as
  // configuration in the logs instead of as an auth failure.
  if (!key) {
    return { ok: false, retryable: false, status: 0, provider,
             body: `no key for provider ${provider}` };
  }

  let res, servedBy;
  if (provider === 'google') {
    // Google's free tier answers 503 "high demand" on the busier models,
    // and sometimes does not answer at all. Retrying the SAME id does not
    // help, so a refusal or a stall walks to the next routed model. The
    // last id asked gets the caller's whole limit; an earlier one gets the
    // shorter stall limit, so a caller's 60 seconds are not all spent
    // waiting on an id that will not answer.
    const chain = byHealth([effectiveModel, ...[...GOOGLE_MODELS].filter(m => m !== effectiveModel)]);
    try {
      ({ res, servedBy } = await googleWalk({
        chain, apiKey: key,
        build: googleBody({ system, text, maxTokens }),
        limitMs: (i, last) => (last ? timeoutMs : Math.min(googleStallMs(i), timeoutMs)),
      }));
    } catch (e) {
      return { ok: false, retryable: true, status: 0, body: (e && e.message) || '', provider };
    }
    // Every routed id stalled.
    if (!res) return { ok: false, retryable: false, timeout: true, status: 0, body: '', provider };
  } else {
    // Claude has no equivalent list and does not walk.
    const chain = [effectiveModel];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await callAnthropic({ model: chain[0], system, text, apiKey: key, maxTokens, signal: controller.signal });
      servedBy = chain[0];
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return { ok: false, retryable: false, timeout: true, status: 0, body: '', provider };
      }
      return { ok: false, retryable: true, status: 0, body: (e && e.message) || '', provider };
    } finally {
      clearTimeout(timer);
    }
  }

  if (res.status === 429 || res.status >= 500) {
    return { ok: false, retryable: true, status: res.status, provider,
             body: await res.text().catch(() => '') };
  }
  if (!res.ok) {
    return { ok: false, retryable: false, status: res.status, provider,
             body: await res.text().catch(() => '') };
  }

  const data = await res.json();

  if (provider === 'google') {
    const cand = data?.candidates?.[0];
    const out = (cand?.content?.parts || []).map(p => p.text || '').join('');
    // A safety block or a token cut returns 200 with no usable text. The
    // defensive parsers downstream would report this as a parse failure,
    // which hides the real cause, so name it here.
    if (!out) {
      const why = cand?.finishReason || data?.promptFeedback?.blockReason || 'empty_candidate';
      return { ok: false, retryable: false, status: 200, provider,
               body: `google returned no text · finishReason=${why}` };
    }
    const u = data?.usageMetadata || {};
    return {
      ok: true, provider, model: servedBy, text: out, raw: data,
      tokens_in: u.promptTokenCount ?? null,
      tokens_out: u.candidatesTokenCount ?? null,
    };
  }

  const out = data?.content?.[0]?.text || '';
  const u = data?.usage || {};
  return {
    ok: true, provider, model: servedBy, fell_back: fellBack, text: out, raw: data,
    tokens_in: u.input_tokens ?? null,
    tokens_out: u.output_tokens ?? null,
  };
}

/**
 * Resolve the model for one run.
 *
 * The free path runs on Gemini because the foundation is free and model
 * cost is its main variable cost. The $79 document is assembled from
 * these same artifacts, so the purchase path re-runs the agents with
 * `runtime_args.model_override` set to a Sonnet id: the buyer's document
 * is generated by the better model, the browser's free view is not.
 *
 * The override is validated against CANONICAL_MODELS. Without that, a
 * runtime argument that reaches the agent from a request body would be
 * an open field naming any model on either provider's API.
 */
export function pickModel(agentModel, runtime_args = {}) {
  const want = runtime_args?.model_override;
  if (typeof want !== 'string' || !want.trim()) return agentModel;
  const m = want.trim();
  if (!CANONICAL_MODELS.includes(m)) {
    console.warn(`[model-call] ignoring non-canonical model_override "${m}"`);
    return agentModel;
  }
  return m;
}
