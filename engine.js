/* Cortex-shaped compiler for the Constructor skin.
   Pages: no fetch. localhost:8010: optional same-origin Cortex calls.
   Execution truth stays on Cortex dag_runner. This file only compiles, ghosts, and ranks. */

const CORTEX_KIND = {
  ingest: "DOCUMENT_REF",
  connector: "DOCUMENT_REF",
  ontology: "DOCUMENT_REF",
  insight: "DOCUMENT_REF",
  foundry: "DOCUMENT_REF",
  app: "EMIT",
  agent: "AGENT_TASK",
  hypothesize: "DOCUMENT_REF",
  enhance: "DOCUMENT_REF",
  improve: "DOCUMENT_REF",
  audit: "DOCUMENT_REF",
  tool_call: "TOOL_CALL",
};

const APPROACHES = [
  {
    id: "single_agent",
    name: "Single agent",
    cortex_status: "strong",
    cortex_path: "AGENT_TASK max_steps loop",
    cost: 1,
    audit: 3,
    blast: 1,
    parked: false,
    blurb: "One context, one tool loop. Default unless the graph has independent facets.",
  },
  {
    id: "generator_verifier",
    name: "Generator-verifier",
    cortex_status: "partial",
    cortex_path: "LLM_JUDGED then EMIT audit",
    cost: 2,
    audit: 5,
    blast: 1,
    parked: false,
    blurb: "Generate, then verify against explicit audit criteria. Best when wrong output is expensive.",
  },
  {
    id: "orchestrator_subagent",
    name: "Orchestrator-subagent",
    cortex_status: "strong",
    cortex_path: "compile_template -> dag_runner + AGENT_TASK",
    cost: 4,
    audit: 4,
    blast: 2,
    parked: false,
    blurb: "Lead plans, bounded subagents return distilled results. Use for ontology -> insights -> foundry -> app.",
  },
];

function cortexOrigin() {
  const host = location.hostname;
  const path = location.pathname;
  if (host === "app.netie.ai" && path.indexOf("/cortex") === 0) return true;
  if ((host === "127.0.0.1" || host === "localhost") && path.indexOf("/cortex") === 0) {
    return true;
  }
  return false;
}

function statusWeight(status) {
  if (status === "strong") return 4;
  if (status === "partial") return 2;
  return 0;
}

function scoreApproach(row) {
  return row.audit * 2 + statusWeight(row.cortex_status) - row.cost - row.blast;
}

function compileIR(state) {
  const output =
    [...state.nodes].reverse().find((n) => n.kind === "app") ||
    [...state.nodes].reverse().find((n) => n.kind === "audit") ||
    state.nodes[state.nodes.length - 1];
  return {
    version: "1.0",
    engine: "cortex",
    ghost: !!window.Constructor.ghost,
    entry_node_id: state.nodes[0].id,
    output_node_id: output.id,
    nodes: state.nodes.map((n) => {
      let kind = CORTEX_KIND[n.kind] || "DOCUMENT_REF";
      if (n.id === output.id) kind = "EMIT";
      else if (kind === "EMIT") kind = "DETERMINISTIC_RULE";
      return {
        id: n.id,
        kind: kind,
        constructor_kind: n.kind,
        object_type: n.object_type || null,
        data_point: n.data_point || null,
        data_type: n.data_type || null,
        action_type: n.action_type || null,
        fetch_from: n.fetch_from || null,
        tier: n.tier || "T0",
        stream: !!n.stream,
        note: n.note,
        requires_confirm: n.kind === "tool_call",
      };
    }),
    edges: state.edges.slice(),
    ontology: ontologyDigest(),
  };
}

function ontologyDigest() {
  const O = window.Ontology;
  if (!O || typeof O.get !== "function") return null;
  const o = O.get() || {};
  return {
    name: o.name || null,
    revision: o.revision || 0,
    objects: Object.keys(o.objectTypes || {}).length,
    links: Object.keys(o.linkTypes || {}).length,
    actions: Object.keys(o.actionTypes || {}).length,
    interfaces: Object.keys(o.interfaces || {}).length,
  };
}

function downloadText(name, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 0);
}

function issueLine(v) {
  const errs = (v && v.errors) || [];
  const warns = (v && v.warnings) || [];
  if (!errs.length && !warns.length) return "Ontology valid. 0 errors, 0 warnings.";
  const top = errs.concat(warns).slice(0, 3).map(function (i) {
    return i.code + " " + (i.path || "") + (i.message ? ": " + i.message : "");
  });
  return errs.length + " errors, " + warns.length + " warnings. " + top.join(" | ");
}

/* Chat verbs that edit the ontology through window.Ontology. Returns null when the
   text is not an ontology verb so handleChat keeps going. */
async function ontologyChat(t) {
  const C = window.Constructor;
  const O = window.Ontology;
  if (/^(open |edit |show )?ontology( studio)?$/.test(t) || /^studio$/.test(t)) {
    if (C.openOntologyStudio && C.openOntologyStudio()) {
      return "Ontology Studio open. Objects, links, actions, interfaces, places. Direct edits save. Esc closes.";
    }
    return "Ontology Studio is not loaded. Refresh the page.";
  }
  if (!O) return null;
  let m = t.match(/^add object ([a-z][a-z0-9_.]*)$/);
  if (m) {
    const r = O.addObjectType(m[1], { label: m[1] });
    return r.ok
      ? "Object type " + m[1] + " added (rev " + O.get().revision + "). Next: add property " + m[1] + ".<prop> <type>."
      : "Refused: " + (r.errors || []).join("; ");
  }
  m = t.match(/^add property ([a-z][a-z0-9_.]*)\.([a-z][a-z0-9_]*)(?: ([a-z]+))?$/);
  if (m) {
    const r = O.addProperty(m[1], m[2], { type: m[3] || "string" });
    return r.ok
      ? "Property " + m[1] + "." + m[2] + " (" + (m[3] || "string") + ") added. Data point select has it."
      : "Refused: " + (r.errors || []).join("; ");
  }
  m = t.match(/^add link ([a-z][a-z0-9_.]*) to ([a-z][a-z0-9_.]*)(?: via ([a-z][a-z0-9_]*))?$/);
  if (m) {
    const id = m[1] + "_" + m[2];
    const via = m[3] || m[2].replace(/s$/, "") + "_id";
    const r = O.addLinkType(id, { from: m[1], to: m[2], via: via, cardinality: "many_to_one" });
    return r.ok
      ? "Link " + id + " (" + m[1] + " -> " + m[2] + " via " + via + ") added."
      : "Refused: " + (r.errors || []).join("; ");
  }
  m = t.match(/^add action ([a-z][a-z0-9_.]*) on ([a-z*][a-z0-9_.]*)$/);
  if (m) {
    const r = O.addActionType(m[1], { objects: [m[2]], requiresConfirm: true, cortexTool: null });
    return r.ok ? "Action " + m[1] + " on " + m[2] + " added. requires_confirm on." : "Refused: " + (r.errors || []).join("; ");
  }
  m = t.match(/^(?:remove|delete) object ([a-z][a-z0-9_.]*)$/);
  if (m) {
    const r = O.removeObjectType(m[1]);
    return r.ok ? "Object type " + m[1] + " removed. undo ontology brings it back." : "Refused: " + (r.errors || []).join("; ");
  }
  m = t.match(/^(?:remove|delete) property ([a-z][a-z0-9_.]*)\.([a-z][a-z0-9_]*)$/);
  if (m) {
    const r = O.removeProperty(m[1], m[2]);
    return r.ok ? "Property " + m[1] + "." + m[2] + " removed. " + issueLine(O.validate()) : "Refused: " + (r.errors || []).join("; ");
  }
  m = t.match(/^(?:remove|delete) link ([a-z][a-z0-9_.]*)$/);
  if (m) {
    const r = O.removeLinkType(m[1]);
    return r.ok ? "Link " + m[1] + " removed." : "Refused: " + (r.errors || []).join("; ");
  }
  if (/^undo ontology$/.test(t)) {
    return O.undo() ? "Ontology undo. rev " + O.get().revision + "." : "Nothing to undo.";
  }
  if (/^redo ontology$/.test(t)) {
    return O.redo() ? "Ontology redo. rev " + O.get().revision + "." : "Nothing to redo.";
  }
  if (/^validate( ontology)?$/.test(t)) {
    return issueLine(O.validate());
  }
  if (/^reset ontology$/.test(t)) {
    O.reset();
    return "Ontology reset to the DMS seed. rev " + O.get().revision + ".";
  }
  m = t.match(/^export ontology(?: (json|native|cortex|jsonld|json-ld|turtle|ttl|owl))?$/);
  if (m) {
    const fmt = m[1] || "json";
    if (fmt === "cortex") downloadText("ontology.cortex.json", O.exportCortex(), "application/json");
    else if (fmt === "jsonld" || fmt === "json-ld") downloadText("ontology.jsonld", O.exportJSONLD(), "application/ld+json");
    else if (fmt === "turtle" || fmt === "ttl" || fmt === "owl") downloadText("ontology.ttl", O.exportTurtle(), "text/turtle");
    else downloadText("ontology.json", O.exportJSON(), "application/json");
    return "Downloaded ontology as " + fmt + ". Zero fetch.";
  }
  if (/^pull ontology$/.test(t)) {
    if (!cortexOrigin()) return "Pull is Cortex only (GET /cortex/constructor/ontology). Pages never fetch.";
    const remote = await cortexGet("/cortex/constructor/ontology");
    if (!remote || !remote.ok || !remote.objects) {
      return "Pull failed (" + ((remote && (remote.status || remote.error)) || "offline") + ").";
    }
    const r = O.importJSON(JSON.stringify(remote));
    return r.ok ? "Pulled Cortex catalog into the ontology. rev " + O.get().revision + "." : "Import refused: " + (r.errors || []).join("; ");
  }
  if (/^push ontology$/.test(t)) {
    if (!cortexOrigin()) return "Push is Cortex only (POST /cortex/constructor/ontology). Pages never fetch.";
    const v = O.validate();
    if (v.errors && v.errors.length) return "Push blocked. " + issueLine(v);
    const remote = await cortexPost("/cortex/constructor/ontology", O.toCatalog());
    C.showAudit({ mode: "cortex-ontology-push", remote: remote, digest: ontologyDigest() });
    if (!remote || remote.ok === false) {
      return "Cortex refused the ontology push (" + ((remote && (remote.status || remote.detail || remote.error)) || "offline") + "). No silent fallback.";
    }
    return "Ontology rev " + O.get().revision + " pushed to Cortex.";
  }
  return null;
}

function topo(state) {
  const incoming = {};
  for (const n of state.nodes) incoming[n.id] = 0;
  for (const e of state.edges) {
    if (incoming[e.to] === undefined) incoming[e.to] = 0;
    incoming[e.to] += 1;
  }
  const q = state.nodes.filter((n) => incoming[n.id] === 0).map((n) => n.id);
  const out = [];
  while (q.length) {
    const id = q.shift();
    out.push(id);
    for (const e of state.edges.filter((edge) => edge.from === id)) {
      incoming[e.to] -= 1;
      if (incoming[e.to] === 0) q.push(e.to);
    }
  }
  for (const n of state.nodes) {
    if (!out.includes(n.id)) out.push(n.id);
  }
  return out;
}

async function ghostRun() {
  const C = window.Constructor;
  const state = C.getState();
  if (cortexOrigin()) {
    const remote = await cortexPost("/cortex/constructor/ghost", {
      nodes: state.nodes,
      edges: state.edges,
    });
    C.showAudit({ mode: "cortex-ghost", remote: remote });
    if (remote && remote.ok) {
      C.markGhostWalk((remote.nodes || []).map((n) => n.id));
      return "Cortex ghost compile ok. EMIT=" + remote.output_node_id + ". No writes.";
    }
    return "Cortex ghost blocked (" + (remote && (remote.status || remote.error) || "offline") + "). Local walk instead. " + localGhostWalk();
  }
  return localGhostWalk();
}

let automateTimer = null;
let automateTicks = 0;
let automateBusy = false;

async function automateTick() {
  const C = window.Constructor;
  if (!C || !C.automate || automateBusy) return;
  automateBusy = true;
  const live = cortexOrigin();
  if (!live) C.setGhost(true);
  automateTicks += 1;
  let msg = "";
  try {
    msg = live ? await liveOrGhost(true) : await ghostRun();
  } catch (err) {
    msg = String((err && err.message) || err);
  }
  const power = document.getElementById("power");
  if (power) {
    power.textContent =
      "Automate #" +
      automateTicks +
      (live ? " (live run_dag). " : " (15s ghost). ") +
      String(msg).slice(0, 140);
  }
  automateBusy = false;
  if (C.automate) automateTimer = setTimeout(automateTick, 15000);
}

function setAutomate(on) {
  const C = window.Constructor;
  const btn = document.getElementById("automate");
  if (automateTimer) {
    clearTimeout(automateTimer);
    automateTimer = null;
  }
  C.automate = !!on;
  if (btn) {
    btn.textContent = on ? "Automate on" : "Automate off";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (!on) return;
  if (!cortexOrigin()) C.setGhost(true);
  automateTick();
}

function localGhostWalk() {
  const C = window.Constructor;
  const state = C.getState();
  const order = topo(state);
  const log = [];
  for (const id of order) {
    const node = state.nodes.find((n) => n.id === id);
    const write = !C.ghost && (node.kind === "tool_call" || node.kind === "app");
    log.push({
      id: node.id,
      kind: node.kind,
      cortex: CORTEX_KIND[node.kind],
      ghost: C.ghost || !write,
      write: !!write,
      would: node.note,
      action_type: node.action_type || (node.kind === "tool_call" ? "export_pptx" : "agent.checked"),
      object_type: node.object_type || null,
      data_point: node.data_point || null,
      fetch_from: node.fetch_from || null,
    });
  }
  C.markGhostWalk(order);
  C.showAudit({
    mode: C.ghost ? "ghost" : "live-local",
    engine: cortexOrigin() ? "cortex-origin" : "pages-sketch",
    steps: log,
  });
  return (
    (C.ghost ? "Ghost run (no writes). " : "Local walk. Tool/app nodes would write. ") +
    log.length +
    " steps. Audit panel has the ledger."
  );
}

async function rankApproaches() {
  if (cortexOrigin()) {
    const remote = await cortexPost("/cortex/constructor/recommend", {
      nodes: window.Constructor.getState().nodes,
      edges: window.Constructor.getState().edges,
    });
    if (remote && remote.ok && Array.isArray(remote.approaches)) {
      const recId = remote.recommendation && remote.recommendation.pattern;
      const box = document.getElementById("approaches");
      box.innerHTML = remote.approaches
        .map((row) => {
          const win = row.id === recId;
          return (
            '<article class="approach' +
            (win ? " winner" : "") +
            '"><div class="eyebrow">' +
            (win ? "WINNER" : "ALT") +
            " / " +
            String(row.cortex_status || "").toUpperCase() +
            "</div><h3>" +
            row.name +
            "</h3><p>" +
            row.blurb +
            '</p><p class="hint">' +
            row.cortex_path +
            "</p></article>"
          );
        })
        .join("");
      const ranked = remote.approaches.map((row) =>
        Object.assign({}, row, { score: row.id === recId ? 99 : 0 })
      );
      ranked.sort((a, b) => b.score - a.score);
      window.Constructor.lastRanking = ranked;
      return ranked;
    }
  }
  const kinds = new Set(window.Constructor.getState().nodes.map((n) => n.kind));
  const foundry = ["ontology", "insight", "foundry", "app"].every((k) => kinds.has(k));
  const verify = kinds.has("hypothesize") && kinds.has("audit") && !foundry;
  const ranked = APPROACHES.map((row) => {
    let score = scoreApproach(row);
    if (foundry && row.id === "orchestrator_subagent") score += 20;
    if (verify && row.id === "generator_verifier") score += 20;
    return Object.assign({}, row, { score: score });
  }).sort((a, b) => b.score - a.score);
  const box = document.getElementById("approaches");
  box.innerHTML = ranked
    .map((row, i) => {
      return (
        '<article class="approach' +
        (i === 0 ? " winner" : "") +
        '"><div class="eyebrow">' +
        (i === 0 ? "WINNER" : "ALT") +
        " / " +
        row.cortex_status.toUpperCase() +
        '</div><h3>' +
        row.name +
        "</h3><p>" +
        row.blurb +
        '</p><p class="hint">score ' +
        row.score +
        " · " +
        row.cortex_path +
        "</p></article>"
      );
    })
    .join("");
  window.Constructor.lastRanking = ranked;
  return ranked;
}

function applyWinner(id) {
  const C = window.Constructor;
  const state = C.getState();
  if (id === "generator_verifier") {
    C.ensureKinds(["hypothesize", "audit"]);
  } else if (id === "orchestrator_subagent") {
    C.loadFoundryPath();
  } else {
    C.ensureKinds(["agent", "audit"]);
  }
  state.approach = id;
  C.save();
  C.render();
}

async function cortexPost(path, body) {
  if (!cortexOrigin()) return null;
  const keyEl = document.getElementById("cortex-key");
  const key = keyEl && keyEl.value ? keyEl.value.trim() : "";
  const headers = { "Content-Type": "application/json" };
  if (key) headers["X-API-Key"] = key;
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: headers,
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        detail: (parsed && (parsed.detail || parsed.error)) || text.slice(0, 240),
      };
    }
    return parsed;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function cortexGet(path) {
  if (!cortexOrigin()) return null;
  const keyEl = document.getElementById("cortex-key");
  const key = keyEl && keyEl.value ? keyEl.value.trim() : "";
  const headers = {};
  if (key) headers["X-API-Key"] = key;
  try {
    const res = await fetch(path, { method: "GET", headers: headers, credentials: "same-origin" });
    if (!res.ok) return { ok: false, status: res.status };
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function setOvStatus(text) {
  const el = document.getElementById("ov-status");
  if (el) el.textContent = text;
}

async function bindSession(key) {
  if (!cortexOrigin() || !key) return { ok: false, error: "not cortex origin" };
  const remote = await cortexPost("/cortex/session", { key: key });
  if (remote && remote.ok === false) return remote;
  return { ok: true };
}

async function issueOpenVaultKey() {
  if (!cortexOrigin()) {
    return "Issue key is Cortex loopback only. Open http://127.0.0.1:8010/cortex/login .";
  }
  const remote = await cortexPost("/cortex/constructor/issue-key", {});
  if (!remote || !remote.token) {
    return (
      "OpenVault did not issue a key (" +
      ((remote && (remote.status || remote.detail || remote.error)) || "offline") +
      "). Start OpenVault on http://127.0.0.1:5000 ."
    );
  }
  const keyEl = document.getElementById("cortex-key");
  if (keyEl) keyEl.value = remote.token;
  await bindSession(remote.token);
  const kid = remote.key && (remote.key.key_id || remote.key.id);
  setOvStatus("OpenVault: issued " + (kid || "ov_") + " (shown once). Fetch and run all are live.");
  return "OpenVault key issued once. Token is in the box. Lost keys cannot be recovered.";
}

async function loadOntology() {
  const C = window.Constructor;
  if (!cortexOrigin() || !C.replaceCatalog) return;
  const remote = await cortexGet("/cortex/constructor/ontology");
  if (remote && remote.ok && remote.objects) {
    const O = window.Ontology;
    const localRev = O && O.get ? O.get().revision || 0 : 0;
    const nobj = Object.keys(remote.objects).length;
    const nact = (remote.actions || []).length;
    const nplace = (remote.fetch_places || []).length;
    if (localRev > 0 && O) {
      setOvStatus(
        "Cortex catalog live: " +
          nobj +
          " objects, " +
          nact +
          " actions. Local ontology rev " +
          localRev +
          " kept. Chat: pull ontology to replace, push ontology to send."
      );
      return;
    }
    C.replaceCatalog(remote.objects, remote.actions, remote.fetch_places);
    setOvStatus(
      "Cortex catalog live: " +
        nobj +
        " objects, " +
        nact +
        " actions, " +
        nplace +
        " fetch places. Paste or issue an ov_ key to run."
    );
  } else if (remote && remote.status === 401) {
    setOvStatus("OpenVault: key required. Issue ov_ or paste one, then fetch / run all.");
  }
}

async function liveOrGhost(forceLive) {
  const C = window.Constructor;
  const ir = compileIR(C.getState());
  if (forceLive) {
    if (!cortexOrigin()) {
      return "Live run is Cortex only (POST /cortex/constructor/run). Pages never fetch. Open http://127.0.0.1:8010/cortex .";
    }
    C.setGhost(false);
    const remote = await cortexPost("/cortex/constructor/run", {
      nodes: C.getState().nodes,
      edges: C.getState().edges,
    });
    C.showAudit({ mode: "cortex-run", ir: ir, remote: remote });
    if (!remote || remote.ok === false) {
      return (
        "Cortex run_dag failed (" +
        ((remote && (remote.status || remote.error || remote.detail)) || "offline") +
        "). No internal fallback."
      );
    }
    const nfetch = remote.fetches ? Object.keys(remote.fetches).length : 0;
    return "Cortex run_dag accepted. Actor " + (remote.actor || "?") + ". Fetches " + nfetch + ". Audit has node outputs.";
  }
  if (C.ghost || !cortexOrigin()) {
    return ghostRun();
  }
  return liveOrGhost(true);
}

function chatSay(role, text) {
  const log = document.getElementById("chat-log");
  if (!log) return;
  const el = document.createElement("div");
  el.className = "bubble " + role;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

async function handleChat(raw) {
  const text = raw.trim();
  const t = text.toLowerCase();
  const C = window.Constructor;
  if (!t) return "Say the object, point, action, or run all.";
  if (t === "help") {
    return "Chat a whole desk: warehouse, venue/CRM, case rows, or a police suspect desk (owned images -> enhance local model or online API -> match owned.watchlist -> app). Or: issue key. set object images|suspects|matches|inventory. set action suspect.match|image.enhance|export_pptx. ghost on/off. propose 3. maximize. run all. why. add <kind>. Ontology: ontology (opens the studio), add object <id>, add property <obj>.<prop> <type>, add link <a> to <b> via <prop>, add action <id> on <obj>, validate, undo ontology, export ontology json|cortex|jsonld|turtle, pull/push ontology (Cortex only). Ctrl+/ toggles chat.";
  }
  const onto = await ontologyChat(t);
  if (onto) return onto;
  if (/^issue( key)?$/.test(t) || /generate key|openvault key/.test(t)) {
    return await issueOpenVaultKey();
  }
  const setObj = t.match(/^set object (\S+)$/);
  if (setObj) {
    if (!C.OBJECTS[setObj[1]]) {
      return "Object must be a Cortex ontology table: " + Object.keys(C.OBJECTS).join(", ") + ".";
    }
    return C.patchSelected("object_type", setObj[1])
      ? "Object " + setObj[1] + " on selected node."
      : "Select a node first.";
  }
  const setPoint = t.match(/^set point (\S+)$/);
  if (setPoint) {
    const node = C.selected && C.selected();
    if (!node) return "Select a node first.";
    const obj = node.object_type && C.OBJECTS[node.object_type] ? node.object_type : "inventory";
    if (!C.OBJECTS[obj] || !C.OBJECTS[obj].points[setPoint[1]]) {
      return "Point not on " + obj + ". " + Object.keys((C.OBJECTS[obj] && C.OBJECTS[obj].points) || {}).join(", ");
    }
    return C.patchSelected("data_point", setPoint[1]) ? "Data point " + setPoint[1] + "." : "Select a node first.";
  }
  const setType = t.match(/^set type (\S+)$/);
  if (setType) {
    return C.patchSelected("data_type", setType[1]) ? "Data type " + setType[1] + "." : "Select a node first.";
  }
  const setAct = t.match(/^set action (\S+)$/);
  if (setAct) {
    if (C.ACTIONS.indexOf(setAct[1]) < 0) {
      return "Action must be one of the ontology action types: " + C.ACTIONS.join(", ") + ".";
    }
    return C.patchSelected("action_type", setAct[1]) ? "Action " + setAct[1] + "." : "Select a node first.";
  }
  const setFetch = t.match(/^set fetch (.+)$/);
  if (setFetch) {
    return C.patchSelected("fetch_from", setFetch[1].trim())
      ? "Fetch/place " + setFetch[1].trim() + "."
      : "Select a node first.";
  }
  if (/^set tier (t[01])$/.test(t) === false && t.match(/^set tier /)) {
    return "Tier must be T0 or T1 (ModelRouter). Not a network load balancer.";
  }
  const setTier = t.match(/^set tier (t[01])$/);
  if (setTier) {
    const tier = setTier[1].toUpperCase();
    return C.patchSelected("tier", tier) ? "Router tier " + tier + " (ModelRouter)." : "Select a node first.";
  }
  if (/^set stream on$/.test(t)) {
    return C.patchSelected("stream", true) ? "Stream flag on. Cortex /dms/streams. Pages cannot stream." : "Select a node.";
  }
  if (/^set stream off$/.test(t)) {
    return C.patchSelected("stream", false) ? "Stream flag off." : "Select a node.";
  }
  if (/ghost off/.test(t)) {
    C.setGhost(false);
    return "Ghost off. run all calls Cortex run_dag. Pages still cannot fetch.";
  }
  if (/ghost on|ghost mode/.test(t)) {
    C.setGhost(true);
    return "Ghost on. Dry-run only.";
  }
  if (/^ghost( run)?$/.test(t) || /dry.?run/.test(t)) {
    C.setGhost(true);
    return await ghostRun();
  }
  if (/automate off|stop automate/.test(t)) {
    setAutomate(false);
    return "Automate off.";
  }
  if (/automate on|automate forever|^automate$/.test(t)) {
    setAutomate(true);
    return "Automate on. Ghost-run every 15s. Live run_dag stays the Run button.";
  }
  if (/propose|bakeoff|approach/.test(t) && !/openclaw/.test(t)) {
    const ranked = await rankApproaches();
    return (
      "Ranked 3 Cortex patterns. Winner: " +
      ranked[0].name +
      " (score " +
      ranked[0].score +
      "). Parked patterns (teams/bus) stay out."
    );
  }
  if (/maximi[sz]e|pick winner|best/.test(t)) {
    const ranked = await rankApproaches();
    applyWinner(ranked[0].id);
    return "Applied " + ranked[0].name + ". Graph compiled toward " + ranked[0].cortex_path + ".";
  }
  if (/^foundry( path)?$/.test(t) || /ontology path/.test(t) || /^create app$/.test(t)) {
    C.loadFoundryPath();
    C.setGhost(true);
    const ranked = await rankApproaches();
    return (
      "Loaded connector -> ontology -> insight -> foundry -> app + export_pptx. Ghost on. Winner: " +
      ranked[0].name +
      "."
    );
  }
  const add = t.match(/^add ([a-z_]+)$/);
  if (add) {
    if (!C.KINDS[add[1]]) return "Unknown kind. " + Object.keys(C.KINDS).join(", ");
    C.addNode(add[1]);
    return "Added " + add[1] + " (" + CORTEX_KIND[add[1]] + ").";
  }
  const wire = t.match(/^wire (\S+) to (\S+)$/);
  if (wire) {
    const ok = C.wire(wire[1], wire[2]);
    return ok ? "Wired " + wire[1] + " -> " + wire[2] : "Need two existing node ids.";
  }
  if (/^fetch$/.test(t) || /^fetch now$/.test(t)) {
    if (!cortexOrigin()) {
      return "Fetch is Cortex only (POST /cortex/constructor/fetch). Pages never fetch. Open http://127.0.0.1:8010/cortex .";
    }
    const node = C.selected && C.selected();
    if (!node) return "Select a node first.";
    const remote = await cortexPost("/cortex/constructor/fetch", { nodes: [node], edges: [] });
    C.showAudit({ mode: "cortex-fetch", remote: remote });
    if (!remote || remote.ok === false) {
      return (
        "Fetch failed (" +
        ((remote && (remote.status || remote.detail || remote.error)) || "offline") +
        "). No internal fallback."
      );
    }
    const s = remote.slice || {};
    return (
      "Fetched " +
      (s.table || "none") +
      " " +
      (s.data_point || "") +
      ": " +
      (s.row_count || 0) +
      " rows" +
      (s.error ? " (" + s.error + ")" : "") +
      "."
    );
  }
  if (/^run all$/.test(t) || /run api|execute all|live run/.test(t)) {
    return await liveOrGhost(true);
  }
  if (/^run$/.test(t) || (/execute/.test(t) && !/all/.test(t))) {
    return await liveOrGhost(false);
  }
  if (/^why$/.test(t) || /decision layer|press (it|node)|why this/.test(t)) {
    return await pressNode();
  }
  if (/^bench$/.test(t) || /openclaw|testbench|accuracy/.test(t)) {
    const ranked = await rankApproaches();
    let live = "";
    if (cortexOrigin()) {
      const remote = await cortexPost("/cortex/constructor/fetch", {
        nodes: [
          {
            id: "bench",
            kind: "connector",
            object_type: "inventory",
            data_point: "sku",
            fetch_from: "warehouse.inventory",
          },
        ],
        edges: [],
      });
      if (remote && remote.ok && remote.slice) {
        live = " Live DuckDB inventory rows: " + (remote.slice.row_count || 0) + ".";
      } else {
        live = " Live warehouse fetch failed (no fake score).";
      }
    }
    return (
      "Cortex G1 bakeoff (repo, not a live OpenClaw rerun): static DAG 4.1 vs OpenClaw 1.7. DMS golden 36/36, 0 confident-wrong." +
      live +
      " This graph winner: " +
      ranked[0].name +
      " score " +
      ranked[0].score +
      ". Constructor does not invent an OpenClaw host."
    );
  }
  return await generateFromChat(text);
}

function objectsInPrompt(text) {
  const low = text.toLowerCase();
  const rows = [
    ["places", ["maps", "nearby", "geo", "latitude", "longitude", "place"]],
    ["venues", ["club", "clubs", "venue", "venues", "nightlife", "restaurant"]],
    ["contacts", ["contact", "contacts"]],
    ["leads", ["customer", "customers", "lead", "leads", "prospect"]],
    ["inventory", ["inventory", "sku", "stock", "warehouse"]],
    ["suppliers", ["supplier", "vendor"]],
    ["locations", ["location", "site", "bin"]],
    ["shipments", ["shipment", "consignment", "carrier"]],
    ["transactions", ["transaction", "txn", "movement"]],
    ["alerts", ["alert", "alarm"]],
    ["incidents", ["incident", "case desk", "case file", "ops desk"]],
    ["images", ["image", "images", "footage", "cctv", "camera"]],
    ["suspects", ["suspect", "watchlist", "police"]],
    ["matches", ["match", "face match", "similarity"]],
  ];
  const found = [];
  for (const row of rows) {
    if (row[1].some((w) => low.indexOf(w) >= 0) && found.indexOf(row[0]) < 0) found.push(row[0]);
  }
  if (found.indexOf("venues") >= 0 && found.indexOf("places") < 0) found.unshift("places");
  return found;
}

function refusePrompt(text) {
  const low = (text || "").toLowerCase();
  const hits = [
    "prostitut",
    "escort",
    "brothel",
    "sex work",
    "sexworker",
    "stalk",
    "doxx",
    "scrape the internet",
    "scrape internet",
    "scrap intenr",
    "public webcam",
    "scrape camera",
  ];
  return hits.some(function (h) {
    return low.indexOf(h) >= 0;
  });
}

function isSuspectDesk(low) {
  return /suspect|watchlist|face|cctv|camera|police|comfy|image enhance|enhance image|label face/.test(low || "");
}

function fetchPlaceFor(obj) {
  if (obj === "places") return "maps.places";
  if (obj === "venues") return "maps.venues";
  if (obj === "contacts") return "crm.contacts";
  if (obj === "leads") return "crm.leads";
  if (obj === "incidents") return "db.incidents";
  if (obj === "images") return "owned.images";
  if (obj === "suspects") return "owned.watchlist";
  if (obj === "matches") return "owned.matches";
  return "warehouse." + obj;
}

function generateLocal(prompt) {
  const C = window.Constructor;
  const low = prompt.toLowerCase();
  if (refusePrompt(prompt)) {
    return {
      ok: false,
      refused: true,
      summary:
        "Refused. Constructor will not compile internet stalking, doxxing, public-webcam scrape, or sex-work targeting. A police suspect desk is allowed on owned images + owned.watchlist. Chat: police suspect desk, local model enhance, match watchlist.",
    };
  }
  let objects = objectsInPrompt(prompt);
  let assumed = false;
  if (!objects.length) {
    objects = ["inventory"];
    assumed = true;
  }
  const points = {
    inventory: "sku",
    suppliers: "supplier_id",
    locations: "location_id",
    shipments: "shipment_id",
    transactions: "txn_id",
    alerts: "alert_id",
    places: "place_id",
    venues: "venue_id",
    contacts: "contact_id",
    leads: "lead_id",
    incidents: "incident_id",
    images: "image_id",
    suspects: "suspect_id",
    matches: "match_id",
  };
  let sourceKind = "place";
  if (/cloud|sign[- ]?in|oauth/.test(low)) sourceKind = "cloud";
  if (/database|db link|postgres|add link|db\./.test(low)) sourceKind = "database";
  if (/local model|comfy|onnx|ollama/.test(low)) sourceKind = "local_model";
  if (/online api|http api|replicate/.test(low)) sourceKind = "online_api";
  const suspectish = isSuspectDesk(low);
  if (suspectish) {
    objects = ["images", "suspects", "matches"];
    assumed = false;
  }
  let action = "export_pptx";
  if (low.indexOf("intake") >= 0) action = "item.intake";
  else if (low.indexOf("agent.checked") >= 0 || (low.indexOf("check") >= 0 && low.indexOf("agent") >= 0)) {
    action = "agent.checked";
  } else if (suspectish || /suspect\.match/.test(low)) {
    action = "suspect.match";
  } else if (/image\.enhance|enhance/.test(low) && suspectish) {
    action = "suspect.match";
  }
  const verify = /verify|audit|hypothes|claim|fact-?check/.test(low);
  const agentish = /single agent|one agent|worker loop/.test(low);
  const foundryish = /foundry|create app|whole (app|workflow|desk)|generate whole|pptx|export|ontology|insight|\bapp\b|maps|club|venue|contact|customer|incident|case desk|suspect|face|cctv|enhance|comfy|police|watchlist/.test(
    low
  );
  let pattern = "orchestrator_subagent";
  let kinds = ["ingest", "connector", "ontology", "insight", "foundry", "app", "tool_call"];
  let enhanceBind = "local_model";
  if (/online api|http api|replicate/.test(low)) enhanceBind = "online_api";
  if (suspectish) {
    kinds = ["ingest", "enhance", "ontology", "insight", "foundry", "app", "tool_call"];
    if (sourceKind === "local_model" || sourceKind === "online_api") enhanceBind = sourceKind;
    sourceKind = "database";
  } else if (verify && !foundryish) {
    pattern = "generator_verifier";
    kinds = ["ingest", "hypothesize", "audit"];
  } else if (agentish && !foundryish) {
    pattern = "single_agent";
    kinds = ["ingest", "agent", "audit"];
  }
  const venueish = objects.some(function (o) {
    return o === "places" || o === "venues" || o === "contacts" || o === "leads";
  });
  const firstObj = objects[0];
  const sourcePlace =
    sourceKind === "cloud"
      ? "cloud.signed_in"
      : sourceKind === "local_model"
        ? "local.model"
        : sourceKind === "online_api"
          ? "api.enhance"
          : fetchPlaceFor(firstObj);
  const doing = {
    ingest: suspectish
      ? "Hop 0. Load owned images from owned.images (station archive or operator upload). Ghost on Pages. No write. No internet scrape."
      : "Hop 0. Load " +
        objects.join("/") +
        " rows from " +
        sourcePlace +
        " (" +
        sourceKind +
        "). Ghost on Pages. No write.",
    connector:
      sourceKind === "cloud"
        ? "Ghost cloud sign-in. Bind the signed-in catalog to an object. No OAuth. No fetch on Pages."
        : sourceKind === "database"
          ? "Bind a database link the operator pasted. Ghost on Pages. No live driver."
          : venueish
            ? "Bind Place/Venue fields to Cortex objects. Ghost on Pages. No live scrape."
            : "First-party Cortex input bound to the ingested object.",
    enhance:
      "Comfy-style enhance. Bind a " +
      enhanceBind +
      ". Ghost on Pages. Distill Comfy, do not clone. Zoom/refresh/improve quality. No public scrape.",
    ontology: suspectish
      ? "Object types images, suspects, matches. Links image_at_location, suspect_image, match_of_image, match_of_suspect. Owned watchlist only."
      : venueish
        ? "Object types " +
          objects.join(", ") +
          ". Links venue_at_place, contact_at_venue, lead_of_contact."
        : objects.indexOf("incidents") >= 0
          ? "Object types " + objects.join(", ") + ". Link incident_at_location. Owned rows."
          : "Cortex ontology objects/links/actions. Not a custom type picker.",
    insight: suspectish
      ? "Cite enhanced image vs owned.watchlist. Score is a claim, steward reviews. Not a conviction."
      : venueish
        ? "Cite nearby venues by Place lat/lng, contacts at those venues, leads from contacts."
        : objects.indexOf("incidents") >= 0
          ? "Cite incident rows + location links. What you may claim from the owned ledger."
          : "Cite ontology + ledger. What you may claim from those objects.",
    foundry: "Compile insights into a governed Cortex app. Not an n8n clone.",
    app: "Runnable output. Hosted inside Cortex at /cortex/constructor/.",
    tool_call: suspectish
      ? "F8 governed write. requires_confirm. Action suspect.match against owned.watchlist."
      : "F8 governed write. requires_confirm. Real tool is export_pptx.",
    hypothesize: "Surface a testable claim.",
    audit: "Why this node exists. DETERMINISTIC_RULE, not a second EMIT.",
    agent: "AGENT_TASK loop. One bounded worker.",
  };
  const nodes = kinds.map(function (kind, i) {
    let obj = objects[0];
    if (kind === "ontology" && objects[1]) obj = objects[1];
    if (kind === "insight" && objects[2]) obj = objects[2];
    if (kind === "tool_call" && objects[objects.length - 1]) obj = objects[objects.length - 1];
    const meta = (C.KINDS && C.KINDS[kind]) || {};
    const node = {
      id: "g" + (i + 1),
      kind: kind,
      x: 32 + (i % 4) * 208,
      y: 48 + Math.floor(i / 4) * 168,
      note: doing[kind] || meta.note || kind,
      doing: doing[kind] || meta.note || kind,
      persona: meta.persona || "",
      tier: "T0",
      stream: false,
    };
    if (kind === "ingest" || kind === "connector" || kind === "ontology" || kind === "tool_call" || kind === "insight" || kind === "enhance") {
      node.object_type = obj;
      node.data_point = points[obj] || "sku";
      node.data_type = "string";
      node.fetch_from = sourceKind === "cloud" ? "cloud.signed_in" : fetchPlaceFor(obj);
      node.source_kind = sourceKind;
      node.source_link = sourceKind === "cloud" ? "signed-in" : sourceKind === "database" ? node.fetch_from : "";
    }
    if (kind === "enhance") {
      node.object_type = "images";
      node.data_point = "image_id";
      node.source_kind = enhanceBind;
      node.fetch_from = enhanceBind === "online_api" ? "api.enhance" : "local.model";
      node.source_link = enhanceBind === "online_api" ? "api.enhance" : "local://enhance";
      node.action_type = "image.enhance";
    }
    if (kind === "tool_call" || kind === "foundry") node.action_type = action;
    if (kind === "app") node.action_type = "emit";
    return node;
  });
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
  return {
    ok: true,
    pattern: pattern,
    assumed_object: assumed,
    objects: objects,
    action: action,
    nodes: nodes,
    edges: edges,
    summary:
      "Compiled " +
      nodes.length +
      " Cortex nodes (" +
      pattern +
      "). " +
      (assumed ? "Assumed inventory. " : "Objects " + objects.join(", ") + ". ") +
      "Action " +
      action +
      ". Source " +
      sourceKind +
      ". Click a node: doing / action / app / code / response.",
  };
}

async function generateFromChat(text) {
  const C = window.Constructor;
  if (refusePrompt(text)) {
    return generateLocal(text).summary;
  }
  let graph = null;
  if (cortexOrigin()) {
    const remote = await cortexPost("/cortex/constructor/generate", { prompt: text });
    if (remote && remote.ok && Array.isArray(remote.nodes) && remote.nodes.length) {
      const localObjs = objectsInPrompt(text);
      if (remote.assumed_object && localObjs.length) graph = null;
      else graph = remote;
    }
  }
  if (!graph) graph = generateLocal(text);
  if (!graph.ok) return graph.summary;
  C.replaceGraph(graph.nodes, graph.edges);
  await rankApproaches();
  const first = C.getState().nodes[0];
  if (first) C.showDecision({ node: first, response: graph.summary });
  return graph.summary || "Compiled the graph. Click a node for doing / action / app / code / response.";
}

async function pressNode() {
  const C = window.Constructor;
  const node = C.selected && C.selected();
  if (!node) return "Select or click a node first.";
  const ir = compileIR(C.getState());
  const compiled = (ir.nodes || []).find((n) => n.id === node.id) || {};
  let remote = null;
  if (cortexOrigin()) {
    remote = await cortexPost("/cortex/constructor/decision", {
      node_id: node.id,
      nodes: C.getState().nodes,
      edges: C.getState().edges,
    });
  }
  const remoteOk = remote && remote.ok !== false && remote.cortex_kind;
  const layer = {
    mode: "cortex-decision",
    node_id: node.id,
    constructor_kind: node.kind,
    cortex_kind: (remoteOk && remote.cortex_kind) || compiled.kind || CORTEX_KIND[node.kind],
    is_emit: ir.output_node_id === node.id,
    is_entry: ir.entry_node_id === node.id,
    requires_confirm: node.kind === "tool_call",
    would_write: node.kind === "tool_call" || node.kind === "app",
    tier: node.tier || "T0",
    object_type: node.object_type || null,
    data_point: node.data_point || null,
    action_type: node.action_type || null,
    fetch_from: node.fetch_from || null,
    tool_name: remote && remote.tool_name,
    approach: C.lastRanking && C.lastRanking[0] ? C.lastRanking[0].id : null,
    remote: remote,
  };
  const response = remoteOk
    ? "Cortex compile " + layer.cortex_kind + (layer.is_emit ? " EMIT" : "") + "."
    : "Local compile " + layer.cortex_kind + (cortexOrigin() ? " (engine decision missed)" : " (Pages, no fetch)") + ".";
  C.showDecision({
    node: node,
    cortex_kind: layer.cortex_kind,
    is_emit: layer.is_emit,
    tool_name: layer.tool_name,
    response: response,
    openDialog: true,
    raw: layer,
  });
  const rec = remote && remote.recommendation && remote.recommendation.pattern;
  return (
    "DOING " +
    (node.doing || node.kind) +
    ". ACTION " +
    (node.action_type || "none") +
    ". APP " +
    (layer.is_emit ? "EMIT" : "downstream") +
    ". CODE " +
    (layer.cortex_kind || "?") +
    ". RESPONSE " +
    response +
    (rec ? " Pattern " + rec : "")
  );
}

function bindChat() {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  function keepChat() {
    if (window.Constructor && window.Constructor.ensureChatOpen) window.Constructor.ensureChatOpen();
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value;
    if (!text.trim()) return;
    keepChat();
    chatSay("user", text);
    input.value = "";
    const send = form.querySelector("button[type=submit]");
    if (send) send.disabled = true;
    try {
      const reply = await handleChat(text);
      chatSay("assistant", reply);
    } finally {
      if (send) send.disabled = false;
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  document.getElementById("ghost-toggle").addEventListener("click", () => {
    const C = window.Constructor;
    C.setGhost(!C.ghost);
    keepChat();
    chatSay("assistant", C.ghost ? "Ghost on." : "Ghost off.");
  });
  const autoBtn = document.getElementById("automate");
  if (autoBtn) {
    autoBtn.addEventListener("click", () => {
      const C = window.Constructor;
      setAutomate(!C.automate);
      keepChat();
      chatSay(
        "assistant",
        C.automate
          ? cortexOrigin()
            ? "Automate on. Live POST /cortex/constructor/run after each finish, then 15s. Pages stay ghost."
            : "Automate on. Ghost-run every 15s. Live run is Cortex only."
          : "Automate off."
      );
    });
  }
  document.getElementById("propose").addEventListener("click", async () => {
    keepChat();
    chatSay("assistant", await handleChat("propose 3"));
  });
  document.getElementById("maximize").addEventListener("click", async () => {
    keepChat();
    chatSay("assistant", await handleChat("maximize"));
  });
  const runBtn = document.getElementById("run-graph");
  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      keepChat();
      chatSay("assistant", await handleChat("run"));
    });
  }
  const issueBtn = document.getElementById("issue-key");
  if (issueBtn) {
    if (!cortexOrigin()) issueBtn.hidden = true;
    issueBtn.addEventListener("click", async () => {
      keepChat();
      chatSay("assistant", await issueOpenVaultKey());
    });
  }
  const keyBox = document.getElementById("cortex-key");
  if (keyBox && cortexOrigin()) {
    keyBox.addEventListener("change", async () => {
      const key = keyBox.value.trim();
      if (!key) return;
      const remote = await bindSession(key);
      if (remote && remote.ok === false) {
        setOvStatus("OpenVault: key refused (" + (remote.status || remote.detail || remote.error || "401") + ").");
        return;
      }
      setOvStatus("OpenVault: session bound. Catalog + fetch + run all are live.");
      await loadOntology();
    });
  }
  chatSay(
    "assistant",
    "Chat warehouse, venue/CRM, case desk, or a police suspect desk. Owned images -> enhance (local model or online API) -> match owned.watchlist -> app. Ctrl+/ toggles. I will not compile stalking, doxxing, public-webcam scrape, or sex-work graphs. Type help."
  );
  window.Constructor.pressNode = pressNode;
  loadOntology();
  rankApproaches();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindChat);
} else {
  bindChat();
}
