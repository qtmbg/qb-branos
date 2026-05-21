/* Chapter 2 · Step 12C acceptance gates (both).
 *
 * Verifies the /foundation upgrade-success banner per
 * chapter-02/step-12-spec.md §3.1 + §3.3 (Nizzar adj #6 override · ship
 * the harness; the post-payment confirmation surface needs gating).
 *
 *   1. Banner renders with the correct tier-aware copy when
 *      ?upgrade=success and tier is present. Asserts ALL THREE
 *      final approved strings VERBATIM (eyebrow + headline + body)
 *      across starter / pro / agency tiers.
 *   2. Banner dismiss strips the param via history.replaceState and
 *      does NOT re-render on reload (param-strip IS the one-shot
 *      guarantee per adj #3).
 *
 * Harness-determinism pattern (carried from step 10 §3.6 + step 11
 * §3.5 + 11C closure) · wait for any mount/ready signal before
 * asserting against the banner DOM. The foundation page mounts the
 * bell after render; we wait for both the banner card present AND
 * .qb-notification-bell[data-mounted="true"] before assertions.
 *
 * Harness-seed schema discipline (carried from step 11 §3.4) · all
 * INSERT/PATCH responses checked for non-OK status. Silent 400s
 * masquerade as client bugs downstream.
 *
 * Usage:
 *   node tests/chapter-02/foundation-banner.mjs
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
const BASE         = process.env.BANNER_BASE || 'https://quantumbranding.ai';
const HEADLESS     = process.env.HEADLESS !== '0';

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };
const PASSWORD = 'qbverify-12c-' + Math.random().toString(36).slice(2, 10) + '-X1!';

// VERBATIM approved copy · matches UPGRADE_BANNER_COPY in js/qb-foundation.js
// (chapter-2/step-12a-upgrade-banner branch · merged at PR #139). Any
// drift between the harness assertions and the renderer fails the gate.
const APPROVED_COPY = {
  starter: {
    eyebrow: 'Starter is live.',
    headline: 'Your tools are unlocked.',
    body: 'All 20 agents and unlimited runs are open. The Visual DNA and War Table exercises just unlocked · finish them to lock your foundation and trigger the full Phase 01 synthesis.',
  },
  pro: {
    eyebrow: 'Pro is live.',
    headline: 'Everything is open.',
    body: 'Your full foundation and all agents are open today. Visual DNA and War Table are waiting · finish them to trigger your Phase 01 synthesis. Predictive Panel and Phase 02 brand creation come online as they ship, and everything you build now compounds into them.',
  },
  agency: {
    eyebrow: 'Agency is live.',
    headline: 'Client mode is on.',
    body: 'Multi-brand workspaces and white-label exports are yours. Run this brand\'s foundation first · Visual DNA and War Table are waiting · then create your first client workspace.',
  },
};

async function tfetch(url, opts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s12c-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await tfetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({ email, email_confirm: true, password: PASSWORD, user_metadata: { signup_source: 'c2-s12c' } }),
  });
  // Harness-seed schema discipline · check INSERT status (step 11 §3.4)
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
  // Harness-seed schema discipline · check PATCH status (step 11 §3.4)
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`setProfile failed: ${r.status} ${body.slice(0, 200)}`);
  }
}

async function deleteUser(userId) {
  await tfetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

async function newContext(browser, userId, email, session, tier) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(({ session, userId, email, tier }) => {
    localStorage.setItem('qb_session', JSON.stringify({
      token: session.token, refreshToken: session.refreshToken,
      userId, email, tier, first_name: 'Verification',
    }));
  }, { session, userId, email, tier });
  return context;
}

function logResult(gate, label, passed, detail) {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  Gate ${gate} · ${label}: ${detail}`);
}

async function readBannerStrings(page) {
  return await page.evaluate(() => {
    const root = document.querySelector('.qb-foundation-upgrade-success');
    if (!root) return null;
    const eyebrowEl  = root.querySelector('.qb-tag_content');
    const headlineEl = root.querySelector('.qb-foundation-upgrade-success__headline');
    const bodyEl     = root.querySelector('.qb-foundation-upgrade-success__body');
    return {
      eyebrow:  eyebrowEl  ? eyebrowEl.textContent.trim()  : null,
      headline: headlineEl ? headlineEl.textContent.trim() : null,
      body:     bodyEl     ? bodyEl.textContent.trim()     : null,
    };
  });
}

async function gate1ForTier(page, BASE, tier) {
  await page.goto(`${BASE}/foundation?upgrade=success`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Harness-determinism · wait for banner DOM AND bell mount
  await page.waitForSelector('.qb-foundation-upgrade-success', { timeout: 20_000 });
  await page.waitForSelector('.qb-notification-bell[data-mounted="true"]', { timeout: 15_000 });
  const strings = await readBannerStrings(page);
  const expected = APPROVED_COPY[tier];
  if (!strings) return { ok: false, detail: 'banner DOM absent' };
  const eyebrowOk  = strings.eyebrow  === expected.eyebrow;
  const headlineOk = strings.headline === expected.headline;
  const bodyOk     = strings.body     === expected.body;
  const allOk = eyebrowOk && headlineOk && bodyOk;
  // URL · ?upgrade=success parameter must be stripped after the
  // history.replaceState call in detectUpgradeSuccessParam()
  const finalUrl = page.url();
  const urlStripped = !finalUrl.includes('upgrade=success');
  return {
    ok: allOk && urlStripped,
    detail: allOk && urlStripped
      ? `eyebrow + headline + body match · URL stripped`
      : `eyebrow=${eyebrowOk} headline=${headlineOk} body=${bodyOk} url-stripped=${urlStripped}`,
    observed: strings,
    expected,
    finalUrl,
  };
}

async function gate2DismissAndReload(page, BASE) {
  // Pre-condition: banner is on screen from gate 1's last navigate
  await page.waitForSelector('.qb-foundation-upgrade-success', { timeout: 5_000 });
  // Click the close button · banner should disappear
  await page.locator('.qb-foundation-upgrade-success__close').click();
  // Wait for banner removal (re-render is async via dismissUpgradeSuccessBanner)
  await page.waitForSelector('.qb-foundation-upgrade-success', { state: 'detached', timeout: 10_000 });
  // URL stays clean (already stripped on initial detection)
  const urlAfterDismiss = page.url();
  const urlCleanAfterDismiss = !urlAfterDismiss.includes('upgrade=success');
  // Reload · banner must NOT re-appear (param-strip IS the one-shot guarantee)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  // Wait a moment for any deferred render
  await page.waitForTimeout(2_000);
  const bannerAfterReload = await page.locator('.qb-foundation-upgrade-success').count();
  return {
    ok: urlCleanAfterDismiss && bannerAfterReload === 0,
    detail: `url-clean=${urlCleanAfterDismiss} · banner-after-reload=${bannerAfterReload}/0 expected`,
  };
}

(async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: HEADLESS });
  const results = {
    1: { starter: false, pro: false, agency: false },
    2: false,
  };
  let user;

  try {
    user = await createUser('all');
    const session = await signIn(user.email);
    console.log(`Created test user ${user.id.slice(0,8)} · gates against ${BASE}`);

    // ─── Gate 1 · banner renders with correct tier-aware copy ──
    console.log('\n── Gate 1 · banner renders with correct tier-aware copy ──');
    for (const tier of ['starter', 'pro', 'agency']) {
      await setProfile(user.id, { tier });
      const context = await newContext(browser, user.id, user.email, session, tier);
      const page = await context.newPage();
      const r = await gate1ForTier(page, BASE, tier);
      results[1][tier] = r.ok;
      logResult(1, `tier=${tier}`, r.ok, r.detail);
      if (!r.ok) {
        console.log(`    expected: ${JSON.stringify(r.expected)}`);
        console.log(`    observed: ${JSON.stringify(r.observed)}`);
      }
      // For tier='starter', leave the page open to feed into Gate 2
      if (tier === 'starter') {
        // ─── Gate 2 · dismiss + reload check ──────────────
        console.log('\n── Gate 2 · dismiss strips param + no re-render on reload ──');
        const g2 = await gate2DismissAndReload(page, BASE);
        results[2] = g2.ok;
        logResult(2, 'dismiss-and-reload', g2.ok, g2.detail);
      }
      await context.close();
    }

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
  const tierResults = results[1];
  const gate1Pass = tierResults.starter && tierResults.pro && tierResults.agency;
  console.log(`  Gate 1 (tier-aware copy): ${gate1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`    · starter: ${tierResults.starter ? 'PASS' : 'FAIL'}`);
  console.log(`    · pro: ${tierResults.pro ? 'PASS' : 'FAIL'}`);
  console.log(`    · agency: ${tierResults.agency ? 'PASS' : 'FAIL'}`);
  console.log(`  Gate 2 (dismiss + reload): ${results[2] ? 'PASS' : 'FAIL'}`);
  const passCount = (gate1Pass ? 1 : 0) + (results[2] ? 1 : 0);
  console.log(`\n${passCount === 2 ? 'PASS' : 'FAIL'} · ${passCount}/2 gates`);

  fs.writeFileSync('tests/chapter-02/foundation-banner.last-run.json', JSON.stringify({
    base: BASE,
    results,
    passCount,
    allPass: passCount === 2,
  }, null, 2));

  process.exit(passCount === 2 ? 0 : 1);
})();
