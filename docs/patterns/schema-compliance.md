# Pattern · schema-compliance · check `r.ok` at every write site, throw with body

**Origin:** chapter 2, step 8 · PR #116 (the production runtime's schema-compliance fix). Extends and broadens `docs/patterns/harness-seed-schema-discipline.md` from test-harness seeds to all production write call sites.

**Linked invariant harness:** `tests/chapter-03/invariants-schema-compliance.mjs`.

**Cross-reference:** `docs/patterns/race-discipline.md` · the `23505` catch in the race-discipline pattern is meaningless if the write site swallows the error response silently. The two disciplines are siblings.

---

## The general shape

Every HTTP write call (POST / PATCH / PUT / DELETE) to a backing store can fail at the DB layer with the HTTP layer reporting "success." The default behavior of most fetch-based clients is to NOT throw on 4xx/5xx — the response is returned, the call site has to read `r.ok` (or `r.status`) to know what happened.

**The trap:** write succeeds at the HTTP layer (no exception thrown), but the DB rejected the row (400 returned with the error in the body), and the application proceeds as if the write succeeded.

**The cure:** every write site checks `r.ok` before assuming success, and on failure throws with the response body so the failing constraint, column, or check appears in the error message.

This is the production-runtime sibling of the harness-seed pattern. The harness pattern protects test fixtures from forged premises; this pattern protects production state from the same trap.

---

## The contract

Every write site MUST satisfy three properties:

1. **Check `r.ok` immediately after the fetch resolves.** No code path is allowed to consume the response (parse JSON, log, branch on data) before the status check.
2. **On `!r.ok`, read the response body before throwing.** Include the body (sliced to a reasonable length) in the error message. The failing constraint code, column name, or validator output should appear in the error.
3. **Throw, do not log-and-continue.** Silent log-and-return is the original anti-pattern. The caller must see the failure or the seam re-opens.

---

## The shape (anti-pattern · do not do this)

```js
// BAD · the call returns the response, the call site never checks
async function patchArtifact({ supaUrl, serviceKey, artifactId, patch }) {
  await fetch(
    `${supaUrl}/rest/v1/artifacts?id=eq.${encodeURIComponent(artifactId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }
  );
  // No r.ok check. A 400 from PostgREST (NOT NULL violation, enum
  // mismatch, RLS reject) is invisible to the caller. The function
  // returns void as if the write succeeded.
}
```

The above pattern appears in chapter-2 production helpers (`api/agents/run.js` `patchArtifact`, `closeAgentRun`, `propagateDispatchAgentVersion`, `settleDispatch`). The chapter-2 audit (`chapter-03/step-1-hardening-report.md` §2.4) names these as silent-fail surfaces. The forward reference in the audit (§8) tracks the production-site cleanup.

---

## The cure shape

```js
// GOOD · canonical write wrapper
async function patchArtifact({ supaUrl, serviceKey, artifactId, patch }) {
  const r = await fetch(
    `${supaUrl}/rest/v1/artifacts?id=eq.${encodeURIComponent(artifactId)}`,
    {
      method: 'PATCH',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }
  );
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`patchArtifact failed: ${r.status} ${body.slice(0, 200)}`);
  }
  // PATCH with Prefer: return=minimal returns 204 No Content · no body to parse
}
```

The pattern: `if (!r.ok) { const body = await r.text().catch(() => ''); throw new Error('<op> failed: <status> <body-slice>'); }`

---

## Why the trap is friendly · why the discipline is hard

The trap is friendly because **most HTTP clients do NOT throw on non-2xx by default.** `fetch()` resolves the promise on any response; only network errors (DNS failure, connection refused) cause rejections. This is by design — it lets the caller decide how to handle 4xx.

The discipline is hard because **the failure mode is invisible at the call site.** The function returns. The artifact PATCH "succeeded" as far as the calling code can tell. The state divergence only shows up when a downstream consumer reads the row and sees stale data — at which point the original write site is far up the stack.

The chapter-2 step 11C origin (`docs/patterns/harness-seed-schema-discipline.md`) describes the same trap at the harness layer: ~30 minutes of debugging a "client rendering bug" that turned out to be a silently-rejected seed insert. The production-runtime version of the trap is worse because the broken state lives in the user's actual database, not a discardable test fixture.

---

## Enum and check constraint awareness

PostgreSQL's schema-defined enums and check constraints reject values silently to the application if the call site doesn't check the response. Common examples in this codebase:

- `artifacts.status` is a check-constrained enum (`'queued' | 'generating' | 'delivered' | 'failed'`). PATCH with `status: 'unknown'` returns 400 with `23514` (check_violation). Silent.
- `agent_runs.status` similarly constrained.
- `dispatch_jobs.kind` constrained to `'lock' | 'chain' | 'regenerate'`. Invalid values 23514.
- NOT NULL columns (`artifacts.content`, `artifacts.artifact_type`, `dispatch_jobs.user_id`). NULL inserts return 400 with `23502` (not_null_violation). Silent.
- Foreign key constraints (`artifacts.user_id → profiles.id`, `agent_runs.artifact_id → artifacts.id`). FK violations return 400 with `23503`. Silent.

The chapter-2 step-11C `content: null` insertion was 23502 silent. The discipline of checking `r.ok` and including the body would have surfaced the exact column in the error.

---

## The invariant

> No insert/patch call site assumes success without reading `r.ok`. Every failure surfaces with the response body in the thrown error.

Enforced by `tests/chapter-03/invariants-schema-compliance.mjs`. The harness sends a deliberately-malformed insert to a chapter-2 write surface (e.g., `artifacts` with an invalid `status` enum value) and asserts:

1. The wrapper surfaces the 400 explicitly (does not silently return).
2. The thrown error includes the response body (the constraint code and the column name should appear).
3. No application state was mutated (the bad insert did not partially land).

---

## When NOT to apply

- **Best-effort fire-and-forget calls** where the caller has explicitly declared that failure is non-blocking and acceptable. Example: the chapter-2 operator-notify path at `api/agents/run.js:486-493` is intentionally non-blocking — config_missing has already been surfaced via the response, the operator email is supplementary. These call sites should be EXPLICITLY annotated with a comment naming the "best-effort, failures ignored" contract, so future readers know the missing `r.ok` check is deliberate.
- **Read operations (GET).** The discipline applies to writes. GETs have their own error handling needs but don't produce the silent-state-divergence trap.
- **Operations where a non-OK response is the EXPECTED behavior under test.** Race-discipline §1 catches `23505` as the idempotency path. That's an explicit non-throw path with the same shape; the discipline is to read `r.ok` and CHOOSE to convert to a successful return based on the error code, not to ignore the response.

---

## Gotchas

- **The throw must include the body.** `throw new Error('patchArtifact failed: 400')` is almost useless. `throw new Error('patchArtifact failed: 400 {"code":"23514","details":"new row...","hint":null}')` tells you the failing constraint in one line.
- **Slice the body.** Huge HTML 500 error pages flood logs if logged verbatim. `body.slice(0, 200)` keeps the diagnostic readable. The exact slice length is a comfort knob; 200-300 chars is usually enough for PostgREST errors.
- **PostgREST status codes:** 201 on INSERT, 200 or 204 on PATCH/DELETE depending on the `Prefer` header, 200 on GET. All 2xx are `r.ok=true`. Don't compare to a specific status code.
- **`Prefer: return=minimal`** on PATCH/DELETE returns 204 with no body. Slightly faster. Does not change the `r.ok` pattern.
- **Don't double-await the body.** `const body = await r.text();` consumes the stream once. If the response was already JSON-parsed, the body is gone. Always check `r.ok` first, then conditionally read the body.
- **`r.text().catch(() => '')`** is the safe variant when the body might be unreadable (network drop after headers). The catch swallows the body-read error so the throw still surfaces the status code at minimum.

---

## Application sites in this codebase

### Already compliant

- All `tests/chapter-02/*.mjs` seed wrappers (per the harness-seed discipline).
- `chain-trigger.js:240-248` (the `23505` catch is the explicit-handle variant).

### Forward-referenced (chapter-3 cleanup step)

Per `chapter-03/step-1-hardening-report.md` §8, forward ref 2:

- `api/agents/run.js:259-268` · `patchArtifact` (silent)
- `api/agents/run.js:247-257` · `closeAgentRun` (silent)
- `api/agents/run.js:231-245` · `openAgentRun` (logs and returns null, no throw)
- `api/agents/run.js:270-293` · `propagateDispatchAgentVersion` (silent best-effort)
- `api/agents/run.js:295-333` · `settleDispatch` (silent best-effort)

The cleanup step (not step 1 · Fence 2) will convert each of these to the canonical wrapper shape, OR explicitly annotate the silent paths as deliberate best-effort with the documented contract.

---

## Cross-references

- `docs/patterns/harness-seed-schema-discipline.md` · the test-harness ancestor. Same discipline, applied at seed-time.
- `docs/patterns/race-discipline.md` · the sibling discipline. The `23505` catch only works if the write surfaces the response.
- `chapter-03/step-1-hardening-report.md` §2.4 + §6 + §8 · the audit findings that drove this consolidation and named the forward-referenced cleanup sites.
