// Archetype Compass: the ten exercises, the local reading when the model
// fails, the model reading, the revision loop and the save to the profile.
export const page = 'archetype-compass.html';
export const title = 'ten exercises, local fallback, model reading, revision alert, save to the profile';

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));

// What the model answers. Every leaf must reach the screen.
const READING = {
  headline: 'Walk headline: a Sage that trains like a Hero.',
  centralParadox: {
    statement: 'Walk paradox: you teach calmly yet you compete.',
    whenGoverned: 'Walk governed: rigour becomes momentum.',
    whenUngoverned: 'Walk ungoverned: the lesson turns into a lecture.',
  },
  trinityReads: {
    primary: 'Walk primary read: knowledge is the operating system.',
    secondary: 'Walk secondary read: mastery gives it muscle.',
    tension: 'Walk tension read: rebellion serves when it is aimed.',
  },
  strategicMoat: {
    uniqueEnablement: 'Walk moat: proof and drive in one voice.',
    competitorsCantDo: 'Walk moat: rivals pick one or the other.',
    premiumPosition: 'Walk moat: clients pay for tested certainty.',
  },
  operatingMode: {
    decisionStyle: 'Walk mode: evidence first.',
    rhythm: 'Walk mode: slow to decide, fast to ship.',
    yesAndNo: 'Walk mode: YES to proof. NO to hype.',
  },
  marketLandscape: {
    occupiers: [{ brand: 'Walk Occupier', read: 'Walk occupier read: holds the pure position.' }],
    openSpace: 'Walk open space: nobody teaches and trains at once.',
  },
  failurePattern: {
    selfSabotage: 'Walk failure: explaining instead of deciding.',
    earlyWarnings: ['Walk warning one', 'Walk warning two'],
  },
  growthArc: { year1: 'Walk year one plan.', year3: 'Walk year three plan.', year5: 'Walk year five plan.' },
  fusion: 'Walk fusion: only this brand can be Sage and Hero at once.',
  decisionFilter: 'Walk filter: does this make us wiser without making us colder?',
  shadowsToWatch: ['Walk shadow one', 'Walk shadow two'],
  voiceImplications: { register: 'Walk voice register.', neverSounds: 'Walk voice never.', signaturePhrase: 'Walk signature phrase.' },
  visualImplications: { world: 'Walk visual world.', neverLooks: 'Walk visual never.', signatureMove: 'Walk signature move.' },
  firstMoveThisWeek: 'Walk first move: publish one tested claim.',
  epigraph: 'Walk epigraph: proof, then pace.',
};
const leaves = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(x => leaves(x, out));
  return out;
};

const SECTIONS = ['The Trinity', 'The Central Paradox', 'The Strategic Moat', 'The Operating Mode', 'The Market Landscape',
  'The Failure Pattern', 'The Growth Arc', 'The Fusion', 'The Decision Filter', 'Shadows to Watch', 'Voice Implications',
  'Visual Implications', 'The First Move', 'Diagnostic Fingerprint'];
const LABELS = ['01 · Primary', '02 · Secondary', '03 · Tension', 'When Governed', 'When Ungoverned', 'What this enables',
  "What competitors can't", 'Premium position', 'Decision Style', 'Rhythm', 'Yes & No', 'Open space', 'Year 1', 'Year 3',
  'Year 5', 'Register', 'Never sounds like', 'Signature phrase', 'Visual world', 'Never looks like', 'Signature move',
  'This week', 'Tone register', 'Core motivation', 'Core fear'];

export async function walk(w) {
  const p = w.page;
  const dialogs = [];
  p.on('dialog', d => dialogs.push(d.message()));

  // w.see matches through XPath, whose normalize-space leaves a no-break
  // space alone. French lines that carry one (before ? : ;) are read here.
  const shows = async (written, { painted = false, within = 'body', exact = true, timeout = 8000 } = {}) => {
    const text = norm(painted ? written : await w.say(written));
    try {
      await p.waitForFunction(([t, sel, ex]) => {
        const n = s => s.replace(/\s+/g, ' ').trim();
        const root = document.querySelector(sel);
        if (!root) return false;
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node; (node = tw.nextNode());) {
          const v = n(node.data);
          if (!v || !(ex ? v === t : v.includes(t))) continue;
          const el = node.parentElement;
          if (el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden') return true;
        }
        return false;
      }, [text, within, exact], { timeout });
      return true;
    } catch (e) { return false; }
  };
  const expect = async (written, opts) => w.check(await shows(written, opts), `not on screen: ${JSON.stringify(written)}`);

  // The model: down (503), slow (answers after a pause, so the loading
  // screen can be read) or ok. Every request body is kept.
  let model = 'down';
  const bodies = [];
  await w.mockModel(async body => { bodies.push(body); if (model === 'slow') await wait(1600); return READING; });
  await w.mock('**/api/claude', route => (model === 'down'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'not configured' }) })
    : route.fallback()));

  // Logos. Two sources never answered: Clearbit's Logo API (shut down) and
  // local peer-*.png files that were never added. Neither may be asked again.
  const deadLogoRequests = [];
  p.on('request', r => { if (/logo\.clearbit\.com|\/img\/archetype\/peer-/.test(r.url())) deadLogoRequests.push(r.url()); });

  let plan = [];

  await w.step('open', async () => {
    await w.open();
    await w.see('Collapse · Foundation · 01 of 05');
    await w.see('10 exercises');
    await w.see('Rank your top 3');
    await w.see('Begin diagnostic →');
    await expect("Soul Map, Visual DNA, War Table, Voice Guide. Each one reads from what you set here.");
    const facts = await p.evaluate(() => ({
      screens: SCREENS.length,
      archetypes: Object.keys(ARCHETYPES).length,
      options: SCREENS.map(s => s.opts.length).join(),
      mapped: SCREENS.filter(s => s.cols !== 2).every(s => new Set(s.opts.map(o => o.a)).size === 12),
    }));
    w.check(facts.screens === 10, `the page says ten exercises and holds ${facts.screens}`);
    w.check(facts.archetypes === 12, `twelve archetypes expected, ${facts.archetypes} defined`);
    w.check(facts.options === '12,12,12,12,12,4,12,12,12,12', `options per exercise: ${facts.options}`);
    w.check(facts.mapped, 'a ranking exercise does not offer one option per archetype');
    // Sage first, Hero second, Rebel third, and the quadrant that holds the Sage.
    plan = await p.evaluate(() => SCREENS.map(s => (s.cols === 2
      ? [s.opts.findIndex(o => o.q === 'freedom')]
      : ['sage', 'hero', 'rebel'].map(a => s.opts.findIndex(o => o.a === a)))));
  });

  await w.step('ten exercises', async () => {
    await w.click('Begin diagnostic →');
    for (let n = 1; n <= 10; n++) {
      await w.see(`Exercise ${String(n).padStart(2, '0')} of 10`, { within: '.q-head' });
      await expect(await p.evaluate(i => SCREENS[i].title, n - 1), { within: '.q-head' });
      const cards = p.locator('.q-grid .q-opt');
      const picks = plan[n - 1];
      w.check(await cards.count() === (n === 6 ? 4 : 12), `exercise ${n}: wrong number of cards`);
      w.check(await p.locator('.prog-bar .prog-dot').count() === 10, `exercise ${n}: the progress bar does not hold ten dots`);

      // Next is inert until the exercise is answered: no pointer, and a
      // keyboard or scripted click is refused too.
      const next = p.locator('.q-nav .next');
      w.check(!(await next.evaluate(b => b.classList.contains('ready') || getComputedStyle(b).pointerEvents !== 'none')), `exercise ${n}: Next looks ready with no answer`);
      await next.evaluate(b => b.click());
      w.check(await p.evaluate(() => S.step) === n, `exercise ${n}: Next moved on with no answer`);

      for (const i of picks) await cards.nth(i).click();

      if (n === 6) {
        w.check(await p.locator('.q-opt.is-selected').count() === 1, 'exercise 6: one quadrant should be selected');
        w.check(await p.locator('.q-rank-hint').count() === 0, 'exercise 6 is a single pick and should not ask for a top 3');
      } else {
        for (let r = 0; r < 3; r++) {
          w.check(await cards.nth(picks[r]).locator('.q-rank-badge').innerText() === `#${r + 1}`, `exercise ${n}: rank ${r + 1} badge is missing`);
        }
        w.check(await p.locator('.rh-pip.filled').count() === 3, `exercise ${n}: the three pips are not filled`);
      }

      if (n === 1) {
        // A fourth pick is ignored. Tapping a picked card removes it.
        const spare = [...Array(12).keys()].find(i => !picks.includes(i));
        await cards.nth(spare).click();
        w.check(await p.locator('.q-rank-badge').count() === 3, 'exercise 1: a fourth pick was accepted');
        await cards.nth(picks[2]).click();
        w.check(await p.locator('.q-rank-badge').count() === 2, 'exercise 1: tapping a picked card did not remove it');
        await cards.nth(picks[2]).click();
        w.check(await cards.nth(picks[2]).locator('.q-rank-badge').innerText() === '#3', 'exercise 1: the third pick did not come back');
      }
      if (n === 2) {
        // Back keeps the answers already given.
        await w.click('← Previous');
        await w.see('Exercise 01 of 10', { within: '.q-head' });
        w.check(await p.locator('.q-rank-badge').count() === 3, 'going back lost the answers to exercise 1');
        await w.click('Next →');
        await w.see('Exercise 02 of 10', { within: '.q-head' });
      }
      if (n === 2 || n === 9 || n === 10) {
        // Every portrait, metaphor and expression image exists.
        const broken = await p.evaluate(async () => {
          const out = [];
          for (const f of document.querySelectorAll('.figure-frame')) {
            const src = f.getAttribute('data-img');
            const res = await fetch(src).catch(() => null);
            if (!res || !res.ok) out.push(src);
          }
          return out;
        });
        w.check(broken.length === 0, `exercise ${n}: missing images ${broken.join(', ')}`);
      }

      w.check(await p.locator('.q-nav .next').evaluate(b => b.classList.contains('ready')), `exercise ${n}: Next is not ready once answered`);
      if (n < 10) await w.click('Next →');
      else await w.see('Synthesize trinity →');
    }
  });

  await w.step('local reading when the model fails', async () => {
    model = 'down';
    await w.click('Synthesize trinity →');
    await w.see('Trinity set · Strategic reading', { timeout: 15000 });
    await expect('AI synthesis was unavailable. The diagnostic was scored but the deep reading could not be generated. - The AI service is not configured on the server.');
    await w.see('Retry');

    // The scoring is local, so the trinity is already right.
    const names = await p.evaluate(() => ['primary', 'secondary', 'tension'].map(r => document.querySelector(`.r-arch.${r} .name`).textContent));
    w.check(names.join() === 'The Sage,The Hero,The Rebel', `trinity read ${names.join()}`);
    w.check((await p.locator('.r-head h1 em').innerText()).trim() === 'Sage', 'the headline does not name the primary archetype');
    await expect('Gift · Wisdom / Shadow · Detachment');

    // The local reading, sentence by sentence as the page builds it.
    await expect('Your brand reads as a The Sage primary with The Hero texture and The Rebel tension.');
    await expect('You are Sage yet Hero - and Rebel keeps knocking.');
    await expect('The Sage is the operating system. The diagnostic points to a brand built around wisdom.');
    await expect('Retry for a brand-specific signature phrase.');
    await expect('Retry for a brand-specific signature visual move.');
    await expect('Only Your brand can be Sage and Hero at the same time.');

    // The two hints above are painted, never stored. What a save writes is
    // read here: "Retry for a brand-specific signature phrase." was once
    // saved as the brand's signature phrase and read back by every tool.
    const stored = await p.evaluate(() => JSON.stringify(S.result));
    const leak = /[^".]*\bRetry\b[^"]*/.exec(stored);
    w.check(!leak, `the local reading carries a line addressed to the founder in the data a save would write: ${JSON.stringify(leak && leak[0])}`);
    const text = await p.locator('#app').innerText();
    w.check(!/ANTHROPIC|Deploy with/i.test(text), 'operator instructions are shown to the founder');

    const nums = await p.locator('.r-div .num').allInnerTexts();
    w.check(nums.join() === '01,02,03,04,05,06,07,08,09,10,11,12,13,·', `sections in the local reading: ${nums.join()}`);
    w.check(await p.locator('.r-refine').count() === 0, 'the revision loop should not be offered on a local reading');
  });

  await w.step('model reading', async () => {
    model = 'slow';
    await w.click('Retry');
    await w.see('Synthesizing your archetype trinity');
    await w.see(await p.evaluate(() => LOADING_MESSAGES[0]));
    await w.see(READING.headline, { painted: true, timeout: 15000 });
    w.check(await p.locator('.results-shell .banner.err').count() === 0, 'the error banner stayed after a good reading');

    for (const s of SECTIONS) await w.see(s);
    for (const l of LABELS) await expect(l);
    for (const leaf of leaves(READING)) await expect(leaf, { painted: true, timeout: 3000 });

    const names = await p.evaluate(() => ['primary', 'secondary', 'tension'].map(r => document.querySelector(`.r-arch.${r} .name`).textContent));
    w.check(names.join() === 'The Sage,The Hero,The Rebel', `trinity read ${names.join()}`);
    // The fingerprint shows the first pick of exercises 1, 5 and 7.
    await expect('Informative · Logical · Educated', { within: '.r-meta' });
    await expect('Knowledge', { within: '.r-meta' });
    await expect('Ignorance · Misinformation · Inaccuracy', { within: '.r-meta' });

    // What goes to the model stays English in both languages.
    const sent = bodies.length ? String(bodies[bodies.length - 1].messages[0].content) : '';
    w.check(/PRIMARY:\s+The Sage/.test(sent) && /SECONDARY:\s+The Hero/.test(sent) && /TENSION:\s+The Rebel/.test(sent), 'the detected trinity was not sent to the model');
    w.check(sent.includes('#1 Informative · Logical · Educated'), 'the answers sent to the model are not the English labels');
  });

  await w.step('revision alert and refine', async () => {
    model = 'ok';
    await w.see('Refine the read · 3 revisions remaining');
    const area = p.locator('.r-refine textarea');
    w.check(await area.getAttribute('placeholder') === await w.say('e.g. "Push harder on the tension between Magician and Sage. The Year-5 arc feels too cautious."'),
      'the revision placeholder is not in the page language');

    // Empty note: the alert, and no model call.
    const before = bodies.length;
    await w.click('Refine reading');
    w.check(dialogs.length === 1 && dialogs[0] === await w.say('Tell the system what to refine.'), `alert said ${JSON.stringify(dialogs)}`);
    w.check(bodies.length === before, 'an empty revision note still called the model');

    await w.fill(area, 'Push the tension harder.');
    await w.click('Refine reading');
    await w.see('Refine the read · 2 revisions remaining', { timeout: 15000 });
    const sent = String(bodies[bodies.length - 1].messages[0].content);
    w.check(sent.includes('USER REVISION REQUEST: Push the tension harder.'), 'the revision note did not reach the model');
    w.check(await p.locator('.r-refine textarea').inputValue() === '', 'the revision note was not cleared after the rewrite');
  });

  await w.step('save to the profile', async () => {
    w.check(deadLogoRequests.length === 0, `${deadLogoRequests.length} logo request(s) went to a source that never answers, first: ${deadLogoRequests[0]}`);
    await w.see('Save to QBP to lock the trinity into your brand profile');
    await w.click('Save to QBP');
    const qbp = await p.evaluate(() => JSON.parse(localStorage.getItem('qb_qbp') || '{}'));
    w.check(qbp.archetype === 'The Sage' && qbp.archetypePrimary === 'The Sage' && qbp.archetypeSecondary === 'The Hero' && qbp.archetypeTension === 'The Rebel',
      `profile holds ${qbp.archetypePrimary}, ${qbp.archetypeSecondary}, ${qbp.archetypeTension}`);
    w.check(qbp.archetypeToneRegister === 'Informative · Logical · Educated' && qbp.archetypeCoreMotivation === 'Knowledge' && qbp.archetypeCoreFear === 'Ignorance · Misinformation · Inaccuracy',
      'the labels stored in the profile are not the English ones');
    w.check(qbp.archetypeHeadline === READING.headline && qbp.archetypeFusion === READING.fusion, 'the reading was not stored');
    w.check(qbp.archetypeCompassComplete === true && qbp.archetypeCompassFallback === false, 'completion flags are wrong');
    w.check(Array.isArray(qbp.archetypeRawAnswers[1]) && qbp.archetypeRawAnswers[1].length === 3, 'raw answers were not stored');

    // An anonymous founder gets the soft gate. Skipping still records the work.
    const skip = p.locator('#qb-gate-skip');
    await skip.waitFor({ state: 'visible', timeout: 6000 });
    await skip.click();
    await p.locator('.qb-gate-overlay').waitFor({ state: 'detached', timeout: 6000 });
    const done = await p.evaluate(() => JSON.parse(localStorage.getItem('qb_completions') || '{}'));
    w.check(!!done['archetype-compass'], 'the completion was not recorded');

    await w.see('Continue to Brand Soul Map →');
    w.check(await p.locator('.r-actions a.btn-primary').getAttribute('href') === 'brand-soul-map.html', 'the next step does not lead to the Brand Soul Map');
    await w.see('Trinity saved to QBP · Soul Map and downstream tools will read from this');
    w.check(await p.locator('.r-actions button.btn-primary').count() === 0, 'Save to QBP is still offered after saving');
  });

  await w.step('re-take resets the diagnostic', async () => {
    await w.click('Re-take diagnostic');
    await w.see('Begin diagnostic →');
    w.check(await p.evaluate(() => Object.keys(S.answers).length === 0 && S.result === null && S.revisions === 0), 'the answers were not cleared');
  });
}
