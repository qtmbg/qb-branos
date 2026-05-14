-- 006_indexes.sql
-- Chapter 1 / Build step 1
-- Indexes per spec section 4.7. All idempotent via `if not exists`.
--
-- Index on tool_completions uses the existing column name `tool_name`
-- (canonical per migration 005).

create index if not exists artifacts_user_phase_idx
  on public.artifacts (user_id, phase, created_at desc);

create index if not exists artifacts_user_status_idx
  on public.artifacts (user_id, status);

create index if not exists artifact_runs_artifact_idx
  on public.artifact_runs (artifact_id, created_at desc);

create index if not exists qbp_revisions_user_idx
  on public.qbp_revisions (user_id, created_at desc);

create index if not exists tool_completions_user_tool_idx
  on public.tool_completions (user_id, tool_name);

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- drop index if exists public.artifacts_user_phase_idx;
-- drop index if exists public.artifacts_user_status_idx;
-- drop index if exists public.artifact_runs_artifact_idx;
-- drop index if exists public.qbp_revisions_user_idx;
-- drop index if exists public.tool_completions_user_tool_idx;
-- ───────────────────────────────────────────────────────────────────────────
