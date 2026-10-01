/* Detail popover. Hover or focus opens it. Click pins it. Esc closes it.
   No fetch. One control for planner cards, Studio rows, and canvas nodes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && typeof root === "object") root.InfoPop = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  let pinned = null;
  let hover = null;
  let installed = false;

  function panelFor(btn) {
    if (!btn) return null;
    const id = btn.getAttribute("aria-controls");
    if (id) return document.getElementById(id);
    const parent = btn.parentElement;
    return parent ? parent.querySelector(".info-pop") : null;
  }

  function closeBtn(btn) {
    if (!btn) return;
    const pop = panelFor(btn);
    if (pop) pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (pinned === btn) pinned = null;
    if (hover === btn) hover = null;
  }

  function open(btn, mode) {
    const pop = panelFor(btn);
    if (!pop) return;
    document.querySelectorAll(".info-btn[aria-expanded='true']").forEach(function (other) {
      if (other !== btn) closeBtn(other);
    });
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    if (mode === "pin") pinned = btn;
    else hover = btn;
  }

  function install() {
    if (installed || typeof document === "undefined") return;
    installed = true;
    document.addEventListener("mouseover", function (event) {
      const btn = event.target.closest && event.target.closest(".info-btn");
      if (!btn || btn === pinned) return;
      open(btn, "hover");
    });
    document.addEventListener("mouseout", function (event) {
      const btn = event.target.closest && event.target.closest(".info-btn");
      if (!btn || btn === pinned) return;
      const pop = panelFor(btn);
      const next = event.relatedTarget;
      if (next && (btn.contains(next) || (pop && pop.contains(next)))) return;
      if (hover === btn) closeBtn(btn);
    });
    document.addEventListener("focusin", function (event) {
      const btn = event.target.closest && event.target.closest(".info-btn");
      if (btn && btn !== pinned) open(btn, "hover");
    });
    document.addEventListener("focusout", function (event) {
      const btn = event.target.closest && event.target.closest(".info-btn");
      if (!btn || btn === pinned) return;
      const pop = panelFor(btn);
      const next = event.relatedTarget;
      if (next && ((pop && pop.contains(next)) || btn.contains(next))) return;
      if (hover === btn) closeBtn(btn);
    });
    document.addEventListener("click", function (event) {
      const btn = event.target.closest && event.target.closest(".info-btn");
      if (btn) {
        event.preventDefault();
        event.stopPropagation();
        if (pinned === btn) closeBtn(btn);
        else open(btn, "pin");
        return;
      }
      if (!pinned) return;
      const pop = panelFor(pinned);
      if (pop && event.target.closest && event.target.closest(".info-pop") === pop) return;
      closeBtn(pinned);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!pinned && !hover) return;
      closeBtn(pinned || hover);
      event.preventDefault();
    });
  }

  return { install: install };
});
