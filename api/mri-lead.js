// Brand MRI. Lead notification for the self-serve diagnostic.
// Vercel Edge Function
//
// POST /api/mri-lead
//   Body: { email, brand?, website?, score?, frein?, tier? }
//   Headers: optional Origin check (same-origin only)
//
//   -> { ok: true, emailId } on success
//   -> { ok: false, error } on failure
//
// Triggered when a visitor completes the free Brand MRI (mri.html).
// The browser calls to Klaviyo's client API failed at network level
// (TypeError: Failed to fetch, verified 2026-11-10 with ?debug=1), so the
// lead is captured on the server instead: one email to the practice inbox
// per completed diagnostic, via Resend. The visitor account itself is
// created separately by /api/send-magic-link (window.QB.sendMagicLink).
//
// Required env vars:
//   RESEND_API_KEY      Restricted Resend key with emails:send scope
//                       (same key as send-welcome-email.js).
//
// Sender:
//   auth@quantumbranding.ai (Resend-verified domain, same as send-magic-link.js)

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = new Set([
  'https://quantumbranding.ai',
  'https://www.quantumbranding.ai',
  'https://app.quantumbranding.ai',
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://quantumbranding.ai';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function clean(v, max) {
  return (v == null ? '' : String(v)).trim().slice(0, max);
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors_h = cors(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors_h });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Email not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const email = clean(body.email, 200).toLowerCase();
  const brand = clean(body.brand, 120);
  const website = clean(body.website, 300);
  const frein = clean(body.frein, 120);
  const tier = clean(body.tier, 40) || 'free';
  const score = Number.isFinite(body.score) ? body.score : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'Valid email required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  const text = [
    'Nouveau diagnostic Brand MRI terminé.',
    '',
    'Email : ' + email,
    'Marque : ' + (brand || '(non renseignée)'),
    'Site : ' + (website || '(non renseigné)'),
    'Score : ' + (score === null ? '(inconnu)' : score + '/100'),
    'Frein principal : ' + (frein || '(inconnu)'),
    'Palier : ' + tier,
    'Date : ' + new Date().toISOString(),
  ].join('\n');

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Brand MRI <auth@quantumbranding.ai>',
      to: ['me@qtmbg.com'],
      reply_to: email,
      subject: 'Brand MRI lead : ' + (brand || email) + (score === null ? '' : ' (' + score + '/100)'),
      text,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text().catch(() => '');
    console.error('[mri-lead] resend failed', resendRes.status, errText.slice(0, 300));
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  const data = await resendRes.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, emailId: data.id || null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors_h },
  });
}
