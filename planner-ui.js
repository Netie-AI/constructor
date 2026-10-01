/* Planner canvas for the Constructor skin.
   Renders the plan, answer-spec chips, and ontology proposal cards.
   No fetch. Acceptance is a human click. Nothing is certified here. */
(function () {
  "use strict";

  const P = window.Planner;
  if (!P) throw new Error("Planner missing. Load planner.js before planner-ui.js.");

  const state = {
    plan: null,
    cards: [],
    confirmed: { high: false, max: false },
    gate: "",
    settingsOpen: false,
    settingsError: "",
  };

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
    if (!state.plan || state.plan.request !== plan.request) {
      state.confirmed = { high: false, max: false };
      state.gate = "";
    }
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
    panel.appendChild(renderEfforts(plan));

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

  function costText(value) {
    if (value === "unknown") return "unknown";
    if (value && typeof value.min === "number" && typeof value.max === "number") {
      return "$" + value.min + " to $" + value.max + (value.capped ? ", capped" : "");
    }
    return "unknown";
  }

  function capLabel(value) {
    return typeof value === "number" ? "$" + value : "unlimited";
  }

  function remainingText(plan) {
    const left = (plan.budget && plan.budget.remaining) || {};
    return "remaining per call " + capLabel(left.paidCallUsd === "unlimited" ? null : left.paidCallUsd) + ", per run " + capLabel(left.runUsd === "unlimited" ? null : left.runUsd) + ", max-level " + capLabel(left.maxLevelBudgetUsd === "unlimited" ? null : left.maxLevelBudgetUsd);
  }

  function pathsFrom(plan) {
    const paths = [];
    ["high", "max"].forEach(function (level) {
      const brief = plan.efforts && plan.efforts[level] && plan.efforts[level].brief;
      ((brief && brief.affectedPaths) || []).forEach(function (name) {
        if (paths.indexOf(name) < 0) paths.push(name);
      });
    });
    return paths;
  }

  function planContext(extra) {
    const ctx = {
      adapter: P.cortexPlannerStub(),
      settings: P.readSettings(window.localStorage),
      storage: window.localStorage,
      search: window.location.search,
    };
    if (P.currentDmsRaw() !== undefined) ctx.dmsSettings = P.currentDmsRaw();
    Object.keys(extra || {}).forEach(function (key) { ctx[key] = extra[key]; });
    return ctx;
  }

  function replan(prev, extra) {
    const panel = document.getElementById("planner-panel");
    const plan = P.plan(prev.request, planContext(Object.assign({
      synthetic: prev.synthetic === true,
      diffNames: pathsFrom(prev),
      recordedAt: new Date().toISOString(),
    }, extra || {})));
    render(plan, { cards: state.cards, full: !!(panel && panel.classList.contains("is-full")) });
    if (window.Constructor) window.Constructor.lastPlan = plan;
    return plan;
  }

  function saveSettings(form) {
    const written = P.writeSettings({
      effortMode: form.querySelector("[data-testid=settings-mode]").value,
      confirm: form.querySelector("[data-testid=settings-confirm]").checked,
      paidCallUsd: form.querySelector("[data-testid=settings-paid-call]").value,
      runUsd: form.querySelector("[data-testid=settings-run]").value,
      maxLevelBudgetUsd: form.querySelector("[data-testid=settings-max]").value,
    }, window.localStorage);
    if (!written.ok) {
      state.settingsError = "Caps must be empty or a number that is at least 0.";
      render(state.plan, { cards: state.cards });
      return;
    }
    state.settingsError = "";
    replan(state.plan, { settings: written.settings });
  }

  function renderSettings(plan) {
    const box = el("section", { class: "planner-settings", "data-testid": "planner-settings" });
    const toggle = el("button", {
      type: "button",
      class: "ghost",
      "data-testid": "planner-settings-open",
    }, state.settingsOpen ? "Hide settings" : "Settings");
    toggle.addEventListener("click", function () {
      state.settingsOpen = !state.settingsOpen;
      state.settingsError = "";
      render(state.plan, { cards: state.cards });
    });
    box.appendChild(toggle);
    if (!state.settingsOpen) return box;
    const local = P.readSettings(window.localStorage);
    const settings = plan.settingsSource === "dms" ? local : (plan.settings || local);
    const form = el("form", { "data-testid": "planner-settings-form" });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveSettings(form);
    });
    const modeLabel = el("label", null, "Effort mode");
    const mode = el("select", { "data-testid": "settings-mode" });
    ["auto", "low", "medium", "high", "max"].forEach(function (level) {
      const opt = el("option", { value: level }, level);
      if (settings.effortMode === level) opt.selected = true;
      mode.appendChild(opt);
    });
    modeLabel.appendChild(mode);
    form.appendChild(modeLabel);
    const confirmLabel = el("label", null, "Require confirmation for manual high and max");
    const confirmAttrs = { type: "checkbox", "data-testid": "settings-confirm" };
    if (settings.confirm) confirmAttrs.checked = "checked";
    confirmLabel.appendChild(el("input", confirmAttrs));
    form.appendChild(confirmLabel);
    function moneyField(testId, label, value) {
      const lab = el("label", null, label);
      lab.appendChild(el("input", {
        type: "text",
        inputmode: "decimal",
        "data-testid": testId,
        placeholder: "unlimited",
        value: typeof value === "number" ? String(value) : "",
      }));
      return lab;
    }
    form.appendChild(moneyField("settings-paid-call", "Per call cap", settings.paidCallUsd));
    form.appendChild(moneyField("settings-run", "Per run cap", settings.runUsd));
    form.appendChild(moneyField("settings-max", "Max-level budget", settings.maxLevelBudgetUsd));
    form.appendChild(el("button", { type: "submit", "data-testid": "settings-save" }, "Save settings"));
    const exportSchema = el("button", { type: "button", class: "ghost", "data-testid": "settings-export-schema" }, "Export settings schema");
    exportSchema.addEventListener("click", function () {
      download("planner-settings.schema.json", P.settingsSchema());
    });
    form.appendChild(exportSchema);
    if (plan.settingsSource === "dms") {
      form.appendChild(el("p", { class: "planner-note", "data-testid": "settings-dms-note" }, "DMS is the active source. Saving here updates the Constructor copy only."));
    }
    box.appendChild(form);
    if (state.settingsError) box.appendChild(el("p", { class: "planner-settings-error", "data-testid": "settings-error" }, state.settingsError));
    return box;
  }

  function tokenText(value) {
    if (!value || value === "unknown") return "unknown";
    return "in " + value.inputMin + "-" + value.inputMax + ", out " + value.outputMin + "-" + value.outputMax;
  }

  function renderEfforts(plan) {
    const box = el("section", { class: "planner-efforts", "data-testid": "planner-efforts" });
    box.appendChild(el("div", { class: "eyebrow" }, "EFFORT"));
    const choice = plan.effortChoice || {};
    const predicted = costText(choice.predictedUsd);
    const prefix = plan.settings && plan.settings.effortMode === "auto" ? "auto chose " : "effort ";
    box.appendChild(el("p", { class: "planner-choice", "data-testid": "effort-choice" }, prefix + choice.level + ", predicted cost " + predicted));
    box.appendChild(el("p", { class: "planner-note", "data-testid": "effort-log" }, "logged: " + plan.intent + ", " + choice.level + ", " + predicted + ". " + (choice.reason || "")));
    box.appendChild(el("p", { class: "planner-note", "data-testid": "effort-remaining" }, remainingText(plan)));
    const sourceName = plan.settingsSource === "dms" ? "DMS" : "Constructor";
    box.appendChild(el("p", { class: "planner-note", "data-testid": "settings-source" }, "settings source " + sourceName));
    if (plan.settingsWarning) {
      box.appendChild(el("p", { class: "planner-settings-error", "data-testid": "settings-source-warning" }, plan.settingsWarning));
    }
    box.appendChild(renderSettings(plan));
    box.appendChild(el("p", { class: "planner-note" }, (plan.efforts && plan.efforts.low && plan.efforts.low.profileNote) || ""));
    const grid = el("div", { class: "planner-effort-grid" });
    (P.EFFORT_LEVELS || []).forEach(function (level) {
      const row = plan.efforts && plan.efforts[level];
      if (!row) return;
      const card = el("article", { class: "planner-effort", "data-testid": "effort-" + level, "data-level": level });
      if (choice.level === level) card.setAttribute("data-chosen", "true");
      card.appendChild(el("strong", null, level));
      card.appendChild(el("p", { "data-testid": "effort-deliverable" }, row.deliverable));
      card.appendChild(el("p", null, "requests " + row.requests));
      card.appendChild(el("p", { "data-testid": "effort-tokens" }, "tokens " + tokenText(row.tokens)));
      card.appendChild(el("p", { "data-testid": "effort-cost" }, "cost " + costText(row.costUsd)));
      const capLine = "per call " + capLabel(row.paidCallUsd) + ", per run " + capLabel(row.runUsd) + (level === "max" ? ", max-level " + capLabel(row.maxLevelBudgetUsd) : "");
      card.appendChild(el("p", { "data-testid": "effort-cap" }, capLine));
      const wire = row.wire || {};
      card.appendChild(el("p", { "data-testid": "effort-wire" }, "wired to " + wire.client + " / " + wire.lane));
      if (row.brief) {
        const paths = row.brief.affectedPaths || [];
        card.appendChild(el("p", { "data-testid": "effort-brief" }, row.brief.targetRepo + " paths " + (paths.length ? paths.join(", ") : "none") + ". " + row.brief.note));
      }
      if (row.needsConfirm && !state.confirmed[level]) {
        const confirm = el("button", { type: "button", "data-testid": "effort-" + level + "-confirm" }, "Confirm before this starts");
        confirm.addEventListener("click", function () {
          state.confirmed[level] = true;
          state.gate = "";
          render(state.plan, { cards: state.cards });
        });
        card.appendChild(confirm);
      }
      const start = el("button", { type: "button", class: "ghost", "data-testid": "effort-" + level + "-start" }, row.needsConfirm && !state.confirmed[level] ? "Start" : "Start");
      start.addEventListener("click", function () {
        const result = P.startEffort(state.plan, level, {
          confirmed: !!state.confirmed[level],
          settings: state.plan.settings,
        });
        state.gate = level + ": " + result.reason;
        render(state.plan, { cards: state.cards });
      });
      card.appendChild(start);
      grid.appendChild(card);
    });
    box.appendChild(grid);
    if (state.gate) box.appendChild(el("p", { "data-testid": "effort-gate" }, state.gate));
    return box;
  }

  function openDemo() {
    const plan = P.plan(P.demoRequest(), planContext({ synthetic: true }));
    const cards = P.proposeOntology(P.sampleSchema());
    render(plan, { full: true, cards: cards });
    if (window.Constructor) window.Constructor.lastPlan = plan;
  }

  function mount() {
    ensure();
    if (!window.__plannerDmsListener) {
      window.__plannerDmsListener = true;
      window.addEventListener("message", function (event) {
        const data = event.data;
        if (!data || data.type !== P.DMS_MESSAGE_TYPE) return;
        P.noteDmsMessage(data);
        if (!state.plan) return;
        replan(state.plan);
      });
    }
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
