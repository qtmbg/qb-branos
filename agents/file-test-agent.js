// agents/file-test-agent.js
//
// Chapter 3 · Step 3E · synthetic file-test agent.
//
// Loaded into the registry only when process.env.FILE_TEST_AGENT === '1'.
// Strict string equality · mirrors the chain_test_agent precedent from
// chapter-2 step 8B. Truthy checks fail open · strict equality fails closed.
//
// Skips Claude entirely. Returns a deterministic delivered artifact that
// echoes the received files array, so the repro gate harness can verify
// the upload → sign → dispatch → runtime_args.files → agent.run() seam
// end-to-end without depending on Claude responses.
//
// Triggers: ['manual'] only. The harness dispatches via /api/agents/run
// directly with inter-edge HMAC. NOT lock-fireable, NOT chain-triggered.

export const META = {
  slug: 'file_test_agent',
  phase: '00', // sentinel · same as chain_test_agent
  tier_required: 'free',
  display_name: 'File Test Agent',
  description: 'Synthetic agent for file-upload-pipeline verification. Loaded only when FILE_TEST_AGENT=1.',
  artifact_type: 'file_test_agent',
  version: 1,
  inputs: {
    qbp_fields: [],
    artifact_dependencies: [],
    // The harness sends one file with type='sample'. The contract declares
    // the slot optional so /api/agents/run.js validateInputs passes when
    // the harness intentionally omits files (negative-path test variants).
    // source is contract-required (CANONICAL_FILE_SOURCES); its absence
    // was the latent violation that crashed registry module load in
    // production on 2026-06-10 once #170 made META validation
    // unconditional (revert #171, re-land here).
    files: [{ type: 'sample', source: 'user-upload', optional: true }],
    runtime_args: { qbp_source: 'optional' },
  },
  triggers: ['manual'],
  error_codes: ['config_missing'],
  retry_budget: 0,
};

export async function run({ qbp, dependencies = {}, files = [], runtime_args = {}, anthropicKey }) {
  // Echo the received files into the artifact content so the harness
  // can assert specific file_id / type / mime values landed.
  const filesEcho = (files || []).map(f => ({
    type: f?.type || null,
    file_id: f?.file_id || null,
    path: f?.path || null,
    mime: f?.mime || null,
    signed_url_present: typeof f?.signed_url === 'string' && f.signed_url.length > 0,
  }));

  const content = {
    schema_version: '1.0',
    header: {
      eyebrow: 'test',
      title: 'File Test Agent',
      agent: 'file_test_agent',
      generated_at: new Date().toISOString(),
      version: META.version,
    },
    body_sections: [{
      heading: 'Files received',
      prose: `Synthetic file_test_agent dispatched with ${filesEcho.length} file(s). Step 3E verification artifact.\n\n<!-- file-test-json: ${JSON.stringify({ files: filesEcho, runtime_args_received: runtime_args || {} })} -->`,
    }],
    data_blocks: [],
    footer: { qbp_fields_referenced: [] },
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
