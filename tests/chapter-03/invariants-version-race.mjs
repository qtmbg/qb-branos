/* Chapter 3 · Step 1C · Invariant assertion harness · version race
 *
 * INVARIANT (combined · app + DB):
 *   No two artifacts rows share (user_id, artifact_type, version) under
 *   concurrent reruns. The cure has two layers: application max(version)+1
 *   (in place at api/agents/rerun.js) AND a DB unique constraint on
 *   artifacts(user_id, artifact_type, version) (NOT YET LANDED · forward-
 *   referenced by chapter-03/step-1-hardening-report.md §3.3 + §8).
 *
 * Origin: docs/patterns/race-discipline.md §1 · PR #100 class-race.
 *
 * EXPECTED-RED STATE (read before interpreting last-run.json):
 *   Empirical first run on 2026-05-21 against live production:
 *     - 8 concurrent reruns all returned 202 (app accepted all)
 *     - Resulting artifact_versions: [5, 5, 5, 4, 3, 3, 3, 2, 1]
 *     - Three v5 rows · two v3 rows · the race exists
 *     - duplicate_tuples on (artifact_id, agent_version) was [] · this is
 *       because each rerun creates a new artifact_id (the artifact-level
 *       version race is the actual gap, not the agent_runs-level one)
 *   This harness goes RED today AS DESIGNED · the cure pattern is not
 *   complete until the DB constraint lands. When step 2 (or step 2-bis)
 *   adds the partial unique index on artifacts(user_id, artifact_type,
 *   version), this harness flips to GREEN. Re-fire it as the GO-criterion
 *   for that step.
 *
 * Reproducer shape (smallest):
 *   1. Create a fresh test user, complete Phase 01.
 *   2. Lock the foundation (v1 fan-out).
 *   3. Once v1 soul_map_synthesizer is delivered, spawn N=8 concurrent
 *      rerun calls against it via /api/agents/rerun.
 *   4. Wait for all reruns to settle (terminal status on agent_runs).
 *   5. Post-conditions:
 *      A. agent_runs: no two rows share (artifact_id, agent_version)
 *         · this passes today (each rerun gets a new artifact_id).
 *      B. artifacts: no two rows share (user_id, artifact_type, version)
 *         · this FAILS today and is the forward-referenced cure.
 *      C. All rerun responses are documented (202, 409, 400, 401).
 *      D. The harness reports both sub-invariants separately so the
 *         step-2 cleanup can ship and re-fire for green.
 *
 * PASS (combined):
 *   - All N reruns return a documented outcome (202 / 409 / 400 / 401).
 *   - Sub-invariant A: zero (artifact_id, agent_version) duplicates.
 *   - Sub-invariant B: zero (user_id, artifact_type, version) duplicates.
 *
 * FAIL surface (goes red until the DB constraint lands):
 *   - Sub-invariant B failure is expected RED until step 2 ships.
 *   - Sub-invariant A or C failure would be a NEW race shape · STOP-and-
 *     surface before the cleanup step.
 *
 * Usage:
 *   node tests/chapter-03/invariants-version-race.mjs
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
const CONCURRENT_REGENERATES = parseInt(process.env.CONCURRENT || '8', 10);
const SETTLE_BUDGET_MS = 90_000;

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const PASSWORD = 'qbinv-vr-' + Math.random().toString(36).slice(2, 10) + '-X1!';

const FULL_QBP = {
  brandName: 'Race Test',
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
};

async function createUser() {
  const ts = Date.now();
  const email = `nizzar.ben+inv-vr-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      email, email_confirm: true, password: PASSWORD,
      user_metadata: { signup_source: 'c3-s1c-version-race' },
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`createUser failed: ${r.status} ${body.slice(0, 200)}`);
  }
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
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`signIn failed: ${r.status} ${body.slice(0, 200)}`);
  }
  const d = await r.json();
  if (!d.access_token) throw new Error('sign-in failed: ' + JSON.stringify(d));
  return d.access_token;
}

async function setProfile(userId, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`setProfile failed: ${r.status} ${body.slice(0, 200)}`);
  }
}

async function lockFoundation(token) {
  const r = await fetch(`${BASE}/api/lock-foundation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!r.ok && r.status !== 202) {
    const body = await r.text().catch(() => '');
    throw new Error(`lock-foundation failed: ${r.status} ${body.slice(0, 200)}`);
  }
  return r.json();
}

async function waitForArtifactDelivered(userId, slug, budgetMs = 60_000) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/artifacts` +
      `?user_id=eq.${userId}&artifact_type=eq.${slug}&status=eq.delivered` +
      `&select=id,version&order=version.desc&limit=1`,
      { headers: svc }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows?.[0]) return rows[0];
    }
    await new Promise(res => setTimeout(res, 2_000));
  }
  throw new Error(`Timed out waiting for ${slug} delivered`);
}

async function regenerate(token, artifactId) {
  // Canonical rerun endpoint per api/agents/rerun.js. The
  // `/api/artifacts/[id]/regenerate` path documented in spec text is the
  // pre-§5.3 legacy name; the current production endpoint is
  // /api/agents/rerun with { artifact_id, qbp_source } in the body.
  const r = await fetch(`${BASE}/api/agents/rerun`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ artifact_id: artifactId, qbp_source: 'current' }),
  });
  const body = await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, body: body.slice(0, 500) };
}

async function readAgentRuns(userId, artifactType) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_runs` +
    `?user_id=eq.${userId}&agent_slug=eq.${artifactType}` +
    `&select=id,artifact_id,agent_version,status,started_at,completed_at` +
    `&order=started_at.desc&limit=200`,
    { headers: svc }
  );
  if (!r.ok) throw new Error(`readAgentRuns failed: ${r.status}`);
  return r.json();
}

async function readArtifacts(userId, artifactType) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${userId}&artifact_type=eq.${artifactType}` +
    `&select=id,version,status` +
    `&order=version.desc&limit=200`,
    { headers: svc }
  );
  if (!r.ok) throw new Error(`readArtifacts failed: ${r.status}`);
  return r.json();
}

async function waitAllSettled(userId, artifactType, expectedNew, budgetMs) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const runs = await readAgentRuns(userId, artifactType);
    const terminal = runs.filter(r => r.status === 'succeeded' || r.status === 'failed');
    if (terminal.length >= expectedNew + 1) return runs; // +1 for lock-time v1
    await new Promise(res => setTimeout(res, 2_000));
  }
  return readAgentRuns(userId, artifactType);
}

async function deleteUser(userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function main() {
  const startedAt = new Date().toISOString();
  let user, token, result;
  const log = [];

  try {
    log.push('[1/6] Create user');
    user = await createUser();
    log.push(`  user_id=${user.id}`);

    log.push('[2/6] Sign in + set Phase 01 complete + full QBP');
    token = await signIn(user.email);
    await setProfile(user.id, {
      tool_completions: { 'archetype-compass': true, 'soul-map': true, 'sensescape': true },
      qbp: FULL_QBP,
    });

    log.push('[3/6] Lock foundation');
    const lock = await lockFoundation(token);
    log.push(`  dispatch_id=${lock?.dispatch_id}`);

    log.push('[4/6] Wait for v1 soul_map_synthesizer delivered');
    const v1 = await waitForArtifactDelivered(user.id, 'soul_map_synthesizer', 75_000);
    log.push(`  v1.artifact_id=${v1.id} version=${v1.version}`);

    log.push(`[5/6] Spawn ${CONCURRENT_REGENERATES} concurrent regenerates against v1`);
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REGENERATES }, () => regenerate(token, v1.id))
    );
    log.push(`  responses: ${responses.map(r => r.status).join(', ')}`);

    log.push('[6/6] Wait for all to settle, then assert invariant');
    const runs = await waitAllSettled(user.id, 'soul_map_synthesizer', CONCURRENT_REGENERATES, SETTLE_BUDGET_MS);
    const artifacts = await readArtifacts(user.id, 'soul_map_synthesizer');

    // Sub-invariant A: no two agent_runs share (artifact_id, agent_version)
    // among succeeded rows. PASSES today (each rerun creates a new
    // artifact_id; the race is at the artifacts-table level, not here).
    const seen = new Map();
    const agentRunsDuplicates = [];
    for (const r of runs) {
      if (r.status !== 'succeeded') continue;
      const uniq = `${r.artifact_id}|${r.agent_version}`;
      if (seen.has(uniq)) {
        agentRunsDuplicates.push({ uniq, existing: seen.get(uniq), this: r.id });
      } else {
        seen.set(uniq, r.id);
      }
    }

    // Sub-invariant B: no two artifacts share (user_id, artifact_type, version).
    // FAILS today · forward-referenced cure (step 2 or step 2-bis adds the
    // DB unique constraint). Re-fire this harness post-cleanup for green.
    const versions = artifacts.map(a => a.version);
    const versionCounts = versions.reduce((acc, v) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});
    const artifactsTableDuplicates = Object.entries(versionCounts)
      .filter(([, count]) => count > 1)
      .map(([version, count]) => ({ version: Number(version), count }));

    // Sub-invariant C: every rerun response is documented (no 500s, no
    // network errors). 2xx, 202, 409, 400, 401 are all documented.
    const undocumented = responses.filter(r => {
      if (r.ok) return false;
      if (r.status === 409) return false;
      if (r.status === 400) return false;
      if (r.status === 401) return false;
      return true;
    });

    const subInvariantA_pass = agentRunsDuplicates.length === 0;
    const subInvariantB_pass = artifactsTableDuplicates.length === 0;
    const subInvariantC_pass = undocumented.length === 0;
    const combinedPass = subInvariantA_pass && subInvariantB_pass && subInvariantC_pass;

    result = {
      // Combined pass is RED today until step 2 / step 2-bis ships the
      // DB constraint. Sub-invariant breakdown below clarifies why.
      pass: combinedPass,
      expected_red_until: 'step 2 lands the DB unique constraint on artifacts(user_id, artifact_type, version)',
      sub_invariants: {
        A_agent_runs_uniqueness: { pass: subInvariantA_pass, duplicates: agentRunsDuplicates },
        B_artifacts_uniqueness:  { pass: subInvariantB_pass, duplicates: artifactsTableDuplicates },
        C_documented_responses:  { pass: subInvariantC_pass, undocumented },
      },
      invariant: 'No two artifacts rows share (user_id, artifact_type, version) under concurrent reruns',
      concurrent_regenerates: CONCURRENT_REGENERATES,
      responses_summary: {
        ok: responses.filter(r => r.ok).length,
        status_409: responses.filter(r => r.status === 409).length,
        status_other: responses.filter(r => !r.ok && r.status !== 409).length,
      },
      agent_runs_total: runs.length,
      agent_runs_succeeded: runs.filter(r => r.status === 'succeeded').length,
      agent_runs_failed: runs.filter(r => r.status === 'failed').length,
      artifacts_total: artifacts.length,
      artifact_versions: versions,
    };
  } catch (e) {
    result = {
      pass: false,
      invariant: 'No two agent_runs rows share (artifact_id, agent_version) for succeeded status',
      error: String(e?.message || e),
    };
  } finally {
    if (user?.id) await deleteUser(user.id);
  }

  const out = {
    harness: 'invariants-version-race',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    base_url: BASE,
    ...result,
    log,
  };
  fs.writeFileSync('tests/chapter-03/invariants-version-race.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
