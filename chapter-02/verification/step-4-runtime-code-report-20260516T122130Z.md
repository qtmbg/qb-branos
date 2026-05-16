# Chapter 2 · Step 4 · runtime code (hold-open)

**Step:** `/api/agents/run` + supporting files per the locked spec amended in PR #74.
**Generated:** 2026-05-16T12:21:30Z.
**Branch:** `chapter-2/step-4-runtime-code`.
**Verdict:** **CODE STAGED · awaiting review.** Migration 014 applied to prod. Registry pre-check enforces §5.2.1 two-layer rule (warn at 22 000 ms, throw at 25 000 ms). Move A smoke confirmed Haiku Sensescape works in prod-equivalent code. Step 4 close criteria (live conformance, a3 + a4 + a5 live, 10/10 harness) ship in the **next** PR after this code lands.

---

## 1. Move A smoke result (prerequisite from PR #74 merge)

Single live dispatch against the deployed `/agents/sensescape.js`:

```text
Direct module call · OK in 10080ms
Schema validation: PASS
Model: claude-haiku-4-5-20251001
Tokens in: 1747
Tokens out: 849
Duration: 10036ms
```

**Limitation surfaced honestly.** Admin session minting returned non-200, so the smoke fell back to a direct call against the same module production imports rather than driving the full HTTP path through `/api/agents/dispatch`. Same code, same model, same Claude API, same prompt, same artifact assembler. Schema validity + model selection + Claude call behavior are identical to production. The paths not exercised by this fallback are JWT verification, Supabase persistence round-trips (~500 ms), and Edge cold-start (~500 ms) · none of these affect schema correctness.

If a true end-to-end UI smoke is required, the operator runs it through the live UI as a fresh user. The harness script (`tests/chapter-02/smoke-haiku-sensescape.mjs`) commits in this PR for re-runs.

---

## 2. What ships in this PR

| File | Purpose |
| --- | --- |
| `supabase/migrations/014_agent_runs_schema_retry_count.sql` | NEW · adds `agent_runs.schema_retry_count int not null default 0` per §5.2 step 8 + §6.6.1. Applied to prod. |
| `agents/contract.js` | EDITED · `assertAgentMetaOrThrow` now hard-fails registration when `(retry_budget+1) × observed_latency > EDGE_FUNCTION_CEILING_MS` per §5.2.1 two-layer enforcement. Warning at 22 000 ms remains non-fatal. |
| `agents/user-action-copy.js` | NEW · §5.8.1 canonical user-action copy resolver. Three locked templates (`missing_inputs`, `qbp_field_missing`, `missing_dependency`) with `{agent}`, `{exercise}`, `{upstream}` placeholders. |
| `api/_lib/operator-notify.js` | NEW · §5.8.2 Resend channel to `me@qtmbg.com` with `[QB BrandOS Operator]` subject prefix. 60-second dedup per (agent_slug, stage) pair. Always returns; never throws. |
| `api/agents/run.js` | NEW · the 12-step runtime per §5.2. Inter-edge HMAC verification, QBP source resolution, required-input validation, agent_runs writes (qbp_snapshot, file_refs, runtime_args, agent_version, schema_retry_count), dispatch_jobs settlement, schema-validate-and-retry loop honoring `META.retry_budget`, failure surface row writes, operator-notify on config_missing. Test-force-error hook for §11.12.1 a3 live coverage in the next PR. |
| `tests/chapter-02/smoke-haiku-sensescape.mjs` | NEW · Move A's smoke script · falls back to direct module call when admin session minting fails. |

---

## 3. Spec mapping · what's implemented vs deferred

### Implemented in this PR

| Spec | Implementation |
| --- | --- |
| §5.2 step 1 (caller verification) | `verifyUserJwt` + `verifyInterEdge` in `api/agents/run.js`. HMAC over `${timestamp}.${rawBody}` with 5-minute freshness window. |
| §5.2 step 2 (registry lookup) | `AGENTS[agent_slug]` from `agents/registry.js`. |
| §5.2 step 3 (QBP source) | `resolveQbpSource` reads `runtime_args.qbp_source` · `'current'` from `profiles.qbp`, `'original'` from the source artifact's `agent_runs.qbp_snapshot`. |
| §5.2 step 4 + 5 (input validation, fail early on missing inputs) | `validateInputs` checks required `qbp_fields`, `artifact_dependencies`, and non-optional `files`. Failures write `{ ok: false, code, missing_fields }` via `error_payload` jsonb. |
| §5.2 step 6 (agent_runs row) | `openAgentRun` writes `qbp_snapshot`, `file_refs`, `runtime_args`, `agent_version`, `model`. `propagateDispatchAgentVersion` writes `agent_version` to the parent `dispatch_jobs` row. |
| §5.2 step 7 (artifact generating) | `patchArtifact` flips status. |
| §5.2 step 8 (schema-validate-and-retry loop) | `runWithSchemaRetry` reads `META.retry_budget` (default 1, but all four agents declare 0 today), increments `schema_retry_count` per Claude call attempt. Test-force-error hook accepts `runtime_args.test_force_error` for `edge_timeout`, `model_call_failed`, `schema_validation_failed`. |
| §5.2 steps 9-11 (success/failure persistence, dispatch settlement) | `closeAgentRun` + `patchArtifact` + `settleDispatch`. Successful runs trigger artifact-ready email best-effort. |
| §5.2 step 12 (run summary) | Returns `{ ok, agent_slug, artifact_id, agent_runs_id, status, schema_retry_count, qbp_source, duration_ms }`. |
| §5.2.1 latency-budget pre-check · two-layer enforcement | `checkLatencyBudget` + `assertAgentMetaOrThrow` · warning at 22 000 ms (registry-load log + LATENCY_BUDGET_WARNINGS array), hard-fail throw at 25 000 ms. |
| §5.8 failure surface | Every code mapped to (artifact.status, dispatch_jobs.status, agent_runs.status, notification, console row, retryable) per the table. User-fixable codes write `error_payload` only · no bell notification. Operator-only `config_missing` fires `sendOperatorNotification` immediately. |
| §5.8.1 canonical user-action copy | `agents/user-action-copy.js` exports `resolveUserActionCopy(code, agentMeta, ctx)` with three templates + `USER_FIXABLE_CODES` set + `TRANSIENT_COPY` + `PERMANENTLY_FAILED_COPY` + `OPERATOR_ONLY_COPY` constants. |
| §5.8.2 operator notification channel | `api/_lib/operator-notify.js` with Resend, dedup window, plain-text body. Registry-load latency warnings forwarded on first dispatch via `fireRegistryLatencyWarnings`. |

### Explicitly deferred to the next PR (step 4 verification)

- **a3 live conformance: `edge_timeout` and `model_call_failed`.** The test-force-error hook is in place in `api/agents/run.js`. The conformance runner needs updating to invoke the runtime through HTTP (not direct module) so the force-error path fires. Plus a smoke-deploy + 10/10 reproduction harness run.
- **a4 + a5 live verification.** Same dependency · needs the runtime invoked via HTTP against prod for the `agent_version` + `qbp_snapshot` writes to land in real DB rows the conformance test can query.
- **PR #67 harness against new runtime.** A new test endpoint (mirroring `test-async-lock` but firing `/api/agents/run`) can be a small follow-on if the build sequence wants the harness pointed at the runtime in step 4. Easier: defer until step 6 lock refactor, which is the natural moment to validate the runtime under real lock load.
- **§6.6.1 Console rolling-average surface.** The DATA writes (`schema_retry_count` on every run) ship in this PR. The CONSOLE surface that reads + renders the rolling average lands in step 11 (Run history view).

---

## 4. Registry pre-check · current state

```text
[agents/registry] latency-budget warning: visual_dna_synthesizer · worst case 22900ms exceeds 22000ms budget at retry_budget=0 · drop retry_budget to 0 + tighten prompt, OR defer to streaming runtime
registry OK · agents: 4 warnings: 1
```

Three of four pass cleanly. Visual DNA is the single warning · 900 ms above the 22 000 ms warning threshold, 2 100 ms below the 25 000 ms Edge ceiling. Below the hard-fail line; registration passes. The warning is the operational signal flagged in PR #74 §12 known debt; it will surface to the operator on the first dispatch through `fireRegistryLatencyWarnings`.

Offline conformance · 4/4 PASS:

```text
soul_map_synthesizer    · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
sensescape_synthesizer  · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
visual_dna_synthesizer  · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
war_table_synthesizer   · PASS (a1+a3 verified · a2 skipped offline · a4+a5 deferred to step 4)
```

---

## 5. Hold-open

Per Chapter 2 PR policy. The code is the implementation of the locked spec from PR #74. Two paths after merge:

1. **Step 4 verification PR.** Live conformance a2 + a3 force-error + a4 + a5 across all four agents through the deployed `/api/agents/run`. Surface metrics, schema validity, schema_retry_count values, model resolution, error_payload writes.
2. **Step 5 begins.** `/api/agent-runs/[id]/replay` GET endpoint. Smaller scope; can ship in parallel with the verification work.

Awaiting your review on the code shape and the spec coverage table in §3 above before either follow-up begins.

---

## End of step 4 runtime code report
