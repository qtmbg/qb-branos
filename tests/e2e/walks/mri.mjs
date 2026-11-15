// Brand MRI : de la page d'accueil au score, puis chaque palier payant.
//
// La page est écrite en français, donc ce parcours aussi. En anglais, le
// harnais traduit ce que le parcours cherche (js/i18n/en/mri.js).
//
// Rien ne sort de la machine : le lead (/api/mri-lead) et le lien magique
// (/api/send-magic-link) reçoivent une réponse locale, et les boutons de
// paiement sont lus au moment où la page s'apprête à partir vers Stripe,
// sans y aller.
//
// Les réponses sont fixes pour que le résultat se vérifie au point près
// (js/mri.js) : chaque pilier est la moyenne de ses deux questions, sur 100.
//   La phrase 85 · Le test du logo 70 · Cohérence 30 · Différenciation 85 · Preuve 15
//   Score global 57. Tensions, de la plus faible : Preuve, Cohérence, Le test du logo.
import fs from 'node:fs';

export const page = 'mri.html';
export const title = 'score gratuit, lead, paliers Flash, complet, review, re-test, export';
export const timeout = 120;

const MARQUE = 'Atelier Lumen';
const SITE = 'https://atelier-lumen.example';
const EMAIL = 'fondatrice@example.com';
const CIBLE = 'dirigeants de studios';
const PHRASE = 'Nous faisons des sites pour les studios.';
const QUESTIONS_REVIEW = 'La preuve doit-elle passer avant la promesse ? Faut-il un cas client nommé ?';

// Indice de l'option choisie par question : 0 Non, 1 Plutôt non, 2 Plutôt oui, 3 Oui, clairement.
const REPONSES = [3, 2, 2, 2, 1, 1, 2, 3, 0, 1];
const SCORE = 57;
const PILIERS = [
  { nom: 'La phrase',        court: 'Positionnement en une phrase',               score: 85, niveau: 'solide', conseil: 'Garder cette phrase intacte. Ne pas la diluer avec des variantes par canal.' },
  { nom: 'Le test du logo',  court: 'Reconnaissable sans logo',                   score: 70, niveau: 'solide', conseil: 'Protéger cette identité. Tout nouveau support doit passer le test sans logo.' },
  { nom: 'Cohérence',        court: 'Même promesse partout',                      score: 30, niveau: 'faible', conseil: 'Aligner site, réseaux et documents sur une seule promesse écrite. Corriger les contradictions en premier.' },
  { nom: 'Différenciation',  court: 'Ce que les concurrents ne peuvent pas dire', score: 85, niveau: 'solide', conseil: 'Rendre la différence plus difficile à copier : un actif, une méthode, une preuve propre à vous.' },
  { nom: 'Preuve',           court: 'Ce qui prouve la promesse',                  score: 15, niveau: 'faible', conseil: 'Ajouter 3 preuves précises sur la page d’accueil : un cas client, un chiffre, un témoignage nommé.' },
];
const TENSIONS = [PILIERS[4], PILIERS[2], PILIERS[1]];
const OPTIONS = ['Non', 'Plutôt non', 'Plutôt oui', 'Oui, clairement'];
const PREMIERE_QUESTION = '1. [La phrase] Un visiteur comprend-il en 5 secondes ce que vous vendez, à qui, et pourquoi vous ?';
const DERNIERE_QUESTION = '10. [Preuve] Ces preuves sont-elles précises et vérifiables, ou vagues et génériques ?';

// Les liens de paiement, tels que js/mri-app.js les porte.
const STRIPE = {
  flash:     'https://buy.stripe.com/4gM4gz8PY4uWfpD9xY2Ry04',
  full:      'https://buy.stripe.com/8x28wP9U29Pg7XbcKa2Ry05',
  upgrade60: 'https://buy.stripe.com/cNi14n3vEaTk4KZ5hI2Ry06',
  review211: 'https://buy.stripe.com/28E6oHeaigdE1yNh0q2Ry07',
  retest39:  'https://buy.stripe.com/fZu3cv9U28Lc3GV9xY2Ry09',
};

export async function walk(w) {
  const p = w.page;
  // Une cible absente échoue en quelques secondes, jamais au bout d'un délai par défaut.
  const T = 4000;
  p.setDefaultTimeout(T);
  p.setDefaultNavigationTimeout(8000);
  const flat = s => String(s).replace(/\s+/g, ' ').trim();
  const dit = async ecrit => flat(await w.say(ecrit));
  const texte = async sel => flat(await p.locator(sel).first().textContent());
  // w.see compare par XPath, dont normalize-space laisse l'espace insécable
  // que le français place avant : ; ? et $. Ici elle est repliée des deux côtés.
  const montre = async (ecrit, dans = 'main') => {
    const attendu = await dit(ecrit);
    await p.waitForFunction(([sel, t]) => {
      const racine = document.querySelector(sel);
      if (!racine) return false;
      const tw = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (n.data.replace(/\s+/g, ' ').trim() === t && n.parentElement && n.parentElement.getClientRects().length) return true;
      }
      return false;
    }, [dans, attendu], { timeout: T }).catch(() => { throw new Error(`absent de l'écran : ${JSON.stringify(attendu)}`); });
  };
  const cache = sel => p.evaluate(s => document.querySelector(s).classList.contains('hidden'), sel);

  const leads = [], liens = [], alertes = [];
  await w.mock('**/api/mri-lead', async route => {
    leads.push({ corps: JSON.parse(route.request().postData() || '{}'), langue: route.request().headers()['x-qb-lang'] });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await w.mock('**/api/send-magic-link', async route => {
    liens.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  // Filet : si un départ vers Stripe n'était pas retenu, il n'atteindrait pas Stripe.
  await w.mock(/buy\.stripe\.com/, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stripe</title>' }));
  p.on('dialog', d => alertes.push(flat(d.message())));

  // L'adresse vers laquelle la page s'apprête à partir, sans y aller.
  const partVers = async action => {
    await p.evaluate(() => {
      window.__depart = null;
      window.navigation.addEventListener('navigate', e => { window.__depart = e.destination.url; e.preventDefault(); }, { once: true });
    });
    await action();
    await p.waitForFunction(() => window.__depart !== null, null, { timeout: T });
    return p.evaluate(() => window.__depart);
  };

  // Du bouton d'accueil au résultat, avec les réponses fixes.
  const diagnostiquer = async ({ precedent } = {}) => {
    await p.locator('#startBtn').click();
    await w.fill('#brand', MARQUE);
    await w.fill('#website', SITE);
    await w.fill('#email', EMAIL);
    await w.fill('#currentPhrase', PHRASE);
    await w.fill('#target', CIBLE);
    if (precedent != null) await w.fill('#prevScore', String(precedent));
    for (let q = 0; q < REPONSES.length; q++) await p.locator(`input[name="q${q}"]`).nth(REPONSES[q]).check();
    await p.locator('#resultBtn').click();
    await p.waitForFunction(() => !document.getElementById('result').classList.contains('hidden'), null, { timeout: T });
    w.check(await texte('#globalScore') === String(SCORE), `le score affiché est ${await texte('#globalScore')}, attendu ${SCORE}`);
    await montre(`Votre frein principal : ${TENSIONS[0].nom}. Le détail et le plan sont dans les paliers payants.`, '#result');
  };
  const leadRecu = async n => {
    const debut = Date.now();
    while (leads.length < n && Date.now() - debut < T) await p.waitForTimeout(50);
    w.check(leads.length === n, `${leads.length} lead(s) reçu(s) par /api/mri-lead, attendu ${n}`);
  };

  await w.step('accueil : la promesse et les prix, tels que le code les compte', async () => {
    await w.open();
    await montre('Ce que votre marque dit en réalité, en 5 minutes.');
    for (const ligne of ['Gratuit :', '19 $ :', '79 $ :', '290 $ au total :']) await montre(ligne, '#landing');
    await montre('MRI Flash, vos 3 tensions + 1 chantier.', '#landing');
    await montre('rapport complet, 5 piliers + phrase + 3 chantiers + plan 90 jours.', '#landing');
    const t = await p.evaluate(() => ({
      flash: window.TIERS.totalPaid('flash'), full: window.TIERS.totalPaid('full'), review: window.TIERS.totalPaid('review'),
      pas: ['free', 'flash', 'full'].map(x => window.TIERS.nextOffer(x).price), fin: window.TIERS.nextOffer('review'),
      piliers: window.MRI.PILLARS.length, questions: window.MRI.QUESTIONS.length,
    }));
    w.check(t.flash === 19 && t.full === 79 && t.review === 290, `les totaux du code sont ${t.flash}, ${t.full}, ${t.review} ; la page annonce 19, 79 et 290`);
    w.check(t.pas[0] === t.flash && t.flash + t.pas[1] === t.full && t.full + t.pas[2] === t.review, `les compléments ${t.pas.join(', ')} ne mènent pas aux totaux annoncés`);
    w.check(t.fin === null, 'un palier existe au-delà de la review');
    w.check(t.piliers === 5 && t.questions === 10, `le code porte ${t.piliers} piliers et ${t.questions} questions ; la page annonce 5 et 10`);
    w.check(await cache('#retestNote'), 'la note de re-test est visible hors re-test');
    w.check(await cache('#form') && await cache('#result'), 'le formulaire ou le résultat est visible dès l’accueil');
  });

  await w.step('formulaire : dix questions, quatre réponses chacune, et ses deux garde-fous', async () => {
    await p.locator('#startBtn').click();
    w.check(await cache('#landing') && !(await cache('#form')), 'le formulaire ne s’est pas ouvert');
    await w.see('Votre marque', { timeout: T });
    await w.see('10 questions', { timeout: T });
    w.check(await p.locator('#questions fieldset').count() === 10, `${await p.locator('#questions fieldset').count()} questions affichées`);
    w.check(await texte('#questions fieldset:nth-of-type(1) legend') === await dit(PREMIERE_QUESTION), `première question : ${await texte('#questions fieldset:nth-of-type(1) legend')}`);
    w.check(await texte('#questions fieldset:nth-of-type(10) legend') === await dit(DERNIERE_QUESTION), `dernière question : ${await texte('#questions fieldset:nth-of-type(10) legend')}`);
    const options = (await p.locator('#questions fieldset:nth-of-type(1) label').allTextContents()).map(flat);
    const attendues = [];
    for (const o of OPTIONS) attendues.push(await dit(o));
    w.check(options.join('|') === attendues.join('|'), `les réponses proposées sont ${options.join(', ')}`);
    w.check(await cache('#prevScoreWrap'), 'le score précédent est demandé hors re-test');

    await p.locator('#resultBtn').click();
    w.check(alertes[alertes.length - 1] === await dit('Indiquez votre email pour voir le score gratuit.'), `sans email, l’alerte dit : ${alertes[alertes.length - 1]}`);
    await w.fill('#email', EMAIL);
    await p.locator('#resultBtn').click();
    w.check(alertes[alertes.length - 1] === await dit('Répondez aux 10 questions pour voir le résultat.'), `sans réponses, l’alerte dit : ${alertes[alertes.length - 1]}`);
    w.check(await cache('#result') && leads.length === 0, 'un résultat ou un lead est parti avant les dix réponses');
  });

  await w.step('score gratuit : le score, le frein, rien de plus, et le lead part', async () => {
    await w.open();
    await diagnostiquer();
    await w.see('Votre score gratuit', { timeout: T });
    await montre('Palier actuel : score gratuit.', '#result');
    w.check(await cache('#flashSection') && await cache('#fullSection') && await cache('#reviewSection'), 'un palier payant est visible sans paiement');
    w.check(await cache('#retestCompare'), 'une comparaison de re-test est affichée hors re-test');
    await leadRecu(1);
    const lead = leads[0] || { corps: {} };
    w.check(lead.corps.email === EMAIL && lead.corps.brand === MARQUE && lead.corps.website === SITE, `le lead porte ${JSON.stringify(lead.corps)}`);
    w.check(lead.corps.score === SCORE && lead.corps.tier === 'free', `le lead porte le score ${lead.corps.score} et le palier ${lead.corps.tier}`);
    // Une donnée ne change pas avec la langue : le frein part tel que le moteur le nomme.
    w.check(lead.corps.frein === TENSIONS[0].nom, `le lead nomme le frein ${JSON.stringify(lead.corps.frein)}`);
    w.check(lead.langue === w.lang, `le serveur a reçu la langue ${lead.langue}`);
    w.check(liens.length === 1 && liens[0].email === EMAIL && liens[0].sourceTool === 'brand-mri', `le lien magique a reçu ${JSON.stringify(liens)}`);

    await montre('MRI Flash · 19 $', '#offerBox');
    await montre('Le détail de vos tensions et votre premier chantier, livrés immédiatement.', '#offerBox');
    const boutons = (await p.locator('#offerBox button').allTextContents()).map(flat);
    w.check(boutons.length === 2 && boutons[0] === await dit('MRI Flash · 19 $ · Payer par Stripe') && boutons[1] === await dit('Rapport complet direct · 79 $ · Payer par Stripe'), `les boutons de paiement sont ${JSON.stringify(boutons)}`);
    w.check(await partVers(() => p.locator('#offerBox button').nth(0).click()) === STRIPE.flash, 'le bouton Flash ne mène pas au lien Flash');
    w.check(await partVers(() => p.locator('#offerBox button').nth(1).click()) === STRIPE.full, 'le bouton du rapport complet ne mène pas à son lien');
  });

  await w.step('palier Flash, au retour de Stripe : trois tensions et un chantier', async () => {
    await w.open('paid=flash');
    await montre('Paiement reçu, merci. Refaites le diagnostic, votre palier est déjà ouvert.');
    await diagnostiquer();
    await montre('Paiement reçu, merci. Palier actuel : Flash (19 $, total payé 19 $).', '#result');
    w.check(!(await cache('#flashSection')) && await cache('#fullSection') && await cache('#reviewSection'), 'le palier Flash ne montre pas exactement sa part');
    w.check(await p.locator('#tensions .card').count() === 3, `${await p.locator('#tensions .card').count()} tensions affichées`);
    for (let i = 0; i < TENSIONS.length; i++) {
      await montre(`${i + 1}. ${TENSIONS[i].nom} (${TENSIONS[i].score}/100)`, '#tensions');
      await montre(TENSIONS[i].conseil, '#tensions');
    }
    await montre(`Chantier 1 : ${TENSIONS[0].nom}`, '#chantier');
    await montre('Passer au rapport complet · 60 $ de plus (total 79 $)', '#offerBox');
    w.check(await p.locator('#offerBox button').count() === 1, 'le palier Flash propose autre chose que le complément de 60 $');
    w.check(await partVers(() => p.locator('#offerBox button').click()) === STRIPE.upgrade60, 'le complément de 60 $ ne mène pas à son lien');
    await leadRecu(2);
    w.check((leads[1] || { corps: {} }).corps.tier === 'flash', `le lead du palier Flash porte ${JSON.stringify((leads[1] || { corps: {} }).corps.tier)}`);
  });

  await w.step('rapport complet : cinq piliers, la phrase, le plan 90 jours', async () => {
    await w.open('paid=full');
    await diagnostiquer();
    await montre('Paiement reçu, merci. Palier actuel : Rapport complet (total payé 79 $).', '#result');
    w.check(!(await cache('#flashSection')) && !(await cache('#fullSection')) && await cache('#reviewSection'), 'le rapport complet ne montre pas exactement sa part');
    w.check(await p.locator('#pillarScores .card').count() === PILIERS.length, `${await p.locator('#pillarScores .card').count()} piliers affichés`);
    for (const pilier of PILIERS) {
      await montre(`${pilier.nom} : ${pilier.score}/100`, '#pillarScores');
      await montre(pilier.court, '#pillarScores');
      await montre(pilier.conseil, '#pillarScores');
    }
    const niveaux = await p.evaluate(() => [...document.querySelectorAll('#pillarScores .card')].map(c => c.querySelector('strong').nextSibling.data.replace(/\s+/g, ' ').trim()));
    for (let i = 0; i < PILIERS.length; i++) w.check(niveaux[i] === await dit(`(${PILIERS[i].niveau})`), `${PILIERS[i].nom} est classé ${niveaux[i]}`);
    const barres = await p.evaluate(() => [...document.querySelectorAll('#pillarScores .bar > div')].map(b => b.style.width));
    w.check(barres.join(',') === PILIERS.map(x => `${x.score}%`).join(','), `les barres mesurent ${barres.join(', ')}`);
    await montre(`Pour ${CIBLE}, ${MARQUE} est ce que vos concurrents ne peuvent pas dire, prouvé par vos preuves.`, '#fullSection');
    w.check(await texte('#currentPhraseOut') === PHRASE, `la phrase actuelle est rendue ${JSON.stringify(await texte('#currentPhraseOut'))}`);
    const plan = ['Jours 1 à 30', 'Jours 31 à 60', 'Jours 61 à 90'];
    w.check(await p.locator('#plan90 .card').count() === 3, `${await p.locator('#plan90 .card').count()} étapes au plan 90 jours`);
    for (let i = 0; i < plan.length; i++) await montre(`${plan[i]} : ${TENSIONS[i].nom}`, '#plan90');
    await p.evaluate(() => { window.__imprime = 0; window.print = () => { window.__imprime++; }; });
    await w.click('Imprimer / enregistrer le rapport', { timeout: T });
    w.check(await p.evaluate(() => window.__imprime) === 1, 'le bouton d’impression n’a pas imprimé');
    await montre('Ajouter la review vidéo · 211 $ de plus (total 290 $)', '#offerBox');
    w.check(await partVers(() => p.locator('#offerBox button').click()) === STRIPE.review211, 'le complément de 211 $ ne mène pas à son lien');
  });

  await w.step('review : la commande part par email, dans la langue de la page', async () => {
    await w.open('paid=review');
    await diagnostiquer();
    await montre('Paiement reçu, merci. Palier actuel : Rapport + review (total payé 290 $).', '#result');
    w.check(!(await cache('#reviewSection')), 'le formulaire de review est absent du palier review');
    await montre('Palier maximal atteint.', '#offerBox');
    w.check(await p.locator('#offerBox button').count() === 0, 'un paiement est encore proposé au dernier palier');
    await p.locator('#reviewSubmitBtn').click();
    w.check(alertes[alertes.length - 1] === await dit('Écrivez vos 2 ou 3 phrases pour la review, puis envoyez.'), `sans question, l’alerte dit : ${alertes[alertes.length - 1]}`);
    await w.fill('#reviewQuestions', QUESTIONS_REVIEW);
    const depart = await partVers(() => p.locator('#reviewSubmitBtn').click());
    const mail = new URL(depart);
    const sujet = flat(mail.searchParams.get('subject')), corps = (mail.searchParams.get('body') || '').split('\n').map(flat);
    w.check(mail.protocol === 'mailto:' && mail.pathname === 'me@qtmbg.com', `la commande part vers ${mail.protocol}${mail.pathname}`);
    w.check(sujet === await dit(`Brand MRI review : ${MARQUE}`), `l’objet est ${JSON.stringify(sujet)}`);
    w.check(corps[0] === await dit(`Marque : ${MARQUE}`), `la première ligne est ${JSON.stringify(corps[0])}`);
    w.check(corps[1] === await dit(`Site : ${SITE}`) && corps[2] === await dit(`Email : ${EMAIL}`), `les lignes site et email sont ${JSON.stringify(corps.slice(1, 3))}`);
    w.check(corps[3] === await dit(`Score : ${SCORE}/100`), `la ligne du score est ${JSON.stringify(corps[3])}`);
    w.check(corps[5] === await dit('Questions pour la review :'), `l’intitulé des questions est ${JSON.stringify(corps[5])}`);
    // Les mots de la fondatrice partent tels qu'elle les a écrits, dans les deux langues.
    w.check(corps[6] === flat(QUESTIONS_REVIEW), `les questions sont parties ainsi : ${JSON.stringify(corps[6])}`);
  });

  await w.step('re-test : la comparaison avec le score précédent', async () => {
    await w.open('retest=1');
    w.check(!(await cache('#retestNote')), 'la note de re-test est absente');
    await montre('Re-test 90 jours : 39 $.', '#landing');
    await diagnostiquer({ precedent: 40 });
    await montre(`Comparaison re-test : 40 → ${SCORE} (+${SCORE - 40} points).`, '#result');
    await montre('Re-test 90 jours · 39 $', '#offerBox');
    w.check(await p.locator('#offerBox button').count() === 1, 'le re-test propose autre chose que son propre paiement');
    w.check(await partVers(() => p.locator('#offerBox button').click()) === STRIPE.retest39, 'le bouton de re-test ne mène pas à son lien');
  });

  await w.step('titre ciblé, puis export des réponses', async () => {
    await w.open('focus=preuve');
    await montre('Votre promesse est-elle prouvée ? Votre score le dit en 5 minutes.');
    await diagnostiquer();
    const [fichier] = await Promise.all([p.waitForEvent('download', { timeout: T }), w.click('Exporter mes réponses (CSV, pour l’équipe)', { timeout: T })]);
    const csv = fs.readFileSync(await fichier.path(), 'utf8').split('\n');
    w.check(fichier.suggestedFilename() === 'brand-mri-leads.csv', `le fichier s’appelle ${fichier.suggestedFilename()}`);
    w.check(csv[0] === 'date,brand,website,email,score,frein,tier', `l’en-tête du CSV est ${csv[0]}`);
    w.check(csv.length === leads.length + 1, `le CSV porte ${csv.length - 1} lignes pour ${leads.length} diagnostics`);
    // Le fichier est une donnée : il ne change pas avec la langue.
    w.check(csv.slice(1).every(l => l.includes(`,${MARQUE},`) && l.includes(`,${SCORE},${TENSIONS[0].nom},`)), `une ligne du CSV ne porte pas la marque, le score et le frein : ${csv[1]}`);
    w.check(liens.length === leads.length, `${liens.length} lien(s) magique(s) pour ${leads.length} diagnostic(s)`);
  });
}
