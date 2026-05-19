# Chapter 2 · Step 8 spec outline

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §6 below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §5.4 (chain orchestration), §3.5 (agent contract), §13.9 (build sequence step 9 · chain orchestration). Step 7 closure forward references.

Branch: `chapter-2/step-8-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 8 wires the chain-orchestration logic per §5.4. When `/api/agents/run` finishes a successful delivery, it looks up downstream agents whose `artifact_dependencies` include the just-delivered agent's slug, checks their other dependencies, and auto-fires them via `/api/agents/run` with `trigger='chain'`. Tier-gating enforced.

Chapter 2 has no Phase 02 synthesizers. The framework is testable via a feature-flagged synthetic test agent that exists in the registry only when `process.env.CHAIN_TEST_AGENT === '1'` (or similar). The synthetic agent has dependencies on one or more Phase 01 slugs and produces a deterministic delivered artifact. The verification harness uses this synthetic agent to exercise the chain path end-to-end without polluting prod with a Phase 02 stub.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Chain trigger logic in `/api/agents/run` | §5.4 | After a successful delivery, dispatch satisfied downstream agents |
| `trigger='chain'` runtime path | §3.3 | Already enumerated in the trigger enum; verify end-to-end |
| Tier-gate short-circuit | §5.4 + tier-gating module | Free users skip chain triggers; starter+ fires them |
| Synthetic test agent | step-8-spec §1 (this doc) | Feature-flagged dev-only agent to exercise the chain path |

§13 items deferred out of step 8:
- §13.13 Foundation `?upgrade=success` banner.
- §13.14 `/api/agents/dispatch` retirement.
- Real Phase 02 synthesizers (Chapter 4).

Prerequisites met (carried from step 6 + 7):
- `INTER_EDGE_SECRET` live in Vercel Production.
- `CRON_SECRET` live in Vercel Production.
- Vercel Pro tier active.
- Lock + regen Option A pattern verified.
- Reaper cron live + verified.
- Notification bell live + Realtime path verified.

---

## 2. Deliverable surfaces

### 2.1 Chain trigger in `/api/agents/run`

Per §5.4. After a successful delivery on `/api/agents/run`:

1. Look up `agents/registry.js` for agents whose `inputs.dependencies` (slug list) includes the just-delivered agent's slug.
2. For each candidate downstream agent:
   - Check that all OTHER dependencies are also satisfied (latest delivered for the user).
   - Check tier gating · `canRun(profile.tier, downstream_slug)` returns true.
   - Check no in-flight dispatch for the downstream agent (avoid double-fire under reaper retry conditions).
3. For each satisfied downstream agent: insert a `dispatch_jobs` row with `kind='chain'`, `parent_agent_slug=<upstream>`, then `fireChildRuns` with the new run.

The chain trigger fan-out uses the same `dispatch-pattern.js` helper as lock-foundation + regenerate. Single source of truth for Option A invariants.

### 2.2 `parent_agent_slug` column on `dispatch_jobs`

Per §4.2 the dispatch_jobs table already has `kind`, `trigger`, `retry_count`, `last_retry_at`, `agent_version`. Need to confirm whether `parent_agent_slug` exists. Migration 012 extension may have included it; if not, migration 016 adds it.

### 2.3 `agents/registry.js` synthetic test agent (feature-flagged)

A new dev-only agent that:
- Has `inputs.dependencies = ['soul_map_synthesizer', 'sensescape_synthesizer']` (or similar).
- Produces a deterministic delivered artifact (no real Claude call · just writes a fixed JSON).
- Only loads when `process.env.CHAIN_TEST_AGENT === '1'`.
- Slug: `chain_test_agent` (or similar; spec defaults to this).

The harness sets the env var via the verification environment. Prod has no such env var, so the agent never appears in the registry. Open call · agent slug + dependency set.

### 2.4 Verification harness

`tests/chapter-02/chain-orchestration.mjs` covers:
1. Lock fires four Phase 01 synthesizers (existing path).
2. As each completes, `/api/agents/run` checks for downstream agents with deps including the completing slug. None exist in prod registry → no fan-out.
3. With `CHAIN_TEST_AGENT=1` set in the verification environment, the synthetic agent loads. Its deps are `[soul_map_synthesizer, sensescape_synthesizer]`. When BOTH deliver, the chain-trigger fires.
4. Verify: `chain_test_agent` artifact appears with `dispatch_jobs.kind='chain'`, `parent_agent_slug=<the-last-completing-dep-slug>`, `agent_runs.trigger='chain'`.

Acceptance: 5/5 lock runs where the synthetic agent correctly fires after deps deliver. Tier-gating verified by also running the same harness with a free-tier user · synthetic agent does NOT fire.

---

## 3. Sub-PR breakdown

Step 8 is moderate-scope. Proposed phasing:

| Sub-PR | Topic |
| --- | --- |
| 8A | Chain trigger logic in `/api/agents/run` + `dispatch_jobs.parent_agent_slug` column (migration 016 if needed) |
| 8B | Synthetic test agent + feature-flag wiring in `agents/registry.js` |
| 8C | Tier-gate short-circuit + verification harness · `chain-orchestration.mjs` 5/5 |
| 8D | Step 8 closure report |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass.

---

## 4. Acceptance criteria

Per §13.9 + §11.4 (chain orchestration):

1. **Chain trigger fires on satisfied deps** · synthetic test agent with deps `[soul_map_synthesizer, sensescape_synthesizer]` produces a delivered artifact after BOTH deps deliver. `dispatch_jobs.kind='chain'`, `parent_agent_slug=<last-completing-dep>`, `agent_runs.trigger='chain'`.
2. **No fan-out when deps unsatisfied** · if only one of two deps has delivered, chain does NOT fire. Verified by sequencing.
3. **No double-fire under reaper retry** · if a parent dispatch gets retried by the reaper and re-delivers, the chain does NOT fire a second time. Idempotency check via existing in-flight detection on the downstream agent.
4. **Tier-gate short-circuit** · free user completes Phase 01 with synthetic agent in registry; chain does NOT fire (canRun returns false for starter-only synthetic). Starter user with same setup · chain DOES fire.
5. **No regression on existing dispatch paths** · 7A rerun-conformance 10/10 still passes · 7C bell-realtime 5/5 still passes · step 6E 15-state capture matrix still re-fires green.

---

## 5. Six open calls for Nizzar adjudication

1. **Synthetic test agent slug + dependency set.** Default outline: slug `chain_test_agent`, deps `[soul_map_synthesizer, sensescape_synthesizer]`. Two deps test the multi-dep satisfaction logic; three deps would over-stress without proportional coverage. Override if you want a different slug or dep set.

2. **Synthetic agent persistence.** Default: feature-flagged via `CHAIN_TEST_AGENT=1` env var. Production has no such env var, agent never loads. Override if you want a different gating mechanism (e.g., a chain_test_agents migration table that the agent registry reads from).

3. **`parent_agent_slug` column.** Default outline checks migration 012 for whether the column exists. If not, migration 016 adds it. Spec §5.4 implies it as part of chain-trigger metadata. Override if you have a different chain-history storage preference (e.g., link via a chain_id with full ancestry traversal vs immediate-parent slug only).

4. **Reaper interaction.** Default outline: chain triggers fire INSIDE `/api/agents/run` after successful delivery. If the parent dispatch gets retried by the reaper and re-delivers, the chain trigger's idempotency check (in-flight on downstream agent) prevents double-fire. Override if you want explicit per-(parent_dispatch_id, downstream_slug) idempotency tracking in dispatch_jobs metadata.

5. **Chain depth.** Default: chain can be N-deep. The trigger logic is recursive · a chain-triggered agent's successful delivery can fan out to ITS downstream agents. No depth limit at framework layer. Override if you want a depth cap (e.g., max 5 levels) to prevent runaway chains.

6. **Notification scope.** Default outline: no notification fires on chain delivery. The `chain_ready` notification kind exists in the `notifications.kind` enum (migration 013) but has no emitter in steps 6-8. Defer the emitter to a later step or to Chapter 4 when real Phase 02 synthesizers ship. Override if you want a `chain_ready` notification to fire on every successful chain-triggered delivery starting in step 8.

---

## 6. Out of scope

Explicit:

- Phase 02+ synthesizer retrofit (Chapter 4).
- Real Phase 02 agents in `agents/registry.js` (Chapter 4).
- `/api/agents/dispatch.js` retirement (step 14).
- Foundation `?upgrade=success` banner (step 13).
- Archive UI tree-view for branched chains (step 9 forward note from step 7 closure).
- Notification preferences UI (CHAPTER_02_SPEC.md §14.4 explicit out-of-scope).
- DAG view in Agent Console (CHAPTER_02_SPEC.md §14.3 explicit out-of-scope).
- `chain_ready` notification emitter (open call #6 above defers).
- Chain depth limit (open call #5 defaults to no limit).

---

## 7. Forward references

- **Step 9** archive UI tree-view rendering. Surfaced as step 7 forward note. Step 8 may also surface chain-history-needs-tree-view findings.
- **Step 13** Foundation `?upgrade=success` banner.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **Chapter 4** Phase 02 synthesizers (Logo Direction, Logo Evaluation, Voice Guide) become the first real chain consumers.

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch.
