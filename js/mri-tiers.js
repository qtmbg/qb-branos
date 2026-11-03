// Brand MRI V2 : regles de debloquage par palier. Pur, testable.
// free : score + nom du frein principal seulement.
// flash : + 3 tensions detaillees + 1er chantier.
// full : + 5 piliers, phrase proposee, 3 chantiers, plan 90 jours.
// review : + formulaire de commande de la review video.

function visibleSections(tier) {
  return {
    score: true,
    freinPrincipal: true,
    tensions: tier === "flash" || tier === "full" || tier === "review",
    chantierPrioritaire: tier === "flash" || tier === "full" || tier === "review",
    rapportComplet: tier === "full" || tier === "review",
    reviewForm: tier === "review",
  };
}

function nextOffer(tier) {
  if (tier === "free") return { label: "MRI Flash · 19 $", price: 19, to: "flash" };
  if (tier === "flash") return { label: "Passer au rapport complet · 60 $ de plus (total 79 $)", price: 60, to: "full" };
  if (tier === "full") return { label: "Ajouter la review video · 211 $ de plus (total 290 $)", price: 211, to: "review" };
  return null;
}

function totalPaid(tier) {
  if (tier === "flash") return 19;
  if (tier === "full") return 79;
  if (tier === "review") return 290;
  return 0;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { visibleSections: visibleSections, nextOffer: nextOffer, totalPaid: totalPaid };
} else if (typeof window !== "undefined") {
  window.TIERS = { visibleSections: visibleSections, nextOffer: nextOffer, totalPaid: totalPaid };
}
