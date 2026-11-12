// Brand MRI V2 : interface par palier. Moteur dans mri.js, regles dans tiers.js.
// Liens Payment Link Stripe live, compte Quantum Branding LLC, crees le 2026-11-01.
// Apres paiement, Stripe redirige vers ?paid=<palier> : refaire le diagnostic
// dans la meme adresse debloque le palier paye. Mode demo sans payer :
// ?demo=flash, ?demo=full ou ?demo=review.
var STRIPE = { flash: "https://buy.stripe.com/4gM4gz8PY4uWfpD9xY2Ry04", full: "https://buy.stripe.com/8x28wP9U29Pg7XbcKa2Ry05", upgrade60: "https://buy.stripe.com/cNi14n3vEaTk4KZ5hI2Ry06", review211: "https://buy.stripe.com/28E6oHeaigdE1yNh0q2Ry07", reviewFull: "https://buy.stripe.com/9B68wP5DM3qSa5jeSi2Ry08", retest39: "https://buy.stripe.com/fZu3cv9U28Lc3GV9xY2Ry09" };
var params = new URLSearchParams(window.location.search);
var DEMO = params.get("demo") || params.get("paid"); // flash | full | review
var PAID = params.get("paid") !== null;
var RETEST = params.get("retest") === "1";
var FOCUS = params.get("focus");
var tier = DEMO || "free";
var lastDiagnosis = null;

function el(id) { return document.getElementById(id); }
function saveLead(d) {
  var lead = { date: new Date().toISOString(), brand: el("brand").value.trim(), website: el("website").value.trim(), email: el("email").value.trim(), score: d.global, frein: d.tensions[0].name, tier: tier };
  try {
    var leads = JSON.parse(localStorage.getItem("mri_leads") || "[]");
    leads.push(lead);
    localStorage.setItem("mri_leads", JSON.stringify(leads));
  } catch (e) {}
  captureLead(lead);
}

// Capture serveur (2026-11-10) : les appels navigateur directs a Klaviyo
// echouent au niveau reseau (Failed to fetch, prouve via ?debug=1), donc
// le lead part par /api/mri-lead (email Resend vers la boite de la pratique)
// et le compte BrandOS est cree par le magic link du site. Tout est en
// arriere-plan, aucun echec ne bloque l'affichage du score.
var CAPTURE_DEBUG = params.get("debug") === "1";
function captureLog(msg) {
  try {
    var box = el("captureDebug");
    if (CAPTURE_DEBUG && box) { box.classList.remove("hidden"); box.textContent += msg + " | "; }
  } catch (e) {}
}
function captureLead(lead) {
  try {
    fetch("/api/mri-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: lead.email, brand: lead.brand, website: lead.website, score: lead.score, frein: lead.frein, tier: lead.tier })
    }).then(function (r) { captureLog("lead serveur HTTP " + r.status); }).catch(function (err) { captureLog("lead serveur erreur " + err); });
  } catch (e) { captureLog("lead serveur exception " + e); }
  try {
    if (window.QB && window.QB.sendMagicLink) {
      window.QB.sendMagicLink(lead.email, "", "brand-mri", "/mri").then(function (r) { captureLog("magic link " + (r && r.ok ? "OK" : "echec " + (r && r.error))); }).catch(function (err) { captureLog("magic link erreur " + err); });
    } else { captureLog("magic link absent (QB non charge)"); }
  } catch (e) { captureLog("magic link exception " + e); }
}

var FOCUS_HEADLINES = {
  phrase: "Votre phrase tient-elle en une ligne ? Votre score le dit en 5 minutes.",
  logo: "Sans logo, votre marque est-elle reconnaissable ? Votre score le dit en 5 minutes.",
  coherence: "Votre promesse est-elle la même partout ? Votre score le dit en 5 minutes.",
  differentiation: "Ce que vos concurrents ne peuvent pas dire : votre score le dit en 5 minutes.",
  preuve: "Votre promesse est-elle prouvée ? Votre score le dit en 5 minutes."
};
if (FOCUS && FOCUS_HEADLINES[FOCUS]) el("headline").textContent = FOCUS_HEADLINES[FOCUS];
if (PAID) el("headline").textContent = "Paiement recu, merci. Refaites le diagnostic, votre palier est deja debloque.";
if (RETEST) el("retestNote").classList.remove("hidden");

function renderQuestions() {
  var wrap = el("questions");
  window.MRI.QUESTIONS.forEach(function (q, qi) {
    var pillar = window.MRI.PILLARS[Math.floor(qi / 2)];
    var fs = document.createElement("fieldset");
    var lg = document.createElement("legend");
    lg.textContent = (qi + 1) + ". [" + pillar.name + "] " + q;
    fs.appendChild(lg);
    var div = document.createElement("div"); div.className = "opts";
    window.MRI.OPTIONS.forEach(function (opt) {
      var lab = document.createElement("label");
      var inp = document.createElement("input");
      inp.type = "radio"; inp.name = "q" + qi; inp.value = opt.value;
      lab.appendChild(inp); lab.appendChild(document.createTextNode(" " + opt.label));
      div.appendChild(lab);
    });
    fs.appendChild(div); wrap.appendChild(fs);
  });
}

function readAnswers() {
  var answers = [];
  for (var i = 0; i < 10; i++) {
    var checked = document.querySelector('input[name="q' + i + '"]:checked');
    if (!checked) return null;
    answers.push(parseInt(checked.value, 10));
  }
  return answers;
}

function renderOffer() {
  var offer = window.TIERS.nextOffer(tier);
  var box = el("offerBox");
  if (!offer) { box.innerHTML = '<div class="card price"><strong>Palier maximal atteint.</strong><p>Rapport complet + review commandée. Prochaine étape : audit humain, avec vos 79 $ déduits sous 30 jours.</p></div>'; return; }
  var stripeKey = tier === "free" ? (RETEST ? "retest39" : "flash") : tier === "flash" ? "upgrade60" : "review211";
  var url = STRIPE[stripeKey];
  var label = RETEST && tier === "free" ? "Re-test 90 jours · 39 $" : offer.label;
  box.innerHTML = '<div class="card price"><strong>' + label + '</strong><p>' +
    (tier === "free" ? "Le détail de vos tensions et votre premier chantier, livrés immédiatement." :
     tier === "flash" ? "Le rapport complet, sans repayer le Flash : 19 $ déjà payés, 60 $ de plus." :
     "La vidéo de Nizzar sur votre rapport, 10 min, sous 72 h ouvrées.") + '</p></div>';
  var btn = document.createElement("button");
  btn.textContent = url ? label + " · Payer par Stripe" : label + " · Paiement en cours d'activation";
  btn.disabled = !url;
  if (url) btn.addEventListener("click", function () { window.location.href = url; });
  box.appendChild(btn);
  if (tier === "free" && !RETEST && STRIPE.full) {
    var btn2 = document.createElement("button");
    btn2.className = "secondary";
    btn2.textContent = "Rapport complet direct · 79 $ · Payer par Stripe";
    btn2.addEventListener("click", function () { window.location.href = STRIPE.full; });
    box.appendChild(btn2);
  }
  if (!url) {
    var note = document.createElement("p"); note.className = "note";
    note.textContent = "Mode démo : ajoutez ?demo=flash, ?demo=full ou ?demo=review à l'adresse pour tester ce palier sans payer. En production, ce bouton ouvre Stripe.";
    box.appendChild(note);
  }
}

function renderResult(d) {
  lastDiagnosis = d;
  el("globalScore").textContent = d.global;
  el("frein").textContent = "Votre frein principal : " + d.tensions[0].name + ". Le détail et le plan sont dans les paliers payants.";
  el("tierNote").textContent = (PAID ? "Paiement recu, merci. " : "") + "Palier actuel : " + (tier === "free" ? "score gratuit" : tier === "flash" ? "Flash (19 $, total payé 19 $)" : tier === "full" ? "Rapport complet (total payé 79 $)" : "Rapport + review (total payé 290 $)") + ".";
  var vis = window.TIERS.visibleSections(tier);
  if (vis.tensions) {
    el("flashSection").classList.remove("hidden");
    el("tensions").innerHTML = d.tensions.map(function (p, i) {
      return '<div class="card"><strong>' + (i + 1) + '. ' + p.name + ' (' + p.score + '/100)</strong><p>' + p.advice + '</p></div>';
    }).join("");
    el("chantier").innerHTML = '<div class="card"><strong>Chantier 1 : ' + d.tensions[0].name + '</strong><p>' + d.tensions[0].advice + '</p></div>';
  }
  if (vis.rapportComplet) {
    el("fullSection").classList.remove("hidden");
    el("pillarScores").innerHTML = d.pillars.map(function (p) {
      return '<div class="card"><strong>' + p.name + ' : ' + p.score + '/100</strong> (' + p.level + ')<div class="bar"><div style="width:' + p.score + '%"></div></div><p>' + p.short + '</p><p>' + p.advice + '</p></div>';
    }).join("");
    el("proposedSentence").textContent = window.MRI.proposedSentence({ brand: el("brand").value.trim(), target: el("target").value.trim() });
    el("currentPhraseOut").textContent = el("currentPhrase").value.trim() || "non renseignée";
    el("plan90").innerHTML = d.tensions.map(function (p, i) {
      var phase = ["Jours 1 à 30", "Jours 31 à 60", "Jours 61 à 90"][i];
      return '<div class="card"><strong>' + phase + ' : ' + p.name + '</strong><p>' + p.advice + '</p></div>';
    }).join("");
  }
  if (vis.reviewForm) el("reviewSection").classList.remove("hidden");
  if (RETEST && el("prevScore").value) {
    var prev = parseInt(el("prevScore").value, 10);
    var diff = d.global - prev;
    el("retestCompare").classList.remove("hidden");
    el("retestCompare").textContent = "Comparaison re-test : " + prev + " → " + d.global + " (" + (diff >= 0 ? "+" : "") + diff + " points).";
  }
  renderOffer();
}

el("startBtn").addEventListener("click", function () {
  el("landing").classList.add("hidden");
  el("form").classList.remove("hidden");
  if (RETEST) el("prevScoreWrap").classList.remove("hidden");
  window.scrollTo(0, 0);
});

el("resultBtn").addEventListener("click", function () {
  if (!el("email").value.trim() || el("email").value.indexOf("@") === -1) { alert("Indiquez votre email pour voir le score gratuit."); return; }
  var answers = readAnswers();
  if (!answers) { alert("Répondez aux 10 questions pour voir le résultat."); return; }
  var d = window.MRI.diagnose(answers);
  saveLead(d);
  el("form").classList.add("hidden");
  el("result").classList.remove("hidden");
  renderResult(d);
  window.scrollTo(0, 0);
});

el("printBtn").addEventListener("click", function () { window.print(); });
el("reviewSubmitBtn").addEventListener("click", function () {
  var q = el("reviewQuestions").value.trim();
  if (!q) { alert("Ecrivez vos 2 ou 3 phrases pour la review, puis envoyez."); return; }
  var subject = encodeURIComponent("Brand MRI review : " + el("brand").value.trim());
  var body = encodeURIComponent("Marque : " + el("brand").value.trim() + "\nSite : " + el("website").value.trim() + "\nEmail : " + el("email").value.trim() + "\nScore : " + (lastDiagnosis ? lastDiagnosis.global : "") + "/100\n\nQuestions pour la review :\n" + q);
  window.location.href = "mailto:me@qtmbg.com?subject=" + subject + "&body=" + body;
});
el("exportBtn").addEventListener("click", function () {
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem("mri_leads") || "[]"); } catch (e) {}
  if (!leads.length) { alert("Aucun lead enregistré dans ce navigateur."); return; }
  var csv = "date,brand,website,email,score,frein,tier\n" + leads.map(function (l) {
    return [l.date, l.brand, l.website, l.email, l.score, l.frein, l.tier].join(",");
  }).join("\n");
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "brand-mri-leads.csv"; a.click();
});

renderQuestions();
