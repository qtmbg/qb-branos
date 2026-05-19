// QB BrandOS · qb-realtime-manager.js
//
// Chapter 2 · Step 9C · single Supabase Realtime subscription manager.
//
// Architectural payoff (per step-9-spec.md §3.4): one subscription
// channel powering multiple consumers (bell, Phase view, future
// surfaces), one state machine (realtime ↔ poll with SUBSCRIBED grace
// timeout), one auth surface. No duplicate-Realtime sprawl as more
// surfaces become Realtime-aware.
//
// State machine inherited verbatim from step 7C bell implementation:
//   - start({ authToken }) → fetch token, decode user_id, try Realtime
//   - On SUBSCRIBED → state = 'realtime'; consumers stop their own poll
//   - On SUBSCRIBED grace timeout (10 s) → state = 'poll'
//   - On CHANNEL_ERROR / TIMED_OUT / CLOSED → state = 'poll'
//   - On reconnect → state = 'realtime'
//
// Consumers (bell, Phase view) register via:
//   QBRealtimeManager.onNotification(({ event, row, oldRow }) => ...)
//   QBRealtimeManager.onState(state => ...)
// and own their own poll behavior (each polls a different endpoint).
// The manager broadcasts notification events + state transitions;
// consumers wire the rest.
//
// Singleton. Idempotent start(). One Supabase Realtime client + one
// channel per page lifetime.

(function () {
  if (window.QBRealtimeManager) return; // already initialized

  const SUBSCRIBED_TIMEOUT_MS = 10_000;

  let supabaseClient = null;
  let channel = null;
  let state = null; // 'realtime' | 'poll' | null
  let token = null;
  let userId = null;
  let isStarted = false;
  let isDestroyed = false;
  let subscribedTimeout = null;

  const stateSubscribers = new Set();
  const notificationSubscribers = new Set();

  function decodeJwtSub(jwt) {
    try {
      const parts = String(jwt || '').split('.');
      if (parts.length !== 3) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload?.sub || null;
    } catch { return null; }
  }

  function setState(s) {
    if (state === s) return;
    state = s;
    for (const cb of stateSubscribers) {
      try { cb(s); } catch (e) { console.warn('[rt-mgr] state cb error', e?.message); }
    }
  }

  function dispatchNotification(event, row, oldRow) {
    if (!row || (userId && row.user_id && row.user_id !== userId)) return;
    for (const cb of notificationSubscribers) {
      try { cb({ event, row, oldRow }); } catch (e) { console.warn('[rt-mgr] notif cb error', e?.message); }
    }
  }

  async function startRealtime() {
    if (isDestroyed) return;
    const url = window.QB?.SUPA_URL;
    const anon = window.QB?.SUPA_KEY;
    if (!url || !anon || !token || !userId) {
      setState('poll');
      return;
    }
    let subscribedFired = false;
    subscribedTimeout = setTimeout(() => {
      if (!subscribedFired) setState('poll');
    }, SUBSCRIBED_TIMEOUT_MS);

    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      if (isDestroyed) { clearTimeout(subscribedTimeout); return; }
      const { createClient } = mod;
      supabaseClient = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      await supabaseClient.realtime.setAuth(token);
      const filter = `user_id=eq.${userId}`;
      channel = supabaseClient
        .channel(`notifications-${userId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter },
          p => dispatchNotification('INSERT', p?.new, p?.old))
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter },
          p => dispatchNotification('UPDATE', p?.new, p?.old))
        .subscribe((status) => {
          if (isDestroyed) return;
          if (status === 'SUBSCRIBED') {
            subscribedFired = true;
            clearTimeout(subscribedTimeout);
            setState('realtime');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            subscribedFired = true;
            clearTimeout(subscribedTimeout);
            setState('poll');
          }
        });
    } catch (e) {
      clearTimeout(subscribedTimeout);
      console.warn('[rt-mgr] Realtime unavailable, falling back to poll:', e?.message);
      setState('poll');
    }
  }

  function start(opts) {
    if (isStarted) return; // idempotent
    token = opts?.authToken || null;
    if (!token) return;
    userId = decodeJwtSub(token);
    if (!userId) return;
    isStarted = true;
    isDestroyed = false;
    startRealtime();
  }

  function stop() {
    isDestroyed = true;
    if (subscribedTimeout) { clearTimeout(subscribedTimeout); subscribedTimeout = null; }
    if (channel && supabaseClient) {
      try { supabaseClient.removeChannel(channel); } catch {}
    }
    channel = null;
    supabaseClient = null;
    state = null;
    isStarted = false;
    userId = null;
    token = null;
  }

  function onState(cb) {
    if (typeof cb !== 'function') return () => {};
    stateSubscribers.add(cb);
    // Fire immediately if state already known so consumers don't
    // need to query getState() separately.
    if (state) {
      try { cb(state); } catch (e) { console.warn('[rt-mgr] state cb error', e?.message); }
    }
    return () => stateSubscribers.delete(cb);
  }

  function onNotification(cb) {
    if (typeof cb !== 'function') return () => {};
    notificationSubscribers.add(cb);
    return () => notificationSubscribers.delete(cb);
  }

  function setToken(newToken) {
    token = newToken;
    if (supabaseClient && newToken) {
      try { supabaseClient.realtime.setAuth(newToken); } catch {}
    }
  }

  window.QBRealtimeManager = {
    start,
    stop,
    onState,
    onNotification,
    setToken,
    getState: () => state,
    getUserId: () => userId,
  };
})();
