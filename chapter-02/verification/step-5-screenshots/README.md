# Step 5 verification screenshots

This directory holds the six visual surfaces required to close step 5 per PR #79.

Capture against `https://quantumbranding.ai/agents` after signing in. Vercel auto-deployed commit `1c4dce4` (PR #78 merge) to production on 2026-05-16. Mobile capture at 360 px viewport; desktop at 1280 px.

Persistent provenance lives in this directory (not in PR comments) per PR #79 approval: screenshots survive PR archival and are accessible to step 6+ without GitHub API calls.

## Manifest

| File | Surface | Required state | Expected color / treatment |
| --- | --- | --- | --- |
| `01-phase-view-green.png` | Phase view · all four agents healthy | All Phase 01 delivered, rolling avgs within thresholds | All four dots `var(--phase-discovery)` forest green (#5B7E6A) |
| `02-phase-view-yellow.png` | Phase view · one threshold elevated | At least one agent's rolling latency in 20-23 s band | That agent's dot `var(--gold-deep)` (#B89540), others green |
| `03-phase-view-red.png` | Phase view · failure or threshold rose | One agent failed OR rolling avg > 23 s / 0.5 retries | That agent's dot `var(--rose-deep)` (#B8704D) |
| `04-phase-view-neutral.png` | Phase view · fresh foundation lock, no runs yet | Foundation newly locked, no completed runs in 7-day window | All four dots `rgba(45, 21, 33, 0.4)` muted ink |
| `05-run-history-badges.png` | Run history · badge thresholds at boundaries | Mix of rows showing latency badges at 20 s (gold), 23 s+ (rose), 0 retries (monochrome), 1 retry (rose) | Per-row badges in three colors visible in single screenshot |
| `06-replay-modal-non-latest.png` | Replay modal opened on v2 of a multi-version chain | Agent with at least v3+ versions; click on a v2 run row | Modal header reads `agent_slug · v2`; qbp_snapshot block contains v2's QBP; collapsibles for runtime_args, file_refs, error_payload visible |
| `07-transient-failed.png` | Phase view · transient-failed agent row | Force a `model_call_failed` on one agent | §5.8.1 generic transient copy below meta; two-button rerun CTAs visible |
| `08-failed-permanently-pill.png` | Phase view · failed_permanently agent row | Manually advance `dispatch_jobs.status='failed_permanently'` on an agent's dispatch, OR wait for reaper exhaustion | §5.8.1 permanent copy; single "Retry manually" pill; two-button rerun NOT visible |
| `09-locked-phase-cards.png` | Phase view · Phase 02-05 locked cards | Any signed-in user (free or starter) | Four locked sections (Brand Creation, Content Creation, Execution, Intelligence) with locked-glyph ◐ rows and "Unlocks when Starter tier is active" copy |
| `10-mobile-stack.png` | Mobile (360 px) · agent row with stacked rerun CTAs | Any agent with delivered artifact, viewed at 360 px | Rerun buttons stack vertically (current QBP on top, original below) |

Optional · helpful for the verification report appendix but not required to close step 5:

| File | Surface | Note |
| --- | --- | --- |
| `11-run-history-list.png` | Full Run history view with multiple agents' runs interleaved | Confirms cross-agent chronological order + click-through behavior |
| `12-empty-state-foundation-not-locked.png` | Console viewed before foundation lock | Should show "Lock your foundation to see your agents at work" + CTA to `/foundation` |

## Verification process

For each screenshot:
1. Capture the state in the browser
2. Save as PNG with the filename from the manifest above
3. Commit to this directory
4. PR #79 picks up the addition; reviewer cross-checks against the manifest before merge

## How to produce specific states

**Green (01):** sign in to a test user with all four Phase 01 artifacts delivered. Wait for the 7-day window to have data.

**Yellow (02):** the fastest path is Visual DNA · its 22.9 s observed latency on Sonnet should land it in the gold band on a fresh 7-day window with one or two runs. If the rolling average stays below 20 s, fire a few more Visual DNA reruns to bring the average up.

**Red (03):** force one agent to fail via `/tests/chapter-02/step-4-live-verification.mjs` using the service-path `force_error='model_call_failed'` hook · the failed run drops the rolling retry to 1 (above the 0.5 rose threshold).

**Neutral (04):** create a fresh test user, lock the foundation, screenshot before any agent completes. The 7-day window is empty until at least one run lands.

**Transient failed (07):** same as red · use `force_error` once. The status pill reads "Failed" (not "Permanently failed").

**Failed permanently (08):** either advance manually via SQL `UPDATE dispatch_jobs SET status='failed_permanently' WHERE id=...`, or wait for the reaper (step 8) which exhausts 3 retries on a stuck queued artifact. Until step 8 ships the reaper, manual SQL is the only path.

**Mobile stack (10):** browser dev tools, set viewport to 360 px, capture an agent row with rerun CTAs visible.
