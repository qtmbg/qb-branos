// tests/agent-conformance/open-questions-agent.fixtures.mjs
// Open Questions Agent · conformance fixtures. Recut Phase 3.
//
// Same error contract as the other text-only agents: config_missing is
// the only code triggerable offline; edge_timeout and model_call_failed
// need a controlled upstream and are reported as "needs live trigger."

export const HAPPY_PATH_QBP = {
  brandName: 'Quantum Trial',
  brandEssence: 'Calm clarity for founders making their first brand decisions.',
  archetypePrimary: 'The Guide',
  archetypeSecondary: 'The Creator',
  manifesto: 'We build tools that make brand thinking feel like reading a good book.',
  antiBrand: 'Not a hustle dashboard. Not a 10x gimmick. Not chrome and gradients.',
  antiVoice: 'Breathless, exclamatory, hype-shaped.',
  paradox: 'Rigorous about strategy and gentle about voice.',
  alwaysNever: {
    always: ['Speak in plain English', 'Show the work'],
    never: ['Use marketing jargon', 'Manufacture urgency'],
  },
  audienceLanguage: ['stuck', 'it all sounds the same', 'I know what I mean but cannot say it'],
  audienceFears: ['Looking amateur next to funded competitors'],
  // competitorSet and visualDirection deliberately absent: the agent
  // treats a silence as evidence, so at least one must be missing for
  // the happy path to exercise that branch.
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
  { code: 'edge_timeout',      description: 'requires a controlled upstream delay' },
  { code: 'model_call_failed', description: 'requires a controlled upstream failure or malformed text' },
];
