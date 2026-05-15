// tests/agent-conformance/sensescape.fixtures.mjs
// Sensescape Synthesizer · conformance fixtures.

// Minimal happy-path fixture · enough to satisfy the contract, light
// enough to clear the 24 s Edge timeout. The richer fixture (all 11
// fields populated) burns ~25 s of output generation and reproducibly
// trips edge_timeout in conformance. Production user QBPs are typically
// sparser than the rich fixture, so this minimal variant is closer to
// the real-world median. See step-3 phase B verification §5 for the
// Sensescape generation-budget finding.
export const HAPPY_PATH_QBP = {
  brandName: 'Quantum Trial',
  colorTerritory: 'Bone, brass, ink.',
  brandObject: 'A leather-bound notebook with a brass clasp.',
};

export const OFFLINE_ERROR_FIXTURES = [
  {
    code: 'config_missing',
    description: 'anthropicKey is empty · agent must refuse without calling Claude',
    runArgs: { qbp: HAPPY_PATH_QBP, dependencies: {}, files: [], runtime_args: {}, anthropicKey: '' },
    expectedStage: 'config',
  },
];

export const LIVE_ERROR_CODES = [
  {
    code: 'edge_timeout',
    description: 'Claude call exceeds CLAUDE_TIMEOUT_MS · requires network induced delay',
  },
  {
    code: 'model_call_failed',
    description: 'Claude returns non-2xx or malformed text · requires Claude mock or live failure',
  },
];
