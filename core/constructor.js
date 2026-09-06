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
      rsf: opts.rsf ? rsfDigest(opts.rsf) : null,
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
      ["alerts", ["alert", "alarm", "anomal", "sensor", "snesor", "pressure"]],
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
      "baileys",
      "pywhatkit",
      "whatsapp-web",
      "scrape phone",
    ];
    return hits.some(function (h) {
      return low.indexOf(h) >= 0;
    });
  }

  function isSuspectDesk(low) {
    return /suspect|watchlist|\bpolice\b/.test(low || "");
  }

  function flowFromPrompt(low) {
    const s = String(low || "");
    if (isSuspectDesk(s)) return "suspect";
    if (/whatsapp|gmail|\bemail\b|e-mail|outlook/.test(s)) return "notify";
    if (/retrain|anomal|sensor|snesor|pressure|factory|facotry|\bplc\b/.test(s)) return "plant";
    if (/detect|infer|cctv|camera|particle|region/.test(s)) return "infer";
    return "desk";
  }

  function plantPlace(low) {
    const m = String(low || "").match(/(?:factory|facotry)\s*([a-z0-9]+)/);
    return "factory." + ((m && m[1]) || "c");
  }

  function sensorCount(low) {
    const s = String(low || "");
    const m =
      s.match(/(\d+)\s*(?:pressure\s*)?(?:detection\s*)?(?:snesors?|sensors?)/) ||
      s.match(/(\d+)(?:snesors?|sensors?)/);
    return (m && m[1]) || "8";
  }

  function naturalSummary(opts) {
    if (opts.flow === "plant") {
      return (
        "Ghost sketch, not live plant. " +
        opts.place +
        ", " +
        opts.sensors +
        " pressure feeds -> last week's anomaly model -> retrain DAG. Nothing at the factory moved. Click a node, then Run."
      );
    }
    if (opts.flow === "infer") {
      return "Ghost sketch, not live cameras. Owned frames -> human mark -> judge. No scrape. Click a node, then Run.";
    }
    if (opts.flow === "suspect") {
      return "Ghost sketch of a police suspect desk on owned images + owned.watchlist. Not live CCTV. Click a node, then Run.";
    }
    if (opts.flow === "notify") {
      return (
        "Ghost notify, not a live sender. Email is a draft until you grant Gmail and click send. " +
        "WhatsApp is draft-only (no Twilio/Baileys). Live DuckDB is /cortex + ov_ key. Pages never fetch."
      );
    }
    return (
      "Ghost sketch. " +
      (opts.assumed ? "No object named, so warehouse inventory. " : "Objects " + (opts.objects || []).join(", ") + ". ") +
      "Ghost is on. Click a node, then Run."
    );
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
    const flow = flowFromPrompt(low);
    const place = flow === "plant" ? plantPlace(low) : "";
    const sensors = flow === "plant" ? sensorCount(low) : "";
    let objects = objectsInPrompt(prompt);
    let assumed = false;
    if (flow === "plant") {
      objects = ["alerts"];
    } else if (flow === "infer") {
      objects = ["images"];
    } else if (flow === "suspect") {
      objects = ["images", "suspects", "matches"];
    } else if (flow === "notify") {
      objects = ["contacts"];
    } else if (!objects.length) {
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
    if (flow === "plant") sourceKind = "stream";
    if (flow === "notify") sourceKind = "cloud";
    const suspectish = flow === "suspect";
    let action = "export_pptx";
    if (flow === "plant" || flow === "infer") action = "agent.checked";
    else if (flow === "notify") action = /whatsapp/.test(low) ? "draft_whatsapp" : "draft_email";
    else if (low.indexOf("intake") >= 0) action = "item.intake";
    else if (low.indexOf("agent.checked") >= 0 || (low.indexOf("check") >= 0 && low.indexOf("agent") >= 0)) {
      action = "agent.checked";
    } else if (suspectish || /suspect\.match/.test(low)) {
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
    if (flow === "infer") {
      kinds = ["trigger", "ingest", "enhance", "ontology", "insight", "foundry", "app", "audit"];
    } else if (flow === "plant") {
      kinds = ["ingest", "connector", "ontology", "insight", "foundry", "app", "audit", "tool_call"];
    } else if (flow === "notify") {
      kinds = ["ingest", "connector", "ontology", "insight", "foundry", "app", "audit", "tool_call"];
    } else if (suspectish) {
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
      flow === "plant"
        ? place
        : flow === "infer"
          ? "owned.images"
          : flow === "notify"
            ? "cloud.signed_in"
            : sourceKind === "cloud"
            ? "cloud.signed_in"
            : sourceKind === "local_model"
              ? "local.model"
              : sourceKind === "online_api"
                ? "api.enhance"
                : fetchPlaceFor(firstObj);
    const doing = {
      ingest:
        flow === "plant"
          ? "Ghost. " + sensors + " pressure sensors from " + place + ". Not a live PLC."
          : flow === "infer"
            ? "Ghost. Owned frames, not a live camera."
            : flow === "notify"
              ? "DMS rows the note is about. Ghost on Pages. Live fetch is warehouse inventory on /cortex."
              : suspectish
              ? "Hop 0. Load owned images from owned.images (station archive or operator upload). Ghost on Pages. No write. No internet scrape."
              : "Hop 0. Load " +
                objects.join("/") +
                " rows from " +
                sourcePlace +
                " (" +
                sourceKind +
                "). Ghost on Pages. No write.",
      connector:
        flow === "plant"
          ? "Stream bind for those " + sensors + " feeds. Pages cannot open the factory bus."
          : flow === "notify"
            ? "Gmail grant is your Google click / OpenVault. Constructor never takes the password. WhatsApp number is a field. No send."
            : sourceKind === "cloud"
            ? "Ghost cloud sign-in. Bind the signed-in catalog to an object. No OAuth. No fetch on Pages."
            : sourceKind === "database"
              ? "Bind a database link the operator pasted. Ghost on Pages. No live driver."
              : venueish
                ? "Bind Place/Venue fields to Cortex objects. Ghost on Pages. No live scrape."
                : "First-party Cortex input bound to the ingested object.",
      trigger: flow === "infer" ? "Webhook / message. Ghost on Pages. Not a live CCTV tap." : "Webhook, schedule, or message. Ghost on Pages.",
      enhance:
        flow === "infer"
          ? "Resize / detect stub. Human mark is mock SVG. Live model is Cortex."
          : "Comfy-style enhance. Bind a " +
            enhanceBind +
            ". Ghost on Pages. Distill Comfy, do not clone. Zoom/refresh/improve quality. No public scrape.",
      ontology:
        flow === "plant"
          ? "Alerts on sensor id. Last week's model is a Cortex weight, not a new type."
          : flow === "infer"
            ? "Owned image frames. Studio for the PK, not a detector store."
            : suspectish
              ? "Object types images, suspects, matches. Links image_at_location, suspect_image, match_of_image, match_of_suspect. Owned watchlist only."
              : venueish
                ? "Object types " + objects.join(", ") + ". Links venue_at_place, contact_at_venue, lead_of_contact."
                : objects.indexOf("incidents") >= 0
                  ? "Object types " + objects.join(", ") + ". Link incident_at_location. Owned rows."
                  : "Cortex ontology objects/links/actions. Not a custom type picker.",
      foundry:
        flow === "plant"
          ? "Retrain as Cortex DAG. Last week's anomaly weights stay in Cortex. Not Apache Airflow."
          : flow === "infer"
            ? "Infer compile. Weights stay in Cortex."
            : flow === "notify"
              ? "Compile notify onto Cortex DMS brain. Not n8n. Not a live mailer."
              : "Compile insights into a governed Cortex app. Not an n8n clone.",
      app: "Skin only. Engine is Cortex. Ghost on Pages.",
      tool_call:
        flow === "plant"
          ? "Handoff to Cortex retrain. requires_confirm. Not export_pptx."
          : flow === "notify"
            ? "DMS draft_email / draft_whatsapp. requires_confirm. You click send. P16 parks unofficial WhatsApp."
            : suspectish
            ? "F8 governed write. requires_confirm. Action suspect.match against owned.watchlist."
            : "F8 governed write. requires_confirm. Real tool is export_pptx.",
      hypothesize: "Surface a testable claim.",
      audit:
        flow === "plant"
          ? "Gate mock metrics vs last week's model. Live gate is Cortex."
          : flow === "infer"
            ? "LLM-as-judge mock: label vs human mark. Not a live LLM on Pages."
            : "Why this node exists. DETERMINISTIC_RULE, not a second EMIT.",
      agent: "AGENT_TASK loop. One bounded worker.",
      insight:
        flow === "plant"
          ? "Anomaly score vs last week's model. Mock curve, not a live trainer."
          : flow === "infer"
            ? "Region mark: human. Mock SVG, not CV."
            : suspectish
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
        stream: flow === "plant" && (kind === "ingest" || kind === "connector"),
      };
      node.x = 24 + i * 196;
      if (kind === "trigger") {
        node.trigger_kind = "webhook";
        node.stream = true;
        node.source_kind = "stream";
        node.source_link = "streams.open";
        node.fetch_from = "streams.open";
      }
      if (
        kind === "ingest" ||
        kind === "connector" ||
        kind === "ontology" ||
        kind === "tool_call" ||
        kind === "insight" ||
        kind === "enhance" ||
        kind === "audit"
      ) {
        node.object_type = obj;
        node.data_point = points[obj] || "sku";
        node.data_type = "string";
        node.fetch_from = sourceKind === "cloud" ? "cloud.signed_in" : sourcePlace || fetchPlaceFor(obj);
        node.source_kind = sourceKind;
        node.source_link = sourceKind === "cloud" ? "signed-in" : sourceKind === "database" ? node.fetch_from : sourceKind === "stream" ? node.fetch_from : "";
      }
      if (kind === "enhance") {
        node.object_type = "images";
        node.data_point = "image_id";
        node.source_kind = enhanceBind;
        node.fetch_from = enhanceBind === "online_api" ? "api.enhance" : "local.model";
        node.source_link = enhanceBind === "online_api" ? "api.enhance" : "local://enhance";
        node.action_type = "image.enhance";
      }
      if ((kind === "insight" || kind === "audit") && flow === "infer") {
        node.region = "cx=62 cy=48 r=18 why=human";
      }
      if (kind === "tool_call") node.action_type = action;
      if (kind === "foundry") {
        node.action_type = action;
        node.skin = suspectish ? "suspect" : flow === "plant" || flow === "infer" || venueish ? "constructor" : "warehouse";
        node.compute = "cortex";
      }
      if (kind === "app") {
        node.action_type = "emit";
        node.skin = suspectish ? "suspect" : flow === "plant" || flow === "infer" || venueish ? "constructor" : "warehouse";
        node.object_type = firstObj;
      }
      return node;
    });
    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
    const lab =
      flow === "plant"
        ? "retrain"
        : flow === "infer" || flow === "suspect"
          ? "infer"
          : flow === "notify"
            ? "warehouse"
            : assumed
              ? "sample"
              : "warehouse";
    const insight =
      flow === "plant"
        ? "Mock retrain DAG for " + place + ". No live PLC."
        : flow === "infer"
          ? "Mock judge: circle human. Live LLM only on /cortex."
          : flow === "notify"
            ? "Ghost notify. Draft email/WhatsApp. You click send."
            : "";
    return {
      ok: true,
      flow: flow,
      lab: lab,
      insight: insight,
      pattern: pattern,
      assumed_object: assumed,
      objects: objects,
      action: action,
      nodes: nodes,
      edges: edges,
      summary: naturalSummary({
        flow: flow,
        assumed: assumed,
        objects: objects,
        place: place,
        sensors: sensors,
      }),
    };
  }

  /* RSF-05: consume DMS-shaped CERTIFIED artifacts toward compile/run.
     Schema of record: Netie-AI/dms dms_core.rsf (HTTP JSON). Cortex consumer is
     CortexOS.rsf.parse_rsf_artifact. Constructor never imports n8n/LC/LF. */

  const RSF_STAGES = ["research", "segment", "classify", "filter"];
  const RSF_STATUSES = { CERTIFIED: 1, ABSTAIN: 1, REFUSE: 1 };
  const RSF_REQUIRED = [
    "artifact_id",
    "stage",
    "question",
    "options",
    "chosen_option",
    "route_trace",
    "evidence",
    "status",
    "reasons",
  ];
  const RSF_DECISION_REQUIRED = ["step", "considered", "chosen", "rejected", "note"];
  const BANNED_ENGINE_IDS = {
    n8n: 1,
    myn8n: 1,
    langchain: 1,
    langchain_core: 1,
    langchain_community: 1,
    langflow: 1,
    langgraph: 1,
    crew: 1,
    crewai: 1,
    activepieces: 1,
  };

  function rsfError(message, code) {
    const err = new Error(message);
    err.name = "RsfError";
    err.code = code || "rsf";
    return err;
  }

  function isBannedEngineId(id) {
    const s = String(id || "")
      .toLowerCase()
      .replace(/-/g, "_")
      .trim();
    if (!s) return false;
    const root = s.split(".")[0];
    return !!BANNED_ENGINE_IDS[s] || !!BANNED_ENGINE_IDS[root];
  }

  function strList(value, label) {
    if (!Array.isArray(value) || !value.every(function (x) { return typeof x === "string"; })) {
      throw rsfError(label + " must be a list of strings", "schema");
    }
    return value.slice();
  }

  function rejectedMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw rsfError("rejected must be a mapping of option -> reason", "schema");
    }
    const out = {};
    Object.keys(value).forEach(function (option) {
      const reason = value[option];
      if (typeof option !== "string" || typeof reason !== "string") {
        throw rsfError("rejected must map string option to string reason", "schema");
      }
      if (!reason.trim()) {
        throw rsfError("rejected option " + JSON.stringify(option) + " carries no reason", "schema");
      }
      out[option] = reason;
    });
    return out;
  }

  function parseRouteDecision(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw rsfError("route decision must be an object", "schema");
    }
    const missing = RSF_DECISION_REQUIRED.filter(function (k) { return !(k in raw); });
    if (missing.length) {
      throw rsfError("route decision missing fields: " + missing.join(", "), "schema");
    }
    const step = String(raw.step || "").trim();
    if (!step) throw rsfError("route decision step required", "schema");
    const considered = strList(raw.considered, "considered");
    const chosen = raw.chosen;
    if (chosen != null && typeof chosen !== "string") {
      throw rsfError("route decision chosen must be a string or null", "schema");
    }
    if (chosen != null && considered.indexOf(chosen) < 0) {
      throw rsfError("route step " + JSON.stringify(step) + " chose " + JSON.stringify(chosen) + ", which it never considered", "schema");
    }
    if (typeof raw.note !== "string") throw rsfError("route decision note must be a string", "schema");
    return {
      step: step,
      considered: considered,
      chosen: chosen == null ? null : chosen,
      rejected: rejectedMap(raw.rejected),
      note: raw.note,
    };
  }

  function requireChoiceMatchesStatus(status, chosenOption, options) {
    if (status === "CERTIFIED") {
      if (chosenOption == null) {
        throw rsfError("CERTIFIED requires a chosen_option; nothing was chosen", "invent-green");
      }
    } else if (chosenOption != null) {
      throw rsfError(status + " must not carry a chosen_option (" + JSON.stringify(chosenOption) + ")", "invent-green");
    }
    if (chosenOption != null && options.indexOf(chosenOption) < 0) {
      throw rsfError("chosen_option " + JSON.stringify(chosenOption) + " is not one of the options considered", "schema");
    }
  }

  function parseRsfArtifact(raw) {
    if (raw == null) throw rsfError("schema missing", "schema");
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw rsfError("RSF artifact must be an object", "schema");
    }
    const missing = RSF_REQUIRED.filter(function (k) { return !(k in raw); });
    if (missing.length) {
      throw rsfError("schema missing fields: " + missing.join(", "), "schema");
    }
    const artifactId = String(raw.artifact_id || "").trim();
    if (!artifactId) throw rsfError("artifact_id required", "schema");
    const stage = String(raw.stage || "").trim();
    if (RSF_STAGES.indexOf(stage) < 0) {
      throw rsfError("unknown RSF stage " + JSON.stringify(stage), "schema");
    }
    const status = String(raw.status || "").trim();
    if (!RSF_STATUSES[status]) {
      throw rsfError("unknown status " + JSON.stringify(status), "schema");
    }
    const question = String(raw.question || "").trim();
    if (!question) {
      throw rsfError("question required; an artifact with no input is unauditable", "schema");
    }
    const options = strList(raw.options, "options");
    const evidence = strList(raw.evidence, "evidence");
    const reasons = strList(raw.reasons, "reasons");
    const chosen = raw.chosen_option;
    if (chosen != null && typeof chosen !== "string") {
      throw rsfError("chosen_option must be a string or null", "schema");
    }
    requireChoiceMatchesStatus(status, chosen == null ? null : chosen, options);
    if (status === "CERTIFIED" && !evidence.length) {
      throw rsfError("CERTIFIED requires evidence; a bare claim is not a certification", "invent-green");
    }
    if (!Array.isArray(raw.route_trace)) throw rsfError("route_trace must be a list", "schema");
    return {
      artifact_id: artifactId,
      stage: stage,
      question: question,
      options: options,
      chosen_option: chosen == null ? null : chosen,
      route_trace: raw.route_trace.map(parseRouteDecision),
      evidence: evidence,
      status: status,
      reasons: reasons,
    };
  }

  function requireCertifiedPriors(trace) {
    const byStage = {};
    trace.forEach(function (a) { byStage[a.stage] = a; });
    let blocked = false;
    RSF_STAGES.forEach(function (stage) {
      const item = byStage[stage];
      if (blocked) {
        if (item && item.status === "CERTIFIED") {
          throw rsfError(stage + " must not be CERTIFIED after a prior ABSTAIN/REFUSE/missing stage", "invent-green");
        }
        return;
      }
      if (!item || item.status !== "CERTIFIED") blocked = true;
    });
  }

  function parseRsfTrace(raw) {
    if (raw == null) throw rsfError("schema missing", "schema");
    if (!Array.isArray(raw)) throw rsfError("RSF trace must be a list", "schema");
    const out = raw.map(parseRsfArtifact);
    const seen = {};
    out.forEach(function (item) {
      if (seen[item.stage]) throw rsfError("duplicate stage " + item.stage, "schema");
      seen[item.stage] = true;
    });
    requireCertifiedPriors(out);
    return out;
  }

  function isRsfPayload(raw) {
    if (raw == null) return false;
    if (Array.isArray(raw)) {
      return raw.length > 0 && raw.every(function (item) {
        return item && typeof item === "object" && typeof item.status === "string" && typeof item.stage === "string";
      });
    }
    if (typeof raw !== "object") return false;
    if (Array.isArray(raw.artifacts)) return isRsfPayload(raw.artifacts);
    if (Array.isArray(raw.trace)) return isRsfPayload(raw.trace);
    if (raw.rsf && typeof raw.rsf === "object") return isRsfPayload(raw.rsf);
    return typeof raw.status === "string" && typeof raw.stage === "string" && "chosen_option" in raw;
  }

  function unwrapRsfPayload(raw) {
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (err) {
        throw rsfError("RSF JSON did not parse", "schema");
      }
    }
    if (Array.isArray(raw)) return { kind: "trace", items: raw };
    if (raw && Array.isArray(raw.artifacts)) return { kind: "trace", items: raw.artifacts };
    if (raw && Array.isArray(raw.trace)) return { kind: "trace", items: raw.trace };
    if (raw && raw.rsf && typeof raw.rsf === "object" && !("status" in raw)) {
      return unwrapRsfPayload(raw.rsf);
    }
    if (raw && typeof raw === "object" && "status" in raw) return { kind: "one", items: [raw] };
    throw rsfError("RSF payload must be an artifact, a trace list, or {artifacts: [...]}", "schema");
  }

  function bannedEngineHit(artifact) {
    const hits = [];
    function consider(value, where) {
      if (value == null) return;
      if (isBannedEngineId(value)) hits.push(where + "=" + value);
    }
    consider(artifact.chosen_option, "chosen_option");
    consider(artifact.engine, "engine");
    consider(artifact.engine_id, "engine_id");
    consider(artifact.runtime, "runtime");
    (artifact.route_trace || []).forEach(function (step) {
      consider(step.chosen, "route:" + step.step);
    });
    return hits;
  }

  function formatRsfRoute(artifact) {
    if (!artifact) return "";
    const steps = (artifact.route_trace || []).map(function (d) {
      return d.step + " -> " + (d.chosen || "none");
    });
    const chosen = artifact.chosen_option || "none";
    return chosen + (steps.length ? " (" + steps.join("; ") + ")" : "");
  }

  function rsfDigest(artifactOrConsume) {
    const a = artifactOrConsume && artifactOrConsume.wire ? artifactOrConsume.wire : artifactOrConsume;
    if (!a || typeof a !== "object") return null;
    return {
      artifact_id: a.artifact_id || null,
      stage: a.stage || null,
      status: a.status || null,
      chosen_option: a.chosen_option || null,
      route: formatRsfRoute(a),
      engine: ENGINE,
    };
  }

  function sampleCertifiedRsf(overrides) {
    overrides = overrides || {};
    const options = overrides.options || ["cortex", "myn8n", "langchain", "langflow"];
    const chosen = Object.prototype.hasOwnProperty.call(overrides, "chosen_option")
      ? overrides.chosen_option
      : "cortex";
    const rejected = {};
    options.forEach(function (opt) {
      if (opt === chosen) return;
      rejected[opt] = isBannedEngineId(opt)
        ? "distill_only, never product_engine"
        : "not the Netie-native route";
    });
    const base = {
      artifact_id: "rsf_filter_constructor",
      stage: "filter",
      question: "ingest warehouse inventory then foundry app",
      options: options,
      chosen_option: chosen,
      route_trace: [
        {
          step: "pick_engine",
          considered: options.slice(),
          chosen: chosen,
          rejected: rejected,
          note: "Constructor engine is Cortex dag_runner. Distill options stay listed.",
        },
      ],
      evidence: ["engine=cortex", "POST /cortex/constructor/run"],
      status: "CERTIFIED",
      reasons: ["RSF-05 Constructor consume"],
    };
    return Object.assign(base, overrides);
  }

  function consumeRsf(raw, opts) {
    opts = opts || {};
    const liveOrigin = !!opts.cortexOrigin;
    const ghostWanted = opts.ghost == null ? !liveOrigin : !!opts.ghost;
    try {
      const wrapped = unwrapRsfPayload(raw);
      const parsed =
        wrapped.kind === "trace" && wrapped.items.length > 1
          ? parseRsfTrace(wrapped.items)
          : wrapped.items.map(parseRsfArtifact);
      const primary = parsed[parsed.length - 1];
      if (primary.status !== "CERTIFIED") {
        return {
          ok: false,
          accepted: false,
          refused: primary.status === "REFUSE",
          status: primary.status,
          engine: ENGINE,
          chosen_option: primary.chosen_option,
          route: formatRsfRoute(primary),
          ghost: true,
          live: false,
          liveEligible: false,
          invented_live: false,
          wire: primary,
          trace: parsed,
          summary:
            "RSF " +
            primary.status +
            " is not accepted into Constructor run. Ghost only. Engine stays cortex. Not live.",
        };
      }
      const bans = [];
      parsed.forEach(function (a) {
        bannedEngineHit(a).forEach(function (h) { bans.push(h); });
      });
      if (bans.length) {
        return {
          ok: false,
          accepted: false,
          refused: true,
          ban: true,
          status: primary.status,
          engine: ENGINE,
          chosen_option: primary.chosen_option,
          route: formatRsfRoute(primary),
          ghost: true,
          live: false,
          liveEligible: false,
          invented_live: false,
          wire: primary,
          trace: parsed,
          summary:
            "BAN: n8n/langchain/langflow cannot be the Constructor engine (" +
            bans.join(", ") +
            "). Distill-only. Engine stays cortex. Not live.",
        };
      }
      const graph = generateGraph(primary.question);
      if (!graph.ok) {
        return {
          ok: false,
          accepted: false,
          refused: !!graph.refused,
          status: primary.status,
          engine: ENGINE,
          chosen_option: primary.chosen_option,
          route: formatRsfRoute(primary),
          ghost: true,
          live: false,
          liveEligible: false,
          invented_live: false,
          wire: primary,
          trace: parsed,
          summary: graph.summary || "RSF question refused by Constructor compile.",
        };
      }
      const ghost = ghostWanted || !liveOrigin;
      const route = formatRsfRoute(primary);
      return {
        ok: true,
        accepted: true,
        status: "CERTIFIED",
        engine: ENGINE,
        chosen_option: primary.chosen_option,
        stage: primary.stage,
        route: route,
        ghost: ghost,
        live: false,
        liveEligible: liveOrigin && !ghost,
        invented_live: false,
        graph: graph,
        wire: primary,
        trace: parsed,
        summary: ghost
          ? "RSF CERTIFIED accepted. Ghost dry-run. Option " +
            primary.chosen_option +
            " via " +
            route +
            ". Engine cortex. Not live (Hyperlift absent)."
          : "RSF CERTIFIED accepted. Option " +
            primary.chosen_option +
            " via " +
            route +
            ". Engine cortex. POST /cortex/constructor/run is liveEligible; core does not invent live success.",
      };
    } catch (err) {
      return {
        ok: false,
        accepted: false,
        refused: true,
        status: null,
        engine: ENGINE,
        chosen_option: null,
        route: "",
        ghost: true,
        live: false,
        liveEligible: false,
        invented_live: false,
        error: String((err && err.message) || err),
        summary: "RSF refused: " + String((err && err.message) || err) + ". Not live.",
      };
    }
  }

  return {
    VERSION: VERSION,
    ENGINE: ENGINE,
    CORTEX_KIND: CORTEX_KIND,
    KIND_NOTES: KIND_NOTES,
    APPROACHES: APPROACHES,
    RSF_STAGES: RSF_STAGES,
    RSF_STATUSES: ["CERTIFIED", "ABSTAIN", "REFUSE"],
    BANNED_ENGINE_IDS: Object.keys(BANNED_ENGINE_IDS),
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
    isBannedEngineId: isBannedEngineId,
    parseRsfArtifact: parseRsfArtifact,
    parseRsfTrace: parseRsfTrace,
    isRsfPayload: isRsfPayload,
    consumeRsf: consumeRsf,
    sampleCertifiedRsf: sampleCertifiedRsf,
    formatRsfRoute: formatRsfRoute,
    rsfDigest: rsfDigest,
  };
});
