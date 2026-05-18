// QB BrandOS · GET /api/notifications
// Returns the caller's notifications (last 50 by default) plus unread_count.
// Chapter 2 step 6D per spec §7.1 + §7.2.
//
// Auth pattern mirrors /api/agents/console.js:
//   1. resolveUser() validates the inbound JWT against Supabase auth.
//   2. Service-role-scoped REST reads filter by user_id=eq.<userId>.
//      RLS would also gate this if we used the user's token directly,
//      but service-role gives consistent shape across the api layer.
//
// Forward-compat: accepts ?before=<iso-timestamp> for pagination into older
// pages. MVP serves a single 50-row page; the param is wired now so the
// bell can grow a "load older" footer later without a new endpoint.

import { cors, json, resolveUser, svcHeaders, requireEnv } from './_lib/auth.js';

export const config = { runtime: 'edge' };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseIso(s) {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' }, corsH);

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);
  const userId = authResult.user.id;

  const url = new URL(req.url);
  const before = parseIso(url.searchParams.get('before'));
  let limit = parseInt(url.searchParams.get('limit') || '', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  // Page query: caller's rows, newest first, optionally older than ?before.
  let listUrl =
    `${env.SUPABASE_URL}/rest/v1/notifications` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&select=id,kind,agent_slug,artifact_id,payload,read_at,created_at` +
    `&order=created_at.desc&limit=${limit}`;
  if (before) listUrl += `&created_at=lt.${encodeURIComponent(before)}`;

  // Unread count: HEAD request with Prefer: count=exact reads the
  // Content-Range header. Filter `read_at=is.null` keeps the count
  // bounded to actionable rows only.
  const countUrl =
    `${env.SUPABASE_URL}/rest/v1/notifications` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&read_at=is.null&select=id`;

  const svc = svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY);

  const [listRes, countRes] = await Promise.all([
    fetch(listUrl, { headers: svc }),
    fetch(countUrl, {
      method: 'HEAD',
      headers: { ...svc, Prefer: 'count=exact' },
    }),
  ]);

  if (!listRes.ok) {
    return json(500, { error: 'Could not load notifications' }, corsH);
  }
  const notifications = await listRes.json().catch(() => []);

  // Parse Content-Range: "0-9/42" → 42. Fall back to the page length if the
  // header is missing (which only happens if Supabase ever drops the Prefer
  // hint silently).
  let unreadCount = 0;
  if (countRes.ok) {
    const range = countRes.headers.get('content-range') || '';
    const m = range.match(/\/(\d+)\s*$/);
    if (m) unreadCount = parseInt(m[1], 10) || 0;
  }

  return json(200, {
    ok: true,
    notifications: Array.isArray(notifications) ? notifications : [],
    unread_count: unreadCount,
  }, corsH);
}
