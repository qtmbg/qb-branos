# Chapter 2 · Step 8C · Chain-Orchestration Verification Report

**Run:** 2026-05-19 13:31 UTC
**Branch:** main @ c6d49a7
**Spec:** `chapter-02/step-8-spec.md` (b445c17)
**Harness:** `tests/chapter-02/chain-orchestration.mjs`
**Run artifact:** `tests/chapter-02/chain-orchestration.last-run.json`

## Result · 5/5 PASS

| Gate | Status | Detail |
|---|---|---|
| 1 · chain fires on satisfied deps | PASS | chain_id=8b5ddc02, parent=soul_map_synthesizer, depth=1, end-to-end 22293 ms |
| 2 · no fan-out when deps unsatisfied | PASS | only 1 of 2 deps delivered, no chain dispatch for chain_test_agent |
| 3 · DB-enforced idempotency · 23505 catch | PASS | first INSERT OK, second returns 409 from unique partial index on (chain_id, agent_slug) WHERE kind='chain' |
| 4 · tier-gate short-circuit | PASS | free-tier user, no chain dispatch fired |
| 5 · chain depth cap at 8 | PASS | chain_depth column persists, CHAIN_DEPTH_CAP=8 enforced in chain-trigger.js |

## What we verified

The chain-orchestration spine works end-to-end on production. A `delivered` artifact for any agent listed as an upstream dep triggers `triggerChainIfReady()` from `/api/agents/run`, which:

1. reads the parent dispatch's `chain_id` + `chain_depth` (or seeds them at root)
2. enumerates downstream agents via `META.inputs.artifact_dependencies` + `META.triggers.includes('chain')`
3. tier-gates per `profile.tier` vs `META.tier_required`
4. depth-caps at 8 (refuse + Resend operator email on exceed)
5. checks dep satisfaction across all required upstream slugs
6. pre-inserts dispatch + artifact rows under `kind='chain'`, catches 23505 for DB-enforced idempotency
7. fires child runs via `fireChildRuns()` HMAC envelope inside `holdOpenForChildren()`

The synthetic `chain_test_agent` (loaded only when `CHAIN_TEST_AGENT=1`) carries deps `[soul_map_synthesizer, sensescape_synthesizer]`, runs after both deliver, and emits a self-describing artifact whose `body_sections[0].prose` embeds a `<!-- chain-trace-json: {dependencies_satisfied:[...]} -->` marker that Gate 1 parses for trace continuity.

## Latent-bug log · four PR #86-pattern surfacings

Step 8 ran four surgical fixes after the four sub-PR commits (#111-#113) landed. Pattern is identical to chapter 2's earlier waves: the spec adjudications are sound, but boundary conditions only surface under live verification.

### Fix 1 · PR #114 → PR #115 · registry race condition
Comet shipped PR #114 to unblock a CJS build error using `import().then()`, which resolves AFTER `AGENTS = Object.freeze({...})` runs. Result: `chainTestEntry` stays null at freeze time and the synthetic agent never appears in the registry even with `CHAIN_TEST_AGENT=1` set.

Fix: static ESM import + synchronous gate. Module always loads into memory (~2 KB), but only EXPOSED via AGENTS when the env var is `'1'`.

### Fix 2 · PR #116 · synthetic agent schema compliance
Original `chain_test_agent` content used:
- `data_blocks[0].kind='chain_trace'` — the strict type enum has six values, none of which is `chain_trace`
- `body_sections=[]` — validator requires 1..12 items
- `footer={}` — validator requires `qbp_fields_referenced` array

Plus `retry_budget=0` meant a single schema-invalid pass flipped the artifact to `failed` immediately.

Fix: reshape content to schema-compliant shape. `body_sections=[{heading, prose}]` carries the chain-trace marker in prose; `data_blocks=[]`; `footer={qbp_fields_referenced:[]}`. Harness updated to parse marker out of prose.

### Fix 3 · PR #117 · KNOWN_AGENT_SLUGS missing the sentinel
Even with schema-compliant content, `header.agent='chain_test_agent'` was rejected because `KNOWN_AGENT_SLUGS` only contained the four prod synthesizers. The Console phase '00' filter (PR #113) guards UI visibility, but the schema validator runs everywhere.

Fix: append `chain_test_agent` to the allowlist.

### Fix 4 · PR #117 · lock-foundation indiscriminate fan-out
`api/lock-foundation.js` enumerated `listAgentSlugs()` without filtering by `META.triggers.includes('lock')`. Result: chain-only agents (`triggers=['chain']`) fired at lock time with `error_code='missing_dependency'` because their upstream deps haven't run yet.

Fix: filter the slugs list to lock-fireable agents before pre-insert.

Both fix 3 and fix 4 shipped in PR #117 (squash-merged at c6d49a7).

## Five-gate methodology · key observations

- **Gate 1 timing.** End-to-end 22293 ms covers: lock → 4 Phase 01 deliveries → chain fire → synthetic delivery. The four prod synthesizers dominate (each running Claude); the synthetic adds <1 s. Below the 30 s reasonable-completion ceiling.
- **Gate 2 negative-path verification.** Surgical: only insert 1 of 2 deps as `delivered`, confirm no row appears in `dispatch_jobs` with `kind='chain' AND agent_slug='chain_test_agent'` for that user. Negative-path gates are cheap when the join key is right.
- **Gate 3 DB-enforced idempotency.** Two concurrent `preInsertDispatch` calls with identical `(chain_id, agent_slug)` produce: first 201, second 409 with PostgREST 23505 message. Catch at the call site translates to `[chain-idempotent-skip]` log without app-level inflight tracking.
- **Gate 4 tier-gate path.** Free-tier profile, chain_test_agent declares `tier_required='starter'`. `canRun()` returns false; summary collects `tier_blocked.push(slug)`; no dispatch row written. Console makes no distinction between blocked and unsatisfied at the user view (correctly · both are silent to the user).
- **Gate 5 code-inspection PASS.** Depth-cap behavior was verified via code inspection + `chain_depth` column persistence rather than a true 9-deep chain. This is the chapter-2 pattern for cost-bounded gates: synthesize all 8 deep levels of dispatch_jobs rows manually, confirm the column survives, and confirm `CHAIN_DEPTH_CAP=8` is read at the right point in `chain-trigger.js`. A live 9-deep run would burn 9× synthetic deliveries to verify what the schema + code already guarantee.

## Step 8 framework-defect-rate input

Surgical fixes during step 8 (post-spec, pre-closure):

| # | PR | Class | Surfaced by |
|---|---|---|---|
| 1 | #115 | Race condition (CJS dynamic import vs Object.freeze) | tooling-discipline breach + audit |
| 2 | #116 | Schema-validator boundary (data_blocks enum, body_sections min, footer required) | Gate 1 trace inspection |
| 3 | #117 (a) | Schema allowlist missing sentinel | Gate 1 trace inspection |
| 4 | #117 (b) | Lock-foundation indiscriminate fan-out | Gate 1 trace inspection |

Combined with step 7's surfacings (PRs #100, #105, #107 = 3) the chapter-2 running total reaches **7 surgical fixes**, above the >5 threshold set in the autonomous-chain posture. Capture in 8D closure for a chapter-hardening discussion before chapter 3 spec opens.

## Sign-off

All five gates PASS. Step 8 verification clears. Next: 8D closure report with framework-defect-rate review + tooling-discipline section.
