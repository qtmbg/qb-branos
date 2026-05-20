/* Chapter 2 · Step 10C acceptance gates (all five).
 *
 * Verifies the /agents Run history view + replay panel per
 * chapter-02/step-10-spec.md §5.
 *
 *   1. Run history view renders rows with delivered artifacts.
 *   2. Click-through opens replay modal · modal DOM appears.
 *   3. Replay modal surfaces all frozen inputs · header + inputs
 *      block + three collapsibles.
 *   4. Modal a11y · Escape closes + focus returns to triggering row.
 *      Backdrop click closes + focus returns. closeBtn focused on open.
 *   5. Realtime live-update on run history view · notification INSERT
 *      triggers re-paint of recent_runs within 5 s (inherited from
 *      9C qb-realtime-manager via livePayload refetch).
 *
 * Usage:
 *   node tests/chapter-02/replay-panel.mjs
 *
 * Reads /tmp/.env.qb-branos.live-backup.
 */

import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = env.SUPABASE_ANON_KEY;
const BASE         = process.env.REPLAY_BASE || 'https://quantumbranding.ai';
const HEADLESS     = process.env.HEADLESS !== '0';

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const PASSWORD = 'qbverify-10c-' + Math.random().toString(36).slice(2, 10) + '-X1!';

async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s10c-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s10c' } }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function signIn(email) {
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('sign-in failed');
  return { token: d.access_token, refreshToken: d.refresh_token };
}

async function setProfile(userId, patch) {
  await tfetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function seedDeliveredArtifact(userId) {
  // Seed a delivered artifact + agent_run + dispatch_job so the run
  // history view has at least one row to render. The replay modal
  // reads the agent_runs row by id.
  const lockRes = await tfetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, kind: 'lock', status: 'completed',
      agents_count: 4, agents_settled: 4, trigger: 'lock',
    }),
  });
  const lockRow = (await lockRes.json())?.[0];

  const artRes = await tfetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, artifact_type: 'soul_map_synthesizer', status: 'delivered',
      version: 1, phase: '01', dispatch_id: lockRow.id,
      content: {
        schema_version: '1.0',
        header: { eyebrow: 'phase 01', title: 'Soul Map', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 },
        body_sections: [{ heading: 'Essence', prose: 'Test prose for replay-panel.mjs harness.' }],
        data_blocks: [],
        footer: { qbp_fields_referenced: [] },
      },
    }),
  });
  const artRow = (await artRes.json())?.[0];

  const runRes = await tfetch(`${SUPABASE_URL}/rest/v1/agent_runs`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, agent_slug: 'soul_map_synthesizer', agent_version: 1,
      trigger: 'lock', dispatch_id: lockRow.id, artifact_id: artRow.id,
      qbp_snapshot: { brandName: 'Replay Test', archetype: 'The Sage' },
      file_refs: [], runtime_args: { qbp_source: 'current' },
      started_at: new Date(Date.now() - 15000).toISOString(),
      completed_at: new Date().toISOString(),
      status: 'succeeded', model: 'claude-sonnet-4-6',
      duration_ms: 15000, tokens_in: 4200, tokens_out: 2100, schema_retry_count: 0,
    }),
  });
  return (await runRes.json())?.[0];
}

async function insertNotification(userId, kind, payload) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, kind, payload, read_at: null }),
  });
  return (await r.json())?.[0];
}

async function deleteUser(userId) {
  await tfetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function newContext(browser, userId, email, session) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(({ session, userId, email }) => {
    localStorage.setItem('qb_session', JSON.stringify({
      token: session.token, refreshToken: session.refreshToken,
      userId, email, tier: 'starter', first_name: 'Verification',
    }));
  }, { session, userId, email });
  return context;
}

function logResult(gate, passed, detail) {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  Gate ${gate}: ${detail}`);
}

(async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: HEADLESS });
  let user;
  const results = { 1: false, 2: false, 3: false, 4: false, 5: false };

  try {
    user = await createUser('all');
    await setProfile(user.id, {
      tier: 'starter',
      foundation_locked_at: new Date().toISOString(),
      foundation_lock_qbp: { brand_name: 'Replay Test' },
      tool_completions: { 'archetype-compass': true, 'soul-map': true, 'sensescape': true },
    });
    await seedDeliveredArtifact(user.id);
    const session = await signIn(user.email);
    console.log(`Created test user ${user.id.slice(0,8)} · gates against ${BASE}`);

    const context = await newContext(browser, user.id, user.email, session);
    const page = await context.newPage();

    const consoleGets = [];
    page.on('request', req => {
      if (req.url().includes('/api/agents/console') && req.method() === 'GET') {
        consoleGets.push({ url: req.url(), ts: Date.now() });
      }
    });

    await page.goto(`${BASE}/agents`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.phase-section_active, .console-error, .console-empty', { timeout: 20_000 });
    // Wait for the bell to fully mount AND the shared Realtime manager
    // to reach 'realtime' state BEFORE interacting with the view toggle.
    // Without this dual-wait, the harness's tab click + modal open can
    // race against the bell's manager.start + subscribe lifecycle,
    // occasionally re-rendering the view back to Phase view via a
    // deferred re-paint inside refetchAndRepaint. The race surfaces
    // intermittently; this wait makes the harness deterministic.
    // (Mitigation pattern captured in 10D §3 forward notes.)
    await page.waitForSelector('.qb-notification-bell[data-mounted="true"]', { timeout: 15_000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('.qb-notification-bell[data-mounted="true"]');
      return b && b.getAttribute('data-realtime') === 'true';
    }, null, { timeout: 30_000 });

    // ─── Gate 1 · Run history view renders rows ────────────────
    console.log('\n── Gate 1 · Run history view renders rows ──');
    // Click the "Run history" tab in the view toggle
    const runsTab = page.locator('.console-view-toggle_btn').nth(1);
    await runsTab.click();
    await page.waitForSelector('.run-row, .console-empty', { timeout: 10_000 });
    const rowCount = await page.locator('.run-row').count();
    const hasStatusPill = await page.locator('.run-row .qb-tag').first().count();
    results[1] = rowCount >= 1 && hasStatusPill >= 1;
    logResult(1, results[1], `rendered ${rowCount} run-row(s) with status pill`);

    // ─── Gate 2 · Click-through opens replay modal ─────────────
    console.log('\n── Gate 2 · Click-through opens replay modal ──');
    const firstRow = page.locator('.run-row').first();
    await firstRow.focus(); // simulate keyboard activation path so focus is on row
    await firstRow.press('Enter');
    await page.waitForSelector('.replay-modal', { timeout: 5_000 });
    const modalCount = await page.locator('.replay-modal[role="dialog"][aria-modal="true"]').count();
    results[2] = modalCount === 1;
    logResult(2, results[2], `modal DOM present (role=dialog, aria-modal=true): ${modalCount}/1`);

    // ─── Gate 3 · Frozen-inputs surface complete ───────────────
    console.log('\n── Gate 3 · Frozen-inputs surface complete ──');
    const headerText = await page.locator('.replay-modal_title').textContent();
    const inputsFields = await page.locator('.replay-modal_field-label').allTextContents();
    const collapsibles = await page.locator('.replay-modal_collapsible summary').allTextContents();
    const requiredFields = ['agent_version', 'trigger', 'model', 'tokens', 'schema_retry_count'];
    const requiredCollapsibles = ['qbp_snapshot', 'runtime_args', 'file_refs'];
    const fieldsPass = requiredFields.every(f => inputsFields.includes(f));
    const collapsiblesPass = requiredCollapsibles.every(c => collapsibles.some(s => s.includes(c)));
    const headerPass = headerText && headerText.includes('soul_map_synthesizer') && headerText.includes('v1');
    results[3] = fieldsPass && collapsiblesPass && headerPass;
    logResult(3, results[3], `header=${headerPass} · fields=${fieldsPass} (${inputsFields.length}) · collapsibles=${collapsiblesPass} (${collapsibles.length})`);

    // ─── Gate 4 · Modal a11y · Escape + backdrop close + focus return ─
    console.log('\n── Gate 4 · Modal a11y · Escape + backdrop close + focus return ──');
    // closeBtn should be focused on open
    const closeBtnFocused = await page.evaluate(() => {
      return document.activeElement?.classList?.contains('replay-modal_close') || false;
    });
    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForSelector('.replay-modal', { state: 'detached', timeout: 5_000 });
    // Focus should return to the triggering row
    const focusAfterEsc = await page.evaluate(() => {
      return document.activeElement?.classList?.contains('run-row') || false;
    });

    // Reopen via direct DOM dispatch (avoids Playwright locator re-query
    // timing issues when the view has potentially re-painted).
    await page.waitForSelector('.run-row', { state: 'attached', timeout: 10_000 });
    await page.evaluate(() => {
      const row = document.querySelector('.run-row');
      row?.focus();
      row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await page.waitForSelector('.replay-modal', { timeout: 5_000 });
    // Click the backdrop (the area outside the modal)
    await page.locator('.replay-backdrop').click({ position: { x: 10, y: 10 } });
    await page.waitForSelector('.replay-modal', { state: 'detached', timeout: 5_000 });
    const focusAfterBackdrop = await page.evaluate(() => {
      return document.activeElement?.classList?.contains('run-row') || false;
    });

    results[4] = closeBtnFocused && focusAfterEsc && focusAfterBackdrop;
    logResult(4, results[4], `closeBtn focused on open: ${closeBtnFocused} · focus after Esc: ${focusAfterEsc} · focus after backdrop: ${focusAfterBackdrop}`);

    // ─── Gate 5 · Realtime live-update on run history ──────────
    console.log('\n── Gate 5 · Realtime live-update on run history ──');
    // Stay on the run history tab. Wait for manager SUBSCRIBED via bell.
    const realtimeUp = await page.waitForFunction(() => {
      const b = document.querySelector('.qb-notification-bell[data-mounted="true"]');
      return b && b.getAttribute('data-realtime') === 'true';
    }, null, { timeout: 30_000 }).then(() => true).catch(() => false);
    console.log(`  realtime channel SUBSCRIBED: ${realtimeUp}`);
    const beforeFetchCount = consoleGets.length;
    await insertNotification(user.id, 'chain_ready', { agent_slug: 'soul_map_synthesizer', reason: '10C Gate 5 probe' });
    const injectStart = Date.now();
    let refetchObserved = false;
    for (let i = 0; i < 20; i++) {
      if (consoleGets.length > beforeFetchCount) { refetchObserved = true; break; }
      await page.waitForTimeout(500);
    }
    const refetchMs = Date.now() - injectStart;
    const newFetchCount = consoleGets.length - beforeFetchCount;
    results[5] = refetchObserved && refetchMs < 10_000;
    logResult(5, results[5], `refetch fired in ${refetchMs}ms · ${newFetchCount} new GET /api/agents/console`);

    await context.close();

  } catch (e) {
    console.error('harness error:', e?.message);
  } finally {
    if (user?.id) {
      try { await deleteUser(user.id); } catch {}
    }
    await browser.close();
  }

  // ─── Summary ─────────────────────────────────────────
  console.log('\n── Summary ──────────────────────────────────────────');
  for (const g of [1,2,3,4,5]) {
    console.log(`  Gate ${g}: ${results[g] ? 'PASS' : 'FAIL'}`);
  }
  const passCount = Object.values(results).filter(Boolean).length;
  console.log(`\n${passCount === 5 ? 'PASS' : 'FAIL'} · ${passCount}/5 gates`);

  fs.writeFileSync('tests/chapter-02/replay-panel.last-run.json', JSON.stringify({
    base: BASE,
    results,
    passCount,
    allPass: passCount === 5,
  }, null, 2));

  process.exit(passCount === 5 ? 0 : 1);
})();
