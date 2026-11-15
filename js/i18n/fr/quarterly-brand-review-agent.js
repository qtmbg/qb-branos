/* fr · quarterly-brand-review-agent.html
   Quarter values, archetype and force names are stored and sent to the
   model in English. Only what is painted changes. « Q+1 » reads « T+1 »
   (trimestre suivant). */
QBI18N.add('fr', {
  /* ── Head ───────────────────────────────────────────────────────── */
  "Quarterly Brand Review · BrandOS": "Revue de marque trimestrielle · BrandOS",
  "The Quarterly Brand Review reads a quarter of data against your Brand Profile: what held, what drifted, what changes next, with proposed updates to the profile. Part of Hold in BrandOS. Not open yet.":
    "La Revue de marque trimestrielle lit un trimestre de données au regard de votre Profil de marque\u00a0: ce qui a tenu, ce qui a dérivé, ce qui change ensuite, avec des propositions de mise à jour du profil. Fait partie de Hold dans BrandOS. Pas encore ouvert.",

  /* ── Tool header and footer ─────────────────────────────────────── */
  "Quarterly Review": "Revue trimestrielle",
  "Input Data": "Saisie des données",
  "Intelligence": true,
  "Quarterly Brand Review / Hold": "Revue de marque trimestrielle / Hold",

  /* ── Step 1 · intro ─────────────────────────────────────────────── */
  "Quarterly Brand Review": "Revue de marque trimestrielle",
  "Feed the quarter's data. The agent reads it through your brand identity, proposes updates to the QBP from what it learned, and sets the strategic direction for the next 90 days.":
    "Donnez les données du trimestre. L’agent les lit à travers votre identité de marque, propose des mises à jour du QBP à partir de ce qu’il a appris et fixe la direction stratégique des 90 prochains jours.",

  /* ── Step 1 · current brand profile ─────────────────────────────── */
  "Current Brand Profile": "Profil de marque actuel",
  "* Required base context": "* Contexte de base obligatoire",
  "Brand Name *": "Nom de la marque *",
  "The brand under review": "La marque étudiée",
  "Natural Force": "Force naturelle",
  "The Ocean": "L’océan",
  "Lightning": "La foudre",
  "Wildfire": "Le feu de forêt",
  "The River": "La rivière",
  "The Earthquake": "Le séisme",
  "The Sunrise": "Le lever du soleil",
  "Archetype": "Archétype",
  "- select -": "- choisir -",
  "Brand Essence *": "Essence de marque *",
  "Brand Essence": "Essence de marque",
  "Current irreducible truth - one sentence": "La vérité irréductible actuelle, en une phrase",
  "The Spark (Narrative)": "L’Étincelle (récit)",
  "Current synthesis of who the brand is and why it exists":
    "La synthèse actuelle de ce qu’est la marque et de sa raison d’être",
  "Manifesto Line": "Phrase manifeste",
  "Current core belief": "Conviction centrale actuelle",
  "Primary Persona": "Persona principal",
  "Who the brand currently serves": "Ceux que la marque sert aujourd’hui",
  "Core Offer": "Offre centrale",
  "What the brand currently sells": "Ce que la marque vend aujourd’hui",
  "Anti-Brand": "Anti-marque",
  "What the brand refuses to be": "Ce que la marque refuse d’être",
  "Voice Notes": "Notes sur la voix",
  "How the brand currently writes and speaks": "Comment la marque écrit et parle aujourd’hui",

  /* ── Step 1 · quarter ───────────────────────────────────────────── */
  "Quarter Under Review": "Trimestre étudié",
  "* Required timeframe": "* Période obligatoire",
  "Quarter *": "Trimestre *",
  "Q1 (Jan–Mar)": "T1 (janv.–mars)",
  "Q2 (Apr–Jun)": "T2 (avr.–juin)",
  "Q3 (Jul–Sep)": "T3 (juil.–sept.)",
  "Q4 (Oct–Dec)": "T4 (oct.–déc.)",
  /* First line of the exported text. The quarter is part of the line, so
     each quarter has its own key, above the general pattern further down. */
  "QUARTERLY BRAND REVIEW - Q1 (Jan–Mar) {0}": "REVUE DE MARQUE TRIMESTRIELLE · T1 (janv.–mars) {0}",
  "QUARTERLY BRAND REVIEW - Q2 (Apr–Jun) {0}": "REVUE DE MARQUE TRIMESTRIELLE · T2 (avr.–juin) {0}",
  "QUARTERLY BRAND REVIEW - Q3 (Jul–Sep) {0}": "REVUE DE MARQUE TRIMESTRIELLE · T3 (juil.–sept.) {0}",
  "QUARTERLY BRAND REVIEW - Q4 (Oct–Dec) {0}": "REVUE DE MARQUE TRIMESTRIELLE · T4 (oct.–déc.) {0}",
  /* Exported text, one line per proposed update: "Brand Essence (strengthen):". */
  "{0} (strengthen):": "{0} (renforcer)\u00a0:",
  "{0} (evolve):": "{0} (faire évoluer)\u00a0:",
  "{0} (add):": "{0} (ajouter)\u00a0:",
  "{0} (recalibrate):": "{0} (recalibrer)\u00a0:",
  "Year": "Année",
  "e.g. 2026": "ex. 2026",

  /* ── Step 1 · performance data ──────────────────────────────────── */
  "Performance Data": "Données de performance",
  "Quantitative reality": "La réalité chiffrée",
  "Content Produced": "Contenu produit",
  "e.g. 24 IG posts, 12 LinkedIn posts, 3 YouTube videos, 6 newsletter issues":
    "ex. 24 publications Instagram, 12 publications LinkedIn, 3 vidéos YouTube, 6 numéros de newsletter",
  "Top Performers": "Meilleures performances",
  "Describe what performed best - which posts, topics, formats, and rough numbers":
    "Décrivez ce qui a le mieux marché\u00a0: quelles publications, quels sujets, quels formats, avec des chiffres approximatifs",
  "Lowest Performers": "Plus faibles performances",
  "What underperformed - and any patterns": "Ce qui a sous-performé, et les schémas éventuels",
  "Key Metrics": "Métriques clés",
  "Follower growth, engagement rates, reach, email list, website traffic - whatever you track":
    "Croissance des abonnés, taux d’engagement, portée, liste e-mail, trafic du site. Tout ce que vous suivez",
  "Business Outcomes": "Résultats commerciaux",
  "Leads, calls booked, sales, revenue attributable to content and brand activity":
    "Prospects, appels réservés, ventes, revenus attribuables au contenu et à l’activité de marque",

  /* ── Step 1 · reflection ────────────────────────────────────────── */
  "Reflection & Qualitative Data": "Réflexion et données qualitatives",
  "Founder intuition": "L’intuition du fondateur",
  "Audience Evolution": "Évolution de l’audience",
  "Who started showing up? Did the persona match? Any new segments?":
    "Qui a commencé à se montrer\u00a0? Le persona correspondait-il\u00a0? De nouveaux segments\u00a0?",
  "What Worked (Honest Read)": "Ce qui a marché (lecture honnête)",
  "What genuinely worked this quarter - in content, strategy, offer, or brand":
    "Ce qui a réellement marché ce trimestre\u00a0: contenu, stratégie, offre ou marque",
  "What Didn't (Honest Read)": "Ce qui n’a pas marché (lecture honnête)",
  "What failed, underperformed, or felt wrong - even if the numbers didn't reflect it yet":
    "Ce qui a échoué, sous-performé ou sonné faux, même si les chiffres ne le montraient pas encore",
  "Biggest Lesson": "La plus grande leçon",
  "The single most important thing you learned this quarter - about your brand, your audience, or yourself":
    "La chose la plus importante apprise ce trimestre, sur votre marque, votre audience ou vous-même",
  "Brand Feeling": "Ressenti de marque",
  "Honest gut check - did it feel like you? Did it feel coherent? Or did something feel off?":
    "Un ressenti honnête. Cela vous ressemblait-il\u00a0? Était-ce cohérent\u00a0? Ou quelque chose clochait-il\u00a0?",
  "Identity Drift": "Dérive d’identité",
  "Any moments where the brand drifted from its identity - in content, offers, or communication":
    "Les moments où la marque a dérivé de son identité\u00a0: contenu, offres ou communication",
  "Emerging Opportunities": "Opportunités émergentes",
  "What became visible this quarter that didn't exist before - new angles, audiences, formats, or moves":
    "Ce qui est devenu visible ce trimestre et n’existait pas avant\u00a0: nouveaux angles, audiences, formats ou gestes",
  "Goal for Q+1": "Objectif pour T+1",
  "What does success look like at the end of next quarter? Be specific.":
    "À quoi ressemble la réussite à la fin du prochain trimestre\u00a0? Soyez précis.",
  "Initialize Intelligence Run": "Lancer l’analyse",

  /* ── Errors ─────────────────────────────────────────────────────── */
  "Complete required fields: brand name, essence, quarter, and at least one data field.":
    "Remplissez les champs obligatoires\u00a0: nom de la marque, essence, trimestre et au moins un champ de données.",
  "Synthesis was unavailable. The review could not be generated. Try again in a moment.":
    "La synthèse était indisponible. La revue n’a pas pu être générée. Réessayez dans un instant.",
  "Agent anomaly: API error: HTTP {0}": "Anomalie de l’agent\u00a0: erreur d’API, HTTP {0}",
  "Agent anomaly: API error": "Anomalie de l’agent\u00a0: erreur d’API",
  "Agent anomaly: {0}": "Anomalie de l’agent\u00a0: {0}",

  /* ── Step 2 · processing ────────────────────────────────────────── */
  "Processing Intelligence": "Intelligence en cours de traitement",
  "Reading quarter's data through brand lens...": "Lecture des données du trimestre à travers le prisme de la marque…",
  "Evaluating brand performance & coherence...": "Évaluation de la performance et de la cohérence de marque…",
  "Extracting core intelligence traces...": "Extraction des traces d’intelligence essentielles…",
  "Proposing Quantum Brand Profile updates...": "Proposition de mises à jour du Quantum Brand Profile…",
  "Constructing Q+1 strategic directives...": "Construction des directives stratégiques de T+1…",
  "Assembling War Table initiatives...": "Assemblage des initiatives de la War Table…",

  /* ── Step 3 · results header ────────────────────────────────────── */
  "// Hold · Review complete": "// Hold · Revue terminée",
  "Brand analyzed · QBP updates proposed · Directives set": "Marque analysée · Mises à jour du QBP proposées · Directives fixées",
  "Export Text": "Exporter le texte",
  "New Run": "Nouvelle analyse",
  "Overall": "Global",
  "Coherence": "Cohérence",
  "Content": "Contenu",
  "Audience": true,
  "Commercial": true,

  /* Tabs */
  "Narrative": "Récit",
  "Learnings": "Enseignements",
  "QBP Updates ({0})": "Mises à jour QBP ({0})",
  "Q+1 Direction": "Direction T+1",
  "Directive": true,

  /* Narrative */
  "Quarter Narrative": "Récit du trimestre",
  "Grade Rationale": "Justification de la note",
  "Carry Forward": "À poursuivre",
  "Leave Behind": "À laisser derrière",

  /* Learnings */
  "Evidence": "Preuve",
  "Implication": true,

  /* QBP updates */
  "The profile holds strong. No structural updates required this quarter.":
    "Le profil tient bon. Aucune mise à jour structurelle requise ce trimestre.",
  "These are proposed updates to the QBP, drawn from what the quarter taught. They reflect what the brand has become - not what it was designed to be. Nothing is applied for you. Keep the changes that feel true. Leave those that feel reactive.":
    "Voici des propositions de mise à jour du QBP, tirées de ce que le trimestre a appris. Elles reflètent ce que la marque est devenue, pas ce pour quoi elle a été conçue. Rien n’est appliqué à votre place. Gardez les changements qui sonnent vrai. Laissez ceux qui semblent réactifs.",
  "STRENGTHEN": "RENFORCER",
  "EVOLVE": "FAIRE ÉVOLUER",
  "ADD": "AJOUTER",
  "RECALIBRATE": "RECALIBRER",
  "CURRENT STATE": "ÉTAT ACTUEL",
  "PROPOSED STATE": "ÉTAT PROPOSÉ",
  "Intelligence trace:": "Trace d’intelligence\u00a0:",

  /* Q+1 direction */
  "Next Quarter Theme": "Thème du prochain trimestre",
  "North Star Metric:": "Indicateur de cap\u00a0:",
  "Content Focus": "Priorité de contenu",
  "Primary format": "Format principal",
  "Primary angle": "Angle principal",
  "Voice evolution": "Évolution de la voix",
  "Platform Priority": "Priorité des plateformes",
  "Offer Signals": "Signaux de l’offre",
  "Identity Check": "Point sur l’identité",
  "Core To Protect": "Le cœur à protéger",

  /* War Table */
  "Primary Constraint": "Contrainte principale",
  "The binding resource for Q+1 execution": "La ressource qui limite l’exécution de T+1",
  "Time": "Temps",
  "Money": "Argent",
  "Clarity": "Clarté",
  "Team": "Équipe",
  "Trust": "Confiance",
  "NOW": "MAINTENANT",
  "NEXT": "ENSUITE",
  "LATER": "PLUS TARD",
  "PARK": "EN RÉSERVE",
  "low": "faible",
  "medium": "moyen",
  "high": "élevé",
  "effort": "en effort",
  "conviction": true,
  "Metric:": "Indicateur\u00a0:",

  /* Directive */
  "Strategic Directive - Execute The Following": "Directive stratégique · À exécuter",
  "Copy Directive": "Copier la directive"
});

/* Exported text. The .txt review built by Export Text.
   These lines never reach the DOM: the runtime translates the file and
   the clipboard line by line (js/qb-i18n.js, "Text that leaves the page"). */
QBI18N.add('fr', {
  "QUARTERLY BRAND REVIEW - {0} {1}": "REVUE DE MARQUE TRIMESTRIELLE · {0} {1}",
  "Generated by BrandOS - Quarterly Brand Review Agent": "Généré par BrandOS · Revue de marque trimestrielle",
  "Brand: {0}": "Marque : {0}",
  "QUARTER NARRATIVE:": "RÉCIT DU TRIMESTRE :",
  "GRADES:": "NOTES :",
  "KEY LEARNINGS:": "ENSEIGNEMENTS CLÉS :",
  "Evidence: {0}": "Preuve : {0}",
  "Implication: {0}": "Implication : {0}",
  "CARRY FORWARD:": "À POURSUIVRE :",
  "LEAVE BEHIND:": "À LAISSER DERRIÈRE :",
  "QBP UPDATES:": "MISES À JOUR DU QBP :",
  "Current: {0}": "Actuel : {0}",
  "Proposed: {0}": "Proposé : {0}",
  "Why: {0}": "Pourquoi : {0}",
  "NEXT QUARTER:": "TRIMESTRE SUIVANT :",
  "Theme: {0}": "Thème : {0}",
  "North Star: {0}": "Cap : {0}",
  "WAR TABLE:": "WAR TABLE :",
  "Constraint: {0}": "Contrainte : {0}",
  "NOW:": "MAINTENANT :",
  "NEXT:": "ENSUITE :",
  "PARK:": "EN RÉSERVE :",
  "CLOSING DIRECTIVE:": "DIRECTIVE FINALE :"
});
