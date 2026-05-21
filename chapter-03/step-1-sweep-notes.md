# Chapter 3 · Step 1D · Race-condition sweep memo (MEMO-ONLY)

**Status:** sweep complete. Zero patches. All findings categorized + forward-referenced or marked likely-fine.

**Time-box:** ~70 minutes against the five Edge/Realtime surfaces.

**Hard fence honored:** zero product code edits. This memo names findings; any real race becomes its own scoped fix later with its own repro gate.

**Trigger for the sweep:** three reactive races in chapter-2 steps 7-8 (#100, #107, #115) on one class of surface is itself a pattern. The sweep checks whether more instances exist before chapter 3 adds new Edge/Realtime code.

---

## 1. Scope

Five surfaces audited end-to-end for the three race shapes from `docs/patterns/race-discipline.md`:

| # | File | Lines read | Time spent |
|---|---|---|---|
| 1 | `api/lock-foundation.js` | 1-366 | ~10 min |
| 2 | `api/agents/run.js` | 1-729 | ~20 min |
| 3 | `api/_lib/chain-trigger.js` | 1-281 | ~10 min |
| 4 | `js/qb-realtime-manager.js` | 1-180 | ~5 min |
| 5 | `api/cron/reaper.js` | 1-415 | ~20 min |

Looking for: any fourth/fifth instance of the three race shapes named in `chapter-03/step-1-hardening-report.md` §6 (concurrent write race · async state-transition grace race · dependency-loading race).

---

## 2. Findings · ranked by severity

### Finding 1 · `real` · Reaper terminal-flip race (concurrent-write class)

**Surface:** `api/cron/reaper.js:286-339` (terminal-flip path inside `processDispatch`).

**Race shape:** the reaper reads `artifacts` rows for the dispatch (line 301), checks `anyOutstanding` (line 306), then flips `dispatch_jobs.status='failed_permanently'` (line 311). Between the read and the flip, a child can deliver via the normal `/api/agents/run` settle path. Outcome: the dispatch is marked `failed_permanently` even though every child eventually delivered.

**Window:** sub-second. The read and the flip are two sequential REST round-trips against PostgREST. The intervening child-settle path is the parallel race surface.

**Class match:** concurrent write race (shape 1 from race-discipline.md). The temporal assumption is "the children state I just read is the children state when I write." Concurrency breaks this.

**Cure shape (NOT patched · forward reference):** convert the flip to a conditional UPDATE with a WHERE clause that re-asserts the precondition. PostgREST supports this via `?status=eq.producing`:

```js
// Forward-referenced cure (NOT shipped in step 1)
// Atomic conditional flip: only update if status is still producing
const r = await fetch(
  `${supaUrl}/rest/v1/dispatch_jobs?id=eq.${dispatchId}&status=eq.producing`,
  { method: 'PATCH', headers: ..., body: JSON.stringify({ status: 'failed_permanently' }) }
);
// If r.status returns 0 rows updated, the flip lost the race (a child
// delivered between the read and the flip). Skip the notification.
```

**Severity:** low. The window is sub-second and the consequence is observability (user sees a failed banner on a dispatch that completed). The dispatch_failed notification + email would fire once. Self-recovery: the user re-opens the artifact and sees it delivered. No state corruption.

**Recommended next step:** add to step 2 blocker list as a low-priority hardening cleanup that can ride alongside the artifacts unique constraint migration (similar surface · DB-level enforcement).

---

### Finding 2 · `real` · Reaper concurrent-tick race (concurrent-write class)

**Surface:** `api/cron/reaper.js` (handler-level · cron is `* * * * *` per `vercel.json`).

**Race shape:** if a single reaper tick exceeds 60 seconds (50 rows × multiple REST round-trips each), the next cron tick can start before the previous one finishes. No DB-level lock prevents two reaper instances from processing the same dispatch_jobs row. Outcome: `incrementDispatchRetry` could fire twice for the same retry_count, double-incrementing.

**Window:** depends on tick latency. The `MAX_ROWS_PER_TICK = 50` cap + the parallel per-dispatch processing should keep ticks well under 60s in normal conditions. Under degraded Supabase response (~500ms per round-trip × ~5 round-trips per dispatch × 50 dispatches = 125s), the race window is real.

**Class match:** concurrent write race (shape 1). Two ticks reading + writing the same `dispatch_jobs.retry_count`.

**Mitigations already present:**
- Vercel Cron has built-in dedup: documentation indicates Vercel attempts to prevent concurrent invocations of the same cron schedule. The race is structurally unlikely on Vercel infrastructure but not architecturally prevented.
- The terminal-flip gate at retry_count >= 3 caps the damage: even a double-increment couldn't push past the flip without elapsed time advancing 300s.

**Severity:** likely-fine for chapter 2's load. Re-evaluate when chapter 3's asset layer adds new dispatch volume.

**Cure shape (if needed):** add a conditional UPDATE on `retry_count`:

```js
// Forward-referenced cure (NOT shipped)
PATCH /rest/v1/dispatch_jobs?id=eq.X&retry_count=eq.<expected-current>
body: { retry_count: expected+1, last_retry_at: now }
```

The PostgREST query rejects the PATCH if `retry_count` no longer equals the expected value; the tick that loses the race no-ops without error.

**Recommended next step:** no action. Add a watchlist note. Re-evaluate at the asset-layer step if reaper traffic grows.

---

### Finding 3 · `suspected` · agents/run.js dispatch-settle write race (concurrent-write class)

**Surface:** `api/agents/run.js:295-333` (`settleDispatch` function).

**Race shape:** when N children of the same dispatch complete concurrently (which is the entire lock-foundation pattern: 4 agents run in parallel), each child's settleDispatch reads `dispatch_jobs.agents_settled`, computes `settled = count + 1`, and PATCHes back. Two concurrent child completions could both read N and both write N+1, losing one count.

**Window:** sub-second. Real for the lock-foundation fan-out where 4 agents finish around the same time.

**Class match:** concurrent write race (shape 1). The application's read-then-write on a counter.

**Existing protection:**
- Line 312: `if (total > 0 && settled >= total)` uses `>=` not `==`. So a final terminal flip survives a single missed count (settled=3 when total=4 doesn't flip; settled=4 or settled=5 both flip).
- The terminal patch (line 321) writes status='completed' or 'partial' explicitly. Multiple writes to the terminal state are idempotent.

**Outcome under the race:** `agents_settled` count could be off by 1 from `agents_count`. The Console "X of Y settled" display would be misleading by one count. Self-recovery: on next page load the count is unchanged (still off); only the terminal flip determines user-visible state, and that flips correctly because of the `>=` operator.

**Severity:** suspected, low. The off-by-one observability gap is not a state-corruption issue.

**Cure shape (if needed):** Postgres `UPDATE ... SET agents_settled = agents_settled + 1` via a SQL function exposed through PostgREST. Or accept the cosmetic off-by-one as a documented limitation.

**Recommended next step:** no action. Document the cosmetic limitation if a user-facing complaint surfaces. Re-evaluate at the asset-layer chapter where fan-out widens.

---

### Finding 4 · `real` · artifacts version race (CONFIRMED by 1C invariant)

**Surface:** `api/agents/rerun.js` + `api/_lib/chain-trigger.js:204-216` (the two `max(version)+1` sites).

**Race shape:** identical to PR #100 · two concurrent reruns both compute the same `nextVersion` and both insert. No DB unique constraint on `artifacts(user_id, artifact_type, version)`.

**Status:** confirmed by `tests/chapter-03/invariants-version-race.mjs` first-run on 2026-05-21. 8 concurrent reruns produced versions `[5, 5, 5, 4, 3, 3, 3, 2, 1]` against live production.

**Cure shape (NOT shipped · forward reference):** add a partial unique index on `artifacts(user_id, artifact_type, version)`. The application-level `max+1` can stay as-is; the DB catches collisions via 23505 which the call site treats as an idempotent skip.

**Severity:** real Cat B. Already surfaced by the invariant harness.

**Recommended next step:** included in step 2 scope (chain_id backfill migration) OR opened as step 2-bis. Decision deferred to step 2 adjudication. The harness flips green when the constraint lands.

---

### Finding 5 · `likely-fine` · lock-foundation 60s in-flight check race

**Surface:** `api/lock-foundation.js:103-117` (`findInflightLock`) + line 270-280 (the subsequent `preInsertDispatch`).

**Race shape:** between the in-flight check (line 203-205) and the pre-insert (line 270), a second lock call from the same user could pass the in-flight check and proceed to create a second dispatch + four duplicate artifacts.

**Window:** ~100-500ms (the time between the in-flight read and the pre-insert). The user would have to double-click the lock button or have two browser tabs fire near-simultaneously.

**Class match:** concurrent write race (shape 1) at the dispatch row level, but the check is app-level only.

**Why likely-fine:** the consequence is two `dispatch_jobs` rows for the same lock + 8 artifact rows (instead of 4). The dispatch fan-outs would race against each other; one would deliver 4 artifacts, the other would also deliver 4. The Console would show 2 lock dispatches for the same lock action. Cosmetic, not state-corrupting.

**Severity:** likely-fine.

**Recommended next step:** no action. If a real user report surfaces, add a partial unique index on `dispatch_jobs(user_id, kind, status) WHERE status='producing'` to enforce one in-flight per user-kind.

---

### Finding 6 · `likely-fine` · Realtime manager `start()` re-entry race

**Surface:** `js/qb-realtime-manager.js:121-130` (`start` function).

**Race shape:** `start()` is gated by `isStarted` (line 122). Concurrent `start()` calls within the same tick would both pass the check before the flag is set at line 127.

**Why likely-fine:** JavaScript is single-threaded. `start()` is synchronous up to the `isStarted = true` assignment. No `await` between the check and the set. Race window is zero.

**Severity:** likely-fine. Mentioned for completeness.

---

### Finding 7 · `likely-fine` · Realtime manager token refresh race

**Surface:** `js/qb-realtime-manager.js:163-168` (`setToken` function).

**Race shape:** `setToken` updates the token reference (line 164), then calls `supabaseClient.realtime.setAuth(newToken)` (line 166). If the Supabase client is null (e.g., during stop/start sequence), the `if (supabaseClient && newToken)` check protects. If the channel is mid-subscribe with the old token, the call may race.

**Why likely-fine:** the Supabase SDK's `setAuth` is documented to update the auth on the existing channel without resubscribing. The race window between the local `token = newToken` and the SDK's `setAuth` is intra-tick. No observed bug.

**Severity:** likely-fine.

---

## 3. Summary table

| # | Surface | Class | Severity | Action |
|---|---|---|---|---|
| 1 | Reaper terminal-flip | concurrent-write race | real, low | Add to step 2 blocker list |
| 2 | Reaper concurrent-tick | concurrent-write race | likely-fine | Watchlist · re-evaluate post-chapter-3 |
| 3 | run.js settleDispatch counter | concurrent-write race | suspected, low | No action |
| 4 | artifacts version race | concurrent-write race | real, Cat B | **Step 2 scope (already surfaced by 1C)** |
| 5 | lock-foundation in-flight check | concurrent-write race | likely-fine | No action |
| 6 | Realtime start() re-entry | dependency-loading | likely-fine | No action |
| 7 | Realtime token refresh | async state-transition | likely-fine | No action |

**Totals:** 2 `real` (#1, #4 · #4 was already surfaced by 1C) · 1 `suspected` · 4 `likely-fine`.

**Cat B count:** 1 (the artifacts version race, already in 1Z surfacing).

**Genuinely new findings from this sweep:** 1 (the reaper terminal-flip race, finding #1). Severity: low. Adds a single line item to the step 2 blocker list.

---

## 4. Outcome

The sweep validates the chapter-2 race-class hardening: three race shapes were named in steps 6-8, and the chapter-3 sweep finds 1 new instance + 1 already-surfaced instance + 5 likely-fine paths. The pattern of "three reactive races on Edge/Realtime → look for the fourth" produces exactly one new low-severity finding (#1) plus the already-surfaced version race.

The Edge/Realtime surfaces are mostly hardened. The remaining work is:
- Land the artifacts unique constraint (cures finding #4, flips the version-race invariant green).
- Optionally land the reaper terminal-flip conditional UPDATE (cures finding #1, no invariant harness needed for the small window).

Both are forward-referenced. Neither ships in step 1.

---

## 5. Forward references added by this sweep

The §8 forward references in `chapter-03/step-1-hardening-report.md` are extended with the following:

**Forward ref 3 (new from sweep) · Reaper terminal-flip atomic conditional UPDATE.** `api/cron/reaper.js:286-339`. Convert the read-modify-write of `dispatch_jobs.status='failed_permanently'` to a conditional PATCH `?status=eq.producing` that rejects when a child has delivered between the read and the flip. Severity low; recommended bundle target is the step 2 (or step 2-bis) artifacts-uniqueness migration where similar DB-level enforcement work is happening.

No other forward references added.

---

## 6. Sign-off

Sweep complete. Zero patches. Two real findings (one already surfaced by 1C, one new low-severity); one suspected; four likely-fine. The genuinely new finding (#1) is added as Forward ref 3 to the hardening report.

`Swept on branch chapter-3/step-1d-sweep`
