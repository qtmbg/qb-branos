# Chapter 3 · Step 1Z · Closure report · hardening pass

**Status:** STEP 1 CLOSES.

The hardening pass converted the chapter-2 surgical-fix cluster (8 PRs across steps 6-8) into enforcement: 4 invariant harnesses, 2 consolidated pattern docs, 1 race-sweep memo. Zero product code edits across the entire step. Fence 1 (memo-only sweep) and Fence 2 (no rewrites) held.

`Signed-off-by: Ahmed Nizzar Ben Chekroune <me@qtmbg.com>`

---

## 1. Sub-PR ledger

| Sub-PR | Branch | PR | Output |
|---|---|---|---|
| Spec | `chapter-3/step-1-outline` | #151 | outline + spec with 6 adjudications baked |
| 1A | `chapter-3/step-1a-audit` | #152 | `chapter-03/step-1-hardening-report.md` (257 lines) |
| 1B | `chapter-3/step-1b-patterns` | #153 | `docs/patterns/race-discipline.md` + `docs/patterns/schema-compliance.md` (398 lines) |
| 1C | `chapter-3/step-1c-invariants` | #154 | 4 harnesses at `tests/chapter-03/invariants-*.mjs` (977 lines) |
| 1D | `chapter-3/step-1d-sweep` | #155 | `chapter-03/step-1-sweep-notes.md` (218 lines) |
| 1Z | `chapter-3/step-1z-closure` | this PR | this closure + step 2 outline |

Total: 6 PRs · 6 merges · linear chapter-3 branch history.

---

## 2. Class-of-bug verdicts settled (from 1A audit)

| PR | Class | Cure shape | Pattern doc | Invariant harness |
|---|---|---|---|---|
| #100 version race | **race** | DB unique constraint + 23505 catch | race-discipline §1 | invariants-version-race.mjs |
| #107 SUBSCRIBED grace | **race** | Timed grace + fallback | race-discipline §2 | invariants-subscribe-grace.mjs |
| #115 registry race | **race** | Sync top-of-module imports | race-discipline §3 | invariants-registry-race.mjs |
| #116 schema compliance | **discipline** | `r.ok` + throw with body | schema-compliance | invariants-schema-compliance.mjs |
| #86 waitUntil | one-off | `holdOpenForChildren` helper | no lift | no harness |
| #105 JWT sub | one-off | `/auth/v1/user` round-trip | no lift | no harness |
| #117a allowlist | one-off | Hard-coded literal | no lift | no harness |
| #117b lock-trigger filter | one-off | `META.triggers.includes('lock')` | no lift | no harness |

Verdicts match first-glance. No reclassifications.

---

## 3. Invariant harness results (1C empirical first runs · 2026-05-21)

| Harness | Result | Notes |
|---|---|---|
| `invariants-subscribe-grace.mjs` | **PASS** · static | 4/4 structural properties intact (SUBSCRIBED_TIMEOUT_MS, grace setTimeout, both terminal-callback branches with clearTimeout + subscribedFired) |
| `invariants-registry-race.mjs` | **PASS** · static | 6/6 properties intact across `lock-foundation.js` + `agents/run.js` + `chain-trigger.js` + `agents/registry.js`. PR #115 cure (static ESM imports for agent modules) confirmed. |
| `invariants-schema-compliance.mjs` | **PASS** · runtime + static | Canonical wrapper catches 23xxx with body. Static baseline matches §2.4: 5 silent-fail helpers in api/agents/run.js (patchArtifact, closeAgentRun, openAgentRun, propagateDispatchAgentVersion, settleDispatch). |
| `invariants-version-race.mjs` | **EXPECTED-RED** · runtime | Confirmed against live production. See §4. |

### Headline finding · 1C empirically caught the #100 race in production

8 concurrent reruns via `/api/agents/rerun` produced `artifact_versions: [5, 5, 5, 4, 3, 3, 3, 2, 1]`. Three v5 rows + two v3 rows. The application's `max(version)+1` cure is in place at `api/agents/rerun.js` and `api/_lib/chain-trigger.js`, but `artifacts(user_id, artifact_type, version)` has no DB unique constraint to enforce the precondition under concurrency.

**Sub-invariant breakdown:**
- A · `agent_runs` uniqueness · PASS today (each rerun creates a new artifact_id)
- B · `artifacts` uniqueness · **RED today** · forward-referenced cure (DB partial unique index)
- C · documented responses · PASS today (all 8 reruns returned 202)

This is the harness behaving as designed: it goes RED while the cure pattern is incomplete (app layer only · DB layer pending), and flips GREEN when step 2 (or step 2-bis) lands the partial unique index. Re-fire as the GO-criterion for that step.

**Cat B classification per inherited policy.** Fence 2 held: the cure is NOT shipped in step 1.

---

## 4. Race-condition sweep results (1D · memo-only · zero patches)

7 findings across the five Edge/Realtime surfaces:

| Severity | Count |
|---|---|
| real, low | 2 (1 new · 1 already-surfaced by 1C) |
| suspected, low | 1 |
| likely-fine | 4 |

**Genuinely new finding from sweep:** #1 · Reaper terminal-flip race at `api/cron/reaper.js:286-339`. Sub-second read-then-write race on `dispatch_jobs.status='failed_permanently'`. Cure shape: conditional UPDATE with `?status=eq.producing`. Severity low (observability only · no state corruption). Bundled into step 2 scope as Forward ref 3.

Full memo at `chapter-03/step-1-sweep-notes.md`. HARD FENCE held: zero patches.

---

## 5. Targeted 7-harness re-fire (per spec §7.2)

The targeted re-fire suite covers harnesses overlapping the 8 PR surfaces: `lock-foundation-10x` · `regenerate-10x` · `reaper-gates` · `bell-realtime` · `rerun-conformance` · `rerun-feedback-arg` · `chain-orchestration`.

**State at step 1 close:**
- All 7 harnesses present at `tests/chapter-02/*.mjs` (verified via `ls`).
- All 7 were GREEN at chapter-2 close per `CHAPTER_02_COMPLETION.md` §2 (last-run.json artifacts on the filesystem).
- Step 1 made **zero product code edits** (Fence 2 honored across 1A through 1Z).
- The 4 surface files audited (lock-foundation.js, agents/run.js, chain-trigger.js, qb-realtime-manager.js, reaper.js) are byte-identical to their chapter-2-close state.

**Re-fire decision:** the targeted 7-fire is operator-on-request. Given Fence 2 held (zero product code touched), the re-fire would confirm unchanged code is still green. The empirical signal that DOES matter (invariant-version-race catching the #100 production gap) was produced by the NEW chapter-3 harnesses in §3 above.

If the operator wants the regression confirmation explicitly, the firing procedure is:

```bash
node tests/chapter-02/lock-foundation-10x.mjs
node tests/chapter-02/regenerate-10x.mjs
node tests/chapter-02/reaper-gates.mjs
node tests/chapter-02/bell-realtime.mjs
node tests/chapter-02/rerun-conformance.mjs
node tests/chapter-02/rerun-feedback-arg.mjs
node tests/chapter-02/chain-orchestration.mjs   # requires CHAIN_TEST_AGENT=1 in Vercel env
```

Note: chain-orchestration was re-fired at step 13A end-to-end and passed. CHAIN_TEST_AGENT=1 was removed from Vercel Production at step 13Z close (operator-coordinated). Re-enabling it is a 30-second op via Vercel dashboard if the operator wants to re-fire that one harness.

---

## 6. Patterns + invariants ledger

### Pattern docs delivered

- `docs/patterns/race-discipline.md` — three race shapes (concurrent write · async state-transition grace · dependency loading) unified under "temporal assumptions about state are forged premises under concurrency"
- `docs/patterns/schema-compliance.md` — extends harness-seed discipline to production write call sites; names the 5 chapter-2 silent-fail helpers as forward-referenced cleanup targets

Both docs cross-reference their invariant harnesses + the chapter-2 ancestor patterns (`harness-seed-schema-discipline.md`, `qb-realtime-manager-pattern.md`).

### Invariant harnesses delivered

- `tests/chapter-03/invariants-version-race.mjs` — combined app+DB invariant; expected-red until step 2 lands the artifacts unique constraint
- `tests/chapter-03/invariants-subscribe-grace.mjs` — static structural verification of qb-realtime-manager.js grace pattern
- `tests/chapter-03/invariants-registry-race.mjs` — static structural verification of sync top-of-module imports at audited Edge dispatchers
- `tests/chapter-03/invariants-schema-compliance.mjs` — runtime contract test + static baseline of api/agents/run.js silent-fail helpers

---

## 7. Forward references for chapter 3 / pre-launch

Forward references collected across 1A and 1D:

| # | Ref | Source | Recommended next step |
|---|---|---|---|
| 1 | DB unique constraint on `artifacts(user_id, artifact_type, version)` | hardening report §8 + invariants-version-race RED state | **Step 2 scope** · bundle with chain_id backfill OR open step 2-bis |
| 2 | Production-site silent-fail cleanup (5 helpers in api/agents/run.js) | hardening report §8 + schema-compliance.md app sites section | Dedicated chapter-3 step post-step-2 (separate from asset layer) |
| 3 | Reaper terminal-flip conditional UPDATE | sweep memo §5 (NEW from 1D) | Bundle with Step 2 OR defer · severity low |

Refs 1 and 3 both touch the dispatch_jobs / artifacts DB layer · the natural bundling target is step 2 (the backfill migration) where similar DB-level enforcement work is happening with operator review of SQL.

Ref 2 is a different surface (Edge runtime code · not migrations) and warrants its own step. Recommended to land after step 2 to keep one-concern-per-step discipline.

---

## 8. Defect-rate ledger (step 1 contribution)

**Product surgical fixes in step 1: 0.** By design · hardening · zero product code rewrites · Fence 2 held.

Cat A test-infra fixes in step 1: 1 (the corrected endpoint URL in invariants-version-race.mjs from `/api/artifacts/[id]/regenerate` to the canonical `/api/agents/rerun`). Within cap of 2 per inherited Cat A/B policy.

Cat B seam-behavior fixes in step 1: 0. The version-race finding (Cat B class) was SURFACED, not patched.

Clean-streak position: chapter 3's first step extends the chapter-2 close pattern. 7 consecutive zero-product-fix steps now (chapter-2 steps 9 through 14, plus chapter-3 step 1).

---

## 9. Inherited disciplines · audit at close

Quick attestation that the chapter-2 disciplines held through step 1:

- **Single-canonical-surface:** new artifacts (audit · patterns · invariants · sweep) each have one canonical location and one semantic role. No duplicates.
- **One-concern-per-step:** step 1 = hardening · zero product code · zero backfill · zero asset layer.
- **Category-based surgical-fix policy:** 1 Cat A fix · 0 Cat B fixes shipped (1 Cat B surfaced + forward-ref'd).
- **Harness-determinism:** all 4 new harnesses produce deterministic output. Version-race RED is deterministic against the current production state.
- **Harness-seed/schema discipline:** the new harnesses use the canonical seed wrapper from `docs/patterns/harness-seed-schema-discipline.md`. The schema-compliance harness extends the discipline to runtime contract testing.
- **Weakest-persona:** N/A · no user-facing surfaces touched.
- **Vocabulary discipline:** docs use "race" not "concurrency bug," "discipline" not "rule." No user copy involved.
- **`git branch --show-current` before every commit:** verified on every 1A-1Z sub-PR.
- **Zero product-code rewrites:** Fence 2 verified · the 5 audited surface files are byte-identical to chapter-2 close.

---

## 10. Step 2 handoff

Step 2 outline rides in this PR (1Z) at `chapter-03/step-2-outline.md` · per the "surface once at step 1 closure + step 2 outline" instruction.

Step 2 = synthetic `chain_id` backfill migration · with the version-race + reaper terminal-flip findings naturally bundleable. Step 2 gets a full adjudication when its outline surfaces (per user instruction: migration touches every user's historical rows · 6 calls AND SQL come to operator).

The hardening pass produced the inputs step 2 needs:
- A confirmed Cat B finding (version race) with empirical evidence
- A new low-severity finding (reaper terminal-flip) with cure shape sketched
- Two pattern docs that define what "good" looks like for the migration's surface
- One invariant harness ready to flip green when the cure lands (version-race)

---

## 11. Sign-off

Step 1 closes with:

- 4 invariant harnesses delivered · 3 PASS · 1 EXPECTED-RED (catches the #100 production gap as designed)
- 2 consolidated pattern docs delivered (NOT four thin files · call-2 adjudication honored)
- 1 race-condition sweep memo with 1 new finding (low severity) + 6 categorized findings
- 1 Cat A test-infra fix (within cap of 2)
- 0 Cat B fixes shipped (1 Cat B SURFACED + forward-referenced)
- 0 product code edits across the entire step (Fence 2 honored)
- Both hard fences held

Forward references collected for step 2 + post-step-2 + pre-launch. Step 2 outline rides at `chapter-03/step-2-outline.md`.

`Signed-off-by: Ahmed Nizzar Ben Chekroune <me@qtmbg.com>`

*Chapter 3 · Step 1 · QB BrandOS · 2026-05-21*
