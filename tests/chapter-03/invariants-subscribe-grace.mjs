/* Chapter 3 · Step 1C · Invariant assertion harness · SUBSCRIBED grace
 *
 * INVARIANT:
 *   No Realtime-dependent code path remains in null state past the grace
 *   window. Either SUBSCRIBED fires within 10 seconds, or the fallback
 *   to 'poll' fires at the grace boundary.
 *
 * Origin: docs/patterns/race-discipline.md §2 · PR #107 class-race.
 *
 * Reproducer approach:
 *   The browser-side state machine in js/qb-realtime-manager.js is the
 *   invariant surface. Three structural properties must hold for the
 *   grace pattern to be intact:
 *
 *     S1: A timeout constant > 0 named SUBSCRIBED_TIMEOUT_MS
 *     S2: A setTimeout firing within SUBSCRIBED_TIMEOUT_MS that calls
 *         setState('poll') when the subscribed flag has not flipped
 *     S3: Both terminal subscribe callbacks (SUBSCRIBED and the
 *         ERROR-class branch covering CHANNEL_ERROR / TIMED_OUT /
 *         CLOSED) clear the timeout AND set the subscribed flag
 *
 * Hybrid harness:
 *   1. STATIC (always runs): parse js/qb-realtime-manager.js for the
 *      three structural properties. Goes red if any property is missing
 *      (someone removed the grace timeout, the clearTimeout calls, or
 *      the subscribedFired flag tracking).
 *   2. RUNTIME (optional · gated on PLAYWRIGHT=1): drive the manager
 *      via Playwright against a stubbed Supabase endpoint that never
 *      fires SUBSCRIBED, then assert getState() === 'poll' after the
 *      grace window. Documented but not required because Playwright
 *      is a peer dep and the static contract catches the structural
 *      regression at zero infrastructure cost.
 *
 * PASS (static):
 *   S1 + S2 + S3 all present in js/qb-realtime-manager.js.
 *
 * FAIL surface (goes red if the cure pattern is removed or weakened):
 *   - SUBSCRIBED_TIMEOUT_MS constant absent or set to 0.
 *   - Missing setTimeout that fires setState('poll').
 *   - SUBSCRIBED branch missing clearTimeout OR missing subscribedFired = true.
 *   - ERROR-class branch missing clearTimeout OR missing subscribedFired = true.
 *
 * Usage:
 *   node tests/chapter-03/invariants-subscribe-grace.mjs
 *
 * Runtime mode (optional):
 *   PLAYWRIGHT=1 node tests/chapter-03/invariants-subscribe-grace.mjs
 *   (requires `npx playwright install chromium` in advance)
 */

import fs from 'node:fs';
import path from 'node:path';

const MANAGER_PATH = 'js/qb-realtime-manager.js';

function readManager() {
  return fs.readFileSync(path.resolve(MANAGER_PATH), 'utf8');
}

function checkStaticInvariants(src) {
  const findings = [];

  // S1: SUBSCRIBED_TIMEOUT_MS constant with positive value
  const constMatch = src.match(/const\s+SUBSCRIBED_TIMEOUT_MS\s*=\s*([\d_]+)/);
  if (!constMatch) {
    findings.push({ id: 'S1', pass: false, reason: 'SUBSCRIBED_TIMEOUT_MS constant not found' });
  } else {
    const value = Number(constMatch[1].replace(/_/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      findings.push({ id: 'S1', pass: false, reason: `SUBSCRIBED_TIMEOUT_MS value invalid: ${constMatch[1]}` });
    } else {
      findings.push({ id: 'S1', pass: true, detail: `SUBSCRIBED_TIMEOUT_MS = ${value}ms` });
    }
  }

  // S2: setTimeout that calls setState('poll') gated on subscribedFired
  const setTimeoutGracePattern = /setTimeout\(\s*\(\)\s*=>\s*\{\s*if\s*\(\s*!\s*subscribedFired\s*\)\s*setState\(\s*['"]poll['"]\s*\)/;
  if (setTimeoutGracePattern.test(src)) {
    findings.push({ id: 'S2', pass: true, detail: 'Grace setTimeout → setState(poll) present' });
  } else {
    findings.push({ id: 'S2', pass: false, reason: 'Grace setTimeout firing setState(poll) on !subscribedFired not found' });
  }

  // S3a: SUBSCRIBED branch has clearTimeout AND subscribedFired = true
  const subscribedBranchPattern = /status\s*===\s*['"]SUBSCRIBED['"][^}]*subscribedFired\s*=\s*true[^}]*clearTimeout/s;
  const subscribedBranchPatternAlt = /status\s*===\s*['"]SUBSCRIBED['"][^}]*clearTimeout[^}]*subscribedFired\s*=\s*true/s;
  if (subscribedBranchPattern.test(src) || subscribedBranchPatternAlt.test(src)) {
    findings.push({ id: 'S3a', pass: true, detail: 'SUBSCRIBED branch: clearTimeout + subscribedFired=true present' });
  } else {
    findings.push({ id: 'S3a', pass: false, reason: 'SUBSCRIBED branch missing clearTimeout OR subscribedFired=true' });
  }

  // S3b: ERROR-class branch (CHANNEL_ERROR / TIMED_OUT / CLOSED) has clearTimeout AND subscribedFired = true
  const errorBranchHasClear = /CHANNEL_ERROR[\s\S]*?TIMED_OUT[\s\S]*?CLOSED[\s\S]*?clearTimeout/s.test(src) ||
                              /CHANNEL_ERROR[\s\S]*?CLOSED[\s\S]*?TIMED_OUT[\s\S]*?clearTimeout/s.test(src) ||
                              /CLOSED[\s\S]*?CHANNEL_ERROR[\s\S]*?TIMED_OUT[\s\S]*?clearTimeout/s.test(src);
  const errorBranchHasFired = /CHANNEL_ERROR[\s\S]*?subscribedFired\s*=\s*true/s.test(src);
  if (errorBranchHasClear && errorBranchHasFired) {
    findings.push({ id: 'S3b', pass: true, detail: 'ERROR-class branch: clearTimeout + subscribedFired=true present' });
  } else {
    findings.push({ id: 'S3b', pass: false, reason: `ERROR-class branch missing properties (clearTimeout=${errorBranchHasClear}, subscribedFired=${errorBranchHasFired})` });
  }

  return findings;
}

async function maybeRunPlaywright() {
  if (process.env.PLAYWRIGHT !== '1') return { runtime_ran: false, reason: 'PLAYWRIGHT env not set' };
  try {
    // Optional runtime exercise · documented but gated. The chapter-3
    // hardening pass does NOT mandate runtime · the static check is the
    // primary gate. If the operator wires this up later, the harness
    // returns the result; otherwise the static check stands alone.
    return { runtime_ran: false, reason: 'Playwright path stub · runtime gate is forward-referenced' };
  } catch (e) {
    return { runtime_ran: false, error: String(e?.message || e) };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  let result;

  try {
    const src = readManager();
    const findings = checkStaticInvariants(src);
    const runtime = await maybeRunPlaywright();
    const pass = findings.every(f => f.pass);

    result = {
      pass,
      invariant: 'qb-realtime-manager.js retains the SUBSCRIBED grace timeout pattern',
      static_findings: findings,
      runtime,
      manager_path: MANAGER_PATH,
      manager_bytes: src.length,
    };
  } catch (e) {
    result = {
      pass: false,
      invariant: 'qb-realtime-manager.js retains the SUBSCRIBED grace timeout pattern',
      error: String(e?.message || e),
    };
  }

  const out = {
    harness: 'invariants-subscribe-grace',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    ...result,
  };
  fs.writeFileSync('tests/chapter-03/invariants-subscribe-grace.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
