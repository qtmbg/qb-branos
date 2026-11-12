/* fr · newsletter-architecture-agent.html
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
  "Newsletter Architecture Agent · BrandOS": "Agent d’architecture de newsletter · BrandOS",
  "Design a newsletter that compounds. Rhythm, segments, and signature sections drawn from your Brand Profile. Phase 04 inside BrandOS.":
    "Concevez une newsletter dont la valeur se cumule. Rythme, segments et rubriques distinctives tirés de votre Profil de marque. Phase 04 dans BrandOS.",

  /* App header and intro */
  "Newsletter Architecture Agent": "Agent d’architecture de newsletter",
  "The highest-leverage owned channel - no algorithm, direct access to the audience. This agent designs the full newsletter system and writes the first 4 issues completely.":
    "Le canal propriétaire au plus fort effet de levier\u00a0: aucun algorithme, un accès direct à l’audience. Cet agent conçoit le système de newsletter complet et rédige entièrement les 4 premiers numéros.",

  /* Intake */
  "Brand Core": "Cœur de marque",
  "The brand behind the newsletter": "La marque derrière la newsletter",
  "Author Name": "Nom de l’auteur",
  "Who writes it - the by-line": "Qui l’écrit\u00a0: le nom qui signe",
  "Audience + Offer": "Audience + offre",
  "Who subscribes - role, struggle, desire. Specific.": "Qui s’abonne\u00a0: rôle, difficulté, désir. Soyez précis.",
  "The more specific, the more precisely the issues will speak to the right person":
    "Plus vous êtes précis, plus les numéros parleront avec exactitude à la bonne personne",
  "What this brand sells - the newsletter must eventually lead here naturally":
    "Ce que vend cette marque. La newsletter doit finir par y mener naturellement",
  "Voice + Context": "Voix + contexte",
  "How this brand writes - rhythm, register, what it refuses to sound like":
    "Comment cette marque écrit\u00a0: rythme, registre, ce à quoi elle refuse de ressembler",
  "Writing rules for copy": "Règles d’écriture pour les textes",
  "What this newsletter refuses to be": "Ce que cette newsletter refuse d’être",
  "Newsletter Name Idea": "Idée de nom pour la newsletter",
  "Leave blank to generate, or suggest a direction": "Laissez vide pour en générer un, ou suggérez une direction",
  "Newsletter Goal": "Objectif de la newsletter",
  "e.g. Build audience, drive to offer": "ex. Construire une audience, mener vers l’offre",
  "Existing Newsletter (if any)": "Newsletter existante (le cas échéant)",
  "Current name, platform, cadence, what's working / not working": "Nom actuel, plateforme, cadence, ce qui fonctionne / ne fonctionne pas",
  "Build Newsletter System →": "Construire le système de newsletter →",

  /* Loading */
  "Agent Synthesizing": "L’agent synthétise",
  "Scanning Quantum Brand Profile...": "Analyse du Quantum Brand Profile...",
  "Designing newsletter architecture...": "Conception de l’architecture de la newsletter...",
  "Structuring signature format...": "Structuration du format distinctif...",
  "> Executing 4-issue content generation": "> Génération du contenu des 4 numéros",

  /* Results: header and tabs */
  "System Complete": "Système terminé",
  "Export Pack": "Exporter le pack",
  "New Session": "Nouvelle session",
  "Architecture": true,
  "4 Issues": "4 numéros",

  /* Results: architecture */
  "Newsletter Positioning": "Positionnement de la newsletter",
  "Name + Tagline": "Nom + signature",
  "Format + Structure": "Format + structure",
  "Ideal Reader": "Lecteur idéal",
  "Tone + Register": "Ton + registre",
  "Signature Elements": "Éléments distinctifs",
  "Growth Strategy": "Stratégie de croissance",
  "Platform Recommendation": "Plateforme recommandée",
  "Welcome Sequence Outline": "Plan de la séquence de bienvenue",

  /* Results: issue list and detail */
  "The Sequence": "La séquence",
  "NO.": "N°",
  "ISSUE": "NUMÉRO",
  "Full Issue": "Numéro complet",
  "Subject + Meta": "Objet + méta",
  "Growth Engine": "Moteur de croissance",
  "Opening - the hook": "Ouverture\u00a0: l’accroche",
  "Section {0}": "Section {0}",
  "Closing + CTA": "Conclusion + CTA",
  "P.S.": true,
  "Subject line": "Objet",
  "A/B variants": "Variantes A/B",
  "Preview text (inbox snippet)": "Texte d’aperçu (extrait en boîte de réception)",
  "Strategic purpose in the sequence": "Objectif stratégique dans la séquence",
  "Recommended delivery:": "Envoi recommandé\u00a0:",
  "Referral / forward hook": "Accroche de parrainage / transfert",
  "Repurpose angles": "Angles de déclinaison",

  /* Values the prompt lists in English. The model answers in French, but
     when it hands one of these back as written, the pill reads French. */
  "Manifesto": "Manifeste",
  "Deep dive": "Analyse approfondie",
  "Framework": "Cadre",
  "Story": "Récit",
  "Challenge": "Défi",
  "Observation": true
});
