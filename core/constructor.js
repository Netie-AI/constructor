/* Netie Constructor core (v0.1.0).
   Cortex-shaped IR + ghost compile. No n8n, no Activepieces, no Crew runtime.
   Browser: globalThis.NetieConstructorCore. Node: module.exports. */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.NetieConstructorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "0.1.0";
  const ENGINE = "cortex";

  const CORTEX_KIND = {
    ingest: "DOCUMENT_REF",
    connector: "DOCUMENT_REF",
    trigger: "DOCUMENT_REF",
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

  const KIND_NOTES = {
    ingest: { persona: "loader", note: "Hop 0. Load rows from a place into an object. No write." },
    connector: { persona: "source", note: "First-party Cortex input bound to an object. No n8n." },
    trigger: { persona: "source", note: "Webhook, schedule, or message. Ghost on Pages. Live only on /cortex." },
    ontology: { persona: "modeler", note: "Object, link, and action types on this graph." },
    insight: { persona: "analyst", note: "Cite ontology + ledger. What you may claim." },
    foundry: { persona: "compiler", note: "Compile insights into a governed Cortex app." },
    app: { persona: "operator", note: "Emit the app a stranger can run inside Cortex." },
    agent: { persona: "worker", note: "AGENT_TASK loop. One bounded worker." },
    hypothesize: { persona: "skeptic", note: "Surface a testable claim." },
    enhance: { persona: "enhancer", note: "Comfy-style. Local model or online API. Ghost on Pages." },
    improve: { persona: "editor", note: "Change a product from the claim." },
    audit: { persona: "steward", note: "Why this node exists. DETERMINISTIC_RULE, not a second EMIT." },
    tool_call: { persona: "writer", note: "Governed write. requires_confirm." },
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

  function cortexOriginFrom(host, path) {
    host = String(host || "");
    path = String(path || "");
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

  function nodeIo(n) {
    n = n || {};
    const k = n.kind;
    const obj = n.object_type || "";
    const place = n.fetch_from || n.source_link || "";
    if (k === "ingest") return { data_in: place || n.source_kind || "place", data_out: obj || "rows" };
    if (k === "connector") return { data_in: (n.source_kind || "place") + " bind", data_out: obj || "feed" };
    if (k === "trigger") return { data_in: n.trigger_kind || "webhook", data_out: "event" };
    if (k === "ontology") return { data_in: obj || "type", data_out: "schema" };
    if (k === "insight") return { data_in: obj || "object", data_out: "claim" };
    if (k === "foundry") return { data_in: "insights", data_out: n.skin || "app IR" };
    if (k === "app") return { data_in: "compiled IR", data_out: "EMIT " + (n.skin || "constructor") };
    if (k === "tool_call") return { data_in: obj || "object", data_out: n.action_type || "write" };
    if (k === "enhance") return { data_in: "owned image", data_out: "enhanced" };
    if (k === "audit") return { data_in: "claim", data_out: "gate" };
    if (k === "agent") return { data_in: "task", data_out: "AGENT_TASK" };
    if (k === "hypothesize") return { data_in: "rows", data_out: "claim" };
    if (k === "improve") return { data_in: "claim", data_out: "edit" };
    return { data_in: "in", data_out: "out" };
  }

  function compileIR(state, opts) {
    opts = opts || {};
    const ghost = opts.ghost != null ? !!opts.ghost : true;
    const output =
      [...state.nodes].reverse().find((n) => n.kind === "app") ||
      [...state.nodes].reverse().find((n) => n.kind === "audit") ||
      state.nodes[state.nodes.length - 1];
    return {
      version: "1.0",
      engine: ENGINE,
      ghost: ghost,
      entry_node_id: state.nodes[0].id,
      output_node_id: output.id,
      nodes: state.nodes.map((n) => {
        let kind = CORTEX_KIND[n.kind] || "DOCUMENT_REF";
        if (n.id === output.id) kind = "EMIT";
        else if (kind === "EMIT") kind = "DETERMINISTIC_RULE";
        const io = nodeIo(n);
        return {
          id: n.id,
          kind: kind,
          constructor_kind: n.kind,
          object_type: n.object_type || null,
          data_point: n.data_point || null,
          data_type: n.data_type || null,
          action_type: n.action_type || null,
          fetch_from: n.fetch_from || null,
          skin: n.skin || null,
          compute: n.compute || (n.kind === "foundry" ? "cortex" : null),
          tier: n.tier || "T0",
          stream: !!n.stream,
          trigger_kind: n.trigger_kind || null,
          source_kind: n.source_kind || null,
          source_link: n.source_link || null,
          region: n.region || null,
          data_in: io.data_in,
          data_out: io.data_out,
          note: n.note,
          requires_confirm: n.kind === "tool_call",
        };
      }),
      edges: state.edges.slice(),
    };
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

  function ghostWalk(state, ghost) {
    const order = topo(state);
    const log = [];
    for (const id of order) {
      const node = state.nodes.find((n) => n.id === id);
      const write = !ghost && (node.kind === "tool_call" || node.kind === "app");
      log.push({
        id: node.id,
        kind: node.kind,
        cortex: CORTEX_KIND[node.kind],
        ghost: ghost || !write,
        write: !!write,
        would: node.note,
        action_type: node.action_type || (node.kind === "tool_call" ? "export_pptx" : "agent.checked"),
        object_type: node.object_type || null,
        data_point: node.data_point || null,
        fetch_from: node.fetch_from || null,
      });
    }
    return { order: order, steps: log };
  }

  function rankApproachesForGraph(state) {
    const kinds = new Set((state.nodes || []).map((n) => n.kind));
    const foundry = ["ontology", "insight", "foundry", "app"].every((k) => kinds.has(k));
    const verify = kinds.has("hypothesize") && kinds.has("audit") && !foundry;
    const judge = kinds.has("audit") && kinds.has("trigger");
    const ranked = APPROACHES.map((row) => {
      let score = scoreApproach(row);
      if (foundry && row.id === "orchestrator_subagent") score += 20;
      if (verify && row.id === "generator_verifier") score += 20;
      if (judge && row.id === "generator_verifier") score += 22;
      return Object.assign({}, row, { score: score });
    }).sort((a, b) => b.score - a.score);
    return ranked;
  }

  function objectsInPrompt(text) {
    const low = String(text || "").toLowerCase();
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
    const low = String(text || "").toLowerCase();
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

  function generateGraph(prompt, kindsCatalog) {
    const kindsMap = kindsCatalog || KIND_NOTES;
    const low = String(prompt || "").toLowerCase();
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
          ? "Object types " + objects.join(", ") + ". Links venue_at_place, contact_at_venue, lead_of_contact."
          : objects.indexOf("incidents") >= 0
            ? "Object types " + objects.join(", ") + ". Link incident_at_location. Owned rows."
            : "Cortex ontology objects/links/actions. Not a custom type picker.",
      foundry: "Compile insights into a governed Cortex app. Not an n8n clone.",
      app: "Runnable output. Hosted inside Cortex at /cortex/constructor/.",
      tool_call: suspectish
        ? "F8 governed write. requires_confirm. Action suspect.match against owned.watchlist."
        : "F8 governed write. requires_confirm. Real tool is export_pptx.",
      hypothesize: "Surface a testable claim.",
      audit: "Why this node exists. DETERMINISTIC_RULE, not a second EMIT.",
      agent: "AGENT_TASK loop. One bounded worker.",
      insight: suspectish
        ? "Cite enhanced image vs owned.watchlist. Score is a claim, steward reviews. Not a conviction."
        : venueish
          ? "Cite nearby venues by Place lat/lng, contacts at those venues, leads from contacts."
          : objects.indexOf("incidents") >= 0
            ? "Cite incident rows + location links. What you may claim from the owned ledger."
            : "Cite ontology + ledger. What you may claim from those objects.",
    };
    const nodes = kinds.map(function (kind, i) {
      let obj = objects[0];
      if (kind === "ontology" && objects[1]) obj = objects[1];
      if (kind === "insight" && objects[2]) obj = objects[2];
      if (kind === "tool_call" && objects[objects.length - 1]) obj = objects[objects.length - 1];
      const meta = kindsMap[kind] || KIND_NOTES[kind] || {};
      const node = {
        id: "g" + (i + 1),
        kind: kind,
        y: 56,
        note: doing[kind] || meta.note || kind,
        doing: doing[kind] || meta.note || kind,
        persona: meta.persona || "",
        tier: "T0",
        stream: false,
      };
      node.x = 24 + i * 196;
      if (
        kind === "ingest" ||
        kind === "connector" ||
        kind === "ontology" ||
        kind === "tool_call" ||
        kind === "insight" ||
        kind === "enhance"
      ) {
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
      if (kind === "tool_call") node.action_type = action;
      if (kind === "foundry") {
        node.action_type = action;
        node.skin = suspectish ? "suspect" : venueish ? "constructor" : "warehouse";
        node.compute = "cortex";
      }
      if (kind === "app") {
        node.action_type = "emit";
        node.skin = suspectish ? "suspect" : venueish ? "constructor" : "warehouse";
        node.object_type = firstObj;
      }
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

  return {
    VERSION: VERSION,
    ENGINE: ENGINE,
    CORTEX_KIND: CORTEX_KIND,
    KIND_NOTES: KIND_NOTES,
    APPROACHES: APPROACHES,
    cortexOriginFrom: cortexOriginFrom,
    compileIR: compileIR,
    topo: topo,
    ghostWalk: ghostWalk,
    scoreApproach: scoreApproach,
    rankApproachesForGraph: rankApproachesForGraph,
    objectsInPrompt: objectsInPrompt,
    refusePrompt: refusePrompt,
    isSuspectDesk: isSuspectDesk,
    fetchPlaceFor: fetchPlaceFor,
    nodeIo: nodeIo,
    generateGraph: generateGraph,
  };
});
