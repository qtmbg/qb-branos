// Atelier: the one door with no price. A page to read, and one action:
// write to Nizzar.
import { pageText, noRetiredWords } from './_app/fixtures.mjs';

export const page = 'atelier.html';
export const title = 'the offer as written, no price, the two ways to write';

export async function walk(w) {
  await w.step('open: what Atelier is', async () => {
    await w.open();
    await w.see("Some work doesn't fit in a tier.");
    await w.see('Atelier is Quantum Branding delivered as a relationship, not a product. Scope, depth, and terms get shaped per engagement, after a mutual decision to work together.');
    await w.see('Atelier is one engagement at a time, run with me personally. The Collapse, the method behind BrandOS, at a different resolution than self-serve.');
  });

  await w.step('how it works, and who answers', async () => {
    await w.see("You write. Tell me what you're working on and what you would want this to be.");
    await w.see('If we move forward, scope, format, and investment get shaped together. The terms come from the work.');
    await w.see('I read every email. I reply within 72 hours.');
  });

  await w.step('no price, no plan that is not sold, no retired vocabulary', async () => {
    const text = await pageText(w);
    w.check(!/[$€]\s?\d|\d\s?[$€]/.test(text), 'the page states a price: working with Nizzar never carries one');
    w.check(!/\bPro\b|\bAgency\b|\bStudio\b/.test(text), 'the page names a plan that is not sold');
    await noRetiredWords(w, 'atelier');
  });

  await w.step('the hero button goes to the writing section', async () => {
    await w.page.locator('.at-hero_cta a').click();
    await w.page.waitForFunction(() => location.hash === '#write-to-me', null, { timeout: 4000 });
    await w.see("Tell me what you're working on.");
    w.check(await w.page.locator('#write-to-me').evaluate(el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'the writing section is not in view after the click');
  });

  await w.step('the writing button opens an email to Nizzar', async () => {
    const href = await w.page.locator('#write-to-me a.qb-button').getAttribute('href');
    w.check(/^mailto:me@qtmbg\.com\?/.test(href || ''), `the button does not write to me@qtmbg.com: ${href}`);
    w.check(/subject=Atelier/.test(href || ''), `the email has no subject: ${href}`);
  });

  await w.step('the way to try the method first', async () => {
    const link = w.page.locator('.at-prose_body a', { hasText: 'Signal Scan' });
    w.check(await link.count() === 1, 'the Signal Scan link is missing');
    w.check((await link.getAttribute('href')) === '/scan', 'the Signal Scan link does not point at /scan');
    await w.see(". It's free. It uses the same methodology at a fraction of the depth.");
  });

  await w.step('the footer names the practice and links to it', async () => {
    await w.see('BrandOS is a product of');
    const practice = w.page.locator('.footer_endorse a');
    w.check((await practice.getAttribute('href')) === 'https://thequantumbranding.com', 'the practice is not linked to thequantumbranding.com');
  });
}
