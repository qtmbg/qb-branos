/* scripts/registry-smoke.mjs · the registry merge gate, executable half.
 *
 * STANDING GATE (binding from 2026-06-10, all chapters): any merge
 * touching agents/, the registry, or the dispatch path requires
 *   (a) this smoke run locally with ALL test flags set, output recorded
 *       verbatim in the PR body, and
 *   (b) the post-deploy unauthenticated 401 probe on /api/agents/run and
 *       /api/agents/console before the run continues.
 *
 * Why: #170 took production down on Edge cold start via a latent
 * file_test_agent META that unconditional load-time validation correctly
 * detonated (revert #171, cure + re-land #172, allowlist cure #173). The
 * validation stays unconditional; this gate catches violations before
 * deploy instead of in production.
 *
 * Checks:
 *   1. registry imports clean with all test flags set (module-load
 *      validation passes for every META, production + test).
 *   2. listAgentSlugs() returns every production agent plus every
 *      TEST_AGENTS entry; getAgent() resolves each.
 *   3. every test-agent META passes assertAgentMetaOrThrow standalone.
 *   4. every registry slug is present in the artifact-schema
 *      KNOWN_AGENT_SLUGS allowlist (the #173 gap class).
 *
 * Usage:
 *   node scripts/registry-smoke.mjs
 *
 * Exit 0 = gate passes. Any nonzero = do not merge.
 */

const TEST_FLAGS = ['FILE_TEST_AGENT', 'CHAIN_TEST_AGENT'];
for (const f of TEST_FLAGS) process.env[f] = '1';

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
let failed = false;
const fail = (s) => { failed = true; say(`FAIL · ${s}`); };

say(`registry-smoke · flags set: ${TEST_FLAGS.map(f => `${f}=1`).join(' ')}`);

let reg;
try {
  reg = await import('../agents/registry.js');
  say('1. registry import: OK (module-load META validation passed for all agents)');
} catch (e) {
  fail(`1. registry import threw · this is the #170-class production crash, caught pre-deploy:\n${String(e?.message || e)}`);
  process.exit(1);
}

const prodSlugs = Object.keys(reg.AGENTS);
const slugs = reg.listAgentSlugs();
const testSlugs = slugs.filter(s => !prodSlugs.includes(s));
say(`2. listAgentSlugs(): ${JSON.stringify(slugs)}`);
say(`   production: ${prodSlugs.length} · test: ${testSlugs.length}`);
if (testSlugs.length < TEST_FLAGS.length) {
  fail(`2. expected at least ${TEST_FLAGS.length} test agents with all flags set, got ${testSlugs.length}`);
}
for (const slug of slugs) {
  const a = reg.getAgent(slug);
  if (!a || !a.META || typeof a.run !== 'function') fail(`2. getAgent(${slug}) did not resolve to { META, run }`);
}
if (!failed) say('   getAgent() resolves every slug to { META, run }');

try {
  const { assertAgentMetaOrThrow } = await import('../agents/contract.js');
  for (const slug of testSlugs) {
    assertAgentMetaOrThrow(reg.getAgent(slug).META, `registry-smoke:${slug}`);
  }
  say(`3. test-agent METAs pass assertAgentMetaOrThrow: ${testSlugs.join(', ') || '(none)'}`);
} catch (e) {
  fail(`3. test-agent META contract violation:\n${String(e?.message || e)}`);
}

try {
  const { KNOWN_AGENT_SLUGS } = await import('../js/qb-artifact-schema.js');
  const missing = slugs.filter(s => !KNOWN_AGENT_SLUGS.includes(s));
  if (missing.length) fail(`4. registry slugs missing from KNOWN_AGENT_SLUGS (the #173 gap): ${JSON.stringify(missing)}`);
  else say(`4. all ${slugs.length} registry slugs present in artifact-schema KNOWN_AGENT_SLUGS`);
} catch (e) {
  fail(`4. could not cross-check artifact schema: ${String(e?.message || e)}`);
}

say(failed ? 'registry-smoke: RED · do not merge' : 'registry-smoke: GREEN · paste this output into the PR body');
process.exit(failed ? 1 : 0);
