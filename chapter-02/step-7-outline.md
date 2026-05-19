# Chapter 2 · Step 7 spec outline

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §6 below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §5.3 + §5.3.1, step-6 closure report §7 forward references, `api/agents/rerun.js` header comment (MVS shipped in PR #78, Edge `waitUntil` fix in PR #86), PR #88 (notification bell MVP poll).

Branch: `chapter-2/step-7-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 7 is a conformance pass over `/api/agents/rerun.js` plus a notification-bell upgrade path. The MVS shipped in PR #78 (`60c7ce4`) handles the common case (regenerate one agent with a `qbp_source` choice); step 7 closes the remaining §5.3 + §7 conformance gaps and lays the path for Realtime.

Five sources of work:

| Item | Source | Action |
| --- | --- | --- |
| §5.3 conformance pass | `/api/agents/rerun.js` MVS | Audit + harden against the spec language |
| Replay-target version semantics | step-6-spec §13 forward ref | Validate parent_artifact_id linkage when the source is mid-chain (not the latest) |
| Content Approval Loop wiring | `/api/agents/rerun.js` header comment + §3.5 | Pipe a `feedback` runtime arg through the rerun → run path |
| `/api/artifacts/[id]/regenerate` deprecation status | step 6 closure report §7 | Decide retire-now vs retire-step-14 (X-Deprecated header is the safety net) |
| Realtime notification subscriptions | step 6 closure forward note (5) | Upgrade the bell from 30 s poll to Supabase Realtime · MVP shape preserved |

§13 items deferred out of step 7:
- §13.8 chain orchestration (step 8).
- §13.13 Foundation `?upgrade=success` banner.
- §13.14 `api/agents/dispatch` retirement (step 14).
- Chapter 4 work.

Prerequisites met (carried from step 6 closure):
- `INTER_EDGE_SECRET` live in Vercel Production.
- `CRON_SECRET` live in Vercel Production.
- Vercel Pro tier active.

---

## 2. Deliverable surfaces

### 2.1 `/api/agents/rerun.js` conformance pass

Hardening over the MVS shipped in PR #78:

- **Dual `qbp_source` handling.** Spec §5.3 requires `'current'` (default) reads `profiles.qbp`; `'original'` reads `profiles.foundation_lock_qbp` and 422s with `error.code='no_original_snapshot'` if null. PR #78 may or may not implement the 422 path; audit and align.
- **parent_artifact_id linkage validation.** When the source artifact has its own `parent_artifact_id` (i.e., the source is mid-chain), the new rerun's `parent_artifact_id` is the source (current behavior). Validate this through a verification harness with a 3-version chain.
- **Replay-target version semantics.** When user rerun on v2 of a 3-version chain (v3 is latest), the new artifact is v4 with `parent_artifact_id=v2.id` (matches spec §5.3 — "parent_artifact_id pointing at the source"). Confirm no off-by-one where the parent should point to v3 instead.

### 2.2 Content Approval Loop runtime arg

Per `/api/agents/rerun.js` header comment ("When step 7 opens, its spec starts from this endpoint and hardens it (full Content-Approval-Loop semantics, feedback runtime_args, etc)") and master spec §3.5:

- Accept a new request body field: `feedback?: string`.
- Pass through to `/api/agents/run` as `runtime_args.feedback`.
- `/api/agents/run` already writes `runtime_args` to `agent_runs.runtime_args` (per step 4 spec); the prompt-templating layer reads the feedback string and surfaces it to the agent for revision.
- No prompt-templating change in this step · only the runtime arg plumbing. The actual feedback-aware prompt rewrite is the agent author's responsibility per `/agents/<slug>/prompt.md` build conventions.

### 2.3 `/api/artifacts/[id]/regenerate` retirement decision

Step 6 closure left the X-Deprecated header on the legacy endpoint with retirement scheduled for step 14. Step 7 has an opening to retire it sooner because:
- Console rerun CTAs already route through `/api/agents/rerun` (PR #78 audit confirmed zero active callers).
- Step 7 hardens `/api/agents/rerun` to full §5.3 conformance, so the legacy endpoint's role is purely a safety net for unknown callers.

Whether to retire now or wait for step 14 is an open adjudication (§6 below).

### 2.4 Realtime notification subscriptions

Step 6D shipped the bell with a 30 s poll + visibility-aware suppression. Step 6 spec adjudication #5 deferred Realtime to step 7+.

Step 7 wires Supabase Realtime as the upgrade:

- Bell subscribes to `notifications` table changes filtered by `user_id`.
- On `INSERT` event, the bell immediately rerenders the dropdown + increments the badge (no fresh GET needed for the count, but a GET fires to fetch the full row payload for display).
- The 30 s poll stays as a fallback for browsers without WebSocket support or transient Realtime disconnects.
- Visibility-aware suppression behavior unchanged for the poll path. Realtime path runs continuously regardless of tab focus (server-pushed; no client poll to suppress).

Cost note: Supabase Realtime billing is per-connection and per-message. With 1k-10k users this is well within the free / pro tier. Capture in spec.

### 2.5 Verification harness extensions

Extend `tests/chapter-02/` with two new harnesses:

- `rerun-conformance.mjs` · the 10-run rerun harness mirroring `regenerate-10x.mjs` shape but targeting `/api/agents/rerun`. Add mid-chain source coverage (5 runs against v1 of a 3-version chain, 5 runs against v2). Verifies dual `qbp_source` handling, `parent_artifact_id` linkage, version bump correctness, `feedback` runtime arg pass-through.
- `bell-realtime.mjs` · Playwright harness that opens the bell, subscribes to Realtime, inserts a notification via service-role, asserts the bell badge updates within a small window (target: <2 s) without a manual poll cycle.

Contact-sheet matrix may or may not need new states (Realtime is invisible to a static screenshot · the bell looks the same whether updated via poll or Realtime). Open adjudication (§6.6).

---

## 3. `/api/artifacts/[id]/regenerate` retirement timing · open call

Default outline picks: **retire in step 7.**

Rationale:
- The X-Deprecated header was the safety net for any caller drift between step 6 and step 14. Zero callers observed across step 6's full window per the verification harness traces.
- Step 7 hardens `/api/agents/rerun` to full §5.3 conformance, so the legacy endpoint's reason-to-exist disappears.
- Leaving it alive until step 14 means three surfaces (`run`, `rerun`, `regenerate`) coexist when only two are real. Operator code-reading load.

Alternative if you prefer step 14: leave `regenerate.js` in place, keep the X-Deprecated header, step 14 deletes both `regenerate.js` AND `/api/agents/dispatch.js` in one sweep.

---

## 4. Sub-PR breakdown

Step 7 is smaller than step 6. Proposed phasing:

1. **7A · rerun conformance + retire legacy regenerate.** `/api/agents/rerun` audited and hardened. `/api/artifacts/[id]/regenerate.js` deleted (if §3 picks retire-now). Harness: `rerun-conformance.mjs` 10/10. Single PR.
2. **7B · Content Approval Loop runtime arg.** `feedback` field accepted by rerun, passed to run. No prompt-side change. Single PR.
3. **7C · Realtime notification subscriptions.** Bell wires Supabase Realtime channel. Poll stays as fallback. Harness: `bell-realtime.mjs`. Single PR.
4. **7D · Verification closure.** Closure report + capture-state additions if any.

Each sub-PR gates on the prior. Per the autonomous-chain posture established at step 6 closure, sub-PRs may merge autonomously after their gates pass; touchpoints are at the verification reports.

---

## 5. Acceptance criteria

Per §13.7 + §11.3 (regenerate) + §11.8 (notifications):

1. **Rerun conformance 10/10** · `tests/chapter-02/rerun-conformance.mjs` reports 10/10 successful reruns. 5 runs target v1 (root of chain), 5 target v2 (mid-chain). All produce correct `version=N+1` with `parent_artifact_id=source.id`. `qbp_snapshot` matches the chosen `qbp_source`.
2. **`feedback` runtime arg trace** · A rerun POST with `{ artifact_id, qbp_source, feedback: "test feedback" }` writes the feedback string to `agent_runs.runtime_args.feedback`. Verified via service-role read.
3. **`/api/artifacts/[id]/regenerate` retired** (if §3 picks retire-now) · POST returns 410 OR the route returns 404. No regression on Console rerun CTAs (which route through `/api/agents/rerun`).
4. **Realtime bell update under 2 s** · `tests/chapter-02/bell-realtime.mjs` inserts a notification via service-role, observes the bell badge update in the headless browser within 2 s without a manual poll cycle.
5. **Poll fallback path intact** · The 30 s poll remains active. Verified by disabling Realtime subscription (via feature flag or DOM probe) and observing the badge update at the next poll tick.
6. **No regression on step 6 capture matrix** · All 15 capture states from step 6E re-fire green.

---

## 6. Open calls for Nizzar adjudication

Recorded for traceability; default-outline picks documented for each.

1. **`/api/artifacts/[id]/regenerate` retirement timing.** Default: retire in step 7A (zero callers, X-Deprecated safety net fired no flags). Override if you want it to stay until step 14.

2. **`feedback` runtime arg vs full Content Approval Loop scope.** Default outline: ship the runtime-arg plumbing only in 7B (rerun accepts `feedback`, run writes to `agent_runs.runtime_args.feedback`). The actual revision logic (3-revision loop, prompt template selection based on revision number) is the agent author's responsibility per `/agents/<slug>/prompt.md`. Override if you want step 7B to include the loop counter + revision number tracking in `dispatch_jobs` or `agent_runs`.

3. **Realtime path · subscription scope.** Default: bell subscribes to `INSERT` events on `notifications` table filtered by `user_id`. No `UPDATE` subscription (the bell's only state-change event is "new notification arrived"; reads/marks happen client-side). Override if you want bell to also react to `read_at` updates from other tabs.

4. **Replay-target version semantics on mid-chain rerun.** When user rerun on v2 of a 3-version chain (v3 is latest), the spec-aligned behavior is: new artifact = v4 with `parent_artifact_id = v2.id`. The chain becomes v1 → v2 → v3 and v2 → v4 (branched). Confirm this is the intended semantics. Override if you want v4 to chain off v3 (the latest) instead, making it a linear v1 → v2 → v3 → v4 (with `source_artifact_id=v2.id` for replay-target tracking but `parent_artifact_id=v3.id`).

5. **Realtime as primary vs Realtime as supplement.** Default: Realtime is supplemental · the 30 s poll stays alive as a fallback for browsers without WebSocket support and as a transient-disconnect safety net. Override if you want Realtime to be primary (poll only fires on Realtime connection error).

6. **Capture states for step 7.** Default outline: no new capture states · Realtime is invisible to a static screenshot, the rerun behavior is observable in the existing nine step-5 + six step-6E states. Add a state only if a specific surface (e.g., a feedback dialog modal, a Realtime-connected status pill) ships in step 7. Override if you want capture-state coverage for any visible surface step 7 produces.

---

## 7. Out of scope

Explicit:

- Chain orchestration (§13.8, step 8).
- Phase 02+ synthesizer retrofit (Chapter 4).
- Foundation `?upgrade=success` banner (§13.13).
- `/api/agents/dispatch.js` retirement (step 14 · regardless of whether `regenerate.js` retires in step 7 or step 14).
- Notification preferences UI (CHAPTER_02_SPEC.md §14.4 explicit out-of-scope).
- DAG view in Agent Console (CHAPTER_02_SPEC.md §14.3 explicit out-of-scope).
- Prompt-template changes for feedback-aware revisions (agent author responsibility, not framework scope).
- Notification email template changes (step 6 shipped the dispatch_failed email; no new notification kinds in step 7).

---

## 8. Forward references

- **Step 8 · chain orchestration.** Depends on step 6 lock-foundation refactor + step 7 rerun conformance. The chain-trigger logic fans out to `/api/agents/run` via the same `dispatch-pattern.js` helper.
- **Step 9 · `/agents` surface enhancements** if any (most Console work shipped in step 5 + 6).
- **Step 14 · `/api/agents/dispatch.js` retirement** (regardless of `regenerate.js` retirement timing in step 7).

---

## 9. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §6 open calls. Full spec follows in a second commit on the same branch.
