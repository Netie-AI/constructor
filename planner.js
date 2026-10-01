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
  const CLARIFY = "Which job is this: docs, governed rows, an aggregate, code, training a model, or an app skin?";
  const INTENTS = ["knowledge", "database", "insight", "build-code", "build-model", "app-prompt", "unclear"];
  const LANES = ["Cortex", "DMS SQL", "OpenVault FreeRoute model hop", "KB"];
  const MODES = ["one-shot", "few-shot", "multi-step"];
  const EFFORT_LEVELS = ["low", "medium", "high", "max"];
  const BUILD_INTENTS = ["build-code", "build-model", "app-prompt"];
  const CALIBRATION_SCHEMA = "netie.planner-cost-calibration/1";
  const BRIEF_SCHEMA = "netie.build-brief/1";
  const SETTINGS_SCHEMA = "netie.planner-settings/1";
  const LOG_SCHEMA = "netie.planner-effort-log/1";
  const SETTINGS_KEY = "netie.constructor.planner.settings";
  const LOG_KEY = "netie.constructor.planner.log";
  const EFFORT_MODES = ["auto", "low", "medium", "high", "max"];
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

  function defaultSettings() {
    return {
      schema: SETTINGS_SCHEMA,
      effortMode: "auto",
      confirm: false,
      paidCallUsd: null,
      runUsd: null,
      maxLevelBudgetUsd: null,
      spentUsd: null,
    };
  }

  function moneyOrNull(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number" && isFinite(value) && value >= 0) return value;
    if (typeof value === "string" && value.trim() !== "" && isFinite(Number(value))) {
      const n = Number(value);
      if (n >= 0) return n;
    }
    return undefined;
  }

  function normalizeSettings(input) {
    const base = defaultSettings();
    if (!input || typeof input !== "object") return { ok: true, settings: base, invalid: [] };
    const invalid = [];
    const mode = input.effortMode == null || input.effortMode === "" ? "auto" : input.effortMode;
    if (EFFORT_MODES.indexOf(mode) < 0) invalid.push("effortMode");
    else base.effortMode = mode;
    if (input.confirm == null || input.confirm === "" || input.confirm === false || input.confirm === "false") base.confirm = false;
    else if (input.confirm === true || input.confirm === "true") base.confirm = true;
    else invalid.push("confirm");
    ["paidCallUsd", "runUsd", "maxLevelBudgetUsd", "spentUsd"].forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) return;
      const n = moneyOrNull(input[key]);
      if (n === undefined) invalid.push(key);
      else base[key] = n;
    });
    return { ok: invalid.length === 0, settings: base, invalid: invalid };
  }

  function storageOf(storage) {
    if (storage && typeof storage.getItem === "function" && typeof storage.setItem === "function") return storage;
    return null;
  }

  function readSettings(storage) {
    const store = storageOf(storage);
    if (!store) return defaultSettings();
    try {
      const raw = store.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      const norm = normalizeSettings(JSON.parse(raw));
      if (!norm.ok) return defaultSettings();
      return norm.settings;
    } catch (err) {
      return defaultSettings();
    }
  }

  function writeSettings(input, storage) {
    const store = storageOf(storage);
    const prev = readSettings(store);
    if (!store) return { ok: false, settings: prev, invalid: ["storage"] };
    const norm = normalizeSettings(Object.assign({}, prev, input || {}));
    if (!norm.ok) return { ok: false, settings: prev, invalid: norm.invalid };
    try {
      store.setItem(SETTINGS_KEY, JSON.stringify(norm.settings));
    } catch (err) {
      return { ok: false, settings: prev, invalid: ["storage"] };
    }
    return { ok: true, settings: norm.settings, invalid: [] };
  }

  function readLog(storage) {
    const store = storageOf(storage);
    if (!store) return [];
    try {
      const raw = store.getItem(LOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function recordChoice(entry, storage) {
    const row = {
      schema: LOG_SCHEMA,
      intent: entry.intent,
      level: entry.level,
      costUsd: entry.costUsd,
      predictedUsd: entry.predictedUsd,
      reason: entry.reason,
      recordedAt: entry.recordedAt == null ? null : entry.recordedAt,
    };
    const store = storageOf(storage);
    if (!store) return null;
    const list = readLog(store);
    list.push(row);
    try {
      store.setItem(LOG_KEY, JSON.stringify(list));
    } catch (err) {
      return null;
    }
    return row;
  }

  function resolveSettings(ctx) {
    ctx = ctx || {};
    if (ctx.settings) return normalizeSettings(ctx.settings).settings;
    if (ctx.storage) return readSettings(ctx.storage);
    return defaultSettings();
  }

  function moneyLabel(value) {
    return typeof value === "number" ? "$" + value : "unlimited";
  }

  function remainingView(settings) {
    const spent = typeof settings.spentUsd === "number" ? settings.spentUsd : 0;
    function left(cap) {
      if (typeof cap !== "number") return "unlimited";
      return Math.max(0, cap - spent);
    }
    return {
      paidCallUsd: typeof settings.paidCallUsd === "number" ? settings.paidCallUsd : "unlimited",
      runUsd: left(settings.runUsd),
      maxLevelBudgetUsd: left(settings.maxLevelBudgetUsd),
      spentUsd: typeof settings.spentUsd === "number" ? settings.spentUsd : null,
    };
  }

  function budget(settings) {
    settings = settings || defaultSettings();
    const confirm = settings.confirm === true
      ? "Confirmation is on for a manual high or max. Auto does not ask."
      : "Confirmation is off.";
    return {
      requestsPerMinute: BUDGET_REQUESTS_PER_MINUTE,
      paidCallUsd: settings.paidCallUsd,
      runUsd: settings.runUsd,
      maxLevelBudgetUsd: settings.maxLevelBudgetUsd,
      confirm: settings.confirm === true,
      effortMode: settings.effortMode,
      remaining: remainingView(settings),
      rule: "About 20 requests a minute. Per call " + moneyLabel(settings.paidCallUsd) + ". Per run " + moneyLabel(settings.runUsd) + ". Max-level budget " + moneyLabel(settings.maxLevelBudgetUsd) + ". " + confirm,
    };
  }

  function moneyOk(value) {
    return value == null || (typeof value === "number" && isFinite(value) && value >= 0);
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
    const settings = resolveSettings(ctx);
    const efforts = effortPreview(routed.intent, shaped.steps, ctx, settings);
    const choice = chooseEffort(routed.intent, efforts, settings);
    const logged = recordChoice({
      intent: routed.intent,
      level: choice.level,
      costUsd: choice.costUsd,
      predictedUsd: choice.predictedUsd,
      reason: choice.reason,
      recordedAt: ctx.recordedAt == null ? null : ctx.recordedAt,
    }, ctx.storage);
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
      budget: budget(settings),
      settings: settings,
      governance: governance(),
      answerSpec: shaped.answerSpec,
      adapter: { id: adapter.id, kind: adapter.kind, called: false },
      efforts: efforts,
      effortChoice: {
        level: choice.level,
        costUsd: choice.costUsd,
        predictedUsd: choice.predictedUsd,
        reason: choice.reason,
        prompted: false,
        logged: !!logged,
      },
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
    if (!moneyOk(b.paidCallUsd)) err("PLAN_BUDGET_CALL", "per-call cap must be empty or a number that is at least 0");
    if (!moneyOk(b.runUsd)) err("PLAN_BUDGET_RUN", "per-run cap must be empty or a number that is at least 0");
    if (!moneyOk(b.maxLevelBudgetUsd)) err("PLAN_BUDGET_MAX", "max-level budget must be empty or a number that is at least 0");
    const settings = planObj.settings || defaultSettings();
    if (!planObj.settings || planObj.settings.schema !== SETTINGS_SCHEMA) err("PLAN_SETTINGS", "settings are required");
    if (EFFORT_MODES.indexOf(settings.effortMode) < 0) err("PLAN_SETTINGS_MODE", "effort mode is not known");
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
    if (!planObj.efforts) err("PLAN_EFFORT", "effort preview is required");
    EFFORT_LEVELS.forEach(function (level) {
      const row = planObj.efforts && planObj.efforts[level];
      if (!row) {
        err("PLAN_EFFORT_LEVEL", "missing effort " + level);
        return;
      }
      if (!moneyOk(row.paidCallUsd)) err("PLAN_EFFORT_CALL", level + " per-call cap must be empty or a number");
      if (!moneyOk(row.runUsd)) err("PLAN_EFFORT_RUN", level + " per-run cap must be empty or a number");
      const confirmOn = settings.confirm === true && settings.effortMode !== "auto";
      if (row.needsConfirm !== (confirmOn && (level === "high" || level === "max"))) err("PLAN_EFFORT_CONFIRM", level + " confirm gate drifted");
      if (row.costUsd !== "unknown" && !(row.costUsd && typeof row.costUsd.min === "number" && typeof row.costUsd.max === "number")) {
        err("PLAN_EFFORT_COST", level + " cost must be unknown or a min/max pair");
      }
      if (row.predictedUsd !== "unknown" && !(row.predictedUsd && typeof row.predictedUsd.min === "number" && typeof row.predictedUsd.max === "number")) {
        err("PLAN_EFFORT_PREDICTED", level + " predicted cost must be unknown or a min/max pair");
      }
      if (row.tokens !== "unknown" && !(row.tokens && typeof row.tokens.inputMin === "number")) {
        err("PLAN_EFFORT_TOKENS", level + " tokens must be unknown or a range");
      }
    });
    if (!planObj.effortChoice || EFFORT_LEVELS.indexOf(planObj.effortChoice.level) < 0) err("PLAN_EFFORT_CHOICE", "effort choice is required");
    if (planObj.effortChoice && planObj.effortChoice.prompted !== false) err("PLAN_EFFORT_PROMPT", "the effort choice must not prompt");
    if (settings.effortMode !== "auto" && planObj.effortChoice && planObj.effortChoice.level !== settings.effortMode) {
      err("PLAN_EFFORT_MODE", "a manual mode keeps the chosen level");
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

  function defaultPrices() {
    if (defaultPrices.cache) return defaultPrices.cache;
    let table = null;
    if (typeof require === "function") {
      try {
        table = require("./planner-prices.json");
      } catch (err) {
        table = null;
      }
    }
    if (!table && typeof window !== "undefined" && window.PlannerPrices) table = window.PlannerPrices;
    defaultPrices.cache = table;
    return table;
  }

  function priceTable(ctx) {
    if (ctx && ctx.prices) return ctx.prices;
    return defaultPrices();
  }

  function providerById(table, id) {
    const list = (table && table.providers) || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function priced(provider) {
    if (!provider) return false;
    return typeof provider.inputUsdPerMillion === "number" && typeof provider.outputUsdPerMillion === "number";
  }

  function wireFor(intent, level) {
    const build = BUILD_INTENTS.indexOf(intent) >= 0 && (level === "high" || level === "max");
    if (build) return { client: "cursor-cloud-agents", lane: "outsourced-coding", called: false };
    return { client: "cortex", lane: "governed", called: false };
  }

  function deliverable(intent, level) {
    if (level === "low") return "A single cheap or free hop: an idea or a spec only. No code.";
    if (level === "medium") return "A governed answer or a plan, plus code snippets or a diff for one module.";
    if (level === "high") {
      if (intent === "build-model") return "An ML plan: data, features, baseline, and eval. No training run.";
      if (intent === "build-code" || intent === "app-prompt") return "A full code change on the build lane: one PR with tests.";
      return "A governed answer on the Cortex lane.";
    }
    if (BUILD_INTENTS.indexOf(intent) >= 0) {
      return "An end-to-end build of a whole app or ML pipeline, plus orchestration, tests, and an improve loop.";
    }
    return "A governed Cortex answer at max effort.";
  }

  function capsFromSettings(settings) {
    settings = settings || defaultSettings();
    return {
      paidCallUsd: typeof settings.paidCallUsd === "number" ? settings.paidCallUsd : null,
      runUsd: typeof settings.runUsd === "number" ? settings.runUsd : null,
      maxLevelBudgetUsd: typeof settings.maxLevelBudgetUsd === "number" ? settings.maxLevelBudgetUsd : null,
      spentUsd: typeof settings.spentUsd === "number" ? settings.spentUsd : null,
    };
  }

  function requestCount(steps, level, profile) {
    const n = Math.max(0, steps | 0);
    if (!profile) return "unknown";
    if (level === "low") {
      return typeof profile.lowRequests === "number" ? profile.lowRequests : "unknown";
    }
    const per = profile.requestsPerStep && profile.requestsPerStep[level];
    if (typeof per !== "number") return "unknown";
    return n * per;
  }

  function tokenRange(requests, level, profile) {
    const tokens = profile && profile.tokensPerStep;
    const row = tokens && tokens[level];
    if (!row) return "unknown";
    if (typeof requests !== "number") return "unknown";
    const keys = ["inputMin", "inputMax", "outputMin", "outputMax"];
    for (let i = 0; i < keys.length; i++) {
      if (typeof row[keys[i]] !== "number") return "unknown";
    }
    return {
      inputMin: requests * row.inputMin,
      inputMax: requests * row.inputMax,
      outputMin: requests * row.outputMin,
      outputMax: requests * row.outputMax,
    };
  }

  function limitList(caps, requests, level) {
    const spent = typeof caps.spentUsd === "number" ? caps.spentUsd : 0;
    const limits = [];
    if (typeof caps.paidCallUsd === "number" && typeof requests === "number") limits.push(caps.paidCallUsd * requests);
    if (typeof caps.runUsd === "number") limits.push(Math.max(0, caps.runUsd - spent));
    if (level === "max" && typeof caps.maxLevelBudgetUsd === "number") limits.push(Math.max(0, caps.maxLevelBudgetUsd - spent));
    return limits;
  }

  function costRange(tokens, provider, requests, caps, level) {
    const limits = limitList(caps, requests, level);
    const stop = limits.length ? Math.min.apply(null, limits) : null;
    if (tokens === "unknown" || !priced(provider) || typeof requests !== "number") {
      return { costUsd: "unknown", predictedUsd: "unknown", capped: false, stopUsd: stop };
    }
    const min = (tokens.inputMin / 1000000) * provider.inputUsdPerMillion + (tokens.outputMin / 1000000) * provider.outputUsdPerMillion;
    const max = (tokens.inputMax / 1000000) * provider.inputUsdPerMillion + (tokens.outputMax / 1000000) * provider.outputUsdPerMillion;
    const predictedUsd = { min: min, max: max };
    if (stop == null) {
      return { costUsd: { min: min, max: max, capped: false }, predictedUsd: predictedUsd, capped: false, stopUsd: null };
    }
    const hit = max > stop || min > stop;
    return {
      costUsd: { min: Math.min(min, stop), max: Math.min(max, stop), capped: hit },
      predictedUsd: predictedUsd,
      capped: hit,
      stopUsd: stop,
    };
  }

  function diffPaths(list) {
    const out = [];
    (list || []).forEach(function (p) {
      if (typeof p !== "string") return;
      const name = p.trim();
      if (!name || name === "." || name === "*" || name.indexOf("..") === 0) return;
      if (out.indexOf(name) < 0) out.push(name);
    });
    return out;
  }

  function buildBrief(intent, level, ctx, caps) {
    const wire = wireFor(intent, level);
    if (wire.lane !== "outsourced-coding") return null;
    const paths = diffPaths(ctx && ctx.diffNames);
    return {
      schema: BRIEF_SCHEMA,
      diffFirst: true,
      wholeTree: false,
      targetRepo: (ctx && ctx.repo) || "Netie-AI/constructor",
      affectedPaths: paths,
      acceptanceTests: ["npm run test:laws", "npm run test:unit"],
      budget: { paidCallUsd: caps.paidCallUsd, runUsd: caps.runUsd, maxLevelBudgetUsd: caps.maxLevelBudgetUsd },
      note: paths.length
        ? "Paths come from the diff list. The whole tree is not ingested."
        : "No diff list was supplied. The whole tree is not ingested.",
    };
  }

  function effortRow(intent, steps, level, ctx, table, settings) {
    const profile = table && table.profile;
    const caps = capsFromSettings(settings);
    const requests = requestCount(steps, level, profile);
    const tokens = tokenRange(requests, level, profile);
    const wire = wireFor(intent, level);
    const providerId = table && table.laneProviders ? table.laneProviders[wire.lane] : null;
    const provider = providerById(table, providerId);
    const cost = costRange(tokens, provider, requests, caps, level);
    const confirmOn = settings.confirm === true && settings.effortMode !== "auto";
    return {
      level: level,
      deliverable: deliverable(intent, level),
      requests: requests,
      tokens: tokens,
      costUsd: cost.costUsd,
      predictedUsd: cost.predictedUsd,
      capped: cost.capped,
      stopUsd: cost.stopUsd,
      paidCallUsd: caps.paidCallUsd,
      runUsd: caps.runUsd,
      runCapUsd: cost.stopUsd,
      maxLevelBudgetUsd: caps.maxLevelBudgetUsd,
      needsConfirm: confirmOn && (level === "high" || level === "max"),
      wire: wire,
      providerId: providerId,
      providerPriced: priced(provider),
      brief: buildBrief(intent, level, ctx, caps),
      profileNote: (table && table.profileNote) || "",
    };
  }

  function effortPreview(intent, steps, ctx, settings) {
    const table = priceTable(ctx);
    settings = settings || resolveSettings(ctx);
    const stepCount = (steps || []).length;
    const out = {};
    EFFORT_LEVELS.forEach(function (level) {
      out[level] = effortRow(intent, stepCount, level, ctx, table, settings);
    });
    return out;
  }

  function routerLevel(intent) {
    if (intent === "unclear") return "low";
    if (BUILD_INTENTS.indexOf(intent) >= 0) return "high";
    return "medium";
  }

  function capIsSet(settings, level) {
    if (typeof settings.paidCallUsd === "number") return true;
    if (typeof settings.runUsd === "number") return true;
    if (level === "max" && typeof settings.maxLevelBudgetUsd === "number") return true;
    return false;
  }

  function fits(row, settings) {
    if (!row) return { ok: false, unknown: false, reason: "Missing effort row." };
    if (!capIsSet(settings, row.level)) return { ok: true, unknown: false, reason: "No user cap is set." };
    const predicted = row.predictedUsd;
    if (!predicted || predicted === "unknown" || typeof predicted.max !== "number") {
      return { ok: false, unknown: true, reason: "Predicted cost is unknown against a user cap." };
    }
    const spent = typeof settings.spentUsd === "number" ? settings.spentUsd : 0;
    if (typeof settings.paidCallUsd === "number") {
      if (typeof row.requests !== "number") return { ok: false, unknown: true, reason: "Request count is unknown against a per-call cap." };
      if (predicted.max > settings.paidCallUsd * row.requests) return { ok: false, unknown: false, reason: "Predicted cost is over the per-call cap." };
    }
    if (typeof settings.runUsd === "number") {
      const left = Math.max(0, settings.runUsd - spent);
      if (predicted.max > left) return { ok: false, unknown: false, reason: "Predicted cost is over the remaining run budget." };
    }
    if (row.level === "max" && typeof settings.maxLevelBudgetUsd === "number") {
      const left = Math.max(0, settings.maxLevelBudgetUsd - spent);
      if (predicted.max > left) return { ok: false, unknown: false, reason: "Predicted cost is over the remaining max-level budget." };
    }
    return { ok: true, unknown: false, reason: "Predicted cost fits the user caps." };
  }

  function chooseEffort(intent, efforts, settings) {
    settings = normalizeSettings(settings).settings;
    if (settings.effortMode !== "auto") {
      const level = settings.effortMode;
      const row = efforts[level];
      return {
        level: level,
        costUsd: row ? row.costUsd : "unknown",
        predictedUsd: row ? row.predictedUsd : "unknown",
        reason: "The effort mode is set to " + level + ".",
        prompted: false,
      };
    }
    const preferred = routerLevel(intent);
    const order = ["max", "high", "medium", "low"];
    const start = order.indexOf(preferred);
    let blockedUnknown = false;
    for (let i = start; i < order.length; i++) {
      const level = order[i];
      const row = efforts[level];
      const fit = fits(row, settings);
      if (fit.ok) {
        const stepped = level !== preferred;
        return {
          level: level,
          costUsd: row.costUsd,
          predictedUsd: row.predictedUsd,
          reason: stepped
            ? "Router picked " + preferred + " for " + intent + ". Estimator stepped down to " + level + ". " + fit.reason
            : "Router picked " + preferred + " for " + intent + ". " + fit.reason,
          prompted: false,
        };
      }
      if (fit.unknown) blockedUnknown = true;
    }
    const low = efforts.low;
    return {
      level: "low",
      costUsd: low ? low.costUsd : "unknown",
      predictedUsd: low ? low.predictedUsd : "unknown",
      reason: blockedUnknown
        ? "Predicted cost is unknown and a user cap is set, so auto stays at low. No dollar amount was guessed."
        : "No level fits the remaining user budget, so auto stays at low.",
      prompted: false,
    };
  }

  function cursorCloudAgentStub() {
    return {
      id: "cursor-cloud-agents",
      kind: "cursor-stub",
      calls: 0,
      send: function () {
        this.calls += 1;
        throw new Error("Cursor cloud agent stub is not called in this version");
      },
    };
  }

  function lightLlmEstimator() {
    return {
      id: "light-llm",
      kind: "light-llm",
      calls: 0,
      estimate: function () {
        this.calls += 1;
        throw new Error("light LLM estimator is not called in this version");
      },
    };
  }

  function deterministicEstimator() {
    return { id: "deterministic-profile", kind: "deterministic" };
  }

  function estimate(planObj, ctx) {
    ctx = ctx || {};
    const estimator = ctx.estimator || deterministicEstimator();
    const settings = ctx.settings
      ? normalizeSettings(ctx.settings).settings
      : ((planObj && planObj.settings) || defaultSettings());
    if (estimator.kind === "light-llm") {
      return {
        estimatorId: estimator.id,
        called: false,
        efforts: effortPreview(planObj && planObj.intent, (planObj && planObj.steps) || [], ctx, settings),
      };
    }
    if (estimator.kind === "custom" && typeof estimator.estimate === "function") {
      return estimator.estimate(planObj, ctx);
    }
    return {
      estimatorId: "deterministic-profile",
      called: false,
      efforts: effortPreview(planObj && planObj.intent, (planObj && planObj.steps) || [], ctx, settings),
    };
  }

  function costCalibration(predicted) {
    predicted = predicted || {};
    return {
      schema: CALIBRATION_SCHEMA,
      predicted: {
        requests: predicted.requests === undefined ? null : predicted.requests,
        tokens: predicted.tokens === undefined ? null : predicted.tokens,
        costUsd: predicted.costUsd === undefined ? null : predicted.costUsd,
      },
      actual: { requests: null, tokens: null, costUsd: null },
      recordedAt: null,
    };
  }

  function startEffort(planObj, level, ctx) {
    ctx = ctx || {};
    const row = planObj && planObj.efforts && planObj.efforts[level];
    if (!row) return { ok: false, started: false, sent: false, reason: "Unknown effort." };
    const settings = normalizeSettings(ctx.settings || (planObj && planObj.settings) || defaultSettings()).settings;
    const confirmOn = settings.effortMode !== "auto" && settings.confirm === true && (level === "high" || level === "max");
    if (confirmOn && ctx.confirmed !== true) {
      return { ok: false, started: false, sent: false, reason: "Confirm before high or max starts." };
    }
    const fit = fits(row, settings);
    if (!fit.ok && !fit.unknown) {
      return { ok: false, started: false, sent: false, reason: fit.reason };
    }
    return {
      ok: true,
      started: false,
      sent: false,
      reason: fit.unknown ? fit.reason + " No prompt is sent in this version." : "Allowed. No prompt is sent in this version.",
      wire: row.wire,
      brief: row.brief,
      calibration: costCalibration(row),
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
    EFFORT_LEVELS: EFFORT_LEVELS.slice(),
    SETTINGS_SCHEMA: SETTINGS_SCHEMA,
    LOG_SCHEMA: LOG_SCHEMA,
    SETTINGS_KEY: SETTINGS_KEY,
    LOG_KEY: LOG_KEY,
    defaultSettings: defaultSettings,
    readSettings: readSettings,
    writeSettings: writeSettings,
    readLog: readLog,
    priceTable: function () { return defaultPrices(); },
    wireFor: wireFor,
    effortPreview: function (intent, steps, ctx) { return effortPreview(intent, steps, ctx, resolveSettings(ctx)); },
    estimate: estimate,
    startEffort: startEffort,
    costCalibration: costCalibration,
    cursorCloudAgentStub: cursorCloudAgentStub,
    lightLlmEstimator: lightLlmEstimator,
    deterministicEstimator: deterministicEstimator,
  };
});
