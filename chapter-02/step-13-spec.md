# Chapter 2 · Step 13 spec · End-to-end QA pass (full)

Status: full spec. All six adjudications baked in (see §2 — five defaults with hard conditions, one modified policy on #6). Outline file `chapter-02/step-13-outline.md` retained as historical record on this branch (PR #143). Hold released per Nizzar directive · 13A starts immediately on merge, with two operator-coordination dependencies named in §3.

Source authority: `CHAPTER_02_SPEC.md` §13.15 + step 12 closure §6 (chapter-close shape) + Nizzar adjudication (this session).

Branch: `chapter-2/step-13-spec`.

---

## 1. Bundle framing

Step 13 is the comprehensive end-to-end verification of chapter 2. The 13-harness per-surface suite (`bell-realtime.mjs`, `chain-orchestration.mjs`, `phase-view.mjs`, `replay-panel.mjs`, `archive-tree.mjs`, `foundation-banner.mjs`, and the older single-surface harnesses) each verifies its own slice in isolation. Step 13 verifies **the seams between them** · the cross-surface state propagation no isolated harness covers.

This is gating work. The chapter has stabilized (4 clean steps in a row · 8 surgical fixes total) but the master spec §13.15 explicitly calls for the substantial integration verification. Step 14 (terminal · §13.16 sign-off + `CHAPTER_02_COMPLETION.md`) opens only after step 13 clears.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Monolithic E2E Playwright harness | §13.15 + adj #1 default | `tests/chapter-02/e2e-chapter-2.mjs` covering full path in one Playwright context, one fresh user |
| Cross-surface state verification | E2E framing | Verify state propagates: upgrade → unlock → lock → deliver → bell + Phase view + archive + run history |
| Any in-session fixes surfaced by seams | adj #6 modified policy | Cosmetic/test-infra: ship in-session under cap 2. ANY seam-defect: STOP and surface (even 2 lines). |

§13 items remaining after step 13:

- **Step 14** Final sign-off + `CHAPTER_02_COMPLETION.md` (master spec §13.16) · TERMINAL.

Operator-coordination dependencies for 13A (surface as blockers if either is unmet):

1. **Stripe test-mode key availability.** Real Stripe test-mode is the default for the upgrade-flow gate (adj #3). If the key is genuinely not provisionable at 13A time, STOP and surface · do not silently fall back to mocked. Fallback path on confirmed unavailability: mocked-with-logged-gap + a named pre-launch real-Stripe seam check.
2. **CHAIN_TEST_AGENT=1 re-enable for verification window.** Per step-8C operator pattern. Required for the chain-orchestration gate inside the E2E. Disabled before step 13 closes (confirm in closure).

Prerequisites met (carried from steps 6-12):
- All chapter-2 surfaces shipped + verified at the per-surface level via the 13-harness suite (12 active after the 12B retirement of `smoke-haiku-sensescape.mjs`).
- 4 clean steps in a row · 8 surgical fixes total · chapter stabilized.

---

## 2. Adjudicated decisions · baked into this spec

Per Nizzar's six-point adjudication (this session):

### 2.1 Monolithic harness · adj #1 default

**Decision:** one comprehensive `tests/chapter-02/e2e-chapter-2.mjs` covering the full path sequentially. Single Playwright context end-to-end.

**Reasoning (Nizzar):** the seam between gates is the thing under test; splitting rebuilds per-area harnesses and loses the only capability E2E adds over the 13 isolated harnesses. Debug isolation comes from gate labelling inside the file, not fragmentation.

### 2.2 ONE user across all gates · adj #2 default

**Decision:** one fresh test user persists across every gate in the E2E run. Created in setup, deleted in `finally`.

**Reasoning (Nizzar):** cross-gate state propagation IS the coverage. Per-gate users reset state at every boundary = testing against synthetic fixture state, which the per-surface harnesses already do.

### 2.3 Real Stripe test-mode · adj #3 default WITH HARD CONDITION

**Decision:** real Stripe test-mode checkout against the prod deploy (Stripe → redirect → `?upgrade=success` → banner path).

**Reasoning (Nizzar):** the Stripe → redirect → banner path is exactly the seam this step exists to verify, and the step-12 banner was built to handle that redirect. Mocking skips the seam the chapter's last feature was built for.

**Hard condition (adj #3 explicit):** confirm the Stripe test-mode key is actually available in the environment at 13A. If it is genuinely not provisionable, STOP and surface · do not silently fall back to mocked.

**Fallback path on confirmed unavailability only:** mocked-with-logged-gap + a named pre-launch real-Stripe seam check.

### 2.4 CHAIN_TEST_AGENT enable-for-window with explicit disable · adj #4 default

**Decision:** re-enable `CHAIN_TEST_AGENT=1` in Vercel Production for the 13A verification window (per step-8C operator pattern · operator action). Verify the chain fires inside the same continuous user journey as upgrade + archive. Then DISABLE it before step 13 closes. Confirm the disable in the 13 closure.

**Reasoning (Nizzar):** chapter close should verify EVERYTHING in chapter 2 lights up, not just everything-minus-chain. Do not let the flag survive into step 14.

### 2.5 Cleanup discipline · adj #5 default

**Decision:** every E2E run deletes its test user in the `finally` block (per existing harness pattern · `createUser` + `deleteUser`). Captured logs/IDs in harness output, not live rows in customer DB.

**Reasoning (Nizzar):** prod Supabase does not accumulate verification-era users. The 017 hotfix recently closed a leak in that exact DB.

### 2.6 MODIFIED surgical-fix policy · category-gated · adj #6

**Decision:** keep the in-session fix pattern and cap of 2, but the gate is CATEGORY not line count.

**Category A · cosmetic / test-infrastructure (in-session under cap of 2):**
- Selector tweak
- Timing wait adjustment
- Harness bug (off-by-one, missing await)
- Copy typo the QA caught
- Test-fixture state cleanup
- No pre-adjudication, that's ceremony.
- Cap of 2 holds; exceeding triggers stop-and-reassess per spec §4.4.

**Category B · ANY cross-surface SEAM defect (STOP and surface BEFORE patching, regardless of line count · even 2 lines):**
- State not propagating between gates
- Redirect dropping a param
- A Realtime consumer not refreshing in the integrated timeline
- Lock/unlock state not carrying
- Banner not appearing despite param present
- Bell badge not updating after notification INSERT
- ANY behavior that ONLY surfaces in the cross-surface seam (the per-surface harness PASSed; the integration FAILs)

**Reasoning (Nizzar):** the reason it surfaced in E2E and not a per-surface harness is that it lives in the seam, and seam defects are the entire point of this step. A quiet in-session patch of a real integration bug is the failure mode to avoid · a 4-step clean streak is exactly when that quiet patch feels too safe.

**Discipline:** before any surgical fix, name the category. Cat A → patch. Cat B → STOP and surface with the seam description.

---

## 3. Deliverable surfaces

### 3.1 End-to-end Playwright harness (13A) · `tests/chapter-02/e2e-chapter-2.mjs`

**Shape:**
- Single Playwright `chromium.launch()` + single `browser.newContext()` + single `context.newPage()` for the whole run (per adj #1 + #2)
- One fresh test user via `createUser` in `setup`; `deleteUser` in `finally` (per adj #5)
- Sequential gates · each depends on the prior state
- Each gate logs PASS/FAIL with detail label
- Run artifact JSON written to `tests/chapter-02/e2e-chapter-2.last-run.json`

**Gates (sequential, all required for full PASS):**

| Gate | Surface | Verifies |
|---|---|---|
| 1 | Auth + signup | Fresh user created via service-role admin endpoint + signed in via password grant → JWT obtained |
| 2 | Foundation cold-start | `/foundation` renders for free-tier user with no QBP · hero + free-tier exercise tiles + upgrade-banner CTA visible |
| 3 | QBP accumulation | Free-tier exercises (archetype-compass, soul-map, sensescape) marked complete via `/api/qbp` PATCH · QBP fields populate |
| 4 | Paywall gate | Visual DNA + War Table locked-card click → paywall modal opens (CHAPTER 1 surface; verified via DOM presence) |
| 5 | Upgrade flow · Stripe test-mode | Click "Upgrade to Starter" → POST `/api/stripe/checkout` → receive checkout URL → navigate to URL → fill test card (4242 4242 4242 4242, future date, any CVC, any postal) → submit → Stripe redirects to `/foundation?upgrade=success` |
| 6 | Upgrade banner renders | After redirect: banner DOM present with Starter copy verbatim · URL stripped via `history.replaceState` · tier in `/api/qbp` now `'starter'` |
| 7 | Tier-locked unlock | Visual DNA + War Table cards now click-active · paywall modal does NOT appear |
| 8 | Tier-locked exercises complete | Mark Visual DNA + War Table completions via `/api/qbp` PATCH · QBP `visualDnaKeepCount` + War Table fields populate |
| 9 | Foundation lock | Click "Lock your foundation" → `/api/lock-foundation` returns 202 · four dispatch_jobs rows created · four artifact rows in `queued` status |
| 10 | Phase 01 delivery + bell + Phase view propagation | Within 60s: all four Phase 01 artifacts deliver · bell badge updates per delivery · Phase view rows show `succeeded` status pill · run history populates · archive tree shows the chain |
| 11 | Chain orchestration (under `CHAIN_TEST_AGENT=1`) | After soul_map + sensescape deliver, synthetic chain_test_agent fires · its artifact appears in archive as a child node of the chain · `dispatch_jobs.kind='chain'` row present |
| 12 | Manual rerun · two-button | Click "Rerun · current QBP" on Phase view → `/api/agents/rerun` returns 202 · new artifact version appears in archive nested under v1 via `parent_artifact_id` |
| 13 | Replay modal · focus management | Click run history row → modal opens · closeBtn focused · Escape closes · focus returns to row |

**Harness-determinism pattern (mandatory):** wait for `.qb-notification-bell[data-mounted="true"]` AND `data-realtime="true"` before any view-toggle interaction. Same pattern as 10C/11C/12C.

**Harness-seed schema discipline (mandatory):** check `r.ok` on every Supabase REST mutation. Throw with response body on non-OK. Silent 400s during seed masquerade as client bugs downstream.

### 3.2 Cross-surface state-propagation seam-checks

Specific assertions the harness adds (these are NOT covered by any per-surface harness):

| Seam | Source surface | Dependent surfaces · all must reflect |
|---|---|---|
| Stripe upgrade | Stripe redirect | tier on `/api/qbp` = starter · banner DOM · tier-locked cards unlocked |
| Banner dismiss | User click | DOM removal · URL clean of `upgrade=success` · subsequent reload shows no banner |
| Lock-foundation | `/api/lock-foundation` 202 | dispatch_jobs rows · artifact rows queued · Phase view shows producing state · bell registers Realtime channel |
| Each Phase 01 delivery | Server-side `delivered` write | bell notification within 5s · Phase view row updates within 5s · run history populates within 5s · archive tree includes the artifact within 5s |
| chain_ready notification | Server-side notification insert | bell badge increments · Phase view refetches · archive refetches · all within Realtime + 5s |
| Manual rerun | `/api/agents/rerun` 202 | new artifact row · run history shows new run · archive tree shows v2 nested under v1 |

### 3.3 Pre-13A operator-coordination dependencies (BLOCKERS if unmet)

**Stripe test-mode key:**
- Check `/tmp/.env.qb-branos.live-backup` for `STRIPE_SECRET_KEY` (or equivalent)
- Determine whether the value is a test-mode key (prefix `sk_test_`) or a live key (prefix `sk_live_`)
- If `sk_live_` only: production runs with live keys; spending real money for an E2E run is not acceptable. STOP and surface; await operator action to provision test-mode (likely via a preview deployment with test keys configured).
- If `sk_test_` present: proceed.

**CHAIN_TEST_AGENT=1 in Vercel Production:**
- Confirm via deployment env check OR via a smoke probe (curl/health endpoint that signals)
- If not set: STOP and surface, await operator coordination (per step-8C pattern · operator action)
- If set: proceed; remember to surface for disable before closure

### 3.4 Sub-PR breakdown

| Sub-PR | Topic |
|---|---|
| 13A | `tests/chapter-02/e2e-chapter-2.mjs` (the monolithic harness) · merges only after E2E PASSes locally against prod with both operator dependencies confirmed |
| 13B-N (variable, Cat A only) | PR #86-pattern surgical fixes for cosmetic/test-infra issues only · capped at 2 |
| 13Z | Step 13 closure report + step 14 outline opens |

The middle (13B-N) is variable. If E2E goes clean, the cycle is 13A + 13Z. If Cat A fixes surface, each gets its own surgical PR (cap of 2). If a Cat B seam-defect surfaces at any point, STOP and surface · do not patch · do not continue.

---

## 4. Acceptance criteria

Per §13.15 + chapter-2 scope:

1. **Full path end-to-end PASSES.** Every one of the 13 gates green. Run artifact JSON captures all per-gate results + timing + the cross-surface propagation latencies.
2. **Cross-surface state propagation verified.** Each seam-check assertion (per §3.2) passes within the documented window (Realtime + 5s).
3. **Zero regression on per-surface harnesses.** Re-run the relevant per-surface harnesses post-13A · all still PASS at their previous PASS-counts. (Practical: re-run `chain-orchestration.mjs` after E2E to confirm chain still works post-test-user-cleanup; `foundation-banner.mjs` to confirm banner copy still verbatim; `phase-view.mjs` + `archive-tree.mjs` as smoke.)
4. **Surgical-fix count caps at 2 (Cat A only).** If step 13 surfaces 3+ Cat A fixes, STOP and surface for chapter-stabilization reassessment. ANY Cat B fix triggers STOP-and-surface regardless of count.
5. **Test user cleanup.** Every E2E run leaves zero residual test users in production Supabase. Verified by post-run query of `auth.users` for any `signup_source='c2-s13'` entries.
6. **CHAIN_TEST_AGENT disabled before closure.** Confirm in the 13 closure report that the flag is OFF in prod env after E2E completes.

---

## 5. Out of scope

Explicit:

- Final sign-off + `CHAPTER_02_COMPLETION.md` (step 14).
- New features (no new surfaces ship in step 13).
- Synthetic chain_id backfill migration (chapter-3 candidate per step 11 adj #6).
- Bracketed hardening sub-PR (chapter-3 first step).
- WCAG accessibility audit beyond what existing harnesses cover (deferred to a chapter-3 a11y pass if scoped).
- Chapter 1 surface re-verification (chapter 1 is closed; chapter 2 E2E verifies chapter-2 surfaces only).
- Stripe webhook hardening (orthogonal · already in place).

---

## 6. Closure-report required confirmations (per Nizzar directive)

13Z closure report must explicitly answer:

1. **All gate results.** Per-gate PASS/FAIL with the run artifact captured.
2. **CHAIN_TEST_AGENT confirmed disabled.** Post-E2E status of the env var in prod · explicit "DISABLED at <timestamp>" or surface a blocker.
3. **Test users confirmed deleted.** Post-run query against `auth.users` for the harness's `signup_source` tag · zero results = confirmed.
4. **Surgical-fix count by category.** Cat A (cosmetic/test-infra) count · Cat B (seam-defect) count (must be 0; any > 0 means STOP-and-surface triggered).
5. **Running chapter total.** Updated total (currently 8 entering step 13).
6. **Clean-streak status.** Did step 13 hold the clean streak (5 in a row) OR did it break it?

Then open step 14 outline (terminal step) with its six open calls.

---

## 7. Forward references

- **Step 14 (TERMINAL)** Final sign-off + `CHAPTER_02_COMPLETION.md` (master spec §13.16). Pure documentation closeout · catalog of every shipped surface, every harness, framework defect-rate ledger, all captured patterns, chapter-3 inheritance notes, formal closeout statement.
- **Chapter 3 first step** Bracketed hardening sub-PR (per step 8 + step 10 + step 11 + step 12 closure recommendations · evidence supports a small focused pass given chapter stabilization).
- **Chapter 3 candidate work** Synthetic chain_id backfill migration (per step 11 adj #6 · own step, own reproduction gate, own SQL review).

---

## 8. Captures for the step 13 closure report

Carryforward + new:

- **Framework defect-rate continuation.** Cat B count is the integration-defect signal · 0 holds the stabilization claim; > 0 breaks it. Cat A is per-step noise · 0-2 is fine, 3+ triggers stop-and-reassess.
- **Clean-streak status.** Step 13 is the first GATING step in 5 (steps 9-12 were build/verification; step 13 is gating). A clean step 13 = 5-in-a-row clean streak entering terminal step 14.
- **Operator-coordination dependencies validated.** Two named dependencies (Stripe test-mode key + CHAIN_TEST_AGENT=1) · the discipline of surfacing BEFORE running rather than failing mid-harness is itself a pattern to capture.
- **Category-gated fix policy (NEW · validated by step 13 execution).** Cat A vs Cat B as the canonical surgical-fix discrimination. The line-count cap is the wrong gate at integration time; the surface where the bug lives is the right gate.
- **Harness-determinism pattern (carryforward · applied to 13A).** Same wait-for-mount-and-realtime pattern.
- **Harness-seed schema discipline (carryforward · applied to 13A seed mutations).** Check r.ok on every REST write.
- **Branch-state verification discipline (carryforward · applies to 13A/13B-N/13Z commits).** `git branch --show-current` before every commit.
- **Tooling discipline (carryforward · permanent).** Operator-only secret/env var actions. The CHAIN_TEST_AGENT enable + disable are operator actions, not autonomous.

---

## 9. End of spec

Hold released per Nizzar directive. Autonomous chain resumes IMMEDIATELY on merge with the pre-13A operator-coordination dependency checks (Stripe test-mode key + CHAIN_TEST_AGENT=1). Either failing = STOP and surface. Otherwise 13A.
