/* fr · youtube-strategy-agent.html
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
  "YouTube Strategy Agent · BrandOS": "Agent de stratégie YouTube · BrandOS",
  "Plot a YouTube content stack from your Brand Profile: short-form hooks, long-form anchors, and the shelf logic that keeps a viewer moving.":
    "Tracez une pile de contenus YouTube à partir de votre Profil de marque\u00a0: accroches en format court, piliers en format long, et la logique de sections qui garde le spectateur en mouvement.",

  /* App header, intro, footer */
  "YouTube Strategy Agent": "Agent de stratégie YouTube",
  "Channel positioning, 3 series architectures, 6 fully scripted videos, and a repurpose pack for each - Reels, LinkedIn posts, and newsletter angles. One brand, every platform.":
    "Positionnement de la chaîne, 3 architectures de séries, 6 vidéos entièrement scénarisées, et un pack de déclinaisons pour chacune\u00a0: Reels, posts LinkedIn et angles de newsletter. Une marque, toutes les plateformes.",
  "YouTube Strategy Agent / Phase 03": "Agent de stratégie YouTube / Phase 03",

  /* Intake */
  "Brand & Channel Core": "Cœur de marque et de chaîne",
  "The brand behind the channel": "La marque derrière la chaîne",
  "Host Name *": "Nom du présentateur *",
  "Who appears on camera": "Qui apparaît à l’écran",
  "Offer & Method": "Offre et méthode",
  "Who watches - their role, struggle, desire. Specific.": "Qui regarde\u00a0: son rôle, sa difficulté, son désir. Soyez précis.",
  "The more specific, the more precisely targeted every script will be": "Plus vous êtes précis, plus chaque script sera ciblé avec exactitude",
  "What you sell - format and transformation": "Ce que vous vendez\u00a0: format et transformation",
  "Voice & Production": "Voix et production",
  "How this brand talks on video - rhythm, tone, what it refuses to sound like":
    "Comment cette marque parle en vidéo\u00a0: rythme, ton, ce à quoi elle refuse de ressembler",
  "What this channel refuses to be": "Ce que cette chaîne refuse d’être",
  "Video Style Preference": "Style de vidéo préféré",
  "e.g. Talking head, B-roll heavy, essay style, documentary": "ex. Face caméra, riche en plans de coupe, style essai, documentaire",
  "Channel Goal": "Objectif de la chaîne",
  "e.g. Build authority, drive discovery calls, grow audience": "ex. Asseoir une autorité, générer des appels découverte, développer l’audience",
  "Existing Content / What's been done": "Contenu existant / Ce qui a été fait",
  "Any existing videos or content directions to build on or avoid": "Vidéos ou directions de contenu existantes, à prolonger ou à éviter",
  "Generate YouTube Strategy →": "Générer la stratégie YouTube →",

  /* Loading */
  "Weaving identity into narrative architecture...": "Tissage de l’identité en architecture narrative...",
  "3 series · 6 scripts · 18 reels · full repurpose": "3 séries · 6 scripts · 18 reels · déclinaison complète",

  /* Results: header and tabs */
  "// YouTube Strategy - Complete": "// Stratégie YouTube · Terminée",
  "3 series · 6 videos · 18 reels · complete repurpose system": "3 séries · 6 vidéos · 18 reels · système de déclinaison complet",
  "Export Scripts": "Exporter les scripts",
  "Channel Strategy": "Stratégie de chaîne",
  "Scripts + Repurpose": "Scripts + déclinaisons",

  /* Results: channel strategy */
  "Channel positioning statement": "Énoncé de positionnement de la chaîne",
  "Channel premise": "Principe de la chaîne",
  "Target viewer": "Spectateur cible",
  "Series": "Série",
  "Channel page optimizations": "Optimisations de la page de chaîne",
  "Repurpose flywheel": "Boucle de déclinaison",

  /* Results: video list and detail */
  "6 videos - select to view": "6 vidéos\u00a0: sélectionnez pour afficher",
  "EP": true,
  "script": true,
  "thumbnail": "miniature",
  "Repurpose": "Déclinaisons",
  "metadata": "métadonnées",
  "Hook - first 30 seconds": "Accroche\u00a0: 30 premières secondes",
  "Intro - context + promise": "Intro\u00a0: contexte + promesse",
  "Act {0} - {1}": "Acte {0}\u00a0: {1}",
  "Body section": "Section du corps",
  "Transition / midpoint": "Transition / milieu",
  "CTA - end card": "CTA\u00a0: écran de fin",
  "Thumbnail concept": "Concept de miniature",
  "On-image text": "Texte sur l’image",
  "Midjourney prompt": "Prompt Midjourney",
  "Title variants - A/B test these": "Variantes de titre\u00a0: à tester en A/B",
  "One video →": "Une vidéo →",
  "repurposed assets. Same intelligence, different surfaces.": "contenus déclinés. La même intelligence, d’autres surfaces.",
  "Reel / Short": true,
  "Hook": "Accroche",
  "Script": true,
  "LinkedIn post - from this video": "Post LinkedIn\u00a0: tiré de cette vidéo",
  "Tweet thread - from this video": "Fil de tweets\u00a0: tiré de cette vidéo",
  "Newsletter angle": "Angle de newsletter",
  "Video description (YouTube)": "Description de la vidéo (YouTube)",
  "Tags": true,

  /* Errors specific to this page */
  "AI returned no videos": "L’IA n’a renvoyé aucune vidéo",

  /* Values the prompt lists in English. The model answers in French, but
     when it hands one of these back as written, the pill reads French. */
  "Talking head": "Face caméra",
  "Essay": "Essai",
  "Tutorial": "Tutoriel",
  "Interview": true,
  "Documentary": "Documentaire",
  "Manifesto": "Manifeste",
  "Instagram Reels": true,
  "TikTok": true,
  "YouTube Shorts": true
});

/* Exported text. The .txt pack built by the export button.
   These lines never reach the DOM: the runtime translates the file and
   the clipboard line by line (js/qb-i18n.js, "Text that leaves the page"). */
QBI18N.add('fr', {
  "YOUTUBE STRATEGY PACK - {0}": "PACK DE STRATÉGIE YOUTUBE · {0}",
  "Generated by BrandOS - YouTube Strategy Agent": "Généré par BrandOS · Agent de stratégie YouTube",
  "Series: {0} | Format: {1} | {2}": "Série : {0} | Format : {1} | {2}",
  "HOOK:": "ACCROCHE :",
  "INTRO:": "INTRO :",
  "ACT {0} - {1}:": "ACTE {0} · {1} :",
  "CTA:": "CTA :",
  "REELS:": "REELS :"
});
