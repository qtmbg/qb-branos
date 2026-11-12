/* fr · privacy.html
   Glossary and rules: docs/i18n/glossary-fr.md
   Legal copy. Translated clause by clause: same meaning, same numbers, same
   jurisdiction. The product is named "BrandOS" and nothing else.
   GDPR is RGPD, a processor is a sous-traitant, SCCs are CCT.
   A sentence that holds a link or a code tag is several text nodes; each
   fragment is written so the French sentence reads right once rejoined. */
QBI18N.add('fr', {
  /* Head */
  "Privacy Policy · BrandOS": "Politique de confidentialité · BrandOS",
  "How Quantum Branding handles your personal data. GDPR-compliant. Transparent about what we collect and why.":
    "Comment Quantum Branding traite vos données personnelles. Conforme au RGPD. Transparent sur ce que nous collectons et pourquoi.",

  /* Title block */
  "Legal · Last updated 11 May 2026": "Juridique · Dernière mise à jour le 11 mai 2026",
  "Privacy @@ .doc-h1": "Politique de",
  "policy.": "confidentialité.",
  "What we collect, why, and what control you have over it":
    "Ce que nous collectons, pourquoi, et le contrôle que vous gardez dessus",

  /* Contents and section headings */
  "1. The short version": "1. La version courte",
  "2. Who's responsible": "2. Qui est responsable",
  "3. Data we collect": "3. Les données que nous collectons",
  "4. Why we collect it (lawful basis)": "4. Pourquoi nous les collectons (base légale)",
  "5. Third parties we share data with": "5. Les tiers avec lesquels nous partageons des données",
  "6. Where data is stored": "6. Où les données sont conservées",
  "7. How long we keep it": "7. Combien de temps nous les conservons",
  "8. Your rights": "8. Vos droits",
  "9. Cookies and localStorage": "9. Cookies et localStorage",
  "10. Security": "10. Sécurité",
  "11. Children": "11. Enfants",
  "12. Changes to this policy": "12. Modification de la présente politique",
  "13. Contact and complaints": "13. Contact et réclamations",

  /* 1. The short version */
  "We collect what we need to operate BrandOS for you: your email, the brand information you enter into the tools, and the minimum behavioural signal we need to bill you and improve the product. We don't sell your data, we don't advertise to you, and we don't profile you beyond what the tools require to function. You can delete everything at any time by emailing":
    "Nous collectons ce dont nous avons besoin pour faire fonctionner BrandOS pour vous : votre e-mail, les informations de marque que vous saisissez dans les outils, et le minimum de signaux d’usage nécessaires pour vous facturer et améliorer le produit. Nous ne vendons pas vos données, nous ne vous adressons pas de publicité, et nous ne vous profilons pas au-delà de ce que les outils exigent pour fonctionner. Vous pouvez tout supprimer à tout moment en écrivant à",

  /* 2. Who's responsible */
  "Data controller: Nizzar Ben Chekroune, operating as":
    "Responsable du traitement : Nizzar Ben Chekroune, exerçant sous le nom",
  "(France). Contact:": "(France). Contact :",

  /* 3. Data we collect */
  "Category": "Catégorie",
  "What we collect": "Ce que nous collectons",
  "Source": true,
  "Email address, first name, optional last name, magic-link sign-in events":
    "Adresse e-mail, prénom, nom facultatif, événements de connexion par lien magique",
  "You enter it;": "Vous le saisissez ;",
  "Supabase Auth": true,
  "records it": "l’enregistre",
  "Brand Profile (QBP)": "Profil de marque (QBP)",
  "Your brand name, archetype, manifesto, personas, voice notes, sensory profile, visual direction. Everything you type into a Phase 01 tool":
    "Le nom de votre marque, l’archétype, le manifeste, les personas, les notes de voix, le profil sensoriel, la direction visuelle. Tout ce que vous saisissez dans un outil de la Phase 01",
  "You enter it; stored in": "Vous le saisissez ; conservé dans",
  "profiles.qbp": true,
  "Usage": true,
  "Which tools you completed and when (": "Les outils que vous avez terminés et à quelle date (",
  "tool_completions": true,
  "), your tier, subscription status, last active timestamp":
    "), votre offre, l’état de votre abonnement, l’horodatage de votre dernière activité",
  "System records as you use it": "Enregistré par le système au fil de votre utilisation",
  "Signal Scan results": "Résultats du Signal Scan",
  "Your 8 question answers, computed score, grade, top gap, moment phase":
    "Vos réponses aux 8 questions, le score calculé, la note, l’écart principal, la phase du moment",
  "You enter; computed by the app; stored in Supabase":
    "Vous saisissez ; calculé par l’application ; conservé dans Supabase",
  "Payment": "Paiement",
  "Stripe customer id, subscription id, subscription status, plan name. We never see or store your card number.":
    "Identifiant client Stripe, identifiant d’abonnement, état de l’abonnement, nom de l’offre. Nous ne voyons ni ne conservons jamais votre numéro de carte.",
  "Stripe": true,
  "webhook": "(webhook)",
  "Email engagement": "Engagement e-mail",
  "Whether emails we send are delivered, opened, clicked, bounced, unsubscribed":
    "Si les e-mails que nous envoyons sont remis, ouverts, cliqués, rejetés, ou s’ils donnent lieu à une désinscription",
  "Resend": true,
  "Technical": "Technique",
  "IP address, browser user-agent, page-load timestamps as part of normal HTTP request logs (hosting only, not used for tracking)":
    "Adresse IP, user-agent du navigateur, horodatages de chargement des pages, dans le cadre des journaux de requêtes HTTP habituels (hébergement uniquement, non utilisés pour le suivi)",
  "Vercel": true,
  "access logs": "(journaux d’accès)",
  "Aggregate usage": "Usage agrégé",
  "Pageviews, page paths, referrer, country, device type. Cookieless. No persistent identifier. IP hashed and discarded.":
    "Pages vues, chemins des pages, site référent, pays, type d’appareil. Sans cookie. Aucun identifiant persistant. Adresse IP hachée puis supprimée.",
  "Vercel Web Analytics": true,
  "Speed Insights": true,
  "We do @@ .legal-doc": "Nous ne collectons",
  "not @@ .legal-doc": "pas",
  "collect: government ID, payment card numbers (Stripe handles those), health data, sexual orientation, religious or political views, or any special-category data under GDPR Article 9. If a tool asks you something you'd prefer not to answer, don't answer it. The tools work fine without filling every field.":
    "les données suivantes : pièce d’identité officielle, numéros de carte de paiement (Stripe s’en charge), données de santé, orientation sexuelle, opinions religieuses ou politiques, ni aucune catégorie particulière de données au sens de l’article 9 du RGPD. Si un outil vous demande quelque chose à quoi vous préférez ne pas répondre, n’y répondez pas. Les outils fonctionnent bien sans que chaque champ soit rempli.",

  /* 4. Why we collect it (lawful basis) */
  "Performance of a contract (GDPR Art. 6(1)(b)).": "Exécution d’un contrat (RGPD, art. 6(1)(b)).",
  "Account, QBP, usage, payment data: needed to deliver the service you signed up for.":
    "Données de compte, de QBP, d’usage et de paiement : nécessaires pour fournir le service auquel vous vous êtes inscrit.",
  "Legitimate interest (Art. 6(1)(f)).": "Intérêt légitime (art. 6(1)(f)).",
  "Email engagement and technical logs: needed to keep the service running, debug issues, and prevent abuse. We've balanced this against your privacy interests and judged the impact minimal.":
    "Engagement e-mail et journaux techniques : nécessaires pour maintenir le service en fonctionnement, corriger les incidents et prévenir les abus. Nous avons mis cet intérêt en balance avec votre vie privée et jugé l’impact minime.",
  "Consent (Art. 6(1)(a)).": "Consentement (art. 6(1)(a)).",
  "Marketing emails (newsletter, drip campaigns). You can withdraw consent at any time by unsubscribing in the email footer or emailing us.":
    "E-mails marketing (newsletter, campagnes séquencées). Vous pouvez retirer votre consentement à tout moment en vous désinscrivant depuis le pied de l’e-mail ou en nous écrivant.",
  "Legal obligation (Art. 6(1)(c)).": "Obligation légale (art. 6(1)(c)).",
  "Records we have to keep for tax, accounting, or in response to a lawful request.":
    "Les documents que nous devons conserver à des fins fiscales ou comptables, ou en réponse à une demande légale.",

  /* 5. Third parties we share data with */
  "BrandOS runs on infrastructure provided by these processors. Each handles a slice of your data on our behalf, governed by a Data Processing Addendum (DPA):":
    "BrandOS fonctionne sur une infrastructure fournie par les sous-traitants ci-dessous. Chacun traite une partie de vos données pour notre compte, dans le cadre d’un accord de traitement des données (DPA) :",
  "Processor": "Sous-traitant",
  "What they handle": "Ce qu’ils traitent",
  "Region": "Région",
  "Hosting, edge functions, request logs, cookieless web analytics, speed insights":
    "Hébergement, fonctions edge, journaux de requêtes, mesure d’audience web sans cookie, mesures de vitesse",
  "Global (EU edge nodes)": "Mondial (nœuds edge dans l’UE)",
  "Supabase": true,
  "Auth, profiles database, storage": "Authentification, base de données des profils, stockage",
  "EU (Frankfurt)": "UE (Francfort)",
  "Payment processing, billing portal": "Traitement des paiements, portail de facturation",
  "EU + USA": "UE + États-Unis",
  "Transactional email (magic links, welcome, results, receipts, lock confirmations)":
    "E-mails transactionnels (liens magiques, bienvenue, résultats, reçus, confirmations de verrouillage)",
  "EU (eu-west-1)": "UE (eu-west-1)",
  "Anthropic": true,
  "AI inference for the brand document and operator tools (Claude)":
    "Inférence d’IA pour le document de marque et les outils d’opérateur (Claude)",
  "USA": "États-Unis",
  "Google": true,
  "AI inference for the free exercises (Gemini)": "Inférence d’IA pour les exercices gratuits (Gemini)",
  "We don't share your personal data with anyone for marketing or profiling. We don't sell data. If a processor is subpoenaed or asked by a government to disclose data, that's between them and the requesting authority. We'll be told to the extent legally possible.":
    "Nous ne partageons vos données personnelles avec personne à des fins de marketing ou de profilage. Nous ne vendons pas de données. Si un sous-traitant reçoit une injonction ou une demande d’un gouvernement de divulguer des données, cela se règle entre lui et l’autorité requérante. Nous en serons informés dans la mesure où la loi le permet.",
  "For transfers to processors outside the EU/EEA, we rely on Standard Contractual Clauses (SCCs) and the processor's own compliance commitments.":
    "Pour les transferts vers des sous-traitants situés hors de l’UE/EEE, nous nous appuyons sur les clauses contractuelles types (CCT) et sur les engagements de conformité propres à chaque sous-traitant.",

  /* 6. Where data is stored */
  "Your account and Brand Profile are stored in Supabase's Frankfurt region (EU). Transactional emails go through Resend's EU-West region. Stripe handles payment data on its global infrastructure but stores European customers' financial records in the EU. AI inference runs on US infrastructure under SCCs. The free exercises are processed by Google Gemini on Google's free API tier, where Google uses prompts and responses to improve its products and services, and human reviewers may read them. Anything you pay for, and the brand document itself, is processed by Anthropic, where inputs are used only to generate the response and are not retained for training (per Anthropic's API terms). If you would rather your exercises were not processed this way, do not enter anything into the free tools that you need kept confidential.":
    "Votre compte et votre Profil de marque sont conservés dans la région Francfort de Supabase (UE). Les e-mails transactionnels passent par la région EU-West de Resend. Stripe traite les données de paiement sur son infrastructure mondiale mais conserve dans l’UE les documents financiers des clients européens. L’inférence d’IA s’exécute sur une infrastructure américaine, dans le cadre des CCT. Les exercices gratuits sont traités par Google Gemini via l’offre gratuite de l’API de Google, dans laquelle Google utilise les requêtes et les réponses pour améliorer ses produits et services, et des relecteurs humains peuvent les lire. Tout ce que vous payez, ainsi que le document de marque lui-même, est traité par Anthropic, où les saisies ne servent qu’à générer la réponse et ne sont pas conservées à des fins d’entraînement (selon les conditions de l’API d’Anthropic). Si vous préférez que vos exercices ne soient pas traités de cette façon, ne saisissez dans les outils gratuits rien que vous devez garder confidentiel.",

  /* 7. How long we keep it */
  "Data type": "Type de données",
  "Retention": "Durée de conservation",
  "Active account data": "Données d’un compte actif",
  "For as long as your account is active": "Tant que votre compte est actif",
  "Cancelled subscription": "Abonnement résilié",
  "30 days, then archived to a minimal billing record":
    "30 jours, puis archivage sous la forme d’un enregistrement de facturation minimal",
  "Account deletion request": "Demande de suppression de compte",
  "Action within 30 days; full deletion within 90 days (some processor backups can take that long to expire)":
    "Prise en charge sous 30 jours ; suppression complète sous 90 jours (certaines sauvegardes de sous-traitants mettent ce délai à expirer)",
  "Billing records": "Documents de facturation",
  "10 years from invoice date (French commercial law)":
    "10 ans à compter de la date de facture (droit commercial français)",
  "Retained as long as the marketing list contains your address; deleted on unsubscribe + 90 days":
    "Conservé tant que la liste marketing contient votre adresse ; supprimé 90 jours après la désinscription",
  "Server access logs": "Journaux d’accès du serveur",
  "30 days at Vercel's default retention": "30 jours, selon la durée de conservation par défaut de Vercel",

  /* 8. Your rights */
  "Under GDPR (and equivalent rights elsewhere), you have:":
    "Au titre du RGPD (et des droits équivalents ailleurs), vous disposez des droits suivants :",
  "Right of access.": "Droit d’accès.",
  "Ask for a copy of all personal data we hold about you":
    "Demander une copie de toutes les données personnelles que nous détenons sur vous",
  "Right to rectification.": "Droit de rectification.",
  "Correct any data that's wrong": "Corriger toute donnée inexacte",
  "Right to erasure (\"right to be forgotten\").": "Droit à l’effacement (« droit à l’oubli »).",
  "Delete your data, subject to legal retention obligations":
    "Supprimer vos données, sous réserve des obligations légales de conservation",
  "Right to restrict processing.": "Droit à la limitation du traitement.",
  "Pause our use of your data while a dispute is resolved":
    "Suspendre notre utilisation de vos données le temps de résoudre un litige",
  "Right to data portability.": "Droit à la portabilité des données.",
  "Get a copy of your data in a machine-readable format (we export your QBP as JSON on request)":
    "Obtenir une copie de vos données dans un format lisible par machine (nous exportons votre QBP en JSON sur demande)",
  "Right to object.": "Droit d’opposition.",
  "Stop processing based on legitimate interest or for marketing":
    "Faire cesser un traitement fondé sur l’intérêt légitime ou réalisé à des fins de marketing",
  "Right to withdraw consent.": "Droit de retirer votre consentement.",
  "Cancel any consent you previously gave (e.g. marketing emails)":
    "Annuler tout consentement donné auparavant (par exemple pour les e-mails marketing)",
  "Right not to be subject to automated decision-making.": "Droit de ne pas faire l’objet d’une décision automatisée.",
  "We don't make decisions about you based solely on algorithms; humans can review any output":
    "Nous ne prenons aucune décision vous concernant sur la seule base d’algorithmes ; un humain peut relire tout résultat",
  "Exercise any of these by emailing": "Pour exercer l’un de ces droits, écrivez à",
  ". We'll respond within 30 days. There's no charge unless the request is clearly excessive.":
    ". Nous répondons sous 30 jours. C’est gratuit, sauf si la demande est manifestement excessive.",

  /* 9. Cookies and localStorage */
  "BrandOS does not use third-party tracking cookies. We use the browser's":
    "BrandOS n’utilise pas de cookies de suivi tiers. Nous utilisons le",
  "localStorage": true,
  "to store:": "du navigateur pour conserver :",
  "qb_session": true,
  ", your Supabase auth token (only after sign-in)":
    ", votre jeton d’authentification Supabase (uniquement après connexion)",
  "qb_qbp": true,
  ", your in-progress Brand Profile so you don't lose work between sessions":
    ", votre Profil de marque en cours, pour ne pas perdre votre travail entre deux sessions",
  "qb_completions": true,
  ", which Phase 01 tools you've finished": ", les outils de la Phase 01 que vous avez terminés",
  "qb_user_tier": true,
  "qb_sub_status": true,
  ", your subscription tier, refreshed from the server on each load":
    ", votre offre d’abonnement, actualisée depuis le serveur à chaque chargement",
  "qb_first_name": true,
  "qb_apikey": true,
  ", convenience caches you set explicitly": ", des caches de confort que vous définissez explicitement",
  "These are functional, not tracking. They never leave your browser unless they're sent to the server as part of an API call. Clearing your browser data clears them all.":
    "Ces éléments sont fonctionnels, pas des traceurs. Ils ne quittent jamais votre navigateur, sauf lorsqu’ils sont envoyés au serveur dans le cadre d’un appel d’API. Effacer les données de votre navigateur les efface tous.",
  "Stripe and Supabase may set their own cookies on their own domains (Stripe Checkout, the Supabase Auth callback). Those are governed by Stripe's and Supabase's privacy policies.":
    "Stripe et Supabase peuvent déposer leurs propres cookies sur leurs propres domaines (Stripe Checkout, le retour d’authentification Supabase). Ceux-ci relèvent des politiques de confidentialité de Stripe et de Supabase.",

  /* 10. Security */
  "HTTPS everywhere. Auth via magic links (no passwords to leak). API keys for AI providers and payment processors stored only as Vercel environment variables and never exposed to the client. Supabase Row Level Security ensures one user can only read their own profile. Webhook signatures verified with HMAC-SHA256.":
    "HTTPS partout. Authentification par liens magiques (aucun mot de passe à faire fuiter). Les clés d’API des fournisseurs d’IA et des prestataires de paiement sont conservées uniquement sous forme de variables d’environnement Vercel et ne sont jamais exposées au client. La sécurité au niveau des lignes (Row Level Security) de Supabase garantit qu’un utilisateur ne peut lire que son propre profil. Les signatures des webhooks sont vérifiées avec HMAC-SHA256.",
  "Despite all that, no system is fully secure. If we ever experience a personal-data breach that creates a risk to your rights, we'll notify the relevant supervisory authority within 72 hours of becoming aware, and notify affected users without undue delay where required.":
    "Malgré tout cela, aucun système n’est totalement sûr. Si nous subissons un jour une violation de données personnelles qui crée un risque pour vos droits, nous la notifierons à l’autorité de contrôle compétente dans les 72 heures après en avoir pris connaissance, et nous informerons les utilisateurs concernés sans retard injustifié lorsque cela est requis.",

  /* 11. Children */
  "BrandOS is not directed at children under 16. We don't knowingly collect data from anyone under that age. If you believe a child has created an account, email us and we'll delete it.":
    "BrandOS ne s’adresse pas aux enfants de moins de 16 ans. Nous ne collectons pas sciemment de données auprès de personnes en dessous de cet âge. Si vous pensez qu’un enfant a créé un compte, écrivez-nous et nous le supprimerons.",

  /* 12. Changes to this policy */
  "We'll update the \"Last updated\" date at the top when this policy changes. For material changes that affect how we handle existing customer data, we'll email you 30 days before the change takes effect.":
    "Nous mettons à jour la date de « Dernière mise à jour » en haut de page lorsque la présente politique change. Pour les changements substantiels qui touchent la façon dont nous traitons les données des clients existants, nous vous écrivons par e-mail 30 jours avant leur prise d’effet.",

  /* 13. Contact and complaints */
  "For any data-related question or request:": "Pour toute question ou demande relative aux données :",
  "If you believe we have not handled your data properly, you can lodge a complaint with your local data-protection authority. In France, that's the":
    "Si vous estimez que nous n’avons pas traité vos données correctement, vous pouvez déposer une réclamation auprès de votre autorité locale de protection des données. En France, il s’agit de la",
  "CNIL": true,
  ". We'd appreciate the chance to fix things first by emailing us.":
    ". Nous aimerions avoir d’abord l’occasion de corriger les choses. Écrivez-nous.",

  /* Footer */
  "© 2026 Quantum Branding · Built by Nizzar Ben Chekroune": "© 2026 Quantum Branding · Conçu par Nizzar Ben Chekroune"
});
