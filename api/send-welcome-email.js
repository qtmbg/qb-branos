// BrandOS. Welcome email sender.
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

import { langFromRequest } from '../agents/lang.js';

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
    'Access-Control-Allow-Headers': 'Content-Type, X-QB-Lang',
    'Vary': 'Origin',
  };
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Email copy, per language. English is the text this endpoint always sent.
const COPY = {
  en: {
    htmlLang: 'en',
    subject: 'Welcome to BrandOS',
    eyebrow: 'Welcome',
    headlineBefore: 'Welcome to ',
    greeting: name => (name ? `Hi ${name},` : 'Hi there,'),
    p1: 'You took Signal Scan. That is the start.',
    p2: 'Your diagnostic is on its way to your inbox in a moment.',
    p3: "Your sign-in link is in a separate email from us. Open it once and your account is live. From there, Phase 01 is four exercises that surface your brand's truth. Free, at your own pace.",
    button: 'Sign in and begin Phase 01',
    textCta: 'Sign in and begin Phase 01:',
  },
  fr: {
    htmlLang: 'fr',
    subject: 'Bienvenue dans BrandOS',
    eyebrow: 'Bienvenue',
    headlineBefore: 'Bienvenue dans ',
    greeting: name => (name ? `Bonjour ${name},` : 'Bonjour,'),
    p1: 'Vous avez fait Signal Scan. C’est le début.',
    p2: 'Votre diagnostic arrive dans votre boîte de réception d’un instant à l’autre.',
    p3: 'Votre lien de connexion se trouve dans un autre email de notre part. Ouvrez-le une fois et votre compte est actif. Ensuite, la Phase 01 tient en quatre exercices qui font remonter la vérité de votre marque. Gratuit, à votre rythme.',
    button: 'Se connecter et commencer la Phase 01',
    textCta: 'Se connecter et commencer la Phase 01\u00a0:',
  },
};

function buildHtml({ firstName, lang }) {
  const c = COPY[lang] || COPY.en;
  const greeting = c.greeting(firstName ? escapeHtml(firstName) : '');
  // Minimal, table-based, dark-mode-safe HTML. No web fonts. Inline styles.
  return `<!DOCTYPE html>
<html lang="${c.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:#FBF5E6;color:#2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="540" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;width:100%;background:#F2EBD3;border:2px solid #2D1521;border-radius:18px;">
      <tr><td style="padding:32px 32px 8px;">
        <p style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#B58840;margin:0 0 12px;font-weight:700;">${c.eyebrow}</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.15;color:#2D1521;margin:0 0 24px;letter-spacing:-0.01em;">${c.headlineBefore}<em style="color:#B58840;">BrandOS</em>.</h1>
      </td></tr>
      <tr><td style="padding:0 32px 32px;font-size:16px;line-height:1.6;color:#2D1521;">
        <p style="margin:0 0 16px;">${greeting}</p>
        <p style="margin:0 0 16px;">${c.p1}</p>
        <p style="margin:0 0 16px;">${c.p2}</p>
        <p style="margin:0 0 24px;">${c.p3}</p>
        <p style="margin:0 0 32px;text-align:left;">
          <a href="https://app.quantumbranding.ai/login?return_to=%2Ffoundation" style="display:inline-block;padding:14px 24px;background:#B58840;color:#FBF5E6;text-decoration:none;font-weight:600;border-radius:999px;border:2px solid #2D1521;">${c.button}</a>
        </p>
        <p style="margin:0;color:#2D1521;">Nizzar</p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;border-top:1px solid rgba(45,21,33,0.10);font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;color:rgba(45,21,33,0.50);">
        BrandOS by Quantum Branding · quantumbranding.ai
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildText({ firstName, lang }) {
  const c = COPY[lang] || COPY.en;
  return `${c.greeting(firstName)}

${c.p1}

${c.p2}

${c.p3}

${c.textCta} https://app.quantumbranding.ai/login?return_to=%2Ffoundation

Nizzar

BrandOS by Quantum Branding
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

  const lang = langFromRequest(req);
  const html = buildHtml({ firstName, lang });
  const text = buildText({ firstName, lang });

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BrandOS <auth@quantumbranding.ai>',
      to: [email],
      reply_to: 'me@qtmbg.com',
      subject: (COPY[lang] || COPY.en).subject,
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
