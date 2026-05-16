-- 014_agent_runs_schema_retry_count.sql
-- Chapter 2 / Step 4 · adds schema_retry_count to agent_runs.
--
-- Per CHAPTER_02_SPEC.md §5.2 step 8 (amended) + §6.6.1: the runtime
-- annotates every agent_runs row with the number of Claude call attempts
-- the schema-validate-and-retry loop made. Increments per attempt, not
-- per final outcome. With all four Chapter 2 agents at retry_budget: 0,
-- the column is always 0 today · the value lights up if a future agent
-- declares retry_budget > 0 (Chapter 3+ when streaming/async runtime
-- dissolves the per-call wall constraint).
--
-- §6.6.1 Agent Console surfaces a 7-day rolling average of this column.
-- The column is read on every Console load.
--
-- Nullable + default 0. Existing legacy rows (backfilled in migration
-- 011) get 0 implicitly.

alter table public.agent_runs
  add column if not exists schema_retry_count int not null default 0;

-- ─── DOWN MIGRATION ────────────────────────────────────────────────────────
-- alter table public.agent_runs drop column if exists schema_retry_count;
-- ───────────────────────────────────────────────────────────────────────────
