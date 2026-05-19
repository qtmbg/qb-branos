/* Chapter 2 · Step 7B acceptance gate.
 *
 * Verifies the feedback runtime arg plumbing:
 *   1. POST /api/agents/rerun with { artifact_id, qbp_source: 'current',
 *      feedback: '<string>' } · agent_runs.runtime_args.feedback ===
 *      the supplied string.
 *   2. POST without feedback · agent_runs.runtime_args.feedback is absent.
 *   3. No regression on 7A rerun path · the rerun returns 202 in both
 *      shapes.
 *
 * Per chapter-02/step-7-spec.md §4.3 acceptance.
 *
 * Inherits PR #90 harness hardening · fetch timeouts + cooldown.
 *
 * Usage:
 *   node tests/chapter-02/rerun-feedback-arg.mjs
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
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

const PASSWORD = 'qbverify-7b-' + Math.random().toString(36).slice(2, 10) + '-X1!';
const TARGET_SLUG = 'soul_map_synthesizer';
const FEEDBACK_STRING = 'Add more vibrant detail to the imagery. Tighten the manifesto. Step 7B verification marker.';

const FULL_QBP = {
  brandName: 'Lighthouse Feedback',
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

async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts?.timeoutMs || FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s7b-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s7b' } }),
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
    'archetype-compass': { completed_at: ts, source: 'c2-s7b' },
    'soul-map':          { completed_at: ts, source: 'c2-s7b' },
    'sensescape':        { completed_at: ts, source: 'c2-s7b' },
  };
}

async function postLock(token) {
  const r = await tfetch(`${BASE}/api/lock-foundation`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}',
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function postRerun(token, artifactId, qbpSource, feedback) {
  const body = { artifact_id: artifactId, qbp_source: qbpSource };
  if (feedback !== undefined) body.feedback = feedback;
  const r = await tfetch(`${BASE}/api/agents/rerun`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function readArtifactsForUser(userId, slug) {
  const r = await tfetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&artifact_type=eq.${slug}&select=id,version,status&order=version.asc`,
    { headers: svc }
  );
  return r.ok ? await r.json().catch(() => []) : [];
}

async function readAgentRunsForUser(userId) {
  const r = await tfetch(
    `${SUPABASE_URL}/rest/v1/agent_runs?user_id=eq.${userId}&select=id,trigger,artifact_id,runtime_args&order=started_at.asc`,
    { headers: svc }
  );
  return r.ok ? await r.json().catch(() => []) : [];
}

async function waitForVersion(userId, slug, version, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const arts = await readArtifactsForUser(userId, slug);
    const target = arts.find(a => a.version === version && a.status === 'delivered');
    if (target) return target;
    await new Promise(r => setTimeout(r, 3_000));
  }
  return null;
}

(async () => {
  console.log(`rerun-feedback-arg · two-shape verification against ${BASE}`);
  console.log('');

  let user;
  let withFeedbackPass = false;
  let withoutFeedbackPass = false;

  try {
    user = await createUser('feedback');
    await setProfile(user.id, { qbp: FULL_QBP, tool_completions: fullToolCompletions() });
    const token = await signIn(user.email);
    const lockRes = await postLock(token);
    if (lockRes.status !== 202 && lockRes.status !== 200) {
      throw new Error(`lock failed: ${lockRes.status}`);
    }
    await new Promise(r => setTimeout(r, 60_000));
    const v1 = await waitForVersion(user.id, TARGET_SLUG, 1, 5_000);
    if (!v1) throw new Error('v1 not delivered after lock');
    console.log(`user ${user.id.slice(0,8)} · v1 ${v1.id.slice(0,8)} delivered`);

    // ─── Shape 1 · rerun WITH feedback ──────────────────────────────────
    console.log('\n── Shape 1 · rerun WITH feedback ──');
    const r1 = await postRerun(token, v1.id, 'current', FEEDBACK_STRING);
    console.log(`  rerun POST → ${r1.status}`);
    if (r1.status === 202 || r1.status === 200) {
      const v2 = await waitForVersion(user.id, TARGET_SLUG, 2);
      if (v2) {
        const runs = await readAgentRunsForUser(user.id);
        const targetRun = runs.find(r => r.artifact_id === v2.id && r.trigger === 'regenerate');
        const observedFeedback = targetRun?.runtime_args?.feedback;
        const observedQbpSource = targetRun?.runtime_args?.qbp_source;
        console.log(`  runtime_args.feedback observed: ${JSON.stringify(observedFeedback)}`);
        console.log(`  runtime_args.qbp_source observed: ${JSON.stringify(observedQbpSource)}`);
        withFeedbackPass = observedFeedback === FEEDBACK_STRING && observedQbpSource === 'current';
      } else {
        console.log('  v2 not delivered');
      }
    }
    console.log(`  Shape 1: ${withFeedbackPass ? 'PASS' : 'FAIL'}`);

    // ─── Shape 2 · rerun WITHOUT feedback ───────────────────────────────
    console.log('\n── Shape 2 · rerun WITHOUT feedback ──');
    await new Promise(r => setTimeout(r, 5_000));
    const r2 = await postRerun(token, v1.id, 'current'); // no feedback arg
    console.log(`  rerun POST → ${r2.status}`);
    if (r2.status === 202 || r2.status === 200) {
      const v3 = await waitForVersion(user.id, TARGET_SLUG, 3);
      if (v3) {
        const runs = await readAgentRunsForUser(user.id);
        const targetRun = runs.find(r => r.artifact_id === v3.id && r.trigger === 'regenerate');
        const runtimeArgs = targetRun?.runtime_args || {};
        const hasFeedback = Object.prototype.hasOwnProperty.call(runtimeArgs, 'feedback');
        const observedQbpSource = runtimeArgs.qbp_source;
        console.log(`  runtime_args.feedback present: ${hasFeedback}`);
        console.log(`  runtime_args.qbp_source observed: ${JSON.stringify(observedQbpSource)}`);
        withoutFeedbackPass = !hasFeedback && observedQbpSource === 'current';
      } else {
        console.log('  v3 not delivered');
      }
    }
    console.log(`  Shape 2: ${withoutFeedbackPass ? 'PASS' : 'FAIL'}`);
  } catch (e) {
    console.error('THREW:', e?.message);
    process.exitCode = 1;
  } finally {
    if (user?.id) await deleteUser(user.id);
  }

  console.log('\n── Summary ─────────────────────────────────────');
  console.log(`  Shape 1 (with feedback): ${withFeedbackPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Shape 2 (without feedback): ${withoutFeedbackPass ? 'PASS' : 'FAIL'}`);
  const all = withFeedbackPass && withoutFeedbackPass;
  console.log(`\n${all ? 'PASS · 2/2 shapes verified' : 'FAIL'}`);
  if (!all) process.exitCode = 1;
})();
