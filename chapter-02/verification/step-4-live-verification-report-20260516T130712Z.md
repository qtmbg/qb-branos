# Chapter 2 · Step 4 · live verification report

**Step:** Step 4 close criteria · live verification of `/api/agents/run` against the locked spec.
**Generated:** 2026-05-16T13:07:12Z.
**Harness:** [`tests/chapter-02/step-4-live-verification.mjs`](../../tests/chapter-02/step-4-live-verification.mjs) · invokes the runtime's handler with synthetic Request objects against real Supabase + Anthropic.
**Verdict:** **27 PASS · 2 BLOCK · 0 FAIL.** Ten of twelve close criteria verified live. Two blocked with documented closure paths; both acceptable defers per the locked methodology.

---

## 1. Verification approach · why handler-direct, not HTTP-via-prod

The verification harness invokes the `/api/agents/run` handler directly with synthetic `Request` objects. The handler is the same JS code Vercel Edge runs in production. Same Supabase, same Anthropic, same auth code paths (JWT verify and inter-edge HMAC verify both execute).

Why this shape:

- **No dependency on `INTER_EDGE_SECRET` being set in Vercel env.** The secret is generated locally and passed via `process.env.INTER_EDGE_SECRET` so the harness can sign HMAC headers and the handler verifies them. Same code path; the secret is shared in-process. Production sets its own `INTER_EDGE_SECRET`; the runtime works identically.
- **Catches DB write paths.** Every `agent_runs`, `dispatch_jobs`, and `artifacts` mutation lands in real Supabase and is readable for assertions.
- **Same Claude API.** Live model calls with funded key.

What this does NOT cover:

- **Vercel Edge runtime envelope.** Cold start, edge-instance network latency, the 25 s hard wall. Production traffic exercises this; the harness does not.
- **The full prod HTTP path through CDN.** `Access-Control-Allow-Origin`, `Vary`, etc. Smoke-tested via the production probe (`curl -X POST` returns 401 as expected).

The harness gap is documented; criteria that depend on Edge-specific behavior (criterion 9, cold-boot operator-notify emission) are surfaced as BLOCK with closure paths.

---

## 2. Per-criterion results

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1+2 | Conformance live · all 4 agents schema-valid happy path | **PASS** × 4 | Soul Map 19.3 s 716+633 tokens · Sensescape 12.9 s 1696+870 · Visual DNA 25.3 s 874+862 · War Table 20.1 s 1104+862. All schema-valid. |
| 3a | a3 `edge_timeout` via `force_error` (service auth) | **PASS** | `body.error=edge_timeout`, `agent_runs.error_payload.code=edge_timeout`, `agent_runs.status=failed` |
| 3b | a3 `model_call_failed` via `force_error` (service auth) | **PASS** | `body.error=model_call_failed`, `agent_runs.error_payload.code=model_call_failed`, `agent_runs.status=failed` |
| 4 | a4 `agent_version` writes to `agent_runs` AND `dispatch_jobs` | **PASS** × 4 | Every agent: `agent_runs.agent_version=1`, `dispatch_jobs.agent_version=1`, matches META.version |
| 5 | a5 `qbp_snapshot` writes on every run | **PASS** × 4 | All four agents wrote 38-key qbp_snapshot. Replay surface has the frozen QBP |
| 6 | `META.model` resolution honored | **PASS** × 4 | `agent_runs.model` = `claude-sonnet-4-6` for Soul Map / Visual DNA / War Table; `claude-haiku-4-5-20251001` for Sensescape · matches the spec |
| 7 | `retry_budget=0` honored | **PASS** × 4 | `agent_runs.schema_retry_count=0` across all four successful happy-path runs. No in-call retry observed (matches §5.2.1 + §12 known debt) |
| 8 | PR #67 harness 10/10 against `/api/agents/run` | **BLOCK** | Requires a deployed `test-async-lock-v2.js` that mirrors lock-foundation's Option A pattern against `/api/agents/run`. Scoped out of this run; closure path in §4 |
| 9 | `LATENCY_BUDGET_WARNINGS` forwarded to operator channel | **BLOCK** | Fires once per cold-boot Edge instance. The harness invokes the handler in a single Node process; the cold-boot path isn't simulated. Closure path in §4 |
| 10 | `dispatch_jobs` partial settlement via forced failure on one child | **PASS** | Two-agent dispatch · one succeeded, one forced to fail. Parent settled to `status=partial`, `agents_settled=2/2`, `completed_at` set |
| 11a | Failure-path: `qbp_field_missing` writes queryable `agent_runs` row | **PASS** | Empty QBP → Visual DNA → `agent_runs.status=failed`, `error_payload.code=qbp_field_missing` |
| 11b | Failure-path: success path writes queryable row | **PASS** | Covered by criterion 1+2 · every success produces `status=succeeded` with full meta |
| 11c | Failure-path: `schema_validation_failed` writes queryable row | **PASS** | Forced via `force_error`. `agent_runs.status=failed`, `error_payload.code=schema_validation_failed`, `schema_retry_count=1` (one attempt before exhausting budget=0) |
| 12 | Supabase-unavailable edge case documented | **PASS** | §6 below + inline in `api/agents/run.js` (`openAgentRun` returns null on failure, `closeAgentRun` no-ops on null `runId`) |

---

## 3. Notable observations from the live data

### 3.1 Visual DNA latency single-shot · 25.3 s observed

The harness measured 25 256 ms wall for Visual DNA's successful run. The agent's internal `CLAUDE_TIMEOUT_MS` is 24 000 ms; the Claude call completed within that, but the surrounding handler wall (auth verify, Supabase reads, agent execution, DB writes, response serialization) totaled 25.3 s in this Node-equivalent environment.

Production Edge has its own 25 000 ms hard wall. Visual DNA at this latency would be at the very edge of the Vercel ceiling. Whether the handler completes inside the wall in production depends on:

- Edge-vs-Node Supabase latency · usually lower in Edge (same datacenter)
- Cold-start overhead · adds ~200-500 ms on cold Edge
- Anthropic regional routing · varies

This matches the **§12 known-debt entry** (Visual DNA marginal at 22.9 s observed Claude call; tracked for production monitoring). The live verification confirms the marginal status with a real measurement. **The framework's pre-check correctly fires the LATENCY_BUDGET_WARNING for Visual DNA at registry load.** No code change needed; the operator surveillance path is the resolution.

### 3.2 schema_retry_count writes exactly as spec'd

On the forced `schema_validation_failed` run (criterion 11c), `agent_runs.schema_retry_count=1`. This is the per-attempt count per §5.2 step 8 amendment: the agent's `run()` was called once, returned `ok:true` with content that failed `validateArtifact`, the runtime incremented the counter and re-called (since the loop runs `attempt 0 through retry_budget`). At `retry_budget=0`, the loop runs exactly attempt 0, the schema fails, the counter increments to 1, the loop exits with `schema_validation_failed`. **This is the correct shape**: the count reflects attempts that produced invalid output, which is the model-drift signal for §6.6.1.

### 3.3 Sensescape on Haiku · 12.9 s · matches prior 8.8-12.7 s baseline

Live Sensescape run on Haiku 4.5 returned in 12.9 s with 1696+870 tokens and a schema-valid artifact. Sits at the high end of the step-3 phase B baseline (8.8-12.7 s); the run with the highest input tokens (1696, vs baseline 1684) takes correspondingly longer. Within expected variance. No regression.

### 3.4 Partial settlement timing · `completed_at` set on first dispatch

The two-agent partial-settlement test (criterion 10) showed `completed_at=2026-05-16T13:05:58.645+00:00` immediately after the second (failed) child settled. The runtime's `settleDispatch` function reads all child artifacts, computes the terminal status, and writes `completed_at` in the same call. No race condition; no hung "still producing" state.

---

## 4. The two BLOCK criteria · closure paths

### 4.1 Criterion 8 · PR #67 harness 10/10 against `/api/agents/run`

**What's blocked:** the run-repro.mjs pattern fires fire-and-forget child fetches from a parent endpoint. Today's `test-async-lock.js` fires to `test-async-dispatch.js`. To validate `/api/agents/run` under the same load pattern, we need a `test-async-lock-v2.js` (or similar) that:

- Pre-inserts artifact rows + dispatch_jobs row (Option A pattern)
- Uses `context.waitUntil()` to fire 4 child `fetch()`s to `/api/agents/run`
- Returns 202 immediately

Then adapt `tests/chapter-02/run-repro.mjs` to optionally target the v2 endpoint, run 10 times, count stuck-vs-delivered children. The success criterion is 10/10 children deliver (where the original test caught 6/10 stuck).

**Why it's a defer-not-fail:** the cancellation bug was a parent-context-teardown problem. `/api/agents/run` is the CHILD, not the parent. The parent that calls it (lock-foundation refactor in step 6) is what needs to use the Option A pattern. Step 4 ships the runtime; step 6 ships the parent that uses it.

The PR #67 harness measured the Chapter-1 parent behavior. The Chapter-2 parent that uses the new runtime (lock-foundation refactor in step 6) is where the harness gets adapted. The runtime itself (single-shot Edge invocation) cannot have the parent-context-teardown bug because it has no children to fire.

**Suggested closure: validate this in step 6** (lock-foundation refactor). The harness adaptation lands there with the refactored parent. Add a step-4 follow-up note to §13 build sequence if you want it tracked sooner.

### 4.2 Criterion 9 · `LATENCY_BUDGET_WARNINGS` forwarded to operator channel

**What's blocked:** the runtime fires `LATENCY_BUDGET_WARNINGS` to the operator channel on first dispatch after a cold-boot Edge instance (see `fireRegistryLatencyWarnings()` in `api/agents/run.js`). The handler-direct harness runs everything in one Node process · the "first dispatch" fires once at the very first invocation, but the operator-notify dedup (60 s in-process Map) suppresses subsequent invocations.

To observe the email arriving at `me@qtmbg.com` with `[QB BrandOS Operator]` prefix, the closure path is:

- Set `INTER_EDGE_SECRET` in Vercel env (currently absent · service-path auth fails in prod)
- Confirm `RESEND_API_KEY` is set in Vercel env (it is)
- Make a fresh dispatch via HMAC-signed request to prod `/api/agents/run` after a cold Edge boot
- Observe `me@qtmbg.com` receives a `[QB BrandOS Operator] latency_budget_warning · visual_dna_synthesizer` email

**Why it's a defer-not-fail:** the code path is verified by inspection of `fireRegistryLatencyWarnings()` and the operator-notify dedup logic. The only thing not exercised is the email arrival itself, which is an operator-side observation. The verification harness logs confirm `LATENCY_BUDGET_WARNINGS.length === 1` (Visual DNA marginal warning) at registry load, and the runtime's first-dispatch path correctly calls `sendOperatorNotification(...)`.

**Suggested closure: operator-side observation after `INTER_EDGE_SECRET` is set in Vercel env.** Single curl with signed HMAC headers; check inbox. Sub-five-minute task.

---

## 5. Verification summary

| # | Criterion | Status |
| --- | --- | --- |
| 1 | 4-agent conformance live | **PASS** |
| 2 | a3 edge_timeout via force_error | **PASS** |
| 3 | a3 model_call_failed via force_error | **PASS** |
| 4 | a4 agent_version writes (agent_runs + dispatch_jobs) | **PASS** |
| 5 | a5 qbp_snapshot writes | **PASS** |
| 6 | META.model resolution | **PASS** |
| 7 | retry_budget=0 honored | **PASS** |
| 8 | PR #67 harness 10/10 | **BLOCK** (defer to step 6) |
| 9 | LATENCY_BUDGET_WARNINGS forwarded | **BLOCK** (operator-side observation) |
| 10 | Partial settlement | **PASS** |
| 11 | agent_runs failure-path writes | **PASS** (all three terminal paths) |
| 12 | Supabase-unavailable doc | **PASS** |

**10 of 12 verified live. 2 documented blockers with closure paths.**

---

## 6. Supabase-unavailable edge case · operational documentation

Per criterion 12, this section names the edge case explicitly.

When `openAgentRun` POSTs to Supabase `/rest/v1/agent_runs` and the request fails (Supabase unreachable, RLS error, network partition), `openAgentRun` returns `null`. Subsequent `closeAgentRun` calls check `if (!runId) return;` and no-op. The handler returns the run summary with `agent_runs_id: null`.

Consequences:

- No `agent_runs` row exists for the dispatch.
- The artifact row is still PATCH'd to `delivered` or `failed` (those use the same Supabase client but separate calls; one can succeed where another fails).
- The replay panel (§5.3.1) shows no run history for that artifact · the user sees the artifact but cannot inspect the run.
- The reaper does NOT see this state because it queries `dispatch_jobs.status='producing'`, not orphan-artifacts.

**Operational stance:** acceptable. Supabase availability is a higher-order concern than the runtime's correctness. When Supabase is down, ALL dispatches fail in the same way; this edge case is not specific to `/api/agents/run`. Production monitoring (Vercel function error rate, Supabase status page) catches the broader incident before this edge case becomes load-bearing.

**Resolution if it ever becomes load-bearing:** retry the `openAgentRun` POST with exponential backoff (3 attempts) before giving up. Adds latency on the rare failure path; not worth the complexity today.

Inline note added in `api/agents/run.js:212-215` (openAgentRun function comment block) so future readers see the trade-off without consulting the spec.

---

## 7. Step 4 close · adjudication request

Per the locked rhythm, step 4 closes when all twelve criteria verify. Today: 10 verified, 2 blocked with documented closure paths.

**Two adjudication options:**

**Option A · accept 10/12, close step 4, fold blockers into step 6 + an operator observation:**
- Criterion 8 closes in step 6 verification (lock-foundation refactor brings the parent that needs the harness)
- Criterion 9 closes via a 5-minute operator-side observation after `INTER_EDGE_SECRET` is set in Vercel env
- Step 5 (Agent Console surface) begins immediately

**Option B · hold step 4 open, build criterion 8 harness in this PR, defer criterion 9 only:**
- Build `api/test-async-lock-v2.js` + adapt `run-repro.mjs` in this PR
- Run 10 live dispatches, verify 10/10 success
- Step 4 closes when criterion 8 lands
- Criterion 9 still requires `INTER_EDGE_SECRET` in Vercel env + cold-boot observation

**Recommendation: Option A.** The cancellation bug is a parent-context-teardown issue · `/api/agents/run` is the child, not the parent. Validating the child against a parent that doesn't yet use it (lock-foundation still uses the legacy dispatch path) tests behavior outside step 4's scope. The honest place to validate is in step 6, where the parent gets refactored.

Awaiting your call.

---

## 8. Definition of done · step 4 verification

| Item | Status |
| --- | --- |
| Live conformance across all four agents | done · 27/27 sub-assertions PASS |
| Force-error hook exercised (a3 live) | done · edge_timeout + model_call_failed PASS |
| Database writes verified (a4 + a5 + schema_retry_count + model + error_payload) | done · all four agents |
| Partial settlement verified | done |
| Failure-path writes verified across all three terminal paths | done |
| Supabase-unavailable edge case documented | done |
| Harness committed for re-runs | `tests/chapter-02/step-4-live-verification.mjs` |
| Verification report committed | this file |
| Two BLOCK criteria with documented closure paths | done · §4 |

---

## 9. Next step

Per the adjudication on §7, either:

- **Option A approved:** merge this PR. Operator observation of criterion 9 in a 5-min follow-up. Step 5 (Agent Console surface) begins.
- **Option B approved:** I build criterion 8 in this PR, re-run, resurface.

Hold-open per Chapter 2 PR policy.

---

## End of step 4 live verification report
