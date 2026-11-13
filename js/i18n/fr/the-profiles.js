/* fr · the-profiles.html
   Glossary and rules: docs/i18n/glossary-fr.md
     is the no-break space French sets before : ; ? and inside guillemets.
   Category, stage and field labels stay English in the data (QBP, exports,
   prompts); only the painted text changes. The prompts sent to the model are
   not here on purpose.
   "Journey" is rendered "cheminement". The usual French word for a buyer's
   path is on the glossary's banned list.
   Pattern order matters. A specific pattern sits before a general one. */
QBI18N.add('fr', {
  /* ── Head ───────────────────────────────────────────────────────── */
  "The Profiles · BrandOS": true,
  "Three full buyer personas built across biography, pain, journey, and psychology. Phase 01 of BrandOS.":
    "Trois personas d’acheteurs complets, construits à travers la biographie, la douleur, le cheminement et la psychologie. Phase 01 de BrandOS.",
  "Three full buyer personas: NOW, NEXT, NORTH STAR.": "Trois personas d’acheteurs complets : NOW, NEXT, NORTH STAR.",

  /* ── Tool header ────────────────────────────────────────────────── */
  "Phase 01 · The Profiles": true,
  "Chapter {0} · {1}": "Chapitre {0} · {1}",
  "Three Seats": "Trois sièges",
  "Biographies + Hooks": "Biographies + accroches",
  "Pain Map": "Carte des douleurs",
  "Journey Map": "Carte du cheminement",
  "Psychological X-Ray": "Radiographie psychologique",
  "Common Thread": "Fil conducteur",
  "Synthesis": "Synthèse",
  "Save and exit": "Enregistrer et quitter",
  "Progress saved. You can return any time.": "Progression enregistrée. Revenez quand vous voulez.",

  /* ── Shared pieces. "Continue", "Cancel", "First name" and "Open
     Foundation" are in shared.js. ─────────────────────────────────── */
  "Persona 1": true,
  "Persona 2": true,
  "Persona 3": true,
  "Back": "Retour",
  "Generate": "Générer",
  "// Working": "// En cours",
  "try again": "réessayez",
  "No API key configured": "aucune clé API configurée",

  /* ── Intro ──────────────────────────────────────────────────────── */
  "Phase 01 · The Profiles · The journey": "Phase 01 · The Profiles · Le cheminement",
  "Three buyers.": "Trois acheteurs.",
  "Three lives.": "Trois vies.",
  "An hour of structured depth. Identity, pain, journey, psychology. By the end you have three complete persona briefs in the format your strategy work demands.":
    "Une heure de profondeur structurée. Identité, douleur, cheminement, psychologie. À la fin, vous avez trois briefs de persona complets, au format qu’exige votre travail stratégique.",
  "Built in coherence with Brand Soul Map. Reads from your QBP. Writes back when complete.":
    "Conçu en cohérence avec Brand Soul Map. Lit votre QBP. Y écrit une fois terminé.",
  "Saved progress detected.": "Progression enregistrée détectée.",
  "Resume where you left off": "Reprenez là où vous vous êtes arrêté",
  "or start over below.": "ou recommencez ci-dessous.",

  "PHASE {0}": "PHASE {0}",
  "5 min": true,
  "18 min": true,
  "10 min": true,
  "15 min": true,
  "8 min": true,
  "3 min": true,
  "Three names. Three roles. The three humans your brand serves.": "Trois prénoms. Trois rôles. Les trois personnes que sert votre marque.",
  "Biographies and Hooks": "Biographies et accroches",
  "Build each persona from the inside out. Identity, mindset, and the line that captures their situation.":
    "Construisez chaque persona de l’intérieur. Identité, état d’esprit, et la phrase qui saisit sa situation.",
  "The Pain Map": "La carte des douleurs",
  "Five pain categories across all three personas. Cross-cutting, side by side.": "Cinq catégories de douleur pour les trois personas. En transversal, côte à côte.",
  "The Journey Map": "La carte du cheminement",
  "Five stages from awareness to advocacy. Four columns. Built one stage at a time.":
    "Cinq étapes, de la prise de conscience à la recommandation. Quatre colonnes. Une étape à la fois.",
  "Six psychological patterns per persona. Generated from your inputs. You sharpen.":
    "Six schémas psychologiques par persona. Générés à partir de vos saisies. Vous affûtez.",
  "The Common Thread": "Le fil conducteur",
  "What runs through all three. The single insight that becomes your strategic core.":
    "Ce qui traverse les trois. Le constat unique qui devient votre noyau stratégique.",
  "The Synthesis": "La synthèse",
  "Final deliverable assembled. Three full persona briefs. Ready to share.": "Livrable final assemblé. Trois briefs de persona complets. Prêts à partager.",

  "Begin · 60 minutes": "Commencer · 60 minutes",
  "Reset": "Réinitialiser",
  "Clear all saved progress and start over?": "Effacer toute la progression enregistrée et recommencer ?",

  /* ── Phase I · three seats ──────────────────────────────────────── */
  "Phase I · The Three Seats": "Phase I · Les trois sièges",
  "Who is in the room?": "Qui est dans la pièce ?",
  "Three buyers. Three names. Three roles. Three opening lines. Begin specific. The rest of the hour builds on whatever you write here, so do not generalize.":
    "Trois acheteurs. Trois prénoms. Trois rôles. Trois phrases d’ouverture. Soyez précis dès le départ. Le reste de l’heure se construit sur ce que vous écrivez ici, alors ne généralisez pas.",
  "Seat {0}": "Siège {0}",
  "Real-feeling. Not 'CEO Type A'. Pick a name your client could say out loud.":
    "Un prénom qui sonne vrai. Pas « PDG type A ». Choisissez un prénom que votre client pourrait dire à voix haute.",
  "Paul": true,
  "Jess": true,
  "Sam": true,
  "Role and context": "Rôle et contexte",
  "Specific job title plus the situation they are in. Not a category.":
    "Un intitulé de poste précis, plus la situation dans laquelle il se trouve. Pas une catégorie.",
  "e.g. Director of Planning, Design and Construction at a major academic medical center":
    "ex. Directeur de la planification, de la conception et de la construction d’un grand centre hospitalier universitaire",
  "What is on their mind": "Ce qui l’occupe",
  "One sentence. What is occupying them when they walk into a meeting today.":
    "Une phrase. Ce qui lui occupe l’esprit quand il entre en réunion aujourd’hui.",
  "e.g. Racing seismic compliance deadlines while orchestrating a billion-dollar greenfield hospital":
    "ex. Court après les échéances de mise aux normes sismiques tout en orchestrant un hôpital neuf à un milliard de dollars",

  /* ── Phase II · biography and hook ──────────────────────────────── */
  "// Phase II · Biography and Hook": "// Phase II · Biographie et accroche",
  "Build {0}'s profile.": "Construisez le profil de {0}.",
  "this persona": "ce persona",
  "Five fields of biography, then a three-pass writing exercise to land their hook. Write as if you are introducing them to a new strategist.":
    "Cinq champs de biographie, puis un exercice d’écriture en trois passes pour trouver son accroche. Écrivez comme si vous le présentiez à un nouveau stratège.",
  "Formal role": "Rôle officiel",
  "Their official title and what their organization does. One sentence.": "Son titre officiel et ce que fait son organisation. Une phrase.",
  "e.g. Director of Planning, Design and Construction at UCI Health":
    "ex. Directeur de la planification, de la conception et de la construction chez UCI Health",
  "Their largest current undertaking": "Son plus grand chantier du moment",
  "What is the biggest thing they are leading right now. Be concrete. Numbers if you have them.":
    "La plus grosse chose qu’il pilote en ce moment. Soyez concret. Des chiffres si vous en avez.",
  "e.g. Leading a 7-story, 144-bed greenfield hospital plus three multi-campus seismic retrofits, all running on overlapping timelines":
    "ex. Pilote un hôpital neuf de 7 étages et 144 lits, plus trois mises aux normes sismiques sur plusieurs sites, le tout sur des calendriers qui se chevauchent",
  "What their team would say about them": "Ce que son équipe dirait de lui",
  "One line. The shorthand. What people who work with them call out first.":
    "Une ligne. Le raccourci. Ce que ceux qui travaillent avec lui citent en premier.",
  "e.g. The one who actually walks the site every Friday": "ex. Celui qui arpente le chantier pour de bon chaque vendredi",
  "Their proudest achievement and biggest pressure": "Sa plus grande fierté et sa plus forte pression",
  "One sentence that captures both. The thing they are proud of is also the thing under threat.":
    "Une phrase qui saisit les deux. Ce dont il est fier est aussi ce qui est menacé.",
  "e.g. Delivered the world's first all-electric hospital, and now every choice is measured against that same carbon-neutrality bar":
    "ex. A livré le premier hôpital tout électrique au monde, et chaque choix est désormais mesuré à cette même exigence de neutralité carbone",
  "Their professional mindset": "Son état d’esprit professionnel",
  "One sentence. The philosophical operating system they bring to every decision.":
    "Une phrase. Le système de pensée qu’il applique à chaque décision.",
  "e.g. Design must serve clinical operations. Sustainability is non-negotiable. Long-term partnerships beat transactional contracts.":
    "ex. La conception doit servir l’activité clinique. La durabilité n’est pas négociable. Les partenariats de long terme valent mieux que les contrats transactionnels.",

  "The hook.": "L’accroche.",
  "Three writing passes. Each pass tightens the line. Do not skip ahead. The discipline is the point.":
    "Trois passes d’écriture. Chaque passe resserre la phrase. Ne sautez pas d’étape. La discipline est le but.",
  "Pass 1 · First instinct": "Passe 1 · Premier jet",
  "Write the situation they are in. Under 25 words. Do not edit. Just write it.":
    "Écrivez la situation dans laquelle il se trouve. Moins de 25 mots. Ne corrigez pas. Écrivez, c’est tout.",
  "e.g. Managing billion-dollar projects while racing seismic compliance deadlines and meeting the carbon commitments he made publicly":
    "ex. Pilote des projets à un milliard de dollars tout en courant après les échéances sismiques et en tenant les engagements carbone qu’il a pris publiquement",
  "Pass 2 · Cut every adjective": "Passe 2 · Coupez tous les adjectifs",
  "Take pass 1. Remove every adjective. Keep only nouns and verbs. Notice what survives.":
    "Reprenez la passe 1. Retirez tous les adjectifs. Ne gardez que les noms et les verbes. Regardez ce qui survit.",
  "Rewrite pass 1 with no adjectives": "Réécrivez la passe 1 sans adjectifs",
  "Complete pass 1 first": "Terminez d’abord la passe 1",
  "Pass 3 · Active and under 15 words": "Passe 3 · Actif et moins de 15 mots",
  "Make it about their doing, not their being. Active form. Under 15 words. Final hook.":
    "Parlez de ce qu’il fait, pas de ce qu’il est. Voix active. Moins de 15 mots. Accroche finale.",
  "The final hook, under 15 words": "L’accroche finale, moins de 15 mots",
  "Complete pass 2 first": "Terminez d’abord la passe 2",
  "✓ {0} words": "✓ {0} mots",
  "{0} words. Cut to under 15.": "{0} mots. Passez sous 15.",
  "Next persona": "Persona suivant",
  "Continue to Pain Map": "Vers la carte des douleurs",

  /* ── Phase III · pain map ───────────────────────────────────────── */
  "Phase III · The Pain Map": "Phase III · La carte des douleurs",
  "Five pains. Three buyers. Side by side.": "Cinq douleurs. Trois acheteurs. Côte à côte.",
  "Cross-cutting, not sequential. Read each row across all three personas. If two cells in a row say the same thing, sharpen them until they do not.":
    "En transversal, pas en séquence. Lisez chaque ligne sur les trois personas. Si deux cases d’une ligne disent la même chose, affûtez-les jusqu’à ce que ce ne soit plus le cas.",
  "After each row, step back. If two cells could swap and the row would still make sense, you have not differentiated yet. The pains should point to different solutions.":
    "Après chaque ligne, prenez du recul. Si deux cases peuvent s’échanger sans que la ligne perde son sens, vous n’avez pas encore différencié. Les douleurs doivent mener à des solutions différentes.",
  "Pain category": "Catégorie de douleur",
  "Time and capacity": "Temps et capacité",
  "What never has enough hours, what compresses their attention": "Ce qui manque toujours d’heures, ce qui comprime son attention",
  "Compliance and reputation": "Conformité et réputation",
  "What could damage their standing or their work's standing if it goes wrong":
    "Ce qui pourrait entamer son crédit, ou celui de son travail, si cela tourne mal",
  "Stakeholder orchestration": "Orchestration des parties prenantes",
  "Who they have to align, manage, escalate to, protect from each other": "Ceux qu’il doit aligner, gérer, alerter, protéger les uns des autres",
  "Vendor and dependency": "Prestataires et dépendances",
  "What they cannot do alone, where outside players control their outcome":
    "Ce qu’il ne peut pas faire seul, là où des acteurs extérieurs tiennent son résultat",
  "The existential pain underneath": "La douleur existentielle en dessous",
  "The fear under the official story. The thing they would not say in a meeting":
    "La peur sous le récit officiel. Ce qu’il ne dirait pas en réunion",
  "Be specific. Not 'too busy'. The actual situation.": "Soyez précis. Pas « trop occupé ». La situation réelle.",
  "Different from persona 1. Same category, different shape.": "Différent du persona 1. Même catégorie, autre forme.",
  "Different from the other two. Sharpen the contrast.": "Différent des deux autres. Accentuez le contraste.",
  "Continue to Journey Map": "Vers la carte du cheminement",

  /* ── Phase IV · journey map ─────────────────────────────────────── */
  "// Phase IV · Journey Map · Stage {0} of 5": "// Phase IV · Carte du cheminement · Étape {0} sur 5",
  "STAGE {0}": "ÉTAPE {0}",
  "Fill 4 fields per persona": "Remplissez 4 champs par persona",
  "Awareness": "Prise de conscience",
  "They realize something is off but have not identified the root cause":
    "Il comprend que quelque chose cloche, sans avoir identifié la cause profonde",
  "Realization of need": "Reconnaissance du besoin",
  "They acknowledge they need to do something but are unsure of the path": "Il admet qu’il doit agir, sans être sûr de la voie à suivre",
  "Shopping and comparing": "Recherche et comparaison",
  "They start looking for solutions but are skeptical": "Il commence à chercher des solutions, mais reste sceptique",
  "Engage and delight": "Engagement et enchantement",
  "They take the first step but need reinforcement": "Il fait le premier pas, mais a besoin d’être conforté",
  "Share and return": "Partage et retour",
  "They become an advocate but only on their terms": "Il devient un ambassadeur, mais à ses conditions",
  "Initiating event": "Événement déclencheur",
  "What specifically triggers this stage": "Ce qui déclenche précisément cette étape",
  "Feeling and emotion": "Ressenti et émotion",
  "What they feel beneath the surface": "Ce qu’il ressent sous la surface",
  "Touchpoint and channel": "Point de contact et canal",
  "Where the brand can be present": "Là où la marque peut être présente",
  "Communication and strategy": "Communication et stratégie",
  "How the brand should show up here": "Comment la marque doit se présenter ici",
  "Next stage": "Étape suivante",
  "Continue to Psychology": "Vers la psychologie",

  /* ── Phase V · psychological X-Ray ──────────────────────────────── */
  "Phase V · The Psychological X-Ray": "Phase V · La radiographie psychologique",
  "Now the layer underneath.": "Maintenant, la couche du dessous.",
  "Six psychological patterns per persona. Drawn from the biography, mindset, pain, and journey you have built so far. Claude proposes. You sharpen.":
    "Six schémas psychologiques par persona. Tirés de la biographie, de l’état d’esprit, de la douleur et du cheminement que vous avez construits jusqu’ici. Claude propose. Vous affûtez.",
  "Micro-behaviors of control. Rationalizations. Hidden drivers. Defense mechanisms. Emotional contradiction. Aspirational undercurrent.":
    "Micro-comportements de contrôle. Rationalisations. Moteurs cachés. Mécanismes de défense. Contradiction émotionnelle. Aspiration souterraine.",
  "// Generating psychological X-Ray": "// Génération de la radiographie psychologique",
  "Reading every input you have given. Naming the patterns underneath. Six fields per persona, eighteen in total.":
    "Lecture de tout ce que vous avez saisi. Les schémas sous-jacents sont nommés. Six champs par persona, dix-huit au total.",
  "X-Ray generation failed: {0}": "La génération de la radiographie a échoué : {0}",

  "Sharpen the language.": "Affûtez la langue.",
  "Six patterns per persona. Edit each one until it reads true. If a sentence does not sound like this person, rewrite it.":
    "Six schémas par persona. Retouchez chacun jusqu’à ce qu’il sonne vrai. Si une phrase ne ressemble pas à cette personne, réécrivez-la.",
  "Micro-behaviors of control": "Micro-comportements de contrôle",
  "What they obsessively organize. The routines they cling to. The dashboards they build.":
    "Ce qu’il organise de façon obsessionnelle. Les routines auxquelles il s’accroche. Les tableaux de bord qu’il construit.",
  "Rationalizations": "Rationalisations",
  "What they tell themselves to keep going. The story they repeat when the cost is mounting.":
    "Ce qu’il se raconte pour continuer. L’histoire qu’il se répète quand le coût grimpe.",
  "Hidden drivers": "Moteurs cachés",
  "What really moves them under the official story. Validation, fear, legacy, recognition.":
    "Ce qui le meut en réalité, sous le récit officiel. Validation, peur, héritage, reconnaissance.",
  "Defense mechanisms": "Mécanismes de défense",
  "What they reach for when exposed. Jargon, process, deflection, busyness.":
    "Ce vers quoi il se replie quand il se sent exposé. Jargon, procédure, esquive, suractivité.",
  "Emotional contradiction": "Contradiction émotionnelle",
  "The gap between outward composure and inward state. The thing they would never say in a meeting.":
    "L’écart entre le calme affiché et l’état intérieur. Ce qu’il ne dirait jamais en réunion.",
  "Aspirational undercurrent": "Aspiration souterraine",
  "What they want to be remembered for. The legacy under the work.":
    "Ce pour quoi il veut qu’on se souvienne de lui. L’héritage sous le travail.",
  "Continue to Common Thread": "Vers le fil conducteur",

  /* ── Phase VI · common thread ───────────────────────────────────── */
  "Phase VI · The Common Thread": "Phase VI · Le fil conducteur",
  "What runs through all three?": "Qu’est-ce qui traverse les trois ?",
  "Different roles, different pains, different journeys. But underneath, a pattern. The single insight that becomes your strategic core.":
    "Des rôles différents, des douleurs différentes, des cheminements différents. Mais en dessous, un schéma. Le constat unique qui devient votre noyau stratégique.",
  "// Finding the common thread": "// Recherche du fil conducteur",
  "Reading across all three psychological X-Rays. Naming what runs through all of them. Surfacing the binding insight.":
    "Lecture croisée des trois radiographies psychologiques. Ce qui les traverse toutes est nommé. Le constat fédérateur remonte à la surface.",
  "Common thread generation failed: {0}": "La génération du fil conducteur a échoué : {0}",

  "Sharpen the constants.": "Affûtez les constantes.",
  "Three to five common themes plus the one binding insight. These are the strategic constants that travel across every audience.":
    "Trois à cinq thèmes communs, plus le constat fédérateur. Ce sont les constantes stratégiques valables pour chaque audience.",
  "Common themes": "Thèmes communs",
  "Theme {0}": "Thème {0}",
  "Add theme": "Ajouter un thème",
  "The binding insight": "Le constat fédérateur",
  "One sentence. The strategic thread that runs through all three. The thing your brand exists to address across every buyer.":
    "Une phrase. Le fil stratégique qui traverse les trois. Ce que votre marque est là pour traiter, chez chaque acheteur.",
  "All three buyers operate in regulated, high-stakes systems where one missed signal can damage decades of credibility - they buy partners who absorb that signal load on their behalf.":
    "Les trois acheteurs évoluent dans des systèmes réglementés, à fort enjeu, où un seul signal manqué peut abîmer des décennies de crédibilité. Ils achètent des partenaires qui absorbent cette charge de signaux à leur place.",
  "Build the deliverable": "Construire le livrable",

  /* ── Phase VII · synthesis ──────────────────────────────────────── */
  "Phase VII · Synthesis": "Phase VII · Synthèse",
  "Final assembly.": "Assemblage final.",
  "Claude assembles your work into the full deliverable: three persona briefs in your strategy format, plus the cross-cutting layers. You review, refine if needed, then save.":
    "Claude assemble votre travail dans le livrable complet : trois briefs de persona au format de votre stratégie, plus les couches transversales. Vous relisez, vous affinez si besoin, puis vous enregistrez.",
  "Build deliverable": "Construire le livrable",
  "// Assembling the deliverable": "// Assemblage du livrable",
  "Three full persona briefs. Marketing approach. Key takeaways. Common themes. Binding insight. Detailed patterns. The complete document.":
    "Trois briefs de persona complets. Approche marketing. Points clés. Thèmes communs. Constat fédérateur. Schémas détaillés. Le document complet.",
  "Synthesis failed: {0}": "La synthèse a échoué : {0}",

  /* ── Reveal ─────────────────────────────────────────────────────── */
  "No synthesis. Go back and run it.": "Pas de synthèse. Revenez en arrière et lancez-la.",
  "Your three buyers.": "Vos trois acheteurs.",
  "Three full briefs. Approve when each lands. Refine if needed. Three rounds per persona.":
    "Trois briefs complets. Validez chacun dès qu’il est au point. Affinez si besoin. Trois tours par persona.",
  "Core Identity": "Identité fondamentale",
  "Professional Mindset": "État d’esprit professionnel",
  "The Hook": "L’accroche",
  "Pain Points": "Points de douleur",
  "Marketing Approach": "Approche marketing",
  "Customer Journey": "Cheminement client",
  "Stage": "Étape",
  "Feeling": "Ressenti",
  "Touchpoint": "Point de contact",
  "Strategy": "Stratégie",
  "Key Takeaways": "Points clés",

  /* List labels painted as "<strong>Label: </strong>" in the reveal cards */
  "Time and capacity:": "Temps et capacité :",
  "Compliance and reputation:": "Conformité et réputation :",
  "Stakeholder orchestration:": "Orchestration des parties prenantes :",
  "Vendor and dependency:": "Prestataires et dépendances :",
  "The existential pain underneath:": "La douleur existentielle en dessous :",
  "Micro-behaviors of control:": "Micro-comportements de contrôle :",
  "Rationalizations:": "Rationalisations :",
  "Hidden drivers:": "Moteurs cachés :",
  "Defense mechanisms:": "Mécanismes de défense :",
  "Emotional contradiction:": "Contradiction émotionnelle :",
  "Aspirational undercurrent:": "Aspiration souterraine :",

  /* Approval loop. "Refine · round…" and "Refine failed…" sit before
     "Refine {0}", and before "{0} of 3", which would otherwise claim them. */
  "✓ Approved": "✓ Validé",
  "Approve": "Valider",
  "Refine · round {0} of 3": "Affiner · tour {0} sur 3",
  "Refinement limit reached": "Limite d’affinage atteinte",
  "Refine failed: {0}": "L’affinage a échoué : {0}",
  "Refine {0}": "Affiner {0}",
  "{0} of 3": "{0} sur 3",
  "What needs to change? Marketing approach? Takeaways? X-Ray pattern? One paragraph of direction. Claude will rebuild this persona's brief.":
    "Que faut-il changer ? L’approche marketing ? Les points clés ? Un schéma de la radiographie ? Un paragraphe de consignes. Claude reconstruira le brief de ce persona.",
  "e.g. The marketing approach is too tactical. Lift it to ecosystem-level moves. The third takeaway is correct but the language is generic - make it specific to academic medical centers.":
    "ex. L’approche marketing est trop tactique. Élevez-la au niveau de l’écosystème. Le troisième point clé est exact mais sa formulation est générique. Rendez-le propre aux centres hospitaliers universitaires.",
  "Rebuild this persona": "Reconstruire ce persona",

  "Cross-cutting layer": "Couche transversale",
  "Common Themes": "Thèmes communs",
  "The Binding Insight": "Le constat fédérateur",
  "Shared Key Takeaways": "Points clés partagés",
  "Save and finish": "Enregistrer et terminer",
  "Approve all three personas to save and finish": "Validez les trois personas pour enregistrer et terminer",

  /* ── Finish ─────────────────────────────────────────────────────── */
  "Saved to QBP": "Enregistré dans le QBP",
  "Done.": "Terminé.",
  "Three full persona briefs written into your QBP. War Table, Voice Guide, and Predictive Panel will read this automatically. Below: download formats and the branded export that mirrors your strategy deck.":
    "Trois briefs de persona complets inscrits dans votre QBP. War Table, Voice Guide et Predictive Panel les liront automatiquement. Ci-dessous : les formats de téléchargement et l’export de marque, calqué sur votre présentation stratégique.",
  "Branded export (PDF)": "Export de marque (PDF)",
  "Download PPTX": "Télécharger le PPTX",
  "Marketing deck": "Deck marketing",
  "Download JSON": "Télécharger le JSON",
  "Download Markdown": "Télécharger le Markdown",
  "Start over": "Recommencer",
  "Run The Profiles again? Saved profiles remain in QBP. Tool progress resets.":
    "Relancer The Profiles ? Les profils enregistrés restent dans le QBP. La progression de l’outil est remise à zéro.",
  "PPTX export still loading - try again in a second.": "L’export PPTX charge encore. Réessayez dans une seconde.",
  "Could not generate the PPTX. Check the console for details.": "Impossible de générer le PPTX. Le détail est dans la console.",

  /* ── API key gate ───────────────────────────────────────────────── */
  "API key required": "Clé API requise",
  "Anthropic key needed": "Clé Anthropic nécessaire",
  "Used for the X-Ray, Common Thread, and Synthesis steps. Stored locally only. Never sent anywhere except to Anthropic.":
    "Utilisée pour les étapes Radiographie, Fil conducteur et Synthèse. Stockée en local uniquement. Jamais envoyée ailleurs que chez Anthropic.",
  "sk-ant-...": true,
  "Save and continue": "Enregistrer et continuer",

  /* ── Footer blurb (short variant; common.js holds the long one) ─── */
  "The Brand Operating System. From idea to orbit. Identity, look, voice, content, strategy. One connected platform.":
    "Le système d’exploitation de marque. De l’idée à l’orbite. Identité, allure, voix, contenu, stratégie. Une seule plateforme connectée.",

  /* ── Percentages: the header's "69%" becomes "69 %". Last, so it never
     shadows a more specific pattern. ───────────────────────────────── */
  "{0}%": "{0}\u00a0%"
});

/* Exported text. The Markdown file built by buildMarkdown().
   These lines never reach the DOM: the runtime translates the file and
   the clipboard line by line (js/qb-i18n.js, "Text that leaves the page"). */
QBI18N.add('fr', {
  "Hook": "Accroche",
  "Initiating Event": "Événement déclencheur",
  "Persona {0}: {1} - {2}": "Persona {0} : {1} · {2}"
});
