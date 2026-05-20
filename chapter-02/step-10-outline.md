# Chapter 2 · Step 10 spec outline · SUPERSEDED

> **Status: superseded by `step-10-spec.md` after Nizzar adjudication.** All six open calls accepted as defaults; no overrides. The full spec elaborates the conformance-audit + small-fix shape and bakes four new closure-capture patterns (conformance-audit-pattern, single-canonical-surface discipline, bell-only Realtime indicator, framework defect-rate continuation). See `step-10-spec.md` for the canonical step 10 specification.
>
> Retained below as historical record of the pre-adjudication framing.

---

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §5 below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §13.11 (`/agents` surface · Run history view + replay panel) + §5.3.1 (`/api/agent-runs/[id]/replay`) + §4.1 (`agent_runs` shape · qbp_snapshot, file_refs, runtime_args, agent_version) + §11.7 (replay acceptance criteria). Step 9 closure forward references.

Branch: `chapter-2/step-10-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 10 is the verification + gap-fill step for the Agent Console's Run history view + replay panel. Most of the substantive code shipped earlier:

- `runHistoryRow()` + `paintRunHistoryView()` shipped in step 5 (agent console) and hardened across steps 6-9.
- `openReplayModal()` shipped in step 5 with frozen-inputs surface (`agent_version`, `trigger`, `model`, tokens, schema_retry_count, qbp_snapshot, runtime_args, file_refs, error_payload).
- `/api/agent-runs/[id]/replay` GET endpoint shipped in step 4 with RLS-scoped auth.
- The `agent_runs` table writes `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version` on every run-start (§4.1 + §5.2).
- Realtime refresh of run history view inherits from step 9's `qb-realtime-manager.js` extraction · `livePayload.recent_runs` re-paints on notification arrival.

Step 10's job is to verify these surfaces against the master spec acceptance criteria (§11.7) and patch any small UX gaps surfaced by audit. The Realtime payoff from step 9 means run history view now updates live without dedicated wiring · the architectural payoff Nizzar named in the 9C-acceptance directive paid out here.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Run history view conformance audit | §6.5 + §11.7 | Verify row shape, badges, click-through, failure copy |
| Replay panel conformance audit | §5.3.1 + §11.7 | Verify frozen-inputs surface, collapsibles, error_payload rendering, modal a11y |
| New harness · `replay-panel.mjs` | step-10-spec (this doc) | Playwright-based gates for run history + replay end-to-end |

§13 items deferred out of step 10 (unchanged):

- Step 11 or 12 · Archive UI tree-view rendering.
- Step 13 · Foundation `?upgrade=success` banner.
- Step 14 · `/api/agents/dispatch.js` retirement.
- Pagination + filtering on run history view (master spec §13 explicit "Chapter 3+ enhancement", noted in `api/agents/console.js` line 92-94).

Prerequisites met (carried from steps 5-9):
- `/api/agents/console` returns `recent_runs[]` capped at 200 rows per 7-day window with row-level latency_state + retry_state already threshold-mapped.
- `/api/agent-runs/[id]/replay` returns the full frozen-input shape under RLS.
- `qb-realtime-manager.js` powers shared Realtime; run history re-paints on notification arrival.
- Two-button rerun lives on the Phase view (canonical surface per step 9 spec); run history is the audit surface.

---

## 2. Deliverable surfaces

### 2.1 Run history view conformance audit

**Status:** Shipped in step 5; refined across 6-9. The renderer at `js/qb-agents-console.js` `paintRunHistoryView()` (line ~617) iterates `livePayload.recent_runs` and renders `runHistoryRow()` per row. Per-row badges (latency, retry) carry the server-decided threshold state. Failure copy renders for `failed` / `failed_permanently` statuses.

**Audit checks:**
- Empty-state copy matches QB voice (currently `"Your run history will populate after your first agent completes."`).
- Status pills cover all six `agent_runs.status` values (queued, producing, delivered, failed, failed_permanently, schema_invalid).
- Row time prefers `completed_at` over `started_at` for terminal statuses.
- Click-through fires `openReplayModal(run.id, session)` correctly.
- Keyboard accessibility · Enter + Space trigger replay modal (already wired).

**What ships in 10A:** any small fixes surfaced by the audit. No architecture changes.

### 2.2 Replay panel conformance audit

**Status:** Shipped in step 5. `openReplayModal()` fetches `/api/agent-runs/[id]/replay`, renders header + frozen-inputs block + three `<details>` collapsibles + optional error_payload block.

**Audit checks:**
- Header shows agent_slug + version + status + relative time + duration + model.
- Frozen-inputs block surfaces all §11.7 required fields: `agent_version`, `trigger`, `model`, tokens, `schema_retry_count`.
- Collapsibles render valid JSON for `qbp_snapshot`, `runtime_args`, `file_refs`.
- `error_payload` collapsible appears only when present.
- Modal a11y · `role="dialog"`, `aria-modal="true"`, close on backdrop click + Escape (already wired).
- Focus management · open returns focus to triggering row on close. *Possible gap.*

**What ships in 10B:** focus-management fix if audit confirms the gap. Otherwise verification-only.

### 2.3 Verification harness · `tests/chapter-02/replay-panel.mjs`

New 5-gate Playwright harness covering:

1. Run history view renders with `recent_runs` populated (foundation locked, 1+ delivered artifact).
2. Click-through fires replay modal · backdrop + modal DOM present.
3. Frozen-inputs surface exposes all required fields with correct values.
4. Backdrop click + Escape close the modal; focus returns to the triggering row.
5. Realtime live-update on run history view · notification INSERT triggers re-paint of `recent_runs` (regression-gated via the 9D Phase view harness, plus a fresh assertion against the run-history-specific re-paint).

---

## 3. Sub-PR breakdown

Step 10 is small-scope (verification + minor fixes). Proposed phasing:

| Sub-PR | Topic |
| --- | --- |
| 10A | Run history view conformance audit + any small fixes |
| 10B | Replay panel conformance audit + focus-management fix if gap confirmed |
| 10C | `tests/chapter-02/replay-panel.mjs` 5-gate harness |
| 10D | Step 10 closure report |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass.

If both 10A and 10B audits surface zero gaps, the cycle collapses to "10C + 10D" with a verification-only closure report. That's a fine outcome and arguably the most likely outcome given how much of this surface shipped earlier.

---

## 4. Acceptance criteria

Per §11.7 + §13.11:

1. **Run history view renders rows correctly.** All six `agent_runs.status` values render with appropriate status pill, time, latency/retry badges, failure copy when applicable.
2. **Click-through opens replay modal.** Mouse click + Enter + Space all trigger `openReplayModal()`. Modal DOM appears within 1 s.
3. **Replay modal surfaces all frozen inputs.** `agent_version`, `trigger`, `model`, tokens, `schema_retry_count`, `qbp_snapshot`, `runtime_args`, `file_refs` all rendered. `error_payload` rendered when present.
4. **Modal a11y baseline.** `role="dialog"`, `aria-modal="true"`, Escape closes, backdrop click closes, focus returns to triggering row on close.
5. **Realtime updates propagate to run history view.** A `chain_ready` notification INSERT triggers a re-paint of `recent_runs` within 5 s (refresh-on-notification via `livePayload` update; verified independently of the 9D Phase view assertion).

---

## 5. Six open calls for Nizzar adjudication

1. **Scope · verification-only vs gap-fill.** Default outline frames step 10 as audit + minor gap-fill (focus-management is the likely gap). Override if you want step 10 to also ship a substantive enhancement (e.g., add a "Repeat with current QBP" CTA directly inside the replay modal · would shorten the audit → rerun loop for operators).

2. **Run history view · filtering primitive.** Currently the surface shows the last 200 runs in the 7-day window with no filtering. Master spec defers filtering + pagination to Chapter 3+. Override if you want a single-axis filter (by agent_slug) added to step 10 as a quality-of-life primitive · would require a small `paintRunHistoryView()` change but no API change (client-side filter on the 200-row payload).

3. **Replay modal · artifact content preview.** Default outline keeps the replay modal input-focused per §11.7. Override if you want the replay modal to also include a `<details>` block previewing the produced artifact `content` JSON · would surface the input→output relationship in one view. Trade-off: increases modal size + couples replay to artifact-reading surface.

4. **Realtime indicator on run history view.** Default · no visible "Live" pill or pulse on the run history view. The Phase view also has no visible indicator; the bell's `data-realtime` attribute is the canonical signal. Override if you want a small visual indicator (e.g., a green dot or "Live" pill) added to the view-toggle to communicate that the surface auto-updates.

5. **Two-button rerun on run history rows.** Default · rerun lives only on the Phase view (the canonical rerun surface). Override if you want rerun CTAs added to delivered-status run history rows · would duplicate the rerunCtas() pattern but on the audit surface.

6. **Run-history endpoint split.** Currently `recent_runs` is part of the `/api/agents/console` payload. Every Realtime-triggered refetch re-fetches BOTH the Phase view data AND the run history data in one round-trip. As history grows (toward the 200-row cap), this couples refresh latency to history size. Default · keep coupled; bounded shape size, refresh cadence dominated by Realtime events (rare). Override if you want a separate `/api/agent-runs/recent` endpoint with independent refresh cadence · cleaner architecture but more code to maintain.

---

## 6. Out of scope

Explicit:

- Pagination + filtering (master spec defers to Chapter 3+; outline §13 noted in api/agents/console.js).
- Phase view enhancements (shipped in step 9; verification-locked).
- Archive UI tree-view (deferred to step 11/12).
- Foundation `?upgrade=success` banner (step 13).
- `/api/agents/dispatch.js` retirement (step 14).
- New notification kinds (`artifact_delivered` etc. · forward note from step 9 §3 forward notes).
- Replay modal accessibility full WCAG audit · deferred to step 15 E2E QA pass.
- Replay panel including artifact content preview (open call #3 defaults to no).

---

## 7. Forward references

- **Step 11 or 12** Archive UI tree-view rendering. Exploits step 8 `chain_id` primitive. Visual treatment + chain-root preferences captured in step 9 spec §2.2-2.3.
- **Step 13** Foundation `?upgrade=success` banner.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **Step 15** End-to-end QA pass · full WCAG accessibility audit lives here.
- **Step 16** Final sign-off + `CHAPTER_02_COMPLETION.md`.
- **Chapter 3** Run history pagination + filtering (master spec defers); artifact-content reading surface enhancements.

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch.
