// Home page on a phone: the menu button is on screen, the menu opens,
// and it carries the switch and both actions.
export const page = 'index.html';
export const title = 'phone width: menu button reachable, menu opens and closes';
export const width = 390;

export async function walk(w) {
  await w.step('open', async () => {
    await w.open();
    await w.see('Idea in,');
  });

  await w.step('the menu button is inside the screen and the pill', async () => {
    const r = await w.page.evaluate(() => {
      const h = document.querySelector('#hamburger').getBoundingClientRect();
      const n = document.querySelector('.nav-wrap .nav').getBoundingClientRect();
      return { right: h.right, navRight: n.right, vw: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    w.check(r.right <= r.vw, `menu button ends at ${Math.round(r.right)}px on a ${r.vw}px screen`);
    w.check(r.right <= r.navRight + 1, `menu button ends at ${Math.round(r.right)}px, outside the pill (${Math.round(r.navRight)}px)`);
    w.check(r.overflow <= 1, `the page scrolls sideways by ${r.overflow}px`);
  });

  await w.step('the switch floats, out of the pill', async () => {
    const shown = await w.page.evaluate(() => {
      const vis = el => !!el && getComputedStyle(el).display !== 'none';
      return { inPill: vis(document.querySelector('.nav-actions .qb-lang')), floating: vis(document.querySelector('.qb-lang.is-floating')) };
    });
    w.check(!shown.inPill, 'the switch is still inside the pill on a phone');
    w.check(shown.floating, 'the floating switch is not shown on a phone');
  });

  await w.step('open the menu', async () => {
    await w.page.click('#hamburger');
    await w.see('Start free', { within: '.mobile-menu_foot' });
    await w.see('Sign in', { within: '.mobile-menu_foot' });
    await w.see('Pricing', { within: '.mobile-menu_list' });
    w.check(await w.page.locator('.mobile-menu_foot .qb-lang').isVisible(), 'the menu does not carry the language switch');
  });

  await w.step('close the menu', async () => {
    await w.page.click('#mobileMenuClose');
    await w.page.waitForFunction(() => document.querySelector('#mobileMenu').dataset.open !== 'true', null, { timeout: 4000 });
  });
}
