/* QB BrandOS — Account page renderer
   Last updated: 2026-05-15
   Spec reference: CHAPTER_01_SPEC.md §2.3 (/account route),
                   §12 (design system).

   Minimal account surface for Chapter 1. Renders email, tier,
   tier_started_at, and a sign-out pill. The full account
   experience (plan switching, billing portal, profile edit,
   subscription history) lands in Chapter 10.

   Exports:
     renderAccount(container, user, profile, opts)
     renderAccountLoading(container)
     renderAccountError(container, error)
*/

import { createTierBadge } from '/js/qb-components.js';

const PAID_TIERS = new Set(['starter','pro','agency','atelier']);

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
  if (href && !disabled) return el('a', { class: cls.join(' '), href }, [content]);
  return el('button', {
    class: cls.join(' '),
    type: 'button',
    disabled: disabled ? 'disabled' : null,
    on: { click: (e) => { if (!disabled && onClick) onClick(e); } },
  }, [content]);
}

function formatDateLong(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (_) { return ''; }
}

/* ─── Header ────────────────────────────────────────── */
function renderHeader() {
  return el('header', { class: 'qb-account__header' }, [
    el('div', { class: 'qb-account__eyebrow' }, 'Account'),
    el('h1',  { class: 'qb-account__headline' }, 'Your account'),
  ]);
}

/* ─── Field row ─────────────────────────────────────── */
function renderField({ label, value, hint, control }) {
  return el('section', { class: 'qb-account-field' }, [
    el('div', { class: 'qb-account-field__label' }, label),
    el('div', { class: 'qb-account-field__value' }, value),
    hint ? el('div', { class: 'qb-account-field__hint' }, hint) : null,
    control ? el('div', { class: 'qb-account-field__control' }, control) : null,
  ]);
}

/* ─── Billing portal control ────────────────────────── */
/* Wires the paid founder's plan row to the Stripe Customer Portal via
   POST /api/billing-portal (existing endpoint · returns { url }). The
   button disables while the session is created; any failure surfaces a
   plain note instead of a dead end. */
function buildPortalControl(opts) {
  const note = el('div', { class: 'qb-account-portal__note', 'aria-live': 'polite' });
  const btn = pill({
    label: 'Manage subscription',
    variant: 'secondary',
    onClick: async () => {
      const token = opts.session?.token;
      if (!token) {
        note.textContent = 'Sign in again to manage billing.';
        return;
      }
      const content = btn.querySelector('.qb-button_content');
      btn.classList.add('is-disabled');
      if (content) content.textContent = 'Opening the portal…';
      try {
        const r = await fetch('/api/billing-portal', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ return_url: window.location.href }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) { window.location.href = d.url; return; }
        throw new Error(d.error || `portal_${r.status}`);
      } catch (_) {
        btn.classList.remove('is-disabled');
        if (content) content.textContent = 'Manage subscription';
        note.textContent = 'The billing portal is unavailable right now. Email me@qtmbg.com and we’ll sort it.';
      }
    },
  });
  return el('div', { class: 'qb-account-portal' }, [btn, note]);
}

/* ─── Main render ───────────────────────────────────── */
export function renderAccount(container, user, profile, opts = {}) {
  if (!container) throw new Error('renderAccount: container is required');
  container.innerHTML = '';

  const email = user?.email || profile?.email || '(unknown)';
  const tier = String(profile?.tier || 'free').toLowerCase();
  const tierStartedAt = profile?.tier_started_at || null;
  const isPaid = PAID_TIERS.has(tier);

  const tierValue = el('div', { class: 'qb-account-field__tier-row' }, [
    createTierBadge({ tier }),
    isPaid && tierStartedAt
      ? el('span', { class: 'qb-account-field__since' }, `Active since ${formatDateLong(tierStartedAt)}`)
      : null,
  ]);

  const planControl = isPaid
    ? buildPortalControl(opts)
    : pill({
        label: 'Upgrade to Starter',
        variant: 'primary',
        href: '/paywall',
      });

  const signOut = pill({
    label: 'Sign out',
    variant: 'secondary',
    onClick: () => (opts.onSignOut ? opts.onSignOut() : null),
  });

  const root = el('section', { class: 'qb-account' }, [
    el('div', { class: 'qb-account__inner' }, [
      renderHeader(),
      renderField({ label: 'Email', value: email }),
      renderField({
        label: 'Plan',
        value: tierValue,
        control: planControl,
      }),
      el('section', { class: 'qb-account-field qb-account-field--signout' }, [
        el('div', { class: 'qb-account-field__label' }, 'Session'),
        el('div', { class: 'qb-account-field__control' }, signOut),
      ]),
    ]),
  ]);

  container.appendChild(root);
}

/* ─── Loading / error ───────────────────────────────── */
export function renderAccountLoading(container) {
  container.innerHTML = '';
  const root = el('section', { class: 'qb-account is-loading' }, [
    el('div', { class: 'qb-account__inner' }, [
      el('header', { class: 'qb-account__header' }, [
        el('div', { class: 'qb-account__eyebrow qb-skeleton' }, ' '),
        el('h1',  { class: 'qb-account__headline qb-skeleton' }, ' '),
      ]),
      el('section', { class: 'qb-account-field' }, [
        el('div', { class: 'qb-account-field__label' }, 'Email'),
        el('div', { class: 'qb-account-field__value qb-skeleton' }, ' '),
      ]),
      el('section', { class: 'qb-account-field' }, [
        el('div', { class: 'qb-account-field__label' }, 'Plan'),
        el('div', { class: 'qb-account-field__value qb-skeleton' }, ' '),
      ]),
    ]),
  ]);
  container.appendChild(root);
}

export function renderAccountError(container, error) {
  container.innerHTML = '';
  const root = el('section', { class: 'qb-account is-error' }, [
    el('div', { class: 'qb-account__inner' }, [
      renderHeader(),
      el('p', { class: 'qb-account__error' },
        error?.message || 'Could not load your account. Reload and try again.'),
      pill({ label: 'Try again', onClick: () => location.reload(), variant: 'primary' }),
    ]),
  ]);
  container.appendChild(root);
}

const AccountRenderer = {
  renderAccount,
  renderAccountLoading,
  renderAccountError,
};
export default AccountRenderer;
