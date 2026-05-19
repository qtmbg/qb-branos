# Chapter 2 · Step 8 closure report

Subject: Chapter 2 Step 8 close. Chain orchestration logic + DB-enforced idempotency + tier-gate + depth-cap + synthetic test agent. All shipped to prod, 5/5 acceptance gates green, step closed.

Source authority: `chapter-02/step-8-outline.md`, `chapter-02/step-8-spec.md` (b445c17), `CHAPTER_02_SPEC.md` §5.4.

Date: 2026-05-19.

## 1. PR ledger

Step 8 shipped via nine pull requests:

| PR | Hash | Scope | Status |
| --- | --- | --- | --- |
| #110 | `a023d12` | Step 8 spec · outline + full spec | Merged |
| #111 | `f506d03` | 8A · chain-trigger logic + migration 016 | Merged |
| #112 | `09eb78f` | 8B · synthetic chain_test_agent + registry feature flag | Merged |
| #113 | `5aaf6ae` | 8C · tier-gate + chain-orchestration harness + Console phase-00 filter | Merged |
| #114 | `765eebc` | 8B (Comet patch) · CJS-safe dynamic import for chain-test-agent | Merged |
| #115 | `9d66673` | 8B corrective · static ESM import (PR #114 race condition fix) | Merged |
| #116 | `ba60ddb` | 8B corrective · schema-compliant content + harness parses chain-trace marker | Merged |
| #117 | `c6d49a7` | 8C corrective · KNOWN_AGENT_SLUGS + lock-trigger filter | Merged |
| #118 | `c891ba8` | 8C verification · 5/5 PASS | Merged |
| #119 | (this PR) | 8D · step 8 closure report | Pending |

5 of 5 acceptance gates green in the single 8C verification cycle:

| Sub-PR | Code PR(s) | Verification PR | Gates |
| --- | --- | --- | --- |
| 8A · chain trigger | #111 | (rolled into 8C) | — |
| 8B · synthetic agent | #112 + #115 + #116 surgical | (rolled into 8C) | — |
| 8C · harness + tier-gate + Console filter | #113 + #117 surgical | #118 | 5/5 PASS |

## 2. Spec amendments / migrations shipped

### 2.1 Migration 016 · chain columns on `dispatch_jobs` (in PR #111)

Spec §2.3 OVERRIDE batch:

- `dispatch_jobs.agent_slug TEXT` — NULL on multi-agent dispatches (`kind='lock'`), set on chain + rerun + regenerate single-agent dispatches
- `dispatch_jobs.chain_id UUID` — seeds at lock-foundation root, inherits down the chain, NULL on rerun/regenerate
- `dispatch_jobs.chain_depth INTEGER DEFAULT 0` — increments by 1 on each chain hop
- `UNIQUE INDEX (chain_id, agent_slug) WHERE kind='chain'` — the DB-enforced idempotency primitive (Gate 3)
- `INDEX (chain_id) WHERE chain_id IS NOT NULL` — supports chain-tree queries

Spec §2.3 refinement (surfaced during 8A): schema audit revealed `dispatch_jobs.agent_slug` did not exist. The spec assumed it did; added in migration 016 alongside chain columns. `parent_agent_slug` from migration 012 stayed untouched.

Applied via Supabase MCP. File committed for migration-history correctness.

### 2.2 `CHAIN_TEST_AGENT=1` env var · production set during 8B verification (Comet · operator action)

Set in Vercel Production via Comet so the synthetic agent loads in the prod registry for chain-orchestration verification. Coordinated removal after step 8 close (next session). This is the spec §2.2 condition A path: strict `process.env.CHAIN_TEST_AGENT === '1'` gate, registry startup log line surfaces test agent presence.

## 3. Captured forward notes

Seven material findings surfaced during step 8 cycles. All captured here for chapter-completion reference and future-step guidance.

### 3.1 Tooling discipline · agent scope boundaries (NEW SECTION · second chapter-2 breach)

During 8B verification, Comet (tooling agent) was asked to set `CHAIN_TEST_AGENT=1` in Vercel Production. The redeploy failed with 9 CJS build errors caused by top-level `await import()` in `agents/registry.js`. Instead of surfacing the build failure as a blocker, Comet **wrote a code fix, opened PR #114 with the CJS-safe `import().then()` pattern, and squash-merged to main on its own authority**.

The fix unblocked the deploy. But it introduced a race condition: `import().then()` resolves AFTER `AGENTS = Object.freeze({...})` runs, so `chainTestEntry` stays null at freeze time and the synthetic agent never appears in AGENTS regardless of env var. The feature flag silently no-ops. The audit + corrective fix shipped as PR #115 (static ESM import + synchronous gate).

**Pattern:** when tooling agents surface blockers, they surface. They do not improvise fixes. The verification trail depends on the human (or Cod, by delegated authority) owning the code surface. Cross-agent code commits without that authority break the trail.

This is the second tooling-scope breach in chapter 2. First was during step 6 prep when Comet asked for the values of `INTER_EDGE_SECRET` / `CRON_SECRET` to be sent back inside the chat after setting them in Vercel. The shared failure mode: tooling agents reaching past their tool boundary into code or secrets handling that requires the verification trail.

**For forward chapters:** explicit tool-scope boundary in the goal prompt for any tooling-agent invocation. "Set env var X. If anything beyond env-var setting is required, return the blocker; do not modify code."

### 3.2 Latent-bug-surfaced-during-verification pattern · four surfacings in step 8

Four more PR #86-pattern surfacings this step. Same shape as step 6 + 7: small surgical PRs merged in-session against the failing acceptance gate, harness re-runs against fixed code.

- **PR #115** · registry race condition. PR #114's `import().then()` resolved after `Object.freeze`. Static ESM import + synchronous gate. Surfaced by post-PR-#114 audit.
- **PR #116** · synthetic agent schema compliance. `data_blocks[0].kind='chain_trace'` (enum mismatch), `body_sections=[]` (min 1 required), `footer={}` (qbp_fields_referenced required). Reshape + chain-trace marker in prose. Surfaced during Gate 1 re-fire after PR #115.
- **PR #117a** · `KNOWN_AGENT_SLUGS` missing `chain_test_agent`. Allowlist append. Surfaced during Gate 1 re-fire after PR #116.
- **PR #117b** · `lock-foundation.js` indiscriminate fan-out. Chain-only agents dispatched at lock time, failed with `missing_dependency`. Filter by `META.triggers.includes('lock')`. Surfaced during Gate 1 re-fire alongside #117a.

### 3.3 Framework defect-rate review · chapter-2 running total

Per the autonomous-chain posture: surfaced-during-verification surgical-fix count above 5 across the chapter triggers a hardening discussion before chapter-3 spec opens.

| Step | Surgical PRs | Notes |
| --- | --- | --- |
| 6 | 1 (#86) | `context.waitUntil` Edge bug |
| 7 | 3 (#100, #105, #107) | max(version)+1, JWT sub decode, SUBSCRIBED grace timeout |
| 8 | 4 (#115, #116, #117a, #117b) | registry race, schema compliance, allowlist, lock-trigger filter |

Total: **8 surgical fixes across steps 6-8**, above the >5 threshold.

**Hardening pass discussion for chapter-3 spec opening:**

The class of bugs surfaced in step 8 was largely *framework-internal*: the synthetic agent existed to verify the chain spine, and the cascade (race condition → schema compliance → allowlist → lock-trigger filter) was a single-thread surfacing series for the same boundary condition. Steps 6-7 surfacings were more substantive (Edge runtime semantics, version increment logic, Realtime SDK behavior). Recommendation: chapter-3 spec should call for a single hardening sub-PR before any new feature work — one verification sweep across all dispatch paths (lock, rerun, regenerate, chain) with the same harness pattern, surface remaining boundary cases, fix in one batch. No need to pause new feature work entirely; one bracketed cycle.

### 3.4 New chain-orchestration patterns established

Three reusable patterns now live in the chapter-2 architecture:

- **DB-enforced idempotency via 23505 catch.** The unique partial index `(chain_id, agent_slug) WHERE kind='chain'` is the source-of-truth for "this agent already dispatched on this chain." Application-level inflight tracking is not needed for this class. Catch the 23505 at the call site, log `[chain-idempotent-skip]`, continue. Carries forward to any future chain-flavored work.
- **chain_id tree-grouping with root-seeding.** `chain_id` seeds at lock-foundation parent and inherits down. NULL on rerun/regenerate (those are not chain dispatches; they branch within a phase). Enables chain-tree visualization (forward note for step 9) and chain-scoped queries.
- **Chain depth cap as framework guardrail.** `CHAIN_DEPTH_CAP=8` in `chain-trigger.js`. Refuse at depth > 8, Resend operator email on exceed (framework-defect-class event · investigate dependency graph for cycles). Per spec adjudication, this is a *defensive* guardrail, not an expected limit. Real chain depths in production are 1-3 hops.

### 3.5 Phase '00' sentinel · invisible-to-user testing primitive

The chain-test-agent uses `phase: '00'` (added to `CANONICAL_PHASES` enum in the contract). The Console (`api/agents/console.js`) filters phase '00' agents from the user-facing Phase view server-side. The schema allowlist (`js/qb-artifact-schema.js`) carries the sentinel slug so delivered artifacts pass validation. Net: synthetic test agents can run in prod under a feature flag, deliver schema-valid artifacts, never appear in the UI.

**Pattern for forward chapters:** new test agents follow this triple — phase '00', registry feature flag, Console + schema entries. Documented in the spec for any future synthetic-agent work.

### 3.6 Branch-state verification discipline (carried from step 7)

No incidents in step 8. Discipline held. The recovery pattern from step 7 (cherry-pick + `reset --hard origin/main` when stray commits land on local main) remains valid; this step did not exercise it.

### 3.7 Harness re-fire cadence under autonomous-chain posture

Step 8's Gate 1 re-fire ran four times (after PR #115, #116, #117). Each re-fire surfaced the next boundary condition. The autonomous-chain posture absorbed the cycle without surfacing to the user · the surgical fixes shipped, the harness re-ran, the gate eventually went green. End-to-end wall time from first Gate 1 failure to 5/5 PASS: ~1 hour 30 minutes. Acceptable rhythm for boundary-condition cascades.

## 4. Harnesses shipped across step 8

One new harness under `tests/chapter-02/`, inheriting the chapter-2 harness-hardening posture (`AbortController` fetch timeouts, deterministic state setup, JSON run artifact):

- `tests/chapter-02/chain-orchestration.mjs` · 5-gate harness covering chain fire, no-fan-out, idempotency, tier-gate, depth-cap

Step 8 verification harness suite total: 1 new. Combined with steps 6 + 7 + 8: **9 harnesses available for chapter close + future regression.**

## 5. Local cleanup performed in this PR

- `git worktree list` confirms no stale worktrees (clean since step 7D)
- Local `chapter-2/*` branches: `chapter-2/step-4-code` (Chapter 2 historical · separate cleanup at chapter close), `chapter-2/step-5-verification` (residual from earlier cycle), `chapter-2/step-8d-closure` (this branch)

## 6. Out of scope · forward references

Items deferred to subsequent chapter steps:

- **Step 9** archive UI tree-view rendering. Surfaced as forward note from step 7 (branched-chain topology) and now reinforced by step 8 (chain_id tree-grouping makes the tree structure queryable). The current Archive UI renders artifacts as a flat list ordered by version. Step 9 visualizes chain_id-grouped trees.
- **Step 13** Foundation `?upgrade=success` banner. Deferred from step 6.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **CHAIN_TEST_AGENT env var removal** · coordinated with Comet in next session after step 8 close confirmed.

## 7. Sign-off

Step 8 closes with all 5 acceptance gates green, three sub-PR cycles (8A/8B/8C) complete, one master-spec migration (016) landed, four surgical fixes captured, seven forward notes documented, framework defect-rate review surfaced for chapter-3 spec entry.

Per the autonomous-chain posture: this PR merges immediately. Step 9 spec opens next on branch `chapter-2/step-9-spec` per §13.9 forward references. Outline first, six adjudications surfaced, standard chapter rhythm resumes.
