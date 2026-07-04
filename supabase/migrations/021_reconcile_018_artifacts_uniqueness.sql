-- migration 021: reconcile of migration 018 · never executed against prod
--
-- History (chapter-4 closure finding, 2026-06-14, re-verified 2026-07-04):
--   Migration 018 exists in the repo but was NEVER applied to the
--   production database. Empirical probe on 2026-07-04 (service-role
--   insert of two artifacts rows with identical user_id, artifact_type,
--   version · both accepted 201) confirms the divergence is still live:
--     - migration_018_snapshot table: absent
--     - artifacts_user_type_version_unique index: absent
--     - dispatch_jobs.chain_id: column exists, legacy rows unbackfilled
--   Meanwhile api/agents/rerun.js and api/_lib/chain-trigger.js both
--   catch 23505 as idempotent_skip, an assumption the missing index
--   leaves unbacked. Migration 020 (artifacts_inflight_unique) IS applied
--   and remains the only DB-enforced in-flight guard.
--
-- This file re-issues 018's operations verbatim in intent, under a 021
-- snapshot table. Every step is idempotent, so applying 021 after a late
-- 018 application (or vice versa) is a no-op. Apply via the Supabase SQL
-- editor or an MCP-connected session against project yushbxjwfhuokaezoioe,
-- then re-run the duplicate-insert probe and expect 409/23505 on the
-- second insert.
--
--   1. Backfill dispatch_jobs.chain_id for legacy rows (synthetic = id).
--   2. Renumber duplicate artifact versions, then add the unique index
--      on artifacts(user_id, artifact_type, version).

BEGIN;

-- ─── 1. Snapshot (defensive · manual-rollback path) ─────────────────────

CREATE TABLE IF NOT EXISTS migration_021_snapshot (
  snapshotted_at TIMESTAMPTZ DEFAULT now(),
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  pre_state JSONB NOT NULL,
  PRIMARY KEY (table_name, row_id)
);

INSERT INTO migration_021_snapshot (table_name, row_id, pre_state)
SELECT 'dispatch_jobs', id, to_jsonb(dj)
FROM dispatch_jobs dj
WHERE chain_id IS NULL
ON CONFLICT (table_name, row_id) DO NOTHING;

INSERT INTO migration_021_snapshot (table_name, row_id, pre_state)
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
      'Migration 021 abort: % duplicate (user_id, artifact_type, version) tuples remain after renumbering. Investigate before re-running.',
      dupe_count;
  END IF;
END $$;

-- ─── 5. Add the unique index ────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_user_type_version_unique
  ON artifacts (user_id, artifact_type, version);

COMMIT;
