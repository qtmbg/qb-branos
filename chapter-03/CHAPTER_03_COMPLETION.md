# Chapter 3 · Asset Layer · Completion draft

**Status: DRAFT. Chapter close surfaces to the operator; this document does not self-certify.**

Drafted 2026-06-11 after step 5 (runtime envelope migration) and the step-4 re-fire under the new envelope.

---

## 1. Exit condition

Stated: a founder uploads a file, and a real production agent reads it.

Met, empirically, on 2026-06-11 against production (`tests/chapter-03/file-upload-real-agent.mjs`, full output on PR #178):

- Five file-present visual_dna runs delivered through `/api/agents/run`, p95 25 800 ms, zero timeouts, gate threshold 35 000 ms.
- The production founder entry end to end: `POST /api/agents/rerun` with a reference-image file → 202 → artifact delivered, the agent reading the founder's image through a Claude vision url-source block.
- `agent_runs.file_refs` snapshot correct (file_id and contract type match).
- Loud rejection before dispatch for both excluded classes: SVG (vision MIME set) and oversize (5 MB cap), each with named detail.
- Self-teardown, zero debris.

## 2. PR ledger

Chapter base: `641478a` (#150, build-state pin). Thirty-two first-parent commits, PRs #151 through #183.

| Range | Content |
|---|---|
| #151-#159 | Step 1 (bucket + RLS + sign-url + upload card 3B) and step 2 opening (migration 018 drafted, then PARKED on PL-002) |
| #160-#168 | Step 3: contract files slot, file_test_agent, runtime_args.files plumbing (run + rerun, 3D), pipeline harness + JWT conversion, storage auth isolation (3C), FILE_TEST_AGENT env diagnostics |
| #169 | Debug probe, closed without merge by design |
| #170-#173 | Incident 1 (see §3): flag-runtime fix, revert, re-land + META cure, allowlist cure |
| #174 | Test infra: registry-env invariants, registry-smoke gate, harness self-teardown |
| #175-#176 | Forward refs: reaper terminal-flip compare-and-set, run.js loud failures |
| #177 | Step 3Z closure |
| #178 | Step 4: visual_dna file read (held on RED gate, merged after step 5 re-fire GREEN) |
| #179-#181 | Incident 3 (see §3): mis-based branch breach, revert, clean re-land of the Ch4 outline |
| #182 | Step 5: Edge → Node serverless runtime migration, audit-cured |
| #183 | Latent 3C sign-url bug (see §4), caught by the step-4 production harness |

Defect rate: 7 of 32 first-parent commits are `fix` commits. Of those, three are the incident-response chain of incident 1, one is incident 3's revert, two are step-5 pre-merge audit cures, one is the latent 3C bug.

## 3. Incidents

### Incident 1 · 2026-06-10 · registry cold-start outage (~6 minutes)

#170 correctly moved test-agent env-flag reads from module-init to handler-call time and made META validation unconditional at module load. A latent file_test_agent META violation (missing `files[].source`) detonated on production cold start: every agent endpoint returned FUNCTION_INVOCATION_FAILED. Cure chain: revert #171 within minutes, META cure + re-land #172, artifact-schema allowlist cure #173 (the second registration surface, caught by the harness re-fire). The "verified on branch" claim on #170 was false at the time it was made; the process hole is closed by the standing registry merge gate (§5). Class pinned by `tests/chapter-03/invariants-registry-env.mjs` (E1-E7, negative-tested against the #170 commit).

### Incident 2 · 2026-05-22 · silent storage leak (no outage)

Storage DELETE calls carrying only a Bearer header return 400 "Invalid Compact JWS", and the old teardown read 400 as "gone": six 73-byte orphan PNGs accumulated across harness runs. Cure: both `apikey` and `Authorization` headers on storage calls, verification by list-by-prefix instead of GET. The six orphans were deleted under explicit pre-authorization on 2026-06-10 (before 6, after 0, bucket root empty).

### Incident 3 · 2026-06-10 · mis-based branch breach (~100 seconds)

The chapter-4 outline branch silently cut from the held step-4 branch after a failed `git checkout main` on uncommitted files; #179 carried the RED-gated step-4 commit onto main and was merged without inspecting the PR commit list. Reverted in #180 (~100 s production exposure), outline re-landed clean in #181. **Process correction, standing since:** `git merge-base --is-ancestor` base check on every branch, `gh pr view --json files,commits` inspection before every merge. Both checks ran on every subsequent merge this chapter (#182, #178, #183).

## 4. The latent 3C bug (#183)

`/api/files/sign-url` composed `SUPABASE_URL + signedURL`, omitting the `/storage/v1` prefix: every signed URL it ever issued 404'd. Invisible through all of step 3 because no consumer dereferenced the URL; the step-4 vision read is the first real fetch, and the production harness caught it on run 1. Lesson recorded: harnesses that assert plumbing without exercising consumption pass over dead payloads. The chapter's harness now fetches what it signs.

## 5. Standing gates accumulated this chapter

1. **Registry merge gate** (binding, all chapters, CLAUDE.md + docs/patterns/registry-merge-gate.md): `scripts/registry-smoke.mjs` output verbatim in the PR body pre-merge; unauthenticated 401 probes on `/api/agents/run` and `/api/agents/console` post-deploy; any 500 = revert immediately.
2. **Branch-base ancestry check** before every commit series; **files,commits inspection** before every merge (incident 3 correction).
3. **Registry-env invariants** (`invariants-registry-env.mjs`, E1-E7): no module-scope env read gates registry membership; both incident-1 registration surfaces pinned.
4. **Harness self-teardown discipline**: every harness deletes what it creates, verifies absence, reports `debris_free`.

## 6. Step 5 · envelope migration (the step-4 RED gate's structural fix)

The step-4 latency gate went RED on 2026-06-10: p95 file-present 23 684 ms against a 22 900 ms threshold, one hard timeout in five runs, and the unmodified baseline also timing out. The operator ruled the structural fix: migrate agent execution from Edge to Node serverless.

Shipped as #182: `runtime: 'nodejs', maxDuration: 300` on run.js and the reaper (Web-standard handlers via HTTP-method exports), in-call Claude timeout 60 000 ms fleet-wide, contract budgets re-derived (warning 60 000 / ceiling 290 000 / timeout-bounded admission check), reaper re-derivations (orphan window 330 s, terminal flip 330 s, claim-first retry accounting, fire-and-release refires). A three-lens pre-merge adversarial audit caught one blocker (kill-before-accounting) and two serious defects (overlapping cron ticks, admission-gate under-modeling); all cured pre-merge.

Before/after, visual_dna:

| | Edge (pre-step-5) | Node (post-step-5) |
|---|---|---|
| Envelope | 24 000 ms in-agent, ~25 s function | 60 000 ms in-call, 300 s function |
| File-absent | 18 887 ms + one timeout in 2 runs | 17 055-27 701 ms, 5/5 delivered, zero timeouts |
| File-present | 22 625-23 684 ms + one timeout in 5 runs, p95 RED | 21 137-25 800 ms, 5/5 delivered, p95 25 800 GREEN |

The 27 701 ms file-absent run and three of the five GREEN file-present runs sit in the latency class the old envelope killed.

## 7. Parks, deferrals, forward risks

- **Step 2 PARKED**: migration 018 resumes on PL-002. The version-race harness stays EXPECTED-RED on sub-invariant B (duplicate versions under concurrent rerun) until the unique index lands.
- **PL-003 deferred**: per-tier storage caps, file versioning, ZIP.
- **SVG forward risk carried into chapter 4**: SVG uploads remain accepted by the bucket but excluded from every agent read path; never render uploaded SVGs inline in the DOM (`<img src=signed-url>` only). Logo Evaluation (Ch4) will face SVG logo uploads directly; the exclusion call re-opens there.
- **Reverse race (3Z §9)**: settleDispatch's final write is unconditional; the reaper side is compare-and-set since #175. Watch item.
- **Exit condition 7 · FILE_TEST_AGENT**: still set in Production env at draft time (verified 2026-06-11, 20 days old). Removal is operator-only. chain_test_agent was never added to Production. Once removed, the registry serves exactly the four production agents and the test agents remain flag-gated for local smoke only.

## 8. Chapter boundary

This draft records the evidence. Chapter 3 closes when the operator says it closes.
