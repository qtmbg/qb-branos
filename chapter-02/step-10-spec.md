# Chapter 2 · Step 10 spec · `/agents` Run history + replay panel (full)

Status: full spec. All six adjudications baked in (see §2 — Nizzar accepted all defaults). Outline file `chapter-02/step-10-outline.md` retained as the canonical framing doc; this spec elaborates the conformance-audit + small-fix shape. Hold-open PR #125 stays on hold-gate until explicit release.

Source authority: `CHAPTER_02_SPEC.md` §13.11 + §6.5 + §5.3.1 + §4.1 + §11.7. Step 9 closure forward references.

Branch: `chapter-2/step-10-spec`.

---

## 1. Bundle framing

Step 10 is the verification + small-fix step for the Agent Console's run history view + replay panel. Most substantive code shipped earlier (step 5 build, step 6-9 hardening). The job here is to audit against §11.7 acceptance criteria, patch any small gaps surfaced (the most likely candidate is replay-modal focus management on close), and ship a 5-gate Playwright harness that locks the surface against regression.

The Realtime payoff from step 9C pays out here without new wiring: `livePayload.recent_runs` re-paints on notification arrival via the shared `qb-realtime-manager.js`. Run history view is Realtime-aware as a side effect of the manager extraction. No new subscription code in step 10.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Run history view conformance audit | §6.5 + §11.7 | Verify row shape, badges, status pill coverage, click-through, failure copy |
| Replay panel conformance audit | §5.3.1 + §11.7 | Verify frozen-inputs surface, modal a11y, focus return on close (likely gap) |
| New harness · `tests/chapter-02/replay-panel.mjs` | step-10-spec §2.3 | 5-gate Playwright harness |

§13 items unchanged · deferred out:

- Step 11 · Archive UI tree-view (deferred from step 9 per sequencing override).
- Step 13 · Foundation `?upgrade=success` banner.
- Step 14 · `/api/agents/dispatch.js` retirement.
- Pagination + filtering on run history view (Chapter 3+ enhancement per master spec and `api/agents/console.js:92`).

Prerequisites met (carried from steps 5-9):
- `/api/agents/console` returns `recent_runs[]` (200-row cap per 7-day window).
- `/api/agent-runs/[id]/replay` GET endpoint with RLS-scoped auth.
- `agent_runs` writes `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version` on run-start.
- `qb-realtime-manager.js` shared by bell + Phase view; run history view inherits live-refresh via `livePayload`.

---

## 2. Adjudicated decisions · baked into this spec

Per Nizzar's six-point adjudication against `step-10-outline.md` (all defaults accepted):

### 2.1 Scope · verification-only with focus-management fix if audit confirms

**Decision:** No "Repeat with current QBP" CTA inside the replay modal. Single canonical rerun surface on Phase view stays. The replay modal is the audit surface; rerun is the action surface; they don't merge. If the audit surfaces a focus-management gap on modal close, fix it in 10B; otherwise 10B is verification-only.

### 2.2 No client-side filter on run history

**Decision:** Phase view already provides per-agent grouping; run history is the chronological audit view. Filtering deferred to Chapter 3 as a unified design pass (pagination + filtering co-designed).

### 2.3 Replay modal stays input-focused

**Decision:** No artifact content preview as a collapsible. Input semantic (replay modal) and output semantic (artifact reading surface at `/artifact/[id]`) stay separated. Coupling them would blur the "what produced this version" affordance.

### 2.4 No visible "Live" pill on run history

**Decision:** Bell carries the canonical Realtime signal via `data-realtime` attribute. Single source of truth for connection status. Avoid sprawl across every Realtime-enabled surface. Captured as a forward-note pattern for 10E closure.

### 2.5 No rerun CTAs on run history rows

**Decision:** Audit surface is for inspection, not action. Run history rows stay click-through-to-replay-only. Adding rerun CTAs would duplicate the canonical Phase view affordance and violate single-canonical-surface discipline.

### 2.6 Keep `recent_runs` in `/api/agents/console` payload

**Decision:** 200-row bounded shape + rare Realtime refresh cadence dominate the cost picture. Split into a separate endpoint only when a real metric demands it (e.g., refresh latency degrades past a threshold or payload size grows under traffic), not theoretically.

---

## 3. Deliverable surfaces

### 3.1 Run history view conformance audit (9A)

**Status:** Shipped in step 5 (Agent Console build), refined across steps 6-9. The renderer at `js/qb-agents-console.js` `paintRunHistoryView()` (~line 617) iterates `livePayload.recent_runs` and renders `runHistoryRow()` per row.

**Audit checks (§6.5 + §11.7):**
- Status pill covers all `agent_runs.status` values that can appear in `recent_runs`: `queued`, `producing`, `succeeded`, `failed`, `failed_permanently`, `schema_invalid`. (Note: `agent_runs` uses `succeeded` per migration 011; `dispatch_jobs.status` uses `delivered`. Verify the pill rendering handles both terminologies if it surfaces either.)
- Row time prefers `completed_at` over `started_at` for terminal statuses; falls back to `started_at` for in-flight.
- Per-row latency + retry badges painted from server-decided `latency_state` / `retry_state` (no client-side threshold re-application).
- Failure copy renders for `failed` and `failed_permanently` via `userActionCopy` + fallback to `genericFailedCopy`.
- Click handler + keyboard (Enter, Space) both trigger `openReplayModal(run.id, session)`.
- Empty-state copy: `"Your run history will populate after your first agent completes."` (already present; verify QB voice match).

**What ships in 10A:** any small fixes surfaced. The likely zero-gap outcome is acceptable. No architecture changes.

### 3.2 Replay panel conformance audit + focus-management fix if gap (10B)

**Status:** Shipped in step 5. `openReplayModal()` fetches `/api/agent-runs/[id]/replay` and renders header + frozen-inputs block + three `<details>` collapsibles (qbp_snapshot, runtime_args, file_refs) + optional error_payload block. Backdrop click + Escape both close the modal.

**Audit checks (§5.3.1 + §11.7):**
- Header surfaces agent_slug + `v${artifact_version}` + status + relative time + duration + model.
- Frozen-inputs block surfaces required §11.7 fields: `agent_version`, `trigger`, `model`, `tokens_in` / `tokens_out`, `schema_retry_count`.
- Collapsibles render valid JSON for `qbp_snapshot`, `runtime_args`, `file_refs`.
- `error_payload` collapsible appears only when present (currently wired).
- Modal a11y baseline: `role="dialog"`, `aria-modal="true"` (currently wired).
- Escape closes; backdrop click closes (currently wired).
- **Likely gap:** focus management on close. Current code does not return focus to the triggering row. Patch if confirmed.

**What ships in 10B:** focus-return-on-close patch if the audit confirms the gap. Implementation pattern: capture `document.activeElement` at modal open, restore on close (backdrop click + Escape paths both need it). Reduced-motion respected (the modal uses no animations beyond opacity transitions already).

### 3.3 Verification harness · `tests/chapter-02/replay-panel.mjs` (10C)

New 5-gate Playwright harness:

1. **Run history view renders rows with delivered artifacts.** Test user with foundation locked + at least one completed agent_run. Verify rows appear with status pill + latency/retry badges + click-through affordance.

2. **Click-through opens replay modal.** Mouse click + keyboard Enter both trigger `openReplayModal`. Modal DOM (`.replay-modal`) appears within 2 s.

3. **Replay modal surfaces all frozen inputs.** Header has agent_slug + version + status + time. Frozen-inputs block has all §11.7 required fields. Three collapsibles present (qbp_snapshot, runtime_args, file_refs).

4. **Modal a11y: Escape + backdrop close, focus returns.** Open modal, press Escape · modal closes, focus returns to triggering row. Open modal, click backdrop · same. (This gate validates the 10B fix if shipped; if no fix needed it validates the pre-existing behavior.)

5. **Realtime live-update on run history view.** Notification INSERT triggers re-paint of `recent_runs` within 5 s (refresh-on-notification via shared manager). Verifies that the architectural payoff from 9C extends to run history without dedicated wiring · inherited live-refresh.

---

## 4. Sub-PR breakdown

Step 10 expected to be small-scope (verification + likely one small fix). Proposed phasing per outline:

| Sub-PR | Topic |
| --- | --- |
| 10A | Run history view conformance audit + any small fixes |
| 10B | Replay panel conformance audit + focus-management fix if gap confirmed |
| 10C | `tests/chapter-02/replay-panel.mjs` · 5-gate harness |
| 10D | Step 10 closure report |

**Expected collapse path:** if both 10A and 10B audits surface zero gaps beyond the focus-management one (most likely outcome per outline §3), the cycle effectively becomes "10B small fix → 10C harness → 10D closure". If even the focus-management gap is absent, it collapses to "10C harness → 10D closure" with verification-only ledger. Either is fine.

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass.

---

## 5. Acceptance criteria

Per §11.7 + §13.11:

1. **Run history view renders rows correctly.** All status values that can appear in `recent_runs` render with appropriate status pill, time, latency/retry badges, failure copy when applicable.

2. **Click-through opens replay modal.** Mouse click + Enter + Space all trigger `openReplayModal()`. Modal DOM appears within 2 s.

3. **Replay modal surfaces all frozen inputs.** `agent_version`, `trigger`, `model`, tokens, `schema_retry_count`, `qbp_snapshot`, `runtime_args`, `file_refs` all rendered. `error_payload` rendered when present.

4. **Modal a11y baseline.** `role="dialog"`, `aria-modal="true"`, Escape closes, backdrop click closes, focus returns to triggering row on close.

5. **Realtime updates propagate to run history view.** A `chain_ready` notification INSERT triggers a re-paint of `recent_runs` within 5 s (refresh-on-notification via `livePayload` update inherited from 9C).

---

## 6. Out of scope

Explicit:

- Pagination + filtering on run history (Chapter 3+ per master spec).
- Phase view enhancements (shipped in step 9; verification-locked).
- Archive UI tree-view (step 11 per sequencing override from step 9).
- Foundation `?upgrade=success` banner (step 13).
- `/api/agents/dispatch.js` retirement (step 14).
- "Repeat with current QBP" inside replay modal (open call #1 default).
- Client-side agent_slug filter (open call #2 default).
- Artifact content preview in replay modal (open call #3 default).
- "Live" pill on run history view (open call #4 default).
- Rerun CTAs on run history rows (open call #5 default).
- Splitting `recent_runs` to dedicated endpoint (open call #6 default).
- New notification kinds (e.g., `artifact_delivered`) · forward note from step 9.
- Replay modal full WCAG accessibility audit · deferred to step 15 E2E QA pass.

---

## 7. Forward references

- **Step 11** Archive UI tree-view rendering. Exploits step 8 `chain_id` + `parent_artifact_id` primitives. Visual treatment + chain-root preferences captured in step 9 spec §2.2-2.3.
- **Step 13** Foundation `?upgrade=success` banner.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **Step 15** End-to-end QA pass · full WCAG accessibility audit lives here.
- **Step 16** Final sign-off + `CHAPTER_02_COMPLETION.md`.
- **Chapter 3** Run history pagination + filtering unified design pass; artifact-content reading surface enhancements; potential `artifact_delivered` notification kind if user feedback demands it.

---

## 8. Captures for the step 10 closure report

Carryforward + new (per Nizzar directive):

- **Framework defect-rate continuation.** Aggregate across chapter 2. Step 10 is expected verification-only; defect-rate should stay at 8 across steps 6-9 (well below the 12+ escalation threshold). If the chapter-3 hardening plan holds, this remains a chapter-3 first-step item.

- **Conformance-audit-pattern as new chapter-2 capture (NEW).** When most of a surface ships across earlier build steps, the dedicated step becomes verification + small gap-fill, not heavy build. Step 10 is the canonical example: the run history + replay panel shipped in step 5, hardened across 6-9, and step 10's job is to lock it down with a harness. **Sequencing implication for chapter 3:** identify audit steps vs build steps at chapter spec time so the plan reflects the actual work shape, not a default "build the surface" framing.

- **Single-canonical-surface discipline as new pattern (NEW).** Surfaces have semantic roles: rerun lives on Phase view (action), audit lives on run history (inspection), output lives on the artifact reading surface (consumption). Don't duplicate affordances across surfaces because "convenience" · the duplication erodes the semantic role of each surface. Step 10 adjudications #1, #3, #5 all reinforce this: no in-modal rerun, no in-modal artifact preview, no in-row rerun.

- **Bell-only Realtime indicator pattern as new capture (NEW).** Single source of truth for Realtime connection status: the bell's `data-realtime` attribute. No per-surface "Live" pills, no duplicated indicators on every Realtime-enabled surface. Step 10 adjudication #4 establishes this pattern; future Realtime-aware surfaces inherit silently via the shared manager.

- **Tooling discipline (carryforward).** Permanent forward note. Comet stays operator-only.

---

## 9. End of spec

Hold-open PR #125 stays on hold-gate until explicit release. Per autonomous-chain posture, the chain resumes on hold-release with sub-PR 10A.
