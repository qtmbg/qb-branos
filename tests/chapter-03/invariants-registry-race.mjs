/* Chapter 3 · Step 1C · Invariant assertion harness · registry race
 *
 * INVARIANT:
 *   No dispatch can resolve an agent slug from an incompletely-loaded
 *   registry. Equivalent: if the dispatch handler is reachable, the
 *   registry is fully populated.
 *
 * Origin: docs/patterns/race-discipline.md §3 · PR #115 class-race.
 *
 * The structural cure (sync top-of-module imports of agents/registry.js)
 * makes this invariant a regression-against-future-change gate. If
 * someone converts a registry import to a lazy `await import(...)`, the
 * race shape returns and this harness goes red.
 *
 * Hybrid harness:
 *   1. STATIC: parse the production import sites for the registry
 *      module. Every Edge function that dispatches must use a
 *      static-top-of-module import, NOT a lazy/dynamic import.
 *   2. RUNTIME: optional Edge cold-start parallel-dispatch under
 *      operator coordination. Documented; gated on RUNTIME=1.
 *
 * PASS (static):
 *   Every audited Edge entry point uses a static top-of-module import
 *   of agents/registry.js. No lazy or dynamic import of the registry.
 *
 * FAIL surface (goes red if the cure pattern is removed):
 *   - Any audited Edge file uses `await import(...)` against the
 *     registry path.
 *   - Any audited Edge file has the registry imported inside the
 *     handler scope (function body) instead of at module top.
 *
 * Usage:
 *   node tests/chapter-03/invariants-registry-race.mjs
 *
 * Reads no env. Pure static analysis at default; runtime gates on
 * env=RUNTIME=1 + /tmp/.env.qb-branos.live-backup.
 */

import fs from 'node:fs';
import path from 'node:path';

const REGISTRY_PATH = 'agents/registry.js';
const AUDITED_EDGE_SITES = [
  'api/lock-foundation.js',
  'api/agents/run.js',
  'api/_lib/chain-trigger.js',
];

function checkStaticInvariants() {
  const findings = [];

  // S1: registry module exists and is statically loadable (no top-level await)
  try {
    const src = fs.readFileSync(path.resolve(REGISTRY_PATH), 'utf8');
    const topLevelAwait = /^[^/\n]*await\s/m.test(src);
    if (topLevelAwait) {
      findings.push({ id: 'S1', pass: false, reason: 'agents/registry.js contains top-level await · forces deferred resolution' });
    } else {
      findings.push({ id: 'S1', pass: true, detail: 'agents/registry.js has no top-level await' });
    }
  } catch (e) {
    findings.push({ id: 'S1', pass: false, reason: `Cannot read ${REGISTRY_PATH}: ${e.message}` });
  }

  // S2: each audited Edge site uses static (non-lazy) import of the registry.
  //   Static-import detection: any `import ... from '...agents/registry.js'`
  //   pattern across the file. Edge functions have multi-line imports +
  //   leading file-header comments; parsing the "import section" is fragile,
  //   so we scan the whole file. The lazy-import check below catches any
  //   `await import(...)` of the registry as the actual anti-pattern.
  for (const site of AUDITED_EDGE_SITES) {
    const id = `S2:${site}`;
    let src;
    try {
      src = fs.readFileSync(path.resolve(site), 'utf8');
    } catch (e) {
      findings.push({ id, pass: false, reason: `Cannot read ${site}: ${e.message}` });
      continue;
    }

    // Required: a static import of agents/registry.js anywhere in the file.
    //   Pattern handles single-line `import {x} from '...registry.js'`
    //   and multi-line `import {\n  x,\n  y,\n} from '...registry.js'`.
    const hasStaticImport = /import\s+(?:\*\s+as\s+\w+|\{[\s\S]*?\}|\w+)\s+from\s+['"][^'"]*agents\/registry\.js['"]/.test(src);

    // Forbidden: any dynamic `await import(...)` of the registry.
    const hasLazyImport = /await\s+import\s*\(\s*['"][^'"]*agents\/registry\.js['"]\s*\)/.test(src);

    // Also forbidden: any non-awaited `import(...)` of the registry inside
    // a function body (the `.then(...)` pattern that PR #115 cured).
    const hasDeferredImport = /(?<!from\s+)import\s*\(\s*['"][^'"]*agents\/registry\.js['"]\s*\)/.test(src);

    if (hasStaticImport && !hasLazyImport && !hasDeferredImport) {
      findings.push({ id, pass: true, detail: `${site}: static import only` });
    } else {
      findings.push({
        id,
        pass: false,
        reason: `${site}: static=${hasStaticImport}, lazy_await=${hasLazyImport}, deferred=${hasDeferredImport}`,
      });
    }
  }

  // S3: registry calls the META validator at module load (sync barrier).
  //   The chapter-2 registry uses assertAgentMetaOrThrow from contract.js.
  //   Any sync-load validator name from the contract module satisfies the
  //   invariant; we look for the canonical call shape.
  try {
    const src = fs.readFileSync(path.resolve(REGISTRY_PATH), 'utf8');
    const topLevelValidator = /assertAgentMetaOrThrow\s*\(/.test(src) ||
                              /validateAgentMeta\s*\(/.test(src);
    if (topLevelValidator) {
      findings.push({ id: 'S3', pass: true, detail: 'Registry calls META validator at module load (assertAgentMetaOrThrow)' });
    } else {
      findings.push({ id: 'S3', pass: false, reason: 'Registry does not call a META validator at module load · contract gate bypassed' });
    }

    // S4: registry uses static ESM imports of each agent module (PR #115 cure).
    //   The pre-cure shape was `import().then(m => AGENTS[slug] = m)` inside
    //   a conditional. The cure is `import { META, run } from './slug.js'`
    //   at the top of the module. Detect: agent module imports must all be
    //   static (no `import(...)` calls without `from` clause anywhere).
    const dynamicAgentImport = /(?<!from\s+)import\s*\(\s*['"][^'"]*\.(?:js|mjs)['"]\s*\)/.test(src);
    if (!dynamicAgentImport) {
      findings.push({ id: 'S4', pass: true, detail: 'Registry uses only static ESM imports for agent modules (PR #115 cure intact)' });
    } else {
      findings.push({ id: 'S4', pass: false, reason: 'Registry contains a dynamic import() · the PR #115 race shape has returned' });
    }
  } catch (e) {
    findings.push({ id: 'S3', pass: false, reason: `Cannot re-read ${REGISTRY_PATH}: ${e.message}` });
  }

  return findings;
}

async function maybeRunRuntime() {
  if (process.env.RUNTIME !== '1') return { runtime_ran: false, reason: 'RUNTIME env not set' };
  return { runtime_ran: false, reason: 'Runtime exercise is forward-referenced · static gate is primary' };
}

async function main() {
  const startedAt = new Date().toISOString();
  let result;

  try {
    const findings = checkStaticInvariants();
    const runtime = await maybeRunRuntime();
    const pass = findings.every(f => f.pass);

    result = {
      pass,
      invariant: 'No Edge dispatcher uses a lazy/dynamic import of agents/registry.js; sync top-of-module load is the structural barrier',
      static_findings: findings,
      runtime,
      audited_sites: AUDITED_EDGE_SITES,
    };
  } catch (e) {
    result = {
      pass: false,
      invariant: 'No Edge dispatcher uses a lazy/dynamic import of agents/registry.js',
      error: String(e?.message || e),
    };
  }

  const out = {
    harness: 'invariants-registry-race',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    ...result,
  };
  fs.writeFileSync('tests/chapter-03/invariants-registry-race.last-run.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
