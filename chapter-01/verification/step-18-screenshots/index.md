# Step 18 PR 2 · Visual Verification Pass

**Generated:** 2026-05-15T16:02Z.
**Test user:** `0b034d6a-9421-4408-a6ae-8e22752d29a4` (the step-17 user, preserved with 7 artifacts).
**Capture tool:** Playwright 1.60.0 with Chromium 1223 (headless), `fullPage: true`, deviceScaleFactor 1.
**Viewports:** 375 (iPhone SE), 768 (iPad), 1440 (desktop).
**Surfaces captured:** 14.
**Total screenshots:** 42 (3 viewports × 14 surfaces).

The fresh-state Foundation pages (cold / in-progress / ready-to-lock / locked-producing) are not in this set because the test user is already in the `locked-delivered` bucket and producing-state is sub-second under async dispatch. Those four states are covered by the gallery harness in `tests/foundation.gallery.html` (step 12) and by PR 1's async dispatch behavior. The five remaining surfaces (Foundation locked-delivered free + starter, four artifact reading surfaces, Archive, QBP, Paywall, Account free + starter) are captured against real production data.

## Surface map

| # | Surface | Slug |
| --- | --- | --- |
| 1 | Foundation, locked-delivered, free tier | `01-foundation-locked-delivered-free` |
| 5 | Foundation, locked-delivered, starter tier | `05-foundation-locked-delivered-starter` |
| 6 | Artifact reading — Soul Map (always free) | `06-artifact-soul-map` |
| 7 | Artifact reading — Sensescape (locked on free) | `07-artifact-sensescape-locked-free` |
| 7s | Artifact reading — Sensescape (starter, open) | `07s-artifact-sensescape-starter` |
| 8 | Artifact reading — Visual DNA (locked on free) | `08-artifact-visual-dna-locked-free` |
| 8s | Artifact reading — Visual DNA (starter, open) | `08s-artifact-visual-dna-starter` |
| 9 | Artifact reading — War Table (locked on free) | `09-artifact-war-table-locked-free` |
| 9s | Artifact reading — War Table (starter, open) | `09s-artifact-war-table-starter` |
| 10 | Brand Archive (free, 3 locked rows) | `10-archive-free` |
| 11 | QBP (free, export-gated) | `11-qbp-free-export-gated` |
| 12 | Paywall | `12-paywall` |
| 13 | Account (free) | `13-account-free` |
| 14 | Account (starter) | `14-account-starter` |

Each slug has three viewport variants: `-mobile-375`, `-tablet-768`, `-desktop-1440`. Files live alongside this report.

## Issues found

### HIGH 1. Foundation page nav badge + upgrade banner ignore live tier

**File:** `05-foundation-locked-delivered-starter-*.png`
**Observed:** Even after the DB tier was flipped to `starter` for the user, the Foundation page rendered with the FREE badge in the top-right nav and continued to show the "Unlock the rest of your foundation" upgrade banner. The artifact tiles correctly transitioned to "READY" (because the renderer reads each artifact's `locked` flag from `/api/artifacts`, which IS authoritative). But the chrome around them stayed free-tier.
**Root cause:** `foundation.html:143` reads `String(session.tier || 'free').toLowerCase()` from localStorage. The qb_session payload is set at sign-in time and never refreshes after a tier change. `/api/qbp` returns a fresh `tier` value but `fetchAll()` in foundation.html does not include it in the returned packet, and `computeFoundationState({...tier...})` is called with the stale value.
**Same root cause as step 15 surprise §10.4** (the `?upgrade=success` session-restore bounce). This is the integration-level surface of that bug.
**Severity:** HIGH. A user who upgrades and lands on `/foundation?upgrade=success` will see free-tier chrome until they sign out and back in.
**Fix:** Have `fetchAll()` return `tier` from `/api/qbp` and pass it to `computeFoundationState` instead of using `session.tier`. ~5-line change.
**Recommendation:** Fix inline before merging PR 2, OR carry forward as a Chapter 10 debt item (already listed in §16 of CHAPTER_01_SPEC.md).

### HIGH 2. Account page shows FREE under starter tier

**File:** `14-account-starter-*.png`
**Observed:** The account page rendered the FREE badge + "Upgrade to Starter" CTA even after the DB tier was `starter`. Should have shown a STARTER badge + "Manage subscription" placeholder.
**Root cause:** Less clear. `account.html` DOES fetch `/api/qbp` and reads `data.tier`. Either the API call returned a stale value at that moment, or there is a render race. Most likely cause: the screenshot script flipped tier then navigated to several other pages before reaching `/account`; the account page's API call returned the correct tier, but the script's earlier free-tier navigation cached page state in the browser and re-served it.
**Severity:** HIGH if reproducible against a real user. The Playwright capture may be amplifying an underlying race that wouldn't fire under normal user behavior. Manual verification by signing in as a starter user and visiting `/account` would clarify.
**Recommendation:** Manual reproduction first. If reproducible, force `/api/qbp` no-cache and re-test.

### MEDIUM 1. Foundation hero copy assumes Soul Map is the only ready artifact

**File:** `01-foundation-locked-delivered-free-*.png` and `05-foundation-locked-delivered-starter-*.png`
**Observed:** Hero reads "Your Soul Map is ready." even when ALL four artifacts have status=delivered. On starter, where all four tiles read "Ready," the hero singling out Soul Map is misleading.
**Severity:** MEDIUM. Real but confined to a copy choice.
**Fix:** When `allArtifacts.every(a => a.status === 'delivered')`, render a different hero ("Your foundation is ready." or similar).

### LOW 1. Locked-artifact reading surface footer covers full viewport

**Files:** `07-artifact-sensescape-locked-free-*.png`, `08-artifact-visual-dna-locked-free-*.png`, `09-artifact-war-table-locked-free-*.png`
**Observed:** The locked-artifact reading surface is intentionally minimal (just title + locked frost + paywall). The page is tall in viewport but only ~600px of content. Empty viewport space below the paywall reads as unfinished.
**Severity:** LOW. Functional, just sparse.
**Fix:** Either reduce min-height or add a "back to Archive" link in empty space.

### LOW 2. QBP page sections render with mixed visual weight

**File:** `11-qbp-free-export-gated-desktop-1440.png`
**Observed:** Sensescape's two body cards ("Sight," "Touch") render with more visual prominence than the Soul section above (which has more content but smaller type). Reading order is fine; visual hierarchy slightly off.
**Severity:** LOW.
**Fix:** Pass during QBP polish.

## What passed cleanly

- All four artifact reading surfaces under starter render full content (`07s`, `08s`, `09s`, `06`).
- All four artifact reading surfaces under free correctly show the locked-frost paywall (Soul Map always free + 3 locked).
- Archive page renders correctly on all viewports.
- Paywall renders the 3-tier card grid with correct gold accent on Starter; Pro and Agency cards are visibly muted.
- Account free tier renders correctly (the bug is only on starter — same surface, different state).
- All viewports respect mobile-first responsive layout; no overflow, no broken grids.
- All text rendered with Fraunces (display) + Inter (body) + JetBrains Mono (eyebrows) per the design system.
- Two-layer pill buttons render correctly with hard offset shadows.
- Tier badges render with correct colors (gold for STARTER, muted for FREE).

## Surfaces deferred

- Foundation page sub-states `cold`, `in-progress`, `lock-ready`, `locked-producing` were not captured against this user (state is already locked-delivered). The `tests/foundation.gallery.html` harness covers all four with synthetic fixtures and is shipped in step 12.
- The `locked-producing` state is sub-second under PR 1's async dispatch; capturing it would require a separate fresh user + lock + immediate snap timing. Out of scope.

## Definition of done

- [x] 42 screenshots committed (14 surfaces × 3 viewports)
- [x] Issues flagged with severity (2 HIGH, 1 MEDIUM, 2 LOW)
- [ ] No critical visual bugs unresolved — TWO HIGH ISSUES NEED A DECISION before merging

## Recommendation

PR 2 ships as documentation of the visual state. The two HIGH issues (foundation tier + account tier reading from stale session) are the same family of bug — the foundation/account surfaces should refresh tier from `/api/qbp` after the initial page load, or the qb_session.tier should be refreshed on every navigation. Either decide to fix inline in PR 2 (small change, well-scoped) or defer to Chapter 10 with the explicit consequence that any user who upgrades and lands on /foundation will see free-tier chrome until they sign out/in.

Awaiting your decision in chat per the hold policy.
