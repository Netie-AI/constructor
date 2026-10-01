/* Governed Answer loader for the Constructor skin (v0.2.0).
   Stored JSONL only: one object per question. No DOM. No fetch. No model call.
   UMD: module.exports under Node, window.GovernedAnswer in the browser.
   Schema netie.governed-answer/1.
   Cortex stays the only engine. This file only classifies stored rows. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && typeof root === "object") root.GovernedAnswer = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "0.2.0";
  const SCHEMA = "netie.governed-answer/1";
  const EXAMPLE_LABEL = "example data, not a measured result";
  const FIGURE_RE = /\d[\d,]*(?:\.\d+)?/;
  const CHIP_PACING = "pacing (rate limit / no healthy key)";
  const CHIP_NOT_APPROVED = "not yet an approved query";
  const CHIP_WRONG_DETAIL = "wrong level of detail";
  const CHIP_MISSING = "truly missing data";
  const CHIP_UNLABELLED = "unlabelled";
  const REFUSAL_CHIPS = [CHIP_PACING, CHIP_NOT_APPROVED, CHIP_WRONG_DETAIL, CHIP_MISSING, CHIP_UNLABELLED];

  function clone(x) {
    if (x === undefined) return undefined;
    return JSON.parse(JSON.stringify(x));
  }

  function clean(v) {
    return typeof v === "string" ? v.trim() : "";
  }

  function textHasFigure(s) {
    return FIGURE_RE.test(String(s || ""));
  }

  function cellHasFigure(c) {
    if (typeof c === "number" && isFinite(c)) return true;
    if (typeof c === "string" && textHasFigure(c)) return true;
    return false;
  }

  function rowsHaveFigure(rows) {
    if (!Array.isArray(rows)) return false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (Array.isArray(row)) {
        if (row.some(cellHasFigure)) return true;
      } else if (row && typeof row === "object") {
        const keys = Object.keys(row);
        for (let k = 0; k < keys.length; k++) {
          if (cellHasFigure(row[keys[k]])) return true;
        }
      } else if (cellHasFigure(row)) return true;
    }
    return false;
  }

  function valuesHaveFigure(list) {
    if (!Array.isArray(list)) return false;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (cellHasFigure(v)) return true;
      if (v && typeof v === "object" && cellHasFigure(v.value)) return true;
    }
    return false;
  }

  function recordHasFigure(rec) {
    if (valuesHaveFigure(rec.values)) return true;
    if (valuesHaveFigure(rec.figures)) return true;
    if (rowsHaveFigure(rec.rows)) return true;
    if (textHasFigure(rec.idea) || textHasFigure(rec.text)) return true;
    return false;
  }

  function executedSql(rec) {
    if (rec.executed === false) return "";
    if (rec.sql == null) return "";
    return String(rec.sql).trim();
  }

  function ontologyLink(rec) {
    const o = rec.ontology || rec.link || null;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const table = clean(o.table);
    const key = clean(o.key);
    const measure = clean(o.measure);
    if (!table || !key || !measure) return null;
    return { table: table, key: key, measure: measure };
  }

  function isPredict(rec) {
    if (rec.predict === true) return true;
    const kind = String(rec.kind || rec.task || "").toLowerCase();
    if (kind === "predict" || kind === "prediction") return true;
    return /^\s*predict\b/i.test(rec.question || "");
  }

  function forecastAllowed(rec) {
    const env = rec.model_envelope || null;
    if (!env || typeof env !== "object" || Array.isArray(env)) return false;
    if (env.fitted !== true) return false;
    const says = String(env.task || env.kind || env.says || "").toLowerCase();
    return says === "forecast";
  }

  function sourceLabel(rec) {
    if (typeof rec.source === "string" && rec.source.trim()) return rec.source.trim();
    if (rec.source && typeof rec.source === "object" && !Array.isArray(rec.source)) {
      if (typeof rec.source.name === "string" && rec.source.name.trim()) return rec.source.name.trim();
      if (typeof rec.source.id === "string" && rec.source.id.trim()) return rec.source.id.trim();
    }
    return null;
  }

  function exampleLabel(rec) {
    if (rec.example === true || rec.label === EXAMPLE_LABEL) return EXAMPLE_LABEL;
    return null;
  }

  function baseView(rec) {
    return {
      state: "unlinked",
      question: rec.question,
      badge: null,
      sql: null,
      rows: [],
      source: null,
      tables: [],
      provider: rec.provider == null ? null : String(rec.provider),
      model: rec.model == null ? null : String(rec.model),
      verdict: null,
      answerKey: null,
      idea: null,
      values: [],
      notice: null,
      link: null,
      exampleLabel: exampleLabel(rec),
      forecast: false,
      refusalChip: null,
      missing: null,
      wouldAnswer: null,
    };
  }

  function refusalChip(rec) {
    const raw = rec.refusal_reason == null ? "" : String(rec.refusal_reason).trim();
    if (raw === "pacing" || raw === CHIP_PACING) return CHIP_PACING;
    if (raw === CHIP_NOT_APPROVED) return CHIP_NOT_APPROVED;
    if (raw === CHIP_WRONG_DETAIL) return CHIP_WRONG_DETAIL;
    if (raw === CHIP_MISSING) return CHIP_MISSING;
    return CHIP_UNLABELLED;
  }

  function isRefusal(rec) {
    if (isPredict(rec) && !forecastAllowed(rec)) return true;
    if (String(rec.verdict || "").toLowerCase() === "refused") return true;
    return !!(rec.refusal_reason != null && String(rec.refusal_reason).trim());
  }

  function plainDetail(v) {
    const text = clean(v);
    if (!text || textHasFigure(text)) return null;
    return text;
  }

  function refuseView(rec, view) {
    view.state = "refused";
    view.notice = "refused";
    view.badge = null;
    view.sql = null;
    view.rows = [];
    view.values = [];
    view.idea = null;
    view.answerKey = null;
    view.refusalChip = refusalChip(rec);
    if (view.refusalChip === CHIP_MISSING) {
      view.missing = plainDetail(rec.missing);
      view.wouldAnswer = plainDetail(rec.would_answer);
    }
    return view;
  }

  function classify(rec) {
    const view = baseView(rec);
    if (isRefusal(rec)) return refuseView(rec, view);
    const sql = executedSql(rec);
    if (recordHasFigure(rec) && !sql) {
      view.state = "withheld";
      view.notice = "WITHHELD";
      return view;
    }
    const link = ontologyLink(rec);
    if (link && sql) {
      view.state = "governed";
      view.badge = "governed";
      view.sql = sql;
      view.rows = clone(rec.rows) || [];
      view.source = sourceLabel(rec);
      view.tables = rec.tables.slice();
      view.verdict = rec.verdict == null ? null : String(rec.verdict);
      view.answerKey = clone(rec.answer_key);
      view.link = link;
      view.forecast = isPredict(rec) && forecastAllowed(rec);
      return view;
    }
    view.state = "unlinked";
    view.idea = String(rec.idea || "")
      .replace(FIGURE_RE, "")
      .replace(/\s+/g, " ")
      .trim();
    view.values = [];
    view.badge = null;
    return view;
  }

  function asVerdict(v) {
    if (typeof v === "boolean") return v ? "match" : "mismatch";
    return v;
  }

  function validateRecord(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { ok: false, errors: ["record must be an object"] };
    }
    const sql = obj.sql !== undefined ? obj.sql : obj.sql_used;
    let verdict = obj.verdict !== undefined ? obj.verdict : obj.row_match;
    verdict = asVerdict(verdict);
    let tables = obj.tables;
    if (tables === undefined && Array.isArray(obj.source_tables)) tables = obj.source_tables;
    if (tables === undefined && obj.source && typeof obj.source === "object" && Array.isArray(obj.source.tables)) {
      tables = obj.source.tables;
    }
    const answerKeyPresent =
      Object.prototype.hasOwnProperty.call(obj, "answer_key") || Object.prototype.hasOwnProperty.call(obj, "answerKey");
    const answer_key = Object.prototype.hasOwnProperty.call(obj, "answer_key") ? obj.answer_key : obj.answerKey;

    const missing = [];
    if (typeof obj.question !== "string" || !obj.question.trim()) missing.push("question");
    if (sql === undefined) missing.push("sql");
    if (obj.rows === undefined) missing.push("rows");
    if (!Object.prototype.hasOwnProperty.call(obj, "source") && obj.source_tables === undefined) missing.push("source");
    if (tables === undefined) missing.push("tables");
    if (obj.provider === undefined) missing.push("provider");
    if (obj.model === undefined) missing.push("model");
    if (verdict === undefined) missing.push("verdict");
    if (!answerKeyPresent) missing.push("answer_key");
    if (missing.length) return { ok: false, errors: missing.map(function (k) { return "missing " + k; }) };

    const errors = [];
    if (sql !== null && typeof sql !== "string") errors.push("sql must be a string or null");
    if (!Array.isArray(obj.rows)) errors.push("rows must be an array");
    const source = Object.prototype.hasOwnProperty.call(obj, "source") ? obj.source : null;
    if (source !== null && typeof source !== "string" && (typeof source !== "object" || Array.isArray(source))) {
      errors.push("source must be a string, object, or null");
    }
    if (!Array.isArray(tables) || tables.some(function (t) { return typeof t !== "string"; })) {
      errors.push("tables must be an array of strings");
    }
    if (obj.provider !== null && typeof obj.provider !== "string") errors.push("provider must be a string or null");
    if (obj.model !== null && typeof obj.model !== "string") errors.push("model must be a string or null");
    if (verdict !== null && typeof verdict !== "string") errors.push("verdict must be a string or null");
    if (obj.executed !== undefined && typeof obj.executed !== "boolean") errors.push("executed must be a boolean");
    if (obj.predict !== undefined && typeof obj.predict !== "boolean") errors.push("predict must be a boolean");
    if (obj.idea !== undefined && obj.idea !== null && typeof obj.idea !== "string") errors.push("idea must be a string");
    if (obj.refusal_reason !== undefined && obj.refusal_reason !== null && typeof obj.refusal_reason !== "string") {
      errors.push("refusal_reason must be a string or null");
    }
    if (obj.missing !== undefined && obj.missing !== null && typeof obj.missing !== "string") {
      errors.push("missing must be a string or null");
    }
    if (obj.would_answer !== undefined && obj.would_answer !== null && typeof obj.would_answer !== "string") {
      errors.push("would_answer must be a string or null");
    }
    if (obj.values !== undefined && !Array.isArray(obj.values)) errors.push("values must be an array");
    if (obj.example === true && obj.label !== EXAMPLE_LABEL) {
      errors.push("example label must be exactly: " + EXAMPLE_LABEL);
    }
    const onto = obj.ontology !== undefined ? obj.ontology : obj.link;
    if (onto !== undefined && onto !== null) {
      if (typeof onto !== "object" || Array.isArray(onto)) errors.push("ontology must be an object");
      else {
        ["table", "key", "measure"].forEach(function (k) {
          if (onto[k] !== undefined && onto[k] !== null && typeof onto[k] !== "string") {
            errors.push("ontology." + k + " must be a string");
          }
        });
      }
    }
    const env = obj.model_envelope || obj.fitted_model_envelope || null;
    if ((obj.model_envelope !== undefined && obj.model_envelope !== null) || (obj.fitted_model_envelope !== undefined && obj.fitted_model_envelope !== null)) {
      if (!env || typeof env !== "object" || Array.isArray(env)) errors.push("model_envelope must be an object");
      else {
        if (env.fitted !== undefined && typeof env.fitted !== "boolean") errors.push("model_envelope.fitted must be a boolean");
        const task = env.task || env.kind || env.says;
        if (task !== undefined && typeof task !== "string") errors.push("model_envelope.task must be a string");
      }
    }
    if (errors.length) return { ok: false, errors: errors };

    return {
      ok: true,
      errors: [],
      record: {
        question: obj.question.trim(),
        sql: sql,
        rows: clone(obj.rows) || [],
        source: source,
        tables: tables.slice(),
        provider: obj.provider,
        model: obj.model,
        verdict: verdict,
        answer_key: clone(answer_key),
        executed: obj.executed,
        predict: obj.predict === true,
        kind: typeof obj.kind === "string" ? obj.kind : "",
        task: typeof obj.task === "string" ? obj.task : "",
        idea: typeof obj.idea === "string" ? obj.idea : typeof obj.text === "string" ? obj.text : "",
        text: typeof obj.text === "string" ? obj.text : "",
        values: Array.isArray(obj.values) ? clone(obj.values) : [],
        figures: Array.isArray(obj.figures) ? clone(obj.figures) : [],
        ontology: obj.ontology || null,
        link: obj.link || null,
        model_envelope: env,
        example: obj.example === true,
        label: typeof obj.label === "string" ? obj.label : "",
        refusal_reason: typeof obj.refusal_reason === "string" ? obj.refusal_reason : null,
        missing: typeof obj.missing === "string" ? obj.missing : "",
        would_answer: typeof obj.would_answer === "string" ? obj.would_answer : "",
      },
    };
  }

  function filterRefusals(views, reason) {
    const list = Array.isArray(views) ? views : [];
    const refused = list.filter(function (v) { return v && v.state === "refused"; });
    if (!reason || reason === "all" || reason === "refusals") return refused;
    return refused.filter(function (v) { return v.refusalChip === reason; });
  }

  function loadText(text) {
    const errors = [];
    const records = [];
    const raw = String(text == null ? "" : text).replace(/^\uFEFF/, "");
    const lines = raw.split(/\r?\n/);
    let seen = 0;
    lines.forEach(function (line, i) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === "#") return;
      seen += 1;
      let obj;
      try {
        obj = JSON.parse(trimmed);
      } catch (err) {
        errors.push({ line: i + 1, message: "not JSON" });
        return;
      }
      const v = validateRecord(obj);
      if (!v.ok) {
        v.errors.forEach(function (msg) {
          errors.push({ line: i + 1, message: msg });
        });
        return;
      }
      records.push(v.record);
    });
    if (!seen) errors.push({ line: 0, message: "no records" });
    const example = records.some(function (r) { return r.example === true || r.label === EXAMPLE_LABEL; });
    return {
      ok: errors.length === 0,
      schema: SCHEMA,
      errors: errors,
      records: errors.length ? [] : records,
      views: errors.length ? [] : records.map(classify),
      exampleLabel: example && errors.length === 0 ? EXAMPLE_LABEL : null,
    };
  }

  function urlLoadError(url) {
    let u;
    try {
      u = new URL(String(url || "").trim());
    } catch (err) {
      return "URL is not valid. Use the file picker.";
    }
    if (u.username || u.password) return "URL refused. No credentials in the loader URL.";
    if (u.protocol !== "http:" && u.protocol !== "https:") return "URL must be http or https. Use the file picker.";
    const host = u.hostname.toLowerCase();
    const path = (u.pathname || "").toLowerCase();
    if (host === "app.netie.ai" || path.indexOf("/cortex") >= 0) {
      return "URL refused. This loader does not call Cortex.";
    }
    const banned = [
      "openai.com",
      "anthropic.com",
      "generativelanguage.googleapis.com",
      "api.groq.com",
      "openrouter.ai",
    ];
    for (let i = 0; i < banned.length; i++) {
      const b = banned[i];
      if (host === b || host.endsWith("." + b)) return "URL refused. This loader does not call a model.";
    }
    if (/\/(chat\/completions|embeddings|responses)(\/|$)/.test(path)) {
      return "URL refused. This loader does not call a model.";
    }
    return null;
  }

  return {
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    EXAMPLE_LABEL: EXAMPLE_LABEL,
    REFUSAL_CHIPS: REFUSAL_CHIPS,
    loadText: loadText,
    classify: classify,
    filterRefusals: filterRefusals,
    urlLoadError: urlLoadError,
  };
});
