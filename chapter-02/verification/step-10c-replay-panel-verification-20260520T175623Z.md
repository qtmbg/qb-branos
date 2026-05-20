# Chapter 2 · Step 10C · Replay panel verification report

**Run:** 2026-05-20 17:56 UTC
**Branch:** main @ a8b3e8a (post-10B)
**Spec:** `chapter-02/step-10-spec.md` §5
**Harness:** `tests/chapter-02/replay-panel.mjs`
**Run artifact:** `tests/chapter-02/replay-panel.last-run.json`

## Result · 5/5 PASS

| Gate | Status | Detail |
|---|---|---|
| 1 · Run history renders rows | PASS | 1 run-row with status pill rendered after switching to Run History tab |
| 2 · Click-through opens replay modal | PASS | Modal DOM present with `role=dialog` + `aria-modal=true` |
| 3 · Frozen-inputs surface complete | PASS | Header has agent_slug + v1; 5 required fields (agent_version, trigger, model, tokens, schema_retry_count); 3 collapsibles (qbp_snapshot, runtime_args, file_refs) |
| 4 · Modal a11y · close + focus return | PASS | closeBtn focused on open; focus returns to triggering row on Escape AND on backdrop click |
| 5 · Realtime live-update | PASS | refetch fired in 502 ms after notification INSERT · 2 new GET /api/agents/console |

## What we verified

Step 10 ships the conformance audit + focus-management fix for the Agent Console run history view + replay panel. The harness verifies end-to-end on production.

- **Run history view** (10A audit, zero gaps) · rows render with status pill, latency/retry badges, click + keyboard handlers, failure copy.
- **Replay modal** (10B focus-management fix) · `focusSource` captured at modal open, restored via single `closeModal()` function on all three close paths (× button, backdrop click, Escape). closeBtn focused on open for keyboard signal.
- **Realtime extension** (inherited from 9C) · `livePayload.recent_runs` re-paints on notification arrival. No new wiring required · the `qb-realtime-manager.js` payoff pays out here.

Gate 4 specifically verifies the 10B fix end-to-end: open modal, press Escape, focus returns to `.run-row`; reopen, click backdrop, focus returns again. Three close paths, one consistent behavior.

## Latent-bug log · zero production bugs · one harness-determinism finding

Step 10 shipped 10A audit (zero gaps) + 10B focus-management fix + 10C harness. No surgical fixes to production code beyond 10B's planned focus patch. Chapter-2 running total stays at **8 across steps 6-10**.

One **harness-determinism finding** captured separately under §Forward notes · this is a test-instrumentation pattern, not a production bug.

## Five-gate methodology · observations

- **Gate 4 testing the 10B fix.** The audit-driven fix (capture activeElement on open, restore on close, focus closeBtn on open) is verified by:
  - `closeBtnFocused`: read `document.activeElement.classList.contains('replay-modal_close')` immediately after open
  - `focusAfterEsc`: read after Escape close — verifies focus restored to `.run-row`
  - `focusAfterBackdrop`: read after backdrop click close — verifies the same restore path works for the second close trigger
  - All three booleans must be true for Gate 4 PASS. They are.

- **Gate 5 inherits 9C payoff cleanly.** No new code was needed for run history view to refresh on notification arrival · the shared `qb-realtime-manager.js` dispatches to all subscribers, and Phase view's `refetchAndRepaint` writes to `livePayload` which both Phase view and Run History view read from. The architectural payoff named in step 9 closure §3.1 is exercised here as a side effect, not a deliberate wiring.

- **Harness race surfaced + mitigated.** During verification, the harness initially showed intermittent Gate 4 FAILs — `.run-row` would vanish from the DOM after the modal closed, with the view auto-switching back to Phase view. Diagnostic instrumentation (pre-Esc state dump + MutationObserver) revealed the failure was a race between the harness's tab-click and the bell's `qb-realtime-manager.start` async lifecycle. The accidental fix was extra `evaluate()` round-trips before Escape that gave the page enough time to settle. The deterministic fix: wait for both `.qb-notification-bell[data-mounted="true"]` AND `data-realtime="true"` before clicking the Run History tab. With both conditions met, the manager has fully subscribed and no deferred re-paint races against the harness's interactions.

## Forward notes for 10D closure

- **Harness-determinism pattern · wait for manager-ready before view interactions (NEW).** Future Realtime-aware surface harnesses should wait for both bell-mounted AND data-realtime='true' attribute states before interacting with view-toggle elements or other UI affordances that can trigger re-paints. This locks the harness against intermittent FAILs from manager-subscription races. Pattern captured here; applies to step 11+ harnesses against the archive tree-view and any future surface that subscribes to the shared manager.

- **Conformance-audit-pattern played out as predicted (carries forward to 10E).** 10A surfaced zero gaps; 10B surfaced exactly the focus-management gap the spec called out; 10C captured everything in one harness. The "audit step vs build step" framing from step 10 spec §8 holds: when a surface ships across earlier build steps, the dedicated step's work shape is verification + one small fix, not heavy build.

- **`agent_runs.status` enum verified.** Status pill map at `js/qb-agents-console.js:159-168` covers `succeeded`, `started`, `failed`, plus artifact-status fallbacks (`delivered`, `queued`, `failed_permanently`). `agent_runs.status` enum is `started | succeeded | failed` per migration 011 · all three are mapped. No gap.

## Sign-off

All five gates PASS. Step 10 verification clears. Next: 10D closure report with framework-defect-rate continuation + the four new closure captures (conformance-audit-pattern, single-canonical-surface discipline, bell-only Realtime indicator pattern, harness-determinism pattern).
