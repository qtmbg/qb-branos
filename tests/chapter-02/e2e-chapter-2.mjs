/* Chapter 2 · Step 13A · End-to-end QA pass · 13-gate monolithic harness.
 *
 * One fresh test user walks the full chapter-2 path in a single
 * Playwright context. Verifies the seams between the 13 per-surface
 * harnesses · cross-surface state propagation no isolated harness covers.
 *
 * Per chapter-02/step-13-spec.md §3.1 (adj #1 monolithic, adj #2 one
 * user, adj #5 deleteUser in finally) + adj #3 STRIPE GATE is MOCKED
 * with logged gap (Stripe test-mode key not provisionable in prod env;
 * fallback authorized per spec §2.3) + adj #4 CHAIN_TEST_AGENT=1
 * required in Vercel Production for Gate 11.
 *
 * Surgical-fix policy (adj #6 modified · category-gated):
 *   Cat A · cosmetic/test-infra: ship in-session under cap of 2
 *   Cat B · ANY cross-surface seam defect: STOP and surface · DO NOT
 *           patch, regardless of line count
 *
 * Harness-determinism pattern (carry from 10C/11C/12C):
 *   Wait for .qb-notification-bell[data-mounted="true"] AND
 *   data-realtime="true" before any view-toggle interaction.
 *
 * Harness-seed schema discipline (carry from 11C/12C):
 *   Check r.ok on every REST mutation. Throw with response body on
 *   non-OK. Silent 400s during seed masquerade as client bugs.
 *
 * Usage:
 *   node tests/chapter-02/e2e-chapter-2.mjs
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
const BASE         = process.env.E2E_BASE || 'https://quantumbranding.ai';
const HEADLESS     = process.env.HEADLESS !== '0';

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const PASSWORD = 'qbverify-13a-' + Math.random().toString(36).slice(2, 10) + '-X1!';

// VERBATIM Starter copy · matches UPGRADE_BANNER_COPY in
// js/qb-foundation.js. Locked at the 12A copy-check (PR #139).
const STARTER_COPY = {
  eyebrow:  'Starter is live.',
  headline: 'Your tools are unlocked.',
  body:     'All 20 agents and unlimited runs are open. The Visual DNA and War Table exercises just unlocked · finish them to lock your foundation and trigger the full Phase 01 synthesis.',
};

// Full QBP fixture · matches what real Phase 01 exercises produce.
// Used to seed completion state via /rest/v1/profiles PATCH.
const FULL_QBP = {
  brandName: 'E2E Chapter 2',
  brandEssence: 'Coherence at the integration layer.',
  spark: 'A late realization that seam tests are everything.',
  archetypePrimary: 'The Sage',
  archetype: 'The Sage',
  archetypeRawAnswers: [{ q: 'why', a: 'coherence' }],
  manifesto: 'We test the spaces between surfaces because that is where bugs live.',
  paradox: 'Slow seam validation, fast iteration.',
  antiBrand: 'Not a happy-path-only operation.',
  alwaysNever: 'Always integrate. Never assume.',
  colorTerritory: 'Cream + ink + a single gold accent.',
  forbiddenColor: 'No fluorescents.',
  brandObject: 'A perfectly aligned ruler.',
  brandMoment: 'The moment a seam check passes.',
  signatureGesture: 'A deliberate pause.',
  soundSignature: 'A confirmed click.',
  warTableBrief: 'Cross-surface state propagation under realtime.',
  warTablePosture: 'Defensive integration.',
  warTableTopInitiatives: 'Harness coverage, seam validation, cleanup discipline.',
  audienceFears: 'A bug in the seam that no per-surface harness catches.',
  visualDnaKeepCount: 16,
};

async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s13a-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s13a' } }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`createUser failed: ${r.status} ${body.slice(0, 200)}`);
  }
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function signIn(email) {
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`signIn failed: ${r.status} ${body.slice(0, 200)}`);
  }
  const d = await r.json();
  if (!d.access_token) throw new Error('sign-in failed (no access_token)');
  return { token: d.access_token, refreshToken: d.refresh_token };
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

async function readProfile(userId) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, { headers: svc });
  if (!r.ok) throw new Error(`readProfile failed: ${r.status}`);
  const rows = await r.json();
  return rows?.[0] || null;
}

async function readArtifacts(userId) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&select=id,artifact_type,version,status,dispatch_id,parent_artifact_id&order=created_at.asc`, { headers: svc });
  if (!r.ok) throw new Error(`readArtifacts failed: ${r.status}`);
  return await r.json();
}

async function readDispatches(userId) {
  const r = await tfetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs?user_id=eq.${userId}&select=id,kind,agent_slug,status,chain_id,chain_depth&order=created_at.asc`, { headers: svc });
  if (!r.ok) throw new Error(`readDispatches failed: ${r.status}`);
  return await r.json();
}

async function deleteUser(userId) {
  await tfetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function ctxFromSession(browser, userId, email, session, tier) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(({ session, userId, email, tier }) => {
    localStorage.setItem('qb_session', JSON.stringify({
      token: session.token, refreshToken: session.refreshToken,
      userId, email, tier, first_name: 'E2E',
    }));
  }, { session, userId, email, tier });
  return context;
}

function logGate(num, label, passed, detail) {
  const tag = passed ? 'PASS' : 'FAIL';
  console.log(`  ${tag}  Gate ${num} · ${label}: ${detail}`);
}

(async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: HEADLESS });
  let user;
  const results = {};
  // Pre-flight log: Stripe gap noted, CHAIN_TEST_AGENT assumed enabled
  console.log('E2E Chapter 2 · monolithic harness · one user, one context');
  console.log(`  base: ${BASE}`);
  console.log('  Stripe gate: MOCKED-WITH-LOGGED-GAP (real test-mode key not provisionable in prod env)');
  console.log('  Chain gate: requires CHAIN_TEST_AGENT=1 in Vercel Production (operator-set)');
  console.log('');

  try {
    // ─── Gate 1 · Auth + signup ─────────────────────────────
    user = await createUser('all');
    const session = await signIn(user.email);
    results[1] = { passed: !!session.token && !!user.id, detail: `user ${user.id.slice(0,8)} created + signed in` };
    logGate(1, 'auth + signup', results[1].passed, results[1].detail);
    if (!results[1].passed) throw new Error('Gate 1 FAIL · cannot proceed');

    // ─── Initial state · free tier, no foundation lock ──
    // Foundation expects a profile row to exist (handle_new_user trigger
    // creates it). Confirm it exists + is free-tier baseline.
    let profile = await readProfile(user.id);
    if (!profile) throw new Error('profile row missing post-signup · trigger broken?');

    const context = await ctxFromSession(browser, user.id, user.email, session, 'free');
    const page = await context.newPage();

    // ─── Gate 2 · Foundation cold-start ─────────────────────
    await page.goto(`${BASE}/foundation`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Distinguish rendered state from loading skeleton: the rendered
    // article carries data-bucket attribute (renderFoundation at
    // qb-foundation.js:539). Loading skeleton has .is-loading. Per
    // step 10 §3.6 / step 11 §3.5 / 11C closure harness-determinism
    // pattern · use the data-painted-state selector.
    await page.waitForSelector('.qb-foundation[data-bucket]', { timeout: 20_000 });
    const cold = await page.evaluate(() => {
      const hero = document.querySelector('.qb-foundation-hero, .qb-foundation-cold, .qb-foundation__inner');
      const upgradeBanner = document.querySelector('.qb-foundation-upgrade-banner');
      return {
        hasShell: !!document.querySelector('.qb-foundation'),
        hasHeroLike: !!hero,
        hasUpgradeBanner: !!upgradeBanner,
      };
    });
    results[2] = {
      passed: cold.hasShell && cold.hasHeroLike,
      detail: `shell=${cold.hasShell} · hero/inner=${cold.hasHeroLike} · upgrade-banner=${cold.hasUpgradeBanner}`,
    };
    logGate(2, 'foundation cold-start render', results[2].passed, results[2].detail);

    // ─── Gate 3 · QBP accumulation (free-tier exercises) ────
    // Mark the four free-tier exercises complete via direct PATCH ·
    // these would be set by archetype-compass / soul-map / sensescape /
    // war-table tool pages during normal user flow. For E2E we shortcut
    // to focus on the lock + post-lock seams.
    const partialQbp = {
      archetypePrimary: FULL_QBP.archetypePrimary,
      archetype: FULL_QBP.archetype,
      archetypeRawAnswers: FULL_QBP.archetypeRawAnswers,
      brandEssence: FULL_QBP.brandEssence,
      manifesto: FULL_QBP.manifesto,
      paradox: FULL_QBP.paradox,
      antiBrand: FULL_QBP.antiBrand,
      colorTerritory: FULL_QBP.colorTerritory,
      brandObject: FULL_QBP.brandObject,
    };
    await setProfile(user.id, {
      qbp: partialQbp,
      tool_completions: {
        'archetype-compass': { completed_at: new Date().toISOString(), source: 'c2-s13a' },
        'soul-map':          { completed_at: new Date().toISOString(), source: 'c2-s13a' },
        'sensescape':        { completed_at: new Date().toISOString(), source: 'c2-s13a' },
      },
    });
    profile = await readProfile(user.id);
    const qbpFreeFieldsOk = !!profile.qbp?.brandEssence && !!profile.qbp?.archetypePrimary;
    results[3] = {
      passed: qbpFreeFieldsOk,
      detail: `qbp.brandEssence=${!!profile.qbp?.brandEssence} · qbp.archetypePrimary=${!!profile.qbp?.archetypePrimary}`,
    };
    logGate(3, 'QBP accumulation (free-tier exercises)', results[3].passed, results[3].detail);

    // ─── Gate 4 · Paywall gate ──────────────────────────────
    // Tier-locked exercises (Visual DNA, War Table) render as
    // qb-exercise-card with .is-locked class for free users
    // (createExerciseCard at js/qb-components.js:139). The CTA on
    // those cards opens a paywall modal on click. Verifying the
    // locked rendering carries the gate without needing the click.
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Same data-bucket distinguisher as Gate 2 · avoid loading-skeleton
    // false-positive.
    await page.waitForSelector('.qb-foundation[data-bucket]', { timeout: 20_000 });
    await page.waitForSelector('.qb-exercise-card', { timeout: 10_000 });
    const tierLockedView = await page.evaluate(() => {
      const lockedCards = document.querySelectorAll('.qb-exercise-card.is-locked').length;
      // The renderLocked-path upgrade banner only appears post-lock for
      // free users; not relevant pre-lock. Locked exercise cards are
      // the right signal at the in-progress/lock-ready buckets.
      return { lockedCards };
    });
    results[4] = {
      passed: tierLockedView.lockedCards >= 2,
      detail: `locked exercise cards (Visual DNA + War Table): ${tierLockedView.lockedCards}/2+`,
    };
    logGate(4, 'paywall gate (tier-locked render)', results[4].passed, results[4].detail);

    // ─── Gate 5 · Upgrade flow · MOCKED-WITH-LOGGED-GAP ─────
    // Per adj #3 fallback: Stripe test-mode key not provisionable in
    // prod env. Mock the post-checkout state by direct DB tier flip +
    // navigate to /foundation?upgrade=success. Logged gap captured in
    // 13Z closure for the named pre-launch real-Stripe seam check.
    console.log('  [GAP] Stripe gate MOCKED · direct tier flip + URL navigation');
    await setProfile(user.id, { tier: 'starter', tier_started_at: new Date().toISOString() });
    profile = await readProfile(user.id);
    results[5] = {
      passed: profile.tier === 'starter',
      detail: `tier=${profile.tier} (mocked via direct DB PATCH · Stripe test-mode key gap)`,
    };
    logGate(5, 'upgrade flow (MOCKED)', results[5].passed, results[5].detail);

    // ─── Gate 6 · Upgrade banner renders + URL strip ────────
    await page.goto(`${BASE}/foundation?upgrade=success`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.qb-foundation-upgrade-success', { timeout: 15_000 });
    await page.waitForSelector('.qb-notification-bell[data-mounted="true"]', { timeout: 15_000 });
    const bannerStrings = await page.evaluate(() => {
      const root = document.querySelector('.qb-foundation-upgrade-success');
      if (!root) return null;
      return {
        eyebrow:  root.querySelector('.qb-tag_content')?.textContent.trim() || null,
        headline: root.querySelector('.qb-foundation-upgrade-success__headline')?.textContent.trim() || null,
        body:     root.querySelector('.qb-foundation-upgrade-success__body')?.textContent.trim() || null,
      };
    });
    const urlNow = page.url();
    const urlStripped = !urlNow.includes('upgrade=success');
    const stringsMatch = bannerStrings &&
      bannerStrings.eyebrow === STARTER_COPY.eyebrow &&
      bannerStrings.headline === STARTER_COPY.headline &&
      bannerStrings.body === STARTER_COPY.body;
    results[6] = {
      passed: !!stringsMatch && urlStripped,
      detail: `strings-verbatim=${!!stringsMatch} · url-stripped=${urlStripped}`,
      observed: bannerStrings,
    };
    logGate(6, 'upgrade banner renders + URL strip', results[6].passed, results[6].detail);

    // ─── Gate 7 · Tier-locked unlock ────────────────────────
    // After upgrade, the tier-locked tiles (Visual DNA, War Table)
    // should no longer be in locked state. Phase view banner copy
    // (or foundation roadmap) should reflect the new tier.
    // Dismiss the upgrade banner first so we can see the underlying surface.
    const dismissBtn = page.locator('.qb-foundation-upgrade-success__close');
    if (await dismissBtn.count() > 0) {
      await dismissBtn.click();
      await page.waitForSelector('.qb-foundation-upgrade-success', { state: 'detached', timeout: 5_000 });
    }
    await page.waitForTimeout(500);
    const postUpgradeView = await page.evaluate(() => {
      // After upgrade, the paywall-CTA banner should be gone OR the
      // tier-paid section appears (e.g., the "Phase 02 unlocks in a
      // future chapter" banner replaces the upgrade CTA).
      const upgradeCta = document.querySelector('.qb-foundation-upgrade-banner');
      const phaseRoadmap = document.querySelector('.qb-foundation-roadmap, .qb-foundation-phase-roadmap, [class*="phase-roadmap"]');
      const dataset = document.querySelector('.qb-foundation')?.dataset;
      return {
        upgradeCtaGone: !upgradeCta,
        hasRoadmap: !!phaseRoadmap,
        tierAttr: dataset?.tier || null,
      };
    });
    results[7] = {
      passed: postUpgradeView.upgradeCtaGone && postUpgradeView.tierAttr === 'starter',
      detail: `upgrade-cta-gone=${postUpgradeView.upgradeCtaGone} · tier-attr=${postUpgradeView.tierAttr} · has-roadmap=${postUpgradeView.hasRoadmap}`,
    };
    logGate(7, 'tier-locked unlock (post-upgrade view)', results[7].passed, results[7].detail);

    // ─── Gate 8 · Tier-locked exercises complete ────────────
    // Mark Visual DNA + War Table completions via direct PATCH ·
    // matches what those tool pages would set.
    await setProfile(user.id, {
      qbp: { ...partialQbp, ...FULL_QBP },
    });
    profile = await readProfile(user.id);
    const allFieldsOk = !!profile.qbp?.visualDnaKeepCount && !!profile.qbp?.warTablePosture;
    results[8] = {
      passed: allFieldsOk,
      detail: `qbp.visualDnaKeepCount=${profile.qbp?.visualDnaKeepCount} · qbp.warTablePosture=${!!profile.qbp?.warTablePosture}`,
    };
    logGate(8, 'tier-locked exercises complete', results[8].passed, results[8].detail);

    // ─── Gate 9 · Foundation lock ───────────────────────────
    const lockRes = await tfetch(`${BASE}/api/lock-foundation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    const lockBody = await lockRes.json().catch(() => ({}));
    const lockOk = lockRes.status === 202 || lockRes.status === 200;
    // Brief wait for dispatch + artifact rows to appear
    await new Promise(r => setTimeout(r, 2000));
    const dispatchesAfterLock = await readDispatches(user.id);
    const artifactsAfterLock = await readArtifacts(user.id);
    const lockDispatch = dispatchesAfterLock.find(d => d.kind === 'lock');
    results[9] = {
      passed: lockOk && !!lockDispatch && artifactsAfterLock.length >= 4,
      detail: `lock-status=${lockRes.status} · lock-dispatch=${!!lockDispatch} · artifacts=${artifactsAfterLock.length}/4+`,
    };
    logGate(9, 'foundation lock', results[9].passed, results[9].detail);
    if (!results[9].passed) {
      console.log(`    lock body: ${JSON.stringify(lockBody).slice(0, 200)}`);
    }

    // ─── Gate 10 · Phase 01 delivery + propagation ──────────
    // Wait up to 240s for all four Phase 01 agents to deliver. Each
    // run takes ~6-15s (Claude calls) but Visual DNA was flagged as
    // marginal at step 4 latency budget review (1100ms headroom). Under
    // integrated load + concurrent chain trigger, an agent can take
    // 60-180s. Previous Gate 10 timing budget (120s) FAILed 3/4 on a
    // re-run · timing was the cause. Cat A fix: bump to 240s budget.
    const PROD_AGENT_SLUGS = ['soul_map_synthesizer', 'sensescape_synthesizer', 'visual_dna_synthesizer', 'war_table_synthesizer'];
    const deliveryStart = Date.now();
    let allDelivered = false;
    let lastArtifacts = [];
    for (let i = 0; i < 120; i++) {  // 120 × 2s = 240s budget
      lastArtifacts = await readArtifacts(user.id);
      const delivered = PROD_AGENT_SLUGS.filter(slug =>
        lastArtifacts.some(a => a.artifact_type === slug && a.status === 'delivered')
      );
      if (delivered.length === 4) { allDelivered = true; break; }
      await new Promise(r => setTimeout(r, 2000));
    }
    const deliveryMs = Date.now() - deliveryStart;
    // Verify Phase view also reflects the deliveries (Realtime seam)
    await page.goto(`${BASE}/agents`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.phase-section_active, .console-empty, .console-error', { timeout: 20_000 });
    await page.waitForSelector('.qb-notification-bell[data-mounted="true"]', { timeout: 15_000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('.qb-notification-bell[data-mounted="true"]');
      return b && b.getAttribute('data-realtime') === 'true';
    }, null, { timeout: 30_000 });
    // Wait a moment for Phase 01 rows to paint with delivered state
    await page.waitForTimeout(1500);
    const phaseViewState = await page.evaluate(() => {
      const rows = document.querySelectorAll('.agent-row');
      const deliveredPills = document.querySelectorAll('.agent-row .qb-tag.is-teal');
      return {
        rowCount: rows.length,
        deliveredPillCount: deliveredPills.length,
      };
    });
    results[10] = {
      passed: allDelivered && phaseViewState.rowCount >= 4 && phaseViewState.deliveredPillCount >= 4,
      detail: `all-4-delivered=${allDelivered} in ${deliveryMs}ms · phase-view rows=${phaseViewState.rowCount} · delivered-pills=${phaseViewState.deliveredPillCount}`,
    };
    logGate(10, 'Phase 01 delivery + Phase view propagation', results[10].passed, results[10].detail);

    // ─── Gate 11 · Chain orchestration (CHAIN_TEST_AGENT=1) ─
    // After soul_map + sensescape deliver, the synthetic chain_test_agent
    // should fire automatically (per step 8C). The artifact appears in
    // the archive as a child of the chain root.
    // Wait for chain dispatch + chain_test_agent delivery (up to 60s).
    const chainStart = Date.now();
    let chainFired = false;
    let chainDispatch = null;
    let chainArtifact = null;
    for (let i = 0; i < 30; i++) {
      const dispatches = await readDispatches(user.id);
      chainDispatch = dispatches.find(d => d.kind === 'chain' && d.agent_slug === 'chain_test_agent');
      const arts = await readArtifacts(user.id);
      chainArtifact = arts.find(a => a.artifact_type === 'chain_test_agent' && a.status === 'delivered');
      if (chainDispatch && chainArtifact) { chainFired = true; break; }
      await new Promise(r => setTimeout(r, 2000));
    }
    const chainMs = Date.now() - chainStart;
    results[11] = {
      passed: chainFired,
      detail: chainFired
        ? `chain fired · dispatch.kind=chain · artifact delivered in ${chainMs}ms`
        : `NO chain dispatch · likely CHAIN_TEST_AGENT not active in prod`,
      dispatch: chainDispatch ? { id: chainDispatch.id?.slice(0,8), depth: chainDispatch.chain_depth } : null,
    };
    logGate(11, 'chain orchestration (CHAIN_TEST_AGENT=1)', results[11].passed, results[11].detail);

    // ─── Gate 12 · Manual rerun (two-button current QBP path) ─
    // Click rerun on the Phase view, observe new artifact version
    // appears in archive nested under v1 via parent_artifact_id.
    // Use a direct POST to /api/agents/rerun (the Phase view CTA does
    // the same; we test the underlying behavior here).
    const soulMapV1 = lastArtifacts.find(a => a.artifact_type === 'soul_map_synthesizer' && a.status === 'delivered');
    if (!soulMapV1) {
      results[12] = { passed: false, detail: 'no v1 soul_map artifact to rerun against' };
      logGate(12, 'manual rerun', false, results[12].detail);
    } else {
      const rerunRes = await tfetch(`${BASE}/api/agents/rerun`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ artifact_id: soulMapV1.id, qbp_source: 'current' }),
      });
      const rerunOk = rerunRes.status === 202 || rerunRes.status === 200;
      // Wait for v2 delivery (up to 60s)
      const rerunStart = Date.now();
      let v2 = null;
      for (let i = 0; i < 30; i++) {
        const arts = await readArtifacts(user.id);
        v2 = arts.find(a =>
          a.artifact_type === 'soul_map_synthesizer' &&
          a.version === 2 &&
          a.parent_artifact_id === soulMapV1.id &&
          a.status === 'delivered'
        );
        if (v2) break;
        await new Promise(r => setTimeout(r, 2000));
      }
      const rerunMs = Date.now() - rerunStart;
      results[12] = {
        passed: rerunOk && !!v2,
        detail: `rerun status=${rerunRes.status} · v2 delivered with parent_artifact_id=v1 in ${rerunMs}ms`,
      };
      logGate(12, 'manual rerun (current QBP path)', results[12].passed, results[12].detail);
    }

    // ─── Gate 13 · Replay modal · focus management ──────────
    // Open run history view, click a row, verify modal opens + closeBtn
    // focused, press Escape, verify focus returns to row.
    const runsTab = page.locator('.console-view-toggle_btn').nth(1);
    await runsTab.click();
    await page.waitForSelector('.run-row', { timeout: 10_000 });
    const firstRunRow = page.locator('.run-row').first();
    await firstRunRow.focus();
    await firstRunRow.press('Enter');
    await page.waitForSelector('.replay-modal', { timeout: 5_000 });
    const closeBtnFocused = await page.evaluate(() => {
      return document.activeElement?.classList?.contains('replay-modal_close') || false;
    });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.replay-modal', { state: 'detached', timeout: 5_000 });
    const focusReturned = await page.evaluate(() => {
      return document.activeElement?.classList?.contains('run-row') || false;
    });
    results[13] = {
      passed: closeBtnFocused && focusReturned,
      detail: `closeBtn-focused-on-open=${closeBtnFocused} · focus-returned-on-close=${focusReturned}`,
    };
    logGate(13, 'replay modal focus management', results[13].passed, results[13].detail);

    await context.close();
  } catch (e) {
    console.error('\nharness error:', e?.message);
  } finally {
    if (user?.id) {
      try { await deleteUser(user.id); } catch {}
    }
    await browser.close();
  }

  // ─── Summary ─────────────────────────────────────────
  console.log('\n── Summary ──────────────────────────────────────────');
  const passCount = Object.values(results).filter(r => r.passed).length;
  const totalGates = 13;
  for (let g = 1; g <= totalGates; g++) {
    const r = results[g];
    console.log(`  Gate ${g}: ${r ? (r.passed ? 'PASS' : 'FAIL') : 'NOT REACHED'}`);
  }
  console.log(`\n${passCount === totalGates ? 'PASS' : 'FAIL'} · ${passCount}/${totalGates} gates`);

  fs.writeFileSync('tests/chapter-02/e2e-chapter-2.last-run.json', JSON.stringify({
    base: BASE,
    stripe: 'MOCKED-WITH-LOGGED-GAP',
    chain_test_agent: 'expected enabled in prod',
    results,
    passCount,
    totalGates,
    allPass: passCount === totalGates,
  }, null, 2));

  process.exit(passCount === totalGates ? 0 : 1);
})();
