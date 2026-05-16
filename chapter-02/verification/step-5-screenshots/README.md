# Step 5 verification screenshots

This directory holds the nine visual surfaces required to close step 5 per PR #79.

Capture via the seed-and-capture script · `node seed-and-capture.mjs <state>` for one state, or `node seed-and-capture.mjs all` to fire all nine sequentially and build a 3x3 contact sheet PNG at the end. Script seeds a fresh test user into the target state via Supabase admin + service-role writes, mints a session, drives Playwright headless against `https://quantumbranding.ai/agents` with `localStorage.qb_session` injected, captures fullPage PNG, cleans up. Persistent provenance · re-runnable end-to-end.

Vercel auto-deployed commit `1c4dce4` (PR #78 merge) to production on 2026-05-16. The script targets that deployment.

## Prerequisites

1. `/tmp/.env.qb-branos.live-backup` exists with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (prod values).
2. `npm install playwright --no-save` from repo root. Chromium binaries must be cached at `~/Library/Caches/ms-playwright/` (they are if you've run Playwright before).

## States (nine PNGs)

Two modes:

- **One at a time** · for debugging or first-pass capture, run each state alone and eyeball the PNG before the next state fires. ~30-60 s per state.
- **All in one pass** · `node seed-and-capture.mjs all` runs the nine in sequence and writes `contact-sheet.png` (3x3 grid, ~320 px thumbnails, state labels, missing PNGs flagged as placeholders) so review collapses to one image. Use this once the per-state seeds are known-good. ~5-8 min total.

| State command | Output PNG | Expected surface |
| --- | --- | --- |
| `neutral` | `neutral.png` | Phase view · four agents with muted-ink dots (40% opacity), foundation locked, no runs in window. Locked Phase 02-05 cards render below. |
| `green` | `green.png` | Phase view · four agents with forest-green dots, rolling avgs within thresholds. Locked Phase 02-05 cards below. |
| `yellow-latency` | `yellow-latency.png` | Phase view · Visual DNA's dot in gold-deep (latency rolling avg 20-23 s band). Other three green. Locked cards below. |
| `rose-latency` | `rose-latency.png` | Phase view · Visual DNA's dot in rose-deep (latency rolling avg >23 s). Other three green. Locked cards below. |
| `rose-retry` | `rose-retry.png` | Phase view · Soul Map's dot in rose-deep (retry rolling avg >0.5). Other three green. Locked cards below. |
| `transient-failed` | `transient-failed.png` | Phase view · Soul Map row in transient-failed state · §5.8.1 generic transient copy + standard rerun CTAs (or hidden per Case C since latest is failed not delivered · see PR #79 §3 finding). Three others delivered. |
| `failed-permanently` | `failed-permanently.png` | Phase view · Soul Map row in failed_permanently · §5.8.1 permanent copy + single "Retry manually" pill (no two-button rerun). Three others delivered. |
| `locked-phase-cards` | `locked-phase-cards.png` | Phase view · green state + explicit subject framing on the Phase 02-05 locked sections. Logo Direction, Logo Evaluation, Voice Guide, Content Strategist, Campaign Planner, Execution Planner, Predictive Panel, Quarterly Brand Review listed under locked-glyph rows with "Unlocks when Starter tier is active" copy. (Redundant coverage with every other PNG · explicit-subject capture for spec §6.3.) |
| `replay-modal-v1-of-3` | `replay-modal-v1-of-3.png` | Run history view with replay modal open on Soul Map v1 (root of 3-version chain). Modal header `soul_map_synthesizer · v1`; qbp_snapshot block contains v1's QBP (distinguishable by `_capture_version: 1` field); collapsibles for runtime_args, file_refs visible. Demonstrates §5.3.1 specific-run version semantics. |

## After capture

Once all nine PNGs land in this directory:

```bash
git add chapter-02/verification/step-5-screenshots/*.png
git commit -m "verify(chapter-2/step-5): nine screenshots committed · step 5 close"
git push
```

Signal: "Screenshots committed, proceed." That's the trigger to merge PR #79 and open step 6 spec.

## Boundary case coverage map

Per PR #79 verification report:

- **Case A (null duration_ms safe render)** · code-path verified, no screenshot needed
- **Case B (deep parent chain replay)** · covered by `replay-modal-v1-of-3.png` (v1 is the root of the chain; replay surfaces v1's snapshot, not v3's)
- **Case C (stuck queued v2 hides rerun button)** · finding deferred to step 6 · `transient-failed.png` partially demonstrates this if Soul Map's latest is failed (rerunCtas hides). Captured incidentally.

## Failure surface

If any `<state>` invocation fails (schema collision, Supabase 4xx, Playwright timeout, Edge function error from prod):

1. Paste the terminal output verbatim to the PR #79 thread.
2. Cod debugs from the trace and pushes a script fix on the same branch.
3. Resume from the failing state.

Each invocation creates AND cleans up its own test user via `deleteUser(userId)` in the `finally` block. A failed run that exits early may leave a test user in the auth schema with the prefix `nizzar.ben+s5-<tag>-`; cleanup is non-blocking but worth a sweep before declaring step 5 closed.

## Why this isn't in `tests/`

The screenshots and the script that produces them are verification artifacts for a specific chapter step, not part of the long-running test suite. They live next to the verification report for provenance and discoverability. The conformance suite at `tests/agent-conformance.mjs` and the reproduction harness at `tests/chapter-02/run-repro.mjs` remain the canonical test infrastructure.
