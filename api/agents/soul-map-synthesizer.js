// QB BrandOS — Soul Map Synthesizer
// Vercel Edge Function (importable module + 405 default handler)
//
// Reads the locked Phase 01 QBP, calls Claude to produce a synthesized
// Soul Map artifact, returns the parsed JSON. The HTTP route exists only
// so the file can sit next to dispatch.js — direct invocation is blocked.

export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;

// Fields the synthesizer reads off the QBP. Order matters only for the
// "missing" report we return alongside the artifact, so the dashboard can
// show "Return to the Soul Map" if foundational answers were skipped.
const SOUL_MAP_FIELDS = [
  'brandName',
  'brandEssence',
  'spark',
  'archetype',
  'manifesto',
  'antiBrand',
  'paradox',
  'alwaysNever',
];

const SYSTEM_PROMPT = `You are the Soul Map Synthesizer for Quantum Branding OS.

You receive a user's raw Phase 01 Soul Map answers. Your job is to produce a synthesized Soul Map artifact: a single, structured, readable document that gives the user a mirror of their own brand's identity.

The synthesis must:
1. Be written in a calm, editorial voice. No marketing language, no jargon, no AI talk. Address the user directly using "you" and "your brand."
2. Reflect what the user actually said back to them with greater clarity and precision than they gave it.
3. Surface patterns or tensions they may not have noticed in their own answers.
4. Be useful as a document they can read once and reference forever.

Output structure (JSON):

{
  "essence": "A single sentence that captures the brand's core essence. Distilled from brandEssence and spark.",
  "archetype": {
    "primary": "The primary archetype name",
    "interpretation": "2-3 sentences on how this archetype shows up in this specific brand based on the user's manifesto and paradox."
  },
  "manifesto": "A refined version of the user's manifesto, kept in their voice but sharpened. 3-5 sentences.",
  "antiBrand": "A clear statement of what this brand is not, distilled from the user's antiBrand answer. 2-3 sentences.",
  "paradox": "The central tension this brand holds, expressed as a single, clear sentence. Sharpened from the user's paradox answer.",
  "always": ["array of 3-7 short statements of what this brand always does, distilled from alwaysNever"],
  "never": ["array of 3-7 short statements of what this brand never does, distilled from alwaysNever"],
  "observed_pattern": "One observation about a pattern or tension you noticed across the user's answers that they may not have named explicitly. One paragraph."
}

Constraints:
- Do not invent details the user did not provide.
- Do not flatter or compliment the brand.
- Do not use phrases like "your brand is" or "you are" as openings — write naturally.
- If any field is missing from the user's input, write "Not yet captured. Return to the Soul Map to add this." for that field rather than inventing content.

Return only the JSON object. No prose wrapper, no markdown fencing, no commentary.`;

function pickSoulMapInput(qbp) {
  const safe = (qbp && typeof qbp === 'object') ? qbp : {};
  const out = {};
  const missing = [];
  for (const k of SOUL_MAP_FIELDS) {
    const v = safe[k];
    const isPresent = typeof v === 'string'
      ? v.trim().length > 0
      : v && typeof v === 'object' && Object.keys(v).length > 0;
    if (isPresent) out[k] = v;
    else missing.push(k);
  }
  return { input: out, missing };
}

// Pattern lifted from archetype-compass.html: trust the text body first,
// strip a ```json fence if present, fall back to a brace slice. Any failure
// returns { ok:false } with the original text so the caller can log it.
function defensiveParseJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, reason: 'empty-text' };
  }
  let raw = text.trim();
  const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (_) {}

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = raw.substring(start, end + 1);
    try {
      return { ok: true, value: JSON.parse(slice) };
    } catch (_) {}
  }
  return { ok: false, reason: 'parse-failed', raw };
}

async function callClaude({ apiKey, system, userText, attempt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });

  if (res.status === 429 || res.status >= 500) {
    return { ok: false, retryable: true, status: res.status, body: await res.text().catch(() => '') };
  }
  if (!res.ok) {
    return { ok: false, retryable: false, status: res.status, body: await res.text().catch(() => '') };
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  return { ok: true, text, raw: data };
}

export async function runSoulMapSynthesizer({ qbp, anthropicKey }) {
  if (!anthropicKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY missing', stage: 'config' };
  }
  const { input, missing } = pickSoulMapInput(qbp);

  // The user message is the raw Soul Map answers, serialized as labeled
  // blocks. JSON would work too — labels read more naturally to the model
  // and make the "Not yet captured" fallback land on the right field.
  const userBlocks = SOUL_MAP_FIELDS.map(k => {
    const v = input[k];
    if (v == null) return `${k}: <not provided by user>`;
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  }).join('\n\n');

  const userText = `User's raw Phase 01 Soul Map answers:\n\n${userBlocks}\n\nReturn only the JSON object described in your instructions.`;

  // One retry on a transient class of failures (rate limit, upstream 5xx).
  let claudeRes;
  for (let attempt = 0; attempt < 2; attempt++) {
    claudeRes = await callClaude({ apiKey: anthropicKey, system: SYSTEM_PROMPT, userText, attempt });
    if (claudeRes.ok) break;
    if (!claudeRes.retryable) break;
    await new Promise(r => setTimeout(r, 600));
  }

  if (!claudeRes.ok) {
    return {
      ok: false,
      error: `Claude call failed (status ${claudeRes.status})`,
      stage: 'claude-call',
      detail: (claudeRes.body || '').slice(0, 400),
    };
  }

  const parsed = defensiveParseJson(claudeRes.text);
  if (!parsed.ok) {
    return {
      ok: false,
      error: 'Could not parse synthesized JSON',
      stage: 'json-parse',
      detail: (claudeRes.text || '').slice(0, 800),
    };
  }

  return { ok: true, content: parsed.value, missing };
}

// Default handler exists so Vercel does not 500 on a stray GET to this
// path. The synthesizer is module-only; invoke it via /api/agents/dispatch.
export default async function handler() {
  return new Response(
    JSON.stringify({ ok: false, error: 'Not directly invocable. Use /api/agents/dispatch.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
