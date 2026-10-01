/* Constructor planner (v0.3.0).
   Every request becomes a plan before Cortex runs. Cortex is the only engine.
   No DOM. No fetch. No model call. Offline rules, plus a Cortex stub that is not called.
   UMD: module.exports under Node, window.Planner in the browser.
   Schema netie.plan/1. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && typeof root === "object") root.Planner = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "0.3.0";
  const SCHEMA = "netie.plan/1";
  const SPEC_SCHEMA = "netie.answer-spec/1";
  const ONTOLOGY_SCHEMA = "netie.ontology-proposal/1";
  const SYNTHETIC_LABEL = "synthetic example, not a measured request";
  const MIN_SCORE = 2;
  const LOW_CARDINALITY_MAX = 12;
  const BUDGET_REQUESTS_PER_MINUTE = 20;
  const BUDGET_PAID_CALL_USD = 0.02;
  const BUDGET_RUN_USD = 5;
  const CLARIFY = "Which job is this: docs, governed rows, an aggregate, code, training a model, or an app skin?";
  const INTENTS = ["knowledge", "database", "insight", "build-code", "build-model", "app-prompt", "unclear"];
  const LANES = ["Cortex", "DMS SQL", "OpenVault FreeRoute model hop", "KB"];
  const MODES = ["one-shot", "few-shot", "multi-step"];
  const DEMO_REQUEST = "list open orders where status is open, columns order_id status region, one row per order, sort by order_id";

  const SIGNALS = [
    { id: "kb.ask", intent: "knowledge", weight: 2, re: /\b(what is|what's|what are|explain|how does|how do i|where is)\b/i },
    { id: "kb.doc", intent: "knowledge", weight: 2, re: /\b(documentation|documented|docs|runbook|readme|knowledge base|\bkb\b|contract)\b/i },
    { id: "db.sql", intent: "database", weight: 2, re: /\b(sql|select\b|query the|lookup|look up)\b/i },
    { id: "db.rows", intent: "database", weight: 2, re: /\b(list|show|which|find|filter)\b.{0,48}\b(rows?|records?|orders?|customers?|skus?|invoices?|contacts?|venues?)\b/i },
    { id: "db.table", intent: "database", weight: 2, re: /\b(table|governed sql|row-level)\b/i },
    { id: "in.agg", intent: "insight", weight: 2, re: /\b(average|total|sum|count|trend|breakdown|aggregate|growth|compare)\b/i },
    { id: "in.howmany", intent: "insight", weight: 2, re: /\bhow many\b/i },
    { id: "in.bucket", intent: "insight", weight: 2, re: /\b(?:per|by) (month|week|day|region|store)\b/i },
    { id: "in.over", intent: "insight", weight: 2, re: /\bover time\b/i },
    { id: "in.group", intent: "insight", weight: 2, re: /\bgroup by\b/i },
    { id: "bm.train", intent: "build-model", weight: 2, re: /\b(retrain|fine-?tune|train|fit (?:a |the )?(?:model|weights))\b/i },
    { id: "bm.predict", intent: "build-model", weight: 2, re: /\b(predict|forecast|prediction)\b/i },
    { id: "bc.write", intent: "build-code", weight: 2, re: /\b(write|implement|refactor|patch)\b(?:\s+\S+){0,4}\s+\b(function|script|code|module|handler|test)\b/i },
    { id: "bc.lang", intent: "build-code", weight: 2, re: /\b(javascript|typescript|python)\b/i },
    { id: "bc.generate", intent: "build-code", weight: 2, re: /\bgenerate\b.{0,48}\b(connector|function|code|handler|script)\b/i },
    { id: "ap.app", intent: "app-prompt", weight: 2, re: /\b(make|build|create|design)\b(?:\s+\S+){0,5}\s+\b(app|skin|screen)\b/i },
    { id: "ap.named", intent: "app-prompt", weight: 2, re: /\b(app prompt|constructor skin|emit skin|full flow)\b/i },
    { id: "weak.maybe", intent: "knowledge", weight: 1, re: /\bmaybe\b/i },
  ];

  function template(id, version, mode, instructions) {
    const prefix = [
      "NETIE PLANNER",
      "template: " + id,
      "version: " + version,
      "mode: " + mode,
      "engine: cortex",
      instructions,
    ].join("\n");
    return { id: id, version: version, mode: mode, prefix: prefix };
  }

  const REGISTRY = [
    template(
      "planner.intent",
      "1",
      "one-shot",
      "Classify the request into one intent. Record the matched signals. Low confidence becomes unclear."
    ),
    template(
      "planner.plan",
      "1",
      "multi-step",
      "Emit the goal, the success check, the steps, the lane, and the prompt mode. Do not run the engine."
    ),
    template(
      "planner.answer-spec",
      "1",
      "one-shot",
      "Write the answer spec before any SQL: columns, grain, filters, sort, and limit."
    ),
    template(
      "planner.ontology-propose",
      "1",
      "few-shot",
      "Example: table orders, column status values open|closed -> dimension status, value list open|closed, status proposed.\nPropose object, key, measure, dimension, and low-cardinality value lists. Never certify."
    ),
    template(
      "planner.clarify",
      "1",
      "one-shot",
      "Ask one clarifying question. Do not pick a lane."
    ),
  ];

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function copyTemplate(t) {
    return { id: t.id, version: t.version, mode: t.mode, prefix: t.prefix };
  }

  function getTemplate(id) {
    const t = REGISTRY.find(function (row) { return row.id === id; });
    return t ? copyTemplate(t) : null;
  }

  function listTemplates() {
    return REGISTRY.map(copyTemplate);
  }

  function renderTemplate(id, request) {
    const t = getTemplate(id);
    if (!t) throw new Error("unknown planner template: " + id);
    return t.prefix + "\n\nREQUEST:\n" + String(request || "");
  }

  function reviseTemplate() {
    throw new Error("prompts are not self-modifying");
  }

  function offlineAdapter() {
    return {
      id: "offline-deterministic",
      kind: "offline",
      calls: 0,
      send: function () {
        this.calls += 1;
        throw new Error("offline planner has no endpoint");
      },
    };
  }

  function cortexPlannerStub() {
    return {
      id: "cortex-constructor-plan",
      kind: "cortex-stub",
      method: "POST",
      path: "/cortex/constructor/plan",
      calls: 0,
      send: function () {
        this.calls += 1;
        throw new Error("Cortex planner stub is not called in this version");
      },
    };
  }

  function hasStrong(signals, intent) {
    return signals.some(function (s) { return s.intent === intent && s.weight >= 2; });
  }

  function route(text) {
    const raw = String(text || "");
    const matched = [];
    SIGNALS.forEach(function (sig) {
      if (sig.re.test(raw)) {
        matched.push({ id: sig.id, intent: sig.intent, weight: sig.weight });
      }
    });
    let signals = matched.slice();
    const dropped = [];
    function drop(intent, reason) {
      signals = signals.filter(function (s) {
        if (s.intent !== intent) return true;
        dropped.push({ id: s.id, intent: s.intent, weight: s.weight, reason: reason });
        return false;
      });
    }
    if (hasStrong(signals, "build-model")) {
      drop("insight", "train, fit, or forecast is build-model");
      drop("database", "train, fit, or forecast is build-model");
      drop("build-code", "train, fit, or forecast is build-model");
      drop("app-prompt", "train, fit, or forecast is build-model");
    } else if (hasStrong(signals, "insight")) {
      drop("database", "aggregate words are insight, not a row lookup");
    } else if (hasStrong(signals, "app-prompt")) {
      drop("build-code", "app or skin is app-prompt");
    } else if (hasStrong(signals, "knowledge")) {
      drop("database", "a doc question is knowledge");
      drop("build-code", "a doc question is knowledge");
    }
    const scores = {};
    signals.forEach(function (s) {
      scores[s.intent] = (scores[s.intent] || 0) + s.weight;
    });
    const ranked = Object.keys(scores).sort(function (a, b) {
      return scores[b] - scores[a] || (a < b ? -1 : 1);
    });
    const candidate = ranked[0] || null;
    const bestScore = candidate ? scores[candidate] : 0;
    const secondScore = ranked[1] ? scores[ranked[1]] : 0;
    const confidence = bestScore + secondScore === 0 ? 0 : bestScore / (bestScore + secondScore);
    const low = bestScore < MIN_SCORE || (secondScore > 0 && bestScore <= secondScore * 2);
    return {
      intent: !candidate || low ? "unclear" : candidate,
      candidate: candidate,
      confidence: confidence,
      low: low,
      bestScore: bestScore,
      secondScore: secondScore,
      signals: signals,
      droppedSignals: dropped,
      matchedSignals: matched,
      scores: scores,
    };
  }

  function budget() {
    return {
      requestsPerMinute: BUDGET_REQUESTS_PER_MINUTE,
      paidCallUsd: BUDGET_PAID_CALL_USD,
      runUsd: BUDGET_RUN_USD,
      rule: "About 20 requests a minute. A paid call stops at $0.02. A run stops at $5.",
    };
  }

  function governance() {
    return {
      contract: "netie.governed-answer/1",
      linked: "Linked goes to SQL with rows, source, and a governed badge.",
      noLink: "No link gives an idea with values empty and the badge off.",
      noExecutedQuery: "No executed query means withheld.",
      predict: "Predict stays refused until a fitted model envelope says forecast.",
    };
  }

  function step(id, title, lane, mode, reason, templateId) {
    const t = getTemplate(templateId);
    return {
      id: id,
      title: title,
      lane: lane,
      promptMode: mode,
      promptModeReason: reason,
      templateId: t.id,
      templateVersion: t.version,
    };
  }

  function logOf(ids) {
    return ids.map(function (id) {
      const t = getTemplate(id);
      return { id: t.id, version: t.version, mode: t.mode };
    });
  }

  function wordList(src) {
    return String(src || "").split(/\s+/).filter(Boolean);
  }

  function answerSpec(text, intent) {
    if (intent !== "database" && intent !== "insight") return null;
    const raw = String(text || "");
    const columns = [];
    const col = raw.match(/\bcolumns?\s+([a-z0-9_]+(?:\s+[a-z0-9_]+)*)/i);
    if (col) {
      wordList(col[1]).forEach(function (name) {
        if (columns.indexOf(name) < 0) columns.push(name);
      });
    }
    let grain = null;
    const one = raw.match(/\bone row per\s+([a-z0-9_]+(?:\s+[a-z0-9_]+)*)/i);
    if (one) grain = "one row per " + one[1].trim();
    if (!grain) {
      const bucket = raw.match(/\b(?:per|by)\s+(month|week|day|region|store)\b/i);
      if (bucket && intent === "insight") grain = "one row per " + bucket[1].toLowerCase();
    }
    if (!grain) {
      grain = intent === "insight" ? "one row per aggregate bucket" : "one row per matched record";
    }
    const filters = [];
    const where = raw.match(/\bwhere\s+([^,.;]+)/i);
    if (where) filters.push(where[1].trim());
    const sortMatch = raw.match(/\bsort(?:ed)? by\s+([a-z0-9_]+)/i);
    const limitMatch = raw.match(/\b(?:limit|top)\s+(\d+)\b/i);
    return {
      schema: SPEC_SCHEMA,
      intent: intent,
      columns: columns,
      grain: grain,
      filters: filters,
      sort: sortMatch ? sortMatch[1] : null,
      limit: limitMatch ? Number(limitMatch[1]) : null,
    };
  }

  function specChips(spec) {
    if (!spec) return [];
    const chips = [{ kind: "grain", label: spec.grain }];
    (spec.columns || []).forEach(function (name) {
      chips.push({ kind: "column", label: name });
    });
    (spec.filters || []).forEach(function (f) {
      chips.push({ kind: "filter", label: f });
    });
    if (spec.sort) chips.push({ kind: "sort", label: "sort " + spec.sort });
    if (spec.limit != null) chips.push({ kind: "limit", label: "limit " + spec.limit });
    return chips;
  }

  function exportAnswerSpec(spec) {
    if (!spec) return null;
    return clone(spec);
  }

  function shapeFor(intent, text) {
    const spec = answerSpec(text, intent);
    if (intent === "knowledge") {
      return {
        goal: "Answer from the docs or KB with a citation.",
        successCheck: "The reply names the doc it used.",
        promptMode: "one-shot",
        promptModeReason: "One doc question. No tool loop, so the mode is one-shot.",
        promptLog: logOf(["planner.intent", "planner.plan"]),
        steps: [
          step("s1", "Read the doc", "KB", "one-shot", "One question maps to one document.", "planner.intent"),
          step("s2", "Cite the section", "Cortex", "one-shot", "Cortex returns the citation. No second hop.", "planner.plan"),
        ],
        answerSpec: null,
      };
    }
    if (intent === "database") {
      return {
        goal: "Return a governed row answer for the named records.",
        successCheck: "The answer spec exists before SQL, and the contract is linked, idea-only, or withheld.",
        promptMode: "multi-step",
        promptModeReason: "Spec, then SQL, then the answer contract. That is more than one step.",
        promptLog: logOf(["planner.intent", "planner.answer-spec", "planner.plan"]),
        steps: [
          step("s1", "Write the answer spec", "Cortex", "one-shot", "The spec is fixed before any SQL.", "planner.answer-spec"),
          step("s2", "Run governed SQL", "DMS SQL", "multi-step", "SQL runs only after the spec. Rows come back with a source.", "planner.plan"),
          step("s3", "Apply the answer contract", "Cortex", "multi-step", "Linked shows SQL, rows, source, and a badge. No link keeps values empty. No executed query is withheld.", "planner.plan"),
        ],
        answerSpec: spec,
      };
    }
    if (intent === "insight") {
      return {
        goal: "Return an aggregate or trend over governed measures.",
        successCheck: "The spec names the grain before SQL, and a figure with no executed query is withheld.",
        promptMode: "multi-step",
        promptModeReason: "Spec, then the aggregate, then the contract.",
        promptLog: logOf(["planner.intent", "planner.answer-spec", "planner.plan"]),
        steps: [
          step("s1", "Write the measure spec", "Cortex", "one-shot", "Columns, grain, filters, and sort are fixed before SQL.", "planner.answer-spec"),
          step("s2", "Aggregate on governed measures", "DMS SQL", "multi-step", "The aggregate is SQL over measures that are already governed.", "planner.plan"),
          step("s3", "Apply the answer contract", "Cortex", "multi-step", "A figure with no executed query is withheld.", "planner.plan"),
        ],
        answerSpec: spec,
      };
    }
    if (intent === "build-code") {
      return {
        goal: "Draft the code change and ghost-compile it.",
        successCheck: "The sketch compiles locally. A live run still waits for a /cortex origin.",
        promptMode: "few-shot",
        promptModeReason: "The code template carries fixed IR examples, so the mode is few-shot.",
        promptLog: logOf(["planner.intent", "planner.plan"]),
        steps: [
          step("s1", "Draft the change", "Cortex", "few-shot", "Fixed examples in the template show the IR shape.", "planner.plan"),
          step("s2", "Ghost compile", "Cortex", "multi-step", "Compile stays on the Constructor sketch until a /cortex origin.", "planner.plan"),
        ],
        answerSpec: null,
      };
    }
    if (intent === "build-model") {
      return {
        goal: "Train or fit a model. Predict stays refused until a fitted envelope says forecast.",
        successCheck: "No forecast is shown unless model_envelope.fitted is true and task is forecast.",
        promptMode: "multi-step",
        promptModeReason: "Fit first. Predict is a later step and stays refused until a fitted model envelope says forecast.",
        promptLog: logOf(["planner.intent", "planner.plan"]),
        steps: [
          step("s1", "Fit or train", "OpenVault FreeRoute model hop", "multi-step", "Train and fit go through the OpenVault FreeRoute model hop, not SQL.", "planner.plan"),
          step("s2", "Hold predict", "Cortex", "one-shot", "Predict stays refused until a fitted model envelope says forecast.", "planner.clarify"),
        ],
        answerSpec: null,
      };
    }
    if (intent === "app-prompt") {
      return {
        goal: "Draft an app skin prompt and ghost the app block.",
        successCheck: "The app block is an EMIT skin. Cortex stays the engine.",
        promptMode: "few-shot",
        promptModeReason: "The template carries a fixed skin example, so the mode is few-shot.",
        promptLog: logOf(["planner.intent", "planner.plan"]),
        steps: [
          step("s1", "Draft the skin prompt", "Cortex", "few-shot", "A fixed skin example leads the template. The request follows it.", "planner.plan"),
          step("s2", "Ghost the app block", "Cortex", "multi-step", "The app is an EMIT skin on the Constructor canvas.", "planner.plan"),
        ],
        answerSpec: null,
      };
    }
    return {
      goal: "Ask one clarifying question before any lane runs.",
      successCheck: "The operator names one job: docs, rows, aggregate, code, model, or app.",
      promptMode: "one-shot",
      promptModeReason: "One clarifying question. No second step until the job is named.",
      promptLog: logOf(["planner.intent", "planner.clarify"]),
      steps: [
        step("s1", "Ask one question", "Cortex", "one-shot", "Confidence is too low to pick a lane.", "planner.clarify"),
      ],
      answerSpec: null,
    };
  }

  function plan(request, ctx) {
    ctx = ctx || {};
    const adapter = ctx.adapter || offlineAdapter();
    const text = String(request || "").trim();
    const routed = route(text);
    const shaped = shapeFor(routed.intent, text);
    return {
      schema: SCHEMA,
      version: VERSION,
      request: text,
      intent: routed.intent,
      candidate: routed.candidate,
      confidence: routed.confidence,
      lowConfidence: routed.low,
      signals: routed.signals,
      droppedSignals: routed.droppedSignals,
      scores: routed.scores,
      clarify: routed.intent === "unclear" ? CLARIFY : null,
      goal: shaped.goal,
      successCheck: shaped.successCheck,
      steps: shaped.steps,
      promptMode: shaped.promptMode,
      promptModeReason: shaped.promptModeReason,
      promptLog: shaped.promptLog,
      budget: budget(),
      governance: governance(),
      answerSpec: shaped.answerSpec,
      adapter: { id: adapter.id, kind: adapter.kind, called: false },
      synthetic: ctx.synthetic === true,
      label: ctx.synthetic === true ? SYNTHETIC_LABEL : null,
    };
  }

  function validatePlan(planObj) {
    const errors = [];
    function err(code, message) { errors.push({ code: code, message: message }); }
    if (!planObj || typeof planObj !== "object") {
      err("PLAN_SHAPE", "plan is missing");
      return { ok: false, errors: errors };
    }
    if (planObj.schema !== SCHEMA) err("PLAN_SCHEMA", "schema must be " + SCHEMA);
    if (planObj.version !== VERSION) err("PLAN_VERSION", "version must be " + VERSION);
    if (INTENTS.indexOf(planObj.intent) < 0) err("PLAN_INTENT", "intent is not a known class");
    if (typeof planObj.goal !== "string" || !planObj.goal) err("PLAN_GOAL", "goal is required");
    if (typeof planObj.successCheck !== "string" || !planObj.successCheck) err("PLAN_SUCCESS", "success check is required");
    if (!Array.isArray(planObj.steps) || !planObj.steps.length) err("PLAN_STEPS", "steps are required");
    (planObj.steps || []).forEach(function (s, i) {
      if (!s || LANES.indexOf(s.lane) < 0) err("PLAN_LANE", "step " + i + " lane is not a known lane");
      if (!s || MODES.indexOf(s.promptMode) < 0) err("PLAN_MODE", "step " + i + " prompt mode is not known");
      if (!s || !s.promptModeReason) err("PLAN_MODE_REASON", "step " + i + " needs a prompt mode reason");
      if (!s || !getTemplate(s.templateId) || s.templateVersion !== "1") err("PLAN_TEMPLATE", "step " + i + " template is not in the registry");
    });
    if (MODES.indexOf(planObj.promptMode) < 0) err("PLAN_PROMPT_MODE", "plan prompt mode is not known");
    if (!planObj.promptModeReason) err("PLAN_PROMPT_REASON", "plan prompt mode needs a reason");
    if (!Array.isArray(planObj.promptLog) || !planObj.promptLog.length) err("PLAN_LOG", "prompt log is required");
    (planObj.promptLog || []).forEach(function (row, i) {
      const t = row && getTemplate(row.id);
      if (!t || t.version !== row.version || t.mode !== row.mode) err("PLAN_LOG_ROW", "prompt log " + i + " is not a registered template");
    });
    const b = planObj.budget || {};
    if (b.requestsPerMinute !== BUDGET_REQUESTS_PER_MINUTE) err("PLAN_BUDGET_RATE", "request budget must stay at 20 a minute");
    if (b.paidCallUsd !== BUDGET_PAID_CALL_USD) err("PLAN_BUDGET_CALL", "a paid call must stop at 0.02");
    if (b.runUsd !== BUDGET_RUN_USD) err("PLAN_BUDGET_RUN", "a run must stop at 5");
    const g = planObj.governance || {};
    if (g.contract !== "netie.governed-answer/1") err("PLAN_GATE_CONTRACT", "governance contract mismatch");
    if (!g.linked || !g.noLink || !g.noExecutedQuery || !g.predict) err("PLAN_GATES", "governance gates are incomplete");
    if (typeof planObj.confidence !== "number" || planObj.confidence < 0 || planObj.confidence > 1) err("PLAN_CONFIDENCE", "confidence must be from 0 to 1");
    if (!Array.isArray(planObj.signals)) err("PLAN_SIGNALS", "signals must be a list");
    if (planObj.intent === "unclear") {
      if (planObj.clarify !== CLARIFY) err("PLAN_CLARIFY", "unclear must ask the one clarifying question");
      if ((String(planObj.clarify).match(/\?/g) || []).length !== 1) err("PLAN_CLARIFY_ONE", "unclear asks exactly one question");
    } else if (planObj.clarify != null) {
      err("PLAN_CLARIFY_EXTRA", "a clear intent does not ask a clarifying question");
    }
    if (planObj.intent === "database" || planObj.intent === "insight") {
      if (!planObj.answerSpec) err("PLAN_SPEC", "database and insight need an answer spec");
    } else if (planObj.answerSpec) {
      err("PLAN_SPEC_EXTRA", "only database and insight carry an answer spec");
    }
    if (planObj.adapter && planObj.adapter.called !== false) err("PLAN_ADAPTER", "the planner adapter must not be called");
    if (planObj.intent === "build-model" && (!g.predict || g.predict.indexOf("refused") < 0)) {
      err("PLAN_PREDICT", "build-model must keep predict refused");
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function isLowCardinality(col) {
    if (!col || typeof col !== "object") return false;
    if (col.lowCardinality === true || col.cardinality === "low") return true;
    const values = Array.isArray(col.distinct) ? col.distinct : [];
    const n = typeof col.distinctCount === "number" ? col.distinctCount : values.length;
    return values.length > 0 && n === values.length && n <= LOW_CARDINALITY_MAX;
  }

  function isKeyColumn(col) {
    if (!col) return false;
    if (col.primary === true || col.role === "key") return true;
    return /(^id$|_id$)/i.test(String(col.name || ""));
  }

  function isMeasureColumn(col) {
    const t = String(col.type || "").toLowerCase();
    return ["number", "integer", "float", "decimal", "numeric"].indexOf(t) >= 0;
  }

  function proposal(table, role, name, reason, values) {
    const card = {
      id: table + "." + role + "." + name,
      role: role,
      status: "proposed",
      object: table,
      name: name,
      reason: reason,
      certified: false,
    };
    if (values) card.values = values.slice();
    return card;
  }

  function proposeOntology(input) {
    const src = input && typeof input === "object" ? input : {};
    const table = String(src.table || "").trim();
    if (!table) return [];
    const columns = Array.isArray(src.columns) ? src.columns : [];
    const cards = [
      proposal(table, "object", table, "The table name is the object.", null),
    ];
    const keys = columns.filter(isKeyColumn);
    const primary = keys.filter(function (c) { return c.primary === true; });
    const keyCols = primary.length ? primary : keys;
    const keyNames = {};
    keyCols.forEach(function (col) {
      keyNames[col.name] = true;
      cards.push(proposal(table, "key", col.name, "This column is the key.", null));
    });
    columns.forEach(function (col) {
      if (!col || !col.name || keyNames[col.name]) return;
      if (isMeasureColumn(col)) {
        cards.push(proposal(table, "measure", col.name, "A number column that is not the key is a measure.", null));
        return;
      }
      const low = isLowCardinality(col);
      const type = String(col.type || "").toLowerCase();
      const dimensional = low || ["string", "date", "boolean"].indexOf(type) >= 0;
      if (!dimensional) return;
      cards.push(proposal(
        table,
        "dimension",
        col.name,
        low ? "Low cardinality makes this a dimension." : "A non-key label column is a dimension.",
        null
      ));
      if (low && Array.isArray(col.distinct) && col.distinct.length) {
        cards.push(proposal(
          table,
          "value-list",
          col.name,
          "Distinct values are a proposed value list. A person still has to accept them.",
          col.distinct.map(String)
        ));
      }
    });
    return cards.map(function (card) {
      card.status = "proposed";
      card.certified = false;
      return card;
    });
  }

  function acceptProposal(cards, id) {
    return (cards || []).map(function (card) {
      const next = clone(card);
      if (next.id === id && next.status === "proposed") {
        next.status = "accepted";
        next.certified = false;
      }
      return next;
    });
  }

  function exportAccepted(cards) {
    const items = (cards || []).filter(function (card) { return card && card.status === "accepted"; }).map(function (card) {
      const row = clone(card);
      row.status = "accepted";
      row.certified = false;
      return row;
    });
    return {
      schema: ONTOLOGY_SCHEMA,
      for: "cortex",
      certified: false,
      items: items,
    };
  }

  function sampleSchema() {
    return {
      label: "synthetic schema fixture, not a live table",
      synthetic: true,
      table: "orders",
      columns: [
        { name: "order_id", type: "string", primary: true, distinctCount: 2, distinct: ["A-100", "A-101"] },
        { name: "status", type: "string", cardinality: "low", distinctCount: 3, distinct: ["open", "closed", "held"] },
        { name: "region", type: "string", cardinality: "low", distinctCount: 2, distinct: ["north", "south"] },
        { name: "amount", type: "number", distinctCount: 40, distinct: [] },
      ],
    };
  }

  function createPlanner(adapter) {
    const bound = adapter || offlineAdapter();
    return {
      adapter: bound,
      plan: function (request, ctx) {
        const next = ctx || {};
        if (!next.adapter) next.adapter = bound;
        return plan(request, next);
      },
      proposeOntology: proposeOntology,
      acceptProposal: acceptProposal,
      exportAccepted: exportAccepted,
    };
  }

  return {
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    SPEC_SCHEMA: SPEC_SCHEMA,
    ONTOLOGY_SCHEMA: ONTOLOGY_SCHEMA,
    SYNTHETIC_LABEL: SYNTHETIC_LABEL,
    INTENTS: INTENTS.slice(),
    LANES: LANES.slice(),
    MODES: MODES.slice(),
    LOW_CARDINALITY_MAX: LOW_CARDINALITY_MAX,
    demoRequest: function () { return DEMO_REQUEST; },
    sampleSchema: sampleSchema,
    listTemplates: listTemplates,
    getTemplate: getTemplate,
    renderTemplate: renderTemplate,
    reviseTemplate: reviseTemplate,
    offlineAdapter: offlineAdapter,
    cortexPlannerStub: cortexPlannerStub,
    createPlanner: createPlanner,
    route: route,
    plan: plan,
    validatePlan: validatePlan,
    answerSpec: answerSpec,
    specChips: specChips,
    exportAnswerSpec: exportAnswerSpec,
    proposeOntology: proposeOntology,
    acceptProposal: acceptProposal,
    exportAccepted: exportAccepted,
  };
});
