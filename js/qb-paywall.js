/* QB BrandOS — Paywall page renderer
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

import { createTierBadge } from '/js/qb-components.js';

const STARTER_PRICE_ID = 'price_1Th8JkEHEAcWrG55Abr1OZXe';

const PAID_TIERS = new Set(['starter','pro','agency','atelier']);

const AGENT_LABELS = {
  soul_map_synthesizer:   'Brand Soul',
  sensescape_synthesizer: 'Sensescape',
  visual_dna_synthesizer: 'Visual Language',
  war_table_synthesizer:  'Strategic Position',
};

const SECTION_LABELS = {
  visual_dna: 'Visual Language',
  war_table:  'Strategic Position',
};

const PHASE_LABELS = {
  phase_02: 'Phase 02',
  phase_03: 'Phase 03',
  phase_04: 'Phase 04',
  phase_05: 'Phase 05',
};

const EXERCISE_LABELS = {
  visual_dna: 'Visual DNA',
  war_table:  'War Table',
};

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
  const r = String(reason || '').toLowerCase();
  if (r === 'qbp_export') {
    return {
      eyebrow: 'Upgrade',
      headline: 'Export your QBP.',
      body: 'Your Quantum Brand Profile becomes a downloadable document with Starter.',
    };
  }
  if (r === 'qbp_section') {
    const section = SECTION_LABELS[params.section] || 'a locked section';
    return {
      eyebrow: 'Upgrade',
      headline: `Read your ${section}.`,
      body: `The ${section} section of your QBP is ready. Upgrade to read it.`,
    };
  }
  if (r === 'artifact') {
    const agent = AGENT_LABELS[params.agent] || 'this artifact';
    return {
      eyebrow: 'Upgrade',
      headline: `Read your ${agent}.`,
      body: `Your ${agent} synthesis is ready. Upgrade to read it.`,
    };
  }
  if (r === 'exercise') {
    const exercise = EXERCISE_LABELS[params.exercise] || 'this exercise';
    return {
      eyebrow: 'Upgrade',
      headline: `${exercise} opens with Starter.`,
      body: `Run the ${exercise} exercise and feed it into your foundation.`,
    };
  }
  if (PHASE_LABELS[r]) {
    const phase = PHASE_LABELS[r];
    const sub = {
      phase_02: 'The visual identity phase is built on your foundation. Starter opens it.',
      phase_03: 'The content phase is built on your foundation. Starter opens it.',
      phase_04: 'The execution phase is built on your foundation. Starter opens it.',
      phase_05: 'The intelligence phase is built on your foundation. Starter opens it.',
    };
    return {
      eyebrow: 'Upgrade',
      headline: `${phase} opens with Starter.`,
      body: sub[r],
    };
  }
  if (String(params.cancelled) === '1') {
    return {
      eyebrow: 'Cancelled',
      headline: 'Checkout cancelled.',
      body: 'No charge was made. Pick up where you left off.',
    };
  }
  return {
    eyebrow: 'Upgrade',
    headline: 'Open the rest of your foundation.',
    body: 'Visual DNA, War Table, three remaining synthesis artifacts, full QBP export, and every Phase 02–05 agent. All on Starter.',
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
    status === 'soon' ? el('span', { class: 'qb-plan-card__pip' }, 'Coming soon') : null,
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
  const link = el('a', { class: 'qb-paywall-atelier__link', href: 'mailto:me@qtmbg.com' }, 'Reach out.');
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
    el('span', {}, '14-day money-back'),
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
      el('div', { class: 'qb-paywall__plans' }, [
        createPlanCard({
          name:    'Starter',
          price:   '$97',
          cadence: '/ month',
          lede:    'Everything you need to finish Phase 01 and open Phase 02.',
          features: [
            'All Phase 01 synthesis artifacts (Sensescape, Visual DNA, War Table)',
            'Visual DNA and War Table exercises',
            'Full QBP export',
            'All Phase 02 agents (Logo Direction, Logo Evaluation, Voice Guide)',
            'All Phase 03 content agents',
            'Cancel anytime',
          ],
          ctaLabel: tier === 'starter' ? 'Current plan' : 'Upgrade to Starter',
          variant: 'starter',
          isCurrent: tier === 'starter',
          ctaOnClick: tier === 'starter' ? null : (e) => triggerCheckout(e, opts),
        }),
        createPlanCard({
          name:    'Pro',
          price:   '$247',
          cadence: '/ month',
          lede:    'For brands building in public, ready to publish on cadence.',
          features: [
            'Everything in Starter',
            'All Phase 04 execution agents',
            'All Phase 05 intelligence agents',
            'Priority synthesis dispatch',
            'Quarterly brand review',
          ],
          ctaLabel: tier === 'pro' ? 'Current plan' : 'Available in a future chapter',
          variant: 'pro',
          status: tier === 'pro' ? null : 'soon',
          isCurrent: tier === 'pro',
          ctaOnClick: () => showSoonToast(opts),
        }),
        createPlanCard({
          name:    'Agency',
          price:   '$1,497',
          cadence: '/ month',
          lede:    'For agencies running brand systems for multiple clients.',
          features: [
            'Everything in Pro',
            'Up to 5 client workspaces',
            'White-label exports and reports',
            'Multi-tenant QBPs',
            'Dedicated account contact',
          ],
          ctaLabel: tier === 'agency' ? 'Current plan' : 'Available in a future chapter',
          variant: 'agency',
          status: tier === 'agency' ? null : 'soon',
          isCurrent: tier === 'agency',
          ctaOnClick: () => showSoonToast(opts),
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

function showSoonToast(opts) {
  showToast('Available in a future chapter.');
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
      el('div', { class: 'qb-paywall__plans' }, [
        el('div', { class: 'qb-plan-card qb-skeleton' }, ' '),
        el('div', { class: 'qb-plan-card qb-skeleton' }, ' '),
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
