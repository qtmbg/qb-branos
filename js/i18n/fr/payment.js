/* fr · payment.html
   Every state of the checkout: plans, not on sale, processing, success, error. */
QBI18N.add('fr', {
  /* Head */
  "Access · BrandOS": "Accès · BrandOS",
  "Starter: $97 a month. Everything in Brand Profile, plus your full foundation and the Phase 02 agents. Cancel anytime.":
    "Starter : 97 $ par mois. Tout le Profil de marque, plus votre fondation complète et les agents de la Phase 02. Résiliation à tout moment.",
  "Starter: $97 a month. The full BrandOS foundation and the Phase 02 agents.":
    "Starter : 97 $ par mois. La fondation BrandOS complète et les agents de la Phase 02.",

  /* Plans view */
  "[QB_OS]": true,
  "Open the full BrandOS": "Ouvrez BrandOS en entier",
  "The exercises are free. Starter opens the agents that do the work.":
    "Les exercices sont gratuits. Starter ouvre les agents qui font le travail.",
  "Checkout is not available right now. Write to me@qtmbg.com.":
    "Le paiement n’est pas disponible pour le moment. Écrivez à me@qtmbg.com.",
  "Starter, $97 per month": "Starter, 97 $ par mois",
  "$97": "97 $",
  "/ month": "/ mois",
  "Everything in Brand Profile, plus your full foundation and the Phase 02 agents.":
    "Tout le Profil de marque, plus votre fondation complète et les agents de la Phase 02.",
  "Every Phase 01 reading: Sensescape, Visual DNA, War Table":
    "Chaque lecture de la Phase 01 : Sensescape, Visual DNA, War Table",
  "Phase 02 agents: Logo Direction, Logo Evaluation, Voice Guide":
    "Agents de la Phase 02 : Direction de logo, Évaluation de logo, Voice Guide",
  "Full Brand Profile (QBP) export": "Export complet du Profil de marque (QBP)",
  "Full refund within 14 days of your first payment":
    "Remboursement intégral dans les 14 jours suivant votre premier paiement",
  "Cancel anytime": "Résiliation à tout moment",
  "Free, and staying free: Signal Scan and every Phase 01 exercise":
    "Gratuit, et qui le reste : Signal Scan et chaque exercice de la Phase 01",
  "Some of what your foundation leaves open will not be settled by another exercise. Those need a person. Write to":
    "Une partie de ce que votre fondation laisse ouvert ne se réglera pas par un exercice de plus. Cela demande une personne. Écrivez à",
  "me@qtmbg.com": true,
  "and say which question you are stuck on.": "et dites sur quelle question vous bloquez.",
  "Already have an account?": "Vous avez déjà un compte ?",
  "Sign in →": "Connexion →",

  /* Processing view */
  "Redirecting to checkout": "Redirection vers le paiement",
  "You will complete payment securely on Stripe.":
    "Vous finaliserez le paiement en toute sécurité sur Stripe.",

  /* Success view */
  "You're in.": "Vous y êtes.",
  "Your account is active. Your API key and QBP are waiting in the system.":
    "Votre compte est actif. Votre clé API et votre QBP vous attendent dans le système.",
  "Enter BrandOS →": "Entrer dans BrandOS →",

  /* Error view. The message under the title comes from the checkout
     endpoint (api/stripe/checkout.js, api/_lib/auth.js) or from the browser. */
  "Something went wrong": "Une erreur est survenue",
  "Please try again or contact support.": "Veuillez réessayer ou contacter le support.",
  "← Try Again": "← Réessayer",
  "Missing authorization": "Autorisation manquante",
  "Invalid session": "Session invalide",
  "Invalid body": "Requête invalide",
  "Method not allowed": "Méthode non autorisée",
  "price_id is required": "Le tarif est requis",
  "Not configured: {0}": "Non configuré : {0}",
  "unknown_price_id": "Tarif inconnu",
  "tier_not_yet_available": "Cette offre n’est pas encore disponible",
  "stripe_error": "Erreur du côté de Stripe",
  "stripe_returned_no_url": "Stripe n’a pas renvoyé de lien de paiement",
  "HTTP {0}": true,
  "Failed to fetch": "Connexion impossible. Vérifiez votre réseau.",
  "Load failed": "Connexion impossible. Vérifiez votre réseau.",
  "NetworkError when attempting to fetch resource.": "Connexion impossible. Vérifiez votre réseau.",

  /* Footer */
  "The Brand Operating System. From idea to orbit. Identity, look, voice, content, strategy. One connected platform.":
    "Le système d’exploitation de marque. De l’idée à l’orbite. Identité, allure, voix, contenu, stratégie. Une seule plateforme connectée."
});
