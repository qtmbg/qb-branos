// qb-pptx-export.js
// Shared PPTX export for QB BrandOS Phase 01 tools.
// Exposes window.QB_exportPPTX(toolId, data, opts).
// Loads PptxGenJS lazily from unpkg (already allowed by site CSP).
//
// Brand: QB BrandOS v3.2 — dark warm palette, brass + patina accents.
//   bg-base    #0E0C09   bg-deep   #0A0806   bg-void  #080604
//   brass      #A8903E   brass-lit #C4A84E
//   patina     #3A5F4A   patina-lit #4A7A5E
//   text-1     DDD4C4    text-2    A89A88    text-3   6A5E50
//   serif: DM Serif Display    sans: Inter    mono: JetBrains Mono

(function () {
  var PPTX_CDN = "https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";

  // ---------- Brand tokens ----------
  var TOKENS = {
    bgBase:    "0E0C09",
    bgDeep:    "0A0806",
    bgVoid:    "080604",
    brass:     "A8903E",
    brassLit:  "C4A84E",
    patina:    "3A5F4A",
    patinaLit: "4A7A5E",
    text1:     "DDD4C4",
    text2:     "A89A88",
    text3:     "6A5E50",
    text4:     "3E3830",
    serif: "DM Serif Display",
    sans:  "Inter",
    mono:  "JetBrains Mono"
  };
  // 16:9 slide = 13.333 x 7.5 in (PptxGenJS LAYOUT_WIDE)
  var W = 13.333, H = 7.5;
  var GUTTER = 0.7;
  var COL_W = W - GUTTER * 2;

  // ---------- Loader ----------
  var _loadPromise = null;
  function loadPptxGen() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = PPTX_CDN;
      s.async = true;
      s.onload = function () {
        if (window.PptxGenJS) resolve(window.PptxGenJS);
        else reject(new Error("PptxGenJS loaded but global missing"));
      };
      s.onerror = function () { reject(new Error("Failed to load PptxGenJS from " + PPTX_CDN)); };
      document.head.appendChild(s);
    });
    return _loadPromise;
  }

  // ---------- Helpers ----------
  function txt(v) { return (v == null ? "" : String(v)).trim(); }
  function nonEmpty(arr) { return (arr || []).filter(function (x) { return txt(x); }); }
  function todayStamp() {
    var d = new Date();
    var m = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()];
    return m + " " + d.getFullYear();
  }

  function sanitizeFilename(s) {
    return String(s || "qb-deck")
      .toLowerCase()
      .replace(/[^a-z0-9\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "qb-deck";
  }

  // ---------- Slide master ----------
  // Two masters: QB_DARK (default) and QB_COVER (hero).
  function defineMasters(pres, brandLabel) {
    var label = txt(brandLabel) || "QB BRANDOS";
    pres.defineSlideMaster({
      title: "QB_DARK",
      background: { color: TOKENS.bgBase },
      objects: [
        // top hairline
        { rect: { x: 0, y: 0, w: W, h: 0.02, fill: { color: TOKENS.brass, transparency: 60 } } },
        // brand mark top-left
        { text: {
            text: label.toUpperCase(),
            options: { x: GUTTER, y: 0.28, w: 5, h: 0.28,
              fontFace: TOKENS.mono, fontSize: 8, color: TOKENS.brass,
              charSpacing: 4, bold: false, valign: "middle" }
        }},
        // page brand right
        { text: {
            text: "QB BRANDOS  ·  PHASE 01",
            options: { x: W - GUTTER - 5, y: 0.28, w: 5, h: 0.28,
              fontFace: TOKENS.mono, fontSize: 8, color: TOKENS.text3,
              charSpacing: 3, align: "right", valign: "middle" }
        }},
        // footer brass dot + date
        { rect: { x: GUTTER, y: H - 0.42, w: 0.08, h: 0.08, fill: { color: TOKENS.brass } } },
        { text: {
            text: todayStamp(),
            options: { x: GUTTER + 0.18, y: H - 0.5, w: 4, h: 0.3,
              fontFace: TOKENS.mono, fontSize: 8, color: TOKENS.text3,
              charSpacing: 3, valign: "middle" }
        }},
        { text: {
            text: "PAGE  {slide_num} / {slide_count}",
            options: { x: W - GUTTER - 4, y: H - 0.5, w: 4, h: 0.3,
              fontFace: TOKENS.mono, fontSize: 8, color: TOKENS.brass,
              charSpacing: 3, align: "right", valign: "middle" }
        }}
      ]
    });

    pres.defineSlideMaster({
      title: "QB_COVER",
      background: { color: TOKENS.bgVoid },
      objects: [
        { rect: { x: 0, y: 0, w: W, h: 0.02, fill: { color: TOKENS.brass } } },
        { text: {
            text: label.toUpperCase(),
            options: { x: GUTTER, y: 0.28, w: 8, h: 0.28,
              fontFace: TOKENS.mono, fontSize: 8, color: TOKENS.brass,
              charSpacing: 4, valign: "middle" }
        }},
        { text: {
            text: todayStamp(),
            options: { x: W - GUTTER - 5, y: 0.28, w: 5, h: 0.28,
              fontFace: TOKENS.mono, fontSize: 8, color: TOKENS.text3,
              charSpacing: 3, align: "right", valign: "middle" }
        }},
        { rect: { x: GUTTER, y: H - 0.42, w: 0.08, h: 0.08, fill: { color: TOKENS.brass } } },
        { text: {
            text: "QUANTUM BRANDING  ·  BRANDOS",
            options: { x: GUTTER + 0.18, y: H - 0.5, w: 8, h: 0.3,
              fontFace: TOKENS.mono, fontSize: 8, color: TOKENS.text3,
              charSpacing: 3, valign: "middle" }
        }}
      ]
    });
  }

  // ---------- Slide builders (atoms) ----------
  function addCoverSlide(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_COVER" });
    s.addText(opts.eyebrow || "PHASE 01  ·  DELIVERABLE", {
      x: GUTTER, y: H * 0.32, w: COL_W, h: 0.4,
      fontFace: TOKENS.mono, fontSize: 11, color: TOKENS.brass, charSpacing: 6
    });
    s.addText(opts.title || "Untitled", {
      x: GUTTER, y: H * 0.36, w: COL_W, h: 1.6,
      fontFace: TOKENS.serif, fontSize: 64, color: TOKENS.text1,
      bold: false, charSpacing: -1
    });
    if (opts.subtitle) {
      s.addText(opts.subtitle, {
        x: GUTTER, y: H * 0.36 + 1.65, w: COL_W * 0.78, h: 1.0,
        fontFace: TOKENS.sans, fontSize: 18, color: TOKENS.text2,
        italic: false, lineSpacingMultiple: 1.35
      });
    }
    return s;
  }

  function addSectionDivider(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_DARK" });
    s.addText(opts.kicker || "SECTION", {
      x: GUTTER, y: H * 0.42, w: COL_W, h: 0.35,
      fontFace: TOKENS.mono, fontSize: 10, color: TOKENS.brass, charSpacing: 5
    });
    s.addText(opts.title || "", {
      x: GUTTER, y: H * 0.46, w: COL_W, h: 1.6,
      fontFace: TOKENS.serif, fontSize: 52, color: TOKENS.text1, charSpacing: -1
    });
    if (opts.note) {
      s.addText(opts.note, {
        x: GUTTER, y: H * 0.46 + 1.6, w: COL_W * 0.7, h: 0.8,
        fontFace: TOKENS.sans, fontSize: 14, color: TOKENS.text2
      });
    }
    return s;
  }

  function addContentTitle(slide, kicker, title) {
    slide.addText(kicker || "", {
      x: GUTTER, y: 0.85, w: COL_W, h: 0.3,
      fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.brass, charSpacing: 4
    });
    slide.addText(title || "", {
      x: GUTTER, y: 1.15, w: COL_W, h: 0.9,
      fontFace: TOKENS.serif, fontSize: 32, color: TOKENS.text1, charSpacing: -0.5
    });
    // brass hairline beneath title
    slide.addShape("rect", {
      x: GUTTER, y: 2.05, w: 0.6, h: 0.02,
      fill: { color: TOKENS.brass }, line: { color: TOKENS.brass, width: 0 }
    });
  }

  function addQuoteSlide(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_DARK" });
    s.addText(opts.kicker || "INSIGHT", {
      x: GUTTER, y: 0.85, w: COL_W, h: 0.3,
      fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.brass, charSpacing: 4
    });
    // big patina open quote
    s.addText("“", {
      x: GUTTER, y: 1.6, w: 1.2, h: 1.8,
      fontFace: TOKENS.serif, fontSize: 120, color: TOKENS.patinaLit
    });
    s.addText(opts.quote || "", {
      x: GUTTER + 0.95, y: 2.0, w: COL_W - 1.0, h: 3.5,
      fontFace: TOKENS.serif, fontSize: 28, color: TOKENS.text1,
      lineSpacingMultiple: 1.3
    });
    if (opts.attribution) {
      s.addText("— " + opts.attribution, {
        x: GUTTER + 0.95, y: 6.0, w: COL_W - 1.0, h: 0.4,
        fontFace: TOKENS.mono, fontSize: 10, color: TOKENS.text3, charSpacing: 3
      });
    }
    return s;
  }

  function addBulletsSlide(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_DARK" });
    addContentTitle(s, opts.kicker, opts.title);
    var items = nonEmpty(opts.items);
    var paragraphs = [];
    if (!items.length) {
      paragraphs.push({ text: opts.placeholder || "—", options: { fontFace: TOKENS.sans, fontSize: 16, color: TOKENS.text3, breakLine: true } });
    } else {
      items.forEach(function (item, i) {
        paragraphs.push({ text: pad2(i + 1) + "   ", options: { fontFace: TOKENS.mono, fontSize: 11, color: TOKENS.brass, charSpacing: 3 } });
        paragraphs.push({ text: txt(item),           options: { fontFace: TOKENS.sans, fontSize: 16, color: TOKENS.text1, breakLine: true } });
      });
    }
    s.addText(paragraphs, {
      x: GUTTER, y: 2.4, w: COL_W * 0.85, h: H - 3.2,
      paraSpaceAfter: 14, lineSpacingMultiple: 1.35, valign: "top"
    });
    return s;
  }

  function addBodySlide(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_DARK" });
    addContentTitle(s, opts.kicker, opts.title);
    if (opts.eyebrow) {
      s.addText(opts.eyebrow, {
        x: GUTTER, y: 2.2, w: COL_W * 0.85, h: 0.3,
        fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.text3, charSpacing: 3
      });
    }
    s.addText(opts.body || "", {
      x: GUTTER, y: 2.55, w: COL_W * 0.78, h: H - 3.4,
      fontFace: TOKENS.sans, fontSize: 16, color: TOKENS.text1,
      lineSpacingMultiple: 1.45, valign: "top", paraSpaceAfter: 8
    });
    return s;
  }

  function addTwoColSlide(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_DARK" });
    addContentTitle(s, opts.kicker, opts.title);
    var colW = (COL_W - 0.5) / 2;
    s.addText(opts.leftLabel || "", {
      x: GUTTER, y: 2.3, w: colW, h: 0.3,
      fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.brass, charSpacing: 4
    });
    s.addText(opts.left || "", {
      x: GUTTER, y: 2.6, w: colW, h: H - 3.4,
      fontFace: TOKENS.sans, fontSize: 14, color: TOKENS.text1,
      lineSpacingMultiple: 1.4, valign: "top"
    });
    s.addText(opts.rightLabel || "", {
      x: GUTTER + colW + 0.5, y: 2.3, w: colW, h: 0.3,
      fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.patinaLit, charSpacing: 4
    });
    s.addText(opts.right || "", {
      x: GUTTER + colW + 0.5, y: 2.6, w: colW, h: H - 3.4,
      fontFace: TOKENS.sans, fontSize: 14, color: TOKENS.text1,
      lineSpacingMultiple: 1.4, valign: "top"
    });
    return s;
  }

  function addTableSlide(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_DARK" });
    addContentTitle(s, opts.kicker, opts.title);
    var headerRow = (opts.headers || []).map(function (h) {
      return {
        text: String(h).toUpperCase(),
        options: {
          fontFace: TOKENS.mono, fontSize: 9, color: TOKENS.brass,
          bold: false, charSpacing: 3,
          fill: { color: TOKENS.bgDeep }, valign: "middle",
          margin: 0.08
        }
      };
    });
    var bodyRows = (opts.rows || []).map(function (row) {
      return row.map(function (cell, i) {
        return {
          text: txt(cell),
          options: {
            fontFace: TOKENS.sans, fontSize: 11,
            color: i === 0 ? TOKENS.brassLit : TOKENS.text1,
            bold: false, valign: "top",
            fill: { color: TOKENS.bgBase },
            margin: 0.08
          }
        };
      });
    });
    var rows = [headerRow].concat(bodyRows);
    s.addTable(rows, {
      x: GUTTER, y: 2.35, w: COL_W,
      colW: opts.colW || undefined,
      border: { type: "solid", pt: 0.5, color: TOKENS.text4 },
      autoPage: false
    });
    return s;
  }

  function addClosingSlide(pres, opts) {
    var s = pres.addSlide({ masterName: "QB_COVER" });
    s.addText(opts.kicker || "END OF DECK", {
      x: GUTTER, y: H * 0.40, w: COL_W, h: 0.4,
      fontFace: TOKENS.mono, fontSize: 11, color: TOKENS.brass, charSpacing: 6
    });
    s.addText(opts.title || "Built with QB BrandOS", {
      x: GUTTER, y: H * 0.44, w: COL_W, h: 1.2,
      fontFace: TOKENS.serif, fontSize: 44, color: TOKENS.text1, charSpacing: -0.5
    });
    s.addText(opts.note || "Quantum Branding  ·  app.quantumbranding.ai", {
      x: GUTTER, y: H * 0.44 + 1.3, w: COL_W * 0.8, h: 0.5,
      fontFace: TOKENS.sans, fontSize: 14, color: TOKENS.text2
    });
    return s;
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  // ---------- Tool deck builders ----------
  function buildProfilesDeck(pres, data, opts) {
    var brandName = txt(opts && opts.brandName) || "Brand";
    defineMasters(pres, "THE PROFILES  ·  " + brandName);

    // Cover
    addCoverSlide(pres, {
      eyebrow: "PHASE 01  ·  THE PROFILES",
      title: "Three buyers.\nOne strategic thread.",
      subtitle: brandName + " — three full persona briefs, the patterns that bind them, and the moves they unlock."
    });

    // Binding insight first (it's the headline)
    if (txt(data.bindingInsight)) {
      addQuoteSlide(pres, {
        kicker: "THE BINDING INSIGHT",
        quote: txt(data.bindingInsight),
        attribution: "What runs through all three"
      });
    }

    // Per-persona section: divider + 5 content slides
    (data.profiles || []).forEach(function (p, i) {
      var n = pad2(i + 1);
      addSectionDivider(pres, {
        kicker: "PERSONA  ·  " + n,
        title: txt(p.name) + (txt(p.role) ? "  ·  " + txt(p.role) : ""),
        note: txt(p.opening)
      });

      // Identity + mindset
      addTwoColSlide(pres, {
        kicker: n + "  ·  WHO THEY ARE",
        title: "Identity & mindset",
        leftLabel: "CORE IDENTITY",
        left: txt(p.coreIdentity),
        rightLabel: "PROFESSIONAL MINDSET",
        right: txt(p.mindset)
      });

      // Hook
      if (txt(p.hook)) {
        addQuoteSlide(pres, {
          kicker: n + "  ·  THE HOOK",
          quote: txt(p.hook),
          attribution: txt(p.name)
        });
      }

      // Pain points (table: category | pain)
      var pains = (p.painPoints || []).filter(function (pp) { return txt(pp && pp.pain); });
      if (pains.length) {
        addTableSlide(pres, {
          kicker: n + "  ·  PAIN POINTS",
          title: "Where it hurts",
          headers: ["Category", "Pain"],
          rows: pains.map(function (pp) { return [txt(pp.category), txt(pp.pain)]; }),
          colW: [3.0, COL_W - 3.0]
        });
      }

      // Marketing approach
      if (nonEmpty(p.marketingApproach).length) {
        addBulletsSlide(pres, {
          kicker: n + "  ·  MARKETING APPROACH",
          title: "Five strategic moves",
          items: p.marketingApproach
        });
      }

      // Customer journey (table)
      var jr = (p.journey || []).filter(function (j) { return txt(j && j.event); });
      if (jr.length) {
        addTableSlide(pres, {
          kicker: n + "  ·  CUSTOMER JOURNEY",
          title: "From signal to advocacy",
          headers: ["Stage", "Initiating event", "Feeling", "Touchpoint", "Strategy"],
          rows: jr.map(function (j) { return [txt(j.stage), txt(j.event), txt(j.feeling), txt(j.touchpoint), txt(j.strategy)]; })
        });
      }

      // Key takeaways
      if (nonEmpty(p.keyTakeaways).length) {
        addBulletsSlide(pres, {
          kicker: n + "  ·  KEY TAKEAWAYS",
          title: "What to remember",
          items: p.keyTakeaways
        });
      }
    });

    // Common themes
    if (nonEmpty(data.commonThemes).length) {
      addBulletsSlide(pres, {
        kicker: "CROSS-CUTTING",
        title: "Common themes",
        items: data.commonThemes
      });
    }

    // Shared key takeaways
    if (nonEmpty(data.sharedKeyTakeaways).length) {
      addBulletsSlide(pres, {
        kicker: "SHARED",
        title: "What is true of all three",
        items: data.sharedKeyTakeaways
      });
    }

    addClosingSlide(pres, {
      kicker: "END OF DECK",
      title: "Three briefs.  One thread.  Move.",
      note: "Generated by QB BrandOS  ·  app.quantumbranding.ai"
    });
  }

  function buildSoulMapDeck(pres, data, opts) {
    var brandName = txt(opts && opts.brandName) || "Brand";
    var c = data || {};
    defineMasters(pres, "BRAND SOUL MAP  ·  " + brandName);

    addCoverSlide(pres, {
      eyebrow: "PHASE 01  ·  BRAND SOUL MAP",
      title: brandName,
      subtitle: "The irreducible truth, the archetype, and the emotional foundation\nyour brand is built on."
    });

    if (txt(c.verdict)) {
      addBodySlide(pres, { kicker: "OPENING", title: "The verdict", body: txt(c.verdict) });
    }
    if (txt(c.essence)) {
      addQuoteSlide(pres, { kicker: "THE ESSENCE", quote: txt(c.essence), attribution: brandName });
    }
    if (txt(c.spark)) {
      addBodySlide(pres, { kicker: "THE SPARK", title: "Why this brand exists", body: txt(c.spark) });
    }

    // 01 · Identity portrait
    var ip = c.identityPortrait || {};
    if (txt(ip.energy) || txt(ip.aesthetic) || txt(ip.archetype)) {
      var ipBody = "";
      if (txt(ip.energy))    ipBody += "ENERGY  ·  " + txt(ip.energy) + "\n\n";
      if (txt(ip.aesthetic)) ipBody += "AESTHETIC  ·  " + txt(ip.aesthetic) + "\n\n";
      if (txt(ip.archetype)) ipBody += "ARCHETYPE  ·  " + txt(ip.archetype);
      addBodySlide(pres, {
        kicker: "01  ·  IDENTITY PORTRAIT",
        title: "How this brand moves",
        body: ipBody.trim()
      });
    }

    // 02 · Purpose & legacy
    var pl = c.purposeLegacy || {};
    if (txt(pl.legacyRewritten) || txt(pl.beliefRewritten) || txt(pl.transformation)) {
      var plBody = "";
      if (txt(pl.legacyRewritten)) plBody += "LEGACY CLAIM  ·  " + txt(pl.legacyRewritten) + "\n\n";
      if (txt(pl.beliefRewritten)) plBody += "CORE BELIEF  ·  " + txt(pl.beliefRewritten) + "\n\n";
      if (txt(pl.transformation))  plBody += "TRANSFORMATION  ·  " + txt(pl.transformation);
      addBodySlide(pres, {
        kicker: "02  ·  PURPOSE & LEGACY",
        title: "Why it exists. What it leaves behind.",
        body: plBody.trim()
      });
    }

    // 03 · Positioning spine (two-col + extras)
    var ps = c.positioningSpine || {};
    if (txt(ps.claimedTerritory) || txt(ps.refusedTerritory)) {
      addTwoColSlide(pres, {
        kicker: "03  ·  POSITIONING SPINE",
        title: "Where we play. Where we don't.",
        leftLabel: "CLAIMED TERRITORY",
        left: txt(ps.claimedTerritory),
        rightLabel: "REFUSED TERRITORY",
        right: txt(ps.refusedTerritory)
      });
    }
    if (txt(ps.dnaReading) || txt(ps.defensibility)) {
      var psBody = "";
      if (txt(ps.dnaReading))    psBody += "DNA READING  ·  " + txt(ps.dnaReading) + "\n\n";
      if (txt(ps.defensibility)) psBody += "DEFENSIBILITY  ·  " + txt(ps.defensibility);
      addBodySlide(pres, {
        kicker: "03  ·  POSITIONING SPINE",
        title: "What makes it stick",
        body: psBody.trim()
      });
    }

    // 04 · Community soul
    var cs = c.communitySoul || {};
    if (txt(cs.personPortrait)) {
      addBodySlide(pres, {
        kicker: "04  ·  COMMUNITY SOUL",
        title: "Who shows up",
        body: txt(cs.personPortrait)
      });
    }
    if (cs.essentialWords) {
      var ew = cs.essentialWords;
      if (Array.isArray(ew) && ew.length) {
        addTableSlide(pres, {
          kicker: "04  ·  COMMUNITY SOUL",
          title: "Five essential words",
          headers: ["Word", "Cost of saying it"],
          rows: ew.map(function (w) { return [txt(w.word), txt(w.cost)]; }),
          colW: [2.6, COL_W - 2.6]
        });
      } else if (typeof ew === "string" && txt(ew)) {
        addBodySlide(pres, {
          kicker: "04  ·  COMMUNITY SOUL",
          title: "Five essential words",
          body: txt(ew)
        });
      }
    }
    if (txt(cs.unsaidPromise)) {
      addQuoteSlide(pres, {
        kicker: "04  ·  COMMUNITY SOUL",
        quote: txt(cs.unsaidPromise),
        attribution: "The unsaid promise"
      });
    }

    // 05 · Voice & tone code
    var vt = c.voiceToneCode || {};
    if (Array.isArray(vt.principles) && nonEmpty(vt.principles).length) {
      addBulletsSlide(pres, {
        kicker: "05  ·  VOICE & TONE CODE",
        title: "Principles",
        items: vt.principles
      });
    }
    if (Array.isArray(vt.samples) && vt.samples.length) {
      addTableSlide(pres, {
        kicker: "05  ·  VOICE & TONE CODE",
        title: "Voice samples",
        headers: ["Context", "Voice"],
        rows: vt.samples.map(function (s) { return [txt(s.label), txt(s.text)]; }),
        colW: [2.6, COL_W - 2.6]
      });
    }

    // 06 · Cultural position
    var cp = c.culturalPosition || {};
    if (txt(cp.movementInheritance) || txt(cp.contemporaryStance) || txt(cp.refusal)) {
      var cpBody = "";
      if (txt(cp.movementInheritance)) cpBody += "MOVEMENT INHERITANCE  ·  " + txt(cp.movementInheritance) + "\n\n";
      if (txt(cp.contemporaryStance))  cpBody += "CONTEMPORARY STANCE  ·  " + txt(cp.contemporaryStance) + "\n\n";
      if (txt(cp.refusal))             cpBody += "REFUSAL  ·  " + txt(cp.refusal);
      addBodySlide(pres, {
        kicker: "06  ·  CULTURAL POSITION",
        title: "What we inherit. What we refuse.",
        body: cpBody.trim()
      });
    }
    if (txt(cp.signature)) {
      addQuoteSlide(pres, {
        kicker: "06  ·  CULTURAL POSITION",
        quote: txt(cp.signature),
        attribution: "Signature"
      });
    }

    // 07 · Tensions to manage
    if (Array.isArray(c.tensionsToManage) && c.tensionsToManage.length) {
      addTableSlide(pres, {
        kicker: "07  ·  TENSIONS TO MANAGE",
        title: "The contradictions you live with",
        headers: ["Tension", "How to manage"],
        rows: c.tensionsToManage.map(function (t) { return [txt(t.tension), txt(t.managementNote)]; }),
        colW: [3.4, COL_W - 3.4]
      });
    }

    // 08 · Risks & blind spots
    if (Array.isArray(c.risksAndBlindSpots) && c.risksAndBlindSpots.length) {
      addTableSlide(pres, {
        kicker: "08  ·  RISKS & BLIND SPOTS",
        title: "Where it can break",
        headers: ["Risk", "Mitigation"],
        rows: c.risksAndBlindSpots.map(function (r) { return [txt(r.risk), txt(r.mitigation)]; }),
        colW: [3.4, COL_W - 3.4]
      });
    }

    // 09 · Operating principles
    if (Array.isArray(c.operatingPrinciples) && nonEmpty(c.operatingPrinciples).length) {
      addBulletsSlide(pres, {
        kicker: "09  ·  OPERATING PRINCIPLES",
        title: "How we work",
        items: c.operatingPrinciples
      });
    }

    // 10 · Next three moves
    if (Array.isArray(c.nextThreeMoves) && c.nextThreeMoves.length) {
      addTableSlide(pres, {
        kicker: "10  ·  NEXT THREE MOVES",
        title: "What to do next",
        headers: ["Move", "Tool", "Rationale"],
        rows: c.nextThreeMoves.map(function (m) { return [txt(m.move), txt(m.tool), txt(m.rationale)]; }),
        colW: [3.6, 2.4, COL_W - 6.0]
      });
    }

    // Closing directive
    if (txt(c.closingDirective)) {
      addQuoteSlide(pres, {
        kicker: "CLOSING DIRECTIVE",
        quote: txt(c.closingDirective),
        attribution: brandName + "  ·  Brand Soul Map"
      });
    }

    addClosingSlide(pres, {
      kicker: "END OF DECK",
      title: "Built on the soul.  Shipped with the system.",
      note: "Generated by QB BrandOS  ·  app.quantumbranding.ai"
    });
  }

  // ---------- Public API ----------
  function exportPPTX(toolId, data, opts) {
    opts = opts || {};
    var filenameBase = opts.filename || (toolId + (opts.brandName ? "-" + opts.brandName : ""));
    var filename = sanitizeFilename(filenameBase) + ".pptx";

    return loadPptxGen().then(function (Lib) {
      var pres = new Lib();
      pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
      pres.author = "QB BrandOS";
      pres.company = "Quantum Branding";
      pres.title = (opts.brandName ? opts.brandName + " — " : "") + (opts.deckTitle || toolId);

      switch (toolId) {
        case "the-profiles":
          buildProfilesDeck(pres, data, opts); break;
        case "brand-soul-map":
          buildSoulMapDeck(pres, data, opts); break;
        default:
          throw new Error("Unknown tool for PPTX export: " + toolId);
      }
      return pres.writeFile({ fileName: filename }).then(function () { return filename; });
    });
  }

  window.QB_exportPPTX = exportPPTX;
})();
