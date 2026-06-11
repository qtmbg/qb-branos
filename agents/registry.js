// agents/registry.js
// Chapter 2 · Step 3 · phase B complete
// Chapter 3 · Step 3E · flag-runtime-fix (2026-05-22)
//
// Single import map for every contract-conformant agent. The runtime
// (/api/agents/run, shipping in step 4) imports AGENTS and the
// getAgent/listAgentSlugs helpers from this file only. Adding a new
// agent is one file under /agents/ + one line below.
//
// Every entry is validated against the §3.5 contract via the imported
// assertAgentMetaOrThrow at module load. A contract violation throws,
// which prevents the runtime from accepting dispatches for a broken
// agent · this is the §11.12.1 "rejected at registry import time"
// requirement.
//
// Feature-flagged test agents (chain_test_agent, file_test_agent):
// the env-flag check moved from MODULE-INIT to REQUEST-TIME per
// chat 2026-05-22. Vercel Edge has a build-time vs runtime env-access
// split: process.env reads at top-level (module init) may evaluate
// against build-time-snapshot env, while reads inside handler functions
// evaluate against current runtime env. Probe diagnostic on preview
// deploy dpl_92EaqJaoi22sdETn8dzS3dDWMX3j (PR #169) surfaced the split
// directly: FILE_TEST_AGENT was 'present:true, charCodes:[49]' at
// handler-call time, but AGENTS at the same isolate did NOT include
// file_test_agent · meaning module-init evaluated the env-flag check
// as false. The fix moves both flag reads (FILE_TEST_AGENT and
// CHAIN_TEST_AGENT) to the runtime helpers getAgent() and
// listAgentSlugs() · they read process.env when called, which is
// always at request time from Edge handlers.

import { assertAgentMetaOrThrow, checkLatencyBudget } from './contract.js';
import { META as soulMapMeta, run as soulMapRun } from './soul-map.js';
import { META as sensescapeMeta, run as sensescapeRun } from './sensescape.js';
import { META as visualDnaMeta, run as visualDnaRun } from './visual-dna.js';
import { META as warTableMeta, run as warTableRun } from './war-table.js';
import { META as logoDirectionMeta, run as logoDirectionRun } from './logo-direction.js';
import { META as logoEvaluationMeta, run as logoEvaluationRun } from './logo-evaluation.js';
import { META as chainTestMeta, run as chainTestRun } from './chain-test-agent.js';
import { META as fileTestMeta, run as fileTestRun } from './file-test-agent.js';

// Validate META for all agents (real + test) at module load · cheap,
// no env reads. If any META is malformed, fail fast at module load
// regardless of whether the test-agent flag is set.
assertAgentMetaOrThrow(soulMapMeta, 'agents/soul-map.js');
assertAgentMetaOrThrow(sensescapeMeta, 'agents/sensescape.js');
assertAgentMetaOrThrow(visualDnaMeta, 'agents/visual-dna.js');
assertAgentMetaOrThrow(warTableMeta, 'agents/war-table.js');
assertAgentMetaOrThrow(logoDirectionMeta, 'agents/logo-direction.js');
assertAgentMetaOrThrow(logoEvaluationMeta, 'agents/logo-evaluation.js');
assertAgentMetaOrThrow(chainTestMeta, 'agents/chain-test-agent.js');
assertAgentMetaOrThrow(fileTestMeta, 'agents/file-test-agent.js');

// Per §5.2.1: latency-budget pre-check at registry load. Warnings collect
// here so the runtime can route them through §5.8.2 operator-notify on
// first dispatch (the operator-notify module needs Resend at runtime, not
// at module-load).
export const LATENCY_BUDGET_WARNINGS = [];
for (const meta of [soulMapMeta, sensescapeMeta, visualDnaMeta, warTableMeta, logoDirectionMeta, logoEvaluationMeta]) {
  const check = checkLatencyBudget(meta);
  if (!check.withinBudget) {
    LATENCY_BUDGET_WARNINGS.push(check);
    console.warn(`[agents/registry] latency-budget warning: ${check.message}`);
  }
}

console.log('agent registry loaded · 6 prod agents + 2 test agents (flag-gated at request time)');

// ─── Real agents · ALWAYS loaded · frozen at module init ─────────────────
// These are the production agents. No env gates. The frozen map is the
// canonical source for any code that needs to enumerate or look up a real
// agent by slug.
export const AGENTS = Object.freeze({
  [soulMapMeta.slug]: { META: soulMapMeta, run: soulMapRun },
  [sensescapeMeta.slug]: { META: sensescapeMeta, run: sensescapeRun },
  [visualDnaMeta.slug]: { META: visualDnaMeta, run: visualDnaRun },
  [warTableMeta.slug]: { META: warTableMeta, run: warTableRun },
  // Chapter 4 step 1 · the first Phase 02 agent. Registered for dispatch
  // and harness verification; Console-invisible until the operator signs
  // the prompt (PROMPT_HOLD_SLUGS in api/agents/console.js).
  [logoDirectionMeta.slug]: { META: logoDirectionMeta, run: logoDirectionRun },
  // Chapter 4 step 2 · Logo Evaluation. Merges behind PROMPT_HOLD_SLUGS
  // (standing policy); Console-invisible until the prompt is signed.
  [logoEvaluationMeta.slug]: { META: logoEvaluationMeta, run: logoEvaluationRun },
});

// ─── Test agents · flag-gated at REQUEST TIME ─────────────────────────────
// Internal map. Consumers should NOT read this directly; use getAgent()
// or listAgentSlugs() which check the env flag at call time.
const TEST_AGENTS = Object.freeze({
  [chainTestMeta.slug]: {
    envFlag: 'CHAIN_TEST_AGENT',
    META: chainTestMeta,
    run: chainTestRun,
  },
  [fileTestMeta.slug]: {
    envFlag: 'FILE_TEST_AGENT',
    META: fileTestMeta,
    run: fileTestRun,
  },
});

// Resolve an agent by slug. Real agents return immediately from the
// frozen AGENTS map. Test agents check process.env[envFlag] === '1' at
// CALL time (which is request time when invoked from an Edge handler).
// Returns null when the slug is unknown OR when the test-agent flag is
// not set.
export function getAgent(slug) {
  const real = AGENTS[slug];
  if (real) return real;
  const test = TEST_AGENTS[slug];
  if (test && process.env[test.envFlag] === '1') {
    return { META: test.META, run: test.run };
  }
  return null;
}

// List all currently-active agent slugs. Real agents are always
// included. Test agents are included only when their env flag is '1'
// at the moment listAgentSlugs() is called.
export function listAgentSlugs() {
  const slugs = Object.keys(AGENTS);
  for (const [slug, entry] of Object.entries(TEST_AGENTS)) {
    if (process.env[entry.envFlag] === '1') slugs.push(slug);
  }
  return slugs;
}
