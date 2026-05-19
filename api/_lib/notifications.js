// QB BrandOS · Notification emitter.
//
// One export: emitDispatchFailed({ env, userId, dispatchId, agentSlug, reason }).
//
// Wraps the two side effects fired when the reaper flips a dispatch to
// failed_permanently per §5.5 and §7.0:
//   1. INSERT a `notifications` row (kind='dispatch_failed', service-role).
//   2. Send a Resend email if RESEND_API_KEY is configured.
//
// The email send is non-fatal · if it errors, the function logs and
// returns ok:true on the notification row anyway. The in-app bell is the
// authoritative surface; email is a courtesy second channel.
//
// Caller (api/cron/reaper.js) invokes this exactly once per terminal flip.

import { svcHeaders } from './auth.js';
import { sendEmail } from './email.js';

const SUBJECT = 'Agent dispatch failed. Manual retry available.';

function emailHtml({ agentSlug, dispatchId, reason }) {
  const safeSlug = String(agentSlug || 'unknown');
  const safeReason = String(reason || 'transient_failure');
  const safeDispatch = String(dispatchId || '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent dispatch failed. Manual retry available.</title>
</head>
<body style="margin:0;padding:0;background:#FBF5E6;color:#2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FBF5E6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#F2EBD3;border:2px solid #2D1521;border-radius:24px;">
      <tr><td style="padding:36px 36px 8px;">
        <p style="font-family:'Courier New',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#2D1521;margin:0 0 14px;font-weight:700;">Agent console</p>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.1;color:#2D1521;margin:0 0 24px;letter-spacing:-0.01em;">A run did not finish.</h1>
      </td></tr>
      <tr><td style="padding:0 36px 28px;font-size:16px;line-height:1.6;color:#2D1521;">
        <p style="margin:0 0 16px;">An agent dispatch tried three times and could not deliver. Open the Agent Console to retry it manually.</p>
        <p style="margin:0 0 16px;font-family:'Courier New',Menlo,monospace;font-size:13px;">
          agent: ${safeSlug}<br>
          reason: ${safeReason}<br>
          dispatch_id: ${safeDispatch}
        </p>
        <p style="margin:0 0 32px;">
          <a href="https://app.quantumbranding.ai/agents#agent=${safeSlug}" style="display:inline-block;padding:14px 26px;background:#E0B069;color:#2D1521;text-decoration:none;font-weight:600;border-radius:999px;border:2px solid #2D1521;box-shadow:0 6px 0 #2D1521;font-family:'Inter','Helvetica Neue',Arial,sans-serif;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">Open Agent Console &rarr;</a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#2D1521;">Reply to this email if anything looks wrong.</p>
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
}

function emailText({ agentSlug, dispatchId, reason }) {
  return [
    'AGENT CONSOLE',
    '',
    'A run did not finish.',
    '',
    'An agent dispatch tried three times and could not deliver. Open the Agent Console to retry it manually.',
    '',
    `agent: ${agentSlug || 'unknown'}`,
    `reason: ${reason || 'transient_failure'}`,
    `dispatch_id: ${dispatchId || ''}`,
    '',
    `Open Agent Console: https://app.quantumbranding.ai/agents#agent=${agentSlug || ''}`,
    '',
    'Reply to this email if anything looks wrong.',
    '',
    'Nizzar',
    'Quantum Branding',
    'quantumbranding.ai',
  ].join('\n');
}

/**
 * Look up the caller's email from public.profiles. Returns null on miss
 * or any read error. Email is a courtesy channel · we never throw on
 * lookup failure.
 */
async function readUserEmail({ supaUrl, serviceKey, userId }) {
  if (!supaUrl || !serviceKey || !userId) return null;
  try {
    const r = await fetch(
      `${supaUrl}/rest/v1/profiles?select=email,first_name&id=eq.${encodeURIComponent(userId)}`,
      { headers: svcHeaders(serviceKey) }
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Emit a dispatch_failed notification.
 *
 * @param {object} args
 * @param {object} args.env             Environment bag with SUPABASE_URL,
 *                                       SUPABASE_SERVICE_ROLE_KEY, optional
 *                                       RESEND_API_KEY.
 * @param {string} args.userId          Recipient user id.
 * @param {string} args.dispatchId      The failed dispatch id.
 * @param {string} args.agentSlug       Slug of the failing agent (or first
 *                                       failing agent in a multi-agent
 *                                       dispatch).
 * @param {string} args.reason          Short reason code for the payload
 *                                       (e.g. 'edge_timeout',
 *                                       'schema_validation_failed').
 *
 * @returns {Promise<{ok:true,notification_id:string,email:{ok:boolean,id?:string,error?:string}}
 *                  | {ok:false,error:string}>}
 */
export async function emitDispatchFailed({ env, userId, dispatchId, agentSlug, reason }) {
  const supaUrl = env?.SUPABASE_URL;
  const serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return { ok: false, error: 'notifications_env_missing' };
  }
  if (!userId) {
    return { ok: false, error: 'user_id_required' };
  }

  // 1. Insert the in-app notification row via service role.
  const payload = {
    user_id: userId,
    kind: 'dispatch_failed',
    agent_slug: agentSlug || null,
    payload: {
      dispatch_id: dispatchId || null,
      agent_slug: agentSlug || null,
      reason: reason || 'transient_failure',
    },
    read_at: null,
  };

  let notificationId = null;
  try {
    const r = await fetch(`${supaUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('[notifications] insert failed', r.status, t.slice(0, 200));
      return { ok: false, error: `notification_insert_failed: ${r.status}` };
    }
    const rows = await r.json().catch(() => []);
    notificationId = rows?.[0]?.id || null;
  } catch (e) {
    console.error('[notifications] insert threw', e?.message);
    return { ok: false, error: 'notification_insert_threw' };
  }

  // 2. Email · best-effort. RESEND_API_KEY may be unset in non-prod
  // environments. sendEmail returns ok:false on send failure; we log
  // and continue.
  let emailResult = { ok: false, error: 'not_attempted' };
  if (env?.RESEND_API_KEY) {
    const profile = await readUserEmail({ supaUrl, serviceKey, userId });
    if (profile?.email) {
      try {
        emailResult = await sendEmail({
          to: profile.email,
          subject: SUBJECT,
          html: emailHtml({ agentSlug, dispatchId, reason }),
          text: emailText({ agentSlug, dispatchId, reason }),
          refId: 'qb-dispatch-failed',
        });
        if (!emailResult.ok) {
          console.error('[notifications] email send failed',
            emailResult.status || '',
            String(emailResult.error || '').slice(0, 300));
        }
      } catch (e) {
        console.error('[notifications] email threw', e?.message);
        emailResult = { ok: false, error: 'email_threw' };
      }
    } else {
      emailResult = { ok: false, error: 'no_recipient_email' };
    }
  }

  return { ok: true, notification_id: notificationId, email: emailResult };
}
