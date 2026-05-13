// QB BrandOS. Welcome email sender.
// Vercel Edge Function
//
// POST /api/send-welcome-email
//   Body: { email, firstName?, signalScanResult? }
//   Headers: optional Origin check (same-origin only)
//
//   → { ok: true, emailId } on success
//   → { ok: false, error } on failure
//
// Triggered immediately after a Signal Scan completion (signal-scan.html).
// Sends a single transactional welcome message via Resend. The user's Signal
// Scan diagnostic itself goes through /api/send-results in the existing flow;
// this endpoint exists only to acknowledge sign-up and point at Phase 01.
//
// Required env vars:
//   RESEND_API_KEY      Restricted Resend key with emails:send scope.
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

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildHtml({ firstName }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  // Minimal, table-based, dark-mode-safe HTML. No web fonts. Inline styles.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome to Quantum Branding</title>
</head>
<body style="margin:0;padding:0;background:#FBF5E6;color:#2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="540" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;width:100%;background:#F2EBD3;border:2px solid #2D1521;border-radius:18px;">
      <tr><td style="padding:32px 32px 8px;">
        <p style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#B58840;margin:0 0 12px;font-weight:700;">Welcome</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.15;color:#2D1521;margin:0 0 24px;letter-spacing:-0.01em;">Welcome to <em style="color:#B58840;">Quantum Branding</em>.</h1>
      </td></tr>
      <tr><td style="padding:0 32px 32px;font-size:16px;line-height:1.6;color:#2D1521;">
        <p style="margin:0 0 16px;">${greeting}</p>
        <p style="margin:0 0 16px;">You just took Signal Scan. That is the start.</p>
        <p style="margin:0 0 16px;">Your diagnostic is on its way to your inbox in a moment.</p>
        <p style="margin:0 0 24px;">When you are ready to go deeper, your next step is the foundation work. Phase 01 of Quantum Branding is four exercises that surface your brand's truth. It is free and you can do it at your own pace.</p>
        <p style="margin:0 0 32px;text-align:left;">
          <a href="https://quantumbranding.ai/qb-branidos-hub.html" style="display:inline-block;padding:14px 24px;background:#B58840;color:#FBF5E6;text-decoration:none;font-weight:600;border-radius:999px;border:2px solid #2D1521;">Begin Phase 01</a>
        </p>
        <p style="margin:0;color:#2D1521;">Nizzar</p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;border-top:1px solid rgba(45,21,33,0.10);font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;color:rgba(45,21,33,0.50);">
        Quantum Branding · quantumbranding.ai
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildText({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  return `${greeting}

You just took Signal Scan. That is the start.

Your diagnostic is on its way to your inbox in a moment.

When you are ready to go deeper, your next step is the foundation work. Phase 01 of Quantum Branding is four exercises that surface your brand's truth. It is free and you can do it at your own pace.

Begin Phase 01: https://quantumbranding.ai/qb-branidos-hub.html

Nizzar

Quantum Branding
quantumbranding.ai`;
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const cors_h = cors(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors_h });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors_h });
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
  const email = (body.email || '').toString().trim().toLowerCase();
  const firstName = (body.firstName || '').toString().trim().slice(0, 80);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'Valid email required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  const html = buildHtml({ firstName });
  const text = buildText({ firstName });

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Quantum Branding <auth@quantumbranding.ai>',
      to: [email],
      reply_to: 'me@qtmbg.com',
      subject: 'Welcome to Quantum Branding',
      html,
      text,
      headers: {
        'List-Unsubscribe': '<mailto:me@qtmbg.com?subject=unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': 'qb-brandos-welcome',
      },
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text().catch(() => '');
    console.error('[send-welcome-email] resend failed', resendRes.status, errText.slice(0, 300));
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...cors_h },
    });
  }

  const data = await resendRes.json();
  return new Response(JSON.stringify({ ok: true, emailId: data?.id || null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors_h },
  });
}
