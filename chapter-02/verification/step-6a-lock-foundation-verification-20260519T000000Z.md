# Chapter 2 · Step 6A verification report

Subject: PR #84 · `feat(chapter-2/step-6a): lock-foundation Option A refactor + status-aware selector` (merged `e489239`)

Source authority: `chapter-02/step-6-spec.md` §4. Acceptance gates §4.4. PR #79 §3 Case C carry-over.

Date: 2026-05-19. Verified against `https://quantumbranding.ai` post-merge of PR #86 (the Edge `waitUntil` fix that surfaced during gate 1 run; see §3 below).

## 1. Result · all four gates passed

| Gate | Topic | Result | Evidence |
| --- | --- | --- | --- |
| 1 | 10/10 zero-stuck dispatches | **PASS** | `tests/chapter-02/lock-foundation-10x.mjs` reports 10 SUCCESS, 0 STUCK, 0 partial-fail (all four child agents delivered on every run, ~64 s wall time per run) |
| 2 | PR #79 §3 Case C trace | **PASS** | `tests/chapter-02/case-c-trace.mjs` confirms: v1 delivered, v2 generating, Console payload returns `latest_artifact.status='delivered'` AND `inflight_dispatch_id` non-null on the same agent rollup, independently |
| 3 | Nine step-5 capture states re-fire green | **PASS** | `seed-and-capture.mjs all` re-fired all 9 surfaces. Visual diff of post-6A contact sheet vs PR #79 committed contact sheet shows pixel-equivalent tiles. Only difference is the header timestamp/base annotation. Per-tile inspection covered: layout, row composition, status pills, rolling badges, dot colors, failure copy, replay modal contents (Soul Map v1, qbp_snapshot 18 keys, runtime_args, file_refs), locked Phase 02-05 sections |
| 4 | JWT pass-through writes `agent_runs` correctly under new dispatch_id | **PASS** | `case-c-trace.mjs` Gate 4 section confirms each of 4 `agent_runs` rows carries `dispatch_id` (the new lock's), `trigger='lock'`, `qbp_keys=17` (full QBP snapshot), and the registry-declared `model` (3 × Sonnet, 1 × Haiku for Sensescape). Matches the step 4 proven path |

## 2. Forward notes captured

Per Nizzar's pre-release adjudication:

- **6A flag 1 confirmation** · JWT pass-through path on the lock parent reuses step 4's proven runtime. `case-c-trace.mjs` Gate 4 trace shows the four `agent_runs` rows match the step 4 contract: `agent_version=1`, `trigger='lock'`, `dispatch_id` linked to the new lock dispatch, `qbp_snapshot` written with 17 keys, `model` field present (Sonnet 4.6 for Soul Map / Visual DNA / War Table, Haiku 4.5 for Sensescape). The HMAC helper in `dispatch-pattern.js` is retained for the 6C reaper which calls without a user session.

- **6A flag 2 captured · agent_slug as canonical join key for cross-status dispatch state.** With `readLatestDeliveredArtifact` filtering on `status='delivered'`, the previous `latestArtifact?.id === artId` matching in `readActiveDispatches` + `dispatchByArtifact` no longer hits the in-flight queued/producing artifact. The refactor re-keyed `inflightDispatchBySlug` and `permanentlyFailedDispatchBySlug` on `agent_slug` (PostgREST `artifact_type` column) so the most-recent-dispatch lookup survives the delivered-only filter. **Pattern for forward chapters**: anywhere a query joins dispatch state against artifacts and the artifact selector is status-filtered, key the join on `agent_slug` not `artifact_id`. Captured here so step 8 (chain orchestration) does not re-discover this.

## 3. Live bug surfaced + fixed during verification

Gate 1's first run returned 504 after 29.7 s. Root cause: `api/_lib/dispatch-pattern.js` (just shipped in 6A) AND `api/agents/rerun.js` (shipped in PR #78) both assumed the Cloudflare-Workers handler signature `handler(req, context)` with `context.waitUntil`. Vercel Edge runtime does NOT pass a context arg (verified against Edge runtime docs 2026-05-19). The handler receives a single `request` argument; `waitUntil` must be imported from `@vercel/functions`.

Result: the parent was always falling into the local-dev fallback path inside `holdOpenForChildren`, which `await`s the Promise.allSettled inline, blocking the response for the full child duration. Lock-foundation 504'd at the Edge ceiling. Rerun (single-child) appeared to work because Visual DNA's 22 s wall time fit inside the 25 s warning threshold, but every Console rerun was blocking the user on the response.

Fix shipped as PR #86 (`fix(edge): waitUntil via @vercel/functions, not handler context arg`, merged `3b634bf`):
- Added `@vercel/functions ^2.0.0` to `package.json` deps. No lockfile per repo convention (mirrors `@vercel/og`).
- Updated `api/_lib/dispatch-pattern.js` to import `waitUntil` and use it directly. Caller no longer passes a `context` arg.
- Updated `api/lock-foundation.js` handler signature to `handler(req)` (drop the never-populated second arg).
- Same fix applied retroactively to `api/agents/rerun.js`.

Gate 1's 10/10 result was measured post-PR-#86 deploy. The PR #84 code as merged would have failed gate 1 absent the Edge waitUntil fix.

## 4. Harness extensions shipped alongside this verification

Two new files under `tests/chapter-02/`, both committed to this verification PR:

### 4.1 `lock-foundation-10x.mjs`

Reason · the existing `tests/chapter-02/run-repro.mjs` targets `/api/test-async-lock`, which is the §2.5 PR #59 diagnostic endpoint that intentionally implements fire-and-forget WITHOUT pre-insert or waitUntil. That harness proves the old pattern broke; it cannot verify the new Option A pattern shipped in 6A.

Shape · creates 10 fresh test users, seeds full QBP + tool_completions, signs in, POSTs `/api/lock-foundation`, waits 60 s, reads the `artifacts` table, classifies each run as SUCCESS / STUCK / partial-fail / unexpected. Cleans up the test user in the `finally` block. Reports per-run status + summary + final pass/fail.

Wait window · 60 s (was 45 s in the first draft). Visual DNA's worst-case 22.9 s single-shot wall time at `retry_budget=0` plus child-fetch propagation overhead does not converge inside 45 s under load. 60 s gives consistent convergence.

Pass criterion · 0 STUCK across the configured run count. partial-fail (one or more child agents failed but settled) is acceptable per the `retry_budget=0` design; the reaper recovers these in step 6C. STUCK (child still in queued / producing / generating / started) is the spec-non-negotiable gate.

### 4.2 `case-c-trace.mjs`

Single-shot verification for gates 2 and 4. Creates one test user, locks, waits, reads `agent_runs` (gate 4), fires a rerun against the delivered Soul Map artifact, polls `/api/agents/console` at +500 ms / +3500 ms / +11500 ms after rerun POST, asserts that at least one observation shows `latest_artifact.status='delivered' AND inflight_dispatch_id !== null` (gate 2), cleans up.

Observation trace from the verified run (user `c0b6510c`, lock dispatch `55ad3bc2`, rerun dispatch `f1be6f0c`):

```
+500ms · latest_artifact.status=delivered version=1  inflight_dispatch_id=f1be6f0c
+3500ms · latest_artifact.status=delivered version=1  inflight_dispatch_id=f1be6f0c
+11500ms · latest_artifact.status=delivered version=1  inflight_dispatch_id=f1be6f0c
```

DB state at the time of polling:

```
v1  status=delivered  parent=null      dispatch=55ad3bc2 (the lock)
v2  status=generating parent=98e24ee7  dispatch=f1be6f0c (the rerun)
```

The two signals surface independently. PR #79 §3 Case C is resolved by the `readLatestDeliveredArtifact` selector.

## 5. Out of scope · captured for forward steps

- **Sub-PR 6B** opens against `api/artifacts/[id]/regenerate.js` next. The Option A pattern is already extracted in `api/_lib/dispatch-pattern.js` and the X-Deprecated header strategy is locked in step 6 spec §5.
- **Sub-PR 6D** runs in parallel on its own branch (`chapter-2/step-6d-notification-bell`, PR #85). Verification gate runs after merge per the same protocol.
- **PR #78 `api/agents/rerun.js` was incidentally fixed** by PR #86. The rerun-blocking bug shipped to users between PR #78 merge (2026-05-16) and PR #86 merge (2026-05-19). User impact during that window: rerun CTAs blocked on the response while the single child agent completed, instead of returning 202 immediately. No data loss, no failed reruns. Capture for chapter completion notes.

## 6. Files added to main via this verification PR

- `tests/chapter-02/lock-foundation-10x.mjs` (new)
- `tests/chapter-02/case-c-trace.mjs` (new)
- `tests/chapter-02/lock-foundation-10x.last-run.json` (gitignored or removed before commit · run output, not source)
- `chapter-02/verification/step-6a-lock-foundation-verification-20260519T000000Z.md` (this report)

## 7. Sign-off

Step 6A acceptance gate complete. All four gates green. The lock-foundation refactor and the status-aware selector are verified live against prod. Sub-PR 6B may open against main.
