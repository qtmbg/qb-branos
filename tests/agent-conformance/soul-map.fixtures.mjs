// tests/agent-conformance/soul-map.fixtures.mjs
// Soul Map Synthesizer · conformance fixtures.
//
// One fixture per assertion that needs synthetic input.
//
// happy_path · valid QBP populated for assertion 2 (happy path → valid
// schema-conformant content).
//
// error_codes · one fixture per code in META.error_codes that can be
// triggered offline. Codes that require provoking the upstream Claude
// service (e.g. forcing a 5xx) are NOT in the offline set and are
// surfaced by the conformance runner as "needs live trigger."
//
//   config_missing · trigger by calling run() with anthropicKey=''.
//                    No network. Fully offline.
//
//   edge_timeout · cannot be reliably triggered offline (would need
//                  to mock fetch). Conformance runner marks this as
//                  "needs live trigger" and surfaces in the report.
//
//   model_call_failed · same · requires Claude to return non-2xx or
//                       malformed text. Not in offline set.

export const HAPPY_PATH_QBP = {
  brandName: 'Quantum Trial',
  brandEssence: 'Calm clarity for founders making their first brand decisions.',
  spark: 'A late-night moment realizing the existing tools made me feel small instead of clear.',
  archetype: 'The Guide',
  manifesto: 'We build tools that make brand thinking feel like reading a good book, not filing taxes.',
  antiBrand: 'We are not a hustle dashboard. We are not a "10x your branding" gimmick. We are not chrome and gradients.',
  paradox: 'We are rigorous about strategy and gentle about voice.',
  alwaysNever: {
    always: ['Speak in plain English', 'Show the work', 'Respect the reader'],
    never: ['Use marketing jargon', 'Manufacture urgency', 'Flatter the user'],
  },
};

export const OFFLINE_ERROR_FIXTURES = [
  {
    code: 'config_missing',
    description: 'anthropicKey is empty · agent must refuse without calling Claude',
    runArgs: { qbp: HAPPY_PATH_QBP, dependencies: {}, files: [], runtime_args: {}, anthropicKey: '' },
    expectedStage: 'config',
  },
];

// Codes that the conformance test cannot trigger without a live network
// path or fetch mock. Surfaced in the report as "needs live trigger."
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
