// Brand MRI V1 : moteur de score deterministe, sans LLM, sans backend.
// Entree : answers = tableau de 10 nombres (0, 3, 7 ou 10), dans l'ordre des questions.
// Sortie : score global, scores par pilier, tensions triees, phrase de lecture.

const PILLARS = [
  { id: "phrase", name: "La phrase", short: "Positionnement en une phrase", questions: [0, 1] },
  { id: "logo", name: "Le test du logo", short: "Reconnaissable sans logo", questions: [2, 3] },
  { id: "coherence", name: "Cohérence", short: "Meme promesse partout", questions: [4, 5] },
  { id: "differentiation", name: "Différenciation", short: "Ce que les concurrents ne peuvent pas dire", questions: [6, 7] },
  { id: "preuve", name: "Preuve", short: "Ce qui prouve la promesse", questions: [8, 9] },
];

const QUESTIONS = [
  "Un visiteur comprend-il en 5 secondes ce que vous vendez, a qui, et pourquoi vous ?",
  "Votre phrase de positionnement tient-elle en une phrase, sans jargon ?",
  "Sans logo, votre site reste-t-il reconnaissable face a 3 concurrents ?",
  "Votre identite visuelle (couleurs, typographie, ton) est-elle distincte, ou generique ?",
  "La meme promesse apparait-elle sur le site, les reseaux et les documents commerciaux ?",
  "Le ton et le message sont-ils les memes partout, sans contradiction ?",
  "Avez-vous une affirmation que vos concurrents ne peuvent pas reprendre telle quelle ?",
  "Un client peut-il dire pourquoi vous choisir, vous, plutot qu'un concurrent, en une phrase ?",
  "Des preuves visibles soutiennent-elles la promesse (cas clients, chiffres, presse, avis) ?",
  "Ces preuves sont-elles precises et verifiables, ou vagues et generiques ?",
];

const OPTIONS = [
  { label: "Non", value: 0 },
  { label: "Plutot non", value: 3 },
  { label: "Plutot oui", value: 7 },
  { label: "Oui, clairement", value: 10 },
];

function level(score) {
  if (score < 40) return "faible";
  if (score < 70) return "a renforcer";
  return "solide";
}

function pillarAdvice(pillar, score) {
  const texts = {
    phrase: {
      faible: "Reecrire la phrase en une ligne : ce que vous vendez, a qui, pourquoi vous. La tester sur 5 inconnus.",
      "a renforcer": "Raccourcir la phrase et la placer en haut de la page d'accueil, mot pour mot, partout.",
      solide: "Garder cette phrase intacte. Ne pas la diluer avec des variantes par canal.",
    },
    logo: {
      faible: "Definir 3 signes distinctifs hors logo : une couleur, une typographie, un ton. Les appliquer partout.",
      "a renforcer": "Supprimer les elements generiques et garder un seul signe fort, repete a chaque point de contact.",
      solide: "Proteger cette identite. Tout nouveau support doit passer le test sans logo.",
    },
    coherence: {
      faible: "Aligner site, reseaux et documents sur une seule promesse ecrite. Corriger les contradictions en premier.",
      "a renforcer": "Faire une passe canal par canal et remplacer chaque promesse divergente par la promesse centrale.",
      solide: "Documenter la promesse centrale pour que chaque nouveau contenu la reprenne sans derivation.",
    },
    differentiation: {
      faible: "Trouver une affirmation que les concurrents ne peuvent pas dire, puis la prouver. Sans elle, le prix decide.",
      "a renforcer": "Formuler la difference en une affirmation concrete, pas en adjectifs (premium, innovant, humain).",
      solide: "Rendre la difference plus difficile a copier : un actif, une methode, une preuve propre a vous.",
    },
    preuve: {
      faible: "Ajouter 3 preuves precises sur la page d'accueil : un cas client, un chiffre, un temoignage nomme.",
      "a renforcer": "Remplacer les preuves vagues par des preuves chiffrees et verifiables, avec noms et contextes.",
      solide: "Mettre les meilleures preuves au meme niveau que la promesse, pas en bas de page.",
    },
  };
  return texts[pillar][level(score)];
}

function diagnose(answers) {
  if (!Array.isArray(answers) || answers.length !== 10) {
    throw new Error("diagnose attend exactement 10 reponses");
  }
  const pillars = PILLARS.map(function (p) {
    const score = Math.round((answers[p.questions[0]] + answers[p.questions[1]]) / 2 * 10) / 10;
    const pct = Math.round(score * 10);
    return { id: p.id, name: p.name, short: p.short, score: pct, level: level(pct), advice: pillarAdvice(p.id, pct) };
  });
  const global = Math.round(pillars.reduce(function (s, p) { return s + p.score; }, 0) / pillars.length);
  const sorted = pillars.slice().sort(function (a, b) { return a.score - b.score; });
  const tensions = sorted.slice(0, 3);
  const strongest = sorted[sorted.length - 1];
  const reading = "Point le plus solide : " + strongest.name + " (" + strongest.score + "/100). Frein principal : " + tensions[0].name + " (" + tensions[0].score + "/100). " +
    (global < 40 ? "Le diagnostic est faible dans l'ensemble : commencer par les 3 tensions, dans l'ordre."
    : global < 70 ? "La base existe, mais les tensions ci-dessous limitent la lisibilite de la marque."
    : "La marque est lisible. Le travail porte sur les derniers ecarts, pas sur une refonte.");
  return { global: global, globalLevel: level(global), pillars: pillars, tensions: tensions, strongest: strongest, reading: reading };
}

function proposedSentence(inputs) {
  const brand = (inputs && inputs.brand) || "[Votre marque]";
  const target = (inputs && inputs.target) || "vos clients";
  const diff = (inputs && inputs.difference) || "ce que vos concurrents ne peuvent pas dire";
  const proof = (inputs && inputs.proof) || "vos preuves";
  return "Pour " + target + ", " + brand + " est " + diff + ", prouve par " + proof + ".";
}

// Export Node (tests) et navigateur (window).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PILLARS: PILLARS, QUESTIONS: QUESTIONS, OPTIONS: OPTIONS, diagnose: diagnose, proposedSentence: proposedSentence, level: level };
} else if (typeof window !== "undefined") {
  window.MRI = { PILLARS: PILLARS, QUESTIONS: QUESTIONS, OPTIONS: OPTIONS, diagnose: diagnose, proposedSentence: proposedSentence };
}
