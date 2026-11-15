// Sensescape, print view: the sheet empty, then filled from what the
// exercise writes to the profile, with its cover, its colophon and print.
export const page = 'sensescape-pdf.html';
export const title = 'empty and filled sheet, cover and colophon, print on a light ground';
export const timeout = 90;

const BRAND = 'Maison Levain';
// The fields Sensescape saves, with what the founder answered.
const PROFILE = {
  brandName: BRAND,
  brandObject: 'A linen-bound notebook.',
  brandMoment: 'The hour before opening.',
  colorTerritory: 'Storm blue over warm stone.',
  forbiddenColor: 'Anything fluorescent.',
  typographyNote: 'A serif with weight.',
  antiVoice: 'Slogans in capitals.',
  soundSignature: 'Rain on a tin roof.',
  signatureGesture: 'Folding the page.',
  visualTerritoryNote: 'Matte surfaces, long shadows.',
  paradox: 'Slow hands, sharp edges.',
};

export async function walk(w) {
  const p = w.page;
  Object.values(PROFILE).forEach(v => w.note(v));
  const pageText = () => p.evaluate(() => document.body.innerText);
  // The cover prints today's date, formatted by the page.
  const noteDate = async () => (await pageText()).split('\n').filter(l => /\b20\d\d\b/.test(l)).forEach(l => w.note(l));
  const colophon = async where => {
    await w.see('The Collapse');
    const text = await pageText();
    w.check(text.includes('Observe, Collapse, Build, Hold'), `${where}: the colophon does not carry the cycle`);
    w.check(!/Phase 0\d/i.test(text), `${where}: the sheet still names a phase`);
    w.check(/BrandOS/.test(text) && !/BRANDOS|Brand OS/.test(text), `${where}: the product name is recased`);
  };

  await w.step('nothing saved yet: the sheet says so, and still carries its cover', async () => {
    await p.addInitScript(() => { try { if (!sessionStorage.getItem('walk_seeded')) localStorage.removeItem('qb_qbp'); } catch (e) {} });
    await w.open();
    await noteDate();
    await w.see('Not filled yet');
    await w.see('This report fills from your Sensescape answers. None are saved on this device yet.');
    await colophon('empty sheet');
  });

  await w.step('filled from the profile: every answer Sensescape saved is on the sheet', async () => {
    await p.evaluate(v => { sessionStorage.setItem('walk_seeded', '1'); localStorage.setItem('qb_qbp', JSON.stringify(v)); }, PROFILE);
    await w.open();
    await noteDate();
    const text = await pageText();
    for (const [field, value] of Object.entries(PROFILE)) w.check(text.includes(value), `the sheet does not show ${field}: ${JSON.stringify(value)}`);
    w.check(!text.includes(await w.say('Not filled yet')), 'a filled sheet still says it is empty');
    for (const label of ['The brand object', 'The brand moment', 'Forbidden colour', 'Sound signature', 'Signature gesture', 'The Paradox']) await w.see(label);
    await colophon('filled sheet');
  });

  await w.step('print: the button asks the browser, and the paper is light', async () => {
    await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await p.locator('.print-btn').first().click();
    w.check(await p.evaluate(() => window.__printed) === 1, 'Save as PDF did not call the browser');
    await p.emulateMedia({ media: 'print' });
    await p.waitForTimeout(300);
    w.check(!(await p.locator('.print-btn').first().isVisible()), 'the button would be printed');
    const ground = await p.evaluate(() => {
      const doc = document.querySelector('.doc') || document.body;
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(doc).backgroundColor);
      return m ? (+m[1] + +m[2] + +m[3]) / 3 : 255;
    });
    w.check(ground > 200, `the sheet would print on a dark ground (${Math.round(ground)})`);
    await p.emulateMedia({ media: 'screen' });
  });
}
