// Local browser integration. API answers and Realtime are simulated;
// no request can reach Supabase or a model provider.
import assert from 'node:assert/strict';
import { serve, launch } from '../i18n/_browser.mjs';

const server = await serve();
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'localhost') return route.abort();
    if (url.pathname === '/polling-test') return route.fulfill({
      contentType: 'text/html', body: '<div id="console"></div><div id="archive"></div>',
    });
    return route.continue();
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://localhost:${server.address().port}/polling-test`);
  await page.clock.install();
  await page.evaluate(async () => {
    const states = new Set(), notifications = new Set();
    let mode = 'realtime';
    window.QBRealtimeManager = {
      start() {},
      onState(cb) { states.add(cb); cb(mode); return () => states.delete(cb); },
      onNotification(cb) { notifications.add(cb); return () => notifications.delete(cb); },
    };
    window.testState = s => { mode = s; states.forEach(cb => cb(s)); };
    window.testNotify = () => notifications.forEach(cb => cb({}));
    window.subscriptionCount = () => notifications.size;
    window.calls = [];
    window.foundationUpdates = 0;
    window.foundationRows = [{ id: 'artifact-1', status: 'generating' }];
    window.consolePayload = { ok: true, user: { foundation_locked_at: '2026-11-01' }, agents: [], recent_runs: [] };
    const archivePayload = { ok: true, chains: [], legacy: [], has_active_jobs: false };
    window.fetch = async url => {
      window.calls.push(String(url));
      return Response.json(String(url).includes('/console') ? window.consolePayload
        : String(url).includes('chains') ? archivePayload : { artifacts: window.foundationRows });
    };
    const { renderConsole } = await import('/js/qb-agents-console.js');
    const { renderArchiveTree } = await import('/js/qb-archive.js');
    const { startArtifactPolling } = await import('/js/qb-foundation.js');
    const opts = { session: { token: 'test' } };
    window.remountConsole = () => renderConsole(document.getElementById('console'), window.consolePayload, opts);
    window.remountConsole();
    renderArchiveTree(document.getElementById('archive'), archivePayload, opts);
    startArtifactPolling({ token: 'test', initialArtifacts: window.foundationRows,
      onUpdate() { window.foundationUpdates++; } });
  });
  await page.waitForFunction(() => calls.length === 3);
  assert.equal(await page.evaluate(() => foundationUpdates), 0, 'unchanged catch-up preserves the lock banner');
  await page.evaluate(() => { calls = []; });
  await page.clock.runFor(60_000);
  assert.equal(await page.evaluate(() => calls.length), 0, 'no periodic reads in Realtime');
  await page.evaluate(() => { foundationRows = [{ id: 'artifact-1', status: 'delivered' }]; testNotify(); });
  await page.waitForFunction(() => foundationUpdates === 1 && subscriptionCount() === 2);
  await page.evaluate(() => { remountConsole(); calls = []; testState('poll'); });
  for (let i = 0; i < 15; i++) await page.clock.runFor(60_000);
  const calls = await page.evaluate(() => calls);
  assert.ok(calls.filter(x => x.includes('/console')).length <= 5);
  assert.ok(calls.filter(x => x.includes('chains')).length <= 5);
  assert.equal(calls.filter(x => x.includes('limit=200')).length, 0, 'foundation stopped after delivery');
  const endCount = calls.length;
  await page.clock.runFor(15 * 60_000);
  assert.equal(await page.evaluate(() => calls.length), endCount, 'idle consumers stay stopped');
  assert.equal(await page.evaluate(() => subscriptionCount()), 2, 'remount did not duplicate subscriptions');
  await page.evaluate(() => testNotify());
  await page.waitForFunction(n => calls.length === n + 2, endCount);
  assert.deepEqual(errors, []);
  console.log(`Polling browser integration passed: Realtime 0 periodic reads; idle 15 min ${endCount} reads across console + archive; next 15 min 0; notifications wake both.`);
} finally {
  await browser.close();
  server.close();
}
