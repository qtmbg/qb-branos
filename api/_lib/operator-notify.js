// api/_lib/operator-notify.js
// Chapter 2 · Step 4 · §5.8.2 operator notification channel.
//
// Fires a plain-text Resend email to me@qtmbg.com when an operator-only
// state surfaces (`config_missing`, registry latency-budget warnings,
// future operator-actionable conditions). User-facing surfaces never
// render this detail; they show §5.8.2 generic copy ("Temporarily
// unavailable. Try again later.") and stay silent on the bell.
//
// Dedup window: at most one email per 60-second window per
// (agent_slug, stage) pair. Prevents storm conditions when a
// misconfigured deploy triggers `config_missing` on every dispatch.
//
// Dedup state lives in-process (module-level Map) for now. Edge function
// instances are short-lived so the dedup is best-effort across restarts;
// the trade-off is acceptable for an operator-only channel where a few
// extra emails during a deploy storm are still better than zero signal.
// A future Supabase-backed dedup table can replace this if storm load
// becomes a real problem.

import { sendEmail } from './email.js';

const OPERATOR_EMAIL = 'me@qtmbg.com';
const SUBJECT_PREFIX = '[QB BrandOS Operator]';
const DEDUP_WINDOW_MS = 60_000;

// key → lastSentAt (epoch ms). Cleared lazily on each fire to avoid
// unbounded growth in long-lived processes.
const _dedupCache = new Map();

function shouldFire(key) {
  const now = Date.now();
  const last = _dedupCache.get(key) || 0;
  if (now - last < DEDUP_WINDOW_MS) return false;
  _dedupCache.set(key, now);
  // Lazy GC: drop any entry older than 5 × window.
  if (_dedupCache.size > 128) {
    const cutoff = now - DEDUP_WINDOW_MS * 5;
    for (const [k, ts] of _dedupCache) {
      if (ts < cutoff) _dedupCache.delete(k);
    }
  }
  return true;
}

function formatBody(payload) {
  const lines = [
    `agent_slug:  ${payload.agent_slug || '<unknown>'}`,
    `dispatch_id: ${payload.dispatch_id || '<unknown>'}`,
    `stage:       ${payload.stage || '<unknown>'}`,
    `env_hint:    ${payload.env_hint || '<unknown>'}`,
    `fired_at:    ${payload.fired_at || new Date().toISOString()}`,
    `context:     ${payload.context || '<no context>'}`,
  ];
  return lines.join('\n');
}

// Fires the operator notification. Always returns a result object;
// never throws. Caller does NOT await this in dispatch paths · the
// notification is informational and must not block user-visible flow.
//
// Inputs:
//   payload · {
//     agent_slug, dispatch_id, stage, env_hint, context,
//     reason · short subject suffix (e.g. "config_missing", "latency_budget_warning")
//   }
//
// Returns:
//   { ok: true, sent: true, id }       · email queued by Resend
//   { ok: true, sent: false, dedup: true } · within dedup window, no-op
//   { ok: false, error }               · Resend failure or config missing
export async function sendOperatorNotification(payload) {
  const reason = payload?.reason || payload?.stage || 'operator-event';
  const agentSlug = payload?.agent_slug || 'unknown_agent';
  const key = `${agentSlug}:${reason}`;
  if (!shouldFire(key)) {
    return { ok: true, sent: false, dedup: true };
  }

  const subject = `${SUBJECT_PREFIX} ${reason} · ${agentSlug}`;
  const body = formatBody({
    ...payload,
    fired_at: payload?.fired_at || new Date().toISOString(),
  });

  try {
    const result = await sendEmail({
      to: OPERATOR_EMAIL,
      subject,
      text: body,
      html: `<pre style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px;">${escapeHtml(body)}</pre>`,
      refId: 'qb-operator',
      transactional: true,
    });
    if (!result.ok) {
      return { ok: false, error: result.error || 'send failed' };
    }
    return { ok: true, sent: true, id: result.id };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'threw' };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Test hook · clears the dedup cache. Used by the conformance suite when
// the same operator-only state needs to fire repeatedly within a single
// test run. Not for production use.
export function _resetDedupForTests() {
  _dedupCache.clear();
}
