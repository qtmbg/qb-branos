/* ═══════════════════════════════════════════════════════════════
   QB SHELL — Persistent navigation frame
   Injected into every tool page in QB BrandOS.
   Reads: data-qb-tool, data-qb-phase on <html> or <body>
   Manages: sidebar nav, topbar breadcrumbs, QBP health, theme
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Theme init (must run before paint) ── */
  const savedTheme = localStorage.getItem('qb-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  /* ── Tool registry ── */
  const TOOLS = [
    { id: 'signal-scan',         name: 'Signal Scan',         phase: 'acquisition', file: 'signal-scan.html' },
    { id: 'brand-soul-map',      name: 'Brand Soul Map',      phase: 'discovery',   file: 'brand-soul-map.html' },
    { id: 'sensescape',          name: 'Sensescape',          phase: 'discovery',   file: 'sensescape.html' },
    { id: 'visual-dna',          name: 'Visual DNA',          phase: 'discovery',   file: 'visual-dna.html' },
    { id: 'war-table',           name: 'War Table',           phase: 'discovery',   file: 'war-table.html' },
    { id: 'logo-direction',      name: 'Logo Direction',      phase: 'creation',    file: 'logo-direction-agent.html' },
    { id: 'logo-evaluation',     name: 'Logo Evaluation',     phase: 'creation',    file: 'logo-evaluation-agent.html' },
    { id: 'voice-guide',         name: 'Voice Guide',         phase: 'creation',    file: 'voice-guide-agent.html' },
    { id: 'predictive-panel',    name: 'Predictive Panel',    phase: 'validation',  file: 'predictive-panel.html' },
    { id: 'instagram-seed',      name: 'Instagram Seed',      phase: 'content',     file: 'instagram-seed-agent.html' },
    { id: 'linkedin-strategy',   name: 'LinkedIn Strategy',   phase: 'content',     file: 'linkedin-strategy-agent.html' },
    { id: 'youtube-strategy',    name: 'YouTube Strategy',    phase: 'content',     file: 'youtube-strategy-agent.html' },
    { id: 'newsletter-arch',     name: 'Newsletter Arch.',    phase: 'content',     file: 'newsletter-architecture-agent.html' },
    { id: 'content-bridge',      name: 'Content Bridge',      phase: 'content',     file: 'content-bridge.html' },
    { id: 'repurposing-engine',  name: 'Repurposing Engine',  phase: 'execution',   file: 'content-repurposing-engine.html' },
    { id: 'performance-dash',    name: 'Performance Dash',    phase: 'intelligence', file: 'brand-performance-dashboard.html' },
    { id: 'quarterly-review',    name: 'Quarterly Review',    phase: 'intelligence', file: 'quarterly-brand-review-agent.html' },
  ];

  const PHASES = [
    { id: 'discovery',    label: 'Discovery' },
    { id: 'creation',     label: 'Brand Creation' },
    { id: 'validation',   label: 'Validation' },
    { id: 'content',      label: 'Content' },
    { id: 'execution',    label: 'Execution' },
    { id: 'intelligence', label: 'Intelligence' },
  ];

  const PHASE_DISPLAY = {
    discovery: 'Phase 01',
    creation: 'Phase 02',
    validation: 'Phase 2.5',
    content: 'Phase 03',
    execution: 'Phase 04',
    intelligence: 'Phase 05',
  };

  /* ── Read current tool from page ── */
  const currentToolId =
    document.documentElement.getAttribute('data-qb-tool') ||
    document.body.getAttribute('data-qb-tool') ||
    '';
  const currentTool = TOOLS.find(t => t.id === currentToolId);

  /* ── Read completion state from localStorage ── */
  function getCompletionState() {
    try {
      return JSON.parse(localStorage.getItem('qb_tool_completion') || '{}');
    } catch { return {}; }
  }

  /* ── Read QBP field count ── */
  function getQBPHealth() {
    try {
      const qbp = JSON.parse(localStorage.getItem('qb_qbp') || '{}');
      const fields = [
        'brandName', 'brandEssence', 'spark', 'archetype', 'manifesto',
        'antiBrand', 'paradox', 'alwaysNever', 'primaryPersona',
        'sensoryProfile', 'colorDirection', 'visualDNA'
      ];
      let filled = 0;
      fields.forEach(f => {
        if (qbp[f] && String(qbp[f]).trim().length > 0) filled++;
      });
      return { filled, total: fields.length };
    } catch { return { filled: 0, total: 12 }; }
  }

  /* ── Build topbar HTML ── */
  function buildTopbar() {
    const phaseName = currentTool
      ? PHASES.find(p => p.id === currentTool.phase)?.label || ''
      : '';
    const phaseDisplay = currentTool
      ? PHASE_DISPLAY[currentTool.phase] || ''
      : '';
    const toolName = currentTool ? currentTool.name : 'QB BrandOS';

    return `
      <div class="qb-topbar">
        <div class="qb-topbar-crumbs">
          <a href="qb-branidos-hub.html" class="qb-crumb" style="cursor:pointer">QB BrandOS</a>
          <span class="qb-crumb-sep">/</span>
          <span class="qb-crumb">${phaseName}</span>
          <span class="qb-crumb-sep">/</span>
          <span class="qb-crumb here">${toolName}</span>
        </div>
        ${phaseDisplay ? `<div class="qb-topbar-pill">${phaseDisplay}</div>` : ''}
      </div>`;
  }

  /* ── Inject shell on DOM ready ── */
  function injectShell() {
    /* If shell already exists (page built it explicitly), just hydrate state */
    if (document.querySelector('.qb-shell')) {
      hydrateState();
      return;
    }

    /* Non-destructive injection: wrap existing body children */
    var existingChildren = Array.from(document.body.childNodes);

    /* Build sidebar */
    var sidebar = document.createElement('aside');
    sidebar.className = 'qb-sidebar';
    sidebar.id = 'qb-sidebar';
    sidebar.innerHTML = buildSidebarInner();

    /* Build topbar */
    var topbar = document.createElement('div');
    topbar.innerHTML = buildTopbar();
    var topbarEl = topbar.firstElementChild;

    /* Build content wrapper */
    var contentWrap = document.createElement('div');
    contentWrap.className = 'qb-content';
    contentWrap.id = 'qb-tool-content';

    /* Build main */
    var main = document.createElement('main');
    main.className = 'qb-main';
    main.appendChild(topbarEl);
    main.appendChild(contentWrap);

    /* Build shell */
    var shell = document.createElement('div');
    shell.className = 'qb-shell';
    shell.appendChild(sidebar);
    shell.appendChild(main);

    /* Move existing children into content wrapper (non-destructive) */
    existingChildren.forEach(function(node) {
      contentWrap.appendChild(node);
    });

    /* Append shell to body */
    document.body.appendChild(shell);
  }

  /* ── Hydrate sidebar state for pre-built shells ── */
  function hydrateState() {
    var completion = getCompletionState();
    var qbp = getQBPHealth();
    var pct = Math.round((qbp.filled / qbp.total) * 100);

    /* Update QBP bar */
    var fill = document.querySelector('.qb-sidebar-qbp-fill');
    if (fill) fill.style.width = pct + '%';
    var meta = document.querySelector('.qb-sidebar-qbp-meta');
    if (meta) meta.textContent = qbp.filled + ' of ' + qbp.total + ' fields set';

    /* Update completion dots */
    TOOLS.forEach(function(tool) {
      var items = document.querySelectorAll('.qb-sidebar-item');
      items.forEach(function(item) {
        var nameEl = item.querySelector('.qb-sidebar-name');
        if (nameEl && nameEl.textContent.trim() === tool.name) {
          var dot = item.querySelector('.qb-sidebar-dot');
          if (completion[tool.id] && dot) {
            dot.className = 'qb-sidebar-dot done';
            item.classList.add('done');
          }
        }
      });
    });
  }

  /* ── Build sidebar inner HTML (without the aside wrapper) ── */
  function buildSidebarInner() {
    var completion = getCompletionState();
    var qbp = getQBPHealth();
    var pct = Math.round((qbp.filled / qbp.total) * 100);

    var navHTML = '';
    PHASES.forEach(function(phase) {
      var phaseTools = TOOLS.filter(function(t) { return t.phase === phase.id; });
      navHTML += '<div class="qb-sidebar-phase" data-phase="' + phase.id + '">' + phase.label + '</div>';
      phaseTools.forEach(function(tool) {
        var isDone = completion[tool.id] === true;
        var isCurrent = tool.id === currentToolId;
        var classes = ['qb-sidebar-item'];
        if (isDone) classes.push('done');
        if (isCurrent) classes.push('active');
        var dotClass = 'locked';
        if (isDone) dotClass = 'done';
        else if (isCurrent) dotClass = 'now';
        navHTML += '<a href="' + tool.file + '" class="' + classes.join(' ') + '">' +
          '<div class="qb-sidebar-dot ' + dotClass + '"></div>' +
          '<div class="qb-sidebar-name">' + tool.name + '</div>' +
          '<div class="qb-sidebar-check">&#10003;</div>' +
          '</a>';
      });
    });

    return '<div class="qb-sidebar-logo">' +
      '<div class="qb-pulse"></div>' +
      '<div class="qb-sidebar-brand">Quantum</div>' +
      '<div class="qb-sidebar-tag">BrandOS</div>' +
      '</div>' +
      '<nav class="qb-sidebar-nav">' + navHTML + '</nav>' +
      '<div class="qb-sidebar-qbp">' +
        '<div class="qb-sidebar-qbp-head">' +
          '<div class="qb-sidebar-qbp-dot"></div>' +
          'Quantum Brand Profile' +
        '</div>' +
        '<div class="qb-sidebar-qbp-track">' +
          '<div class="qb-sidebar-qbp-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="qb-sidebar-qbp-meta">' + qbp.filled + ' of ' + qbp.total + ' fields set</div>' +
      '</div>';
  }

  /* ── Run ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectShell);
  } else {
    injectShell();
  }

  /* ── Expose utility for tools to mark completion ── */
  window.qbShell = {
    markComplete: function (toolId) {
      const state = getCompletionState();
      state[toolId] = true;
      localStorage.setItem('qb_tool_completion', JSON.stringify(state));
    },
    getTheme: function () {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    },
    setTheme: function (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('qb-theme', theme);
    },
    toggleTheme: function () {
      const current = this.getTheme();
      this.setTheme(current === 'dark' ? 'light' : 'dark');
    }
  };

})();
