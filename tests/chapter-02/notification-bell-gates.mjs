/* Chapter 2 · Step 6D acceptance gates (all five).
 *
 * Single Playwright harness against prod. Creates one signed-in test
 * user, runs five gates sequentially, cleans up.
 *
 * Gates per chapter-02/step-6-spec.md §7.5:
 *   1. DOM probe · bell mounted on /agents, /foundation, /archive, and
 *      the scan continuation surface (signal-scan.html). Null on
 *      non-mount surfaces (marketing pages, signed-out routes).
 *   2. Empty state · zero notifications · no badge + empty-state copy.
 *   3. Unread state · two seeded notifications · badge count 2.
 *   4. Mark-read · click row → POST observed → badge decrements →
 *      persisted state on re-poll.
 *   5. Visibility-aware suppression · 60 s backgrounded shows zero
 *      poll requests · foreground fires one immediate poll + resumes
 *      interval.
 *
 * Usage:
 *   node tests/chapter-02/notification-bell-gates.mjs
 *
 * Reads /tmp/.env.qb-branos.live-backup. Requires playwright in
 * node_modules (already installed for the seed-and-capture script).
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
const BASE         = process.env.BELL_BASE || 'https://quantumbranding.ai';

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

const PASSWORD = 'qbverify-bell-' + Math.random().toString(36).slice(2, 10) + '-X1!';

const MOUNT_SURFACES   = ['/agents', '/foundation', '/archive', '/scan'];
const NONMOUNT_SURFACES = ['/', '/qbp', '/account'];

async function createUser() {
  const ts = Date.now();
  const email = `nizzar.ben+s6d-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s6d' } }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function signIn(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('sign-in failed: ' + JSON.stringify(d));
  return { token: d.access_token, refreshToken: d.refresh_token };
}

async function setProfile(userId, patch) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function seedNotifications(userId, rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify(rows.map(row => ({ user_id: userId, ...row }))),
  });
  if (!r.ok) throw new Error('seed notifications failed: ' + (await r.text()));
  return await r.json();
}

async function deleteUser(userId) {
  // Cascade · auth user delete drops profile + notifications via FK.
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function newContext(browser, userId, email, session) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(({ session, userId, email }) => {
    localStorage.setItem('qb_session', JSON.stringify({
      token: session.token,
      refreshToken: session.refreshToken,
      userId,
      email,
      tier: 'starter',
      first_name: 'Verification',
    }));
  }, { session, userId, email });
  return context;
}

function logResult(gate, passed, detail) {
  const label = passed ? 'PASS' : 'FAIL';
  console.log(`Gate ${gate}: ${label}  ${detail || ''}`);
}

// ─── Gate 1 · DOM probe ────────────────────────────────────────────────────
async function gate1DomProbe(browser, userId, email, session) {
  console.log('\n── Gate 1 · DOM probe across mount + non-mount surfaces ──');
  const context = await newContext(browser, userId, email, session);
  const page = await context.newPage();

  const results = { mount: {}, nonmount: {} };

  for (const path of MOUNT_SURFACES) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(2_000); // give bell mount + first fetch room
      const mounted = await page.evaluate(() => {
        const el = document.querySelector('.qb-notification-bell[data-mounted="true"]');
        return el ? true : false;
      });
      results.mount[path] = mounted;
      console.log(`  ${path}: bell mounted = ${mounted}`);
    } catch (e) {
      results.mount[path] = `error: ${e.message}`;
      console.log(`  ${path}: error · ${e.message}`);
    }
  }

  for (const path of NONMOUNT_SURFACES) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(1_500);
      const mounted = await page.evaluate(() => {
        const el = document.querySelector('.qb-notification-bell[data-mounted="true"]');
        return el ? true : false;
      });
      results.nonmount[path] = mounted;
      console.log(`  ${path}: bell mounted = ${mounted}  (expect false)`);
    } catch (e) {
      results.nonmount[path] = `error: ${e.message}`;
      console.log(`  ${path}: error · ${e.message}`);
    }
  }

  await context.close();
  const allMountOK = MOUNT_SURFACES.every(p => results.mount[p] === true);
  const allNonmountOK = NONMOUNT_SURFACES.every(p => results.nonmount[p] === false);
  const passed = allMountOK && allNonmountOK;
  logResult(1, passed, `mount ${MOUNT_SURFACES.filter(p => results.mount[p] === true).length}/${MOUNT_SURFACES.length}, nonmount ${NONMOUNT_SURFACES.filter(p => results.nonmount[p] === false).length}/${NONMOUNT_SURFACES.length}`);
  return { passed, results };
}

// ─── Gate 2 · empty state ──────────────────────────────────────────────────
async function gate2EmptyState(browser, userId, email, session) {
  console.log('\n── Gate 2 · empty state · no badge + correct copy ──');
  const context = await newContext(browser, userId, email, session);
  const page = await context.newPage();
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2_500); // first poll fetch must complete

  const observed = await page.evaluate(() => {
    const root = document.querySelector('.qb-notification-bell[data-mounted="true"]');
    if (!root) return { mounted: false };
    const badge = root.querySelector('.qb-notification-bell_badge');
    const trigger = root.querySelector('.qb-notification-bell_trigger');
    return {
      mounted: true,
      badgeDataCount: badge?.getAttribute('data-count') || null,
      badgeText: badge?.textContent || '',
      triggerAriaLabel: trigger?.getAttribute('aria-label') || '',
    };
  });
  console.log(`  pre-click: ${JSON.stringify(observed)}`);

  // Click trigger to reveal dropdown + empty-state copy
  await page.click('.qb-notification-bell_trigger');
  await page.waitForTimeout(500);
  const emptyCopy = await page.evaluate(() => {
    const el = document.querySelector('.qb-notification-bell_empty');
    return el ? el.textContent.trim() : null;
  });
  console.log(`  empty-state copy: ${JSON.stringify(emptyCopy)}`);

  await context.close();
  const expectedCopy = 'No notifications. The system flags here when something needs your attention.';
  const noBadge = observed.badgeDataCount === '0' || observed.badgeDataCount === null || observed.badgeText === '' || observed.badgeText === '0';
  const correctCopy = emptyCopy && emptyCopy.includes('No notifications');
  const passed = observed.mounted && noBadge && correctCopy;
  logResult(2, passed, `mounted=${observed.mounted} no-badge=${noBadge} copy-match=${correctCopy}`);
  return { passed, observed, emptyCopy, expectedCopy };
}

// ─── Gate 3 · unread state ─────────────────────────────────────────────────
async function gate3Unread(browser, userId, email, session) {
  console.log('\n── Gate 3 · two seeded notifications · badge count 2 ──');

  // Seed two notifications rows (kind: dispatch_failed) with read_at=null
  const seeded = await seedNotifications(userId, [
    { kind: 'dispatch_failed', read_at: null, payload: { dispatch_id: '00000000-0000-0000-0000-000000000001', agent_slug: 'soul_map_synthesizer', reason: 'verification seed · gate 3' } },
    { kind: 'dispatch_failed', read_at: null, payload: { dispatch_id: '00000000-0000-0000-0000-000000000002', agent_slug: 'visual_dna_synthesizer', reason: 'verification seed · gate 3 second row' } },
  ]);
  console.log(`  seeded ${seeded.length} rows`);

  const context = await newContext(browser, userId, email, session);
  const page = await context.newPage();
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2_500);

  const observed = await page.evaluate(() => {
    const badge = document.querySelector('.qb-notification-bell_badge');
    return {
      badgeDataCount: badge?.getAttribute('data-count') || null,
      badgeText: badge?.textContent || '',
    };
  });
  console.log(`  badge: ${JSON.stringify(observed)}`);

  await page.click('.qb-notification-bell_trigger');
  await page.waitForTimeout(400);
  const rowCount = await page.evaluate(() => document.querySelectorAll('.qb-notification-bell_item').length);
  console.log(`  dropdown rows: ${rowCount}`);

  await context.close();
  const passed = (observed.badgeDataCount === '2' || observed.badgeText === '2') && rowCount === 2;
  logResult(3, passed, `badge=${observed.badgeText} rows=${rowCount}`);
  return { passed, observed, rowCount, seeded };
}

// ─── Gate 4 · mark-read POST + UI update + persistence ─────────────────────
async function gate4MarkRead(browser, userId, email, session, seededIds) {
  console.log('\n── Gate 4 · mark-read · POST + UI update + persistence ──');

  const context = await newContext(browser, userId, email, session);
  const page = await context.newPage();

  // Capture all network requests so we can find the POST
  const networkRequests = [];
  page.on('request', req => {
    if (req.url().includes('/api/notifications')) {
      networkRequests.push({ method: req.method(), url: req.url(), ts: Date.now() });
    }
  });

  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2_500);

  await page.click('.qb-notification-bell_trigger');
  await page.waitForTimeout(300);

  // Click first row · capture target id
  const firstRowId = await page.evaluate(() => {
    const el = document.querySelector('.qb-notification-bell_item');
    return el?.getAttribute('data-id') || null;
  });
  console.log(`  clicking first row · id=${firstRowId}`);
  await page.click('.qb-notification-bell_item:first-child');
  await page.waitForTimeout(1_500); // let POST fire + state update

  const postObserved = networkRequests.find(r => r.method === 'POST' && r.url.includes('/read'));
  console.log(`  POST observed: ${postObserved ? postObserved.url : 'no'}`);

  // Re-poll · navigate again to confirm persistence
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2_500);
  const reread = await page.evaluate(() => {
    const badge = document.querySelector('.qb-notification-bell_badge');
    return { badgeDataCount: badge?.getAttribute('data-count') || null, badgeText: badge?.textContent || '' };
  });
  console.log(`  badge after re-poll: ${JSON.stringify(reread)}`);

  await context.close();
  const passed = !!postObserved && (reread.badgeDataCount === '1' || reread.badgeText === '1');
  logResult(4, passed, `post-observed=${!!postObserved} badge-after-rerpoll=${reread.badgeText}`);
  return { passed, postObserved, reread, networkRequests };
}

// ─── Gate 5 · visibility-aware suppression ─────────────────────────────────
async function gate5Visibility(browser, userId, email, session) {
  console.log('\n── Gate 5 · visibility-aware suppression ──');
  console.log('  (60 s hidden window · this takes ~75 s wall time)');

  const context = await newContext(browser, userId, email, session);
  const page = await context.newPage();

  const networkRequests = [];
  page.on('request', req => {
    if (req.url().includes('/api/notifications') && req.method() === 'GET') {
      networkRequests.push({ url: req.url(), ts: Date.now() });
    }
  });

  // Use CDP to set the page's true visibility · Object.defineProperty
  // does not flip the underlying state that document.hidden reads from
  // on Chromium. setVisibilityChanged is the correct lever.
  const client = await context.newCDPSession(page);

  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2_500); // initial poll
  const initialCount = networkRequests.length;
  console.log(`  initial poll requests after mount + 2.5s: ${initialCount}`);

  // Hide tab · CDP path
  await client.send('Emulation.setPageVisibility', { visibility: 'hidden' }).catch(async (e) => {
    // Older CDP versions use a different method name; fall back to direct
    // event dispatch + property override.
    console.log(`  CDP setPageVisibility unavailable (${e.message}); falling back to JS override`);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  });
  const hideStart = Date.now();

  // Read document.hidden inside the page to confirm the override took
  const hiddenObserved = await page.evaluate(() => ({
    hidden: document.hidden,
    visibilityState: document.visibilityState,
  }));
  console.log(`  hidden window opened · document.hidden=${hiddenObserved.hidden} visibilityState=${hiddenObserved.visibilityState}`);

  // Wait 60 s · zero polls expected
  await page.waitForTimeout(60_000);
  const hiddenWindowCount = networkRequests.filter(r => r.ts > hideStart).length;
  console.log(`  poll requests during 60 s hidden window: ${hiddenWindowCount}`);

  // Foreground · expect immediate fetch
  const showStart = Date.now();
  await client.send('Emulation.setPageVisibility', { visibility: 'visible' }).catch(async (e) => {
    console.log(`  CDP fallback for foreground (${e.message})`);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  });
  const visibleObserved = await page.evaluate(() => ({
    hidden: document.hidden,
    visibilityState: document.visibilityState,
  }));
  console.log(`  foreground · document.hidden=${visibleObserved.hidden} visibilityState=${visibleObserved.visibilityState}`);

  await page.waitForTimeout(3_000); // generous window for the immediate fetch to land
  const resumeWindowCount = networkRequests.filter(r => r.ts >= showStart).length;
  console.log(`  poll requests within 3 s of foreground: ${resumeWindowCount} (expect at least 1)`);

  // Dump timing of all captured requests for forensic clarity
  console.log(`  full request timeline (ms relative to hideStart):`);
  for (const r of networkRequests) {
    console.log(`    +${r.ts - hideStart}ms · ${r.url.slice(BASE.length)}`);
  }

  await context.close();
  const passed = hiddenWindowCount === 0 && resumeWindowCount >= 1;
  logResult(5, passed, `hidden=${hiddenWindowCount} immediate-resume=${resumeWindowCount}`);
  return { passed, initialCount, hiddenWindowCount, resumeWindowCount };
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== '0' });
  let user;
  try {
    user = await createUser();
    console.log(`Created test user ${user.id.slice(0, 8)}... · gates against ${BASE}`);
    // Minimal profile state so the surfaces that gate on tier/qbp do not 401/403
    await setProfile(user.id, { tier: 'starter' });
    const session = await signIn(user.email);
    console.log(`Session minted · token ${session.token.slice(0, 20)}...`);

    const g1 = await gate1DomProbe(browser, user.id, user.email, session);
    const g2 = await gate2EmptyState(browser, user.id, user.email, session);
    const g3 = await gate3Unread(browser, user.id, user.email, session);
    const g4 = await gate4MarkRead(browser, user.id, user.email, session, g3.seeded);
    const g5 = await gate5Visibility(browser, user.id, user.email, session);

    console.log('\n── Summary ──────────────────────────────────────────');
    const all = { 1: g1.passed, 2: g2.passed, 3: g3.passed, 4: g4.passed, 5: g5.passed };
    for (const [k, v] of Object.entries(all)) console.log(`  Gate ${k}: ${v ? 'PASS' : 'FAIL'}`);
    const overall = Object.values(all).every(Boolean);
    console.log(`\nOverall: ${overall ? 'PASS · all five gates green' : 'FAIL · at least one gate failed'}`);
    if (!overall) process.exitCode = 1;
  } catch (e) {
    console.error('THREW:', e?.message || e);
    if (e?.stack) console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    if (user?.id) {
      console.log('\ncleanup test user…');
      await deleteUser(user.id);
    }
  }
})();
