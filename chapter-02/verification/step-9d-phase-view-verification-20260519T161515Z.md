# Chapter 2 · Step 9D · Phase view verification report

**Run:** 2026-05-19 16:15 UTC
**Branch:** main @ 104d806 (post-9C)
**Spec:** `chapter-02/step-9-spec.md` §5
**Harness:** `tests/chapter-02/phase-view.mjs`
**Run artifact:** `tests/chapter-02/phase-view.last-run.json`

## Result · 5/5 PASS

| Gate | Status | Detail |
|---|---|---|
| 1 · Phase view renders correctly | PASS | Phase 01 active section + four Phase 02-05 locked sections present after foundation lock |
| 2 · Locked rows are tier-aware | PASS | Starter sees "Available in Chapter ${N} · ${label} phase" for all four sections; Free sees "Unlocks when Starter tier is active" |
| 3 · Two-button rerun present | PASS | rerunCtas() code-inspection · primary/secondary/Chapter-1-legacy-guard present. Functional regression-gated by 7B rerun-feedback-arg.mjs (2/2 PASS this session) |
| 4 · Realtime live update | PASS | Notification INSERT triggers Phase view refetch in 1003 ms · bell badge increments simultaneously (single manager dispatching to both consumers) |
| 5 · No bell regression | PASS | Bell consumes shared manager · no inline Supabase client. 7C bell-realtime.mjs re-fired 5/5 PASS this session before 9D harness run |

## What we verified

Step 9 ships the `/agents` Phase view as the canonical Agent Console surface, with two material changes from the pre-9 baseline:

1. **Tier-aware locked-row copy.** Free users continue to see the Starter-upsell narrative ("Unlocks when Starter tier is active"). Starter+ users now see the build-ahead narrative ("Available in Chapter ${4,5,6,7} · ${Brand Creation, Content Creation, Execution, Intelligence} phase"). The corrected copy answers the actual question a paying user asks when they hit a still-locked row.

2. **Realtime extension via shared `qb-realtime-manager.js`.** A new singleton manager owns the Supabase Realtime client, channel, and state machine. Both bell and Phase view subscribe. On notification arrival (`chain_ready` / `dispatch_failed`), the Phase view refetches `/api/agents/console` and re-paints. Poll-fallback at 30 s when manager state='poll'. Bell behavior is unchanged (verified by re-firing 7C bell-realtime.mjs 5/5 PASS).

Gate 4's verification is the architectural payoff captured live: a single notification INSERT propagates to both consumers in one channel event. Bell badge increments. Phase view refetches. Same SDK, same client, same state machine.

## Latent-bug log · zero surgical fixes in step 9

Step 9 shipped three sub-PRs (9A, 9B verification-only, 9C) without surfacing latent bugs. The chapter-2 running total stays at 8 surgical fixes (carried from step 8 closure). Well below the 12+ escalation threshold.

Two minor harness-evolution observations captured separately under §Forward notes below · these are test-instrumentation findings, not production bugs.

## Five-gate methodology · observations

- **Gate 1 selector precision.** Initial pass used `waitForSelector('.console-shell')` which matches the loading skeleton AND the data-painted state. False-positive risk: assertion ran against the loading skeleton before fetch resolved, locked sections count was 0/4. Fix: wait for `.phase-section_active, .console-error, .console-empty` (any data-painted state). General principle: the loading-state selector and the success-state selector need to be distinct in any harness covering render assertions.

- **Gate 2 reload pattern.** Same loading-vs-painted issue surfaced on `page.reload()` between Starter-context and Free-context probes. Same fix applied to the reload paths.

- **Gate 4 cold-start timing.** Initial pass had a 5 s polling window for the refetch. The bell's 7C harness uses 8 s for INSERT propagation under similar conditions. Bumped to 10 s; observed actual refetch in ~1 s after SUBSCRIBED. The slack matters for cold-context SDK load (the Supabase JS module is ~80 KB lazy-loaded from CDN).

- **Gate 4 bell-badge bisect diagnostic.** Reading bell badge `data-count` before + after the insert was the bisection point that confirmed bell received the event (so manager dispatch worked) AND told us where to look if Phase view refetch hadn't fired (it would have been a Phase-view subscription bug). Bell + Phase view both receive the event from one channel.

## Forward notes for 9E closure

- **`qb-realtime-manager.js` as canonical Realtime extraction pattern.** Future surfaces (e.g., run history view if it grows live-update needs, artifact reading surface, archive tree-view) extend by calling `QBRealtimeManager.onNotification(cb)` + `QBRealtimeManager.onState(cb)`. The manager API is the contract; no new Supabase clients, no new channels, no new state machines. This is the architectural payoff Nizzar flagged in the 9C-acceptance directive.

- **Harness pattern for render-state assertions.** Distinguish loading-state selector from data-painted-state selector. Capture in test conventions for chapter 3.

- **Notification scope limitation acknowledged.** The Phase view only refreshes on `chain_ready` / `dispatch_failed` (the two `notifications.kind` values that actually fire). Lock-foundation and manual-rerun deliveries do not fire notifications · those transitions surface on the next 30 s poll-fallback window or next page navigation. Acceptable for v1; a future `kind='artifact_delivered'` notification would close this gap if user feedback surfaces it.

## Sign-off

All five gates PASS. Step 9 verification clears. Next: 9E closure report.
