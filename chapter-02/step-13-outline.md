# Chapter 2 · Step 13 spec outline · End-to-end QA pass

Status: draft outline. Awaiting Nizzar adjudication on the open calls in §5 below. Full spec follows on the same branch once the outline lands.

Source authority: `CHAPTER_02_SPEC.md` §13.15 ("End-to-end QA pass. Same shape as Chapter 1 step 17. Fresh user, full path, all gates.") + step 12 closure §6 chapter-close-shape decision.

Branch: `chapter-2/step-13-spec`. PR opens on a hold gate until the outline is approved.

---

## 1. Bundle framing

Step 13 is the comprehensive end-to-end verification of chapter 2. A fresh user walks the full path from signup through chapter close, and every gate in chapter 2's surface area is exercised in a single integrated pass. The 13 existing chapter-2 harnesses (`bell-realtime.mjs`, `chain-orchestration.mjs`, `phase-view.mjs`, `replay-panel.mjs`, `archive-tree.mjs`, `foundation-banner.mjs`, plus the older single-surface harnesses from steps 6-8) all verify their slice. Step 13 verifies the seams between them · the cross-surface state propagation that no single harness covers.

This step is GATING work · it could surface bugs requiring PR #86-pattern surgical fixes. The chapter has stabilized (4 clean steps in a row, 8 surgical fixes total) but the master spec §13.15 explicitly calls for the substantial verification. Step 14 (final sign-off + `CHAPTER_02_COMPLETION.md`) opens only after step 13 clears.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| End-to-end Playwright harness | §13.15 + step 12 closure §6 | New harness covering the full chapter-2 path |
| Cross-surface state verification | E2E framing | Verify state propagates: bell ↔ Phase view ↔ archive ↔ replay |
| Any surgical fixes surfaced | PR #86 pattern (carried from steps 6-8) | Ship in-session if streak permits, surface to Nizzar if scope creeps |

§13 items unchanged · deferred out:

- **Step 14** Final sign-off + `CHAPTER_02_COMPLETION.md` (master spec §13.16).

Prerequisites met (carried from steps 6-12):
- All chapter-2 surfaces shipped + verified at the per-surface level via the 13-harness suite.
- 12C foundation-banner harness `tests/chapter-02/foundation-banner.mjs` covers the upgrade-success surface.
- Operator coordination available for `CHAIN_TEST_AGENT=1` re-enablement during the verification window (per step 8C pattern).
- Chapter has stabilized; 4 clean steps streak suggests low surgical-fix risk but not zero.

---

## 2. Acceptance areas covered

The E2E gates exercise the full chapter-2 surface area in order:

| Area | Surfaces touched | What's verified |
| --- | --- | --- |
| Auth + signup | `signal-scan.html`, magic link | Fresh user creation, email confirm, sign-in, session JWT |
| Foundation cold-start | `/foundation`, free-tier exercises | Hero + roadmap render, free exercises clickable, QBP accumulates |
| Paywall gate | tier-locked exercises | Visual DNA + War Table locked-card click → paywall modal |
| Upgrade flow | Stripe checkout → `?upgrade=success` redirect → banner | Stripe test card, redirect lands at `/foundation?upgrade=success`, tier-aware banner shows (12C-asserted strings) |
| Tier-locked exercises unlock | post-upgrade Visual DNA, War Table | Locked cards now active, exercises complete, QBP accumulates |
| Foundation lock | `/api/lock-foundation`, dispatch fan-out | Lock fires four Phase 01 agents via `/api/agents/run`, dispatch rows created |
| Phase 01 delivery | bell, Phase view | Each agent delivers, bell receives notifications, Phase view updates live |
| Chain orchestration | `chain_test_agent` synthetic | After deps deliver, chain fires (under `CHAIN_TEST_AGENT=1`) |
| Archive tree-view | `/archive` with `mode=chains` | Tree renders chain + Earlier work (if legacy artifacts present) |
| Run history + replay | `/agents` Run history tab → replay modal | All runs visible, click-through opens replay, focus management correct |
| Manual rerun | Phase view two-button rerun | Both `qbp_source=current` and `qbp_source=original` paths fire |

Step 13 doesn't re-verify what each per-surface harness already covers. It verifies the cross-surface seams: a single test user's state propagates correctly through the chain (upgrade → unlock → lock → deliver → notify → render).

---

## 3. Deliverable surfaces

### 3.1 End-to-end Playwright harness (13A)

`tests/chapter-02/e2e-chapter-2.mjs` (or split per open call #1).

Shape:
- Single Playwright browser instance, single context, single test user lifecycle (per open call #2 default)
- Sequential gates (each gate depends on the prior state)
- Each gate logs PASS/FAIL with detail
- Harness-determinism pattern inherited (wait for mount/ready before assertions)
- Harness-seed schema discipline inherited (check INSERT/PATCH response status)
- Test user deletion in `finally` block
- Run artifact JSON written to `tests/chapter-02/e2e-chapter-2.last-run.json`

### 3.2 Cross-surface state verification

Specific seam-checks the harness adds:
- After Stripe upgrade → tier on `/api/qbp` reflects 'starter'
- After upgrade banner dismiss → `tier === 'starter'` persists in subsequent renders
- After lock-foundation → all four Phase 01 dispatch_jobs rows exist
- After each Phase 01 delivery → bell notification arrives AND Phase view updates AND run history populates AND archive tree shows the artifact
- After chain orchestration (under `CHAIN_TEST_AGENT=1`) → synthetic agent artifact appears in archive as a child of the chain root
- After manual rerun → new artifact version appears in archive nested under v1 (via `parent_artifact_id`)

### 3.3 Surgical fix policy

Per open call #6 (default: ship in-session). If a bug surfaces during E2E gates, it gets a PR #86-pattern surgical fix and the E2E re-fires. Each surgical fix gets its own PR with audit + verification, just like steps 6-8.

If surgical fixes exceed 2 in step 13 (i.e., step 13 alone contributes 2+ to the chapter total of 8), STOP and surface · the chapter stabilization claim breaks down at that point and chapter-3 hardening needs reassessment.

### 3.4 Sub-PR breakdown

| Sub-PR | Topic |
| --- | --- |
| 13A | `tests/chapter-02/e2e-chapter-2.mjs` (or split per open call #1) · the harness itself |
| 13B-N (variable) | Any surgical fixes surfaced by 13A · each its own PR per PR #86 pattern |
| 13Z | Step 13 closure report · captures gates green, surgical-fix count, chapter-13 forward notes |

The middle is variable. If E2E goes clean, 13B-N is empty and the cycle is just 13A + 13Z. If bugs surface, each gets its own surgical PR.

---

## 4. Acceptance criteria

Per §13.15 + chapter-2 scope:

1. **Full path end-to-end PASSES.** Fresh user goes from signup through chapter close · every gate green. Test artifact (JSON) captures all per-gate results.
2. **Cross-surface state propagation verified.** State change in one surface (e.g., agent delivery) reflects correctly in all dependent surfaces (bell + Phase view + archive + run history) within Realtime + 5s window.
3. **Zero regression on per-surface harnesses.** Re-run `bell-realtime.mjs`, `chain-orchestration.mjs`, `phase-view.mjs`, `replay-panel.mjs`, `archive-tree.mjs`, `foundation-banner.mjs` post-13A · all still PASS at their previous PASS-counts.
4. **Surgical-fix count caps at 2.** If step 13 surfaces 3+ surgical fixes, STOP and surface for chapter-stabilization reassessment.
5. **Test user cleanup.** Every E2E run leaves zero residual test users in the production Supabase database.

---

## 5. Six open calls for Nizzar adjudication

1. **Harness shape · monolithic vs split.** Default: one comprehensive file `e2e-chapter-2.mjs` covering the full path sequentially. Override: split per acceptance area (e.g., `e2e-signup-foundation.mjs` + `e2e-upgrade-lock.mjs` + `e2e-delivery-render.mjs`). Default favors a single Playwright context end-to-end · the seam between gates is itself a thing being tested; splitting would lose that fidelity.

2. **Test user lifecycle · one user end-to-end vs per-gate users.** Default: ONE user persists across all gates (matches "fresh user, full path" master-spec framing). Override: per-gate users (each gate independent, easier to debug a single FAIL but loses cross-gate state-propagation coverage). Default favors the integrated path.

3. **Stripe checkout · real vs mocked.** Default: real Stripe test-mode checkout with a test card, real redirect to `/foundation?upgrade=success`, real banner render. Override: mock the post-checkout state by direct DB tier flip + URL navigation (faster, no Stripe dependency, but loses the actual Stripe → redirect → banner integration). Default favors the real integration · the upgrade flow IS the highest-emotion moment.

4. **CHAIN_TEST_AGENT involvement.** Default: re-enable `CHAIN_TEST_AGENT=1` in Vercel Production during the verification window (per step 8C pattern · operator action). Disable after E2E completes. Override: skip chain orchestration in E2E (it's already gated by `chain-orchestration.mjs`). Default favors fully-integrated E2E · chapter close should verify EVERYTHING in chapter 2 lights up, not just everything-minus-chain.

5. **Cleanup discipline.** Default: every E2E run deletes its test user in the `finally` block (per existing harness pattern · `createUser` + `deleteUser`). Override: leave test users in place for debugging post-run. Default favors clean DB state · prod Supabase shouldn't accumulate verification-era users.

6. **Surgical-fix policy.** Default: PR #86-pattern surgical fixes ship in-session if scope stays small (4 clean steps streak suggests we should preserve momentum). Cap at 2 surgical fixes per the spec §4 acceptance criteria · if step 13 exceeds 2, STOP and surface for chapter-stabilization reassessment. Override: surface ALL surgical-fix candidates for adjudication first before any fix lands (more ceremony, more confidence on each fix).

---

## 6. Out of scope

Explicit:

- Final sign-off + `CHAPTER_02_COMPLETION.md` (step 14).
- Synthetic chain_id backfill migration (chapter-3 candidate per step 11 adj #6).
- Bracketed hardening sub-PR (chapter-3 first step).
- New features (no new surfaces ship in step 13).
- Chapter 1 surface re-verification (chapter 1 is closed; chapter 2 E2E verifies chapter-2 surfaces only).
- WCAG accessibility audit beyond what existing harnesses cover (deferred to a chapter-3 a11y pass if scoped).

---

## 7. Forward references

- **Step 14** Final sign-off + `CHAPTER_02_COMPLETION.md` (master spec §13.16). Pure documentation closeout · catalog of every shipped surface, every harness, framework defect-rate ledger, all captured patterns, chapter-3 inheritance notes, formal closeout statement.
- **Chapter 3 first step** Bracketed hardening sub-PR (per step 8 + step 10 + step 11 + step 12 closure recommendations · evidence supports a small focused pass given chapter stabilization).
- **Chapter 3 candidate work** Synthetic chain_id backfill migration (per step 11 adj #6 · own step, own reproduction gate, own SQL review).

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch.
