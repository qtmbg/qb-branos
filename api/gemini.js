// QB BrandOS — Gemini Proxy
// Key lives in GEMINI_API_KEY environment variable on Vercel (free Google AI Studio tier).
// Clients call /api/gemini with the same body shape as /api/claude — they never see the key.
// Used by the iOS app for result generation where the Anthropic spend is not justified.

export const config = { runtime: 'edge' };

const ALLOWED_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const maxTokens = Math.min(Math.max(body.max_tokens || 2048, 1), 8000);

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing messages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Translate the /api/claude body shape to Gemini generateContent
  const contents = body.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? '') }],
  }));

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(body.temperature !== undefined && { temperature: body.temperature }),
    },
    ...(body.system && { systemInstruction: { parts: [{ text: String(body.system) }] } }),
  };

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Upstream error', detail: data?.error?.message || 'unknown' }), {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Normalize to the /api/claude response shape: { content: [{ text }] }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('');

    return new Response(JSON.stringify({ content: [{ type: 'text', text }], model }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream error', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
