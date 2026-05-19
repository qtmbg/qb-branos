# Chapter 2 · Step 6 closure report

Subject: Chapter 2 Step 6 bundle close. Lock-foundation refactor + regenerate refactor + reaper cron + notification bell + verification capture states. All shipped to prod, all verified, step closed.

Source authority: `chapter-02/step-6-outline.md`, `chapter-02/step-6-spec.md`, `CHAPTER_02_SPEC.md` §5.1, §5.3, §5.5, §6, §7, §13.

Date: 2026-05-19.

## 1. PR ledger

Step 6 shipped via nine pull requests over four working sessions:

| PR | Hash | Scope | Status |
| --- | --- | --- | --- |
| #83 | `0268927` | Spec outline + full spec + six corrections (3 commits, hold-open) | Merged |
| #84 | `e489239` | 6A · lock-foundation Option A refactor + readLatestDeliveredArtifact status-aware selector | Merged |
| #85 | `a0a6e3a` | 6D · notification bell + GET/read endpoints | Merged |
| #86 | `3b634bf` | Edge `waitUntil` fix · surfaced during 6A gate 1 run, also fixed PR #78 rerun blocking incidentally | Merged |
| #87 | `6ba7740` | 6A verification · 4 gates PASS | Merged |
| #88 | `03429b8` | 6D verification · 5 gates PASS | Merged |
| #89 | `0b75c86` | 6B · regenerate Option A refactor + X-Deprecated header | Merged |
| #90 | `85e05fa` | 6B verification · 3 gates PASS | Merged |
| #91 | `c837565` | 6C · reaper cron + HMAC + master-spec §5.5 amendment | Merged |
| #92 | `24a8e6e` | 6C verification · 7 gates PASS | Merged |
| #93 | (this PR) | 6E · six new capture states + 15-tile contact sheet + closure + §13 amendment | Pending |

Step 6 bundled four §13 build-sequence items plus one carry-over fix and one master-spec amendment:

| §13 item | Topic | Sub-PR | Verification PR | Gates |
| --- | --- | --- | --- | --- |
| 6 | Lock-foundation refactor (Option A) | #84 | #87 | 4/4 PASS |
| 7 | Regenerate refactor (Option A) + X-Deprecated | #89 | #90 | 3/3 PASS |
| 8 | Reaper cron + master-spec §5.5 amendment | #91 | #92 | 7/7 PASS |
| 12 | Notification bell + endpoints (4 surface mount) | #85 | #88 | 5/5 PASS |
| · | `readLatestDeliveredArtifact` status-aware selector (PR #79 §3 Case C) | #84 (folded into 6A) | covered by #87 gate 2 | PASS |

Total: 19 of 19 acceptance gates green across the four sub-PRs.

## 2. Spec amendments landed

### 2.1 `CHAPTER_02_SPEC.md` §5.5 reaper cron interval (in PR #91)

Pre-amendment (incorrect against current Vercel docs):
> Vercel Cron job that runs every 30 seconds (the tightest interval Vercel offers)
> Backoff: retry 1 at +30 s · retry 2 at +2 min · retry 3 at +5 min

Post-amendment (correct, verified against Vercel cron docs 2026-05-16):
> Vercel Cron job that runs every 1 minute (the tightest interval Vercel supports across all tiers)
> Backoff: retry 1 at +1 min · retry 2 at +2 min · retry 3 at +5 min

### 2.2 `CHAPTER_02_SPEC.md` §13 build sequence prerequisites (in this PR)

§13 expanded with an explicit prerequisites paragraph naming the operator-set environment variables. Before this amendment, the build sequence implied env-var setup but did not name it. After this amendment, sub-PR 6C readers know exactly which two env vars must be live in Vercel Production before the reaper code merges.

## 3. Captured forward notes

Six material findings surfaced during step 6 verification cycles. All captured here for chapter-completion reference and future-step guidance.

### 3.1 Verification-surfaced fix pattern (PR #86)

PR #84 (sub-PR 6A) lock-foundation 504'd at 29.7 s on the first acceptance harness run. Investigation showed both `api/_lib/dispatch-pattern.js` (just shipped in 6A) AND `api/agents/rerun.js` (shipped in PR #78) used the Cloudflare-Workers `context.waitUntil` pattern, which Vercel Edge does not support. The handler receives a single `request` argument; `waitUntil` must be imported from `@vercel/functions`. Verified against Vercel Edge runtime docs.

Fix shipped as PR #86 in the same session as the verification cycle: small surgical patch to `dispatch-pattern.js` + `lock-foundation.js` + `rerun.js` + `package.json` (added `@vercel/functions ^2.0.0`). Squash-merged to main. Re-deployed. Gate 1 then passed 10/10.

**Pattern for forward chapters:** latent bugs surfaced during verification gate runs are merged in the same session when the fix is small and the verified scope is clear. The verification harness IS the right place to catch this kind of latent bug; surfacing the fix as its own PR (with its own deploy + verification trace in the report) keeps the chain auditable while preserving velocity. PR #86 is the canonical example.

### 3.2 Harness instrumentation lesson · >= vs > on visibility transitions (PR #88 gate 5)

The first 6D Gate 5 run reported FAIL with `resume-window-count=0`. Investigation showed the bell module is spec-compliant; the harness used a strict `>` timestamp comparison and a 2 s wait window. The actual resume poll fires at the exact ms the `visibilitychange` event resolves (~0 ms latency between handler running and `fetch()` queueing), so the strict-greater-than rejected the resume poll's timestamp.

Fix in harness only (not in bell module): strict `>` → `>=` on the timestamp comparison; 2 s wait → 3 s for generous coverage. The bell behavior was correct from PR #85 first commit.

**Pattern for forward chapters:** time-comparison logic on visibility / animation / transition boundaries needs `>=` not `>` when the observation point fires at the exact ms the trigger event resolves. Future harnesses should default to `>=` for transition-fired observations.

### 3.3 `agent_slug` as canonical join key for cross-status dispatch state (PR #87 §2)

Sub-PR 6A renamed `readLatestArtifacts` to `readLatestDeliveredArtifact` with a `status='delivered'` filter. The previous code matched dispatch state against the latest artifact by `artifact_id`. With the new selector, that match no longer hits the in-flight queued/producing artifact (which is what carries the live `dispatch_id`).

The fix in 6A re-keyed `inflightDispatchBySlug` and `permanentlyFailedDispatchBySlug` on `agent_slug` (the PostgREST `artifact_type` column) so the most-recent-dispatch lookup survives the delivered-only filter on the artifact selector. `activeDispatches` arrives ordered `created_at.desc`, so the first hit per slug wins (correct "most recent dispatch" semantics).

**Pattern for forward chapters:** anywhere a query joins dispatch state against artifacts AND the artifact selector is status-filtered, key the join on `agent_slug` not `artifact_id`. Step 8 (chain orchestration) and any future Phase 02+ work that reads dispatch state should adopt this pattern from the start.

### 3.4 Bell position interim (PR #88 §4)

Sub-PR 6D mounts the bell via `position: fixed; top: var(--space-s); right: var(--space-s); z-index: 50`. No existing nav slot to hook into on the four mount surfaces (`agents.html`, `foundation.html`, `archive.html`, `signal-scan.html`).

**Forward note:** when a nav-chassis lands across the signed-in surface family (likely Chapter 3 or 4 scope), relocate the bell from fixed-corner to a proper nav placement. The mount API (`QBNotificationBell.mount(parentEl, { authToken })`) accepts any DOM node; only the parent assignment changes.

### 3.5 Platform-layer 404s are NOT handler-layer responses (PR #90 §3.2)

Sub-PR 6B added an `X-Deprecated` header to every response from `/api/artifacts/[id]/regenerate`. Acceptance gate 2 verified the header presence across 202, 204 (OPTIONS preflight), 401 (no auth), 405 (wrong method).

Curl against `POST /api/artifacts/not-a-uuid/regenerate` returns 404 from Vercel's platform routing (`x-vercel-error: NOT_FOUND`, `server: Vercel`) WITHOUT the `X-Deprecated` header. This is correct behavior: vercel.json route patterns require UUID-format segments; non-matching paths fall through to the platform catch-all 404, upstream of the handler.

**Pattern for forward chapters:** response-header deprecation tracking only applies to handler-layer responses. Platform-layer 404s (rejected by route regex before handler dispatch) do not carry handler-decorated headers and should not be tracked as caller-surface. Acceptance gates that decorate responses should distinguish handler-vs-platform paths.

### 3.6 Harness fetch timeouts + inter-run cooldown (PR #90 §3.1)

Sub-PR 6B Gate 1 first run hit infrastructure throttling (Supabase admin + Vercel under repeated rapid lock-foundation calls) and one run hung 2 h 1 min on a stalled connection. Default global `fetch()` has no timeout, so a stalled connection waits forever.

Fix in the harness: every `fetch()` goes through a `tfetch()` wrapper with a 30 s `AbortController` timeout. Plus a 10 s cooldown between iterations to give Supabase admin + Vercel a small breathing window. After hardening: 10/10 SUCCESS, no flakes.

**Pattern for forward chapters:** any harness against prod that creates auth users or fires endpoint calls in a tight loop needs (a) per-fetch `AbortController` timeouts to surface stalls as flakes within seconds, and (b) inter-run cooldown to avoid hitting platform rate limits. The reaper-gates harness in PR #92 inherited this posture by default. All future verification harnesses should adopt the same.

## 4. Verification capture matrix

15 capture states total. Original nine from PR #79 (step 5 close) + six new added in this PR per §9.2 of step-6-spec.md.

| State | Source | Surface |
| --- | --- | --- |
| `neutral` | step 5 | Phase view · queued state |
| `green` | step 5 | Phase view · all delivered |
| `yellow-latency` | step 5 | Phase view · Visual DNA gold latency band |
| `rose-latency` | step 5 | Phase view · Visual DNA rose latency band |
| `rose-retry` | step 5 | Phase view · Soul Map rose retry band |
| `transient-failed` | step 5 | Phase view · Soul Map transient failure |
| `failed-permanently` | step 5 | Phase view · Soul Map permanent failure pill |
| `locked-phase-cards` | step 5 | Phase view · phases 02-05 locked sections |
| `replay-modal-v1-of-3` | step 5 | Run history modal · Soul Map v1 (root of chain) |
| `latest-delivered-with-queued` | step 6E | Console renders v1 delivered + v2 generating independently (Case C resolution) |
| `reaper-mid-backoff` | step 6E | Soul Map row in failed state with stale dispatch_jobs.retry_count=1 + last_retry_at recent |
| `reaper-recovered` | step 6E | Soul Map row delivered, Run history shows retry trace (one failed + one succeeded) |
| `permanent-failure-with-notification` | step 6E | Console permanent-failure pill AND bell badge with dispatch_failed dropdown entry |
| `bell-empty` | step 6E | Bell with no badge, dropdown open showing empty-state copy |
| `bell-with-unread` | step 6E | Bell badge "2", dropdown open with 2 dispatch_failed rows |

15-tile contact sheet at `chapter-02/verification/step-5-screenshots/contact-sheet.png` (the existing `seed-and-capture.mjs` builder handles N tiles via the same 3-column CSS grid; 15 states wrap to 5 rows naturally).

## 5. Operator action ledger

Recorded for chapter-completion reference:

- `CRON_SECRET` set in Vercel Production scope · before sub-PR 6C opened (operator action, cleared)
- `INTER_EDGE_SECRET` set in Vercel Production scope · before sub-PR 6C opened (operator action, cleared)
- Vercel Pro upgrade confirmed live · prerequisite for cron primitives (operator action, cleared)
- Service role key rotation · still parked. Captured for future operator action; not blocking step 6 close

## 6. PR #78 rerun-blocking bug · user impact note

PR #78 (Agent Console code, merged 2026-05-16) shipped the same `context.waitUntil` bug that PR #86 fixed on 2026-05-19 for the lock-foundation path. The single-child rerun path appeared to work because Visual DNA's 22 s wall time fit inside the Edge 25 s warning threshold, but every Console rerun was blocking the user on the response while the Option A intent was to return 202 immediately.

User impact during the window (2026-05-16 → 2026-05-19, ~3 days):
- Console rerun CTAs returned ~22 s slower than intended.
- No data loss.
- No failed reruns (the synchronous path completed correctly within the Edge ceiling).
- Captured in PR #87 §5 forward note.

## 7. Out of scope · forward references

Items deferred to subsequent chapter steps:

- **Step 7** opens immediately after this closure merges. Branch `chapter-2/step-7-spec`. Scope: full §5.3 conformance pass over `/api/agents/rerun` (shipped as MVS in PR #78 + fixed in PR #86). Outline + six adjudications surface for Nizzar adjudication per standard chapter rhythm.
- **Step 8** chain orchestration. Depends on lock-foundation refactor (shipped) + a Phase 02 synthesizer to chain INTO (Chapter 4).
- **Step 13** Foundation `?upgrade=success` banner (small UX fix, deferred).
- **Step 14** `/api/agents/dispatch` retirement + `/api/artifacts/[id]/regenerate` retirement. The `X-Deprecated` header on regenerate (shipped in PR #89) is the safety net for any drift between step 6 close and step 14 sweep.

## 8. Sign-off

Step 6 closes with all 19 acceptance gates green, four sub-PR cycles complete, two master-spec amendments landed, six forward notes captured, 15-state capture matrix updated, and the §13 build-sequence prerequisites named.

Per the autonomous-chain posture: this PR merges immediately and step 7 spec branch opens next.
