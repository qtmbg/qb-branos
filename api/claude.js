// BrandOS — tool model proxy
// The tool pages call /api/claude with an Anthropic-shaped body and read an
// Anthropic-shaped answer. They never see a key or a provider.
//
// Which provider answers is decided in api/_lib/tool-provider.js. Today it
// is Google, by owner decision of 15 November 2026. The route keeps its
// name because sixteen pages call it.

import { langFromRequest, withLanguage } from '../agents/lang.js';
import { toolProvider, toGoogleContents, unwrapJsonFence, GOOGLE_TOOL_MODELS, GOOGLE_MIN_OUTPUT, GOOGLE_THINKING, googleRequest } from './_lib/tool-provider.js';

// Node serverless, not Edge. Edge must begin answering within about 25
// seconds, and this route answers only once the model has finished: a long
// reading (a Codex, a dossier) ran past that and the founder got a 504 page
// in place of an answer. Seen live on 15 November 2026, on the day the
// tools moved to Google. api/agents/run.js left Edge for the same reason.
// Same Web-standard handler (Request → Response).
export const config = { runtime: 'nodejs', maxDuration: 300 };

// One budget for the whole request, the walk across Google ids included.
// Under maxDuration, so the founder reads a sentence and not a platform page.
const ANSWER_BUDGET_MS = 240000;

const ALLOWED_MODELS = [
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  // Legacy IDs retained for tools still pinned to them
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001'
];
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const CORS = { 'Access-Control-Allow-Origin': '*' };
const json = (obj, status) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', ...CORS },
});
// The pages read `error.message` first, then `error`. One shape for both providers.
const fail = (status, message, type = 'upstream_error') => json({ type: 'error', error: { type, message } }, status);

async function askGoogle({ body, system, maxTokens, apiKey, signal }) {
  const wanted = GOOGLE_TOOL_MODELS.includes(body.model) ? body.model : GOOGLE_TOOL_MODELS[0];
  const chain = [wanted, ...GOOGLE_TOOL_MODELS.filter(m => m !== wanted)];
  const build = thinking => ({
    contents: toGoogleContents(body.messages),
    generationConfig: {
      // A floor, not the page's own number: Gemini counts its reasoning
      // against this cap and a tight one cuts the answer mid-object.
      maxOutputTokens: Math.max(maxTokens, GOOGLE_MIN_OUTPUT),
      ...(thinking ? { thinkingConfig: GOOGLE_THINKING } : {}),
      ...(body.temperature !== undefined && { temperature: body.temperature }),
    },
    ...(system && { systemInstruction: { parts: [{ text: String(system) }] } }),
  });

  let upstream, servedBy;
  for (const candidate of chain) {
    upstream = await googleRequest({ model: candidate, apiKey, build, signal });
    servedBy = candidate;
    // Only capacity walks to the next id. Any other refusal would be
    // refused by the next model too.
    if (upstream.status !== 429 && upstream.status !== 503) break;
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const busy = upstream.status === 429 || upstream.status === 503;
    // The page paints this line, so it is one of four fixed sentences with a
    // French entry in js/i18n/fr/shared.js. Google's own wording goes to the log.
    console.warn(`[api/claude] google ${servedBy} answered ${upstream.status}: ${data?.error?.message || ''}`);
    return fail(upstream.status, busy
      ? 'The AI service is busy right now. Try again in a minute.'
      : 'The AI service refused the request.',
      busy ? 'overloaded_error' : 'upstream_error');
  }

  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) {
    // A safety block or a token cut answers 200 with nothing to read.
    const why = cand?.finishReason || data?.promptFeedback?.blockReason || 'empty answer';
    return fail(502, `The AI service returned no text (${why}).`);
  }
  const u = data?.usageMetadata || {};
  if (cand?.finishReason === 'MAX_TOKENS') {
    console.warn(`[api/claude] google ${servedBy} cut the answer at the cap · thoughts ${u.thoughtsTokenCount ?? '?'} · visible ${u.candidatesTokenCount ?? '?'}`);
  }
  return json({
    type: 'message',
    role: 'assistant',
    model: servedBy,
    content: [{ type: 'text', text: unwrapJsonFence(text) }],
    stop_reason: cand?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
    usage: { input_tokens: u.promptTokenCount ?? null, output_tokens: u.candidatesTokenCount ?? null },
  }, 200);
}

async function askAnthropic({ body, system, maxTokens, apiKey, signal }) {
  const payload = {
    model: ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL,
    max_tokens: maxTokens,
    messages: body.messages,
    ...(system && { system }),
    ...(body.temperature !== undefined && { temperature: body.temperature }),
  };
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await upstream.json();
  return json(data, upstream.status);
}

async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-QB-Lang',
      },
    });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const provider = toolProvider({ geminiKey, anthropicKey });
  if (!provider) return json({ error: 'Service unavailable' }, 503);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json({ error: 'Missing messages' }, 400);

  // Sanitize: bounded output, and only the fields named here reach a provider.
  const maxTokens = Math.min(Math.max(body.max_tokens || 2048, 1), 8000);

  // The tools send English prompts. When the founder reads in French the
  // browser says so in X-QB-Lang and one directive is appended here, so
  // the answer comes back in French. English is passed through untouched.
  const system = withLanguage(body.system, langFromRequest(req));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANSWER_BUDGET_MS);
  try {
    return provider === 'google'
      ? await askGoogle({ body, system, maxTokens, apiKey: geminiKey, signal: controller.signal })
      : await askAnthropic({ body, system, maxTokens, apiKey: anthropicKey, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') return fail(504, 'The AI service took too long to answer. Try again.', 'timeout_error');
    return fail(502, 'The AI service could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

export const POST = handler;
export const OPTIONS = handler;
