// Logo Evaluation: the Brand Profile arrives, calibration with its required
// fields, up to four concepts, evaluation through each failure, the three
// verdicts and how each is painted, the six dimensions, the four tabs of
// the result, back and new calibration, the theme toggle.
//
// What this page does not have, so the walk cannot cover it: an approval
// loop (a verdict is read, not revised; running again is a new evaluation)
// and any copy or export button.
export const page = 'logo-evaluation-agent.html';
export const title = 'profile in, verdict out: three verdicts, six dimensions, four tabs';

const PROFILE = {
  brandName: 'Maison Verne',
  brandEssence: 'Quiet objects for loud lives.',
  naturalForce: 'A slow tide',
  archetype: 'The Sage + The Rebel',
  antiBrand: 'We refuse to shout.',
  paradox: 'quiet yet certain',
  colorTerritory: 'Ink on warm paper.',
};
const BLOCKLIST = 'No waves, no drops, no gradients.';
const QUESTION = 'Would a stranger feel the calm before reading the name?';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// The three verdicts, as the prompt spells them and as the page names their style.
const VERDICTS = [
  { text: 'PASS - Ready for use', cls: 'verdict-pass', passed: true },
  { text: 'REFINE - Conditional approval with changes', cls: 'verdict-refine', passed: true },
  { text: 'REJECT - Fundamental misalignment', cls: 'verdict-reject', passed: false },
];
// The six dimensions, as the page names them.
const DIMENSIONS = [
  ['geometry', 'Geometry Alignment', 'Does the form vocabulary match the Visual Direction?'],
  ['archetype', 'Archetype Expression', 'Does the mark carry the Primary Archetype?'],
  ['energy', 'Energy Match', 'Does it transmit the Natural Force correctly?'],
  ['complexity', 'Complexity Score', 'Is the complexity level right for the brand?'],
  ['antiPattern', 'Anti-Pattern Compliance', 'Does it violate any blocklist items?'],
  ['essence', 'Essence Test', 'Does it carry the Brand Essence without words?'],
];

export async function walk(w) {
  const p = w.page;
  Object.values(PROFILE).forEach(w.note);
  ['verne-mark-a.png', 'verne-mark-b.png'].forEach(w.note);
  await p.addInitScript(profile => { try { localStorage.setItem('qb_qbp', JSON.stringify(profile)); } catch (e) {} }, PROFILE);

  // w.see compares through XPath normalize-space, which keeps the no-break
  // space French sets before ? and : . Playwright's own text match folds it.
  const seen = async (english, timeout = 8000) => {
    await p.getByText(await w.say(english), { exact: true }).filter({ visible: true }).first().waitFor({ state: 'visible', timeout });
  };
  const fold = s => String(s).replace(/\s+/g, ' ').trim();
  const field = n => p.locator('main input[type=text], main textarea').nth(n);
  const next = p.locator('main .btn-primary');
  const upload = (name) => p.locator('main input[type=file]').setInputFiles({ name, mimeType: 'image/png', buffer: PNG });
  // The verdict box: the element that wraps the verdict and takes its style.
  const verdictBox = () => p.evaluate(() => {
    const span = [...document.querySelectorAll('main span.text-mono')].find(s => /^verdict-|^$/.test(s.parentElement.className) && s.parentElement.style.display === 'inline-block');
    return span ? { cls: span.parentElement.className, text: span.textContent, ground: getComputedStyle(span.parentElement).backgroundColor, ink: getComputedStyle(span).color } : null;
  });
  const failed = async english => {
    const want = fold(await w.say('Evaluation failed:') + ' ' + await w.say(english));
    await p.waitForFunction(t => { const el = document.querySelector('main .error-box'); return !!el && el.innerText.replace(/\s+/g, ' ').trim() === t; }, want, { timeout: 8000 });
  };

  // The model, answered here. Every request is kept so the walk can read the prompt.
  const calls = [];
  let api = 'ok';
  let verdict = VERDICTS[0];
  let run = 0, runBase = 0;           // which evaluation, and where its calls start
  const reading = k => `Reading ${run}.${k} holds the essence against the mark.`;
  await w.mockModel(async body => {
    calls.push(body);
    await new Promise(r => setTimeout(r, 400));
    const k = calls.length - runBase;   // 1 for the first concept with an image, 2 for the second
    const n = `${run}.${k}`;
    return {
      overallScore: k === 1 ? 86 : 61,
      verdict: verdict.text,
      verdictReason: reading(k),
      dimensions: DIMENSIONS.map(([id], i) => ({
        id,
        // The agent's own wording for one label: the page must still name the dimension itself.
        label: id === 'antiPattern' ? 'Blocklist check, in the agent’s words' : DIMENSIONS[i][1],
        score: 90 - i * 7,
        finding: `Finding on ${id}, reading ${n}.`,
        evidence: `Evidence on ${id}, reading ${n}.`,
      })),
      strengths: ['The open letter carries the calm.'],
      criticalIssues: ['The counter closes at small sizes.'],
      refinementDirections: ['Open the counter by a hair.'],
      designerNote: 'Keep the cut. Loosen the spacing.',
      passedQualityTest: verdict.passed,
      qualityTestExplanation: 'A stranger reads calm before the name.',
    };
  });
  await w.mock('**/api/claude', route => {
    if (api === 'http500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    if (api === 'http502') return route.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
    if (api === 'network') return route.abort();
    return route.fallback();
  });
  const evaluate = async () => {
    run++; runBase = calls.length;
    await w.click('Execute Analysis');
    await w.see('Analysis Complete', { timeout: 12000 });
  };
  const backToArtifacts = async () => { await w.click('← Back to Artifacts'); await w.see('Evaluation Dimensions'); };

  await w.step('the Brand Profile fills the calibration', async () => {
    await w.open();
    await w.see('Intelligence Calibration');
    await w.see('This agent analyzes identity artifacts through the lens of your Quantum Brand Profile. It scores against six exact dimensions, ensuring concepts carry your essence before they are ever presented.');
    const got = { name: await field(0).inputValue(), force: await field(1).inputValue(), essence: await field(2).inputValue(), archetype: await field(4).inputValue(), anti: await field(5).inputValue(), paradox: await field(6).inputValue(), colour: await field(11).inputValue() };
    w.check(got.name === PROFILE.brandName && got.essence === PROFILE.brandEssence, `name and essence did not come from the Brand Profile: ${JSON.stringify(got)}`);
    w.check(got.force === PROFILE.naturalForce && got.archetype === PROFILE.archetype, 'natural force or archetype did not come from the Brand Profile');
    w.check(got.anti === PROFILE.antiBrand && got.paradox === PROFILE.paradox && got.colour === PROFILE.colorTerritory, 'anti-brand, paradox or colour territory did not come from the Brand Profile');
  });

  await w.step('validation: five required fields', async () => {
    // The profile holds no museum room, so the form is one field short.
    w.check(await field(3).inputValue() === '', 'museum room was filled from nowhere');
    w.check(await next.isDisabled(), '"Proceed to Artifacts" is enabled with no museum room');
    await w.fill(field(3), 'Bauhaus');
    w.check(!(await next.isDisabled()), '"Proceed to Artifacts" stayed disabled with the five required fields filled');
    await field(0).fill('');
    w.check(await next.isDisabled(), '"Proceed to Artifacts" is enabled with no brand name');
    await w.fill(field(0), PROFILE.brandName);
    await w.fill(field(12), BLOCKLIST);
    await w.fill(field(13), QUESTION);
    await w.click('Proceed to Artifacts');
    await w.see('Artifacts');
    await w.see(PROFILE.brandName, { painted: true, exact: false, within: 'main' });
  });

  await w.step('the six dimensions are listed before anything is uploaded', async () => {
    await w.see('Evaluation Dimensions');
    for (const [, label, question] of DIMENSIONS) { await w.see(label); await seen(question); }
    w.check(DIMENSIONS.length === 6, 'the walk lists six dimensions, as the page says');
  });

  await w.step('upload, remove, rename', async () => {
    w.check(await next.isDisabled(), '"Execute Analysis" is enabled with no artifact');
    await w.see('Drop identity artifact here');
    await w.see('PNG, JPG, SVG accepted');
    await upload('verne-mark-a.png');
    await w.see('verne-mark-a.png', { painted: true });
    w.check(!(await next.isDisabled()), '"Execute Analysis" stayed disabled with an artifact uploaded');
    await w.click('Remove');
    await w.see('Drop identity artifact here');
    w.check(await next.isDisabled(), '"Execute Analysis" is enabled after the artifact was removed');
    await upload('verne-mark-a.png');
    await w.see('verne-mark-a.png', { painted: true });
    await w.fill('main input[type=text]', 'Open V');
    await w.see('Open V', { painted: true });
  });

  await w.step('up to four concepts', async () => {
    await w.see('Provide up to 4 concepts for independent QBP evaluation.');
    await w.click('+ Add');
    await w.see('Concept B');
    await upload('verne-mark-b.png');
    await w.see('verne-mark-b.png', { painted: true });
    await w.click('+ Add');
    await w.click('+ Add');
    await w.see('Concept D');
    await w.gone('+ Add');
    w.check(await p.locator('main .tab-btn').count() === 4, `${await p.locator('main .tab-btn').count()} concept tabs, the page allows four`);
  });

  await w.step('the agent answers 500', async () => {
    // Concept D is open and has no image. The result still lands on a concept that was evaluated.
    api = 'http500';
    const before = calls.length;
    await evaluate();
    await failed('API error 500');
    w.check(calls.length === before, 'the model mock was reached though the proxy answered 500');
    w.check(await verdictBox() === null, 'a verdict is painted for a failed evaluation');
  });

  await w.step('the agent answers 502', async () => {
    await backToArtifacts();
    api = 'http502';
    await evaluate();
    await failed('The agent was unavailable and this concept was not scored. Try again in a moment.');
  });

  await w.step('the network drops', async () => {
    await backToArtifacts();
    api = 'network';
    await evaluate();
    await failed('Failed to fetch');
  });

  const grounds = {};
  for (const v of VERDICTS) {
    await w.step(`verdict: ${v.text}`, async () => {
      await backToArtifacts();
      api = 'ok';
      verdict = v;
      const before = calls.length;
      run++; runBase = calls.length;
      await w.click('Execute Analysis');
      await w.see('Synthesizing Intelligence');
      await w.see('Analyzing');
      await w.see('Analysis Complete', { timeout: 12000 });
      await w.see(v.text);
      const box = await verdictBox();
      w.check(!!box, 'no verdict box on screen');
      if (!box) return;
      w.check(box.cls === v.cls, `"${v.text}" is painted with class "${box.cls}", expected "${v.cls}"`);
      w.check(fold(box.text) === fold(await w.say(v.text)), `the verdict reads ${JSON.stringify(box.text)}`);
      grounds[v.cls] = box.ground + ' / ' + box.ink;
      // Two concepts carry an image, so two calls left the page, each with the image and the pinned verdicts.
      w.check(calls.length - before === 2, `${calls.length - before} evaluation call(s), two concepts carry an image`);
      const content = calls[before].messages[0].content;
      w.check(content[0].type === 'image' && content[0].source.media_type === 'image/png', 'the image is not in the request');
      const prompt = content[1].text;
      w.check(VERDICTS.every(x => prompt.includes('\n' + x.text)), 'the three verdict strings are not spelled out on their own lines in the prompt');
      w.check(prompt.includes('must be exactly one of these three strings') && prompt.includes('Leave it in English'), 'the prompt does not pin the verdict');
      w.check(prompt.includes('Anti-Pattern Blocklist: ' + BLOCKLIST) && prompt.includes('Quality Test: ' + QUESTION), 'blocklist or defining question missing from the prompt');
      await w.see('Quality Test');
      await w.see({ en: v.passed ? 'Passed' : 'Failed', fr: v.passed ? 'réussi' : 'échoué' }[w.lang], { painted: true });
    });
  }

  await w.step('the three verdicts are painted three ways', async () => {
    const seenStyles = new Set(Object.values(grounds));
    w.check(Object.keys(grounds).length === 3 && seenStyles.size === 3, `the three verdicts do not have three styles: ${JSON.stringify(grounds)}`);
  });

  await w.step('a verdict the page does not know is not painted as a rejection', async () => {
    await backToArtifacts();
    verdict = { text: 'VALIDÉ - Prêt à l’emploi', passed: true };
    await evaluate();
    await w.see(verdict.text, { painted: true });
    const box = await verdictBox();
    w.check(!!box && box.cls === '', `an unknown verdict is painted with class "${box && box.cls}", expected none`);
    w.check(await p.locator('main .verdict-reject').count() === 0, 'an unknown verdict fell through to the reject style');
  });

  await w.step('result: dimension analysis', async () => {
    await backToArtifacts();
    verdict = VERDICTS[0];
    await evaluate();
    await w.see('System Verdict');
    await w.see('Dimension Topography');
    await w.see('86');
    for (const [id, label] of DIMENSIONS) { await w.see(label); await w.see(`Finding on ${id}, reading ${run}.1.`, { painted: true }); await w.see(`Evidence on ${id}, reading ${run}.1.`, { painted: true }); }
    w.check(await p.getByText('Blocklist check, in the agent’s words').count() === 0, 'a dimension is named by the agent, not by the page');
    // The chart names each axis by the first word of the page's own label.
    for (const axis of ['Geometry', 'Archetype', 'Energy', 'Complexity', 'Anti-Pattern', 'Essence']) await w.see(axis);
    w.check(await p.locator('main svg text').count() === 6, `${await p.locator('main svg text').count()} chart axes, expected six`);
    await w.see('A stranger reads calm before the name.', { painted: true });
  });

  await w.step('result: the other three tabs', async () => {
    await w.click('Alignment Points');
    await w.see('System Alignment');
    await w.see('The open letter carries the calm.', { painted: true });
    await w.click('Friction & Refinements');
    await w.see('Critical Friction');
    await w.see('The counter closes at small sizes.', { painted: true });
    await w.see('Suggested Refinements');
    await w.see('Open the counter by a hair.', { painted: true });
    await w.click('Designer Note');
    await w.see('Note to Creator');
    await w.see('Keep the cut. Loosen the spacing.', { painted: true });
    await w.click('Dimension Analysis');
    await w.see('Geometry Alignment');
  });

  await w.step('the second concept has its own reading', async () => {
    const first = reading(1), second = reading(2);
    await w.see(first, { painted: true });
    await w.click('Concept B');
    await w.see(second, { painted: true });
    await w.gone(first);
    await w.see('61');
  });

  await w.step('new calibration', async () => {
    await w.click('New Calibration');
    await w.see('Intelligence Calibration');
    w.check(await field(0).inputValue() === PROFILE.brandName, 'a new calibration emptied the brand name');
    await w.click('Proceed to Artifacts');
    await w.see('Concept A');
    w.check(await p.locator('main .tab-btn').count() === 1, 'the concepts were not reset to one');
    await w.see('Drop identity artifact here');
    await w.click('← Re-calibrate');
    await w.see('Intelligence Calibration');
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
}
