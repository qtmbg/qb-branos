// QB BrandOS — Send Results API
// Vercel Edge Function
// Handles: Resend email + Klaviyo lead sync + optional Supabase logging
// Env vars required: RESEND_API_KEY
// Env vars optional: KLAVIYO_PRIVATE_KEY, SUPABASE_URL, SUPABASE_ANON_KEY

export const config = { runtime: 'edge' };

const TOOL_LABELS = {
  'soul-map': 'Brand Soul Map',
  'sensescape': 'Sensescape — Sensory World',
  'visual-dna': 'Visual DNA',
  'war-table': 'War Table',
  'profiles': 'The Profiles',
  'brand-document': 'Brand Document',
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildEmailHTML({ firstName, lastName, company, toolId, qbp, results }) {
  const toolLabel = TOOL_LABELS[toolId] || 'Brand Results';
  const brandName = qbp?.brandName || 'Your Brand';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');

  const e = escapeHtml;

  // v3.4 SOT email — cream + ink + gold + rose-deep.
  // Outlook + dark-mode-Gmail fallbacks: hex colors only, no CSS variables,
  // fonts via <link> in head with system-font fallback, inline-style cards,
  // table-based layout for the wrapper. Lines stay under 80 cols where it
  // helps readability in source diffs.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(toolLabel)} — ${e(brandName)}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..800,0..100,0..1;1,9..144,400..800,0..100,0..1&family=Inter:wght@400..700&family=JetBrains+Mono:wght@500;600&display=swap">
<style>
  /* Margin reset for clients that ignore the reset table. */
  body, table, td, p, div { margin:0; padding:0; }
  body { background:#FBF5E6; color:#2D1521;
         font-family:'Inter','Helvetica Neue',Arial,sans-serif;
         -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
  a { color:#A8862E; }
  /* Dark-mode safety: force the page colors even when Apple Mail/Gmail
     invert. */
  @media (prefers-color-scheme: dark) {
    body, .qb-page { background:#FBF5E6 !important; color:#2D1521 !important; }
    .qb-card { background:#F4EBD3 !important; color:#2D1521 !important; }
  }
</style>
</head>
<body style="background:#FBF5E6;margin:0;padding:0;">
<table role="presentation" class="qb-page" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">

      <!-- ── HEADER ─────────────────────────────────────────── -->
      <tr><td style="padding:0 0 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#A8862E;text-transform:uppercase;font-weight:600;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#B5455A;vertical-align:middle;margin-right:8px;"></span>
              Quantum Branding
            </td>
            <td align="right" style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;">
              QB BrandOS
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- ── HERO CARD ──────────────────────────────────────── -->
      <tr><td>
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:24px;padding:40px 36px 36px 36px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#A8862E;text-transform:uppercase;font-weight:600;margin-bottom:14px;">
              ${e(toolLabel)}
            </div>
            <h1 style="font-family:'Fraunces','Times New Roman',serif;font-weight:700;font-size:38px;line-height:1.05;letter-spacing:-0.015em;color:#2D1521;margin:0 0 8px 0;font-variation-settings:'wght' 700,'opsz' 144,'SOFT' 100,'WONK' 1;">
              ${e(brandName)}
            </h1>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.14em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;">
              Strategic Brand Intelligence Report
            </div>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── GREETING ───────────────────────────────────────── -->
      <tr><td style="padding:32px 4px 0 4px;">
        <p style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:16px;line-height:1.6;color:rgba(45,21,33,0.85);margin:0;">
          ${fullName ? e(fullName) + ',<br><br>' : ''}Your brand diagnostic is complete. Below are your core outputs from the ${e(toolLabel)}. This is the beginning of your brand's strategic architecture, built on identity, not guesswork.
        </p>
      </td></tr>

      ${results?.spark ? `
      <tr><td style="padding:28px 4px 0 4px;">
        <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.2em;color:#A8862E;text-transform:uppercase;font-weight:600;margin-bottom:10px;">Brand Spark</div>
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Your Brand Statement</div>
            <div style="font-family:'Fraunces','Times New Roman',serif;font-weight:650;font-size:20px;line-height:1.4;color:#2D1521;font-variation-settings:'wght' 650,'opsz' 144,'SOFT' 100;">${e(results.spark)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      ${results?.essence ? `
      <tr><td style="padding:16px 4px 0 4px;">
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Brand Essence</div>
            <div style="font-family:'Fraunces','Times New Roman',serif;font-weight:650;font-size:20px;line-height:1.4;color:#2D1521;font-variation-settings:'wght' 650,'opsz' 144,'SOFT' 100;">${e(results.essence)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      ${qbp?.archetype ? `
      <tr><td style="padding:16px 4px 0 4px;">
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Brand Archetype</div>
            <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:15px;line-height:1.55;color:#2D1521;">${e(qbp.archetype)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      ${qbp?.alwaysNever ? `
      <tr><td style="padding:16px 4px 0 4px;">
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Brand Code</div>
            <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:15px;line-height:1.55;color:#2D1521;">${e(qbp.alwaysNever)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      ${qbp?.primaryPersona ? `
      <tr><td style="padding:16px 4px 0 4px;">
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Primary Audience</div>
            <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:15px;line-height:1.55;color:#2D1521;">${e(qbp.primaryPersona)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      ${qbp?.sensoryProfile ? `
      <tr><td style="padding:16px 4px 0 4px;">
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Sensory World</div>
            <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:15px;line-height:1.55;color:#2D1521;">${e(qbp.sensoryProfile)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      ${qbp?.colorDirection ? `
      <tr><td style="padding:16px 4px 0 4px;">
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Visual Direction</div>
            <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:15px;line-height:1.55;color:#2D1521;">${e(qbp.colorDirection)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      ${qbp?.strategicPriorities ? `
      <tr><td style="padding:28px 4px 0 4px;">
        <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.2em;color:#A8862E;text-transform:uppercase;font-weight:600;margin-bottom:10px;">Strategic Layer</div>
        <table role="presentation" class="qb-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4EBD3;border:2px solid #2D1521;border-radius:20px;padding:22px 24px;">
          <tr><td>
            <div style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;letter-spacing:0.16em;color:rgba(45,21,33,0.55);text-transform:uppercase;font-weight:500;margin-bottom:8px;">Strategic Priorities</div>
            <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:15px;line-height:1.55;color:#2D1521;">${e(Array.isArray(qbp.strategicPriorities) ? qbp.strategicPriorities.join(' · ') : qbp.strategicPriorities)}</div>
          </td></tr>
        </table>
      </td></tr>` : ''}

      <!-- ── CTA ───────────────────────────────────────────── -->
      <tr><td style="padding:36px 4px 0 4px;text-align:center;">
        <p style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:500;font-size:14px;line-height:1.65;color:rgba(45,21,33,0.7);margin:0 0 18px 0;">Your full Brand Document and all diagnostic outputs are available inside QB BrandOS. Continue building your brand intelligence.</p>
        <a href="https://quantumbranding.ai/os" style="display:inline-block;background:#E5C975;color:#2D1521;border:2px solid #2D1521;border-radius:9999px;padding:14px 28px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:14px;text-decoration:none;box-shadow:0 4px 0 #2D1521;letter-spacing:0.01em;">Continue in QB BrandOS →</a>
      </td></tr>

      <!-- ── FOOTER ────────────────────────────────────────── -->
      <tr><td style="padding:36px 4px 0 4px;border-top:1px solid rgba(45,21,33,0.12);margin-top:36px;">
        <p style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.06em;color:rgba(45,21,33,0.55);line-height:1.7;margin:24px 0 0 0;text-align:center;">
          Generated by <a href="https://quantumbranding.ai" style="color:#A8862E;text-decoration:none;">QB BrandOS</a> · The Brand Operating System<br>
          Built by Nizzar Ben Chekroune
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
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
  }
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 503 });

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 }); }

  const { firstName, lastName, company, email, toolId, qbp, results } = body;
  if (!email) return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 });

  const toolLabel = TOOL_LABELS[toolId] || 'Brand Results';
  const brandName = qbp?.brandName || 'Your Brand';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'there';

  const emailHTML = buildEmailHTML({ firstName, lastName, company, toolId, qbp, results });

  // Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Quantum Branding <results@quantumbranding.ai>',
      to: [email],
      reply_to: 'me@qtmbg.com',
      subject: `${brandName} — Your ${toolLabel} Results`,
      html: emailHTML,
      // Spam-classifier signals: transactional sender + clear unsubscribe path
      headers: {
        'List-Unsubscribe': '<mailto:me@qtmbg.com?subject=unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': 'qb-brandos-results',
      },
    })
  });

  const resendData = await resendRes.json();
  if (!resendRes.ok) {
    console.error('Resend error:', resendData);
    return new Response(JSON.stringify({ error: 'Email delivery failed', detail: resendData }), { status: 502 });
  }

  // Optional: Klaviyo sync
  const klaviyoKey = process.env.KLAVIYO_PRIVATE_KEY;
  if (klaviyoKey) {
    try {
      await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Klaviyo-API-Key ${klaviyoKey}`, 'revision': '2024-02-15' },
        body: JSON.stringify({ data: { type: 'profile', attributes: { email, first_name: firstName, last_name: lastName, organization: company || '', properties: { source: 'QB BrandOS', tool: toolId, brand_name: brandName } } } })
      });
    } catch(e) { console.warn('Klaviyo sync optional, non-blocking:', e.message); }
  }

  return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
