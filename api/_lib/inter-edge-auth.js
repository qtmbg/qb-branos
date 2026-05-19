// QB BrandOS · Cron-trigger auth validator.
//
// Single export: verifyCronTrigger(request).
//
// The cron path sits across one trust boundary distinct from the inter-Edge
// HMAC used for service-to-service calls (§5.6). Vercel's cron platform
// invokes /api/cron/<name> as a GET with the user-agent 'vercel-cron/1.0'
// and an Authorization: Bearer <CRON_SECRET> header. This module verifies
// both before letting the reaper sweep the dispatch_jobs table.
//
// Two distinct secrets, two distinct paths, per step-6 spec §6.3:
//   Path 1 (this file)  · cron → reaper      · CRON_SECRET
//   Path 2 (dispatch-pattern.signInterEdge) · reaper → /api/agents/run · INTER_EDGE_SECRET
//
// Returns one of:
//   { ok: true }
//   { ok: false, status: 401, reason: 'missing_cron_secret_env' }
//   { ok: false, status: 401, reason: 'bad_user_agent', ua, ipPrefix }
//   { ok: false, status: 401, reason: 'bad_bearer', ua, ipPrefix }
//
// The caller surfaces a 401 JSON response with error.code='unauthorized_cron_trigger'
// on any not-ok shape. The ua + ipPrefix fields exist so the caller can
// log the rejection for anomalous-probe visibility (rate-limit fodder for
// any operator review later).

const VERCEL_CRON_UA = 'vercel-cron/1.0';

function ipPrefixOf(req) {
  // Vercel's Edge runtime exposes the caller's IP via x-forwarded-for.
  // The header value can be a single IP or a comma-separated chain; the
  // first entry is the originating client. We log only the /24 prefix
  // (first three octets for IPv4, first 48 bits for IPv6) so the log
  // line is useful for pattern-spotting without storing PII at full
  // resolution.
  const raw = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const first = String(raw).split(',')[0].trim();
  if (!first) return '';
  if (first.includes(':')) {
    // IPv6 · keep first three groups.
    const parts = first.split(':');
    return parts.slice(0, 3).join(':') + '::/48';
  }
  const octets = first.split('.');
  if (octets.length === 4) return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  return first;
}

export function verifyCronTrigger(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, status: 401, reason: 'missing_cron_secret_env' };
  }

  const ua = req.headers.get('user-agent') || '';
  const ipPrefix = ipPrefixOf(req);

  if (ua !== VERCEL_CRON_UA) {
    return { ok: false, status: 401, reason: 'bad_user_agent', ua, ipPrefix };
  }

  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${cronSecret}`;
  if (authHeader !== expected) {
    return { ok: false, status: 401, reason: 'bad_bearer', ua, ipPrefix };
  }

  return { ok: true };
}
