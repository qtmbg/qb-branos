# Chapter 2 · Step 5 · Agent Console verification report

**Step:** Step 5 close · Agent Console (Phase view + Run history + replay panel) live verification.
**Generated:** 2026-05-16T14:58:22Z.
**Code commit:** `1c4dce4` (PR #78, merged).
**Verdict:** **Code-path verifications clean across A + B. Case C surfaced as finding for step 6+. Six visual surfaces awaiting operator-side browser capture. Step 7 sequencing note folded in per PR #78 approval.**

---

## 1. Boundary case A · null `duration_ms` on a run row

### What the spec needs

A run that failed before timing started, or a row in-flight with no `completed_at` yet, has `duration_ms = null`. The per-row latency badge must render without crashing.

### Code-path verification

Server (`api/agents/console.js`):
- `thresholdState(value, gold, rose)` at line 66 · explicit null guard: `if (value == null || Number.isNaN(value)) return null;`
- `recent_runs[].latency_state = thresholdState(r.duration_ms, ...)` at line 304 · returns `null` when `duration_ms` is null

Client (`js/qb-agents-console.js`):
- `const latencyState = run.latency_state || 'monochrome';` · null falls through to `'monochrome'` default
- Badge text: `` `${fmtMs(run.duration_ms)}` ``
- `fmtMs(null)` at line 80 returns `'·'` (the QB middle-dot placeholder)

**Result:** badge renders as `·` in monochrome state with the steady-state tooltip. No null reference, no NaN, no crash. **PASS by inspection.**

Screenshot slot: a Run history row showing a failed-before-timing-started run · expected: `[Failed] [agent] [time] [·] [retry N]` with both badges monochrome.

---

## 2. Boundary case B · rerun on a deep `parent_artifact_id` chain

### What the spec needs

An artifact whose lineage is v1 → v2 → v3 → v4. Rerun on v4 must create v5 with `parent_artifact_id = v4.id`. The replay panel on v5 must surface v5's own `qbp_snapshot`, not v4's or any older version's.

### Code-path verification

`/api/agents/rerun.js` artifact insert at lines 117-125:
```js
version: (Number(source.version) || 1) + 1,
parent_artifact_id: source.id,
```

If `source.version = 4` and `source.id = A4`, new artifact is `{version: 5, parent_artifact_id: A4}`. Chain is linear and additive.

`/api/agent-runs/[id]/replay.js` filter at lines 56-57:
```js
?id=eq.${encodeURIComponent(runId)}
&user_id=eq.${encodeURIComponent(userId)}
```

The query is keyed on the specific `run.id` from `recent_runs[]`, not on `agent_slug` or `latest`. Run history click passes `run.id` → endpoint returns that run's frozen inputs.

**Result:** v5's replay panel surfaces v5's qbp_snapshot. v4's snapshot is preserved on v4's run row (queryable via its own `run.id`). Same version-semantics correctness from PR #78 audit item 3, one chain-level deeper. **PASS by inspection.**

Screenshot slot: replay modal opened on a v5 run · expected header `agent_slug · v5`, qbp_snapshot block contains the QBP at time of v5's run (different from v4's if QBP fields changed between runs).

---

## 3. Boundary case C · stuck queued v2 blocks rerun button on the agent · finding

### What the spec needs

A user clicks "Rerun · current QBP" on a delivered v1. `/api/agents/rerun` creates v2 in `status='queued'`. The runtime crashes or hangs before v2 reaches a terminal state. The user returns to the Console and expects the rerun button to **still be available** so they can try again.

### Code-path finding

`js/qb-agents-console.js:198-199`:
```js
function rerunCtas(agent, opts) {
  if (!agent.latest_artifact || agent.latest_artifact.status !== 'delivered') return null;
```

`api/agents/console.js` `readLatestArtifacts` at line 121:
```js
&order=version.desc&limit=1
```

`latest_artifact` is **strictly the latest version**, regardless of status. After the rerun, v2 (queued) becomes `latest_artifact`. v1 (delivered) is no longer surfaced as the agent's row state.

`rerunCtas` gates on `latest_artifact.status === 'delivered'`. With v2 in queued, the gate returns null. **Rerun button hides.** The user cannot retry until v2 reaches a terminal state.

### Severity

Real finding. Cosmetic only as long as the reaper (step 6+) sweeps stuck queued rows · the worst case today is "user must wait" rather than "user is locked out." But this is fragile: if the reaper isn't yet wired (Chapter 2 step 8) and a crash leaves v2 stuck, the user has no UI surface to recover.

### Recommended fix (deferred per PR #78 approval)

**Option 1 (server-side · preferred):** `/api/agents/console` returns both `latest_artifact` (any status) AND `latest_delivered_artifact` (status='delivered' specifically) on each agent. Console renders rerun CTAs against `latest_delivered_artifact`. v2's queued state shows on the row's status pill; v1's delivered surface remains the rerun anchor.

**Option 2 (client-side):** weaken the rerunCtas gate to `latest_artifact?.status === 'delivered' || agent.has_prior_delivered`. Needs a new field on the payload.

**Option 3 (architectural):** wait for the reaper at step 8 to clear stuck queued rows within the 30 s + 2 min + 5 min backoff. The user-visible gap shrinks to <8 min worst case.

### Where this lands

Per PR #78 approval: not a step-5 blocker. Per PR #79 approval (this report): **fold the fix into step 6 lock-foundation refactor**, which touches `readLatestArtifacts` anyway. Server-side `latest_delivered_artifact` is the chosen fix shape · one change instead of two.

**Status: DEFERRED to step 6 lock-foundation refactor. Server-side `latest_delivered_artifact` is the fix path.**

### Gating-window caveat for the step 5 → step 6 gap

Between merge of step 5 (PR #78 · already on prod) and lock-foundation landing in step 6, the user-visible behavior is:

- User clicks rerun on v1 (delivered) → `/api/agents/rerun` creates v2 in `queued` → Console reloads → v2 is `latest_artifact` → rerun CTAs disappear from the agent row
- v2 reaches `delivered` → rerun CTAs reappear (gated on the new latest's status)
- v2 reaches `failed` (transient) → rerun CTAs reappear under the failure branch
- v2 reaches `failed_permanently` → "Retry manually" pill appears (see §3.1 below · independence confirmed)
- v2 stalls in `queued` indefinitely → **user is locked out of further reruns until reaper or operator intervention**

In practice, Phase 01 happy-path latencies (8.8-22.9 s observed) mean the CTA-hidden window is seconds. The user clicks rerun, the button hides briefly, the new artifact lands, the button reappears with v2 as the new anchor.

The risk surface is dispatch stalls. If `/api/agents/run` gets cancelled mid-Claude-call (the PR #59 mechanism · which still lives until step 6 refactors the parent), v2 sits queued indefinitely. The reaper at step 8 sweeps it within the 30s/2min/5min backoff. **Worst-case lockout: ~8 minutes before reaper recovers v2 to `failed_permanently` and the manual-retry pill takes over.**

**Acceptable as step 5 → step 6 known debt. Flagged here explicitly so it does not surface as a regression complaint mid-window.**

### §3.1 Permanent-failure "Retry manually" pill independence · trace

The user's question at PR #79 approval: does the §5.5 "Retry manually" pill share Case C's gating problem? **Trace confirms it does not.**

Server compute path (`api/agents/console.js`):
- Line 140: `readActiveDispatches` includes `status=in.(producing,failed_permanently)` · pulls both in-flight and terminal-permanent rows
- Lines 220-225: `permanentlyFailed = activeDispatches.find(d => d.status === 'failed_permanently' && <maps to latestArtifact.id>)` · independent computation; reads `dispatch_jobs.status`, not `artifacts.status`
- Line 262: ships `permanently_failed_dispatch_id` in the per-agent payload

Client gate (`js/qb-agents-console.js:250-262`):
```js
const errStatus = agent.permanently_failed_dispatch_id ? 'failed_permanently'
  : (agent.latest_artifact?.status === 'failed' || agent.latest_run?.status === 'failed') ? 'failed'
  : null;
if (errStatus) {
  // copy renders for both
  if (errStatus === 'failed_permanently') {
    // "Retry manually" pill
  } else {
    // standard rerunCtas (current / original QBP)
  }
}
```

The "Retry manually" pill is gated by `permanently_failed_dispatch_id` (a server-computed `dispatch_jobs` lookup), **not** by `latest_artifact.status`. When v2 reaches `failed_permanently`:
- `dispatch_jobs.status = 'failed_permanently'`
- Server's `permanentlyFailed.find(...)` returns the v2 dispatch (it maps to `latestArtifact.id = v2.id`)
- `permanently_failed_dispatch_id` is set
- `errStatus = 'failed_permanently'`
- "Retry manually" pill renders

The permanent-failure recovery path stays live regardless of what `latest_artifact.status` reads. Case C does **not** propagate to the failed_permanently surface. It is isolated to the transient rerun CTAs only.

**Step 6 fix shape (server-side `latest_delivered_artifact`) addresses Case C without needing to touch the permanent-failure path.** The two surfaces are orthogonal.

Screenshot slot: a Console state with a stuck queued v2 · expected: status pill reads "Producing" (or "Queued"), the rerun CTAs row is absent. After the reaper sweeps, the row recovers.

---

## 4. The six visual surfaces from PR #78 approval

Each requires operator-side browser capture against the deployed `/agents` route on `https://quantumbranding.ai`. Vercel auto-deployed commit `1c4dce4` to production on PR #78 merge.

Screenshots can be attached as PR comments OR committed to `/chapter-02/verification/step-5-screenshots/` and referenced inline.

### 4.1 Phase view · four health-dot states

The §6.6.3 dot has four states. Each needs a screenshot.

| State | How to produce | Expected dot color |
| --- | --- | --- |
| **neutral** | Fresh test user, foundation locked, no runs in 7-day window | `rgba(45, 21, 33, 0.4)` (40% opacity ink) |
| **green** | All four agents delivered, rolling averages within thresholds | `var(--phase-discovery)` forest green `#5B7E6A` |
| **yellow** | At least one rolling average in gold band (e.g. Visual DNA latency >20 s on 7-day avg but <23 s) | `var(--gold-deep)` `#B89540` |
| **red** | Most-recent-run failed OR rolling average above rose threshold | `var(--rose-deep)` `#B8704D` |

Tooltips on hover should match `HEALTH_LABEL` map: "Healthy", "Watch · one threshold elevated", "Action · threshold exceeded or recent failure", "No recent data".

### 4.2 Run history view · badge thresholds at boundaries

The §6.6.1 + §6.6.2 thresholds apply per-row. Screenshots needed at the boundaries:

- Latency badge at exactly 20 000 ms (gold floor) · expected: gold-deep
- Latency badge at exactly 23 001 ms (rose floor) · expected: rose-deep
- Retry badge at 0 (monochrome) · expected: ink color
- Retry badge at 1 (rose, since 1 > 0.5 threshold) · expected: rose-deep

Visual DNA's typical 22.9 s production runs should produce gold-band latency badges on individual rows.

### 4.3 Replay modal on a non-latest run

Open replay on a v2 (not v5) of a multi-version agent. Confirm:
- Modal header reads `agent_slug · v2`
- qbp_snapshot block contains v2's QBP (not v5's)
- runtime_args, file_refs, agent_version reflect v2's run
- Backdrop dismisses on click outside; ESC dismisses

### 4.4 Transient-failed copy + rerun CTAs

Force a transient failure on Soul Map (e.g. via service-path `force_error='model_call_failed'` from a local conformance harness pointing at prod). Expected Console state:
- Status pill reads "Failed"
- §5.8.1 user-action copy renders below the meta line (for `model_call_failed` this falls to `genericFailedCopy('failed') = 'Run failed. The system is retrying automatically.'`)
- Standard rerun CTAs visible · "Rerun · current QBP" (primary) + "Rerun · original QBP" (secondary)

### 4.5 `failed_permanently` retry pill

Synthesise a `failed_permanently` state (manually advance a `dispatch_jobs.status` to `failed_permanently` for an agent, or wait for the reaper at step 8 to exhaust 3 retries on a forced failure). Expected:
- Status pill reads "Permanently failed"
- §5.8.1 copy: `PERMANENTLY_FAILED_COPY = 'Run failed after multiple attempts. Try a manual rerun.'`
- A single "Retry manually" pill (`is-primary is-sm`) · standard two-button rerun CTAs do NOT render

### 4.6 Locked Phase 02-05 cards

For any signed-in user (free or starter tier), Phase view should render below the live Phase 01 section:
- Phase 02 · Brand Creation · Logo Direction, Logo Evaluation, Voice Guide
- Phase 03 · Content Creation · Content Strategist, Campaign Planner
- Phase 04 · Execution · Execution Planner
- Phase 05 · Intelligence · Predictive Panel, Quarterly Brand Review

Each card: locked-glyph (◐ at 40% opacity), agent display name, "Unlocks when Starter tier is active" copy. Visual treatment per §6.3 (full row but muted).

---

## 5. §13 step 7 sequencing note · folded in per PR #78 approval

Per PR #78 audit item 3B: `/api/agents/rerun.js` is the minimum-viable surface of §13 step 7 (regenerate endpoint refactor), shipped in step 5 to keep reruns on the contract path during the step 5 → step 6 gap.

**Implication for step 7:** when step 7 opens for spec review, the starting point is the existing `/api/agents/rerun.js` endpoint, not a blank slate. Step 7 hardens it with:
- Content Approval Loop feedback semantics (`runtime_args.feedback`)
- Per-spec §6.4 invariants on the secondary "original QBP" button (disabled tooltip when source qbp_snapshot is null)
- Full retirement of `/api/artifacts/[id]/regenerate` (currently dead path, retires at step 14 alongside `api/agents/dispatch`)

No spec rewrite happens in this PR · the sequencing shift is captured here so step 7's spec PR opens against the right baseline.

---

## 6. Step 6 input · cron source pre-decided

Per the PR #78 approval message: **AD-001 selects Vercel Pro as the cron source for §13 step 8 reaper.** Step 6 (lock-foundation refactor) does not depend on this · the reaper is step 8. Captured here as a forward note so the reaper spec opens against the locked decision.

Vercel Pro cron supports per-minute granularity; the §5.5 reaper backoff schedule (30 s / 2 min / 5 min) maps onto a 1-minute cron tick with per-row backoff checks inside the handler. Documented in §5.5 of CHAPTER_02_SPEC.md.

---

## 7. Verification summary

| Item | Status |
| --- | --- |
| Boundary A · null duration_ms safe render | **PASS** by inspection |
| Boundary B · deep parent_artifact_id chain replay correctness | **PASS** by inspection |
| Boundary C · stuck queued v2 blocks rerun button on agent | **FINDING** · deferred to step 8 (reaper) or earlier UI hardening per §3 recommendations |
| Six visual surfaces (Phase dot · 4 states, badge thresholds, replay non-latest, transient failed, failed_permanently pill, locked Phase 02-05 cards) | **Operator-side browser capture pending** |
| §13 step 7 sequencing note | **Captured** here per PR #78 approval |
| Step 6 input · Vercel Pro cron per AD-001 | **Noted** for forward reference |

---

## 8. Definition of done · step 5 close

| Item | Status |
| --- | --- |
| Phase view renders four health states from server-decided dot color | code shipped · screenshots pending |
| Run history shows per-row badges with server-decided state | code shipped · screenshots pending |
| Replay panel resolves a specific run_id (not latest) | confirmed by code path |
| §5.8.1 user-action copy renders on user-fixable error codes | code shipped · screenshots pending |
| §5.5 manual retry pill on failed_permanently · two-button rerun on transient failed | confirmed by code path · screenshots pending |
| Locked Phase 02-05 cards with "Unlocks when Starter tier is active" copy | code shipped · screenshots pending |
| Rerun routes through `/api/agents/rerun` (contract-conformant path) | confirmed by code path |
| Boundary case C finding surfaced for step 6+ adjudication | this report §3 |
| Step 7 sequencing note captured | this report §5 |
| Step 8 cron decision noted forward | this report §6 |
| Verification report committed | this file |

---

## 9. Next step

Step 5 closes when:
1. Operator captures the six visual surfaces (§4) and attaches them to this PR
2. Case C deferral (§3) is confirmed as acceptable for step 6 entry

Step 6 (lock-foundation refactor) begins immediately after step 5 closes. The spec for step 6 is in §5.1 of CHAPTER_02_SPEC.md; the cron source is pre-decided per AD-001.

Hold-open until operator captures screenshots and confirms the C deferral.

---

## End of step 5 verification report
