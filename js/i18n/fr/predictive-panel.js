/* fr · predictive-panel..html (React, JSX)
   Glossary and rules: docs/i18n/glossary-fr.md
     is the no-break space French sets before : ; ? % and inside numbers.
   JSX splits a line at every {expression}, so "{n}% Risk" is the two nodes
   "42" and "% Risk". The system and user prompts are not here on purpose:
   they go to the model, never to the screen. */
QBI18N.add('fr', {
  /* ── Head ───────────────────────────────────────────────────────── */
  "Predictive Panel · BrandOS": true,
  "Pressure-test a brand or content decision before it ships. The Predictive Panel runs it past a synthetic audience built from your Brand Profile.":
    "Mettez une décision de marque ou de contenu à l’épreuve avant sa sortie. Predictive Panel la soumet à une audience synthétique construite à partir de votre Profil de marque.",

  /* ── Tool header and footer ─────────────────────────────────────── */
  "BRAND": true,
  "OS": true,
  "Toggle theme": "Changer de thème",
  "Parameters": "Paramètres",
  "Simulating": "Simulation",
  /* "Intelligence", the third step, stays as written (shared.js). */
  "Predictive Panel / Active": "Predictive Panel / Actif",

  /* ── Step 0 · parameters ────────────────────────────────────────── */
  "Simulation Parameters": "Paramètres de simulation",
  "Initialize a probabilistic market simulation. The engine will instantiate thousands of synthetic agents based on your persona parameters and test your product concept before capital is deployed.":
    "Lancez une simulation de marché probabiliste. Le moteur crée des milliers d’agents synthétiques à partir des paramètres de votre persona et teste votre concept de produit avant que le capital ne soit engagé.",
  "Simulation Scale": "Échelle de simulation",
  "1,000 agents / Fast": "1 000 agents / Rapide",
  "5,000 agents / Standard": "5 000 agents / Standard",
  "10,000 agents / Deep": "10 000 agents / Approfondi",

  "Identity Vector": "Vecteur d’identité",
  "Sourced from QBP": "Issu du QBP",
  "Brand Name *": "Nom de la marque *",
  "Entity executing the launch": "L’entité qui porte le lancement",
  "Natural Force": "Force naturelle",
  "e.g. Lightning, Gravity": "ex. La foudre, la gravité",
  "Brand Essence": "Essence de marque",
  "The irreducible core truth of the brand": "La vérité centrale et irréductible de la marque",
  "e.g. The Architect, The Catalyst": "ex. The Architect, The Catalyst",

  "Launch Variables": "Variables de lancement",
  "* Required": "* Obligatoire",
  "Target Persona *": "Persona cible *",
  "High specificity required. Define their role, immediate friction points, and latent desires.":
    "Soyez précis. Définissez son rôle, ses points de friction immédiats et ses désirs latents.",
  "Product / Offer Concept *": "Concept de produit / d’offre *",
  "Define the exact intervention. What is it, and what transformation does it enforce?":
    "Définissez l’intervention exacte. De quoi s’agit-il, et quelle transformation impose-t-elle ?",
  "Price Structure *": "Structure de prix *",
  "e.g. $2k/mo retainer, $99 one-time": "ex. Forfait à 2 000 $ par mois, 99 $ en une fois",
  "Primary Channel": "Canal principal",
  "e.g. Owned email, LinkedIn organic": "ex. E-mail en propre, LinkedIn organique",
  "Competitive Environment": "Environnement concurrentiel",
  "What existing solutions must be displaced?": "Quelles solutions existantes faut-il déloger ?",
  "Contextual Modifiers": "Facteurs de contexte",
  "Macro factors, urgency drivers, existing brand equity.": "Facteurs macro, moteurs d’urgence, capital de marque existant.",

  "Requires ~45s computation": "Environ 45 s de calcul",
  "Initialize Panel": "Lancer le panel",

  /* Errors. The specific pattern sits before the general one. */
  "Parameters incomplete. Please fill all required fields.": "Paramètres incomplets. Remplissez tous les champs obligatoires.",
  "Synthesis was unavailable. The diagnostic was scored but the deep reading could not be generated. Try again in a moment.":
    "La synthèse était indisponible. Le diagnostic a été noté, mais la lecture approfondie n’a pas pu être générée. Réessayez dans un instant.",
  "Panel disruption: API Error: {0}": "Perturbation du panel : erreur d’API {0}",
  "Panel disruption: {0}": "Perturbation du panel : {0}",

  /* ── Step 1 · running ───────────────────────────────────────────── */
  "Processing": "Traitement en cours",
  "Instantiating synthetic persona architecture...": "Création de l’architecture de personas synthétiques…",
  "Seeding {0} market agents from profile parameters...": "Génération de {0} agents de marché à partir des paramètres du profil…",
  "Running multi-variant scenario simulations...": "Exécution des simulations de scénarios à variantes multiples…",
  "Mapping probabilistic event distributions...": "Cartographie des distributions probabilistes d’événements…",
  "Identifying structural high-confidence zones...": "Repérage des zones structurelles de haute confiance…",
  "Stress-testing for critical failure points...": "Test de résistance sur les points de rupture critiques…",
  "Calculating brand-market entanglement vectors...": "Calcul des vecteurs d’intrication entre marque et marché…",
  "Compiling final panel intelligence...": "Compilation de l’analyse finale du panel…",

  /* "{n}%" is two nodes in JSX. French sets a no-break space before %. */
  "%": " %",

  /* Agent counts, as toLocaleString() writes them in an English browser */
  "1,000": "1 000",
  "5,000": "5 000",
  "10,000": "10 000",

  /* ── Step 2 · results ───────────────────────────────────────────── */
  "Simulation Complete /": "Simulation terminée /",
  "Agents": "agents",
  "Configure New": "Nouvelle simulation",
  "Overall Confidence": "Confiance globale",
  "Brand Alignment": "Alignement de marque",
  "Price Resistance": "Résistance au prix",

  /* Verdict badge */
  "GO - Launch Ready": "GO · Prêt au lancement",
  "NO-GO - Do Not Launch": "NO-GO · Ne pas lancer",
  "CONDITIONAL - Pivot Required": "CONDITIONNEL · Pivot requis",

  /* Tabs */
  "Scenarios": "Scénarios",
  "High Confidence": "Haute confiance",
  "Segments": true,
  "Failure Points": "Points de rupture",
  "Price & Channel": "Prix et canal",
  "Directive": true,

  /* Scenarios */
  "PRIMARY VECTOR": "VECTEUR PRINCIPAL",
  "Conditions:": "Conditions :",

  /* High confidence */
  "Structural invariants. These findings maintain stability across all tested scenarios.":
    "Invariants structurels. Ces constats restent stables dans tous les scénarios testés.",
  "EXPLOITABLE": true,
  "Strategic Edge": "Avantage stratégique",

  /* Segments */
  "Behavioral divergence across the simulated population.": "Divergences de comportement au sein de la population simulée.",
  "Population Share:": "Part de la population :",
  "Conversion": true,

  /* Failure points */
  "Identified systemic vulnerabilities. Pre-solve these before execution.": "Vulnérabilités systémiques identifiées. Réglez-les avant l’exécution.",
  "% Risk": " % de risque",
  "Trigger Condition": "Condition déclenchante",
  "Required Mitigation": "Atténuation requise",
  "Recommended Pivots": "Pivots recommandés",
  "Gain:": "Gain :",
  "Friction:": "Friction :",
  "low": "faible",
  "medium": "moyenne",
  "high": "élevée",

  /* Price and channel */
  "Economic Elasticity": "Élasticité économique",
  "Vector:": "Vecteur :",
  "ON TARGET": "DANS LA CIBLE",
  "TOO HIGH": "TROP ÉLEVÉ",
  "TOO LOW": "TROP BAS",
  "SLIGHTLY HIGH": "UN PEU ÉLEVÉ",
  "SLIGHTLY LOW": "UN PEU BAS",
  "Tolerance Threshold (Resistance)": "Seuil de tolérance (résistance)",
  "Distribution Fit": "Adéquation de la distribution",
  "Brand Coherence": "Cohérence de marque",

  /* Directive */
  "Executive Summary": "Synthèse",
  "Copy Directive": "Copier la directive",
  "Pre-Flight Protocol": "Protocole avant lancement",
  "ready": "prêt",
  "needs work": "à travailler",
  "critical gap": "écart critique",

  /* ── Footer blurb (short variant; common.js holds the long one) ─── */
  "The Brand Operating System. From idea to orbit. Identity, look, voice, content, strategy. One connected platform.":
    "Le système d’exploitation de marque. De l’idée à l’orbite. Identité, allure, voix, contenu, stratégie. Une seule plateforme connectée."
});
