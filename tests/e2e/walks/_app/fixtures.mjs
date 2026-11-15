/* BrandOS · end-to-end walks, fixtures for the account pages
 *
 * Shared by login, auth-callback, foundation, archive, artifact, account,
 * qbp, paywall and agents-console. Lives in a folder so the runner, which
 * loads every .mjs directly under walks/, does not take it for a walk.
 *
 * Everything here is made up: the founder, the brand, the answers, the
 * artifacts, the runs. A walk hands each piece to w.note() through the
 * helpers below, so the French run tells data from untranslated copy.
 */

/* ── The made-up founder and brand ─────────────────────────────────── */
export const USER = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'ada@maison-orage.example',
  firstName: 'Ada',
};
export const BRAND = 'Maison Orage';

const b64url = s => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
// Shaped like a JWT, because the notification bell and the realtime
// manager read the user id from the token's middle part and stay off
// without one. It signs nothing and no server ever sees it.
export const TOKEN = 'walk.' + b64url(JSON.stringify({ sub: USER.id })) + '.walk';

const NOW = Date.now();
export const ago = ms => new Date(NOW - ms).toISOString();
export const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
export const uid = n => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* ── Session and plan ──────────────────────────────────────────────── */
// The runner signs every walk in on the dormant 'agency' tier. An account
// page reads its tier from /api/qbp, so that does not matter there, but
// the access gate in qb-cloud.js reads localStorage. A walk says which
// account it is: free (no tier at all), or a named tier.
export async function signIn(w, { tier = null, anonymous = false } = {}) {
  w.note(USER.email);
  w.note(USER.firstName);
  await w.page.addInitScript(([user, token, t, anon]) => {
    try {
      localStorage.removeItem('qb_user_tier');
      localStorage.removeItem('qb_sub_status');
      if (anon) { localStorage.removeItem('qb_session'); return; }
      localStorage.setItem('qb_session', JSON.stringify({
        token, refreshToken: 'walk', userId: user.id, email: user.email, firstName: user.firstName,
      }));
      if (t) { localStorage.setItem('qb_user_tier', t); localStorage.setItem('qb_sub_status', 'active'); }
    } catch (e) {}
  }, [USER, TOKEN, tier, anonymous]);
}

/* ── Mocking ───────────────────────────────────────────────────────── */
export const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// A mocked answer that a walk can change between steps:
//   const qbp = await answer(w, /\/api\/qbp(\?|$)/, profile({ tier: 'free' }));
//   qbp.set(profile({ tier: 'starter' }));
// The body may be a function of the route. { __status: 500, ... } sets the status.
export async function answer(w, pattern, first) {
  const box = { body: first, calls: [] };
  await w.mock(pattern, async route => {
    box.calls.push({ url: route.request().url(), method: route.request().method(), body: route.request().postData() });
    const raw = typeof box.body === 'function' ? await box.body(route) : box.body;
    const { __status = 200, ...rest } = raw || {};
    return json(route, Array.isArray(raw) ? raw : rest, __status);
  });
  return { set(b) { box.body = b; }, calls: box.calls };
}

// qb-cloud.js confirms the plan against the profile row before it sends
// anyone to a plan page. With no row it stays put, so a free account needs
// a free row.
export function supabaseProfile(w, { tier = 'free', qbp = {} } = {}) {
  return w.mock(/supabase\.co\/rest\/v1\/profiles/, route => json(route, [{
    qbp, first_name: USER.firstName, tier,
    subscription_status: tier === 'free' ? 'inactive' : 'active',
    tool_completions: {},
  }]));
}

// The upload card and the realtime manager import supabase-js from a CDN.
// This stands in for it: a channel that subscribes at once, a storage
// bucket holding the files a walk names, and a query that finds one
// delivered Visual DNA artifact.
export function supabaseClientStub(w, files = []) {
  files.forEach(f => { w.note(f.name); w.note(f.metadata?.original_filename || ''); });
  const body = `
    const FILES = ${JSON.stringify(files)};
    export function createClient() {
      const chain = () => { const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: [{ id: '${uid(3)}', version: 1 }], error: null }) }; return q; };
      return {
        realtime: { setAuth() {} },
        channel() { const c = { on() { return c; }, subscribe(cb) { setTimeout(() => cb('SUBSCRIBED'), 0); return c; } }; return c; },
        removeChannel() {},
        from: chain,
        storage: { from: () => ({
          list: async () => ({ data: FILES, error: null }),
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null }),
        }) },
      };
    }`;
  return w.mock(/cdn\.jsdelivr\.net\/npm\/@supabase/, route => route.fulfill({
    status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body,
  }));
}

/* ── Going somewhere other than the walk's own page ────────────────── */
// w.open() only knows the walk's page. This goes anywhere on the same
// server, in the walk's language, and gives up quickly: a page that does
// not answer fails the step in seconds.
export async function go(w, pathAndQuery) {
  const origin = new URL(w.page.url()).origin;
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const [path, hash = ''] = pathAndQuery.split('#');
  await w.page.goto(`${origin}${path}${sep}lang=${w.lang}${hash ? '#' + hash : ''}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await w.page.waitForFunction(() => !!window.QBI18N, null, { timeout: 8000 });
  await w.page.waitForTimeout(700);
}
// Wait until the browser is on a given path (with or without .html).
export function landedOn(w, pathname, timeout = 8000) {
  return w.page.waitForURL(u => u.pathname.replace(/\.html$/, '') === pathname, { timeout });
}

/* ── Telling data from copy ────────────────────────────────────────── */
// Every string in a mocked answer is data, not copy.
export function noteAll(w, value) {
  if (typeof value === 'string') w.note(value);
  else if (Array.isArray(value)) value.forEach(v => noteAll(w, v));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => noteAll(w, v));
}

// A date is painted by the browser from a made-up timestamp, in the three
// shapes the app uses. The page formats them, so what is noted is exactly
// what is painted in this language.
export async function noteDates(w, isos) {
  const painted = await w.page.evaluate(list => list.flatMap(iso => {
    const d = new Date(iso);
    return [
      d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
      d.toLocaleDateString(),
    ];
  }), isos);
  painted.forEach(p => w.note(p));
}

// The whole page, as painted. A check reads all of it: nothing is cut.
export const pageText = w => w.page.evaluate(() => document.body.innerText);

// The retired vocabulary. A page of the app paints none of it, in either
// language: no phase number, no build chapter, no plan that is not sold.
const RETIRED = [
  /\bPhase 0\d\b/i, /\bChapter \d/i, /\bchapitre \d/i,
  /Brand Creation/, /Création de marque/, /\b0[1-5] (Discovery|Découverte|Content|Execution|Intelligence)\b/,
  /Coming soon/i, /\bBientôt\b/,
  /Pro is live/i, /Agency is live/i, /white-label/i, /marque blanche/i, /Multi-brand workspaces/i, /Requires Pro/i,
];
export async function noRetiredWords(w, where) {
  const text = await pageText(w);
  for (const re of RETIRED) {
    const m = re.exec(text);
    w.check(!m, `${where}: the page paints ${JSON.stringify(m && m[0])}, which is retired vocabulary`);
  }
}

// The seven operator-only agents. Named here so a walk can prove that no
// public page paints them. Nothing public may.
export const OPERATOR_ONLY_NAMES = [
  'Instagram Seed', 'LinkedIn Strategy', 'YouTube Strategy', 'Newsletter Architecture',
  'Content Bridge', 'Content Repurposing Engine', 'Content Scheduler',
];

/* ── Profiles (what /api/qbp answers) ──────────────────────────────── */
export const QBP = {
  empty: {},
  // One of the three free exercises done.
  started: { brandName: BRAND, archetypePrimary: 'The Sage', archetypeCompassComplete: true, brandEssence: 'Calm under pressure.' },
  // All three done: ready to lock.
  ready: {
    brandName: BRAND, archetypePrimary: 'The Sage', archetypeCompassComplete: true,
    brandEssence: 'Calm under pressure.', manifesto: 'We make less, and we make it hold.',
    sensescapeCompletedAt: ago(2 * DAY),
  },
  // Every exercise done, on Starter.
  full: {
    brandName: BRAND,
    archetypePrimary: 'The Sage', archetypeSecondary: 'The Creator', archetypeTension: 'The Rebel',
    archetypeHeadline: 'A quiet authority that refuses to shout.', archetypeEpigraph: 'Less, and it holds.',
    archetypeCompassComplete: true,
    brandEssence: 'Calm under pressure.', manifesto: 'We make less, and we make it hold.',
    paradox: 'Slow hands, sharp edges.', antiBrand: 'Noise sold as energy.',
    always: ['Say the true thing first'], never: ['Raise the voice to be heard'],
    colorTerritory: 'Storm blue over warm stone.', forbiddenColor: 'Anything fluorescent.',
    visualTerritoryNote: 'Matte surfaces, long shadows.', typographyNote: 'A serif with weight.',
    soundSignature: 'Rain on a tin roof.', antiVoice: 'Slogans in capitals.',
    brandObject: 'A linen-bound notebook.', brandMoment: 'The hour before opening.', signatureGesture: 'Folding the page.',
    sensescapeCompletedAt: ago(9 * DAY),
    visualDnaKeepCount: 42, visualDnaDiscardRate: 79, visualDnaKeptImages: ['a', 'b', 'c'], visualDnaFastDiscards: ['d'],
    visualDnaCompletedAt: ago(6 * DAY),
    warTablePosture: 'Hold the ground we already own.',
    warTableBrief: { challenge: 'Too many lines.', goal: 'One line that pays.', constraint: 'Two people.' },
    warTableTopInitiatives: ['Retire the second range'], warTablePrinciples: ['One decision a week'],
    audienceFears: 'Being sold a trend.', audienceDesires: 'A thing that lasts.',
    audienceLanguage: 'Plain and dry.', audienceFriction: 'Price without proof.',
    warTableCompletedAt: ago(5 * DAY),
  },
};

export function profile({ tier = 'free', qbp = QBP.empty, lockedAt = null } = {}) {
  return {
    qbp, tier,
    tier_started_at: tier === 'free' ? null : ago(41 * DAY),
    foundation_locked_at: lockedAt,
    last_updated: ago(3 * HOUR),
  };
}

/* ── Artifacts ─────────────────────────────────────────────────────── */
export const READINGS = [
  { slug: 'soul_map_synthesizer',   title: `The Soul of ${BRAND}` },
  { slug: 'sensescape_synthesizer', title: `The Sensory World of ${BRAND}` },
  { slug: 'visual_dna_synthesizer', title: `The Visual Language of ${BRAND}` },
  { slug: 'war_table_synthesizer',  title: `The Strategic Position of ${BRAND}` },
];

// What /api/artifacts?limit=200 answers. `statuses` is one status per
// reading; `locked` says which of them the plan cannot read.
export function artifactList(statuses, locked = []) {
  return { artifacts: READINGS.map((r, i) => ({
    id: uid(i + 1), agent_slug: r.slug, phase: '01',
    title: statuses[i] === 'delivered' ? r.title : 'Artifact',
    status: statuses[i], version: 1, created_at: ago(3 * HOUR), locked: locked.includes(i),
  })) };
}

// What /api/artifacts?mode=chains answers: one lock, four readings, one of
// them locked, one failed, one still generating, each with an earlier
// version, plus one Build artifact and two from before locks were recorded.
export function archiveTree() {
  const status = ['delivered', 'delivered', 'generating', 'failed'];
  return {
    ok: true,
    chains: [
      { lock_at: ago(2 * DAY), agents_count: 4, nodes: READINGS.map((r, i) => ({
        agent_slug: r.slug,
        artifacts: [{
          id: uid(i + 1), title: status[i] === 'delivered' ? r.title : '', status: status[i], version: 2,
          delivered_at: ago(3 * HOUR), locked: i === 1,
          children: [{ id: uid(i + 11), title: '', status: 'delivered', version: 1, delivered_at: ago(26 * HOUR), locked: i === 1 }],
        }],
      })) },
      { lock_at: null, agents_count: 1, nodes: [{ agent_slug: 'open_questions_agent', artifacts: [
        { id: uid(21), title: `What ${BRAND} Has Not Decided`, status: 'queued', version: 1 },
      ] }] },
    ],
    legacy: [
      { id: uid(31), title: `A Mark for ${BRAND}`, artifact_type: 'logo_direction_agent', status: 'delivered', version: 1, created_at: ago(40 * DAY), locked: false },
      { id: uid(32), title: '', artifact_type: 'voice_guide_agent', status: 'failed', version: 1, created_at: ago(40 * DAY), locked: false },
    ],
  };
}

// A delivered artifact, every block the reading surface knows. `eyebrow`
// is what the agent stored: pass an old one to stand in for an artifact
// written before the movements replaced the phases.
export function artifactContent({ eyebrow = 'Collapse · War Table', agent = 'war_table_synthesizer', title = `The Strategic Position of ${BRAND}` } = {}) {
  return {
    schema_version: '1.0',
    header: { eyebrow, title, agent, generated_at: ago(4 * DAY), version: 2 },
    body_sections: [
      { heading: 'Opening', prose: 'Maison Orage holds a narrow ground and holds it well.\n\nThe work ahead is to stop apologising for the width.' },
      { heading: 'The field', prose: 'Two neighbours shout. One whispers. Nobody else is plain.' },
      { heading: 'Decisions ahead', prose: 'Whether the second range earns its shelf.' },
    ],
    data_blocks: [
      { type: 'positioning_map', title: 'The field', content: {
        x_axis: { low: 'Loud', high: 'Quiet' }, y_axis: { low: 'Trend', high: 'Lasting' },
        placements: [{ label: BRAND, x: 0.8, y: 0.85, is_self: true }, { label: 'Atelier Nord', x: 0.3, y: 0.4, is_self: false }],
      } },
      { type: 'always_never', title: 'Always / Never', content: { always: ['Say the true thing first'], never: ['Raise the voice to be heard'] } },
      { type: 'priority_list', title: 'Strategic priorities', content: { items: [
        { rank: 1, label: 'Retire the second range', rationale: 'It costs attention the first one needs.' },
      ] } },
      { type: 'descriptor_list', title: 'Sensory descriptors', content: { groups: [
        { label: 'Sight', items: ['storm blue', 'warm stone'] }, { label: 'Sound', items: ['rain on tin'] },
      ] } },
      { type: 'palette', title: 'Color system', content: { swatches: [{ label: 'Storm', hex: '#22384A', rationale: 'The ground colour.' }] } },
      { type: 'type_pairing', title: 'Type direction', content: {
        display: { family: 'Fraunces', weight: '600', rationale: 'Weight without noise.' },
        body: { family: 'Inter', weight: '400', rationale: 'Plain and dry.' },
      } },
    ],
    footer: { qbp_fields_referenced: ['brandName', 'warTablePosture', 'audienceFears'] },
  };
}

/* ── Agent Console (what /api/agents/console answers) ──────────────── */
const AGENTS = [
  // slug, display name, description, phase, tier, model
  ['soul_map_synthesizer', 'Soul Map Synthesizer', 'Distills your brand essence into a readable Soul Map.', '01', 'free'],
  ['sensescape_synthesizer', 'Sensescape Synthesizer', 'Translates raw sensory answers into a five-sense reading of the brand.', '01', 'starter'],
  ['visual_dna_synthesizer', 'Visual DNA Synthesizer', 'Recommends a four-swatch palette and a display+body type pairing grounded in your archetype.', '01', 'starter'],
  ['war_table_synthesizer', 'War Table Synthesizer', 'Reads the strategic position: positioning map, binding commitments, three priorities.', '01', 'starter'],
  ['logo_direction_agent', 'Logo Direction Agent', 'Distills your foundation into three named logo directions with the qualities, anti-patterns, and designer brief for each.', '02', 'starter'],
  ['logo_evaluation_agent', 'Logo Evaluation Agent', 'Reads your uploaded logo against your foundation and returns ranked, actionable verdicts: what the mark gets right, where it works against you, and what to change first.', '02', 'starter'],
  ['voice_guide_agent', 'Voice Guide Agent', 'Turns your foundation into a working voice guide: the register, the lexicon, the sentence mechanics, and the hard walls, concrete enough that anyone could write as your brand.', '02', 'starter'],
  ['brand_performance_agent', 'Brand Performance Dashboard', 'Your performance data read through the brand lens: five health scores, named signals with evidence and one action each, and the next 30 days decided.', '05', 'pro'],
  ['quarterly_review_agent', 'Quarterly Brand Review', 'The quarter graded honestly, the learnings extracted, the profile recalibrations proposed, and the next 90 days decided. The brand gets smarter each quarter.', '05', 'pro'],
  ['predictive_panel_agent', 'Predictive Panel', 'Your launch, simulated before you spend a dollar: a verdict with probabilities, the scenarios, the failure points, and the readiness checklist.', '05', 'pro'],
];
// One state per agent, in the order above: delivered and healthy, delivered
// and slow, failed on a missing answer, failed on a first run, then Build
// with nothing run yet, one producing, one never run, then Hold.
const STATES = [
  { latest_artifact: { id: uid(1), status: 'delivered' }, latest_run: { id: 'run-1', status: 'succeeded', completed_at: ago(2 * MIN) },
    health: { dot: 'green', retry_state: 'monochrome', latency_state: 'monochrome' }, rolling: { runs_7d: 3, schema_retry_avg_7d: 0, duration_avg_7d_ms: 850 } },
  { latest_artifact: { id: uid(2), status: 'delivered' }, latest_run: { id: 'run-2', status: 'succeeded', completed_at: ago(3 * HOUR) },
    health: { dot: 'yellow', retry_state: 'gold', latency_state: 'gold' }, rolling: { runs_7d: 2, schema_retry_avg_7d: 0.3, duration_avg_7d_ms: 21000 } },
  { latest_artifact: { id: uid(3), status: 'failed' }, latest_run: { id: 'run-3', status: 'failed', completed_at: ago(2 * DAY), error_payload: { code: 'qbp_field_missing', missing_fields: [] } },
    health: { dot: 'red', retry_state: 'rose', latency_state: 'rose' }, rolling: { runs_7d: 1, schema_retry_avg_7d: 0.9, duration_avg_7d_ms: 24000 } },
  { latest_artifact: null, latest_run: { id: 'run-4', status: 'failed', completed_at: ago(5 * MIN), error_payload: { code: 'missing_dependency', missing_slug: 'soul_map_synthesizer' } }, health: { dot: 'neutral' }, rolling: {} },
  { latest_artifact: null, latest_run: null, health: { dot: 'neutral' }, rolling: {} },
  { latest_artifact: null, latest_run: null, health: { dot: 'neutral' }, rolling: {} },
  { latest_artifact: null, latest_run: { id: 'run-7', status: 'started', started_at: ago(40e3) }, inflight_dispatch_id: 'dispatch-7', health: { dot: 'neutral' }, rolling: {} },
  { latest_artifact: null, latest_run: null, health: { dot: 'neutral' }, rolling: {} },
  { latest_artifact: null, latest_run: null, health: { dot: 'neutral' }, rolling: {} },
  { latest_artifact: null, latest_run: null, health: { dot: 'neutral' }, rolling: {} },
];
export function consolePayload({ tier = 'free', locked = true } = {}) {
  return {
    ok: true,
    user: { id: USER.id, tier, first_name: USER.firstName, foundation_locked_at: locked ? ago(2 * DAY) : null },
    thresholds: { retry_gold: 0.1, retry_rose: 0.5, latency_gold_ms: 20000, latency_rose_ms: 23000 },
    agents: AGENTS.map((a, i) => ({
      slug: a[0], display_name: a[1], description: a[2], phase: a[3], tier_required: a[4],
      model: 'gemini-3.5-flash', retry_budget: 0, inflight_dispatch_id: null, permanently_failed_dispatch_id: null,
      ...STATES[i],
    })),
    // What the API sends a public account today: the seven operator-only
    // agents, under their phase labels. The Console must paint none of it.
    locked_phase_cards: [
      { phase: '03', label: 'Content Creation', agents: OPERATOR_ONLY_NAMES.slice(0, 5).map((n, i) => ({ slug: 'content_' + i, display_name: n })) },
      { phase: '04', label: 'Execution', agents: OPERATOR_ONLY_NAMES.slice(5).map((n, i) => ({ slug: 'execution_' + i, display_name: n })) },
    ],
    recent_runs: [
      { id: 'run-1', agent_slug: 'soul_map_synthesizer', status: 'succeeded', completed_at: ago(2 * MIN), duration_ms: 850, schema_retry_count: 0 },
      { id: 'run-3', agent_slug: 'visual_dna_synthesizer', status: 'failed', completed_at: ago(2 * DAY), duration_ms: 24000, schema_retry_count: 2, latency_state: 'rose', retry_state: 'gold', error_payload: { code: 'qbp_field_missing', missing_fields: [] } },
      { id: 'run-7', agent_slug: 'voice_guide_agent', status: 'started', started_at: ago(40e3), duration_ms: null },
    ],
  };
}

export const REPLAY = {
  ok: true, agent_slug: 'soul_map_synthesizer', artifact_version: 2, status: 'succeeded',
  started_at: ago(2 * MIN), duration_ms: 850, model: 'gemini-3.5-flash', agent_version: 1, trigger: 'manual',
  tokens_in: 1200, tokens_out: 900, schema_retry_count: 0,
  qbp_snapshot: { brandName: BRAND, brandEssence: 'Calm under pressure.' }, runtime_args: {}, file_refs: [],
};

/* ── Notifications (what /api/notifications answers) ───────────────── */
export const NOTIFICATIONS = {
  unread_count: 2,
  notifications: [
    { id: 'n1', kind: 'artifact_ready', agent_slug: 'soul_map_synthesizer', artifact_id: uid(1), created_at: ago(2 * MIN) },
    { id: 'n2', kind: 'dispatch_failed', agent_slug: 'war_table_synthesizer', created_at: ago(3 * HOUR) },
    { id: 'n3', kind: 'chain_ready', created_at: ago(2 * DAY), read_at: ago(DAY) },
  ],
};

/* ── Files in the upload card ──────────────────────────────────────── */
export const FILES = [
  { name: 'f1.png', created_at: ago(DAY), metadata: { original_filename: 'orage-mark-draft.png', size: 1258291, mimetype: 'image/png' } },
  { name: 'f2.pdf', created_at: ago(2 * DAY), metadata: { original_filename: 'orage-brand-notes.pdf', size: 420000, mimetype: 'application/pdf' } },
];
