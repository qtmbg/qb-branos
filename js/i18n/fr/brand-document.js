/* fr · brand-document.html
   Glossary and rules: docs/i18n/glossary-fr.md
   The document assembles what the tools wrote to the Brand Profile. Profile
   values are data and stay as stored; labels, states and exports are here. */
QBI18N.add('fr', {
  /* ── Head ── */
  "Your Brand Document · BrandOS": "Votre document de marque · BrandOS",

  /* ── Header actions and their states ── */
  "Go back": "Retour",
  "← Back": "← Retour",
  "Download brand document as PPTX": "Télécharger le document de marque en PPTX",
  "↓ Download PPTX": "↓ Télécharger le PPTX",
  "Download brand document as marketing-style PPTX": "Télécharger le document de marque en PPTX au format marketing",
  "↓ Marketing deck": "↓ Deck marketing",
  "Send brand document to my inbox": "Envoyer le document de marque dans ma boîte mail",
  "✉ Send to inbox": "✉ Envoyer par e-mail",
  "Download brand document as PDF": "Télécharger le document de marque en PDF",
  "↓ Download PDF": "↓ Télécharger le PDF",
  "Generating…": "Génération…",
  "Generating PDF, please wait": "Génération du PDF, veuillez patienter",
  "Sending…": "Envoi…",
  "✓ Sent to inbox": "✓ Envoyé par e-mail",
  "✗ Try again": "✗ Réessayer",
  "✗ Sign in to receive": "✗ Connexion requise",

  /* ── sendDocByEmail() reads the button label back from the DOM and restores it, so the French label comes back as source text. Declared so it is not counted as a miss. ── */
  "✉ Envoyer par e-mail": true,

  /* ── alert() messages ── */
  "PDF generation failed. Use Ctrl+P / Cmd+P to print as PDF instead.":
    "La génération du PDF a échoué. Utilisez Ctrl+P / Cmd+P pour imprimer en PDF à la place.",
  "PPTX export still loading - try again in a second.": "L’export PPTX charge encore. Réessayez dans une seconde.",
  "PPTX generation failed. See console for details.": "La génération du PPTX a échoué. Le détail est dans la console.",

  /* ── Completion meter ── */
  "{0}% complete": "Terminé à {0}\u00a0%",
  "Complete Phase 01 tools to fill your brand document": "Terminez les outils de la Phase 01 pour remplir votre document de marque",
  "All Phase 01 tools complete. Your brand document is ready to download.":
    "Tous les outils de la Phase 01 sont terminés. Votre document de marque est prêt à être téléchargé.",
  "{0} of {1} Phase 01 tools complete": "{0} sur {1} outils de la Phase 01 terminés",
  "Brand document completion": "Avancement du document de marque",
  "Soul Map": true,

  /* ── Cover ── */
  "Entangled Time - Brand Operating System": "Entangled Time · Système d’exploitation de marque",
  "Quantum Brand Profile - Complete Identity Document": "Quantum Brand Profile · Document d’identité complet",

  /* ── Cover date. The page formats it in en-US: "Generated: November 12, 2026 ·". ── */
  "Generated: January {0}, {1} ·": "Généré le {0} janvier {1} ·",
  "Generated: February {0}, {1} ·": "Généré le {0} février {1} ·",
  "Generated: March {0}, {1} ·": "Généré le {0} mars {1} ·",
  "Generated: April {0}, {1} ·": "Généré le {0} avril {1} ·",
  "Generated: May {0}, {1} ·": "Généré le {0} mai {1} ·",
  "Generated: June {0}, {1} ·": "Généré le {0} juin {1} ·",
  "Generated: July {0}, {1} ·": "Généré le {0} juillet {1} ·",
  "Generated: August {0}, {1} ·": "Généré le {0} août {1} ·",
  "Generated: September {0}, {1} ·": "Généré le {0} septembre {1} ·",
  "Generated: October {0}, {1} ·": "Généré le {0} octobre {1} ·",
  "Generated: November {0}, {1} ·": "Généré le {0} novembre {1} ·",
  "Generated: December {0}, {1} ·": "Généré le {0} décembre {1} ·",

  /* ── Section titles and states ── */
  "Archetype Trinity": "Trinité d’archétypes",
  "Identity Core": "Cœur d’identité",
  "Sensory Universe": "Univers sensoriel",
  "Strategic Direction": "Direction stratégique",
  "Buyer Personas": "Personas d’acheteurs",
  "Complete QBP Summary": "Synthèse complète du QBP",
  "Auto-generated": "Généré automatiquement",
  "Pending": "En attente",
  "✓ Complete": "✓ Terminé",
  "Complete @@ .empty-section-text": "Terminez",
  "to populate this section": "pour remplir cette section",
  "Open {0} →": "Ouvrir {0} →",
  "is recorded as complete, but the synthesis output isn't in your profile yet. Re-run to generate it.":
    "est enregistré comme terminé, mais sa synthèse n’est pas encore dans votre profil. Relancez-le pour la générer.",
  "Re-run {0} →": "Relancer {0} →",

  /* ── Field labels ── */
  "Headline": "Titre",
  "Primary Archetype": "Archétype principal",
  "Secondary Archetype": "Archétype secondaire",
  "Tension Archetype": "Archétype de tension",
  "The Fusion": "La fusion",
  "Core Motivation": "Motivation profonde",
  "Core Fear": "Peur profonde",
  "Tone Register": "Registre de ton",
  "Central Paradox": "Paradoxe central",
  "Decision Filter": "Filtre de décision",
  "First Move (this week)": "Première action (cette semaine)",
  "Brand Essence": "Essence de marque",
  "The Spark": "L’Étincelle",
  "Manifesto Line": "Phrase manifeste",
  "Anti-Brand": "Anti-marque",
  "Primary Persona": "Persona principal",
  "Color Territory": "Territoire de couleur",
  "Visual Territory": "Territoire visuel",
  "Typography Direction": "Direction typographique",
  "Brand Object + Moment": "Objet de marque + moment",
  "Images Kept": "Images gardées",
  "Discard Rate": "Taux d’images écartées",
  "Strategic Challenge": "Défi stratégique",
  "Primary Goal": "Objectif principal",
  "Hook": "Accroche",
  "Mindset": "État d’esprit",
  "Binding insight": "Constat qui relie",
  "Brand Name": "Nom de la marque",
  "Natural Force": "Force naturelle",
  "Core Offer": "Offre centrale",
  "Voice Notes": "Notes sur la voix",

  /* ── Empty field line. The page lowercases the label inside the sentence, so each label has a lowercase entry that reads as a noun phrase. "archetype" is also a field-name chip in shared.js; this page needs the noun phrase. ── */
  "Complete {0} in the tool to fill this field": "Renseignez {0} dans l’outil pour remplir ce champ",
  "headline": "le titre",
  "primary archetype": "l’archétype principal",
  "secondary archetype": "l’archétype secondaire",
  "tension archetype": "l’archétype de tension",
  "the fusion": "la fusion",
  "core motivation": "la motivation profonde",
  "core fear": "la peur profonde",
  "tone register": "le registre de ton",
  "central paradox": "le paradoxe central",
  "decision filter": "le filtre de décision",
  "first move (this week)": "la première action (cette semaine)",
  "brand essence": "l’essence de marque",
  "the spark": "l’étincelle",
  "manifesto line": "la ligne de manifeste",
  "anti-brand": "l’anti-marque",
  "always / never": "la partie toujours / jamais",
  "primary persona": "le persona principal",
  "color territory": "le territoire de couleur",
  "visual territory": "le territoire visuel",
  "typography direction": "la direction typographique",
  "brand object + moment": "l’objet de marque et le moment",
  "images kept": "les images gardées",
  "discard rate": "le taux d’images écartées",
  "strategic challenge": "le défi stratégique",
  "primary goal": "l’objectif principal",
  "hook": "l’accroche",
  "mindset": "l’état d’esprit",
  "binding insight": "le constat qui relie",
  "brand name": "le nom de la marque",
  "natural force": "la force naturelle",
  "archetype": "l’archétype",
  "core offer": "l’offre centrale",
  "voice notes": "les notes de voix",

  /* ── Visual DNA section ── */
  "{0} reference images selected": "{0} images de référence sélectionnées",
  "{0}% — indicates visual selectivity": "{0}\u00a0%, un indice de sélectivité visuelle",
  "Fast Discards — Your Visual Blocklist": "Écartées d’emblée · Votre liste d’exclusion visuelle",
  "Images rejected in under 3 seconds — these define what the brand is NOT. Provide this list to your designer as a negative reference.":
    "Des images écartées en moins de 3 secondes. Elles définissent ce que la marque n’est PAS. Remettez cette liste à votre designer comme référence négative.",
  "Designer Note": "Note pour le designer",
  "Your Visual DNA Brief is complete. The kept images define your visual world. The fast discards define your visual blocklist. Share both sets with your designer or use them as Midjourney reference images.":
    "Votre brief Visual DNA est terminé. Les images gardées définissent votre monde visuel. Les images écartées d’emblée définissent votre liste d’exclusion visuelle. Partagez les deux séries avec votre designer ou utilisez-les comme images de référence dans Midjourney.",

  /* ── War Table section ── */
  "Top Initiatives (by score)": "Initiatives prioritaires (par score)",
  "War Table complete. Your full 60-day field plan and Strategic Command Document are available in the War Table tool.":
    "War Table terminé. Votre plan de terrain complet sur 60 jours et votre Document de commandement stratégique sont disponibles dans l’outil War Table.",

  /* ── The Profiles section ── */
  "Persona {0}": true,
  "Pain points": "Points de douleur",
  "Marketing approach": "Approche marketing",
  "Common themes across all three": "Thèmes communs aux trois",
  "Shared key takeaways": "Points clés communs",

  /* ── Values Brand Soul Map stores in the profile with an English prefix. Only the painted prefix changes. ── */
  "Always: {0} | Never: {1}": "Toujours\u00a0: {0} | Jamais\u00a0: {1}",
  "Always: {0}": "Toujours\u00a0: {0}",
  "| Never: {0}": "| Jamais\u00a0: {0}",
  "We refuse to: {0}": "Nous refusons de\u00a0: {0}",

  /* ── Footer ── */
});
