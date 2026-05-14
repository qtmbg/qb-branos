-- 002_artifacts_schema_extension.sql
-- Chapter 1 / Build step 1
-- Adds phase, version, parent_artifact_id, and a phase CHECK constraint.
-- Drops the (user_id, artifact_type) unique constraint, which blocks the
-- versioning system mandated by spec 4.3 and 5.7.
--
-- Spec references columns `agent_slug`, `content_jsonb`, `failed_reason`.
-- The existing columns `artifact_type`, `content`, `error` serve the same
-- purpose and are referenced by api/agents/dispatch.js. Per spec 4.3
-- ("Existing columns preserved") the existing columns are canonical.
-- The semantic contract matches the spec exactly.
--
-- The status vocabulary currently uses 'producing' / 'ready'. Spec mandates
-- 'queued' / 'generating' / 'delivered' / 'failed'. Migration 007 backfills
-- existing rows. The strict CHECK constraint on status is intentionally NOT
-- added here; it lands in build step 3 alongside the dispatch.js refactor
-- that updates the writer.

alter table public.artifacts
  add column if not exists phase text,
  add column if not exists version int not null default 1,
  add column if not exists parent_artifact_id uuid references public.artifacts(id) on delete set null;

-- Drop unique constraint that blocks versioning. Idempotent.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'artifacts_user_id_artifact_type_key'
      and conrelid = 'public.artifacts'::regclass
  ) then
    alter table public.artifacts drop constraint artifacts_user_id_artifact_type_key;
  end if;
end $$;

-- Phase identifier CHECK. Idempotent via drop-and-recreate.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'artifacts_phase_check'
      and conrelid = 'public.artifacts'::regclass
  ) then
    alter table public.artifacts drop constraint artifacts_phase_check;
  end if;
end $$;

alter table public.artifacts
  add constraint artifacts_phase_check
  check (phase is null or phase in ('00', '01', '02', '03', '04', '05'));

-- RLS already enabled with "Users can read own artifacts" select policy
-- (no insert/update/delete policies — service role writes only).
-- No policy change here.

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- alter table public.artifacts drop constraint if exists artifacts_phase_check;
-- alter table public.artifacts drop column if exists parent_artifact_id;
-- alter table public.artifacts drop column if exists version;
-- alter table public.artifacts drop column if exists phase;
-- alter table public.artifacts
--   add constraint artifacts_user_id_artifact_type_key unique (user_id, artifact_type);
-- ───────────────────────────────────────────────────────────────────────────
