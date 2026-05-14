-- 005_tool_completions_unique.sql
-- Chapter 1 / Build step 1
-- Adds unique constraint on (user_id, tool_name) per spec section 4.2.
-- Confirms RLS and user-scoped read/insert/update policies on
-- public.tool_completions.
--
-- Spec references the column as `tool_slug`. The existing column is
-- `tool_name`. Per spec 4.2 ("Existing columns preserved" intent) the
-- existing column is canonical. The semantic contract matches the spec.
--
-- Note: the active write path for completion tracking is the
-- profiles.tool_completions JSONB column via the record_tool_completion
-- RPC. The public.tool_completions table is a secondary historical record.
-- Both are confirmed live in audit.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tool_completions_user_tool_key'
      and conrelid = 'public.tool_completions'::regclass
  ) then
    -- Deduplicate rows before adding the unique constraint.
    -- Retains the earliest created_at per (user_id, tool_name).
    delete from public.tool_completions a
    using public.tool_completions b
    where a.user_id = b.user_id
      and a.tool_name = b.tool_name
      and a.created_at > b.created_at;

    alter table public.tool_completions
      add constraint tool_completions_user_tool_key unique (user_id, tool_name);
  end if;
end $$;

alter table public.tool_completions enable row level security;

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

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- alter table public.tool_completions drop constraint if exists tool_completions_user_tool_key;
-- drop policy if exists "Users can read own tool completions" on public.tool_completions;
-- drop policy if exists "Users can insert own tool completions" on public.tool_completions;
-- drop policy if exists "Users can update own tool completions" on public.tool_completions;
-- ───────────────────────────────────────────────────────────────────────────
