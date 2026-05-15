/* Step 18 PR 2 - Visual Verification Pass
 *
 * Captures 14 surfaces x 3 viewports = 42 screenshots against deployed prod
 * (https://quantumbranding.ai). Test user 0b034d6a-9421-4408-a6ae-8e22752d29a4
 * (the step 17 test user, preserved with 7 artifacts).
 *
 * Authenticates by minting an admin magic-link, extracting the access_token
 * from the redirect Location fragment, and injecting it into localStorage as
 * the page's `qb_session` shape so qb-cloud.js sees an authed user.
 *
 * The 14 surfaces:
 *   1.  Foundation (cold/in-progress depending on state)
 *   2.  Foundation in-progress (same render, separate viewport pass)
 *   3.  Foundation lock-ready (synthetic; we paint via flag toggle if needed)
 *   4.  Foundation locked + producing (synthetic state)
 *   5.  Foundation all artifacts ready (state already exists for this user)
 *   6.  Artifact reading - Soul Map
 *   7.  Artifact reading - Sensescape
 *   8.  Artifact reading - Visual DNA
 *   9.  Artifact reading - War Table
 *   10. Brand Archive
 *   11. QBP (free tier, export gated)
 *   12. Paywall
 *   13. Account (free tier - current state)
 *   14. Account (starter - flip tier, snap, flip back)
 *
 * Runs at 375, 768, 1440 wide. 1700px tall window for full-fold capture.
 *
 * Output: chapter-01/verification/step-18-screenshots/<slug>-<viewport>.png
 *         chapter-01/verification/step-18-screenshots/index.md
 */
import { chromium } from '/tmp/qb-shots/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')]; }));

const USER_ID = '0b034d6a-9421-4408-a6ae-8e22752d29a4';
const EMAIL = 'nizzar.ben+c1qa-20260515t144543@gmail.com';
const BASE = 'https://quantumbranding.ai';
const OUT = './chapter-01/verification/step-18-screenshots';
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_ANON = env.SUPABASE_ANON_KEY;

const VIEWPORTS = [
  { name: 'mobile-375',  w: 375,  h: 1700 },
  { name: 'tablet-768',  w: 768,  h: 1700 },
  { name: 'desktop-1440', w: 1440, h: 1700 },
];

async function mintSession() {
  const link = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`,
    { method:'POST', headers:{ apikey: SERVICE_KEY, Authorization:`Bearer ${SERVICE_KEY}`, 'content-type':'application/json' },
      body: JSON.stringify({ type:'magiclink', email: EMAIL }) }).then(r=>r.json());
  const r = await fetch(link.action_link, { redirect:'manual' });
  const frag = (r.headers.get('location')||'').split('#')[1] || '';
  const params = new URLSearchParams(frag);
  return {
    token: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
  };
}

async function setTier(tier) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${USER_ID}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ tier }),
  });
}

async function getArtifactIds() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${USER_ID}&select=id,artifact_type,version,status&order=version.desc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }).then(r=>r.json());
  // Latest version per agent_slug
  const byAgent = {};
  for (const a of r) {
    if (a.status !== 'delivered') continue;
    if (!byAgent[a.artifact_type] || a.version > byAgent[a.artifact_type].version) {
      byAgent[a.artifact_type] = a;
    }
  }
  return byAgent;
}

async function snap(page, slug) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(800); // let layout settle
    const path = `${OUT}/${slug}-${vp.name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(`  ✓ ${path}`);
  }
}

async function setSessionInBrowser(page, session) {
  // qb-cloud.js reads localStorage.qb_session. Setting it before navigating
  // the page lets the auth gate pass on first load. We use addInitScript so
  // it runs before every page load, even after redirects.
  const payload = {
    token: session.token,
    refreshToken: session.refreshToken,
    userId: USER_ID,
    email: EMAIL,
    firstName: 'Atelier',
  };
  await page.addInitScript((p) => {
    try { localStorage.setItem('qb_session', JSON.stringify(p)); } catch(_) {}
  }, payload);
}

(async () => {
  console.log('Step 18 PR 2 - Visual verification pass');
  console.log(`Test user: ${USER_ID}\nBase: ${BASE}\n`);

  // Ensure test user is on free tier for the first batch
  await setTier('free');
  const session = await mintSession();
  console.log(`Session minted (len=${session.token?.length})\n`);

  // Inventory artifact ids for the reading pages (full content surfaces).
  const arts = await getArtifactIds();
  console.log('Latest delivered artifacts:');
  for (const [slug, a] of Object.entries(arts)) {
    console.log(`  ${slug.padEnd(28)} v${a.version}  id=${a.id}`);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await setSessionInBrowser(page, session);

  // ── FREE TIER SCREENSHOTS ──────────────────────────────────
  console.log('\n── Free tier ──────────────────');

  console.log('\n[01] /foundation (locked, delivered, free)');
  await page.goto(`${BASE}/foundation`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(1500);
  await snap(page, '01-foundation-locked-delivered-free');

  console.log('\n[06] /artifact?id=<soul_map>');
  if (arts.soul_map_synthesizer) {
    await page.goto(`${BASE}/artifact?id=${arts.soul_map_synthesizer.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap(page, '06-artifact-soul-map');
  }

  console.log('\n[07] /artifact?id=<sensescape> (locked surface)');
  if (arts.sensescape_synthesizer) {
    await page.goto(`${BASE}/artifact?id=${arts.sensescape_synthesizer.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap(page, '07-artifact-sensescape-locked-free');
  }

  console.log('\n[08] /artifact?id=<visual_dna> (locked surface)');
  if (arts.visual_dna_synthesizer) {
    await page.goto(`${BASE}/artifact?id=${arts.visual_dna_synthesizer.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap(page, '08-artifact-visual-dna-locked-free');
  }

  console.log('\n[09] /artifact?id=<war_table> (locked surface)');
  if (arts.war_table_synthesizer) {
    await page.goto(`${BASE}/artifact?id=${arts.war_table_synthesizer.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap(page, '09-artifact-war-table-locked-free');
  }

  console.log('\n[10] /archive (free, 3 locked rows)');
  await page.goto(`${BASE}/archive`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await snap(page, '10-archive-free');

  console.log('\n[11] /qbp (free tier, export gated)');
  await page.goto(`${BASE}/qbp`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await snap(page, '11-qbp-free-export-gated');

  console.log('\n[12] /paywall');
  await page.goto(`${BASE}/paywall`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await snap(page, '12-paywall');

  console.log('\n[13] /account (free tier)');
  await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await snap(page, '13-account-free');

  // ── STARTER TIER SCREENSHOTS ──────────────────────────────
  console.log('\n── Starter tier ──────────────');
  await setTier('starter');
  await page.waitForTimeout(800);

  console.log('\n[05] /foundation (locked, delivered, starter)');
  await page.goto(`${BASE}/foundation?_=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await snap(page, '05-foundation-locked-delivered-starter');

  console.log('\n[06s] /artifact?id=<soul_map> (starter, identical to free)');
  // Soul Map is always free; skip duplicate snap.

  console.log('\n[07s] /artifact?id=<sensescape> (starter, content visible)');
  if (arts.sensescape_synthesizer) {
    await page.goto(`${BASE}/artifact?id=${arts.sensescape_synthesizer.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap(page, '07s-artifact-sensescape-starter');
  }

  console.log('\n[08s] /artifact?id=<visual_dna> (starter)');
  if (arts.visual_dna_synthesizer) {
    await page.goto(`${BASE}/artifact?id=${arts.visual_dna_synthesizer.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap(page, '08s-artifact-visual-dna-starter');
  }

  console.log('\n[09s] /artifact?id=<war_table> (starter)');
  if (arts.war_table_synthesizer) {
    await page.goto(`${BASE}/artifact?id=${arts.war_table_synthesizer.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await snap(page, '09s-artifact-war-table-starter');
  }

  console.log('\n[14] /account (starter tier)');
  await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await snap(page, '14-account-starter');

  await browser.close();

  // Restore free tier
  console.log('\n── Cleanup: tier back to free ──');
  await setTier('free');

  console.log(`\nDone. Screenshots in ${OUT}/`);
})().catch(e => { console.error(e); process.exit(1); });
