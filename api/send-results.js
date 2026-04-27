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
  'casting-floor': 'The Casting Floor',
  'brand-document': 'Brand Document',
};

function buildEmailHTML({ firstName, lastName, company, toolId, qbp, results }) {
  const toolLabel = TOOL_LABELS[toolId] || 'Brand Results';
  const brandName = qbp?.brandName || 'Your Brand';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  // The email is itself a premium document — clean, dark, precise
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>${toolLabel} — ${brandName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0a0a0a; font-family:'Inter',sans-serif; color:#e8e8e8; }
  .wrap { max-width:640px; margin:0 auto; }
  .header { background:#000; padding:48px 40px 36px; border-bottom:1px solid rgba(74,222,128,0.3); }
  .logo-line { display:flex; align-items:center; gap:10px; margin-bottom:32px; }
  .logo-mark { width:28px; height:28px; background:#4ade80; border-radius:4px; display:inline-block; }
  .logo-text { font-size:11px; letter-spacing:.25em; text-transform:uppercase; color:#4ade80; font-family:'Inter',sans-serif; font-weight:500; }
  .doc-label { font-size:10px; letter-spacing:.3em; text-transform:uppercase; color:rgba(74,222,128,0.7); font-family:'Inter',sans-serif; margin-bottom:12px; }
  .brand-name { font-family:'Cormorant Garamond',serif; font-size:42px; font-weight:300; color:#fff; line-height:1.1; margin-bottom:6px; }
  .doc-title { font-size:13px; color:rgba(255,255,255,0.4); letter-spacing:.1em; text-transform:uppercase; }
  .body-section { background:#111; padding:40px; }
  .greeting { font-size:16px; color:rgba(255,255,255,0.7); line-height:1.7; margin-bottom:32px; }
  .section-label { font-size:9px; letter-spacing:.3em; text-transform:uppercase; color:#4ade80; font-family:'Inter',sans-serif; margin-bottom:12px; display:block; }
  .field-block { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:20px 24px; margin-bottom:16px; }
  .field-label { font-size:9px; letter-spacing:.25em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:8px; display:block; }
  .field-value { font-size:15px; color:rgba(255,255,255,0.85); line-height:1.6; }
  .field-value.large { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:300; line-height:1.5; }
  .divider { height:1px; background:rgba(255,255,255,0.07); margin:32px 0; }
  .cta-block { text-align:center; padding:32px 0; }
  .cta-text { font-size:13px; color:rgba(255,255,255,0.4); margin-bottom:20px; line-height:1.7; }
  .cta-btn { display:inline-block; background:#4ade80; color:#000; font-size:12px; font-weight:600; letter-spacing:.15em; text-transform:uppercase; padding:14px 32px; border-radius:6px; text-decoration:none; }
  .footer { background:#000; padding:28px 40px; border-top:1px solid rgba(255,255,255,0.06); }
  .footer-text { font-size:11px; color:rgba(255,255,255,0.25); line-height:1.8; }
  .footer-link { color:rgba(74,222,128,0.6); text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo-line">
      <span class="logo-mark"></span>
      <span class="logo-text">Quantum Branding</span>
    </div>
    <div class="doc-label">${toolLabel}</div>
    <div class="brand-name">${brandName}</div>
    <div class="doc-title">Strategic Brand Intelligence Report</div>
  </div>

  <div class="body-section">
    <div class="greeting">
      ${fullName ? `${fullName},<br><br>` : ''}Your brand diagnostic is complete. Below are your core outputs from the ${toolLabel}. This is the beginning of your brand's strategic architecture — built on identity, not guesswork.
    </div>

    ${results?.spark ? `
    <span class="section-label">Brand Spark</span>
    <div class="field-block">
      <span class="field-label">Your Brand Statement</span>
      <div class="field-value large">${results.spark}</div>
    </div>` : ''}

    ${results?.essence ? `
    <div class="field-block">
      <span class="field-label">Brand Essence</span>
      <div class="field-value large">${results.essence}</div>
    </div>` : ''}

    ${qbp?.archetype ? `
    <div class="field-block">
      <span class="field-label">Brand Archetype</span>
      <div class="field-value">${qbp.archetype}</div>
    </div>` : ''}

    ${qbp?.alwaysNever ? `
    <div class="field-block">
      <span class="field-label">Brand Code</span>
      <div class="field-value">${qbp.alwaysNever}</div>
    </div>` : ''}

    ${qbp?.primaryPersona ? `
    <div class="field-block">
      <span class="field-label">Primary Audience</span>
      <div class="field-value">${qbp.primaryPersona}</div>
    </div>` : ''}

    ${qbp?.sensoryProfile ? `
    <div class="field-block">
      <span class="field-label">Sensory World</span>
      <div class="field-value">${qbp.sensoryProfile}</div>
    </div>` : ''}

    ${qbp?.colorDirection ? `
    <div class="field-block">
      <span class="field-label">Visual Direction</span>
      <div class="field-value">${qbp.colorDirection}</div>
    </div>` : ''}

    ${qbp?.strategicPriorities ? `
    <span class="section-label">Strategic Layer</span>
    <div class="field-block">
      <span class="field-label">Strategic Priorities</span>
      <div class="field-value">${Array.isArray(qbp.strategicPriorities) ? qbp.strategicPriorities.join(' · ') : qbp.strategicPriorities}</div>
    </div>` : ''}

    <div class="divider"></div>

    <div class="cta-block">
      <div class="cta-text">Your full Brand Document and all diagnostic outputs are available inside QB BrandOS. Continue building your brand intelligence.</div>
      <a class="cta-btn" href="https://quantumbranding.ai/os">Continue in QB BrandOS →</a>
    </div>
  </div>

  <div class="footer">
    <div class="footer-text">
      This report was generated by <a class="footer-link" href="https://quantumbranding.ai">QB BrandOS</a> — the Brand Operating System.<br>
      Quantum Branding · quantumbranding.ai · Built by Nizzar Ben Chekroune
    </div>
  </div>
</div>
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
      from: 'QB BrandOS <results@quantumbranding.ai>',
      to: [email],
      subject: `${brandName} — Your ${toolLabel} Results`,
      html: emailHTML,
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
