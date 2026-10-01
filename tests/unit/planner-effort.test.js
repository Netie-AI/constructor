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
  assert.equal(pricesJson.caps.paidCallUsd, 0.02);
  assert.equal(pricesJson.caps.runUsd.max, 30);
  assert.equal(pricesJson.caps.runUsd.high, 5);
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

test("a sourced fixture price is monotonic and the caps stop the run", () => {
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
  const plan = P.plan("Look up the customer row for account_id A-14", { prices: table });
  const steps = plan.steps.length;
  const perRequest = (1000 / 1000000) * 2 + (1000 / 1000000) * 8;
  const requests = [1, steps, steps * 2, steps * 3];
  const costs = LEVELS.map((level) => plan.efforts[level].costUsd.max);
  assert.deepEqual(costs, requests.map((n) => n * perRequest));
  for (let i = 1; i < costs.length; i++) assert.ok(costs[i] >= costs[i - 1]);
  LEVELS.forEach((level) => assert.equal(plan.efforts[level].capped, false));

  table.profile.tokensPerStep = {
    low: tokenRow(100000000),
    medium: tokenRow(100000000),
    high: tokenRow(100000000),
    max: tokenRow(100000000),
  };
  const heavy = P.plan("Look up the customer row for account_id A-14", { prices: table });
  function stop(requests, runCap) {
    return Math.min(runCap, 0.02 * requests);
  }
  assert.equal(heavy.efforts.low.requests, 1);
  assert.equal(heavy.efforts.low.costUsd.max, stop(1, 5));
  assert.equal(heavy.efforts.low.capped, true);
  assert.equal(heavy.efforts.medium.costUsd.max, stop(heavy.efforts.medium.requests, 5));
  assert.equal(heavy.efforts.high.costUsd.max, stop(heavy.efforts.high.requests, 5));
  assert.equal(heavy.efforts.max.runCapUsd, 30);
  assert.equal(heavy.efforts.max.costUsd.max, stop(heavy.efforts.max.requests, 30));
  assert.ok(heavy.efforts.max.costUsd.max <= 30);
  assert.ok(heavy.efforts.high.costUsd.max <= 5);
  assert.ok(heavy.efforts.max.costUsd.max >= heavy.efforts.high.costUsd.max);
  LEVELS.forEach((level) => assert.equal(heavy.efforts[level].paidCallUsd, 0.02));
});

test("high and max stay blocked until the user confirms", () => {
  const plan = P.plan("Write a javascript function that checks the plan schema");
  const blocked = P.startEffort(plan, "high", { confirmed: false });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.sent, false);
  assert.match(blocked.reason, /Confirm/);
  const maxBlocked = P.startEffort(plan, "max", {});
  assert.equal(maxBlocked.ok, false);
  assert.equal(maxBlocked.sent, false);
  const allowed = P.startEffort(plan, "high", { confirmed: true });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.sent, false);
  assert.equal(allowed.started, false);
  assert.equal(allowed.calibration.schema, "netie.planner-cost-calibration/1");
  assert.equal(allowed.calibration.actual.costUsd, null);
  assert.equal(allowed.calibration.actual.requests, null);
  assert.equal(allowed.calibration.actual.tokens, null);
  assert.equal(allowed.calibration.recordedAt, null);
  const low = P.startEffort(plan, "low", {});
  assert.equal(low.ok, true);
  assert.equal(low.sent, false);
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
  assert.match(plan.efforts.max.deliverable, /USD 30/);
  assert.equal(plan.efforts.high.needsConfirm, true);
  assert.equal(plan.efforts.max.runCapUsd, 30);
  assert.equal(plan.efforts.low.runCapUsd, 5);
});
