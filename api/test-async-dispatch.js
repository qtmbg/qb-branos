// TEST-ONLY child endpoint · the dispatcher in the PR #59 pattern.
//
// THIS IS A DIAGNOSTIC ENDPOINT. Receives a fire-and-forget POST from
// /api/test-async-lock and:
//   1. Logs entry timestamp (so we know the child function actually started)
//   2. Writes a `repro_children` row for the run_id + child_index
//   3. Optionally pauses briefly to simulate the Claude call wall time
//   4. Logs exit timestamp
//
// If the child never starts, no row appears in `repro_children`. The
// harness checks this. That's the stuck-dispatch failure mode.

export const config = { runtime: 'edge' };

function log(stage, data) {
  console.log(JSON.stringify({ marker: '[repro]', stage, ts: Date.now(), ...data }));
}

export default async function handler(req) {
  const t_child_entry = Date.now();

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const REPRO_SECRET = process.env.REPRO_SECRET;

  if (!SUPABASE_URL || !SERVICE_KEY || !REPRO_SECRET) {
    log('child.misconfigured', {});
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503 });
  }

  const sig = req.headers.get('x-repro-secret') || '';
  if (sig !== REPRO_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const { run_id, child_index, fire_initiate_ts } = body;

  log('child.entry', { run_id, child_index, fire_initiate_ts, t_child_entry, propagation_ms: t_child_entry - (fire_initiate_ts || t_child_entry) });

  // Write the child row immediately so even a Claude-call-side failure
  // still proves the child function started.
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/repro_children`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        run_id,
        child_index,
        entry_at: new Date(t_child_entry).toISOString(),
        fire_initiate_ts: fire_initiate_ts ? new Date(fire_initiate_ts).toISOString() : null,
        propagation_ms: fire_initiate_ts ? (t_child_entry - fire_initiate_ts) : null,
      }),
    });
    log('child.row_written', { run_id, child_index });
  } catch (e) {
    log('child.insert_failed', { run_id, child_index, err: e?.message });
  }

  // Simulate ~5s of Claude work to match real conditions
  await new Promise(rs => setTimeout(rs, 5000));

  const t_child_exit = Date.now();
  log('child.exit', { run_id, child_index, duration_ms: t_child_exit - t_child_entry });

  // PATCH the child row to record completion
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/repro_children?run_id=eq.${encodeURIComponent(run_id)}&child_index=eq.${child_index}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ exit_at: new Date(t_child_exit).toISOString(), duration_ms: t_child_exit - t_child_entry }),
    });
  } catch (e) {
    log('child.patch_failed', { run_id, child_index, err: e?.message });
  }

  return new Response(JSON.stringify({ ok: true, run_id, child_index }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
