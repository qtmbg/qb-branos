# Pattern · harness-seed schema discipline · check INSERT/PATCH response status

**Origin:** chapter 2, step 11C (`tests/chapter-02/archive-tree.mjs` first-run FAIL on Gate 4).
**Reinforced at:** step 12C (`foundation-banner.mjs`), step 13A (`e2e-chapter-2.mjs`).

Any Playwright/Node harness that seeds fixture data via Supabase REST mutations MUST check `r.ok` on every response and throw with the response body when the status is non-OK. Silent 400s during seed produce downstream "missing fixture row" failures that look like client bugs but are actually rejected inserts.

## When to use

- Any harness that creates a test user via `/auth/v1/admin/users`.
- Any harness that PATCHes profile state via `/rest/v1/profiles?id=eq.<uuid>`.
- Any harness that seeds artifact / dispatch_jobs / agent_runs rows via `/rest/v1/<table>`.
- Any harness that calls Supabase REST endpoints to set up state before asserting.

## Canonical seed wrapper

```js
async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s${stepTag}-${tag}-${ts}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: `c2-s${stepTag}` } }),
  });
  // Harness-seed schema discipline · check INSERT status
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`createUser failed: ${r.status} ${body.slice(0, 200)}`);
  }
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function setProfile(userId, patch) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`setProfile failed: ${r.status} ${body.slice(0, 200)}`);
  }
}
```

The pattern: `if (!r.ok) throw new Error(`<op> failed: ${r.status} ${body.slice(0, 200)}`);`

## Why this matters · the 11C surfacing

Step 11C's first Gate 4 FAILed because the harness seeded a queued sensescape artifact with `content: null`. The artifacts table has `content NOT NULL`. PostgREST returned `400 Bad Request` with the 23502 error in the response body. The original harness used `await tfetch(...)` without checking `r.ok` · the 400 was silently swallowed. The insert never landed. The Gate 4 assertion ("in-flight chain renders placeholder · queued artifact + is-pending class") then FAILed because there was no queued artifact in the DB.

The investigation cost ~30 minutes because the downstream FAIL ("0 in-flight rows in chain") looks like the renderer is dropping the queued state · a CLIENT bug. The actual cause was the seed had been rejected · a HARNESS bug. The discipline of checking `r.ok` and throwing with body would have surfaced the 23502 NOT NULL violation in the seed call itself, instantly · before any rendering work was done.

## Loose principle

**A silent 400 during seed is a forged premise for every subsequent assertion.** Throw loud, with body. The investigation time saved is far more than the lines of wrapper code cost.

## When NOT to apply

- Read-only harness operations (GETs) · these have their own error handling needs but don't masquerade as client bugs.
- Operations where a non-OK response is the EXPECTED behavior under test (e.g., gate 3 of chain-orchestration verifies that a duplicate insert returns 23505/409 · don't throw in that case, assert on the status).

## Gotchas

- **The throw must include the body.** `throw new Error('createUser failed: 400')` is almost useless · you still don't know WHY it 400'd. `throw new Error('createUser failed: 400 {"code":"23502","details":...}')` tells you the failing column in one line.
- **Slice the body.** Huge HTML 500 error pages will flood the console if you log them verbatim. `body.slice(0, 200)` keeps the diagnostic readable.
- **PostgREST returns 201 on insert, 204 on PATCH/DELETE.** All 2xx are `r.ok=true`. Don't compare to a specific status code.
- **`Prefer: return=minimal`** is the recommended header on PATCH/DELETE · returns 204 with no body, slightly faster, doesn't change the status-check pattern.

## Origin context

Step 11C's archive-tree harness Gate 4 spent the first half hour debugging the in-flight placeholder rendering, eventually surfacing the silent seed-side 400. The fix was two changes: `content: {}` instead of `content: null` (the immediate cause), and the `r.ok` check pattern documented here (the discipline that would have surfaced the immediate cause faster). The discipline propagated forward to step 12C and step 13A · both shipped with the wrapper pattern in place from the start.
