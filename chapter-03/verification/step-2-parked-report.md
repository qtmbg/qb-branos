# Chapter 3 · Step 2 · PARKED · awaiting PL-002 Pro upgrade

**Status:** PARKED on 2026-05-21. Step 2 is not closed; it is suspended at the gate before 2C (the mandatory branch dry-run per Call 5 override). Operator deferred the Supabase Pro upgrade (PL-002) decision to a later session. Step 2 resumes when Pro lands on the qb-branos project (`yushbxjwfhuokaezoioe`).

`Park decision: operator · 2026-05-21`

---

## 1. What is shipped (intact on main)

| Artifact | PR | Hash | State |
|---|---|---|---|
| Step 2 spec · 7 adjudications baked | #157 | merged | landed on main |
| Migration 018 SQL | #158 | merged | committed, NOT applied to prod |
| Repro gate harness · synthetic | #158 | merged | committed, ready for branch dry-run |
| Repro gate harness · branch audit | #158 | merged | committed, ready for branch dry-run |

The spec, SQL, and harnesses are all reviewed and merged. They are ready to fire the moment the branch dry-run prerequisite is satisfied.

## 2. The blocker

**Call 5 (override · adjudicated 2026-05-21) made branch dry-run mandatory before any prod touch.** The Supabase MCP rejects `create_branch` on `yushbxjwfhuokaezoioe` with `PaymentRequiredException: Branching is supported only on the Pro plan or above`.

- Current plan on qb-branos project: free
- Pro plan baseline: ~$25/month (in addition to the $0.01344/hour per-branch fee)
- PL-002 (Supabase Pro upgrade) was deferred at chapter-2 close to pre-launch · per `chapter-02/pre-launch-checklist.md`

Resolution paths explored in chat (2026-05-21):
- Wait for propagation after a verified upgrade: 4.5 min wait, no propagation observed
- Pivot to held-transaction dry-run on prod: rejected (would weaken Call 5)
- Skip live verification: rejected (would weaken Call 5)
- Defer step 2 until PL-002 lands: **chosen**

## 3. What remains EXPECTED-RED until step 2 resumes

- `tests/chapter-03/invariants-version-race.mjs` · still goes RED on the artifacts uniqueness sub-invariant (sub-invariant B). The application-level `max(version)+1` cure exists; the DB constraint that closes the race does not yet land. This was the headline finding from step 1.
- Production state remains: `artifacts(user_id, artifact_type, version)` has no DB unique constraint. Concurrent reruns within milliseconds can still produce duplicate-version rows. **Current production count of such dupes: zero** (confirmed via read-only SELECT during 2C attempt). The race shape exists but has not fired against real users.
- The "Earlier work" archive section: unchanged. All 16 chapter-2-era dispatches still have `chain_id IS NULL`; their artifacts render via legacy path. The 20 truly-legacy artifacts (`dispatch_id IS NULL`) stay in "Earlier work" indefinitely, which is the Call 2b adjudication.

## 4. Production state snapshot (read-only · captured during 2C attempt)

| Counter | Value | Notes |
|---|---|---|
| `dispatch_jobs` total | 16 | All have `chain_id IS NULL` |
| `artifacts` total | 80 | |
| `artifacts` with `dispatch_id IS NULL` | 20 | Truly-legacy "Earlier work" rows |
| `artifacts` with dispatch_id set | 60 | Chapter-2-era rows |
| Duplicate `(user_id, artifact_type, version)` tuples | 0 | Cascade cleanup worked; no real-user races have fired |

The migration on the current prod state is small in scope: 16 dispatch_jobs backfills + 0 renumbers + 1 index addition. The transaction would complete in <1 second.

## 5. What unparks step 2

The operator upgrades the qb-branos Supabase project (`yushbxjwfhuokaezoioe`) to the Pro tier. Once branching is available on this project, step 2 resumes from 2C exactly as adjudicated:

1. Create branch via MCP `create_branch`
2. Run `repro-gate-018-branch-audit.mjs setup` (capture clone state)
3. Run `repro-gate-018-synthetic.mjs setup` (inject [5,5,5,...] pattern)
4. Apply migration 018 to the branch via MCP
5. Run `repro-gate-018-synthetic.mjs verify` (assert §2.2 trace)
6. Run `repro-gate-018-branch-audit.mjs verify` (assert invariants)
7. Commit dry-run report
8. HOLD for operator prod-apply go (per Call 5)
9. After go: prod apply + rerun catch + harness re-fire (2D)
10. Closure + step 3 outline (2Z)

No re-adjudication needed when step 2 resumes. The seven adjudications stand.

## 6. Activity ledger · step 2 to-date

| Date | Activity | Result |
|---|---|---|
| 2026-05-21 | Step 2 outline (PR #156 1Z carry-along) | Six open calls surfaced for adjudication |
| 2026-05-21 | Step 2 adjudications (operator) | All seven calls baked · SQL approved · renumber strategy + rerun catch required |
| 2026-05-21 | 2A spec (PR #157) | Merged |
| 2026-05-21 | 2B migration + harnesses (PR #158) | Merged · zero touches to prod |
| 2026-05-21 | 2C branch dry-run attempt | BLOCKED on Pro plan requirement |
| 2026-05-21 | Park decision (operator) | Step 2 suspended awaiting PL-002 |

## 7. Forward references carried into the park

The forward references from step 1 (`chapter-03/step-1-hardening-report.md` §8) remain in force:

- Forward ref 1 · DB unique constraint on `artifacts(user_id, artifact_type, version)` · embedded in migration 018 · ships when step 2 resumes
- Forward ref 2 · Production-site silent-fail cleanup (5 helpers in `api/agents/run.js`) · separate post-step-2 step · unaffected by the park
- Forward ref 3 · Reaper terminal-flip conditional UPDATE · its own small step after step 2 · unaffected by the park

## 8. Inherited disciplines · audit at park

- Fence 1 (memo-only on the step 1 sweep): held through step 2 work to date.
- Fence 2 (no product-code rewrites): held through 2A and 2B. The rerun 23505 catch is queued for 2D; not yet shipped.
- Branch hygiene: `git branch --show-current` verified before every commit through 2A, 2B, and this parked report.
- Three-layer SQL review discipline: the third layer (branch dry-run GREEN) is precisely what the park preserves. No prod-touching SQL has executed.

## 9. Sign-off (park)

Step 2 is PARKED. The seven adjudications stand. The artifacts (spec · SQL · harnesses) are live on main. Production is untouched. The version-race invariant remains EXPECTED-RED · documented · contained.

Step 2 resumes when PL-002 (Supabase Pro upgrade) lands on the qb-branos project.

The next session opens step 3 (Asset Layer) per the chapter-3 plan-of-record. Step 2 and step 3 are independent (no shared surfaces); step 3 does not require step 2's migration to land.

`Parked-by: Ahmed Nizzar Ben Chekroune <me@qtmbg.com>`

---

*Chapter 3 · Step 2 · PARKED · QB BrandOS · 2026-05-21*
