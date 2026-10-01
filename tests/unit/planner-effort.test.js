// Effort picker, cost preview, and build-lane routing. No model call. No stub call.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");
const { execSync } = require("node:child_process");

const root = path.join(__dirname, "..", "..");
const P = require(path.join(root, "planner.js"));
const pricesJs = require(path.join(root, "planner-prices.js"));
const pricesJson = require(path.join(root, "planner-prices.json"));

const LEVELS = ["low", "medium", "high", "max"];

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function tokenRow(n) {
  return { inputMin: n, inputMax: n, outputMin: n, outputMax: n };
}

test("price config matches the browser copy and leaves unknown prices null", () => {
  assert.deepEqual(pricesJs, pricesJson);
  assert.equal(pricesJson.version, "1");
  assert.equal(pricesJson.asOf, "2026-10-01");
  pricesJson.providers.forEach((provider) => {
    assert.equal(provider.inputUsdPerMillion, null, provider.id);
    assert.equal(provider.outputUsdPerMillion, null, provider.id);
    assert.equal(provider.asOf, "2026-10-01");
  });
  const cursor = pricesJson.providers.find((p) => p.id === "cursor-cloud-agents");
  assert.equal(cursor.sourceUrl, "https://cursor.com/docs/cloud-agent");
  assert.equal(Object.prototype.hasOwnProperty.call(pricesJson, "caps"), false);
  assert.equal(pricesJson.profile.tokensPerStep, null);
});

test("shipped estimator shows unknown cost and never invents a price", () => {
  const plan = P.plan("list open orders where status is open, columns order_id status region, one row per order, sort by order_id");
  LEVELS.forEach((level) => {
    const row = plan.efforts[level];
    assert.equal(row.costUsd, "unknown");
    assert.equal(row.tokens, "unknown");
    assert.equal(row.providerPriced, false);
    assert.equal(typeof row.costUsd, "string");
  });
  const withTokens = clone(pricesJson);
  withTokens.profile.tokensPerStep = {
    low: tokenRow(1000),
    medium: tokenRow(1000),
    high: tokenRow(1000),
    max: tokenRow(1000),
  };
  const priced = P.estimate(plan, { prices: withTokens });
  LEVELS.forEach((level) => {
    assert.equal(priced.efforts[level].costUsd, "unknown");
    assert.notEqual(typeof priced.efforts[level].costUsd, "number");
  });
});

test("request counts are monotonic and follow the profile", () => {
  const plan = P.plan("Average order amount by month");
  assert.equal(plan.steps.length, 3);
  const requests = LEVELS.map((level) => plan.efforts[level].requests);
  assert.deepEqual(requests, [1, 3, 6, 9]);
  for (let i = 1; i < requests.length; i++) assert.ok(requests[i] >= requests[i - 1]);
  assert.equal(plan.efforts.low.deliverable.indexOf("No code") >= 0, true);
  assert.equal(plan.efforts.medium.deliverable.indexOf("one module") >= 0, true);
});

function memory() {
  const bag = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
    },
    setItem(key, value) {
      bag[key] = String(value);
    },
    removeItem(key) {
      delete bag[key];
    },
  };
}

function pricedTable() {
  const table = clone(pricesJson);
  table.profile.tokensPerStep = {
    low: tokenRow(1000),
    medium: tokenRow(1000),
    high: tokenRow(1000),
    max: tokenRow(1000),
  };
  table.providers.push({
    id: "fixture-priced",
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 8,
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-4.1",
    asOf: "2026-10-01",
    note: "Test fixture. Not the shipped lane price.",
  });
  table.laneProviders.governed = "fixture-priced";
  table.laneProviders["outsourced-coding"] = "fixture-priced";
  return table;
}

test("a sourced fixture price is monotonic and an empty cap does not limit it", () => {
  const table = pricedTable();
  const plan = P.plan("Look up the customer row for account_id A-14", { prices: table });
  const steps = plan.steps.length;
  const perRequest = (1000 / 1000000) * 2 + (1000 / 1000000) * 8;
  const requests = [1, steps, steps * 2, steps * 3];
  const costs = LEVELS.map((level) => plan.efforts[level].costUsd.max);
  assert.deepEqual(costs, requests.map((n) => n * perRequest));
  for (let i = 1; i < costs.length; i++) assert.ok(costs[i] >= costs[i - 1]);
  LEVELS.forEach((level) => {
    assert.equal(plan.efforts[level].capped, false);
    assert.equal(plan.efforts[level].stopUsd, null);
    assert.equal(plan.efforts[level].paidCallUsd, null);
    assert.equal(plan.efforts[level].runUsd, null);
    assert.deepEqual(plan.efforts[level].predictedUsd, plan.efforts[level].costUsd.min === undefined ? plan.efforts[level].predictedUsd : { min: plan.efforts[level].costUsd.min, max: plan.efforts[level].costUsd.max });
  });
  assert.equal(plan.budget.remaining.paidCallUsd, "unlimited");
  assert.equal(plan.budget.remaining.runUsd, "unlimited");
  assert.equal(plan.budget.remaining.maxLevelBudgetUsd, "unlimited");
});

test("a user-set cap is enforced and the remaining budget shrinks only for a numeric spend", () => {
  const table = pricedTable();
  const text = "Look up the customer row for account_id A-14";
  const perRequest = (1000 / 1000000) * 2 + (1000 / 1000000) * 8;
  const open = P.plan(text, { prices: table });
  const steps = open.steps.length;
  assert.equal(open.efforts.medium.costUsd.max, steps * perRequest);
  assert.equal(open.efforts.medium.capped, false);

  const capped = P.plan(text, {
    prices: table,
    settings: { effortMode: "auto", runUsd: 0.02, paidCallUsd: null, maxLevelBudgetUsd: null },
  });
  assert.equal(capped.effortChoice.level, "low");
  assert.equal(capped.effortChoice.prompted, false);
  assert.equal(capped.efforts.low.capped, false);
  assert.equal(capped.efforts.low.predictedUsd.max, 1 * perRequest);
  assert.equal(capped.efforts.medium.capped, true);
  assert.equal(capped.efforts.medium.predictedUsd.max, steps * perRequest);
  assert.equal(capped.efforts.medium.costUsd.max, Math.min(steps * perRequest, 0.02));
  assert.ok(capped.efforts.medium.costUsd.max <= 0.02);
  const over = P.startEffort(capped, "medium", {});
  assert.equal(over.ok, false);
  assert.equal(over.sent, false);
  assert.match(over.reason, /remaining run budget/);
  const under = P.startEffort(capped, "low", {});
  assert.equal(under.ok, true);
  assert.equal(under.sent, false);

  table.profile.tokensPerStep = {
    low: tokenRow(100000000),
    medium: tokenRow(100000000),
    high: tokenRow(100000000),
    max: tokenRow(100000000),
  };
  const heavy = P.plan(text, {
    prices: table,
    settings: { paidCallUsd: 0.02, runUsd: 5, maxLevelBudgetUsd: 30, spentUsd: 1, effortMode: "auto" },
  });
  function stop(requests, runRemaining, paid) {
    return Math.min(runRemaining, paid * requests);
  }
  assert.equal(heavy.budget.remaining.runUsd, 4);
  assert.equal(heavy.budget.remaining.maxLevelBudgetUsd, 29);
  assert.equal(heavy.efforts.low.requests, 1);
  assert.equal(heavy.efforts.low.predictedUsd.max, 1000);
  assert.equal(heavy.efforts.low.costUsd.max, stop(1, 4, 0.02));
  assert.equal(heavy.efforts.low.capped, true);
  assert.equal(heavy.efforts.max.costUsd.max, Math.min(4, 0.02 * heavy.efforts.max.requests, 29));
  assert.ok(heavy.efforts.max.costUsd.max <= 4);
  assert.ok(heavy.efforts.max.predictedUsd.max > heavy.efforts.max.costUsd.max);
  const raw = P.plan(text, { prices: table });
  assert.equal(raw.efforts.max.capped, false);
  assert.equal(raw.efforts.max.stopUsd, null);
  assert.equal(raw.efforts.max.predictedUsd.max, raw.efforts.max.requests * 1000);
});

test("auto never prompts, and manual high or max asks only when confirmation is on", () => {
  const mem = memory();
  const plan = P.plan("Write a javascript function that checks the plan schema", { storage: mem, recordedAt: null });
  assert.equal(plan.settings.effortMode, "auto");
  assert.equal(plan.settings.confirm, false);
  assert.equal(plan.effortChoice.level, "high");
  assert.equal(plan.effortChoice.prompted, false);
  assert.equal(plan.effortChoice.logged, true);
  assert.equal(plan.efforts.high.needsConfirm, false);
  assert.equal(plan.efforts.max.needsConfirm, false);
  const started = P.startEffort(plan, "high", { confirmed: false });
  assert.equal(started.ok, true);
  assert.equal(started.sent, false);
  assert.equal(started.started, false);
  assert.match(started.reason, /No prompt is sent/);
  assert.equal(started.calibration.schema, "netie.planner-cost-calibration/1");
  assert.equal(started.calibration.actual.costUsd, null);
  assert.equal(started.calibration.actual.requests, null);
  assert.equal(started.calibration.actual.tokens, null);
  assert.equal(started.calibration.recordedAt, null);
  const log = P.readLog(mem);
  assert.equal(log.length, 1);
  assert.equal(log[0].schema, "netie.planner-effort-log/1");
  assert.equal(log[0].intent, "build-code");
  assert.equal(log[0].level, "high");
  assert.equal(log[0].costUsd, "unknown");
  assert.equal(log[0].predictedUsd, "unknown");
  assert.equal(log[0].recordedAt, null);

  const ask = P.plan("Write a javascript function that checks the plan schema", {
    settings: { effortMode: "auto", confirm: true },
  });
  assert.equal(ask.efforts.high.needsConfirm, false);
  const autoStart = P.startEffort(ask, "high", { confirmed: false });
  assert.equal(autoStart.ok, true);
  assert.equal(autoStart.sent, false);

  const manual = P.plan("Write a javascript function that checks the plan schema", {
    settings: { effortMode: "high", confirm: true },
  });
  assert.equal(manual.effortChoice.level, "high");
  assert.equal(manual.efforts.high.needsConfirm, true);
  const blocked = P.startEffort(manual, "high", { confirmed: false });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.sent, false);
  assert.match(blocked.reason, /Confirm/);
  const allowed = P.startEffort(manual, "high", { confirmed: true });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.sent, false);
  const quiet = P.plan("Write a javascript function that checks the plan schema", {
    settings: { effortMode: "max", confirm: false },
  });
  assert.equal(P.startEffort(quiet, "max", {}).ok, true);
  assert.equal(P.plan("What is the Constructor FDE runbook?").effortChoice.level, "medium");
  assert.equal(P.plan("Look up the customer row for account_id A-14").effortChoice.level, "medium");
  assert.equal(P.plan("Average order amount by month").effortChoice.level, "medium");
  assert.equal(P.plan("Make an app skin for the warehouse desk").effortChoice.level, "high");
  assert.equal(P.plan("maybe").effortChoice.level, "low");
  assert.equal(P.plan("What is the Constructor FDE runbook?").efforts.medium.wire.client, "cortex");
  assert.equal(P.plan("Make an app skin for the warehouse desk").efforts.high.wire.lane, "outsourced-coding");
});

test("settings persist in the supplied store and an empty cap stays unlimited", () => {
  const mem = memory();
  assert.equal(P.readSettings(mem).effortMode, "auto");
  assert.equal(P.readSettings(mem).confirm, false);
  assert.equal(P.readSettings(mem).paidCallUsd, null);
  const saved = P.writeSettings({
    effortMode: "auto",
    confirm: false,
    paidCallUsd: "",
    runUsd: 4,
    maxLevelBudgetUsd: "",
  }, mem);
  assert.equal(saved.ok, true);
  assert.equal(saved.settings.paidCallUsd, null);
  assert.equal(saved.settings.runUsd, 4);
  assert.equal(saved.settings.maxLevelBudgetUsd, null);
  const again = P.readSettings(mem);
  assert.equal(again.runUsd, 4);
  assert.equal(again.effortMode, "auto");
  assert.equal(again.confirm, false);
  const bad = P.writeSettings({ paidCallUsd: "nope" }, mem);
  assert.equal(bad.ok, false);
  assert.equal(P.readSettings(mem).runUsd, 4);
  assert.equal(P.readSettings(mem).paidCallUsd, null);
  const table = pricedTable();
  table.profile.tokensPerStep = {
    low: tokenRow(1000),
    medium: tokenRow(1000),
    high: tokenRow(1000),
    max: tokenRow(1000),
  };
  const plan = P.plan("Look up the customer row for account_id A-14", { prices: table, storage: mem });
  assert.equal(plan.settings.runUsd, 4);
  assert.equal(plan.settings.paidCallUsd, null);
  assert.equal(plan.efforts.max.paidCallUsd, null);
  assert.equal(plan.efforts.max.stopUsd, 4);
  assert.equal(plan.efforts.max.capped, false);
  assert.equal(plan.efforts.max.costUsd.max, plan.efforts.max.predictedUsd.max);
  assert.equal(plan.effortChoice.level, "medium");
  const unknown = P.plan("Write a javascript function that checks the plan schema", {
    settings: { effortMode: "auto", runUsd: 4 },
  });
  assert.equal(unknown.effortChoice.level, "low");
  assert.match(unknown.effortChoice.reason, /unknown/);
  assert.equal(unknown.effortChoice.predictedUsd, "unknown");
  assert.equal(JSON.stringify(unknown.effortChoice).indexOf("4.00"), -1);
});

test("build intents at high and max use the coding stub lane and do not call it", () => {
  const stub = P.cursorCloudAgentStub();
  const wrapped = stub.send;
  let sends = 0;
  stub.send = function () {
    sends += 1;
    return wrapped.apply(this, arguments);
  };
  const diff = execSync("git diff --name-only origin/landing-9-first-path...HEAD", {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert.ok(diff.length > 0);
  const cases = [
    ["build-code", "Write a javascript function that checks the plan schema"],
    ["build-model", "Retrain the anomaly model on last week's sensors"],
    ["app-prompt", "Make an app skin for the warehouse desk"],
    ["knowledge", "What is the Constructor FDE runbook?"],
    ["database", "Look up the customer row for account_id A-14"],
    ["insight", "Average order amount by month"],
  ];
  cases.forEach((pair) => {
    const plan = P.plan(pair[1], { diffNames: diff });
    assert.equal(plan.intent, pair[0], pair[1]);
    LEVELS.forEach((level) => {
      const wire = plan.efforts[level].wire;
      const build = pair[0] === "build-code" || pair[0] === "build-model" || pair[0] === "app-prompt";
      if (build && (level === "high" || level === "max")) {
        assert.equal(wire.client, "cursor-cloud-agents");
        assert.equal(wire.lane, "outsourced-coding");
        assert.equal(wire.called, false);
        assert.equal(plan.efforts[level].brief.wholeTree, false);
        assert.equal(plan.efforts[level].brief.diffFirst, true);
        assert.equal(plan.efforts[level].brief.targetRepo, "Netie-AI/constructor");
        assert.deepEqual(plan.efforts[level].brief.affectedPaths, diff);
        assert.ok(plan.efforts[level].brief.acceptanceTests.indexOf("npm run test:unit") >= 0);
      } else {
        assert.equal(wire.client, "cortex");
        assert.equal(wire.lane, "governed");
        assert.equal(plan.efforts[level].brief, null);
      }
    });
    P.startEffort(plan, "max", { confirmed: true, cursorStub: stub });
    P.estimate(plan, { estimator: stub });
  });
  assert.equal(sends, 0);
  assert.equal(stub.calls, 0);
  const empty = P.plan("Make an app skin for the warehouse desk", { diffNames: ["", ".", "*", "../secret"] });
  assert.deepEqual(empty.efforts.high.brief.affectedPaths, []);
  assert.match(empty.efforts.high.brief.note, /not ingested/);
});

test("the light LLM estimator is pluggable and not called", () => {
  const light = P.lightLlmEstimator();
  const plan = P.plan("What is the Constructor FDE runbook?");
  const out = P.estimate(plan, { estimator: light });
  assert.equal(out.called, false);
  assert.equal(light.calls, 0);
  assert.equal(out.efforts.low.wire.client, "cortex");
  let customCalls = 0;
  const custom = P.estimate(plan, {
    estimator: {
      id: "custom-test",
      kind: "custom",
      estimate: function () {
        customCalls += 1;
        return { ok: true, called: true };
      },
    },
  });
  assert.equal(customCalls, 1);
  assert.equal(custom.ok, true);
});

test("build-model high is an ML plan with no training run", () => {
  const plan = P.plan("Predict next quarter revenue");
  assert.equal(plan.intent, "build-model");
  assert.match(plan.efforts.high.deliverable, /No training run/);
  assert.match(plan.efforts.max.deliverable, /improve loop/);
  assert.equal(plan.efforts.max.deliverable.indexOf("30"), -1);
  assert.equal(plan.efforts.high.needsConfirm, false);
  assert.equal(plan.efforts.max.runCapUsd, null);
  assert.equal(plan.efforts.low.runCapUsd, null);
  assert.equal(plan.effortChoice.level, "high");
  assert.equal(plan.efforts.high.wire.lane, "outsourced-coding");
  assert.equal(plan.efforts.medium.wire.lane, "governed");
});
