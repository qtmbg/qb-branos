// agents/registry.js
// Chapter 2 · Step 3
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
// Scope note · Chapter 2 step 3 phase A:
//   Only Soul Map Synthesizer is retrofitted. sensescape_synthesizer,
//   visual_dna_synthesizer, and war_table_synthesizer are deliberately
//   NOT in this registry yet. They are still served via the legacy
//   /api/agents/dispatch.js path until step 3 phase B retrofits them.
//   This keeps Chapter 1 lock-foundation behavior unchanged while the
//   new framework is validated against one agent first.

import { assertAgentMetaOrThrow } from './contract.js';
import { META as soulMapMeta, run as soulMapRun } from './soul-map.js';

assertAgentMetaOrThrow(soulMapMeta, 'agents/soul-map.js');

export const AGENTS = Object.freeze({
  [soulMapMeta.slug]: { META: soulMapMeta, run: soulMapRun },
});

export function getAgent(slug) {
  return AGENTS[slug] || null;
}

export function listAgentSlugs() {
  return Object.keys(AGENTS);
}
