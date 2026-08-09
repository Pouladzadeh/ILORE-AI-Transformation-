/* ==========================================================================
   ILORE — Homepage behaviour
   Progressive enhancement only: every section reads correctly without this
   file, JavaScript adds navigation, tabs, the service accordion, scroll
   reveal, scrollspy, the hero signal parallax and CTA tracking.
   ========================================================================== */
(function () {
  "use strict";

  var SPY_OFFSET = 140;
  var PARALLAX_MAX = 4;

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
    var list = document.querySelector(".flow");
    if (!list) return;

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
     Hero signal parallax
     Nudges the whole diagram by at most PARALLAX_MAX px against the pointer.
     Decoration only: skipped entirely without a fine pointer, and whenever
     reduced motion is asked for. The easing lives on .signal in CSS.
     ------------------------------------------------------------------------ */
  function initHeroParallax() {
    var group = document.querySelector(".signal");
    if (!group) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var hero = group.closest(".hero");
    if (!hero) return;

    var offsetX = 0;
    var offsetY = 0;
    var frame = 0;

    function apply() {
      frame = 0;
      group.style.transform = "translate3d(" + offsetX + "px, " + offsetY + "px, 0)";
    }

    function requestApply() {
      if (!frame) frame = window.requestAnimationFrame(apply);
    }

    function axis(position, start, size) {
      if (!size) return 0;
      // -1 at the near edge, +1 at the far edge, then scaled and rounded so
      // we are not writing a new transform for every sub-pixel of movement.
      var ratio = ((position - start) / size) * 2 - 1;
      return Math.round(ratio * PARALLAX_MAX * 10) / 10;
    }

    hero.addEventListener(
      "mousemove",
      function (event) {
        var rect = hero.getBoundingClientRect();
        offsetX = axis(event.clientX, rect.left, rect.width);
        offsetY = axis(event.clientY, rect.top, rect.height);
        requestApply();
      },
      { passive: true }
    );

    hero.addEventListener("mouseleave", function () {
      offsetX = 0;
      offsetY = 0;
      requestApply();
    });
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
  initHeroParallax();
  initCtaTracking();
})();
