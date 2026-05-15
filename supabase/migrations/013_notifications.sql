-- 013_notifications.sql
-- Chapter 2 / Step 2 · notifications table for the in-app bell + email triggers.
--
-- Per spec §4.3 + §7. One row per notification event. Persisted across
-- sessions. User reads own rows via RLS. Service role writes (the agent
-- framework + reaper).
--
-- kind enum reflects §7.0:
--   - artifact_ready    · one per artifact transition to `delivered`
--   - chain_ready       · one per successful chain dispatch
--   - dispatch_failed   · emitted by the reaper at failed_permanently only
--   - quarterly_due     · reserved for Chapter 9; no writer in Chapter 2

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  agent_slug  text,
  artifact_id uuid references public.artifacts(id) on delete set null,
  payload     jsonb default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint notifications_kind_check
    check (kind in ('artifact_ready', 'chain_ready', 'dispatch_failed', 'quarterly_due'))
);

-- Hot query: the bell dropdown reads "last 10 by user" and "count of
-- unread by user." Cover both with one composite + one partial index.
create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- User can SELECT own notifications.
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- User can UPDATE only the read_at column on their own rows.
-- The POST /api/notifications/[id]/read endpoint goes through the service
-- role today, but adding the policy now keeps the door open for a future
-- direct-client write without another migration.
drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- drop policy if exists "Users can mark own notifications read" on public.notifications;
-- drop policy if exists "Users can read own notifications" on public.notifications;
-- drop index if exists public.notifications_user_id_unread_idx;
-- drop index if exists public.notifications_user_id_created_at_idx;
-- drop table if exists public.notifications;
-- ───────────────────────────────────────────────────────────────────────────
