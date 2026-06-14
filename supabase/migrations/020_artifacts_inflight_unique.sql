-- migration 020: single-in-flight unique index on artifacts
-- Chapter 4 · step 4 · the founder dispatch entry (api/agents/dispatch.js).
--
-- The ruled single-in-flight guard (one producing dispatch per agent per
-- user) cannot be made race-safe in application code: under READ COMMITTED
-- two concurrent inserts can each re-read before the other commits, so
-- neither sees the other. The guarantee must be DB-enforced. This partial
-- unique index allows at most one NON-TERMINAL (queued|generating) artifact
-- per (user_id, artifact_type).
--
-- A concurrent second dispatch's artifact insert violates this index
-- (Postgres 23505); the dispatch entry's existing unique-violation handler
-- returns 409 dispatch_in_flight and rolls its rows back. Terminal rows
-- (delivered|failed) are excluded, so a legitimate sequential re-run is never
-- blocked.
--
-- Context: the (user_id, artifact_type, version) index that migration 018
-- would have added was never applied to production, and would not have
-- closed the cross-version race anyway (two concurrent requests at different
-- versions both succeed). The partial in-flight index is the correct guard.
--
-- Idempotent: IF NOT EXISTS. Pre-checked clean on 2026-06-14 (0 (user_id,
-- artifact_type) groups with >1 non-terminal artifact). Reversible:
--   DROP INDEX IF EXISTS artifacts_inflight_unique;

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_inflight_unique
  ON artifacts (user_id, artifact_type)
  WHERE status IN ('queued', 'generating');
