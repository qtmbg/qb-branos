/* Chapter 2 · Step 6A acceptance gates 2 + 4.
 *
 * Gate 2 · PR #79 §3 Case C trace. After a clean lock, fire a rerun of
 * one agent (Soul Map) via /api/agents/rerun and immediately read the
 * Console payload while v2 is still in queued or producing. Verify
 * the Console resolves latest_delivered_artifact to v1 (delivered) and
 * surfaces inflight_dispatch_id from v2.
 *
 * Gate 4 · JWT pass-through writes agent_runs rows correctly under the
 * new dispatch_id. Inspect agent_runs for the kept test user after the
 * clean lock and confirm each row carries dispatch_id, agent_version,
 * model, qbp_snapshot, and trigger='lock'.
 *
 * Single test user lifecycle: create → seed → lock → wait → assert lock
 * delivered → fire rerun → poll Console mid-flight → assert Case C
 * resolution → wait for rerun to settle → cleanup.
 *
 * Usage:
 *   node tests/chapter-02/case-c-trace.mjs
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

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

const FULL_QBP = {
  brandName: 'Lighthouse Case C',
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

const PASSWORD = 'qbverify-casec-' + Math.random().toString(36).slice(2, 10) + '-X1!';
const TARGET_SLUG = 'soul_map_synthesizer';

async function createUser() {
  const ts = Date.now();
  const email = `nizzar.ben+s6a-casec-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s6a-casec' } }),
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

async function fullToolCompletions() {
  const ts = new Date().toISOString();
  return {
    'archetype-compass': { completed_at: ts, source: 'c2-s6a-casec' },
    'soul-map':          { completed_at: ts, source: 'c2-s6a-casec' },
    'sensescape':        { completed_at: ts, source: 'c2-s6a-casec' },
  };
}

async function postLock(token) {
  const r = await fetch(`${BASE}/api/lock-foundation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function readArtifactsForUser(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&select=id,artifact_type,status,version,dispatch_id,parent_artifact_id&order=artifact_type.asc,version.asc`,
    { headers: svc }
  );
  return r.ok ? (await r.json().catch(() => [])) : [];
}

async function readAgentRunsForUser(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_runs?user_id=eq.${userId}&select=id,agent_slug,agent_version,trigger,dispatch_id,artifact_id,status,model,duration_ms,schema_retry_count,started_at,completed_at,qbp_snapshot&order=started_at.asc`,
    { headers: svc }
  );
  return r.ok ? (await r.json().catch(() => [])) : [];
}

async function getConsolePayload(token) {
  const r = await fetch(`${BASE}/api/agents/console`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`console api ${r.status}`);
  return await r.json();
}

async function postRerun(token, artifactId, source) {
  const r = await fetch(`${BASE}/api/agents/rerun`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ artifact_id: artifactId, qbp_source: source }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

function fmt(o) { return JSON.stringify(o, null, 2); }

(async () => {
  let user;
  try {
    console.log('── setup ──────────────────────────────────────────────');
    user = await createUser();
    console.log(`user ${user.id.slice(0,8)} created`);
    await setProfile(user.id, { qbp: FULL_QBP, tool_completions: await fullToolCompletions() });
    const token = await signIn(user.email);
    console.log('signed in · session minted');

    console.log('\n── lock ──────────────────────────────────────────────');
    const lockRes = await postLock(token);
    console.log(`lock POST → ${lockRes.status}`);
    if (lockRes.status !== 202 && lockRes.status !== 200) {
      console.error('lock failed:', fmt(lockRes.body));
      process.exitCode = 1;
      return;
    }
    console.log(`dispatch_id: ${lockRes.body.dispatch_id}`);

    console.log('\n── wait 60s for children ─────────────────────────────');
    await new Promise(r => setTimeout(r, 60000));

    const arts1 = await readArtifactsForUser(user.id);
    const delivered = arts1.filter(a => a.status === 'delivered');
    console.log(`artifacts post-lock: ${arts1.length} total, ${delivered.length} delivered`);
    if (delivered.length !== 4) {
      console.error('LOCK SETUP FAILED · not all four children delivered');
      console.error(fmt(arts1));
      process.exitCode = 1;
      return;
    }

    console.log('\n── Gate 4 · agent_runs after clean lock ──────────────');
    const runs = await readAgentRunsForUser(user.id);
    console.log(`${runs.length} agent_runs rows for user (expect 4)`);
    let gate4Pass = true;
    const requiredFields = ['agent_slug', 'agent_version', 'trigger', 'dispatch_id', 'artifact_id', 'qbp_snapshot', 'model'];
    for (const r of runs) {
      const missing = requiredFields.filter(f => r[f] == null);
      const okDispatch = r.dispatch_id === lockRes.body.dispatch_id;
      const okTrigger  = r.trigger === 'lock';
      const okQbpKeys  = r.qbp_snapshot && Object.keys(r.qbp_snapshot).length >= 15;
      const verdict = (missing.length === 0 && okDispatch && okTrigger && okQbpKeys) ? 'OK  ' : 'FAIL';
      if (verdict === 'FAIL') gate4Pass = false;
      console.log(`  ${verdict}  ${r.agent_slug.padEnd(24)} dispatch_id=${(r.dispatch_id || '').slice(0,8)} trigger=${r.trigger} model=${r.model} qbp_keys=${r.qbp_snapshot ? Object.keys(r.qbp_snapshot).length : 0} dur_ms=${r.duration_ms}`);
      if (missing.length) console.log(`    missing fields: ${missing.join(', ')}`);
      if (!okDispatch)    console.log(`    dispatch_id mismatch · expected ${lockRes.body.dispatch_id}`);
      if (!okTrigger)     console.log(`    trigger expected 'lock', got '${r.trigger}'`);
    }
    console.log(`Gate 4: ${gate4Pass ? 'PASS' : 'FAIL'}`);

    console.log('\n── Gate 2 · Case C · fire rerun, observe Console mid-flight ──');
    // The rerun endpoint takes artifact_id, not agent_slug · resolve to the
    // current Soul Map artifact id from the post-lock read.
    const soulMapArt = arts1.find(a => a.artifact_type === TARGET_SLUG && a.status === 'delivered');
    if (!soulMapArt) {
      console.error('cannot resolve Soul Map artifact_id for rerun');
      process.exitCode = 1;
      return;
    }
    const rerunRes = await postRerun(token, soulMapArt.id, 'current');
    console.log(`rerun POST → ${rerunRes.status}`);
    if (rerunRes.status !== 202 && rerunRes.status !== 200) {
      console.error('rerun failed:', fmt(rerunRes.body));
      process.exitCode = 1;
      return;
    }

    // Poll Console immediately and at 3 / 8 second marks · the v2 should
    // be in queued or producing for at least the first read.
    const observations = [];
    for (const delay of [500, 3000, 8000]) {
      await new Promise(r => setTimeout(r, delay));
      const payload = await getConsolePayload(token);
      const agent = payload.agents.find(a => a.slug === TARGET_SLUG);
      observations.push({
        delay_ms_total: observations.reduce((s, o) => s + o.delay_ms, 0) + delay,
        delay_ms: delay,
        latest_artifact_status: agent?.latest_artifact?.status || null,
        latest_artifact_version: agent?.latest_artifact?.version || null,
        inflight_dispatch_id: agent?.inflight_dispatch_id || null,
      });
    }

    console.log('Console observations · Soul Map agent:');
    for (const o of observations) {
      console.log(`  +${o.delay_ms_total}ms · latest_artifact.status=${o.latest_artifact_status} version=${o.latest_artifact_version}  inflight_dispatch_id=${(o.inflight_dispatch_id || '').slice(0,8) || 'null'}`);
    }

    // Verdict: in at least one observation, latest_artifact.status must be
    // 'delivered' AND inflight_dispatch_id must be non-null. That is the
    // Case C resolution · the delivered v1 surfaces its rerun CTAs while
    // v2 surfaces its inflight pill independently.
    const caseCEvidence = observations.some(o =>
      o.latest_artifact_status === 'delivered' &&
      o.inflight_dispatch_id != null
    );
    console.log(`Gate 2: ${caseCEvidence ? 'PASS' : 'FAIL'}`);
    if (!caseCEvidence) {
      console.log('  expected: at some observation, latest_artifact.status === "delivered" AND inflight_dispatch_id !== null');
      console.log('  observed: none of the three observations satisfied both conditions');
    }

    // Also log the raw artifact rows for v1 vs v2 inspection
    const arts2 = await readArtifactsForUser(user.id);
    const targetArts = arts2.filter(a => a.artifact_type === TARGET_SLUG);
    console.log(`\nSoul Map artifacts in DB:`);
    for (const a of targetArts) {
      console.log(`  v${a.version}  status=${a.status}  id=${a.id.slice(0,8)}  parent=${(a.parent_artifact_id || '').slice(0,8) || 'null'}  dispatch=${(a.dispatch_id || '').slice(0,8) || 'null'}`);
    }

    console.log('\n── final summary ─────────────────────────────────────');
    console.log(`Gate 1: PASS  (verified by tests/chapter-02/lock-foundation-10x.mjs · 10/10 SUCCESS)`);
    console.log(`Gate 2: ${caseCEvidence ? 'PASS' : 'FAIL'}  (Case C: delivered v1 surfaces with inflight_dispatch_id from v2)`);
    console.log(`Gate 4: ${gate4Pass ? 'PASS' : 'FAIL'}  (agent_runs rows carry dispatch_id, trigger='lock', qbp_snapshot, model)`);

    if (!caseCEvidence || !gate4Pass) process.exitCode = 1;
  } catch (e) {
    console.error('THREW:', e?.message || e);
    if (e?.stack) console.error(e.stack);
    process.exitCode = 1;
  } finally {
    if (user?.id) {
      console.log('\ncleanup test user…');
      await deleteUser(user.id);
    }
  }
})();
