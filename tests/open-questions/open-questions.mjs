#!/usr/bin/env node
// tests/open-questions/open-questions.mjs
// Recut Phase 3 · standing harness for the Open Questions agent.
//
// Run: node tests/open-questions/open-questions.mjs
// With ANTHROPIC_API_KEY set it also runs one live call and validates
// the real artifact. Without it, everything except the live case runs.
//
// Per CLAUDE.md "Audit harnesses": nothing is truncated before
// comparison, no findings array is capped, and the failure direction is
// asserted rather than assumed.

import { META, SYSTEM_PROMPT, assembleArtifact, normalizeOpen, run } from '../../agents/open-questions.js';
import { validateAgentMeta } from '../../agents/contract.js';
import { validateArtifact } from '../../js/qb-artifact-schema.js';
import { canReadArtifact } from '../../api/_lib/tier-gating.js';

const failures = [];
const fail = m => failures.push(m);
const ok = m => console.log(`  ok · ${m}`);
let mark = 0;
const since = () => { mark = failures.length; };
const okIf = m => { if (failures.length === mark) ok(m); };

const PARSED = {
  opening: 'Your foundation is further along than it feels.\n\nTwo of the four sections are decided by your own answers. One is not.',
  what_holds: 'The anti-brand is the strongest thing here.\n\nYou named what you refuse before you named what you are, and that is the harder order.',
  settled: [
    'The archetype is the Guide. Your manifesto, your anti-brand and your audience language all point one way.',
    'The voice refuses hype. You wrote "not a 10x gimmick" unprompted.',
    'The audience is founders who cannot say what they mean. Their own words, three times.',
    'The palette follows the archetype rather than the category.',
  ],
  open: [
    { label: 'Who this is not for', rationale: 'You named an anti-brand but never an anti-customer. Every segment you described could plausibly buy.' },
    { label: 'Whether the price signals craft or access', rationale: 'The manifesto argues for craft. The audience fears argue for access. Both cannot lead.' },
    { label: 'What happens after the first result', rationale: 'The foundation ends at delivery. Nothing you answered describes the second month.' },
  ],
  the_contradiction: 'You want to be gentle and you want to be rigorous.\n\nBoth are real, and in the copy they pull opposite ways. One has to lead a sentence and the other has to follow.',
  where_a_person_helps: 'Two of the three open decisions are arguments, not exercises.\n\nNo further question will settle who you refuse. Someone has to push, and you have to hold a position under pressure.',
};

console.log('\n1 · META and registration');
{
  since();
  const v = validateAgentMeta(META);
  if (!v.ok) fail(`META invalid: ${JSON.stringify(v.errors)}`);
  if (META.phase !== '01') fail(`phase is ${META.phase}; must be '01' so the run.js tier gate never fires`);
  if (META.tier_required !== 'free') fail(`tier_required is ${META.tier_required}; must be 'free'`);
  if (META.retry_budget !== 0) fail(`retry_budget is ${META.retry_budget}; §5.2.1 mandates 0`);
  okIf(`META valid · phase ${META.phase} · tier ${META.tier_required} · retry_budget ${META.retry_budget}`);

  since();
  // The whole point is that someone who has paid nothing can read it.
  if (!canReadArtifact('free', META.slug)) fail('a free-tier user cannot read the open_questions_agent artifact');
  okIf('a free-tier user can read the artifact body');

  since();
  const deps = META.inputs.artifact_dependencies;
  const expected = ['soul_map_synthesizer','sensescape_synthesizer','visual_dna_synthesizer','war_table_synthesizer'];
  if ([...deps].sort().join(',') !== [...expected].sort().join(',')) {
    fail(`dependencies drifted: ${deps.join(', ')}`);
  }
  okIf('depends on the complete Phase 01 foundation, all four artifacts');
}

console.log('\n2 · the assembled artifact validates against the schema');
{
  since();
  const art = assembleArtifact({ parsed: PARSED, brandName: 'Quantum Trial', missingFields: ['competitorSet'] });
  const v = validateArtifact(art);
  if (!v.valid) fail(`artifact invalid: ${JSON.stringify(v.errors)}`);
  okIf('a representative artifact passes validateArtifact');

  since();
  if (art.header.agent !== META.slug) fail('header.agent does not match the slug');
  if (!art.header.title.includes('Quantum Trial')) fail('brand name missing from the title');
  if (art.body_sections.length !== 4) fail(`expected 4 body sections, got ${art.body_sections.length}`);
  const blocks = art.data_blocks.map(b => b.type);
  if (blocks.join(',') !== 'descriptor_list,priority_list') fail(`block types drifted: ${blocks.join(',')}`);
  okIf('header, 4 body sections, descriptor_list + priority_list');

  // An empty brand name must not produce a title with a hole in it.
  since();
  const anon = assembleArtifact({ parsed: PARSED, brandName: '   ', missingFields: [] });
  if (!validateArtifact(anon).valid) fail(`artifact with a blank brand name failed validation: ${JSON.stringify(validateArtifact(anon).errors)}`);
  if (anon.header.title.includes('  ')) fail(`blank brand name left a gap in the title: ${anon.header.title}`);
  okIf(`blank brand name falls back cleanly: "${anon.header.title}"`);
}

console.log('\n3 · normalizeOpen protects the priority_list contract');
{
  since();
  const seq = normalizeOpen(PARSED.open).map(o => o.rank);
  if (seq.join(',') !== '1,2,3') fail(`ranks not sequential from 1: ${seq.join(',')}`);
  okIf('three items rank 1,2,3');

  since();
  // The model returning duplicate or gapped ranks must not fail the
  // artifact after a paid call has already been spent.
  const messy = normalizeOpen([
    { rank: 7, label: 'a', rationale: 'x' },
    { rank: 7, label: 'b', rationale: 'y' },
    { rank: 2, label: 'c', rationale: 'z' },
  ]);
  if (messy.map(o => o.rank).join(',') !== '1,2,3') fail(`duplicate and gapped ranks not repaired: ${JSON.stringify(messy)}`);
  okIf('duplicate and gapped ranks are renumbered');

  since();
  const over = normalizeOpen(Array.from({ length: 30 }, (_, i) => ({ label: `l${i}`, rationale: `r${i}` })));
  if (over.length !== 10) fail(`priority_list allows 1..10, got ${over.length}`);
  okIf('more than ten open items are capped at the schema maximum of ten');

  since();
  for (const empty of [[], null, undefined, [{ label: '', rationale: '' }]]) {
    const r = normalizeOpen(empty);
    if (r.length !== 1 || r[0].rank !== 1) { fail(`empty open list did not produce the single valid fallback: ${JSON.stringify(r)}`); break; }
    if (!validateArtifact(assembleArtifact({ parsed: { ...PARSED, open: empty }, brandName: 'X', missingFields: [] })).valid) {
      fail('artifact with an empty open list failed validation'); break;
    }
  }
  okIf('an empty open list still yields a valid artifact, saying nothing was left open');
}

console.log('\n4 · the prompt obeys the codex it asks the model to obey');
{
  since();
  if (SYSTEM_PROMPT.includes('—')) fail('the system prompt contains an em dash, the character it forbids');
  okIf('no em dash in the system prompt');

  since();
  // The prompt names banned words in order to ban them, so only the
  // instructional uses are allowed. Check the prose around each hit.
  const BANNED = ['empower','supercharge','seamless','frictionless','world-class','best-in-class','cutting-edge'];
  const banLine = (SYSTEM_PROMPT.match(/^- Banned words:.*$/m) || [''])[0];
  for (const w of BANNED) {
    const hits = [...SYSTEM_PROMPT.matchAll(new RegExp(w, 'gi'))];
    for (const h of hits) {
      const ctx = SYSTEM_PROMPT.slice(Math.max(0, h.index - 120), h.index + 40);
      if (!banLine.includes(w) || !ctx.includes('Banned words')) {
        fail(`system prompt uses the banned word "${w}" outside the ban list: …${ctx.slice(-70)}…`);
      }
    }
  }
  okIf('banned words appear only inside the ban list');

  since();
  // The three jobs from the strategy note must each be instructed, or
  // the agent is a gap inventory rather than the hinge it was built as.
  for (const [need, probe] of [
    ['honesty about thin evidence', 'generated from thin input'],
    ['naming the decision, not the gap', 'Name the DECISION, not the gap'],
    ['ranking by what it blocks', 'Rank the open decisions'],
    ['no manufactured gaps', 'Never invent a gap'],
    ['no pitch in the closing section', 'No pitch, no urgency, no pricing'],
  ]) {
    if (!SYSTEM_PROMPT.includes(probe)) fail(`the prompt lost its instruction for ${need} ("${probe}")`);
  }
  okIf('all five load-bearing instructions are present');
}

console.log('\n5 · config_missing before any network call');
{
  since();
  const r = await run({ qbp: {}, dependencies: {}, files: [], runtime_args: {}, anthropicKey: '' });
  if (r.ok || r.error !== 'config_missing' || r.stage !== 'config') {
    fail(`expected config_missing/config, got ${JSON.stringify(r)}`);
  }
  okIf('an absent key refuses at the config stage');
}

// The agent runs on Google since the provider split, so the live case
// needs whichever key its own model calls for.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const KEY = ANTHROPIC_KEY || GEMINI_KEY;
console.log(`\n6 · live run ${KEY ? `(${META.model})` : '(SKIPPED · set GEMINI_API_KEY or ANTHROPIC_API_KEY)'}`);
if (KEY) {
  since();
  const dep = slug => ({ delivered: true, content: {
    schema_version: '1.0',
    header: { eyebrow: 'x', title: slug, agent: slug, generated_at: new Date().toISOString(), version: 1 },
    body_sections: [{ heading: 'Summary', prose: `Delivered ${slug} for a calm, anti-hype guide brand whose audience cannot articulate what they mean.` }],
    data_blocks: [],
  }});
  const t0 = Date.now();
  const r = await run({
    qbp: {
      brandName: 'Quantum Trial', brandEssence: 'Calm clarity for founders making their first brand decisions.',
      archetypePrimary: 'The Guide', manifesto: 'We build tools that make brand thinking feel like reading a good book.',
      antiBrand: 'Not a hustle dashboard. Not a 10x gimmick.', antiVoice: 'Breathless, exclamatory.',
      audienceLanguage: ['stuck', 'it all sounds the same'],
    },
    dependencies: {
      soul_map_synthesizer: dep('soul_map_synthesizer'),
      sensescape_synthesizer: dep('sensescape_synthesizer'),
      visual_dna_synthesizer: dep('visual_dna_synthesizer'),
      war_table_synthesizer: dep('war_table_synthesizer'),
    },
    files: [], runtime_args: {}, anthropicKey: ANTHROPIC_KEY, geminiKey: GEMINI_KEY,
  });
  const ms = Date.now() - t0;
  if (!r.ok) { fail(`live run failed: ${JSON.stringify(r).slice(0, 300)}`); }
  else {
    const v = validateArtifact(r.content);
    if (!v.valid) fail(`live artifact invalid: ${JSON.stringify(v.errors)}`);
    const text = JSON.stringify(r.content);
    if (text.includes('—')) fail('the live artifact contains an em dash');
    if (/[!]/.test(text.replace(/\\[nrt]/g, ''))) fail('the live artifact contains an exclamation point');
    const openItems = r.content.data_blocks.find(b => b.type === 'priority_list')?.content.items || [];
    console.log(`  live · ${ms} ms · model ${r.meta?.model} · ${openItems.length} open decisions`);
    for (const it of openItems) console.log(`     ${it.rank}. ${it.label}`);
  }
  okIf('live run produced a valid, codex-clean artifact');
}

console.log('');
if (failures.length) {
  console.error(`open-questions: FAILED · ${failures.length} problem${failures.length === 1 ? '' : 's'}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('open-questions: GREEN');
