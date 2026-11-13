/* BrandOS · language runtime
 *
 * One blocking script in <head>, right after <meta charset>:
 *
 *   <script src="/js/qb-i18n.js" data-page="index"></script>
 *
 * What it does:
 *   1. Picks the language: ?lang=, then the saved choice, then the browser.
 *   2. Loads two dictionaries for the target language when it differs from
 *      the language the page was written in: js/i18n/<lang>/common.js and
 *      js/i18n/<lang>/<page>.js.
 *   3. Translates text nodes and a short list of attributes, and keeps
 *      translating as the page renders (React pages re-render constantly).
 *      It only ever rewrites text node data and attribute values, so a
 *      framework that owns the elements never loses a node.
 *   4. Reverses the colour pair in French: where English paints ink on
 *      cream, French paints cream on ink. Tokens swap in one :root block.
 *   5. Mounts the EN / FR switch in the nav, or floats it when a page has
 *      no nav.
 *   6. Tells the API which language to answer in, through X-QB-Lang on
 *      same-origin /api/ calls.
 *
 * English is untouched: with lang=en on an English page no dictionary
 * loads, no token changes, and the contrast pass never runs.
 *
 * Audit: tests/i18n/i18n-audit.mjs sets window.__QB_I18N_AUDIT before load
 * and reads QBI18N.misses() to list painted text with no dictionary entry.
 */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  if (W.QBI18N) return;

  var LANGS = ['en', 'fr'];
  var STORE = 'qb_lang';
  var script = D.currentScript;
  var BASE = script && script.src ? script.src.replace(/qb-i18n\.js(\?.*)?$/, '') : '/js/';
  var SOURCE = (R.getAttribute('lang') || 'en').slice(0, 2).toLowerCase();
  if (LANGS.indexOf(SOURCE) < 0) SOURCE = 'en';
  var PAGE = (script && script.getAttribute('data-page')) || (function () {
    var p = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
    return (p || 'index').replace(/\//g, '-');
  })();
  var AUDIT = !!W.__QB_I18N_AUDIT || /[?&]i18n-audit=1\b/.test(location.search);

  /* ── Language choice ─────────────────────────────────────────────── */
  function readSaved() {
    var m = /(?:^|;\s*)qb_lang=(en|fr)\b/.exec(D.cookie || '');
    if (m) return m[1];
    try { var v = localStorage.getItem(STORE); if (LANGS.indexOf(v) > -1) return v; } catch (e) {}
    return null;
  }
  function save(l) {
    try { localStorage.setItem(STORE, l); } catch (e) {}
    // The marketing site and the app live on sibling hosts, so the choice
    // rides a parent-domain cookie. Anywhere else it stays host-only.
    var dom = /(^|\.)quantumbranding\.ai$/.test(location.hostname) ? '; domain=.quantumbranding.ai' : '';
    D.cookie = 'qb_lang=' + l + '; path=/; max-age=31536000; SameSite=Lax' + dom;
  }
  function pick() {
    var q = /[?&]lang=(en|fr)\b/i.exec(location.search);
    if (q) { var l = q[1].toLowerCase(); save(l); return l; }
    var s = readSaved();
    if (s) return s;
    return (navigator.language || '').slice(0, 2).toLowerCase() === 'fr' ? 'fr' : 'en';
  }
  var lang = pick();

  /* ── Dictionaries ────────────────────────────────────────────────── */
  var dicts = {};          // lang -> { exact: Map, patterns: [], ctx: Map }
  var loaded = {};         // lang -> true once its files were requested
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function dictFor(l) { return dicts[l] || (dicts[l] = { exact: new Map(), patterns: [], ctx: new Map() }); }

  function add(l, entries) {
    var d = dictFor(l);
    Object.keys(entries || {}).forEach(function (k) {
      var key = norm(k), val = entries[k];
      if (!key) return;
      // true (or the key itself) marks a string that stays as written:
      // a proper noun, a unit, a code. It counts as covered in the audit.
      if (val === true || val === 1 || val == null) val = key.split(' @@ ')[0];
      // "Start @@ .final-cta h2" translates "Start" only inside that
      // selector. For a short fragment that needs two renderings on a page.
      var at = key.indexOf(' @@ ');
      if (at > -1) {
        var text = norm(key.slice(0, at)), sel = key.slice(at + 4).trim();
        if (!d.ctx.has(text)) d.ctx.set(text, []);
        d.ctx.get(text).push({ sel: sel, out: String(val) });
        return;
      }
      if (/\{\d+\}/.test(key)) {
        var src = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\d+)\}/g, '(.+?)');
        var order = [];
        key.replace(/\{(\d+)\}/g, function (_, n) { order.push(+n); return _; });
        d.patterns.push({ re: new RegExp('^' + src + '$'), out: String(val), order: order });
      } else {
        d.exact.set(key, String(val));
      }
    });
    d.upper = null;
    if (l === lang) schedulePass();
  }

  function active() { return lang !== SOURCE; }

  // Returns the translation, or null when the dictionary has no entry.
  function lookup(text, el) {
    var d = dicts[lang];
    if (!d) return null;
    var n = norm(text);
    if (!n) return null;
    var hit = null, scoped = el && d.ctx.get(n);
    if (scoped) {
      for (var c = 0; c < scoped.length && hit == null; c++) {
        try { if (el.closest(scoped[c].sel)) hit = scoped[c].out; } catch (e) {}
      }
    }
    if (hit == null) hit = d.exact.get(n);
    if (hit == null) {
      for (var i = 0; i < d.patterns.length && hit == null; i++) {
        var p = d.patterns[i], m = p.re.exec(n);
        if (!m) continue;
        var caps = {};
        p.order.forEach(function (num, idx) { caps[num] = m[idx + 1]; });
        hit = p.out.replace(/\{(\d+)\}/g, function (_, num) {
          var c = caps[num];
          if (c == null) return '';
          var inner = d.exact.get(norm(c));
          return inner == null ? c : inner;
        });
      }
    }
    if (hit == null) return null;
    var s = String(text);
    return /^\s*/.exec(s)[0] + hit + /\s*$/.exec(s)[0];
  }
  function t(text) {
    if (!active()) return text;
    var r = lookup(text);
    return r == null ? text : r;
  }

  /* ── DOM translation ─────────────────────────────────────────────── */
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  // A textarea's text is what the founder typed. Its placeholder is ours.
  var TYPED_TAGS = { TEXTAREA: 1 };
  var SKIP_SEL = '[data-i18n-skip],[translate="no"],.notranslate,[contenteditable="true"]';
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-label', 'data-tooltip', 'data-tip'];
  var META_SEL = 'meta[name="description"],meta[property="og:title"],meta[property="og:description"],' +
    'meta[property="og:image:alt"],meta[name="twitter:title"],meta[name="twitter:description"],meta[name="twitter:image:alt"]';
  var textRec = new WeakMap();   // text node -> { src, out }
  var attrRec = new WeakMap();   // element   -> { attr: { src, out } }
  var missed = new Map();        // normalised text -> where it was seen
  var LETTERS = /[A-Za-zÀ-ɏ]{2,}/;

  function skipped(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS[el.tagName]) return true;
    return !!(el.closest && el.closest(SKIP_SEL));
  }
  function where(el) {
    var bits = [];
    for (var n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
      var cls = typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).join('.') : '';
      bits.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + cls);
    }
    return bits.join(' > ');
  }
  function miss(text, el, kind) {
    if (!AUDIT) return;
    var n = norm(text);
    if (!n || !LETTERS.test(n) || missed.has(n)) return;
    missed.set(n, (kind ? kind + ' @ ' : '') + where(el));
  }

  function doText(node) {
    var parent = node.parentNode;
    if (!parent || (parent.nodeType === 1 && (skipped(parent) || TYPED_TAGS[parent.tagName]))) return;
    var rec = textRec.get(node), cur = node.data;
    if (rec && cur === rec.out) {
      if (!active()) { node.data = rec.src; textRec.delete(node); }
      else {
        // Dictionary may have grown since this node was translated.
        var again = lookup(rec.src, parent.nodeType === 1 ? parent : null);
        if (again != null && again !== rec.out) { rec.out = again; node.data = again; }
      }
      return;
    }
    if (rec) textRec.delete(node);
    if (!active()) return;
    var out = lookup(cur, parent.nodeType === 1 ? parent : null);
    if (out == null) { miss(cur, parent, ''); return; }
    if (out !== cur) { textRec.set(node, { src: cur, out: out }); node.data = out; }
  }

  function doAttr(el, name) {
    if (skipped(el)) return;
    var cur = el.getAttribute(name);
    var recs = attrRec.get(el), rec = recs && recs[name];
    if (rec && cur === rec.out) {
      if (!active()) { el.setAttribute(name, rec.src); delete recs[name]; }
      return;
    }
    if (rec) delete recs[name];
    if (!active() || cur == null || !cur.trim()) return;
    var out = lookup(cur, el);
    if (out == null) { miss(cur, el, name); return; }
    if (out !== cur) {
      if (!recs) { recs = {}; attrRec.set(el, recs); }
      recs[name] = { src: cur, out: out };
      el.setAttribute(name, out);
    }
  }

  // value is copy only on a button input; on any other field it is what
  // the founder typed, and it is never read or changed. content is copy
  // only on the description and share tags.
  function eligible(el, name) {
    if (name === 'value') return el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type);
    if (name === 'content') return el.tagName === 'META' && el.matches(META_SEL);
    return ATTRS.indexOf(name) > -1;
  }
  function doElement(el) {
    for (var i = 0; i < ATTRS.length; i++) if (el.hasAttribute(ATTRS[i])) doAttr(el, ATTRS[i]);
    if (el.hasAttribute('value') && eligible(el, 'value')) doAttr(el, 'value');
    if (el.tagName === 'META' && eligible(el, 'content')) doAttr(el, 'content');
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) { if (skipped(root)) return; doElement(root); }
    var tw = D.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && (SKIP_TAGS[n.tagName] || (n.matches && n.matches(SKIP_SEL)))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doElement(n); }
  }

  var passQueued = false;
  function schedulePass() {
    if (passQueued) return;
    passQueued = true;
    Promise.resolve().then(function () { passQueued = false; walk(R); scheduleGuard(); });
  }

  var mo = new MutationObserver(function (list) {
    var touched = false;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'characterData') { doText(m.target); touched = true; }
      else if (m.type === 'attributes') {
        // A class change is a state change: selected, open, active. The
        // colours may have moved, so the contrast pass runs again.
        if (m.attributeName === 'class') touched = true;
        else if (eligible(m.target, m.attributeName)) doAttr(m.target, m.attributeName);
      }
      else {
        for (var j = 0; j < m.addedNodes.length; j++) { walk(m.addedNodes[j]); touched = true; }
      }
    }
    if (touched) { scheduleGuard(); ensureSwitch(); }
  });
  mo.observe(R, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ATTRS.concat(['value', 'content', 'class'])
  });

  /* ── Dictionary loading ──────────────────────────────────────────── */
  // common.js: chassis and names. shared.js: strings the shared scripts
  // (js/*.js, qb-*.js) put on screen. Then the page's own file, last, so it
  // can override either.
  function dictUrl(l, slug) { return BASE + 'i18n/' + l + '/' + slug + '.js'; }
  function urls(l) { return [dictUrl(l, 'common'), dictUrl(l, 'shared'), dictUrl(l, PAGE)]; }
  // A dictionary can pull in another page's file: a PDF view shows the
  // labels of the tool that produced it.
  var included = {};
  function include(l, slug) {
    var id = l + '/' + slug;
    if (included[id] || slug === PAGE || slug === 'common' || slug === 'shared') return;
    included[id] = true;
    if (D.readyState === 'loading') { D.write('<script src="' + dictUrl(l, slug) + '"><\/script>'); return; }
    var s = D.createElement('script');
    s.src = dictUrl(l, slug); s.async = false;
    s.onload = function () { schedulePass(); };
    D.head.appendChild(s);
  }
  // Per-language CSS a dictionary may add, for the few places where the
  // translated copy needs a different measure. Off in every other language.
  var sheets = [];
  function addCss(l, text) {
    var el = D.createElement('style');
    el.setAttribute('data-qb-lang-css', l);
    el.textContent = text;
    el.disabled = l !== lang;
    (D.head || R).appendChild(el);
    el.disabled = l !== lang;
    sheets.push({ lang: l, el: el });
  }
  function load(l, done) {
    if (loaded[l]) { if (done) done(); return; }
    loaded[l] = true;
    var list = urls(l);
    // While the parser is still running, write the tags so the dictionaries
    // execute before <body> is parsed. Nothing paints in the wrong language.
    if (D.readyState === 'loading' && script && !script.async && !script.defer) {
      D.write(list.map(function (u) { return '<script src="' + u + '"><\/script>'; }).join(''));
      return;
    }
    var left = list.length;
    list.forEach(function (u) {
      var s = D.createElement('script');
      s.src = u; s.async = false;
      s.onload = s.onerror = function () { if (--left === 0) { schedulePass(); if (done) done(); } };
      D.head.appendChild(s);
    });
  }

  /* ── Colour reversal and switch styles ───────────────────────────── */
  var CREAM = [251, 245, 230], INK = [45, 21, 33];
  var css = [
    /* Defaults at zero specificity, for the few pages with no token block. */
    ':where(:root){--ink:#2D1521;--cream:#FBF5E6;--gold:#E0B069}',
    /* French: the pair reverses. Ink surfaces, cream type. Accents hold.
       Screen only: paper has no ink ground, and a browser that drops
       backgrounds when printing would leave cream type on white. A French
       page prints, and saves to PDF, on cream like the English one. */
    '@media screen{',
    ':root[data-lang="fr"][data-lang]{',
    'color-scheme:dark;',
    '--cream:#2D1521 !important;--bg-void:#2D1521 !important;--bg-base:#2D1521 !important;',
    '--cream-card:#3A1E2D !important;--cream-soft:#3A1E2D !important;--bg-deep:#3A1E2D !important;--bg-surface:#3A1E2D !important;',
    '--cream-warm:#4A2B3A !important;--cream-deep:#4A2B3A !important;',
    '--cream-edge:#5E3D4D !important;--cream-rose:#4E2236 !important;',
    '--white:#432435 !important;--bg-elevated:#432435 !important;--bg-overlay:#432435 !important;',
    '--cream-line:rgba(251,245,230,0.16) !important;',
    '--border-subtle:rgba(251,245,230,0.12) !important;--border-medium:rgba(251,245,230,0.20) !important;--border-strong:rgba(251,245,230,0.34) !important;',
    '--ink:#FBF5E6 !important;--text-1:#FBF5E6 !important;',
    '--ink-75:rgba(251,245,230,0.80) !important;--ink-soft:rgba(251,245,230,0.80) !important;--text-2:rgba(251,245,230,0.80) !important;',
    '--ink-50:rgba(251,245,230,0.64) !important;--ink-mute:rgba(251,245,230,0.64) !important;--text-3:rgba(251,245,230,0.64) !important;',
    '--ink-33:rgba(251,245,230,0.40) !important;--ink-faint:rgba(251,245,230,0.40) !important;--text-4:rgba(251,245,230,0.40) !important;',
    '--ink-25:rgba(251,245,230,0.28) !important;',
    '--aubergine:#ECDDB8 !important;--scrim:rgba(45,21,33,0.90) !important;',
    '--rose-deep:#E79BB0 !important;--gold-deep:#EBC88F !important;--teal-deep:#9ED3DC !important;',
    '}',
    /* Illustrations keep the surface they were drawn for. */
    ':root[data-lang="fr"] .qb-illus-card{--cream-card:#F2EBD3 !important;--ink:#2D1521 !important;--white:#FFFEF8 !important}',
    /* Set by the contrast pass below. */
    ':root[data-lang="fr"] [data-qb-fix="c"]{color:#FBF5E6 !important}',
    ':root[data-lang="fr"] [data-qb-fix="i"]{color:#2D1521 !important}',
    ':root[data-lang="fr"] img[data-qb-mark]{content:url("/img/brand/mark-reverse.svg")}',
    '}',
    /* The switch. The pressed side is the reversed pair, so the control
       shows what it does. */
    '.qb-lang{display:inline-flex;align-items:stretch;flex:none;border:1.5px solid var(--ink);border-radius:999px;overflow:hidden;',
    'background:var(--cream);font-family:var(--font-mono,var(--f-mono,ui-monospace,monospace));font-size:var(--step--2,0.8125rem);line-height:1}',
    '.qb-lang_opt{appearance:none;-webkit-appearance:none;border:0;margin:0;padding:var(--space-3xs,0.5625rem) var(--space-2xs,0.6875rem);',
    'background:transparent;color:var(--ink);font:inherit;font-weight:600;letter-spacing:0.06em;cursor:pointer;min-height:0;text-transform:none;border-radius:0;box-shadow:none;width:auto}',
    '.qb-lang_opt[aria-pressed="true"]{background:var(--ink);color:var(--cream);cursor:default}',
    '.qb-lang_opt:focus-visible{outline:2px solid var(--gold);outline-offset:-3px}',
    '.qb-lang.is-floating{position:fixed;z-index:2147483000;inset-inline-start:var(--space-xs,0.875rem);inset-block-end:var(--space-xs,0.875rem)}',
    '.mobile-menu_foot .qb-lang{align-self:flex-start;margin-block-end:var(--space-xs,0.875rem)}',
    /* Under 1000px the nav pill has no room to spare, so the switch leaves
       it and floats. The nav itself is laid out exactly as before. */
    '@media (max-width:999.98px){.nav-actions .qb-lang{display:none}}',
    '@media (min-width:1000px){.qb-lang.is-floating.has-nav{display:none}}',
    '@media print{.qb-lang{display:none !important}}'
  ].join('');
  var styleEl = D.createElement('style');
  styleEl.id = 'qb-i18n-css';
  styleEl.textContent = css;
  (D.head || R).appendChild(styleEl);

  /* ── Contrast pass (French only) ─────────────────────────────────────
     Tokens reverse cleanly. Two cases do not: text set in ink on an accent
     fill (a gold button), and colours written as literals. After the swap
     either can land light on light or dark on dark. This pass finds text
     whose contrast against its real background fell under 2.5:1 and sets
     it to whichever of ink or cream reads. Faint decorative type (alpha
     under 0.5) is left alone on purpose. */
  function parse(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    var p = m[1].split(/[,\s\/]+/).filter(Boolean).map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function over(top, base) {
    var a = top[3];
    return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1];
  }
  function lum(c) {
    var v = [c[0], c[1], c[2]].map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // Real background behind an element. null when an image or gradient sits
  // in the stack, because then the colour underneath cannot be known.
  function backdrop(el, cache) {
    var stack = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (cache.has(n)) { stack.push(cache.get(n)); break; }
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { stack.push(null); break; }
      var bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0) { stack.push(bg); if (bg[3] >= 0.999) break; }
    }
    var base = [45, 21, 33, 1];
    for (var i = stack.length - 1; i >= 0; i--) {
      if (stack[i] === null) { cache.set(el, null); return null; }
      base = over(stack[i], base);
    }
    cache.set(el, base);
    return base;
  }
  function unfix() {
    var els = D.querySelectorAll('[data-qb-fix],[data-qb-mark]');
    for (var i = 0; i < els.length; i++) { els[i].removeAttribute('data-qb-fix'); els[i].removeAttribute('data-qb-mark'); }
  }
  var FIX = { c: CREAM, i: INK };
  function guard() {
    if (lang !== 'fr' || !D.body) return;
    var cache = new Map();
    var tw = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT, null);
    var seen = new Set(), n;
    while ((n = tw.nextNode())) {
      var el = n.parentElement;
      if (!el || seen.has(el) || !n.data.trim() || SKIP_TAGS[el.tagName]) continue;
      seen.add(el);
      if (el.closest && el.closest('.qb-lang')) continue;
      var bg = backdrop(el, cache);
      if (!bg) continue;
      // A fix made earlier stands while it still reads. A button that
      // changed state since then gets judged again from its own colour.
      var had = el.getAttribute('data-qb-fix');
      if (had) {
        if (FIX[had] && ratio(FIX[had], bg) >= 2.5) continue;
        el.removeAttribute('data-qb-fix');
      }
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      var fg = parse(cs.color);
      if (!fg || fg[3] < 0.5) continue;
      if (ratio(over(fg, bg), bg) >= 2.5) continue;
      el.setAttribute('data-qb-fix', ratio(CREAM, bg) >= ratio(INK, bg) ? 'c' : 'i');
    }
    // The ink mark disappears on ink. The reverse mark is drawn for it.
    var marks = D.querySelectorAll('img[src*="mark-ink.svg"]');
    for (var i = 0; i < marks.length; i++) {
      var b = backdrop(marks[i], cache);
      if (b && lum(b) < 0.2) marks[i].setAttribute('data-qb-mark', ''); else marks[i].removeAttribute('data-qb-mark');
    }
  }
  var guardTimer = 0;
  function scheduleGuard() {
    if (lang !== 'fr' || guardTimer) return;
    guardTimer = setTimeout(function () { guardTimer = 0; guard(); }, 80);
  }

  /* ── The switch ──────────────────────────────────────────────────── */
  var LABEL = { en: 'Language', fr: 'Langue' };
  function buildSwitch(extra) {
    var box = D.createElement('div');
    box.className = 'qb-lang' + (extra ? ' ' + extra : '');
    box.setAttribute('role', 'group');
    box.setAttribute('data-i18n-skip', '');
    LANGS.forEach(function (l) {
      var b = D.createElement('button');
      b.type = 'button';
      b.className = 'qb-lang_opt';
      b.setAttribute('data-lang-set', l);
      b.setAttribute('lang', l);
      b.textContent = l.toUpperCase();
      b.addEventListener('click', function () { setLang(l); });
      box.appendChild(b);
    });
    paintSwitch(box);
    return box;
  }
  function paintSwitch(box) {
    box.setAttribute('aria-label', LABEL[lang]);
    var opts = box.querySelectorAll('.qb-lang_opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].setAttribute('aria-pressed', opts[i].getAttribute('data-lang-set') === lang ? 'true' : 'false');
    }
  }
  var mountQueued = false;
  function mountSwitch() {
    mountQueued = false;
    if (!D.body) return;
    var actions = D.querySelector('.nav-actions');
    var foot = D.querySelector('.mobile-menu_foot');
    if (actions && !actions.querySelector('.qb-lang')) actions.insertBefore(buildSwitch(), actions.firstChild);
    if (foot && !foot.querySelector('.qb-lang')) foot.insertBefore(buildSwitch(), foot.firstChild);
    var floating = D.querySelector('.qb-lang.is-floating');
    if (!floating) { floating = buildSwitch('is-floating'); D.body.appendChild(floating); }
    floating.classList.toggle('has-nav', !!actions);
  }
  // A page that renders its nav late, or re-renders it, gets the switch back.
  function ensureSwitch() {
    if (mountQueued || !D.body) return;
    var actions = D.querySelector('.nav-actions');
    var floating = D.querySelector('.qb-lang.is-floating');
    if (floating && floating.classList.contains('has-nav') === !!actions && (!actions || actions.querySelector('.qb-lang'))) return;
    mountQueued = true;
    setTimeout(mountSwitch, 0);
  }

  /* ── Applying a language ─────────────────────────────────────────── */
  function meta() {
    R.setAttribute('lang', lang);
    R.setAttribute('data-lang', lang);
    var tc = D.querySelector('meta[name="theme-color"]');
    if (tc) {
      if (!tc.hasAttribute('data-src')) tc.setAttribute('data-src', tc.getAttribute('content') || '');
      tc.setAttribute('content', lang === 'fr' ? '#FBF5E6' : tc.getAttribute('data-src'));
    }
    var loc = D.querySelector('meta[property="og:locale"]');
    if (loc) loc.setAttribute('content', lang === 'fr' ? 'fr_FR' : 'en_US');
    // Search engines: each language has its own address (?lang=fr), the
    // translated view is canonical to itself, and both point at each other.
    var canon = D.querySelector('link[rel="canonical"]');
    if (canon && D.head) {
      if (!canon.hasAttribute('data-src')) canon.setAttribute('data-src', canon.getAttribute('href') || '');
      var base = canon.getAttribute('data-src');
      var urlFor = function (l) { return l === SOURCE ? base : base + (base.indexOf('?') > -1 ? '&' : '?') + 'lang=' + l; };
      canon.setAttribute('href', urlFor(lang));
      LANGS.concat(['x-default']).forEach(function (l) {
        var el = D.head.querySelector('link[rel="alternate"][hreflang="' + l + '"]');
        if (!el) {
          el = D.createElement('link');
          el.setAttribute('rel', 'alternate');
          el.setAttribute('hreflang', l);
          D.head.appendChild(el);
        }
        el.setAttribute('href', l === 'x-default' ? base : urlFor(l));
      });
    }
  }
  function apply() {
    meta();
    var boxes = D.querySelectorAll('.qb-lang');
    for (var i = 0; i < boxes.length; i++) paintSwitch(boxes[i]);
    for (var k = 0; k < sheets.length; k++) sheets[k].el.disabled = sheets[k].lang !== lang;
    if (lang !== 'fr') unfix();
    if (active()) load(lang, function () { walk(R); scheduleGuard(); });
    walk(R);
    scheduleGuard();
    try { W.dispatchEvent(new CustomEvent('qb:lang', { detail: { lang: lang } })); } catch (e) {}
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0 || l === lang) return;
    lang = l;
    save(l);
    api.lang = l;
    apply();
  }

  /* ── Text that never reaches the DOM ─────────────────────────────── */
  ['alert', 'confirm', 'prompt'].forEach(function (name) {
    var orig = W[name];
    if (typeof orig !== 'function') return;
    W[name] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof msg === 'string') args[0] = t(msg);
      return orig.apply(W, args);
    };
  });
  if (W.CanvasRenderingContext2D) {
    ['fillText', 'strokeText', 'measureText'].forEach(function (name) {
      var orig = CanvasRenderingContext2D.prototype[name];
      if (!orig) return;
      CanvasRenderingContext2D.prototype[name] = function (text) {
        var args = Array.prototype.slice.call(arguments);
        if (typeof text === 'string') args[0] = t(text);
        return orig.apply(this, args);
      };
    });
  }

  /* ── Text that leaves the page ───────────────────────────────────────
     A downloaded .txt or .md pack and a "copy" button build their text
     from the same English labels the page shows, but never through the
     DOM. They are translated here, line by line: the whole line first
     (exact or pattern key), then a line that is "Label: value" or a
     marked-up heading, by its label. A line with no entry is left exactly
     as it was, so the founder's words and the model's are never touched. */
  function upperLookup(n) {
    var d = dicts[lang];
    if (!d || n !== n.toUpperCase() || !LETTERS.test(n)) return null;
    if (!d.upper) {
      d.upper = new Map();
      d.exact.forEach(function (v, k) { var u = k.toUpperCase(); if (!d.upper.has(u)) d.upper.set(u, v.toUpperCase()); });
    }
    var hit = d.upper.get(n);
    return hit == null ? null : hit;
  }
  function label(text) {
    var hit = lookup(text);
    if (hit != null) return hit;
    var n = norm(text);
    hit = upperLookup(n);
    return hit == null ? null : /^\s*/.exec(text)[0] + hit + /\s*$/.exec(text)[0];
  }
  function tLine(line) {
    if (!line.trim()) return line;
    var whole = label(line);
    if (whole != null) return whole;
    var m = /^(\s*(?:#{1,6}\s+|[-*+\u2022]\s+|\d+[.)]\s+|>\s+)?)(\*\*|__)?([\s\S]*?)\s*$/.exec(line);
    var pre = m[1], mark = m[2] || '', rest = m[3];
    if (/^\s*\|.*\|\s*$/.test(line) && !/^\s*\|[\s|:-]+\|\s*$/.test(line)) {   // | a | table | row |
      return line.split('|').map(function (cell) { return cell.trim() ? (label(cell) || cell) : cell; }).join('|');
    }
    if (pre && !mark) {                                        // ## Heading, - item
      var head = label(rest);
      if (head != null) return pre + head;
    }
    if (mark && rest.slice(-mark.length) === mark) {          // **Heading**
      var inner = label(rest.slice(0, -mark.length));
      if (inner != null) return pre + mark + inner + mark;
    }
    var colon = rest.indexOf(':');
    if (colon > 0 && colon <= 60) {                            // Label: value
      var name = rest.slice(0, colon), after = rest.slice(colon + 1);
      var closing = '';
      if (mark && name.slice(-mark.length) === mark) { name = name.slice(0, -mark.length); closing = mark; }
      else if (mark && after.slice(0, mark.length) === mark) { after = after.slice(mark.length); closing = mark; }
      var tName = label(name);
      if (tName != null) {
        var tAfter = after.trim() ? (label(after) || after) : after;
        return pre + mark + tName + (lang === 'fr' ? '\u00a0:' : ':') + closing + tAfter;
      }
    }
    if (!mark) return line;
    var plain = label(rest);
    return plain == null ? line : pre + mark + plain;
  }
  function tText(text) {
    if (!active() || typeof text !== 'string' || !text) return text;
    return text.split('\n').map(tLine).join('\n');
  }
  if (W.Blob) {
    var NativeBlob = W.Blob;
    var TextBlob = function (parts, options) {
      try {
        var type = (options && options.type) || '';
        if (active() && /^text\/(plain|markdown)\b/.test(type) && Array.isArray(parts)) {
          parts = parts.map(function (part) { return typeof part === 'string' ? tText(part) : part; });
        }
      } catch (e) {}
      return arguments.length ? new NativeBlob(parts, options) : new NativeBlob();
    };
    TextBlob.prototype = NativeBlob.prototype;
    W.Blob = TextBlob;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      var nativeWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = function (text) { return nativeWrite(tText(text)); };
    }
  } catch (e) {}

  /* ── Dates and numbers ───────────────────────────────────────────────
     Scripts format with toLocaleDateString(undefined, ...), which follows
     the browser, not the switch: an English browser reading French would
     get "Actif depuis le October 3, 2026". When the page is in French and
     the caller named no locale, French is used. A caller that names one
     keeps it, and English is left to the browser as before. */
  [[Date.prototype, ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']],
   [Number.prototype, ['toLocaleString']]].forEach(function (pair) {
    pair[1].forEach(function (name) {
      var orig = pair[0][name];
      if (typeof orig !== 'function') return;
      pair[0][name] = function (locales) {
        if (lang === 'fr' && (locales === undefined || locales === null || (Array.isArray(locales) && !locales.length))) {
          var args = Array.prototype.slice.call(arguments);
          args[0] = 'fr-FR';
          return orig.apply(this, args);
        }
        return orig.apply(this, arguments);
      };
    });
  });

  /* ── Language header on same-origin API calls ────────────────────────
     The server reads X-QB-Lang to pick the language a model answers in,
     the email template, and the checkout locale. Same origin only: a
     custom header on a cross-origin call would force a preflight the
     other host has not agreed to. */
  // Two tools call the model straight from the browser with the founder's
  // own key, so no server sees X-QB-Lang. For those calls the directive is
  // appended here. It is the same text as agents/lang.js, and
  // tests/i18n/server-lang.mjs fails if the two drift apart.
  var DIRECTIVE = {
    fr: [
      'LANGUAGE OF THE OUTPUT.',
      'The reader is French-speaking. Write every piece of prose the reader will see in French, addressing the reader as "vous". This overrides any earlier instruction about the language of the output, and nothing else.',
      'Keep exactly as specified: JSON keys and field names, and every value the instructions restrict to a fixed list or format (ids, slugs, enum values, hex colours, dates, URLs, numbers).',
      'Return exactly as spelled, in English, every label the instructions spell out literally: verdicts, statuses, ratings, category names, section headings and line prefixes such as "POST 1:" or "Caption:". The interface matches them and shows them in French itself.',
      'Keep proper nouns as written: BrandOS, Quantum Branding, The Collapse, the movement names Observe, Collapse, Build and Hold, tool names, archetype names, and the founder\'s own brand, product and people names.',
      'Quote the founder\'s own words in the language they were written in.',
      'The voice rules above hold in French: short sentences, sentence case, no em dash, no exclamation points. Use the typographic apostrophe and French punctuation spacing.'
    ].join('\n')
  };
  if (typeof W.fetch === 'function') {
    var nativeFetch = W.fetch;
    W.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var u = new URL(url, location.href);
        if (u.origin === location.origin && u.pathname.indexOf('/api/') === 0) {
          init = init || {};
          var h = new Headers(init.headers || (typeof input !== 'string' && input && input.headers) || {});
          if (!h.has('X-QB-Lang')) h.set('X-QB-Lang', lang);
          init.headers = h;
        } else if (u.hostname === 'api.anthropic.com' && DIRECTIVE[lang] && init && typeof init.body === 'string') {
          var body = JSON.parse(init.body);
          if (body && Array.isArray(body.messages)) {
            if (typeof body.system === 'string' || body.system == null) {
              body.system = body.system ? body.system + '\n\n' + DIRECTIVE[lang] : DIRECTIVE[lang];
            } else if (Array.isArray(body.system)) {
              body.system = body.system.concat([{ type: 'text', text: DIRECTIVE[lang] }]);
            }
            init = Object.assign({}, init, { body: JSON.stringify(body) });
          }
        }
      } catch (e) {}
      return nativeFetch.call(W, input, init);
    };
  }

  // A print or export view opened in a blank window is written by the page
  // and carries no runtime. Its text is translated from here, a few times
  // over the first seconds, as the page finishes writing it.
  if (typeof W.open === 'function') {
    var nativeOpen = W.open;
    W.open = function () {
      var win = nativeOpen.apply(W, arguments);
      if (win && active()) {
        [0, 120, 400, 1000, 2500].forEach(function (ms) {
          setTimeout(function () {
            try { if (win.document && win.document.documentElement) { win.document.documentElement.setAttribute('lang', lang); walk(win.document.documentElement); } } catch (e) {}
          }, ms);
        });
      }
      return win;
    };
  }

  /* ── Public surface ──────────────────────────────────────────────── */
  var api = W.QBI18N = {
    lang: lang,
    source: SOURCE,
    page: PAGE,
    langs: LANGS.slice(),
    add: add,
    include: include,
    css: addCss,
    t: t,
    text: tText,
    set: setLang,
    refresh: function () { walk(R); guard(); },
    misses: function () {
      var out = [];
      missed.forEach(function (at, text) { out.push({ text: text, at: at }); });
      return out;
    }
  };

  /* ── Boot ────────────────────────────────────────────────────────── */
  meta();
  if (active()) load(lang);
  function ready() { meta(); mountSwitch(); walk(R); scheduleGuard(); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', ready); else ready();
  W.addEventListener('load', function () { walk(R); scheduleGuard(); });
})();
