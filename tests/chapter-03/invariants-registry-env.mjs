/* Chapter 3 · Step 3E · Invariant assertion harness · registry env discipline
 *
 * INVARIANT:
 *   No module-scope process.env read may gate registry membership or any
 *   request-path branch. The conforming shape is the TEST_AGENTS map +
 *   getAgent()/listAgentSlugs() request-time pattern (PR #172 re-land of
 *   #170). Additionally, every TEST_AGENTS META must pass the full §3.5
 *   contract (assertAgentMetaOrThrow) and appear in the artifact-schema
 *   KNOWN_AGENT_SLUGS allowlist.
 *
 * Origin: the 2026-06-10 incident. #170 moved test-agent env-flag reads
 * from module-init to handler-call time and made META validation
 * unconditional at module load. Two latent registration gaps detonated:
 *   1. file_test_agent META lacked the contract-required files[].source
 *      → registry module load threw on every Edge cold start → the whole
 *      agent runtime returned FUNCTION_INVOCATION_FAILED (~6 min outage,
 *      revert #171, cure + re-land #172).
 *   2. file_test_agent was absent from KNOWN_AGENT_SLUGS in
 *      js/qb-artifact-schema.js → run.js schema-validate rejected its
 *      delivered artifact (schema_validation_failed → artifact failed,
 *      cure #173).
 * This harness pins both halves plus the env-read discipline itself.
 *
 * Findings:
 *   E1 (functional) · flags unset at import: registry exposes exactly the
 *      production agents; getAgent() returns null for test slugs.
 *   E2 (functional) · flags set AFTER import, same module instance:
 *      test agents appear via getAgent()/listAgentSlugs(). This is the
 *      incident-class pin: a module-init env read cannot see a post-import
 *      env change, so regressing to module-init gating turns E2 red.
 *   E3 (functional) · frozen AGENTS map never contains a test agent,
 *      flags on or off (strictness: lock-foundation + console resolve
 *      via AGENTS[slug]?.META and therefore fail closed).
 *   E4 (contract) · every test-agent META passes assertAgentMetaOrThrow.
 *   E5 (cross-layer) · every registry slug (flags on) is present in the
 *      artifact-schema KNOWN_AGENT_SLUGS allowlist.
 *   E6 (static) · every process.env occurrence in agents/registry.js sits
 *      inside the getAgent or listAgentSlugs function body.
 *   E7 (static) · no file under api/ reads the test-agent env flags; the
 *      registry owns them.
 *
 * Usage:
 *   node tests/chapter-03/invariants-registry-env.mjs
 *
 * Deterministic per docs/patterns/harness-determinism.md: reads no
 * network, no /tmp env file; mutates only its own process env.
 */

import fs from 'node:fs';
import path from 'node:path';

const REGISTRY_PATH = 'agents/registry.js';
const TEST_FLAG_NAMES = ['FILE_TEST_AGENT', 'CHAIN_TEST_AGENT'];

function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

// Extract the body of a top-level `export function NAME(...) { ... }` by
// brace counting from its opening brace.
function extractFunctionBody(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = re.exec(src);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return { start: open, end: i };
    }
  }
  return null;
}

function checkInvariants() {
  const findings = [];

  // ─── Functional findings (E1-E5) ───────────────────────────────────────
  return import(path.resolve(REGISTRY_PATH)).then(async (reg) => {
    const prodSlugs = Object.keys(reg.AGENTS);

    // E1 · flags are unset (main() deleted them before import): the
    // registry must expose exactly the production agents.
    {
      const slugs = reg.listAgentSlugs();
      const testResolves = TEST_FLAG_NAMES.map(() => null);
      const fileAgent = reg.getAgent('file_test_agent');
      const chainAgent = reg.getAgent('chain_test_agent');
      const pass = slugs.length === prodSlugs.length
        && slugs.every(s => prodSlugs.includes(s))
        && fileAgent === null && chainAgent === null && testResolves.every(v => v === null);
      findings.push(pass
        ? { id: 'E1', pass: true, detail: `flags unset: listAgentSlugs()=${slugs.length} production slugs only, test slugs resolve null` }
        : { id: 'E1', pass: false, reason: `flags unset but registry leaks: slugs=${JSON.stringify(slugs)} file=${!!fileAgent} chain=${!!chainAgent}` });
    }

    // E2 · set flags AFTER import on the SAME module instance. Request-time
    // reads see the change; module-init reads cannot. This is the
    // incident-class pin.
    {
      for (const f of TEST_FLAG_NAMES) process.env[f] = '1';
      const slugs = reg.listAgentSlugs();
      const fileAgent = reg.getAgent('file_test_agent');
      const chainAgent = reg.getAgent('chain_test_agent');
      const testSlugs = slugs.filter(s => !prodSlugs.includes(s));
      const pass = !!fileAgent && !!chainAgent && testSlugs.includes('file_test_agent') && testSlugs.includes('chain_test_agent');
      findings.push(pass
        ? { id: 'E2', pass: true, detail: `flags set post-import: ${testSlugs.length} test agents visible at request time (${testSlugs.join(', ')})` }
        : { id: 'E2', pass: false, reason: `post-import env change invisible · membership is being decided at module init. slugs=${JSON.stringify(slugs)}` });
    }

    // E3 · frozen AGENTS map stays production-only with flags on.
    {
      const leaked = Object.keys(reg.AGENTS).filter(s => !prodSlugs.includes(s) || s.includes('test'));
      const frozen = Object.isFrozen(reg.AGENTS);
      const pass = leaked.length === 0 && frozen;
      findings.push(pass
        ? { id: 'E3', pass: true, detail: 'AGENTS is frozen and contains no test agent with flags on' }
        : { id: 'E3', pass: false, reason: `AGENTS frozen=${frozen} leaked=${JSON.stringify(leaked)}` });
    }

    // E4 · every test-agent META passes the full contract. Pins incident
    // half 1 (#172): unvalidated test META crashing module load.
    {
      const { assertAgentMetaOrThrow } = await import(path.resolve('agents/contract.js'));
      const testSlugs = reg.listAgentSlugs().filter(s => !prodSlugs.includes(s));
      const failures = [];
      for (const slug of testSlugs) {
        try {
          assertAgentMetaOrThrow(reg.getAgent(slug).META, `registry:${slug}`);
        } catch (e) {
          failures.push({ slug, error: String(e?.message || e).slice(0, 300) });
        }
      }
      findings.push(failures.length === 0
        ? { id: 'E4', pass: true, detail: `${testSlugs.length} test-agent META(s) pass assertAgentMetaOrThrow: ${testSlugs.join(', ')}` }
        : { id: 'E4', pass: false, reason: `contract violations: ${JSON.stringify(failures)}` });
    }

    // E5 · registry ↔ artifact-schema allowlist consistency. Pins incident
    // half 2 (#173): registered agent missing from KNOWN_AGENT_SLUGS.
    {
      const { KNOWN_AGENT_SLUGS } = await import(path.resolve('js/qb-artifact-schema.js'));
      const slugs = reg.listAgentSlugs();
      const missing = slugs.filter(s => !KNOWN_AGENT_SLUGS.includes(s));
      findings.push(missing.length === 0
        ? { id: 'E5', pass: true, detail: `all ${slugs.length} registry slugs present in KNOWN_AGENT_SLUGS` }
        : { id: 'E5', pass: false, reason: `registry slugs missing from artifact-schema allowlist: ${JSON.stringify(missing)}` });
    }

    // ─── Static findings (E6-E7) ─────────────────────────────────────────

    // E6 · every process.env occurrence in the registry sits inside the
    // getAgent or listAgentSlugs body.
    {
      const raw = fs.readFileSync(path.resolve(REGISTRY_PATH), 'utf8');
      const src = stripCommentsAndStrings(raw);
      const allowedRanges = ['getAgent', 'listAgentSlugs']
        .map(n => extractFunctionBody(src, n))
        .filter(Boolean);
      const offenders = [];
      const re = /process\.env/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const inAllowed = allowedRanges.some(r => m.index > r.start && m.index < r.end);
        if (!inAllowed) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(line);
        }
      }
      findings.push(offenders.length === 0
        ? { id: 'E6', pass: true, detail: `every process.env read in ${REGISTRY_PATH} sits inside getAgent/listAgentSlugs` }
        : { id: 'E6', pass: false, reason: `module-scope (or out-of-helper) process.env reads at ${REGISTRY_PATH} line(s) ${offenders.join(', ')}` });
    }

    // E7 · no api/ file reads the test-agent env flags. The registry owns
    // them; a request-path branch reading them directly re-opens the class.
    {
      const offenders = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (entry.name.endsWith('.js')) {
            const src = stripCommentsAndStrings(fs.readFileSync(p, 'utf8'));
            for (const flag of TEST_FLAG_NAMES) {
              if (src.includes(`process.env.${flag}`) || new RegExp(`process\\.env\\[.{0,3}${flag}`).test(src)) {
                offenders.push(`${p}:${flag}`);
              }
            }
          }
        }
      };
      walk(path.resolve('api'));
      findings.push(offenders.length === 0
        ? { id: 'E7', pass: true, detail: 'no api/ file reads FILE_TEST_AGENT or CHAIN_TEST_AGENT' }
        : { id: 'E7', pass: false, reason: `api files read test-agent flags directly: ${JSON.stringify(offenders)}` });
    }

    return findings;
  });
}

async function main() {
  const startedAt = new Date().toISOString();

  // Flags must be unset at import time for E1; the harness owns its env.
  for (const f of TEST_FLAG_NAMES) delete process.env[f];

  let result;
  try {
    const findings = await checkInvariants();
    const pass = findings.every(f => f.pass);
    result = {
      pass,
      invariant: 'No module-scope env read gates registry membership or request-path branches; TEST_AGENTS METAs pass contract + artifact-schema allowlist',
      findings,
    };
  } catch (e) {
    result = {
      pass: false,
      invariant: 'No module-scope env read gates registry membership or request-path branches',
      error: String(e?.message || e),
    };
  }

  const out = {
    harness: 'invariants-registry-env',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    ...result,
  };
  fs.writeFileSync('tests/chapter-03/invariants-registry-env.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
