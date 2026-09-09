/* ────────────────────────────────────────────────────────────────────────────
   QB CLOUD. Shared module for auth, QBP sync, completion tracking, and
   feature-access checks. Loaded once per page via
   <script src="/qb-cloud.js"></script>. Exposes window.QB.
   ──────────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  const SUPA_URL = 'https://yushbxjwfhuokaezoioe.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1c2hieGp3Zmh1b2thZXpvaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjEwNTAsImV4cCI6MjA5MDM5NzA1MH0.xU_jlBhmSeb1Bck04bEgNAD7HQBsGvgkf7d3PK_dbl0';

  // All product pages load this module. Keep their state on the product
  // origin; marketing stays on the apex. Preserve deep links and auth hashes.
  const PRODUCT_ORIGIN = 'https://app.quantumbranding.ai';
  if (typeof window !== 'undefined'
      && ['quantumbranding.ai', 'www.quantumbranding.ai'].includes(window.location.hostname)) {
    window.location.replace(PRODUCT_ORIGIN + window.location.pathname
      + window.location.search + window.location.hash);
    return;
  }

  // ── Tool registry ──────────────────────────────────────────────────────────
  // PHASE_01_TOOLS lists every tool that counts toward Phase 01 progress.
  // Order matters: nextRecommendedTool() returns the first incomplete one,
  // so list them in journey order. Compass is the entry point.
  const TOOL_NAMES = {
    // Phase 01 — Discovery (free)
    'archetype-compass': 'Archetype Compass',
    'soul-map':          'Brand Soul Map',
    'sensescape':        'Sensescape',
    'visual-dna':        'Visual DNA',
    'war-table':         'The War Table',
    'profiles':          'The Profiles',
    // Phase 02 — Brand Creation
    'logo-direction':    'Logo Direction',
    'logo-evaluation':   'Logo Evaluation',
    'voice-guide':       'Voice Guide',
    // Phase 03 — Content Creation
    'content-bridge':    'Content Bridge',
    'content-repurpose': 'Content Repurposing Engine',
    'content-scheduler': 'Content Scheduler',
    // Phase 04 — Execution
    'instagram':         'Instagram Seed Agent',
    'linkedin':          'LinkedIn Strategy',
    'youtube':           'YouTube Strategy',
    'newsletter':        'Newsletter Architecture',
    // Phase 05 — Intelligence
    'quarterly':         'Quarterly Brand Review',
    'dashboard':         'Brand Performance Dashboard',
    'panel':             'Predictive Panel',
    // Phase 06 — Synthesis (top-of-funnel deliverable)
    'brand-document':    'Brand Document'
  };
  const TOOL_FILES = {
    'archetype-compass': 'archetype-compass.html',
    'soul-map':          'brand-soul-map.html',
    'sensescape':        'sensescape.html',
    'visual-dna':        'visual-dna.html',
    'war-table':         'war-table.html',
    'profiles':          'the-profiles.html',
    'logo-direction':    'logo-direction-agent.html',
    'logo-evaluation':   'logo-evaluation-agent.html',
    'voice-guide':       'voice-guide-agent.html',
    'content-bridge':    'content-bridge.html',
    'content-repurpose': 'content-repurposing-engine.html',
    'content-scheduler': 'content-scheduler.html',
    'instagram':         'instagram-seed-agent.html',
    'linkedin':          'linkedin-strategy-agent.html',
    'youtube':           'youtube-strategy-agent.html',
    'newsletter':        'newsletter-architecture-agent.html',
    'quarterly':         'quarterly-brand-review-agent.html',
    'dashboard':         'brand-performance-dashboard.html',
    'panel':             'predictive-panel..html',
    'brand-document':    'brand-document.html'
  };
  const PHASE_01_TOOLS = ['archetype-compass', 'soul-map', 'sensescape', 'visual-dna', 'war-table', 'profiles'];

  // Phase 02-5 tools — gated behind any paid tier. brand-document is the
  // synthesis page that surfaces the QBP; it stays free (the deliverable).
  const PAID_TOOLS = [
    'logo-direction', 'logo-evaluation', 'voice-guide',
    'content-bridge', 'content-repurpose', 'content-scheduler',
    'instagram', 'linkedin', 'youtube', 'newsletter',
    'quarterly', 'dashboard', 'panel'
  ];

  // ── Session management ────────────────────────────────────────────────────
  function getSession(){
    try { return JSON.parse(localStorage.getItem('qb_session') || '{}'); }
    catch(e){ return {}; }
  }
  // Keep signed-out drafts tied to their owner, never to the next visitor.
  const DRAFT_PREFIX = 'qb_saved_user:';
  const NON_DRAFT_KEYS = new Set(['qb_session', 'qb_data_owner', 'qb_theme', 'qb-theme',
    'qb_post_auth_return_to', 'qb_pending_signup']);
  function privateKeys(){
    return Object.keys(localStorage).filter(k => /^qb[_-]/.test(k)
      && !k.startsWith(DRAFT_PREFIX) && !NON_DRAFT_KEYS.has(k));
  }
  function parkDraft(userId){
    if (!userId) return;
    const draft = {};
    privateKeys().forEach(k => { draft[k] = localStorage.getItem(k); });
    const key = DRAFT_PREFIX + userId;
    const serialized = JSON.stringify(draft);
    let persisted = false;
    try {
      localStorage.setItem(key, serialized);
      sessionStorage.removeItem(key);
      persisted = true;
    } catch(e) {
      // A full local store must not expose answers after sign-out. Retain
      // the draft in this tab while making room in the active namespace.
      try {
        sessionStorage.setItem(key, serialized);
        persisted = true;
      } catch(err) {}
    }
    // If both stores are unavailable, keep the active values rather than
    // clearing the only copy of a user's work.
    if (!persisted) return;
    privateKeys().forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('qb_data_owner');
  }
  function setSession(s){
    const current = getSession();
    const oldOwner = current.userId || localStorage.getItem('qb_data_owner');
    if (s.userId && oldOwner && oldOwner !== s.userId) parkDraft(oldOwner);
    if (s.userId && current.userId !== s.userId) {
      try {
        const key = DRAFT_PREFIX + s.userId;
        // A shared archive can be refreshed by another tab, so prefer it
        // over this tab's quota fallback whenever it is present.
        const archived = localStorage.getItem(key) || sessionStorage.getItem(key) || '{}';
        const saved = JSON.parse(archived);
        Object.entries(saved).forEach(([k,v]) => {
          if (NON_DRAFT_KEYS.has(k) || k.startsWith(DRAFT_PREFIX)) return;
          const fresh = localStorage.getItem(k);
          if (fresh === null) localStorage.setItem(k,v);
          else if (k === 'qb_qbp' || k === 'qb_completions') {
            // Work completed since sign-out takes precedence over the archive.
            localStorage.setItem(k, JSON.stringify({ ...JSON.parse(v), ...JSON.parse(fresh) }));
          }
        });
      } catch(e) {}
    }
    localStorage.setItem('qb_session', JSON.stringify(s));
    if (s.userId) localStorage.setItem('qb_data_owner', s.userId);
  }

  function safeReturnTo(raw, fallback = '/foundation'){
    if (typeof raw !== 'string' || !raw.startsWith('/') || /[\\\x00-\x20]/.test(raw)) return fallback;
    try {
      const url = new URL(raw, window.location.origin);
      const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
      if (url.origin !== window.location.origin || !path
          || /^\/(login|signin|auth-callback)(\.html)?$/i.test(path)) return fallback;
      return url.pathname + url.search + url.hash;
    } catch(e) { return fallback; }
  }
  function clearSession(){
    localStorage.removeItem('qb_session');
  }
  function isAuthed(){
    const s = getSession();
    return !!(s && s.token && s.userId);
  }

  // ── JWT refresh + retry wrapper ───────────────────────────────────────────
  // Supabase access tokens are 1-hour. Without refresh, every cloud write
  // started silently 401-PGRST303-failing after expiry — local diverged from
  // cloud invisibly until the user switched devices. Pattern: fire the
  // request; if it 401s with a JWT-expired signal, hit /auth/v1/token with
  // the refresh_token, persist the new access token, retry the original
  // request once. Falls through silently on second failure (network down,
  // refresh token invalid, user logged out elsewhere — let the caller no-op).
  let _refreshing = null;
  async function refreshAccessToken(){
    // Single in-flight refresh shared across concurrent callers
    if (_refreshing) return _refreshing;
    const s = getSession();
    if (!s || !s.refreshToken) return null;
    _refreshing = (async () => {
      try {
        const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: s.refreshToken })
        });
        if (!res.ok) {
          if ((res.status === 400 || res.status === 401) && getSession().token === s.token) logout();
          return null;
        }
        const data = await res.json();
        // A sign-out or account switch while this request was in flight wins.
        if (getSession().userId !== s.userId || getSession().token !== s.token) return null;
        if (!data || !data.access_token) return null;
        const next = Object.assign({}, getSession(), {
          token:        data.access_token,
          refreshToken: data.refresh_token || s.refreshToken
        });
        setSession(next);
        return data.access_token;
      } catch(e){ return null; }
      finally { _refreshing = null; }
    })();
    return _refreshing;
  }
  // Authenticated first-party requests renew once, using the current token
  // even when a renderer captured an older session object.
  async function apiFetch(url, init = {}){
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin || !target.pathname.startsWith('/api/')) {
      throw new Error('Account requests must stay on this site.');
    }
    const before = getSession();
    if (!before.token || !before.userId) return new Response('{}', { status: 401 });
    const fire = () => {
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', 'Bearer ' + getSession().token);
      return fetch(url, { ...init, headers });
    };
    let res = await fire();
    if (res.status !== 401) return res;
    if (getSession().userId !== before.userId) return res;
    // Another request may already have refreshed this token.
    const token = getSession().token !== before.token
      ? getSession().token : await refreshAccessToken();
    if (token && getSession().userId === before.userId) res = await fire();
    if (res.status === 401 && getSession().userId === before.userId) {
      // A network failure during refresh must not discard a valid session.
      if (before.refreshToken && !token && isAuthed()) throw new Error('Could not reconnect. Please try again.');
      logout();
    }
    return res;
  }
  function isJwtExpiredResponse(res, body){
    if (res.status !== 401) return false;
    const code = body && (body.code || body.error_code);
    const msg  = body && (body.message || body.msg || body.error_description || '');
    return code === 'PGRST303' || /jwt expired/i.test(String(msg));
  }
  // cloudFetch(buildRequest): buildRequest receives the current access token
  // and returns { url, init } so the retry can rebuild headers with the fresh
  // token. Returns the second-attempt Response (or first if no retry needed).
  async function cloudFetch(buildRequest){
    if (!isAuthed()) return null;
    const fire = async () => {
      const tok = getSession().token;
      const { url, init } = buildRequest(tok);
      return fetch(url, init);
    };
    let res = await fire();
    if (res.ok) return res;
    // Only attempt refresh on JWT-expired signals; pass other 4xx/5xx through
    let body = null;
    try { body = await res.clone().json(); } catch(e){}
    if (!isJwtExpiredResponse(res, body)) return res;
    const newToken = await refreshAccessToken();
    if (!newToken) return res;  // refresh failed — return original 401
    return await fire();          // retry once with the fresh token
  }

  // ── QBP read/write — local + cloud mirror ─────────────────────────────────
  function getQBP(){
    try { return JSON.parse(localStorage.getItem('qb_qbp') || '{}'); }
    catch(e){ return {}; }
  }
  function setQBP(qbp){
    localStorage.setItem('qb_qbp', JSON.stringify(qbp));
    syncQBPToCloud(qbp);
    return qbp;
  }
  function mergeQBP(patch){
    if (!patch || typeof patch !== 'object') return getQBP();
    // Strip undefined values so we don't overwrite real data with nothing
    const cleanPatch = {};
    Object.keys(patch).forEach(k => { if (patch[k] !== undefined) cleanPatch[k] = patch[k]; });
    const next = Object.assign({}, getQBP(), cleanPatch);
    return setQBP(next);
  }
  // Cloud QBP sync: routes through the merge_qbp RPC so concurrent writers
  // (other tabs, other devices, the user's phone) can't silently overwrite
  // each other's keys. Server-side jsonb || preserves any key in cloud not
  // present in the patch — a Tab A that sets {essence:"x"} and a Tab B that
  // sets {persona:"y"} both land safely instead of last-writer-wins.
  // We send the full local qbp as the patch (top-level shallow merge), so
  // any key the local just wrote replaces the cloud's value for that key,
  // and any cloud-only key survives. Net effect: local additive writes
  // never lose remote-only data.
  async function syncQBPToCloud(qbp){
    if (!isAuthed()) return false;
    const userId = getSession().userId;
    try {
      const res = await cloudFetch(token => ({
        url: SUPA_URL + '/rest/v1/rpc/merge_qbp',
        init: {
          method: 'POST',
          headers: {
            'apikey': SUPA_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ p_user_id: userId, p_patch: qbp || {} })
        }
      }));
      return !!(res && res.ok);
    } catch(e){ return false; }
  }
  async function pullQBPFromCloud(){
    if (!isAuthed()) return null;
    const userId = getSession().userId;
    try {
      const res = await cloudFetch(token => ({
        url: SUPA_URL + '/rest/v1/profiles?select=qbp,first_name,tier,subscription_status,tool_completions&id=eq.' + userId,
        init: {
          headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + token }
        }
      }));
      if (!res || !res.ok) return null;
      const data = await res.json();
      const profile = data && data[0];
      if (!profile || getSession().userId !== userId) return null;

      // Merge cloud → local. Cloud is source of truth, but don't drop
      // local fields that haven't been pushed yet.
      const local = getQBP();
      const merged = Object.assign({}, local, profile.qbp || {});
      localStorage.setItem('qb_qbp', JSON.stringify(merged));

      localStorage.setItem('qb_data_owner', userId);
      localStorage.setItem('qb_first_name', profile.first_name || '');
      if (profile.tier)               localStorage.setItem('qb_user_tier',   profile.tier);
      localStorage.setItem('qb_sub_status', profile.subscription_status || 'inactive');
      if (profile.tool_completions)   localStorage.setItem('qb_completions', JSON.stringify(profile.tool_completions));

      return profile;
    } catch(e){ return null; }
  }

  // ── Completion tracking ───────────────────────────────────────────────────
  function getCompletions(){
    try { return JSON.parse(localStorage.getItem('qb_completions') || '{}'); }
    catch(e){ return {}; }
  }
  async function recordCompletion(toolId){
    if (!toolId) return;

    // Local mirror. Stays even if user is anonymous.
    const localKey = 'qb_' + toolId.replace(/-/g, '_') + '_done';
    localStorage.setItem(localKey, '1');
    const completions = getCompletions();
    completions[toolId] = new Date().toISOString();
    localStorage.setItem('qb_completions', JSON.stringify(completions));

    // Cloud (only if authed). JWT auto-refreshes via cloudFetch on 401.
    if (isAuthed()) {
      const userId = getSession().userId;
      try {
        await cloudFetch(token => ({
          url: SUPA_URL + '/rest/v1/rpc/record_tool_completion',
          init: {
            method: 'POST',
            headers: {
              'apikey': SUPA_KEY,
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_user_id: userId, p_tool_id: toolId })
          }
        }));
      } catch(e){ /* silent */ }
    }
  }
  // Completion hook used by the Phase 01 tools after they write their QBP
  // fields. Keep the page-level contract small while routing the durable
  // local/cloud bookkeeping through the single completion writer above.
  function openGate({ toolId } = {}){
    if (!toolId) return false;
    recordCompletion(toolId);
    return true;
  }
  function nextRecommendedTool(){
    const done = getCompletions();
    return PHASE_01_TOOLS.find(t => !done[t]) || null;
  }
  function phase01Progress(){
    const done = getCompletions();
    const completed = PHASE_01_TOOLS.filter(t => done[t]).length;
    return {
      completed,
      total:   PHASE_01_TOOLS.length,
      percent: Math.round((completed / PHASE_01_TOOLS.length) * 100)
    };
  }

  // ── Magic-link auth ───────────────────────────────────────────────────────
  // The gotrue REST API for /auth/v1/otp expects:
  //   - body: email, create_user, data { ...metadata }     (top-level, no `options` wrapper)
  //   - query: redirect_to                                   (not a body field)
  // The `options` wrapper is a Supabase JS SDK convention — it gets unwrapped
  // before the SDK sends. When calling REST directly you must flatten.
  // Force the canonical host in the redirect target so it always lands on the
  // same origin where localStorage was written (defense alongside the early
  // host redirect at the top of this module).
  async function sendMagicLink(email, firstName, sourceTool, returnTo){
    if (!email) return { ok:false, error:'Email is required.' };
    // Custom magic-link delivery path. We POST to /api/send-magic-link which:
    //   1. Mints an action_link via Supabase admin /generate_link (does NOT
    //      trigger Supabase's default email).
    //   2. Sends our own branded email through Resend from auth@send.nizzar.com
    //      (verified domain, much better deliverability than the default
    //      noreply@mail.app.supabase.io which Gmail/Apple aggressively filter).
    // Optional returnTo overrides the default /foundation landing. It is
    // stashed in localStorage on this origin so auth-callback.html can read
    // it back. We do not thread it through redirect_to because Supabase's
    // allowlist matcher silently rejects URLs with non-static query strings.
    if (returnTo) {
      try { localStorage.setItem('qb_post_auth_return_to', safeReturnTo(returnTo)); } catch(e){}
    }
    try {
      const res = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName: firstName || '',
          sourceTool: sourceTool || 'unknown'
        })
      });
      if (!res.ok) {
        let msg = 'Email send failed';
        try {
          const err = await res.json();
          msg = err.error || err.msg || msg;
        } catch(e){}
        throw new Error(msg);
      }
      // Stash for the callback page so it knows the source/firstName
      localStorage.setItem('qb_pending_signup', JSON.stringify({
        email, firstName, sourceTool, sentAt: Date.now()
      }));
      return { ok:true };
    } catch(e){
      return { ok:false, error:e.message };
    }
  }

  function logout(){
    parkDraft(getSession().userId);
    clearSession();
    sessionStorage.removeItem('qb_return_to');
    localStorage.removeItem('qb_pending_signup');
    localStorage.removeItem('qb_post_auth_return_to');
    localStorage.removeItem('qb_first_name');
    localStorage.removeItem('qb_user_tier');
    localStorage.removeItem('qb_sub_status');
    // The private draft is restored only after this same account signs in.
  }

  // ── Profile confirm (single-flight) ───────────────────────────────────────
  // pullQBPFromCloud() runs at bootstrap and again from requireAccess().
  // Share one in-flight promise so a tool load never fires the profile
  // read twice.
  let _profilePull = null;
  function confirmProfile(){
    if (!_profilePull) {
      _profilePull = pullQBPFromCloud().then(
        p => { _profilePull = null; return p; },
        e => { _profilePull = null; throw e; }
      );
    }
    return _profilePull;
  }

  // ── Feature access (paywall shim — used by Phase 02+ tools) ───────────────
  // Mirrors the existing window.QB_HAS_ACCESS contract used by hub + tools.
  function hasAccess(feature){
    const tier = localStorage.getItem('qb_user_tier') || 'free';
    const status = localStorage.getItem('qb_sub_status') || 'inactive';
    // Phase 01 tools are always free
    if (PHASE_01_TOOLS.includes(feature)) return true;
    if (feature === 'signal-scan')        return true;
    if (feature === 'brand-document')     return true;
    // Everything else requires an active paid subscription
    return isAuthed() && status === 'active' && tier !== 'free';
  }
  // Backwards-compat shim — existing code calls window.QB_HAS_ACCESS
  if (typeof window.QB_HAS_ACCESS !== 'function') {
    window.QB_HAS_ACCESS = hasAccess;
  }

  // ── requireAccess (boot-time gate for Phase 02+ agents) ───────────────────
  // Called from each agent's <head> via:
  //   <script>QB.requireAccess('logo-direction', 'Logo Direction')</script>
  //
  // Behavior:
  //   - Phase 01 tools and brand-document: always allowed (no redirect).
  //   - Anonymous user on a paid tool: redirect to /signal-scan first so they
  //     enter the funnel at the top instead of staring at a paywall.
  //   - Authed but free/inactive on a paid tool: redirect to /payment, remember
  //     the return path so payment.html can bounce them back after checkout.
  function requireAccess(toolId, toolName){
    if (!toolId) return true;
    if (hasAccess(toolId)) return true;

    const here = window.location.pathname + window.location.search;

    // Save where the user wanted to go so we can bring them back.
    try {
      sessionStorage.setItem('qb_return_to', here);
      sessionStorage.setItem('qb_blocked_tool', toolId);
      if (toolName) sessionStorage.setItem('qb_blocked_tool_name', toolName);
    } catch(e) {}

    if (!isAuthed()) {
      // Anonymous. Send them to the one surface that can actually sign
      // them in, carrying the tool they wanted so they land back on it.
      // This used to point at /signal-scan.html, which has no sign-in
      // form and no return_to handling, so the user bounced back to the
      // first question of the diagnostic forever.
      window.location.replace(
        '/login?reason=paywall&return_to=' + encodeURIComponent(here)
      );
      return false;
    }

    // Authed, but the local tier says no. Local can lag the server: the
    // profile pull is async and a cold browser has no qb_user_tier at
    // all, which bounced paying customers to the plan picker on every
    // single load. Confirm against the server first, and only redirect
    // when the server itself says the tier is short. Anything else
    // (network down, profile unreadable) leaves the user on the page.
    // /api/agents/run gates the tier server-side and fails closed, so
    // this client check is UX, never the security boundary.
    confirmProfile().then(profile => {
      if (!profile) return;                 // could not confirm · stay put
      if (hasAccess(toolId)) return;        // paid after all · stay put
      window.location.replace('/payment.html?reason=upgrade&tool=' + encodeURIComponent(toolId));
    }).catch(() => { /* stay put */ });
    return false;
  }

  // ── Cross-tab state sync ──────────────────────────────────────────────────
  // The browser fires `storage` events in OTHER tabs of the same origin when
  // localStorage changes. We bridge those into a single `qb:state-changed`
  // CustomEvent so pages can listen to one thing instead of N keys.
  // Tab B's localStorage is auto-updated by the browser before the event
  // fires, so a re-render reads fresh local values immediately.
  // Pages should listen via:
  //   window.addEventListener('qb:state-changed', e => { /* re-render */ });
  // The event detail is { key, scope } where scope is one of
  // 'qbp' | 'completions' | 'session' | 'profile' | 'other'.
  const QB_KEY_SCOPES = {
    'qb_qbp':            'qbp',
    'qb_completions':    'completions',
    'qb_session':        'session',
    'qb_first_name':     'profile',
    'qb_user_tier':      'profile',
    'qb_sub_status':     'profile'
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', function(e){
      if (!e || !e.key || !QB_KEY_SCOPES[e.key]) return;
      if (e.key === 'qb_session') {
        let before = {}, after = {};
        try { before = JSON.parse(e.oldValue || '{}'); after = JSON.parse(e.newValue || '{}'); } catch(err) {}
        if (before.userId !== after.userId) { window.location.reload(); return; }
      }
      try {
        window.dispatchEvent(new CustomEvent('qb:state-changed', {
          detail: { key: e.key, scope: QB_KEY_SCOPES[e.key] }
        }));
      } catch(err){}
    });
  }

  // ── Bootstrap on load ─────────────────────────────────────────────────────
  if (isAuthed()) {
    confirmProfile().catch(() => {});
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.QB = {
    SUPA_URL, SUPA_KEY,
    isAuthed, getSession, setSession, clearSession,
    getQBP, setQBP, mergeQBP, syncQBPToCloud, pullQBPFromCloud,
    recordCompletion, openGate, getCompletions, nextRecommendedTool, phase01Progress,
    sendMagicLink, logout,
    hasAccess, requireAccess,
    cloudFetch, apiFetch, safeReturnTo, refreshAccessToken, confirmProfile,
    TOOL_NAMES, TOOL_FILES, PHASE_01_TOOLS, PAID_TOOLS
  };
})();
