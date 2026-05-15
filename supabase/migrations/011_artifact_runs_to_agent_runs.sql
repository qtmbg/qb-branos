-- 011_artifact_runs_to_agent_runs.sql
-- Chapter 2 / Step 2 · agent framework data model.
--
-- Renames public.artifact_runs to public.agent_runs and adds the columns
-- the framework needs:
--   - dispatch_id  · fk to dispatch_jobs (nullable for manual runs)
--   - agent_version · matches META.version at run time
--   - user_id      · for direct RLS lookup (no artifact join)
--   - trigger      · enum matching agent run trigger
--   - qbp_snapshot · frozen copy of profiles.qbp at run start (replay)
--   - file_refs    · array of file refs (empty until Chapter 3)
--   - runtime_args · the args this run received (replay)
--   - started_at, completed_at · explicit lifecycle timestamps
--
-- Existing artifact_runs rows are preserved. Backfill:
--   - dispatch_id → NULL (legacy runs were not in a dispatch_jobs context)
--   - agent_version → 1 (no version field existed in Chapter 1)
--   - user_id → joined from the artifact's user_id
--   - trigger → 'lock' (most legacy runs came from lock-foundation)
--   - qbp_snapshot → NULL (Chapter 1 did not capture; replay disabled
--     for legacy artifacts per spec §6.4 and §11.5)
--   - file_refs → '[]'
--   - runtime_args → '{}'
--   - started_at → created_at
--   - completed_at → created_at if status in ('succeeded','failed') else null
--
-- The error column was text in Chapter 1; spec §4.1 calls for jsonb.
-- We add error_payload jsonb alongside, backfill from the legacy text,
-- and from this migration forward writers use error_payload. The legacy
-- error column stays for one chapter for read compatibility, dropped in
-- a future migration once all callers are confirmed using error_payload.

-- 1. Rename the table.
alter table public.artifact_runs rename to agent_runs;

-- 2. Add new columns. All nullable for backfill, then we tighten where appropriate.
alter table public.agent_runs
  add column if not exists dispatch_id     uuid,
  add column if not exists agent_version   int,
  add column if not exists user_id         uuid,
  add column if not exists trigger         text,
  add column if not exists qbp_snapshot    jsonb,
  add column if not exists file_refs       jsonb default '[]'::jsonb,
  add column if not exists runtime_args    jsonb default '{}'::jsonb,
  add column if not exists started_at      timestamptz,
  add column if not exists completed_at    timestamptz,
  add column if not exists error_payload   jsonb;

-- 3. Backfill from the artifact's user_id.
update public.agent_runs r
   set user_id = a.user_id
  from public.artifacts a
 where r.artifact_id = a.id
   and r.user_id is null;

-- 4. Backfill agent_version, trigger, started_at, completed_at, error_payload.
update public.agent_runs
   set agent_version = coalesce(agent_version, 1),
       trigger       = coalesce(trigger, 'lock'),
       started_at    = coalesce(started_at, created_at),
       completed_at  = case
                         when completed_at is not null then completed_at
                         when status in ('succeeded', 'failed') then created_at
                         else null
                       end,
       error_payload = case
                         when error_payload is not null then error_payload
                         when error is null then null
                         when error ~ '^\s*[{\[]' then error::jsonb
                         else jsonb_build_object('message', error)
                       end;

-- 5. NOT NULL on the columns that must be filled.
alter table public.agent_runs
  alter column user_id        set not null,
  alter column agent_version  set not null,
  alter column trigger        set not null,
  alter column started_at     set not null,
  alter column file_refs      set default '[]'::jsonb,
  alter column runtime_args   set default '{}'::jsonb;

-- 6. Strict CHECK on trigger enum (matches §3.3 + §5.2 enum).
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'agent_runs_trigger_check'
       and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs drop constraint agent_runs_trigger_check;
  end if;
end $$;
alter table public.agent_runs
  add constraint agent_runs_trigger_check
  check (trigger in ('lock', 'chain', 'manual', 'regenerate', 'scheduled'));

-- 7. dispatch_id FK. ON DELETE SET NULL · we keep the run record even if
-- the dispatch_jobs row is deleted (which only happens via cascade from
-- auth.users.delete).
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'agent_runs_dispatch_id_fkey'
       and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs drop constraint agent_runs_dispatch_id_fkey;
  end if;
end $$;
alter table public.agent_runs
  add constraint agent_runs_dispatch_id_fkey
  foreign key (dispatch_id) references public.dispatch_jobs(id) on delete set null;

-- 8. user_id FK matches dispatch_jobs · cascade on auth.users delete.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'agent_runs_user_id_fkey'
       and conrelid = 'public.agent_runs'::regclass
  ) then
    alter table public.agent_runs drop constraint agent_runs_user_id_fkey;
  end if;
end $$;
alter table public.agent_runs
  add constraint agent_runs_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 9. Indexes for the common query paths.
create index if not exists agent_runs_user_id_started_at_idx
  on public.agent_runs (user_id, started_at desc);
create index if not exists agent_runs_dispatch_id_idx
  on public.agent_runs (dispatch_id);
create index if not exists agent_runs_artifact_id_idx
  on public.agent_runs (artifact_id);

-- 10. RLS policy · drop the old (was named for artifact_runs), recreate
-- with a direct user_id check (faster than joining artifacts).
drop policy if exists "Users can read own artifact runs" on public.agent_runs;
drop policy if exists "Users can read own agent runs" on public.agent_runs;
create policy "Users can read own agent runs"
  on public.agent_runs for select
  using (auth.uid() = user_id);

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- alter table public.agent_runs rename to artifact_runs;
-- alter table public.artifact_runs drop column if exists error_payload;
-- alter table public.artifact_runs drop column if exists completed_at;
-- alter table public.artifact_runs drop column if exists started_at;
-- alter table public.artifact_runs drop column if exists runtime_args;
-- alter table public.artifact_runs drop column if exists file_refs;
-- alter table public.artifact_runs drop column if exists qbp_snapshot;
-- alter table public.artifact_runs drop column if exists trigger;
-- alter table public.artifact_runs drop column if exists user_id;
-- alter table public.artifact_runs drop column if exists agent_version;
-- alter table public.artifact_runs drop column if exists dispatch_id;
-- (recreate old RLS policy on artifact_runs)
-- ───────────────────────────────────────────────────────────────────────────
