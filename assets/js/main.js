/* ==========================================================================
   ILORE — Homepage behaviour
   Progressive enhancement only: every section reads correctly without this
   file, JavaScript adds navigation, tabs, the service accordion, scroll
   reveal, scrollspy, the hero value curve and CTA tracking.
   ========================================================================== */
(function () {
  "use strict";

  var SPY_OFFSET = 140;

  /* ------------------------------------------------------------------------
     Analytics helper
     Pushes to the existing dataLayer convention. No third-party library is
     loaded here; a tag manager can consume these events if one is installed.
     ------------------------------------------------------------------------ */
  function track(eventName, detail) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: eventName };
    if (detail) {
      Object.keys(detail).forEach(function (key) {
        payload[key] = detail[key];
      });
    }
    window.dataLayer.push(payload);
  }

  /* ------------------------------------------------------------------------
     Mobile navigation
     ------------------------------------------------------------------------ */
  function initMobileNavigation() {
    var toggle = document.getElementById("menuToggle");
    var menu = document.getElementById("mobileMenu");
    if (!toggle || !menu) return;

    function setOpen(isOpen) {
      menu.hidden = !isOpen;
      // The button's content is the hamburger, which the stylesheet turns into
      // a cross off aria-expanded, so the label is what has to carry the change
      // in wording for anyone who cannot see that happen.
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    }

    toggle.addEventListener("click", function () {
      setOpen(menu.hidden);
    });

    // Selecting a destination closes the menu.
    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !menu.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Clicking anywhere outside the header dismisses the menu.
    document.addEventListener("click", function (event) {
      if (menu.hidden) return;
      if (event.target.closest(".site-header")) return;
      setOpen(false);
    });

    // Returning to desktop widths always resets to the closed state.
    // Whether we are in the mobile range is read from the stylesheet — the
    // toggle is only rendered below the breakpoint — so the breakpoint lives
    // in exactly one place. Resizes that stay within the mobile range (the
    // on-screen keyboard, the mobile URL bar) leave an open menu alone.
    window.addEventListener(
      "resize",
      function () {
        var mobileNavActive = toggle.getClientRects().length > 0;
        if (!menu.hidden && !mobileNavActive) setOpen(false);
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------------
     Academy tabs — mouse, touch and full keyboard support
     ------------------------------------------------------------------------ */
  function initTabs() {
    var tabList = document.querySelector('[role="tablist"]');
    if (!tabList) return;

    var tabs = Array.prototype.slice.call(tabList.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function selectTab(tab, moveFocus) {
      tabs.forEach(function (candidate) {
        var isSelected = candidate === tab;
        var panel = document.getElementById(candidate.getAttribute("aria-controls"));
        candidate.setAttribute("aria-selected", String(isSelected));
        candidate.tabIndex = isSelected ? 0 : -1;
        if (panel) panel.hidden = !isSelected;
      });
      if (moveFocus) tab.focus();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        selectTab(tab, false);
      });

      tab.addEventListener("keydown", function (event) {
        var lastIndex = tabs.length - 1;
        var nextIndex = null;

        switch (event.key) {
          case "ArrowRight":
          case "ArrowDown":
            nextIndex = index === lastIndex ? 0 : index + 1;
            break;
          case "ArrowLeft":
          case "ArrowUp":
            nextIndex = index === 0 ? lastIndex : index - 1;
            break;
          case "Home":
            nextIndex = 0;
            break;
          case "End":
            nextIndex = lastIndex;
            break;
          default:
            return;
        }

        event.preventDefault();
        selectTab(tabs[nextIndex], true);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Transform accordion — one service open at a time
     ------------------------------------------------------------------------ */
  function initAccordion() {
    var lists = Array.prototype.slice.call(document.querySelectorAll(".flow"));
    lists.forEach(initFlowList);
  }

  function initFlowList(list) {
    var items = Array.prototype.slice.call(list.querySelectorAll(".flow__item"));
    if (!items.length) return;

    function setOpenItem(item) {
      items.forEach(function (candidate) {
        var isOpen = candidate === item;
        var candidateToggle = candidate.querySelector(".flow__toggle");
        candidate.classList.toggle("is-open", isOpen);
        if (candidateToggle) candidateToggle.setAttribute("aria-expanded", String(isOpen));
      });
    }

    // Reserve the height of the tallest expanded state, so opening a service
    // only moves the rows inside the panel — never the panel, the columns
    // beside it or the sections around it.
    //
    // Nothing is opened to work that out. A collapsed body is a grid row of
    // 0fr around an inner element that still holds its content, so
    // `scrollHeight` reports what that service would occupy if it were open,
    // and subtracting each row's currently rendered body height leaves the
    // list's fully collapsed height. Reading instead of toggling keeps the
    // measurement free of any state the visitor could catch sight of, and
    // makes it safe to run part-way through an open/close animation.
    //
    // The stylesheet decides where the reservation is honoured, so the
    // breakpoint does not have to be repeated here.
    function reserveTallestState() {
      var collapsed = 0;
      var tallestBody = 0;

      items.forEach(function (item) {
        var body = item.querySelector(".flow__body");
        var inner = item.querySelector(".flow__body-inner");
        var bodyHeight = body ? body.getBoundingClientRect().height : 0;
        collapsed += item.getBoundingClientRect().height - bodyHeight;
        if (inner) tallestBody = Math.max(tallestBody, inner.scrollHeight);
      });

      list.style.setProperty("--flow-reserve", Math.ceil(collapsed + tallestBody) + "px");
    }

    items.forEach(function (item) {
      var toggle = item.querySelector(".flow__toggle");
      if (!toggle) return;

      toggle.addEventListener("click", function () {
        setOpenItem(item);
      });
    });

    reserveTallestState();

    // Re-measure whenever the copy could have re-wrapped: a width change, or
    // the web fonts arriving after the first measurement. Height-only resizes
    // — a mobile URL bar, an on-screen keyboard — cannot rewrap anything.
    var lastWidth = window.innerWidth;
    var pending = false;
    window.addEventListener(
      "resize",
      function () {
        if (window.innerWidth === lastWidth || pending) return;
        pending = true;
        window.requestAnimationFrame(function () {
          pending = false;
          lastWidth = window.innerWidth;
          reserveTallestState();
        });
      },
      { passive: true }
    );

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(reserveTallestState);
    }
  }

  /* ------------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------------ */
  function initScrollReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!targets.length) return;

    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function revealAll() {
      targets.forEach(function (target) {
        target.classList.add("is-visible");
      });
    }

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    // Only hide content once we know we can bring it back.
    document.documentElement.classList.add("reveal-ready");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  /* ------------------------------------------------------------------------
     Scrollspy
     One passive scroll listener, throttled to animation frames.
     ------------------------------------------------------------------------ */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".site-nav__link"));
    var entries = links
      .map(function (link) {
        var href = link.getAttribute("href") || "";
        if (href.charAt(0) !== "#") return null;
        var section = document.getElementById(href.slice(1));
        return section ? { link: link, section: section } : null;
      })
      .filter(Boolean);

    if (!entries.length) return;

    var ticking = false;

    function update() {
      ticking = false;
      var current = null;

      entries.forEach(function (entry) {
        if (entry.section.getBoundingClientRect().top <= SPY_OFFSET) current = entry;
      });

      entries.forEach(function (entry) {
        var isCurrent = entry === current;
        entry.link.classList.toggle("is-current", isCurrent);
        if (isCurrent) {
          entry.link.setAttribute("aria-current", "true");
        } else {
          entry.link.removeAttribute("aria-current");
        }
      });
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------------
     CTA tracking
     ------------------------------------------------------------------------ */
  function initCtaTracking() {
    document.addEventListener("click", function (event) {
      var cta = event.target.closest("[data-cta]");
      if (!cta) return;
      track("cta_click", {
        cta: cta.getAttribute("data-cta"),
        href: cta.getAttribute("href")
      });
    });
  }

  initMobileNavigation();
  initTabs();
  initAccordion();
  initScrollReveal();
  initScrollSpy();
  initCtaTracking();
})();

/* ====================================================================
   ILORE hero visual — "The value curve" — BEHAVIOUR (for main.js)

   Add this IIFE alongside the other behaviours in main.js. Like every
   behaviour in that file it no-ops when its markup is absent, so
   assessment.html is unaffected.

   What it draws:
   - Grey stray lines wander in low on the left (scattered experiments)
     and braid into one accent curve — a tapered ribbon that thickens
     and deepens in colour as it climbs — ending at a summit dot.
   - Three of the strays survive the merge as faint filaments braided
     around the spine, converging to zero at the summit.
   - Milestones (DOM links) are positioned onto the curve's inflection
     points and rotated to its local slope.
   - Opening scene, once per pageview: strays fade in, the curve draws
     itself led by a comet tip, labels spring in as the tip passes,
     the summit lands with a one-time double ring burst.
   - Idle: gentle breathing + summit pulse. Cursor: ripple within
     ~120px, scrub guideline + dot + phase name. Milestone hover paints
     its exact segment of the curve.
   - Gridlines, baseline and the scrub guideline skip the labels'
     measured bounding boxes: no line is ever drawn through text.
   - Reduced motion or coarse pointer: one static final frame.
   - All colours are read from base.css tokens at init — no literals.
===================================================================== */
(function () {
  var hero = document.querySelector(".hero");
  var stage = document.getElementById("heroStage");
  var canvas = document.getElementById("heroCurveCanvas");
  if (!hero || !stage || !canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var milestones = [
    document.getElementById("heroMs0"),
    document.getElementById("heroMs1"),
    document.getElementById("heroMs2")
  ];
  var terminal = document.getElementById("heroTerminal");
  if (!milestones[0] || !milestones[1] || !milestones[2] || !terminal) return;

  /* ------------------------------------------------------------------
     Tokens → rgb strings. Every colour comes from base.css.
     ------------------------------------------------------------------ */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  function hexToRgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return (
      parseInt(hex.substr(0, 2), 16) +
      "," +
      parseInt(hex.substr(2, 2), 16) +
      "," +
      parseInt(hex.substr(4, 2), 16)
    );
  }

  var ACCENT = hexToRgb(cssVar("--color-accent", "#a84622"));
  var ACCENT_DEEP = hexToRgb(cssVar("--color-accent-hover", "#8f3819"));
  var INK = hexToRgb(cssVar("--color-accent-ink", "#7e351c"));
  var MUTED = hexToRgb(cssVar("--color-text-muted", "#92949d"));
  var GRID = hexToRgb(cssVar("--color-border", "#e8e8eb"));
  var GROUND = hexToRgb(cssVar("--color-border-strong", "#d9dade"));

  /* ------------------------------------------------------------------
     Tuning
     ------------------------------------------------------------------ */
  var MS_NX = [0.46, 0.64, 0.82]; // milestone inflection positions
  var PHASE_NAMES = ["Experimentation", "Learn", "Implement", "Grow"];
  var STRAYS = 5;
  var SEGS = 160;
  /* Beyond the summit the line keeps its own tangent, easing off over
     TAIL_K of normalised width so it leaves the frame at the right edge
     instead of stopping on a seam. Slope is read off valueAt's last term,
     so the tail cannot drift out of step with the shape it continues. */
  var TAIL_SLOPE = (0.44 * 1.55) / (1 - MS_NX[2]);
  var TAIL_K = 0.05;
  var TAIL_MS = 520; // the tail grows out of the summit as the burst rings do
  /* The ruling belongs to the climb, not to the copy. It is worth nothing
     left of GRID_IN and at full strength by GRID_FULL — which is Transform
     — so the grid reads across Transform → Discover → the summit and the
     headline, the lede and the buttons sit on clean paper. Both are
     normalised positions, so the relationship holds at every width. */
  var GRID_IN = 0.52;
  var GRID_FULL = MS_NX[1];
  var GRID_ALPHA = 0.65;
  var CURSOR_R = 120; // ripple reach, px
  var CURSOR_PUSH = 14; // ripple strength, px
  var DRAW_MS = 1500; // opening draw duration
  var STRAY_LEAD_MS = 380; // strays fade in before the draw

  var W = 0,
    H = 0,
    dpr = 1;
  var strays = [];
  var pointer = { x: -9999, y: -9999, inside: false };
  var scrub = { x: -1 };
  var rafId = null,
    running = false;
  var bornAt = -1,
    introDone = false,
    burstAt = -1;
  var hotSeg = -1;
  var stacked = false;
  var gutter = 52;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var stackQuery = window.matchMedia("(max-width: 1120px)");

  /* ------------------------------------------------------------------
     Maths + geometry
     ------------------------------------------------------------------ */
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function clamp(v, a, b) {
    return Math.min(Math.max(v, a), b);
  }
  function easeInOut(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /* Two alignments, deliberately separate.

     plot() is the CONTENT grid: it stops at the site's own gutter
     (--container-padding, which already narrows on phones) at both ends.
     Everything that carries meaning — the curve's shape, the milestone
     anchors, the summit and the axis caption — is measured in this box, so
     no label can ever be cropped and none of it moves.

     The lines themselves are FULL BLEED. nxAtX() converts the viewport's
     own edges back into the same normalised space, which lets the
     gridlines, the baseline and the trajectory run to the screen without
     the shape, the labels or the nodes shifting by a pixel. */
  function plot() {
    return {
      left: gutter,
      right: W - gutter,
      top: stacked ? 60 : 100,
      bottom: H - (stacked ? 66 : 80)
    };
  }

  function nxAtX(x, p) {
    var span = p.right - p.left;
    return span > 0 ? (x - p.left) / span : 0;
  }

  /* Sample index of a given nx, once the sample grid starts left of zero. */
  function firstIndex(p) {
    return Math.floor(nxAtX(0, p) * SEGS);
  }
  function indexOf(nx, p) {
    return Math.ceil(nx * SEGS) - firstIndex(p);
  }

  /* Value shape: quiet floor, then three inflections — one per
     division — each steeper than the last. Pure shape, no data. */
  function valueAt(nx) {
    /* Past the summit: the same tangent, easing off. The shape inside the
       plot is untouched; this only exists so the line can leave the frame.
       Left of the plot every term below already clamps to zero, so the
       quiet floor extends to the viewport edge on its own. */
    if (nx > 1) {
      return (
        0.95 + TAIL_SLOPE * TAIL_K * (1 - Math.exp(-(nx - 1) / TAIL_K))
      );
    }
    var v = 0.05 + 0.02 * smooth(clamp(nx / 0.4, 0, 1));
    v += 0.16 * smooth(clamp((nx - MS_NX[0]) / (MS_NX[1] - MS_NX[0]), 0, 1));
    v += 0.28 * smooth(clamp((nx - MS_NX[1]) / (MS_NX[2] - MS_NX[1]), 0, 1));
    v += 0.44 * Math.pow(clamp((nx - MS_NX[2]) / (1 - MS_NX[2]), 0, 1), 1.55);
    return v; /* 0.05 → ~0.95 */
  }

  function xAt(nx, p) {
    return p.left + nx * (p.right - p.left);
  }
  function yAt(nx, p) {
    return p.bottom - valueAt(nx) * (p.bottom - p.top);
  }
  /* Clamped, so the full-bleed tails carry the stroke weight of the end
     they continue rather than smooth()'s behaviour outside [0,1]. */
  function widthAt(nx) {
    return 1.7 + 2.1 * smooth(clamp(nx, 0, 1)); /* thickens as value compounds */
  }

  function build() {
    stacked = stackQuery.matches;
    /* Read once per layout rather than per frame. It is the same token the
       site's container uses, so the plot's edges track the site's gutter. */
    gutter = parseFloat(cssVar("--container-padding", "52px")) || 52;
    var rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    strays = [];
    for (var i = 0; i < STRAYS; i++) {
      strays.push({
        lane: (i + 1) / (STRAYS + 1),
        f: 1.6 + Math.random() * 2.2,
        p: Math.random() * Math.PI * 2,
        drift: 0.3 + Math.random() * 0.4,
        end: 0.42 * (0.7 + Math.random() * 0.5)
      });
    }
    positionMarkers();
  }

  /* Milestones + terminal are DOM — placed onto the curve; each label
     is rotated to the curve's local slope so it rides the line. */
  function positionMarkers() {
    var p = plot();
    for (var i = 0; i < milestones.length; i++) {
      var nx = MS_NX[i];
      var ms = milestones[i];
      ms.style.left = xAt(nx, p) + "px";
      ms.style.top = yAt(nx, p) + "px";
      var e = 0.02;
      var dx = xAt(nx + e, p) - xAt(nx - e, p);
      var dy = yAt(nx + e, p) - yAt(nx - e, p);
      ms.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
    }
    terminal.style.left = xAt(1, p) + 6 + "px";
    terminal.style.top = yAt(1, p) + "px";
  }

  /* ------------------------------------------------------------------
     Text protection: measured label boxes; lines are drawn in
     segments that skip them.
     ------------------------------------------------------------------ */
  function labelRects() {
    var sr = stage.getBoundingClientRect();
    var rects = [];

    function add(el, padX, padY) {
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      rects.push({
        left: r.left - sr.left - padX,
        right: r.right - sr.left + padX,
        top: r.top - sr.top - padY,
        bottom: r.bottom - sr.top + padY
      });
    }

    for (var i = 0; i < milestones.length; i++) {
      add(milestones[i].querySelector(".ms__label"), 10, 6);
    }
    /* The summit chip needs the same protection the milestone labels get —
       no line is drawn through any of them. */
    add(terminal, 10, 6);
    return rects;
  }

  function drawHAvoid(y, x0, x1, rects) {
    var blocks = [];
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (y > r.top && y < r.bottom) blocks.push([r.left, r.right]);
    }
    blocks.sort(function (a, b) {
      return a[0] - b[0];
    });
    ctx.beginPath();
    var cur = x0;
    for (var b = 0; b < blocks.length; b++) {
      var bs = Math.max(blocks[b][0], x0),
        be = Math.min(blocks[b][1], x1);
      if (be <= cur) continue;
      if (bs > cur) {
        ctx.moveTo(cur, y);
        ctx.lineTo(bs, y);
      }
      cur = Math.max(cur, be);
    }
    if (cur < x1) {
      ctx.moveTo(cur, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
  }

  function drawVAvoid(x, y0, y1, rects) {
    var blocks = [];
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x > r.left && x < r.right) blocks.push([r.top, r.bottom]);
    }
    blocks.sort(function (a, b) {
      return a[0] - b[0];
    });
    ctx.beginPath();
    var cur = y0;
    for (var b = 0; b < blocks.length; b++) {
      var bs = Math.max(blocks[b][0], y0),
        be = Math.min(blocks[b][1], y1);
      if (be <= cur) continue;
      if (bs > cur) {
        ctx.moveTo(x, cur);
        ctx.lineTo(x, bs);
      }
      cur = Math.max(cur, be);
    }
    if (cur < y1) {
      ctx.moveTo(x, cur);
      ctx.lineTo(x, y1);
    }
    ctx.stroke();
  }

  /* ------------------------------------------------------------------
     Interaction + curve sampling
     ------------------------------------------------------------------ */
  function ripple(x, y) {
    if (!pointer.inside) return 0;
    var dx = x - pointer.x,
      dy = y - pointer.y;
    var d2 = dx * dx + dy * dy;
    if (d2 >= CURSOR_R * CURSOR_R) return 0;
    var fall = 1 - Math.sqrt(d2) / CURSOR_R;
    return (dy >= 0 ? 1 : -1) * fall * fall * CURSOR_PUSH;
  }

  /* Sampled from the viewport's left edge to wherever the drawing has
     reached — one array, so the tails are the same ribbon rather than
     patches stitched onto its ends. `reach` is the opening draw's head:
     it runs the plot as before, then continues past the summit over
     TAIL_MS while the burst rings expand, so nothing pops into place. */
  function curvePoints(p, time, prog, reach) {
    var pts = [];
    var i0 = firstIndex(p);
    /* Rounded outwards once the draw is past the summit, so the last
       sample lands on or beyond the edge and the line has no short fall. */
    var iEnd = Math.max(
      i0 + 1,
      prog < 1 ? Math.floor(reach * SEGS) : Math.ceil(reach * SEGS)
    );
    for (var i = i0; i <= iEnd; i++) {
      var nx = i / SEGS;
      var x = xAt(nx, p);
      var y = yAt(nx, p);
      if (introDone) {
        y += Math.sin(nx * Math.PI * 3 + time * 0.5) * 2 * (1 - nx * 0.6);
      }
      y += ripple(x, y);
      pts.push({ x: x, y: y, nx: nx });
    }
    return pts;
  }

  /* The colour journey, re-expressed in viewport space. The three stops
     land on exactly the same x they always did, so the ribbon inside the
     plot is pixel-identical; the two added stops fade the lead-in out at
     the left edge and hold the summit's colour out to the right one. */
  function bleedGradient(stops) {
    var g = ctx.createLinearGradient(0, 0, W, 0);
    for (var i = 0; i < stops.length; i++) {
      g.addColorStop(clamp(stops[i][0] / W, 0, 1), stops[i][1]);
    }
    return g;
  }

  function ribbonGradient(p) {
    return bleedGradient([
      [0, "rgba(" + MUTED + ",0)"],
      [p.left, "rgba(" + MUTED + ",0.55)"],
      [xAt(0.35, p), "rgba(" + ACCENT + ",0.9)"],
      [p.right, "rgba(" + ACCENT_DEEP + ",1)"],
      [W, "rgba(" + ACCENT_DEEP + ",1)"]
    ]);
  }

  function strokePath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  /* The tapered ribbon: a polygon offset above/below the spine by
     half the local width, filled with the colour journey. */
  function drawRibbon(pts, p) {
    if (pts.length < 3) return;
    var top = [],
      bot = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(i - 1, 0)];
      var b = pts[Math.min(i + 1, pts.length - 1)];
      var dx = b.x - a.x,
        dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nxv = -dy / len,
        nyv = dx / len;
      var w = widthAt(pts[i].nx) / 2;
      top.push({ x: pts[i].x + nxv * w, y: pts[i].y + nyv * w });
      bot.push({ x: pts[i].x - nxv * w, y: pts[i].y - nyv * w });
    }
    var grad = ribbonGradient(p);
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (var t = 1; t < top.length; t++) ctx.lineTo(top[t].x, top[t].y);
    for (var u = bot.length - 1; u >= 0; u--) ctx.lineTo(bot[u].x, bot[u].y);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  /* ------------------------------------------------------------------
     Frame
     ------------------------------------------------------------------ */
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    var time = t / 1000;
    var p = plot();

    /* Opening progress — once per pageview. */
    var prog = 1;
    if (!introDone) {
      if (bornAt < 0) bornAt = t;
      var elapsed = t - bornAt;
      prog = easeInOut((elapsed - STRAY_LEAD_MS) / DRAW_MS);
      for (var mi = 0; mi < milestones.length; mi++) {
        if (prog >= MS_NX[mi]) milestones[mi].classList.add("is-in");
      }
      if (prog >= 1) {
        terminal.classList.add("is-in");
        if (burstAt < 0) burstAt = t;
        if (t - burstAt > 900) introDone = true;
      }
    }
    var strayAlpha = introDone
      ? 1
      : clamp((t - bornAt) / STRAY_LEAD_MS, 0, 1);

    /* Gridlines — the visualisation's own ruling, and only that. They
       start out of nothing at GRID_IN and are at full strength by
       Transform, so there is no edge to see and nothing is drawn behind
       the copy; from there they carry on to the screen with the curve.
       They still skip the measured label boxes. */
    var rects = labelRects();
    var gridFrom = xAt(GRID_IN, p);
    ctx.strokeStyle = bleedGradient([
      [gridFrom, "rgba(" + GRID + ",0)"],
      [xAt(GRID_FULL, p), "rgba(" + GRID + "," + GRID_ALPHA + ")"],
      [W, "rgba(" + GRID + "," + GRID_ALPHA + ")"]
    ]);
    ctx.lineWidth = 1;
    for (var g = 1; g <= 3; g++) {
      var gy = p.top + ((p.bottom - p.top) * g) / 4;
      drawHAvoid(gy, gridFrom, W, rects);
    }

    /* Baseline with milestone ticks — the chart's ground, not ruling. It
       belongs to the curve and behaves like it: full bleed to the right,
       dissolving into the left edge over the gutter. It sits below the
       whole copy block, so nothing of it passes behind the text. */
    ctx.strokeStyle = bleedGradient([
      [0, "rgba(" + GROUND + ",0)"],
      [p.left, "rgba(" + GROUND + ",0.9)"],
      [W, "rgba(" + GROUND + ",0.9)"]
    ]);
    drawHAvoid(p.bottom + 14, 0, W, rects);
    for (var ti = 0; ti < MS_NX.length; ti++) {
      var tkx = xAt(MS_NX[ti], p);
      ctx.beginPath();
      ctx.moveTo(tkx, p.bottom + 10);
      ctx.lineTo(tkx, p.bottom + 18);
      ctx.stroke();
    }

    /* How far the line has been drawn. Inside the plot this is the opening
       draw; once it lands, it carries on past the summit to the right edge
       of the viewport over TAIL_MS, under the burst. */
    var nxMax = nxAtX(W, p);
    var tailProg = introDone
      ? 1
      : burstAt < 0
        ? 0
        : easeInOut((t - burstAt) / TAIL_MS);
    var reach = prog < 1 ? prog : 1 + (nxMax - 1) * tailProg;
    var pts = curvePoints(p, time, prog, reach);

    /* Strays: absorbed into the spine as it forms. They wander in from the
       viewport edge and fade up out of it, so the floor has no start seam. */
    for (var i = 0; i < strays.length; i++) {
      var st = strays[i];
      ctx.beginPath();
      var started = false;
      for (var s = firstIndex(p); s <= SEGS; s++) {
        var nx = s / SEGS;
        if (nx > st.end || nx > prog) break;
        var x = xAt(nx, p);
        var merge = smooth(clamp(nx / st.end, 0, 1));
        var floorY =
          p.bottom - (0.02 + st.lane * 0.1) * (p.bottom - p.top);
        var wob =
          Math.sin(nx * Math.PI * 2 * st.f + time * st.drift + st.p) *
          6 *
          (1 - merge);
        var y = floorY + (yAt(nx, p) - floorY) * merge + wob + ripple(x, floorY);
        if (started) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        started = true;
      }
      var strayA = (0.3 - i * 0.03) * strayAlpha;
      ctx.strokeStyle = bleedGradient([
        [0, "rgba(" + MUTED + ",0)"],
        [p.left, "rgba(" + MUTED + "," + strayA + ")"],
        [W, "rgba(" + MUTED + "," + strayA + ")"]
      ]);
      ctx.lineWidth = 1;
      ctx.stroke();

      /* The wire lives on: a faint filament braided around the spine,
         weaving close through the climb and converging at the summit.
         The experiments are aligned and carried, not discarded. */
      if (i % 2 === 0 && pts.length > 2) {
        ctx.beginPath();
        var fStarted = false;
        var startIdx = Math.max(0, indexOf(st.end, p));
        for (var fj = startIdx; fj < pts.length; fj++) {
          var fnx = pts[fj].nx;
          /* The filaments converge at the summit and end there — they must
             not ride the tail out as a grey line over the accent. */
          if (fnx > 1) break;
          var uu = clamp((fnx - st.end) / (1 - st.end), 0, 1);
          var env = Math.sin(Math.PI * uu); /* 0 → bloom → 0 */
          var weave =
            Math.sin(
              fnx * Math.PI * 2 * st.f * 0.8 + time * st.drift * 0.6 + st.p
            ) *
            6.5 *
            env;
          var fy = pts[fj].y + weave;
          if (fStarted) ctx.lineTo(pts[fj].x, fy);
          else ctx.moveTo(pts[fj].x, fy);
          fStarted = true;
        }
        ctx.strokeStyle = "rgba(" + MUTED + "," + 0.16 * strayAlpha + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* Soft fill under the climb — the tint. It follows the line out to the
       viewport's right edge and closes 2px past it, so the colour bleeds off
       the screen instead of stopping on a vertical seam. It still starts at
       the first milestone: the tint belongs to the climb, not to the floor,
       and letting it run left as well would put a wash behind the copy. */
    if (pts.length > 2 && pts[pts.length - 1].nx > MS_NX[0]) {
      var fillEnd = pts[pts.length - 1];
      var bleedX = fillEnd.nx >= 1 ? W + 2 : fillEnd.x;
      ctx.beginPath();
      var f0i = Math.max(0, indexOf(MS_NX[0], p));
      ctx.moveTo(pts[Math.min(f0i, pts.length - 1)].x, p.bottom);
      for (var fi = f0i; fi < pts.length; fi++) {
        ctx.lineTo(pts[fi].x, pts[fi].y);
      }
      ctx.lineTo(bleedX, fillEnd.y);
      ctx.lineTo(bleedX, p.bottom);
      ctx.closePath();
      var fillGrad = ctx.createLinearGradient(0, p.top, 0, p.bottom);
      fillGrad.addColorStop(0, "rgba(" + ACCENT + ",0.07)");
      fillGrad.addColorStop(1, "rgba(" + ACCENT + ",0)");
      ctx.fillStyle = fillGrad;
      ctx.fill();
    }

    /* One glow pass beneath the ribbon — no per-segment shadows. It runs
       the full bleed with the line, at the same restrained 0.10, and fades
       out with the lead-in rather than ending on the gutter. */
    strokePath(pts);
    ctx.strokeStyle = bleedGradient([
      [0, "rgba(" + ACCENT + ",0)"],
      [p.left, "rgba(" + ACCENT + ",0.10)"],
      [W, "rgba(" + ACCENT + ",0.10)"]
    ]);
    ctx.lineWidth = 9;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    drawRibbon(pts, p);

    /* Hot segment: the division under hover claims its stretch. */
    if (hotSeg >= 0 && introDone) {
      var h0 = MS_NX[hotSeg];
      var h1 = hotSeg < 2 ? MS_NX[hotSeg + 1] : 1;
      var hp = [];
      for (var hi = 0; hi < pts.length; hi++) {
        if (pts[hi].nx >= h0 && pts[hi].nx <= h1) hp.push(pts[hi]);
      }
      if (hp.length > 1) {
        strokePath(hp);
        ctx.strokeStyle = "rgba(" + ACCENT_DEEP + ",0.35)";
        ctx.lineWidth = widthAt(h1) + 5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    /* Comet tip during the opening draw. */
    if (!introDone && prog > 0 && prog < 1 && pts.length > 1) {
      var tip = pts[pts.length - 1];
      var halo = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 26);
      halo.addColorStop(0, "rgba(" + ACCENT + ",0.35)");
      halo.addColorStop(1, "rgba(" + ACCENT + ",0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgb(" + ACCENT + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    /* Summit: one-time double ring burst, then a calm pulse. */
    var sx = xAt(1, p),
      sy = yAt(1, p);
    if (prog >= 1) {
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(" + ACCENT_DEEP + ")";
      ctx.fill();

      if (burstAt > 0 && t - burstAt < 900) {
        for (var ring = 0; ring < 2; ring++) {
          var bt = clamp((t - burstAt - ring * 160) / 700, 0, 1);
          if (bt > 0 && bt < 1) {
            ctx.beginPath();
            ctx.arc(sx, sy, 6 + bt * 30, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(" + ACCENT + "," + 0.35 * (1 - bt) + ")";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      } else {
        var pulse = (Math.sin(time * 1.5) + 1) / 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 8 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle =
          "rgba(" + ACCENT + "," + (0.28 - pulse * 0.14) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* Scrub: eased guideline + dot + the phase you're standing in. */
    if (introDone && pointer.inside && !stacked) {
      /* Held to the plot rather than the bleed: the guideline is the one
         other vertical the hero draws, and it has no business running out
         to the screen edges. */
      var target = clamp(pointer.x, p.left, p.right);
      scrub.x = scrub.x < 0 ? target : scrub.x + (target - scrub.x) * 0.18;
      var snx = nxAtX(scrub.x, p);
      var scy = yAt(snx, p);

      ctx.strokeStyle = "rgba(" + ACCENT + ",0.13)";
      ctx.setLineDash([3, 5]);
      drawVAvoid(scrub.x, p.top - 4, p.bottom + 10, rects);
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(scrub.x, scy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "rgb(" + ACCENT + ")";
      ctx.lineWidth = 2;
      ctx.stroke();

      /* The phase caption rides the axis strip, below the baseline. At the
         top of the plot it shared a band with the badge and the headline,
         and since the canvas sits below the copy it was the caption that
         lost — the copy simply covered it. Down here it belongs to the
         axis, tracks the cursor across the whole width, and nothing can be
         drawn or laid out over it. */
      var phase = PHASE_NAMES[0];
      if (snx >= MS_NX[2]) phase = PHASE_NAMES[3];
      else if (snx >= MS_NX[1]) phase = PHASE_NAMES[2];
      else if (snx >= MS_NX[0]) phase = PHASE_NAMES[1];
      ctx.font = '500 9px "Spline Sans Mono", monospace';
      try {
        ctx.letterSpacing = "1.2px";
      } catch (e) {}
      ctx.fillStyle = "rgb(" + INK + ")";
      var label = phase.toUpperCase();
      var tw = ctx.measureText(label).width;
      var lx = clamp(scrub.x + 10, p.left, p.right - tw - 4);
      ctx.fillText(label, lx, p.bottom + 30);
    } else {
      scrub.x = -1;
    }
  }

  /* ------------------------------------------------------------------
     Lifecycle
     ------------------------------------------------------------------ */
  function finalFrame() {
    introDone = true;
    for (var i = 0; i < milestones.length; i++) {
      milestones[i].classList.add("is-in");
    }
    terminal.classList.add("is-in");
    draw(1e7);
  }

  function loop(t) {
    draw(t);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    if (reduceMotion.matches || !finePointer.matches) {
      finalFrame();
      return;
    }
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  hero.addEventListener("pointermove", function (e) {
    var rect = stage.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.inside =
      pointer.x >= 0 && pointer.y >= 0 && pointer.x <= W && pointer.y <= H;
  });
  hero.addEventListener("pointerleave", function () {
    pointer.inside = false;
    pointer.x = pointer.y = -9999;
  });

  milestones.forEach(function (ms, i) {
    ms.addEventListener("pointerenter", function () {
      hotSeg = i;
    });
    ms.addEventListener("pointerleave", function () {
      hotSeg = -1;
    });
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) start();
        else stop();
      },
      { threshold: 0.05 }
    ).observe(stage);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", function () {
      stop();
      build();
      start();
    });
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      stop();
      build();
      /* After a resize, never replay the intro. */
      if (introDone || bornAt > 0) {
        bornAt = -1;
        introDone = true;
        burstAt = 1;
      }
      start();
    }, 150);
  });

  build();
  start();
})();
