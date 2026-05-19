// agents/registry.js
// Chapter 2 · Step 3 · phase B complete
//
// Single import map for every contract-conformant agent. The runtime
// (/api/agents/run, shipping in step 4) imports AGENTS from this file
// only. Adding a new agent is one file under /agents/ + one line below.
//
// Every entry is validated against the §3.5 contract via the imported
// assertAgentMetaOrThrow at module load. A contract violation throws,
// which prevents the runtime from accepting dispatches for a broken
// agent · this is the §11.12.1 "rejected at registry import time"
// requirement.
//
// Chapter 2 status:
//   All four Phase 01 agents (Soul Map, Sensescape, Visual DNA, War
//   Table) are retrofitted to the §3.5 contract. The legacy
//   api/agents/*-synthesizer.js modules are no longer imported anywhere
//   and become dead code in step 14 deprecation.

import { assertAgentMetaOrThrow, checkLatencyBudget } from './contract.js';
import { META as soulMapMeta,    run as soulMapRun }    from './soul-map.js';
import { META as sensescapeMeta, run as sensescapeRun } from './sensescape.js';
import { META as visualDnaMeta,  run as visualDnaRun }  from './visual-dna.js';
import { META as warTableMeta,   run as warTableRun }   from './war-table.js';

assertAgentMetaOrThrow(soulMapMeta,    'agents/soul-map.js');
assertAgentMetaOrThrow(sensescapeMeta, 'agents/sensescape.js');
assertAgentMetaOrThrow(visualDnaMeta,  'agents/visual-dna.js');
assertAgentMetaOrThrow(warTableMeta,   'agents/war-table.js');

// Per §5.2.1: latency-budget pre-check at registry load. Warnings collect
// here so the runtime can route them through §5.8.2 operator-notify on
// first dispatch (the operator-notify module needs Resend at runtime, not
// at module-load).
export const LATENCY_BUDGET_WARNINGS = [];
for (const meta of [soulMapMeta, sensescapeMeta, visualDnaMeta, warTableMeta]) {
  const check = checkLatencyBudget(meta);
  if (!check.withinBudget) {
    LATENCY_BUDGET_WARNINGS.push(check);
    console.warn(`[agents/registry] latency-budget warning: ${check.message}`);
  }
}

// ─── Chain test agent · feature-flagged · step 8B ────────────────────────
// Loaded only when CHAIN_TEST_AGENT === '1' (strict string equality per
// chapter-02/step-8-spec.md §2.2 condition A · truthy checks fail open;
// strict equality fails closed).
//
// Production has no such env var, so the synthetic agent never appears in
// the prod registry. Verification environments set the env var; the
// chain-orchestration harness exercises the chain-trigger path through
// this agent.

const CHAIN_TEST_ENABLED = process.env.CHAIN_TEST_AGENT === '1';
let chainTestEntry = null;
if (CHAIN_TEST_ENABLED) {
  try {
    const chainTest = await import('./chain-test-agent.js');
    assertAgentMetaOrThrow(chainTest.META, 'agents/chain-test-agent.js');
    chainTestEntry = { META: chainTest.META, run: chainTest.run };
  } catch (e) {
    console.error('[agents/registry] chain-test-agent load failed:', e?.message);
  }
}

// Startup log line · names whether the test agent is loaded (per §2.2
// condition B). If the test agent ever appears in prod deploy logs, the
// anomaly surfaces immediately in observability.
if (chainTestEntry) {
  console.log('agent registry loaded · 4 prod agents + 1 test agent (CHAIN_TEST_AGENT=1)');
} else {
  console.log('agent registry loaded · 4 prod agents');
}

export const AGENTS = Object.freeze({
  [soulMapMeta.slug]:    { META: soulMapMeta,    run: soulMapRun },
  [sensescapeMeta.slug]: { META: sensescapeMeta, run: sensescapeRun },
  [visualDnaMeta.slug]:  { META: visualDnaMeta,  run: visualDnaRun },
  [warTableMeta.slug]:   { META: warTableMeta,   run: warTableRun },
  ...(chainTestEntry ? { [chainTestEntry.META.slug]: chainTestEntry } : {}),
});

export function getAgent(slug) {
  return AGENTS[slug] || null;
}

export function listAgentSlugs() {
  return Object.keys(AGENTS);
}
