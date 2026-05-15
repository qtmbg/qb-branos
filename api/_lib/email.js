/* QB BrandOS · Email helper for Edge functions
 * Last updated: 2026-05-15
 * Spec reference: CHAPTER_01_SPEC.md §14 (email templates).
 *
 * Wraps the Resend API with the QB conventions:
 *   - from:     "Quantum Branding <auth@quantumbranding.ai>"
 *   - reply_to: "me@qtmbg.com" (overridable)
 *   - List-Unsubscribe + X-Entity-Ref-ID headers for Gmail Primary placement
 *
 * Templates live at /emails/*.html and /emails/*.txt. The HTML and text
 * bodies are baked into this module at deploy time as string constants
 * (Edge runtime cannot read the filesystem). renderTemplate() does
 * straightforward {{var}} substitution.
 *
 * Exports:
 *   sendEmail({ to, subject, html, text, replyTo, refId })
 *   renderTemplate(template, vars)
 *   EMAIL_TEMPLATES.FOUNDATION_LOCKED   { subject, html, text }
 *   EMAIL_TEMPLATES.ARTIFACT_READY       { subject, html, text }
 *   AGENT_EMAIL_VARS                     per-agent template variables
 */

const FROM = 'Quantum Branding <auth@quantumbranding.ai>';
const REPLY_TO_DEFAULT = 'me@qtmbg.com';

/* ──────────────────────────────────────────────
   sendEmail
   ────────────────────────────────────────────── */
export async function sendEmail({ to, subject, html, text, replyTo, refId }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY missing' };
  if (!to) return { ok: false, error: 'to required' };
  if (!subject) return { ok: false, error: 'subject required' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        reply_to: replyTo || REPLY_TO_DEFAULT,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': '<mailto:me@qtmbg.com?subject=unsubscribe>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Entity-Ref-ID': refId || 'qb-brandos',
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: errText.slice(0, 400) };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data?.id || null };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'send threw' };
  }
}

/* ──────────────────────────────────────────────
   renderTemplate · {{var}} substitution
   ────────────────────────────────────────────── */
export function renderTemplate(template, vars = {}) {
  if (!template) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

/* ──────────────────────────────────────────────
   Inlined templates (baked at deploy)
   ──────────────────────────────────────────────
   Source of truth lives in /emails/*. The strings
   below are kept in sync with those files.
   Any edit to /emails/* must also be applied here.
   ────────────────────────────────────────────── */

const FOUNDATION_LOCKED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Your foundation is locked. Your artifacts are being prepared.</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, table, td { background: #FBF5E6 !important; color: #2D1521 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#FBF5E6;color:#2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#FBF5E6;">Your Phase 01 answers are locked. Synthesis is running. You will receive a separate email as each artifact is delivered.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#F2EBD3;border:2px solid #2D1521;border-radius:24px;">
      <tr><td style="padding:36px 36px 8px;">
        <p style="font-family:'Courier New',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#2D1521;margin:0 0 14px;font-weight:700;">Foundation</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.1;color:#2D1521;margin:0 0 24px;letter-spacing:-0.01em;">Your foundation is locked.</h1>
      </td></tr>
      <tr><td style="padding:0 36px 28px;font-size:16px;line-height:1.6;color:#2D1521;">
        <p style="margin:0 0 16px;">Hi {{first_name}},</p>
        <p style="margin:0 0 16px;">Your Phase 01 answers are now immutable. We're producing your synthesis artifacts in the background. You'll receive a separate email as each one is delivered.</p>
        <p style="margin:0 0 28px;">Free tier: your Soul Map artifact will be ready first. The Sensescape, Visual Language, and Strategic Position artifacts are produced and held until you upgrade.</p>
        <p style="margin:0 0 32px;">
          <a href="{{foundation_url}}" style="display:inline-block;padding:14px 26px;background:#E0B069;color:#2D1521;text-decoration:none;font-weight:600;border-radius:999px;border:2px solid #2D1521;box-shadow:0 6px 0 #2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Open your foundation &rarr;</a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#2D1521;">Reply to this email anytime. I read every reply.</p>
        <p style="margin:0;">Nizzar</p>
      </td></tr>
      <tr><td style="padding:18px 36px 28px;border-top:1px solid rgba(45,21,33,0.10);font-family:'Courier New',Menlo,monospace;font-size:11px;letter-spacing:0.10em;color:rgba(45,21,33,0.55);">
        Quantum Branding &middot; quantumbranding.ai
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

const FOUNDATION_LOCKED_TEXT = `FOUNDATION

Your foundation is locked.

Hi {{first_name}},

Your Phase 01 answers are now immutable. We're producing your synthesis artifacts in the background. You'll receive a separate email as each one is delivered.

Free tier: your Soul Map artifact will be ready first. The Sensescape, Visual Language, and Strategic Position artifacts are produced and held until you upgrade.

Open your foundation: {{foundation_url}}

Reply to this email anytime. I read every reply.

Nizzar
Quantum Branding
quantumbranding.ai`;

const ARTIFACT_READY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Your {{artifact_title}} is ready</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, table, td { background: #FBF5E6 !important; color: #2D1521 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#FBF5E6;color:#2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#FBF5E6;">{{preheader}}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#F2EBD3;border:2px solid #2D1521;border-radius:24px;">
      <tr><td style="padding:36px 36px 8px;">
        <p style="font-family:'Courier New',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#2D1521;margin:0 0 14px;font-weight:700;">{{agent_eyebrow}}</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.1;color:#2D1521;margin:0 0 24px;letter-spacing:-0.01em;">Your {{artifact_title}} is ready.</h1>
      </td></tr>
      <tr><td style="padding:0 36px 28px;font-size:16px;line-height:1.6;color:#2D1521;">
        <p style="margin:0 0 16px;">Hi {{first_name}},</p>
        <p style="margin:0 0 16px;">{{paragraph_one}}</p>
        <p style="margin:0 0 28px;">Read it now. Sit with it. Reply to this email if anything surprises you.</p>
        <p style="margin:0 0 32px;">
          <a href="{{artifact_url}}" style="display:inline-block;padding:14px 26px;background:#E0B069;color:#2D1521;text-decoration:none;font-weight:600;border-radius:999px;border:2px solid #2D1521;box-shadow:0 6px 0 #2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Read your {{artifact_name}} &rarr;</a>
        </p>
        <p style="margin:0;">Nizzar</p>
      </td></tr>
      <tr><td style="padding:18px 36px 28px;border-top:1px solid rgba(45,21,33,0.10);font-family:'Courier New',Menlo,monospace;font-size:11px;letter-spacing:0.10em;color:rgba(45,21,33,0.55);">
        Quantum Branding &middot; quantumbranding.ai
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

const ARTIFACT_READY_TEXT = `{{agent_eyebrow}}

Your {{artifact_title}} is ready.

Hi {{first_name}},

{{paragraph_one}}

Read it now. Sit with it. Reply to this email if anything surprises you.

Read your {{artifact_name}}: {{artifact_url}}

Nizzar
Quantum Branding
quantumbranding.ai`;

export const EMAIL_TEMPLATES = {
  FOUNDATION_LOCKED: {
    subject: 'Your foundation is locked. Your artifacts are being prepared.',
    html: FOUNDATION_LOCKED_HTML,
    text: FOUNDATION_LOCKED_TEXT,
    refId: 'qb-foundation-locked',
  },
  ARTIFACT_READY: {
    subjectFor: (vars) => `Your ${vars.artifact_title} is ready`,
    html: ARTIFACT_READY_HTML,
    text: ARTIFACT_READY_TEXT,
    refId: 'qb-artifact-ready',
  },
};

/* ──────────────────────────────────────────────
   Per-agent template variables
   ────────────────────────────────────────────── */
export const AGENT_EMAIL_VARS = {
  soul_map_synthesizer: {
    artifact_title: 'Soul Map',
    artifact_name: 'Soul Map',
    agent_eyebrow: '01 DISCOVERY · SOUL MAP SYNTHESIZER',
    paragraph_one: 'Your Soul Map names what your brand stands for at its center. The essence, the manifesto, the paradox that gives it life.',
    preheader: 'The center of your brand has a name. Read it.',
  },
  sensescape_synthesizer: {
    artifact_title: 'Sensory World',
    artifact_name: 'Sensory World',
    agent_eyebrow: '01 DISCOVERY · SENSESCAPE SYNTHESIZER',
    paragraph_one: 'Your Sensory World captures how your brand feels across all five senses. What it sounds, looks, tastes, smells, and touches like.',
    preheader: 'Your brand has a body. This is what it feels like.',
  },
  visual_dna_synthesizer: {
    artifact_title: 'Visual Language',
    artifact_name: 'Visual Language',
    agent_eyebrow: '01 DISCOVERY · VISUAL DNA SYNTHESIZER',
    paragraph_one: 'Your Visual Language defines how your brand looks. The color system, the typography, the visual posture.',
    preheader: 'How your brand sees itself. Now ready to read.',
  },
  war_table_synthesizer: {
    artifact_title: 'Strategic Position',
    artifact_name: 'Strategic Position',
    agent_eyebrow: '01 DISCOVERY · WAR TABLE SYNTHESIZER',
    paragraph_one: 'Your Strategic Position maps the field your brand operates in. The competitors, the paradox, the three priorities ahead.',
    preheader: 'The field, mapped. Three priorities, named.',
  },
};

export function getAgentEmailVars(agentSlug) {
  return AGENT_EMAIL_VARS[agentSlug] || null;
}
