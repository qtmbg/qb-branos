/* Chapter 2 · Step 6A acceptance gate 1.
 *
 * 10-run controlled-lock harness against the production /api/lock-foundation
 * endpoint. Pass criterion: 10/10 runs land all four child artifacts in the
 * delivered state, with zero rows left in queued or producing after the
 * 45 s observation window.
 *
 * Why a new harness · the original tests/chapter-02/run-repro.mjs targets
 * /api/test-async-lock, which is the §2.5 PR #59 diagnostic endpoint that
 * intentionally implements fire-and-forget WITHOUT pre-insert or waitUntil.
 * That harness proves the old pattern broke; it cannot verify the new
 * Option A pattern that ships in PR #84.
 *
 * Usage:
 *   node tests/chapter-02/lock-foundation-10x.mjs [runs]
 *
 *   runs defaults to 10. The pass criterion is 10/10 zero-stuck.
 *
 * Required local env (sourced from /tmp/.env.qb-branos.live-backup):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 *
 * Optional env:
 *   LOCK_BASE  · override base URL (default https://quantumbranding.ai)
 *   WAIT_MS    · per-run observation window (default 45000)
 */

import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = env.SUPABASE_ANON_KEY;
const BASE         = process.env.LOCK_BASE || 'https://quantumbranding.ai';
// 60 s default: Visual DNA's worst-case is 22.9 s single-shot wall time at
// retry_budget=0 (§5.2.1 amendment). Add child-fetch propagation overhead +
// some margin so a heavy-load run converges before the observation window
// closes. 45 s was too tight (one run in a 3-run sanity batch saw Visual
// DNA still in producing).
const WAIT_MS      = parseInt(process.env.WAIT_MS || '60000', 10);
const RUNS         = parseInt(process.argv[2] || '10', 10);

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

const FULL_QBP = {
  brandName: 'Lighthouse Verify',
  brandEssence: 'Quiet clarity for founders.',
  spark: 'Late-night realization.',
  archetype: 'The Sage',
  manifesto: 'Clarity earned by sitting longer with the question.',
  antiBrand: 'Not a guru.',
  paradox: 'Slow on purpose, fast in result.',
  alwaysNever: 'Always honest. Never performative.',
  colorTerritory: 'Cold seafoam, oxidized brass.',
  forbiddenColor: 'No saturated reds.',
  brandObject: 'A brass weather instrument.',
  brandMoment: 'A founder closing their laptop at 11pm.',
  signatureGesture: 'A slow nod.',
  soundSignature: 'A low piano chord.',
  archetypePrimary: 'The Sage',
  warTableBrief: 'A thinking partner.',
  audienceFears: 'Being seen as another guru.',
};

const PASSWORD = 'qbverify-6a-' + Math.random().toString(36).slice(2, 12) + '-X1!';

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s6a-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      email, email_confirm: true, password: PASSWORD,
      user_metadata: { signup_source: 'c2-s6a-verify' },
    }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function signIn(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('sign-in failed: ' + JSON.stringify(d));
  return d.access_token;
}

async function setProfile(userId, patch) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function deleteUser(userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function postLock(token) {
  // /api/lock-foundation reads qbp + tool_completions from profiles, not
  // from the request body. Caller must setProfile() first.
  const r = await fetch(`${BASE}/api/lock-foundation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

function fullToolCompletions() {
  const ts = new Date().toISOString();
  return {
    'archetype-compass': { completed_at: ts, source: 'c2-s6a-verify' },
    'soul-map':          { completed_at: ts, source: 'c2-s6a-verify' },
    'sensescape':        { completed_at: ts, source: 'c2-s6a-verify' },
  };
}

async function readArtifacts(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&select=artifact_type,status,version,created_at,updated_at&order=created_at.asc`,
    { headers: svc }
  );
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}

// Non-terminal statuses · anything that means "child agent has not settled
// yet." Counted as stuck because they violate the "all four converge
// within the observation window" criterion.
const NON_TERMINAL = ['queued', 'producing', 'generating', 'started'];

function classify(artifacts) {
  const byStatus = artifacts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});
  const total     = artifacts.length;
  const delivered = (byStatus.delivered || 0) + (byStatus.succeeded || 0);
  const stuck     = NON_TERMINAL.reduce((s, k) => s + (byStatus[k] || 0), 0);
  const failed    = (byStatus.failed || 0) + (byStatus.failed_permanently || 0);
  const summary   = Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(' ');

  if (total !== 4)     return { verdict: 'malformed',    detail: `${total} artifact rows, expected 4 · ${summary}`, byStatus };
  if (stuck > 0)       return { verdict: 'STUCK',        detail: `${stuck} non-terminal after ${WAIT_MS} ms · ${summary}`, byStatus };
  if (delivered === 4) return { verdict: 'SUCCESS',      detail: `${summary}`, byStatus };
  if (failed > 0 && delivered + failed === 4) return { verdict: 'partial-fail', detail: `${summary}`, byStatus };
  return { verdict: 'unexpected', detail: summary, byStatus };
}

async function runOnce(idx) {
  const tag = String(idx).padStart(2, '0');
  let user;
  const started = Date.now();
  try {
    user = await createUser(tag);
    await setProfile(user.id, {
      qbp: FULL_QBP,
      tool_completions: fullToolCompletions(),
    });
    const token = await signIn(user.email);
    const lockRes = await postLock(token);

    if (lockRes.status !== 200 && lockRes.status !== 202) {
      return { idx, verdict: 'lock-failed', detail: `POST returned ${lockRes.status}`, body: lockRes.body, ms: Date.now() - started };
    }

    await new Promise(r => setTimeout(r, WAIT_MS));
    const artifacts = await readArtifacts(user.id);
    const cls = classify(artifacts);
    return { idx, ...cls, lockStatus: lockRes.status, ms: Date.now() - started };
  } catch (e) {
    return { idx, verdict: 'threw', detail: e?.message || String(e), ms: Date.now() - started };
  } finally {
    if (user?.id) await deleteUser(user.id);
  }
}

(async () => {
  console.log(`lock-foundation-10x · ${RUNS} runs against ${BASE} · wait ${WAIT_MS} ms per run`);
  console.log('');

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    process.stdout.write(`run ${String(i).padStart(2,'0')}/${RUNS}... `);
    const r = await runOnce(i);
    results.push(r);
    const label = r.verdict.padEnd(13);
    console.log(`${label}  ${r.ms} ms  ${r.detail}`);
  }

  const stuck   = results.filter(r => r.verdict === 'STUCK').length;
  const success = results.filter(r => r.verdict === 'SUCCESS').length;
  const partial = results.filter(r => r.verdict === 'partial-fail').length;
  const other   = results.length - stuck - success - partial;

  console.log('');
  console.log(`── Summary ────────────────────────────────────────────`);
  console.log(`  runs:         ${results.length}`);
  console.log(`  SUCCESS:      ${success}  (all four delivered)`);
  console.log(`  partial-fail: ${partial}  (some failed, none stuck)`);
  console.log(`  STUCK:        ${stuck}  (queued/producing after wait window)`);
  console.log(`  other:        ${other}`);
  console.log('');

  const passed = stuck === 0;
  const summaryLine = passed
    ? `PASS · 0 stuck of ${results.length} runs (${success}/${results.length} fully delivered)`
    : `FAIL · ${stuck} stuck of ${results.length} runs`;
  console.log(summaryLine);

  const outPath = 'tests/chapter-02/lock-foundation-10x.last-run.json';
  fs.writeFileSync(outPath, JSON.stringify({
    base: BASE, runs: results.length, wait_ms: WAIT_MS,
    success, partial_fail: partial, stuck, other,
    passed, results,
  }, null, 2));
  console.log(`Written: ${outPath}`);

  if (!passed) process.exitCode = 1;
})();
