// QB BrandOS — "Send Me My Results" Modal
// Drop this script anywhere in a Phase 01 tool.
// Call: window.QB_showResultsModal({ toolId, qbp, results })

(function() {

  const STYLES = `
    .qb-modal-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.85);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      animation: qbFadeIn .2s ease;
    }
    @keyframes qbFadeIn { from { opacity:0 } to { opacity:1 } }
    .qb-modal {
      background: #111;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      padding: 40px;
      animation: qbSlideUp .25s ease;
    }
    @keyframes qbSlideUp { from { transform:translateY(16px); opacity:0 } to { transform:translateY(0); opacity:1 } }
    .qb-modal-close {
      position: absolute; top: 16px; right: 16px;
      background: none; border: none; color: rgba(255,255,255,.3);
      cursor: pointer; font-size: 18px; line-height: 1;
    }
    .qb-modal-close:hover { color: #fff; }
    .qb-modal-eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; letter-spacing: .35em; text-transform: uppercase;
      color: #4ade80; margin-bottom: 12px;
    }
    .qb-modal-title {
      font-size: 22px; font-weight: 500; color: #fff;
      margin-bottom: 8px; line-height: 1.2;
    }
    .qb-modal-sub {
      font-size: 13px; color: rgba(255,255,255,.4);
      margin-bottom: 32px; line-height: 1.6;
    }
    .qb-modal-field {
      margin-bottom: 16px;
    }
    .qb-modal-label {
      display: block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; letter-spacing: .25em; text-transform: uppercase;
      color: rgba(255,255,255,.35); margin-bottom: 8px;
    }
    .qb-modal-input {
      width: 100%; background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px; padding: 12px 16px;
      font-size: 14px; color: #fff;
      font-family: 'Inter', sans-serif;
      outline: none; transition: border-color .15s;
    }
    .qb-modal-input:focus { border-color: #4ade80; }
    .qb-modal-input::placeholder { color: rgba(255,255,255,.2); }
    .qb-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .qb-modal-btn {
      width: 100%; background: #4ade80; color: #000;
      border: none; border-radius: 8px;
      padding: 14px; font-size: 13px; font-weight: 600;
      letter-spacing: .08em; text-transform: uppercase;
      cursor: pointer; margin-top: 24px;
      font-family: 'Inter', sans-serif;
      transition: opacity .15s, transform .1s;
    }
    .qb-modal-btn:hover:not(:disabled) { opacity: .88; }
    .qb-modal-btn:active { transform: scale(.99); }
    .qb-modal-btn:disabled { opacity: .4; cursor: not-allowed; }
    .qb-modal-status {
      text-align: center; font-size: 12px;
      color: rgba(255,255,255,.4); margin-top: 16px;
      min-height: 18px;
    }
    .qb-modal-status.ok { color: #4ade80; }
    .qb-modal-status.err { color: #f87171; }
    .qb-modal-note {
      font-size: 11px; color: rgba(255,255,255,.2);
      text-align: center; margin-top: 12px; line-height: 1.5;
    }
  `;

  function injectStyles() {
    if (document.getElementById('qb-results-modal-styles')) return;
    const s = document.createElement('style');
    s.id = 'qb-results-modal-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  window.QB_showResultsModal = function({ toolId, qbp, results, pdfPage }) {
    injectStyles();

    // Remove any existing modal
    const existing = document.getElementById('qb-results-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qb-results-overlay';
    overlay.className = 'qb-modal-overlay';

    overlay.innerHTML = `
      <div class="qb-modal" style="position:relative;">
        <button class="qb-modal-close" id="qb-modal-close-btn">✕</button>
        <div class="qb-modal-eyebrow">Your Results Are Ready</div>
        <div class="qb-modal-title">Get your report by email</div>
        <div class="qb-modal-sub">We'll send a beautifully designed PDF of your results directly to your inbox.</div>

        <div class="qb-modal-row">
          <div class="qb-modal-field">
            <label class="qb-modal-label">First Name</label>
            <input class="qb-modal-input" id="qb-fn" type="text" placeholder="Sarah">
          </div>
          <div class="qb-modal-field">
            <label class="qb-modal-label">Last Name</label>
            <input class="qb-modal-input" id="qb-ln" type="text" placeholder="Chen">
          </div>
        </div>

        <div class="qb-modal-field">
          <label class="qb-modal-label">Company <span style="opacity:.4;">(optional)</span></label>
          <input class="qb-modal-input" id="qb-co" type="text" placeholder="Studio Name or Brand">
        </div>

        <div class="qb-modal-field">
          <label class="qb-modal-label">Email Address <span style="color:#4ade80;">*</span></label>
          <input class="qb-modal-input" id="qb-em" type="email" placeholder="you@yourbrand.com">
        </div>

        <button class="qb-modal-btn" id="qb-submit-btn">Send My Results →</button>
        <div class="qb-modal-status" id="qb-status"></div>
        <div class="qb-modal-note">Your results are also saved locally in this browser. No spam — ever.</div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    document.getElementById('qb-modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Submit
    document.getElementById('qb-submit-btn').addEventListener('click', async () => {
      const fn = document.getElementById('qb-fn').value.trim();
      const ln = document.getElementById('qb-ln').value.trim();
      const co = document.getElementById('qb-co').value.trim();
      const em = document.getElementById('qb-em').value.trim();
      const status = document.getElementById('qb-status');
      const btn = document.getElementById('qb-submit-btn');

      if (!em || !em.includes('@')) {
        status.textContent = 'Please enter a valid email address.';
        status.className = 'qb-modal-status err';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending…';
      status.textContent = 'Generating your report…';
      status.className = 'qb-modal-status';

      // 1. Open PDF in new tab (browser renders it perfectly, user saves as PDF)
      const currentQbp = qbp || JSON.parse(localStorage.getItem('qb_qbp') || '{}');
      const pdfUrl = (pdfPage || '/brand-soul-map-pdf.html') + '?' + new URLSearchParams({
        fn, ln, co,
        qbp: encodeURIComponent(btoa(JSON.stringify(currentQbp))),
        autoprint: '0'
      }).toString();
      window.open(pdfUrl, '_blank');

      // 2. Send email via API
      try {
        const res = await fetch('/api/send-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: fn, lastName: ln, company: co, email: em,
            toolId: toolId || 'soul-map',
            qbp: currentQbp,
            results: results || {}
          })
        });
        const data = await res.json();
        if (data.success) {
          status.textContent = '✓ Report sent! Also check the new tab for your PDF.';
          status.className = 'qb-modal-status ok';
          btn.textContent = 'Done ✓';
        } else {
          throw new Error(data.error || 'Send failed');
        }
      } catch(e) {
        // Email failed but PDF still opened
        status.textContent = 'PDF opened in new tab. Email delivery requires setup.';
        status.className = 'qb-modal-status';
        btn.textContent = 'PDF Ready ✓';
      }

      setTimeout(() => overlay.remove(), 4000);
    });

    // Focus email
    setTimeout(() => document.getElementById('qb-fn').focus(), 100);
  };

})();
