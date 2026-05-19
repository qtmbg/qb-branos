-- 016_dispatch_jobs_chain.sql
-- Chapter 2 · Step 8A · chain orchestration data model.
--
-- Per chapter-02/step-8-spec.md §3.
--
-- parent_agent_slug already lives on dispatch_jobs from migration 012;
-- §2.3 of the spec assumed it would be added here · audit during 8A
-- implementation confirms it's already present. No change to that column.
--
-- Adds three columns:
--   · agent_slug   · for kind='chain' (downstream agent's slug, single)
--                    AND kind='regenerate' (the rerun's slug, single).
--                    NULL on kind='lock' (multi-agent dispatch).
--                    Required for the unique-partial-index idempotency
--                    constraint that powers DB-enforced chain-fire dedup.
--   · chain_id     · groups dispatches in same fan-out tree.
--                    Seeds at lock-foundation parent (self-id).
--                    Reruns/regenerates have NULL (user-triggered, not
--                    chain-triggered).
--   · chain_depth  · 0 at lock root; +1 per chain-fire.
--                    Caps at 8 (enforced application-side in chain-
--                    trigger.js).
--
-- Plus unique partial index for DB-enforced idempotency on chain fires:
--   one (chain_id, agent_slug) per kind='chain'. Reaper-retried parents
--   that re-deliver cannot fire the same downstream twice in the same
--   chain tree.
--
-- The agent_slug addition is a §2.3-spec refinement surfaced during 8A
-- implementation · the original spec text assumed the column existed.
-- Captured in 8A verification report as "schema audit refinement, not a
-- material spec deviation."

alter table public.dispatch_jobs
  add column if not exists agent_slug   text,
  add column if not exists chain_id     uuid,
  add column if not exists chain_depth  integer not null default 0;

create unique index if not exists dispatch_jobs_chain_unique
  on public.dispatch_jobs (chain_id, agent_slug)
  where kind = 'chain';

create index if not exists dispatch_jobs_chain_id_idx
  on public.dispatch_jobs (chain_id)
  where chain_id is not null;
