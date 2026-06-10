# Pattern · registry merge gate · smoke before merge, probe after deploy

**Origin:** the 2026-06-10 incident (PRs #170 → #171 revert → #172 re-land → #173 allowlist cure).
**Status:** STANDING GATE, binding from 2026-06-10, all chapters.

Any merge touching `agents/`, the registry, or the dispatch path requires both halves, in order:

1. **Pre-merge, local:** run `node scripts/registry-smoke.mjs` and record its output verbatim in the PR body. A merge claim of "verified" without this output is invalid.
2. **Post-deploy, production:** probe `POST /api/agents/run` and `GET /api/agents/console` unauthenticated. Expect handler-level 401. Any 500 `FUNCTION_INVOCATION_FAILED` is RED: revert immediately, then surface.

## Why this gate exists

#170 moved test-agent env-flag reads from module-init to handler-call time and made `assertAgentMetaOrThrow` unconditional for all METAs at registry module load. Both changes were correct. But `agents/file-test-agent.js` carried a latent contract violation (`files[0].source` missing) that had never been validated in any environment, because the pre-#170 registry validated only the four production METAs.

Result: registry module load threw on every Edge cold start. Five functions import the registry (run, rerun, console, lock-foundation, chain-trigger); the whole agent runtime returned `FUNCTION_INVOCATION_FAILED` in production for ~6 minutes until revert #171 landed.

A second gap of the same class surfaced one layer deeper on the re-fire: `file_test_agent` was absent from `KNOWN_AGENT_SLUGS` in `js/qb-artifact-schema.js`, so run.js schema-validate rejected its delivered artifact (#173).

The load-time validation stays unconditional. That is the point: it catches broken METAs before they can accept dispatches. The gate moves the detonation from production cold start to a local terminal.

## What the smoke covers

`scripts/registry-smoke.mjs` sets all test flags, imports the registry, and asserts:

1. Module load passes (every META, production and test, validates).
2. `listAgentSlugs()` lists every production and test agent; `getAgent()` resolves each to `{ META, run }`.
3. Every test-agent META passes `assertAgentMetaOrThrow` standalone.
4. Every registry slug is present in the artifact-schema `KNOWN_AGENT_SLUGS` allowlist (the #173 gap class).

The regression harness `tests/chapter-03/invariants-registry-env.mjs` pins the same invariants plus the env-read discipline (no module-scope env read may gate registry membership or any request-path branch) and runs with the chapter-3 invariant set.

## Adding a new agent: the checklist this gate enforces

A new agent (production or test) registers on at least three surfaces. Miss one and the failure appears at a different layer each time:

| Surface | Miss symptom |
|---|---|
| `agents/registry.js` entry | `unknown_agent` at dispatch |
| META passes `agents/contract.js` | module-load throw → runtime-wide FUNCTION_INVOCATION_FAILED |
| `KNOWN_AGENT_SLUGS` in `js/qb-artifact-schema.js` | `schema_validation_failed` → artifact `failed` |

Run the smoke; it checks all three.
