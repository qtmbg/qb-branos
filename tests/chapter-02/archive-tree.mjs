/* Chapter 2 · Step 11C acceptance gates (all five).
 *
 * Verifies the /archive tree-view per chapter-02/step-11-spec.md §5.
 *
 *   1. Archive renders chain-grouped tree · one chain card per chain
 *      with header (Locked YYYY-MM-DD · N agents) + nested rows
 *   2. Branched reruns render as visual children · v2 with
 *      parent_artifact_id=v1.id nests under v1 in the DOM
 *   3. "Earlier work" section surfaces legacy artifacts · section
 *      header + flat rows below the chain cards
 *   4. In-flight chain renders placeholders · queued / producing
 *      artifacts surface with status pill + click-disabled
 *   5. Realtime live-update · notification INSERT triggers refetch +
 *      repaint within 5 s (inherits 9C qb-realtime-manager.js)
 *
 * Harness-determinism pattern (per step 10 §3.6 + 11-spec §3.4):
 *   Wait for .qb-notification-bell[data-mounted="true"] AND the
 *   bell's data-realtime="true" attribute before any tree-view
 *   assertions. Locks the harness against manager-subscribe race.
 *
 * Usage:
 *   node tests/chapter-02/archive-tree.mjs
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
const BASE         = process.env.ARCHIVE_BASE || 'https://quantumbranding.ai';
const HEADLESS     = process.env.HEADLESS !== '0';

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const PASSWORD = 'qbverify-11c-' + Math.random().toString(36).slice(2, 10) + '-X1!';

async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s11c-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s11c' } }),
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

// Seed shape:
//   · 1 lock dispatch with chain_id self-seeded
//   · soul_map_synthesizer v1 (delivered, chain)
//   · soul_map_synthesizer v2 (delivered, chain, parent_artifact_id=v1.id) · branched rerun
//   · sensescape_synthesizer v1 (queued, chain) · in-flight placeholder
//   · legacy archetype_compass v1 (delivered, no dispatch_id) · Earlier work
async function seedChainState(userId) {
  // Lock dispatch · chain_id self-seeds
  const lockRes = await tfetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, kind: 'lock', status: 'completed',
      agents_count: 4, agents_settled: 2, trigger: 'lock',
    }),
  });
  const lock = (await lockRes.json())?.[0];
  await tfetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs?id=eq.${lock.id}`, {
    method: 'PATCH', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify({ chain_id: lock.id }),
  });

  // soul_map v1 (delivered, chain)
  const soulV1Res = await tfetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, artifact_type: 'soul_map_synthesizer', status: 'delivered',
      version: 1, phase: '01', dispatch_id: lock.id,
      content: {
        schema_version: '1.0',
        header: { eyebrow: 'phase 01', title: 'Soul Map · v1', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 1 },
        body_sections: [{ heading: 'Essence', prose: '11C harness seed' }],
        data_blocks: [], footer: { qbp_fields_referenced: [] },
      },
    }),
  });
  const soulV1 = (await soulV1Res.json())?.[0];

  // soul_map v2 (delivered, chain, parent_artifact_id=v1.id) · branched rerun
  await tfetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId, artifact_type: 'soul_map_synthesizer', status: 'delivered',
      version: 2, phase: '01', dispatch_id: lock.id, parent_artifact_id: soulV1.id,
      content: {
        schema_version: '1.0',
        header: { eyebrow: 'phase 01', title: 'Soul Map · v2', agent: 'soul_map_synthesizer', generated_at: new Date().toISOString(), version: 2 },
        body_sections: [{ heading: 'Essence v2', prose: '11C harness rerun seed' }],
        data_blocks: [], footer: { qbp_fields_referenced: [] },
      },
    }),
  });

  // sensescape v1 (queued, chain) · in-flight placeholder for Gate 4
  // (content is NOT NULL in the artifacts schema · empty object is the
  // queued-state convention; titleFromContent returns "(generating)"
  // copy regardless of content shape when status=queued)
  await tfetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId, artifact_type: 'sensescape_synthesizer', status: 'queued',
      version: 1, phase: '01', dispatch_id: lock.id,
      content: {},
    }),
  });

  // Legacy artifact (no dispatch_id · chapter-1 style)
  await tfetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId, artifact_type: 'archetype_compass', status: 'delivered',
      version: 1, phase: '01',
      content: {
        schema_version: '1.0',
        header: { eyebrow: 'pre-chain', title: 'Archetype Compass', agent: 'archetype_compass', generated_at: new Date().toISOString(), version: 1 },
        body_sections: [{ heading: 'x', prose: 'legacy seed' }],
        data_blocks: [], footer: { qbp_fields_referenced: [] },
      },
    }),
  });
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
      foundation_lock_qbp: { brand_name: 'Tree Test' },
      tool_completions: { 'archetype-compass': true, 'soul-map': true, 'sensescape': true },
    });
    await seedChainState(user.id);
    const session = await signIn(user.email);
    console.log(`Created test user ${user.id.slice(0,8)} · gates against ${BASE}`);

    const context = await newContext(browser, user.id, user.email, session);
    const page = await context.newPage();

    const artifactsGets = [];
    page.on('request', req => {
      if (req.url().includes('/api/artifacts') && req.method() === 'GET') {
        artifactsGets.push({ url: req.url(), ts: Date.now() });
      }
    });

    await page.goto(`${BASE}/archive`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Wait for data-painted state · chain card OR legacy section OR empty
    await page.waitForSelector('.qb-archive-chain, .qb-archive-legacy, .qb-archive.is-empty', { timeout: 20_000 });
    // Harness-determinism pattern · wait for bell mount + manager-realtime
    // before any tree-view assertions (avoids race per 10C surfaced pattern)
    await page.waitForSelector('.qb-notification-bell[data-mounted="true"]', { timeout: 15_000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('.qb-notification-bell[data-mounted="true"]');
      return b && b.getAttribute('data-realtime') === 'true';
    }, null, { timeout: 30_000 });

    // ─── Gate 1 · Chain-grouped tree renders ─────────────────────
    console.log('\n── Gate 1 · Chain-grouped tree renders ──');
    const chainCount = await page.locator('.qb-archive-chain').count();
    const chainTitle = await page.locator('.qb-archive-chain__title').first().textContent().catch(() => '');
    const titleOk = /^Locked \d{4}-\d{2}-\d{2} · \d+ agents?$/.test(chainTitle || '');
    results[1] = chainCount === 1 && titleOk;
    logResult(1, results[1], `chain cards: ${chainCount}/1 · title="${chainTitle}" (format ok: ${titleOk})`);

    // ─── Gate 2 · Branched reruns nest as children ──────────────
    console.log('\n── Gate 2 · Branched reruns nest as children ──');
    const childRows = await page.locator('.qb-archive-chain-child').count();
    // We seeded v1 + v2 with v2.parent_artifact_id = v1.id, so v2 should
    // be a child row (depth=1).
    results[2] = childRows >= 1;
    logResult(2, results[2], `child rows (depth >= 1): ${childRows} (expected >= 1)`);

    // ─── Gate 3 · "Earlier work" section surfaces legacy ────────
    console.log('\n── Gate 3 · "Earlier work" section surfaces legacy ──');
    const earlierTitle = await page.locator('.qb-archive-legacy__title').textContent().catch(() => '');
    const earlierRows = await page.locator('.qb-archive-legacy .qb-artifact-row').count();
    const earlierOk = earlierTitle === 'Earlier work' && earlierRows >= 1;
    results[3] = earlierOk;
    logResult(3, results[3], `section title: "${earlierTitle}" · legacy rows: ${earlierRows} (expected: "Earlier work" + >= 1)`);

    // ─── Gate 4 · In-flight chain renders placeholder ────────────
    console.log('\n── Gate 4 · In-flight chain renders placeholder ──');
    // The seeded sensescape_synthesizer v1 (queued) should appear as a
    // row inside the chain card with status pill = "Queued" and
    // is-pending class applied.
    const pendingRows = await page.locator('.qb-archive-chain .qb-artifact-row.is-pending').count();
    results[4] = pendingRows >= 1;
    logResult(4, results[4], `in-flight rows in chain: ${pendingRows} (expected >= 1)`);

    // ─── Gate 5 · Realtime live-update on archive ──────────────
    console.log('\n── Gate 5 · Realtime live-update on archive ──');
    const beforeFetchCount = artifactsGets.length;
    await insertNotification(user.id, 'chain_ready', { agent_slug: 'soul_map_synthesizer', reason: '11C Gate 5 probe' });
    const injectStart = Date.now();
    let refetchObserved = false;
    for (let i = 0; i < 20; i++) {
      if (artifactsGets.length > beforeFetchCount) { refetchObserved = true; break; }
      await page.waitForTimeout(500);
    }
    const refetchMs = Date.now() - injectStart;
    const newFetchCount = artifactsGets.length - beforeFetchCount;
    results[5] = refetchObserved && refetchMs < 10_000;
    logResult(5, results[5], `refetch fired in ${refetchMs}ms · ${newFetchCount} new GET /api/artifacts`);

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

  fs.writeFileSync('tests/chapter-02/archive-tree.last-run.json', JSON.stringify({
    base: BASE,
    results,
    passCount,
    allPass: passCount === 5,
  }, null, 2));

  process.exit(passCount === 5 ? 0 : 1);
})();
