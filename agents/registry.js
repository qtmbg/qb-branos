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
import { META as voiceGuideMeta, run as voiceGuideRun } from './voice-guide.js';
import { META as newsletterArchMeta, run as newsletterArchRun } from './newsletter-architecture.js';
import { META as linkedinStrategyMeta, run as linkedinStrategyRun } from './linkedin-strategy.js';
import { META as instagramSeedMeta, run as instagramSeedRun } from './instagram-seed.js';
import { META as youtubeStrategyMeta, run as youtubeStrategyRun } from './youtube-strategy.js';
import { META as contentBridgeMeta, run as contentBridgeRun } from './content-bridge.js';
import { META as contentRepurposingMeta, run as contentRepurposingRun } from './content-repurposing.js';
import { META as contentSchedulerMeta, run as contentSchedulerRun } from './content-scheduler.js';
import { META as brandPerformanceMeta, run as brandPerformanceRun } from './brand-performance.js';
import { META as quarterlyReviewMeta, run as quarterlyReviewRun } from './quarterly-review.js';
import { META as predictivePanelMeta, run as predictivePanelRun } from './predictive-panel.js';
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
assertAgentMetaOrThrow(voiceGuideMeta, 'agents/voice-guide.js');
assertAgentMetaOrThrow(newsletterArchMeta, 'agents/newsletter-architecture.js');
assertAgentMetaOrThrow(linkedinStrategyMeta, 'agents/linkedin-strategy.js');
assertAgentMetaOrThrow(instagramSeedMeta, 'agents/instagram-seed.js');
assertAgentMetaOrThrow(youtubeStrategyMeta, 'agents/youtube-strategy.js');
assertAgentMetaOrThrow(contentBridgeMeta, 'agents/content-bridge.js');
assertAgentMetaOrThrow(contentRepurposingMeta, 'agents/content-repurposing.js');
assertAgentMetaOrThrow(contentSchedulerMeta, 'agents/content-scheduler.js');
assertAgentMetaOrThrow(brandPerformanceMeta, 'agents/brand-performance.js');
assertAgentMetaOrThrow(quarterlyReviewMeta, 'agents/quarterly-review.js');
assertAgentMetaOrThrow(predictivePanelMeta, 'agents/predictive-panel.js');
assertAgentMetaOrThrow(chainTestMeta, 'agents/chain-test-agent.js');
assertAgentMetaOrThrow(fileTestMeta, 'agents/file-test-agent.js');

// Per §5.2.1: latency-budget pre-check at registry load. Warnings collect
// here so the runtime can route them through §5.8.2 operator-notify on
// first dispatch (the operator-notify module needs Resend at runtime, not
// at module-load).
export const LATENCY_BUDGET_WARNINGS = [];
for (const meta of [soulMapMeta, sensescapeMeta, visualDnaMeta, warTableMeta, logoDirectionMeta, logoEvaluationMeta, voiceGuideMeta, newsletterArchMeta, linkedinStrategyMeta, instagramSeedMeta, youtubeStrategyMeta, contentBridgeMeta, contentRepurposingMeta, contentSchedulerMeta, brandPerformanceMeta, quarterlyReviewMeta, predictivePanelMeta]) {
  const check = checkLatencyBudget(meta);
  if (!check.withinBudget) {
    LATENCY_BUDGET_WARNINGS.push(check);
    console.warn(`[agents/registry] latency-budget warning: ${check.message}`);
  }
}

console.log('agent registry loaded · 17 prod agents + 2 test agents (flag-gated at request time)');

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
  // Chapter 4 step 3 · Voice Guide. Merges behind PROMPT_HOLD_SLUGS
  // (standing policy); Console-invisible until the prompt is signed.
  [voiceGuideMeta.slug]: { META: voiceGuideMeta, run: voiceGuideRun },
  // Chapter 5 step 1 · the first Phase 03 agent. Registered for dispatch
  // and harness verification; Console-invisible until the operator signs
  // the prompt (PROMPT_HOLD_SLUGS in api/agents/console.js).
  [newsletterArchMeta.slug]: { META: newsletterArchMeta, run: newsletterArchRun },
  // Chapter 5 steps 2-3 · LinkedIn Strategy + Instagram Seed. Merge behind
  // PROMPT_HOLD_SLUGS (standing policy); Console-invisible until signed.
  [linkedinStrategyMeta.slug]: { META: linkedinStrategyMeta, run: linkedinStrategyRun },
  [instagramSeedMeta.slug]: { META: instagramSeedMeta, run: instagramSeedRun },
  // Chapter 5 steps 4-5 · YouTube Strategy + Content Bridge (the Phase 03
  // fan-in). Merge behind PROMPT_HOLD_SLUGS; Console-invisible until signed.
  [youtubeStrategyMeta.slug]: { META: youtubeStrategyMeta, run: youtubeStrategyRun },
  [contentBridgeMeta.slug]: { META: contentBridgeMeta, run: contentBridgeRun },
  // Chapter 6 steps 1-2 · Content Repurposing + Content Scheduler (Phase 04
  // complete). Merge behind PROMPT_HOLD_SLUGS; Console-invisible until signed.
  [contentRepurposingMeta.slug]: { META: contentRepurposingMeta, run: contentRepurposingRun },
  [contentSchedulerMeta.slug]: { META: contentSchedulerMeta, run: contentSchedulerRun },
  // Chapter 7 steps 1-3 · the Phase 05 intelligence agents (pro tier).
  // Merge behind PROMPT_HOLD_SLUGS; Console-invisible until signed.
  [brandPerformanceMeta.slug]: { META: brandPerformanceMeta, run: brandPerformanceRun },
  [quarterlyReviewMeta.slug]: { META: quarterlyReviewMeta, run: quarterlyReviewRun },
  [predictivePanelMeta.slug]: { META: predictivePanelMeta, run: predictivePanelRun },
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
