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
    const style = document.createElement('style');
    style.id = 'qb-gate-styles';
    style.textContent = ''
      + '.qb-gate-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:qbGateIn 0.3s ease-out;font-family:\'Inter\',-apple-system,BlinkMacSystemFont,sans-serif}'
      + '@keyframes qbGateIn{from{opacity:0}to{opacity:1}}'
      + '.qb-gate-card{background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;max-width:440px;width:100%;padding:36px 32px;color:#fff;position:relative;animation:qbGateUp 0.4s cubic-bezier(0.16,1,0.3,1);box-shadow:0 20px 60px rgba(0,0,0,0.5)}'
      + '@keyframes qbGateUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}'
      + '.qb-gate-label{font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:0.16em;color:#4ade80;margin-bottom:18px;text-transform:uppercase}'
      + '.qb-gate-title{font-size:22px;font-weight:500;line-height:1.3;margin-bottom:12px;color:#fff}'
      + '.qb-gate-sub{font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:24px}'
      + '.qb-gate-row{display:flex;gap:10px;margin-bottom:12px}'
      + '.qb-gate-input{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:13px 14px;color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.15s;-webkit-appearance:none}'
      + '.qb-gate-input:focus{border-color:#4ade80}'
      + '.qb-gate-input::placeholder{color:rgba(255,255,255,0.35)}'
      + '.qb-gate-btn{width:100%;background:#4ade80;color:#000;border:none;border-radius:8px;padding:14px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;transition:opacity 0.15s;margin-top:8px}'
      + '.qb-gate-btn:hover{opacity:0.9}'
      + '.qb-gate-btn:disabled{opacity:0.5;cursor:not-allowed}'
      + '.qb-gate-skip{display:block;text-align:center;margin-top:18px;color:rgba(255,255,255,0.4);font-size:13px;text-decoration:underline;cursor:pointer;background:none;border:none;width:100%;font-family:inherit}'
      + '.qb-gate-skip:hover{color:rgba(255,255,255,0.7)}'
      + '.qb-gate-fine{font-size:11px;color:rgba(255,255,255,0.4);margin-top:18px;font-family:\'JetBrains Mono\',monospace;letter-spacing:0.04em;text-align:center;line-height:1.6}'
      + '.qb-gate-err{color:#f87171;font-size:12px;margin-top:10px;font-family:\'JetBrains Mono\',monospace;text-align:center}'
      + '.qb-gate-success{text-align:center;padding:20px 0}'
      + '.qb-gate-success-icon{font-size:32px;margin-bottom:14px}'
      + '.qb-gate-progress{display:flex;gap:6px;margin-bottom:24px}'
      + '.qb-gate-pip{flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;transition:background-color .25s ease}'
      + '.qb-gate-pip.done{background:#4ade80}'
      + '.qb-gate-context{font-family:\'JetBrains Mono\',monospace;font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}'
      + '.qb-gate-context-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:qbPulse 2s ease-in-out infinite}'
      + '@keyframes qbPulse{0%,100%{opacity:1}50%{opacity:0.4}}';
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

    // If already authed, no gate. Just record completion + invoke onClose.
    if (QB.isAuthed() && !isLogin) {
      QB.recordCompletion(opts.toolId);
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
