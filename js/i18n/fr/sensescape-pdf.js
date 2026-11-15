/* fr · sensescape-pdf.html
   Glossary and rules: docs/i18n/glossary-fr.md
   The tool's own labels come from sensescape.js: the page title, and the
   labels above each answer ("The brand object", "Sound signature", ...).
   That file loads after this one, so a key present in both takes the tool's
   rendering. */
QBI18N.include('fr', 'sensescape');

QBI18N.add('fr', {
  /* ── Controls ───────────────────────────────────────────────────── */
  "Sensescape Report": "Rapport Sensescape",
  "↓ Save as PDF": "↓ Enregistrer en PDF",

  /* ── Cover ──────────────────────────────────────────────────────── */
  "Sensescape · Sensory World": "Sensescape · Monde sensoriel",
  "Strategic Brand Report": "Rapport stratégique de marque",
  "{0} · Brand Intelligence": "{0} · Intelligence de marque",
  "Generated": "Généré le",
  "For": "Pour",
  "Founder": "Fondateur",
  "Methodology": "Méthode",

  /* Cover date. The page writes it with the en-GB locale: "12 November 2026". */
  "{0} January {1}": "{0} janvier {1}",
  "{0} February {1}": "{0} février {1}",
  "{0} March {1}": "{0} mars {1}",
  "{0} April {1}": "{0} avril {1}",
  "{0} May {1}": "{0} mai {1}",
  "{0} June {1}": "{0} juin {1}",
  "{0} July {1}": "{0} juillet {1}",
  "{0} August {1}": "{0} août {1}",
  "{0} September {1}": "{0} septembre {1}",
  "{0} October {1}": "{0} octobre {1}",
  "{0} November {1}": "{0} novembre {1}",
  "{0} December {1}": "{0} décembre {1}",

  /* ── Main page ──────────────────────────────────────────────────── */
  "Sensory Architecture": "Architecture sensorielle",
  "01 · Sensory World": "01 · Monde sensoriel",
  "The physical world": "Le monde physique",
  "of your brand": "de votre marque",
  /* What Sensescape saves as its visual territory. The profile keeps the
     English; each part is painted as its own text. The label itself
     ("Visual territory") and "Your Brand" are held by shared.js. */
  "Photography-led": "Dominante photographie",
  "Illustration-led": "Dominante illustration",
  "Mixed photography & illustration": "Photographie et illustration mêlées",
  "high contrast": "contraste fort",
  "soft gradients": "dégradés doux",
  "futuristic visual language": "langage visuel futuriste",
  "nostalgic visual language": "langage visuel nostalgique",
  /* Fields no tool writes today. Shown when a profile carries them. */
  "Sensory Profile": "Profil sensoriel",
  "Color Direction": "Direction couleur",
  "Typography Direction": "Direction typographique",
  /* The paradox comes from Brand Soul Map, when it has been done. */
  "02 · Brand Paradox": "02 · Paradoxe de marque",
  "The tension": "La tension",
  "that makes you real": "qui vous rend réel",
  "The Paradox": "Le paradoxe",
  /* Nothing from Sensescape in the profile yet. */
  "Not filled yet": "Pas encore rempli",
  "This report fills from your Sensescape answers. None are saved on this device yet.":
    "Ce rapport se remplit à partir de vos réponses Sensescape. Aucune n’est enregistrée sur cet appareil pour l’instant.",

  /* The script also carries labels it never reaches: a generic default and
     a War Table branch (its tool id is fixed to sensescape). Covered so the
     source reads clean. */
  "BrandOS Report": "Rapport BrandOS",
  "Foundation report": "Rapport de la fondation",
  "Brand Intelligence": "Intelligence de marque",
  "War Table · Strategic Priorities": "War Table · Priorités stratégiques",
  "War Table Report": "Rapport War Table",
  "Strategic Intelligence": "Intelligence stratégique",
  "01 · Strategic Priorities": "01 · Priorités stratégiques",
  "Where you": "Là où vous",
  "commit your force": "engagez vos forces",
  "Priority {0}": "Priorité {0}",
  "02 · Competitive Landscape": "02 · Paysage concurrentiel",
  "Who shares": "Qui partage",
  "your territory": "votre territoire",
  "Landscape Intelligence": "Lecture du paysage",

  /* ── Closing page and colophon ──────────────────────────────────── */
  "Document Complete": "Document terminé",
  "Your brand intelligence": "Votre intelligence de marque",
  "is building.": "se construit.",
  "Each foundation exercise adds a layer to your Quantum Brand Profile. Every output flows automatically into the tools that follow. Nothing gets repeated. Everything compounds.":
    "Chaque exercice de la fondation ajoute une couche à votre Quantum Brand Profile. Chaque résultat alimente automatiquement les outils qui suivent. Rien ne se répète. Tout se cumule.",
  "Continue in BrandOS →": "Continuer dans BrandOS →",
  "Created by": "Créé par"
});
