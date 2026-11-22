// Brand MRI · the scoring engine. Deterministic, no model call, no backend.
//
// Input : ten answers (0, 3, 7 or 10), in question order.
// Output: a global score, five pillar scores, the three tensions in order.
//
// The engine speaks in ids and numbers. Every word a visitor reads lives in
// js/mri-i18n.js, so one diagnostic renders in either language.
// api/_lib/mri.js repeats this arithmetic for the server. The harness in
// tests/mri/mri.mjs runs both on the same answers and fails on any drift.

var MRI_PILLARS = [
  { id: 'phrase', questions: [0, 1] },
  { id: 'logo', questions: [2, 3] },
  { id: 'coherence', questions: [4, 5] },
  { id: 'differentiation', questions: [6, 7] },
  { id: 'preuve', questions: [8, 9] }
];

var MRI_OPTION_VALUES = [0, 3, 7, 10];

function mriLevel(score) {
  if (score < 40) return 'weak';
  if (score < 70) return 'mid';
  return 'solid';
}

function mriDiagnose(answers) {
  if (!Array.isArray(answers) || answers.length !== 10) {
    throw new Error('diagnose expects exactly 10 answers');
  }
  for (var i = 0; i < 10; i++) {
    if (MRI_OPTION_VALUES.indexOf(answers[i]) === -1) throw new Error('answer ' + (i + 1) + ' is not 0, 3, 7 or 10');
  }
  var pillars = MRI_PILLARS.map(function (p) {
    var raw = Math.round((answers[p.questions[0]] + answers[p.questions[1]]) / 2 * 10) / 10;
    var pct = Math.round(raw * 10);
    return { id: p.id, score: pct, level: mriLevel(pct), questions: p.questions.slice() };
  });
  var global = Math.round(pillars.reduce(function (s, p) { return s + p.score; }, 0) / pillars.length);
  var sorted = pillars.slice().sort(function (a, b) { return a.score - b.score; });
  return {
    global: global,
    globalLevel: mriLevel(global),
    pillars: pillars,
    tensions: sorted.slice(0, 3),
    strongest: sorted[sorted.length - 1]
  };
}

// What one tier shows, as data. The page draws this and nothing else.
//
// The rule it encodes: within one view, a piece of advice appears once.
//   flash  : the three tensions carry their advice. The priority workstream
//            adds the exit test for the first one and repeats nothing.
//   full + : the 90-day plan carries the advice of the three tensions as
//            its actions. The pillar cards carry advice only for the two
//            pillars the plan leaves out, and point to the plan otherwise.
function mriReportModel(d, tier) {
  var rank = { free: 0, flash: 1, full: 2, review: 3 }[tier] || 0;
  var m = {
    tier: rank === 0 ? 'free' : tier,
    score: d.global,
    brake: d.tensions[0].id,
    reading: rank >= 1,
    tensions: null,
    priority: null,
    pillars: null,
    plan: null,
    sentence: rank >= 2,
    review: rank >= 3
  };
  if (rank === 1) {
    m.tensions = d.tensions.map(function (p) { return { id: p.id, score: p.score, level: p.level, advice: true }; });
    m.priority = { id: d.tensions[0].id, exitTest: d.tensions[0].questions.slice() };
  }
  if (rank >= 2) {
    var planIds = d.tensions.map(function (p) { return p.id; });
    m.pillars = d.pillars.map(function (p) {
      var phase = planIds.indexOf(p.id);
      return { id: p.id, score: p.score, level: p.level, advice: phase === -1, phase: phase };
    });
    m.plan = d.tensions.map(function (p, i) {
      return { phase: i, id: p.id, score: p.score, level: p.level, advice: true, exitTest: p.questions.slice() };
    });
  }
  return m;
}

// The positioning sentence, assembled from what the buyer wrote.
// `complete` is false while a slot still shows its bracketed placeholder,
// so the page can present the line as a frame to fill and never as a
// finished sentence.
function mriSentence(inputs, strings) {
  var d = strings.sentenceDefaults;
  var v = {
    target: String((inputs && inputs.target) || '').trim(),
    brand: String((inputs && inputs.brand) || '').trim(),
    difference: String((inputs && inputs.difference) || '').trim(),
    proof: String((inputs && inputs.proof) || '').trim()
  };
  var text = strings.sentence
    .replace('{target}', v.target || d.target)
    .replace('{brand}', v.brand || d.brand)
    .replace('{difference}', v.difference || d.difference)
    .replace('{proof}', v.proof || d.proof);
  return { text: text, complete: Boolean(v.brand && v.difference && v.proof) };
}

var MRI_ENGINE = {
  PILLARS: MRI_PILLARS,
  OPTION_VALUES: MRI_OPTION_VALUES,
  level: mriLevel,
  diagnose: mriDiagnose,
  reportModel: mriReportModel,
  sentence: mriSentence
};

// Export Node (tests) and browser (window).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MRI_ENGINE;
} else if (typeof window !== 'undefined') {
  window.MRI = MRI_ENGINE;
}
