/* en · mri.html, js/mri.js, js/mri-tiers.js, js/mri-app.js
   The page is written in French. This is the English rendering.
   Keys are the French text nodes exactly as the page builds them. */
QBI18N.add('en', {
  /* Head */
  "Brand MRI : votre score de marque, puis le plan pour le faire monter":
    "Brand MRI: your brand score, then the plan to raise it",

  /* Landing */
  "Quantum Branding · Brand MRI": true,
  "Ce que votre marque dit en réalité, en 5 minutes.": "What your brand actually says, in 5 minutes.",
  "D'abord votre score gratuit. Ensuite, si vous voulez le plan, le diagnostic complet. Vous ne payez que pour fermer l'écart, pas pour le découvrir.":
    "First, your free score. Then, if you want the plan, the full diagnostic. You pay only to close the gap, not to find it.",
  "Gratuit :": "Free:",
  "score sur 100 + votre frein principal.": "score out of 100 + your main blocker.",
  "19 $ :": "$19:",
  "MRI Flash, vos 3 tensions + 1 chantier.": "MRI Flash, your 3 tensions + 1 project.",
  "79 $ :": "$79:",
  "rapport complet, 5 piliers + phrase + 3 chantiers + plan 90 jours.":
    "full report, 5 pillars + sentence + 3 projects + 90-day plan.",
  "290 $ au total :": "$290 in total:",
  "rapport + review vidéo 10 min, 5 places par semaine.":
    "report + 10 min video review, 5 slots a week.",
  "Re-test 90 jours : 39 $.": "90-day re-test: $39.",
  "Comparez votre nouveau score avec le précédent.": "Compare your new score with the previous one.",
  "Obtenir mon score gratuit": "Get my free score",
  "Email obligatoire pour voir le score. Garantie : remboursement sous 7 jours sur simple email, avant l'enregistrement de la review.":
    "Email required to see the score. Guarantee: refund within 7 days on a simple email request, before the review is recorded.",

  /* Focus headlines (?focus=) and the return from Stripe (?paid=) */
  "Votre phrase tient-elle en une ligne ? Votre score le dit en 5 minutes.":
    "Does your sentence fit on one line? Your score tells you in 5 minutes.",
  "Sans logo, votre marque est-elle reconnaissable ? Votre score le dit en 5 minutes.":
    "Without the logo, is your brand recognisable? Your score tells you in 5 minutes.",
  "Votre promesse est-elle la même partout ? Votre score le dit en 5 minutes.":
    "Is your promise the same everywhere? Your score tells you in 5 minutes.",
  "Ce que vos concurrents ne peuvent pas dire : votre score le dit en 5 minutes.":
    "What your competitors cannot say: your score tells you in 5 minutes.",
  "Votre promesse est-elle prouvée ? Votre score le dit en 5 minutes.":
    "Is your promise proven? Your score tells you in 5 minutes.",
  "Paiement recu, merci. Refaites le diagnostic, votre palier est deja debloque.":
    "Payment received, thank you. Run the diagnostic again, your tier is already open.",

  /* Form */
  "Votre marque": "Your brand",
  "Nom de la marque": "Brand name",
  "Ex : Atelier Lumen": "E.g. Atelier Lumen",
  "Site web": "Website",
  "https://votresite.com": "https://yoursite.com",
  "Email pour recevoir le score": "Email to receive the score",
  "vous@exemple.com": "you@example.com",
  "Votre phrase actuelle, en une phrase (optionnel)": "Your current positioning, in one sentence (optional)",
  "À qui vous vendez, en quelques mots (optionnel)": "Who you sell to, in a few words (optional)",
  "Ex : dirigeants de PME": "E.g. small business owners",
  "Votre score précédent (re-test)": "Your previous score (re-test)",
  "Ex : 52": "E.g. 52",
  "10 questions": true,
  "Répondez honnêtement. Il n'y a pas de bonne image à donner, seulement un écart à mesurer.":
    "Answer honestly. There is no good image to project, only a gap to measure.",
  "Voir mon score gratuit": "See my free score",

  /* Questions. Each legend is built as "1. [Pillar] Question". */
  "{0}. [{1}] {2}": "{0}. [{1}] {2}",
  "Un visiteur comprend-il en 5 secondes ce que vous vendez, a qui, et pourquoi vous ?":
    "Does a visitor understand in 5 seconds what you sell, to whom, and why you?",
  "Votre phrase de positionnement tient-elle en une phrase, sans jargon ?":
    "Does your positioning fit in one sentence, with no jargon?",
  "Sans logo, votre site reste-t-il reconnaissable face a 3 concurrents ?":
    "Without the logo, does your site stay recognisable next to 3 competitors?",
  "Votre identite visuelle (couleurs, typographie, ton) est-elle distincte, ou generique ?":
    "Is your visual identity (colours, typography, tone) distinct, or generic?",
  "La meme promesse apparait-elle sur le site, les reseaux et les documents commerciaux ?":
    "Does the same promise appear on the site, on social and in sales documents?",
  "Le ton et le message sont-ils les memes partout, sans contradiction ?":
    "Are the tone and the message the same everywhere, with no contradiction?",
  "Avez-vous une affirmation que vos concurrents ne peuvent pas reprendre telle quelle ?":
    "Do you have a claim your competitors cannot repeat as it stands?",
  "Un client peut-il dire pourquoi vous choisir, vous, plutot qu'un concurrent, en une phrase ?":
    "Can a customer say why they would choose you over a competitor, in one sentence?",
  "Des preuves visibles soutiennent-elles la promesse (cas clients, chiffres, presse, avis) ?":
    "Does visible proof back the promise (client cases, figures, press, reviews)?",
  "Ces preuves sont-elles precises et verifiables, ou vagues et generiques ?":
    "Is that proof precise and verifiable, or vague and generic?",
  "Non": "No",
  "Plutot non": "Mostly no",
  "Plutot oui": "Mostly yes",
  "Oui, clairement": "Yes, clearly",

  /* Pillars */
  "La phrase": "The sentence",
  "Le test du logo": "The logo test",
  "Cohérence": "Consistency",
  "Différenciation": "Differentiation",
  "Preuve": "Proof",
  "Positionnement en une phrase": "Positioning in one sentence",
  "Reconnaissable sans logo": "Recognisable without the logo",
  "Meme promesse partout": "Same promise everywhere",
  "Ce que les concurrents ne peuvent pas dire": "What competitors cannot say",
  "Ce qui prouve la promesse": "What proves the promise",
  "(faible)": "(weak)",
  "(a renforcer)": "(to strengthen)",
  "(solide)": "(solid)",

  /* Advice, per pillar and level */
  "Reecrire la phrase en une ligne : ce que vous vendez, a qui, pourquoi vous. La tester sur 5 inconnus.":
    "Rewrite the sentence on one line: what you sell, to whom, why you. Test it on 5 strangers.",
  "Raccourcir la phrase et la placer en haut de la page d'accueil, mot pour mot, partout.":
    "Shorten the sentence and place it at the top of the homepage, word for word, everywhere.",
  "Garder cette phrase intacte. Ne pas la diluer avec des variantes par canal.":
    "Keep this sentence intact. Do not dilute it with a variant per channel.",
  "Definir 3 signes distinctifs hors logo : une couleur, une typographie, un ton. Les appliquer partout.":
    "Define 3 distinctive signs beyond the logo: a colour, a typeface, a tone. Apply them everywhere.",
  "Supprimer les elements generiques et garder un seul signe fort, repete a chaque point de contact.":
    "Remove the generic elements and keep one strong sign, repeated at every touchpoint.",
  "Proteger cette identite. Tout nouveau support doit passer le test sans logo.":
    "Protect this identity. Every new piece has to pass the test without the logo.",
  "Aligner site, reseaux et documents sur une seule promesse ecrite. Corriger les contradictions en premier.":
    "Align site, social and documents on one written promise. Fix the contradictions first.",
  "Faire une passe canal par canal et remplacer chaque promesse divergente par la promesse centrale.":
    "Go through channel by channel and replace every diverging promise with the central one.",
  "Documenter la promesse centrale pour que chaque nouveau contenu la reprenne sans derivation.":
    "Document the central promise so every new piece of content repeats it without drift.",
  "Trouver une affirmation que les concurrents ne peuvent pas dire, puis la prouver. Sans elle, le prix decide.":
    "Find a claim competitors cannot make, then prove it. Without it, price decides.",
  "Formuler la difference en une affirmation concrete, pas en adjectifs (premium, innovant, humain).":
    "State the difference as one concrete claim, not as adjectives (premium, innovative, human).",
  "Rendre la difference plus difficile a copier : un actif, une methode, une preuve propre a vous.":
    "Make the difference harder to copy: an asset, a method, a proof that is yours alone.",
  "Ajouter 3 preuves precises sur la page d'accueil : un cas client, un chiffre, un temoignage nomme.":
    "Add 3 precise proofs to the homepage: a client case, a figure, a named testimonial.",
  "Remplacer les preuves vagues par des preuves chiffrees et verifiables, avec noms et contextes.":
    "Replace vague proof with verifiable proof in numbers, with names and context.",
  "Mettre les meilleures preuves au meme niveau que la promesse, pas en bas de page.":
    "Put your best proof at the same level as the promise, not at the bottom of the page.",

  /* Result */
  "Votre score gratuit": "Your free score",
  "Votre score": "Your score",
  "Votre frein principal : {0}. Le détail et le plan sont dans les paliers payants.":
    "Your main blocker: {0}. The detail and the plan are in the paid tiers.",
  "Comparaison re-test : {0} → {1} ({2} points).": "Re-test comparison: {0} → {1} ({2} points).",
  "Palier actuel : {0}.": "Current tier: {0}.",
  "Paiement recu, merci. Palier actuel : {0}.": "Payment received, thank you. Current tier: {0}.",
  "score gratuit": "free score",
  "Flash (19 $, total payé 19 $)": "Flash ($19, total paid $19)",
  "Rapport complet (total payé 79 $)": "Full report (total paid $79)",
  "Rapport + review (total payé 290 $)": "Report + review (total paid $290)",

  /* Flash tier */
  "Vos 3 tensions (Flash)": "Your 3 tensions (Flash)",
  "{0}. {1} ({2}/100)": "{0}. {1} ({2}/100)",
  "Chantier prioritaire": "Priority project",
  "Chantier 1 : {0}": "Project 1: {0}",

  /* Full report */
  "Diagnostic par pilier": "Diagnosis by pillar",
  "{0} : {1}/100": "{0}: {1}/100",
  "Phrase de positionnement proposée": "Proposed positioning sentence",
  "Pour {0}, {1} est ce que vos concurrents ne peuvent pas dire, prouve par vos preuves.":
    "For {0}, {1} is what your competitors cannot say, proven by your proof.",
  "vos clients": "your customers",
  "[Votre marque]": "[Your brand]",
  "Base de travail à affiner. Votre phrase actuelle, si renseignée :":
    "A working draft to refine. Your current sentence, if you gave one:",
  "non renseignée": "not provided",
  "3 chantiers et plan 90 jours": "3 projects and a 90-day plan",
  "Jours {0} à {1} : {2}": "Days {0} to {1}: {2}",
  "Imprimer / enregistrer le rapport": "Print / save the report",

  /* Review */
  "Review vidéo : vos questions pour Nizzar": "Video review: your questions for Nizzar",
  "Après paiement, cette commande part avec votre rapport. Délai 72 h ouvrées, 5 places par semaine.":
    "After payment, this order goes out with your report. Turnaround: 72 business hours, 5 slots a week.",
  "Ce que vous voulez que la vidéo tranche, en 2 ou 3 phrases":
    "What you want the video to settle, in 2 or 3 sentences",
  "Envoyer ma commande de review (démo)": "Send my review order (demo)",

  /* Next tier */
  "Passer au palier suivant": "Move to the next tier",
  "MRI Flash · 19 $": "MRI Flash · $19",
  "Passer au rapport complet · 60 $ de plus (total 79 $)": "Move to the full report · $60 more ($79 total)",
  "Ajouter la review video · 211 $ de plus (total 290 $)": "Add the video review · $211 more ($290 total)",
  "Re-test 90 jours · 39 $": "90-day re-test · $39",
  "Le détail de vos tensions et votre premier chantier, livrés immédiatement.":
    "The detail of your tensions and your first project, delivered immediately.",
  "Le rapport complet, sans repayer le Flash : 19 $ déjà payés, 60 $ de plus.":
    "The full report, without paying for Flash twice: $19 already paid, $60 more.",
  "La vidéo de Nizzar sur votre rapport, 10 min, sous 72 h ouvrées.":
    "Nizzar's video on your report, 10 min, within 72 business hours.",
  "{0} · Payer par Stripe": "{0} · Pay with Stripe",
  "{0} · Paiement en cours d'activation": "{0} · Payment being activated",
  "Rapport complet direct · 79 $ · Payer par Stripe": "Full report, direct · $79 · Pay with Stripe",
  "Mode démo : ajoutez ?demo=flash, ?demo=full ou ?demo=review à l'adresse pour tester ce palier sans payer. En production, ce bouton ouvre Stripe.":
    "Demo mode: add ?demo=flash, ?demo=full or ?demo=review to the address to test this tier without paying. In production, this button opens Stripe.",
  "Palier maximal atteint.": "Top tier reached.",
  "Rapport complet + review commandée. Prochaine étape : audit humain, avec vos 79 $ déduits sous 30 jours.":
    "Full report + review ordered. Next step: a human audit, with your $79 deducted within 30 days.",
  "Après le rapport complet : audit humain à partir de 450 $, avec vos 79 $ déduits si vous réservez sous 30 jours. Le MRI devient un acompte, pas une dépense perdue.":
    "After the full report: a human audit from $450, with your $79 deducted if you book within 30 days. The MRI becomes a deposit, not money lost.",
  "Exporter mes réponses (CSV, pour l'équipe)": "Export my answers (CSV, for the team)",

  /* Alerts */
  "Indiquez votre email pour voir le score gratuit.": "Enter your email to see the free score.",
  "Répondez aux 10 questions pour voir le résultat.": "Answer all 10 questions to see the result.",
  "Ecrivez vos 2 ou 3 phrases pour la review, puis envoyez.": "Write your 2 or 3 sentences for the review, then send.",
  "Aucun lead enregistré dans ce navigateur.": "No lead saved in this browser."
});
