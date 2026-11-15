// api/_lib/tool-provider.js
// Which provider answers the tool pages, and the translation between the
// Anthropic shape the pages speak and the Gemini shape Google speaks.
// Kept out of the route file so a test can import it without a request.
//
// WHICH PROVIDER ANSWERS. Owner decision, 15 November 2026: every in-tool
// call goes through Google's API until revenue covers Anthropic. The
// agents already run there (agents/model-call.js); this is the same
// decision for the pages. Google's free tier uses prompts and responses to
// improve its products. By owner decision of the same day the legal pages
// list the providers and do not describe that use. They may not claim the
// opposite: tests/e2e/walks/legal.mjs reads this constant and fails if a
// page says the tools are answered by Anthropic, says a provider keeps the
// work out of training, or drops Google from the processor list.
//
// To send the tools back to Anthropic, change TOOL_PROVIDER to 'anthropic'
// and update the processor list in privacy.html in the same change. No page is edited: the
// route, the body and the answer keep their shape.

export const TOOL_PROVIDER = 'google';

// The ids agents/model-call.js routes to Google, in the order a capacity
// refusal walks them. tests/model-routing asserts the two lists agree, so a
// retired id is removed in one place and noticed in the other.
export const GOOGLE_TOOL_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
];

// The output floor and the thinking level are the agents' own, so the tool
// route and the fleet cannot drift apart. See agents/model-call.js for why.
export { GOOGLE_MIN_OUTPUT, GOOGLE_THINKING, googleRequest } from '../../agents/model-call.js';

// Which id is asked first is decided with the fleet's own health memory
// (agents/model-call.js): an id that just stalled or refused is asked last
// for five minutes, and never dropped.
import { byHealth, restGoogleId, forgetGoogleHealth } from '../../agents/model-call.js';
export { googleWalk } from '../../agents/model-call.js';
export const restId = restGoogleId;
export const forgetToolHealth = forgetGoogleHealth;
export function toolChain(wanted, now = Date.now()) {
  const first = GOOGLE_TOOL_MODELS.includes(wanted) ? wanted : GOOGLE_TOOL_MODELS[0];
  return byHealth([first, ...GOOGLE_TOOL_MODELS.filter(m => m !== first)], now);
}

/** Which provider serves a tool request, given the keys on the deployment. */
export function toolProvider({ geminiKey, anthropicKey } = {}) {
  if (TOOL_PROVIDER === 'google' && geminiKey) return 'google';
  // No Google key: Anthropic answers if it can, as the agents do the other
  // way round. Funding either account gives a working product.
  if (anthropicKey) return 'anthropic';
  return geminiKey ? 'google' : null;
}

/** Anthropic messages → Gemini contents. Text and base64 images, as the pages send them. */
export function toGoogleContents(messages) {
  return messages.map((m) => {
    const blocks = Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content ?? '') }];
    const parts = [];
    for (const b of blocks) {
      if (!b) continue;
      if (typeof b === 'string') { parts.push({ text: b }); continue; }
      if (b.type === 'text') { parts.push({ text: String(b.text ?? '') }); continue; }
      if (b.type === 'image' && b.source && b.source.type === 'base64' && b.source.data) {
        parts.push({ inlineData: { mimeType: b.source.media_type || 'image/png', data: b.source.data } });
      }
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: parts.length ? parts : [{ text: '' }] };
  });
}

/**
 * A whole answer wrapped in one code fence around JSON loses the fence.
 * Prose and markdown that merely contain a fence are left as written.
 */
export function unwrapJsonFence(text) {
  const m = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/i.exec(text);
  if (!m) return text;
  const inner = m[1].trim();
  return (inner.startsWith('{') || inner.startsWith('[')) ? inner : text;
}
