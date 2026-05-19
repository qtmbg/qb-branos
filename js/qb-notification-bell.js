/* QB BrandOS · Notification bell
   Last updated: 2026-05-18
   Spec reference: CHAPTER_02_SPEC.md §7 + chapter-02/step-6-spec.md §7.1-§7.5

   Self-contained vanilla module. Loads via:
     <script src="/js/qb-notification-bell.js" defer></script>
   then a one-line mount call from the host page once auth is resolved:
     QBNotificationBell.mount(parentEl, { authToken });

   Behavior summary:
     - On mount: one immediate GET /api/notifications.
     - 30 s setInterval poll thereafter.
     - document.visibilitychange suppresses the interval while hidden.
       On return-to-foreground the bell fires one immediate fetch and
       restarts the interval. A user backgrounded for 5 min gets fresh
       state without waiting up to 30 s.
     - 401 → bell hides itself + clears the interval. qb-cloud.js owns
       session refresh; the bell does not chase auth.
     - Click on a row → POST /api/notifications/<id>/read, then route
       to the kind-specific target URL per §7.4. Bell is idempotent on
       re-click of an already-read row.
     - DOM shape per §7.3, tokens from :root only, reduced-motion
       respected on the dropdown reveal.
*/

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.QBNotificationBell) return; // already mounted globally

  const POLL_MS = 30000;
  const DROPDOWN_LIMIT = 10; // §7.1 · "last 10" in dropdown view
  const STYLE_ID = 'qb-notification-bell-styles';

  /* ─── DOM helpers ─────────────────────────────────────────── */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] === false || attrs[k] == null) {
          // skip
        } else if (attrs[k] === true) {
          node.setAttribute(k, '');
        } else {
          node.setAttribute(k, String(attrs[k]));
        }
      }
    }
    if (children) {
      for (const c of children) {
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  /* ─── Styles ──────────────────────────────────────────────── */
  // Injected once on first mount. All tokens from :root. Hard offset shadow
  // per design system (0 9px var(--ink) mobile, 0 16px var(--ink) ≥640px).
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.qb-notification-bell {
  position: relative;
  display: inline-block;
  font-family: var(--font-body, 'Inter', system-ui, sans-serif);
}
.qb-notification-bell_trigger {
  appearance: none;
  background: var(--cream-card);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: var(--radius-circle, 50%);
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  position: relative;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px var(--ink);
  transition: transform 0.4s var(--ease-qb), box-shadow 0.4s var(--ease-qb);
}
.qb-notification-bell_trigger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px var(--ink);
}
.qb-notification-bell_trigger:active {
  transform: translateY(2px);
  box-shadow: 0 2px var(--ink);
}
.qb-notification-bell_trigger:focus-visible {
  outline: 2px solid var(--rose-deep);
  outline-offset: 3px;
}
.qb-notification-bell_icon {
  width: 1.25rem;
  height: 1.25rem;
  display: block;
  color: var(--ink);
}
.qb-notification-bell_badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  background: var(--rose-deep);
  color: var(--cream);
  border: 2px solid var(--ink);
  border-radius: var(--radius-pill, 9999px);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 600;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0;
}
.qb-notification-bell_badge[data-count="0"] { display: none; }
.qb-notification-bell_dropdown {
  position: absolute;
  top: calc(100% + 0.75rem);
  right: 0;
  width: min(22rem, calc(100vw - var(--space-m)));
  background: var(--cream-card);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: var(--radius-card, 32px);
  box-shadow: 0 9px var(--ink);
  z-index: 60;
  max-height: 28rem;
  overflow-y: auto;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.4s var(--ease-qb), transform 0.4s var(--ease-qb);
}
@media (min-width: 640px) {
  .qb-notification-bell_dropdown { box-shadow: 0 16px var(--ink); }
}
.qb-notification-bell_dropdown[data-open="true"] {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .qb-notification-bell_trigger,
  .qb-notification-bell_dropdown {
    transition: none;
  }
  .qb-notification-bell_trigger:hover {
    transform: none;
  }
}
.qb-notification-bell_header {
  padding: var(--space-s) var(--space-m) var(--space-xs);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink);
  border-bottom: 1px solid var(--cream-edge, var(--ink-25));
}
.qb-notification-bell_list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.qb-notification-bell_item {
  padding: var(--space-s) var(--space-m);
  border-bottom: 1px solid var(--cream-edge, var(--ink-25));
  cursor: pointer;
  display: grid;
  grid-template-columns: 0.5rem 1fr;
  gap: var(--space-xs);
  align-items: start;
  background: var(--cream-card);
  transition: background 0.2s var(--ease-qb);
}
.qb-notification-bell_item:last-child { border-bottom: none; }
.qb-notification-bell_item:hover { background: var(--cream-warm); }
.qb-notification-bell_item[data-read="1"] { opacity: 0.55; }
.qb-notification-bell_item_dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-circle, 50%);
  background: var(--ink-25);
  margin-top: 0.45rem;
}
.qb-notification-bell_item[data-kind="dispatch_failed"][data-read="0"] .qb-notification-bell_item_dot {
  background: var(--rose-deep);
}
.qb-notification-bell_item[data-kind="artifact_ready"][data-read="0"] .qb-notification-bell_item_dot {
  background: var(--teal-deep);
}
.qb-notification-bell_item[data-kind="chain_ready"][data-read="0"] .qb-notification-bell_item_dot {
  background: var(--gold-deep);
}
.qb-notification-bell_item[data-kind="quarterly_due"][data-read="0"] .qb-notification-bell_item_dot {
  background: var(--gold);
}
.qb-notification-bell_item_body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.qb-notification-bell_item_kind {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-75, var(--ink));
}
.qb-notification-bell_item_copy {
  font-family: var(--font-body);
  font-size: var(--step--1);
  color: var(--ink);
  line-height: 1.4;
}
.qb-notification-bell_item_time {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--ink-50, var(--ink));
}
.qb-notification-bell_empty {
  padding: var(--space-m);
  font-family: var(--font-body);
  font-size: var(--step--1);
  color: var(--ink-75, var(--ink));
  text-align: center;
  line-height: 1.5;
}
`;
    document.head.appendChild(style);
  }

  /* ─── Bell-glyph SVG (inline so no extra asset) ───────────── */
  function bellIconSvg() {
    return '<svg class="qb-notification-bell_icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>' +
      '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' +
      '</svg>';
  }

  /* ─── Copy + routing per §7.4 ─────────────────────────────── */
  const KIND_LABEL = {
    dispatch_failed: 'Dispatch failed',
    artifact_ready:  'Artifact ready',
    chain_ready:     'Chain ready',
    quarterly_due:   'Quarterly review due',
  };

  function kindCopy(n) {
    const slug = n.agent_slug || n.payload?.agent_slug || '';
    const human = slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    switch (n.kind) {
      case 'dispatch_failed':
        return human
          ? `${human} could not finish after retries. Open the Console to rerun.`
          : 'A dispatch could not finish after retries. Open the Console to rerun.';
      case 'artifact_ready':
        return human
          ? `${human} is ready to open.`
          : 'A new artifact is ready to open.';
      case 'chain_ready':
        return 'A chain finished. Open the Console to review.';
      case 'quarterly_due':
        return 'Your quarterly brand review is due.';
      default:
        return 'You have a new system update.';
    }
  }

  function targetUrlFor(n) {
    const slug = n.agent_slug || n.payload?.agent_slug || '';
    switch (n.kind) {
      case 'dispatch_failed':
        return slug ? `/agents#agent=${encodeURIComponent(slug)}` : '/agents';
      case 'artifact_ready':
        return n.artifact_id ? `/artifact/${encodeURIComponent(n.artifact_id)}` : '/archive';
      case 'chain_ready':
      case 'quarterly_due':
      default:
        return '/agents';
    }
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = Math.max(0, Date.now() - t);
    const min = Math.floor(diff / 60000);
    if (min < 1)  return 'moments ago';
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)  return `${hr} hr ago`;
    const day = Math.floor(hr / 24);
    if (day < 7)  return `${day} d ago`;
    return new Date(iso).toLocaleDateString();
  }

  /* ─── Bell instance ───────────────────────────────────────── */
  // Decode the JWT 'sub' claim to extract the user_id for Realtime
  // channel name + filter. The JWT comes from Supabase auth /token; sub
  // is the user_id (UUID).
  function decodeJwtSub(jwt) {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload?.sub || null;
    } catch { return null; }
  }

  function createBell(parentEl, opts) {
    let token = opts && opts.authToken;
    if (!parentEl || !token) return null;
    const userId = decodeJwtSub(token);
    if (!userId) return null;

    injectStyles();

    const root = el('div', {
      class: 'qb-notification-bell',
      'data-mounted': 'true',
    });
    const trigger = el('button', {
      class: 'qb-notification-bell_trigger',
      type: 'button',
      'aria-label': 'Notifications',
      'aria-expanded': 'false',
      'aria-haspopup': 'true',
      html: bellIconSvg() +
        '<span class="qb-notification-bell_badge" data-count="0">0</span>',
    });
    const dropdown = el('div', {
      class: 'qb-notification-bell_dropdown',
      role: 'menu',
      hidden: true,
      'data-open': 'false',
    });
    root.appendChild(trigger);
    root.appendChild(dropdown);
    parentEl.appendChild(root);

    let pollHandle = null;
    let isDestroyed = false;
    let lastUnread = 0;
    let lastRows = [];

    function setBadge(count) {
      const badge = trigger.querySelector('.qb-notification-bell_badge');
      if (!badge) return;
      badge.setAttribute('data-count', String(count));
      badge.textContent = count > 99 ? '99+' : String(count);
      trigger.setAttribute(
        'aria-label',
        count > 0 ? `Notifications, ${count} unread` : 'Notifications'
      );
    }

    function renderDropdown(rows) {
      dropdown.innerHTML = '';

      const header = el('div', {
        class: 'qb-notification-bell_header',
        text: 'Notifications',
      });
      dropdown.appendChild(header);

      if (!Array.isArray(rows) || rows.length === 0) {
        const empty = el('div', {
          class: 'qb-notification-bell_empty',
          text: 'No notifications. The system flags here when something needs your attention.',
        });
        dropdown.appendChild(empty);
        return;
      }

      const list = el('ul', { class: 'qb-notification-bell_list' });
      const visible = rows.slice(0, DROPDOWN_LIMIT);
      for (const n of visible) {
        const isRead = n.read_at ? '1' : '0';
        const item = el('li', {
          class: 'qb-notification-bell_item',
          'data-kind': n.kind || 'unknown',
          'data-read': isRead,
          'data-id': n.id,
          role: 'menuitem',
          tabindex: '0',
        }, [
          el('span', { class: 'qb-notification-bell_item_dot' }),
          el('div', { class: 'qb-notification-bell_item_body' }, [
            el('span', {
              class: 'qb-notification-bell_item_kind',
              text: KIND_LABEL[n.kind] || 'System update',
            }),
            el('span', {
              class: 'qb-notification-bell_item_copy',
              text: kindCopy(n),
            }),
            el('span', {
              class: 'qb-notification-bell_item_time',
              text: relativeTime(n.created_at),
            }),
          ]),
        ]);
        item.addEventListener('click', () => onRowClick(n));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRowClick(n);
          }
        });
        list.appendChild(item);
      }
      dropdown.appendChild(list);
    }

    function openDropdown() {
      dropdown.hidden = false;
      // Force reflow so the transition applies on first open.
      void dropdown.offsetHeight;
      dropdown.setAttribute('data-open', 'true');
      trigger.setAttribute('aria-expanded', 'true');
    }
    function closeDropdown() {
      dropdown.setAttribute('data-open', 'false');
      trigger.setAttribute('aria-expanded', 'false');
      // Give the transition a chance to finish before hiding.
      setTimeout(() => {
        if (dropdown.getAttribute('data-open') === 'false') dropdown.hidden = true;
      }, 400);
    }

    trigger.addEventListener('click', () => {
      if (dropdown.getAttribute('data-open') === 'true') closeDropdown();
      else openDropdown();
    });

    // Click-outside close.
    function onDocClick(e) {
      if (!root.contains(e.target) && dropdown.getAttribute('data-open') === 'true') {
        closeDropdown();
      }
    }
    document.addEventListener('click', onDocClick);

    // Escape closes the dropdown.
    function onKeydown(e) {
      if (e.key === 'Escape' && dropdown.getAttribute('data-open') === 'true') {
        closeDropdown();
        trigger.focus();
      }
    }
    document.addEventListener('keydown', onKeydown);

    // ─── Realtime · INSERT + UPDATE on notifications · primary path ─────
    // State machine per chapter-02/step-7-spec.md §5.2 (adjudication #5):
    //   - Bell mounts → fetch initial state once → open Realtime channel
    //   - On SUBSCRIBED → state = 'realtime'; no recurring poll
    //   - On CHANNEL_ERROR / TIMED_OUT / CLOSED → state = 'poll';
    //     start 30 s setInterval
    //   - On Realtime reconnect → stop poll, return to state = 'realtime'
    // Single state machine, two paths, never both active.
    let realtimeState = null; // 'realtime' | 'poll' | null
    let realtimeChannel = null;
    let supabaseClient = null;

    async function startRealtime() {
      if (isDestroyed) return;
      const url = window.QB?.SUPA_URL;
      const anon = window.QB?.SUPA_KEY;
      if (!url || !anon) {
        // No Supabase wiring · fall back to poll
        realtimeState = 'poll';
        if (pollHandle === null) {
          pollHandle = setInterval(poll, POLL_MS);
        }
        return;
      }
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        if (isDestroyed) return;
        const { createClient } = mod;
        supabaseClient = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
          realtime: { params: { eventsPerSecond: 10 } },
        });
        // Set the user's JWT so Realtime enforces RLS against auth.uid()
        await supabaseClient.realtime.setAuth(token);
        const filter = `user_id=eq.${userId}`;
        realtimeChannel = supabaseClient
          .channel(`notifications-${userId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter }, handleInsert)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter }, handleUpdate)
          .subscribe((status) => {
            if (isDestroyed) return;
            if (status === 'SUBSCRIBED') {
              realtimeState = 'realtime';
              if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
              root.setAttribute('data-realtime', 'true');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              realtimeState = 'poll';
              root.setAttribute('data-realtime', 'false');
              if (pollHandle === null) {
                pollHandle = setInterval(poll, POLL_MS);
              }
            }
          });
      } catch (e) {
        // SDK load failure or runtime error · fall back to poll
        console.warn('[bell] Realtime unavailable, falling back to poll:', e?.message);
        realtimeState = 'poll';
        root.setAttribute('data-realtime', 'false');
        if (pollHandle === null) {
          pollHandle = setInterval(poll, POLL_MS);
        }
      }
    }

    function handleInsert(payload) {
      if (isDestroyed) return;
      const row = payload?.new;
      if (!row || row.user_id !== userId) return;
      // Prepend to rows, dedupe by id, cap to DROPDOWN_LIMIT
      const existing = lastRows.filter(r => r.id !== row.id);
      lastRows = [row, ...existing].slice(0, DROPDOWN_LIMIT);
      if (!row.read_at) lastUnread = lastUnread + 1;
      setBadge(lastUnread);
      renderDropdown(lastRows);
    }

    function handleUpdate(payload) {
      if (isDestroyed) return;
      const oldRow = payload?.old;
      const newRow = payload?.new;
      if (!newRow || newRow.user_id !== userId) return;
      const wasRead = oldRow?.read_at != null;
      const isRead = newRow.read_at != null;
      // Defensive · only adjust on read_at transitions
      if (!wasRead && isRead) lastUnread = Math.max(0, lastUnread - 1);
      if (wasRead && !isRead) lastUnread = lastUnread + 1;
      // Update the row in place
      lastRows = lastRows.map(r => r.id === newRow.id ? newRow : r);
      setBadge(lastUnread);
      renderDropdown(lastRows);
    }

    function destroy() {
      isDestroyed = true;
      if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
      if (realtimeChannel && supabaseClient) {
        try { supabaseClient.removeChannel(realtimeChannel); } catch {}
        realtimeChannel = null;
        supabaseClient = null;
      }
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('visibilitychange', onVisibility);
      // Hide rather than remove so a future re-mount on a fresh session
      // doesn't fight any host-page DOM mutation observers.
      root.style.display = 'none';
      root.setAttribute('data-mounted', 'false');
    }

    async function poll() {
      if (isDestroyed) return;
      let res;
      try {
        res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // Network errors are non-fatal; the next poll re-tries.
        return;
      }
      if (res.status === 401) {
        // Session expired. Bell surrenders; qb-cloud.js owns refresh.
        destroy();
        return;
      }
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data.notifications) ? data.notifications : [];
      const unread = Number.isFinite(data.unread_count) ? data.unread_count : 0;
      lastRows = rows;
      lastUnread = unread;
      setBadge(unread);
      renderDropdown(rows);
    }

    async function onRowClick(n) {
      const wasUnread = !n.read_at;
      if (wasUnread) {
        // Optimistic: decrement badge + mark row read before the POST resolves.
        lastUnread = Math.max(0, lastUnread - 1);
        setBadge(lastUnread);
        n.read_at = new Date().toISOString();
        const dom = dropdown.querySelector(`[data-id="${n.id}"]`);
        if (dom) dom.setAttribute('data-read', '1');

        try {
          await fetch(`/api/notifications/${encodeURIComponent(n.id)}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (e) {
          // Swallow. Re-poll on the next interval will re-sync truth.
        }
      }
      const url = targetUrlFor(n);
      if (url) window.location.href = url;
    }

    function onVisibility() {
      if (isDestroyed) return;
      // Realtime path runs continuously regardless of tab focus · only the
      // poll-fallback path responds to visibility transitions.
      if (realtimeState === 'realtime') return;
      if (document.hidden) {
        if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
      } else if (pollHandle === null && realtimeState === 'poll') {
        poll();
        pollHandle = setInterval(poll, POLL_MS);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    // Mount sequence: fetch initial state once, then open Realtime channel.
    // The state machine decides whether the recurring poll fires (only on
    // Realtime error · per adjudication #5).
    poll();
    startRealtime();

    // Render the empty state immediately so a slow first poll doesn't
    // leave the dropdown blank if the user opens it before the response.
    renderDropdown([]);

    return {
      destroy,
      refresh: poll,
      setToken(newToken) { token = newToken; },
    };
  }

  window.QBNotificationBell = {
    mount(parentEl, opts) {
      return createBell(parentEl, opts);
    },
  };
})();
