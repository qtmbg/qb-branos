// The agent console: the agents by movement, Hold said plainly, a rerun
// and its failure, a first run, refining with feedback, the run history
// and a replay, a free account, and the console when the server fails.
import {
  signIn, answer, supabaseClientStub, noteAll, noRetiredWords, pageText, json,
  profile, QBP, NOTIFICATIONS, consolePayload, REPLAY, OPERATOR_ONLY_NAMES, USER, ago, DAY, uid,
} from './_app/fixtures.mjs';

export const page = 'agents.html';
export const title = 'movements, Hold not open, rerun, first run, refine, run history, replay, free account, error';
export const session = true;
export const timeout = 300;

export async function walk(w) {
  await signIn(w, { tier: 'starter' });
  await supabaseClientStub(w);
  await answer(w, /\/api\/qbp(\?|$)/, profile({ tier: 'starter', qbp: QBP.full, lockedAt: ago(2 * DAY) }));
  await answer(w, /\/api\/notifications(\?|$)/, NOTIFICATIONS);
  const payload = consolePayload({ tier: 'starter' });
  noteAll(w, [payload.agents.map(a => [a.display_name, a.description]), REPLAY, USER.firstName]);
  const consoleApi = await answer(w, /\/api\/agents\/console/, payload);

  // Dialogs are answered by the runner. The walk keeps what they said, and
  // in French it requires that they were said in French.
  const said = [];
  w.page.on('dialog', d => said.push(d.message()));
  const inThisLanguage = async english => {
    const t = await w.say(english);
    if (w.lang !== 'en') w.check(t !== english, `no French for the dialog ${JSON.stringify(english)}`);
    return t;
  };
  // A row is found by the agent's name as painted, which French may translate.
  const card = name => ({ async loc() { return w.page.locator('.agent-row').filter({ hasText: await w.say(name) }).first(); } });
  const within = async name => (await card(name).loc());

  await w.step('the agents, by movement, and nothing that is not public', async () => {
    await w.open();
    await w.see('Your workforce');
    for (const heading of ['The foundation', 'The Build agents', 'The Hold tools']) await w.see(heading);
    const text = await pageText(w);
    for (const name of OPERATOR_ONLY_NAMES) w.check(!text.includes(name), `the console paints the operator-only agent ${name}`);
    w.check(/BrandOS/.test(text) && !/BRANDOS/.test(text), 'the product name is recased in the console header');
    await noRetiredWords(w, 'console');
  });

  await w.step('Hold: three tools, each says it is not open yet, none can be run', async () => {
    const notOpen = await w.say('Not open yet');
    const labels = (await w.page.locator('body *').filter({ hasText: new RegExp(`^${notOpen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).allInnerTexts()).filter(t => t.trim().toLowerCase() === notOpen.toLowerCase());
    w.check(labels.length >= 3, `${labels.length} tool(s) say "Not open yet"; Hold has three`);
    for (const hold of ['Brand Performance Dashboard', 'Quarterly Brand Review', 'Predictive Panel']) {
      const buttons = await (await within(hold)).locator('button').count().catch(() => 0);
      w.check(buttons === 0, `${hold} offers a button although Hold is not open`);
    }
  });

  await w.step('rerun with the current profile: asked first, then sent for the right artifact', async () => {
    const rerun = await answer(w, /\/api\/agents\/rerun/, { __status: 202, ok: true, dispatch_id: 'd-1' });
    said.length = 0;
    await (await within('Soul Map Synthesizer')).getByText(await w.say('Rerun · current QBP'), { exact: true }).click({ timeout: 6000 });
    await w.page.waitForLoadState('domcontentloaded');
    await w.page.waitForTimeout(600);
    w.check(said[0] === await inThisLanguage('Rerun Soul Map Synthesizer with your current QBP?'), `the question was ${JSON.stringify(said[0])}`);
    const sent = JSON.parse(rerun.calls[0]?.body || '{}');
    w.check(sent.artifact_id === uid(1) && sent.qbp_source === 'current', `the rerun sent ${JSON.stringify(sent)}`);
  });

  await w.step('a rerun the server refuses: the reason is said', async () => {
    await answer(w, /\/api\/agents\/rerun/, { __status: 409, error: 'already_running' });
    said.length = 0;
    await (await within('Soul Map Synthesizer')).getByText(await w.say('Rerun · original QBP'), { exact: true }).click({ timeout: 6000 });
    await w.page.waitForTimeout(500);
    w.check(said[0] === await inThisLanguage('Rerun Soul Map Synthesizer with the original QBP snapshot?'), `the question was ${JSON.stringify(said[0])}`);
    w.check(typeof said[1] === 'string' && said[1].includes('already_running'), `the refusal was ${JSON.stringify(said[1])}`);
    if (w.lang !== 'en') w.check(!/^Rerun failed/.test(said[1] || ''), 'the refusal was said in English');
  });

  await w.step('a first run of a Build agent: sent, and the card says it is producing', async () => {
    const dispatch = await answer(w, /\/api\/agents\/dispatch/, { __status: 202, ok: true, dispatch_id: 'd-2' });
    // After the run is accepted the console asks the server again, so the
    // server's next answer has this agent in flight too.
    const inFlight = consolePayload({ tier: 'starter' });
    inFlight.agents.find(a => a.slug === 'logo_direction_agent').inflight_dispatch_id = 'd-2';
    consoleApi.set(inFlight);
    // "Run" is one short word with a scoped French entry, so the button is
    // found by where it sits, not by what it says.
    await (await within('Logo Direction Agent')).locator('.agent-first-run button, .agent-row_ctas button').first().click({ timeout: 6000 });
    await w.page.waitForTimeout(700);
    const sent = JSON.parse(dispatch.calls[0]?.body || '{}');
    w.check(sent.agent_slug === 'logo_direction_agent', `the first run sent ${JSON.stringify(sent)}`);
    const producing = await w.say('Producing…');
    w.check((await (await within('Logo Direction Agent')).innerText()).includes(producing), 'the card did not turn to producing');
  });

  await w.step('refine with feedback: the founder\'s words go with the rerun', async () => {
    const rerun = await answer(w, /\/api\/agents\/rerun/, { __status: 202, ok: true, dispatch_id: 'd-3' });
    consoleApi.set(payload);
    await w.open();
    const c = await within('Sensescape Synthesizer');
    await c.getByText(await w.say('Refine with feedback'), { exact: true }).click({ timeout: 6000 });
    const box = c.locator('textarea').first();
    w.check(await box.getAttribute('placeholder') === await w.say('What should change? Be specific. The agent applies this concretely.'), 'the feedback box has the wrong prompt');
    await w.fill(box, 'Less about scent. More about what the hands feel.');
    await c.locator('button').filter({ hasText: await w.say('Refine') }).last().click({ timeout: 6000 });
    await w.page.waitForTimeout(500);
    const sent = JSON.parse(rerun.calls[0]?.body || '{}');
    w.check(sent.feedback === 'Less about scent. More about what the hands feel.' && sent.artifact_id === uid(2), `the refine sent ${JSON.stringify(sent)}`);
  });

  await w.step('run history, and one run replayed', async () => {
    await w.open();
    await w.mock(/\/api\/agent-runs\/[^/]+\/replay/, route => json(route, REPLAY));
    await w.click('Run history');
    const rows = await w.page.locator('.run-list .run-row').count();
    w.check(rows === 3, `the history shows ${rows} run(s), the server sent 3`);
    await w.page.locator('.run-list .run-row').first().click({ timeout: 6000 });
    await w.see('Frozen inputs', { timeout: 6000 });
    await noRetiredWords(w, 'console, replay');
    await w.page.keyboard.press('Escape');
  });

  await w.step('a free account: the Starter agents say what opens them', async () => {
    consoleApi.set(consolePayload({ tier: 'free' }));
    await w.open();
    const opens = await w.say('Opens with Starter');
    const text = await pageText(w);
    w.check(text.toLowerCase().includes(opens.toLowerCase()), 'a free account is not told that the Build agents open with Starter');
    await w.see('Upgrade to run');
    await noRetiredWords(w, 'console, free');
  });

  await w.step('the foundation is not locked: the console says what to do first', async () => {
    consoleApi.set(consolePayload({ tier: 'starter', locked: false }));
    await w.open();
    await w.see('Lock your foundation to see your agents at work.');
    await w.see('Go to foundation');
  });

  await w.step('the server fails: the console says so and offers to reload', async () => {
    consoleApi.set({ __status: 500, error: 'down' });
    await w.open();
    await w.see('Something went wrong.');
    await w.see('Reload');
  });
}
