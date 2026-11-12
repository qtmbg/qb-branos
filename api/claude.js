// BrandOS — Claude Proxy
// Key lives in ANTHROPIC_API_KEY environment variable on Vercel.
// Frontend tools call /api/claude — they never see the key or Anthropic directly.

import { langFromRequest, withLanguage } from '../agents/lang.js';

export const config = { runtime: 'edge' };

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

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-QB-Lang',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
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

  // Sanitize: enforce model whitelist, remove any client-injected keys
  const model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const max_tokens = Math.min(Math.max(body.max_tokens || 2048, 1), 8000);

  const system = withLanguage(body.system, langFromRequest(req));

  const payload = {
    model,
    max_tokens,
    messages: body.messages,
    // The tools send English prompts. When the founder reads in French the
    // browser says so in X-QB-Lang and one directive is appended here, so
    // the answer comes back in French. English is passed through untouched.
    ...(system && { system }),
    ...(body.temperature !== undefined && { temperature: body.temperature }),
  };

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: upstream.status,
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
