/* One-shot Try it. One input, one action, offline pipeline.
   Typed line or a dropped JSON/CSV fixture. No fetch. No live call. */
(function () {
  "use strict";

  const P = window.Planner;
  const S = window.SkinState;
  if (!P || !S) return;

  let dropped = null;

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

  function rowsToSchema(rows, name) {
    const header = Object.keys(rows[0] || {});
    const columns = header.map(function (key) {
      const values = rows.map(function (row) { return row[key]; }).filter(function (v) { return v != null && v !== ""; });
      const unique = [];
      values.forEach(function (v) {
        const s = String(v);
        if (unique.indexOf(s) < 0) unique.push(s);
      });
      const numeric = values.length > 0 && values.every(function (v) { return v !== "" && isFinite(Number(v)); });
      const col = { name: key, type: numeric ? "number" : "string", distinctCount: unique.length, distinct: unique.slice(0, 12) };
      if (!numeric && unique.length > 0 && unique.length <= 12 && unique.length === values.length) col.cardinality = "low";
      if (/(_id$|^id$)/i.test(key)) col.primary = true;
      return col;
    });
    return {
      label: "Dropped fixture " + (name || "table") + ". Values are only the cells in the file.",
      synthetic: false,
      table: (name || "dropped").replace(/\.[^.]+$/, ""),
      columns: columns,
    };
  }

  function csvToSchema(text, name) {
    const lines = text.split(/\r?\n/).filter(function (line) { return line.trim(); });
    if (lines.length < 2) return null;
    const delim = lines[0].indexOf("\t") >= 0 ? "\t" : ",";
    const header = lines[0].split(delim).map(function (cell) { return cell.trim(); });
    const rows = lines.slice(1).map(function (line) {
      const cells = line.split(delim);
      const row = {};
      header.forEach(function (key, i) { row[key] = (cells[i] || "").trim(); });
      return row;
    });
    return rowsToSchema(rows, name);
  }

  function parseTable(text, name) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;
    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
      try {
        const data = JSON.parse(trimmed);
        if (data && Array.isArray(data.columns)) return data;
        if (Array.isArray(data) && data[0] && typeof data[0] === "object") return rowsToSchema(data, name);
      } catch (err) {
        return null;
      }
      return null;
    }
    if (trimmed.indexOf(",") >= 0 || trimmed.indexOf("\t") >= 0) return csvToSchema(trimmed, name);
    return null;
  }

  function stepsFor(plan) {
    const intent = plan && plan.intent ? plan.intent : "unclear";
    return [
      { kind: "ingest", role: "ingest", title: "Ingest", lane: "DMS SQL", summary: "Load rows for " + intent + "." },
      { kind: "ontology", role: "ontology", title: "Ontology", lane: "KB", summary: "Proposals stay proposed until you accept them." },
      { kind: "insight", role: "plan", title: "Plan", lane: "Cortex", summary: (plan && plan.goal) || "Goal plan." },
      { kind: "agent", role: "cortex", title: "Cortex lane", lane: "Cortex", summary: "Governed lane. This pass does not call it." },
      { kind: "app", role: "answer", title: "Answer", lane: "Cortex", summary: "No executed query. Withheld. Values empty." },
    ];
  }

  function run(rawRequest, schema, synthetic) {
    const C = window.Constructor;
    const typed = String(rawRequest || "").trim();
    const request = typed || P.demoRequest();
    const table = schema || (!typed ? P.sampleSchema() : null);
    const settings = P.readSettings(window.localStorage);
    const plan = P.plan(request, {
      synthetic: synthetic === true || !typed,
      settings: settings,
      storage: window.localStorage,
      search: window.location.search,
    });
    const cards = table ? P.proposeOntology(table) : [];
    const pipeline = C && typeof C.applyTryPipeline === "function" ? C.applyTryPipeline(stepsFor(plan)) : stepsFor(plan);
    S.set({
      request: request,
      plan: plan,
      proposals: cards,
      pipeline: pipeline,
      answer: { title: "Answer", state: "withheld", badge: false, values: [] },
    });
    if (window.PlannerUI) window.PlannerUI.render(plan, { full: true, cards: cards });
    const note = document.getElementById("try-note");
    if (note) {
      note.textContent = !typed
        ? "Example fixture: synthetic orders table, not a live table."
        : (table && table.label) || "Ran the typed request. No table was attached.";
    }
  }

  function mount() {
    if (document.getElementById("try-it")) return;
    const rail = document.querySelector(".rail");
    if (!rail) return;
    const form = el("form", { id: "try-it", class: "try-it", "data-testid": "try-it" });
    form.appendChild(el("div", { class: "eyebrow" }, "TRY IT"));
    const label = el("label", { for: "try-input" }, "Request or sample table");
    form.appendChild(label);
    const input = el("textarea", {
      id: "try-input",
      "data-testid": "try-input",
      rows: "2",
      placeholder: "Type a request, or drop a JSON or CSV fixture",
    });
    form.appendChild(input);
    form.appendChild(el("button", { type: "submit", "data-testid": "try-run" }, "Try it"));
    form.appendChild(el("p", { id: "try-note", class: "try-note", "data-testid": "try-fixture" }, "Empty run uses the example fixture: synthetic orders table, not a live table."));
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      run(input.value, dropped, !String(input.value || "").trim());
      dropped = null;
    });
    form.addEventListener("dragover", function (event) { event.preventDefault(); });
    form.addEventListener("drop", function (event) {
      event.preventDefault();
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        dropped = parseTable(String(reader.result || ""), file.name);
        const note = document.getElementById("try-note");
        if (note) note.textContent = dropped ? "Dropped fixture: " + file.name + ". Press Try it." : "That file is not a JSON or CSV table.";
      };
      reader.readAsText(file);
    });
    const guide = document.getElementById("check-guide");
    if (guide) rail.insertBefore(form, guide);
    else rail.appendChild(form);
    window.TryIt = { run: run, parseTable: parseTable };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
