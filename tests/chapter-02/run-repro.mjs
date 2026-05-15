/* Chapter 2 · Step 1 · PR #59 reproduction harness.
 *
 * Single-command. Run from a clean local env:
 *   node tests/chapter-02/run-repro.mjs <runs>
 *
 * Per spec §2.5 evidence bar:
 *   - Min 2/10 stuck dispatches to pass the gate
 *   - 0/N does NOT pass (escalate)
 *   - Single command, clean test user, log evidence at the failure moment
 *
 * Flow per run:
 *   1. Create a fresh test user via Supabase admin
 *   2. POST /api/test-async-lock (mirrors PR #59 fire-and-forget)
 *   3. Wait 30s for children to write rows
 *   4. Query public.repro_children to count how many child rows landed
 *   5. STUCK if < 4 children wrote rows
 *   6. SUCCESS if all 4 wrote rows
 *
 * Summary at end:
 *   N runs · X stuck · Y success · rate Z%
 *
 * Note: the actual production lock-foundation flow is UNTOUCHED. This is
 * a parallel diagnostic surface deployed alongside, using its own tables.
 */
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')]; }));

const REPRO_SECRET = fs.readFileSync('/tmp/repro-secret.txt', 'utf8').trim();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.REPRO_BASE || 'https://quantumbranding.ai';

const RUNS = parseInt(process.argv[2] || '10', 10);
const WAIT_FOR_CHILDREN_MS = 30_000;

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

async function createTestUser() {
  const ts = Date.now();
  const email = `nizzar.ben+c2repro-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { signup_source: 'c2-repro-harness' } }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function fireRepro(user_id) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/test-async-lock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-repro-secret': REPRO_SECRET },
    body: JSON.stringify({ user_id }),
  });
  const elapsed = Date.now() - t0;
  let body = '';
  try { body = await r.text(); } catch {}
  let parsed = {};
  try { parsed = JSON.parse(body); } catch {}
  return { status: r.status, elapsed_ms: elapsed, body: parsed, raw: body };
}

async function checkChildren(run_id) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/repro_children?run_id=eq.${encodeURIComponent(run_id)}&select=child_index,entry_at,exit_at,propagation_ms,duration_ms&order=child_index.asc`,
    { headers: svc }
  );
  return r.ok ? r.json() : [];
}

async function deleteUser(user_id) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`,
    { method: 'DELETE', headers: svc }).catch(() => {});
}

(async () => {
  console.log(`Chapter 2 · Step 1 reproduction harness`);
  console.log(`Base: ${BASE}`);
  console.log(`Runs: ${RUNS}`);
  console.log(`Wait per run: ${WAIT_FOR_CHILDREN_MS}ms`);
  console.log('');

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    process.stdout.write(`Run ${String(i).padStart(2)}/${RUNS} · `);
    let user;
    try {
      user = await createTestUser();
      process.stdout.write(`user=${user.id.slice(0,8)} `);

      const fire = await fireRepro(user.id);
      process.stdout.write(`parent=HTTP ${fire.status} in ${fire.elapsed_ms}ms `);

      const run_id = fire.body?.run_id;
      if (!run_id) {
        console.log('FAIL · no run_id returned · skipping');
        results.push({ run: i, user_id: user.id, error: 'no_run_id', fire });
        continue;
      }

      await new Promise(rs => setTimeout(rs, WAIT_FOR_CHILDREN_MS));

      const children = await checkChildren(run_id);
      const completed = children.filter(c => c.exit_at).length;
      const started = children.length;
      const stuck = started < 4;
      console.log(`children: ${started}/4 started, ${completed}/4 completed · ${stuck ? 'STUCK ✗' : 'OK ✓'}`);

      results.push({
        run: i,
        user_id: user.id,
        run_id,
        parent_status: fire.status,
        parent_elapsed_ms: fire.elapsed_ms,
        children_started: started,
        children_completed: completed,
        stuck,
        child_detail: children,
      });
    } catch (e) {
      console.log(`THREW: ${e.message}`);
      results.push({ run: i, error: e.message });
    } finally {
      if (user?.id) await deleteUser(user.id);
    }
  }

  const stuckCount = results.filter(r => r.stuck).length;
  const successCount = results.filter(r => !r.stuck && !r.error).length;
  const errorCount = results.filter(r => r.error).length;

  console.log('');
  console.log('═══ Summary ═══');
  console.log(`Total runs:    ${RUNS}`);
  console.log(`Success (4/4): ${successCount}`);
  console.log(`Stuck (<4/4):  ${stuckCount}`);
  console.log(`Errors:        ${errorCount}`);
  console.log(`Stuck rate:    ${((stuckCount / RUNS) * 100).toFixed(1)}%`);
  console.log('');
  if (stuckCount >= 2) {
    console.log(`✓ GATE PASS: ${stuckCount}/${RUNS} ≥ 2/10 threshold. Bug reproduced.`);
  } else if (stuckCount === 1) {
    console.log(`⚠ BORDERLINE: 1/${RUNS} matches PR #59's rate but is below 2/10 floor.`);
  } else {
    console.log(`✗ GATE NOT PASSED: 0/${RUNS} stuck. Iterate harness or escalate.`);
  }

  const outPath = `/tmp/repro-results-${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify({ base: BASE, runs: RUNS, results, stuckCount, successCount, errorCount }, null, 2));
  console.log(`\nDetailed results: ${outPath}`);
})().catch(e => { console.error(e); process.exit(1); });
