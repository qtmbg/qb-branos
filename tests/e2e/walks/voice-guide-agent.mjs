// Voice Guide: the Brand Profile arrives, intake, generation through each
// failure, the six tabs of the guide, the copy generator for three rounds,
// copy and export, the theme toggle, a new session.
//
// What this page does not have, so the walk cannot cover it: an approval
// loop. Nothing here asks for a revision or counts rounds. The nearest thing
// is the copy generator, which writes again each time it is asked; the walk
// asks three times and checks each answer replaces the last.
import fs from 'node:fs';

export const page = 'voice-guide-agent.html';
export const title = 'profile in, guide out: six tabs, copy generator, export';

// What the foundation exercises leave in the Brand Profile. The natural
// force and the archetype pair are in the founder's own words, not one of
// the page's list values.
const PROFILE = {
  brandName: 'Maison Verne',
  brandEssence: 'Quiet objects for loud lives.',
  manifesto: 'We make less, and mean it.',
  naturalForce: 'A slow tide',
  archetype: 'The Sage + The Rebel',
  antiBrand: 'We refuse to shout.',
  paradox: 'quiet yet certain',
};
const TOKEN_PROFILE = { brandName: 'Nox Atelier', brandEssence: 'Night work, daylight clarity.', naturalForce: 'Lightning', archetype: 'The Creator' };

const GUIDE = {
  voiceIdentityStatement: 'Maison Verne speaks low and lands exactly.',
  personalityPillars: [
    { pillar: 'Measured', inPractice: 'One claim per sentence, then a full stop.' },
    { pillar: 'Exacting', inPractice: 'Names the material before the feeling.' },
    { pillar: 'Warm at the edges', inPractice: 'Closes on the reader, never on the product.' },
    { pillar: 'Unhurried', inPractice: 'Lets a short line stand alone on the page.' },
  ],
  voiceRegister: 'Plain words, chosen slowly, said once.',
  rhythmTempo: 'Short line, short line, then one long breath.',
  alignedWith: [{ brand: 'A patient publisher', reason: 'Trusts the reader to finish the thought.' }],
  refuses: [{ brand: 'A launch countdown', reason: 'Pressure in place of meaning.' }],
  alwaysDoes: ['Names the maker'],
  neverDoes: ['Stacks adjectives'],
  sentenceArchitecture: { description: 'Subject first, verb close behind, no detours.', characteristics: ['Verbs carry the weight'] },
  behavioralSynthesis: 'Edits like a typesetter, hosts like a bookseller.',
  writingRulesIntro: 'Eight rules would hold this voice; three are shown here.',
  writingRules: [
    { rule: 'Lead with the object', type: 'do', explanation: 'The thing itself earns the next sentence.', wrongExample: 'Discover our amazing new range.', rightExample: 'A lamp, oak and brass, made in Lyon.' },
    { rule: 'Promise a transformation', type: 'never', explanation: 'The object does not change a life.', wrongExample: 'This will change everything.', rightExample: 'It will light the desk.' },
    { rule: 'Humour, in small doses', type: 'caution', explanation: 'A dry aside, at most one per page.' },
  ],
  toneModes: [
    { context: 'Instagram caption', toneShift: 'A half step warmer than the site.', toneWords: ['close', 'visual'], whatChanges: 'Sentence length drops.', whatStaysConstant: 'The object still comes first.', genericExample: 'New drop, link in bio.', onBrandExample: 'Oak, brass, and the hour before dinner.' },
    { context: 'Email to customers', toneShift: 'Slower, with one clear ask.', toneWords: ['direct', 'calm'], whatChanges: 'A greeting appears.', whatStaysConstant: 'One claim per sentence.', genericExample: 'Do not miss our sale.', onBrandExample: 'The winter pieces are ready to see.' },
  ],
  beforeAfterIntro: 'The same message, before and after the voice.',
  beforeAfter: [{ scenario: 'Product launch line', before: 'Introducing our most innovative lamp yet.', after: 'A new lamp. It took two years.', whyItWorks: 'Time spent is the proof.' }],
  contentTemplates: [
    { name: 'Caption frame', usage: 'For any single product photograph.', template: '[OBJECT], [MATERIAL].\n[ONE DETAIL OF MAKING].', example: 'Lamp, oak and brass. Turned by hand in Lyon.' },
    { name: 'Subject line frame', usage: 'For the monthly letter.', template: '[SEASON]: [ONE OBJECT]', example: 'Winter: the reading lamp' },
  ],
};
const COPY = ['First draft: oak, brass, and a patient hand.', 'Second draft: two years for one lamp.', 'Third draft: the desk, lit.'];

const b64 = obj => encodeURIComponent(Buffer.from(JSON.stringify(obj)).toString('base64'));

export async function walk(w) {
  const p = w.page;
  Object.values(PROFILE).forEach(w.note);
  Object.values(TOKEN_PROFILE).forEach(w.note);
  await p.addInitScript(profile => { try { localStorage.setItem('qb_qbp', JSON.stringify(profile)); } catch (e) {} }, PROFILE);

  // w.see compares through XPath normalize-space, which keeps the no-break
  // space French sets before a colon. Playwright's own text match folds it.
  const seen = async (english, timeout = 8000) => {
    await p.getByText(await w.say(english), { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout });
  };
  const field = n => p.locator('main .qb-input').nth(n);
  const area = n => p.locator('main .qb-textarea').nth(n);
  const list = n => p.locator('main .qb-select').nth(n);
  const generate = p.locator('main .btn-primary');
  const clipboard = () => p.evaluate(() => navigator.clipboard.readText());

  // The model, answered here. Every request is kept so the walk can read the prompt.
  const calls = [];
  let api = 'ok';
  await w.mockModel(async body => {
    calls.push(body);
    await new Promise(r => setTimeout(r, 600));
    if (body.max_tokens === 800) return COPY[calls.filter(c => c.max_tokens === 800).length - 1] || COPY[COPY.length - 1];
    return GUIDE;
  });
  await w.mock('**/api/claude', route => {
    if (api === 'http500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    if (api === 'http502') return route.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
    if (api === 'network') return route.abort();
    return route.fallback();
  });

  await w.step('a profile passed in the link fills the form', async () => {
    await w.open('qbp=' + b64(TOKEN_PROFILE));
    await w.see('Synthesize Voice Guide');
    w.check(await field(0).inputValue() === TOKEN_PROFILE.brandName, `brand name is "${await field(0).inputValue()}", expected the one in the link`);
    w.check(await list(0).inputValue() === 'Lightning', 'the natural force in the link was not selected');
    w.check(await list(1).inputValue() === 'The Creator', 'the archetype in the link was not selected');
  });

  await w.step('a broken link says so and keeps the saved profile', async () => {
    await w.open('qbp=%25%25%25');
    await w.see('The QBP token in the URL was invalid or corrupted. Please check the link or enter your brand data manually.');
    w.check(await field(0).inputValue() === PROFILE.brandName, 'the saved Brand Profile was lost to a broken link');
  });

  await w.step('the saved Brand Profile fills the form', async () => {
    await w.open();
    await w.see('Synthesize Voice Guide');
    w.check(await field(0).inputValue() === PROFILE.brandName, `brand name is "${await field(0).inputValue()}", the Brand Profile holds "${PROFILE.brandName}"`);
    w.check(await area(0).inputValue() === PROFILE.brandEssence, 'brand essence did not come from the Brand Profile');
    w.check(await field(1).inputValue() === PROFILE.manifesto, 'manifesto line did not come from the Brand Profile');
    // In the founder's own words: kept, selected and shown, though not a list value.
    w.check(await list(0).inputValue() === PROFILE.naturalForce, `natural force shows "${await list(0).inputValue()}", the profile holds "${PROFILE.naturalForce}"`);
    w.check(await list(1).inputValue() === PROFILE.archetype, `archetype shows "${await list(1).inputValue()}", the profile holds "${PROFILE.archetype}"`);
    w.check(await list(0).locator('option:checked').textContent() === PROFILE.naturalForce, 'the natural force held by the profile is not the option shown');
    w.check(!(await generate.isDisabled()), 'the form is complete from the profile, and the button is disabled');
  });

  await w.step('validation: the four required fields', async () => {
    await field(0).fill('');
    w.check(await generate.isDisabled(), 'the button is enabled with no brand name');
    await w.fill(field(0), PROFILE.brandName);
    await list(0).selectOption('');
    w.check(await generate.isDisabled(), 'the button is enabled with no natural force');
    await list(0).selectOption('The Ocean');
    await list(1).selectOption('The Sage');
    await list(2).selectOption('The Oracle');
    w.check(!(await generate.isDisabled()), 'the button stayed disabled with the four required fields filled');
  });

  await w.step('tone and platforms', async () => {
    const slider = p.locator('main input[type=range]').first();
    await slider.focus();
    for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight');
    w.check(await slider.inputValue() === '8', `the first slider reads ${await slider.inputValue()}, expected 8`);
    await w.click('podcast');
    await w.click('linkedin');
  });

  await w.step('the agent answers 500', async () => {
    api = 'http500';
    await w.click('Generate Identity System');
    await seen('Agent error: API error 500: Internal Server Error');
    await w.see('Synthesize Voice Guide');
    w.check(await field(0).inputValue() === PROFILE.brandName, 'the form was emptied by a failed run');
  });

  await w.step('the agent answers 502', async () => {
    api = 'http502';
    await w.click('Generate Identity System');
    await w.see('The agent was unavailable and nothing was generated. Try again in a moment.');
  });

  await w.step('the network drops', async () => {
    api = 'network';
    await w.click('Generate Identity System');
    await seen('Agent error: Failed to fetch');
  });

  await w.step('generate', async () => {
    api = 'ok';
    const before = calls.length;
    await w.click('Generate Identity System');
    await w.see('Synthesizing Voice Identity');
    await w.see('Assembling Voice Guide');
    await w.see('Voice Identity Statement');
    await w.gone('Agent error: Failed to fetch');
    const prompt = calls[before].messages[0].content;
    w.check(prompt.includes('Brand Name: ' + PROFILE.brandName), 'the brand name is not in the prompt');
    w.check(prompt.includes('Natural Force: The Ocean') && prompt.includes('Primary Archetype: The Sage'), 'the list values chosen are not in the prompt');
    w.check(prompt.includes('Formal(1) to Casual(10): 8'), 'the tone slider is not in the prompt as set');
    w.check(prompt.includes('PLATFORMS TO COVER: instagram, email, website, podcast'), `platforms in the prompt: ${(/PLATFORMS TO COVER: ([^\n]*)/.exec(prompt) || [])[1]}`);
    await w.see(PROFILE.brandName, { painted: true, within: 'main' });
  });

  await w.step('tab 1 · voice DNA', async () => {
    await w.see(GUIDE.voiceIdentityStatement, { painted: true });
    await w.see('Personality pillars');
    w.check(GUIDE.personalityPillars.length === 4, 'the walk answers four pillars, as the prompt asks');
    for (const x of GUIDE.personalityPillars) { await w.see(x.pillar, { painted: true }); await w.see(x.inPractice, { painted: true }); }
    for (const label of ['Voice register', 'Rhythm + tempo', 'Sounds aligned with', 'Refuses to sound like', 'Always', 'Never', 'Sentence architecture', 'Behavioral synthesis']) await w.see(label);
    for (const text of [GUIDE.voiceRegister, GUIDE.rhythmTempo, GUIDE.alignedWith[0].brand, GUIDE.refuses[0].reason, GUIDE.alwaysDoes[0], GUIDE.neverDoes[0], GUIDE.sentenceArchitecture.characteristics[0], GUIDE.behavioralSynthesis]) await w.see(text, { painted: true });
  });

  await w.step('tab 2 · writing rules', async () => {
    await w.click('Writing Rules');
    await w.see(GUIDE.writingRulesIntro, { painted: true });
    for (const badge of ['DO', 'NEVER', 'CAUTION']) await w.see(badge);
    w.check(await p.locator('.rule-card').count() === 3, `${await p.locator('.rule-card').count()} rule cards, three rules were answered`);
    await w.click(GUIDE.writingRules[0].rule, { painted: true });
    await w.see('WRONG');
    await w.see('RIGHT');
    await w.see(GUIDE.writingRules[0].wrongExample, { painted: true });
    await w.see(GUIDE.writingRules[0].rightExample, { painted: true });
    await w.see('↑');
    await w.click(GUIDE.writingRules[2].rule, { painted: true });
    await w.see(GUIDE.writingRules[2].explanation, { painted: true });
    await w.gone('WRONG');
  });

  await w.step('tab 3 · tone modes', async () => {
    await w.click('Tone Modes');
    const [first, second] = GUIDE.toneModes;
    await w.see('Tone shift for');
    for (const label of ['What changes / what stays constant', 'Changes', 'Constant', 'Generic version', 'On-brand version']) await w.see(label);
    for (const text of [first.toneShift, first.toneWords[0], first.whatChanges, first.whatStaysConstant, first.genericExample, first.onBrandExample]) await w.see(text, { painted: true });
    await w.click(second.context, { painted: true, role: 'button' });
    await w.see(second.onBrandExample, { painted: true });
    await w.gone(first.onBrandExample);
  });

  await w.step('tab 4 · before and after', async () => {
    await w.click('Before & After');
    const item = GUIDE.beforeAfter[0];
    await w.see(GUIDE.beforeAfterIntro, { painted: true });
    await w.see('Before · generic');
    await w.see('After · on brand');
    await seen('Why it works:');
    for (const text of [item.scenario, item.before, item.after, item.whyItWorks]) await w.see(text, { painted: true });
  });

  await w.step('tab 5 · content templates, copy', async () => {
    await w.click('Content Templates');
    const [first, second] = GUIDE.contentTemplates;
    await w.see(first.usage, { painted: true });
    await w.see('Example using this template');
    await w.click('Copy');
    w.check(await clipboard() === first.template, `the clipboard holds ${JSON.stringify(await clipboard())}, expected the template`);
    await w.click(second.name, { painted: true, role: 'button' });
    await w.see(second.usage, { painted: true });
    await w.click('Copy');
    w.check(await clipboard() === second.template, 'the second template was not the one copied');
  });

  await w.step('tab 6 · copy generator, validation', async () => {
    await w.click('Copy Generator');
    await w.see('The Voice Guide is active in system memory. Describe what you need, and the agent will write it exactly in this voice.');
    w.check(await generate.isDisabled(), '"Generate Copy" is enabled with nothing to write');
    await w.fill(field(0), 'Instagram caption');
    w.check(await generate.isDisabled(), '"Generate Copy" is enabled with no brief');
    await w.fill(field(1), 'Instagram');
    await w.fill(area(0), 'Announce the reading lamp.');
    w.check(!(await generate.isDisabled()), '"Generate Copy" stayed disabled with format and brief filled');
  });

  await w.step('copy generator, each failure', async () => {
    api = 'http500';
    await w.click('Generate Copy');
    await seen('API error 500: Internal Server Error');
    api = 'http502';
    await w.click('Generate Copy');
    await w.see('The agent was unavailable and nothing was generated. Try again in a moment.');
    api = 'network';
    await w.click('Generate Copy');
    await w.see('Failed to fetch');
    w.check(!(await p.getByText(COPY[0], { exact: true }).isVisible()), 'copy is shown though every call failed');
  });

  await w.step('copy generator, three rounds', async () => {
    api = 'ok';
    for (let round = 0; round < 3; round++) {
      await w.click('Generate Copy');
      await w.see('Writing...');
      await w.see(COPY[round], { painted: true });
      if (round) await w.gone(COPY[round - 1]);
      await w.see('Generated copy');
    }
    await w.gone('Failed to fetch');
    const last = calls[calls.length - 1];
    w.check(last.max_tokens === 800 && last.messages[0].content.includes('Brief: Announce the reading lamp.'), 'the brief is not in the copy prompt');
    w.check(last.messages[0].content.includes(GUIDE.voiceIdentityStatement), 'the generated guide is not in the copy prompt');
    await w.click('Copy text');
    w.check(await clipboard() === COPY[2], `the clipboard holds ${JSON.stringify(await clipboard())}, expected the third draft`);
  });

  await w.step('export JSON', async () => {
    const [download] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), w.click('Export JSON')]);
    w.check(download.suggestedFilename() === 'maison-verne-voice-guide.json', `the file is named ${download.suggestedFilename()}`);
    const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    w.check(data.voiceGuide && data.voiceGuide.voiceIdentityStatement === GUIDE.voiceIdentityStatement, 'the exported guide is not the one on screen');
    w.check(data.voiceGuide.writingRules.length === 3 && data.voiceGuide.toneModes.length === 2, 'the export lost rules or tone modes');
    w.check(data.qbp && data.qbp.brandName === PROFILE.brandName && data.qbp.naturalForce === 'The Ocean', 'the export does not carry the profile the guide was built from');
  });

  await w.step('theme toggle', async () => {
    const toggle = p.locator('#root header button[aria-label]');
    const theme = () => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
    w.check(await theme() === 'light', `the page opened in "${await theme()}"`);
    w.check(await toggle.getAttribute('aria-label') === await w.say('Switch to dark mode'), 'the toggle is not labelled for what it does');
    await toggle.click();
    w.check(await theme() === 'dark', 'the toggle did not set data-theme to dark');
    w.check(await toggle.getAttribute('aria-label') === await w.say('Switch to light mode'), 'the toggle label did not follow');
    await toggle.click();
    w.check(await theme() === 'light', 'the toggle did not come back to light');
  });

  await w.step('new session', async () => {
    await w.click('New Session');
    await w.see('Synthesize Voice Guide');
    w.check(await field(0).inputValue() === PROFILE.brandName, 'a new session emptied the form');
    await w.gone('Voice Identity Statement');
  });
}
