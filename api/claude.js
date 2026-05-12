// QB BrandOS — Claude Proxy
// Key lives in ANTHROPIC_API_KEY environment variable on Vercel.
// Frontend tools call /api/claude — they never see the key or Anthropic directly.
//
// Node runtime (not edge) so the function can wait the full duration of a
// max_tokens=8000 Sonnet call without Vercel killing it and returning the
// HTML "An error occurred with this application" page (which the client then
// tries to JSON.parse and surfaces as "Unexpected token 'A'...").

export const config = {
  maxDuration: 60,
};

const ALLOWED_MODELS = [
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  // Legacy IDs retained for tools still pinned to them
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
];
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Service unavailable' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Invalid request body' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
  const max_tokens = Math.min(Math.max(body.max_tokens || 2048, 1), 8000);

  const payload = {
    model,
    max_tokens,
    messages: body.messages,
    ...(body.system && { system: body.system }),
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

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      return res.status(502).json({
        error: 'Upstream returned non-JSON',
        detail: text.slice(0, 200),
      });
    }
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream error', detail: err.message });
  }
}
