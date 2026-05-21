# Chapter 3 · Step 2 outline · Synthetic `chain_id` backfill migration

**Status:** OUTLINE. Six open calls below for adjudication. Step 2 spec follows on the `chapter-3/step-2-outline` branch (same branch convention as chapter-2 outline + spec) once adjudications land.

**Trigger:** the migration touches every user's historical artifact rows. Per user instruction: step 2 gets a full adjudication including its SQL.

**Hold gate:** active. The spec does NOT open before adjudication on the six calls below.

---

## 1. Source authority

- `CHAPTER_02_COMPLETION.md` §4.5 (Backfill-migration discipline · own step · own repro gate · own SQL review per the migration 017 hotfix model)
- `CHAPTER_02_COMPLETION.md` §7 (Open items handed to chapter 3)
- `chapter-03/step-1-hardening-report.md` §8 (Forward ref 1 · DB constraint on artifacts table)
- `chapter-03/step-1-sweep-notes.md` §5 (Forward ref 3 · reaper terminal-flip conditional UPDATE)
- `tests/chapter-03/invariants-version-race.mjs` (EXPECTED-RED state · empirically confirms #100 gap in production)

---

## 2. Bundle framing

Step 2 ships ONE migration with one repro gate and one SQL review. The primary deliverable is the synthetic `chain_id` backfill that converts the chapter-2 "Earlier work" archive shelf into the unified one-chain-model UI. Two adjacent surfaces from step 1 are candidate bundling targets:

- **Bundle A · just the chain_id backfill.** Migrates legacy artifacts (created before chapter-2's chain orchestration). After ship, the "Earlier work" section in `archive.html` collapses to "Chain history" (one model). Smallest scope.

- **Bundle B · chain_id backfill + artifacts unique constraint.** Adds the partial unique index from Forward ref 1 in the same migration. Cures the version-race finding from 1C. Both touch dispatch_jobs/artifacts DB layer with operator-reviewed SQL.

- **Bundle C · chain_id backfill + artifacts unique constraint + reaper conditional UPDATE.** Same as B plus Forward ref 3. The reaper change is application-level (a one-line conditional PATCH) but rides on the same DB-enforcement theme.

Call 1 below decides which bundle.

### Why bundle B or C is plausible

- The chain_id backfill itself touches `dispatch_jobs` and `artifacts` rows. Adding a unique index in the same migration window is operationally cheap (one DDL statement) and operator-reviewed as a unit.
- The reaper terminal-flip cure (Forward ref 3) is application-level + one line change. It rides alongside as a small app patch in the same step's PR sequence.
- The migration 017 hotfix model (cited as the discipline source) bundled multiple security fixes into one operator-reviewed migration session.

### Why bundle A might still be right

- One-concern-per-step is the inherited discipline. A backfill migration IS the concern; adding the unique constraint adds a separate concern (race-cure enforcement).
- Splitting reduces the human-eyes-on-SQL review burden per step.

Default per the open-call posture: bundle B (chain_id backfill + artifacts unique constraint). Override candidates below.

---

## 3. Six open calls for adjudication

### Call 1 · Bundling scope

- **Default · Bundle B (chain_id backfill + artifacts unique constraint).** Both touch the dispatch_jobs/artifacts DB layer · one migration session · one SQL review · cures the Cat B finding from 1C in the same window.
- **Override · Bundle A (just chain_id backfill).** Honors one-concern-per-step strictly · the artifacts uniqueness constraint becomes step 2-bis with its own SQL review. Smallest blast radius per step.
- **Override · Bundle C (Bundle B + reaper conditional UPDATE).** Adds Forward ref 3 (sweep finding #1) · application-level + 1 line change · same enforcement theme.

### Call 2 · `chain_id` backfill source-of-truth

What populates `chain_id` for legacy artifact rows (those without a chain_id)?

- **Default · group by `dispatch_id`.** Every legacy artifact has a dispatch_id (chapter-2 invariant). Use `dispatch_id` as the synthetic chain_id for legacy rows. Idempotent: re-running the migration produces the same chain_id per dispatch.
- **Override · group by `(user_id, created_at-window)`.** Use a time window to group artifacts created within N seconds of each other. Captures lock-time fan-out as one chain. More complex; needs window-size adjudication.
- **Override · group by source artifact lineage.** Walk `parent_artifact_id` to find the root, use root.id as the chain_id. Captures rerun branches as chained to the original. Most semantically correct; most complex to implement; requires recursive SQL.

### Call 3 · Backfill idempotency mechanism

How does the migration handle partial runs, re-runs, and the test/prod divergence?

- **Default · `UPDATE WHERE chain_id IS NULL`.** The DDL adds the chain_id column (already exists per migration 016 · so this is a backfill not a column-add). The UPDATE only touches rows where chain_id is null. Re-runs are no-ops.
- **Override · `INSERT INTO chain_backfill_log` first, then UPDATE.** Write a log row before each update, so the operator can roll back specific rows if needed. Higher safety; more state to manage.
- **Override · transactional UPDATE with explicit rollback gate.** Wrap in a transaction with a verification SELECT before commit. The operator manually approves the count of rows about to be touched.

### Call 4 · Repro gate shape

What does the repro gate harness assert?

- **Default · synthetic-state-vs-real-state diff.** Create a fresh test user, generate the legacy state (artifacts without chain_id), run the migration, assert the resulting chain_id values match the expected grouping (per Call 2 default). Diff-based assertion.
- **Override · production sample-of-N audit.** Run the migration against a Supabase BRANCH (production data clone). Verify the row counts match expectations. Higher-fidelity to the actual production state; requires Supabase branch creation per `mcp__claude_ai_Supabase__create_branch`.
- **Override · both (full coverage).** Default + Override #1.

### Call 5 · SQL review surface

Who reviews the migration SQL before it lands, and what do they review?

- **Default · operator + AI cross-read.** Operator reviews the SQL itself · AI cross-reads against the §4.5 discipline (idempotency · partial-run safety · constraint correctness). Both must sign off before apply.
- **Override · operator-only review.** Operator reviews; AI provides the SQL draft. No AI sign-off required.
- **Override · operator review + a synthetic-data dry-run on a Supabase branch first.** Operator sees the migration apply against a branch before it touches production.

### Call 6 · Forward ref 3 (reaper terminal-flip) bundling

Where does the sweep-finding-1 cure ship?

- **Default · ride alongside step 2 if Bundle C is chosen; else its own step.** Logical: same enforcement theme, but small enough to land separately.
- **Override · always ship as its own step.** Severity is low (sub-second observability race · no state corruption). Doesn't need to ride.
- **Override · never ship.** Severity is low enough that accepting the cosmetic risk indefinitely is defensible. Document as a known limitation.

---

## 4. Out of scope for step 2

- Asset-layer build (Supabase Storage bucket · upload UI · file browser · agent file-ref read). Starts at step 3.
- Phase 02 agents (Logo Direction · Logo Evaluation · Voice Guide). Chapter 4 territory.
- Production-site silent-fail cleanup (Forward ref 2 · 5 helpers in api/agents/run.js). Separate chapter-3 step after step 2.
- Pricing reconciliation. Roadmap PR #150 reconciliation note pending separate session.
- WCAG accessibility audit. Post-launch deferred.

---

## 5. Definition of done

Step 2 closes when:

- The chain_id backfill migration is applied to production (operator-reviewed SQL · per-row count verified · zero row touch on already-chained artifacts).
- The repro gate harness PASSES against the expected grouping (per Call 2 + Call 4 choices).
- The "Earlier work" section in `archive.html` collapses to the unified chain model (post-backfill UI state is verified).
- If Bundle B or C: the artifacts unique constraint is in place AND `tests/chapter-03/invariants-version-race.mjs` flips GREEN at re-fire.
- If Bundle C: the reaper terminal-flip conditional PATCH is in place (one-line change).

Closure report at `chapter-03/verification/step-2-closure-report.md`.

---

## 6. Sub-PR shape (provisional · finalized in spec)

| Sub-PR | Branch | Output |
|---|---|---|
| Spec | `chapter-3/step-2-outline` | outline + spec on hold gate (this PR + spec follow-up commit) |
| 2A | `chapter-3/step-2a-migration` | the migration SQL · NOT applied · committed for review |
| 2B | `chapter-3/step-2b-repro-gate` | the repro gate harness · runs locally · last-run.json output |
| 2C | `chapter-3/step-2c-apply` | operator applies the migration via MCP/CLI after SQL review · commit captures the applied-at + row counts |
| 2D (conditional · Bundle C) | `chapter-3/step-2d-reaper-flip` | reaper terminal-flip one-line cure |
| 2Z | `chapter-3/step-2z-closure` | closure report + step 3 outline (Asset Layer) |

If Bundle A is chosen, sub-PRs 2D drops out. If Bundle B is chosen, 2D drops out.

---

## 7. Surface posture

Step 2 holds at the gate until the six calls above are adjudicated. After adjudication, the spec lands and the hold releases. The sub-PRs flow under the same posture as step 1 (cosmetic Cat A within cap of 2 · seam-behavior Cat B stops and surfaces).

Per the user's chapter-3 posture: step 2 surfaces its outline (this file) and waits for the full adjudication. Migration steps always come to the operator regardless of the default-shape rule.

---

## 8. End of outline

Hold gate active. Six open calls. Adjudication releases the spec.

`Outline ready · branch chapter-3/step-1z-closure (rides with step 1 closure)`
