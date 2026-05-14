-- 009_stripe_events.sql
-- Chapter 1 / Build step 7
-- Idempotency dedup for the Stripe webhook. event_id is the Stripe-issued
-- unique id (evt_*) — inserting it twice is the signal that we have
-- already processed this delivery and should skip.

create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  payload jsonb
);

alter table public.stripe_events enable row level security;

-- No user-facing policies. Service role writes only. No reads from clients.
-- The Supabase REST API requires the service role to bypass RLS, which the
-- webhook does naturally. Anon/authenticated roles have no policies, so any
-- request from a client returns empty.

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- drop table if exists public.stripe_events;
-- ───────────────────────────────────────────────────────────────────────────
