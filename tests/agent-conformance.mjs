#!/usr/bin/env node
// tests/agent-conformance.mjs
// Chapter 2 · Step 3
//
// Single-command conformance runner per spec §11.12.1.
//
//   node tests/agent-conformance.mjs <agent_slug>
//   node tests/agent-conformance.mjs --all
//
// Asserts (per §11.12.1):
//   1. Contract schema valid · static check, runs offline
//   2. Happy path returns valid output · NEEDS ANTHROPIC_API_KEY for live
//      Claude call AND schema validator. Skipped if no key (CI mode).
//   3. Documented error codes on each known failure mode · runs the
//      offline-triggerable codes per the per-agent fixtures. Codes that
//      need a live trigger are reported as "needs live trigger" rather
//      than as failures.
//   4. Writes correct agent_version to dispatch_jobs · DEFERRED to step 4
//      (no /api/agents/run runtime yet).
//   5. Writes qbp_snapshot to agent_runs · DEFERRED to step 4.
//
// Exit code:
//   0 · every runnable assertion passes
//   1 · any runnable assertion fails
//   2 · invocation error (unknown slug, etc)
//
// Output is one structured line per assertion + one final summary line
// matching the spec format: `<slug> · PASS` or `<slug> · FAIL: <reason>`.
// CI uses the exit code; humans read the per-assertion lines.

import { AGENTS, getAgent, listAgentSlugs } from '../agents/registry.js';
import { validateAgentMeta } from '../agents/contract.js';
import { validateArtifact } from '../js/qb-artifact-schema.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const LIVE = Boolean(ANTHROPIC_KEY);

function line(slug, label, status, detail) {
  const tag = status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : status === 'skip' ? 'SKIP' : 'DEFER';
  const suffix = detail ? ` · ${detail}` : '';
  console.log(`  ${slug} · ${label} · ${tag}${suffix}`);
  return status === 'fail';
}

async function loadFixtures(slug) {
  const path = new URL(`./agent-conformance/${slug.replace(/_synthesizer$/, '').replace(/_/g, '-')}.fixtures.mjs`, import.meta.url);
  try {
    return await import(path.href);
  } catch (e) {
    return null;
  }
}

async function runAssertion1(slug, META) {
  const { ok, errors } = validateAgentMeta(META);
  const hard = errors.filter(e => e.level !== 'note');
  if (!ok) {
    const reason = hard.map(e => `${e.path}: ${e.message}`).join('; ');
    return line(slug, 'a1 contract-schema', 'fail', reason);
  }
  const notes = errors.filter(e => e.level === 'note');
  return line(slug, 'a1 contract-schema', 'pass', notes.length ? `${notes.length} note(s)` : '');
}

async function runAssertion2(slug, agent, fixtures) {
  if (!LIVE) {
    return line(slug, 'a2 happy-path', 'skip', 'ANTHROPIC_API_KEY not set · re-run live to verify');
  }
  if (!fixtures?.HAPPY_PATH_QBP) {
    return line(slug, 'a2 happy-path', 'fail', 'no HAPPY_PATH_QBP fixture');
  }

  let result;
  try {
    result = await agent.run({
      qbp: fixtures.HAPPY_PATH_QBP,
      dependencies: {},
      files: [],
      runtime_args: {},
      anthropicKey: ANTHROPIC_KEY,
    });
  } catch (e) {
    return line(slug, 'a2 happy-path', 'fail', `agent threw: ${(e?.message || '').slice(0, 200)}`);
  }

  if (!result || result.ok !== true) {
    return line(slug, 'a2 happy-path', 'fail', `expected ok:true, got ${JSON.stringify(result).slice(0, 200)}`);
  }
  const validation = validateArtifact(result.content);
  if (!validation.valid) {
    return line(slug, 'a2 happy-path', 'fail', `content schema invalid: ${JSON.stringify(validation.errors).slice(0, 200)}`);
  }
  if (!Number.isInteger(result.meta?.tokens_in) || result.meta.tokens_in <= 0) {
    return line(slug, 'a2 happy-path', 'fail', 'meta.tokens_in must be a positive integer');
  }
  if (!Number.isInteger(result.meta?.tokens_out) || result.meta.tokens_out <= 0) {
    return line(slug, 'a2 happy-path', 'fail', 'meta.tokens_out must be a positive integer');
  }
  if (!Number.isInteger(result.meta?.duration_ms) || result.meta.duration_ms <= 0) {
    return line(slug, 'a2 happy-path', 'fail', 'meta.duration_ms must be a positive integer');
  }
  return line(slug, 'a2 happy-path', 'pass', `tokens=${result.meta.tokens_in}+${result.meta.tokens_out} in ${result.meta.duration_ms}ms`);
}

async function runAssertion3(slug, agent, fixtures, META) {
  const declared = new Set(META.error_codes || []);
  const offline = fixtures?.OFFLINE_ERROR_FIXTURES || [];
  const live = fixtures?.LIVE_ERROR_CODES || [];

  let anyFail = false;

  for (const fx of offline) {
    if (!declared.has(fx.code)) {
      anyFail = line(slug, `a3 error.${fx.code}`, 'fail', 'fixture declared but META.error_codes omits it') || anyFail;
      continue;
    }
    let result;
    try {
      result = await agent.run(fx.runArgs);
    } catch (e) {
      anyFail = line(slug, `a3 error.${fx.code}`, 'fail', `agent threw: ${(e?.message || '').slice(0, 200)}`) || anyFail;
      continue;
    }
    if (result?.ok !== false) {
      anyFail = line(slug, `a3 error.${fx.code}`, 'fail', `expected ok:false, got ${JSON.stringify(result).slice(0, 200)}`) || anyFail;
      continue;
    }
    if (result.error !== fx.code) {
      anyFail = line(slug, `a3 error.${fx.code}`, 'fail', `expected error="${fx.code}", got "${result.error}"`) || anyFail;
      continue;
    }
    line(slug, `a3 error.${fx.code}`, 'pass', `stage=${result.stage || '<none>'}`);
  }

  // Codes that need a live trigger are reported, not failed.
  for (const lc of live) {
    if (!declared.has(lc.code)) continue;
    line(slug, `a3 error.${lc.code}`, 'defer', `needs live trigger · ${lc.description}`);
  }

  // Codes declared in META but with no fixture at all.
  const handled = new Set([
    ...offline.map(f => f.code),
    ...live.map(f => f.code),
  ]);
  for (const code of declared) {
    if (!handled.has(code)) {
      anyFail = line(slug, `a3 error.${code}`, 'fail', 'declared in META.error_codes but no fixture supplied') || anyFail;
    }
  }

  return anyFail;
}

function runAssertion4(slug) {
  return line(slug, 'a4 agent_version-write', 'defer', 'requires /api/agents/run · step 4');
}

function runAssertion5(slug) {
  return line(slug, 'a5 qbp_snapshot-write', 'defer', 'requires /api/agents/run · step 4');
}

async function conform(slug) {
  const agent = getAgent(slug);
  if (!agent) {
    console.log(`${slug} · FAIL: not registered in agents/registry.js`);
    return 2;
  }
  const META = agent.META;
  const fixtures = await loadFixtures(slug);

  console.log(`Running conformance for ${slug} · live mode: ${LIVE ? 'YES (ANTHROPIC_API_KEY set)' : 'NO (offline · a2 will skip)'}`);

  let anyFail = false;
  anyFail = (await runAssertion1(slug, META))    || anyFail;
  anyFail = (await runAssertion2(slug, agent, fixtures)) || anyFail;
  anyFail = (await runAssertion3(slug, agent, fixtures, META)) || anyFail;
  runAssertion4(slug);
  runAssertion5(slug);

  if (anyFail) {
    console.log(`${slug} · FAIL: one or more runnable assertions failed (see lines above)`);
    return 1;
  }
  console.log(`${slug} · PASS (a1+a3 verified · a2 ${LIVE ? 'verified' : 'skipped offline'} · a4+a5 deferred to step 4)`);
  return 0;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tests/agent-conformance.mjs <agent_slug>');
    console.error('       node tests/agent-conformance.mjs --all');
    process.exit(2);
  }

  if (arg === '--all') {
    const slugs = listAgentSlugs();
    if (slugs.length === 0) {
      console.error('No agents registered. Did /agents/registry.js import them?');
      process.exit(2);
    }
    let worst = 0;
    for (const slug of slugs) {
      const code = await conform(slug);
      if (code > worst) worst = code;
      console.log('');
    }
    process.exit(worst);
  }

  const code = await conform(arg);
  process.exit(code);
}

main().catch(e => {
  console.error('conformance runner threw:', e?.message || e);
  process.exit(2);
});
