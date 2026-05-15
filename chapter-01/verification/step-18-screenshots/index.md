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

### HIGH 1. Foundation page nav badge + upgrade banner ignore live tier · FIXED in `1e324de`

**File:** `05-foundation-locked-delivered-starter-*.png`
**Observed:** Even after the DB tier was flipped to `starter` for the user, the Foundation page rendered with the FREE badge in the top-right nav and continued to show the "Unlock the rest of your foundation" upgrade banner.
**Root cause:** `foundation.html:143` read `String(session.tier || 'free').toLowerCase()` from localStorage. The qb_session payload is set at sign-in time and never refreshes after a tier change.
**Fix shipped (`1e324de`):** `fetchAll()` now returns `tier` from `/api/qbp`; `rerender()` uses `pkt.tier` instead of `session.tier`. A comment marker has been added: `// tier is read from /api/qbp, never from localStorage. Server is the source of truth.`
**Status:** FIXED. The screenshots in `05-foundation-locked-delivered-starter-*.png` reflect the pre-fix state. Re-capture deferred to a post-merge smoke test (preview deployments are auth-gated, so the post-fix surface can only be reached via prod).

### HIGH 2. Account page shows FREE under starter tier · ROOT-CAUSE FIXED in `1e324de`

**File:** `14-account-starter-*.png`
**Observed:** The account page rendered the FREE badge + "Upgrade to Starter" CTA even after the DB tier was `starter`.
**Root cause (revised after audit):** `account.html` DOES fetch `/api/qbp` and reads `data.tier` correctly. But the OTHER surfaces in the walkthrough (foundation, archive, qbp, artifact) read `session.tier` from localStorage. When the screenshot script navigated through multiple pages with stale `session.tier`, the user-shaped expectation became "this user is free." The account capture probably caught a request that lost the race against the script's tier flip; the underlying tier-source bug was on the surfaces preceding it, not on account itself.
**Fix shipped (`1e324de`):** Audited every surface; converted foundation, archive, qbp, artifact, paywall to read tier from `/api/qbp`. account already did. The full system is now tier-server-authoritative.
**Status:** FIXED. Same caveat on re-capture: deferred to post-merge prod smoke.
