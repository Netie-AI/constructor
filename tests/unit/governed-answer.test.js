// Loader validation and the three render states. Example fixture only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const GA = require(path.join(__dirname, "..", "..", "governed-answer.js"));
const FIXTURE = path.join(__dirname, "..", "fixtures", "governed-answer.example.jsonl");

function line(extra) {
  return JSON.stringify(
    Object.assign(
      {
        question: "example question",
        sql: null,
        rows: [],
        source: null,
        tables: [],
        provider: "example-provider",
        model: "example-model",
        verdict: null,
        answer_key: null,
      },
      extra || {}
    )
  );
}

test("schema version is 0.2.0 and the loader does not fetch", () => {
  assert.equal(GA.VERSION, "0.2.0");
  assert.equal(GA.SCHEMA, "netie.governed-answer/1");
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "governed-answer.js"), "utf8");
  assert.equal(/\bfetch\s*\(/.test(src), false);
});

test("example fixture is labelled and is not a measured result", () => {
  const raw = fs.readFileSync(FIXTURE, "utf8");
  assert.match(raw, /example data, not a measured result/);
  const loaded = GA.loadText(raw);
  assert.equal(loaded.ok, true, JSON.stringify(loaded.errors));
  assert.equal(loaded.exampleLabel, GA.EXAMPLE_LABEL);
  assert.equal(loaded.records.length, 9);
  assert.equal(loaded.views.length, 9);
  const states = loaded.views.map((v) => v.state);
  assert.deepEqual(states, ["governed", "unlinked", "withheld", "refused", "governed", "refused", "refused", "refused", "refused"]);
});

test("governed view shows sql, rows, source, and the badge", () => {
  const loaded = GA.loadText(fs.readFileSync(FIXTURE, "utf8"));
  const view = loaded.views[0];
  assert.equal(view.state, "governed");
  assert.equal(view.badge, "governed");
  assert.match(view.sql, /^SELECT example_col/);
  assert.equal(view.rows[0].example_col, "example-token");
  assert.equal(view.source, "example-source");
  assert.deepEqual(view.tables, ["example_table"]);
  assert.equal(view.link.table, "example_table");
  assert.equal(view.link.key, "example_key");
  assert.equal(view.link.measure, "example_measure");
  assert.equal(view.verdict, "match");
  assert.deepEqual(view.values, []);
  assert.equal(view.exampleLabel, "example data, not a measured result");
});

test("no link shows the idea only, values empty, badge off", () => {
  const loaded = GA.loadText(fs.readFileSync(FIXTURE, "utf8"));
  const view = loaded.views[1];
  assert.equal(view.state, "unlinked");
  assert.equal(view.badge, null);
  assert.equal(view.idea, "example model idea with no ontology link");
  assert.deepEqual(view.values, []);
  assert.equal(view.sql, null);
  assert.deepEqual(view.rows, []);
  assert.equal(view.notice, null);
});

test("a figure without an executed query is withheld and the number is not in the view", () => {
  const raw = fs.readFileSync(FIXTURE, "utf8");
  assert.match(raw, /424242/);
  const view = GA.loadText(raw).views[2];
  assert.equal(view.state, "withheld");
  assert.equal(view.notice, "WITHHELD");
  assert.equal(view.badge, null);
  assert.equal(view.sql, null);
  assert.deepEqual(view.rows, []);
  assert.deepEqual(view.values, []);
  assert.equal(view.idea, null);
  assert.equal(JSON.stringify(view).includes("424242"), false);
});

test("predict is refused unless a fitted model envelope says forecast", () => {
  const raw = fs.readFileSync(FIXTURE, "utf8");
  assert.match(raw, /515151/);
  const refused = GA.loadText(raw).views[3];
  assert.equal(refused.state, "refused");
  assert.equal(refused.notice, "refused");
  assert.equal(refused.badge, null);
  assert.equal(refused.refusalChip, "unlabelled");
  assert.deepEqual(refused.values, []);
  assert.equal(JSON.stringify(refused).includes("515151"), false);

  const forecast = GA.loadText(raw).views[4];
  assert.equal(forecast.state, "governed");
  assert.equal(forecast.forecast, true);
  assert.equal(forecast.badge, "governed");
  assert.equal(forecast.rows[0].example_forecast, "example-forecast-token");
  assert.equal(JSON.stringify(forecast).includes("515151"), false);

  const drafted = GA.loadText(
    line({
      question: "predict example",
      predict: true,
      sql: "SELECT 1",
      executed: false,
      model_envelope: { fitted: true, task: "classify" },
      values: [{ value: 515151 }],
    })
  );
  assert.equal(drafted.views[0].state, "refused");
  assert.equal(JSON.stringify(drafted.views[0]).includes("515151"), false);

  const bareForecast = GA.loadText(
    line({
      question: "predict example",
      predict: true,
      model_envelope: { fitted: true, task: "forecast" },
      values: [{ value: 424242 }],
    })
  );
  assert.equal(bareForecast.views[0].state, "withheld");
  assert.equal(JSON.stringify(bareForecast.views[0]).includes("424242"), false);
});

test("a stored badge cannot promote an unlinked row", () => {
  const loaded = GA.loadText(line({ badge: "governed", idea: "example idea only" }));
  assert.equal(loaded.ok, true);
  assert.equal(loaded.views[0].state, "unlinked");
  assert.equal(loaded.views[0].badge, null);
});

test("partial ontology link is not governed", () => {
  const loaded = GA.loadText(
    line({
      sql: "SELECT example_col FROM example_table",
      rows: [{ example_col: "example-token" }],
      ontology: { table: "example_table", key: "example_key" },
    })
  );
  assert.equal(loaded.views[0].state, "unlinked");
  assert.equal(loaded.views[0].badge, null);
  assert.deepEqual(loaded.views[0].rows, []);
});

test("loader rejects a bad shape and does not return partial rows", () => {
  const missing = GA.loadText('{"question":"only"}\n');
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.records, []);
  assert.deepEqual(missing.views, []);
  assert.ok(missing.errors.some((e) => e.message === "missing sql"));

  const badRows = GA.loadText(line({ rows: { a: 1 } }));
  assert.equal(badRows.ok, false);
  assert.ok(badRows.errors.some((e) => e.message === "rows must be an array"));

  const notJson = GA.loadText("{not json}\n");
  assert.equal(notJson.ok, false);
  assert.equal(notJson.errors[0].message, "not JSON");

  const empty = GA.loadText("\n\n");
  assert.equal(empty.ok, false);
  assert.equal(empty.errors[0].message, "no records");

  const mislabel = GA.loadText(line({ example: true, label: "measured" }));
  assert.equal(mislabel.ok, false);
  assert.match(mislabel.errors[0].message, /example label/);
});

test("aliases sql_used, row_match, and source.tables validate", () => {
  const raw = JSON.stringify({
    question: "example alias question",
    sql_used: "SELECT example_col FROM example_table",
    rows: [{ example_col: "example-token" }],
    source: { name: "example-source", tables: ["example_table"] },
    provider: "example-provider",
    model: "example-model",
    row_match: true,
    answer_key: [{ example_col: "example-token" }],
    ontology: { table: "example_table", key: "example_key", measure: "example_measure" },
  });
  const loaded = GA.loadText(raw);
  assert.equal(loaded.ok, true, JSON.stringify(loaded.errors));
  assert.equal(loaded.views[0].state, "governed");
  assert.equal(loaded.views[0].verdict, "match");
  assert.equal(loaded.views[0].source, "example-source");
  assert.deepEqual(loaded.records[0].tables, ["example_table"]);
  assert.deepEqual(loaded.records[0].rows, [{ example_col: "example-token" }]);
});

test("refused chips use refusal_reason exactly, and a missing reason stays unlabelled", () => {
  const raw = fs.readFileSync(FIXTURE, "utf8");
  const views = GA.loadText(raw).views;
  const chips = views.filter((v) => v.state === "refused").map((v) => v.refusalChip);
  assert.deepEqual(chips, [
    "unlabelled",
    "pacing (rate limit / no healthy key)",
    "not yet an approved query",
    "wrong level of detail",
    "truly missing data",
  ]);
  const missing = views[8];
  assert.equal(missing.missing, "example measure");
  assert.equal(missing.wouldAnswer, "example_file");
  assert.equal(missing.sql, null);
  assert.deepEqual(missing.rows, []);
  assert.deepEqual(missing.values, []);
  assert.equal(views[0].refusalChip, null);

  function refused(reason, extra) {
    return GA.loadText(line(Object.assign({ verdict: "refused", refusal_reason: reason }, extra || {}))).views[0];
  }
  assert.equal(refused("pacing").refusalChip, "pacing (rate limit / no healthy key)");
  assert.equal(refused("pacing").missing, null);
  assert.equal(refused("not yet an approved query").refusalChip, "not yet an approved query");
  assert.equal(refused("wrong level of detail").refusalChip, "wrong level of detail");
  const gap = refused("truly missing data", { missing: "example measure", would_answer: "example_file" });
  assert.equal(gap.refusalChip, "truly missing data");
  assert.equal(gap.missing, "example measure");
  assert.equal(gap.wouldAnswer, "example_file");
  assert.equal(refused("truly missing data").missing, null);
  assert.equal(refused("truly missing data").wouldAnswer, null);

  const guessed = refused("rate limit");
  assert.equal(guessed.state, "refused");
  assert.equal(guessed.refusalChip, "unlabelled");
  assert.equal(guessed.refusalChip.includes("pacing"), false);

  const absent = GA.loadText(line({ verdict: "refused", values: [{ value: 424242 }] })).views[0];
  assert.equal(absent.refusalChip, "unlabelled");
  assert.equal(absent.state, "refused");
  assert.equal(JSON.stringify(absent).includes("424242"), false);

  const bad = GA.loadText(line({ refusal_reason: 1 }));
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.message === "refusal_reason must be a string or null"));

  const loaded = GA.loadText(raw);
  assert.deepEqual(
    GA.filterRefusals(loaded.views, "pacing (rate limit / no healthy key)").map((v) => v.question),
    ["example pacing refusal"]
  );
  assert.deepEqual(
    GA.filterRefusals(loaded.views, "not yet an approved query").map((v) => v.question),
    ["example unapproved refusal"]
  );
  assert.deepEqual(
    GA.filterRefusals(loaded.views, "wrong level of detail").map((v) => v.question),
    ["example detail refusal"]
  );
  assert.deepEqual(
    GA.filterRefusals(loaded.views, "truly missing data").map((v) => v.question),
    ["example missing-data refusal"]
  );
  assert.deepEqual(
    GA.filterRefusals(loaded.views, "unlabelled").map((v) => v.question),
    ["example predict question"]
  );
  assert.equal(GA.filterRefusals(loaded.views, "refusals").length, 5);
  assert.equal(GA.filterRefusals(loaded.views, "all").length, 5);
});

test("url loader refuses Cortex and model hosts", () => {
  assert.match(GA.urlLoadError("https://app.netie.ai/cortex/constructor/run"), /does not call Cortex/);
  assert.match(GA.urlLoadError("http://127.0.0.1:8012/cortex/constructor/run"), /does not call Cortex/);
  assert.match(GA.urlLoadError("https://api.openai.com/v1/chat/completions"), /does not call a model/);
  assert.match(GA.urlLoadError("not a url"), /not valid/);
  assert.equal(GA.urlLoadError("https://example.com/runs/phase.jsonl"), null);
});
