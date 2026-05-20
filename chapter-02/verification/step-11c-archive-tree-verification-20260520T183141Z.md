# Chapter 2 · Step 11C · Archive tree-view verification report

**Run:** 2026-05-20 18:31 UTC
**Branch:** main @ 3b27caa (post-11B)
**Spec:** `chapter-02/step-11-spec.md` §5
**Harness:** `tests/chapter-02/archive-tree.mjs`
**Run artifact:** `tests/chapter-02/archive-tree.last-run.json`

## Result · 5/5 PASS

| Gate | Status | Detail |
|---|---|---|
| 1 · Chain-grouped tree renders | PASS | 1 chain card · title `"Locked 2026-05-20 · 2 agents"` (format ok) |
| 2 · Branched reruns nest as children | PASS | 1 child row at depth >= 1 (v2 with `parent_artifact_id=v1.id` nests under v1) |
| 3 · "Earlier work" section surfaces legacy | PASS | Section title `"Earlier work"` · 1 legacy row below chain section |
| 4 · In-flight chain renders placeholder | PASS | 1 in-flight row (queued sensescape) with `is-pending` class |
| 5 · Realtime live-update | PASS | refetch fired in 500 ms after notification INSERT · 2 new `GET /api/artifacts` |

## What we verified

Step 11 ships the archive tree-view per the sequencing override from step 9 and Nizzar's six adjudications. The harness verifies end-to-end on production:

- **Tree-only render (adj #2)** · `renderArchiveTree` replaces `buildList`; each chain renders as a `qb-card` with offset shadow + Fraunces title.
- **Chain root anchor (carried from step 9 §2.3)** · `"Locked YYYY-MM-DD · N agents"` format validated by regex.
- **Branched reruns via `parent_artifact_id` (step 7A + step 8 primitive)** · v2 nests visually inside v1 via the recursive `buildChainArtifactNode` + `.qb-archive-chain-child` indent + `↳` glyph.
- **"Earlier work" copy (adj #6 refined)** · vocabulary discipline applied · not "Pre-chain history" (system vocab), not "Chapter 1 artifacts" (build vocab).
- **In-flight placeholders (adj #4)** · queued artifacts surface with status pill + `is-pending` class + click-disabled state. Weakest-persona moment honored · a user who just locked sees the chain producing, not a blank.
- **Realtime extension (adj #3 / step 9C canonical pattern)** · `mgr.onNotification(refetchAndRepaint)` inherits cleanly · one notification, one channel, three consumers (bell + Phase view + archive) updating from a single state machine.

## Latent-bug log · zero production bugs · one harness-seed finding

Step 11 shipped 11A endpoint extension + 11B client rewrite + 11C harness with no production-code surgical fixes. Chapter-2 running total stays at **8 across steps 6-11**.

One **harness-seed finding** captured separately under §Forward notes for 11D · this is a test-instrumentation issue, not a production bug.

## Harness-determinism pattern applied (carried from step 10 §3.6)

The harness waits for **both** conditions before any tree-view assertions:

```js
await page.waitForSelector('.qb-notification-bell[data-mounted="true"]', { timeout: 15_000 });
await page.waitForFunction(() => {
  const b = document.querySelector('.qb-notification-bell[data-mounted="true"]');
  return b && b.getAttribute('data-realtime') === 'true';
}, null, { timeout: 30_000 });
```

This makes the harness deterministic against the bell's manager-subscribe race that 10C surfaced. No intermittent FAILs across the 11C verification cycle.

## Forward notes for 11D closure

- **Harness-seed schema discipline (NEW · candidate).** The first 11C run FAILed on Gate 4 because the queued sensescape artifact was seeded with `content: null`, which violates the `artifacts.content` NOT NULL constraint. The DB rejected the INSERT silently from the harness's perspective (PostgREST returns 400 + the 23502 error in the response body, but the harness's `await` ignored the status). The seed function now uses `content: {}` as the queued-state convention. **Pattern for chapter 3+ harnesses:** check INSERT response status codes when seeding fixture data. Silent 400s during seed produce "missing fixture row" failures downstream that look like client bugs.

- **Realtime extension to archive validates the 9C architectural payoff.** Three surfaces (bell + Phase view + archive) now subscribe to one shared `qb-realtime-manager.js` singleton. One channel, one state machine, one auth surface. Notification INSERT propagated to archive's refetch in 500 ms · matches Phase view's 1003 ms timing from 9D and bell's <2 s timings across 7C / 9D / 10C. The pattern scales.

- **Chain depth + tree visualization match step 8 framework guardrails.** The recursive `buildChainArtifactNode` traverses up to `CHAIN_DEPTH_CAP=8` levels (per step 8 chain-trigger.js). Step 11 verified with depth=1 branching (v1 → v2 child); deeper trees not exercised in this harness because chain depth in chapter 2 typically stays at 1 (Phase 01 agents fanning from lock). Real chapter 3+ chains with Phase 02 synthesizers will exercise deeper trees · the recursive renderer is ready.

- **"Earlier work" copy + vocabulary discipline (carryforward · NEW pattern from 11-spec §8).** User-facing copy should not leak internal system or build vocabulary. Each candidate string runs the QB voice test before shipping. Step 11 §2.6 adj #6 refinement is the canonical instance.

## Sign-off

All five gates PASS. Step 11 verification clears. Next: 11D closure report with the framework-defect-rate continuation, harness-seed schema discipline capture, and confirmation of step 12 scope.
