# Chapter 2 · Step 12 spec · Foundation upgrade-success banner + dispatch retirement (full)

Status: full spec. All six adjudications baked in (see §2 — four defaults, one copy-direction override on #2, one harness override on #6). Outline file `chapter-02/step-12-outline.md` retained as historical record on main (PR #137); this spec elaborates the bundled scope and bakes the adjudicated copy direction. Hold released per Nizzar directive · 12A starts immediately on merge.

Source authority: `CHAPTER_02_SPEC.md` §13.13 (Foundation banner) + §13.14 (dispatch retirement) + step 11 closure §6 forward references + Nizzar adjudication (this session).

Branch: `chapter-2/step-12-spec`.

---

## 1. Bundle framing

Step 12 closes the two small deferred items from master spec §13.13-13.14, bundled per step 11 closure §6 recommendation (zero coupling between them, both trivial). Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Foundation `?upgrade=success` banner | §13.13 + `api/stripe/checkout.js:22` redirect | Detect URL param, render tier-aware banner, dismiss + URL cleanup |
| `/api/agents/dispatch.js` retirement | §13.14 + step 7/11 forward references | Hard delete after fresh zero-caller re-audit at deletion time |
| Verification harness | step-12-spec §3.3 + adj #6 override | 2-gate `foundation-banner.mjs` Playwright harness |

§13 items remaining after step 12 (chapter-close shape determination · captured in 12D):

- **§13.15** End-to-end QA pass.
- **§13.16** Final sign-off + `CHAPTER_02_COMPLETION.md`.

Step 12D closure names whether 13.15 and 13.16 collapse into one final step or run as separate steps. The user wants the chapter-close shape named before step 13 opens.

Prerequisites met (carried from chapter 1 + chapter 2 steps 4-11):
- `api/stripe/checkout.js` redirects to `/foundation?upgrade=success` (DEFAULT_SUCCESS).
- `foundation.html` already has a `bannerText` mechanism + `renderFoundation(root, state, { banner })` option (used post-lock).
- `/api/agents/run` is the canonical agent dispatch endpoint (step 4).
- Chapter has stabilized · 8 surgical fixes total across steps 6-11, three clean steps in a row.

---

## 2. Adjudicated decisions · baked into this spec

Per Nizzar's six-point adjudication (this session):

### 2.1 Bundle accepted · adj #1 default

**Decision:** ship banner + dispatch retirement bundled as step 12. Zero coupling, both trivial, splitting doubles ceremony for no benefit.

### 2.2 OVERRIDE on banner copy · adj #2 (keep tier-aware structure, replace the bodies)

**Decision:** the default generic-SaaS copy ("You're in." / "Everything unlocks." / "Multi-brand mode is live.") is rejected. This banner fires at the highest-emotion moment in the funnel · money just changed hands, the user is asking "did I decide right." The banner answers that.

**Rule for all three bodies:**
1. Confirm the decision was right
2. Name what is now open
3. Point at the single next action that exists on the foundation page today

**Implementation:** draft three copy bodies in 12A against the actual current foundation-page next-action surface. The user approves or tunes in the 12A PR · one copy-check. No generic "you're in."

**Tier-aware structure preserved (carried from default):**

| Tier | Eyebrow | Headline | Body direction |
| --- | --- | --- | --- |
| Starter | "Starter is live." | "Your foundation is unlocked." | Confirms all 20 agents + unlimited runs open · points at running the first agent off the locked Soul Map |
| Pro | "Pro is live." | "Everything is open." | Confirms Phase 01+02 surfaces + Predictive Panel runs · points at highest-value first action |
| Agency | "Agency is live." | "Client mode is on." | Confirms client portals ready · points at creating first client workspace |

The eyebrow + headline pairs are locked here. The bodies are drafted in 12A and reviewed in the 12A PR.

### 2.3 Banner persistence · adj #3 default

**Decision:** manual dismiss + `history.replaceState` param strip. No auto-dismiss, no scroll-dismiss, no localStorage one-shot. The param strip IS the one-shot guarantee. Let the user sit in the moment.

### 2.4 Banner placement · adj #4 default

**Decision:** inline at top of foundation main content. `qb-card` shell with gold accent. Not a toast (wrong register for the money moment), not sticky, not header-replace.

### 2.5 Dispatch retirement · adj #5 default with one requirement

**Decision:** hard delete `api/agents/dispatch.js`. Zero live callers, internal endpoint behind QB's own SPA, registry already routes through `/api/agents/run`. 410 grace shim guards a caller set of zero = dead code.

**Requirement:** re-run the zero-caller audit at 12B deletion time. Do not trust the earlier audit alone. Confirm zero callers at deletion moment in the 12B PR.

**Backward-compat re-exports:** `agents/soul-map.js` etc. each carry "Removed in step 14 when dispatch.js is deprecated" comments. Default · remove the re-exports alongside the 410 retirement (one fewer surface to clean up later). If the audit surfaces stray HTTP callers, this gets reconsidered in 12B.

### 2.6 OVERRIDE on harness · adj #6 (ship the harness)

**Decision:** ship the 2-gate `tests/chapter-02/foundation-banner.mjs` Playwright harness. Do not skip.

**Reasoning (Nizzar):** this is the post-payment confirmation surface, the most fragile moment for a paying user, and a manual visual check is what passes today and silently breaks three commits later with no gate. One small harness protects the upgrade-success moment for every future paying user. Heading into E2E QA + final sign-off, the banner is already gated.

**Cycle:** 12A + 12B + 12C + 12D (4 sub-PRs · the harness adds 12C between 12B and 12D).

---

## 3. Deliverable surfaces

### 3.1 Foundation `?upgrade=success` banner (12A)

**Detection (foundation.html script block):**
- Parse `new URLSearchParams(location.search).get('upgrade')` on load
- If value is `'success'`, set `bannerText` and `bannerVariant = 'upgrade-success'` (new variant, distinct from the existing `'is-success'` post-lock variant)
- Pass to `renderFoundation(root, state, { banner: { variant, tier, copy } })`
- After first render, strip the param via `history.replaceState(null, '', '/foundation')`

**Renderer change (qb-foundation.js):**
- Extend the existing banner pattern (used post-lock) with a new `'upgrade-success'` variant
- The variant renders a `qb-card` shell with gold accent (`is-celebrate` modifier or similar)
- Section structure:
  - Eyebrow `qb-tag` per tier ("Starter is live." / "Pro is live." / "Agency is live.")
  - Fraunces headline per tier ("Your foundation is unlocked." / "Everything is open." / "Client mode is on.")
  - Body paragraph (drafted in 12A · the three candidates surface in the PR for copy-check)
  - Close button (`×`) that calls a passed-through `onDismiss` callback
- `foundation.html` provides `onDismiss` which clears `bannerText` and re-renders (banner falls out of the DOM naturally)

**Copy drafting protocol for 12A:**
- Survey foundation-page next-action surface against the current tier-paid state
- Draft bodies that satisfy Nizzar's rule (confirm decision · name what's open · point at single next action on foundation today)
- Surface drafts in the 12A PR body for one copy-check
- Iterate on the PR if Nizzar tunes

**Sample structure (placeholder, to be refined):**

```
Starter:
  eyebrow: "Starter is live."
  headline: "Your foundation is unlocked."
  body: [draft in 12A PR · confirms 20-agent + unlimited-runs unlock + points
         at running Visual DNA / War Table exercises that just opened]

Pro:
  eyebrow: "Pro is live."
  headline: "Everything is open."
  body: [draft in 12A PR · confirms Phase 01 + 02 + Predictive Panel access +
         points at highest-value first action on the foundation page today]

Agency:
  eyebrow: "Agency is live."
  headline: "Client mode is on."
  body: [draft in 12A PR · confirms client portals ready + points at
         creating first client workspace (likely on /atelier)]
```

### 3.2 `/api/agents/dispatch.js` retirement (12B)

**Pre-deletion zero-caller re-audit (required by adj #5):**
- Run a fresh grep across the codebase for `/api/agents/dispatch` (HTTP POST callers only · module-level imports of `api/agents/*-synthesizer.js` are separate concern)
- Run a fresh grep for `/api/agents/dispatch` inside the production codebase + reference docs
- Audit `vercel.json` for any rewrite/redirect referencing the endpoint
- Document the audit in the 12B PR body before the delete commit

**Deletion (in same 12B PR):**
- `git rm api/agents/dispatch.js`
- Remove backward-compat re-exports from `agents/soul-map.js`, `agents/sensescape.js`, `agents/visual-dna.js`, `agents/war-table.js` (the "Removed in step 14" comment + the export statements they reference)
- Remove `api/agents/*-synthesizer.js` Chapter-1-shape modules (the ones whose only purpose is sitting next to dispatch.js as documented "blocks direct invocation" stubs)
- Confirm `vercel.json` has no orphaned route entries
- Verify deploy via Vercel build + a sanity-check curl: `POST /api/agents/dispatch` should return Vercel's platform-layer 404 (since the file is gone, no route handler exists)

**Rollback path:** if the audit surfaces an unexpected caller post-merge, revert the PR. No 410 shim is left behind for grace · per adj #5 default.

### 3.3 Verification harness · `tests/chapter-02/foundation-banner.mjs` (12C)

Per adj #6 override. 2-gate Playwright harness:

**Gate 1 · Banner renders on `?upgrade=success`:**
- Create a Starter-tier test user (no foundation lock required · banner doesn't depend on lock state)
- Navigate to `/foundation?upgrade=success`
- Wait for bell-mounted + `data-realtime='true'` (per step 10 §3.6 + step 11 §3.5 harness-determinism pattern)
- Assert banner DOM present with `qb-card` + `is-celebrate` (or whatever class lands)
- Assert eyebrow + headline + body present
- Assert URL is now `/foundation` (param stripped after first render)

**Gate 2 · Banner absent on normal load:**
- Same Starter-tier user
- Navigate to `/foundation` (no query param)
- Wait for bell + realtime
- Assert banner DOM is NOT present
- Sanity check · no visual regression on the normal foundation page

**Harness-determinism pattern inherited (mandatory):**
- Wait for `.qb-notification-bell[data-mounted="true"]` AND `data-realtime="true"` before any banner assertion
- Same pattern as 10C + 11C

**Harness-seed schema discipline (carryforward from step 11 §3.4):**
- Check INSERT response status codes for any seed data
- Don't trust silent successes

---

## 4. Sub-PR breakdown

Per adj #6 override (harness ships):

| Sub-PR | Topic |
| --- | --- |
| 12A | Foundation `?upgrade=success` banner · detection + render + dismiss + URL cleanup + 3 tier-aware copy bodies drafted in PR body for one copy-check |
| 12B | `/api/agents/dispatch.js` retirement · fresh zero-caller audit (documented in PR body) + hard delete + backward-compat re-export cleanup |
| 12C | `tests/chapter-02/foundation-banner.mjs` · 2-gate Playwright harness |
| 12D | Step 12 closure report · names chapter-close shape (13 + 14 separate vs collapsed) |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass. **EXCEPTION:** 12A surfaces the copy bodies in its PR body for a one-pass copy-check before merge.

---

## 5. Acceptance criteria

Per §13.13 + §13.14 + adj #6 harness:

1. **Banner renders on `?upgrade=success`** with the correct tier-aware copy from `/api/qbp.tier`. Eyebrow, headline, body all present. `qb-card` shell with gold accent.
2. **Dismiss + URL cleanup work.** Click × → banner removed from DOM + URL no longer has `upgrade` parameter. Reload after dismiss shows no banner.
3. **Banner absent on normal load.** Navigating to `/foundation` (no param) shows no banner DOM. Zero regression on the normal foundation page.
4. **Dispatch endpoint is gone.** `POST /api/agents/dispatch` returns Vercel's platform-layer 404 (file deleted, no handler exists). Zero callers surfaced in the fresh 12B audit.
5. **No app regression from dispatch removal.** All four Phase 01 agents continue to fire via `/api/agents/run`. Step 8 chain-orchestration harness still 5/5 PASS. Step 11C archive-tree harness still 5/5 PASS. Step 10C replay-panel harness still 5/5 PASS.

---

## 6. Out of scope

Explicit:

- Stripe checkout flow itself (already shipped).
- Schema changes (none).
- Bell notification of the upgrade event (default rejected · pure URL-parameter detection).
- 410 shim for dispatch retirement (default rejected · hard delete).
- E2E QA pass (§13.15 · step 13).
- Final sign-off + `CHAPTER_02_COMPLETION.md` (§13.16 · step 13 or step 14 per closure shape decision).
- Bracketed hardening sub-PR (chapter 3 first step).
- Synthetic chain_id backfill migration (chapter 3 candidate per step 11 adj #6).
- Tier downgrade or cancellation flow (post-launch).

---

## 7. Forward references

- **Step 13 (and possibly 14)** End-to-end QA pass + final sign-off + `CHAPTER_02_COMPLETION.md`. Shape determined in 12D closure:
  - **Option A (collapsed):** Step 13 = E2E QA + sign-off + `CHAPTER_02_COMPLETION.md` in one bundle. E2E QA is the gate; sign-off is the artifact. Risk: a single FAIL on E2E QA blocks the whole chapter close until fixed.
  - **Option B (separate):** Step 13 = E2E QA pass with its own verification report. Step 14 = sign-off + `CHAPTER_02_COMPLETION.md` after QA clears. Risk: ceremony overhead for a small admin step.
  - Recommendation surfaced in 12D after viewing the actual remaining surface area.
- **Chapter 3 first step** Bracketed hardening sub-PR (per step 8 + step 10 + step 11 closure recommendations).
- **Chapter 3 candidate work** Synthetic chain_id backfill migration (per step 11 adj #6 · own step, own reproduction gate, own SQL review).

---

## 8. Captures for the step 12 closure report

Carryforward + new:

- **Framework defect-rate continuation.** Step 12 expected outcome: zero surgical fixes (the chapter has stabilized). If step 12 ships 0 → 4 clean steps in a row (9-12) → recommend the chapter-3 first-step hardening sub-PR is small and focused, not a major sweep.
- **Chapter-close shape determination.** 12D names whether 13.15 + 13.16 collapse or run separate.
- **Vocabulary discipline (carryforward · step 11 §3.2 reinforced).** The banner copy drafted in 12A runs the QB voice test. No banned phrases, no system/build vocab leak.
- **Single-canonical-surface discipline (carryforward).** The banner lives only on `/foundation`. The bell does NOT carry a notification for the upgrade event. Stripe checkout redirect IS the signal.
- **Harness-determinism pattern (carryforward · applied to 12C).** Wait for bell-mounted + data-realtime='true' before any view-interaction assertion.
- **Harness-seed schema discipline (carryforward · step 11 §3.4 reinforced).** Check INSERT response status when seeding fixture data.
- **Branch-state verification discipline (carryforward · reinforced from steps 7, 9-11).** `git branch --show-current` before every commit. Step 12 starts on a freshly-recreated `chapter-2/step-12-spec` branch (the prior incarnation was deleted on PR #137 merge).
- **Three-consumer Realtime pattern (carryforward · step 11 §3.1).** Bell + Phase view + archive all subscribe to one shared `qb-realtime-manager.js`. Step 12 banner does NOT subscribe · purely URL-parameter-driven. Captures the pattern's appropriate scope · not every surface needs Realtime.

---

## 9. End of spec

Hold released per Nizzar directive. Autonomous chain resumes IMMEDIATELY with sub-PR 12A on this spec's merge to main.
