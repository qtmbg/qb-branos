/* Chapter 2 · Step 7A acceptance gate 1.
 *
 * 10-run rerun conformance harness against /api/agents/rerun.
 * Per chapter-02/step-7-spec.md §3.5:
 *   - 5 runs target v1 (root) · verifies the simple case
 *   - 5 runs target v2 (mid-chain) · verifies branched semantics per
 *     adjudication #4 (new artifact is v(N+1) with parent=v2, sibling
 *     to whatever the latest in the linear chain is)
 *
 * Each rerun verifies:
 *   - new artifact at version = max + 1
 *   - parent_artifact_id = source.id (the artifact the user rerun on,
 *     NOT the latest)
 *   - dispatch_jobs.kind = 'regenerate'
 *   - agent_runs.trigger = 'regenerate'
 *   - qbp_snapshot._qbp_variant matches the chosen qbp_source marker
 *   - /api/agent-runs/<run-id>/replay returns the run-specific snapshot
 *     (NOT the latest in the chain · §3.3 replay-target proof)
 *
 * Two phases · two users (one per source type):
 *   Phase 1 (v1-source): user A · lock → 5 reruns on v1
 *   Phase 2 (v2-source): user B · lock → rerun v1→v2 → rerun v2→v3 ·
 *     then 5 reruns on v2 (each produces a sibling with parent=v2)
 *
 * Inherits PR #90 harness hardening · fetch timeouts + inter-run cooldown.
 *
 * Usage:
 *   node tests/chapter-02/rerun-conformance.mjs
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
const BASE         = process.env.RERUN_BASE || 'https://quantumbranding.ai';

const FETCH_TIMEOUT_MS = 30_000;
const WAIT_BETWEEN_RERUNS_MS = 45_000;
const COOLDOWN_MS = 5_000;

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const PASSWORD = 'qbverify-7a-' + Math.random().toString(36).slice(2, 10) + '-X1!';
const TARGET_SLUG = 'soul_map_synthesizer';

async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts?.timeoutMs || FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

const FULL_QBP = {
  brandName: 'Lighthouse Rerun',
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
  _qbp_variant: 'CURRENT',
};

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s7a-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s7a' } }),
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
    'archetype-compass': { completed_at: ts, source: 'c2-s7a' },
    'soul-map':          { completed_at: ts, source: 'c2-s7a' },
    'sensescape':        { completed_at: ts, source: 'c2-s7a' },
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

async function postRerun(token, artifactId, qbpSource) {
  const r = await tfetch(`${BASE}/api/agents/rerun`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ artifact_id: artifactId, qbp_source: qbpSource }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function readArtifactsForUser(userId, slug) {
  const r = await tfetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&artifact_type=eq.${slug}&select=id,artifact_type,status,version,dispatch_id,parent_artifact_id&order=version.asc`,
    { headers: svc }
  );
  return r.ok ? await r.json().catch(() => []) : [];
}

async function readAgentRunsForUser(userId) {
  const r = await tfetch(
    `${SUPABASE_URL}/rest/v1/agent_runs?user_id=eq.${userId}&select=id,agent_slug,trigger,dispatch_id,artifact_id,status,qbp_snapshot,runtime_args&order=started_at.asc`,
    { headers: svc }
  );
  return r.ok ? await r.json().catch(() => []) : [];
}

async function readReplay(token, runId) {
  const r = await tfetch(`${BASE}/api/agent-runs/${runId}/replay`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.ok ? await r.json().catch(() => ({})) : { ok: false, status: r.status };
}

async function waitForVersion(userId, slug, version, timeoutMs = WAIT_BETWEEN_RERUNS_MS) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const arts = await readArtifactsForUser(userId, slug);
    const target = arts.find(a => a.version === version && a.status === 'delivered');
    if (target) return target;
    await new Promise(r => setTimeout(r, 3_000));
  }
  return null;
}

function verifyArtifact(art, { expectedVersion, expectedParentId, label }) {
  const issues = [];
  if (!art) issues.push(`${label}: not delivered within window`);
  else {
    if (art.version !== expectedVersion) issues.push(`${label}: version ${art.version} (expected ${expectedVersion})`);
    if (art.parent_artifact_id !== expectedParentId) issues.push(`${label}: parent ${art.parent_artifact_id} (expected ${expectedParentId})`);
    if (art.status !== 'delivered') issues.push(`${label}: status ${art.status}`);
  }
  return issues;
}

async function setupUser(tag) {
  const user = await createUser(tag);
  await setProfile(user.id, { qbp: FULL_QBP, tool_completions: fullToolCompletions() });
  const token = await signIn(user.email);
  const lockRes = await postLock(token);
  if (lockRes.status !== 202 && lockRes.status !== 200) {
    throw new Error(`lock failed for ${tag}: ${lockRes.status} ${JSON.stringify(lockRes.body)}`);
  }
  await new Promise(r => setTimeout(r, 60_000)); // lock-wait window
  const v1 = await waitForVersion(user.id, TARGET_SLUG, 1, 5_000);
  if (!v1) throw new Error(`v1 of ${TARGET_SLUG} not delivered after lock`);
  return { user, token, v1 };
}

// ─── Phase 1 · v1-source reruns ─────────────────────────────────────────
async function phase1V1Source() {
  console.log('\n── Phase 1 · 5 reruns on v1 (root source) ──');
  const results = [];
  const { user, token, v1 } = await setupUser('p1');
  console.log(`user ${user.id.slice(0,8)} · v1 id ${v1.id.slice(0,8)}`);

  try {
    let nextVersion = 2;
    for (let i = 1; i <= 5; i++) {
      const label = `v1-source run ${i}`;
      const started = Date.now();
      const rerunRes = await postRerun(token, v1.id, 'current');
      if (rerunRes.status !== 202 && rerunRes.status !== 200) {
        results.push({ phase: 'v1-source', i, verdict: 'rerun-failed', detail: `${rerunRes.status} ${JSON.stringify(rerunRes.body)}`, ms: Date.now() - started });
        continue;
      }
      const newArt = await waitForVersion(user.id, TARGET_SLUG, nextVersion);
      const issues = verifyArtifact(newArt, { expectedVersion: nextVersion, expectedParentId: v1.id, label });

      // Verify replay endpoint targets the run-specific snapshot
      if (newArt) {
        const runs = await readAgentRunsForUser(user.id);
        const targetRun = runs.find(r => r.artifact_id === newArt.id && r.trigger === 'regenerate');
        if (!targetRun) issues.push(`${label}: no agent_run with trigger=regenerate for v${nextVersion}`);
        else {
          const replay = await readReplay(token, targetRun.id);
          if (!replay.ok && replay.status) issues.push(`${label}: replay endpoint returned ${replay.status}`);
          else if (replay.artifact_version !== nextVersion) {
            issues.push(`${label}: replay artifact_version ${replay.artifact_version} (expected ${nextVersion})`);
          }
        }
      }

      results.push({
        phase: 'v1-source', i,
        verdict: issues.length === 0 ? 'SUCCESS' : 'FAIL',
        detail: issues.length === 0 ? `v${nextVersion} delivered, parent=v1` : issues.join(' · '),
        ms: Date.now() - started,
      });
      nextVersion++;
      await new Promise(r => setTimeout(r, COOLDOWN_MS));
    }
  } finally {
    await deleteUser(user.id);
  }
  return results;
}

// ─── Phase 2 · v2-source reruns (mid-chain) ─────────────────────────────
async function phase2V2Source() {
  console.log('\n── Phase 2 · build chain then 5 reruns on v2 (mid-chain) ──');
  const results = [];
  const { user, token, v1 } = await setupUser('p2');
  console.log(`user ${user.id.slice(0,8)} · v1 id ${v1.id.slice(0,8)}`);

  try {
    // Chain setup · rerun v1 → v2, then rerun v2 → v3 (linear)
    let r = await postRerun(token, v1.id, 'current');
    if (r.status !== 202 && r.status !== 200) throw new Error(`chain setup rerun v1 failed: ${r.status}`);
    const v2 = await waitForVersion(user.id, TARGET_SLUG, 2);
    if (!v2 || v2.parent_artifact_id !== v1.id) throw new Error('chain setup: v2 not delivered with parent=v1');
    console.log(`chain · v2 id ${v2.id.slice(0,8)} parent=v1`);

    await new Promise(r => setTimeout(r, COOLDOWN_MS));
    r = await postRerun(token, v2.id, 'current');
    if (r.status !== 202 && r.status !== 200) throw new Error(`chain setup rerun v2 failed: ${r.status}`);
    const v3 = await waitForVersion(user.id, TARGET_SLUG, 3);
    if (!v3 || v3.parent_artifact_id !== v2.id) throw new Error('chain setup: v3 not delivered with parent=v2');
    console.log(`chain · v3 id ${v3.id.slice(0,8)} parent=v2 (linear)`);

    // Now v2 is mid-chain. 5 reruns on v2 produce v4, v5, v6, v7, v8, all
    // siblings with parent=v2 (branched semantics per adjudication #4).
    let nextVersion = 4;
    for (let i = 1; i <= 5; i++) {
      const label = `v2-source run ${i}`;
      const started = Date.now();
      await new Promise(r => setTimeout(r, COOLDOWN_MS));
      const rerunRes = await postRerun(token, v2.id, 'current');
      if (rerunRes.status !== 202 && rerunRes.status !== 200) {
        results.push({ phase: 'v2-source', i, verdict: 'rerun-failed', detail: `${rerunRes.status} ${JSON.stringify(rerunRes.body)}`, ms: Date.now() - started });
        continue;
      }
      const newArt = await waitForVersion(user.id, TARGET_SLUG, nextVersion);
      // Critical · v(nextVersion).parent_artifact_id MUST be v2.id, not v3.id
      // or any later sibling. Branched semantics.
      const issues = verifyArtifact(newArt, { expectedVersion: nextVersion, expectedParentId: v2.id, label });

      if (newArt) {
        const runs = await readAgentRunsForUser(user.id);
        const targetRun = runs.find(r => r.artifact_id === newArt.id && r.trigger === 'regenerate');
        if (!targetRun) issues.push(`${label}: no agent_run with trigger=regenerate for v${nextVersion}`);
        else {
          const replay = await readReplay(token, targetRun.id);
          if (replay.artifact_version !== nextVersion) {
            issues.push(`${label}: replay artifact_version ${replay.artifact_version} (expected ${nextVersion} NOT v3=${v3.version})`);
          }
        }
      }

      results.push({
        phase: 'v2-source', i,
        verdict: issues.length === 0 ? 'SUCCESS' : 'FAIL',
        detail: issues.length === 0 ? `v${nextVersion} delivered, parent=v2 (sibling to v${v3.version})` : issues.join(' · '),
        ms: Date.now() - started,
      });
      nextVersion++;
    }
  } finally {
    await deleteUser(user.id);
  }
  return results;
}

(async () => {
  console.log(`rerun-conformance · 10 runs against ${BASE}`);
  console.log('Phase 1 · 5 reruns on v1 (root)');
  console.log('Phase 2 · build chain + 5 reruns on v2 (mid-chain)');

  let p1 = [], p2 = [];
  try { p1 = await phase1V1Source(); }
  catch (e) { console.error('Phase 1 threw:', e?.message); }

  try { p2 = await phase2V2Source(); }
  catch (e) { console.error('Phase 2 threw:', e?.message); }

  const results = [...p1, ...p2];
  console.log('\n── Summary ─────────────────────────────────────────');
  for (const r of results) {
    const label = r.verdict.padEnd(15);
    console.log(`  ${r.phase.padEnd(10)} run ${String(r.i).padStart(2,'0')} · ${label} ${r.detail}`);
  }
  const success = results.filter(r => r.verdict === 'SUCCESS').length;
  const total = results.length;
  console.log(`\n${success === 10 && total === 10 ? 'PASS · 10/10' : `FAIL · ${success}/${total}`}`);

  fs.writeFileSync('tests/chapter-02/rerun-conformance.last-run.json',
    JSON.stringify({ base: BASE, results, success, total, passed: success === 10 && total === 10 }, null, 2));
  if (!(success === 10 && total === 10)) process.exitCode = 1;
})();
