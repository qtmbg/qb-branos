-- 004_qbp_revisions.sql
-- Chapter 1 / Build step 1
-- Snapshots of profiles.qbp at meaningful events. Service role writes only.
-- Users read only their own snapshots.

create table if not exists public.qbp_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_jsonb jsonb not null default '{}'::jsonb,
  trigger_event text not null check (trigger_event in (
    'exercise_complete',
    'foundation_locked',
    'tier_upgraded',
    'manual_save',
    'backfill'
  )),
  trigger_detail text,
  created_at timestamptz not null default now()
);

alter table public.qbp_revisions enable row level security;

drop policy if exists "Users can read own qbp revisions" on public.qbp_revisions;
create policy "Users can read own qbp revisions"
  on public.qbp_revisions for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies. Service role bypasses RLS.

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- drop table if exists public.qbp_revisions;
-- ───────────────────────────────────────────────────────────────────────────
