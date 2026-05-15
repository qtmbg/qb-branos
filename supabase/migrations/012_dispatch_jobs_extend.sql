-- 012_dispatch_jobs_extend.sql
-- Chapter 2 / Step 2 · extend dispatch_jobs for the agent framework.
--
-- Per spec §4.2:
--   - trigger            · matches agent_runs.trigger enum
--   - parent_agent_slug  · for chain dispatches (which upstream agent fired this)
--   - agents_count       · how many agents in this dispatch (4 for lock, 1 for chain/manual/regenerate)
--   - agents_settled     · running count of agents at terminal state
--   - agent_version      · META.version at dispatch time (highest among the set
--                          for multi-agent dispatches; per-row precision lives on agent_runs.agent_version)
--   - retry_count        · int default 0; reaper increments on each retry
--   - last_retry_at      · timestamptz; reaper writes the time of the last retry
--
-- And extends the existing status CHECK to include `failed_permanently`,
-- which the reaper sets when retry_count > 3 (§5.5).
--
-- The existing `kind` CHECK is also extended to include `chain` and `manual`
-- so the runtime can record those dispatch types explicitly (§5.2, §5.4).
-- `lock` and `regenerate` remain valid; existing rows are unaffected.
--
-- Existing rows preserved. agents_count and agents_settled stay nullable
-- on Chapter 1 rows (the lock and regenerate paths from §5.1 + §5.2 set
-- them on every new row, but legacy rows have no honest value).

-- 1. Add columns.
alter table public.dispatch_jobs
  add column if not exists trigger           text,
  add column if not exists parent_agent_slug text,
  add column if not exists agents_count      int,
  add column if not exists agents_settled    int default 0,
  add column if not exists agent_version     int,
  add column if not exists retry_count       int not null default 0,
  add column if not exists last_retry_at     timestamptz;

-- 2. CHECK on trigger enum (matches agent_runs.trigger; NULL allowed for
--    legacy rows that predate the framework).
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'dispatch_jobs_trigger_check'
       and conrelid = 'public.dispatch_jobs'::regclass
  ) then
    alter table public.dispatch_jobs drop constraint dispatch_jobs_trigger_check;
  end if;
end $$;
alter table public.dispatch_jobs
  add constraint dispatch_jobs_trigger_check
  check (trigger is null or trigger in ('lock', 'chain', 'manual', 'regenerate', 'scheduled'));

-- 3. Extend kind CHECK to include 'chain' and 'manual'.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'dispatch_jobs_kind_check'
       and conrelid = 'public.dispatch_jobs'::regclass
  ) then
    alter table public.dispatch_jobs drop constraint dispatch_jobs_kind_check;
  end if;
end $$;
alter table public.dispatch_jobs
  add constraint dispatch_jobs_kind_check
  check (kind in ('lock', 'regenerate', 'chain', 'manual'));

-- 4. Extend status CHECK to include 'failed_permanently'.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'dispatch_jobs_status_check'
       and conrelid = 'public.dispatch_jobs'::regclass
  ) then
    alter table public.dispatch_jobs drop constraint dispatch_jobs_status_check;
  end if;
end $$;
alter table public.dispatch_jobs
  add constraint dispatch_jobs_status_check
  check (status in ('queued', 'producing', 'completed', 'partial', 'failed', 'failed_permanently'));

-- 5. Indexes for the reaper's hot query: producing rows that have not
--    been retried recently. status alone is selective enough at our scale;
--    a partial index keeps it cheap.
create index if not exists dispatch_jobs_producing_idx
  on public.dispatch_jobs (status, last_retry_at)
  where status = 'producing';

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- drop index if exists public.dispatch_jobs_producing_idx;
-- alter table public.dispatch_jobs drop constraint if exists dispatch_jobs_status_check;
-- alter table public.dispatch_jobs add constraint dispatch_jobs_status_check
--   check (status in ('queued', 'producing', 'completed', 'partial', 'failed'));
-- alter table public.dispatch_jobs drop constraint if exists dispatch_jobs_kind_check;
-- alter table public.dispatch_jobs add constraint dispatch_jobs_kind_check
--   check (kind in ('lock', 'regenerate'));
-- alter table public.dispatch_jobs drop constraint if exists dispatch_jobs_trigger_check;
-- alter table public.dispatch_jobs drop column if exists last_retry_at;
-- alter table public.dispatch_jobs drop column if exists retry_count;
-- alter table public.dispatch_jobs drop column if exists agent_version;
-- alter table public.dispatch_jobs drop column if exists agents_settled;
-- alter table public.dispatch_jobs drop column if exists agents_count;
-- alter table public.dispatch_jobs drop column if exists parent_agent_slug;
-- alter table public.dispatch_jobs drop column if exists trigger;
-- ───────────────────────────────────────────────────────────────────────────
