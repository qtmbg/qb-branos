// Brand MRI · tier rules. Pure, testable.
//
//   free   : score and the name of the main brake.
//   flash  : + the three tensions and the first workstream.
//   full   : + five pillars, the positioning sentence, the 90-day plan.
//   review : + the order form for the video review.
//
// A paid tier comes from one place only: a Stripe Checkout Session that
// /api/mri-verify has confirmed as paid. The address bar opens nothing.
// The single exception is ?demo= on a host that is not production, so a
// preview deployment can show every tier without a payment.

var MRI_TIER_RANK = { free: 0, flash: 1, full: 2, review: 3 };

var MRI_PROD_HOSTS = ['quantumbranding.ai', 'www.quantumbranding.ai', 'app.quantumbranding.ai'];

function mriIsProdHost(hostname) {
  return MRI_PROD_HOSTS.indexOf(String(hostname || '').toLowerCase()) !== -1;
}

// The highest tier among confirmed sessions. A re-test session carries no
// rank: it measures progress and opens no report by itself.
function mriMaxTier(tiers) {
  var best = 'free';
  (tiers || []).forEach(function (t) {
    if (MRI_TIER_RANK[t] != null && MRI_TIER_RANK[t] > MRI_TIER_RANK[best]) best = t;
  });
  return best;
}

// ctx: { sessions: [{ tier }], demo: string|null, hostname: string }
function mriResolveTier(ctx) {
  var confirmed = mriMaxTier(((ctx && ctx.sessions) || []).map(function (s) { return s && s.tier; }));
  var demo = ctx && ctx.demo;
  if (demo && MRI_TIER_RANK[demo] != null && !mriIsProdHost(ctx.hostname)) return demo;
  return confirmed;
}

function mriVisibleSections(tier) {
  var rank = MRI_TIER_RANK[tier] || 0;
  return {
    score: true,
    freinPrincipal: true,
    tensions: rank >= 1,
    chantierPrioritaire: rank >= 1,
    rapportComplet: rank >= 2,
    reviewForm: rank >= 3
  };
}

// The Stripe links to offer from a tier. `key` names the payment link.
function mriNextOffers(tier, retest) {
  if (tier === 'free') {
    return retest
      ? [{ key: 'retest39', to: 'free', primary: true }]
      : [{ key: 'flash', to: 'flash', primary: true }, { key: 'full', to: 'full', primary: false }];
  }
  if (tier === 'flash') return [{ key: 'upgrade60', to: 'full', primary: true }];
  if (tier === 'full') return [{ key: 'review211', to: 'review', primary: true }];
  return [];
}

function mriTotalPaid(tier) {
  if (tier === 'flash') return 19;
  if (tier === 'full') return 79;
  if (tier === 'review') return 290;
  return 0;
}

var MRI_TIERS_API = {
  RANK: MRI_TIER_RANK,
  isProdHost: mriIsProdHost,
  maxTier: mriMaxTier,
  resolveTier: mriResolveTier,
  visibleSections: mriVisibleSections,
  nextOffers: mriNextOffers,
  totalPaid: mriTotalPaid
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MRI_TIERS_API;
} else if (typeof window !== 'undefined') {
  window.TIERS = MRI_TIERS_API;
}
