-- migration 018: chain_id backfill + artifacts uniqueness
-- Per chapter-03/step-2-spec.md (Bundle B · adjudicated 2026-05-21).
--
-- Two operations bundled in one atomic transaction:
--   1. Backfill dispatch_jobs.chain_id for legacy rows (synthetic = id).
--   2. Renumber duplicate artifact versions then add the unique index
--      on artifacts(user_id, artifact_type, version).
--
-- Idempotent at every step:
--   - dispatch_jobs.chain_id backfill: WHERE chain_id IS NULL (no-op on re-run)
--   - artifacts renumber: only touches rows where dup_rank > 1 (no-op when zero dupes)
--   - unique index: IF NOT EXISTS (no-op on re-run)
--
-- Pre-mutation snapshot in migration_018_snapshot table for manual rollback.
--
-- Application contract (chapter-03/step-2-spec.md §5):
--   - api/_lib/chain-trigger.js:240-248 already catches 23505 as
--     idempotent_skip · works with the new constraint immediately.
--   - api/agents/rerun.js needs an equivalent catch · ships in 2D
--     within step 2 (Fence 2 relaxed for that ONE addition only).

BEGIN;

-- ─── 1. Snapshot (defensive · manual-rollback path) ─────────────────────

CREATE TABLE IF NOT EXISTS migration_018_snapshot (
  snapshotted_at TIMESTAMPTZ DEFAULT now(),
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  pre_state JSONB NOT NULL,
  PRIMARY KEY (table_name, row_id)
);

INSERT INTO migration_018_snapshot (table_name, row_id, pre_state)
SELECT 'dispatch_jobs', id, to_jsonb(dj)
FROM dispatch_jobs dj
WHERE chain_id IS NULL
ON CONFLICT (table_name, row_id) DO NOTHING;

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

-- ─── 2. dispatch_jobs.chain_id backfill ─────────────────────────────────

UPDATE dispatch_jobs
SET chain_id = id
WHERE chain_id IS NULL;

-- ─── 3. Resolve duplicate artifact versions (renumber strategy) ─────────
-- For each (user_id, artifact_type) group with version collisions:
--   - First duplicate (earliest created_at, lowest id as tie-breaker)
--     keeps its current version.
--   - Subsequent duplicates get reassigned versions above the current max.

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

-- ─── 4. Verify post-condition (will abort txn if dupes remain) ─────────

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

-- ─── 5. Add the unique index ────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_user_type_version_unique
  ON artifacts (user_id, artifact_type, version);

COMMIT;
