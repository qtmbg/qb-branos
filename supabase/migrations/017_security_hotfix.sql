-- Migration 017 · security hotfix
-- Out-of-band response to Supabase advisor alert (17 May 2026).
-- Closes:
--   · ERROR  rls_disabled_in_public  · repro_runs, repro_children
--   · ERROR  security_definer_view   · user_access, funnel_snapshot
--   · WARN   function_search_path_mutable · five functions
-- Manual operator step (NOT in this migration):
--   · Enable Auth → "Leaked password protection" toggle in the dashboard.

begin;

-- ─── 1 · user_access · SECURITY INVOKER + revoke anon ─────────────────────────
-- View was running as the postgres owner, bypassing RLS on profiles. Recreated
-- as SECURITY INVOKER so the existing `auth.uid() = id` policy on profiles
-- applies to callers. anon SELECT revoked as belt+suspenders.

drop view if exists public.user_access;

create view public.user_access
  with (security_invoker = true) as
  select
    id,
    email,
    tier,
    subscription_status,
    case
      when subscription_status = 'active'
       and tier = any (array['starter','pro','agency'])
      then true else false
    end as has_access,
    case
      when tier = any (array['pro','agency'])
      then true else false
    end as has_panel_access,
    case
      when tier = 'agency'
      then true else false
    end as has_agency_access
  from public.profiles;

revoke all on public.user_access from anon;
grant select on public.user_access to authenticated;
-- service_role is implicit and bypasses RLS for server-side reads.

-- ─── 2 · funnel_snapshot · SECURITY INVOKER + revoke anon + authenticated ─────
-- Ops/analytics view. No application code reads it (grep clean). Locking down
-- to service_role only. SECURITY INVOKER plus revoke is belt+suspenders;
-- service_role bypasses RLS so admin queries still return all rows.

drop view if exists public.funnel_snapshot;

create view public.funnel_snapshot
  with (security_invoker = true) as
  select
    drip_stage,
    signup_source,
    count(*)::integer as users,
    avg((
      select count(*)
      from jsonb_object_keys(coalesce(profiles.tool_completions, '{}'::jsonb))
    )) as avg_tools_completed
  from public.profiles
  group by drip_stage, signup_source;

revoke all on public.funnel_snapshot from anon, authenticated;

-- ─── 3 · drop the repro_* diagnostic tables ───────────────────────────────────
-- Created out-of-band for Chapter 2 Step 1 PR #59 reproduction harness.
-- 10 rows in repro_runs, 40 in repro_children, no PII. Diagnostic complete.
-- Test endpoints and runner deleted in the same branch.

drop table if exists public.repro_children;
drop table if exists public.repro_runs;

-- ─── 4 · pin search_path on the five flagged functions ────────────────────────
-- Prevents search_path injection on SECURITY DEFINER functions and is hygiene
-- on the SECURITY INVOKER trigger function.

alter function public.handle_new_user()
  set search_path = public, pg_temp;
alter function public.merge_completions(p_user_id uuid, p_patch jsonb)
  set search_path = public, pg_temp;
alter function public.merge_qbp(p_user_id uuid, p_patch jsonb)
  set search_path = public, pg_temp;
alter function public.record_tool_completion(p_user_id uuid, p_tool_id text)
  set search_path = public, pg_temp;
alter function public.set_updated_at()
  set search_path = public, pg_temp;

commit;
