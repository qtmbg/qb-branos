# Chapter 3 · Step 1 spec outline · Hardening pass on the steps 6-8 surgical-fix cluster

Status: draft outline. Awaiting Nizzar adjudication on the six open calls in §5 below. Full spec follows on the same branch once the outline lands.

Source authority: `QB_BUILD_STATE_AND_ROADMAP_v1.md` reconciliation note (Chapter 3 = Asset Layer, scoped to minimum) + `CHAPTER_02_COMPLETION.md` §3 (framework defect-rate ledger) + §7 (open items handed to chapter 3, "small + focused, NOT a major sweep").

Branch: `chapter-3/step-1-outline`. PR opens on a hold gate. Do not merge until adjudication.

**Step 1 is hardening, not building.** No new asset-layer surfaces ship in step 1. The asset-layer work (Supabase Storage bucket, upload UI, file browser, agent file-ref read path) starts at step 2.

---

## 1. Bundle framing

Chapter 2 closed with 8 product surgical fixes total, all concentrated in steps 6-8, followed by 6 consecutive zero-fix steps through gating (step 13) and terminal closure (step 14). The clean streak is meaningful evidence that the chapter shipped stable. The 8 fixes themselves were addressed in their PRs; what was NOT done is a systematic look across the cluster to ask: were these eight incidents, or were they three or four classes of bug surfacing eight times? Where a class exists, the invariant should be lifted from PR history into either a documented pattern, an enforced gate, or both, before chapter 3 surfaces start writing to the same seams.

The hardening pass is the smallest legible reset before asset-layer work begins. It costs one focused step. It buys a verified-clean foundation under the new uploads + file-routing code that chapter 3 will lay on top.

This is documentation + verification work, possibly with new assertion code. No product code is touched in step 1. Any class-of-bug finding that would require a product code change becomes its own follow-up step (1-bis or step 2's blocker), surfaced from the report.

Three sources of work:

| Item | Source | Action |
| --- | --- | --- |
| 8 surgical fixes (per-PR walk) | `CHAPTER_02_COMPLETION.md` §3 | Audit each · root cause · class-of-bug or one-off · gate-coverage state |
| Pattern lift (where class-of-bug) | This step's audit findings | Promote to `docs/patterns/*.md` or as a section on an existing pattern file · open call #2 |
| Regression gate re-fire | Existing 14-harness suite | Targeted or full, per open call #3 · attach `.last-run.json` summaries to PR body |

Prerequisites met:
- Chapter 2 closed (PR #149 merged 2026-05-21).
- Roadmap pinned (PR #150 merged 2026-05-21 · this branch's parent).
- All 14 harnesses present at `tests/chapter-02/*.mjs` and last-known PASS at chapter close.
- The 8 fix PRs are mergeable + grep-able by number (#86, #100, #105, #107, #115, #116, #117a, #117b).

---

## 2. The cluster · the 8 surgical fixes (input data for the audit)

Per `CHAPTER_02_COMPLETION.md` §3, verbatim:

| Step | PR | Brief |
|---|---|---|
| 6 | #86 | `context.waitUntil` Edge bug |
| 7 | #100 | `max(version)+1` (artifact version race) |
| 7 | #105 | JWT `sub` decode |
| 7 | #107 | SUBSCRIBED grace timeout (Realtime subscribe race) |
| 8 | #115 | Agent registry race |
| 8 | #116 | Schema compliance |
| 8 | #117a | Allowlist |
| 8 | #117b | Lock-trigger filter |

Three of the eight read as race-condition shapes at first glance: #100 (version race), #107 (subscribe race), #115 (registry race). Two read as discipline failures that the harness-seed schema pattern was later extracted from: #116 (schema compliance). The remaining three (#86 Edge runtime semantics, #105 JWT decode, #117a allowlist, #117b lock-trigger filter) read as one-off correctness fixes at the seam.

The audit work in step 1 is to verify or correct that first-glance classification, then act on it per the open calls.

---

## 3. What the hardening report must contain (the durable record)

Regardless of open-call decisions, the report includes:

1. **Cluster summary** · the 8 fixes table verbatim from above + the chapter close's "5-step clean streak" framing + the "small + focused" recommendation per `CHAPTER_02_COMPLETION.md` §7.
2. **Per-fix entries** · one block per PR. For each: root-cause one-liner · seam (the file or interface where the fix landed) · class-of-bug verdict (with reasoning) · existing gate coverage (which harness asserts the invariant today, if any) · gate gap (where coverage is absent or partial).
3. **Class-of-bug ledger** · the verdicts rolled up. If three or four classes emerge, name each, list the PRs that fell under it, name the invariant.
4. **Pattern-lift decisions** · per call #2 default: which class-of-bug verdicts produce a `docs/patterns/*.md` file or section. Per override: none.
5. **Regression re-fire results** · per call #3 default: 7 targeted harness JSON summaries (PASS counts + last-run timestamps). Per override: full 14 + the 13-gate E2E.
6. **Forward references** · any class-of-bug verdict that would require a product code change becomes its own forward-referenced step (step 1-bis or step 2 blocker), named explicitly. Do NOT patch in step 1.
7. **Closeout statement** · "Step 1 closes" + Signed-off-by line + chapter-3 step-2 handoff.

---

## 4. Sub-PR breakdown

Step 1 size depends on calls #2, #4, #5, #6. The minimum shape is two sub-PRs:

| Sub-PR | Scope |
|---|---|
| 1A | Hardening report at `chapter-03/step-1-hardening-report.md` · per-fix entries · class-of-bug ledger · pattern-lift decisions · forward references named |
| 1Z | Step 1 closure · final sign-off · step-2 handoff |

If calls #2/#4/#5 land on override, the shape expands to:

| Sub-PR | Scope |
|---|---|
| 1A | Hardening report |
| 1B | Pattern lift · new files at `docs/patterns/*.md` or sections appended to existing pattern files (call #2 override) |
| 1C | New invariant assertions · new harness files at `tests/chapter-03/invariants-*.mjs` (call #4 override) |
| 1D | Proactive sweep findings memo (call #5 override) · stays in `chapter-03/step-1-sweep-notes.md` · zero product code patched |
| 1Z | Step 1 closure |

The cycle collapses to 1A + 1Z if all overrides decline. The expanded shape mirrors chapter 2's terminal step shape (14A / 14B / 14Z).

---

## 5. Six open calls for Nizzar adjudication

1. **Cluster scope · per-PR vs per-surface.** Default: per-PR audit. Walk the 8 PRs in order; surface root cause, seam, and gate state for each. The cluster is exactly 8 incidents. Override: per-surface audit. Pull every surface touched by steps 6-8 (`api/lock-foundation.js`, `api/agents/run.js`, `agents/contract.js`, `api/artifacts/[id]/regenerate.js`, `api/cron/reaper.js`, `js/qb-notification-bell.js`, `api/_lib/chain-trigger.js`, `agents.html`, `archive.html`) and read each end-to-end for race patterns and seam fragility, whether or not a fix shipped on it. Default favors precision and finite scope. Override favors broader signal at higher reading cost.

2. **Pattern lift · class-of-bug verdicts promote to `docs/patterns/`.** Default: per-fix, classify as `class-of-bug` or `one-off`. Class-of-bug findings get added to `docs/patterns/` either as new files or as appended sections on existing pattern docs. One-off findings get a brief mention in the report and nothing more. Best estimate: 2-3 of the 8 will land class-of-bug. Override: no pattern lift. The 6-step clean streak proves the 8 fixes held without further documentation. Treat all 8 as instances; the chapter-2 closure record at `CHAPTER_02_COMPLETION.md` §3 stands as the durable trace. Default favors lifting invariants from incident history into reachable docs.

3. **Regression-gate posture · targeted re-fire vs full-suite re-fire.** Default: targeted re-fire. Fire the 7 harnesses whose surfaces overlap the 8 PRs: `lock-foundation-10x`, `regenerate-10x`, `reaper-gates`, `bell-realtime`, `rerun-conformance`, `rerun-feedback-arg`, `chain-orchestration`. Half the suite. Faster signal, focused on the cluster. Override: full-suite re-fire. All 14 harnesses + the 13-gate E2E. Strongest "foundation still green" signal at the cost of harness runtime and any local-environment maintenance (Stripe mock, `CHAIN_TEST_AGENT=1` if the E2E rides along). Default favors cost-matched signal to the audit scope.

4. **New invariant assertions.** Default: no new assertions. The existing suite held through the chapter close (13/13 E2E PASS + 6-step clean streak); if sufficient then, sufficient at step-1 hardening. Override: for each class-of-bug verdict from call #2, write one targeted invariant assertion as a new harness file at `tests/chapter-03/invariants-*.mjs`. Candidate invariants based on the first-glance classification: "no two `agent_runs` rows can race-write the same `(artifact_id, version)` tuple under concurrent lock-foundation calls"; "no Realtime consumer fires the SUBSCRIBED-dependent code path before SUBSCRIBED or its grace timeout"; "no chain trigger dispatches against an agent slug missing from the registry at dispatch time." Lifts invariants from prose into enforced gates. Default favors not adding test surface that the existing suite already covers indirectly.

5. **Race-condition proactive sweep.** Default: reactive only. The three race fixes (#100 version, #107 subscribe, #115 registry) are addressed in their PRs; no proactive sweep of adjacent code for similar patterns. Override: time-boxed proactive sweep (60-90 minute budget) of `api/lock-foundation.js`, `api/agents/run.js`, `api/_lib/chain-trigger.js`, `js/qb-realtime-manager.js`, `api/cron/reaper.js` for the three race shapes. Findings surface in `chapter-03/step-1-sweep-notes.md`. No patches in step 1. Any non-trivial finding becomes a named forward-referenced step. Default favors not opening unbounded audit work mid-hardening.

6. **Step shape and output.** Default: report-only. `chapter-03/step-1-hardening-report.md` + targeted re-fire results (call #3 default). Per-fix entries with root cause + verdict + gate coverage. Zero product code touched. Single sub-PR (1A) + closure (1Z). Step 1 closes with the report merged + harness `.last-run.json` summaries pasted into the PR body. Override: report + bundled deliverables. If calls #2/#4/#5 land on override, the corresponding outputs (new pattern files, new assertion harnesses, sweep findings memo) ride along in the same step under the 1A/1B/1C/1D/1Z sub-PR shape from §4. Larger step, more atomic output. Default favors the chapter-close recommendation: "small + focused, NOT a major sweep."

---

## 6. Out of scope

Explicit:

- Patching any class-of-bug finding (forward-referenced to its own step).
- Asset-layer build (Supabase Storage bucket, upload UI, file browser, agent file-ref read) · step 2 onward.
- Phase 02 agents · chapter 4 territory.
- Synthetic `chain_id` backfill migration · separate chapter-3 step per `CHAPTER_02_COMPLETION.md` §7.
- Stripe pre-launch seam (PL-001) and Supabase Pro upgrade (PL-002) · pre-launch register, not step 1.
- WCAG accessibility audit · post-launch deferred.
- Pricing reconciliation (roadmap states $97/$247/$1497; auto-loaded master instruction states $97/$297/$997; out of scope per the PR #150 reconciliation note).

---

## 7. Forward references

Step 2 (chapter 3) starts on a verified-clean foundation. Any class-of-bug finding from this step that requires a product code change is surfaced as a named blocker for step 2 (or as its own step 1-bis between 1Z and step 2). Examples of the shape such a forward reference would take:

- "Step 1-bis · enforce `agent_runs (artifact_id, version)` uniqueness at DB level" (if call #2 classifies #100 as class-of-bug AND the existing partial index does not already cover it).
- "Step 2 blocker · audit any chapter-3 Edge function spawning child fetches for `context.waitUntil` correctness" (if #86 elevates to a discipline).

The forward reference is named in the report. Step 1 does NOT execute it.

---

## 8. End of outline

Hold-open PR opens on this branch. Awaiting adjudication on §5 open calls. Full spec follows in a second commit on the same branch once the calls are adjudicated.

Step 1 is the first chapter-3 step. After 1Z merges, chapter 3 moves to step 2 (asset-layer build, scoped to minimum per the roadmap reconciliation note).
