/* Planner canvas for the Constructor skin.
   Renders the plan, answer-spec chips, and ontology proposal cards.
   No fetch. Acceptance is a human click. Nothing is certified here. */
(function () {
  "use strict";

  const P = window.Planner;
  if (!P) throw new Error("Planner missing. Load planner.js before planner-ui.js.");

  const state = { plan: null, cards: [] };

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "class") node.className = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function ensure() {
    let panel = document.getElementById("planner-panel");
    if (panel) return panel;
    const stage = document.getElementById("stage");
    if (!stage) return null;
    panel = el("section", {
      id: "planner-panel",
      class: "planner-panel",
      "data-testid": "planner-panel",
      "aria-label": "Constructor plan",
    });
    panel.hidden = true;
    panel.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    panel.addEventListener("wheel", function (event) { event.stopPropagation(); }, { passive: true });
    stage.appendChild(panel);
    return panel;
  }

  function chip(kind, label) {
    return el("span", { class: "planner-chip", "data-testid": "planner-chip", "data-kind": kind }, label);
  }

  function render(plan, opts) {
    opts = opts || {};
    const panel = ensure();
    if (!panel || !plan) return;
    if (opts.cards) state.cards = opts.cards;
    state.plan = plan;
    if (opts.full === true) panel.classList.add("is-full");
    if (opts.full === false) panel.classList.remove("is-full");
    panel.hidden = false;
    clear(panel);

    const head = el("header", { class: "planner-head" });
    head.appendChild(el("div", { class: "eyebrow" }, "PLAN"));
    head.appendChild(el("strong", { "data-testid": "planner-intent" }, plan.intent));
    const conf = plan.confidence === 1 ? "1" : plan.confidence === 0 ? "0" : String(Math.round(plan.confidence * 100) / 100);
    const closest = plan.intent === "unclear" && plan.candidate ? ", closest " + plan.candidate : "";
    head.appendChild(el("span", { "data-testid": "planner-confidence" }, "confidence " + conf + closest));
    const close = el("button", { type: "button", class: "ghost", "data-testid": "planner-close" }, "Close");
    close.addEventListener("click", function () { panel.hidden = true; });
    head.appendChild(close);
    panel.appendChild(head);

    if (plan.label) panel.appendChild(el("p", { class: "planner-note", "data-testid": "planner-synthetic" }, plan.label));

    const body = el("div", { class: "planner-body" });
    const main = el("div", { "data-testid": "planner-plan-body" });
    const signals = el("ul", { class: "planner-signals", "data-testid": "planner-signals" });
    (plan.signals || []).forEach(function (s) {
      signals.appendChild(el("li", null, s.id + " -> " + s.intent + " (" + s.weight + ")"));
    });
    if (!plan.signals || !plan.signals.length) {
      signals.appendChild(el("li", null, "no signal matched"));
    }
    main.appendChild(signals);
    main.appendChild(el("p", { "data-testid": "planner-goal" }, plan.goal));
    main.appendChild(el("p", { "data-testid": "planner-success" }, plan.successCheck));

    const steps = el("ol", { class: "planner-steps", "data-testid": "planner-steps" });
    (plan.steps || []).forEach(function (s) {
      const li = el("li", null);
      li.appendChild(el("strong", null, s.title));
      li.appendChild(el("span", { class: "planner-lane" }, s.lane));
      li.appendChild(el("span", { class: "planner-mode" }, s.promptMode));
      li.appendChild(el("span", { class: "planner-reason" }, s.promptModeReason));
      li.appendChild(el("span", { class: "planner-reason" }, s.templateId + " v" + s.templateVersion));
      steps.appendChild(li);
    });
    main.appendChild(steps);
    main.appendChild(el("p", { "data-testid": "planner-mode" }, plan.promptMode + ". " + plan.promptModeReason));
    const b = plan.budget || {};
    main.appendChild(el("p", { "data-testid": "planner-budget" }, b.rule || ""));
    const gates = el("ul", { class: "planner-gates", "data-testid": "planner-gates" });
    const g = plan.governance || {};
    [g.linked, g.noLink, g.noExecutedQuery, g.predict].forEach(function (line) {
      if (line) gates.appendChild(el("li", null, line));
    });
    main.appendChild(gates);
    if (plan.clarify) main.appendChild(el("p", { "data-testid": "planner-clarify" }, plan.clarify));
    const used = el("p", { class: "planner-note", "data-testid": "planner-templates" });
    used.textContent = (plan.promptLog || []).map(function (row) {
      return row.id + " v" + row.version;
    }).join(", ");
    main.appendChild(used);
    body.appendChild(main);

    const side = el("div", { class: "planner-side" });
    const specBox = el("div", { "data-testid": "planner-spec" });
    specBox.appendChild(el("div", { class: "eyebrow" }, "ANSWER SPEC"));
    const chips = el("div", { class: "planner-chips" });
    P.specChips(plan.answerSpec).forEach(function (c) {
      chips.appendChild(chip(c.kind, c.label));
    });
    if (!plan.answerSpec) chips.appendChild(el("p", { class: "planner-note" }, "No spec for this intent."));
    specBox.appendChild(chips);
    const exportSpec = el("button", { type: "button", class: "ghost", "data-testid": "planner-export-spec" }, "Export spec JSON");
    exportSpec.disabled = !plan.answerSpec;
    exportSpec.addEventListener("click", function () {
      const payload = P.exportAnswerSpec(plan.answerSpec);
      if (payload) download("answer-spec.json", payload);
    });
    specBox.appendChild(exportSpec);
    side.appendChild(specBox);

    const onto = el("div", { "data-testid": "planner-ontology" });
    onto.appendChild(el("div", { class: "eyebrow" }, "ONTOLOGY PROPOSALS"));
    const cards = el("div", { class: "planner-cards" });
    if (!state.cards.length) {
      cards.appendChild(el("p", { class: "planner-note" }, "No schema loaded. Proposals stay empty until a person asks."));
    }
    state.cards.forEach(function (card) {
      const box = el("article", { class: "planner-card", "data-testid": "planner-card", "data-status": card.status, "data-role": card.role });
      box.appendChild(el("span", { class: "planner-badge" }, card.status === "accepted" ? "ACCEPTED" : "PROPOSED"));
      box.appendChild(el("strong", null, card.role + " " + card.name));
      box.appendChild(el("p", null, card.reason));
      if (card.values && card.values.length) {
        box.appendChild(el("p", { class: "planner-values" }, card.values.join(", ")));
      }
      const accept = el("button", { type: "button", "data-testid": "planner-accept" }, card.status === "accepted" ? "Accepted" : "Accept");
      accept.disabled = card.status === "accepted";
      accept.addEventListener("click", function () {
        state.cards = P.acceptProposal(state.cards, card.id);
        render(state.plan, { cards: state.cards });
      });
      box.appendChild(accept);
      cards.appendChild(box);
    });
    onto.appendChild(cards);
    const exportOnto = el("button", { type: "button", class: "ghost", "data-testid": "planner-export-ontology" }, "Export accepted JSON");
    exportOnto.addEventListener("click", function () {
      download("ontology-proposals.json", P.exportAccepted(state.cards));
    });
    onto.appendChild(exportOnto);
    side.appendChild(onto);
    body.appendChild(side);
    panel.appendChild(body);
  }

  function openDemo() {
    const adapter = P.cortexPlannerStub();
    const plan = P.plan(P.demoRequest(), { adapter: adapter, synthetic: true });
    const cards = P.proposeOntology(P.sampleSchema());
    render(plan, { full: true, cards: cards });
    if (window.Constructor) window.Constructor.lastPlan = plan;
  }

  function mount() {
    ensure();
    const rail = document.querySelector(".rail");
    if (!rail || document.getElementById("open-planner")) return;
    const btn = el("button", { type: "button", id: "open-planner", class: "ghost", "data-testid": "open-planner" }, "Planner");
    btn.addEventListener("click", openDemo);
    const guide = document.getElementById("check-guide");
    if (guide) rail.insertBefore(btn, guide);
    else rail.appendChild(btn);
  }

  window.PlannerUI = {
    render: render,
    openDemo: openDemo,
    cards: function () { return state.cards.slice(); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
