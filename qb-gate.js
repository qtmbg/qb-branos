/* ────────────────────────────────────────────────────────────────────────────
   QB GATE — Soft email-capture modal shown post-synthesis on Phase 01 tools.
              Also used as the login modal on the hub.
   Requires qb-cloud.js to be loaded first.
   Public API:
     QB.openGate({
       toolId,          // e.g. 'soul-map' — also 'hub-login' for login mode
       toolName,        // 'Brand Soul Map' / 'Welcome back'
       brandName?,      // pulled from QBP if available — used in copy
       onClose?         // callback(opts) where opts = { skipped, alreadyAuthed }
     })
   ──────────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';
  if (!window.QB) {
    console.error('qb-gate.js requires qb-cloud.js');
    return;
  }

  let opened = false;

  function injectStyles(){
    if (document.getElementById('qb-gate-styles')) return;
    // v3.4 SOT: cream + ink + gold + rose-deep. 2px ink border, hard offset shadow,
    // Fraunces chunky title, Inter body, JetBrains Mono labels. Reads ecosystem
    // tokens from :root with safe fallbacks for pages that load this script
    // before their own design tokens settle.
    const style = document.createElement('style');
    style.id = 'qb-gate-styles';
    style.textContent = ''
      + '.qb-gate-overlay{position:fixed;inset:0;background:rgba(45,21,33,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:qbGateIn 0.3s ease-out;font-family:\'Inter\',-apple-system,BlinkMacSystemFont,sans-serif}'
      + '@keyframes qbGateIn{from{opacity:0}to{opacity:1}}'
      + '.qb-gate-card{background:var(--cream-card,#F4EBD3);border:2px solid var(--ink,#2D1521);border-radius:24px;max-width:460px;width:100%;padding:40px 32px;color:var(--ink,#2D1521);position:relative;animation:qbGateUp 0.4s cubic-bezier(0.16,1,0.3,1);box-shadow:0 12px var(--ink,#2D1521)}'
      + '@media (min-width:640px){.qb-gate-card{box-shadow:0 16px var(--ink,#2D1521)}}'
      + '@keyframes qbGateUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}'
      + '.qb-gate-label{font-family:\'JetBrains Mono\',monospace;font-size:0.72rem;letter-spacing:0.16em;color:var(--gold-deep,#A8862E);margin-bottom:18px;text-transform:uppercase;font-weight:600}'
      + '.qb-gate-title{font-family:\'Fraunces\',serif;font-variation-settings:"wght" 700,"opsz" 144,"SOFT" 100,"WONK" 1;font-size:clamp(1.6rem,3vw,2rem);font-weight:700;line-height:1.1;letter-spacing:-0.015em;margin-bottom:12px;color:var(--ink,#2D1521)}'
      + '.qb-gate-sub{font-family:\'Inter\',sans-serif;font-weight:500;font-size:0.96rem;color:var(--ink-75,rgba(45,21,33,0.75));line-height:1.55;margin-bottom:24px}'
      + '.qb-gate-row{display:flex;gap:10px;margin-bottom:12px}'
      + '.qb-gate-input{flex:1;background:var(--cream,#FBF5E6);border:2px solid var(--ink,#2D1521);border-radius:16px;padding:0.9em 1.1em;color:var(--ink,#2D1521);font-size:1.0625rem;font-family:\'Inter\',sans-serif;font-weight:500;outline:none;box-shadow:0 4px var(--ink,#2D1521);transition:transform 0.25s cubic-bezier(0.19,1,0.22,1),box-shadow 0.25s cubic-bezier(0.19,1,0.22,1),border-color 0.25s cubic-bezier(0.19,1,0.22,1);-webkit-appearance:none}'
      + '.qb-gate-input:focus{transform:translateY(-2px);box-shadow:0 6px var(--ink,#2D1521);border-color:var(--rose-deep,#B5455A)}'
      + '.qb-gate-input::placeholder{color:var(--ink-50,rgba(45,21,33,0.5));font-weight:400}'
      + '.qb-gate-btn{width:100%;background:var(--gold,#E5C975);color:var(--ink,#2D1521);border:2px solid var(--ink,#2D1521);border-radius:9999px;padding:0.9em 1.5em;font-size:1rem;font-weight:600;font-family:\'Inter\',sans-serif;cursor:pointer;margin-top:8px;box-shadow:0 4px var(--ink,#2D1521);transition:transform 0.25s cubic-bezier(0.19,1,0.22,1),box-shadow 0.25s cubic-bezier(0.19,1,0.22,1),filter 0.25s cubic-bezier(0.19,1,0.22,1)}'
      + '.qb-gate-btn:hover:not(:disabled){transform:translateY(-3px);box-shadow:0 7px var(--ink,#2D1521);filter:brightness(1.06)}'
      + '.qb-gate-btn:active:not(:disabled){transform:translateY(2px);box-shadow:0 2px var(--ink,#2D1521);transition-duration:0.15s}'
      + '.qb-gate-btn:disabled{opacity:0.55;cursor:not-allowed}'
      + '.qb-gate-skip{display:block;text-align:center;margin-top:18px;color:var(--ink-50,rgba(45,21,33,0.5));font-size:0.88rem;text-decoration:underline;text-underline-offset:3px;cursor:pointer;background:none;border:none;width:100%;font-family:\'Inter\',sans-serif;font-weight:500}'
      + '.qb-gate-skip:hover{color:var(--ink,#2D1521)}'
      + '.qb-gate-fine{font-size:0.7rem;color:var(--ink-50,rgba(45,21,33,0.5));margin-top:18px;font-family:\'JetBrains Mono\',monospace;letter-spacing:0.06em;text-align:center;line-height:1.6}'
      + '.qb-gate-err{color:var(--rose-deep,#B5455A);font-size:0.8rem;margin-top:10px;font-family:\'JetBrains Mono\',monospace;text-align:center;font-weight:500}'
      + '.qb-gate-success{text-align:center;padding:20px 0}'
      + '.qb-gate-success-icon{font-family:\'Fraunces\',serif;font-variation-settings:"wght" 700,"opsz" 144,"SOFT" 100,"WONK" 1;font-size:2.4rem;color:var(--gold-deep,#A8862E);margin-bottom:14px}'
      + '.qb-gate-progress{display:flex;gap:6px;margin-bottom:24px}'
      + '.qb-gate-pip{flex:1;height:4px;background:var(--cream-edge,#E5DCC5);border-radius:9999px;overflow:hidden;transition:background-color .25s ease}'
      + '.qb-gate-pip.done{background:var(--gold-deep,#A8862E)}'
      + '.qb-gate-context{font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--ink-75,rgba(45,21,33,0.75));letter-spacing:0.14em;text-transform:uppercase;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px}'
      + '.qb-gate-context-dot{width:8px;height:8px;border-radius:9999px;background:var(--rose-deep,#B5455A);box-shadow:0 0 0 3px var(--cream-rose,#F2E0DA);animation:qbPulse 2.4s ease-in-out infinite}'
      + '@keyframes qbPulse{0%,100%{transform:scale(1)}50%{transform:scale(0.85)}}'
      + '@media (prefers-reduced-motion: reduce){.qb-gate-overlay,.qb-gate-card{animation:none}.qb-gate-context-dot{animation:none}.qb-gate-input,.qb-gate-btn{transition:none}}';
    document.head.appendChild(style);
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function remainingTools(currentToolId){
    const remaining = QB.PHASE_01_TOOLS
      .filter(t => t !== currentToolId)
      .map(t => QB.TOOL_NAMES[t]);
    if (remaining.length === 0) return 'every Phase 02+ tool';
    if (remaining.length === 1) return remaining[0];
    if (remaining.length === 2) return remaining.join(' and ');
    return remaining.slice(0, -1).join(', ') + ', and ' + remaining[remaining.length - 1];
  }

  function buildSaveModal(opts){
    const { toolId, toolName, brandName } = opts;
    const progressNow = QB.phase01Progress();
    // Pip count includes the just-completed tool, capped at total
    const pipsLit = Math.min(progressNow.completed + 1, progressNow.total);
    const titleText = brandName
      ? "Save " + escapeHtml(brandName) + "'s Profile"
      : 'Your result is ready.';
    const subText = brandName
      ? "One click and your work is saved. " + escapeHtml(remainingTools(toolId)) + " build directly on it — no re-entering anything."
      : "One click and your result is saved. The next tools build on it — no re-entering anything.";

    const overlay = document.createElement('div');
    overlay.className = 'qb-gate-overlay';
    overlay.innerHTML = ''
      + '<div class="qb-gate-card" role="dialog" aria-modal="true" aria-labelledby="qb-gate-title">'
        + '<div class="qb-gate-context">'
          + '<span class="qb-gate-context-dot"></span>'
          + escapeHtml((toolName || '').toUpperCase()) + ' · COMPLETE'
        + '</div>'
        + '<div class="qb-gate-progress" aria-label="Phase 01 progress">'
          + Array.from({ length: progressNow.total }, function(_, i){
              return '<div class="qb-gate-pip ' + (i < pipsLit ? 'done' : '') + '"></div>';
            }).join('')
        + '</div>'
        + '<div class="qb-gate-label">Save your Brand Profile</div>'
        + '<h2 id="qb-gate-title" class="qb-gate-title">' + titleText + '</h2>'
        + '<p class="qb-gate-sub">' + subText + '</p>'
        + '<div class="qb-gate-row">'
          + '<input class="qb-gate-input" type="text" id="qb-gate-fname" placeholder="First name" autocomplete="given-name">'
        + '</div>'
        + '<div class="qb-gate-row">'
          + '<input class="qb-gate-input" type="email" id="qb-gate-email" placeholder="your@email.com" autocomplete="email">'
        + '</div>'
        + '<button class="qb-gate-btn" id="qb-gate-submit">Save my Brand Profile →</button>'
        + '<div class="qb-gate-err" id="qb-gate-err" style="display:none"></div>'
        + '<button class="qb-gate-skip" id="qb-gate-skip">Maybe later — just show me the result</button>'
        + '<div class="qb-gate-fine">No password. Magic link. Always free. Never spam.</div>'
      + '</div>';
    return overlay;
  }

  function buildLoginModal(){
    const overlay = document.createElement('div');
    overlay.className = 'qb-gate-overlay';
    overlay.innerHTML = ''
      + '<div class="qb-gate-card" role="dialog" aria-modal="true" aria-labelledby="qb-gate-title">'
        + '<div class="qb-gate-label">Welcome back</div>'
        + '<h2 id="qb-gate-title" class="qb-gate-title">Log in to your Brand Profile</h2>'
        + '<p class="qb-gate-sub">Enter your email and we\'ll send a magic link. No password needed.</p>'
        + '<div class="qb-gate-row">'
          + '<input class="qb-gate-input" type="text" id="qb-gate-fname" placeholder="First name" autocomplete="given-name">'
        + '</div>'
        + '<div class="qb-gate-row">'
          + '<input class="qb-gate-input" type="email" id="qb-gate-email" placeholder="your@email.com" autocomplete="email">'
        + '</div>'
        + '<button class="qb-gate-btn" id="qb-gate-submit">Send magic link →</button>'
        + '<div class="qb-gate-err" id="qb-gate-err" style="display:none"></div>'
        + '<button class="qb-gate-skip" id="qb-gate-skip">Cancel</button>'
        + '<div class="qb-gate-fine">No password. Magic link. Always free.</div>'
      + '</div>';
    return overlay;
  }

  function buildSuccess(email){
    const overlay = document.createElement('div');
    overlay.className = 'qb-gate-overlay';
    overlay.innerHTML = ''
      + '<div class="qb-gate-card">'
        + '<div class="qb-gate-success">'
          + '<div class="qb-gate-success-icon">✦</div>'
          + '<div class="qb-gate-label">Check your inbox</div>'
          + '<h2 class="qb-gate-title">Magic link sent to ' + escapeHtml(email) + '</h2>'
          + '<p class="qb-gate-sub">Click the link to save your profile. We\'ll bring you right back to your result. Takes about 10 seconds.</p>'
          + '<button class="qb-gate-skip" id="qb-gate-success-close">Continue without saving</button>'
          + '<div class="qb-gate-fine">If you don\'t see it within a minute, check spam. The link expires in 60 minutes.</div>'
        + '</div>'
      + '</div>';
    return overlay;
  }

  function close(overlay){
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 200);
  }

  function openGate(opts){
    if (!opts || !opts.toolId) return;
    if (opened) return;

    const isLogin = opts.toolId === 'hub-login';

    // If already authed, no gate. Record completion, silently fire the
    // results email using the stashed identity (no second modal), invoke
    // onClose. The send-results call is fire-and-forget so a Resend
    // hiccup never blocks the user from moving on to the next tool.
    if (QB.isAuthed() && !isLogin) {
      QB.recordCompletion(opts.toolId);
      try {
        const session   = QB.getSession && QB.getSession();
        const email     = session && session.email;
        const firstName = localStorage.getItem('qb_first_name') || '';
        if (email && opts.toolId) {
          const qbp = JSON.parse(localStorage.getItem('qb_qbp') || '{}');
          fetch('/api/send-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName, email,
              toolId: opts.toolId,
              qbp,
              results: opts.results || {}
            })
          }).catch(() => {});
        }
      } catch (e) { /* silent */ }
      if (opts.onClose) opts.onClose({ skipped:false, alreadyAuthed:true });
      return;
    }

    opened = true;
    injectStyles();
    const overlay = isLogin ? buildLoginModal() : buildSaveModal(opts);
    document.body.appendChild(overlay);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const cleanup = (skipped) => {
      document.body.style.overflow = prevOverflow || '';
      opened = false;
      if (opts.onClose) opts.onClose({ skipped: !!skipped });
    };

    overlay.querySelector('#qb-gate-skip').addEventListener('click', () => {
      // Even if the user skips, record local completion so the journey
      // guide reflects the work they did. Login skip records nothing.
      if (!isLogin) QB.recordCompletion(opts.toolId);
      close(overlay);
      cleanup(true);
    });

    const submitBtn = overlay.querySelector('#qb-gate-submit');
    const errEl     = overlay.querySelector('#qb-gate-err');
    const fnameEl   = overlay.querySelector('#qb-gate-fname');
    const emailEl   = overlay.querySelector('#qb-gate-email');
    const showErr   = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };

    const submit = async () => {
      errEl.style.display = 'none';
      const email     = emailEl.value.trim();
      const firstName = fnameEl.value.trim();
      if (!firstName) { showErr('First name is required.'); return; }
      if (!email || !/.+@.+\..+/.test(email)) { showErr('Enter a valid email.'); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending magic link…';

      // Save mode: record local completion before the network call so a
      // network failure never loses the user's progress.
      if (!isLogin) QB.recordCompletion(opts.toolId);

      const result = await QB.sendMagicLink(email, firstName, opts.toolId);
      if (!result.ok) {
        showErr(result.error || 'Could not send. Try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Send magic link →' : 'Save my Brand Profile →';
        return;
      }

      // Fire-and-forget results email. Login flow skips it (no fresh tool output
      // to deliver). Errors stay silent so a Resend hiccup never blocks the
      // signup success state the user is about to see.
      if (!isLogin && opts.toolId) {
        try {
          const qbp = JSON.parse(localStorage.getItem('qb_qbp') || '{}');
          fetch('/api/send-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName, email,
              toolId: opts.toolId,
              qbp,
              results: opts.results || {}
            })
          }).catch(() => {});
        } catch (e) { /* silent */ }
      }

      // Replace with success state
      overlay.remove();
      const success = buildSuccess(email);
      document.body.appendChild(success);
      success.querySelector('#qb-gate-success-close').addEventListener('click', () => {
        close(success);
        cleanup(false);
      });
    };

    submitBtn.addEventListener('click', submit);
    emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    fnameEl.addEventListener('keydown', e => { if (e.key === 'Enter') emailEl.focus(); });

    // Pre-fill from any prior pending signup attempt
    try {
      const pending = JSON.parse(localStorage.getItem('qb_pending_signup') || '{}');
      if (pending.firstName) fnameEl.value = pending.firstName;
      if (pending.email)     emailEl.value = pending.email;
    } catch(e){}
    // Also pre-fill from saved first_name (returning user logging in)
    if (!fnameEl.value) {
      const stashed = localStorage.getItem('qb_first_name');
      if (stashed) fnameEl.value = stashed;
    }

    setTimeout(() => {
      (fnameEl.value ? emailEl : fnameEl).focus();
    }, 100);
  }

  QB.openGate = openGate;
})();
