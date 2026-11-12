/* fr · war-room.html
   Glossary and rules: docs/i18n/glossary-fr.md
   The operator's ship gate. Tiers and tasks are built in the page script.
   File names, routes, commands and tool names stay as written. */
QBI18N.add('fr', {
  /* Head */
  "Ship Gate · BrandOS": "Contrôle de mise en ligne · BrandOS",
  "What is missing before BrandOS can ship and take money safely.":
    "Ce qui manque avant que BrandOS puisse être mis en ligne et encaisser en toute sécurité.",

  /* Header */
  "BrandOS · Ship Gate": "BrandOS · Contrôle de mise en ligne",
  "What is missing": "Ce qui manque",
  "to ship": "pour mettre en ligne",
  "Four tiers ordered by what blocks revenue. Work the lowest open tier. Do not touch the next one until the current is clean.":
    "Quatre paliers, classés selon ce qui bloque le revenu. Travaillez le palier ouvert le plus bas. Ne touchez pas au suivant tant que le palier en cours n’est pas propre.",

  /* Status */
  "Ship readiness": "État de préparation",
  "Not ready. Tier 00 must close before anything else.":
    "Pas prêt. Le palier 00 doit être clos avant tout le reste.",
  "Security clean. Tier 01 transaction chain is still open.":
    "Sécurité propre. La chaîne de transaction du palier 01 est encore ouverte.",
  "Can take money. Polish remaining in Tier 02.":
    "Peut encaisser. Il reste des finitions au palier 02.",
  "Ship ready. Tiers 00, 01, and 02 are closed.":
    "Prêt pour la mise en ligne. Les paliers 00, 01 et 02 sont clos.",

  /* Legend */
  "Tier colors": "Couleurs des paliers",
  "Tier 00 · Security": "Palier 00 · Sécurité",
  "Tier 01 · Transaction": "Palier 01 · Transaction",
  "Tier 02 · Experience": "Palier 02 · Expérience",
  "Tier 03 · Backlog": "Palier 03 · Backlog",

  /* Footer */
  "BrandOS Ship Gate · May 2026 · State saved locally":
    "Contrôle de mise en ligne BrandOS · Mai 2026 · État enregistré localement",
  "Reset all checks": "Réinitialiser toutes les cases",
  "Reset every checkbox?": "Réinitialiser toutes les cases ?",

  /* Tier heads */
  "Tier 00": "Palier 00",
  "Tier 01": "Palier 01",
  "Tier 02": "Palier 02",
  "Tier 03": "Palier 03",
  "Security gate": "Contrôle de sécurité",
  "Transaction gate": "Contrôle de transaction",
  "Experience gate": "Contrôle d’expérience",
  "Post-launch backlog": "Backlog d’après lancement",
  "of {0}": "sur {0}",
  "Gate.": "Critère.",

  /* Tags */
  "5 min": true,
  "10 min": true,
  "15 min": true,
  "20 min": true,
  "30 min": true,
  "45 min": true,
  "60 min": true,
  "Build Chat": true,
  "Nizzar": true,
  "Supabase dashboard": "Tableau de bord Supabase",
  "Open file. Grep constructEvent.": "Ouvrir le fichier. Chercher constructEvent.",
  "Decision then Build Chat": "Décision, puis Build Chat",
  "Arch Chat then Build": "Arch Chat, puis Build",
  "Decision now": "Décision immédiate",
  "Week 1 post-launch": "Semaine 1 après lancement",
  "Week 2 post-launch": "Semaine 2 après lancement",
  "On demand": "À la demande",
  "2 to 3 weeks": "2 à 3 semaines",
  "4 to 6 weeks": "4 à 6 semaines",
  "1 week focused": "1 semaine dédiée",
  "After 3f": "Après 3f",
  "Q3 2026": "T3 2026",

  /* Tier 00 · Security */
  "No exfiltration, leakage, or abuse vector. Non-negotiable.":
    "Aucune exfiltration, aucune fuite, aucun vecteur d’abus. Non négociable.",
  "Verify Stripe webhook signature check": "Vérifier le contrôle de signature du webhook Stripe",
  "Open api/stripe-webhook.js. Confirm stripe.webhooks.constructEvent(body, sig, secret) runs on every request and rejects on failure. Without this, anyone can POST fake payment events.":
    "Ouvrez api/stripe-webhook.js. Confirmez que stripe.webhooks.constructEvent(body, sig, secret) s’exécute à chaque requête et rejette en cas d’échec. Sans cela, n’importe qui peut envoyer en POST de faux événements de paiement.",
  "Confirm Supabase RLS on every table": "Confirmer le RLS Supabase sur chaque table",
  "Supabase dashboard, Authentication, Policies. Every table with user data must have RLS enabled and policies that restrict reads to auth.uid() = user_id.":
    "Tableau de bord Supabase, Authentication, Policies. Chaque table contenant des données d’utilisateur doit avoir le RLS activé et des règles qui limitent la lecture à auth.uid() = user_id.",
  "Add origin check to all /api/* routes": "Ajouter un contrôle d’origine à toutes les routes /api/*",
  "Reject requests where the Origin header is not quantumbranding.ai or app.quantumbranding.ai. Otherwise someone clones the frontend and bills your Anthropic account.":
    "Rejetez les requêtes dont l’en-tête Origin n’est ni quantumbranding.ai ni app.quantumbranding.ai. Sinon, quelqu’un clone le frontend et fait facturer votre compte Anthropic.",
  "Document the ?apikey= browser-side pattern": "Documenter le schéma ?apikey= côté navigateur",
  "Known constraint per Master Instruction Part 15. Add a SECURITY.md note and a console.warn when the param is present. The server-side proxy is Tier 03 work.":
    "Contrainte connue, voir la Master Instruction, partie 15. Ajoutez une note dans SECURITY.md et un console.warn quand le paramètre est présent. Le proxy côté serveur relève du palier 03.",
  "Verify magic link tokens are single-use and time-bounded":
    "Vérifier que les jetons de lien magique sont à usage unique et limités dans le temps",
  "Default Supabase config is correct. Confirm you have not overridden it.":
    "La configuration par défaut de Supabase est correcte. Confirmez que vous ne l’avez pas modifiée.",
  "Privacy policy and terms of service pages live":
    "Pages Politique de confidentialité et Conditions d’utilisation en ligne",
  "GDPR applies, you are in France. Two pages linked from the footer. Standard SaaS templates are fine for v1.":
    "Le RGPD s’applique, vous êtes en France. Deux pages liées depuis le pied de page. Des modèles SaaS standards conviennent pour la v1.",

  /* Tier 01 · Transaction */
  "A stranger can complete: landing, scan, signup, checkout, webhook, access, first tool, output. One unbroken chain in incognito.":
    "Un inconnu peut aller au bout : page d’accueil, scan, inscription, paiement, webhook, accès, premier outil, résultat. Une chaîne sans rupture, en navigation privée.",
  "Anthropic auto-reload enabled": "Rechargement automatique Anthropic activé",
  "console.anthropic.com, Billing, Edit. Threshold $10, reload $25. Defensive max_tokens caps already shipped.":
    "console.anthropic.com, Billing, Edit. Seuil 10 $, rechargement 25 $. Les plafonds défensifs de max_tokens sont déjà en ligne.",
  "Stripe webhook endpoint wired in dashboard": "Point de terminaison du webhook Stripe branché dans le tableau de bord",
  "Stripe, Developers, Webhooks. Add https://app.quantumbranding.ai/api/stripe-webhook. Copy STRIPE_WEBHOOK_SECRET to Vercel env vars.":
    "Stripe, Developers, Webhooks. Ajoutez https://app.quantumbranding.ai/api/stripe-webhook. Copiez STRIPE_WEBHOOK_SECRET dans les variables d’environnement Vercel.",
  "Signal Scan end-to-end smoke test": "Test de bout en bout du Signal Scan",
  "Incognito, quantumbranding.ai/signal-scan.html, real API key, run, result renders, email arrives if applicable. Document any failure.":
    "Navigation privée, quantumbranding.ai/signal-scan.html, vraie clé d’API, lancement, le résultat s’affiche, l’e-mail arrive le cas échéant. Documentez tout échec.",
  "Account creation and magic link smoke test": "Test de création de compte et de lien magique",
  "Fresh email, signup, magic link arrives, click, land authenticated. Check the spam folder.":
    "Nouvel e-mail, inscription, le lien magique arrive, clic, arrivée authentifiée. Vérifiez le dossier des spams.",
  "Stripe checkout completes": "Le paiement Stripe aboutit",
  "Pick Starter tier, Stripe checkout opens, test card 4242, redirect lands cleanly on the success page.":
    "Choisissez l’offre Starter, le paiement Stripe s’ouvre, carte de test 4242, la redirection arrive proprement sur la page de succès.",
  "Webhook updates profile tier in Supabase": "Le webhook met à jour l’offre du profil dans Supabase",
  "After test checkout, open Supabase profiles table, confirm the row updated. The critical link. Without this, payment opens nothing.":
    "Après le paiement de test, ouvrez la table profiles de Supabase et confirmez que la ligne est à jour. Le maillon critique. Sans lui, le paiement n’ouvre rien.",
  "Authenticated user runs a paid tool to output": "Un utilisateur authentifié lance un outil payant jusqu’au résultat",
  "Same session as the checkout. Open one Phase 02 agent. QBP loads. Tool calls AI. Output renders.":
    "Même session que le paiement. Ouvrez un agent de la Phase 02. Le QBP se charge. L’outil appelle l’IA. Le résultat s’affiche.",
  "QBP writes through to Supabase, not just localStorage":
    "Le QBP s’écrit jusque dans Supabase, pas seulement dans localStorage",
  "brand-soul-map.html, complete one module, check the Supabase qbp table for the row. War room gl4.":
    "brand-soul-map.html, terminez un module, vérifiez la ligne dans la table qbp de Supabase. War room gl4.",

  /* Tier 02 · Experience */
  "Paying customers do not churn week one because the product feels broken, incoherent, or amateur.":
    "Les clients payants ne partent pas dès la première semaine parce que le produit paraît cassé, incohérent ou amateur.",
  "Merge or kill the Visual DNA swipe frame branch": "Fusionner ou abandonner la branche du cadre de swipe de Visual DNA",
  "fix/visual-dna-swipe-frame, commit 09072ed. Decide now so it does not rot on a branch.":
    "fix/visual-dna-swipe-frame, commit 09072ed. Décidez maintenant pour qu’elle ne pourrisse pas sur une branche.",
  "Walk the full flow as a fresh user, document every friction":
    "Refaire tout le flux en nouvel utilisateur, documenter chaque accroc",
  "New browser profile, fake email, real card or Stripe test mode. Every screen, every action. The doc becomes the reference for what \"works\" means.":
    "Nouveau profil de navigateur, faux e-mail, vraie carte ou mode test de Stripe. Chaque écran, chaque action. Le document devient la référence de ce que « ça marche » veut dire.",
  "Mobile pass on actual phone, every tool": "Passe mobile sur un vrai téléphone, chaque outil",
  "Open quantumbranding.ai on your phone. Walk the same flow. Note every layout break, tap target issue, and scroll trap.":
    "Ouvrez quantumbranding.ai sur votre téléphone. Refaites le même flux. Notez chaque mise en page cassée, chaque zone de toucher défaillante et chaque piège de défilement.",
  "War Table audience module: build or remove": "Module audience de War Table : construire ou retirer",
  "Four fields (beliefs, language, platforms, pain points) are not wired. Either ship the full tool or remove it from the v1 flow. Do not ship a half-tool.":
    "Quatre champs (croyances, langage, plateformes, points de douleur) ne sont pas branchés. Soit vous livrez l’outil complet, soit vous le retirez du flux de la v1. Ne livrez pas un demi-outil.",
  "Error states have human messages and retry buttons":
    "Les états d’erreur ont des messages humains et des boutons pour réessayer",
  "Defensive parsing covers the data side. Now check the UX side. AI timeout, rate limit, malformed response. User sees a clear message, not a stack trace.":
    "L’analyse défensive couvre le côté données. Vérifiez maintenant le côté UX. Délai d’IA dépassé, limite de débit, réponse mal formée. L’utilisateur voit un message clair, pas une trace d’exécution.",
  "QBP pre-population verified across all Phase 01 tools":
    "Préremplissage du QBP vérifié sur tous les outils de la Phase 01",
  "Complete one tool, confirm the next reads the new fields. Brand Soul Map, Sensescape, Visual DNA, War Table.":
    "Terminez un outil, confirmez que le suivant lit les nouveaux champs. Brand Soul Map, Sensescape, Visual DNA, War Table.",
  "Email deliverability tested from cold inbox": "Délivrabilité des e-mails testée sur une boîte neuve",
  "Send a magic link to a Gmail and an Outlook account you do not own. Confirm inbox placement, not spam.":
    "Envoyez un lien magique à un compte Gmail et à un compte Outlook qui ne sont pas les vôtres. Confirmez l’arrivée en boîte de réception, pas en spam.",
  "Support inbox and refund flow ready": "Boîte de support et procédure de remboursement prêtes",
  "support@quantumbranding.ai live. Refund flow in Stripe tested once. A known-issues note in a doc you can paste from.":
    "support@quantumbranding.ai en service. Procédure de remboursement dans Stripe testée une fois. Une note des problèmes connus dans un document où copier-coller.",

  /* Tier 03 · Backlog */
  "Build after revenue. None of this blocks launch. Locked from the runner until Tiers 00, 01, and 02 are clean.":
    "À construire après le revenu. Rien de tout cela ne bloque le lancement. Verrouillé tant que les paliers 00, 01 et 02 ne sont pas propres.",
  "BrandOS Atelier landing page": "Page d’atterrissage BrandOS Atelier",
  "Premium consulting wedge. Highest-leverage backlog item because it monetises Scan traffic at higher price points. Shipped in PR #13.":
    "L’entrée vers le conseil premium. L’élément du backlog au plus fort effet de levier, car il monétise le trafic du Scan à des prix plus élevés. Livré dans la PR #13.",
  "Atelier CTA after Signal Scan result": "Appel à l’action Atelier après le résultat du Signal Scan",
  "Bridges the Scan output into a consulting funnel. Copy lead: \"Not enough time. Let us build it with you.\"":
    "Relie le résultat du Scan à un tunnel de conseil. Accroche : « Pas assez de temps. Construisons-le avec vous. »",
  "Atelier card in pricing section": "Carte Atelier dans la section Tarifs",
  "Reframe the four-tier matrix as four products and one service on ecosystem.html.":
    "Recadrer la matrice à quatre offres en quatre produits et un service sur ecosystem.html.",
  "Predictive Panel gates 1 and 2: reposition or kill": "Portes 1 et 2 de Predictive Panel : repositionner ou abandonner",
  "Per the decisions panel, the call was \"Reposition\". Decide what they are before building.":
    "D’après le panneau des décisions, le choix était « Repositionner ». Décidez de ce qu’elles sont avant de construire.",
  "PDF exports: Brand Performance and Quarterly Review":
    "Exports PDF : Performance de marque et Revue trimestrielle",
  "Brand Document Builder pattern. Easy to add when customers ask.":
    "Même schéma que le générateur du Document de marque. Facile à ajouter quand les clients le demandent.",
  "Managed Agents: prove Phase 02 orchestration end-to-end":
    "Managed Agents : prouver l’orchestration de la Phase 02 de bout en bout",
  "SDK install, quickstart, extract Phase 02 prompts, create agent, create environment, end-to-end run. The v2 of the product.":
    "Installation du SDK, démarrage rapide, extraction des prompts de la Phase 02, création de l’agent, création de l’environnement, exécution de bout en bout. La v2 du produit.",
  "Build The Feed (SSE stream)": "Construire The Feed (flux SSE)",
  "User-facing layer that watches agents work. Only after the Phase 02 agent is proven.":
    "La couche visible par l’utilisateur, qui regarde les agents travailler. Seulement une fois l’agent de la Phase 02 éprouvé.",
  "Phase 03, 04, 05 agents and gate wiring": "Agents des Phases 03, 04, 05 et branchement des portes",
  "Sequenced after Phase 02 works in production.": "À enchaîner une fois la Phase 02 en service en production.",
  "Server-side API proxy (replaces the ?apikey= pattern)": "Proxy d’API côté serveur (remplace le schéma ?apikey=)",
  "Architectural shift, not hotfix. The clean fix for the Tier 00 security note. After revenue is flowing.":
    "Un changement d’architecture, pas un correctif à chaud. La correction propre de la note de sécurité du palier 00. Une fois le revenu en place.",
  "Native app: framework choice, WebView, Feed, App Store":
    "Application native : choix du framework, WebView, Feed, App Store",
  "Do not start until agents are proven. A native shell around a half-built web app is a worse product.":
    "Ne commencez pas avant que les agents soient éprouvés. Une coque native autour d’une application web à moitié construite est un moins bon produit.",
  "Buffer integration for Content Scheduler": "Intégration de Buffer pour le Planificateur de contenu",
  "Only when paying customers want auto-posting. Token paste, 5 min.":
    "Seulement quand des clients payants veulent la publication automatique. Collage du jeton, 5 min."
});
