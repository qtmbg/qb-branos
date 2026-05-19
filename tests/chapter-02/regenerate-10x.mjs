/* Chapter 2 · Step 6B acceptance gate 1.
 *
 * 10-run controlled-regenerate harness against /api/artifacts/[id]/regenerate.
 * Pass criterion: 10/10 single-agent regenerate runs land the new artifact
 * delivered with the correct version bump, parent_artifact_id linkage,
 * agent_runs row carrying the chosen qbp_source's snapshot.
 *
 * Per chapter-02/step-6-spec.md §5.4 acceptance gate 1.
 *
 * Setup per run:
 *   1. Create fresh user.
 *   2. Seed full QBP + tool_completions + foundation_lock_qbp.
 *   3. Lock foundation (creates 4 delivered artifacts as the regen source).
 *   4. Pick the Soul Map artifact (deterministic target).
 *   5. POST /api/artifacts/[id]/regenerate with qbp_source.
 *   6. Wait 45 s for the child to settle.
 *   7. Verify: new artifact at version=2 with parent_artifact_id=v1.id;
 *      new agent_runs row with trigger='regenerate', dispatch_id matching
 *      the regen dispatch (not the lock dispatch), qbp_snapshot keys
 *      consistent with the chosen qbp_source.
 *   8. Cleanup.
 *
 * Splits 10 runs: 5 with qbp_source='current', 5 with qbp_source='original'.
 *
 * Usage:
 *   node tests/chapter-02/regenerate-10x.mjs [runs]
 *
 * Reads /tmp/.env.qb-branos.live-backup.
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
const WAIT_MS      = parseInt(process.env.WAIT_MS || '45000', 10);
const RUNS         = parseInt(process.argv[2] || '10', 10);

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const TARGET_SLUG = 'soul_map_synthesizer';
const FETCH_TIMEOUT_MS = 30_000;
const INTER_RUN_COOLDOWN_MS = 10_000;

// Wrap fetch with an AbortController-backed timeout. Default global fetch
// has no timeout, so a hung connection waits forever. A 30 s ceiling caps
// any single request and surfaces flakes instead of multi-hour hangs.
async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts?.timeoutMs || FETCH_TIMEOUT_MS);
  try {
    // Inner call MUST be the global fetch (not tfetch) to avoid recursion.
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

const FULL_QBP_CURRENT = {
  brandName: 'Lighthouse Current',
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
  // Marker so we can verify qbp_source='current' picked this version up
  _qbp_variant: 'CURRENT',
};

// Drift the QBP between lock and regen · the lock snapshot has _qbp_variant=
// 'ORIGINAL' (set at lock time below); the live profile.qbp gets updated to
// FULL_QBP_CURRENT so qbp_source='current' picks up the drift. The two
// snapshots must be distinguishable by the harness verifier.

const PASSWORD = 'qbverify-6b-' + Math.random().toString(36).slice(2, 10) + '-X1!';

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s6b-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s6b' } }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function signIn(email) {
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('sign-in failed');
  return d.access_token;
}

async function setProfile(userId, patch) {
  await tfetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function deleteUser(userId) {
  await tfetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

function fullToolCompletions() {
  const ts = new Date().toISOString();
  return {
    'archetype-compass': { completed_at: ts, source: 'c2-s6b' },
    'soul-map':          { completed_at: ts, source: 'c2-s6b' },
    'sensescape':        { completed_at: ts, source: 'c2-s6b' },
  };
}

async function postLock(token) {
  const r = await tfetch(`${BASE}/api/lock-foundation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function readArtifactsForUser(userId) {
  const r = await tfetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&select=id,artifact_type,status,version,dispatch_id,parent_artifact_id&order=created_at.asc`,
    { headers: svc }
  );
  return r.ok ? await r.json().catch(() => []) : [];
}

async function readAgentRunsForUser(userId) {
  const r = await tfetch(
    `${SUPABASE_URL}/rest/v1/agent_runs?user_id=eq.${userId}&select=id,agent_slug,trigger,dispatch_id,artifact_id,status,model,qbp_snapshot&order=started_at.asc`,
    { headers: svc }
  );
  return r.ok ? await r.json().catch(() => []) : [];
}

async function postRegenerate(token, artifactId, qbpSource) {
  const r = await tfetch(`${BASE}/api/artifacts/${artifactId}/regenerate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ qbp_source: qbpSource }),
  });
  const deprecation = r.headers.get('x-deprecated');
  return { status: r.status, body: await r.json().catch(() => ({})), deprecation };
}

async function runOnce(idx, qbpSource) {
  const tag = `${String(idx).padStart(2,'0')}-${qbpSource}`;
  let user;
  const started = Date.now();
  try {
    user = await createUser(tag);
    // Seed · the lock will read profile.qbp + tool_completions and snapshot
    // profile.qbp into foundation_lock_qbp. So we want the lock-time qbp to
    // carry a distinct marker ('ORIGINAL'), then drift to 'CURRENT' before
    // the regenerate fires so qbp_source='current' picks up the new value.
    await setProfile(user.id, {
      qbp: { ...FULL_QBP_CURRENT, _qbp_variant: 'ORIGINAL' },
      tool_completions: fullToolCompletions(),
    });
    const token = await signIn(user.email);
    const lockRes = await postLock(token);
    if (lockRes.status !== 202 && lockRes.status !== 200) {
      return { idx, qbpSource, verdict: 'lock-failed', detail: `POST ${lockRes.status}`, ms: Date.now() - started };
    }
    // Wait for lock to settle
    await new Promise(r => setTimeout(r, 60000));

    const arts1 = await readArtifactsForUser(user.id);
    const target = arts1.find(a => a.artifact_type === TARGET_SLUG && a.status === 'delivered');
    if (!target) {
      return { idx, qbpSource, verdict: 'no-target', detail: 'no delivered Soul Map after lock', ms: Date.now() - started };
    }

    // Drift profile.qbp so current vs original is distinguishable
    await setProfile(user.id, { qbp: { ...FULL_QBP_CURRENT, _qbp_variant: 'CURRENT' } });

    // Regenerate
    const regenRes = await postRegenerate(token, target.id, qbpSource);
    if (regenRes.status !== 202 && regenRes.status !== 200) {
      return { idx, qbpSource, verdict: 'regen-failed', detail: `POST ${regenRes.status}`, body: regenRes.body, deprecation: regenRes.deprecation, ms: Date.now() - started };
    }
    if (regenRes.deprecation !== 'replaced by /api/agents/rerun, retires step 14') {
      return { idx, qbpSource, verdict: 'header-missing', detail: `deprecation header was: ${regenRes.deprecation}`, ms: Date.now() - started };
    }

    // Wait for the single child to settle
    await new Promise(r => setTimeout(r, WAIT_MS));

    const arts2 = await readArtifactsForUser(user.id);
    const v2 = arts2.find(a => a.artifact_type === TARGET_SLUG && a.version === 2);
    if (!v2) {
      return { idx, qbpSource, verdict: 'no-v2', detail: 'no v2 Soul Map artifact post-regen', ms: Date.now() - started };
    }
    if (v2.status !== 'delivered') {
      return { idx, qbpSource, verdict: 'v2-not-delivered', detail: `v2.status=${v2.status}`, ms: Date.now() - started };
    }
    if (v2.parent_artifact_id !== target.id) {
      return { idx, qbpSource, verdict: 'wrong-parent', detail: `v2.parent_artifact_id=${v2.parent_artifact_id}, expected=${target.id}`, ms: Date.now() - started };
    }
    if (v2.dispatch_id === target.dispatch_id) {
      return { idx, qbpSource, verdict: 'dispatch-not-new', detail: `v2.dispatch_id matches v1`, ms: Date.now() - started };
    }

    // Verify the regenerate's agent_run row
    const runs = await readAgentRunsForUser(user.id);
    const regenRun = runs.find(r => r.dispatch_id === v2.dispatch_id && r.agent_slug === TARGET_SLUG);
    if (!regenRun) {
      return { idx, qbpSource, verdict: 'no-regen-run', detail: 'no agent_runs row for v2 dispatch', ms: Date.now() - started };
    }
    if (regenRun.trigger !== 'regenerate') {
      return { idx, qbpSource, verdict: 'wrong-trigger', detail: `trigger=${regenRun.trigger}`, ms: Date.now() - started };
    }
    if (regenRun.artifact_id !== v2.id) {
      return { idx, qbpSource, verdict: 'wrong-artifact-link', detail: `agent_runs.artifact_id mismatch`, ms: Date.now() - started };
    }
    const snapMarker = regenRun.qbp_snapshot?._qbp_variant;
    const expectedMarker = qbpSource === 'original' ? 'ORIGINAL' : 'CURRENT';
    if (snapMarker !== expectedMarker) {
      return { idx, qbpSource, verdict: 'wrong-qbp-snapshot', detail: `qbp_snapshot._qbp_variant=${snapMarker}, expected=${expectedMarker}`, ms: Date.now() - started };
    }

    return { idx, qbpSource, verdict: 'SUCCESS', detail: `v2 delivered, parent=v1, dispatch=new, trigger=regenerate, snapshot=${snapMarker}`, ms: Date.now() - started };
  } catch (e) {
    return { idx, qbpSource, verdict: 'threw', detail: e?.message || String(e), ms: Date.now() - started };
  } finally {
    if (user?.id) await deleteUser(user.id);
  }
}

(async () => {
  console.log(`regenerate-10x · ${RUNS} runs against ${BASE} · wait ${WAIT_MS} ms per regen`);
  console.log('split: half qbp_source=current, half qbp_source=original');
  console.log('');

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    const qbpSource = i <= Math.floor(RUNS / 2) ? 'current' : 'original';
    process.stdout.write(`run ${String(i).padStart(2,'0')}/${RUNS} (${qbpSource})... `);
    const r = await runOnce(i, qbpSource);
    results.push(r);
    const label = r.verdict.padEnd(20);
    console.log(`${label}  ${r.ms} ms  ${r.detail}`);
    // Inter-run cooldown · prior 10-run sweep hit infrastructure throttling
    // around run 5 (multi-hour fetch hangs · cleaned up by AbortController
    // timeout now, but the cooldown gives Supabase admin + Vercel headroom).
    if (i < RUNS) {
      await new Promise(r => setTimeout(r, INTER_RUN_COOLDOWN_MS));
    }
  }

  const success = results.filter(r => r.verdict === 'SUCCESS').length;
  const failed = results.length - success;
  console.log('');
  console.log('── Summary ─────────────────────────────────────────');
  console.log(`  runs:    ${results.length}`);
  console.log(`  SUCCESS: ${success}`);
  console.log(`  FAILED:  ${failed}`);
  console.log('');
  const passed = success === results.length;
  console.log(passed ? `PASS · ${success}/${results.length} successful regens` : `FAIL · ${failed}/${results.length} runs failed`);

  fs.writeFileSync('tests/chapter-02/regenerate-10x.last-run.json',
    JSON.stringify({ base: BASE, runs: results.length, success, failed, passed, results }, null, 2));
  if (!passed) process.exitCode = 1;
})();
