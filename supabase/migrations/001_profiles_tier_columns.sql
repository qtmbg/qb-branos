-- 001_profiles_tier_columns.sql
-- Chapter 1 / Build step 1
-- Adds tier_started_at, enum CHECK on tier, confirms foundation_locked_at.
--
-- Spec section 4.1 references a column `qbp_jsonb`. The existing schema has
-- `qbp` (jsonb) which serves the same purpose and is read/written by
-- api/lock-foundation.js, api/agents/dispatch.js, the merge_qbp RPC, and
-- js/qb-cloud.js. Per spec 4.1 ("Existing columns preserved") the existing
-- column is the canonical store; no rename or duplicate column is added.
-- The semantic contract matches the spec exactly.

alter table public.profiles
  add column if not exists tier_started_at timestamptz;

alter table public.profiles
  alter column tier set default 'free';

-- Enum CHECK on tier. Idempotent via drop-and-recreate.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_tier_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_tier_check;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_tier_check
  check (tier in ('free', 'starter', 'pro', 'agency', 'atelier'));

-- foundation_locked_at already exists from the prior funnel migration.
-- Defensive re-declaration is a no-op on a column that's already present.
alter table public.profiles
  add column if not exists foundation_locked_at timestamptz;

-- RLS already enabled on profiles (prior migration). Policies already
-- enforce auth.uid() = id for select/update/insert. No policy change here.

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- alter table public.profiles drop constraint if exists profiles_tier_check;
-- alter table public.profiles drop column if exists tier_started_at;
-- -- foundation_locked_at is owned by an earlier migration; do not drop here.
-- ───────────────────────────────────────────────────────────────────────────
