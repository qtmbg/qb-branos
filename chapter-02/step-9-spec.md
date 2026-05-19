# Chapter 2 · Step 9 spec · `/agents` Phase view (full)

Status: full spec. Adjudications from Nizzar baked in (see §2). Outline file `chapter-02/step-9-outline.md` retained as historical record; this spec supersedes its sequencing default. Hold-open PR #120 stays on hold-gate until explicit release.

Source authority: `CHAPTER_02_SPEC.md` §6 (Agent Console), §6.3 (locked-phase rows), §6.4 (two-button rerun semantics), §6.6 (states + rolling badges), §13.10 (build sequence step 10 → renumbered to chapter-2/step-9). Step 8 closure §6 forward references.

Branch: `chapter-2/step-9-spec`.

---

## 1. Bundle framing

Step 9 ships the Agent Console **Phase view** as the canonical user-facing surface at `/agents`. A paying Starter user opens `/agents` and sees: four Phase 01 agents with live state, four Phase 02-05 sections as tier-aware locked rows, the bell in the corner, and the run history view a tab away. The locked rows are the upsell narrative · Starter sees "what you have access to" vs "coming in Chapter 4"; Free sees "what unlocks at Starter".

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| Tier-aware locked-row copy | §6.3 + sequencing-override reasoning | Differentiate locked-row copy by `user.tier` |
| Realtime extension to Phase view | §6.6 + Nizzar override on call #5 | Reuse step 7C state machine + bell channel; refresh `/api/agents/console` on notification arrival |
| Verification + lock-in of existing surfaces | §6.4 + §6.6.1-3 + §6.7 | Two-button rerun, rolling-average badges, empty + error states |

§13 items deferred out of step 9 (renumbered per the sequencing cascade):

- §13.11 Run history view + replay panel · shipped within `qb-agents-console.js` already (step 5 work · verified in step 7C). Step 9 leaves it untouched. Any incremental refinement defers to step 10.
- Archive UI tree-view · deferred to step 11 or 12 per Nizzar override (see §2.1).
- §13.13 Foundation `?upgrade=success` banner · unchanged.
- §13.14 `/api/agents/dispatch.js` retirement · unchanged.

Prerequisites met (carried from steps 5-8):
- `/api/agents/console` endpoint live and contract-conformant (returns `agents[]`, `locked_phase_cards[]`, `recent_runs[]`, `user{tier,foundation_locked_at}`).
- `qb-agents-console.js` renders Phase 01 rows + locked Phase 02-05 cards + run-history view + replay modal.
- `qb-notification-bell.js` Realtime state machine verified end-to-end (step 7C, 5/5 PASS).
- Two-button rerun wired and verified (step 7B, 2/2 PASS).
- Migration 016 chain columns shipped (step 8).
- `CHAIN_TEST_AGENT` removed from prod (operator confirmed).

---

## 2. Adjudicated decisions · baked into this spec

Per Nizzar's six-point adjudication against `step-9-outline.md`:

### 2.1 OVERRIDE on sequencing · archive tree-view deferred

**Decision:** Step 9 ships the Agent Console Phase view per master spec §13.10. Archive tree-view is deferred to step 11 or 12 (after Phase view + run history + replay panel). The chapter-mid-flight scope evolution captured in outline §1 is reversed: surface order mirrors user value order; a paying Starter sees the upsell narrative on `/agents`, not on the archive page. Forward references in §7 renumbered accordingly.

**Cascade:** All other adjudications below frame against Phase view scope, not archive scope.

### 2.2 NOTE for future · tree visual treatment when archive tree-view ships

**Decision:** Depth-indented nested `qb-card`s. Simplest treatment for the weakest persona (Blank Slate, first chain). Capture as preference; moot for step 9.

### 2.3 NOTE for future · chain root identification

**Decision:** `lock_at` + "Locked YYYY-MM-DD · N agents" as the visual root anchor when archive tree-view ships. Capture as preference; moot for step 9.

### 2.4 Chapter 1 legacy treatment · reframed for Phase view scope

**Decision:** Chapter 1 artifacts render in Phase view with full functionality. `chain_id=null` does not affect rendering · Phase view groups by phase + agent_slug, not chain_id. The "Pre-chain history" treatment is unnecessary. The two-button rerun secondary CTA correctly stays disabled for Chapter 1 legacy artifacts (no `qbp_snapshot`) per §6.4.

### 2.5 OVERRIDE · Realtime enabled for Phase view in step 9

**Decision:** Phase view subscribes to the bell's existing `notifications` Realtime channel. On any notification arrival, Phase view refetches `/api/agents/console` to refresh agent state. The poll-on-error state machine from step 7C (SUBSCRIBED grace timeout, flipToPoll, 30 s poll interval) extends to the Phase view subscription manager. One Supabase Realtime client instance is shared between bell and Phase view.

**Reasoning** (Nizzar): Phase view is the surface users stare at while waiting for deliveries. Poll-only at 30 s for the surface where users actually wait is wrong UX. The same channel that fires the bell badge also re-paints the Phase view rows from fresh server state.

### 2.6 MOOT · pagination / depth limits for Phase view

**Decision:** Phase view renders a fixed surface · four Phase 01 cards + four Phase 02-05 locked cards. No pagination needed. Moot per the surface shape.

---

## 3. Deliverable surfaces

### 3.1 Agent Console Phase view rendering in `/agents`

**Status:** Mostly shipped in steps 4-5. The DOM structure at `js/qb-agents-console.js` lines 567-587 renders the Phase 01 section + locked Phase 02-05 sections. Step 9 audits this for §6.3 + §6.6 conformance and patches gaps.

**Specific gaps to close:**
- Phase 01 section header copy may not match §6.2 exactly · verify against spec language and patch if drifted.
- Aggregate health dot color logic (§6.6.3) is implemented; verify the threshold-to-state mapping in `thresholdState()` matches §6.6.1-2 thresholds exactly.
- Status pill render for `failed_permanently` per §5.5 · already wired (line 261-285); spot-check copy.

### 3.2 Phase 02-05 locked-row tier-aware copy

**Status:** Locked rows render with static copy `"Unlocks when Starter tier is active"` (line 306). This is correct for Free users. For Starter+ users, the copy is wrong · Starter is already active and the rows still don't unlock (because Phase 02 agents ship in Chapter 4).

**What ships in 9A:**
- New helper `lockedPhaseCopy(card, userTier)` that returns tier-aware text:
  - `userTier === 'free'`: `"Unlocks when Starter tier is active"` (existing copy; the upsell narrative)
  - `userTier === 'starter' | 'pro' | 'agency' | 'enterprise'`: `"Available in Chapter 4 · Brand Creation phase"` (or per-phase variant for Phase 03/04/05 · `"Available in Chapter ${5,6,7}"`)
- Visual treatment unchanged · the `phase-section_locked` styling persists for both copy variants.
- The `Phase 02 Brand Creation` agent list (Logo Direction, Logo Evaluation, Voice Guide) stays visible in both states · the user sees what's coming.

### 3.3 Two-button rerun semantics · verification only

**Status:** Fully shipped in step 7B (PR #102, verified PR #103, 2/2 PASS). `rerunCtas()` at line 197-223 renders primary ("Rerun · current QBP") + secondary ("Rerun · original QBP"). Secondary correctly disables for Chapter 1 legacy artifacts (`hasSnapshot=false`). Routes through `/api/agents/rerun`.

**What ships in 9B:** verification only. No code change unless the audit reveals drift. Re-run `tests/chapter-02/rerun-feedback-arg.mjs` against the current main as a regression gate before declaring step 9 complete.

### 3.4 Realtime subscription extension to Phase view

**What ships in 9C:**

The bell currently owns the Realtime subscription manager. Step 9 promotes this into a shared module so Phase view can hook into the same channel without opening a second Supabase Realtime client.

**Module split:**
- `js/qb-realtime-manager.js` (new) · single Supabase Realtime client lifecycle: mount, set-auth, subscribe to `notifications` filtered by user_id, SUBSCRIBED grace timeout, flipToPoll, reconnect. Exposes `onNotification(cb)` API so multiple consumers (bell, Phase view) register handlers.
- `js/qb-notification-bell.js` · refactor to use `qb-realtime-manager.js`. Behavioral equivalence; no functional change.
- `js/qb-agents-console.js` · subscribes to the manager. On notification arrival, calls `refetchConsole()` which re-fetches `/api/agents/console` and re-paints the Phase view in-place (preserves view-tab state, scroll position).

**State machine reuse:**
- On manager `state='realtime'`: bell + Phase view both react to notification events; no recurring poll.
- On manager `state='poll'` (SUBSCRIBED timeout or CHANNEL_ERROR): Phase view also polls `/api/agents/console` at 30 s intervals (matching bell's poll cadence).
- On reconnect: both return to event-driven mode.

**Notification scope reminder (per §7.0):** notifications fire on `dispatch_failed` and `chain_ready` only. Lock-foundation and manual-rerun deliveries do NOT fire notifications · those state transitions happen in seconds and are observed via the next refresh window (whether via Realtime notification triggering a refresh, or via poll-fallback). This is acceptable because in-flight Phase 01 deliveries complete in ~6 s each. Future step may add a `kind='artifact_delivered'` notification for the lock + manual-rerun case if user feedback surfaces a gap; out of scope for step 9.

### 3.5 Empty state for users with no Phase 01 deliveries yet

**Status:** Empty state exists at the run-history view (line 591-595). Phase view itself does not have a dedicated empty state · a brand-new user with foundation locked but no agent delivered yet sees four Phase 01 rows with `latest_run=null, latest_artifact=null, health.dot='neutral'`, plus the locked Phase 02-05 cards. This is correct · the rows ARE the empty state; they communicate "your agents are queued / running".

**What ships in 9A:** verify the `health.dot='neutral'` path renders correctly. Cross-check empty `latest_run.completed_at` falls through to `"No runs yet"` copy (line 246). No new empty-state surface needed for Phase view.

---

## 4. Sub-PR breakdown

| Sub-PR | Topic |
| --- | --- |
| 9A | Tier-aware locked-row copy in `lockedPhaseCard()` + `/api/agents/console` payload audit (verify `user.tier` already flows through) + Phase view conformance audit (§6.2 + §6.6.3 thresholds + empty state) |
| 9B | Two-button rerun + Chapter 1 legacy verification harness re-run · no code change unless audit reveals drift |
| 9C | Realtime manager extraction (`js/qb-realtime-manager.js`) + bell refactor (behavioral parity) + Phase view subscription |
| 9D | Verification harness · `tests/chapter-02/phase-view.mjs` · five gates (render, locked rows tier-aware, rerun semantics, Realtime delivery update, empty state) |
| 9E | Step 9 closure report |

Each sub-PR gates on the prior. Per autonomous-chain posture, sub-PRs merge autonomously after their gates pass.

---

## 5. Acceptance criteria

Per §13.10 + §6 + §6.4 + §6.6:

1. **Phase view renders correctly for the locked Foundation state.** Four Phase 01 agents render with display_name, model badge, retry_budget, status pill, last-run timestamp, rolling-average badges (when applicable), aggregate health dot. Sections match §6.2 ordering.

2. **Locked rows are tier-aware.** Free user sees `"Unlocks when Starter tier is active"` across all four Phase 02-05 sections. Starter+ user sees `"Available in Chapter ${N}"` where N is 4 (Phase 02), 5 (Phase 03), 6 (Phase 04), 7 (Phase 05). Agent list under the copy renders in both states.

3. **Two-button rerun fires correctly.** Primary "Rerun · current QBP" produces a new artifact with `qbp_source='current'`. Secondary "Rerun · original QBP" produces a new artifact with `qbp_source='original'`. Secondary is disabled with tooltip `"No QBP snapshot available · this is a Chapter 1 legacy artifact."` for legacy artifacts.

4. **Realtime extension delivers live updates.** A test user triggers a manual rerun. The Phase view, while open, refreshes within 5 seconds of the chain delivery firing the `chain_ready` notification (Realtime path). Falls back to 30 s poll when Realtime channel is unavailable (verified by deterministic config-disable per step 7C testing-methodology pattern).

5. **No regression on existing surfaces.** Run history view still renders with replay modal · bell still renders + receives notifications · rerun-conformance 10/10 harness still passes · chain-orchestration 5/5 harness still passes.

---

## 6. Out of scope

Explicit:

- Run history view enhancements · already shipped + verified through step 7. Step 9 leaves untouched.
- Replay modal enhancements · already shipped. Step 9 leaves untouched.
- Archive UI tree-view · deferred to step 11 or 12.
- Foundation `?upgrade=success` banner (step 13).
- `/api/agents/dispatch.js` retirement (step 14).
- New notification kinds (e.g., `artifact_delivered` for lock + manual-rerun deliveries) · forward note, not step-9 scope.
- DAG view of dependency graph · master spec §14.3 explicit out-of-scope for Chapter 2.
- Notification preferences UI · master spec §14.4 explicit out-of-scope for Chapter 2.
- Pagination in any surface · master spec call #6 moot.

---

## 7. Forward references (renumbered per sequencing cascade)

- **Step 10** Run history view + replay panel hardening (per master spec §13.11). Most work shipped in steps 5+7; step 10 verifies + closes any conformance gaps.
- **Step 11 or 12** Archive UI tree-view rendering · deferred from step 9 sequencing override. Will exploit `chain_id` primitive from step 8.
- **Step 13** Foundation `?upgrade=success` banner.
- **Step 14** `/api/agents/dispatch.js` retirement.
- **Step 15** End-to-end QA pass.
- **Step 16** Final sign-off + `CHAPTER_02_COMPLETION.md`.

---

## 8. Captures for the step 9 closure report

Carryforward + new (per Nizzar directive):

- **Framework defect-rate tracking continues.** Aggregate latent bugs across chapter 2. If chapter total approaches 12+ surgical fixes, escalate hardening pass to "before chapter 3 opens" instead of "first step of chapter 3" (currently sits at 8/12 through step 8).
- **Tooling discipline as permanent forward note.** Comet stays operator-only · no code, no PRs, no merges. Signal blockers, do not improvise.
- **Surface-order discipline as new pattern.** When forward notes accumulate suggesting a future surface, validate the surface against weakest-persona value-order before letting the forward note dictate sequencing. The step 9 archive-vs-Phase-view adjudication is the canonical example.

---

## 9. End of spec

Hold-open PR #120 stays on hold-gate until explicit release. Per autonomous-chain posture, the chain resumes on hold-release with sub-PR 9A.
