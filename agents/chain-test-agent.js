// agents/chain-test-agent.js
//
// Chapter 2 · Step 8B · synthetic chain-test agent.
//
// Loaded into the registry only when process.env.CHAIN_TEST_AGENT === '1'.
// Strict string equality per chapter-02/step-8-spec.md §2.2 condition A.
// Truthy checks fail open · strict equality fails closed.
//
// Skips Claude entirely. Returns a deterministic delivered artifact whose
// data_blocks embed the dep names + delivery timestamps so chain traces
// are self-describing in verification logs without cross-table joins.
//
// Per §2.1 spec refinement.
//
// Triggers: ['chain'] only. The synthetic agent is NOT lock-fireable;
// `/api/agents/run` only runs it when a chain-trigger inserts the
// dispatch row with kind='chain' + agent_slug='chain_test_agent'.

export const META = {
  slug: 'chain_test_agent',
  phase: '00', // sentinel · canonical CANONICAL_PHASES allows '00'-'05'
  tier_required: 'starter',
  display_name: 'Chain Test Agent',
  description: 'Synthetic agent for chain-orchestration verification. Loaded only when CHAIN_TEST_AGENT=1.',
  artifact_type: 'chain_test_agent',
  version: 1,
  inputs: {
    qbp_fields: [],
    artifact_dependencies: ['soul_map_synthesizer', 'sensescape_synthesizer'],
    files: [],
    runtime_args: { qbp_source: 'optional' },
  },
  triggers: ['chain'],
  error_codes: [
    'config_missing',
  ],
  retry_budget: 0,
};

/**
 * Synthetic run · no Claude call. Reads the latest delivered artifact
 * for each dep slug via the supabase service-role REST surface to embed
 * dep timestamps in the output JSON.
 *
 * Note: this agent runs in the /api/agents/run Edge handler context, so
 * fetch + SUPABASE_URL/SERVICE_KEY are available via globalThis or env.
 * The runtime passes neither the URL nor the key as run() args (per the
 * production-agent contract), so the synthetic agent reads them from
 * process.env directly. Fine because this module loads only under the
 * test feature flag.
 */
export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  const supaUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // The runtime supplies `dependencies` as a map { [slug]: { delivered, id, version, ... } }
  // already populated from the /api/agents/run dependency-resolution step.
  // We re-shape into the spec §2.1 dep-trace format.
  const depTraces = META.inputs.artifact_dependencies.map(slug => {
    const dep = dependencies?.[slug] || null;
    return {
      agent_slug: slug,
      artifact_id: dep?.id || null,
      delivered_at: dep?.updated_at || dep?.completed_at || null,
    };
  });

  const content = {
    schema_version: '1.0',
    header: {
      eyebrow: 'test',
      title: 'Chain Test Agent',
      agent: 'chain_test_agent',
      generated_at: new Date().toISOString(),
      version: META.version,
    },
    body_sections: [],
    data_blocks: [{
      kind: 'chain_trace',
      dependencies_satisfied: depTraces,
      runtime_args_received: runtime_args || {},
    }],
    footer: {},
  };

  return {
    ok: true,
    content,
    missing: [],
    meta: {
      tokens_in: 0,
      tokens_out: 0,
      duration_ms: 0,
      synthetic: true,
    },
  };
}
