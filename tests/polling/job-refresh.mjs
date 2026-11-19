import { test } from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../../js/qb-job-refresh.js').catch(() => ({}));
test('bounded job refresh is available', () => assert.equal(typeof mod.createJobRefresh, 'function'));

if (mod.createJobRefresh) {
  const { createJobRefresh } = mod;
  function harness(t, options = {}) {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
    const doc = new EventTarget();
    doc.hidden = false;
    let calls = [];
    const refresh = options.refresh || (async () => false);
    const watcher = createJobRefresh({
      document: doc, ...options,
      refresh: async () => { calls.push(Date.now()); return refresh(); },
    });
    async function advance(ms) {
      t.mock.timers.tick(ms);
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    t.after(() => watcher.destroy());
    return { watcher, calls, advance, doc };
  }
  test('idle polling starts at 60 seconds, doubles after three empty replies, stops at ten minutes', async t => {
    const h = harness(t);
    h.watcher.setMode('poll');
    for (const ms of [60_000, 60_000, 60_000, 120_000, 240_000, 60_000, 600_000]) await h.advance(ms);
    assert.deepEqual(h.calls, [60_000, 120_000, 180_000, 300_000, 540_000]);
    h.watcher.setMode('realtime'); h.watcher.setMode('poll');
    await h.advance(60_000);
    assert.equal(h.calls.length, 5, 'reconnect does not restart an expired idle session');
    await h.watcher.refresh({ restartIdle: false });
    await h.advance(60_000);
    assert.equal(h.calls.length, 6, 'catch-up reads do not restart expired timers');
  });
  test('Realtime uses events without periodic reads and can wake an idle watcher', async t => {
    const h = harness(t);
    h.watcher.setMode('realtime');
    await h.advance(900_000);
    assert.equal(h.calls.length, 0);
    await h.watcher.refresh();
    assert.equal(h.calls.length, 1);
    h.watcher.setMode('poll');
    await h.advance(60_000);
    assert.equal(h.calls.length, 2);
  });
  test('active jobs keep their cadence; completion starts a new idle window', async t => {
    let active = true;
    const h = harness(t, { initialActive: true, refresh: async () => active });
    h.watcher.setMode('poll');
    await h.advance(30_000);
    active = false;
    await h.advance(30_000);
    await h.advance(59_999);
    assert.equal(h.calls.length, 2);
    await h.advance(1);
    assert.equal(h.calls.length, 3);
  });
  test('hidden tabs do no polling and a remount can destroy all timers', async t => {
    const h = harness(t);
    h.watcher.setMode('poll');
    h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
    await h.advance(120_000);
    assert.equal(h.calls.length, 0);
    h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange'));
    await h.advance(60_000);
    assert.equal(h.calls.length, 1);
    h.watcher.destroy();
    await h.advance(900_000);
    await h.watcher.refresh();
    assert.equal(h.calls.length, 1);
  });
  test('network errors back off and expire instead of retrying forever', async t => {
    const h = harness(t, { refresh: async () => { throw Error('offline'); } });
    h.watcher.setMode('poll');
    for (const ms of [60_000, 60_000, 60_000, 120_000, 240_000, 60_000, 600_000]) await h.advance(ms);
    assert.deepEqual(h.calls, [60_000, 120_000, 180_000, 300_000, 540_000]);
  });
  test('slow responses cannot overlap and finishing after destroy cannot rearm', async t => {
    let release;
    const h = harness(t, { refresh: () => new Promise(resolve => { release = resolve; }) });
    h.watcher.setMode('poll');
    await h.advance(60_000);
    const duplicate = h.watcher.refresh();
    await h.advance(60_000);
    assert.equal(h.calls.length, 1);
    h.watcher.destroy(); release(false); await duplicate;
    await h.advance(900_000);
    assert.equal(h.calls.length, 1);
  });
}
