# Chapter 2 · Step 6C verification report

Subject: PR #91 · `feat(chapter-2/step-6c): reaper cron + HMAC + §5.5 amendment` (merged `c837565`)

Source authority: `chapter-02/step-6-spec.md` §6. Acceptance gates §6.4. `CHAPTER_02_SPEC.md` §5.5 (amended in same PR).

Date: 2026-05-19. Verified against `https://quantumbranding.ai` via Vercel cron + Supabase service-role state inspection.

## 1. Result · all seven gates passed

| Gate | Topic | Result | Wall time | Detail |
| --- | --- | --- | --- | --- |
| 1 | Retry 1 trace · stuck dispatch at elapsed ≥ 60 s | **PASS** | 6041 ms | `retry_count` flipped 0 → 1, `last_retry_at` written. Vercel cron tick was already inside the window when the harness inserted the state |
| 2 | Retry 2 trace · last_retry_at + 120 s | **PASS** | 60926 ms | `retry_count` flipped 1 → 2 on the next cron tick |
| 3 | Retry 3 trace · last_retry_at + 300 s | **PASS** | 55245 ms | `retry_count` flipped 2 → 3 |
| 4 | Terminal flip · retry_count=3 + 300 s | **PASS** | 57255 ms | `status='failed_permanently'`, exactly **1** `dispatch_failed` notification row inserted (validated `notifications` table read) |
| 5 | User-fixable code (`qbp_field_missing`) NOT retried | **PASS** | 90 s budget | `retry_count` stayed 0 across two cron ticks; `status` stayed `producing`. Reaper correctly identified the failure code as user-actionable and skipped it |
| 6 | Ghost dispatch detection · queued artifact + no `agent_runs` row + dispatch > 25 s | **PASS** | 22422 ms | Reaper detected the ghost child, re-fired it via `/api/agents/run`, `retry_count` flipped 0 → 1 |
| 7 | Trigger auth · 401 on unauthenticated, 200 on authenticated | **PASS** | inline | No-auth GET = 401, bad-bearer GET = 401, bad-user-agent + token GET = 401. The 200 path is implicitly verified by gates 1-6 (those required real Vercel cron ticks to succeed with the real `CRON_SECRET`) |

## 2. Gate-1-vs-Gate-2 wall-time interpretation

Gate 1 landed in 6 seconds. Gate 2 landed in 61 seconds. Both PASS, but the wall times reveal the cron cadence behavior:

- Gate 1: the test inserts a stuck dispatch with `created_at = now() - 65 s`. The Vercel cron runs every minute; the very next tick (within seconds of insert) picks the row up and fires retry 1.
- Gate 2: after gate 1's user is torn down and gate 2's user is created, the gate 2 insert lands at a point where the next cron tick is ~60 s away. The reaper fires retry 2 on that tick.

This is correct behavior. The reaper's 60 s / 120 s / 300 s thresholds are minima, not maxima; the actual retry timing is `(elapsed when next cron fires) ≥ threshold`. In production, where dispatches are inserted at arbitrary moments, the worst-case latency from threshold-crossing to retry is ~60 s (one cron interval). Gate timings confirm this lower-bound enforcement.

## 3. Interpretation notes from the 6C implementation (folded into the verification record)

The 6C agent surfaced five judgment calls that fell within reasonable spec interpretation. None blocked acceptance:

1. **Spec §6.2 step 3(b) artifact status term.** Spec text said `artifacts.status='producing'` for the orphaned-started condition, but the canonical artifacts enum (migration 008) is `queued / generating / delivered / failed`. The reaper code reads `artifact.status === 'generating'` with the latest `agent_runs` row in `status='started'` past the 25 s ceiling. Verified in gate 1-4 traces · the children matching this condition were correctly identified and re-fired.

2. **Artifact reset on re-fire.** The reaper PATCHes the artifact back to `status='queued'` before re-firing `/api/agents/run`, since the run handler's lifecycle starts from `queued`. Applied to all three stuck modes. Verified in gate 1-3 traces · child artifacts cycled correctly through the requeue.

3. **Terminal flip race-check.** Before flipping `failed_permanently`, the reaper reads children one final time; if every child is now delivered, the flip and notification are skipped. The spec's "still `producing` at the next reaper tick" already implies this; the defensive read is explicit in code. Gate 4 verified the positive path (flip happened with notification); the negative path (no flip when children deliver in time) is implicit in normal-flow lock runs.

4. **`runtime_args.qbp_source` carry-through.** On re-fire, the reaper reads the prior `agent_runs.runtime_args.qbp_source` and propagates it. Falls back to `'current'` when there is no prior run (ghost-dispatch case). Verified in gate 6 trace · ghost re-fire completed with default `qbp_source='current'`.

5. **Reason code source for the notification.** The reaper grabs the failure code from the latest `agent_runs.error_payload.code` on the first non-delivered child. Defaults to `'transient_failure'` when no run row carries a code (ghost path). Verified in gate 4 trace · notification payload carries the original failure code.

## 4. CHAPTER_02_SPEC.md §5.5 amendment landed

Pre-amendment (incorrect against current Vercel docs):
> `/api/cron/reaper` · a Vercel Cron job that runs every 30 seconds (the tightest interval Vercel offers; the per-row check below enforces the backoff curve precisely).
> 
> 2. **Backoff schedule.**
>    - retry 1 at +30 s
>    - retry 2 at +2 min
>    - retry 3 at +5 min

Post-amendment (correct, in same PR):
> `/api/cron/reaper` · a Vercel Cron job that runs every 1 minute (the tightest interval Vercel supports across all tiers; verified against Vercel cron docs 2026-05-16). The per-row backoff check below enforces the curve precisely.
> 
> 2. **Backoff schedule.**
>    - retry 1 at +1 min
>    - retry 2 at +2 min
>    - retry 3 at +5 min

Two additional in-text references to "30 s" elsewhere in §5.5 were also updated to "1 min" for internal consistency.

## 5. Harness shipped alongside this report

`tests/chapter-02/reaper-gates.mjs` (new). Single Node harness covering all seven gates. Uses Vercel's real cron tick + Supabase service-role state inspection. Per-gate test isolation via fresh test user. Inherits the PR #90 harness hardening (fetch timeouts via `AbortController`, poll-then-budget pattern).

Wall time ~10 minutes end-to-end on average (depends on how recently the Vercel cron last fired before each gate's insert lands).

## 6. Files added to main via this verification PR

- `tests/chapter-02/reaper-gates.mjs` (new) · seven-gate verification harness
- `chapter-02/verification/step-6c-reaper-verification-20260519T020000Z.md` (this report)

## 7. Out of scope · forward references

- **Sub-PR 6E (verification capture states + closure report)** fires next per the autonomous-chain posture. Six new states added to `seed-and-capture.mjs`, 15-tile contact sheet, step 6 closure report folding all captured forward notes.
- **Step 7 spec** opens after step 6 closes, on branch `chapter-2/step-7-spec` per §13 forward references. Step 7 scope: full §5.3 conformance pass over `/api/agents/rerun` (which shipped as MVS in PR #78 + fix in PR #86).

## 8. Sign-off

Step 6C acceptance complete. All seven gates green. The reaper state machine, the two-secret auth surface, the notification helper, the §5.5 master-spec amendment, and the Vercel cron handshake are verified live against prod.

Per the autonomous-chain posture: this report merges immediately and 6E fires next.
