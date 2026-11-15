// Signal Scan: the sign-in nudge, eight questions, the lead form and its
// validation, the report, and what the page says about itself underneath.
//
// The answers below are fixed so the report can be checked to the point:
// six questions score 0 to 3, each feeds one dimension as (3 - v) / 3 × 100,
// and the weights (20, 18, 17, 22, 13, 10) give 69, band B, weakest
// dimension Visual Coherence, first move Logo Evaluation.
export const page = 'signal-scan.html';
export const title = 'sign-in nudge, eight questions, lead form, report';

const QUESTIONS = [
  { q: 'Where are you right now?', pick: 'I have a brand but something feels off or unclear' },
  { q: 'Can you say what your brand stands for in one sentence?', pick: 'Yes, clearly and without hesitation' },
  { q: 'When someone sees your brand visually, what do they feel?', pick: 'Probably nothing distinctive' },
  { q: 'How consistent is your brand voice across platforms?', pick: 'Mostly consistent with some drift' },
  { q: 'Can your ideal client immediately understand why you and not someone else?', pick: 'Somewhat, but I could be confused with competitors' },
  { q: 'Does your content attract the right people?', pick: 'Yes. My content consistently brings in qualified leads' },
  { q: 'Does your brand support the price you want to charge?', pick: 'Yes. Clients rarely question my pricing' },
];
const LAST_QUESTION = 'In your own words, what is the single biggest problem your brand has right now?';
const PROBLEM = 'People like the work and still cannot say what we are for.';
const EMAIL = 'founder@example.com';
const SCORES = [100, 0, 67, 67, 100, 100];   // identity, visual, voice, positioning, content, price

export async function walk(w) {
  const p = w.page;
  const calls = { welcome: [], magic: [], opened: [] };
  // French sets a no-break space before ? and : so painted text is compared
  // with every run of white space, no-break included, folded to one space.
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const painted = async english => flat(await w.say(english));
  const appText = async () => flat(await p.locator('#app').innerText());
  const sees = async (english, where = '#app') => {
    const want = await painted(english);
    await p.waitForFunction(([sel, text]) => {
      const el = document.querySelector(sel);
      return !!el && el.innerText.replace(/\s+/g, ' ').toLowerCase().includes(text.toLowerCase());
    }, [where, want], { timeout: 8000 });
  };

  await w.mock('**/api/send-welcome-email', async route => {
    calls.welcome.push({ body: JSON.parse(route.request().postData() || '{}'), lang: route.request().headers()['x-qb-lang'] });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"emailId":"walk"}' });
  });
  await w.mock('**/api/send-magic-link', async route => {
    calls.magic.push({ body: JSON.parse(route.request().postData() || '{}'), lang: route.request().headers()['x-qb-lang'] });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await w.step('sign-in nudge for a stray sign-in link', async () => {
    await w.open('reason=signin');
    await sees('Looking to sign in? Your account lives one email away.', '#signin-nudge');
    const href = await p.locator('#signin-nudge a').getAttribute('href');
    w.check(href === '/login?reason=signin&return_to=%2Ffoundation', `nudge link is ${href}`);
    if (w.lang === 'fr') {
      const missed = await p.evaluate(() => window.QBI18N.misses().map(m => m.text));
      w.check(missed.length === 0, `untranslated on the sign-in nudge: ${JSON.stringify(missed)}`);
    }
  });

  await w.step('open, with the nudge for a tool that needs the profile', async () => {
    await w.open('reason=paywall&return_to=%2Fwar-table.html');
    await sees('That tool needs your Brand Profile. Sign in first. If your plan covers it, it opens with your own data behind it.', '#signin-nudge');
    const href = await p.locator('#signin-nudge a').getAttribute('href');
    w.check(href === '/login?reason=paywall&return_to=%2Fwar-table.html', `nudge link is ${href}`);
    await w.see('Signal Scan', { within: '#app' });
    await w.see('· Observe', { within: '#app' });
    await w.see('Built on 20 years of brand practice.');
    w.check(!/1,000|1\s000/.test(await appText()), 'the unverified usage figure is still on the intro');
    w.check(!(await appText()).includes('Intelligence'), 'the intro still carries the retired phase label');
  });

  await w.step('the page describes the scan the code runs', async () => {
    // Counted from the page's own data, not from this file.
    const facts = await p.evaluate(() => ({
      questions: QUESTIONS.length,
      scored: DIMENSIONS.reduce((n, d) => n + d.qIds.length, 0),
      dimensions: DIMENSIONS.length,
      weights: DIMENSIONS.reduce((n, d) => n + d.weight, 0),
      bands: [100, 80, 79, 60, 59, 40, 39, 0].map(s => getVerdict(s).label),
    }));
    w.check(facts.questions === 8, `the scan has ${facts.questions} questions, the copy says eight`);
    w.check(facts.scored === 6 && facts.dimensions === 6, `${facts.scored} questions feed ${facts.dimensions} dimensions, the copy says six and six`);
    w.check(facts.weights === 100, `the weights add up to ${facts.weights}, the score is out of 100`);
    w.check(JSON.stringify(facts.bands) === JSON.stringify(['Strong Foundation', 'Strong Foundation', 'Clear Gaps', 'Clear Gaps', 'Structural Issues', 'Structural Issues', 'Foundation Needed', 'Foundation Needed']),
      `band edges moved: ${facts.bands.join(', ')}`);
    await sees('Six of the eight questions each feed one weighted dimension:', '.scan-brief');
    for (const band of ['80 and above, Strong Foundation.', '60 to 79, Clear Gaps.', '40 to 59, Structural Issues.', 'Below 40, Foundation Needed.']) await w.see(band);
    await w.see('Yes. The scan and its result are free, with no card and no trial clock. So are three foundation exercises (Archetype Compass, Brand Soul Map, Sensescape), The Profiles and the Brand Document.');
    const brief = flat(await p.locator('.scan-brief').innerText());
    w.check(!/Phase 0\d|six phases|free forever|gratuite? à vie/i.test(brief), 'the brief still carries retired phase or free-forever copy');
    // The FAQ markup must say what the page paints, word for word.
    if (w.lang === 'en') {
      const pairs = await p.evaluate(() => {
        const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)).find(d => d['@type'] === 'FAQPage');
        const shown = [...document.querySelectorAll('.scan-brief_faq h3')].map(h => [h.textContent, h.nextElementSibling.textContent].map(t => t.replace(/\s+/g, ' ').trim()));
        return { marked: data.mainEntity.map(q => [q.name, q.acceptedAnswer.text]), shown };
      });
      w.check(JSON.stringify(pairs.marked) === JSON.stringify(pairs.shown), 'the FAQ JSON-LD and the painted FAQ have drifted apart');
    }
  });

  await w.step('seven choice questions', async () => {
    await w.click('Start the scan →');
    for (let i = 0; i < QUESTIONS.length; i++) {
      const { q, pick } = QUESTIONS[i];
      await w.see(`Step ${i + 1} of 8`);
      await w.see(q, { role: 'heading' });
      w.check(await p.locator('#app button.option-btn').count() === 4, `question ${i + 1} does not offer four answers`);
      await w.click(pick, { wait: 450 });
      if (i === 0) {
        // Back keeps the answer; answering again moves on.
        await w.see('Step 2 of 8');
        await w.click('← Back');
        await w.see('Step 1 of 8');
        const kept = flat(await p.locator('#app button.option-btn.selected').innerText());
        w.check(kept === await painted(pick), `going back lost the answer: ${kept}`);
        await w.click(pick, { wait: 450 });
      }
    }
  });

  await w.step('the question in your own words', async () => {
    await w.see('Step 8 of 8');
    await w.see(LAST_QUESTION, { role: 'heading' });
    const hint = await p.locator('#app textarea').getAttribute('placeholder');
    w.check(hint === await w.say('Type here…'), `textarea placeholder reads ${JSON.stringify(hint)}`);
    await w.fill('#app textarea', PROBLEM);
    await w.click('Continue →');
  });

  await w.step('lead form refuses a bad address', async () => {
    await w.see('Your scan is ready.');
    await sees('Enter your email to open your Brand Signal Report. Your score, the gaps, and the exact first move.');
    for (const bad of ['founder', '@', 'founder@example']) {
      await w.fill('#app input[type="email"]', bad);
      await w.click('Send my report →');
      // Said by name: a walk that only times out here would not tell which address got through.
      if (await p.locator('#app input[type="email"]').count() !== 1) throw new Error(`"${bad}" was accepted as an email address`);
      await w.see('Your scan is ready.');
      const edge = await p.locator('#app input[type="email"]').evaluate(el => el.style.borderColor);
      w.check(/rose-deep/.test(edge), `"${bad}" was not flagged on the field`);
    }
    w.check(calls.welcome.length === 0 && calls.magic.length === 0, 'an email call went out for a bad address');
  });

  await w.step('lead form sends, report appears', async () => {
    await w.fill('#app input[type="email"]', `  ${EMAIL} `);
    await w.click('Send my report →');
    await w.see('Compiling intelligence');
    await w.see('Brand Signal Report', { timeout: 9000 });
    await w.gone('Compiling intelligence');
  });

  await w.step('the two calls carry the scan, in English, with the language header', async () => {
    w.check(calls.welcome.length === 1, `${calls.welcome.length} welcome email call(s), expected one`);
    w.check(calls.magic.length === 1, `${calls.magic.length} magic link call(s), expected one`);
    const sent = (calls.welcome[0] || {}).body || {};
    const scan = sent.signalScanResult || {};
    w.check(sent.email === EMAIL, `welcome email went to ${JSON.stringify(sent.email)}`);
    w.check(scan.score === 69 && scan.grade === 'B', `score sent as ${scan.score} ${scan.grade}, expected 69 B`);
    w.check(scan.verdict === 'Clear Gaps' && scan.topGap === 'Visual Coherence', `verdict and gap sent as ${scan.verdict} / ${scan.topGap}: stored values must stay English`);
    w.check(scan.moment === 'doubt' && scan.describe === PROBLEM, 'the first and last answers did not reach the payload');
    w.check((calls.welcome[0] || {}).lang === w.lang, `welcome email asked for language ${(calls.welcome[0] || {}).lang}`);
    const link = (calls.magic[0] || {}).body || {};
    w.check(link.email === EMAIL && link.sourceTool === 'signal-scan', `magic link body is ${JSON.stringify(link)}`);
    w.check((calls.magic[0] || {}).lang === w.lang, `magic link asked for language ${(calls.magic[0] || {}).lang}`);
    w.check(await p.evaluate(() => localStorage.getItem('qb_post_auth_return_to')) === '/foundation', 'the return path after sign-in was not stored');
  });

  await w.step('report: score, band, six dimensions, weakest one named', async () => {
    const ring = await p.locator('#app svg text').allTextContents();
    w.check(ring[0] === '69' && ring[1] === '/100', `score ring reads ${ring.join(' ')}`);
    await w.see('Clear Gaps');
    await sees('The bones are right but key elements are misaligned. Targeted work produces rapid improvement.');
    await w.see('Dimension breakdown');
    w.check(await p.locator('#app .gap-bar-bg').count() === 6, 'the breakdown does not show six dimensions');
    for (const d of ['Identity Clarity', 'Voice Consistency', 'Market Positioning', 'Content Performance', 'Brand Authority']) await w.see(d);
    await w.see('Visual Coherence ← primary gap');
    const shown = await p.evaluate(() => [...document.querySelectorAll('#app .gap-bar-bg')].map(b => parseInt(b.previousElementSibling.lastElementChild.textContent, 10)));
    w.check(JSON.stringify(shown) === JSON.stringify(SCORES), `dimension scores read ${shown.join(', ')}`);
    await sees('Structural gap: Visual Coherence');
    await sees('Visual incoherence signals a lack of conviction. Clients read uncertainty in design before they read your words.');
    await sees('Your sign-in link is on the way. Check your inbox.');
    await sees('Open it in this browser and you land in BrandOS, signed in. The link works for 60 minutes.');
    const report = await appText();
    w.check(!/results on the way|follows you into|every phase|content, and execution/i.test(report), 'the report still makes a promise the page does not keep');
  });

  await w.step('first move and the way into BrandOS', async () => {
    await w.see('Recommended first move');
    await w.see('Logo Evaluation');
    await sees('The visual system is your primary gap. Audit it against identity standards first. Opens with Starter.');
    // The two buttons open a new tab. The walk records where, and stays here.
    await p.evaluate(() => { window.__opened = []; window.open = url => { window.__opened.push(String(url)); return null; }; });
    await w.click('Open Logo Evaluation →');
    await w.click('Explore BrandOS →');
    calls.opened = await p.evaluate(() => window.__opened);
    w.check(calls.opened[0] === 'logo-evaluation-agent.html', `first move opened ${calls.opened[0]}`);
    w.check(calls.opened[1] === '/login?reason=signin&return_to=%2Ffoundation&email=' + encodeURIComponent(EMAIL), `Explore BrandOS opened ${calls.opened[1]}`);
  });

  await w.step('every first move names a tool the visitor can reach, and says when it is paid', async () => {
    const moves = await p.evaluate(() => {
      const out = [];
      for (const moment of ['blank', 'doubt', 'scale', 'pivot']) for (const d of DIMENSIONS) {
        const move = getRecommendedPath(moment, d);
        out.push({ tool: move.tool, desc: move.desc });
      }
      return out;
    });
    const paid = ['Logo Evaluation', 'War Table'];
    for (const m of moves) {
      const says = /Opens with Starter\.$/.test(m.desc);
      w.check(paid.includes(m.tool) === says, `${m.tool}: "${m.desc}" ${says ? 'says Starter but the tool is free' : 'does not say it opens with Starter'}`);
      w.check(await w.say(m.desc) !== m.desc || w.lang === 'en', `no French for: ${m.desc}`);
    }
  });

  await w.step('run another scan', async () => {
    await w.click('Run another scan');
    await w.see('Start the scan →');
    await w.click('Start the scan →');
    await w.see('Step 1 of 8');
    w.check(await p.locator('#app button.option-btn.selected').count() === 0, 'a new scan kept an old answer');
  });
}
