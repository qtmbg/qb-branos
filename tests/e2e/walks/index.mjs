// Home page: the switch changes language and colours in place, and back.
export const page = 'index.html';
export const title = 'language switch, live, both directions';
export const switchesLanguage = true;

export async function walk(w) {
  const other = w.lang === 'en' ? 'fr' : 'en';
  const headline = { en: 'Idea in,', fr: 'Une idée entre,' };
  const ground = () => w.page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await w.step('open', async () => {
    await w.open();
    await w.see('Idea in,');
    await w.see('Start free', { within: '.hero, main' });
  });

  await w.step('switch to the other language', async () => {
    const before = await ground();
    await w.page.locator(`.nav-actions .qb-lang_opt[data-lang-set="${other}"]`).click();
    await w.see(headline[other], { painted: true });
    await w.page.waitForTimeout(700);
    w.check(await w.page.evaluate(() => document.documentElement.lang) === other, `<html lang> did not become ${other}`);
    w.check(await ground() !== before, 'the colour pair did not reverse');
  });

  await w.step('switch back', async () => {
    await w.page.locator(`.nav-actions .qb-lang_opt[data-lang-set="${w.lang}"]`).click();
    await w.see(headline[w.lang], { painted: true });
    await w.page.waitForTimeout(700);
    w.check(await w.page.evaluate(() => document.querySelectorAll('[data-qb-fix]').length) === 0 || w.lang === 'fr', 'colour patches were left behind in English');
  });

  await w.step('the choice is remembered', async () => {
    w.check(await w.page.evaluate(() => localStorage.getItem('qb_lang')) === w.lang, 'qb_lang was not saved');
  });
}
