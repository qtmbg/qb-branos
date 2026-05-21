# Chapter 3 · Step 1A · Per-surface hardening audit

**Status:** audit complete. Class-of-bug verdicts settled. Sub-PR 1B + 1C deliverables derive from §6 + §7 below.

**Scope (per `chapter-03/step-1-spec.md` §3):** four surfaces · Edge dispatch · versioning · auth-decode · Realtime-subscribe · read end-to-end, including paths that did NOT throw in steps 6-8 but sit on the same seam.

**Hard fence honored:** zero product code edits in this audit. All findings either (a) confirm existing structural cures, (b) name a gate gap for 1C invariant assertions, or (c) name a forward-referenced step. No file in `api/`, `agents/`, or `js/` was modified.

---

## 1. Cluster · classification ledger

The 8 chapter-2 product surgical fixes with this audit's class-of-bug verdict.

| PR | Brief | Surface | First-glance class | Audit verdict | Reasoning |
|---|---|---|---|---|---|
| #86 | `context.waitUntil` Edge bug | Edge dispatch | one-off | **one-off · confirmed** | Vercel Edge runtime semantics: spawned fetches need explicit waitUntil to survive past the response. Fix moved the spawn into the helper. Pattern now structurally enforced via `holdOpenForChildren` in `api/_lib/dispatch-pattern.js` (called from `api/lock-foundation.js:337` and `api/agents/run.js:674`). Single-cure shape, not a recurring discipline. |
| #100 | `max(version)+1` artifact version race | Versioning | class · race | **class · race · confirmed** | Two concurrent reruns can both read max=N and both attempt to insert version=N+1. Cure shape: DB-enforced uniqueness. Confirmed present at the chain-dispatch level (migration 016 partial unique index on `(chain_id, agent_slug) WHERE kind='chain'`) but NOT at the artifact-row level. See §5 for the gap. |
| #105 | JWT `sub` decode | Auth-decode | one-off | **one-off · confirmed** | The Edge functions now resolve user identity via Supabase `/auth/v1/user` (authenticated round-trip) rather than self-decoding the JWT body. The client-side decode at `js/qb-realtime-manager.js:45-54` is a separate path with no auth weight. Single-cure shape, not a recurring discipline. |
| #107 | SUBSCRIBED grace timeout | Realtime-subscribe | class · race | **class · race · confirmed** | The Supabase Realtime channel's SUBSCRIBED transition can hang indefinitely under network conditions. Without a grace timeout, the consumer stays in null state. Cure shape: timed grace + fallback to poll. Present at `js/qb-realtime-manager.js:31-82` (10s timeout, `subscribedFired` flag, both terminal callbacks clear the timeout). |
| #115 | Agent registry race | Edge dispatch | class · race | **class · race · confirmed** | The agent registry must be fully populated before any dispatch reads it. Race shape: lazy population + concurrent dispatch. Cure shape: synchronous top-of-module import. Present at `api/agents/run.js:37` and `api/_lib/chain-trigger.js:22` (both `import { AGENTS, ... } from '../../agents/registry.js'` at module top). |
| #116 | Schema compliance | Cross-cutting | class · discipline | **class · discipline · confirmed** | The trap: HTTP write returns 200 to the client but the DB rejected the row (silent-400). Cure shape: `r.ok` check at every write call site with response body on failure. The chapter-2 test harnesses adopted this discipline at the seed layer (per `docs/patterns/harness-seed-schema-discipline.md`); the production runtime adopted it partially but inconsistently (see §5). |
| #117a | Allowlist | Edge dispatch | one-off | **one-off · confirmed** | CORS ALLOWED_ORIGINS Set in each Edge function. Hard-coded literal, duplicated across `api/lock-foundation.js:59-63` (3 origins) and `api/agents/run.js:48-54` (5 origins including localhost). The fix added missing origins; no recurring race or discipline shape. |
| #117b | Lock-trigger filter | Edge dispatch | one-off | **one-off · confirmed** | The chain-only agents (META.triggers=['chain']) would fail at lock-time with missing_dependency. Cure shape: filter the lock-fan-out to agents that opt into the 'lock' trigger. Present at `api/lock-foundation.js:253-256`. Single-cure shape; not a recurring discipline. |

**Verdict counts match first-glance.** Four class-of-bug entries (3 races · 1 discipline). Four one-offs (no lift). The verdicts feed the 1B pattern docs and the 1C invariant harnesses.

---

## 2. Bucket · Edge dispatch surface

### 2.1 Files audited

- `api/lock-foundation.js` (366 lines)
- `api/agents/run.js` (729 lines)
- `api/_lib/chain-trigger.js` (281 lines)
- `api/cron/reaper.js` (read for retry-cron semantics)
- `api/artifacts/[id].js` (read endpoint; RLS-scoped)
- `api/agent-runs/[id]/replay.js` (read endpoint; RLS-scoped)
- `api/_lib/inter-edge-auth.js` (HMAC helpers)
- `api/_lib/dispatch-pattern.js` (shared spawn helpers)

### 2.2 Responsibility per file

| File | Responsibility |
|---|---|
| `lock-foundation.js` | Lock the foundation · pre-insert artifact rows · fire 4 child runs under `context.waitUntil`. Returns 202. |
| `agents/run.js` | Single-agent execution. Verifies caller (JWT or HMAC) · resolves QBP · loads dependencies · runs with schema-validate-retry · persists outcome · fires chain trigger under `waitUntil`. |
| `_lib/chain-trigger.js` | Walk downstream agents · check deps + tier + depth-cap · attempt insert with 23505-catch idempotency · fire children under `waitUntil`. |
| `cron/reaper.js` | Pick up stuck dispatches · 30s/2min/5min backoff · retry 3 times · then `failed_permanently` + email + notification. |

### 2.3 Invariants enforced

1. **Idempotent lock** · `profile.foundation_locked_at` short-circuits at `lock-foundation.js:178-184`. Repeat lock returns the existing lockedAt with `alreadyLocked: true`.
2. **In-flight lock guard (60s)** · `lock-foundation.js:103-117` blocks duplicate fan-out within a 60-second window via a 'producing'-status check against `dispatch_jobs`.
3. **Pre-insert before fire** · `dispatch_pattern.preInsertDispatch()` writes `dispatch_jobs` row + N `artifacts` rows BEFORE any `/api/agents/run` fetch fires. Verified in both lock + chain paths.
4. **`context.waitUntil` wrap on every spawned fetch** · `holdOpenForChildren()` (called at `lock-foundation.js:337` and `agents/run.js:674`). The handler always returns AFTER the wrap.
5. **HMAC verification with timestamp freshness** · `agents/run.js:104-131`. 5-minute window. Hex-encoded SHA-256.
6. **DB-enforced chain idempotency** · `chain-trigger.js:241` catches `23505` / `'duplicate key'` / `'unique constraint'` substrings explicitly, classifies as `idempotent_skip`. Other errors fall through to console.error and continue.
7. **Chain depth cap (8)** · `chain-trigger.js:24,173-184`. Cycle breaker. Operator email on exceed.
8. **Tier gate before any DB write** · `chain-trigger.js:166-170` short-circuits before `preInsertDispatch`.
9. **Lock-trigger filter** · `lock-foundation.js:253-256` filters fan-out to `META.triggers.includes('lock')`.
10. **Synchronous registry load** · `agents/run.js:37`, `chain-trigger.js:22`, `lock-foundation.js:46`. No lazy/async registry reads.

### 2.4 Invariants assumed-but-unchecked (gate gap candidates)

- **`patchArtifact()` swallows non-2xx silently** · `agents/run.js:259-268`. No `r.ok` check. A failed PATCH leaves the artifact in an inconsistent state without surfacing. **Discipline-class gap (#116 family).**
- **`closeAgentRun()` swallows non-2xx silently** · `agents/run.js:247-257`. Same shape.
- **`openAgentRun()` returns null on failure** · `agents/run.js:231-245`. Subsequent code (`closeAgentRun` etc.) is null-tolerant, but the downstream artifact PATCH path still runs, leading to an artifact-without-run row. Audit-rare but possible.
- **`propagateDispatchAgentVersion()` and `settleDispatch()` are best-effort** · `agents/run.js:270-333`. No retry, no surfacing on failure. The reaper does NOT re-run these settle paths.
- **HMAC compare is not constant-time** · `agents/run.js:127`. `expectedHex !== sig.toLowerCase()`. For internal inter-edge use this is acceptable; flagging for completeness.
- **Per-artifact version uniqueness is NOT DB-enforced** · `chain-trigger.js:205-216` computes `max(version)+1` from the global artifact set (no `chain_id` scope). The DB unique constraint is on `(chain_id, agent_slug) WHERE kind='chain'` in `dispatch_jobs`, not on `(user_id, artifact_type, version)` in `artifacts`. **Race-class gap (#100 family). See §5.**

### 2.5 Gate coverage (existing chapter-2 harnesses)

| Invariant | Asserted by |
|---|---|
| Idempotent lock + in-flight guard | `tests/chapter-02/lock-foundation-10x.mjs` |
| Pre-insert before fire + waitUntil shape | `lock-foundation-10x.mjs` + `regenerate-10x.mjs` |
| HMAC verification | `chain-orchestration.mjs` (via the chain-fired path) |
| DB-enforced chain idempotency (23505 path) | `chain-orchestration.mjs` |
| Chain depth cap | `chain-orchestration.mjs` (exercises one hop; cap-tripping not exercised in chapter 2) |
| Reaper retry-and-fail | `reaper-gates.mjs` |
| Rerun branching | `rerun-conformance.mjs` + `rerun-feedback-arg.mjs` |

### 2.6 Adjacent unprotected paths (same seam · didn't throw in steps 6-8)

1. **`patchArtifact` + `closeAgentRun` silent fails** (§2.4) sit on the #116 seam. Each is a potential silent-400 surface. The chapter-2 harnesses do not actively try to trip a malformed PATCH to verify the discipline holds. **→ 1C invariant 4.**
2. **`max(version)+1` outside chain context** (§2.4) sits on the #100 seam. Manual reruns from the Console (non-chain trigger) could compute the same version concurrently and the DB has no unique constraint to catch them. **→ 1C invariant 1.**
3. **Registry read inside the handler** · `agents/run.js:473` reads `AGENTS[agent_slug]`. The registry is sync at module top, so the lookup is atomic. Adjacent shape would be any code path that does an `await import('../../agents/registry.js')` inline; grep confirms zero such paths in the audited files. **No gap.**

### 2.7 Class-of-bug verdicts · Edge dispatch

- #86 · **one-off** · structural cure via `holdOpenForChildren` helper. No invariant assertion needed beyond existing coverage.
- #115 · **class-race** · structural cure via sync top-of-module imports. Adjacent shape: any future inline `import()`. **→ 1C invariant 3** asserts the contract at dispatch time.
- #117a · **one-off** · hard-coded allowlist. No invariant needed.
- #117b · **one-off** · filter literal. No invariant needed.

---

## 3. Bucket · Versioning surface

### 3.1 Files audited

- `api/lock-foundation.js:253-265` (version=1 hard-coded on lock fan-out)
- `api/_lib/chain-trigger.js:204-216` (`max(version)+1` lookup before chain insert)
- `agents/contract.js` (META.version, AGENT_OBSERVED_LATENCY_MS, schema retry budget)
- `js/qb-artifact-schema.js` (referenced from `agents/run.js:39`; not re-read but invoked at every successful run)
- Migration 016 (`supabase/migrations/016_dispatch_jobs_chain.sql`)

### 3.2 Invariants enforced

1. **Lock fan-out hard-codes version=1** · `lock-foundation.js:262`. First lock is always version 1 by construction. Race-free because the helper pre-inserts under a 60s in-flight guard.
2. **`agent_version` propagated to dispatch_jobs** · `agents/run.js:270-293`. Read-then-PATCH; only writes if existing is null or lower.
3. **Schema-validate-and-retry** · `agents/run.js:339-394`. `schema_retry_count` increments per attempt; `runWithSchemaRetry` returns the validated content or the last failure.
4. **DB-enforced chain idempotency** · partial unique index `(chain_id, agent_slug) WHERE kind='chain'` (migration 016).

### 3.3 Invariants assumed-but-unchecked (gate gap)

**Per-artifact version uniqueness is NOT DB-enforced.** `chain-trigger.js:205-216` computes `nextVersion = max(artifacts.version where user_id=U and artifact_type=S) + 1`. Two concurrent regenerate triggers (from the Console rerun path) would both read N and both write N+1. The DB does not have a unique constraint on `artifacts(user_id, artifact_type, version)`. The chain-dispatch path is partially protected by the `dispatch_jobs (chain_id, agent_slug)` index, but the artifact row itself is not.

**Is this a real risk?** The Console rerun path goes through `/api/artifacts/[id]/regenerate` which builds its own pre-insert (need to confirm in 1B research). If that endpoint also uses `dispatch-pattern.preInsertDispatch` with kind='regenerate', then the dispatch table catches double-trigger via the same partial index ONLY IF the index covers kind='regenerate' (it does not · the index is `WHERE kind='chain'`). A manual user double-click within the 60s window could race; the only existing guard is the dispatch-table 60s in-flight check at `lock-foundation.js:103-117`, which is lock-specific.

### 3.4 Adjacent unprotected paths

- `api/artifacts/[id]/regenerate.js` (not re-read for this audit but cited in the spec) is the second `max(version)+1` site. Same shape, same gap.
- Future Phase 02+ agents (chapter 4) will use the same version-write path. The discipline needs to be in place before that fan-out.

### 3.5 Class-of-bug verdict · Versioning

#100 · **class-race · confirmed.** Cure shape is partially structural (`23505`-catch on chain insert) but the artifact-row uniqueness is asserted only by application logic (`max+1` read-then-write). **→ 1C invariant 1** asserts no two `agent_runs` rows share `(artifact_id, version)` under concurrent reruns. The deeper structural cure (adding a DB unique constraint on `artifacts(user_id, artifact_type, version)`) is a forward reference to a future step; the invariant assertion in 1C catches regressions in the meantime.

---

## 4. Bucket · Auth-decode surface

### 4.1 Files audited

- `api/agents/run.js:89-102` (`verifyUserJwt` via Supabase `/auth/v1/user`)
- `api/agents/run.js:104-131` (`verifyInterEdge` HMAC)
- `api/lock-foundation.js:146-155` (JWT verification via `/auth/v1/user`)
- `api/_lib/auth.js` (`svcHeaders` helper)
- `api/_lib/inter-edge-auth.js`
- `js/qb-realtime-manager.js:45-54` (`decodeJwtSub` client-side · NOT auth weight)

### 4.2 Invariants enforced

1. **No self-decoded JWT in Edge functions** · every Edge function resolves identity by calling Supabase `/auth/v1/user` with the bearer token. Identity comes from the authenticated round-trip, not client-decoded claims.
2. **`body.user_id` matches the JWT user** · `agents/run.js:100`. Mismatch returns 401.
3. **HMAC with timestamp freshness** · `agents/run.js:104-131`. 5-minute window. Replays beyond the window rejected.
4. **Two-path auth contract** · `agents/run.js:451-460`. User JWT first, HMAC fallback. Both verified independently; if neither passes, 401.

### 4.3 Invariants assumed-but-unchecked

- HMAC compare is not constant-time (§2.4). Low-severity for internal-only use.
- Client-side `decodeJwtSub` is `try/catch`-protected and returns null on any parse failure (`qb-realtime-manager.js:45-54`). Cannot lie to itself about user identity because the Edge layer still enforces auth on every request.

### 4.4 Adjacent unprotected paths

None. The auth-decode discipline is uniform across the audited Edge functions.

### 4.5 Class-of-bug verdict · Auth-decode

#105 · **one-off · confirmed.** Cure was structural: replace self-decode with `/auth/v1/user`. The cure is uniform across all Edge functions audited. No invariant assertion needed in 1C beyond existing chapter-2 coverage (which exercises auth on every harness that hits an Edge endpoint).

---

## 5. Bucket · Realtime-subscribe surface

### 5.1 Files audited

- `js/qb-realtime-manager.js` (180 lines · the shared singleton)
- `js/qb-notification-bell.js` (consumer · uses `QBRealtimeManager.onNotification`)
- `agents.html` (Phase view consumer · cited in spec, not re-read for this audit)
- `archive.html` (archive consumer · cited in spec, not re-read for this audit)
- `docs/patterns/qb-realtime-manager-pattern.md` (the extracted pattern)

### 5.2 Invariants enforced

1. **SUBSCRIBED grace timeout (10s)** · `qb-realtime-manager.js:31,80-82`. If SUBSCRIBED does not fire within 10s, state transitions to 'poll' and consumers fall back.
2. **Single channel · many consumers** · `qb-realtime-manager.js:170-178`. Bell, Phase view, archive all register via `onNotification` / `onState`.
3. **Idempotent start** · `qb-realtime-manager.js:121-122`. Repeat `start()` calls are no-ops.
4. **Both terminal callback paths clear the timeout** · `qb-realtime-manager.js:104-112`. SUBSCRIBED sets `subscribedFired=true` + clearTimeout. CHANNEL_ERROR/TIMED_OUT/CLOSED also set `subscribedFired=true` + clearTimeout.
5. **Per-user notification filter** · `qb-realtime-manager.js:65`. `dispatchNotification` rejects rows where `row.user_id !== userId` even if the channel filter lets them through.
6. **Token refresh path** · `qb-realtime-manager.js:163-168`. `setToken()` updates the client without restart.
7. **Clean teardown** · `qb-realtime-manager.js:132-144`. `stop()` cancels timeout, removes channel, nulls state.

### 5.3 Invariants assumed-but-unchecked

- `subscribedFired` flag is closure-scoped and only readable inside `startRealtime`. If `startRealtime` is re-entered (it should not be — `isStarted` guards), the flag is overwritten. Defense in depth: the `isStarted` guard prevents re-entry.
- `setAuth(token)` (line 92) is awaited but errors not caught. A throw here would propagate to the outer try/catch at line 114-118 which transitions to 'poll'. Acceptable.

### 5.4 Adjacent unprotected paths

- The bell, Phase view, and archive consumers each own their own poll fallback. If a consumer never registers `onState`, it stays in poll-only mode indefinitely. No invariant gap — this is the documented contract.

### 5.5 Class-of-bug verdict · Realtime-subscribe

#107 · **class-race · confirmed.** Cure shape is structural (timed grace + fallback). **→ 1C invariant 2** asserts: no Realtime-dependent code path fires before SUBSCRIBED resolves OR before the 10s grace timeout elapses.

---

## 6. Class-of-bug ledger (final · feeds 1B + 1C)

| Class | Origin PR | Cure shape | Pattern doc (1B) | Invariant harness (1C) |
|---|---|---|---|---|
| Race · concurrent version write | #100 | DB unique constraint + `r.ok`-checked write | `docs/patterns/race-discipline.md` §1 | `tests/chapter-03/invariants-version-race.mjs` |
| Race · async state-transition grace | #107 | Timed grace + fallback | `docs/patterns/race-discipline.md` §2 | `tests/chapter-03/invariants-subscribe-grace.mjs` |
| Race · dependency loading | #115 | Sync top-of-module import + barrier | `docs/patterns/race-discipline.md` §3 | `tests/chapter-03/invariants-registry-race.mjs` |
| Discipline · schema compliance | #116 | `r.ok`-check at every write site with body on failure | `docs/patterns/schema-compliance.md` | `tests/chapter-03/invariants-schema-compliance.mjs` |

The four one-offs (#86, #105, #117a, #117b) do NOT lift. Each is a single-cure structural fix with no recurring discipline shape.

---

## 7. Top 3 gate gaps (1C invariant priorities)

1. **Per-artifact version uniqueness under concurrent reruns** (§3.3) · sits on the #100 seam · DB does not enforce uniqueness on `artifacts(user_id, artifact_type, version)`. **1C invariant 1 covers this with an N-concurrent regenerate stress + post-condition check on `agent_runs`.**

2. **Silent-400 on `patchArtifact` / `closeAgentRun`** (§2.4) · sits on the #116 seam · the discipline applied to seed-time wrappers needs to extend to production write call sites. **1C invariant 4 covers this with a deliberately-malformed write whose surfacing must include the response body.**

3. **Realtime grace-window enforcement under hung SUBSCRIBED** (§5.2) · sits on the #107 seam · the grace is implemented but never explicitly tested under a stuck-channel reproducer. **1C invariant 2 covers this with a synthetic delay scenario.**

The fourth invariant (registry race) is included for symmetry with the class-of-bug ledger but the structural cure (sync top-of-module import) makes the harness primarily a regression-against-future-change gate, not a current-defect gate.

---

## 8. Forward references

The audit surfaces no findings requiring product code edits within step 1 (Fence 2 holds). Two findings name a future step:

- **Forward ref 1 · DB-level `artifacts` uniqueness constraint.** Add a partial unique index on `artifacts(user_id, artifact_type, version)` to convert the application-level race guard into a structural cure. **Recommendation:** ride this with step 2 (the synthetic `chain_id` backfill migration · which is already operating in the migrations domain with its own repro gate + SQL review per `CHAPTER_02_COMPLETION.md` §4.5). Re-naming step 2 to bundle the constraint is one option; the cleaner option is to add a step 2-bis migration that lands after step 2's backfill (so the backfill doesn't have to satisfy the new constraint mid-migration). **Decision deferred to step 2 adjudication.**

- **Forward ref 2 · Production-site silent-fail audit.** The `patchArtifact` + `closeAgentRun` + `propagateDispatchAgentVersion` + `settleDispatch` helpers all swallow non-2xx silently. Extending the schema-compliance discipline to these sites is a small refactor with a real testability benefit. **Recommendation:** a dedicated chapter-3 step (post-step-2, pre-asset-layer) replaces each silent-fail with an `r.ok` check + log + structured throw. The 1C invariant catches NEW silent-fail sites; the forward step cleans existing ones.

Both forward references are NAMED here. Neither is patched in step 1.

---

## 9. Audit completeness

- **Files read end-to-end:** 5 (`lock-foundation.js`, `chain-trigger.js`, `agents/run.js`, `qb-realtime-manager.js`, `agents/contract.js`).
- **Files audited by reference:** 3 (`reaper.js`, `artifacts/[id].js`, `agent-runs/[id]/replay.js`) · referenced for context, not re-read at depth.
- **Migrations audited:** migration 016 (partial unique index for chain idempotency).
- **Adjacent surfaces consulted:** `qb-realtime-manager-pattern.md`, `harness-seed-schema-discipline.md`, `harness-determinism.md`.
- **PRs verdicted:** 8 (all). 4 class-of-bug. 4 one-off.
- **Pattern docs to write in 1B:** 2 (race-discipline · schema-compliance).
- **Invariant harnesses to write in 1C:** 4 (version-race · subscribe-grace · registry-race · schema-compliance).
- **Sweep memo (1D) input:** §2.4 + §3.3 + §5.3 surfaces are the entry points for the time-boxed sweep across `lock-foundation.js`, `agents/run.js`, `chain-trigger.js`, `qb-realtime-manager.js`, `cron/reaper.js`.

---

## 10. Sign-off

Per-surface audit complete. Class-of-bug verdicts settled. 1B + 1C + 1D deliverables fully scoped from this report. No product code edited.

`Audited on branch chapter-3/step-1a-audit`
