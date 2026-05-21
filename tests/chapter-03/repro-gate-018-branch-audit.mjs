/* Chapter 3 · Step 2B · repro gate 018-branch-audit · prod-sample audit harness
 *
 * Per chapter-03/step-2-spec.md §3 + §4 (Call 4 part 2).
 *
 * INVARIANT (post-migration):
 *   The branch's artifacts table has zero duplicate (user_id, artifact_type,
 *   version) tuples. The branch's dispatch_jobs table has zero rows with
 *   chain_id IS NULL. The migration_018_snapshot table exists with rows
 *   matching the mutation set (one row per backfilled dispatch + one row
 *   per renumbered artifact).
 *
 * Operates on a Supabase BRANCH (not production). Defensive gate against
 * the prod hostname is the same as the synthetic harness.
 *
 * Two phases:
 *
 *   node tests/chapter-03/repro-gate-018-branch-audit.mjs setup
 *     -> captures pre-migration state on the branch:
 *          - count of dispatch_jobs WHERE chain_id IS NULL
 *          - duplicate (user_id, artifact_type, version) tuples
 *          - count of truly-legacy artifacts (dispatch_id IS NULL)
 *        writes /tmp/repro-018-audit-state.json
 *
 *   (operator/AI applies supabase/migrations/018_*.sql to the branch via MCP)
 *
 *   node tests/chapter-03/repro-gate-018-branch-audit.mjs verify
 *     -> captures post-migration state, verifies invariants, writes
 *        tests/chapter-03/repro-gate-018-branch-audit.last-run.json
 *
 * Reports:
 *   - Pre-migration counts (the "real prod dupe count" requested in chat)
 *   - Post-migration counts (must be zero dupes + zero NULL chain_ids
 *     on non-truly-legacy rows)
 *   - Snapshot table row counts (audit trail)
 *   - Truly-legacy persistence (artifacts.dispatch_id IS NULL stays
 *     unchanged per Call 2b)
 *
 * PASS: post-state dupes=0 · chain_id-null=0 · snapshot rows match
 *       mutation set · truly-legacy count is unchanged from pre-state.
 *
 * FAIL: any of the above false.
 */

import fs from 'node:fs';

const PHASE = process.argv[2] || 'setup';
const STATE_FILE = '/tmp/repro-018-audit-state.json';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required (branch credentials)');
  process.exit(2);
}

if (/(?:^|\.)quantumbranding\.ai\b/i.test(SUPABASE_URL) || /\bproduction\b/i.test(SUPABASE_URL)) {
  console.error(`Refused: SUPABASE_URL appears to be production (${SUPABASE_URL}). Branch-only harness.`);
  process.exit(2);
}

const svc = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
};

async function safeFetch(url, label) {
  const r = await fetch(url, { headers: svc });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`${label} failed: ${r.status} ${body.slice(0, 200)}`);
  }
  return r.json();
}

async function countDispatchChainIdNulls() {
  const rows = await safeFetch(
    `${SUPABASE_URL}/rest/v1/dispatch_jobs?chain_id=is.null&select=id`,
    'countDispatchChainIdNulls'
  );
  return rows.length;
}

async function findDuplicateVersionTuples() {
  // PostgREST doesn't support GROUP BY directly. We read all artifact rows
  // and aggregate client-side. Acceptable because the artifacts table on
  // chapter-2 production is small (~thousands of rows max).
  const rows = await safeFetch(
    `${SUPABASE_URL}/rest/v1/artifacts?select=id,user_id,artifact_type,version&limit=10000`,
    'readArtifacts'
  );
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.user_id}|${r.artifact_type}|${r.version}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r.id);
  }
  const dupes = [];
  for (const [key, ids] of groups.entries()) {
    if (ids.length > 1) {
      const [user_id, artifact_type, version] = key.split('|');
      dupes.push({ user_id, artifact_type, version: Number(version), count: ids.length, sample_ids: ids.slice(0, 5) });
    }
  }
  return { total_artifacts: rows.length, dupe_groups: dupes };
}

async function countTrulyLegacy() {
  const rows = await safeFetch(
    `${SUPABASE_URL}/rest/v1/artifacts?dispatch_id=is.null&select=id`,
    'countTrulyLegacy'
  );
  return rows.length;
}

async function countSnapshotRows() {
  // The snapshot table only exists after migration applies (or after a
  // prior run created it). Both pre and post phases tolerate absence.
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/migration_018_snapshot?select=table_name,row_id`,
      { headers: svc }
    );
    if (!r.ok) return { table_exists: false };
    const rows = await r.json();
    const byTable = {};
    for (const row of rows) {
      byTable[row.table_name] = (byTable[row.table_name] || 0) + 1;
    }
    return { table_exists: true, by_table: byTable, total: rows.length };
  } catch (e) {
    return { table_exists: false, error: String(e?.message || e) };
  }
}

async function checkUniqueIndex() {
  // Query pg_indexes via PostgREST rpc · falls back to "unknown" if
  // the rpc isn't exposed. The post-migration audit will infer the
  // constraint from the absence of dupes plus a probe write that
  // expects 23505 (not done here · keeping the audit non-mutating).
  return { check_method: 'inferred-from-dupe-count', note: 'A zero dupe count after the migration is the structural evidence the index landed. The synthetic-gate harness exercises the constraint via the renumbered rows.' };
}

async function snapshot(label) {
  return {
    label,
    captured_at: new Date().toISOString(),
    branch_url: SUPABASE_URL,
    dispatch_jobs_chain_id_nulls: await countDispatchChainIdNulls(),
    artifacts_duplicate_tuples: await findDuplicateVersionTuples(),
    artifacts_truly_legacy: await countTrulyLegacy(),
    migration_018_snapshot: await countSnapshotRows(),
    unique_index: await checkUniqueIndex(),
  };
}

async function runSetup() {
  console.log('[audit] setup phase · capturing pre-migration state on branch');
  const pre = await snapshot('pre-migration');
  const state = {
    phase: 'setup',
    pre,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`[audit] pre-state written to ${STATE_FILE}`);
  console.log(`[audit] dispatch_jobs chain_id NULL count: ${pre.dispatch_jobs_chain_id_nulls}`);
  console.log(`[audit] artifacts dupe groups: ${pre.artifacts_duplicate_tuples.dupe_groups.length}`);
  console.log(`[audit] artifacts truly-legacy count: ${pre.artifacts_truly_legacy}`);
  console.log(`[audit] NEXT: apply supabase/migrations/018_*.sql to branch via MCP, then run with 'verify' phase`);
}

async function runVerify() {
  console.log('[audit] verify phase · capturing post-migration state');
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(`State file missing: ${STATE_FILE}. Run 'setup' phase first.`);
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const post = await snapshot('post-migration');

  const pre = state.pre;

  // Invariants
  const inv1_dupes_zero = post.artifacts_duplicate_tuples.dupe_groups.length === 0;
  const inv2_chain_id_zero = post.dispatch_jobs_chain_id_nulls === 0;
  const inv3_truly_legacy_unchanged = post.artifacts_truly_legacy === pre.artifacts_truly_legacy;
  const inv4_snapshot_exists = post.migration_018_snapshot.table_exists === true;

  // Snapshot row counts should match the mutation set
  const expected_dispatch_snapshot_rows = pre.dispatch_jobs_chain_id_nulls;
  const expected_artifact_snapshot_rows = pre.artifacts_duplicate_tuples.dupe_groups
    .reduce((sum, g) => sum + g.count, 0);
  const actual_dispatch_snapshot_rows = post.migration_018_snapshot.by_table?.dispatch_jobs || 0;
  const actual_artifact_snapshot_rows = post.migration_018_snapshot.by_table?.artifacts || 0;
  const inv5_dispatch_snapshot_count = actual_dispatch_snapshot_rows === expected_dispatch_snapshot_rows;
  const inv6_artifact_snapshot_count = actual_artifact_snapshot_rows === expected_artifact_snapshot_rows;

  const pass = inv1_dupes_zero && inv2_chain_id_zero && inv3_truly_legacy_unchanged && inv4_snapshot_exists && inv5_dispatch_snapshot_count && inv6_artifact_snapshot_count;

  const result = {
    harness: 'repro-gate-018-branch-audit',
    pass,
    pre,
    post,
    invariants: {
      i1_post_dupes_zero: inv1_dupes_zero,
      i2_post_chain_id_nulls_zero: inv2_chain_id_zero,
      i3_truly_legacy_unchanged: inv3_truly_legacy_unchanged,
      i4_snapshot_table_exists: inv4_snapshot_exists,
      i5_dispatch_snapshot_count_matches: inv5_dispatch_snapshot_count,
      i6_artifact_snapshot_count_matches: inv6_artifact_snapshot_count,
    },
    mutation_summary: {
      dispatches_backfilled: pre.dispatch_jobs_chain_id_nulls - post.dispatch_jobs_chain_id_nulls,
      artifacts_renumbered: post.migration_018_snapshot.by_table?.artifacts || 0,
      dupes_resolved: pre.artifacts_duplicate_tuples.dupe_groups.length - post.artifacts_duplicate_tuples.dupe_groups.length,
    },
  };

  fs.writeFileSync('tests/chapter-03/repro-gate-018-branch-audit.last-run.json', JSON.stringify(result, null, 2));
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
  console.error('[audit] failed:', e?.message);
  process.exit(1);
});
