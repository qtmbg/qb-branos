// tests/agent-conformance/war-table.fixtures.mjs
// War Table Synthesizer · conformance fixtures.

export const HAPPY_PATH_QBP = {
  brandName: 'Quantum Trial',
  warTableBrief: 'A calm, editorial alternative to the loud brand-tooling category. Sells through depth, not noise.',
  warTableTopInitiatives: ['Ship Phase 01 free tier with end-to-end synthesis', 'Land 10 paying Starter customers through quiet referral'],
  warTablePosture: 'Quiet, considered, refuses to perform.',
  warTablePrinciples: ['Speak in plain English', 'Show the work', 'Refuse manufactured urgency'],
  warTableNextHandoff: 'Tighten the lock-foundation flow before the paid tier launches.',
  audienceFears: 'Looking generic. Sounding like every other brand tool.',
  audienceDesires: 'A real artifact at the end. Something they can hand to a developer.',
  audienceLanguage: 'Founders who say "this feels off" and trust their gut.',
  audienceFriction: 'They have tried five branding tools and abandoned each.',
  paradox: 'Slow on purpose, fast in result.',
  antiBrand: 'Not a hustle dashboard. Not a 10x-your-branding gimmick.',
  alwaysNever: {
    always: ['Speak in plain English', 'Show the work', 'Respect the reader'],
    never: ['Manufacture urgency', 'Flatter the user', 'Use marketing jargon'],
  },
  manifesto: 'We build tools that make brand thinking feel like reading a good book.',
  archetypePrimary: 'The Sage',
  archetypeSecondary: 'The Creator',
  archetypeMarketLandscape: {
    occupiers: ['Frontify', 'Brandfolder', 'Canva for Brands'],
    summary: 'Crowded with chrome-and-gradient SaaS. Sparse on editorial restraint.',
  },
  archetypeStrategicMoat: 'Voice and editorial layer. Cannot be cloned by a Figma plugin.',
  archetypeCentralParadox: 'Methodology-first in a market that punishes depth.',
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
