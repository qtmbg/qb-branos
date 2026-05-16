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
function aggregateHealth({ retryState, latencyState, runs7d, latestStatus, hasInflight }) {
  if (runs7d === 0 && !hasInflight) return 'neutral';
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

async function readLatestArtifacts({ env, userId, slugs }) {
  // For each slug, the latest delivered artifact (id, version, status).
  // Single query with artifact_type IN (...) plus DISTINCT ON would be
  // ideal but PostgREST doesn't expose DISTINCT ON cleanly; one query
  // per slug is fine at our scale (4 agents).
  const out = {};
  await Promise.all(slugs.map(async slug => {
    const r = await fetch(
      `${env.SUPABASE_URL}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&artifact_type=eq.${encodeURIComponent(slug)}` +
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
    readLatestArtifacts({ env, userId, slugs: listAgentSlugs() }),
    readActiveDispatches({ env, userId }),
  ]);

  const dispatchById = Object.fromEntries(activeDispatches.map(d => [d.id, d]));
  const dispatchByArtifact = new Map();
  // Build artifact → dispatch for the failed_permanently CTA · separate
  // read because dispatch_jobs doesn't directly join to artifacts in the
  // RLS scope.
  if (activeDispatches.length > 0) {
    const r = await fetch(
      `${env.SUPABASE_URL}/rest/v1/artifacts` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&dispatch_id=in.(${activeDispatches.map(d => d.id).join(',')})` +
      `&select=id,dispatch_id`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
    );
    if (r.ok) {
      for (const row of (await r.json().catch(() => []))) {
        dispatchByArtifact.set(row.id, row.dispatch_id);
      }
    }
  }

  // ─── Per-agent rollup ──────────────────────────────────────────────────
  const agentsPayload = listAgentSlugs().map(slug => {
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
    const inflightDispatch = activeDispatches.find(d =>
      d.status === 'producing' && Array.from(dispatchByArtifact.entries())
        .some(([artId, dispId]) => dispId === d.id && latestArtifact?.id === artId)
    );
    const permanentlyFailed = activeDispatches.find(d =>
      d.status === 'failed_permanently' && Array.from(dispatchByArtifact.entries())
        .some(([artId, dispId]) => dispId === d.id && latestArtifact?.id === artId)
    );

    // Threshold states computed server-side · client paints these verbatim.
    const retry_state   = thresholdState(retryAvg,   RETRY_THRESHOLD_GOLD,       RETRY_THRESHOLD_ROSE);
    const latency_state = thresholdState(latencyAvg, LATENCY_THRESHOLD_GOLD_MS,  LATENCY_THRESHOLD_ROSE_MS);

    const dot = aggregateHealth({
      retryState: retry_state, latencyState: latency_state, runs7d,
      latestStatus: permanentlyFailed ? 'failed_permanently'
        : (latestArtifact?.status === 'failed' ? 'failed' : (latestRun?.status || null)),
      hasInflight: Boolean(inflightDispatch),
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
