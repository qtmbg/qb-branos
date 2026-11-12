// Brand MRI · tier rules. Pure, testable.
//
//   free   : score and the name of the main brake.
//   flash  : + the three tensions and the first workstream.
//   full   : + five pillars, the positioning sentence, the 90-day plan.
//   review : + the order form for the video review.
//
// A paid tier comes from one place only: a Stripe Checkout Session that
// /api/mri-verify has confirmed as paid. The address bar opens nothing.
// The single exception is ?demo= on a preview host, so a branch can show
// every tier without a payment. Preview hosts are named here and every
// other host is production: the three domains, the vercel.app aliases that
// serve the production deployment, and any domain added later.

var MRI_TIER_RANK = { free: 0, flash: 1, full: 2, review: 3 };

// A preview deployment of this project: qb-branos-<hash or branch>-<team>.
// Vercel Authentication guards these hosts, so only the team reaches them.
var MRI_PREVIEW_HOST = /^qb-branos-[a-z0-9-]+\.vercel\.app$/;

// Two aliases fit that pattern and serve production. qb-branos.vercel.app
// serves production too and does not fit the pattern.
var MRI_PROD_ALIASES = ['qb-branos-qtmbg.vercel.app', 'qb-branos-git-main-qtmbg.vercel.app'];

function mriIsPreviewHost(hostname) {
  var h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') return true;
  return MRI_PREVIEW_HOST.test(h) && MRI_PROD_ALIASES.indexOf(h) === -1;
}

function mriIsProdHost(hostname) {
  return !mriIsPreviewHost(hostname);
}

// Own keys only: "constructor" is a property of every object and names no tier.
function mriIsTier(t) {
  return typeof t === 'string' && Object.prototype.hasOwnProperty.call(MRI_TIER_RANK, t);
}

// The highest tier among confirmed sessions. A re-test session carries no
// rank: it measures progress and opens no report by itself.
function mriMaxTier(tiers) {
  var best = 'free';
  (tiers || []).forEach(function (t) {
    if (mriIsTier(t) && MRI_TIER_RANK[t] > MRI_TIER_RANK[best]) best = t;
  });
  return best;
}

// ctx: { sessions: [{ tier }], demo: string|null, hostname: string }
function mriResolveTier(ctx) {
  var confirmed = mriMaxTier(((ctx && ctx.sessions) || []).map(function (s) { return s && s.tier; }));
  var demo = ctx && ctx.demo;
  if (mriIsTier(demo) && !mriIsProdHost(ctx.hostname)) return demo;
  return confirmed;
}

function mriVisibleSections(tier) {
  var rank = mriIsTier(tier) ? MRI_TIER_RANK[tier] : 0;
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
  isPreviewHost: mriIsPreviewHost,
  isTier: mriIsTier,
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
