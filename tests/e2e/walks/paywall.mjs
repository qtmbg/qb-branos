// The paywall: one plan, the right sentence for each reason a founder is
// sent here, Hold said plainly, and checkout when it opens and when it fails.
import {
  signIn, answer, supabaseClientStub, noRetiredWords, pageText, json,
  profile, QBP, NOTIFICATIONS,
} from './_app/fixtures.mjs';

export const page = 'paywall.html';
export const title = 'every reason, one plan at $97, Hold not open, checkout and its failures';
export const session = true;

// reason in the address → the headline and the sentence under it
const REASONS = [
  ['', 'Open the rest of your foundation.', 'The Visual DNA and War Table exercises, the Sensescape, Visual DNA and War Table readings, the three Build agents and the full QBP export. All on Starter.'],
  ['reason=artifact', 'This artifact opens with Starter.', 'Upgrade to read it.'],
  ['reason=artifact&agent=sensescape_synthesizer', null, null],
  ['reason=qbp_export', 'Export your QBP.', 'With Starter, your Quantum Brand Profile downloads as a file.'],
  ['reason=qbp_section', 'Two sections of your QBP open with Starter.', 'Visual Language and Strategic Position fill from the Visual DNA and War Table exercises. All of it opens with Starter.'],
  ['reason=exercise', 'This exercise opens with Starter.', 'Visual DNA and War Table are part of Starter. Archetype Compass, Brand Soul Map and Sensescape stay free.'],
  ['reason=upgrade&tool=visual-dna', 'Visual DNA opens with Starter.', 'The Visual DNA exercise and its reading are part of Starter. Archetype Compass, Brand Soul Map and Sensescape stay free.'],
  ['reason=upgrade&tool=war-table', 'War Table opens with Starter.', 'The War Table exercise and its reading are part of Starter. Archetype Compass, Brand Soul Map and Sensescape stay free.'],
  ['reason=upgrade&tool=voice-guide', 'Build opens with Starter.', 'The Build agents work from your foundation. Starter opens them.'],
  ['reason=phase_05', 'Hold is not open yet.', 'No plan opens Hold. Starter opens the rest of your foundation and the Build agents.'],
  ['reason=upgrade&tool=panel', 'Hold is not open yet.', 'No plan opens Hold. Starter opens the rest of your foundation and the Build agents.'],
  ['cancelled=1', 'Checkout cancelled.', 'No charge was made. Pick up where you left off.'],
];

export async function walk(w) {
  await signIn(w);
  await supabaseClientStub(w);
  const qbp = await answer(w, /\/api\/qbp(\?|$)/, profile());
  await answer(w, /\/api\/notifications(\?|$)/, NOTIFICATIONS);

  await w.step('each reason gets its own headline and sentence', async () => {
    for (const [query, headline, body] of REASONS) {
      await w.open(query);
      if (headline) {
        await w.see(headline);
        await w.see(body);
      } else {
        // A named reading: the headline names it, in whichever language.
        const h = (await w.page.locator('.qb-paywall__headline').innerText()).trim();
        w.check(h.length > 0 && h !== (await w.say('This artifact opens with Starter.')), `a named reading fell back to the generic headline (${query})`);
      }
      await noRetiredWords(w, `paywall ${query || '(no reason)'}`);
    }
  });

  await w.step('one plan, one price, what it adds, and the guarantees', async () => {
    await w.open();
    const text = await pageText(w);
    w.check((text.match(/\$\s?97|97\s?\$/g) || []).length >= 1, 'the price is not on the page');
    w.check(!/\$\s?(79|247|1[,.]?497)\b/.test(text), 'a price that is not sold is on the page');
    for (const line of [
      'The Visual DNA and War Table exercises',
      'The three other foundation readings (Sensescape, Visual DNA, War Table)',
      'The three Build agents (Logo Direction, Logo Evaluation, Voice Guide)',
      'Full QBP export',
      'Cancel anytime',
      'Full refund within 14 days',
      'Secure checkout via Stripe',
    ]) await w.see(line);
    await w.see('Upgrade to Starter');
  });

  await w.step('checkout fails: the reason is shown and the button comes back', async () => {
    const checkout = await answer(w, /\/api\/stripe\/checkout/, { __status: 500 });
    await w.click('Upgrade to Starter', { role: 'button' }).catch(() => w.click('Upgrade to Starter'));
    await w.see('Checkout failed (HTTP 500). Try again.', { timeout: 6000 });
    await w.see('Upgrade to Starter');
    const sent = JSON.parse(checkout.calls[0].body || '{}');
    w.check(sent.price_id === 'price_1Th8JkEHEAcWrG55Abr1OZXe', `checkout was asked for ${sent.price_id}, not the Starter price`);
  });

  await w.step('checkout opens: the browser goes to the address Stripe gave', async () => {
    const origin = new URL(w.page.url()).origin;
    await w.mock(/\/api\/stripe\/checkout/, route => json(route, { checkout_url: `${origin}/404.html?from=stripe` }));
    await w.open();
    await w.click('Upgrade to Starter', { role: 'button' }).catch(() => w.click('Upgrade to Starter'));
    await w.page.waitForURL(u => u.searchParams.get('from') === 'stripe', { timeout: 8000 });
  });

  await w.step('already on Starter: the plan says so and cannot be bought twice', async () => {
    qbp.set(profile({ tier: 'starter', qbp: QBP.full }));
    await w.open();
    await w.see('Current plan');
    // Asked of the buttons, not of the words: in French the eyebrow and the
    // button share their wording.
    const upgrade = await w.say('Upgrade to Starter');
    const buttons = (await w.page.locator('button, a.qb-button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    w.check(!buttons.includes(upgrade), 'a Starter account is offered Starter again');
  });
}
