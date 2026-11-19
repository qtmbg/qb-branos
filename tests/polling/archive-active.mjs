// No live database: a stale queued artifact must not keep idle polling alive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/artifacts/index.js';

test('archive activity follows its dispatch, including stale queued artifacts', async t => {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']) {
    const old = process.env[name];
    process.env[name] = name === 'SUPABASE_URL' ? 'https://database.invalid' : 'test';
    t.after(() => { if (old === undefined) delete process.env[name]; else process.env[name] = old; });
  }
  let dispatchStatus = 'completed';
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const u = new URL(url); calls.push(u.pathname);
    let body;
    if (u.pathname === '/auth/v1/user') body = { id: 'user-1' };
    else if (u.pathname === '/rest/v1/profiles') body = [{ id: 'user-1', tier: 'starter' }];
    else if (u.pathname === '/rest/v1/artifacts') body = [{ id: 'artifact-1', dispatch_id: 'dispatch-1', status: 'queued' }];
    else if (u.pathname === '/rest/v1/dispatch_jobs') body = [{ id: 'dispatch-1', status: dispatchStatus }];
    else throw Error(`Unexpected request: ${u}`);
    return Response.json(body);
  });
  async function read() {
    return (await handler(new Request('https://app.invalid/api/artifacts?mode=chains', {
      headers: { Authorization: 'Bearer test' },
    }))).json();
  }
  assert.equal((await read()).has_active_jobs, false);
  dispatchStatus = 'producing';
  assert.equal((await read()).has_active_jobs, true);
  assert.equal(calls.filter(p => p === '/rest/v1/dispatch_jobs').length, 2, 'uses the existing dispatch read');
});
