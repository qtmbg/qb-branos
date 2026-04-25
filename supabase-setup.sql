-- ────────────────────────────────────────────────────────────────────────────
-- QB BRANDOS — FUNNEL v1 SCHEMA
-- Idempotent. Safe to run multiple times. Safe to run on a fresh project
-- (creates the profiles table) or against an existing project (extends it).
-- Run in Supabase Dashboard → SQL Editor.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. PROFILES TABLE ─────────────────────────────────────────────────────────
-- Created if missing. The id column is the auth user id, so RLS keys off it.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  qbp jsonb default '{}'::jsonb,
  tier text default 'free',
  subscription_status text default 'inactive',
  stripe_customer_id text
);

-- Funnel/identity fields
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists signup_source text,
  add column if not exists tool_completions jsonb default '{}'::jsonb,
  add column if not exists drip_stage text default 'pre_signup',
  add column if not exists last_active_at timestamptz default now(),
  add column if not exists klaviyo_synced boolean default false;

-- Indexes for funnel + reactivation queries
create index if not exists idx_profiles_drip_stage      on public.profiles(drip_stage);
create index if not exists idx_profiles_last_active     on public.profiles(last_active_at desc);
create index if not exists idx_profiles_signup_source   on public.profiles(signup_source);
create index if not exists idx_profiles_tier            on public.profiles(tier);
create index if not exists idx_profiles_subscription    on public.profiles(subscription_status);

-- 2. ROW LEVEL SECURITY ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Drop+recreate policies so re-runs leave a clean state
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 3. handle_new_user TRIGGER ────────────────────────────────────────────────
-- Captures first_name + signup_source from the signup metadata that
-- qb-cloud.js sends when calling /auth/v1/otp.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    email,
    first_name,
    signup_source,
    drip_stage,
    last_active_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'signup_source', 'unknown'),
    'gate_signup',
    now()
  )
  on conflict (id) do update set
    first_name    = coalesce(excluded.first_name,    public.profiles.first_name),
    signup_source = coalesce(excluded.signup_source, public.profiles.signup_source),
    last_active_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. RPC: record_tool_completion ────────────────────────────────────────────
-- Bumps tool_completions and last_active when a tool finishes. Called from
-- qb-cloud.js → recordCompletion().
create or replace function public.record_tool_completion(
  p_user_id uuid,
  p_tool_id text
)
returns void as $$
begin
  -- Caller must be the same user (defense in depth on top of RLS)
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  update public.profiles
  set
    tool_completions = coalesce(tool_completions, '{}'::jsonb)
                       || jsonb_build_object(p_tool_id, now()::text),
    last_active_at = now()
  where id = p_user_id;
end;
$$ language plpgsql security definer;

grant execute on function public.record_tool_completion(uuid, text) to authenticated;

-- 5. updated_at TRIGGER ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 6. ADMIN VIEW: funnel_snapshot ────────────────────────────────────────────
-- Aggregated counts by drip_stage + signup_source. Read-only. Useful for
-- Supabase Studio dashboards. Not exposed to the client.
create or replace view public.funnel_snapshot as
  select
    drip_stage,
    signup_source,
    count(*)::int as users,
    avg((select count(*) from jsonb_object_keys(coalesce(tool_completions, '{}'::jsonb)))) as avg_tools_completed
  from public.profiles
  group by drip_stage, signup_source;

-- ────────────────────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────────────────────
