/* Object map overlay. Nodes, typed edges, pan and zoom, side panel, merge clicks.
   Reuses the i popover and netie.skin-state/1. No fetch. Never sets certified. */
(function () {
  "use strict";

  const selected = { id: "" };
  const view = { x: 0, y: 0, k: 1 };
  let drag = null;

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (attrs[key] != null) node.setAttribute(key, attrs[key]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function skin() {
    return window.SkinState ? window.SkinState.get() : { proposals: [], merges: [] };
  }

  function mapNow() {
    const proposals = skin().proposals || [];
    return window.ObjectMap.seed(proposals);
  }

  function mergeById(id) {
    return (skin().merges || []).filter(function (row) { return row.id === id; })[0] || null;
  }

  function chipText(status) {
    if (status === "certified") return "CERTIFIED";
    if (status === "accepted") return "ACCEPTED";
    return "PROPOSED";
  }

  function infoPair(id, label) {
    const popId = "map-info-" + id;
    const btn = el("button", {
      type: "button",
      class: "info-btn",
      "data-testid": "info-" + id,
      "aria-label": label,
      "aria-controls": popId,
      "aria-expanded": "false",
    }, "i");
    const pop = el("div", {
      id: popId,
      class: "info-pop",
      role: "dialog",
      "aria-modal": "false",
      "aria-label": label,
    });
    pop.hidden = true;
    return { btn: btn, pop: pop };
  }

  function ensure() {
    if (document.getElementById("object-map")) return;
    const root = el("section", {
      id: "object-map",
      class: "object-map",
      "data-testid": "object-map",
      "aria-label": "Object map",
    });
    root.hidden = true;
    root.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    root.addEventListener("wheel", function (event) { event.stopPropagation(); });

    const head = el("div", { class: "object-map-head" });
    head.appendChild(el("h2", null, "Object map"));
    const label = el("p", { class: "card-summary", "data-testid": "map-label" }, "");
    head.appendChild(label);
    const tools = el("div", { class: "object-map-tools" });
    [["map-zoom-in", "+", "Zoom in"], ["map-zoom-out", "-", "Zoom out"], ["map-reset-view", "1", "Reset view"], ["map-close", "x", "Close"]].forEach(function (pair) {
      const btn = el("button", {
        type: "button",
        class: "ghost map-tool",
        "data-testid": pair[0],
        "aria-label": pair[2],
      }, pair[1]);
      btn.addEventListener("click", function () {
        if (pair[0] === "map-close") { root.hidden = true; return; }
        if (pair[0] === "map-reset-view") { view.x = 0; view.y = 0; view.k = 1; }
        if (pair[0] === "map-zoom-in") view.k = Math.round(Math.min(2.5, view.k * 1.1) * 100) / 100;
        if (pair[0] === "map-zoom-out") view.k = Math.round(Math.max(0.4, view.k / 1.1) * 100) / 100;
        applyView();
      });
      tools.appendChild(btn);
    });
    head.appendChild(tools);
    root.appendChild(head);

    const body = el("div", { class: "object-map-body" });
    const canvas = el("div", {
      class: "object-map-canvas",
      tabindex: "0",
      "aria-label": "Object map canvas",
      "data-testid": "map-canvas",
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "object-map-svg");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "Objects and typed links");
    svg.setAttribute("viewBox", "0 0 640 400");
    const world = document.createElementNS("http://www.w3.org/2000/svg", "g");
    world.setAttribute("data-testid", "map-world");
    svg.appendChild(world);
    canvas.appendChild(svg);
    body.appendChild(canvas);

    const panel = el("aside", {
      class: "map-panel",
      "data-testid": "map-panel",
      tabindex: "0",
      "aria-label": "Object details",
    });
    panel.hidden = true;
    body.appendChild(panel);
    root.appendChild(body);

    const suggestions = el("section", {
      class: "map-suggestions",
      "data-testid": "map-suggestions",
      tabindex: "0",
      "aria-label": "Merge suggestions",
    });
    root.appendChild(suggestions);
    document.body.appendChild(root);

    canvas.addEventListener("wheel", function (event) {
      event.preventDefault();
      view.k = Math.round((event.deltaY < 0 ? Math.min(2.5, view.k * 1.1) : Math.max(0.4, view.k / 1.1)) * 100) / 100;
      applyView();
    }, { passive: false });
    canvas.addEventListener("pointerdown", function (event) {
      if (event.target.closest && event.target.closest(".map-node")) return;
      drag = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!drag) return;
      view.x = Math.round(drag.vx + (event.clientX - drag.x));
      view.y = Math.round(drag.vy + (event.clientY - drag.y));
      applyView();
    });
    canvas.addEventListener("pointerup", function () { drag = null; });
    canvas.addEventListener("pointercancel", function () { drag = null; });
    canvas.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") view.x -= 16;
      else if (event.key === "ArrowRight") view.x += 16;
      else if (event.key === "ArrowUp") view.y -= 16;
      else if (event.key === "ArrowDown") view.y += 16;
      else return;
      event.preventDefault();
      applyView();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || root.hidden) return;
      if (!selected.id) {
        root.hidden = true;
        return;
      }
      selected.id = "";
      render();
    });
  }

  function applyView() {
    const world = document.querySelector("#object-map [data-testid=map-world]");
    if (!world) return;
    world.setAttribute("transform", "translate(" + view.x + " " + view.y + ") scale(" + view.k + ")");
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function drawGraph(map) {
    const world = document.querySelector("#object-map [data-testid=map-world]");
    world.textContent = "";
    const byId = {};
    map.objects.forEach(function (obj) { byId[obj.id] = obj; });
    map.links.forEach(function (link) {
      const a = byId[link.from];
      const b = byId[link.to];
      if (!a || !b) return;
      const x1 = a.x + 70;
      const y1 = a.y + 28;
      const x2 = b.x + 70;
      const y2 = b.y + 28;
      world.appendChild(svgEl("line", {
        x1: x1, y1: y1, x2: x2, y2: y2,
        class: "map-edge",
        "data-testid": "map-edge",
        "data-id": link.id,
      }));
    });
    map.objects.forEach(function (obj) {
      const node = svgEl("g", {
        class: "map-node" + (obj.id === selected.id ? " is-selected" : ""),
        role: "button",
        tabindex: "0",
        "aria-label": obj.label,
        "data-testid": "map-node",
        "data-id": obj.id,
      });
      node.appendChild(svgEl("rect", { x: obj.x, y: obj.y, width: "140", height: "56", rx: "8" }));
      const title = svgEl("text", { x: obj.x + 12, y: obj.y + 24, class: "map-node-title" });
      title.textContent = obj.label;
      node.appendChild(title);
      const status = svgEl("text", { x: obj.x + 12, y: obj.y + 44, class: "map-node-status" });
      status.textContent = chipText(obj.status);
      node.appendChild(status);
      node.addEventListener("click", function (event) {
        event.stopPropagation();
        selected.id = obj.id;
        render();
      });
      node.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selected.id = obj.id;
        render();
      });
      world.appendChild(node);
    });
    map.links.forEach(function (link) {
      if (!link.label) return;
      const box = link.label;
      const group = svgEl("g", {
        class: "map-edge-label",
        "data-testid": "map-edge-label",
        "data-id": link.id,
        "data-type": link.type,
      });
      group.appendChild(svgEl("rect", {
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        rx: "4",
        class: "map-edge-label-bg",
      }));
      const text = svgEl("text", {
        x: box.x + box.w / 2,
        y: box.y + box.h / 2,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "map-edge-label-text",
      });
      text.textContent = link.type;
      group.appendChild(text);
      world.appendChild(group);
    });
    applyView();
  }

  function renderPanel(map) {
    const panel = document.querySelector("#object-map [data-testid=map-panel]");
    const obj = map.objects.filter(function (row) { return row.id === selected.id; })[0];
    panel.hidden = !obj;
    panel.textContent = "";
    if (!obj) return;
    const face = el("div", { class: "card-face" });
    face.appendChild(el("strong", { "data-testid": "map-title" }, obj.label));
    face.appendChild(el("span", { class: "chip", "data-testid": "map-status" }, chipText(obj.status)));
    panel.appendChild(face);
    panel.appendChild(el("p", { class: "card-summary", "data-testid": "map-source" }, "Source table " + obj.sourceTable));
    panel.appendChild(el("p", { class: "card-summary", "data-testid": "map-columns" }, "Columns " + obj.columns.join(", ")));
    const fields = el("ul", { class: "map-fields", "data-testid": "map-fields" });
    obj.fields.forEach(function (field) {
      fields.appendChild(el("li", { class: "map-field" }, field.role + " " + field.name));
    });
    panel.appendChild(fields);
    const links = el("ul", { class: "map-links", "data-testid": "map-links" });
    map.links.filter(function (link) { return link.from === obj.id || link.to === obj.id; }).forEach(function (link) {
      const other = link.from === obj.id ? link.to : link.from;
      links.appendChild(el("li", { class: "map-field" }, link.type + " " + other + " via " + link.via));
    });
    panel.appendChild(links);
    const info = infoPair(obj.id, "Details for " + obj.label);
    info.pop.appendChild(el("p", null, "Status " + obj.status + " is shown here. Certified only appears when Cortex set certifiedBy."));
    (obj.valueLists || []).forEach(function (list) {
      info.pop.appendChild(el("p", null, list.name + ": " + list.values.join(", ")));
    });
    panel.appendChild(info.btn);
    panel.appendChild(info.pop);
  }

  function renderSuggestions(map) {
    const box = document.querySelector("#object-map [data-testid=map-suggestions]");
    box.textContent = "";
    box.appendChild(el("div", { class: "eyebrow" }, "MERGE SUGGESTIONS"));
    const open = map.suggestions.filter(function (row) {
      const saved = mergeById(row.id);
      return !saved || saved.status !== "dismissed";
    });
    if (!open.length) {
      box.appendChild(el("p", { class: "card-summary" }, "No open suggestions."));
      return;
    }
    open.forEach(function (row) {
      const saved = mergeById(row.id);
      const card = el("article", { class: "map-suggestion", "data-testid": "map-suggestion", "data-id": row.id });
      const face = el("div", { class: "card-face" });
      face.appendChild(el("strong", null, row.leftLabel + " and " + row.rightLabel));
      face.appendChild(el("span", { class: "chip", "data-testid": "map-confidence" }, percent(row.confidence)));
      card.appendChild(face);
      card.appendChild(el("p", { class: "card-summary map-reason" }, row.reason));
      const info = infoPair("merge-" + row.id, "Why " + row.leftLabel + " and " + row.rightLabel);
      info.pop.appendChild(el("p", null, row.reason));
      info.pop.appendChild(el("p", null, "Confidence " + percent(row.confidence) + ". A merge stays a proposal until a person acts elsewhere."));
      card.appendChild(info.btn);
      card.appendChild(info.pop);
      const actions = el("div", { class: "map-actions" });
      const merge = el("button", { type: "button", "data-testid": "map-merge" }, "Merge");
      const dismiss = el("button", { type: "button", class: "ghost", "data-testid": "map-dismiss" }, "Dismiss");
      if (saved && saved.status === "proposed") {
        merge.disabled = true;
        dismiss.disabled = true;
        card.appendChild(el("p", { class: "card-summary", "data-testid": "map-merge-note" }, "Recorded in netie.skin-state/1. Not applied."));
      }
      merge.addEventListener("click", function () {
        if (!window.SkinState) return;
        window.SkinState.proposeMerge(row);
        render();
      });
      dismiss.addEventListener("click", function () {
        if (!window.SkinState) return;
        window.SkinState.dismissMerge(row);
        render();
      });
      actions.appendChild(merge);
      actions.appendChild(dismiss);
      card.appendChild(actions);
      box.appendChild(card);
    });
  }

  function percent(value) {
    return Math.round(Number(value) * 100) + "%";
  }

  function render() {
    ensure();
    const map = mapNow();
    const root = document.getElementById("object-map");
    root.querySelector("[data-testid=map-label]").textContent = map.label;
    drawGraph(map);
    renderPanel(map);
    renderSuggestions(map);
  }

  function openMap() {
    ensure();
    document.getElementById("object-map").hidden = false;
    render();
  }

  function mount() {
    ensure();
    const rail = document.querySelector(".rail");
    if (!rail || document.getElementById("open-object-map")) return;
    const btn = el("button", {
      type: "button",
      id: "open-object-map",
      class: "ghost",
      "data-testid": "open-object-map",
    }, "Object map");
    btn.addEventListener("click", openMap);
    const guide = document.getElementById("check-guide");
    if (guide) rail.insertBefore(btn, guide);
    else rail.appendChild(btn);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
