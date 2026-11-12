// Brand MRI · page controller.
// Engine in mri.js, tier rules in mri-tiers.js, words in mri-i18n.js.
//
// What this file guarantees:
//   - The ten answers are kept on the device (localStorage). A buyer who
//     leaves for Stripe and comes back finds their report open. Nothing is
//     asked twice.
//   - A paid tier opens only after /api/mri-verify has confirmed the
//     Stripe session. ?paid= in the address opens nothing by itself.
//   - The lead, the review order and the funnel events go to the server.
//     The browser calls no third party.
//   - Every text node is written with textContent. No visitor input is
//     ever parsed as HTML.
(function () {
  'use strict';

  var I18N = window.MRI_I18N;
  var ENGINE = window.MRI;
  var TIERS = window.TIERS;

  // Live Stripe Payment Links, account Quantum Branding LLC, created
  // 2026-11-01. Each carries brand_mri_tier metadata and redirects to
  // /mri?paid=<tier>&session_id={CHECKOUT_SESSION_ID}.
  var STRIPE = {
    flash: 'https://buy.stripe.com/4gM4gz8PY4uWfpD9xY2Ry04',
    full: 'https://buy.stripe.com/8x28wP9U29Pg7XbcKa2Ry05',
    upgrade60: 'https://buy.stripe.com/cNi14n3vEaTk4KZ5hI2Ry06',
    review211: 'https://buy.stripe.com/28E6oHeaigdE1yNh0q2Ry07',
    reviewFull: 'https://buy.stripe.com/9B68wP5DM3qSa5jeSi2Ry08',
    retest39: 'https://buy.stripe.com/fZu3cv9U28Lc3GV9xY2Ry09'
  };

  var STATE_KEY = 'mri_state_v2';
  var LANG_KEY = 'qb_lang';
  var FINAL_REASONS = { bad_session_id: 1, not_found: 1, unpaid: 1, not_mri: 1 };

  var params = new URLSearchParams(window.location.search);
  var DEBUG = params.get('debug') === '1';
  var RETEST = params.get('retest') === '1';
  var SESSION_PARAM = params.get('session_id');
  var PAID_PARAM = params.get('paid');
  var DEMO = params.get('demo');
  var HOST = window.location.hostname;

  function el(id) { return document.getElementById(id); }
  function show(node, on) { if (node) node.classList.toggle('hidden', !on); }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }

  /* ── State ──────────────────────────────────────────────── */

  function newId() {
    try {
      var a = new Uint8Array(10);
      window.crypto.getRandomValues(a);
      return 'v_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    } catch (e) {
      return 'v_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
    }
  }

  function validAnswers(a) {
    if (!Array.isArray(a) || a.length !== 10) return null;
    for (var i = 0; i < 10; i++) if (ENGINE.OPTION_VALUES.indexOf(a[i]) === -1) return null;
    return a.slice();
  }

  function blankState() {
    return {
      v: 2, visitorId: newId(), lang: null, form: {}, answers: null, completedAt: null,
      extras: { difference: '', proof: '' }, sessions: [], pendingSession: null,
      reviewSentAt: null, magicFor: null, utm: null, referrer: null, focus: null
    };
  }

  function loadState() {
    var s = null;
    try { s = JSON.parse(window.localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || s.v !== 2 || !s.visitorId) return blankState();
    var base = blankState();
    base.visitorId = String(s.visitorId);
    base.lang = s.lang === 'fr' || s.lang === 'en' ? s.lang : null;
    base.form = s.form && typeof s.form === 'object' ? s.form : {};
    base.answers = validAnswers(s.answers);
    base.completedAt = s.completedAt || null;
    base.extras = { difference: String((s.extras && s.extras.difference) || ''), proof: String((s.extras && s.extras.proof) || '') };
    base.sessions = Array.isArray(s.sessions)
      ? s.sessions.filter(function (x) { return x && typeof x.id === 'string' && typeof x.tier === 'string'; })
      : [];
    base.pendingSession = typeof s.pendingSession === 'string' ? s.pendingSession : null;
    base.reviewSentAt = s.reviewSentAt || null;
    base.magicFor = s.magicFor || null;
    base.utm = s.utm || null;
    base.referrer = s.referrer || null;
    base.focus = s.focus || null;
    return base;
  }

  function saveState() {
    try { window.localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: the page still works for this visit */ }
  }

  var state = loadState();

  // First touch. Where the visitor came from is recorded once and kept, so
  // a lead sent after a trip to Stripe still carries its source.
  if (!state.utm) {
    state.utm = {
      source: params.get('utm_source') || '', medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '', content: params.get('utm_content') || ''
    };
    var ref = '';
    try { ref = document.referrer && new URL(document.referrer).hostname !== HOST ? document.referrer : ''; } catch (e) { ref = ''; }
    state.referrer = ref.slice(0, 300);
    state.focus = params.get('focus') || '';
  }
  var FOCUS = params.get('focus') || '';

  /* ── Language ───────────────────────────────────────────── */

  var storedLang = null;
  try { storedLang = window.localStorage.getItem(LANG_KEY); } catch (e) { storedLang = null; }
  var lang = I18N.resolveLang({
    param: params.get('lang'), stored: storedLang, saved: state.lang,
    nav: (window.navigator && (window.navigator.language || window.navigator.userLanguage)) || ''
  });
  state.lang = lang;
  saveState();

  function S() { return I18N.STRINGS[lang]; }
  function t(path, vars) {
    var v = I18N.path(S(), path);
    if (v == null) return path;
    return vars ? I18N.fmt(v, vars) : v;
  }
  function pillarName(id) { return t('pillars.' + id + '.name'); }

  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.description'));
    each('[data-i18n]', function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    each('[data-i18n-ph]', function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    if (FOCUS && S().focus[FOCUS]) el('headline').textContent = S().focus[FOCUS];
  }

  function setLang(next) {
    next = String(next || '').toLowerCase().slice(0, 2);
    if (!I18N.STRINGS[next] || next === lang) return;
    lang = next;
    state.lang = lang;
    saveState();
    applyStatic();
    renderQuestions();
    refreshLanding();
    if (!el('result').classList.contains('hidden')) renderResult();
  }
  window.addEventListener('qb:lang', function (e) { setLang(e && e.detail); });
  window.MRI_PAGE = { setLang: setLang, lang: function () { return lang; } };

  /* ── Tier ───────────────────────────────────────────────── */

  function currentTier() {
    return TIERS.resolveTier({ sessions: state.sessions, demo: DEMO, hostname: HOST });
  }
  function hasRetest() {
    if (!TIERS.isProdHost(HOST) && DEMO === 'retest') return true;
    return state.sessions.some(function (s) { return s.tier === 'retest'; });
  }
  function addSession(id, tier) {
    if (!state.sessions.some(function (s) { return s.id === id; })) state.sessions.push({ id: id, tier: tier, at: new Date().toISOString() });
  }
  function dropSession(id) {
    state.sessions = state.sessions.filter(function (s) { return s.id !== id; });
  }

  /* ── Server calls ───────────────────────────────────────── */

  function debugLog(msg) {
    var box = el('captureDebug');
    if (DEBUG && box) { show(box, true); box.textContent += msg + ' | '; }
  }

  function track(event, extra) {
    if (!/^https?:$/.test(window.location.protocol)) return;
    var payload = {
      event: event, visitor_id: state.visitorId, lang: lang, tier: currentTier(),
      focus: state.focus || '', utm: state.utm || {}, referrer: state.referrer || ''
    };
    if (extra) Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
    var body = JSON.stringify(payload);
    try {
      if (window.navigator.sendBeacon) {
        window.navigator.sendBeacon('/api/mri-event', new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) { /* fall through to fetch */ }
    try {
      window.fetch('/api/mri-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true })
        .catch(function () {});
    } catch (e) { /* tracking never blocks the page */ }
  }

  function postJson(url, payload) {
    return window.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; });
    });
  }

  function verifySession(id) {
    return window.fetch('/api/mri-verify?session_id=' + encodeURIComponent(id), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); });
  }

  function sendLead(d) {
    var f = state.form;
    // Kept for the debug export only. The lead itself lives on the server.
    try {
      var leads = JSON.parse(window.localStorage.getItem('mri_leads') || '[]');
      leads.push({ date: new Date().toISOString(), brand: f.brand || '', website: f.website || '', email: f.email || '', score: d.global, frein: d.tensions[0].id, tier: currentTier() });
      window.localStorage.setItem('mri_leads', JSON.stringify(leads));
    } catch (e) { /* storage full or blocked */ }

    postJson('/api/mri-lead', {
      type: 'lead', email: f.email, brand: f.brand, website: f.website, phrase: f.phrase, target: f.target,
      answers: state.answers, tier: currentTier(), lang: lang, visitor_id: state.visitorId,
      utm: state.utm || {}, referrer: state.referrer || '', focus: state.focus || '',
      prev_score: hasRetest() && f.prevScore !== '' && f.prevScore != null ? Number(f.prevScore) : null
    }).then(function (r) { debugLog('lead HTTP ' + r.status); })
      .catch(function (err) { debugLog('lead error ' + err); });

    // The BrandOS account, once per email.
    if (state.magicFor !== f.email) {
      state.magicFor = f.email;
      saveState();
      try {
        if (window.QB && window.QB.sendMagicLink) {
          window.QB.sendMagicLink(f.email, '', 'brand-mri', '/mri')
            .then(function (r) { debugLog('magic link ' + (r && r.ok ? 'OK' : 'failed ' + (r && r.error))); })
            .catch(function (err) { debugLog('magic link error ' + err); });
        } else { debugLog('magic link absent'); }
      } catch (e) { debugLog('magic link exception ' + e); }
    }
  }

  /* ── Views ──────────────────────────────────────────────── */

  function view(name) {
    show(el('landing'), name === 'landing');
    show(el('form'), name === 'form');
    show(el('result'), name === 'result');
    window.scrollTo(0, 0);
  }

  function notice(text) {
    var box = el('mriNotice');
    if (!text) { show(box, false); return; }
    box.textContent = text;
    show(box, true);
  }

  // The re-test is bought first, then taken: its pay button sits on the
  // landing until a re-test session is confirmed.
  function refreshLanding() {
    show(el('retestNote'), RETEST);
    var pay = el('retestPay');
    var needsPay = RETEST && !hasRetest();
    clear(pay);
    show(pay, needsPay);
    if (needsPay) {
      pay.appendChild(mkButton(t('offers.pay', { label: S().offers.retest39.label }), false, function () { goPay('retest39'); }));
    }
  }

  function showLanding() {
    refreshLanding();
    view('landing');
  }

  function fillForm() {
    var f = state.form;
    el('brand').value = f.brand || '';
    el('website').value = f.website || '';
    el('email').value = f.email || '';
    el('currentPhrase').value = f.phrase || '';
    el('target').value = f.target || '';
    var wantsPrev = RETEST && hasRetest();
    show(el('prevScoreWrap'), wantsPrev);
    if (wantsPrev && (f.prevScore == null || f.prevScore === '') && state.answers) {
      // The previous score is the one this device last computed.
      f.prevScore = ENGINE.diagnose(state.answers).global;
    }
    el('prevScore').value = wantsPrev && f.prevScore != null ? f.prevScore : '';
  }

  // keepAnswers true: the stored answers come back checked, to adjust.
  // keepAnswers false: a blank sheet (first run, re-test).
  function showForm(keepAnswers) {
    fillForm();
    renderQuestions(keepAnswers && state.answers ? state.answers : false);
    setError('formError', '');
    view('form');
  }

  function setError(id, text) {
    var box = el(id);
    box.textContent = text || '';
    show(box, Boolean(text));
  }

  // prefill: an answers array to check, false for a blank sheet, or
  // nothing to keep whatever is checked now (a language change).
  function renderQuestions(prefill) {
    var wrap = el('questions');
    var kept = prefill === false ? null : (prefill || readAnswersPartial());
    clear(wrap);
    S().questions.forEach(function (q, qi) {
      var pillar = ENGINE.PILLARS[Math.floor(qi / 2)];
      var fs = h('fieldset', 'mri-q');
      fs.id = 'q' + qi + 'set';
      var lg = h('legend');
      lg.appendChild(h('span', 'mri-q_pillar', (qi + 1) + ' · ' + pillarName(pillar.id)));
      lg.appendChild(document.createTextNode(q));
      fs.appendChild(lg);
      var opts = h('div', 'mri-opts');
      ENGINE.OPTION_VALUES.forEach(function (value, oi) {
        var lab = h('label', 'mri-opt');
        var inp = document.createElement('input');
        inp.type = 'radio';
        inp.name = 'q' + qi;
        inp.value = String(value);
        if (kept && kept[qi] === value) inp.checked = true;
        lab.appendChild(inp);
        lab.appendChild(h('span', null, S().options[oi]));
        opts.appendChild(lab);
      });
      fs.appendChild(opts);
      wrap.appendChild(fs);
    });
  }

  function readAnswersPartial() {
    var out = [];
    for (var i = 0; i < 10; i++) {
      var checked = document.querySelector('input[name="q' + i + '"]:checked');
      out.push(checked ? parseInt(checked.value, 10) : null);
    }
    return out;
  }

  function submitForm() {
    var email = el('email').value.trim();
    state.form = {
      brand: el('brand').value.trim(), website: el('website').value.trim(), email: email,
      phrase: el('currentPhrase').value.trim(), target: el('target').value.trim(),
      prevScore: el('prevScore').value.trim()
    };
    saveState();
    if (!email || email.indexOf('@') === -1) {
      setError('formError', t('form.errEmail'));
      el('email').focus();
      return;
    }
    var partial = readAnswersPartial();
    var missing = [];
    partial.forEach(function (v, i) {
      var miss = v === null;
      el('q' + i + 'set').classList.toggle('is-missing', miss);
      if (miss) missing.push(i + 1);
    });
    if (missing.length) {
      setError('formError', t('form.errAnswers', { list: missing.join(', ') }));
      el('q' + (missing[0] - 1) + 'set').scrollIntoView({ block: 'center' });
      return;
    }
    setError('formError', '');
    state.answers = partial;
    state.completedAt = new Date().toISOString();
    saveState();
    var d = ENGINE.diagnose(state.answers);
    sendLead(d);
    notice('');
    renderResult();
    view('result');
  }

  /* ── Result ─────────────────────────────────────────────── */

  function levelPill(level) { return h('span', 'mri-level is-' + level, t('levels.' + level)); }

  function exitTest(questions) {
    var box = h('div', 'mri-exit');
    box.appendChild(h('p', null, t('result.exitLead')));
    var list = h('ol');
    questions.forEach(function (qi) { list.appendChild(h('li', null, S().questions[qi])); });
    box.appendChild(list);
    return box;
  }

  function pillarHead(id, score, level) {
    var head = h('p', 'mri-card_head');
    head.appendChild(h('strong', null, pillarName(id)));
    head.appendChild(document.createTextNode(' · ' + score + '/100 '));
    head.appendChild(levelPill(level));
    return head;
  }

  function mkButton(label, primary, onClick) {
    var b = h('button', 'qb-button is-expand is-wrap' + (primary ? ' is-primary' : ''));
    b.type = 'button';
    b.appendChild(h('span', 'qb-button_content', label));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderSentence() {
    var f = state.form;
    var s = ENGINE.sentence({ brand: f.brand, target: f.target, difference: state.extras.difference, proof: state.extras.proof }, S().result);
    var out = el('proposedSentence');
    out.textContent = s.text;
    out.classList.toggle('is-frame', !s.complete);
  }

  function renderOffers(tier) {
    var box = el('offerBox');
    clear(box);
    var offers = TIERS.nextOffers(tier, RETEST && !hasRetest());
    show(el('offerAudit'), tier !== 'review');
    if (!offers.length) {
      var top = h('div', 'mri-card is-white');
      top.appendChild(h('p', 'mri-card_head', t('offers.maxTitle')));
      top.appendChild(h('p', null, t('offers.maxDesc')));
      box.appendChild(top);
      return;
    }
    offers.forEach(function (o) {
      var copy = S().offers[o.key];
      if (o.primary) {
        var c = h('div', 'mri-card is-white');
        c.appendChild(h('p', 'mri-card_head', copy.label));
        if (copy.desc) c.appendChild(h('p', null, copy.desc));
        box.appendChild(c);
      }
      var row = h('div', 'mri-actions');
      row.appendChild(mkButton(t('offers.pay', { label: copy.label }), o.primary, function () { goPay(o.key); }));
      box.appendChild(row);
    });
  }

  function goPay(key) {
    track('pay_click', { target: key });
    var q = new URLSearchParams();
    q.set('client_reference_id', state.visitorId);
    if (state.form.email) q.set('prefilled_email', state.form.email);
    q.set('locale', lang);
    navigate(STRIPE[key] + '?' + q.toString());
  }

  // One seam for leaving the page, so a harness can observe the address.
  function navigate(url) {
    if (typeof window.__mriNavigate === 'function') { window.__mriNavigate(url); return; }
    window.location.href = url;
  }

  function renderReview(tier) {
    var on = tier === 'review';
    show(el('reviewSection'), on);
    if (!on) return;
    var done = Boolean(state.reviewSentAt);
    show(el('reviewForm'), !done);
    show(el('reviewDone'), done);
    if (done) el('reviewDone').textContent = t('review.sent', { email: state.form.email || '' });
  }

  function renderResult() {
    var d = ENGINE.diagnose(state.answers);
    var tier = currentTier();
    var m = ENGINE.reportModel(d, tier);

    el('resultEyebrow').textContent = tier === 'free' ? t('result.eyebrow') : t('landing.eyebrow');
    el('globalScore').textContent = String(d.global);
    el('frein').textContent = t(tier === 'free' ? 'result.brake' : 'result.brakePaid', { pillar: pillarName(m.brake) });
    el('tierNote').textContent = t('result.tierNote.' + tier);

    var reading = el('reading');
    show(reading, m.reading);
    if (m.reading) {
      reading.textContent = t('result.reading', {
        strong: pillarName(d.strongest.id), s: d.strongest.score, brake: pillarName(m.brake), b: d.tensions[0].score
      }) + ' ' + t('result.readingLevel.' + d.globalLevel);
    }

    var compare = el('retestCompare');
    var prev = parseInt(state.form.prevScore, 10);
    var canCompare = hasRetest() && Number.isFinite(prev);
    show(compare, canCompare);
    if (canCompare) {
      var diff = d.global - prev;
      compare.textContent = t('result.retestCompare', { prev: prev, now: d.global, diff: (diff >= 0 ? '+' : '') + diff });
    }

    // Flash: three tensions with their advice, then the exit test of the first.
    show(el('flashSection'), Boolean(m.tensions));
    if (m.tensions) {
      var tens = el('tensions');
      clear(tens);
      m.tensions.forEach(function (p, i) {
        var c = h('div', 'mri-card is-white');
        var head = pillarHead(p.id, p.score, p.level);
        head.insertBefore(document.createTextNode((i + 1) + '. '), head.firstChild);
        c.appendChild(head);
        c.appendChild(h('p', null, t('advice.' + p.id + '.' + p.level)));
        tens.appendChild(c);
      });
      var pr = el('chantier');
      clear(pr);
      var pc = h('div', 'mri-card');
      pc.appendChild(h('p', 'mri-card_head', t('result.workstream', { n: 1, pillar: pillarName(m.priority.id) }) + ' ' + t('result.startHere')));
      pc.appendChild(exitTest(m.priority.exitTest));
      pr.appendChild(pc);
    }

    // Full: five pillars, the sentence, the 90-day plan.
    show(el('fullSection'), Boolean(m.pillars));
    if (m.pillars) {
      var ps = el('pillarScores');
      clear(ps);
      m.pillars.forEach(function (p) {
        var c = h('div', 'mri-card is-white');
        c.appendChild(pillarHead(p.id, p.score, p.level));
        var bar = h('div', 'mri-bar');
        var fill = h('div');
        fill.style.width = p.score + '%';
        bar.appendChild(fill);
        c.appendChild(bar);
        c.appendChild(h('p', 'mri-short', t('pillars.' + p.id + '.short')));
        c.appendChild(h('p', null, p.advice
          ? t('advice.' + p.id + '.' + p.level)
          : t('result.inPlan', { phase: S().result.phases[p.phase].toLowerCase() })));
        ps.appendChild(c);
      });

      el('difference').value = state.extras.difference;
      el('proof').value = state.extras.proof;
      renderSentence();
      el('currentPhraseOut').textContent = t('result.currentPhrase', { phrase: state.form.phrase || t('result.notProvided') });

      var plan = el('plan90');
      clear(plan);
      m.plan.forEach(function (p) {
        var c = h('div', 'mri-card');
        c.appendChild(h('p', 'mri-card_head', S().result.phases[p.phase] + ' · ' + t('result.workstream', { n: p.phase + 1, pillar: pillarName(p.id) })));
        var act = h('p');
        act.appendChild(h('strong', null, t('result.action') + ' '));
        act.appendChild(document.createTextNode(t('advice.' + p.id + '.' + p.level)));
        c.appendChild(act);
        c.appendChild(exitTest(p.exitTest));
        plan.appendChild(c);
      });
    }

    renderReview(tier);
    renderOffers(tier);
    show(el('exportBtn'), DEBUG);
  }

  /* ── Payment return ─────────────────────────────────────── */

  function cleanUrl() {
    var keep = new URLSearchParams();
    ['lang', 'retest', 'debug', 'demo', 'focus'].forEach(function (k) {
      if (params.get(k) !== null) keep.set(k, params.get(k));
    });
    var qs = keep.toString();
    try { window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '')); } catch (e) { /* older browsers keep the address */ }
  }

  function restoreFrom(restore) {
    var answers = validAnswers(restore.answers);
    if (!answers) return;
    state.answers = answers;
    state.completedAt = state.completedAt || new Date().toISOString();
    var f = restore.form || {};
    state.form = {
      brand: f.brand || state.form.brand || '', website: f.website || state.form.website || '',
      email: f.email || state.form.email || '', phrase: f.phrase || state.form.phrase || '',
      target: f.target || state.form.target || '', prevScore: state.form.prevScore || ''
    };
  }

  function route() {
    if (RETEST) { showLanding(); return; }
    if (state.answers) { renderResult(); view('result'); return; }
    showLanding();
  }

  function confirmPayment(id) {
    show(el('paidFail'), false);
    notice(t('paid.checking'));
    var name = function (tier) { return t('paid.tierNames.' + tier); };
    verifySession(id).then(function (res) {
      if (res && res.ok) {
        state.pendingSession = null;
        addSession(id, res.tier);
        if (!state.answers && res.restore) restoreFrom(res.restore);
        saveState();
        cleanUrl();
        if (res.tier === 'retest') {
          showForm(false);
          notice(t('paid.retestReady'));
        } else if (state.answers) {
          renderResult();
          view('result');
          notice(t('paid.confirmed', { tier: name(res.tier) }));
        } else {
          showForm(false);
          notice(t('paid.needAnswers', { tier: name(res.tier) }));
        }
        return;
      }
      if (res && FINAL_REASONS[res.reason]) {
        state.pendingSession = null;
        saveState();
        cleanUrl();
        notice('');
        route();
        show(el('paidFail'), true);
        return;
      }
      throw new Error((res && res.reason) || 'no answer');
    }).catch(function () {
      // The check could not run. Keep the session and try on the next load.
      state.pendingSession = id;
      saveState();
      route();
      notice(t('paid.pending', { tier: name(RETEST ? 'retest' : (TIERS.RANK[PAID_PARAM] != null ? PAID_PARAM : 'full')) }));
    });
  }

  // Sessions confirmed on an earlier visit are checked again, quietly. One
  // that Stripe no longer reports as paid (a refund) closes its tier.
  function recheckSessions() {
    state.sessions.slice().forEach(function (s) {
      verifySession(s.id).then(function (res) {
        if (res && !res.ok && FINAL_REASONS[res.reason]) {
          dropSession(s.id);
          saveState();
          if (!el('result').classList.contains('hidden')) renderResult();
        }
      }).catch(function () { /* offline: keep what is known */ });
    });
  }

  /* ── Review order ───────────────────────────────────────── */

  function submitReview() {
    var q = el('reviewQuestions').value.trim();
    if (!q) { setError('reviewError', t('review.errEmpty')); return; }
    var session = state.sessions.filter(function (s) { return s.tier === 'review'; })[0];
    var btn = el('reviewSubmitBtn');
    btn.disabled = true;
    setError('reviewError', '');
    el('reviewStatus').textContent = t('review.sending');
    var f = state.form;
    postJson('/api/mri-lead', {
      type: 'review', session_id: session ? session.id : '', email: f.email, brand: f.brand, website: f.website,
      questions: q, answers: state.answers, phrase: f.phrase, target: f.target, extras: state.extras
    }).then(function (r) {
      el('reviewStatus').textContent = '';
      btn.disabled = false;
      if (r.status === 200 && r.data && r.data.ok) {
        state.reviewSentAt = new Date().toISOString();
        saveState();
        renderReview(currentTier());
      } else {
        setError('reviewError', t('review.errSend'));
      }
    }).catch(function () {
      el('reviewStatus').textContent = '';
      btn.disabled = false;
      setError('reviewError', t('review.errSend'));
    });
  }

  /* ── Wiring ─────────────────────────────────────────────── */

  el('startBtn').addEventListener('click', function () {
    track('start');
    showForm(false);
  });
  el('resultBtn').addEventListener('click', submitForm);
  el('retakeBtn').addEventListener('click', function () { showForm(true); });
  el('printBtn').addEventListener('click', function () { window.print(); });
  el('reviewSubmitBtn').addEventListener('click', submitReview);
  el('paidRetryBtn').addEventListener('click', function () {
    var id = SESSION_PARAM || state.pendingSession;
    if (id) confirmPayment(id); else window.location.reload();
  });
  ['difference', 'proof'].forEach(function (id) {
    el(id).addEventListener('input', function () {
      state.extras[id] = el(id).value.slice(0, 300);
      saveState();
      renderSentence();
    });
  });
  el('exportBtn').addEventListener('click', function () {
    var leads = [];
    try { leads = JSON.parse(window.localStorage.getItem('mri_leads') || '[]'); } catch (e) { leads = []; }
    var csv = 'date,brand,website,email,score,frein,tier\n' + leads.map(function (l) {
      return [l.date, l.brand, l.website, l.email, l.score, l.frein, l.tier].map(function (c) {
        return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'brand-mri-leads.csv';
    a.click();
  });

  /* ── Boot ───────────────────────────────────────────────── */

  applyStatic();
  renderQuestions(false);

  var viewed = false;
  try { viewed = window.sessionStorage.getItem('mri_viewed') === '1'; window.sessionStorage.setItem('mri_viewed', '1'); } catch (e) { viewed = false; }
  if (!viewed) track('view');

  if (SESSION_PARAM) {
    confirmPayment(SESSION_PARAM);
  } else if (state.pendingSession) {
    confirmPayment(state.pendingSession);
  } else {
    route();
    // ?paid= with no session to check: there is nothing to confirm.
    if (PAID_PARAM) { cleanUrl(); show(el('paidFail'), true); }
    recheckSessions();
  }
})();
