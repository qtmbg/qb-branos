-- 010_dispatch_jobs.sql
-- Chapter 1 / Step 18 PR 1 (async dispatch + polling).
--
-- Adds:
--   1. public.dispatch_jobs (id, user_id, kind, status, created_at, completed_at)
--   2. public.artifacts.dispatch_id (uuid, references dispatch_jobs.id)
--
-- Purpose: decouple synchronous Edge function invocation from agent
-- production. Lock and regenerate endpoints insert a job row + the
-- placeholder artifact rows, fan out to the agent dispatcher without
-- awaiting, and return 202 immediately. The agent dispatcher updates
-- the artifact row status as it runs. The client polls /api/artifacts
-- (filtered by dispatch_id or by the lock timestamp) to watch state.
--
-- RLS: user can SELECT own dispatch_jobs. INSERT/UPDATE remain service
-- role only (the API does the write).

-- ─── dispatch_jobs table ───────────────────────────────────────────────────
create table if not exists public.dispatch_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,
  status        text not null default 'queued',
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  constraint dispatch_jobs_kind_check
    check (kind in ('lock', 'regenerate')),
  constraint dispatch_jobs_status_check
    check (status in ('queued', 'producing', 'completed', 'partial', 'failed'))
);

create index if not exists dispatch_jobs_user_id_idx
  on public.dispatch_jobs (user_id, created_at desc);

alter table public.dispatch_jobs enable row level security;

-- User can SELECT own jobs.
drop policy if exists "Users can read own dispatch_jobs" on public.dispatch_jobs;
create policy "Users can read own dispatch_jobs"
  on public.dispatch_jobs for select
  using (auth.uid() = user_id);

-- ─── artifacts.dispatch_id column ─────────────────────────────────────────
alter table public.artifacts
  add column if not exists dispatch_id uuid references public.dispatch_jobs(id) on delete set null;

create index if not exists artifacts_dispatch_id_idx
  on public.artifacts (dispatch_id);

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- drop index if exists public.artifacts_dispatch_id_idx;
-- alter table public.artifacts drop column if exists dispatch_id;
-- drop policy if exists "Users can read own dispatch_jobs" on public.dispatch_jobs;
-- drop table if exists public.dispatch_jobs;
-- ───────────────────────────────────────────────────────────────────────────
