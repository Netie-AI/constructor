const STORAGE_KEY = "netie.constructor.v0";
const KINDS = {
  ingest: { label: "Ingest", note: "Read operations into the graph." },
  connector: { label: "Connector", note: "Stub until the app ontology exists." },
  ontology: { label: "Ontology", note: "Object/link/action types. Pack comes later." },
  insight: { label: "Insight", note: "Cite ontology + ledger. RAG_ANSWER on Cortex." },
  foundry: { label: "Foundry", note: "Compile a governed app from insights." },
  app: { label: "App", note: "Emit the app/workflow a stranger can run." },
  agent: { label: "Agent", note: "AGENT_TASK loop. One bounded worker." },
  hypothesize: { label: "Hypothesize", note: "Surface a testable claim." },
  improve: { label: "Improve", note: "Change a product from the claim." },
  audit: { label: "Audit", note: "Show why this node exists. DETERMINISTIC_RULE, not a second EMIT." },
  tool_call: { label: "Tool call", note: "Governed write. requires_confirm." },
};

const nodesEl = document.getElementById("nodes");
const wiresEl = document.getElementById("wires");
const inspectJson = document.getElementById("inspect-json");
const inspectEmpty = document.getElementById("inspect-empty");

const state = load() || sample();
let selectedId = state.nodes[0] ? state.nodes[0].id : null;
let armedPort = null;
let drag = null;

function sample() {
  return {
    nodes: [
      { id: "n1", kind: "ingest", x: 48, y: 72, note: KINDS.ingest.note },
      { id: "n2", kind: "hypothesize", x: 280, y: 72, note: KINDS.hypothesize.note },
      { id: "n3", kind: "improve", x: 512, y: 72, note: KINDS.improve.note },
      { id: "n4", kind: "audit", x: 280, y: 220, note: KINDS.audit.note },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
    ],
  };
}

function foundrySample() {
  return {
    nodes: [
      { id: "c1", kind: "connector", x: 32, y: 48, note: KINDS.connector.note },
      { id: "o1", kind: "ontology", x: 240, y: 48, note: KINDS.ontology.note },
      { id: "i1", kind: "insight", x: 448, y: 48, note: KINDS.insight.note },
      { id: "f1", kind: "foundry", x: 240, y: 200, note: KINDS.foundry.note },
      { id: "a1", kind: "app", x: 448, y: 200, note: KINDS.app.note },
      { id: "g1", kind: "audit", x: 32, y: 200, note: KINDS.audit.note },
    ],
    edges: [
      { from: "c1", to: "o1" },
      { from: "o1", to: "i1" },
      { from: "i1", to: "f1" },
      { from: "f1", to: "a1" },
      { from: "f1", to: "g1" },
    ],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return "n" + Math.random().toString(36).slice(2, 8);
}

function render() {
  nodesEl.innerHTML = "";
  for (const node of state.nodes) {
    const el = document.createElement("article");
    el.className = "node" + (node.id === selectedId ? " selected" : "");
    el.dataset.id = node.id;
    el.style.left = node.x + "px";
    el.style.top = node.y + "px";
    const meta = KINDS[node.kind] || { label: node.kind };
    el.innerHTML =
      '<div class="kind">' +
      node.kind.toUpperCase() +
      "</div><h2>" +
      meta.label +
      '</h2><div class="ports">' +
      '<button type="button" class="port" data-port="out" aria-label="output port"></button>' +
      '<button type="button" class="port" data-port="in" aria-label="input port"></button>' +
      "</div>";
    nodesEl.appendChild(el);
  }
  drawWires();
  showInspect();
}

function nodeCenter(id, port) {
  const el = nodesEl.querySelector('[data-id="' + id + '"]');
  if (!el) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  const stage = document.getElementById("stage").getBoundingClientRect();
  const x = r.left - stage.left + (port === "in" ? r.width - 18 : 18);
  const y = r.top - stage.top + r.height - 18;
  return { x, y };
}

function drawWires() {
  const stage = document.getElementById("stage");
  wiresEl.setAttribute("viewBox", "0 0 " + stage.clientWidth + " " + stage.clientHeight);
  const parts = [];
  for (const edge of state.edges) {
    const a = nodeCenter(edge.from, "out");
    const b = nodeCenter(edge.to, "in");
    const mid = (a.x + b.x) / 2;
    parts.push(
      '<path fill="none" stroke="#e5e5e5" stroke-width="1.25" d="M' +
        a.x +
        " " +
        a.y +
        " C" +
        mid +
        " " +
        a.y +
        " " +
        mid +
        " " +
        b.y +
        " " +
        b.x +
        " " +
        b.y +
        '" />'
    );
  }
  wiresEl.innerHTML = parts.join("");
}

function showInspect() {
  const node = state.nodes.find((n) => n.id === selectedId);
  if (!node) {
    inspectJson.hidden = true;
    inspectEmpty.hidden = false;
    return;
  }
  inspectEmpty.hidden = true;
  inspectJson.hidden = false;
  inspectJson.textContent = JSON.stringify(
    {
      id: node.id,
      kind: node.kind,
      note: node.note,
      inbound: state.edges.filter((e) => e.to === node.id).map((e) => e.from),
      outbound: state.edges.filter((e) => e.from === node.id).map((e) => e.to),
    },
    null,
    2
  );
}

document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.getAttribute("data-add");
    const node = {
      id: uid(),
      kind,
      x: 80 + state.nodes.length * 16,
      y: 80 + state.nodes.length * 16,
      note: KINDS[kind].note,
    };
    state.nodes.push(node);
    selectedId = node.id;
    save();
    render();
  });
});

nodesEl.addEventListener("pointerdown", (event) => {
  const nodeEl = event.target.closest(".node");
  if (!nodeEl) return;
  const port = event.target.closest(".port");
  const id = nodeEl.dataset.id;
  selectedId = id;

  if (port) {
    event.stopPropagation();
    const side = port.getAttribute("data-port");
    if (!armedPort) {
      armedPort = { id, side };
      port.classList.add("armed");
      showInspect();
      return;
    }
    const a = armedPort.side === "out" ? armedPort.id : id;
    const b = armedPort.side === "out" ? id : armedPort.id;
    const valid =
      a !== b &&
      ((armedPort.side === "out" && side === "in") || (armedPort.side === "in" && side === "out"));
    if (valid && !state.edges.some((e) => e.from === a && e.to === b)) {
      state.edges.push({ from: a, to: b });
      save();
    }
    armedPort = null;
    render();
    return;
  }

  drag = {
    id,
    dx: event.clientX - nodeEl.getBoundingClientRect().left,
    dy: event.clientY - nodeEl.getBoundingClientRect().top,
  };
  nodeEl.setPointerCapture(event.pointerId);
  showInspect();
  for (const el of nodesEl.querySelectorAll(".node")) {
    el.classList.toggle("selected", el.dataset.id === selectedId);
  }
});

nodesEl.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const node = state.nodes.find((n) => n.id === drag.id);
  const stage = document.getElementById("stage").getBoundingClientRect();
  node.x = Math.max(8, event.clientX - stage.left - drag.dx);
  node.y = Math.max(8, event.clientY - stage.top - drag.dy);
  const el = nodesEl.querySelector('[data-id="' + drag.id + '"]');
  el.style.left = node.x + "px";
  el.style.top = node.y + "px";
  drawWires();
});

nodesEl.addEventListener("pointerup", () => {
  if (drag) save();
  drag = null;
});

document.getElementById("export-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "constructor-graph.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("reset-graph").addEventListener("click", () => {
  const next = sample();
  state.nodes = next.nodes;
  state.edges = next.edges;
  selectedId = state.nodes[0].id;
  localStorage.removeItem(STORAGE_KEY);
  save();
  render();
});

window.addEventListener("resize", drawWires);

function cortexOrigin() {
  const host = location.hostname;
  const path = location.pathname;
  if (host === "app.netie.ai" && path.indexOf("/cortex") === 0) return true;
  if ((host === "127.0.0.1" || host === "localhost") && location.port === "8010") {
    return path.indexOf("/cortex") === 0;
  }
  return false;
}

function addNode(kind, x, y) {
  const meta = KINDS[kind];
  if (!meta) return null;
  const node = {
    id: uid(),
    kind,
    x: x != null ? x : 80 + state.nodes.length * 16,
    y: y != null ? y : 80 + state.nodes.length * 16,
    note: meta.note,
  };
  state.nodes.push(node);
  selectedId = node.id;
  save();
  render();
  return node;
}

function wire(from, to) {
  if (!state.nodes.some((n) => n.id === from) || !state.nodes.some((n) => n.id === to)) return false;
  if (from === to) return false;
  if (!state.edges.some((e) => e.from === from && e.to === to)) state.edges.push({ from, to });
  save();
  render();
  return true;
}

function setGhost(on) {
  window.Constructor.ghost = !!on;
  document.body.classList.toggle("ghost-mode", window.Constructor.ghost);
  const btn = document.getElementById("ghost-toggle");
  if (btn) btn.textContent = window.Constructor.ghost ? "Ghost on" : "Ghost off";
}

function showAudit(obj) {
  inspectEmpty.hidden = true;
  inspectJson.hidden = false;
  inspectJson.textContent = JSON.stringify(obj, null, 2);
}

function markGhostWalk(ids) {
  for (const el of nodesEl.querySelectorAll(".node")) {
    el.classList.toggle("ghosting", ids.indexOf(el.dataset.id) !== -1);
  }
}

function loadFoundryPath() {
  const next = foundrySample();
  state.nodes = next.nodes;
  state.edges = next.edges;
  selectedId = state.nodes[0].id;
  save();
  render();
}

function ensureKinds(kinds) {
  for (const kind of kinds) {
    if (!state.nodes.some((n) => n.kind === kind)) addNode(kind);
  }
}

window.Constructor = {
  KINDS,
  ghost: true,
  getState: () => state,
  addNode,
  wire,
  setGhost,
  showAudit,
  markGhostWalk,
  loadFoundryPath,
  ensureKinds,
  render,
  save,
};

const power = document.getElementById("power");
if (power) {
  power.textContent = cortexOrigin()
    ? "Powered by Cortex. API key required."
    : "Sketch only. No fetch from github.io. Engine: https://app.netie.ai/cortex (key).";
}
const keyBox = document.getElementById("cortex-key");
if (keyBox && !cortexOrigin()) keyBox.hidden = true;

setGhost(true);
render();
