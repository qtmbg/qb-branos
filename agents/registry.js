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

import { assertAgentMetaOrThrow } from './contract.js';
import { META as soulMapMeta,    run as soulMapRun }    from './soul-map.js';
import { META as sensescapeMeta, run as sensescapeRun } from './sensescape.js';
import { META as visualDnaMeta,  run as visualDnaRun }  from './visual-dna.js';
import { META as warTableMeta,   run as warTableRun }   from './war-table.js';

assertAgentMetaOrThrow(soulMapMeta,    'agents/soul-map.js');
assertAgentMetaOrThrow(sensescapeMeta, 'agents/sensescape.js');
assertAgentMetaOrThrow(visualDnaMeta,  'agents/visual-dna.js');
assertAgentMetaOrThrow(warTableMeta,   'agents/war-table.js');

export const AGENTS = Object.freeze({
  [soulMapMeta.slug]:    { META: soulMapMeta,    run: soulMapRun },
  [sensescapeMeta.slug]: { META: sensescapeMeta, run: sensescapeRun },
  [visualDnaMeta.slug]:  { META: visualDnaMeta,  run: visualDnaRun },
  [warTableMeta.slug]:   { META: warTableMeta,   run: warTableRun },
});

export function getAgent(slug) {
  return AGENTS[slug] || null;
}

export function listAgentSlugs() {
  return Object.keys(AGENTS);
}
