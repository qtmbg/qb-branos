// QB BrandOS · GET /api/agents/console
// Returns the Agent Console payload per CHAPTER_02_SPEC §6 + §6.6.1-3:
//   - user: tier, foundation_locked_at
//   - agents[]: registered Phase 01 agents with per-agent state, rolling
//     averages (schema_retry_count + duration_ms over 7 days), aggregate
//     health dot color, latest run, latest delivered artifact
//   - locked_phase_cards[]: static metadata for Phase 02-05 agents that
//     ship in Chapter 4+ · rendered as locked rows with "Unlocks when
//     Starter tier is active" copy
//   - recent_runs[]: last N agent_runs across all the user's agents for
//     the Run history view, with the same rolling averages joined
//
// All data is RLS-safe · the endpoint resolves the JWT, then reads via
// service role since the queries do server-side aggregation that would
// require multiple RLS-scoped reads otherwise.

import { cors, json, resolveUser, svcHeaders, requireEnv } from '../_lib/auth.js';
import { AGENTS, listAgentSlugs } from '../../agents/registry.js';
import { DEFAULT_MODEL } from '../../agents/contract.js';

export const config = { runtime: 'edge' };

// §6.3 · Phase 02-05 locked-card metadata. Shipped in Chapter 4 (Phase 02),
// Chapter 5 (Phase 03), etc. The Console renders these as locked rows.
const LOCKED_PHASE_CARDS = [
  {
    phase: '02', label: 'Brand Creation',
    agents: [
      { slug: 'logo_direction',  display_name: 'Logo Direction' },
      { slug: 'logo_evaluation', display_name: 'Logo Evaluation' },
      { slug: 'voice_guide',     display_name: 'Voice Guide' },
    ],
  },
  {
    phase: '03', label: 'Content Creation',
    agents: [
      { slug: 'content_strategist', display_name: 'Content Strategist' },
      { slug: 'campaign_planner',   display_name: 'Campaign Planner' },
    ],
  },
  {
    phase: '04', label: 'Execution',
    agents: [
      { slug: 'execution_planner', display_name: 'Execution Planner' },
    ],
  },
  {
    phase: '05', label: 'Intelligence',
    agents: [
      { slug: 'predictive_panel',      display_name: 'Predictive Panel' },
      { slug: 'quarterly_review_agent', display_name: 'Quarterly Brand Review' },
    ],
  },
];

// §6.6.1 + §6.6.2 thresholds.
const RETRY_THRESHOLD_GOLD = 0.1;
const RETRY_THRESHOLD_ROSE = 0.5;
const LATENCY_THRESHOLD_GOLD_MS = 20_000;
const LATENCY_THRESHOLD_ROSE_MS = 23_000;

// Single source of truth for threshold-to-state mapping. Used for both
// the aggregate health dot (§6.6.3) AND the per-row badge state on
// recent_runs (§6.6.1, §6.6.2). The client never re-applies thresholds;
// it paints the state string the server decided.
function thresholdState(value, gold, rose) {
  if (value == null || Number.isNaN(value)) return null;
  if (value > rose) return 'rose';
  if (value >= gold) return 'gold';
  return 'monochrome';
}

// §6.6.3 aggregate health · derive from rolling averages + latest run
// status. Uses thresholdState() so the dot's color logic is identical to
// the badge's color logic.
//
// Per PR #78 audit item 2: zero runs in the 7-day window == neutral,
// period. An inflight dispatch on an agent with no completed history
// produces neutral on the dot · the "producing" signal lives on the
// status pill, not the aggregate-health dot. A long-running or stuck
// dispatch that started >7 days ago is also neutral (no completed runs
// in window). hasInflight is no longer consulted by the dot logic.
function aggregateHealth({ retryState, latencyState, runs7d, latestStatus }) {
  if (runs7d === 0) return 'neutral';
  const failedRecent = latestStatus === 'failed' || latestStatus === 'failed_permanently';
  if (failedRecent || retryState === 'rose' || latencyState === 'rose') return 'red';
  if (retryState === 'gold' || latencyState === 'gold') return 'yellow';
  return 'green';
}

async function readUserAgentRuns({ env, userId, sevenDaysAgoIso }) {
  // Pull all the user's agent_runs from the last 7 days · used for both the
  // rolling-average computation and the recent_runs list. Capped at 200
  // rows to bound the response size; the Console's run history pagination
  // is a Chapter 3+ enhancement.
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/agent_runs` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&select=id,artifact_id,agent_slug,agent_version,status,trigger,model,duration_ms,tokens_in,tokens_out,schema_retry_count,started_at,completed_at,error_payload` +
    `&started_at=gte.${encodeURIComponent(sevenDaysAgoIso)}` +
    `&order=started_at.desc&limit=200`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}

async function readLatestDeliveredArtifact({ env, userId, slugs }) {
  // Per step-6 spec §4.3: latest artifact with status='delivered' per
  // slug. queued / producing / failed rows do NOT gate the rerun CTAs
  // against the prior delivered row. The inflight surface continues to
  // ride on dispatch_jobs.status='producing' plus the dispatch→artifact
  // join below (inflight_dispatch_id).
  //
  // PR #79 §3 Case C resolution: a regenerate that lands a queued v2
  // while v1 is still delivered no longer hides v1's CTAs from the
  // Console. The queued v2 shows up as a producing pill via the
  // dispatch surface; v1's two-button rerun row stays clickable.
  //
  // Permanent-failure surface (PR #79 §3.1) reads from
  // permanently_failed_dispatch_id, independent of artifact status, and
  // is unaffected by this query.
  //
  // Returns { [slug]: artifact | null }. Caller shape stays identical
  // to the prior readLatestArtifacts() helper; only the per-slug value
  // is now the latest delivered row instead of the latest row.
  const out = {};
  await Promise.all(slugs.map(async slug => {
    const r = await fetch(
      `${env.SUPABASE_URL}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&artifact_type=eq.${encodeURIComponent(slug)}` +
      `&status=eq.delivered` +
      `&select=id,status,version,updated_at,dispatch_id` +
      `&order=version.desc&limit=1`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      out[slug] = rows?.[0] || null;
    } else {
      out[slug] = null;
    }
  }));
  return out;
}

async function readActiveDispatches({ env, userId }) {
  // dispatch_jobs in the "producing" state for this user · identifies
  // agents currently in flight. failed_permanently is also surfaced
  // so the Console can render the manual-retry CTA.
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/dispatch_jobs` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&status=in.(producing,failed_permanently)` +
    `&select=id,kind,status,created_at,agents_count,agents_settled,trigger,parent_agent_slug,retry_count,last_retry_at` +
    `&order=created_at.desc&limit=50`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!r.ok) return [];
  return await r.json().catch(() => []);
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const corsH = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' }, corsH);

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = requireEnv(env, 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (missing) return json(503, { error: `Not configured: ${missing}` }, corsH);

  const authResult = await resolveUser(req, env);
  if (!authResult.ok) return json(authResult.status, { error: authResult.error }, corsH);
  const userId = authResult.user.id;

  // Profile read · tier + foundation_locked_at for gating decisions.
  const profRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}` +
    `&select=tier,foundation_locked_at,first_name`,
    { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  const profile = profRes.ok ? (await profRes.json().catch(() => []))?.[0] : null;

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [runs, artifacts, activeDispatches] = await Promise.all([
    readUserAgentRuns({ env, userId, sevenDaysAgoIso }),
    readLatestDeliveredArtifact({ env, userId, slugs: listAgentSlugs() }),
    readActiveDispatches({ env, userId }),
  ]);

  // Per-slug join to the active dispatch surfaces (producing +
  // failed_permanently). With the readLatestDeliveredArtifact rename
  // (step-6 spec §4.3), the per-slug `artifacts` map only carries
  // delivered rows; the queued / producing / failed_permanently row that
  // actually carries the inflight dispatch_id no longer appears there.
  // The inflight / permanent-failure surface keys on artifact_type
  // (= agent slug) instead.
  const dispatchById = Object.fromEntries(activeDispatches.map(d => [d.id, d]));
  const inflightDispatchBySlug = new Map();
  const permanentlyFailedDispatchBySlug = new Map();
  if (activeDispatches.length > 0) {
    const r = await fetch(
      `${env.SUPABASE_URL}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&dispatch_id=in.(${activeDispatches.map(d => d.id).join(',')})` +
      `&select=id,dispatch_id,artifact_type`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    if (r.ok) {
      for (const row of (await r.json().catch(() => []))) {
        const dispatch = dispatchById[row.dispatch_id];
        if (!dispatch) continue;
        if (dispatch.status === 'producing') {
          // Latest producing dispatch wins per slug. activeDispatches is
          // ordered created_at.desc so the first hit is the most recent.
          if (!inflightDispatchBySlug.has(row.artifact_type)) {
            inflightDispatchBySlug.set(row.artifact_type, dispatch);
          }
        } else if (dispatch.status === 'failed_permanently') {
          if (!permanentlyFailedDispatchBySlug.has(row.artifact_type)) {
            permanentlyFailedDispatchBySlug.set(row.artifact_type, dispatch);
          }
        }
      }
    }
  }

  // ─── Per-agent rollup ──────────────────────────────────────────────────
  // Filter out framework-internal agents (phase '00' sentinel) so they
  // never appear in the user-facing Phase view. The chain_test_agent
  // (step 8B) lands at phase '00' when CHAIN_TEST_AGENT=1 is set; this
  // filter keeps it invisible to real users even when the env var leaks
  // into prod for verification windows.
  //
  // PROMPT_HOLD_SLUGS · standing policy for every chapter-4 agent.
  // Agents whose prompt awaits operator sign-off: registered and
  // dispatchable for harness verification, invisible here until the
  // prompt is signed. Remove the slug from this set on sign-off; that
  // single deletion is the release. logo_direction_agent released
  // 2026-06-11 (prompt signed).
  const PROMPT_HOLD_SLUGS = new Set(['logo_evaluation_agent']);
  const userVisibleSlugs = listAgentSlugs().filter(slug => {
    const meta = AGENTS[slug]?.META;
    return meta?.phase && meta.phase !== '00' && !PROMPT_HOLD_SLUGS.has(slug);
  });
  const agentsPayload = userVisibleSlugs.map(slug => {
    const agent = AGENTS[slug];
    const meta = agent.META;
    const agentRuns = runs.filter(r => r.agent_slug === slug);
    const successRuns = agentRuns.filter(r => r.status === 'succeeded');

    const runs7d = agentRuns.length;
    const retryAvg = runs7d === 0 ? null
      : agentRuns.reduce((s, r) => s + (r.schema_retry_count ?? 0), 0) / runs7d;
    const latencyAvg = successRuns.length === 0 ? null
      : successRuns.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / successRuns.length;

    const latestRun = agentRuns[0] || null;
    const latestArtifact = artifacts[slug] || null;
    // Inflight + permanent-failure surfaces key on slug (not on
    // latestArtifact.id), so a queued v2 producing dispatch surfaces
    // independently of a delivered v1 row. Step-6 spec §4.3 Case C.
    const inflightDispatch = inflightDispatchBySlug.get(slug) || null;
    const permanentlyFailed = permanentlyFailedDispatchBySlug.get(slug) || null;

    // Threshold states computed server-side · client paints these verbatim.
    const retry_state   = thresholdState(retryAvg,   RETRY_THRESHOLD_GOLD,       RETRY_THRESHOLD_ROSE);
    const latency_state = thresholdState(latencyAvg, LATENCY_THRESHOLD_GOLD_MS,  LATENCY_THRESHOLD_ROSE_MS);

    const dot = aggregateHealth({
      retryState: retry_state, latencyState: latency_state, runs7d,
      latestStatus: permanentlyFailed ? 'failed_permanently'
        : (latestArtifact?.status === 'failed' ? 'failed' : (latestRun?.status || null)),
    });

    return {
      slug,
      display_name: meta.display_name,
      description: meta.description,
      phase: meta.phase,
      tier_required: meta.tier_required,
      model: meta.model || DEFAULT_MODEL,
      retry_budget: Number.isInteger(meta.retry_budget) ? meta.retry_budget : 1,
      latest_artifact: latestArtifact ? {
        id: latestArtifact.id,
        version: latestArtifact.version,
        status: latestArtifact.status,
        updated_at: latestArtifact.updated_at,
      } : null,
      latest_run: latestRun ? {
        id: latestRun.id,
        status: latestRun.status,
        started_at: latestRun.started_at,
        completed_at: latestRun.completed_at,
        duration_ms: latestRun.duration_ms,
        schema_retry_count: latestRun.schema_retry_count,
        error_payload: latestRun.error_payload,
      } : null,
      inflight_dispatch_id: inflightDispatch?.id || null,
      permanently_failed_dispatch_id: permanentlyFailed?.id || null,
      rolling: {
        runs_7d: runs7d,
        schema_retry_avg_7d: retryAvg,
        duration_avg_7d_ms: latencyAvg,
        success_runs_7d: successRuns.length,
      },
      // §6.6.3 · health.dot drives the Phase view colored dot. retry_state
      // and latency_state expose the same threshold decisions the server
      // made on the rolling averages, in case any aggregate-level badge
      // needs them. The Run history per-row badges read recent_runs[]
      // .retry_state / .latency_state below (computed on point-in-time
      // values, not rolling averages).
      health: {
        dot,
        retry_state,
        latency_state,
      },
    };
  });

  // ─── Recent runs (Run history view) ────────────────────────────────────
  // recent_runs per-row state · threshold decision applied to the row's
  // own value, not a rolling average. A single run at duration_ms = 25000
  // surfaces rose on the Run history badge even when the rolling average
  // is steady. Operator sees exactly where individual outliers fall.
  const recentRuns = runs.slice(0, 50).map(r => ({
    id: r.id,
    agent_slug: r.agent_slug,
    agent_version: r.agent_version,
    artifact_id: r.artifact_id,
    status: r.status,
    trigger: r.trigger,
    model: r.model,
    duration_ms: r.duration_ms,
    tokens_in: r.tokens_in,
    tokens_out: r.tokens_out,
    schema_retry_count: r.schema_retry_count,
    started_at: r.started_at,
    completed_at: r.completed_at,
    error_payload: r.error_payload,
    retry_state:   thresholdState(r.schema_retry_count, RETRY_THRESHOLD_GOLD,      RETRY_THRESHOLD_ROSE),
    latency_state: thresholdState(r.duration_ms,        LATENCY_THRESHOLD_GOLD_MS, LATENCY_THRESHOLD_ROSE_MS),
  }));

  return json(200, {
    ok: true,
    user: {
      id: userId,
      tier: profile?.tier || 'free',
      first_name: profile?.first_name || null,
      foundation_locked_at: profile?.foundation_locked_at || null,
    },
    thresholds: {
      retry_gold: RETRY_THRESHOLD_GOLD,
      retry_rose: RETRY_THRESHOLD_ROSE,
      latency_gold_ms: LATENCY_THRESHOLD_GOLD_MS,
      latency_rose_ms: LATENCY_THRESHOLD_ROSE_MS,
    },
    agents: agentsPayload,
    locked_phase_cards: LOCKED_PHASE_CARDS,
    recent_runs: recentRuns,
  }, corsH);
}
