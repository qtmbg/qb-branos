// TEST-ONLY endpoint · mirrors PR #59 fire-and-forget pattern
// for the Chapter 2 §2.5 reproduction gate.
//
// THIS IS A DIAGNOSTIC ENDPOINT. It does NOT touch the production lock
// flow. It exists to reproduce the stuck-dispatch failure mode that
// caused PR #59 to be reverted.
//
// Pattern:
//   1. Verify caller via INTER_EDGE_SECRET (so this isn't user-reachable).
//   2. Insert a `repro_runs` row with status='dispatched'.
//   3. Fire 4 child fetches to /api/test-async-dispatch WITHOUT awaiting.
//      No pre-inserted artifact rows. No waitUntil. Pure PR #59 pattern.
//   4. Return 202 immediately.
//
// Diagnostic logs at every boundary so Vercel runtime log filtering by
// `[repro]` shows the full failure trail.

export const config = { runtime: 'edge' };

function log(stage, data) {
  // Single channel so Vercel logs are filterable.
  console.log(JSON.stringify({ marker: '[repro]', stage, ts: Date.now(), ...data }));
}

export default async function handler(req) {
  const t_parent_entry = Date.now();
  log('parent.entry', { url: req.url });

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const REPRO_SECRET = process.env.REPRO_SECRET;

  if (!SUPABASE_URL || !SERVICE_KEY || !REPRO_SECRET) {
    log('parent.misconfigured', {});
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503 });
  }

  // Gate access to operators only.
  const sig = req.headers.get('x-repro-secret') || '';
  if (sig !== REPRO_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const run_id = body.run_id || `repro_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user_id = body.user_id || null;

  log('parent.start', { run_id, user_id });

  // Insert a parent row so we can later correlate parent vs child entries.
  // Schema: a simple `repro_runs` table (created via migration in step 1).
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/repro_runs`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        run_id,
        user_id,
        parent_entry_at: new Date(t_parent_entry).toISOString(),
        status: 'dispatched',
      }),
    });
  } catch (e) {
    log('parent.parent_insert_failed', { err: e?.message });
  }

  const base = new URL(req.url).origin;
  const t_fire_start = Date.now();
  log('parent.fire_start', { run_id, base });

  // FIRE 4 CHILDREN WITHOUT AWAIT. Pure PR #59 pattern.
  // No pre-inserted artifact rows. No waitUntil. No connection establishment wait.
  for (let i = 0; i < 4; i++) {
    const fire_at = Date.now();
    log('parent.fire_initiate', { run_id, child_index: i, fire_at });
    fetch(`${base}/api/test-async-dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-repro-secret': REPRO_SECRET },
      body: JSON.stringify({ run_id, child_index: i, fire_initiate_ts: fire_at }),
    }).catch(e => log('parent.fire_catch', { run_id, child_index: i, err: e?.message }));
  }

  const t_parent_return = Date.now();
  log('parent.return', {
    run_id,
    parent_total_ms: t_parent_return - t_parent_entry,
    fire_loop_ms: t_parent_return - t_fire_start,
  });

  return new Response(JSON.stringify({
    ok: true,
    run_id,
    parent_total_ms: t_parent_return - t_parent_entry,
  }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
}
