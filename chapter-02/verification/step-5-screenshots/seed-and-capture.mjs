/* Chapter 2 · Step 5 verification · seed-and-capture script.
 *
 * Reproducible Agent Console screenshot capture per PR #79 approval.
 *
 * Usage:
 *   node chapter-02/verification/step-5-screenshots/seed-and-capture.mjs <state>
 *
 * States:
 *   neutral             · fresh foundation lock, no runs in 7d window
 *   green               · 4 delivered runs, clean rolling averages
 *   yellow-latency      · 4 agents · one's rolling latency in 20-23s gold band
 *   rose-latency        · 4 agents · one's rolling latency >23s rose band
 *   rose-retry          · 4 agents · one's rolling retry >0.5 rose band
 *   transient-failed    · 4 agents · one in failed (transient) state with rerun CTAs
 *   failed-permanently  · 4 agents · one in failed_permanently state with retry pill
 *   locked-phase-cards  · any signed-in user, Phase 02-05 locked rows visible
 *   replay-modal-v1-of-3     · 3-version chain on one agent, captures replay on v1 (root of chain, non-latest)
 *
 * Seeds happen via Supabase admin + service-role direct writes against
 * the production database (project yushbxjwfhuokaezoioe). Each invocation
 * creates a fresh user · cleans up at end.
 *
 * Capture via Playwright headless against https://quantumbranding.ai/agents
 * with the user's session injected into localStorage.qb_session before
 * page navigation (matches qb-cloud.js auth gate).
 *
 * PNGs land at /chapter-02/verification/step-5-screenshots/<state>.png.
 *
 * Required local env (sourced from /tmp/.env.qb-branos.live-backup):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const env = Object.fromEntries(
  fs.readFileSync('/tmp/.env.qb-branos.live-backup', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = env.SUPABASE_ANON_KEY;
const BASE         = process.env.BASE || 'https://quantumbranding.ai';
const HEADLESS     = process.env.HEADLESS !== '0';

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' };

const FULL_QBP = {
  brandName: 'Lighthouse',
  brandEssence: 'Quiet clarity for founders.',
  spark: 'Late-night realization.',
  archetype: 'The Sage',
  manifesto: 'Clarity earned by sitting longer with the question.',
  antiBrand: 'Not a guru.',
  paradox: 'Slow on purpose, fast in result.',
  alwaysNever: 'Always honest. Never performative.',
  colorTerritory: 'Cold seafoam, oxidized brass.',
  forbiddenColor: 'No saturated reds.',
  brandObject: 'A brass weather instrument.',
  brandMoment: 'A founder closing their laptop at 11pm.',
  signatureGesture: 'A slow nod.',
  soundSignature: 'A low piano chord.',
  archetypePrimary: 'The Sage',
  warTableBrief: 'A thinking partner.',
  audienceFears: 'Being seen as another guru.',
};

const AGENT_SLUGS = [
  'soul_map_synthesizer',
  'sensescape_synthesizer',
  'visual_dna_synthesizer',
  'war_table_synthesizer',
];

const STATE = process.argv[2];
const VALID_STATES = [
  'neutral', 'green', 'yellow-latency', 'rose-latency', 'rose-retry',
  'transient-failed', 'failed-permanently', 'locked-phase-cards', 'replay-modal-v1-of-3',
];
const ALL_TOKEN = 'all';
if (STATE !== ALL_TOKEN && !VALID_STATES.includes(STATE)) {
  console.error(`Usage: node seed-and-capture.mjs <${VALID_STATES.join('|')}|all>`);
  process.exit(2);
}

const TEST_PASSWORD = 'qbverify-' + Math.random().toString(36).slice(2, 14) + '-X1!';

// ── Supabase helpers ────────────────────────────────────────────────────────
async function createUser(tag) {
  const ts = Date.now();
  const email = `nizzar.ben+s5-${tag}-${ts}-${Math.random().toString(36).slice(2,8)}@gmail.com`;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: svc,
    body: JSON.stringify({
      email, email_confirm: true, password: TEST_PASSWORD,
      user_metadata: { signup_source: 'c2-step5-verify' },
    }),
  });
  const d = await r.json();
  if (!d.id) throw new Error('user create failed: ' + JSON.stringify(d));
  return { id: d.id, email };
}

async function signIn(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
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

async function insertArtifact(userId, slug, status, version, dispatchId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, artifact_type: slug, status, version: version || 1,
      phase: '01', content: status === 'delivered' ? {
        schema_version: '1.0',
        header: { eyebrow: '01', title: 'Seeded for capture', agent: slug, generated_at: new Date().toISOString(), version: 1 },
        body_sections: [{ heading: 'Seeded', prose: 'Synthetic state for screenshot capture.' }],
        data_blocks: [],
        footer: {},
      } : {},
      error: null,
      dispatch_id: dispatchId || null,
    }),
  });
  const rows = await r.json();
  return rows?.[0];
}

async function insertDispatch(userId, kind, status, agentsCount) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/dispatch_jobs`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, kind, status,
      agents_count: agentsCount || 1, agents_settled: 0,
      trigger: kind, agent_version: 1, retry_count: 0,
    }),
  });
  const rows = await r.json();
  return rows?.[0];
}

async function insertAgentRun(userId, slug, opts = {}) {
  // Default · started_at derived from now minus duration. Caller can pass an
  // explicit completedAt (epoch ms) to control ordering · used by the replay
  // seed to ensure v1 < v2 < v3 in started_at, independent of duration.
  const completedAt = opts.completedAt ? new Date(opts.completedAt) : new Date();
  const startedAt = new Date(completedAt.getTime() - (opts.durationMs || 12_000));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_runs`, {
    method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId, agent_slug: slug, agent_version: 1,
      trigger: opts.trigger || 'lock', dispatch_id: opts.dispatchId || null,
      artifact_id: opts.artifactId || null,
      qbp_snapshot: opts.qbpSnapshot || FULL_QBP,
      file_refs: [], runtime_args: {},
      started_at: startedAt.toISOString(), completed_at: completedAt.toISOString(),
      status: opts.status || 'succeeded',
      model: opts.model || 'claude-sonnet-4-6',
      tokens_in: 900, tokens_out: 700,
      duration_ms: opts.durationMs || 12_000,
      schema_retry_count: opts.retryCount || 0,
      error_payload: opts.errorPayload || null,
    }),
  });
  return (await r.json())?.[0];
}

async function deleteUser(userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc }).catch(() => {});
}

// Drop a slug's prior agent_runs for this user so subsequent inserts define
// the rolling-window mean cleanly. console.js computes latencyAvg over every
// succeeded run in the 7-day window, not the last N · without this, the
// seedGreen baseline at ~12 s drags any later bad-band runs back under
// threshold.
async function deleteAgentRunsForSlug(userId, slug) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/agent_runs?user_id=eq.${userId}&agent_slug=eq.${slug}`,
    { method: 'DELETE', headers: svc }
  ).catch(() => {});
}

// ── State recipes ───────────────────────────────────────────────────────────
async function seedNeutral(userId) {
  await setProfile(userId, {
    tier: 'starter',
    foundation_locked_at: new Date().toISOString(),
    foundation_lock_qbp: FULL_QBP,
    qbp: FULL_QBP,
  });
}

async function seedGreen(userId) {
  await seedNeutral(userId);
  for (const slug of AGENT_SLUGS) {
    const dj = await insertDispatch(userId, 'lock', 'completed', 4);
    const art = await insertArtifact(userId, slug, 'delivered', 1, dj.id);
    // Three clean runs each · 12 s duration, 0 retries → green
    for (let i = 0; i < 3; i++) {
      await insertAgentRun(userId, slug, {
        dispatchId: dj.id, artifactId: art.id,
        durationMs: 11_000 + Math.floor(Math.random() * 2_000),
        retryCount: 0, status: 'succeeded',
      });
    }
  }
}

async function seedYellowLatency(userId) {
  await seedGreen(userId);
  // Visual DNA into 20-23 s gold band. seedGreen leaves 3 runs at ~12 s on
  // this slug · the server averages over every succeeded run in the 7d
  // window, so we drop those first, then insert clean bad-band runs.
  const slug = 'visual_dna_synthesizer';
  await deleteAgentRunsForSlug(userId, slug);
  const art = (await fetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&artifact_type=eq.${slug}&select=id&order=version.desc&limit=1`,
    { headers: svc }
  ).then(r => r.json()))?.[0];
  for (let i = 0; i < 5; i++) {
    await insertAgentRun(userId, slug, {
      artifactId: art?.id, durationMs: 21_000 + i * 200, retryCount: 0, status: 'succeeded',
    });
  }
}

async function seedRoseLatency(userId) {
  await seedGreen(userId);
  // Visual DNA into rose band (>23 s). Drop seedGreen's baseline runs for
  // this slug first so the rolling mean reflects only the bad-band values.
  const slug = 'visual_dna_synthesizer';
  await deleteAgentRunsForSlug(userId, slug);
  const art = (await fetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&artifact_type=eq.${slug}&select=id&order=version.desc&limit=1`,
    { headers: svc }
  ).then(r => r.json()))?.[0];
  for (let i = 0; i < 5; i++) {
    await insertAgentRun(userId, slug, {
      artifactId: art?.id, durationMs: 24_000 + i * 200, retryCount: 0, status: 'succeeded',
    });
  }
}

async function seedRoseRetry(userId) {
  await seedGreen(userId);
  // Push Soul Map's retry rolling avg above 0.5
  const slug = 'soul_map_synthesizer';
  const art = (await fetch(
    `${SUPABASE_URL}/rest/v1/artifacts?user_id=eq.${userId}&artifact_type=eq.${slug}&select=id&order=version.desc&limit=1`,
    { headers: svc }
  ).then(r => r.json()))?.[0];
  for (let i = 0; i < 5; i++) {
    await insertAgentRun(userId, slug, {
      artifactId: art?.id, durationMs: 14_000, retryCount: 1, status: 'failed',
      errorPayload: { code: 'schema_validation_failed', stage: 'schema-validation' },
    });
  }
}

async function seedTransientFailed(userId) {
  await seedNeutral(userId);
  // Three agents delivered, Soul Map failed transient
  for (const slug of AGENT_SLUGS) {
    const dj = await insertDispatch(userId, 'lock', 'partial', 4);
    if (slug === 'soul_map_synthesizer') {
      const art = await insertArtifact(userId, slug, 'failed', 1, dj.id);
      await insertAgentRun(userId, slug, {
        dispatchId: dj.id, artifactId: art.id,
        durationMs: 8_000, retryCount: 0, status: 'failed',
        errorPayload: { code: 'model_call_failed', stage: 'claude-call' },
      });
      // Also need a prior delivered version so the rerun CTAs gate passes
      // ... no, on transient failed errStatus branch, rerunCtas does render
      // its standard buttons, but only if latest_artifact.status === 'delivered'.
      // This is exactly Case C territory · the screenshot will show the
      // failed state without buttons. Note this for the report.
    } else {
      const art = await insertArtifact(userId, slug, 'delivered', 1, dj.id);
      await insertAgentRun(userId, slug, {
        dispatchId: dj.id, artifactId: art.id, durationMs: 13_000, retryCount: 0,
      });
    }
  }
}

async function seedFailedPermanently(userId) {
  await seedNeutral(userId);
  for (const slug of AGENT_SLUGS) {
    if (slug === 'soul_map_synthesizer') {
      const dj = await insertDispatch(userId, 'lock', 'failed_permanently', 1);
      const art = await insertArtifact(userId, slug, 'failed', 1, dj.id);
      await insertAgentRun(userId, slug, {
        dispatchId: dj.id, artifactId: art.id,
        durationMs: 8_000, retryCount: 0, status: 'failed',
        errorPayload: { code: 'edge_timeout', stage: 'claude-call' },
      });
    } else {
      const dj = await insertDispatch(userId, 'lock', 'completed', 1);
      const art = await insertArtifact(userId, slug, 'delivered', 1, dj.id);
      await insertAgentRun(userId, slug, {
        dispatchId: dj.id, artifactId: art.id, durationMs: 13_000, retryCount: 0,
      });
    }
  }
}

async function seedLockedPhaseCards(userId) {
  await seedNeutral(userId);
  // Phase 02-05 cards are static per console.js · they render on any
  // signed-in user. Capture against a green state for the most natural
  // composition.
  await seedGreen(userId);
}

async function seedReplayModalV3(userId) {
  await seedNeutral(userId);
  // Three versions of Soul Map · v1 (root, oldest) → v2 → v3 (latest). The
  // capture script lands on v1 by picking the bottom-most Soul Map row in
  // the `started_at desc` run history. Explicit completedAt values ensure
  // v1 < v2 < v3 chronologically (the previous auto-derived `now - duration`
  // path inverted ordering when durations varied per version).
  const slug = 'soul_map_synthesizer';
  const baseline = Date.now() - 600_000; // 10 min ago
  let prevId = null;
  for (let v = 1; v <= 3; v++) {
    const dj = await insertDispatch(userId, v === 1 ? 'lock' : 'regenerate', 'completed', 1);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/artifacts`, {
      method: 'POST', headers: { ...svc, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId, artifact_type: slug, status: 'delivered',
        version: v, parent_artifact_id: prevId, phase: '01',
        content: {
          schema_version: '1.0',
          header: { eyebrow: '01', title: `Soul Map v${v}`, agent: slug,
                     generated_at: new Date(baseline + v * 60_000).toISOString(), version: v },
          body_sections: [{ heading: 'Seeded', prose: `Version ${v} for replay capture.` }],
          data_blocks: [],
          footer: {},
        },
        error: null, dispatch_id: dj.id,
      }),
    });
    const art = (await r.json())?.[0];
    // Distinct snapshot per version · replay should surface v1's specifically.
    await insertAgentRun(userId, slug, {
      dispatchId: dj.id, artifactId: art.id, durationMs: 12_000 + v * 1_000,
      completedAt: baseline + v * 60_000, // v1 = +1min, v2 = +2min, v3 = +3min
      qbpSnapshot: { ...FULL_QBP, brandName: `Lighthouse v${v}`, _capture_version: v },
    });
    prevId = art.id;
  }
  // Other 3 agents delivered after v3 so they don't push between the Soul Map
  // versions in the Run history desc list. Keeps v1 at the bottom.
  const others = AGENT_SLUGS.filter(s => s !== slug);
  for (let i = 0; i < others.length; i++) {
    const otherSlug = others[i];
    const dj = await insertDispatch(userId, 'lock', 'completed', 1);
    const art = await insertArtifact(userId, otherSlug, 'delivered', 1, dj.id);
    await insertAgentRun(userId, otherSlug, {
      dispatchId: dj.id, artifactId: art.id, durationMs: 13_000,
      completedAt: baseline + (4 + i) * 60_000, // 4min, 5min, 6min · all after v3
    });
  }
}

const SEED_RECIPES = {
  neutral: seedNeutral,
  green: seedGreen,
  'yellow-latency': seedYellowLatency,
  'rose-latency': seedRoseLatency,
  'rose-retry': seedRoseRetry,
  'transient-failed': seedTransientFailed,
  'failed-permanently': seedFailedPermanently,
  'locked-phase-cards': seedLockedPhaseCards,
  'replay-modal-v1-of-3': seedReplayModalV3,
};

// ── Playwright capture ──────────────────────────────────────────────────────
async function capture({ userId, email, session, state, outPath }) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: HEADLESS });
  const isReplay = state === 'replay-modal-v1-of-3';
  const viewport = state === 'mobile-stack'
    ? { width: 360, height: 1200 }
    : { width: 1280, height: 1200 };
  const context = await browser.newContext({ viewport });

  // Inject qb_session BEFORE navigation so window.QB.isAuthed() passes
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

  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.error('[browser]', msg.text()); });

  console.log(`Loading ${BASE}/agents…`);
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle', timeout: 60_000 });

  // Wait for the Console shell to render
  await page.waitForSelector('.console-shell', { timeout: 30_000 });
  // Give the data render a moment to paint
  await page.waitForTimeout(2_000);

  // For replay-modal-v1-of-3 · navigate to Run history view and click the
  // OLDEST row (v1, root of chain) to demonstrate replay's specific-run
  // version semantics. Rows order is `started_at desc` per console.js,
  // so the last row is the oldest run · v1, which has no parent_artifact_id
  // and is strictly non-latest in a 3-version chain.
  if (isReplay) {
    await page.click('.console-view-toggle_btn:nth-child(2)'); // Run history
    await page.waitForSelector('.run-row', { timeout: 10_000 });
    const rows = await page.$$('.run-row');
    if (rows.length >= 1) {
      // Find the row whose agent is Soul Map (the seeded 3-version chain)
      // and click the oldest among them. Falls back to last row overall.
      let targetRow = rows[rows.length - 1];
      for (let i = rows.length - 1; i >= 0; i--) {
        const text = await rows[i].innerText();
        if (text && text.includes('Soul Map')) { targetRow = rows[i]; break; }
      }
      await targetRow.click();
    }
    await page.waitForSelector('.replay-modal', { timeout: 5_000 });
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Screenshot saved: ${outPath}`);

  await browser.close();
}

// ── Per-state capture (extracted from main so `all` mode can iterate) ───────
async function runOneState(state) {
  const tag = state.replace(/[^a-z0-9]/g, '');
  let user;
  const started = Date.now();
  try {
    user = await createUser(tag);
    console.log(`\n── ${state} ──────────────────────────────────────`);
    console.log(`Created test user ${user.id.slice(0, 8)}... · seeding ${state}`);
    await SEED_RECIPES[state](user.id);
    const session = await signIn(user.email);
    console.log(`Session minted · token ${session.token.slice(0, 20)}...`);

    // Diagnostic · hit the Console API with the user's session and print the
    // server-decided health.dot per agent. Confirms the seed produced the
    // intended threshold state before the screenshot is captured.
    try {
      const apiRes = await fetch(`${BASE}/api/agents/console`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (apiRes.ok) {
        const payload = await apiRes.json();
        for (const a of (payload.agents || [])) {
          const avg = a.rolling?.duration_avg_7d_ms;
          console.log(`  · ${a.slug.padEnd(24)} dot=${a.health?.dot.padEnd(7)} retry=${a.health?.retry_state} latency=${a.health?.latency_state} avg_ms=${avg ? Math.round(avg) : 'null'}`);
        }
      } else {
        console.log(`  (api/agents/console returned ${apiRes.status})`);
      }
    } catch (e) { console.log(`  (api probe failed: ${e?.message})`); }

    const outPath = path.join(__dirname, `${state}.png`);
    await capture({ userId: user.id, email: user.email, session, state, outPath });
    return { state, ok: true, path: outPath, ms: Date.now() - started };
  } catch (e) {
    console.error(`FAILED [${state}]:`, e?.message || e);
    if (e?.stack) console.error(e.stack);
    return { state, ok: false, error: e?.message || String(e), ms: Date.now() - started };
  } finally {
    if (user?.id) {
      console.log(`Cleaning up test user…`);
      await deleteUser(user.id);
    }
  }
}

// ── Contact sheet · 3x3 thumbnail grid of every state PNG in the dir ────────
// Renders an HTML page through Playwright and screenshots it. Missing PNGs
// surface as a labelled placeholder so the operator can spot which state
// didn't capture on this run, instead of silently skipping.
async function buildContactSheet(outPath) {
  const { chromium } = await import('playwright');
  const tiles = VALID_STATES.map(s => {
    const p = path.join(__dirname, `${s}.png`);
    const exists = fs.existsSync(p);
    return { state: s, fileUri: exists ? `file://${p}` : null };
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { --ink: #2D1521; --cream: #F2EAD9; --cream-card: #F5EFE6; }
    body { margin: 0; padding: 24px; background: var(--cream); font-family: -apple-system, system-ui, sans-serif; color: var(--ink); }
    h1 { font-size: 18px; margin: 0 0 6px; font-weight: 600; }
    .meta { font-size: 11px; opacity: 0.6; margin-bottom: 18px; font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .tile { background: var(--cream-card); border: 2px solid var(--ink); border-radius: 8px; padding: 10px; box-shadow: 0 6px var(--ink); }
    .tile_label { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 600; margin-bottom: 8px; }
    .tile_img { width: 100%; height: 320px; object-fit: contain; object-position: top; background: var(--cream); border: 1px solid rgba(45,21,33,0.15); border-radius: 4px; }
    .tile_missing { width: 100%; height: 320px; display: flex; align-items: center; justify-content: center; background: rgba(184,112,77,0.08); border: 2px dashed rgba(184,112,77,0.5); border-radius: 4px; color: #B8704D; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; }
  </style></head><body>
    <h1>QB BrandOS · Agent Console · Step 5 capture contact sheet</h1>
    <div class="meta">${new Date().toISOString()} · ${BASE}</div>
    <div class="grid">
      ${tiles.map(t => `
        <div class="tile">
          <div class="tile_label">${t.state}</div>
          ${t.fileUri
            ? `<img class="tile_img" src="${t.fileUri}" alt="${t.state}">`
            : `<div class="tile_missing">PNG not on disk</div>`}
        </div>`).join('')}
    </div>
  </body></html>`;
  const tmpHtml = path.join(__dirname, '.contact-sheet.html');
  fs.writeFileSync(tmpHtml, html);
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
    const page = await context.newPage();
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: outPath, fullPage: true });
  } finally {
    await browser.close();
    try { fs.unlinkSync(tmpHtml); } catch {}
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  if (STATE === ALL_TOKEN) {
    console.log(`Firing all ${VALID_STATES.length} states sequentially against ${BASE}`);
    const results = [];
    for (const s of VALID_STATES) {
      results.push(await runOneState(s));
    }
    console.log(`\n── Summary ─────────────────────────────────────`);
    for (const r of results) {
      console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.state.padEnd(24)}  ${r.ms}ms${r.error ? '  · ' + r.error : ''}`);
    }
    const contactPath = path.join(__dirname, 'contact-sheet.png');
    console.log(`\nBuilding contact sheet…`);
    await buildContactSheet(contactPath);
    console.log(`Contact sheet: ${contactPath}`);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) process.exitCode = 1;
  } else {
    const r = await runOneState(STATE);
    if (!r.ok) process.exitCode = 1;
  }
})();
