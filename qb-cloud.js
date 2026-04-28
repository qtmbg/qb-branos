/* ────────────────────────────────────────────────────────────────────────────
   QB CLOUD — Shared module for auth, QBP sync, completion tracking,
              Klaviyo bridge, and feature-access checks.
   Loaded once per page via <script src="/qb-cloud.js"></script>.
   Exposes window.QB.
   ──────────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  const SUPA_URL = 'https://yushbxjwfhuokaezoioe.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1c2hieGp3Zmh1b2thZXpvaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjEwNTAsImV4cCI6MjA5MDM5NzA1MH0.xU_jlBhmSeb1Bck04bEgNAD7HQBsGvgkf7d3PK_dbl0';

  // ── Canonical host enforcement ────────────────────────────────────────────
  // Defense against the www/non-www split: if a user lands on www.<host>,
  // redirect to the bare <host> immediately so localStorage lives under the
  // same origin the magic-link redirect targets. Hash + query are preserved
  // (so this is safe to run on /auth-callback.html which reads the JWT from
  // the URL fragment). Only applies to www.quantumbranding.ai — leaves the
  // app subdomain and localhost alone.
  const CANONICAL_HOST = 'quantumbranding.ai';
  if (typeof window !== 'undefined' && window.location.host === 'www.' + CANONICAL_HOST) {
    window.location.replace(
      'https://' + CANONICAL_HOST
      + window.location.pathname
      + window.location.search
      + window.location.hash
    );
    return; // The redirect interrupts the rest of this module. Re-runs on the canonical host.
  }

  // ── Tool registry ──────────────────────────────────────────────────────────
  // PHASE_01_TOOLS lists every tool that counts toward Phase 01 progress.
  // Order matters: nextRecommendedTool() returns the first incomplete one,
  // so list them in journey order. Compass is the entry point.
  const TOOL_NAMES = {
    'archetype-compass': 'Archetype Compass',
    'soul-map':          'Brand Soul Map',
    'sensescape':        'Sensescape',
    'visual-dna':        'Visual DNA',
    'war-table':         'The War Table',
    'profiles':     'The Profiles'
  };
  const TOOL_FILES = {
    'archetype-compass': 'archetype-compass.html',
    'soul-map':          'brand-soul-map.html',
    'sensescape':        'sensescape.html',
    'visual-dna':        'visual-dna.html',
    'war-table':         'war-table.html',
    'profiles':     'the-profiles.html'
  };
  const PHASE_01_TOOLS = ['archetype-compass', 'soul-map', 'sensescape', 'visual-dna', 'war-table', 'profiles'];

  // ── Session management ────────────────────────────────────────────────────
  function getSession(){
    try { return JSON.parse(localStorage.getItem('qb_session') || '{}'); }
    catch(e){ return {}; }
  }
  function setSession(s){
    localStorage.setItem('qb_session', JSON.stringify(s));
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
        if (!res.ok) return null;
        const data = await res.json();
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
      if (!profile) return null;

      // Merge cloud → local. Cloud is source of truth, but don't drop
      // local fields that haven't been pushed yet.
      const local = getQBP();
      const merged = Object.assign({}, local, profile.qbp || {});
      localStorage.setItem('qb_qbp', JSON.stringify(merged));

      if (profile.first_name)         localStorage.setItem('qb_first_name',  profile.first_name);
      if (profile.tier)               localStorage.setItem('qb_user_tier',   profile.tier);
      if (profile.subscription_status)localStorage.setItem('qb_sub_status',  profile.subscription_status);
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

    // Local mirror — stays even if user is anonymous
    const localKey = 'qb_' + toolId.replace(/-/g, '_') + '_done';
    localStorage.setItem(localKey, '1');
    const completions = getCompletions();
    const wasComplete = !!completions[toolId];
    completions[toolId] = new Date().toISOString();
    localStorage.setItem('qb_completions', JSON.stringify(completions));

    // Cloud (only if authed) — JWT auto-refreshes via cloudFetch on 401
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

    // Klaviyo per-tool event
    sendKlaviyoEvent('Tool Completed', {
      tool_id:   toolId,
      tool_name: TOOL_NAMES[toolId] || toolId
    });

    // Klaviyo Phase 01 milestone event — fires only on the transition
    // from "not all done" → "all done"
    if (!wasComplete && PHASE_01_TOOLS.every(t => completions[t])) {
      const firstAt = completions[PHASE_01_TOOLS[0]];
      const totalDays = firstAt
        ? Math.max(0, Math.round((Date.now() - new Date(firstAt).getTime()) / 86400000))
        : 0;
      sendKlaviyoEvent('Phase 01 Complete', { total_time_days: totalDays });
    }
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
  async function sendMagicLink(email, firstName, sourceTool){
    if (!email) return { ok:false, error:'Email is required.' };
    const canonicalOrigin = (window.location.host === 'app.' + CANONICAL_HOST)
      ? window.location.origin                     // app subdomain stays itself
      : 'https://' + CANONICAL_HOST;               // everything else → canonical root
    const returnUrl = window.location.href.replace('://www.', '://');
    const redirectTo = canonicalOrigin
      + '/auth-callback.html?return_to='
      + encodeURIComponent(returnUrl);
    try {
      const res = await fetch(
        SUPA_URL + '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirectTo),
        {
          method: 'POST',
          headers: {
            'apikey': SUPA_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            create_user: true,
            data: {
              first_name:    firstName || '',
              signup_source: sourceTool || 'unknown'
            }
          })
        }
      );
      if (!res.ok) {
        let msg = 'Email send failed';
        try {
          const err = await res.json();
          msg = err.msg || err.error_description || err.message || msg;
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
    clearSession();
    localStorage.removeItem('qb_first_name');
    localStorage.removeItem('qb_user_tier');
    localStorage.removeItem('qb_sub_status');
    // Keep qb_qbp + qb_completions locally so the user doesn't lose work
  }

  // ── Feature access (paywall shim — used by Phase 02+ tools) ───────────────
  // Mirrors the existing window.QB_HAS_ACCESS contract used by hub + tools.
  function hasAccess(feature){
    const tier = localStorage.getItem('qb_user_tier') || 'free';
    const status = localStorage.getItem('qb_sub_status') || 'inactive';
    // Phase 01 tools are always free
    if (PHASE_01_TOOLS.includes(feature)) return true;
    if (feature === 'signal-scan')        return true;
    // Everything else requires an active paid subscription
    return status === 'active' && tier !== 'free';
  }
  // Backwards-compat shim — existing code calls window.QB_HAS_ACCESS
  if (typeof window.QB_HAS_ACCESS !== 'function') {
    window.QB_HAS_ACCESS = hasAccess;
  }

  // ── Klaviyo bridge ────────────────────────────────────────────────────────
  // Klaviyo public key + list ID can be injected via:
  //   - window.QB_KLAVIYO_KEY / window.QB_KLAVIYO_LIST_ID (script-tag config)
  //   - localStorage.qb_klaviyo_pk / qb_klaviyo_list (set by hub settings)
  // If neither is present, all Klaviyo functions silently no-op.
  function getKlaviyoConfig(){
    return {
      key:    window.QB_KLAVIYO_KEY     || localStorage.getItem('qb_klaviyo_pk')   || '',
      listId: window.QB_KLAVIYO_LIST_ID || localStorage.getItem('qb_klaviyo_list') || ''
    };
  }
  async function syncKlaviyoProfile(email, firstName, props){
    const cfg = getKlaviyoConfig();
    if (!cfg.key || !email) return;
    try {
      await fetch('https://a.klaviyo.com/client/profiles/?company_id=' + cfg.key, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'revision':'2024-10-15' },
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              email,
              first_name: firstName || undefined,
              properties: props || {}
            }
          }
        })
      });
      if (cfg.listId) {
        await fetch('https://a.klaviyo.com/client/subscriptions/?company_id=' + cfg.key, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'revision':'2024-10-15' },
          body: JSON.stringify({
            data: {
              type: 'subscription',
              attributes: {
                profile: { data: { type:'profile', attributes:{ email } } },
                custom_source: 'Brand Profile Gate'
              },
              relationships: { list: { data: { type:'list', id: cfg.listId } } }
            }
          })
        });
      }
    } catch(e){ /* silent */ }
  }
  async function sendKlaviyoEvent(eventName, props){
    const cfg = getKlaviyoConfig();
    if (!cfg.key) return;
    let email = null;
    try {
      const s = JSON.parse(localStorage.getItem('qb_session') || '{}');
      email = s.email || null;
    } catch(e){}
    if (!email) return;
    try {
      await fetch('https://a.klaviyo.com/client/events/?company_id=' + cfg.key, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'revision':'2024-10-15' },
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              metric:     { data: { type:'metric',  attributes:{ name: eventName } } },
              profile:    { data: { type:'profile', attributes:{ email } } },
              properties: props || {}
            }
          }
        })
      });
    } catch(e){ /* silent */ }
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
      try {
        window.dispatchEvent(new CustomEvent('qb:state-changed', {
          detail: { key: e.key, scope: QB_KEY_SCOPES[e.key] }
        }));
      } catch(err){}
    });
  }

  // ── Bootstrap on load ─────────────────────────────────────────────────────
  if (isAuthed()) {
    pullQBPFromCloud();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.QB = {
    SUPA_URL, SUPA_KEY,
    isAuthed, getSession, setSession, clearSession,
    getQBP, setQBP, mergeQBP, syncQBPToCloud, pullQBPFromCloud,
    recordCompletion, getCompletions, nextRecommendedTool, phase01Progress,
    sendMagicLink, logout,
    hasAccess,
    syncKlaviyoProfile, sendKlaviyoEvent,
    cloudFetch, refreshAccessToken,
    TOOL_NAMES, TOOL_FILES, PHASE_01_TOOLS
  };
})();
