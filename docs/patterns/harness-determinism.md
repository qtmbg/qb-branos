# Pattern · harness-determinism · wait for mount + data-painted-state before asserting

**Origin:** chapter 2, step 10C (`tests/chapter-02/replay-panel.mjs`).
**Refined at:** step 11C (`archive-tree.mjs`), step 12C (`foundation-banner.mjs`), step 13A (`e2e-chapter-2.mjs`).

Any Playwright harness against a chapter-2 surface MUST wait for two signals before asserting against the DOM:

1. **Mount complete** · the surface's mount marker (e.g., `.qb-notification-bell[data-mounted="true"]` for the bell, `.qb-foundation[data-bucket]` for the foundation, `.console-shell` + `.phase-section_active` for the Agent Console).
2. **Realtime connected** · `data-realtime="true"` on the bell · indicates `qb-realtime-manager` has reached the `'realtime'` state (or accepted `'poll'` fallback).

Without these waits, the harness races the async init pipeline and surfaces intermittent FAILs that look like product bugs but are test-infrastructure timing issues.

## When to use

- Any harness assertion against a surface that uses `qb-realtime-manager` (bell, Phase view, run history, archive, foundation upgrade banner).
- Any harness that interacts with a view-toggle, click handler, or focus state before the surface has finished its first async render.

## Canonical wait

```js
// Wait for the data-painted state (NOT the loading skeleton)
await page.waitForSelector('.qb-foundation[data-bucket]', { timeout: 20_000 });

// Wait for bell mount
await page.waitForSelector('.qb-notification-bell[data-mounted="true"]', { timeout: 15_000 });

// Wait for Realtime connection (or poll-fallback acceptance)
await page.waitForFunction(() => {
  const b = document.querySelector('.qb-notification-bell[data-mounted="true"]');
  return b && b.getAttribute('data-realtime') === 'true';
}, null, { timeout: 30_000 });

// Now safe to assert.
```

## Loading-state vs data-painted-state distinguisher

The chapter-2 surfaces all carry a `.{surface}-shell` wrapper class for both the loading skeleton AND the rendered state. The `[data-bucket]`, `[data-mounted]`, or equivalent attribute is set ONLY on the rendered state.

**Wrong** (matches the loading skeleton):
```js
await page.waitForSelector('.qb-foundation', { timeout: 20_000 });
```

**Right** (matches only the rendered article):
```js
await page.waitForSelector('.qb-foundation[data-bucket]', { timeout: 20_000 });
```

Step 13A's first FAIL on Gate 4 was exactly this trap · the wait matched the loading skeleton, then the assertion queried for `.qb-exercise-card.is-locked` which doesn't exist in the skeleton, returning 0/2+ and a FAIL classification.

| Surface | Loading-state class | Data-painted-state attribute |
|---|---|---|
| Foundation | `.qb-foundation.is-loading` | `.qb-foundation[data-bucket]` |
| Agent Console (Phase view) | `.console-shell` only | `.console-shell + .phase-section_active` |
| Archive | `.qb-archive.is-loading` | `.qb-archive` (no specific painted attribute · use child markers) |
| Bell | (no loading state · gates on mount) | `.qb-notification-bell[data-mounted="true"]` |

## Why the dual-wait pattern

The Realtime manager subscribes asynchronously. Until SUBSCRIBED arrives (or the SUBSCRIBED grace timeout fires), the page's notification channel isn't live. A harness that mutates DB state to trigger a notification BEFORE the channel is subscribed sends the event into the void.

Step 10C surfaced this · the replay-panel harness's view-toggle interaction sometimes raced the bell's `qb-realtime-manager.start` lifecycle, producing intermittent FAILs that vanished when extra `evaluate()` calls (which added ~100ms of latency) were inserted. The race got fixed deterministically by waiting for both `[data-mounted]` AND `data-realtime="true"` before the toggle click.

Every chapter-2 harness from step 10C onward applies this pattern. Zero intermittent FAILs across 10C, 11C, 12C, 13A.

## When NOT to apply

- Harnesses that never assert against a Realtime-aware surface (e.g., pure curl-based API checks, the Reaper cron harness).
- Harnesses that DELIBERATELY exercise the pre-mount state (very rare · usually a different test entirely).

## Gotchas

- **Don't bypass with `page.waitForTimeout(N)`.** Fixed timeouts mask races · they pass locally and FAIL in CI under load. The selector-based waits are the right shape.
- **Bell mount can take up to 15s on cold contexts.** The Supabase SDK is lazy-imported from CDN. Don't set the timeout too tight.
- **SUBSCRIBED grace timeout is 10s.** If a harness sees `data-realtime="true"` flip in <10s, it's the live channel. If it sees `data-realtime="false"` then `"true"` flicker, it's the poll-fallback path engaging. Both states are valid for assertion purposes.

## Origin context

Step 10C's Gate 4 (replay modal a11y) FAILed intermittently on first ship. The diagnostic instrumentation (pre-Esc state dump + MutationObserver) traced the failure to a race between the harness's view-toggle click and the bell's manager-subscribe async lifecycle. The accidental fix was extra `evaluate()` calls that added latency; the deterministic fix was the dual-wait pattern documented here. Every harness since uses it.
