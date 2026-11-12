/* fr · content-scheduler.html
   \u00a0 is the no-break space French sets before : ; ? */
QBI18N.add('fr', {
  /* ── Head ───────────────────────────────────────────────────────── */
  "Content Scheduler · BrandOS": "Planificateur de contenu · BrandOS",
  "Set the publishing cadence for your brand across platforms. The Content Scheduler builds a calendar your Brand Profile can sustain.":
    "Fixez le rythme de publication de votre marque sur toutes les plateformes. Le Planificateur de contenu construit un calendrier que votre Profil de marque peut tenir.",

  /* The runtime writes og:locale itself; the audit then reads it back. */
  "fr_FR": true,

  /* ── Agent chassis, shared by the four agent tool pages ─────────── */
  "The Brand Operating System. From idea to orbit. Identity, look, voice, content, strategy. One connected platform.":
    "Le système d’exploitation de marque. De l’idée à l’orbite. Identité, allure, voix, contenu, stratégie. Une seule plateforme connectée.",

  /* ── Tool header ────────────────────────────────────────────────── */
  "QB_BrandOS": true,
  "Content Scheduler": "Planificateur de contenu",
  /* Counts sit after a colon so the line reads right for 0, 1 and many. */
  "{0} in queue · {1} scheduled": "En file\u00a0: {0} · Programmés\u00a0: {1}",
  "Toggle theme": "Changer de thème",

  /* ── Buffer connection ──────────────────────────────────────────── */
  "Connect Buffer": "Connecter Buffer",
  "Buffer is a free social media scheduling tool. Connect it once and BrandOS queues your content automatically across Instagram, LinkedIn, X, and Facebook.":
    "Buffer est un outil gratuit de programmation pour les réseaux sociaux. Connectez-le une fois et BrandOS met votre contenu en file automatiquement sur Instagram, LinkedIn, X et Facebook.",
  "Buffer Access Token - from buffer.com/developers/apps": "Jeton d’accès Buffer, depuis buffer.com/developers/apps",
  "Connect": "Connecter",
  "How to get your Buffer token": "Comment obtenir votre jeton Buffer",
  "1. Create a free account at buffer.com": "1. Créez un compte gratuit sur buffer.com",
  "2. Go to buffer.com/developers/apps": "2. Allez sur buffer.com/developers/apps",
  "3. Create a new application (any name)": "3. Créez une nouvelle application (peu importe le nom)",
  "4. Copy the Access Token and paste it above": "4. Copiez le jeton d’accès (Access Token) et collez-le ci-dessus",
  "Buffer connected": "Buffer connecté",
  "Change token": "Changer de jeton",
  "Load profiles": "Charger les profils",
  "Add your Buffer access token first.": "Ajoutez d’abord votre jeton d’accès Buffer.",
  "Note: Buffer API requires a server-side proxy for CORS. If blocked, copy your profile IDs from buffer.com/app/profile/[YOUR_ID]":
    "Note\u00a0: l’API Buffer exige un proxy côté serveur pour le CORS. En cas de blocage, copiez vos ID de profil depuis buffer.com/app/profile/[YOUR_ID]",

  /* ── Tabs ───────────────────────────────────────────────────────── */
  "Queue ({0})": "File ({0})",
  "Add Post": "Ajouter un post",
  "Bulk Import": "Import groupé",
  "Scheduled ({0})": "Programmés ({0})",

  /* ── Queue ──────────────────────────────────────────────────────── */
  "The room is empty": "La pièce est vide",
  "No posts have been prepared for scheduling yet.": "Aucun post n’est encore prêt à être programmé.",
  "Add First Post": "Ajouter un premier post",
  "0 posts ready": "0 post prêt",
  "0 posts ready to schedule": "0 post prêt à programmer",
  "{0} posts ready to schedule": "{0} posts prêts à programmer",
  "{0} post ready to schedule": "{0} post prêt à programmer",
  "Schedule All": "Tout programmer",
  "Scheduling...": "Programmation…",

  /* Queue items. Platform and status badges paint the stored value. */
  "instagram": true,
  "linkedin_personal": "linkedin personnel",
  "linkedin_company": "linkedin entreprise",
  "twitter": true,
  "facebook": true,
  "queued": "en file",
  "scheduled": "programmé",
  "error": "erreur",
  "Date: {0}": "Date\u00a0: {0}",
  "Time: {0}": "Heure\u00a0: {0}",
  "⚠ No profile ID - add before scheduling": "⚠ Pas d’ID de profil. Ajoutez-le avant de programmer.",
  "⚠ No date selected - required before scheduling": "⚠ Aucune date choisie. Elle est requise avant de programmer.",
  "Error: {0}": "Erreur\u00a0: {0}",
  "Invalid date/time": "Date ou heure invalide",
  "Unknown error": "Erreur inconnue",
  "Remove post": "Retirer le post",
  "Remove": "Retirer",

  /* ── Add a post ─────────────────────────────────────────────────── */
  "Draft a Concept": "Rédiger un concept",
  "Caption / Text": "Légende / Texte",
  "Paste your caption from the content agents here...": "Collez ici votre légende venue des agents de contenu…",
  "Platform": "Plateforme",
  "LinkedIn Personal": "LinkedIn personnel",
  "LinkedIn Company": "LinkedIn entreprise",
  "X / Twitter": true,
  "Facebook": true,
  "Buffer Profile ID": "ID de profil Buffer",
  "e.g. 5b7d6...": "ex. 5b7d6...",
  "Publish Date": "Date de publication",
  "Publish Time": "Heure de publication",
  "{0} ★ Best time": "{0} ★ Meilleur créneau",
  "Add to Queue": "Ajouter à la file",

  /* ── Bulk import ────────────────────────────────────────────────── */
  "Bulk Import System": "Système d’import groupé",
  "Paste combined output from the Content Engine. The system automatically parses and spaces posts 3 days apart.":
    "Collez la sortie combinée du moteur de contenu. Le système analyse les posts et les espace de 3 jours, automatiquement.",
  "Paste Content Below": "Collez le contenu ci-dessous",
  /* « POST 1: » stays exactly as written, no space before the colon: the
     importer splits the pasted text on that heading. */
  "POST 1: Your first caption here... POST 2: Your second caption here... Separate posts with blank lines or POST N: headings":
    "POST 1:\nVotre première légende ici...\n\nPOST 2:\nVotre deuxième légende ici...\n\nSéparez les posts par des lignes vides ou des titres POST N:",
  "Default Platform": "Plateforme par défaut",
  "Global Profile ID": "ID de profil global",
  "Applied to all imported posts": "Appliqué à tous les posts importés",
  "Parse & Queue": "Analyser et mettre en file",

  /* ── Scheduled ──────────────────────────────────────────────────── */
  "Nothing out there yet. Schedule items from the Queue tab to see them here.":
    "Rien n’est encore parti. Programmez des éléments depuis l’onglet File pour les voir ici.",
  "✓ SENT TO BUFFER": "✓ ENVOYÉ À BUFFER",
  /* The longer pattern first: the shorter one would swallow the ID. */
  "Scheduled for {0} at {1} · System ID: {2}": "Programmé le {0} à {1} · ID système\u00a0: {2}",
  "Scheduled for {0} at {1}": "Programmé le {0} à {1}",

  /* ── Tool footer ────────────────────────────────────────────────── */
  "Intelligence from the Future": "L’intelligence venue du futur"
});
