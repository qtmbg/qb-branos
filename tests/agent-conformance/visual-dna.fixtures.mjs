// tests/agent-conformance/visual-dna.fixtures.mjs
// Visual DNA Synthesizer · conformance fixtures.

export const HAPPY_PATH_QBP = {
  brandName: 'Quantum Trial',
  visualDnaKeepCount: 12,
  visualDnaDiscardRate: 0.6,
  visualDnaKeptImages: ['img_a01', 'img_b04', 'img_c12', 'img_d07'],
  visualDnaFastDiscards: ['img_z03', 'img_y08'],
  colorTerritory: 'Bone, brass, ink with one warm metal accent.',
  forbiddenColor: 'Pure tech-bro chrome blue, candy red.',
  visualTerritoryNote: 'Editorial magazine spread, not startup deck.',
  typographyNote: 'Old-style serif for headlines, neutral grotesk for body.',
  antiVoice: 'No exclamation marks, no urgency.',
  archetypePrimary: 'The Sage',
  archetypeSecondary: 'The Creator',
  archetypeVisualImplications: 'Editorial restraint. Warm neutrals. Calm typography.',
  archetypeVisualImplicationsFull: 'Sage archetype visual register: muted, considered, never decorative for its own sake. Creator secondary adds tactile material warmth without losing rigor.',
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
