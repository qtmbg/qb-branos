// Brand MRI · every string the page shows, in English and in French.
//
// English is the primary track. French mirrors it, entry for entry: the
// harness in tests/mri/mri.mjs fails when the two trees differ in shape.
//
// Language is resolved once, in this order:
//   1. ?lang=en or ?lang=fr in the address
//   2. localStorage "qb_lang", the hook for a site-wide language switch
//   3. the language saved with the visitor's diagnostic (so the page keeps
//      its language across the trip to Stripe and back)
//   4. the browser language: French for fr-*, English for everything else
//
// A site-wide switch needs one line to drive this page:
//   window.dispatchEvent(new CustomEvent('qb:lang', { detail: 'fr' }))

var MRI_STRINGS = {
  en: {
    meta: {
      title: 'Brand MRI · Your brand score in five minutes · BrandOS',
      description: 'Ten questions, five pillars, one score out of 100. The score is free. The plan to raise it starts at $19.'
    },
    landing: {
      eyebrow: 'Quantum Branding · Brand MRI',
      h1: 'What your brand is saying, in five minutes.',
      lead: 'First your free score. Then, if you want the plan, the full diagnostic. You pay only to close the gap, not to discover it.',
      ladder: [
        ['Free', 'Your score out of 100 and your main brake.'],
        ['$19 · MRI Flash', 'Your three tensions and your first workstream.'],
        ['$79 · Full report', 'Five pillars, your positioning sentence, three workstreams, a 90-day plan.'],
        ['$290 in total · Report with video review', 'Nizzar reviews your report on video, 10 minutes. Five places a week.']
      ],
      cta: 'Get my free score',
      note: 'Your email is required to see the score. Guarantee: refund within 7 days on a simple email, before the review is recorded.',
      retest: '90-day re-test: $39. Compare your new score with the previous one.'
    },
    focus: {
      phrase: 'Does your sentence fit on one line? Your score answers in five minutes.',
      logo: 'Without the logo, is your brand recognizable? Your score answers in five minutes.',
      coherence: 'Is your promise the same everywhere? Your score answers in five minutes.',
      differentiation: 'What can you say that competitors cannot? Your score answers in five minutes.',
      preuve: 'Is your promise proven? Your score answers in five minutes.'
    },
    form: {
      brandTitle: 'Your brand',
      brand: 'Brand name',
      brandPh: 'e.g. Atelier Lumen',
      website: 'Website',
      websitePh: 'https://yoursite.com',
      email: 'Email, to receive your score',
      emailPh: 'you@example.com',
      phrase: 'Your current sentence, in one line (optional)',
      target: 'Who you sell to, in a few words (optional)',
      targetPh: 'e.g. owners of small companies',
      prevScore: 'Your previous score (re-test)',
      prevScorePh: 'e.g. 52',
      questionsTitle: '10 questions',
      questionsNote: 'Answer honestly. There is no good image to give, only a gap to measure.',
      submit: 'See my free score',
      errEmail: 'Enter your email to see the free score.',
      errAnswers: 'Answer the 10 questions to see the result. Still open: {list}.'
    },
    questions: [
      'Can a visitor tell in 5 seconds what you sell, to whom, and why you?',
      'Does your positioning sentence fit in one sentence, with no jargon?',
      'Without the logo, does your site stay recognizable next to 3 competitors?',
      'Is your visual identity (colors, type, tone) distinct rather than generic?',
      'Does the same promise appear on the site, the social channels and the sales documents?',
      'Are tone and message the same everywhere, with no contradiction?',
      'Do you have a claim your competitors cannot repeat as it stands?',
      'Can a client say why they choose you, you, over a competitor, in one sentence?',
      'Does visible proof back the promise (client cases, figures, press, reviews)?',
      'Is that proof precise and verifiable rather than vague and generic?'
    ],
    options: ['No', 'Mostly no', 'Mostly yes', 'Yes, clearly'],
    pillars: {
      phrase: { name: 'The sentence', short: 'Positioning in one sentence' },
      logo: { name: 'The logo test', short: 'Recognizable without the logo' },
      coherence: { name: 'Coherence', short: 'The same promise everywhere' },
      differentiation: { name: 'Differentiation', short: 'What competitors cannot say' },
      preuve: { name: 'Proof', short: 'What proves the promise' }
    },
    levels: { weak: 'weak', mid: 'to strengthen', solid: 'solid' },
    advice: {
      phrase: {
        weak: 'Rewrite the sentence on one line: what you sell, to whom, why you. Test it on 5 strangers.',
        mid: 'Shorten the sentence and place it at the top of the homepage, word for word, everywhere.',
        solid: 'Keep this sentence intact. Do not dilute it with a variant per channel.'
      },
      logo: {
        weak: 'Define 3 distinctive signs beyond the logo: a color, a typeface, a tone. Apply them everywhere.',
        mid: 'Remove the generic elements and keep one strong sign, repeated at every point of contact.',
        solid: 'Protect this identity. Every new asset must pass the test without the logo.'
      },
      coherence: {
        weak: 'Align site, social channels and documents on one written promise. Correct the contradictions first.',
        mid: 'Go channel by channel and replace each diverging promise with the central one.',
        solid: 'Document the central promise so every new piece of content repeats it without drift.'
      },
      differentiation: {
        weak: 'Find a claim competitors cannot make, then prove it. Without one, price decides.',
        mid: 'State the difference as one concrete claim, not as adjectives (premium, innovative, human).',
        solid: 'Make the difference harder to copy: an asset, a method, a proof that is yours alone.'
      },
      preuve: {
        weak: 'Add 3 precise proofs to the homepage: a client case, a figure, a named testimonial.',
        mid: 'Replace vague proof with figures that can be checked, with names and context.',
        solid: 'Put the best proof at the same level as the promise, not at the bottom of the page.'
      }
    },
    result: {
      eyebrow: 'Your free score',
      title: 'Your score',
      brake: 'Your main brake: {pillar}. The detail and the plan are in the paid tiers.',
      brakePaid: 'Your main brake: {pillar}.',
      reading: 'Strongest point: {strong} ({s}/100). Main brake: {brake} ({b}/100).',
      readingLevel: {
        weak: 'The diagnostic is weak overall: start with the 3 tensions, in order.',
        mid: 'The base exists, but the tensions below limit how readable the brand is.',
        solid: 'The brand is readable. The work is on the last gaps, not on a rebuild.'
      },
      tierNote: {
        free: 'Current tier: free score.',
        flash: 'Current tier: MRI Flash ($19 paid).',
        full: 'Current tier: full report ($79 paid in total).',
        review: 'Current tier: report with video review ($290 paid in total).'
      },
      tensionsTitle: 'Your three tensions',
      priorityTitle: 'Priority workstream',
      workstream: 'Workstream {n}: {pillar}',
      startHere: 'Start here.',
      exitLead: 'Exit test. Move on when both answers are a clear yes:',
      pillarsTitle: 'Diagnostic by pillar',
      inPlan: 'Handled in the 90-day plan, {phase}.',
      sentenceTitle: 'Your positioning sentence',
      sentenceHelp: 'Fill the two fields. The sentence assembles as you type. It is a working base to refine.',
      difference: 'What you can say that competitors cannot',
      differencePh: 'the only studio that ships in ten days',
      proof: 'Your most precise proof',
      proofPh: '120 projects delivered since 2019',
      sentence: 'For {target}, {brand} is {difference}, proven by {proof}.',
      sentenceDefaults: { target: 'your clients', brand: '[your brand]', difference: '[your difference]', proof: '[your proof]' },
      currentPhrase: 'Your current sentence: {phrase}',
      notProvided: 'not provided',
      planTitle: 'Three workstreams, 90 days',
      phases: ['Days 1 to 30', 'Days 31 to 60', 'Days 61 to 90'],
      action: 'Action.',
      print: 'Print or save the report',
      nextTitle: 'Move to the next tier',
      audit: 'After the full report: a human audit from $450, with your $79 credited if you book within 30 days. The MRI becomes a deposit, not money lost.',
      retake: 'Retake the diagnostic',
      retestCompare: 'Re-test: {prev} to {now} ({diff} points).',
      exportDebug: 'Export leads stored in this browser (CSV, debug)'
    },
    review: {
      title: 'Video review: your questions for Nizzar',
      note: 'Your order leaves with your report. Turnaround is 72 working hours, five places a week.',
      label: 'What you want the video to settle, in 2 or 3 sentences',
      submit: 'Send my review order',
      sending: 'Sending.',
      sent: 'Order received. Nizzar records your review within 72 working hours and sends it to {email}.',
      errEmpty: 'Write your 2 or 3 sentences, then send.',
      errSend: 'The order did not go through. Write to me@qtmbg.com from the email you paid with.'
    },
    offers: {
      flash: { label: 'MRI Flash · $19', desc: 'The detail of your three tensions and your first workstream, delivered at once.' },
      full: { label: 'Full report direct · $79', desc: '' },
      upgrade60: { label: 'Full report · $60 more ($79 in total)', desc: 'The full report without paying for Flash twice: $19 already paid, $60 more.' },
      review211: { label: 'Add the video review · $211 more ($290 in total)', desc: 'Nizzar on video about your report, 10 minutes, within 72 working hours.' },
      retest39: { label: '90-day re-test · $39', desc: 'The same diagnostic, your progress measured.' },
      pay: '{label} · Pay with Stripe',
      maxTitle: 'Top tier reached.',
      maxDesc: 'Full report and review ordered. Next step: the human audit, with your $79 credited within 30 days.'
    },
    paid: {
      checking: 'Confirming your payment with Stripe.',
      confirmed: 'Payment received, thank you. Your {tier} is open below.',
      needAnswers: 'Payment received, thank you. Answer the 10 questions once and your {tier} opens.',
      retestReady: 'Payment received, thank you. Retake the 10 questions and your progress is measured against your previous score.',
      failTitle: 'This payment could not be confirmed',
      failBody: 'Nothing is lost. Write to me@qtmbg.com from the email you paid with and your access is restored by hand.',
      retry: 'Check again',
      pending: 'The payment check did not answer. Your payment is safe. Reload this page in a moment and your {tier} opens.',
      tierNames: { flash: 'MRI Flash', full: 'full report', review: 'report with video review', retest: 're-test' }
    }
  },

  fr: {
    meta: {
      title: 'Brand MRI · Votre score de marque en cinq minutes · BrandOS',
      description: 'Dix questions, cinq piliers, un score sur 100. Le score est gratuit. Le plan pour le faire monter commence à 19 $.'
    },
    landing: {
      eyebrow: 'Quantum Branding · Brand MRI',
      h1: 'Ce que votre marque dit vraiment, en 5 minutes.',
      lead: 'D’abord votre score gratuit. Ensuite, si vous voulez le plan, le diagnostic complet. Vous ne payez que pour fermer l’écart, pas pour le découvrir.',
      ladder: [
        ['Gratuit', 'Votre score sur 100 et votre frein principal.'],
        ['19 $ · MRI Flash', 'Vos trois tensions et votre premier chantier.'],
        ['79 $ · Rapport complet', 'Cinq piliers, votre phrase de positionnement, trois chantiers, un plan 90 jours.'],
        ['290 $ au total · Rapport avec review vidéo', 'Nizzar commente votre rapport en vidéo, 10 minutes. Cinq places par semaine.']
      ],
      cta: 'Obtenir mon score gratuit',
      note: 'Email obligatoire pour voir le score. Garantie : remboursement sous 7 jours sur simple email, avant l’enregistrement de la review.',
      retest: 'Re-test 90 jours : 39 $. Comparez votre nouveau score avec le précédent.'
    },
    focus: {
      phrase: 'Votre phrase tient-elle en une ligne ? Votre score le dit en 5 minutes.',
      logo: 'Sans logo, votre marque est-elle reconnaissable ? Votre score le dit en 5 minutes.',
      coherence: 'Votre promesse est-elle la même partout ? Votre score le dit en 5 minutes.',
      differentiation: 'Ce que vos concurrents ne peuvent pas dire : votre score le dit en 5 minutes.',
      preuve: 'Votre promesse est-elle prouvée ? Votre score le dit en 5 minutes.'
    },
    form: {
      brandTitle: 'Votre marque',
      brand: 'Nom de la marque',
      brandPh: 'Ex : Atelier Lumen',
      website: 'Site web',
      websitePh: 'https://votresite.com',
      email: 'Email pour recevoir le score',
      emailPh: 'vous@exemple.com',
      phrase: 'Votre phrase actuelle, en une phrase (optionnel)',
      target: 'À qui vous vendez, en quelques mots (optionnel)',
      targetPh: 'Ex : dirigeants de PME',
      prevScore: 'Votre score précédent (re-test)',
      prevScorePh: 'Ex : 52',
      questionsTitle: '10 questions',
      questionsNote: 'Répondez honnêtement. Il n’y a pas de bonne image à donner, seulement un écart à mesurer.',
      submit: 'Voir mon score gratuit',
      errEmail: 'Indiquez votre email pour voir le score gratuit.',
      errAnswers: 'Répondez aux 10 questions pour voir le résultat. Il reste : {list}.'
    },
    questions: [
      'Un visiteur comprend-il en 5 secondes ce que vous vendez, à qui, et pourquoi vous ?',
      'Votre phrase de positionnement tient-elle en une phrase, sans jargon ?',
      'Sans logo, votre site reste-t-il reconnaissable face à 3 concurrents ?',
      'Votre identité visuelle (couleurs, typographie, ton) est-elle distincte, plutôt que générique ?',
      'La même promesse apparaît-elle sur le site, les réseaux et les documents commerciaux ?',
      'Le ton et le message sont-ils les mêmes partout, sans contradiction ?',
      'Avez-vous une affirmation que vos concurrents ne peuvent pas reprendre telle quelle ?',
      'Un client peut-il dire pourquoi vous choisir, vous, plutôt qu’un concurrent, en une phrase ?',
      'Des preuves visibles soutiennent-elles la promesse (cas clients, chiffres, presse, avis) ?',
      'Ces preuves sont-elles précises et vérifiables, plutôt que vagues et génériques ?'
    ],
    options: ['Non', 'Plutôt non', 'Plutôt oui', 'Oui, clairement'],
    pillars: {
      phrase: { name: 'La phrase', short: 'Le positionnement en une phrase' },
      logo: { name: 'Le test du logo', short: 'Reconnaissable sans logo' },
      coherence: { name: 'Cohérence', short: 'La même promesse partout' },
      differentiation: { name: 'Différenciation', short: 'Ce que les concurrents ne peuvent pas dire' },
      preuve: { name: 'Preuve', short: 'Ce qui prouve la promesse' }
    },
    levels: { weak: 'faible', mid: 'à renforcer', solid: 'solide' },
    advice: {
      phrase: {
        weak: 'Réécrire la phrase en une ligne : ce que vous vendez, à qui, pourquoi vous. La tester sur 5 inconnus.',
        mid: 'Raccourcir la phrase et la placer en haut de la page d’accueil, mot pour mot, partout.',
        solid: 'Garder cette phrase intacte. Ne pas la diluer avec des variantes par canal.'
      },
      logo: {
        weak: 'Définir 3 signes distinctifs hors logo : une couleur, une typographie, un ton. Les appliquer partout.',
        mid: 'Supprimer les éléments génériques et garder un seul signe fort, répété à chaque point de contact.',
        solid: 'Protéger cette identité. Tout nouveau support doit passer le test sans logo.'
      },
      coherence: {
        weak: 'Aligner site, réseaux et documents sur une seule promesse écrite. Corriger les contradictions en premier.',
        mid: 'Faire une passe canal par canal et remplacer chaque promesse divergente par la promesse centrale.',
        solid: 'Documenter la promesse centrale pour que chaque nouveau contenu la reprenne sans dérive.'
      },
      differentiation: {
        weak: 'Trouver une affirmation que les concurrents ne peuvent pas dire, puis la prouver. Sans elle, le prix décide.',
        mid: 'Formuler la différence en une affirmation concrète, pas en adjectifs (premium, innovant, humain).',
        solid: 'Rendre la différence plus difficile à copier : un actif, une méthode, une preuve propre à vous.'
      },
      preuve: {
        weak: 'Ajouter 3 preuves précises sur la page d’accueil : un cas client, un chiffre, un témoignage nommé.',
        mid: 'Remplacer les preuves vagues par des preuves chiffrées et vérifiables, avec noms et contextes.',
        solid: 'Mettre les meilleures preuves au même niveau que la promesse, pas en bas de page.'
      }
    },
    result: {
      eyebrow: 'Votre score gratuit',
      title: 'Votre score',
      brake: 'Votre frein principal : {pillar}. Le détail et le plan sont dans les paliers payants.',
      brakePaid: 'Votre frein principal : {pillar}.',
      reading: 'Point le plus solide : {strong} ({s}/100). Frein principal : {brake} ({b}/100).',
      readingLevel: {
        weak: 'Le diagnostic est faible dans l’ensemble : commencer par les 3 tensions, dans l’ordre.',
        mid: 'La base existe, mais les tensions ci-dessous limitent la lisibilité de la marque.',
        solid: 'La marque est lisible. Le travail porte sur les derniers écarts, pas sur une refonte.'
      },
      tierNote: {
        free: 'Palier actuel : score gratuit.',
        flash: 'Palier actuel : MRI Flash (19 $ payés).',
        full: 'Palier actuel : rapport complet (79 $ payés au total).',
        review: 'Palier actuel : rapport avec review vidéo (290 $ payés au total).'
      },
      tensionsTitle: 'Vos trois tensions',
      priorityTitle: 'Chantier prioritaire',
      workstream: 'Chantier {n} : {pillar}',
      startHere: 'Commencez ici.',
      exitLead: 'Critère de sortie. Passez à la suite quand les deux réponses sont un oui clair :',
      pillarsTitle: 'Diagnostic par pilier',
      inPlan: 'Traité dans le plan 90 jours, {phase}.',
      sentenceTitle: 'Votre phrase de positionnement',
      sentenceHelp: 'Remplissez les deux champs. La phrase s’assemble pendant que vous écrivez. C’est une base de travail à affiner.',
      difference: 'Ce que vous pouvez dire et que vos concurrents ne peuvent pas',
      differencePh: 'le seul studio qui livre en dix jours',
      proof: 'Votre preuve la plus précise',
      proofPh: '120 projets livrés depuis 2019',
      sentence: 'Pour {target}, {brand} est {difference}, prouvé par {proof}.',
      sentenceDefaults: { target: 'vos clients', brand: '[votre marque]', difference: '[votre différence]', proof: '[votre preuve]' },
      currentPhrase: 'Votre phrase actuelle : {phrase}',
      notProvided: 'non renseignée',
      planTitle: 'Trois chantiers, 90 jours',
      phases: ['Jours 1 à 30', 'Jours 31 à 60', 'Jours 61 à 90'],
      action: 'Action.',
      print: 'Imprimer ou enregistrer le rapport',
      nextTitle: 'Passer au palier suivant',
      audit: 'Après le rapport complet : audit humain à partir de 450 $, avec vos 79 $ déduits si vous réservez sous 30 jours. Le MRI devient un acompte, pas une dépense perdue.',
      retake: 'Refaire le diagnostic',
      retestCompare: 'Re-test : {prev} → {now} ({diff} points).',
      exportDebug: 'Exporter les leads de ce navigateur (CSV, debug)'
    },
    review: {
      title: 'Review vidéo : vos questions pour Nizzar',
      note: 'Votre commande part avec votre rapport. Délai : 72 h ouvrées, cinq places par semaine.',
      label: 'Ce que vous voulez que la vidéo tranche, en 2 ou 3 phrases',
      submit: 'Envoyer ma commande de review',
      sending: 'Envoi en cours.',
      sent: 'Commande reçue. Nizzar enregistre votre review sous 72 h ouvrées et l’envoie à {email}.',
      errEmpty: 'Écrivez vos 2 ou 3 phrases, puis envoyez.',
      errSend: 'La commande n’est pas partie. Écrivez à me@qtmbg.com depuis l’email utilisé pour payer.'
    },
    offers: {
      flash: { label: 'MRI Flash · 19 $', desc: 'Le détail de vos trois tensions et votre premier chantier, livrés immédiatement.' },
      full: { label: 'Rapport complet direct · 79 $', desc: '' },
      upgrade60: { label: 'Rapport complet · 60 $ de plus (79 $ au total)', desc: 'Le rapport complet sans repayer le Flash : 19 $ déjà payés, 60 $ de plus.' },
      review211: { label: 'Ajouter la review vidéo · 211 $ de plus (290 $ au total)', desc: 'Nizzar en vidéo sur votre rapport, 10 minutes, sous 72 h ouvrées.' },
      retest39: { label: 'Re-test 90 jours · 39 $', desc: 'Le même diagnostic, votre progression mesurée.' },
      pay: '{label} · Payer par Stripe',
      maxTitle: 'Palier maximal atteint.',
      maxDesc: 'Rapport complet et review commandée. Prochaine étape : l’audit humain, avec vos 79 $ déduits sous 30 jours.'
    },
    paid: {
      checking: 'Confirmation de votre paiement auprès de Stripe.',
      confirmed: 'Paiement reçu, merci. Votre {tier} est ouvert ci-dessous.',
      needAnswers: 'Paiement reçu, merci. Répondez une fois aux 10 questions et votre {tier} s’ouvre.',
      retestReady: 'Paiement reçu, merci. Refaites les 10 questions : votre progression est mesurée par rapport à votre score précédent.',
      failTitle: 'Ce paiement n’a pas pu être confirmé',
      failBody: 'Rien n’est perdu. Écrivez à me@qtmbg.com depuis l’email utilisé pour payer : votre accès est rétabli à la main.',
      retry: 'Vérifier à nouveau',
      pending: 'La vérification du paiement n’a pas répondu. Votre paiement est en sécurité. Rechargez cette page dans un instant et votre {tier} s’ouvre.',
      tierNames: { flash: 'MRI Flash', full: 'rapport complet', review: 'rapport avec review vidéo', retest: 're-test' }
    }
  }
};

// {name} substitution. A missing value leaves the key visible on purpose:
// a hole in the copy should be seen, never read as a finished sentence.
function mriFmt(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, function (m, k) {
    return vars && vars[k] != null ? String(vars[k]) : m;
  });
}

// Dotted path lookup, "landing.ladder.1.0" style.
function mriPath(obj, path) {
  var parts = String(path).split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur == null) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function mriResolveLang(sources) {
  var order = [sources && sources.param, sources && sources.stored, sources && sources.saved];
  for (var i = 0; i < order.length; i++) {
    var c = String(order[i] || '').toLowerCase().slice(0, 2);
    if (c === 'fr' || c === 'en') return c;
  }
  return String((sources && sources.nav) || '').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
}

var MRI_I18N_API = { STRINGS: MRI_STRINGS, fmt: mriFmt, path: mriPath, resolveLang: mriResolveLang };

// Export Node (tests) and browser (window).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MRI_I18N_API;
} else if (typeof window !== 'undefined') {
  window.MRI_I18N = MRI_I18N_API;
}
