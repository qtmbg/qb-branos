-- 003_artifact_runs.sql
-- Chapter 1 / Build step 1
-- Audit log for agent runs. One row per agent invocation. Service role
-- writes only. Users read only their own runs via the artifacts FK.

create table if not exists public.artifact_runs (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  agent_slug text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  error text,
  duration_ms int,
  model text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);

alter table public.artifact_runs enable row level security;

drop policy if exists "Users can read own artifact runs" on public.artifact_runs;
create policy "Users can read own artifact runs"
  on public.artifact_runs for select
  using (
    exists (
      select 1 from public.artifacts a
      where a.id = artifact_runs.artifact_id
        and a.user_id = auth.uid()
    )
  );

-- No insert/update/delete policies. Service role bypasses RLS.

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- drop table if exists public.artifact_runs;
-- ───────────────────────────────────────────────────────────────────────────
