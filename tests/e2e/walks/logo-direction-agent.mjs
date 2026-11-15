// Logo Direction: the Brand Profile arrives, intake with its limits,
// generation through each failure, the eight sections of the direction,
// copy, three regenerations, start over, the theme toggle.
//
// What this page does not have, so the walk cannot cover it: an approval
// loop. There is no revision request and no count of rounds. "Regenerate"
// asks for a fresh direction as often as it is pressed; the walk presses it
// three times and checks each direction replaces the last. There is no
// export button either: the direction leaves the page through "Copy Brief".
export const page = 'logo-direction-agent.html';
export const title = 'profile in, direction out: eight sections, copy, regenerate';

// What the foundation exercises leave in the Brand Profile. The archetype
// pair is stored as one string.
const PROFILE = {
  brandName: 'Maison Verne',
  brandEssence: 'Quiet objects for loud lives.',
  archetype: 'The Sage + The Rebel',
  naturalForce: 'The Ocean',
  paradox: 'Simple yet profound',
};

const HEADINGS = ['STRATEGIC BRIEF', 'THE DIRECTION', 'FORM & MARK', 'TYPOGRAPHY', 'COLOR ARCHITECTURE', 'TEXTURE & FINISH', 'WHAT TO AVOID', 'THE PROVOCATION'];
const NAMES = ['Tempered Tide', 'Held Breath', 'Plain Authority', 'Second Wind'];
const direction = name => [
  '## STRATEGIC BRIEF', 'The mark must hold calm and refusal in one shape.',
  '## THE DIRECTION', name,
  '## FORM & MARK', '- A wordmark, cut once, with one letter left open.',
  '## TYPOGRAPHY', '### Anchor faces', 'A humanist serif with low contrast.',
  '## COLOR ARCHITECTURE', 'Ink on warm paper, one mineral green held back.',
  '## TEXTURE & FINISH', 'Blind emboss before foil, matte before gloss.',
  '## WHAT TO AVOID', '- Waves, drops and every literal sea.',
  '## THE PROVOCATION', 'Say less, and leave the door open.',
].join('\n');

export async function walk(w) {
  const p = w.page;
  Object.values(PROFILE).forEach(w.note);
  await p.addInitScript(profile => { try { localStorage.setItem('qb_qbp', JSON.stringify(profile)); } catch (e) {} }, PROFILE);

  const name = p.locator('#root input[type=text]').first();
  const essence = p.locator('#root textarea').first();
  const generate = p.locator('#root .btn-primary');
  const group = n => p.locator('#root .pill-grid').nth(n);          // 0 force · 1 room · 2 figure · 3 archetypes · 4 paradox
  const pill = async (n, english) => group(n).getByRole('button', { name: await w.say(english), exact: true });
  const active = n => group(n).locator('.pill.active').allTextContents();
  const clipboard = () => p.evaluate(() => navigator.clipboard.readText());
  const fold = s => String(s).replace(/\s+/g, ' ').trim();
  // The banner is a warning sign and the message, two text nodes in one box.
  const banner = async english => {
    const want = fold('⚠ ' + await w.say(english));
    await p.waitForFunction(t => { const el = document.querySelector('#root .error-banner'); return !!el && el.innerText.replace(/\s+/g, ' ').trim() === t; }, want, { timeout: 8000 });
  };

  // The model, answered here. Every request is kept so the walk can read the prompt.
  const calls = [];
  let api = 'ok';
  await w.mockModel(async body => {
    calls.push(body);
    await new Promise(r => setTimeout(r, 600));
    return direction(NAMES[calls.length - 1] || NAMES[NAMES.length - 1]);
  });
  await w.mock('**/api/claude', route => {
    if (api === 'http500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    if (api === 'http502') return route.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
    if (api === 'network') return route.abort();
    return route.fallback();
  });

  await w.step('the Brand Profile fills the form', async () => {
    await w.open();
    await w.see('· LOGO DIRECTION AGENT');
    await w.see('Translate brand essence into precise visual language. No vague briefs. No wasted revisions.');
    w.check(await name.inputValue() === PROFILE.brandName, `brand name is "${await name.inputValue()}", the Brand Profile holds "${PROFILE.brandName}"`);
    w.check(await essence.inputValue() === PROFILE.brandEssence, 'brand essence did not come from the Brand Profile');
    w.check((await active(3)).join() === 'The Sage,The Rebel', `archetypes selected: ${(await active(3)).join() || 'none'}, the profile holds The Sage + The Rebel`);
    w.check((await active(0)).join() === await w.say('The Ocean'), 'the natural force held by the profile is not selected');
    w.check((await active(4)).join() === await w.say('Simple yet profound'), 'the paradox held by the profile is not selected');
    w.check(!(await generate.isDisabled()), 'name and essence came from the profile, and the button is disabled');
  });

  await w.step('validation: name and essence', async () => {
    await essence.fill('Short');
    await w.see('Brand name & essence required');
    w.check(await generate.isDisabled(), 'the button is enabled with a five-letter essence');
    await w.fill(essence, PROFILE.brandEssence);
    await name.fill('');
    await w.see('Brand name & essence required');
    w.check(await generate.isDisabled(), 'the button is enabled with no brand name');
    await w.fill(name, PROFILE.brandName);
    await w.gone('Brand name & essence required');
  });

  await w.step('intake: lists, and no more than three archetypes', async () => {
    await p.locator('#root select').selectOption('Fashion');
    await (await pill(1, 'Bauhaus')).click();
    await (await pill(2, 'The Oracle')).click();
    await (await pill(3, 'The Hero')).click();
    w.check((await active(3)).length === 3, 'a third archetype could not be selected');
    await (await pill(3, 'The Jester')).click();
    w.check((await active(3)).join() === 'The Sage,The Hero,The Rebel', `the page says "select up to 3" and now holds: ${(await active(3)).join()}`);
    const slider = p.locator('#root input[type=range]').first();
    await slider.focus();
    await p.keyboard.press('ArrowRight');
    w.check(await slider.inputValue() === '7', `boldness reads ${await slider.inputValue()}, expected 7`);
  });

  await w.step('the agent answers 500', async () => {
    api = 'http500';
    await w.click('Generate Logo Direction →');
    await banner('API error 500: Internal Server Error');
    w.check(await name.inputValue() === PROFILE.brandName, 'the form was emptied by a failed run');
  });

  await w.step('the agent answers 502', async () => {
    api = 'http502';
    await w.click('Generate Logo Direction →');
    await banner('The agent was unavailable and nothing was generated. Try again in a moment.');
  });

  await w.step('the network drops', async () => {
    api = 'network';
    await w.click('Generate Logo Direction →');
    await banner('Failed to fetch');
    w.check(await p.locator('#root .result-section-header').count() === 0, 'a direction is shown though every call failed');
  });

  await w.step('generate', async () => {
    api = 'ok';
    const before = calls.length;
    await w.click('Generate Logo Direction →');
    await w.see('Generating…');
    await w.see('LOGO DIRECTION · GENERATED');
    w.check(await p.locator('#root .error-banner').count() === 0, 'the last error is still shown above a good result');
    const prompt = calls[before].messages[0].content;
    for (const line of ['Brand Name: Maison Verne', 'Industry: Fashion', 'Brand Essence: Quiet objects for loud lives.', 'Brand Archetype(s): The Sage, The Rebel, The Hero',
      'Natural Force Metaphor: The Ocean', 'If This Brand Were a Museum Room: Bauhaus', 'Mythological Figure: The Oracle', 'Core Paradox to Hold: Simple yet profound', 'Visual Boldness (1=Restraint → 10=Impact): 7/10']) {
      w.check(prompt.includes(line), `not in the prompt: ${line}`);
    }
  });

  await w.step('the direction: eight sections', async () => {
    w.check(await p.locator('#root .result-section-header').count() === 8, `${await p.locator('#root .result-section-header').count()} section headings, the agent is asked for eight`);
    for (const h of HEADINGS) await w.see(h);
    await w.see(NAMES[0], { painted: true });
    await w.see('A wordmark, cut once, with one letter left open.', { painted: true });
    await w.see('Anchor faces', { painted: true });
    await w.see('Say less, and leave the door open.', { painted: true });
    // The lists chosen ride above the result as tags: force, room, figure, three archetypes.
    w.check(await p.locator('#root .tag').count() === 6, `${await p.locator('#root .tag').count()} tags, six choices were made`);
  });

  await w.step('copy brief', async () => {
    await w.click('Copy Brief');
    // On screen the headings read in the founder's language, and so does the copy.
    const want = [];
    for (const line of direction(NAMES[0]).split('\n')) want.push(line.startsWith('## ') ? '## ' + await w.say(line.slice(3)) : line);
    const got = await clipboard();
    w.check(got === want.join('\n'), `the clipboard does not hold the direction as shown: ${JSON.stringify(got.slice(0, 120))}`);   // sliced for the message only
  });

  await w.step('regenerate, three rounds', async () => {
    for (let round = 1; round <= 3; round++) {
      await w.click('Regenerate');
      await w.see(NAMES[round], { painted: true });
      await w.gone(NAMES[round - 1]);
      w.check(await p.locator('#root .result-section-header').count() === 8, `round ${round}: the direction lost sections`);
    }
    w.check(calls.length === 4, `${calls.length} direction(s) were generated, expected the first and three more`);
    await w.see('Regenerate');
  });

  await w.step('start over keeps the brief, drops the direction', async () => {
    await w.see('Reset');
    await w.click('Start Over');
    await w.gone('LOGO DIRECTION · GENERATED');
    w.check(await p.locator('#root .result-section-header').count() === 0, 'the direction is still on screen');
    w.check(await name.inputValue() === PROFILE.brandName && (await active(3)).length === 3, 'start over emptied the form');
  });

  await w.step('theme toggle', async () => {
    const theme = () => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
    w.check(await theme() === 'light', `the page opened in "${await theme()}"`);
    await w.click('◑ Dark');
    await w.see('☀ Light');
    w.check(await theme() === 'dark', 'the toggle did not set data-theme to dark');
    await w.click('☀ Light');
    await w.see('◑ Dark');
    w.check(await theme() === 'light', 'the toggle did not come back to light');
  });
}
