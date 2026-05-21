# Chapter 3 · Step 2 spec · Synthetic `chain_id` backfill + artifacts uniqueness constraint

**Status:** spec with all seven adjudications baked (calls 1, 2, 2b, 3, 4, 5, 6). Migration SQL approved with the renumber strategy. Rerun 23505 catch required IN step 2 (Fence 2 relaxed for this single one-line addition). Three-layer review with mandatory Supabase branch dry-run before any prod touch.

Source authority: `chapter-03/step-2-outline.md` (the open-call outline · this branch's predecessor on main) · the seven adjudications surfaced in chat 2026-05-21 · `chapter-03/step-1-hardening-report.md` §8 (Forward refs 1 + 3) · `chapter-03/step-1-sweep-notes.md` §5 (Forward ref 3) · `tests/chapter-03/invariants-version-race.mjs` (EXPECTED-RED state · the migration's go-criterion).

---

## 0. Adjudications baked

| # | Adjudication | Notes |
|---|---|---|
| 1 | **Bundle B** · backfill + artifacts unique constraint, same window | Reaper terminal-flip (Forward ref 3) stays out. Will get its own small step post step 2. |
| 2 | **Default** · `chain_id = dispatch_jobs.id` for `WHERE chain_id IS NULL` | Each pre-chain dispatch is its own synthetic chain of one. Renders as chain-of-one in `archive.html`. No new UI. Reject the time-window and lineage-walk overrides (don't invent retroactive chain relationships that didn't exist). |
| 2b | **Default** · leave truly-legacy artifacts (`dispatch_id IS NULL`) in "Earlier work" | DO NOT synthesize fake `dispatch_jobs` rows. Data-model contamination breaks every future query assuming `dispatch_jobs` means a real dispatch. The section persisting is the honest outcome. This **revises** the chapter-2 §7 expectation: "Earlier work" disappears for ch2-era artifacts that have dispatch rows, persists for truly-legacy ones. |
| 3 | **Default** · `UPDATE WHERE chain_id IS NULL` + `CREATE UNIQUE INDEX IF NOT EXISTS` | Idempotent by construction. The snapshot table sketched in §3 provides the rollback safety the log-table override was reaching for. No extra ceremony. |
| 4 | **Override · BOTH** · synthetic diff AND production-sample audit on a Supabase branch | Synthetic test proves the logic. Branch audit proves behavior against the real data shape including any real-user dupes beyond the test-user ones. Branch cost is trivial against the risk. |
| 5 | **Override · branch dry-run first** | Three layers: (a) operator reads plain-English column · (b) AI cross-reads against §4.5 discipline · (c) migration applies GREEN against a Supabase branch clone BEFORE it touches production. All three sign off. |
| 6 | **Default** · reaper terminal-flip is its own small step after step 2 | Confirmed by Call 1 = B. Forward ref 3 stays forward. |

### Required addition (Fence 2 relaxed for ONE line only)

**Rerun 23505 catch ships IN step 2.** `api/agents/rerun.js` insert path must mirror the existing `api/_lib/chain-trigger.js:240-248` pattern EXACTLY (catch 23505 / 'duplicate key' / 'unique constraint', treat as `idempotent_skip`, return existing artifact). One pattern-matched addition with a known-good precedent in the same file. Without it, the constraint trades a silent dup bug for a user-facing 500 on race-losing reruns. Half-landed migration is not acceptable. Fence 2 stays in force for every other line of product code.

---

## 1. Bundle framing

Step 2 ships ONE migration. The migration does two things that touch the artifacts/dispatch_jobs DB layer in one operator-reviewed SQL session:

1. **chain_id backfill.** Assigns synthetic `chain_id = dispatch_jobs.id` to every `dispatch_jobs` row where `chain_id IS NULL`. After ship, the archive UI's chain model covers every chapter-2-era dispatch. Truly-legacy artifacts (no dispatch_id at all) persist in "Earlier work" per the §2b adjudication.

2. **artifacts uniqueness constraint.** Adds a full unique index on `(user_id, artifact_type, version)`. Cures the #100 race-class at the structural layer (the cure shape from `docs/patterns/race-discipline.md` §1). Requires pre-existing duplicate-version rows to be resolved first (the renumber strategy in §3).

The migration is atomic (single transaction). The renumber strategy preserves all rows. The snapshot table in §3 gives manual-rollback capability.

The rerun 23505 catch in `api/agents/rerun.js` ships within step 2 to keep the constraint and its app-layer handler in lockstep.

### Sequence of operations (binding · per user adjudication)

1. **2A spec** (this PR) committed and merged.
2. **2B SQL + harnesses** committed (migration file at `supabase/migrations/018_*.sql` · two repro gate harnesses at `tests/chapter-03/repro-gate-018-*.mjs`). NOT applied.
3. **2C branch dry-run.** Create Supabase branch via MCP. Apply 018 to branch. Run both repro gates against branch. Capture results including the [5,5,5,...] trace + the real prod dupe count (from the clone's state). Commit branch-dry-run report. **HOLD** at this gate.
4. **2D post-go.** Operator gives prod-apply go in chat → operator applies 018 to prod via MCP → AI ships the rerun 23505 catch (one-line addition to `api/agents/rerun.js` · merge to main auto-deploys via Vercel) → AI re-fires `invariants-version-race.mjs` (must flip EXPECTED-RED to GREEN).
5. **2Z closure** + step 3 outline.

**Nothing touches production until step 2C's branch dry-run is reviewed and explicit go is given in chat.** The branch run does not auto-promote.

---

## 2. The migration · `supabase/migrations/018_chain_id_backfill_and_artifacts_uniqueness.sql`

### 2.1 SQL with plain-English column

The SQL below is the approved spec. Each statement carries its plain-English row inline below the SQL for operator review at every prod-touching step.

```sql
-- migration 018: chain_id backfill + artifacts uniqueness
-- Per chapter-03/step-2-spec.md (Bundle B). Atomic via single transaction.
-- Idempotent at every step. Pre-migration snapshot for manual rollback.

BEGIN;

-- ─── 1. Snapshot (defensive · manual-rollback path) ─────────────────────

CREATE TABLE IF NOT EXISTS migration_018_snapshot (
  snapshotted_at TIMESTAMPTZ DEFAULT now(),
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  pre_state JSONB NOT NULL,
  PRIMARY KEY (table_name, row_id)
);
```

| What | Touches | Reversible | Existing data |
|---|---|---|---|
| Creates a snapshot table for manual rollback. | New table only. | Yes via `DROP TABLE migration_018_snapshot`. | None. |

```sql
-- dispatch_jobs rows that will have chain_id backfilled
INSERT INTO migration_018_snapshot (table_name, row_id, pre_state)
SELECT 'dispatch_jobs', id, to_jsonb(dj)
FROM dispatch_jobs dj
WHERE chain_id IS NULL
ON CONFLICT (table_name, row_id) DO NOTHING;
```

| What | Touches | Reversible | Existing data |
|---|---|---|---|
| Captures the pre-backfill state of every `dispatch_jobs` row where `chain_id IS NULL`. | Read-only on dispatch_jobs · writes only to snapshot table. | Yes (snapshot is independent). | None on dispatch_jobs · creates snapshot rows for affected dispatches. |

```sql
-- artifacts rows that are in a duplicate-version group
INSERT INTO migration_018_snapshot (table_name, row_id, pre_state)
SELECT 'artifacts', a.id, to_jsonb(a)
FROM artifacts a
WHERE (a.user_id, a.artifact_type, a.version) IN (
  SELECT user_id, artifact_type, version
  FROM artifacts
  GROUP BY user_id, artifact_type, version
  HAVING COUNT(*) > 1
)
ON CONFLICT (table_name, row_id) DO NOTHING;
```

| What | Touches | Reversible | Existing data |
|---|---|---|---|
| Captures the pre-renumber state of every artifact row in a duplicate-version group. | Read-only on artifacts · writes only to snapshot. | Yes (snapshot is independent). | None on artifacts · creates snapshot rows for race-loser artifacts. |

```sql
-- ─── 2. dispatch_jobs.chain_id backfill ────────────────────────────────

UPDATE dispatch_jobs
SET chain_id = id
WHERE chain_id IS NULL;
```

| What | Touches | Reversible | Existing data |
|---|---|---|---|
| Assigns a synthetic `chain_id = dispatch_jobs.id` for every dispatch that doesn't have one. Each pre-chain dispatch becomes its own synthetic chain of one. | Every `dispatch_jobs` row with `chain_id IS NULL`. Idempotent. | Irreversible without the snapshot. Manual rollback: `UPDATE dispatch_jobs SET chain_id = NULL FROM migration_018_snapshot s WHERE s.table_name='dispatch_jobs' AND s.row_id=dispatch_jobs.id`. | Each pre-chain dispatch becomes its own synthetic chain of one. `archive.html` renders them as single-agent chains. No UI change beyond removing the "Earlier work" section for ch2-era artifacts that have dispatch rows. Truly-legacy artifacts (dispatch_id IS NULL) stay in "Earlier work" per §2b. |

```sql
-- ─── 3. Resolve duplicate artifact versions (renumber strategy) ─────────

WITH ranked_dupes AS (
  SELECT
    id,
    user_id,
    artifact_type,
    version,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, artifact_type, version
      ORDER BY created_at ASC, id ASC
    ) AS dup_rank
  FROM artifacts
),
max_per_pair AS (
  SELECT user_id, artifact_type, MAX(version) AS max_v
  FROM artifacts
  GROUP BY user_id, artifact_type
),
to_renumber AS (
  SELECT
    rd.id,
    mv.max_v + ROW_NUMBER() OVER (
      PARTITION BY rd.user_id, rd.artifact_type
      ORDER BY rd.version, rd.id
    ) AS new_version
  FROM ranked_dupes rd
  JOIN max_per_pair mv USING (user_id, artifact_type)
  WHERE rd.dup_rank > 1
)
UPDATE artifacts a
SET version = trn.new_version,
    updated_at = now()
FROM to_renumber trn
WHERE a.id = trn.id;
```

| What | Touches | Reversible | Existing data |
|---|---|---|---|
| **THE CRITICAL STATEMENT.** For each `(user_id, artifact_type)` group with version collisions, keeps the earliest-created duplicate at its current version. Re-numbers subsequent duplicates above the current max for that group. Tie-breaker: `created_at ASC, id ASC` (deterministic). | Only artifact rows where `dup_rank > 1`. On a clean state (no dupes), this touches zero rows. On current state with [5,5,5,4,3,3,3,2,1]-shape dupes: race-loser rows get re-versioned above max. | Irreversible without the snapshot. Manual rollback: `UPDATE artifacts a SET version = (s.pre_state->>'version')::INTEGER FROM migration_018_snapshot s WHERE s.table_name='artifacts' AND s.row_id=a.id`. | Race-loser rows get higher version numbers. Versions are not user-facing in the archive UI (rendered as relative ordering, not absolute numbers). UI impact: zero. All rows preserved · no DELETE. |

```sql
-- ─── 4. Verify post-condition ──────────────────────────────────────────

DO $$
DECLARE
  dupe_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dupe_count
  FROM (
    SELECT 1
    FROM artifacts
    GROUP BY user_id, artifact_type, version
    HAVING COUNT(*) > 1
  ) sub;

  IF dupe_count > 0 THEN
    RAISE EXCEPTION
      'Migration 018 abort: % duplicate (user_id, artifact_type, version) tuples remain after renumbering. Investigate before re-running.',
      dupe_count;
  END IF;
END $$;
```

| What | Touches | Reversible | Existing data |
|---|---|---|---|
| Verifies zero duplicate tuples remain. Aborts the transaction if any survived. Catches the unlikely case of a concurrent write during the migration window. | Read-only. | N/A. | None. Defensive gate. |

```sql
-- ─── 5. Add the unique index ────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_user_type_version_unique
  ON artifacts (user_id, artifact_type, version);

COMMIT;
```

| What | Touches | Reversible | Existing data |
|---|---|---|---|
| Adds the structural cure for the #100 race. Concurrent writers hitting the same `(user_id, artifact_type, version)` tuple get 23505 unique-violation. Application's existing 23505-catch at `chain-trigger.js:240-248` already handles it as `idempotent_skip`. Rerun endpoint's catch ships in 2D as the matching addition (§4 below). | Full unique index on artifacts (`user_id, artifact_type, version`). | Yes via `DROP INDEX artifacts_user_type_version_unique`. | The `invariants-version-race.mjs` harness flips from EXPECTED-RED to GREEN. The Cat B forward-ref from step 1 closes. |

### 2.2 Renumber strategy walkthrough · the [5,5,5,4,3,3,3,2,1] case

The user requirement: "trace the actual [5,5,5,4,3,3,3,2,1] case through the renumber CTE and confirm output has zero collisions and the kept rows retain their versions."

This trace runs against synthetic data injected into the Supabase branch in 2C. The expected output (mathematical pre-check before the branch run):

Input rows (9 artifacts for user U, type `soul_map_synthesizer`, ordered by created_at ASC):

| Row | id (synth) | version | created_at | dup_rank in (U, S, v) | dup_count |
|---|---|---|---|---|---|
| 1 | r1 | 1 | t+0 | 1 | 1 |
| 2 | r2 | 2 | t+10 | 1 | 1 |
| 3 | r3 | 3 | t+20 | 1 (earliest of three v3s) | 3 |
| 4 | r4 | 3 | t+21 | 2 | 3 |
| 5 | r5 | 3 | t+22 | 3 | 3 |
| 6 | r6 | 4 | t+30 | 1 | 1 |
| 7 | r7 | 5 | t+40 | 1 (earliest of three v5s) | 3 |
| 8 | r8 | 5 | t+41 | 2 | 3 |
| 9 | r9 | 5 | t+42 | 3 | 3 |

`max_per_pair` for (U, soul_map_synthesizer) = 5.

`to_renumber` selects rows where `dup_rank > 1`: r4, r5, r8, r9.

`ROW_NUMBER() OVER (PARTITION BY user_id, artifact_type ORDER BY version, id)` over those four rows:

| Row | version | id | ROW_NUMBER | new_version (max_v + RN = 5 + RN) |
|---|---|---|---|---|
| r4 | 3 | (early in id sort) | 1 | 6 |
| r5 | 3 | (later in id sort) | 2 | 7 |
| r8 | 5 | (early in id sort) | 3 | 8 |
| r9 | 5 | (later in id sort) | 4 | 9 |

Post-migration state for the 9 rows:

| Row | original version | new version | notes |
|---|---|---|---|
| r1 | 1 | 1 | unchanged · no dupe |
| r2 | 2 | 2 | unchanged · no dupe |
| r3 | 3 | 3 | kept · earliest of v3 group |
| r4 | 3 | 6 | renumbered |
| r5 | 3 | 7 | renumbered |
| r6 | 4 | 4 | unchanged · no dupe |
| r7 | 5 | 5 | kept · earliest of v5 group |
| r8 | 5 | 8 | renumbered |
| r9 | 5 | 9 | renumbered |

Post-state version set for (U, soul_map_synthesizer): {1, 2, 3, 4, 5, 6, 7, 8, 9}. All unique. Zero collisions. Kept rows (r3 and r7) retain their original versions. **Trace passes.**

The branch dry-run in 2C verifies this matches actual SQL execution. The repro gate harness asserts the pre/post diff matches this expected table.

---

## 3. Sub-PR 2B · Migration SQL + repro gate harnesses

### 3.1 Output

| File | Purpose |
|---|---|
| `supabase/migrations/018_chain_id_backfill_and_artifacts_uniqueness.sql` | The migration SQL from §2. NOT applied · committed for review. |
| `tests/chapter-03/repro-gate-018-synthetic.mjs` | Synthetic-state diff harness (Call 4 part 1). Creates a test user, injects the [5,5,5,4,3,3,3,2,1] pattern via execute_sql on the branch, applies 018, asserts the renumber output matches the §2.2 trace exactly. |
| `tests/chapter-03/repro-gate-018-branch-audit.mjs` | Production-sample audit harness (Call 4 part 2). Queries the branch (which is a clone of prod) for: pre-migration dupe count grouped by `(user_id, artifact_type, version)`, total rows affected by both the chain_id backfill and the renumber, post-migration verification that zero dupes remain. |

### 3.2 Harness contract

Both harnesses:
- Use the Supabase MCP `execute_sql` against the branch (the branch URL + service key resolves via MCP, not via the operator's local env).
- Take the branch ref as input (env var `BRANCH_REF` or hard-coded in the harness).
- Write `tests/chapter-03/repro-gate-018-<name>.last-run.json` (untracked per chapter-2 convention).
- Go red if pre/post diff does not match expectation OR if the migration apply on the branch errors out.

### 3.3 Fence 2 status for 2B

Honored. The SQL file is committed but not applied. The harnesses are NEW test files. Zero edits to production code.

---

## 4. Sub-PR 2C · Branch dry-run

### 4.1 Steps

1. `mcp__claude_ai_Supabase__create_branch` to create a fresh branch from prod state.
2. `mcp__claude_ai_Supabase__apply_migration` (or `execute_sql`) to apply 018 against the branch.
3. Run `repro-gate-018-synthetic.mjs` against the branch (asserts the §2.2 trace).
4. Run `repro-gate-018-branch-audit.mjs` against the branch (reports clone-state dupe counts pre/post).
5. Commit `chapter-03/verification/step-2-branch-dry-run-report.md` with:
   - Branch ref + creation timestamp
   - Pre-migration dupe count (from the audit)
   - Renumber trace output (from the synthetic gate, matching §2.2)
   - Post-migration verification (zero dupes · index in place)
   - Snapshot table row counts
6. Surface report URL in chat. **HOLD** for operator go.

### 4.2 What the operator sees before giving go

| Verification | Expected |
|---|---|
| §2.2 trace output | Matches the table in §2.2 exactly · 9 input rows → 9 unique versions · r3 and r7 retain originals |
| Real-user dupe count (pre) | Reported as-is (could be 0 if cascade cleaned up the harness data and there are no other dupes; could be N>0 if there are real-user races) |
| Real-user dupe count (post) | 0 |
| chain_id backfill count | Reported as-is (number of dispatch_jobs rows that had chain_id IS NULL pre-migration) |
| Index existence | `artifacts_user_type_version_unique` present and unique |
| Snapshot table rows | Matches (dispatch_jobs rows backfilled + artifacts rows renumbered) |
| Transaction status | COMMITTED · no RAISE EXCEPTION fired |

### 4.3 Fence 2 status for 2C

Honored. Branch operations only. Zero production touches. Zero application code edits.

---

## 5. Sub-PR 2D · Prod apply + rerun 23505 catch + harness re-fire

### 5.1 Sequence (post operator go · binding order)

1. **Operator applies 018 to prod via MCP** (the `apply_migration` or `execute_sql` path against the prod project, not a branch). The operator runs this from MCP directly. The plain-English column from §2.1 is the review reference at apply time.
2. **AI ships the rerun 23505 catch.** Single-line addition to `api/agents/rerun.js`. Pattern mirrors `chain-trigger.js:240-248` exactly. Merge to main auto-deploys via Vercel.
3. **AI re-fires `invariants-version-race.mjs`.** The harness must flip from EXPECTED-RED to GREEN. The sub-invariant B (artifacts uniqueness) is the assertion that now passes.
4. **Commit** `chapter-03/verification/step-2-prod-apply-report.md` with: apply timestamp · prod dupe count pre/post · rerun catch deploy hash · harness GREEN result.

### 5.2 The rerun catch · pattern reference

Required shape (from `chain-trigger.js:240-248`):

```js
} catch (e) {
  const msg = (e?.message || '').toLowerCase();
  if (msg.includes('23505') || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    // idempotent_skip · return the existing latest artifact for this user/type
    // OR return a documented refusal payload that the Console can handle
    return /* canonical idempotent-skip response */;
  }
  // re-throw non-23505 errors per the discipline
  throw e;
}
```

Application in `api/agents/rerun.js`: wrap the insert path (the rerun creates a new artifacts row with `version = source.version + 1`). The exact wrapping point is identified at edit time by reading the file; the precedent shape from `chain-trigger.js:240-248` constrains the exact code structure.

**Fence 2 relaxation scope:** ONE catch addition in `api/agents/rerun.js`. NO other production code edits in step 2D.

### 5.3 Fence 2 status for 2D

Relaxed for ONE line/block addition in `api/agents/rerun.js`. All other production code stays untouched. The relaxation is intrinsic to the migration landing cleanly (the constraint without the catch leaves a 500 window).

---

## 6. Sub-PR 2Z · Closure + step 3 outline

### 6.1 Output

- `chapter-03/verification/step-2-closure-report.md` · captures all four sub-PR outcomes · invariant harness flipped GREEN · the version-race Cat B forward-ref from step 1 closes
- `chapter-03/step-3-outline.md` · Asset Layer (chapter goal MINIMUM scope per PR #150 reconciliation note: founder uploads a file, agent reads it · deferred: versioning, ZIP export, tier-based storage limits as PL-003)

### 6.2 Step 3 outline shape

Six open calls covering:
1. Storage scope (Supabase Storage bucket layout · per-user vs shared)
2. Upload UI placement (foundation page banner · or its own surface)
3. File reference contract (how does an agent receive a file ref · qbp.files? artifacts.files?)
4. Auth on file reads (signed URLs · TTL · scope)
5. Tier gating (free tier limit · MB cap · deferred to PL-003)
6. First-agent integration (which agent reads files first · Phase 02 Logo Evaluation Agent vs Phase 03 Content Bridge)

Step 3 holds at the gate for adjudication per chapter-3 posture (asset-layer touches new infrastructure and a new agent integration · not a clean default-shaped step).

---

## 7. Out of scope (step 2)

- Reaper terminal-flip cure (Forward ref 3 · its own step post step 2 · Call 6 default)
- Production-site silent-fail cleanup (Forward ref 2 · 5 helpers in `api/agents/run.js`) · separate post-step-2 step
- Asset Layer build · step 3
- Phase 02 agents · chapter 4
- Pricing reconciliation · separate session
- WCAG accessibility audit · post-launch
- Any production code edit beyond the ONE rerun 23505 catch (Fence 2)

---

## 8. Definition of done

Step 2 closes when:

- Migration 018 has been applied to prod (operator-confirmed in chat after the branch dry-run reviewed).
- The rerun 23505 catch is deployed via Vercel (PR merged to main).
- `invariants-version-race.mjs` flips from EXPECTED-RED to GREEN at re-fire.
- The branch dry-run report and the prod apply report are committed at `chapter-03/verification/`.
- The "Earlier work" section in `archive.html` reflects the new state: ch2-era artifacts that had dispatch rows are now in the chain section (each as a synthetic chain of one) · truly-legacy artifacts (no dispatch_id) remain in "Earlier work".
- The snapshot table `migration_018_snapshot` exists in prod for the rollback window.
- Step 3 outline is committed and held at the gate.

Closure report at `chapter-03/verification/step-2-closure-report.md`.

---

## 9. Hard fences for step 2

- **Branch dry-run before any prod touch (mandatory).** The branch run does NOT auto-promote. Operator gives explicit go in chat after reviewing the dry-run report.
- **Plain-English alongside every prod-touching SQL.** §2.1 has the canonical table. Apply-time review uses it.
- **Fence 2 relaxed for ONE addition only:** the rerun 23505 catch in `api/agents/rerun.js`. All other production code stays untouched. No "while we're in there" refactors.
- **`git branch --show-current` before every commit.** Discipline carried forward from chapter 2 step 7 origin.
- **Three-layer review for SQL:** operator plain-English read · AI cross-read against §4.5 discipline · branch dry-run GREEN. All three required.

---

## 10. Hold gate

This spec ships in PR 2A. Sub-PRs 2B / 2C / 2D / 2Z follow in order. The CRITICAL hold gate is at 2C close: branch dry-run report committed, operator reviews, operator gives prod-apply go in chat OR redirects. Nothing executes against production until that explicit go.

`Spec ready · branch chapter-3/step-2-spec`
