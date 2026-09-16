-- Migration 023 · security hotfix · public.tool_completions
--
-- Supabase advisor: ERROR rls_disabled_in_public · public.tool_completions.
--
-- Finding (empirical probe, 2026-09-16, anon key against the live REST API):
--   GET /rest/v1/tool_completions?select=*  → HTTP 206, 8 of 8 rows returned.
--   PATCH and DELETE with an impossible filter → HTTP 204, not 42501.
--   Anonymous callers could read, edit and delete every row in the table.
--
-- Cause: migration 005 declares `enable row level security` plus three
-- user-scoped policies on this table, but 005 was never applied to
-- production. Same class of divergence as the 018 → 021 reconcile. The
-- repo said the table was protected; the database disagreed.
--
-- Exposure assessed before writing this file: 8 rows, two user_ids, both
-- founder test accounts, qbp_snapshot holding "Test Brand" placeholder
-- copy. No customer data. The write and delete grants are the live risk,
-- not the read.
--
-- The table is a secondary historical record. Grep across api/, js/ and
-- the page HTML finds no reader and no writer: every `tool_completions`
-- reference in application code is the profiles.tool_completions JSONB
-- column, written through the record_tool_completion RPC. Migration 005
-- says the same in its own header. Nothing breaks when anon loses access.
--
-- Apply via the Supabase SQL editor against project yushbxjwfhuokaezoioe,
-- then re-run tests/supabase-rls/rls-probe.mjs and expect anon_rows = 0.
-- Every step is idempotent and safe to run after a late 005.

begin;

-- ─── 1 · the fix ─────────────────────────────────────────────────────────

alter table public.tool_completions enable row level security;

-- ─── 2 · re-issue 005's policies ─────────────────────────────────────────
-- Idempotent: dropped by name first, so a late 005 application leaves no
-- duplicate. auth.uid() = user_id scopes every row to its owner.
-- service_role bypasses RLS, so server-side reads are unaffected.

drop policy if exists "Users can read own tool completions" on public.tool_completions;
create policy "Users can read own tool completions"
  on public.tool_completions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own tool completions" on public.tool_completions;
create policy "Users can insert own tool completions"
  on public.tool_completions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own tool completions" on public.tool_completions;
create policy "Users can update own tool completions"
  on public.tool_completions for update
  using (auth.uid() = user_id);

-- No delete policy. 005 defined none, and a historical record should not
-- be erasable by the client. With RLS on and no policy, delete returns
-- zero rows for every non-service caller.

-- ─── 3 · revoke the anon grants · belt and suspenders ────────────────────
-- Supabase grants anon and authenticated blanket table privileges in the
-- public schema. RLS alone is the gate; revoking write from anon means a
-- future `disable row level security` does not silently reopen the hole.
-- Matches the pattern used on the two views in migration 017.

revoke all on public.tool_completions from anon;
grant select on public.tool_completions to authenticated;

-- ─── 4 · the constraint 005 never installed ──────────────────────────────
-- 005 was not applied, so its unique constraint is absent too. Re-issued
-- here verbatim in intent: dedupe first, retaining the earliest row per
-- (user_id, tool_name), then add the constraint.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tool_completions_user_tool_key'
      and conrelid = 'public.tool_completions'::regclass
  ) then
    delete from public.tool_completions a
    using public.tool_completions b
    where a.user_id = b.user_id
      and a.tool_name = b.tool_name
      and a.created_at > b.created_at;

    alter table public.tool_completions
      add constraint tool_completions_user_tool_key unique (user_id, tool_name);
  end if;
end $$;

commit;

-- ─── DOWN MIGRATION ──────────────────────────────────────────────────────
-- alter table public.tool_completions disable row level security;
-- grant all on public.tool_completions to anon;
-- ─────────────────────────────────────────────────────────────────────────
