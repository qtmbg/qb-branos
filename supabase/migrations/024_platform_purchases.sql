-- 024_platform_purchases.sql
-- Recut Phase 5 · docs/strategy/brandos-recut-v1.md
--
-- The recut replaced subscription tiers with one one-time purchase: the
-- Platform, the A4 brand document, bought per brand. Entitlement is
-- therefore a fact about a purchase, not a string on a profile.
--
-- NOT YET APPLIED TO PRODUCTION. Migrations 005, 018, 021 and 022 are
-- already known to be unapplied there, so nothing may assume this table
-- exists. api/_lib/entitlements.js treats a missing table as "owns
-- nothing" and says so in its reason, which is the safe direction: a
-- misconfigured deploy sells nothing rather than giving everything away.

create table if not exists public.platform_purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  -- One purchase entitles one brand. 'default' until multi-brand exists,
  -- so the column is here from the start and no backfill is needed later.
  brand_key          text not null default 'default',
  stripe_session_id  text not null,
  stripe_payment_intent text,
  amount_total       integer,
  currency           text,
  created_at         timestamptz not null default now()
);

-- Idempotency. Stripe retries webhooks, and a retry must not create a
-- second purchase row or a second entitlement.
create unique index if not exists platform_purchases_session_unique
  on public.platform_purchases (stripe_session_id);

-- The entitlement lookup is (user_id, brand_key) on every gated read.
create index if not exists platform_purchases_user_brand
  on public.platform_purchases (user_id, brand_key);

alter table public.platform_purchases enable row level security;

-- A user reads their own purchases and nothing else. Writes come from
-- the webhook on the service role, which bypasses RLS, so there is
-- deliberately no insert or update policy for authenticated users.
drop policy if exists platform_purchases_select_own on public.platform_purchases;
create policy platform_purchases_select_own
  on public.platform_purchases
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No anon policy at all. The 2026-09-16 tool_completions incident was an
-- anon hole on a table that looked harmless; this one holds payment
-- records, so anon gets nothing.
