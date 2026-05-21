/* Chapter 3 · Step 2B · repro gate 018-synthetic · synthetic-state diff harness
 *
 * Per chapter-03/step-2-spec.md §3 + §4 (Call 4 part 1).
 *
 * INVARIANT (post-migration):
 *   The renumber CTE in supabase/migrations/018_*.sql converts the
 *   [5,5,5,4,3,3,3,2,1] injected pattern into a unique-version set
 *   {1,2,3,4,5,6,7,8,9} where the earliest-by-(created_at,id) of each
 *   duplicate group keeps its original version, and later duplicates
 *   get re-versioned above the original max.
 *
 * Operates on a Supabase BRANCH (not production). The branch's URL and
 * service-role key arrive via env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * The harness aborts if SUPABASE_URL points at the prod hostname (defensive
 * gate).
 *
 * Two phases (run in sequence with the migration apply in between):
 *
 *   node tests/chapter-03/repro-gate-018-synthetic.mjs setup
 *     -> creates a synthetic test user, injects 9 rows matching the
 *        [5,5,5,4,3,3,3,2,1] pattern, writes /tmp/repro-018-synth-state.json
 *
 *   (operator/AI applies supabase/migrations/018_*.sql to the branch via MCP)
 *
 *   node tests/chapter-03/repro-gate-018-synthetic.mjs verify
 *     -> reads the state file, queries the synthetic user's artifact rows
 *        post-migration, asserts the version table matches the §2.2 trace,
 *        cleans up the synthetic user, writes
 *        tests/chapter-03/repro-gate-018-synthetic.last-run.json
 *
 * PASS: post-state versions = {1,2,3,4,5,6,7,8,9} (unique) AND the
 *       earliest-of-v3 and earliest-of-v5 rows retained their originals.
 *
 * FAIL: any deviation from the §2.2 expected table.
 */

import fs from 'node:fs';
import path from 'node:path';

const PHASE = process.argv[2] || 'setup';
const STATE_FILE = '/tmp/repro-018-synth-state.json';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required (branch credentials)');
  process.exit(2);
}

// Defensive: refuse to run against prod
if (/(?:^|\.)quantumbranding\.ai\b/i.test(SUPABASE_URL) || /\bproduction\b/i.test(SUPABASE_URL)) {
  console.error(`Refused: SUPABASE_URL appears to be production (${SUPABASE_URL}). Branch-only harness.`);
  process.exit(2);
}

const svc = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
};

const PASSWORD = 'qbinv-018-synth-' + Math.random().toString(36).slice(2, 10) + '-X1!';
const SLUG = 'soul_map_synthesizer';

async function createUser() {
  const ts = Date.now();
  const email = `nizzar.ben+s2-synth-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      email, email_confirm: true, password: PASSWORD,
      user_metadata: { signup_source: 'c3-s2-synthetic-gate' },
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`createUser failed: ${r.status} ${body.slice(0, 200)}`);
  }
  const d = await r.json();
  return { id: d.id, email };
}

async function ensureProfile(userId, email) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: userId, email }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`ensureProfile failed: ${r.status} ${body.slice(0, 200)}`);
  }
}

async function deleteUser(userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

// Inject the [5,5,5,4,3,3,3,2,1] pattern: 9 rows in created_at order with
// the version values shown below. The created_at offsets are 0ms..80ms in
// 10ms increments so they sort deterministically. The id tie-breaker is
// secondary; relying on created_at for the rank order.
const SYNTHETIC_PATTERN = [
  { slot: 'r1', version: 1, offset_ms:  0 },
  { slot: 'r2', version: 2, offset_ms: 10 },
  { slot: 'r3', version: 3, offset_ms: 20 },  // earliest v3 · keeps version
  { slot: 'r4', version: 3, offset_ms: 21 },  // renumbers to 6
  { slot: 'r5', version: 3, offset_ms: 22 },  // renumbers to 7
  { slot: 'r6', version: 4, offset_ms: 30 },
  { slot: 'r7', version: 5, offset_ms: 40 },  // earliest v5 · keeps version
  { slot: 'r8', version: 5, offset_ms: 41 },  // renumbers to 8
  { slot: 'r9', version: 5, offset_ms: 42 },  // renumbers to 9
];

async function injectSyntheticRows(userId) {
  // Insert 9 artifacts with deterministic created_at offsets. Use the
  // canonical wrapper from docs/patterns/schema-compliance.md.
  const base = Date.now();
  const rows = SYNTHETIC_PATTERN.map(p => ({
    user_id: userId,
    artifact_type: SLUG,
    status: 'delivered',
    content: { synthetic: true, slot: p.slot, version_intent: p.version },
    version: p.version,
    created_at: new Date(base + p.offset_ms).toISOString(),
    updated_at: new Date(base + p.offset_ms).toISOString(),
    phase: '01',
  }));

  const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST',
    headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`injectSyntheticRows failed: ${r.status} ${body.slice(0, 400)}`);
  }
  return r.json();
}

async function readArtifactsForUser(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/artifacts` +
    `?user_id=eq.${encodeURIComponent(userId)}&artifact_type=eq.${encodeURIComponent(SLUG)}` +
    `&select=id,version,created_at,content&order=created_at.asc`,
    { headers: svc }
  );
  if (!r.ok) throw new Error(`readArtifactsForUser failed: ${r.status}`);
  return r.json();
}

async function runSetup() {
  console.log('[synthetic] setup phase');
  const user = await createUser();
  await ensureProfile(user.id, user.email);
  const inserted = await injectSyntheticRows(user.id);

  // Sanity: confirm 9 rows landed
  const readBack = await readArtifactsForUser(user.id);
  if (readBack.length !== 9) {
    await deleteUser(user.id);
    throw new Error(`expected 9 inserted rows, saw ${readBack.length}`);
  }

  // Capture the inserted row IDs in created_at order so we can match
  // them in the verify phase. SYNTHETIC_PATTERN[i] corresponds to
  // readBack[i] because both are ordered by created_at ASC.
  const slotToId = {};
  for (let i = 0; i < SYNTHETIC_PATTERN.length; i++) {
    slotToId[SYNTHETIC_PATTERN[i].slot] = {
      id: readBack[i].id,
      original_version: readBack[i].version,
      created_at: readBack[i].created_at,
    };
  }

  const state = {
    phase: 'setup',
    setup_at: new Date().toISOString(),
    branch_url: SUPABASE_URL,
    user_id: user.id,
    user_email: user.email,
    synthetic_pattern: SYNTHETIC_PATTERN,
    slot_to_id: slotToId,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`[synthetic] state written to ${STATE_FILE}`);
  console.log(`[synthetic] 9 rows injected for user_id=${user.id}`);
  console.log(`[synthetic] NEXT: apply supabase/migrations/018_*.sql to the branch via MCP, then run with 'verify' phase`);
}

async function runVerify() {
  console.log('[synthetic] verify phase');
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(`State file missing: ${STATE_FILE}. Run 'setup' phase first.`);
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

  // Read post-migration state for the synthetic user's rows
  const postRows = await readArtifactsForUser(state.user_id);
  if (postRows.length !== 9) {
    throw new Error(`expected 9 rows post-migration, saw ${postRows.length}`);
  }

  // Build the actual post-state map: slot -> { original_version, post_version }
  const actualBySlot = {};
  for (const slot of Object.keys(state.slot_to_id)) {
    const id = state.slot_to_id[slot].id;
    const row = postRows.find(r => r.id === id);
    if (!row) {
      throw new Error(`slot ${slot} row id=${id} missing post-migration`);
    }
    actualBySlot[slot] = {
      id,
      original_version: state.slot_to_id[slot].original_version,
      post_version: row.version,
    };
  }

  // §2.2 expected post-state
  const EXPECTED = {
    r1: 1, r2: 2, r3: 3, r4: 6, r5: 7,
    r6: 4, r7: 5, r8: 8, r9: 9,
  };

  const traceTable = [];
  let allMatch = true;
  for (const slot of Object.keys(EXPECTED)) {
    const expected = EXPECTED[slot];
    const actual = actualBySlot[slot]?.post_version;
    const match = actual === expected;
    if (!match) allMatch = false;
    traceTable.push({
      slot,
      id: actualBySlot[slot].id,
      original_version: actualBySlot[slot].original_version,
      expected_post: expected,
      actual_post: actual,
      match,
    });
  }

  // Uniqueness of post versions
  const postVersions = traceTable.map(t => t.actual_post);
  const uniquePost = new Set(postVersions);
  const uniqueness = postVersions.length === uniquePost.size;

  // Kept-rows retained their versions
  const r3_kept = actualBySlot.r3.post_version === actualBySlot.r3.original_version;
  const r7_kept = actualBySlot.r7.post_version === actualBySlot.r7.original_version;

  const pass = allMatch && uniqueness && r3_kept && r7_kept;

  const result = {
    harness: 'repro-gate-018-synthetic',
    pass,
    branch_url: state.branch_url,
    setup_at: state.setup_at,
    verified_at: new Date().toISOString(),
    user_id: state.user_id,
    trace_table: traceTable,
    post_versions_unique: uniqueness,
    r3_earliest_v3_kept: r3_kept,
    r7_earliest_v5_kept: r7_kept,
    invariant: 'Renumber CTE produces unique versions; earliest-of-group rows retain original versions',
  };

  fs.writeFileSync('tests/chapter-03/repro-gate-018-synthetic.last-run.json', JSON.stringify(result, null, 2));

  // Cleanup synthetic user
  await deleteUser(state.user_id);
  fs.unlinkSync(STATE_FILE);

  console.log(JSON.stringify(result, null, 2));
  process.exit(pass ? 0 : 1);
}

async function main() {
  if (PHASE === 'setup') return runSetup();
  if (PHASE === 'verify') return runVerify();
  throw new Error(`Unknown phase: ${PHASE}. Use 'setup' or 'verify'.`);
}

main().catch(e => {
  console.error('[synthetic] failed:', e?.message);
  process.exit(1);
});
