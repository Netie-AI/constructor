// Planner unit tests. Synthetic requests only. No model call. No Cortex stub call.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const P = require(path.join(root, "planner.js"));

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

const set = readJson("tests/fixtures/planner-intents.synthetic.json");
const table = readJson("tests/fixtures/planner-table.synthetic.json");

test("synthetic intent set has at least 40 labelled examples", () => {
  assert.equal(set.synthetic, true);
  assert.match(set.label, /synthetic/i);
  assert.ok(set.examples.length >= 40);
  set.examples.forEach((row) => {
    assert.equal(row.synthetic, true);
    assert.ok(row.text && row.intent);
    assert.ok(P.INTENTS.indexOf(row.intent) >= 0);
  });
});

test("router accuracy on the synthetic set", () => {
  const misses = [];
  let correct = 0;
  set.examples.forEach((row) => {
    const plan = P.plan(row.text);
    if (plan.intent === row.intent) correct += 1;
    else misses.push(row.id + " expected " + row.intent + " got " + plan.intent + " :: " + row.text);
  });
  const accuracy = correct / set.examples.length;
  console.log("ROUTER_ACCURACY " + correct + "/" + set.examples.length + " = " + accuracy);
  assert.deepEqual(misses, []);
  assert.equal(accuracy, correct / set.examples.length);
  assert.equal(correct, set.examples.length);
});

test("each synthetic plan validates", () => {
  set.examples.forEach((row) => {
    const plan = P.plan(row.text, { synthetic: true });
    const v = P.validatePlan(plan);
    assert.equal(v.ok, true, row.id + " " + JSON.stringify(v.errors));
    assert.equal(plan.label, P.SYNTHETIC_LABEL);
    assert.equal(plan.adapter.called, false);
    assert.ok(plan.signals);
  });
});

test("low confidence asks one clarifying question", () => {
  const plan = P.plan("Do the thing");
  assert.equal(plan.intent, "unclear");
  assert.equal(plan.lowConfidence, true);
  assert.equal((plan.clarify.match(/\?/g) || []).length, 1);
  const mixed = P.plan("What is the average order amount by month");
  assert.equal(mixed.intent, "unclear");
  assert.ok(mixed.confidence < 1);
  assert.ok(mixed.signals.length >= 2);
});

test("database demo spec is chips before any SQL", () => {
  const text = P.demoRequest();
  const plan = P.plan(text);
  assert.equal(plan.intent, "database");
  const spec = plan.answerSpec;
  assert.equal(spec.schema, P.SPEC_SCHEMA);
  assert.deepEqual(spec.columns, ["order_id", "status", "region"]);
  assert.equal(spec.grain, "one row per order");
  assert.deepEqual(spec.filters, ["status is open"]);
  assert.equal(spec.sort, "order_id");
  assert.equal(spec.limit, null);
  const chips = P.specChips(spec);
  assert.ok(chips.some((c) => c.kind === "grain" && c.label === "one row per order"));
  assert.ok(chips.some((c) => c.kind === "column" && c.label === "order_id"));
  assert.ok(chips.some((c) => c.kind === "filter"));
  assert.ok(chips.some((c) => c.kind === "sort"));
  assert.equal(chips.some((c) => c.kind === "limit"), false);
  const exported = P.exportAnswerSpec(spec);
  assert.equal(exported.sql, undefined);
  assert.deepEqual(exported.columns, spec.columns);
});

test("insight spec uses the bucket grain and does not invent a limit", () => {
  const plan = P.plan("Average order amount by month");
  assert.equal(plan.intent, "insight");
  assert.equal(plan.answerSpec.grain, "one row per month");
  assert.equal(plan.answerSpec.limit, null);
  assert.equal(plan.answerSpec.sort, null);
});

test("top N keeps only the limit the request wrote", () => {
  const spec = P.answerSpec("list customer rows where region is north, top 10", "database");
  assert.equal(spec.limit, 10);
  assert.deepEqual(spec.filters, ["region is north"]);
});

test("predict stays refused on a build-model plan", () => {
  const plan = P.plan("Predict next quarter revenue");
  assert.equal(plan.intent, "build-model");
  assert.match(plan.governance.predict, /refused/);
  assert.match(plan.governance.predict, /forecast/);
  assert.equal(plan.answerSpec, null);
  const fit = plan.steps.find((s) => s.lane === "OpenVault FreeRoute model hop");
  assert.ok(fit);
});

test("governance gates name linked, no link, and withheld", () => {
  const plan = P.plan("Look up the customer row for account_id A-14");
  assert.match(plan.governance.linked, /rows, source, and a governed badge/);
  assert.match(plan.governance.noLink, /values empty/);
  assert.match(plan.governance.noLink, /badge off/);
  assert.match(plan.governance.noExecutedQuery, /withheld/);
  assert.equal(plan.budget.requestsPerMinute, 20);
  assert.equal(plan.budget.paidCallUsd, null);
  assert.equal(plan.budget.runUsd, null);
  assert.equal(plan.budget.maxLevelBudgetUsd, null);
  assert.equal(plan.budget.effortMode, "auto");
  assert.equal(plan.budget.confirm, false);
  assert.equal(plan.budget.remaining.runUsd, "unlimited");
});

test("ontology proposals stay proposed until a person accepts one", () => {
  assert.deepEqual(P.sampleSchema(), table);
  const cards = P.proposeOntology(table);
  assert.ok(cards.length >= 5);
  cards.forEach((card) => {
    assert.equal(card.status, "proposed");
    assert.equal(card.certified, false);
  });
  assert.equal(typeof P.certify, "undefined");
  const roles = cards.map((c) => c.role);
  assert.ok(roles.indexOf("object") >= 0);
  assert.ok(roles.indexOf("key") >= 0);
  assert.ok(roles.indexOf("measure") >= 0);
  assert.ok(roles.indexOf("dimension") >= 0);
  assert.ok(roles.indexOf("value-list") >= 0);
  const status = cards.find((c) => c.role === "value-list" && c.name === "status");
  assert.deepEqual(status.values, ["open", "closed", "held"]);
  const accepted = P.acceptProposal(cards, cards[0].id);
  assert.equal(accepted[0].status, "accepted");
  assert.equal(accepted[0].certified, false);
  const all = P.acceptAllProposals(cards);
  all.forEach((card) => {
    assert.equal(card.status, "accepted");
    assert.equal(card.certified, false);
  });
  assert.equal(JSON.stringify(all).indexOf('"certified":true'), -1);
  accepted.slice(1).forEach((card) => assert.equal(card.status, "proposed"));
  const exported = P.exportAccepted(accepted);
  assert.equal(exported.schema, P.ONTOLOGY_SCHEMA);
  assert.equal(exported.for, "cortex");
  assert.equal(exported.certified, false);
  assert.equal(exported.items.length, 1);
  assert.equal(exported.items[0].status, "accepted");
  assert.equal(JSON.stringify(exported).indexOf('"certified":true'), -1);
  const input = JSON.parse(JSON.stringify(table));
  input.columns[1].status = "certified";
  P.proposeOntology(input).forEach((card) => {
    assert.equal(card.status, "proposed");
    assert.equal(card.certified, false);
  });
});

test("prompt registry versions templates and plans log the version", () => {
  const templates = P.listTemplates();
  assert.ok(templates.length >= 5);
  templates.forEach((t) => {
    assert.equal(t.version, "1");
    assert.ok(P.MODES.indexOf(t.mode) >= 0);
    assert.ok(t.prefix.indexOf("template: " + t.id) >= 0);
    assert.ok(t.prefix.indexOf("version: " + t.version) === t.prefix.indexOf("version:"));
    const a = P.renderTemplate(t.id, "alpha request");
    const b = P.renderTemplate(t.id, "beta request");
    assert.ok(a.startsWith(t.prefix));
    assert.ok(b.startsWith(t.prefix));
    assert.equal(a.slice(0, t.prefix.length), b.slice(0, t.prefix.length));
    assert.ok(a.indexOf("alpha request") > t.prefix.length);
    assert.equal(t.prefix.indexOf("alpha request"), -1);
  });
  const plan = P.plan("Average order amount by month");
  assert.ok(plan.promptLog.some((row) => row.id === "planner.intent" && row.version === "1"));
  assert.ok(plan.promptLog.some((row) => row.id === "planner.answer-spec" && row.version === "1"));
  plan.steps.forEach((s) => {
    assert.equal(s.templateVersion, "1");
    assert.ok(P.getTemplate(s.templateId));
  });
  assert.throws(() => P.reviseTemplate("planner.intent", { prefix: "changed" }), /not self-modifying/);
  assert.equal(P.getTemplate("planner.intent").version, "1");
});

test("cortex planner stub is not called", () => {
  let sends = 0;
  const stub = P.cortexPlannerStub();
  const orig = stub.send;
  stub.send = function () {
    sends += 1;
    return orig.apply(this, arguments);
  };
  const planner = P.createPlanner(stub);
  set.examples.forEach((row) => {
    const plan = planner.plan(row.text);
    assert.equal(plan.adapter.called, false);
    assert.equal(plan.adapter.id, "cortex-constructor-plan");
  });
  assert.equal(sends, 0);
  assert.equal(stub.calls, 0);
  const offline = P.createPlanner(P.offlineAdapter());
  const local = offline.plan("What is the Constructor FDE runbook?");
  assert.equal(local.intent, "knowledge");
  assert.equal(local.adapter.called, false);
  assert.equal(local.adapter.id, "offline-deterministic");
});

test("planner source does not fetch or name a banned engine", () => {
  for (const rel of ["planner.js", "planner-ui.js"]) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.equal(/\bfetch\s*\(/.test(src), false, rel);
    assert.equal(/constructor\.netie\.ai/.test(src), false, rel);
    assert.equal(/\brequire\s*\(\s*["']langchain|langflow|activepieces|n8n|crewai/i.test(src), false, rel);
  }
});

test("existing chat prompts that compile a graph are not unclear", () => {
  [
    "8 pressure sensors from factory c ingest last week's anomaly model then retrain",
    "create a full flow for cctv human detection",
    "generate email connector with grant access send to my email",
  ].forEach((text) => {
    assert.notEqual(P.plan(text).intent, "unclear", text);
  });
});

test("validatePlan rejects a plan that skips the budget", () => {
  const plan = P.plan("What is the runbook?");
  assert.equal(plan.budget.paidCallUsd, null);
  plan.budget.requestsPerMinute = 1;
  const v = P.validatePlan(plan);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.code === "PLAN_BUDGET_RATE"));
  plan.budget.requestsPerMinute = 20;
  plan.budget.paidCallUsd = -1;
  const v2 = P.validatePlan(plan);
  assert.equal(v2.ok, false);
  assert.ok(v2.errors.some((e) => e.code === "PLAN_BUDGET_CALL"));
});
