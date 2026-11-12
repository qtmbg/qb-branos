// BrandOS — Custom magic-link sender
// Vercel Edge Function
//
// Replaces Supabase's default email sender (noreply@mail.app.supabase.io,
// aggressively spam-filtered by Gmail/Apple) with a Resend send from our
// verified quantumbranding.ai domain.
//
// Flow:
//   1. Client POSTs { email, firstName, sourceTool } to this endpoint
//   2. We call Supabase admin /auth/v1/admin/generate_link with type=magiclink
//      to mint a single-use action_link without sending Supabase's email
//   3. We send our own branded email via Resend containing that action_link
//   4. User clicks → lands on /auth-callback.html → Supabase session
//
// Required env vars (already set in Vercel):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (admin generate_link needs service role)
//   RESEND_API_KEY

import { langFromRequest } from '../agents/lang.js';

export const config = { runtime: 'edge' };

// Email copy, per language. English is the text this endpoint always sent.
const COPY = {
  en: {
    htmlLang: 'en',
    title: 'Your BrandOS sign-in link',
    subject: 'Your sign-in link to BrandOS',
    eyebrow: 'Sign in to BrandOS',
    headline: 'One click. You are in.',
    lead: (greeting, tool) => `${greeting} click the button below to sign in to your Brand Profile${tool ? ` continuing your ${tool} work` : ''}. No password needed.`,
    greeting: name => (name ? `${name},` : 'Hello,'),
    button: 'Sign in →',
    paste: 'Or paste this link into your browser:',
    expiry: 'Link expires in 60 minutes. If you did not request this, you can ignore the email and nothing happens.',
    footer: 'BrandOS · The Brand Operating System',
    built: 'Built by Nizzar Ben Chekroune',
    text: (name, link) => `Hello${name ? ' ' + name : ''},\n\nClick the link below to sign in to your Brand Profile. No password needed.\n\n${link}\n\nThe link expires in 60 minutes. If you did not request this, you can ignore this email and nothing happens.\n\nBrandOS by Quantum Branding\nThe Brand Operating System`,
  },
  fr: {
    htmlLang: 'fr',
    title: 'Votre lien de connexion à BrandOS',
    subject: 'Votre lien de connexion à BrandOS',
    eyebrow: 'Connexion à BrandOS',
    headline: 'Un clic. Vous y êtes.',
    lead: (greeting, tool) => `${greeting} cliquez sur le bouton ci-dessous pour vous connecter à votre Profil de marque${tool ? ` et reprendre votre travail sur ${tool}` : ''}. Aucun mot de passe.`,
    greeting: name => (name ? `${name},` : 'Bonjour,'),
    button: 'Connexion →',
    paste: 'Ou collez ce lien dans votre navigateur\u00a0:',
    expiry: 'Le lien expire dans 60 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email et rien ne se passe.',
    footer: 'BrandOS · Le système d’exploitation de marque',
    built: 'Conçu par Nizzar Ben Chekroune',
    text: (name, link) => `Bonjour${name ? ' ' + name : ''},\n\nCliquez sur le lien ci-dessous pour vous connecter à votre Profil de marque. Aucun mot de passe.\n\n${link}\n\nLe lien expire dans 60 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email et rien ne se passe.\n\nBrandOS by Quantum Branding\nLe système d’exploitation de marque`,
  },
};

const ALLOWED_REDIRECT_ORIGINS = [
  'https://quantumbranding.ai',
  'https://www.quantumbranding.ai',
  'https://app.quantumbranding.ai',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const DEFAULT_REDIRECT_ORIGIN = 'https://quantumbranding.ai';

function resolveOrigin(req) {
  const origin = req.headers.get('origin');
  if (origin && ALLOWED_REDIRECT_ORIGINS.includes(origin)) return origin;
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (ALLOWED_REDIRECT_ORIGINS.includes(refOrigin)) return refOrigin;
    } catch {}
  }
  return DEFAULT_REDIRECT_ORIGIN;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildEmailHTML({ firstName, magicLink, sourceTool, lang }) {
  const e = escapeHtml;
  const c = COPY[lang] || COPY.en;
  const lead = c.lead(c.greeting(firstName ? e(firstName) : ''), sourceTool ? e(sourceTool) : '');

  return `<!DOCTYPE html>
<html lang="${c.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.title}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..800,0..100,0..1&family=Inter:wght@400..700&family=JetBrains+Mono:wght@500;600&display=swap">
<style>
  body, table, td, p, div { margin:0; padding:0; }
  body { background:#FBF5E6; color:#2D1521;
         font-family:'Inter','Helvetica Neue',Arial,sans-serif;
         -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
  a { color:#A8862E; }
  @media (prefers-color-scheme: dark) {
    body, .qb-page { background:#FBF5E6 !important; color:#2D1521 !important; }
    .qb-card { background:#F4EBD3 !important; color:#2D1521 !important; }
  }
</style>
</head>
<body style="background:#FBF5E6;margin:0;padding:0;">
<table role="presentation" class="qb-page" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">

      <tr><td style="padding:0 0 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#A8862E;text-transform:uppercase;font-weight:600;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#B5455A;vertical-align:middle;margin-right:8px;"></span>
              BrandOS
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td>
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:24px;padding:36px 32px 32px 32px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#A8862E;text-transform:uppercase;font-weight:600;margin-bottom:14px;">
              ${c.eyebrow}
            </div>
            <h1 style="font-family:'Fraunces','Times New Roman',serif;font-weight:700;font-size:32px;line-height:1.1;letter-spacing:-0.015em;color:#2D1521;margin:0 0 16px 0;font-variation-settings:'wght' 700,'opsz' 144,'SOFT' 100,'WONK' 1;">
              ${c.headline}
            </h1>
            <p style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:15px;line-height:1.6;color:rgba(45,21,33,0.85);margin:0 0 24px 0;">
              ${lead}
            </p>
            <a href="${e(magicLink)}" style="display:inline-block;background:#E5C975;color:#2D1521;border:2px solid #2D1521;border-radius:9999px;padding:14px 28px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:15px;text-decoration:none;box-shadow:0 4px 0 #2D1521;letter-spacing:0.01em;">${c.button}</a>
            <p style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:rgba(45,21,33,0.55);margin:24px 0 0 0;">
              ${c.paste}<br>
              <a href="${e(magicLink)}" style="color:#A8862E;text-decoration:none;word-break:break-all;">${e(magicLink)}</a>
            </p>
            <p style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.06em;color:rgba(45,21,33,0.55);line-height:1.6;margin:24px 0 0 0;">
              ${c.expiry}
            </p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 4px 0 4px;border-top:1px solid rgba(45,21,33,0.12);margin-top:24px;">
        <p style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.06em;color:rgba(45,21,33,0.55);line-height:1.7;margin:16px 0 0 0;text-align:center;">
          ${c.footer}<br>
          ${c.built}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-QB-Lang'
      }
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 });
  }

  const SUPABASE_URL          = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY        = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RESEND_API_KEY) {
    console.error('[send-magic-link] missing env vars');
    return new Response(JSON.stringify({ ok: false, error: 'Service not configured' }), { status: 503 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }

  const { email, firstName = '', sourceTool = '' } = body || {};
  if (!email || !/.+@.+\..+/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'Valid email required' }), { status: 400 });
  }

  // Step 1 — mint a magic-link action_link via Supabase admin API.
  //
  // redirect_to is a bare path with no query string. Supabase allowlist
  // wildcards reliably match path segments but not URL-encoded query
  // values, so an earlier attempt that threaded return_to as a query
  // (?return_to=%2Fdashboard) got rejected by the allowlist and silently
  // replaced with Site URL. Keeping the URL clean makes the allowlist
  // entry a simple exact string and the rejection class disappears.
  //
  // The post-auth destination is always /foundation. auth-callback.html
  // hardcodes that fallback. If we ever need a per-flow destination we
  // can stash it in localStorage on the same origin before the redirect.
  //
  // Every origin used here must be on the Supabase project's
  // Auth → URL Configuration → Redirect URLs allowlist:
  //   https://quantumbranding.ai/auth-callback.html
  //   https://app.quantumbranding.ai/auth-callback.html
  //   https://www.quantumbranding.ai/auth-callback.html
  const redirectOrigin = resolveOrigin(req);
  const redirectTo = `${redirectOrigin}/auth-callback.html`;
  // GoTrue admin generate_link expects redirect_to and data as top-level
  // fields. The {options:{...}} nesting is a Supabase JS SDK convention
  // that the SDK unwraps before sending. Calling the REST API with the
  // wrapper made GoTrue ignore our redirect_to and substitute Site URL,
  // which is exactly the failure mode we kept hitting in production.
  const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'magiclink',
      email,
      redirect_to: redirectTo,
      data: { first_name: firstName, signup_source: sourceTool || 'qb-gate' },
    }),
  });

  if (!adminRes.ok) {
    const errText = await adminRes.text().catch(() => '');
    console.error('[send-magic-link] generate_link failed', adminRes.status, errText.slice(0, 300));
    return new Response(JSON.stringify({ ok: false, error: 'Could not generate sign-in link' }), { status: 502 });
  }

  const adminData = await adminRes.json();
  const actionLink = adminData?.properties?.action_link || adminData?.action_link;
  if (!actionLink) {
    console.error('[send-magic-link] no action_link in response', JSON.stringify(adminData).slice(0, 300));
    return new Response(JSON.stringify({ ok: false, error: 'Sign-in link malformed' }), { status: 502 });
  }

  // Step 2 — send the email via Resend with our branded template.
  const lang = langFromRequest(req);
  const copy = COPY[lang] || COPY.en;
  const emailHTML = buildEmailHTML({ firstName, magicLink: actionLink, sourceTool, lang });
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
      subject: copy.subject,
      html: emailHTML,
      text: copy.text(firstName, actionLink),
      // Purely transactional. No List-Unsubscribe header (it's a positive
      // promotional signal to Gmail's tab classifier). Per step 18 PR 3
      // deliverability pass and EMAIL_DELIVERABILITY.md.
      headers: {
        'X-Entity-Ref-ID': 'qb-brandos-magic-link',
      },
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text().catch(() => '');
    console.error('[send-magic-link] resend send failed', resendRes.status, errText.slice(0, 300));
    return new Response(JSON.stringify({ ok: false, error: 'Could not send email' }), { status: 502 });
  }

  const resendData = await resendRes.json();
  return new Response(JSON.stringify({ ok: true, emailId: resendData?.id || null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
