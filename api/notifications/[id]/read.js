// QB BrandOS · POST /api/notifications/[id]/read
// Marks a single notification row as read for the caller. Sets read_at=now()
// on the caller's own row. RLS enforces ownership; idempotent (re-read is a
// no-op because we filter on `read_at=is.null`, so subsequent calls match
// zero rows and return 200 with the same response shape).
//
// Pattern mirrors /api/artifacts/[id]/regenerate.js:
//   - extract id from the URL path
//   - resolve user via JWT
//   - PATCH via service-role REST, scoped by user_id=eq.<userId>

import { cors, json, resolveUser, svcHeaders, requireEnv } from '../../_lib/auth.js';

export const config = { runtime: 'edge' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractIdFromPath(req) {
  const path = new URL(req.url).pathname;
  const m = path.match(/\/api\/notifications\/([^\/?]+)\/read$/);
  return m ? m[1] : '';
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' }, corsH);

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  const id = extractIdFromPath(req);
  if (!id || !UUID_RE.test(id)) {
    return json(404, { error: 'Notification not found' }, corsH);
  }

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);
  const userId = authResult.user.id;

  // Patch only unread rows owned by the caller. The user_id filter makes
  // the call a no-op on someone else's row even if the id leaked. The
  // read_at=is.null filter makes re-hits idempotent at the row level
  // (first call sets the timestamp; later calls match zero rows).
  const patchUrl =
    `${env.SUPABASE_URL}/rest/v1/notifications` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&read_at=is.null`;

  const nowIso = new Date().toISOString();
  const r = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ read_at: nowIso }),
  });

  if (!r.ok) {
    return json(500, { error: 'Could not mark notification read' }, corsH);
  }
  const rows = await r.json().catch(() => []);

  // rows.length === 0 means either the row doesn't exist, isn't owned by
  // this user, or was already read. All three collapse to the same
  // observable: read_at is set (or wasn't set because the row is gone).
  // We always return ok=true so the bell can treat the call as a no-op.
  return json(200, {
    ok: true,
    id,
    read_at: rows?.[0]?.read_at || nowIso,
    already_read: !rows || rows.length === 0,
  }, corsH);
}
