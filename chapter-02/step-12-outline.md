# Chapter 2 · Step 12 spec outline

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §5 below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §13.13 (Foundation `?upgrade=success` banner) + §13.14 (`/api/agents/dispatch.js` retirement) + step 11 closure §6 forward reference (proposed bundling).

Branch: `chapter-2/step-12-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 12 ships two small fixes bundled into one step per step 11 closure §6 recommendation. Both are housekeeping work · neither is large enough to warrant its own dedicated step, both are independent of each other, both close out master-spec items that have been carried forward across chapters.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Foundation `?upgrade=success` banner | §13.13 + `api/stripe/checkout.js:22` default success_url | Render a celebratory inline element on `/foundation` when the query param is present |
| `/api/agents/dispatch.js` retirement | §13.14 + step 4 (when `/api/agents/run.js` shipped as replacement) | Confirm zero callers; delete the endpoint |
| Verification harness · `foundation-banner.mjs` | step-12-spec (this doc) | Optional 2-gate Playwright harness covering banner render + absence (open call #6) |

§13 items deferred out of step 12:

- Step 13 · End-to-end QA pass with full WCAG audit.
- Step 14 · Final sign-off + `CHAPTER_02_COMPLETION.md`.
- Pagination + filtering on archive (chapter 3+ unified design pass).
- Synthetic chain_id backfill migration (chapter 3 candidate per step 11 adj #6).

Prerequisites met (carried from chapter 1 + chapter 2 steps 4-11):

- `/api/stripe/checkout.js` already redirects to `/foundation?upgrade=success` after a successful checkout session (DEFAULT_SUCCESS constant at line 22).
- `/api/agents/run.js` shipped in step 4 as the canonical agent execution path. All Phase 01 agents route through it.
- `foundation.html` is the canonical post-lock surface (chapter 1 step 12, PR #47).
- No app code currently reads `?upgrade=success` (grep clean on `foundation.html` and `/js/`).

---

## 2. Deliverable surfaces

### 2.1 Foundation `?upgrade=success` banner

**Status:** Stripe redirects users to `/foundation?upgrade=success` after a successful upgrade. The page currently ignores the query param. The banner is the user-visible confirmation that the upgrade landed and their new tier is active.

**Default behavior:**

- On page load, parse `URLSearchParams` for `upgrade=success`
- If present, render a banner element at the top of the main content area with:
  - Eyebrow tag (variant per open call #4)
  - Headline: "You're in." (or per open call #2 candidate)
  - Body: one sentence confirming the tier change and pointing the user at what to do next
  - Dismiss affordance (variant per open call #3)
- On dismiss, remove the banner from the DOM and strip the query param via `history.replaceState` so a page reload doesn't re-show it
- If the param is absent (the normal case), render nothing

**Tier-aware copy:** the banner reads the user's current tier from the `/api/qbp` payload that `foundation.html` already fetches on mount. Copy variants for each tier are surfaced in open call #2.

### 2.2 `/api/agents/dispatch.js` retirement

**Status:** the endpoint shipped in chapter 1 as the first-generation Phase 01 agent execution path. Step 4 (chapter 2) shipped `/api/agents/run.js` as the canonical replacement. The dispatch endpoint has been carrying the master-spec retirement flag since step 4 closure.

**Default behavior:**

- Confirm zero live callers via a fresh grep (HTTP POSTs only · the module's helper exports may be imported elsewhere and need to migrate first if so)
- Delete `api/agents/dispatch.js` entirely (open call #5 surfaces the hard-delete vs 410-Gone-shim question)
- Update `vercel.json` if any route entry references the dispatched path
- Remove any unused helper imports that the file was the sole consumer of

**Migration audit:** if any caller still references `/api/agents/dispatch` directly (HTTP fetch, not module import), the migration to `/api/agents/run` lands in 12B as part of the same PR. The audit happens during 12B implementation, not before.

### 2.3 Verification harness · `tests/chapter-02/foundation-banner.mjs`

Optional (open call #6). If we ship the harness, it covers two gates:

1. Banner renders when `?upgrade=success` is in the URL · DOM element present with correct copy
2. Banner absent on a normal foundation page load (no query param) · DOM element not present

Manual smoke for dispatch retirement is sufficient · `curl -X POST https://quantumbranding.ai/api/agents/dispatch` should 404 post-deploy. No harness needed for an absence-of-endpoint check.

Harness inherits step 10 §3.6 + step 11 §3.5 harness-determinism pattern: wait for bell-mounted + `data-realtime='true'` before banner assertions. Same one-line gate as prior step harnesses.

---

## 3. Sub-PR breakdown

Step 12 is small-scope. Proposed phasing:

| Sub-PR | Topic |
| --- | --- |
| 12A | Foundation `?upgrade=success` banner · render + dismiss + history.replaceState |
| 12B | `/api/agents/dispatch.js` retirement · caller audit + endpoint deletion |
| 12C | (Optional) `tests/chapter-02/foundation-banner.mjs` 2-gate harness · per open call #6 |
| 12D | Step 12 closure report |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass. If open call #6 defaults to "skip harness", the cycle collapses to 12A + 12B + 12D.

---

## 4. Acceptance criteria

Per §13.13 + §13.14:

1. **Banner renders on `?upgrade=success`.** Navigating to `/foundation?upgrade=success` with a valid session shows the banner with tier-aware copy. Dismiss removes the element and strips the query param. Reload after dismiss shows no banner.
2. **Banner absent on normal load.** Navigating to `/foundation` (no query param) shows no banner DOM element. Zero regression on the existing foundation page.
3. **Dispatch endpoint returns 404.** A `POST /api/agents/dispatch` against the live deploy returns 404 (or 410 per open call #5).
4. **No app regression from dispatch removal.** All four Phase 01 agents continue to fire correctly via `/api/agents/run`. Chain-orchestration harness from step 8 still passes 5/5.
5. **Stripe checkout flow end-to-end.** A successful test-mode checkout redirect lands on `/foundation?upgrade=success` and the banner renders. Verified manually with a Stripe test card.

---

## 5. Six open calls for Nizzar adjudication

1. **Bundle vs split.** Default: ship banner + retirement bundled as step 12 (per step 11 closure §6 recommendation). Override: split into step 12 (banner) + step 13 (retirement), renumber forward. Bundling reads cleanly because both are small and independent; splitting trades a step number for a smaller blast radius per PR.

2. **Banner copy.** Default candidates per tier:
   - Starter: eyebrow "Welcome to Starter." · headline "You're in." · body "Your foundation is yours to read in full. Open the Brand Soul Map to start."
   - Pro: eyebrow "Welcome to Pro." · headline "Everything unlocks." (Note: "unlocks" appears in product UI · acceptable as in-product confirmation copy, not banned in voice) · body "All Phase 01 + Phase 02 surfaces are active. The Brand Document waits for you in the archive."
   - Agency: eyebrow "Welcome to Agency." · headline "Multi-brand mode is live." · body "Your client portals are ready. Start a new brand from the foundation."
   Override: provide alternative copy. The defaults follow QB voice (no banned phrases beyond the noted in-product "unlocks", no em dashes, sentence-case headlines).

3. **Banner persistence.** Default: manual dismiss only · the banner stays until the user clicks the dismiss affordance, which strips the query param via `history.replaceState`. Subsequent navigations away from `/foundation` and back without the query param show no banner. Override options: (a) auto-dismiss after 8 seconds; (b) auto-dismiss on first scroll; (c) one-shot per session (localStorage flag). The default reads correctly because the user paid moments ago and confirmation deserves dwell time, not a flash.

4. **Banner placement.** Default: inline at the top of the foundation main content area, above the current page header. Banner uses `qb-card` shell with the gold accent color for the celebratory variant. Override options: (a) `qb-toast` floating top-right (Design System §20.13); (b) sticky pinned-top across the page until dismissed; (c) replace the page header entirely for the duration of the visit. Default favors inline · the user already scrolled into the foundation; the banner sits in their flow rather than competing with the bell or nav.

5. **Dispatch retirement · hard delete vs 410-Gone shim.** Default: hard delete `api/agents/dispatch.js`. The endpoint has zero live callers (audit happens during 12B). Override: replace the file with a 410-Gone responder that includes a `Location: /api/agents/run` header for any stray caller surfaced post-deploy. The shim adds a 2-week grace window but costs maintenance. Default favors clean removal · grep clean = clean removal.

6. **Verification harness scope.** Default: skip the harness. Manual visual check on a staging deploy covers banner-render + banner-absent. The dispatch retirement is verified by curl. The harness adds 2 gates of value against ~50 LOC of changes; the ratio doesn't justify it. Override: ship the 2-gate `foundation-banner.mjs` harness for inheritance value (banner-render is a pattern future surfaces will repeat). The harness is cheap to write if shipped.

---

## 6. Out of scope

Explicit:

- End-to-end QA pass with WCAG audit (step 13 master spec §13.15).
- Final sign-off + `CHAPTER_02_COMPLETION.md` (step 14 master spec §13.16).
- Stripe webhook hardening (orthogonal · already in place).
- Tier downgrade or cancellation flow (post-launch; the upgrade banner is the only confirmation surface in scope).
- Synthetic chain_id backfill migration (chapter 3 candidate per step 11 adj #6).
- Bracketed hardening sub-PR (chapter 3 first step per steps 8 + 10 + 11 closures).

---

## 7. Forward references

- **Step 13** End-to-end QA pass · full WCAG accessibility audit (master spec §13.15). Covers fresh-user full-path + all gates + accessibility tree review.
- **Step 14** Final sign-off + `CHAPTER_02_COMPLETION.md` (master spec §13.16).
- **Chapter 3 first step** Bracketed hardening sub-PR per steps 8 + 10 + 11 closure recommendations. Small focused pass given chapter stabilization (8 surgical fixes across 6-11, three clean steps in a row).
- **Chapter 3 candidate** Synthetic chain_id backfill migration per Nizzar adj #6 step 11. After it ships, "Earlier work" section disappears and the archive collapses to one chain model permanently.

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch.
