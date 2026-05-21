# Pattern · race-discipline · convert temporal assumptions into enforced barriers

**Origin:** chapter 2, steps 7-8. Three race-class fixes shipped in the heavy-build cluster:
- #100 · `max(version)+1` artifact version race (step 7)
- #107 · SUBSCRIBED grace timeout race (step 7)
- #115 · agent registry race (step 8)

**Consolidated from:** chapter-03/step-1-hardening-report.md §6.

**Linked invariant harnesses:** `tests/chapter-03/invariants-version-race.mjs`, `tests/chapter-03/invariants-subscribe-grace.mjs`, `tests/chapter-03/invariants-registry-race.mjs`.

---

## The general shape

Each of the three chapter-2 race fixes is the same pattern at different layers:

> **A piece of code assumes a temporal property about state. Under concurrency, the assumption is false. The cure converts the assumption into a structural barrier.**

The cure differs by layer:
- For **concurrent writes**, the barrier is a DB-enforced uniqueness constraint, with the application catching the constraint-violation error as its idempotency path.
- For **async state transitions**, the barrier is a timed grace window with a fallback path that fires when the expected transition never resolves.
- For **dependency loading**, the barrier is synchronous top-of-module loading, so the dependent code cannot run before its preconditions are met.

The unifying mental model: **temporal assumptions about state are forged premises under concurrency.** Make the precondition structural, not implicit.

---

## Shape 1 · Concurrent write race · DB-enforced uniqueness

### Origin

PR #100 · `max(version)+1` race in the artifact version write path. Two concurrent reruns of the same agent both read `max(version)=N` and both attempt to insert `version=N+1`. Without a uniqueness constraint, both writes succeed and the artifact rowset diverges.

### The race shape (anti-pattern)

```js
// BAD · application-level race guard
const r = await fetch(`${supaUrl}/rest/v1/artifacts?...&select=version&order=version.desc&limit=1`);
const rows = await r.json();
const nextVersion = (rows?.[0]?.version || 0) + 1;
await fetch(`${supaUrl}/rest/v1/artifacts`, {
  method: 'POST',
  body: JSON.stringify({ ..., version: nextVersion }),
});
```

Under N concurrent calls, all N read the same `max(version)` and all N attempt to insert the same `nextVersion`. The application has no way to detect the collision.

### The cure shape (DB-enforced)

```sql
-- The structural barrier: a unique constraint at the DB layer
CREATE UNIQUE INDEX artifacts_user_type_version_unique
  ON artifacts (user_id, artifact_type, version);
```

```js
// GOOD · catch 23505 (Postgres unique_violation) as the idempotency path
try {
  await preInsertArtifact({ ..., version: nextVersion });
} catch (e) {
  const msg = (e?.message || '').toLowerCase();
  if (msg.includes('23505') || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    // Idempotent skip · another concurrent caller won the race
    return { idempotent: true };
  }
  throw e; // Don't swallow other errors
}
```

The chapter-2 chain-trigger path already uses this exact shape at `api/_lib/chain-trigger.js:241` against the partial unique index from migration 016 (`dispatch_jobs (chain_id, agent_slug) WHERE kind='chain'`). The `artifacts`-table extension is a forward reference from the step 1A audit (see hardening report §8).

### Invariant statement

> No two `agent_runs` rows can race-write the same `(artifact_id, version)` tuple under concurrent triggers.

Enforced by `tests/chapter-03/invariants-version-race.mjs` which spawns N concurrent regenerate calls against a fresh test user and asserts post-condition uniqueness.

### Loose principle

**Read-then-write is a race under concurrency.** Move the contention to the DB layer. The application becomes the idempotency-handler, not the contention-arbiter.

---

## Shape 2 · Async state-transition grace race · timed grace + fallback

### Origin

PR #107 · SUBSCRIBED grace timeout in the Realtime subscribe path. The Supabase Realtime client's `subscribe()` callback emits `SUBSCRIBED` when the channel connects. Without a grace timeout, a hung WebSocket upgrade (firewall, captive portal, blocked port) leaves the consumer in `null` state indefinitely.

### The race shape (anti-pattern)

```js
// BAD · no grace window on the async transition
channel.subscribe(status => {
  if (status === 'SUBSCRIBED') setState('realtime');
  else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setState('poll');
});
// If none of the listed statuses ever fire, state stays null forever
```

The SDK does not guarantee that `CHANNEL_ERROR` fires on every failure mode. Captive portals, blocked WebSockets, and silent network drops can hang the channel without surfacing any callback at all.

### The cure shape (timed grace)

```js
// GOOD · grace window with explicit fallback
const SUBSCRIBED_TIMEOUT_MS = 10_000;
let subscribedFired = false;
const subscribedTimeout = setTimeout(() => {
  if (!subscribedFired) setState('poll');
}, SUBSCRIBED_TIMEOUT_MS);

channel.subscribe(status => {
  if (status === 'SUBSCRIBED') {
    subscribedFired = true;
    clearTimeout(subscribedTimeout);
    setState('realtime');
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    subscribedFired = true;
    clearTimeout(subscribedTimeout);
    setState('poll');
  }
});
```

The pattern is at `js/qb-realtime-manager.js:31,79-82,104-112`. Both terminal paths (SUBSCRIBED and ERROR-class) clear the timeout to prevent the fallback firing after a legitimate transition.

### Invariant statement

> No Realtime-dependent code path remains in null state past the grace window. Either SUBSCRIBED fires within 10 seconds, or the fallback to 'poll' fires at the grace boundary.

Enforced by `tests/chapter-03/invariants-subscribe-grace.mjs` which simulates a hung-SUBSCRIBED scenario and asserts the state transitions through the grace boundary into 'poll'.

### Loose principle

**Async state-transitions assume the transition fires. Add a grace timeout for every transition that has no SDK-guaranteed terminal callback.** The grace doesn't change the happy path; it changes what happens when the transition never resolves.

---

## Shape 3 · Dependency-loading race · sync top-of-module imports

### Origin

PR #115 · agent registry race in the chain-trigger path. The `triggerChainIfReady()` function enumerates downstream agents from the registry via `listAgentSlugs()`. If the registry were populated lazily (e.g., via `await import('../agents/registry.js')` inside the handler), a concurrent dispatch could fire before the registry was fully loaded, causing a missing-slug 400 or worse, a silent skip.

### The race shape (anti-pattern)

```js
// BAD · lazy registry load inside the handler
export async function triggerChain({ upstreamSlug }) {
  const { AGENTS, listAgentSlugs } = await import('../../agents/registry.js');
  const candidates = listAgentSlugs().filter(slug => /* ... */);
  // First concurrent caller may resolve the import; subsequent callers
  // may see a partial registry view depending on bundler/runtime semantics
}
```

In Edge runtimes with cold-start parallelism, two concurrent invocations can both trigger the lazy import. Depending on how the bundler resolves the deferred module, one or both can see a partially-initialized registry view.

### The cure shape (sync top-of-module)

```js
// GOOD · sync import at module top, no lazy paths
import { AGENTS, listAgentSlugs } from '../../agents/registry.js';
import { validateAgentMeta } from '../../agents/contract.js';

// The registry module's TOP-LEVEL code MUST be synchronous:
// - Reads agent META objects
// - Calls validateAgentMeta() on each
// - Builds the AGENTS map
// - Exports
// No top-level await. No lazy module loading.

export async function triggerChain({ upstreamSlug }) {
  // Registry is fully loaded by the time the handler is invoked
  const candidates = listAgentSlugs().filter(slug => /* ... */);
  // ...
}
```

The pattern is at `api/agents/run.js:37`, `api/_lib/chain-trigger.js:22`, and `api/lock-foundation.js:46`. All registry reads use the statically-imported `AGENTS` map.

The `agents/contract.js` validator runs at registry load (`agents/registry.js` module body), so any META violation surfaces at module load, before the first dispatch.

### Invariant statement

> No dispatch can resolve an agent slug from an incompletely-loaded registry. Equivalent: if the dispatch handler is reachable, the registry is fully populated.

Enforced by `tests/chapter-03/invariants-registry-race.mjs` which asserts that `AGENTS` is non-empty and `listAgentSlugs()` returns a stable set across N concurrent dispatch simulations.

### Loose principle

**Lazy module loading is a race.** When the module is a contract surface (registry, schema definitions, type validators), load it synchronously at module top. The cost is one-time cold-start latency; the gain is structural elimination of the load-vs-use race.

---

## The unifying model

The three shapes are layers of the same anti-pattern:

| Layer | Anti-pattern | Cure |
|---|---|---|
| Data layer (writes) | `read max → compute next → write` | DB unique constraint + `23505` catch |
| Connection layer (transitions) | `subscribe(callback)` | Grace timeout + fallback path |
| Module layer (dependencies) | `await import(deferred)` | Sync top-of-module import |

Each anti-pattern shares the same logical flaw: **the code assumes the precondition holds when the dependent action runs.** Under concurrency, this assumption is false. The cure converts the assumption into a structural barrier that holds even when the original assumption fails.

---

## When NOT to apply

- **Single-writer scenarios.** A cron job with no parallel scheduling does not need a DB constraint; the application-level read-then-write is safe.
- **Synchronous SDK transitions.** A library that guarantees a terminal callback (success or error, always one of them) does not need a grace timeout; the SDK contract is the barrier.
- **Module loading that has no cross-call dependency.** A utility function with no shared state does not need sync import; lazy is fine.

The discipline applies when concurrency, asynchrony, or both are in play. Identify the temporal assumption, then convert it.

---

## Gotchas

- **Catch the right error code.** The `23505` catch must check the exact error substring; broad catches swallow unrelated errors. The chain-trigger pattern at `api/_lib/chain-trigger.js:240-248` checks `'23505'` OR `'duplicate key'` OR `'unique constraint'` (substring match on the lowercased message) and explicitly falls through other errors to console.error + continue.
- **Clear the grace timeout on EVERY terminal path.** Forgetting to `clearTimeout` on the SUBSCRIBED path means the fallback fires after the legitimate connection. The pattern at `qb-realtime-manager.js:104-112` clears in both the SUBSCRIBED and ERROR-class branches.
- **No top-level await in registry-class modules.** Top-level await silently makes the import deferred in some runtimes. Use a `(function init() { ... })()` IIFE if you need init logic at module load.
- **The DB constraint must match the application assumption.** If the application computes `max(version)+1` per `(user_id, artifact_type)`, the unique constraint must be on `(user_id, artifact_type, version)`. Mismatched scoping leaves a hole.

---

## Cross-references

- `docs/patterns/schema-compliance.md` · the related discipline for write-site error surfacing (the `23505` catch is meaningless if the write site swallows the error response silently).
- `docs/patterns/harness-seed-schema-discipline.md` · the test-harness ancestor of schema-compliance, validated under chapter-2 step 11C.
- `docs/patterns/qb-realtime-manager-pattern.md` · the broader Realtime architecture that hosts the grace-timeout pattern.
- `chapter-03/step-1-hardening-report.md` §6 · the class-of-bug ledger that drove this consolidation.
