const { test } = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../core/constructor.js");

test("v0.1.0 core is Cortex-shaped, not n8n", () => {
  assert.equal(Core.VERSION, "0.1.0");
  assert.equal(Core.ENGINE, "cortex");
  assert.equal(Core.CORTEX_KIND.app, "EMIT");
  assert.equal(Core.CORTEX_KIND.tool_call, "TOOL_CALL");
  assert.equal(Core.CORTEX_KIND.agent, "AGENT_TASK");
});

test("cortexOriginFrom only on real Cortex paths", () => {
  assert.equal(Core.cortexOriginFrom("app.netie.ai", "/cortex"), true);
  assert.equal(Core.cortexOriginFrom("app.netie.ai", "/cortex/constructor/"), true);
  assert.equal(Core.cortexOriginFrom("127.0.0.1", "/cortex"), true);
  assert.equal(Core.cortexOriginFrom("localhost", "/cortex/login"), true);
  assert.equal(Core.cortexOriginFrom("netie-ai.github.io", "/constructor/"), false);
  assert.equal(Core.cortexOriginFrom("app.netie.ai", "/"), false);
  assert.equal(Core.cortexOriginFrom("constructor.netie.ai", "/"), false);
});

test("compileIR maps Constructor kinds onto Cortex IR", () => {
  const state = {
    nodes: [
      { id: "a", kind: "ingest", note: "in", object_type: "inventory", data_point: "sku" },
      { id: "b", kind: "app", note: "out", action_type: "emit" },
      { id: "c", kind: "tool_call", note: "write", action_type: "export_pptx" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };
  const ir = Core.compileIR(state, { ghost: true });
  assert.equal(ir.engine, "cortex");
  assert.equal(ir.ghost, true);
  assert.equal(ir.entry_node_id, "a");
  assert.equal(ir.output_node_id, "b");
  const ingest = ir.nodes.find((n) => n.id === "a");
  const app = ir.nodes.find((n) => n.id === "b");
  const tool = ir.nodes.find((n) => n.id === "c");
  assert.equal(ingest.kind, "DOCUMENT_REF");
  assert.equal(app.kind, "EMIT");
  assert.equal(tool.kind, "TOOL_CALL");
  assert.equal(tool.requires_confirm, true);
});

test("app IR is EMIT skin, ingest keeps the warehouse place", () => {
  const ir = Core.compileIR(
    {
      nodes: [
        { id: "a", kind: "ingest", fetch_from: "warehouse.inventory", object_type: "inventory" },
        { id: "b", kind: "app", action_type: "emit", skin: "warehouse" },
      ],
      edges: [{ from: "a", to: "b" }],
    },
    { ghost: true }
  );
  const ingest = ir.nodes.find((n) => n.id === "a");
  const app = ir.nodes.find((n) => n.id === "b");
  assert.equal(ingest.data_in, "warehouse.inventory");
  assert.equal(ingest.data_out, "inventory");
  assert.equal(app.kind, "EMIT");
  assert.equal(app.skin, "warehouse");
  assert.equal(app.action_type, "emit");
  assert.equal(app.data_out, "EMIT warehouse");
  assert.equal(app.fetch_from, null);
});

test("trigger compiles as DOCUMENT_REF with webhook fields", () => {
  const ir = Core.compileIR(
    {
      nodes: [
        { id: "tr", kind: "trigger", trigger_kind: "webhook", stream: true, source_kind: "stream", region: null },
        { id: "a", kind: "app", action_type: "emit" },
      ],
      edges: [{ from: "tr", to: "a" }],
    },
    { ghost: true }
  );
  const tr = ir.nodes.find((n) => n.id === "tr");
  assert.equal(Core.CORTEX_KIND.trigger, "DOCUMENT_REF");
  assert.equal(tr.kind, "DOCUMENT_REF");
  assert.equal(tr.constructor_kind, "trigger");
  assert.equal(tr.trigger_kind, "webhook");
  assert.equal(tr.stream, true);
  assert.equal(tr.source_kind, "stream");
});

test("infer-style trigger+audit ranks generator-verifier first", () => {
  const ranked = Core.rankApproachesForGraph({
    nodes: [{ kind: "trigger" }, { kind: "ontology" }, { kind: "insight" }, { kind: "foundry" }, { kind: "app" }, { kind: "audit" }],
  });
  assert.equal(ranked[0].id, "generator_verifier");
});

test("topo walks a linear DAG then leftover nodes", () => {
  const state = {
    nodes: [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
    ],
  };
  assert.deepEqual(Core.topo(state), ["n1", "n2", "n3"]);
});

test("ghostWalk never writes when ghost is on", () => {
  const state = {
    nodes: [
      { id: "n1", kind: "ingest", note: "load" },
      { id: "n2", kind: "app", note: "emit", action_type: "emit" },
    ],
    edges: [{ from: "n1", to: "n2" }],
  };
  const ghost = Core.ghostWalk(state, true);
  assert.equal(ghost.steps.every((s) => s.write === false), true);
  const live = Core.ghostWalk(state, false);
  const appStep = live.steps.find((s) => s.kind === "app");
  assert.equal(appStep.write, true);
});

test("foundry path ranks orchestrator-subagent first", () => {
  const ranked = Core.rankApproachesForGraph({
    nodes: [{ kind: "ontology" }, { kind: "insight" }, { kind: "foundry" }, { kind: "app" }],
  });
  assert.equal(ranked[0].id, "orchestrator_subagent");
});

test("warehouse chat compiles ingest -> app Cortex graph", () => {
  const graph = Core.generateGraph("ingest warehouse inventory then foundry app");
  assert.equal(graph.ok, true);
  assert.equal(graph.refused, undefined);
  assert.equal(graph.pattern, "orchestrator_subagent");
  assert.equal(graph.objects.indexOf("inventory") >= 0, true);
  const kinds = graph.nodes.map((n) => n.kind);
  assert.equal(kinds[0], "ingest");
  assert.equal(kinds.indexOf("app") >= 0, true);
  assert.equal(graph.edges.length, graph.nodes.length - 1);
  const app = graph.nodes.find((n) => n.kind === "app");
  assert.equal(app.action_type, "emit");
  assert.equal(app.skin, "warehouse");
});

test("refusePrompt blocks stalk / sex-work / public scrape", () => {
  assert.equal(Core.refusePrompt("stalk this person via CCTV"), true);
  assert.equal(Core.refusePrompt("scrape camera on the street"), true);
  assert.equal(Core.refusePrompt("sex work targeting leads"), true);
  assert.equal(Core.refusePrompt("ingest warehouse inventory"), false);
});

test("police suspect desk compiles owned enhance path", () => {
  const graph = Core.generateGraph("police suspect desk: owned images, local model enhance, match watchlist");
  assert.equal(graph.ok, true);
  assert.equal(graph.refused, undefined);
  const kinds = graph.nodes.map((n) => n.kind);
  assert.equal(kinds.indexOf("enhance") >= 0, true);
  assert.equal(graph.action, "suspect.match");
  assert.deepEqual(graph.objects, ["images", "suspects", "matches"]);
});

test("refused generateGraph does not emit nodes", () => {
  const graph = Core.generateGraph("doxx and scrape the internet");
  assert.equal(graph.ok, false);
  assert.equal(graph.refused, true);
  assert.equal(graph.nodes, undefined);
});
