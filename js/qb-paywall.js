/* BrandOS — Paywall page renderer
   Last updated: 2026-05-15
   Spec reference: CHAPTER_01_SPEC.md §2.3 (/paywall route),
                   §8 (paywall), §12 (design system).

   The full-page version of the upgrade flow. The modal in
   js/qb-components.js handles inline triggers; this module
   renders the dedicated /paywall surface that names exactly
   what the user was trying to do, then offers three tiers.

   Exports:
     renderPaywall(container, opts)
     getReasonCopy(reason, params)
     renderPaywallLoading(container)
     renderPaywallError(container, error)
*/

import { createTierBadge, STARTER_ADDS } from '/js/qb-components.js';

const STARTER_PRICE_ID = 'price_1Th8JkEHEAcWrG55Abr1OZXe';

const PAID_TIERS = new Set(['starter','pro','agency','atelier']);

/* A reading is named after its exercise, as on the facts sheet. */
const READING_LABELS = {
  sensescape_synthesizer: 'Sensescape',
  visual_dna_synthesizer: 'Visual DNA',
  war_table_synthesizer:  'War Table',
};

const BUILD_AGENT_LABELS = {
  logo_direction_agent:  'Logo Direction',
  logo_evaluation_agent: 'Logo Evaluation',
  voice_guide_agent:     'Voice Guide',
};

const HOLD_AGENTS = new Set(['brand_performance_agent', 'quarterly_review_agent', 'predictive_panel_agent']);

/* The two QBP sections that open with Starter, and the exercise each
   one fills from. */
const SECTION_LABELS = {
  visual_dna: 'Visual Language',
  war_table:  'Strategic Position',
};

const EXERCISE_LABELS = {
  visual_dna: 'Visual DNA',
  war_table:  'War Table',
};

/* Tool ids as qb-cloud.js writes them when the access gate sends a
   visitor to a plan page (?reason=upgrade&tool=visual-dna). */
const TOOL_EXERCISE = { 'visual-dna': 'visual_dna', 'war-table': 'war_table' };
const BUILD_TOOLS = new Set(['logo-direction', 'logo-evaluation', 'voice-guide']);
const HOLD_TOOLS  = new Set(['quarterly', 'dashboard', 'panel']);

const FREE_EXERCISES = 'Archetype Compass, Brand Soul Map and Sensescape stay free.';

/* ─── tiny vdom-like helper ─────────────────────────── */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class')   node.className = v;
    else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    }
    else if (k === 'on') {
      for (const [ek, eh] of Object.entries(v)) node.addEventListener(ek, eh);
    }
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  const append = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(append);
    else if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
    else node.appendChild(c);
  };
  append(children);
  return node;
}

function pill({ label, onClick, href, variant = 'primary', size = 'md', disabled }) {
  const cls = ['qb-button'];
  if (variant === 'primary')   cls.push('is-primary');
  if (variant === 'secondary') cls.push('is-secondary');
  if (size === 'sm') cls.push('is-sm');
  if (size === 'lg') cls.push('is-lg');
  if (disabled) cls.push('is-disabled');
  const content = el('span', { class: 'qb-button_content' }, label);
  if (href && !disabled) {
    return el('a', { class: cls.join(' '), href }, [content]);
  }
  const btn = el('button', {
    class: cls.join(' '),
    type: 'button',
    disabled: disabled ? 'disabled' : null,
    on: { click: (e) => { if (disabled) e.preventDefault(); else if (onClick) onClick(e); } },
  }, [content]);
  return btn;
}

/* ─── Reason → copy ─────────────────────────────────── */
export function getReasonCopy(reason, params = {}) {
  let r = String(reason || '').toLowerCase();
  let p = params || {};
  const tool = String(p.tool || '').toLowerCase();

  // The same destination, three spellings: an exercise slug used as the
  // reason (the foundation page's fallback link), an exercise key, or the
  // tool id the access gate hands over with reason=upgrade.
  if (TOOL_EXERCISE[r])            { p = { ...p, exercise: TOOL_EXERCISE[r] }; r = 'exercise'; }
  else if (EXERCISE_LABELS[r])     { p = { ...p, exercise: r }; r = 'exercise'; }
  else if (TOOL_EXERCISE[tool])    { p = { ...p, exercise: TOOL_EXERCISE[tool] }; r = 'exercise'; }
  else if (BUILD_TOOLS.has(tool))  { r = 'phase_02'; }
  else if (HOLD_TOOLS.has(tool))   { r = 'phase_05'; }

  if (r === 'artifact' && BUILD_AGENT_LABELS[p.agent]) r = 'phase_02';
  if (r === 'artifact' && HOLD_AGENTS.has(p.agent))    r = 'phase_05';

  if (r === 'qbp_export') {
    return {
      eyebrow: 'Upgrade',
      headline: 'Export your QBP.',
      body: 'With Starter, your Quantum Brand Profile downloads as a file.',
    };
  }
  if (r === 'qbp_section') {
    const section = SECTION_LABELS[p.section];
    if (!section) {
      return {
        eyebrow: 'Upgrade',
        headline: 'Two sections of your QBP open with Starter.',
        body: 'Visual Language and Strategic Position fill from the Visual DNA and War Table exercises. All of it opens with Starter.',
      };
    }
    return {
      eyebrow: 'Upgrade',
      headline: `${section} opens with Starter.`,
      body: `That section of your QBP fills from the ${EXERCISE_LABELS[p.section]} exercise. Both open with Starter.`,
    };
  }
  if (r === 'artifact') {
    const reading = READING_LABELS[p.agent];
    if (!reading) {
      return {
        eyebrow: 'Upgrade',
        headline: 'This artifact opens with Starter.',
        body: 'Upgrade to read it.',
      };
    }
    return {
      eyebrow: 'Upgrade',
      headline: `Read your ${reading} reading.`,
      body: `The ${reading} reading opens with Starter. Upgrade to read it.`,
    };
  }
  if (r === 'exercise') {
    const exercise = EXERCISE_LABELS[p.exercise];
    if (!exercise) {
      return {
        eyebrow: 'Upgrade',
        headline: 'This exercise opens with Starter.',
        body: `Visual DNA and War Table are part of Starter. ${FREE_EXERCISES}`,
      };
    }
    return {
      eyebrow: 'Upgrade',
      headline: `${exercise} opens with Starter.`,
      body: `The ${exercise} exercise and its reading are part of Starter. ${FREE_EXERCISES}`,
    };
  }
  if (r === 'phase_02') {
    return {
      eyebrow: 'Upgrade',
      headline: 'Build opens with Starter.',
      body: 'The Build agents work from your foundation. Starter opens them.',
    };
  }
  if (r === 'phase_05') {
    // Hold is shown and cannot be bought: Starter does not open it and no
    // plan that does is on sale.
    return {
      eyebrow: 'Hold',
      headline: 'Hold is not open yet.',
      body: 'No plan opens Hold. Starter opens the rest of your foundation and the Build agents.',
    };
  }
  if (String(p.cancelled) === '1') {
    return {
      eyebrow: 'Cancelled',
      headline: 'Checkout cancelled.',
      body: 'No charge was made. Pick up where you left off.',
    };
  }
  return {
    eyebrow: 'Upgrade',
    headline: 'Open the rest of your foundation.',
    body: `${STARTER_ADDS} All on Starter.`,
  };
}

/* ─── Plan card ─────────────────────────────────────── */
function createPlanCard({ name, price, cadence, lede, features, ctaLabel, ctaOnClick, ctaHref, variant, status, isCurrent }) {
  const cls = ['qb-plan-card'];
  if (variant === 'starter') cls.push('is-starter');
  if (variant === 'pro')     cls.push('is-pro');
  if (variant === 'agency')  cls.push('is-agency');
  if (status === 'soon')     cls.push('is-soon');
  if (isCurrent)             cls.push('is-current');

  const head = el('div', { class: 'qb-plan-card__head' }, [
    el('div', { class: 'qb-plan-card__eyebrow' }, name),
    status === 'soon' ? el('span', { class: 'qb-plan-card__pip' }, 'Not open yet') : null,
    isCurrent ? el('span', { class: 'qb-plan-card__pip is-current-pip' }, 'Current plan') : null,
  ]);

  const priceLine = el('div', { class: 'qb-plan-card__price' }, [
    el('span', { class: 'qb-plan-card__amount' }, price),
    el('span', { class: 'qb-plan-card__cadence' }, cadence),
  ]);

  const ledeEl = lede ? el('p', { class: 'qb-plan-card__lede' }, lede) : null;

  const list = el('ul', { class: 'qb-plan-card__features' },
    features.map(f => el('li', { class: 'qb-plan-card__feature' }, f)));

  const ctaWrap = el('div', { class: 'qb-plan-card__cta' }, [
    pill({
      label: ctaLabel,
      variant: variant === 'starter' && !isCurrent ? 'primary' : 'secondary',
      size: variant === 'starter' ? 'lg' : 'md',
      disabled: status === 'soon' || isCurrent,
      onClick: ctaOnClick,
      href: ctaHref,
    }),
  ]);

  return el('article', { class: cls.join(' ') }, [head, priceLine, ledeEl, list, ctaWrap]);
}

/* ─── Header ────────────────────────────────────────── */
function renderHeader({ eyebrow, headline, body, isCancelled }) {
  return el('header', { class: 'qb-paywall__header' + (isCancelled ? ' is-cancelled' : '') }, [
    el('div', { class: 'qb-paywall__eyebrow' }, eyebrow),
    el('h1',  { class: 'qb-paywall__headline' }, headline),
    el('p',   { class: 'qb-paywall__body' }, body),
  ]);
}

/* ─── Already-subscribed banner ─────────────────────── */
function renderAlreadyBanner(tier) {
  const label = String(tier).charAt(0).toUpperCase() + String(tier).slice(1);
  return el('div', { class: 'qb-paywall-banner' }, [
    el('span', { class: 'qb-paywall-banner__text' },
      `You're already on ${label}.`),
    createTierBadge({ tier }),
  ]);
}

/* ─── Atelier line ──────────────────────────────────── */
function renderAtelierLine() {
  const link = el('a', { class: 'qb-paywall-atelier__link', href: 'mailto:me@qtmbg.com' }, 'Write to me@qtmbg.com.');
  return el('p', { class: 'qb-paywall-atelier' }, [
    el('strong', {}, 'Atelier '),
    'is application-only. ',
    link,
  ]);
}

/* ─── Footer ────────────────────────────────────────── */
function renderFooter() {
  return el('footer', { class: 'qb-paywall__footer' }, [
    el('span', {}, 'Cancel anytime'),
    el('span', { class: 'qb-paywall__footer-dot' }, '·'),
    el('span', {}, 'Full refund within 14 days'),
    el('span', { class: 'qb-paywall__footer-dot' }, '·'),
    el('span', {}, 'Secure checkout via Stripe'),
  ]);
}

/* ─── Main render ───────────────────────────────────── */
export function renderPaywall(container, opts = {}) {
  if (!container) throw new Error('renderPaywall: container is required');
  container.innerHTML = '';

  const reason = opts.reason || null;
  const params = opts.params || {};
  const tier = String(opts.tier || 'free').toLowerCase();
  const isCancelled = String(params.cancelled) === '1';

  const copy = isCancelled
    ? getReasonCopy(null, { cancelled: '1' })
    : getReasonCopy(reason, params);

  const isSubscribed = PAID_TIERS.has(tier);

  const root = el('section', { class: 'qb-paywall' }, [
    el('div', { class: 'qb-paywall__inner' }, [
      // Already-subscribed banner
      isSubscribed ? renderAlreadyBanner(tier) : null,

      // Header
      renderHeader({
        eyebrow:    copy.eyebrow,
        headline:   copy.headline,
        body:       copy.body,
        isCancelled,
      }),

      // Plan grid
      el('div', { class: 'qb-paywall__plans is-single' }, [
        createPlanCard({
          name:    'Starter',
          price:   '$97',
          cadence: '/ month',
          lede:    'The rest of your foundation, the Build agents and the full export.',
          features: [
            'The Visual DNA and War Table exercises',
            'The three other foundation readings (Sensescape, Visual DNA, War Table)',
            'The three Build agents (Logo Direction, Logo Evaluation, Voice Guide)',
            'Full QBP export',
            'Cancel anytime',
          ],
          ctaLabel: tier === 'starter' ? 'Current plan' : 'Upgrade to Starter',
          variant: 'starter',
          isCurrent: tier === 'starter',
          ctaOnClick: tier === 'starter' ? null : (e) => triggerCheckout(e, opts),
        }),
      ]),

      renderAtelierLine(),
      renderFooter(),
    ]),
  ]);

  container.appendChild(root);
}

/* ─── Checkout trigger ──────────────────────────────── */
async function triggerCheckout(ev, opts) {
  const btn = ev?.currentTarget;
  if (btn) {
    btn.classList.add('is-loading');
    btn.setAttribute('disabled', 'disabled');
    const content = btn.querySelector('.qb-button_content');
    if (content) content.textContent = 'Opening checkout…';
  }
  try {
    const token = opts.token || null;
    if (!token) throw new Error('Not signed in');
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ price_id: STARTER_PRICE_ID }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }
    throw new Error(data.error || `Checkout failed (HTTP ${res.status})`);
  } catch (e) {
    showToast(`${e.message || 'Checkout failed'}. Try again.`);
    if (btn) {
      btn.classList.remove('is-loading');
      btn.removeAttribute('disabled');
      const content = btn.querySelector('.qb-button_content');
      if (content) content.textContent = 'Upgrade to Starter';
    }
  }
}

function showToast(msg) {
  let t = document.getElementById('qb-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'qb-toast';
    t.className = 'qb-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => t.classList.remove('is-visible'), 3200);
}

/* ─── Loading / error ───────────────────────────────── */
export function renderPaywallLoading(container) {
  container.innerHTML = '';
  const root = el('section', { class: 'qb-paywall is-loading' }, [
    el('div', { class: 'qb-paywall__inner' }, [
      el('header', { class: 'qb-paywall__header' }, [
        el('div', { class: 'qb-paywall__eyebrow qb-skeleton' }, ' '),
        el('h1',  { class: 'qb-paywall__headline qb-skeleton' }, ' '),
        el('p',   { class: 'qb-paywall__body qb-skeleton' }, ' '),
      ]),
      el('div', { class: 'qb-paywall__plans is-single' }, [
        el('div', { class: 'qb-plan-card qb-skeleton' }, ' '),
      ]),
    ]),
  ]);
  container.appendChild(root);
}

export function renderPaywallError(container, error) {
  container.innerHTML = '';
  const root = el('section', { class: 'qb-paywall is-error' }, [
    el('div', { class: 'qb-paywall__inner' }, [
      el('header', { class: 'qb-paywall__header' }, [
        el('div', { class: 'qb-paywall__eyebrow' }, 'Issue'),
        el('h1',  { class: 'qb-paywall__headline' }, 'Could not load checkout.'),
        el('p',   { class: 'qb-paywall__body' }, error?.message || 'Reload and try again. If this keeps happening, write to me@qtmbg.com.'),
      ]),
      pill({ label: 'Try again', onClick: () => location.reload(), variant: 'primary' }),
    ]),
  ]);
  container.appendChild(root);
}

const PaywallRenderer = {
  renderPaywall,
  getReasonCopy,
  renderPaywallLoading,
  renderPaywallError,
};
export default PaywallRenderer;
