/* fr · linkedin-strategy-agent.html
   Glossary and rules: docs/i18n/glossary-fr.md
   The no-break space French sets before : ; ? and inside guillemets is
   written as the escape \u00a0 so it stays visible in an editor. */
QBI18N.add('fr', {
  /* ── Shared agent chassis ─────────────────────────────────────────
     The LinkedIn, YouTube and newsletter agents share one template.
     This block is identical in the three dictionaries: the same English
     string reads the same in French on every page. Edit all three. */

  /* Footer blurb (short form) */
  "The Brand Operating System. From idea to orbit. Identity, look, voice, content, strategy. One connected platform.":
    "Le système d’exploitation de marque. De l’idée à l’orbite. Identité, allure, voix, contenu, stratégie. Une seule plateforme connectée.",

  /* The runtime writes og:locale itself and then reads its own write back
     as a string with no entry. Not copy. Belongs in common.js or a runtime
     fix; held here so the page audits clean. */
  "fr_FR": true,

  /* App header and step rail */
  "QB_BRANDOS": true,
  "QBP Input": "Saisie QBP",
  "Generating": "Génération",
  "Strategy": "Stratégie",
  "Newsletter": true,
  "Theme": "Thème",
  "THEME": "THÈME",
  "// Phase 03 - Content Creation": "// Phase 03 · Création de contenu",
  "Phase 03 - Content Creation": "Phase 03 · Création de contenu",

  /* Intake: labels */
  "* required": "* obligatoire",
  "Brand Name *": "Nom de la marque *",
  "Founder Name": "Nom du fondateur",
  "Brand Essence *": "Essence de marque *",
  "The Spark": "L’Étincelle",
  "Natural Force *": "Force naturelle *",
  "Primary Archetype *": "Archétype principal *",
  "Primary Persona *": "Persona principal *",
  "Core Offer *": "Offre principale *",
  "Transformation": true,
  "Method / Framework Name": "Nom de la méthode / du cadre",
  "Manifesto Line": "Phrase manifeste",
  "Anti-Brand": "Anti-marque",
  "Voice Notes": "Notes sur la voix",
  "Always / Never": "Toujours / Jamais",

  /* Intake: placeholders */
  "The irreducible truth": "La vérité irréductible",
  "Irreducible truth": "Vérité irréductible",
  "Who this brand is, why it exists, what transformation it creates": "Qui est cette marque, pourquoi elle existe, quelle transformation elle crée",
  "The one belief": "La conviction unique",
  "Before → after": "Avant → après",
  "e.g. Quantum Branding, BrandOS": "ex. Quantum Branding, BrandOS",

  /* Intake: selects. The stored value stays English. */
  "- select -": "- choisir -",
  "The Rebel": true,
  "The Sage": true,
  "The Creator": true,
  "The Ruler": true,
  "The Magician": true,
  "The Hero": true,
  "The Explorer": true,
  "The Caregiver": true,
  "The Jester": true,
  "The Everyman": true,
  "The Innocent": true,
  "The Ocean": "L’océan",
  "Lightning": "La foudre",
  "Wildfire": "Le feu de forêt",
  "The River": "La rivière",
  "The Earthquake": "Le séisme",
  "The Sunrise": "Le lever du soleil",

  /* Loading and results chrome */
  "Agent Processing": "L’agent travaille",
  "New Strategy": "Nouvelle stratégie",
  "Cadence": true,
  "Copy": "Copier",
  "Copied ✓": "Copié ✓",
  "COPY": "COPIER",
  "✓ COPIED": "✓ COPIÉ",

  /* Errors. Specific patterns sit above the general one: first match wins. */
  "Complete the required fields (*).": "Remplissez les champs obligatoires (*).",
  "Complete required fields (*).": "Remplissez les champs obligatoires (*).",
  "Synthesis was unavailable. The diagnostic was scored but the deep reading could not be generated. Try again in a moment.":
    "La synthèse était indisponible. Le diagnostic a été noté, mais la lecture approfondie n’a pas pu être générée. Réessayez dans un instant.",
  "Agent error: API error: HTTP {0}": "Erreur de l’agent\u00a0: erreur d’API, HTTP {0}",
  "Agent error: AI service error: {0}": "Erreur de l’agent\u00a0: erreur du service d’IA, {0}",
  "Agent error: {0}": "Erreur de l’agent\u00a0: {0}",
  "Agent error:": "Erreur de l’agent\u00a0:",
  "API error: HTTP {0}": "Erreur d’API, HTTP {0}",
  "AI service error: {0}": "Erreur du service d’IA, {0}",
  "AI request failed": "La requête à l’IA a échoué",
  "Empty response from AI service": "Réponse vide du service d’IA",

  /* Content approval loop, up to 3 revision rounds */
  "Content Review": "Revue du contenu",
  "approved ·": "validés ·",
  "pending ·": "en attente ·",
  "removed": "retirés",
  "All done ✓": "Tout est fait ✓",
  "Pending review": "En attente de revue",
  "Pending Review": "En attente de revue",
  "✓ Approved": "✓ Validé",
  "Removed": "Retiré",
  "Revising…": "Révision en cours…",
  "Revised - review again": "Révisé · à revoir",
  "Revised - Review Again": "Révisé · à revoir",
  "(Round {0}/3)": "(Tour {0}/3)",
  "(ROUND {0}/3)": "(TOUR {0}/3)",
  "✓ Approve": "✓ Valider",
  "↻ Revise": "↻ Réviser",
  "× Remove": "× Retirer",
  "Undo": "Annuler",
  "Generating revision…": "Génération de la révision…",
  "REVISION REQUEST": "DEMANDE DE RÉVISION",
  "Revision Request": "Demande de révision",
  "What should change? Be specific: e.g. 'Make the hook more direct' or 'Remove the question format'":
    "Que faut-il changer\u00a0? Soyez précis\u00a0: par exemple «\u00a0Rendre l’accroche plus directe\u00a0» ou «\u00a0Retirer la forme interrogative\u00a0»",
  "What should change? Be specific...": "Que faut-il changer\u00a0? Soyez précis...",
  "Submit Revision →": "Envoyer la révision →",
  "Cancel": "Annuler",

  /* ── This page ──────────────────────────────────────────────────── */

  /* Head */
  "LinkedIn Strategy Agent · BrandOS": "Agent de stratégie LinkedIn · BrandOS",
  "Build a LinkedIn strategy that puts your brand in the right professional rooms. Positioning, post formats, and a rhythm drawn from your Brand Profile.":
    "Construisez une stratégie LinkedIn qui place votre marque dans les bons cercles professionnels. Positionnement, formats de posts et un rythme tirés de votre Profil de marque.",

  /* App header, intro, footer */
  "LinkedIn Strategy Agent": "Agent de stratégie LinkedIn",
  "Two complete LinkedIn systems from one QBP input. Personal profile rewrite + 4 weeks of founder posts. Company page rewrite + 4 weeks of brand posts. Every post fully written and ready to publish.":
    "Deux systèmes LinkedIn complets à partir d’une seule saisie QBP. Réécriture du profil personnel + 4 semaines de posts du fondateur. Réécriture de la page entreprise + 4 semaines de posts de marque. Chaque post entièrement rédigé, prêt à publier.",
  "Phase 03 / LinkedIn Strategy Agent": "Phase 03 / Agent de stratégie LinkedIn",

  /* Intake */
  "Brand + Founder Core": "Cœur de marque + fondateur",
  "The practice / company name": "Le nom du cabinet ou de l’entreprise",
  "The personal profile owner": "Le titulaire du profil personnel",
  "The Spark - narrative synthesis": "L’Étincelle\u00a0: synthèse narrative",
  "Offer + Transformation": "Offre + transformation",
  "What you sell - be specific about format, price tier, transformation": "Ce que vous vendez. Précisez le format, le niveau de prix, la transformation",
  "Transformation - before → after": "Transformation\u00a0: avant → après",
  "e.g. Scattered identity + weak positioning → coherent brand system that commands premium":
    "ex. Identité dispersée + positionnement faible → système de marque cohérent qui impose des tarifs premium",
  "e.g. Quantum Branding, BrandOS, The Signal Scan": "ex. Quantum Branding, BrandOS, Signal Scan",
  "Price Point": "Niveau de prix",
  "e.g. $997, $5K–$25K, $197/mo": "ex. 997\u00a0$, 5\u00a0000 à 25\u00a0000\u00a0$, 197\u00a0$ par mois",
  "What this brand refuses to be on LinkedIn": "Ce que cette marque refuse d’être sur LinkedIn",
  "Audience + Goals": "Audience + objectifs",
  "Who reads this LinkedIn - role, struggle, desire, what they carry. Specific.":
    "Qui lit ce LinkedIn\u00a0: rôle, difficulté, désir, ce qu’il porte. Soyez précis.",
  "Specificity here determines how precisely the agent targets every post":
    "Plus vous êtes précis ici, plus l’agent cible chaque post avec exactitude",
  "LinkedIn Goal": "Objectif LinkedIn",
  "e.g. Book discovery calls, build waitlist, establish thought leadership, sell course":
    "ex. Décrocher des appels découverte, constituer une liste d’attente, asseoir une autorité d’expert, vendre une formation",
  "Voice + Profile Context": "Voix + contexte du profil",
  "How this brand writes - rhythm, register, what it sounds like": "Comment cette marque écrit\u00a0: rythme, registre, sonorité",
  "Writing rules - what this brand always does and never does in copy":
    "Règles d’écriture\u00a0: ce que cette marque fait toujours et ne fait jamais dans ses textes",
  "Founder Story - what brought you here": "Histoire du fondateur\u00a0: ce qui vous a mené ici",
  "The origin - what you escaped, what you discovered, what you're building instead":
    "L’origine\u00a0: ce que vous avez fui, ce que vous avez découvert, ce que vous construisez à la place",
  "Current Headline (to improve)": "Titre actuel (à améliorer)",
  "Paste current headline": "Collez le titre actuel",
  "Company Tagline (to improve)": "Signature de l’entreprise (à améliorer)",
  "Current company page tagline": "Signature actuelle de la page entreprise",
  "Current About (to rewrite)": "Section Infos actuelle (à réécrire)",
  "Paste current About section - the agent will rewrite it": "Collez la section Infos actuelle. L’agent la réécrira",
  "Generate Strategy": "Générer la stratégie",

  /* Loading */
  "Reading Quantum Brand Profile": "Lecture du Quantum Brand Profile",
  "Building personal authority positioning": "Construction du positionnement d’autorité personnel",
  "Rewriting profile headline + About": "Réécriture du titre de profil + Infos",
  "Architecting 4-week personal post arc": "Architecture de l’arc de posts personnels sur 4 semaines",
  "Writing 12 founder posts in brand voice": "Rédaction de 12 posts du fondateur dans la voix de marque",
  "Building company page strategy": "Construction de la stratégie de la page entreprise",
  "Writing 8 company posts in brand register": "Rédaction de 8 posts d’entreprise dans le registre de la marque",
  "Generating hashtag architecture": "Génération de l’architecture de hashtags",
  "Assembling complete LinkedIn pack": "Assemblage du pack LinkedIn complet",
  "2 PROFILES · 20 POSTS · 4-WEEK ARC": "2 PROFILS · 20 POSTS · ARC DE 4 SEMAINES",

  /* Results: header and tabs */
  "// Strategy Complete": "// Stratégie terminée",
  "2 profiles rewritten · 20 posts scripted · 4-week arc": "2 profils réécrits · 20 posts rédigés · arc de 4 semaines",
  "Export All": "Tout exporter",
  "Founder": "Fondateur",
  "- Personal": "· Personnel",
  "- Company": "· Entreprise",
  "Profile Rewrite": "Réécriture du profil",
  "4-Week Posts": "Posts sur 4 semaines",
  "{0} posts": "{0} posts",

  /* Results: strategy */
  "Strategic positioning": "Positionnement stratégique",
  "Content pillars": "Piliers de contenu",
  "Audience to target": "Audience à cibler",
  "Unique edge - what makes this account unmistakable": "Avantage unique\u00a0: ce qui rend ce compte reconnaissable entre tous",
  "4-week arc themes": "Thèmes de l’arc de 4 semaines",
  "WEEK": "SEMAINE",

  /* Results: profile rewrite */
  "Headline": "Titre",
  "About / Summary": "Infos / Résumé",
  "Featured section strategy": "Stratégie de la section Sélection",
  "Banner / cover image direction": "Direction de la bannière / image de couverture",
  "Profile photo direction": "Direction de la photo de profil",
  "Experience section positioning": "Positionnement de la section Expérience",
  "Connection + engagement strategy": "Stratégie de relations + engagement",

  /* Results: post cards. W is the week badge: S for semaine. */
  "W": "S",
  "W1": "S1",
  "W2": "S2",
  "W3": "S3",
  "W4": "S4",
  "Opening hook": "Accroche d’ouverture",
  "Hook type:": "Type d’accroche\u00a0:",
  "Full post": "Post complet",
  "Strategic purpose": "Objectif stratégique",
  "Call to Action": "Appel à l’action",
  "Hashtags": true,
  "Best time:": "Meilleur moment\u00a0:",

  /* Errors specific to this page */
  "Unexpected response structure - missing personal or company keys":
    "Structure de réponse inattendue\u00a0: clés «\u00a0personal\u00a0» ou «\u00a0company\u00a0» manquantes",
  "Unexpected response structure - posts must be arrays":
    "Structure de réponse inattendue\u00a0: les posts doivent être des tableaux",

  /* Values the prompt lists in English. The model answers in French, but
     when it hands one of these back as written, the pill reads French. */
  "Belief post": "Post de conviction",
  "Contrarian take": "Prise de position à contre-courant",
  "Personal story": "Histoire personnelle",
  "Framework reveal": "Révélation d’un cadre",
  "Industry challenge": "Remise en cause du secteur",
  "Behind the method": "Les coulisses de la méthode",
  "Transformation story": "Histoire de transformation",
  "Manifesto excerpt": "Extrait de manifeste",
  "Hot take": "Avis tranché",
  "Question post": "Post question",
  "Case study thread": "Fil étude de cas",
  "Observation": true,
  "Method breakdown": "Décryptage de la méthode",
  "Client result": "Résultat client",
  "Tool reveal": "Révélation d’un outil",
  "Framework post": "Post cadre",
  "Ecosystem post": "Post écosystème",
  "Problem/solution": "Problème/solution",
  "Social proof": "Preuve sociale",
  "Product feature": "Fonctionnalité produit",
  "Industry positioning": "Positionnement sectoriel",
  "Invitation post": "Post d’invitation",
  "curiosity gap": "brèche de curiosité",
  "bold statement": "affirmation audacieuse",
  "counter-intuitive": "contre-intuitif",
  "story open": "ouverture narrative",
  "direct challenge": "défi direct"
});
