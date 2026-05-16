/* Chapter 2 · Step 4 · Move A · production smoke test on Haiku Sensescape.
 *
 * Single live dispatch via the production /api/agents/dispatch endpoint
 * against a fresh test user with a populated Sensescape QBP. Validates
 * that the retrofitted /agents/sensescape.js (Haiku 4.5, Pass 2 prompt)
 * deployed cleanly to production and matches the local harness baseline.
 *
 * Captures:
 *   - HTTP status + wall latency end-to-end
 *   - artifacts row (status, schema validity via js/qb-artifact-schema.js)
 *   - agent_runs row (tokens_in, tokens_out, duration_ms, model)
 *   - schema_retry_count (deferred to step 4 runtime; not present on
 *     dispatch.js path)
 *
 * Cleans up the test user after the run.
 *
 * Usage:  node tests/chapter-02/smoke-haiku-sensescape.mjs
 */

import fs from 'node:fs';
import { validateArtifact } from '../../js/qb-artifact-schema.js';

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE         = process.env.BASE || 'https://quantumbranding.ai';

const svc = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
};

const SENSESCAPE_QBP = {
  brandName: 'Lighthouse',
  colorTerritory: 'Cold seafoam green, oxidized brass, soft ivory, deep ink.',
  forbiddenColor: 'No saturated reds. No hot pinks.',
  visualTerritoryNote: 'Editorial weight. Generous margins.',
  typographyNote: 'Serif with weight for headlines. Workhorse sans for body.',
  antiVoice: 'No exclamation points. No hype.',
  brandObject: 'A brass weather instrument on a teak desk.',
  brandMoment: 'The moment a founder closes their laptop at 11pm and realizes they understand their own brand.',
  signatureGesture: 'A slow nod. A deliberate pause before answering.',
  soundSignature: 'A low piano chord held for four seconds.',
  sensescapeRawAnswers: 'Object: brass weather station. Place: a small library off a quiet street.',
};

async function createTestUser() {
  const ts = Date.now();
  const email = `nizzar.ben+c2smoke-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { signup_source: 'c2-smoke-haiku' } }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function getServiceJwt(userId) {
  // Mint a magic link for the test user, extract the access token from
  // the URL · cheapest way to get a real JWT without going through email.
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ type: 'magiclink', email: undefined, user_id: userId }),
  });
  // Fallback: many Supabase versions reject user_id; use email path.
  if (!r.ok) {
    // Look up the user to get email
    const u = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: svc });
    const ud = await u.json();
    const r2 = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({ type: 'magiclink', email: ud.email }),
    });
    const d2 = await r2.json();
    return d2?.properties?.action_link || null;
  }
  const d = await r.json();
  return d?.properties?.action_link || null;
}

async function setQbp(userId, qbp) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify({ qbp }),
  });
}

async function deleteUser(userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function pollArtifact(userId, timeoutMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&artifact_type=eq.sensescape_synthesizer` +
      `&select=id,status,content,error,version&order=created_at.desc&limit=1`,
      { headers: svc }
    );
    const rows = r.ok ? await r.json().catch(() => []) : [];
    if (rows.length > 0 && (rows[0].status === 'delivered' || rows[0].status === 'failed')) {
      return rows[0];
    }
    await new Promise(rs => setTimeout(rs, 1500));
  }
  return null;
}

async function readAgentRun(artifactId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_runs` +
    `?artifact_id=eq.${encodeURIComponent(artifactId)}` +
    `&select=id,status,duration_ms,tokens_in,tokens_out,model,error&order=created_at.desc&limit=1`,
    { headers: svc }
  );
  const rows = r.ok ? await r.json().catch(() => []) : [];
  return rows?.[0] || null;
}

(async () => {
  console.log(`Move A · production smoke test on Haiku Sensescape`);
  console.log(`Base: ${BASE}`);
  console.log('');

  const user = await createTestUser();
  console.log(`Test user: ${user.id.slice(0, 8)}... (${user.email})`);

  await setQbp(user.id, SENSESCAPE_QBP);
  console.log(`QBP populated with happy-path Sensescape fixture.`);

  // The production /api/agents/dispatch path expects a Supabase JWT.
  // For this smoke we call it with the service key as the JWT · the
  // production handler verifies JWT through Supabase, and admin tokens
  // resolve to a service principal. If this rejects, fall back to a
  // direct insertion of the artifact + run rows to skip the auth path.
  //
  // Actually, dispatch.js calls /auth/v1/user with the bearer · service
  // role keys don't resolve there. We need a real user JWT. Easiest path:
  // create an access token via admin "session" issuance.
  let accessToken = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}/sessions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({}),
    });
    if (r.ok) {
      const d = await r.json();
      accessToken = d?.access_token || null;
    }
  } catch {}

  if (!accessToken) {
    // Fallback: insert artifact + run directly, then invoke the agent
    // module to test the SAME retrofitted code path that production uses.
    // This isn't a true end-to-end dispatch.js smoke; it's an
    // implementation-equivalent smoke. Documenting the gap.
    console.log(`(Could not mint admin session; falling back to direct agent module test.)`);
  }

  const t0 = Date.now();
  let dispatchResult = null;
  if (accessToken) {
    const dispatchRes = await fetch(`${BASE}/api/agents/dispatch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        qbp: SENSESCAPE_QBP,
        agentName: 'sensescape_synthesizer',
      }),
    });
    dispatchResult = {
      status: dispatchRes.status,
      body: await dispatchRes.json().catch(() => null),
      elapsedMs: Date.now() - t0,
    };
    console.log(`Dispatch · HTTP ${dispatchResult.status} in ${dispatchResult.elapsedMs}ms`);
  } else {
    console.log(`Skipped HTTP dispatch · using direct module call.`);
    // Direct call to the retrofitted agent · same module production uses.
    const { run } = await import('../../agents/sensescape.js');
    const directResult = await run({
      qbp: SENSESCAPE_QBP, dependencies: {}, files: [], runtime_args: {},
      anthropicKey: env.ANTHROPIC_API_KEY,
    });
    const elapsed = Date.now() - t0;
    dispatchResult = {
      status: directResult?.ok ? 200 : 500,
      body: directResult,
      elapsedMs: elapsed,
      direct: true,
    };
    console.log(`Direct module call · ${directResult?.ok ? 'OK' : 'FAIL'} in ${elapsed}ms`);

    // Validate schema directly.
    if (directResult?.ok) {
      const v = validateArtifact(directResult.content);
      console.log(`Schema validation: ${v.valid ? 'PASS' : 'FAIL'}`);
      if (!v.valid) console.log(`  errors: ${JSON.stringify(v.errors).slice(0, 300)}`);
      console.log(`Model: ${directResult.meta?.model}`);
      console.log(`Tokens in: ${directResult.meta?.tokens_in}`);
      console.log(`Tokens out: ${directResult.meta?.tokens_out}`);
      console.log(`Duration: ${directResult.meta?.duration_ms}ms`);
    } else {
      console.log(`Error: ${directResult?.error} stage=${directResult?.stage}`);
    }

    await deleteUser(user.id);
    return;
  }

  // Wait for artifact + agent_runs to land.
  const artifact = await pollArtifact(user.id);
  if (!artifact) {
    console.log(`FAIL · no artifact within poll window`);
    await deleteUser(user.id);
    return;
  }

  const run = await readAgentRun(artifact.id);
  console.log('');
  console.log(`Artifact: ${artifact.id}`);
  console.log(`Status:   ${artifact.status}`);
  if (artifact.status === 'delivered') {
    const v = validateArtifact(artifact.content);
    console.log(`Schema:   ${v.valid ? 'PASS' : `FAIL · ${JSON.stringify(v.errors).slice(0, 200)}`}`);
  } else {
    console.log(`Error:    ${artifact.error || '<none>'}`);
  }
  if (run) {
    console.log(`Run model: ${run.model || '<none>'}`);
    console.log(`Run dur:   ${run.duration_ms}ms`);
    console.log(`Tokens:    ${run.tokens_in} in + ${run.tokens_out} out`);
  }

  await deleteUser(user.id);
})().catch(e => { console.error(e); process.exit(1); });
