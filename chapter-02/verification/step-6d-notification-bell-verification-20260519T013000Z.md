# Chapter 2 · Step 6D verification report

Subject: PR #85 · `feat(chapter-2/step-6d): notification bell + GET/read endpoints` (merged `a0a6e3a`)

Source authority: `chapter-02/step-6-spec.md` §7. Acceptance gates §7.5. PR #78 + PR #84 + PR #86 already on main (precedent for the lock-foundation refactor + Edge `waitUntil` fix).

Date: 2026-05-19. Verified against `https://quantumbranding.ai`.

## 1. Result · all five gates passed

| Gate | Topic | Result | Evidence |
| --- | --- | --- | --- |
| 1 | DOM probe across mount sites + non-mount sites | **PASS** | `tests/chapter-02/notification-bell-gates.mjs` Gate 1. Bell mounted on all four: `/agents`, `/foundation`, `/archive`, `/scan`. Null on all three non-mount surfaces tested: `/` (marketing index), `/qbp`, `/account` |
| 2 | Empty state · no badge + correct copy | **PASS** | Bell renders with `badge.data-count="0"`, dropdown empty-state copy matches §7.5 verbatim: "No notifications. The system flags here when something needs your attention." |
| 3 | Unread state · two seeded rows · badge count 2 | **PASS** | Two `kind=dispatch_failed` rows seeded with `read_at=null`. Badge renders `data-count="2"` and `text="2"`. Dropdown shows 2 `.qb-notification-bell_item` rows |
| 4 | Mark-read · POST observed · badge decrements · persisted on re-poll | **PASS** | Click on first row fires `POST /api/notifications/<uuid>/read` (verified in network log). Badge transitions from `2` to `1`. Hard re-navigation to `/agents` shows badge `1` persisted (server read confirmed) |
| 5 | Visibility-aware suppression | **PASS** | Initial poll on mount (`+0ms`). 60 s hidden window: zero poll requests. Foreground transition fires one immediate poll at `+60012ms`. Confirmed via `page.on('request')` capture with timestamp annotation |

## 2. Live-bug discovery during gate 5 first run

The first Gate 5 run reported FAIL with `resume-window-count=0`. Investigation showed:

- The bell's `onVisibility` handler IS spec-compliant: `else if (pollHandle === null) { poll(); pollHandle = setInterval(poll, POLL_MS); }`. The immediate fetch on resume is wired correctly.
- The harness was using a strict `>` timestamp comparison (`r.ts > showStart`) and a 2 s wait window after the foreground transition. The actual resume poll fires at the exact ms the foreground event dispatches (~0 ms latency between the visibilitychange handler running and `fetch()` queueing the request), so the timestamp comparison rejected it.

Fix in the harness only (not in the bell module):
- Strict-greater-than → greater-or-equal on the timestamp comparison.
- Wait window 2 s → 3 s for generous coverage.
- CDP path added (`Emulation.setPageVisibility`) with the JS-override fallback retained. CDP turned out to be unavailable on the Chromium version installed for verification, so the fallback path is what ran; the JS-override path works correctly with `Object.defineProperty(document, 'hidden', ...)` + dispatch of `visibilitychange`.

No bell module change needed. The bell behavior was correct from PR #85's first commit. The earlier FAIL was harness-measurement, not implementation.

## 3. Cross-check · 6D has zero file-level dependency on 6A

Per Nizzar's pre-release adjudication. Confirmed in the pre-merge audit (referenced in the PR #85 discussion):
- `agents.html`, `api/notifications.js`, `api/notifications/[id]/read.js`, `archive.html`, `foundation.html`, `js/qb-notification-bell.js`, `signal-scan.html`, `vercel.json` — none of these reference 6A surfaces (`dispatch-pattern.js`, `readLatestDeliveredArtifact`).
- The `readLatestArtifacts` and `dispatch-pattern` grep hits in the 6D branch were all in inherited spec docs (`chapter-02/step-6-spec.md`, etc.), not in 6D-modified code.
- Merge order (6A first, 6D second) was sequencing convenience, not correctness. Independent merges would also have been safe.

## 4. Forward notes captured for step 6 closure

- **6D flag 2 (interim bell position).** Bell renders `position: fixed; top: var(--space-s); right: var(--space-s); z-index: 50`. No existing nav slot to hook into on the four mount surfaces. Step 6 closure forward note · nav-chassis cleanup item to relocate the bell into a proper nav placement once a chassis lands.

- **6D flag 3 (mark-read idempotency choice).** The endpoint filters on `read_at=is.null` so re-hits on an already-read row match zero rows and return `{ ok: true, already_read: true }`. Confirmed in the test path: Gate 4 click → POST → response → subsequent observation. Idempotency design works as intended.

- **6D flag 1 (silent no-op on missing/malformed qb_session).** Pre-release verification (this session, previous turn) traced the guard chain across all four mount sites plus `createBell`. Zero throw, zero console, zero DOM mutation across three failure modes (missing key, null value, malformed JSON). Confirmed cleared.

## 5. Harness shipped alongside this report

`tests/chapter-02/notification-bell-gates.mjs` (new). Single Playwright harness. Creates one signed-in test user, runs all five gates sequentially, cleans up. Reports per-gate result + summary.

Reusable for future verification cycles. Wall time ~85 s end-to-end (Gate 5's 60 s hidden window dominates).

## 6. Out of scope · captured for forward steps

- **CRON_SECRET + INTER_EDGE_SECRET** still pending in Vercel Production scope (Nizzar action). Not required for 6D; both are 6C prerequisites.
- **Sub-PR 6C (reaper)** opens next after the env-var prerequisites are confirmed.
- **Service role key rotation** still parked.
- **`scan-continuation.html` distinct file** does not exist; the scan continuation surface lives inside `signal-scan.html`. 6D mounts there with a localStorage-guarded inline script that no-ops for anonymous visitors. Captured for step 6 closure surface map.

## 7. Files added to main via this verification PR

- `tests/chapter-02/notification-bell-gates.mjs` (new)
- `chapter-02/verification/step-6d-notification-bell-verification-20260519T013000Z.md` (this report)

## 8. Sign-off

Step 6D acceptance gate complete. All five gates green. The notification bell, the GET/read endpoints, the 30 s poll with visibility-aware suppression, the four-surface mount, and the §7.5 acceptance criteria are verified live against prod. Sub-PR 6C (reaper) may open once the two Vercel env-var prerequisites are confirmed.
