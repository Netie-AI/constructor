const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../core/constructor.js");

function domainArtifact() {
  return {
    artifact_id: "rsf_segment",
    stage: "segment",
    question: "ingest warehouse inventory then foundry app",
    options: ["region", "country"],
    chosen_option: "region",
    route_trace: [
      {
        step: "pick_segment_key",
        considered: ["region", "country"],
        chosen: "region",
        rejected: { country: "not a column of the granted table" },
        note: "grant lists sales_fact only",
      },
    ],
    evidence: ["column=sales_fact.region"],
    status: "CERTIFIED",
    reasons: ["RSF-02 wire"],
  };
}

test("consumeRsf accepts a JSON string", () => {
  const result = Core.consumeRsf(JSON.stringify(Core.sampleCertifiedRsf()), { cortexOrigin: false });
  assert.equal(result.ok, true);
  assert.equal(result.live, false);
});

test("CERTIFIED RSF is accepted into the ghost run path", () => {
  const result = Core.consumeRsf(Core.sampleCertifiedRsf(), { cortexOrigin: false });
  assert.equal(result.ok, true);
  assert.equal(result.accepted, true);
  assert.equal(result.status, "CERTIFIED");
  assert.equal(result.engine, "cortex");
  assert.equal(result.chosen_option, "cortex");
  assert.equal(result.ghost, true);
  assert.equal(result.live, false);
  assert.equal(result.liveEligible, false);
  assert.equal(result.invented_live, false);
  assert.match(result.route, /pick_engine -> cortex/);
  assert.equal(result.graph.ok, true);
  assert.equal(result.graph.nodes.length > 0, true);
  assert.match(result.summary, /Ghost dry-run/);
  assert.equal(/run_dag accepted|live success/i.test(result.summary), false);
});

test("CERTIFIED domain artifact displays chosen option and stays cortex", () => {
  const result = Core.consumeRsf(domainArtifact(), { cortexOrigin: false });
  assert.equal(result.ok, true);
  assert.equal(result.chosen_option, "region");
  assert.equal(result.engine, "cortex");
  assert.match(result.route, /pick_segment_key -> region/);
  assert.equal(result.live, false);
});

test("n8n / langchain / langflow as chosen engine is BAN", () => {
  const options = ["cortex", "myn8n", "n8n", "langchain", "langflow"];
  for (const banned of ["myn8n", "n8n", "langchain", "langflow"]) {
    const result = Core.consumeRsf(Core.sampleCertifiedRsf({ options: options, chosen_option: banned }), {
      cortexOrigin: false,
    });
    assert.equal(result.ok, false, banned);
    assert.equal(result.ban, true, banned);
    assert.equal(result.live, false);
    assert.equal(result.invented_live, false);
    assert.equal(result.engine, "cortex");
    assert.match(result.summary, /BAN/);
  }
});

test("ABSTAIN is not accepted into run and is not live", () => {
  const result = Core.consumeRsf(
    Core.sampleCertifiedRsf({
      status: "ABSTAIN",
      chosen_option: null,
      evidence: [],
      reasons: ["insufficient grant"],
    }),
    { cortexOrigin: true, ghost: false }
  );
  assert.equal(result.ok, false);
  assert.equal(result.accepted, false);
  assert.equal(result.status, "ABSTAIN");
  assert.equal(result.live, false);
  assert.equal(result.liveEligible, false);
});

test("invent-green CERTIFIED without chosen_option is refused", () => {
  const raw = Core.sampleCertifiedRsf();
  raw.chosen_option = null;
  const result = Core.consumeRsf(raw, { cortexOrigin: true, ghost: false });
  assert.equal(result.ok, false);
  assert.equal(result.live, false);
  assert.match(result.summary, /chosen_option/);
});

test("CERTIFIED without evidence is refused", () => {
  const result = Core.consumeRsf(Core.sampleCertifiedRsf({ evidence: [] }), { cortexOrigin: false });
  assert.equal(result.ok, false);
  assert.equal(result.live, false);
  assert.match(result.error || result.summary, /evidence/);
});

test("Hyperlift-absent consume never sets liveEligible", () => {
  const result = Core.consumeRsf(Core.sampleCertifiedRsf(), { cortexOrigin: false, ghost: false });
  assert.equal(result.ok, true);
  assert.equal(result.ghost, true);
  assert.equal(result.live, false);
  assert.equal(result.liveEligible, false);
});

test("cortex origin + ghost off is liveEligible but core still does not invent live", () => {
  const result = Core.consumeRsf(Core.sampleCertifiedRsf(), { cortexOrigin: true, ghost: false });
  assert.equal(result.ok, true);
  assert.equal(result.liveEligible, true);
  assert.equal(result.live, false);
  assert.equal(result.invented_live, false);
  assert.equal(result.engine, "cortex");
});

test("gencfsm_dag chosen option maps to cortex engine, not a third orchestrator", () => {
  const result = Core.consumeRsf(
    Core.sampleCertifiedRsf({
      options: ["cortex", "gencfsm_dag", "myn8n"],
      chosen_option: "gencfsm_dag",
    }),
    { cortexOrigin: false }
  );
  assert.equal(result.ok, true);
  assert.equal(result.chosen_option, "gencfsm_dag");
  assert.equal(result.engine, "cortex");
  assert.equal(result.ban, undefined);
});

test("parseRsfTrace refuses CERTIFIED after a prior ABSTAIN", () => {
  const research = Core.sampleCertifiedRsf({
    artifact_id: "rsf_research",
    stage: "research",
  });
  const segment = Core.sampleCertifiedRsf({
    artifact_id: "rsf_segment",
    stage: "segment",
    status: "ABSTAIN",
    chosen_option: null,
    evidence: [],
  });
  const classify = Core.sampleCertifiedRsf({
    artifact_id: "rsf_classify",
    stage: "classify",
  });
  assert.throws(() => Core.parseRsfTrace([research, segment, classify]), /classify must not be CERTIFIED/);
});

test("compileIR stays cortex and can carry an RSF digest", () => {
  const state = {
    nodes: [
      { id: "a", kind: "ingest", note: "in" },
      { id: "b", kind: "app", note: "out", action_type: "emit" },
    ],
    edges: [{ from: "a", to: "b" }],
  };
  const ir = Core.compileIR(state, { ghost: true, rsf: Core.sampleCertifiedRsf() });
  assert.equal(ir.engine, "cortex");
  assert.equal(ir.rsf.chosen_option, "cortex");
  assert.equal(ir.rsf.engine, "cortex");
});

test("engine.js POSTs rsf on constructor/run and never invents live in consumeRsfChat", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8");
  assert.match(src, /function constructorRunBody/);
  assert.match(src, /body\.rsf = C\.lastRsf\.wire/);
  assert.match(src, /POST \/cortex\/constructor\/run/);
  assert.match(src, /async function consumeRsfChat/);
  assert.equal(/invented_live:\s*true/.test(src), false);
  assert.match(src, /if \(!cortexOrigin\(\)\) return null;/);
});
