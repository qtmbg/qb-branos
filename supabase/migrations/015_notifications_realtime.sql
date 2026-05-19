-- 015_notifications_realtime.sql
-- Chapter 2 · Step 7C
--
-- Add public.notifications to the supabase_realtime publication so
-- INSERT and UPDATE events flow through Supabase Realtime to the
-- notification-bell subscribers. Without this, the postgres_changes
-- replication source has no notifications table and clients silently
-- never receive events (channel SUBSCRIBED status fires, but no event
-- handlers ever invoke).
--
-- Surfaced during step 7C gate 3/4 verification · the harness saw
-- SUBSCRIBED in 1111 ms but INSERT events never propagated to the
-- bell badge. Root cause was the publication missing this table.
--
-- Migration 013 created the table + RLS but did NOT add it to the
-- Realtime publication. Step 6D shipped the bell as a poll-only
-- consumer, so the publication gap stayed hidden until step 7C
-- wired the Realtime path.

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      execute 'alter publication supabase_realtime add table public.notifications';
    end if;
  end if;
end$$;

-- Idempotent: re-running the migration is a no-op once the table is
-- in the publication.
