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
// PAID TIER ONLY, and this is not a preference. On Google's free tier
// prompts and responses are used to improve their products and human
// reviewers may read them. BrandOS agents ingest positioning,
// competitive analysis and what a founder refuses to be. That belongs
// on the paid tier, where Google states it is not used for training,
// or it belongs nowhere. See https://ai.google.dev/gemini-api/terms
//
// The response shape is identical whichever provider answers, so every
// caller downstream is unchanged: { ok, text, raw, tokens_in, tokens_out }
// on success, { ok:false, retryable, timeout, status, body } on failure.

import { CANONICAL_MODELS } from './contract.js';

export const GOOGLE_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
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

async function callGoogle({ model, system, text, apiKey, maxTokens, signal }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          maxOutputTokens: maxTokens,
          // Every agent prompt ends "return only the JSON object". Asking
          // for JSON at the API level removes the fenced-markdown failure
          // mode the defensive parser exists to survive. The parser stays
          // as the backstop.
          responseMimeType: 'application/json',
        },
      }),
      signal,
    }
  );
  return res;
}

/**
 * @param {object}  o
 * @param {string}  o.model        canonical model id; picks the provider
 * @param {string}  o.system       system prompt
 * @param {string} [o.userContent] user message (the fleet's name for it)
 * @param {string} [o.userText]    same thing, soul-map's name for it
 * @param {string} [o.apiKey]      Anthropic key
 * @param {string} [o.geminiKey]   Google key, paid tier
 */
export async function callModel({
  model, system, userContent, userText, apiKey, geminiKey, maxTokens = 3000, timeoutMs = 60000,
}) {
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    const args = { model: effectiveModel, system, text, apiKey: key, maxTokens, signal: controller.signal };
    res = provider === 'google' ? await callGoogle(args) : await callAnthropic(args);
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') {
      return { ok: false, retryable: false, timeout: true, status: 0, body: '', provider };
    }
    return { ok: false, retryable: true, status: 0, body: (e && e.message) || '', provider };
  }
  clearTimeout(timer);

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
      ok: true, provider, model: effectiveModel, text: out, raw: data,
      tokens_in: u.promptTokenCount ?? null,
      tokens_out: u.candidatesTokenCount ?? null,
    };
  }

  const out = data?.content?.[0]?.text || '';
  const u = data?.usage || {};
  return {
    ok: true, provider, model: effectiveModel, fell_back: fellBack, text: out, raw: data,
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
