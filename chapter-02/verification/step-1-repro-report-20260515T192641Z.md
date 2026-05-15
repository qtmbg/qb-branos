# Chapter 2 · Step 1 · PR #59 reproduction report

**Step:** Build step 1 · the §2.5 pre-implementation reproduction gate.
**Generated:** 2026-05-15T19:26:41Z.
**Spec section:** CHAPTER_02_SPEC.md §2.5 (Pre-implementation gate · PR #59 failure reproduction).
**Harness PR:** #67 → `e90a39e` (test endpoints + runner).
**Verdict:** **GATE PASSED.** Bug reproduced at 6/10 (60%) on production, well above the 2/10 floor. Mechanism identified.

---

## 1. Gate evidence bar · §2.5 checklist

| Criterion | Status | Evidence |
| --- | --- | --- |
| Minimum 2/10 stuck rate | **PASS** | 6 of 10 runs stuck. 60% rate. |
| Single-command reproducibility | **PASS** | `node tests/chapter-02/run-repro.mjs 10` from a clean local env. No multi-step orchestration. |
| Log evidence at the failure moment | **PASS** | Stuck runs show zero `child.entry` log entries in Vercel runtime logs. Success runs show 4+. The failure moment is the parent's return before child fetches establish. |
| 0/N does not pass | n/a | We had 6/10. |

Gate is passed. Proceeding to mechanism analysis.

---

## 2. Harness design

The harness is a parallel diagnostic surface deployed alongside the production code. It does NOT touch the production `/api/lock-foundation` flow (which stays on the reverted sync-await path post-PR #63).

**Test endpoints** (gated by `REPRO_SECRET` env var, operator-only):
- `/api/test-async-lock` · mirrors the reverted PR #59 fire-and-forget pattern exactly. Fires 4 child fetches WITHOUT await, no pre-inserted artifact rows, no `waitUntil`. Returns 202 immediately. Logs every fetch boundary via `[repro]` marker.
- `/api/test-async-dispatch` · the child Edge function. Logs entry, writes a `repro_children` row, sleeps 5 s to simulate Claude wall time, logs exit.

**Tables** (Supabase migration `chapter_02_repro_tables` applied):
- `repro_runs` · one row per parent invocation
- `repro_children` · one row per child invocation that actually executed

**Runner** (`tests/chapter-02/run-repro.mjs`):
```
node tests/chapter-02/run-repro.mjs 10
```

Per run: create fresh user → POST to test-async-lock → wait 30 s → query `repro_children` for the run_id → STUCK if < 4 children wrote rows.

---

## 3. Results · 10-run smoke

```
Total runs:    10
Success (4/4): 4
Stuck (<4/4):  6
Errors:        0
Stuck rate:    60.0%
```

Per-run detail:

| # | Lock returned | Children DB rows | Verdict |
| --- | --- | --- | --- |
| 1 | HTTP 202 in 1579 ms | 0/4 started, 0/4 completed | STUCK |
| 2 | HTTP 202 in 884 ms | 4/4 started, 4/4 completed | OK |
| 3 | HTTP 202 in 828 ms | 0/4 started, 0/4 completed | STUCK |
| 4 | HTTP 202 in 1063 ms | 4/4 started, 4/4 completed | OK |
| 5 | HTTP 202 in 741 ms | 0/4 started, 0/4 completed | STUCK |
| 6 | HTTP 202 in 985 ms | 0/4 started, 0/4 completed | STUCK |
| 7 | HTTP 202 in 802 ms | 0/4 started, 0/4 completed | STUCK |
| 8 | HTTP 202 in 1077 ms | 4/4 started, 4/4 completed | OK |
| 9 | HTTP 202 in 802 ms | 4/4 started, 4/4 completed | OK |
| 10 | HTTP 202 in 833 ms | 0/4 started, 0/4 completed | STUCK |

**Key observation: the failure mode is all-or-nothing.** A stuck run has zero children executing. A successful run has all four. There is no partial state (e.g. 2 of 4 children). This is a strong mechanism signal.

---

## 4. Mechanism · Vercel runtime log evidence

Vercel runtime logs filtered by `[repro]` marker confirm: stuck runs show **zero `child.entry` log entries** for the corresponding parent run_id. The child Edge functions are never invoked.

### 4.1 Log entry counts per run

The harness ran 10 parent invocations. Each invocation should produce exactly 4 child Edge function entries if the fire-and-forget pattern works.

Stuck runs (1, 3, 5, 6, 7, 10): **0 child.entry log entries.**
Success runs (2, 4, 8, 9): **4 child.entry log entries each (some show 8 due to log duplication of entry + row_written).**

### 4.2 The smoking gun

Stuck runs have:
- 1 parent log line (parent.entry)
- 4 parent.fire_initiate log lines (one per child fetch initiation)
- 1 parent.return log line
- **ZERO child.entry log lines**

The parent function explicitly logged that it called `fetch()` four times. The Vercel runtime never reached the child Edge function's handler. This pattern reproduces consistently across 6 of 10 runs.

### 4.3 Why this matches the working hypothesis

The hypothesis from PR #66 §2.5 was: "`fetch()` cancellation when the parent Edge function returns before child connections establish."

The log evidence is exactly that. The parent's fire-and-forget `fetch()` calls are issued, but the parent function returns its 202 response within milliseconds of issuing them. The Vercel runtime tears down the parent function's execution context. The outstanding `fetch()` Promises are part of that context and are cancelled before their underlying TCP connections to the child Edge function endpoints are established. The child function never sees a request. No connection, no invocation, no log.

This is consistent with documented Vercel Edge runtime semantics: a function's lifetime is tied to its returned Promise. Operations outside that Promise (non-awaited fetches, dangling timers, unhandled async work) are not guaranteed to complete.

The successful runs (4 of 10) happen when, by chance, the 4 child connections all establish before the parent returns. At that point the Vercel runtime treats the connections as live and the child invocations proceed to completion.

---

## 5. Why this rate is higher than PR #59's 1/10

PR #59 saw 1/10 stuck dispatches in production. This harness saw 6/10. The harness is a more aggressive trigger of the same mechanism. Differences:

1. **Simulated 5 s Claude work in the child.** Each child sleeps 5 s before exiting. This is the same wall-time as a real Claude call but predictable. The PR #59 children ran real Claude calls with variable timing.

2. **Identical fire pattern across all runs.** No upstream variance (Stripe Checkout, agent prompt nondeterminism). Every run is the same shape, so timing fragility surfaces more deterministically.

3. **Cold-start sensitivity.** Each run creates a fresh test user and immediately POSTs the lock. The Vercel Edge function may not have a warm instance for the child handler, so child cold-start adds to the parent-vs-child race.

The mechanism is the same. The reproduction rate is higher because the test harness amplifies the race.

This is a feature of the harness, not a bug. The §2.5 evidence bar asked us to catch the bug, not to faithfully match the production rate. The higher rate makes the fix easier to validate: a fix that gets 10/10 success here is reliable enough to ship to a production rate of ~1/10.

---

## 6. Confirmation that Option A pattern addresses the mechanism

Per §5 of CHAPTER_02_SPEC.md, the Option A fix has three pillars:

1. **Pre-insert artifact rows in the parent BEFORE firing child fetches.** Even if 100% of child fetches are cancelled, the artifact rows exist in the database with `status='queued'`. The polling client sees them immediately. From the user's perspective, the lock succeeded and the artifacts are "being prepared."

2. **Use `context.waitUntil()` for the child fetches.** This is Vercel's explicit API for fire-and-forget work. The runtime extends the parent's lifetime past its return, holding the function context open until the waitUntil promises settle. This eliminates the parent-vs-child connection race.

3. **Reaper sweeps stuck `dispatch_jobs` rows.** Even with waitUntil correctly wired, a residual cancellation rate is possible (regional failover, runtime upgrade mid-fetch, etc.). The reaper picks up stuck rows after the 30 s / 2 min / 5 min backoff schedule and re-fires.

The mechanism this report confirmed is: **fire-and-forget fetches are cancelled when the parent function returns.** Each Option A pillar addresses a different aspect of that:
- Pre-inserted rows make the cancellation user-invisible (state exists regardless)
- `waitUntil` prevents most cancellations
- Reaper catches the residual

The fix is well-targeted at the confirmed mechanism. The gate clears.

---

## 7. Surprises and notes

### 7.1 Vercel runtime log search has limited message visibility

The Vercel MCP tool returns log entries in a table with the message column truncated. The full `{"marker":"[repro]","stage":...}` JSON payload is only visible via the Vercel dashboard log inspector, not via the API. The pattern (count of child.entry entries per run) was visible from the table even with truncation, which was sufficient to confirm the mechanism. If deeper instrumentation is ever needed (e.g. per-fetch TCP-level timing), pulling from the Vercel dashboard manually is the workaround.

### 7.2 The harness amplifies the rate · acceptable per §2.5

§2.5 said: "minimum 2 of 10 runs · matching or exceeding PR #59's 1/10 rate." The harness saw 6/10. This exceeds the floor by 4x and PR #59's observed rate by 6x. The amplification is from harness design (deterministic timing, no upstream variance). The mechanism is the same; the rate is louder. This is correct behavior for a reproduction harness · a harness that fails to amplify a bug is worse than one that does.

### 7.3 No false negatives

Across 10 runs, every successful run had exactly 4 children writing rows. No partial successes (e.g. 3 of 4 children). The all-or-nothing pattern strongly suggests the mechanism is a parent-context-teardown, not per-fetch failures. This is internally consistent with the hypothesis.

### 7.4 Harness is reusable

The test endpoints + tables stay in the repo. After Chapter 2 step 2 ships the fix, the same harness can validate the fix at 10/10. After that, the harness is the canonical regression test for the dispatch pattern · `node tests/chapter-02/run-repro.mjs N` is the answer to "did we break dispatch reliability?"

---

## 8. Definition of done · §2.5 gate

| Item | Status |
| --- | --- |
| Documented test reliably reproduces the bug | done · 6/10 rate, single command |
| Identified mechanism with log evidence | done · zero child.entry entries on stuck runs; parent return precedes child invocation |
| Confirmation that Option A addresses the mechanism | done · pre-inserted rows + waitUntil + reaper each address a distinct aspect of the parent-context-teardown cancellation |
| Reproduction report committed | this file |

Gate cleared. Per §2.5, this unblocks Chapter 2 build step 2.

---

## 9. Next step

Per CHAPTER_02_SPEC.md §13 build sequence:

**Step 2: Migrations 011 + 012 + 013.** Data model + RLS. `agent_runs` rename + new columns, `dispatch_jobs` extension (`agent_version`, `retry_count`, `last_retry_at`, `failed_permanently` status), `notifications` table. Apply via Supabase MCP. Verification: schema reads match the spec; RLS policies enforced on each new table.

The harness stays in place for regression validation in steps 6 + 7 (lock + regenerate refactors).

---

## End of step 1 reproduction report

Awaiting your review per the hold-open policy. Once mechanism is confirmed accepted, step 2 (migrations) begins.
