# Chapter 3 · Step 3Z · Closure report · Asset Layer minimum

**Status:** STEP 3 CLOSES, conditional on two operator actions logged in §8 (FILE_TEST_AGENT removal from Vercel Production per exit condition 7, and the orphan-object deletions). All engineering exit conditions are met and verified against production on 2026-06-10.

`Sign-off: pending operator`

---

## 1. Sub-PR ledger

| Sub-PR | PR | State | Output |
|---|---|---|---|
| Spec | #160 | merged | Full spec, Asset Layer minimum, 6 adjudications baked |
| 3A | #161 | merged | user-uploads bucket SQL + 4 RLS policies (operator-applied after surface) |
| 3B | #162 | merged | Upload card on /foundation, supabase-js client-side |
| 3C | #163 | merged | /api/files/sign-url Edge function (held, then released) |
| 3C fix | #166 | merged | Storage /sign auth isolated to SUPABASE_STORAGE_SIGN_KEY |
| 3D | #164 | merged | runtime_args.files plumbing, run.js + rerun.js |
| 3E | #165 | merged | Synthetic file_test_agent + file-upload-pipeline repro gate |
| 3E diag | #168 | merged | Empty-commit fresh deploy (env snapshot hypothesis, disproven) |
| 3E probe | #169 | closed unmerged | Preview-only diagnostic probe, clean teardown |
| 3E class fix | #170 | merged then reverted | Flag reads module-init → handler-call (see §3 incident) |
| 3E revert | #171 | merged | Incident restore to known-good |
| 3E re-land | #172 | merged | #170 content + file_test_agent META cure (files[].source) |
| 3E allowlist | #173 | merged | file_test_agent added to KNOWN_AGENT_SLUGS |
| 3E harness | #167 | merged | Harness JWT-path conversion, landed on 5/5 GREEN |
| 3E test infra | #174 | merged | registry-env invariant + registry-smoke gate + harness self-teardown |
| Forward ref 3 | #175 | OPEN, HOLD | Reaper terminal-flip conditional UPDATE (adversarially reviewed, defect cured pre-hold) |
| Forward ref 2 | #176 | OPEN, HOLD | run.js silent failures get loud (adversarially reviewed, SOUND) |
| 3Z | this PR | | This closure + step 4 outline |

---

## 2. Exit conditions (spec §5), verified 2026-06-10

| # | Condition | Verdict |
|---|---|---|
| 1 | Bucket + 4 RLS policies + 25MB + MIME list on prod | MET (3A, operator-applied; exercised by every harness run through the RLS-enforced user-JWT upload path) |
| 2 | Upload card live on /foundation | MET (3B) |
| 3 | /api/files/sign-url deployed, 1h TTL, owner-only | MET (3C + #166; harness asserts signed_url + ttl=3600s on the user-JWT path) |
| 4 | runtime_args.files → agent run(), agent_runs.file_refs frozen | MET (3D; harness asserts the echo end to end) |
| 5 | file_test_agent gated by FILE_TEST_AGENT=1 | MET (request-time gating per #172; invariant E1/E2 pin it) |
| 6 | file-upload-pipeline.mjs PASSES against production, flag ON | MET, three consecutive GREEN runs (see §4) |
| 7 | FILE_TEST_AGENT removed from Vercel Production | **PENDING OPERATOR** (§8) |
| 8 | Closure confirms 1-6, step-2 independence, step 4 outline committed | This document + `chapter-03/step-4-outline.md` |

---

## 3. Incident section · the 2026-06-10 cold-start outage

The class fix (#170) was correct and necessary; it also detonated two latent registration gaps that only its own strictness could have found.

**The latent META bug.** `agents/file-test-agent.js` declared `files: [{ type: 'sample', optional: true }]` with no `source` field. The contract requires `source` in `['user-upload','agent-output']`. Pre-#170, the registry validated only the four production METAs, so no environment had ever validated the test-agent METAs. The same module-init flag-read class also sat latent in chain_test_agent since chapter 2 step 8B (the step-3E probe showed CHAIN_TEST_AGENT absent at module init in production); the request-time pattern cures both agents identically.

**The outage.** #170 made `assertAgentMetaOrThrow` unconditional for all six METAs at registry module load. The violation threw on every Edge cold start. Five functions import the registry (run, rerun, console, lock-foundation, chain-trigger); all returned FUNCTION_INVOCATION_FAILED in production. Window: deploy READY 10:03:47Z to revert READY 10:09:50Z, roughly six minutes. Detected by the harness re-fire within two minutes of deploy; reverted (#171) before continuing anything else.

**The false verification claim.** #170's commit message said "verified on branch before commit." Any registry import at that commit throws regardless of env, so verification cannot have included importing the registry. The claim was wrong, and process now treats unevidenced "verified" claims as invalid (see standing gate below).

**The second gap, one layer deeper.** After re-land (#172), the harness went RED again at the schema-validate step: file_test_agent was absent from `KNOWN_AGENT_SLUGS` in `js/qb-artifact-schema.js` (chain_test_agent was present, per the step-8B precedent). The agent had never executed end to end before, so the gap was unreachable until that day. Cured in #173.

**The class, named.** A new agent registers on at least three surfaces: registry entry, contract-valid META, artifact-schema allowlist. file_test_agent was registered on one of three. Each missing surface fails at a different layer (unknown_agent, module-load crash, schema_validation_failed), which is why the incident unfolded in stages.

**The process hole, closed.** The standing registry merge gate (binding from 2026-06-10, all chapters, documented at `docs/patterns/registry-merge-gate.md`, CLAUDE.md Critical rules, scripts/README.md): any merge touching agents/, the registry, or the dispatch path requires (a) `scripts/registry-smoke.mjs` run locally with all test flags set, output recorded verbatim in the PR, and (b) post-deploy unauthenticated 401 probes on /api/agents/run and /api/agents/console. The load-time validation stays unconditional; the gate moves detonation from production cold start to a local terminal. The smoke checks all three registration surfaces.

---

## 4. Pipeline harness · final GREEN, verbatim

Three consecutive GREEN runs (10:37Z, 10:44Z, 10:52Z). Final run with self-teardown:

```
"pass": true,
"assertions": {
  "type_matches": true,
  "file_id_matches": true,
  "path_matches": true,
  "mime_matches": true,
  "signed_url_present": true
},
"final_artifact_status": "delivered",
"teardown": { "debris_free": true, "leftovers": [] }
```

Teardown steps, final run: agent_runs delete 204, artifacts delete 204, dispatch_jobs delete 204, storage delete 200, auth user delete 200; verified gone via storage list-by-prefix (empty) and auth admin 404. Independent storage list confirmed zero objects under the run's user prefix.

---

## 5. Strictness improvement

Test agents no longer exist in the frozen `AGENTS` map at all; they resolve only through `getAgent()`/`listAgentSlugs()` at request time. lock-foundation and console both resolve through `AGENTS[slug]?.META`, so even if their phase-00 filters regressed, test agents would fail closed there. Pinned by invariant E3.

---

## 6. New invariant + registry smoke

`tests/chapter-03/invariants-registry-env.mjs` joins the chapter-3 set. Seven findings: E1/E2 functional (post-import env change visible at request time, the incident-class pin), E3 (frozen AGENTS production-only), E4 (every TEST_AGENTS META passes the contract, incident half 1), E5 (registry ↔ artifact-schema allowlist consistency, incident half 2), E6/E7 static (env reads only inside the registry helpers; no api/ file reads the flags). Negative-tested against the broken commit `cdd851a`: goes RED with the exact incident error.

Full invariant set on main, 2026-06-10: registry-race PASS, schema-compliance PASS, subscribe-grace PASS, registry-env PASS, version-race EXPECTED-RED (§7).

---

## 7. Step-2 park reconfirmed

Step 3 shipped with zero schema changes; migration 018 stays NOT applied, blocked on PL-002. The version-race harness re-fired against production on 2026-06-10: sub-invariant A PASS, C PASS (8 of 8 reruns 202), B RED with duplicate `(user_id, artifact_type, version)` rows (v2 ×3, v5 ×2). That is the documented EXPECTED-RED shape; it flips GREEN when step 2 lands the partial unique index. Step 3 ships do not change step 2 park status.

---

## 8. Pending operator (exact items)

1. **FILE_TEST_AGENT removal from Vercel Production** (exit condition 7). The flag stays ON until routed; the agent is invisible to users regardless (phase 00 + frozen-AGENTS strictness). Removal is the operator's call in chat, then a fresh deploy is NOT required (request-time reads pick up env changes on current deployments).
2. **Six orphan 73-byte test PNGs in user-uploads**, all the same leak class: the pre-fix harness teardown sent Bearer-only storage DELETEs, got 400 `Invalid Compact JWS`, and swallowed it. Four predate this run (2026-05-22), two are from this run's pre-fix harness executions (the post-fix teardown leaks nothing). Pre-authorized cleanup covered only the RED-run object, which was deleted and verified. The remaining six, exact paths:
   - `0d260074-5971-40b3-b887-37fbbc91dc72/a38038e3-cd36-4e43-89aa-eee22e433b25.png` (2026-05-22)
   - `738f0c09-8cc4-4dfe-b216-1daeeb1f4ebf/a4ae156c-6cdc-4f94-a493-388e8a6a0d7f.png` (2026-05-22)
   - `981d2aa8-6e9d-42c7-a2c8-9bfabd8b8e50/d7901fe7-062d-4a33-a586-82bc90fa499c.png` (2026-05-22)
   - `d678772c-65ea-4ad2-99f9-2ff80e985872/7a9608c5-9f7c-4e63-af73-762d0e576c5a.png` (2026-05-22)
   - `9219f0f2-8ea3-41b9-bad3-ee76a3f5a07c/0ceb2e51-7702-49a3-85bb-059805b3a1ac.png` (2026-06-10, run 2)
   - `9918dbcc-5bc0-4dff-9a26-a2c83143dbb2/d6c5d377-2bb4-4cb3-b75e-92b22e68433b.png` (2026-06-10, run 3)

## 9. Forward risks re-logged

- **SVG**: `image/svg+xml` is in the bucket's allowed MIME list. Never render an uploaded SVG inline in the DOM (innerHTML or inline `<svg>` injection executes embedded script). If an uploaded SVG is ever displayed, it goes through `<img src=signed-url>` only. Step 4 keeps SVG out of the agent-readable set entirely.
- **Reaper reverse race** (from #175 review): settleDispatch's final write is unconditional on dispatch status, so a late settle can overwrite failed_permanently. Pre-existing, low severity, logged for step 4+ consideration.
- **Partial-outside-window gap** (from #175 review): a 'partial' settle that lands outside the reaper's terminal-flip window produces no user notification on main. Pre-existing systemic gap, logged.

## 10. Held PRs

#175 (reaper terminal-flip conditional UPDATE) and #176 (run.js silent failures get loud) are implemented, adversarially reviewed, and OPEN ON HOLD for operator merge-go. #175's review found a real defect (lost-race 'partial' would have silenced the only dispatch_failed emitter); cured on the branch before hold.
