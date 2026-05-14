-- 008_artifacts_status_strict.sql
-- Chapter 1 / Build step 3
-- Strict CHECK constraint on artifacts.status. Lands here, not in 002,
-- because dispatch.js writes 'producing'/'ready' until this step ships.
-- After this migration applies, dispatch.js writes the new vocabulary
-- exclusively. The 007 backfill already mapped any pre-existing legacy
-- values, so no rows should violate the constraint at apply time.
--
-- Vocabulary (canonical): queued, generating, delivered, failed.
-- Default flips from 'producing' to 'queued'.

alter table public.artifacts
  alter column status set default 'queued';

-- Strict CHECK. Idempotent via drop-and-recreate.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'artifacts_status_check'
      and conrelid = 'public.artifacts'::regclass
  ) then
    alter table public.artifacts drop constraint artifacts_status_check;
  end if;
end $$;

alter table public.artifacts
  add constraint artifacts_status_check
  check (status in ('queued', 'generating', 'delivered', 'failed'));

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- alter table public.artifacts drop constraint if exists artifacts_status_check;
-- alter table public.artifacts alter column status set default 'producing';
-- ───────────────────────────────────────────────────────────────────────────
