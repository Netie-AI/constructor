const STORAGE_KEY = "netie.constructor.v4";
const CHAT_DOCK_KEY = "netie.constructor.chatdock.v1";
const PLAY_KEY = "netie.constructor.play.v1";
const SOURCE_KINDS = ["place", "stream", "cloud", "database", "local_model", "online_api"];
const TRIGGER_KINDS = ["webhook", "schedule", "message"];
const SKINS = ["constructor", "warehouse", "ontology", "suspect"];
const COMPUTE = ["cortex"];

function ico(paths) {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    paths +
    "</svg>"
  );
}

const KINDS = {
  ingest: {
    label: "Ingest",
    persona: "loader",
    color: "#7eb8ff",
    note: "Hop 0. Load rows from a place into an object. No write.",
    icon: ico(
      '<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 17h16v3H4z"/>'
    ),
  },
  connector: {
    label: "Connector",
    persona: "source",
    color: "#9ad7c2",
    note: "First-party Cortex input bound to an object. No n8n.",
    icon: ico('<path d="M8 7v10"/><path d="M16 7v10"/><path d="M8 12h8"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>'),
  },
  trigger: {
    label: "Trigger",
    persona: "source",
    color: "#9fd0e8",
    note: "Webhook, schedule, or message. Ghost on Pages. Live only on /cortex.",
    icon: ico('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  },
  ontology: {
    label: "Ontology",
    persona: "modeler",
    color: "#d4b4ff",
    note: "Object, link, and action types on this graph.",
    icon: ico('<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><circle cx="12" cy="17" r="3"/><path d="M10 9.5l2 5.5M14 9.5l-2 5.5M10 8h4"/>'),
  },
  insight: {
    label: "Insight",
    persona: "analyst",
    color: "#f0c36d",
    note: "Cite ontology + ledger. What you may claim.",
    icon: ico('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  },
  foundry: {
    label: "Foundry",
    persona: "compiler",
    color: "#e8a07a",
    note: "Compile insights into a governed Cortex app.",
    icon: ico('<path d="M4 18h16M6 18V9l6-4 6 4v9M9 18v-5h6v5"/>'),
  },
  app: {
    label: "App",
    persona: "operator",
    color: "#8ec8f0",
    note: "Emit the app a stranger can run inside Cortex.",
    icon: ico('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16"/>'),
  },
  agent: {
    label: "Agent",
    persona: "worker",
    color: "#b7e08a",
    note: "AGENT_TASK loop. One bounded worker.",
    icon: ico('<circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/>'),
  },
  hypothesize: {
    label: "Hypothesize",
    persona: "skeptic",
    color: "#c9c27a",
    note: "Surface a testable claim.",
    icon: ico('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 114 2c-.8.8-1.5 1.2-1.5 3"/><path d="M12 17.5h.01"/>'),
  },
  enhance: {
    label: "Enhance",
    persona: "enhancer",
    color: "#c4a0e8",
    note: "Comfy-style. Local model or online API. Ghost on Pages.",
    icon: ico('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 14l3-3 2 2 3-4"/><circle cx="9" cy="8" r="1.2"/>'),
  },
  improve: {
    label: "Improve",
    persona: "editor",
    color: "#9fd0e8",
    note: "Change a product from the claim.",
    icon: ico('<path d="M12 3v18M8 8h3M13 12h3M8 16h3"/>'),
  },
  audit: {
    label: "Audit",
    persona: "steward",
    color: "#d0d0d0",
    note: "Why this node exists. DETERMINISTIC_RULE, not a second EMIT.",
    icon: ico('<path d="M12 3l8 4v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z"/>'),
  },
  tool_call: {
    label: "Tool call",
    persona: "writer",
    color: "#f2a3a3",
    note: "Governed write. requires_confirm.",
    icon: ico('<path d="M13 3l-2 8h6l-8 10 2-8H5z"/>'),
  },
};

const PERSONAS = ["loader", "source", "modeler", "analyst", "compiler", "operator", "worker", "skeptic", "editor", "enhancer", "steward", "writer"];
const ACTION_META = [
  { id: "export_pptx", objects: ["*"], label: "export_pptx (any object)" },
  { id: "item.intake", objects: ["inventory"], label: "item.intake (inventory)" },
  { id: "agent.checked", objects: ["*"], label: "agent.checked (ledger)" },
  { id: "image.enhance", objects: ["images", "matches"], label: "image.enhance (images)" },
  { id: "suspect.match", objects: ["suspects", "matches", "images"], label: "suspect.match (watchlist)" },
];


const nodesEl = document.getElementById("nodes");
const wiresEl = document.getElementById("wires");
const inspectCard = document.getElementById("inspect-card");
const inspectJson = document.getElementById("inspect-json");
const inspectEmpty = document.getElementById("inspect-empty");
const inspectForm = document.getElementById("inspect-form");

const OBJECTS = {
  inventory: {
    points: {
      sku: "string",
      sku_name: "string",
      category: "string",
      supplier_id: "string",
      location_id: "string",
      storage_bin: "string",
      quantity_kg: "number",
      reorder_level_kg: "number",
      unit_cost_myr: "number",
      last_restocked: "date",
      expiry_date: "date",
      is_hazardous: "boolean",
    },
  },
  suppliers: {
    points: {
      supplier_id: "string",
      supplier_name: "string",
      country: "string",
      lead_time_days: "integer",
      payment_terms: "string",
      last_audit_date: "date",
      risk_score: "number",
    },
  },
  locations: {
    points: {
      location_id: "string",
      location_name: "string",
      city: "string",
      latitude: "number",
      longitude: "number",
    },
  },
  places: {
    points: {
      place_id: "string",
      name: "string",
      locality: "string",
      latitude: "number",
      longitude: "number",
    },
  },
  venues: {
    points: {
      venue_id: "string",
      name: "string",
      category: "string",
      place_id: "string",
      website: "string",
    },
  },
  contacts: {
    points: {
      contact_id: "string",
      name: "string",
      role: "string",
      venue_id: "string",
      email: "string",
    },
  },
  leads: {
    points: {
      lead_id: "string",
      account: "string",
      status: "string",
      contact_id: "string",
    },
  },
  incidents: {
    points: {
      incident_id: "string",
      opened_at: "date",
      status: "string",
      location_id: "string",
      summary: "string",
    },
  },
  images: {
    points: {
      image_id: "string",
      captured_at: "date",
      location_id: "string",
      asset_uri: "string",
      quality: "number",
    },
  },
  suspects: {
    points: {
      suspect_id: "string",
      name: "string",
      watchlist: "string",
      image_id: "string",
      notes: "string",
    },
  },
  matches: {
    points: {
      match_id: "string",
      image_id: "string",
      suspect_id: "string",
      score: "number",
      reviewed: "boolean",
    },
  },
};
const LINKS = [
  { id: "inventory_supplier", from: "inventory", to: "suppliers", via: "supplier_id" },
  { id: "inventory_location", from: "inventory", to: "locations", via: "location_id" },
  { id: "venue_at_place", from: "venues", to: "places", via: "place_id" },
  { id: "contact_at_venue", from: "contacts", to: "venues", via: "venue_id" },
  { id: "lead_of_contact", from: "leads", to: "contacts", via: "contact_id" },
  { id: "incident_at_location", from: "incidents", to: "locations", via: "location_id" },
  { id: "image_at_location", from: "images", to: "locations", via: "location_id" },
  { id: "suspect_image", from: "suspects", to: "images", via: "image_id" },
  { id: "match_of_image", from: "matches", to: "images", via: "image_id" },
  { id: "match_of_suspect", from: "matches", to: "suspects", via: "suspect_id" },
];
const ACTIONS = ["export_pptx", "item.intake", "agent.checked", "image.enhance", "suspect.match"];
const FETCH_PLACES = [
  "warehouse.inventory",
  "warehouse.suppliers",
  "warehouse.locations",
  "warehouse.shipments",
  "warehouse.transactions",
  "warehouse.alerts",
  "maps.places",
  "maps.venues",
  "crm.contacts",
  "crm.leads",
  "cloud.signed_in",
  "db.link",
  "db.incidents",
  "owned.images",
  "owned.watchlist",
  "owned.matches",
  "local.model",
  "api.enhance",
];
const TIERS = ["T0", "T1"];

/* The static catalog above is the Pages fallback. When ontology.js is loaded,
   OBJECTS / LINKS / ACTION_META / ACTIONS / FETCH_PLACES become in-place views
   over window.Ontology so engine.js keeps its references. */
function ontologyModel() {
  const O = typeof window !== "undefined" ? window.Ontology : null;
  return O && typeof O.toCatalog === "function" ? O : null;
}

function syncCatalog() {
  const O = ontologyModel();
  if (!O) return false;
  let cat = null;
  try {
    cat = O.toCatalog();
  } catch (err) {
    cat = null;
  }
  if (!cat || !cat.objects || !Object.keys(cat.objects).length) return false;
  Object.keys(OBJECTS).forEach(function (k) {
    delete OBJECTS[k];
  });
  Object.keys(cat.objects).forEach(function (k) {
    OBJECTS[k] = cat.objects[k];
  });
  LINKS.length = 0;
  (cat.links || []).forEach(function (row) {
    LINKS.push(row);
  });
  ACTION_META.length = 0;
  (cat.action_meta || []).forEach(function (row) {
    ACTION_META.push(row);
  });
  ACTIONS.length = 0;
  (cat.actions || []).forEach(function (id) {
    ACTIONS.push(id);
  });
  FETCH_PLACES.length = 0;
  (cat.fetch_places || []).forEach(function (id) {
    FETCH_PLACES.push(id);
  });
  return true;
}
syncCatalog();

function ontologySummary(node) {
  const O = ontologyModel();
  const rev = O ? O.get().revision : null;
  return (
    (node.object_type ? node.object_type + " · " : "") +
    Object.keys(OBJECTS).length +
    " objects · " +
    LINKS.length +
    " links · " +
    ACTIONS.length +
    " actions" +
    (rev != null ? " · rev " + rev : "")
  );
}

function openOntologyStudio(opts) {
  const S = typeof window !== "undefined" ? window.OntologyStudio : null;
  if (!S || typeof S.open !== "function") return false;
  const node = state.nodes.find((n) => n.id === selectedId);
  const args = Object.assign({}, opts || {});
  if (!args.objectType && node && node.object_type && OBJECTS[node.object_type]) {
    args.objectType = node.object_type;
  }
  closeCalPop();
  S.open(args);
  return true;
}

const state = load() || sample();
let selectedId = state.nodes[0] ? state.nodes[0].id : null;
let armedPort = null;
let drag = null;
let calOpen = false;
const pan = { x: 0, y: 0, k: 1 };
let spaceDown = false;
let panning = null;

function applyPan() {
  const world = document.getElementById("world");
  if (!world) return;
  world.style.transform = "translate(" + pan.x + "px, " + pan.y + "px) scale(" + pan.k + ")";
}

function fitView() {
  const stage = document.getElementById("stage");
  if (!stage || !state.nodes.length) return false;
  const rect = stage.getBoundingClientRect();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of state.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + 188);
    maxY = Math.max(maxY, n.y + 110);
  }
  const pad = 24;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const k = Math.min(1.15, Math.max(0.35, Math.min((rect.width - pad * 2) / bw, (rect.height - pad * 2) / bh)));
  pan.k = k;
  pan.x = Math.round((rect.width - bw * k) / 2 - minX * k);
  pan.y = Math.round((rect.height - bh * k) / 2 - minY * k);
  applyPan();
  return true;
}

function screenToWorld(clientX, clientY) {
  const stage = document.getElementById("stage").getBoundingClientRect();
  return {
    x: (clientX - stage.left - pan.x) / pan.k,
    y: (clientY - stage.top - pan.y) / pan.k,
  };
}

function actionsForObject(objectType) {
  return ACTION_META.filter(function (row) {
    return row.objects.indexOf("*") >= 0 || row.objects.indexOf(objectType) >= 0;
  }).map(function (row) {
    return row.id;
  });
}

function seedNode(kind, x, y) {
  const meta = KINDS[kind];
  const node = {
    id: uid(),
    kind: kind,
    x: x != null ? x : 80 + state.nodes.length * 16,
    y: y != null ? y : 80 + state.nodes.length * 16,
    note: meta.note,
    doing: meta.note,
    persona: meta.persona,
    tier: "T0",
    stream: false,
  };
  if (kind === "ingest" || kind === "connector" || kind === "ontology") {
    node.object_type = "inventory";
    node.data_point = "sku";
    node.data_type = "string";
    node.fetch_from = "warehouse.inventory";
    node.source_kind = "place";
    node.source_link = "";
  }
  if (kind === "enhance") {
    node.object_type = "images";
    node.data_point = "image_id";
    node.data_type = "string";
    node.fetch_from = "local.model";
    node.source_kind = "local_model";
    node.source_link = "local://enhance";
    node.action_type = "image.enhance";
  }
  if (kind === "trigger") {
    node.trigger_kind = "webhook";
    node.stream = true;
    node.source_kind = "stream";
    node.source_link = "streams.open";
    node.fetch_from = "streams.open";
  }
  if (kind === "tool_call") node.action_type = "export_pptx";
  if (kind === "foundry") {
    node.action_type = "export_pptx";
    node.skin = "warehouse";
    node.compute = "cortex";
  }
  if (kind === "app") {
    node.action_type = "emit";
    node.skin = "constructor";
    node.object_type = "inventory";
  }
  if (kind === "insight" || kind === "audit" || kind === "agent" || kind === "hypothesize" || kind === "improve") {
    node.object_type = node.object_type || "inventory";
  }
  return node;
}

function sample() {
  return foundrySample();
}

function foundrySample() {
  return {
    nodes: [
      {
        id: "n0",
        kind: "ingest",
        x: 24,
        y: 64,
        object_type: "inventory",
        data_point: "sku",
        data_type: "string",
        fetch_from: "warehouse.inventory",
        source_kind: "place",
        source_link: "",
        persona: "loader",
        tier: "T0",
        stream: false,
        doing: "Hop 0. Load inventory rows from warehouse.inventory. No write.",
        note: "Hop 0. Load inventory rows from warehouse.inventory. No write.",
      },
      {
        id: "c1",
        kind: "connector",
        x: 220,
        y: 64,
        object_type: "inventory",
        data_point: "sku",
        data_type: "string",
        fetch_from: "warehouse.inventory",
        source_kind: "place",
        source_link: "",
        persona: "source",
        tier: "T0",
        stream: false,
        note: "First-party Cortex input. No n8n. WhatsApp stays a draft, not a send.",
      },
      {
        id: "o1",
        kind: "ontology",
        x: 416,
        y: 64,
        object_type: "suppliers",
        data_point: "supplier_id",
        data_type: "string",
        persona: "modeler",
        note: "Cortex ontology objects/links/actions. Not a custom type picker.",
      },
      {
        id: "i1",
        kind: "insight",
        x: 612,
        y: 64,
        object_type: "inventory",
        persona: "analyst",
        note: "Cite ontology + ledger. What you may claim from those objects.",
      },
      {
        id: "f1",
        kind: "foundry",
        x: 808,
        y: 64,
        action_type: "export_pptx",
        skin: "warehouse",
        compute: "cortex",
        persona: "compiler",
        note: "Compile insights into a governed Cortex app. Not an Activepieces clone.",
      },
      {
        id: "a1",
        kind: "app",
        x: 1004,
        y: 64,
        action_type: "emit",
        skin: "warehouse",
        object_type: "inventory",
        persona: "operator",
        note: "Runnable output. Hosted inside Cortex at /cortex/constructor/.",
      },
      {
        id: "g1",
        kind: "audit",
        x: 808,
        y: 260,
        object_type: "inventory",
        persona: "steward",
        note: "Why this node exists. Ghost ledgers would-call, not a second EMIT.",
      },
      {
        id: "t1",
        kind: "tool_call",
        x: 1004,
        y: 260,
        action_type: "export_pptx",
        object_type: "inventory",
        data_point: "sku",
        data_type: "string",
        persona: "writer",
        tier: "T0",
        note: "F8 governed write. requires_confirm. Only real tool on this pack is export_pptx.",
      },
    ],
    edges: [
      { from: "n0", to: "c1" },
      { from: "c1", to: "o1" },
      { from: "o1", to: "i1" },
      { from: "i1", to: "f1" },
      { from: "f1", to: "a1" },
      { from: "f1", to: "g1" },
      { from: "f1", to: "t1" },
    ],
  };
}

function labGraph(lab) {
  const base = foundrySample();
  const n = function (id) {
    return base.nodes.find(function (x) { return x.id === id; });
  };
  if (lab === "train") {
    n("n0").note = "Mock train set. Distill facts. Not GPU weights on Pages.";
    n("c1").stream = true;
    n("c1").source_kind = "stream";
    n("c1").note = "Open stream feed. Compile to Cortex source.";
    n("i1").note = "Mock loss curve. Insight from distill, not a trainer.";
    n("f1").note = "Train compile: IR for Cortex. Not a live neural net here.";
    n("g1").note = "Audit labels vs mock truth.";
    n("t1").note = "Define missing block: chat 'define block <id>'.";
    return { lab: "train", insight: "Mock train compile. Live run only on /cortex.", nodes: base.nodes, edges: base.edges };
  }
  if (lab === "infer") {
    const nodes = [
      { id: "tr", kind: "trigger", x: 24, y: 64, note: "Webhook / message. Ghost on Pages.", trigger_kind: "webhook", stream: true, source_kind: "stream", source_link: "streams.open", fetch_from: "streams.open", persona: "source" },
      { id: "n0", kind: "ingest", x: 220, y: 64, note: "Mock particle frames. Not a camera.", object_type: "images", data_point: "image_id", data_type: "string", source_kind: "place", fetch_from: "owned.images", persona: "loader" },
      { id: "e1", kind: "enhance", x: 416, y: 64, note: "Resize. File-type check in Cortex, not here.", object_type: "images", data_point: "image_id", source_kind: "local_model", source_link: "local://enhance", fetch_from: "local.model", action_type: "image.enhance", persona: "enhancer" },
      { id: "o1", kind: "ontology", x: 612, y: 64, note: "Object + PK. Studio for inventory.", object_type: "images", data_point: "image_id", persona: "modeler" },
      { id: "i1", kind: "insight", x: 808, y: 64, note: "Region mark: bent particle. Mock SVG, not CV.", region: "cx=62 cy=48 r=18 why=bent_particle", object_type: "images", persona: "analyst" },
      { id: "f1", kind: "foundry", x: 1004, y: 64, note: "Infer compile. Weights stay in Cortex.", action_type: "export_pptx", skin: "constructor", compute: "cortex", persona: "compiler" },
      { id: "a1", kind: "app", x: 1004, y: 260, note: "Skin. Engine is Cortex.", action_type: "emit", skin: "constructor", object_type: "images", persona: "operator" },
      { id: "g1", kind: "audit", x: 808, y: 260, note: "LLM-as-judge mock: label vs region. Not a live LLM on Pages.", region: "cx=62 cy=48 r=18 why=bent_particle", object_type: "images", persona: "steward" },
    ];
    const edges = [
      { from: "tr", to: "n0" },
      { from: "n0", to: "e1" },
      { from: "e1", to: "o1" },
      { from: "n0", to: "i1" },
      { from: "i1", to: "f1" },
      { from: "f1", to: "a1" },
      { from: "a1", to: "g1" },
    ];
    return { lab: "infer", insight: "Mock judge: circle bent particle. Live LLM only on /cortex.", nodes: nodes, edges: edges };
  }
  if (lab === "retrain") {
    n("n0").note = "Fresh labeled batch after judge.";
    n("c1").note = "DMS / distill place. Not a second warehouse SPA.";
    n("c1").stream = true;
    n("i1").note = "Where the judge disagreed. Feed Cortex DAG.";
    n("f1").note = "Retrain as Cortex DAG compile. Not Apache Airflow UI.";
    n("g1").note = "Gate: mock metrics. Live gate is Cortex.";
    n("t1").note = "Schedule / webhook already on trigger lab; here tool_call is the handoff.";
    return { lab: "retrain", insight: "Mock retrain DAG. No Airflow product clone.", nodes: base.nodes, edges: base.edges };
  }
  if (lab === "voice") {
    n("n0").note = "Mock audio clip. Same 8-block pipeline as image.";
    n("c1").note = "STT stub on connector. Real decode is Cortex. define block if you need a new kind.";
    n("i1").note = "Transcript insight. Distill, not a voice model on Pages.";
    n("g1").note = "Judge: transcript vs mock gold.";
    n("t1").note = "Same connectors. New block via define block <id>.";
    return { lab: "voice", insight: "Voice uses the same kinds. Missing STT = define block, then Cortex.", nodes: base.nodes, edges: base.edges };
  }
  if (lab === "image") {
    n("n0").note = "Prompt / seed image. Not a generator on Pages.";
    n("c1").note = "Generate stub. Real image model is Cortex.";
    n("i1").note = "Region: artifact in corner. Mock mark.";
    n("i1").region = "cx=80 cy=20 r=12 why=artifact";
    n("g1").note = "Judge: prompt vs mock render.";
    return { lab: "image", insight: "Image-gen lab is the same graph with honest stubs.", nodes: base.nodes, edges: base.edges };
  }
  if (lab === "warehouse") {
    n("n0").note = "SKU / batch rows. Distill to ontology.";
    n("c1").note = "DMS usage compile. OpenVault key only on /cortex.";
    n("i1").note = "Near-expiry, missing PK. Real insight from distill.";
    n("a1").note = "Pick a skin. Prebuilt = these 8 kinds, not a plugin store.";
    return { lab: "warehouse", insight: "Warehouse path: ingest -> ontology -> insight -> app.", nodes: base.nodes, edges: base.edges };
  }
  return { lab: "sample", insight: "", nodes: base.nodes, edges: base.edges };
}

function applySeed(lab) {
  const g = labGraph(lab);
  currentLab = g.lab;
  const p = playState();
  p.lab = g.lab;
  p.insight = g.insight;
  savePlay(p);
  replaceGraph(g.nodes, g.edges);
  return g.lab;
}

let currentLab = "sample";

function playState() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAY_KEY) || "null");
    if (raw && typeof raw.ticks === "number") return raw;
  } catch (e) {}
  return { ticks: 0, lab: "sample", insight: "" };
}

function savePlay(p) {
  try {
    localStorage.setItem(PLAY_KEY, JSON.stringify(p));
  } catch (e) {}
  paintPlayHud();
}

function paintPlayHud() {
  const p = playState();
  const t = document.getElementById("play-ticks");
  const l = document.getElementById("play-lab");
  const i = document.getElementById("play-insight");
  if (t) t.textContent = p.ticks + (p.ticks === 1 ? " tick" : " ticks");
  if (l) l.textContent = currentLab || p.lab || "sample";
  if (i) i.textContent = p.insight || "";
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
    const meta = KINDS[node.kind] || { label: node.kind, icon: "", persona: "", color: "#888" };
    el.className = "node" + (node.id === selectedId ? " selected" : "");
    el.dataset.id = node.id;
    el.dataset.kind = node.kind;
    el.style.left = node.x + "px";
    el.style.top = node.y + "px";
    el.style.setProperty("--kind", meta.color);
    const io = nodeIo(node);
    el.innerHTML =
      '<div class="node-head">' +
      '<span class="ico">' +
      (meta.icon || "") +
      "</span>" +
      '<div class="kind">' +
      node.kind.toUpperCase() +
      "</div>" +
      '<button type="button" class="node-edit" data-edit="1" aria-label="edit node">+</button>' +
      "</div><h2>" +
      meta.label +
      "</h2>" +
      (node.kind === "ontology"
        ? '<p class="sub">' + escapeAttr(ontologySummary(node)) + "</p>"
        : '<p class="io"><span>IN</span> ' +
          escapeAttr(io.data_in) +
          '</p><p class="io"><span>OUT</span> ' +
          escapeAttr(io.data_out) +
          "</p>") +
      '<div class="ports">' +
      '<button type="button" class="port" data-port="in" aria-label="input port"></button>' +
      '<button type="button" class="port" data-port="out" aria-label="output port"></button>' +
      "</div>";
    nodesEl.appendChild(el);
  }
  drawWires();
  showInspect();
}

function nodeCenter(id, port) {
  const node = state.nodes.find((n) => n.id === id);
  if (!node) return { x: 0, y: 0 };
  const w = 188;
  const h = 124;
  return {
    x: node.x + (port === "out" ? w - 18 : 18),
    y: node.y + h - 18,
  };
}

function drawWires() {
  let maxX = 900;
  let maxY = 640;
  for (const n of state.nodes) {
    maxX = Math.max(maxX, n.x + 240);
    maxY = Math.max(maxY, n.y + 180);
  }
  wiresEl.setAttribute("width", String(maxX));
  wiresEl.setAttribute("height", String(maxY));
  wiresEl.setAttribute("viewBox", "0 0 " + maxX + " " + maxY);
  wiresEl.setAttribute("preserveAspectRatio", "none");
  const parts = [];
  for (const edge of state.edges) {
    const a = nodeCenter(edge.from, "out");
    const b = nodeCenter(edge.to, "in");
    const mid = (a.x + b.x) / 2;
    parts.push(
      '<path fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" d="M' +
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
  applyPan();
}

function linksFor(objectType) {
  return LINKS.filter(function (row) {
    return row.from === objectType || row.to === objectType;
  }).map(function (row) {
    return row.id + " (" + row.from + " -> " + row.to + " via " + row.via + ")";
  });
}

function decisionText(node, extra) {
  extra = extra || {};
  const cortex = extra.cortex_kind || extra.kind || "";
  const write = node.kind === "tool_call" || node.kind === "app";
  const linkLines = linksFor(node.object_type);
  const appId = (state.nodes.find(function (n) {
    return n.kind === "app";
  }) || {}).id;
  const lines = [
    "PERSONA: " + (node.persona || ((KINDS[node.kind] && KINDS[node.kind].persona) || "-")),
    "DOING: " + (node.doing || node.note || node.kind),
    "ACTION: " + (node.action_type || (write ? "export_pptx" : "none (read)")),
    "APP: " + (extra.is_emit ? "this node is the EMIT app" : appId ? "downstream " + appId : "no app node yet"),
    "CODE: " + (cortex || node.kind) + (extra.tool_name ? " tool=" + extra.tool_name : ""),
    "RESPONSE: " + (extra.response || "local preview. Press for Cortex compile."),
    "OBJECT: " + (node.object_type || "-") + (node.data_point ? " · " + node.data_point : ""),
    "FETCH: " + (node.fetch_from || "-") + (node.source_kind ? " · " + node.source_kind : ""),
    "WRITE: " + (write ? "would-write if live / confirm on tool_call" : "read"),
  ];
  if (linkLines.length) lines.push("LINKS: " + linkLines.join("; "));
  return lines.join("\n");
}

function showDecision(layer) {
  const el = document.getElementById("inspect-decision");
  const node = (layer && layer.node) || state.nodes.find((n) => n.id === selectedId);
  if (!node) {
    if (el) {
      el.hidden = true;
      el.textContent = "";
    }
    return;
  }
  const text = decisionText(node, layer || {});
  if (el) {
    el.hidden = true;
    el.textContent = text;
  }
  const inspect = document.getElementById("inspect");
  if (inspect && !(layer && layer.openDialog)) inspect.scrollTop = 0;
  for (const n of nodesEl.querySelectorAll(".node")) {
    n.classList.toggle("pressed", !!(layer && layer.openDialog) && n.dataset.id === node.id);
  }
  if (layer && layer.openDialog) openCalPop(node, layer);
}

function closeCalPop() {
  calOpen = false;
  const pop = document.getElementById("cal-pop");
  if (pop) pop.hidden = true;
  for (const n of nodesEl.querySelectorAll(".node")) n.classList.remove("pressed");
}

function openCalPop(node, extra) {
  const pop = document.getElementById("cal-pop");
  if (!pop || !node) return;
  calOpen = true;
  extra = extra || {};
  const meta = KINDS[node.kind] || { label: node.kind, icon: "", persona: "", color: "#888" };
  pop.style.setProperty("--kind", meta.color);
  const icon = document.getElementById("event-icon");
  const title = document.getElementById("event-title");
  const personaEl = document.getElementById("event-persona");
  const help = document.getElementById("ingest-help");
  const hint = document.getElementById("event-actions-hint");
  const fields = document.getElementById("event-fields");
  if (icon) icon.innerHTML = meta.icon || "";
  if (title) title.textContent = meta.label;
  if (personaEl) {
    personaEl.textContent =
      (node.persona || meta.persona) + " · " + (node.doing || node.note || meta.note);
  }
  if (help) help.hidden = node.kind !== "ingest";
  const enhanceHelp = document.getElementById("enhance-help");
  if (enhanceHelp) enhanceHelp.hidden = node.kind !== "enhance";
  const triggerHelp = document.getElementById("trigger-help");
  if (triggerHelp) triggerHelp.hidden = node.kind !== "trigger";
  if (hint) hint.textContent = hintForKind(node);
  if (fields) {
    fields.innerHTML =
      eventFieldsHtml(node) +
      (node.kind === "ontology"
        ? '<button type="button" id="open-studio-node">Open Ontology Studio</button>'
        : "");
  }
  const facts = document.getElementById("decision-facts");
  const js = document.getElementById("decision-json");
  if (facts) facts.textContent = extra.cortex_kind ? decisionText(node, extra) : "";
  if (js) js.textContent = extra.raw ? JSON.stringify(extra.raw, null, 2) : "";
  const nodeEl = nodesEl.querySelector('[data-id="' + node.id + '"]');
  const r = nodeEl ? nodeEl.getBoundingClientRect() : { right: 200, top: 120, left: 32 };
  let left = r.right + 12;
  let top = r.top;
  if (left + 360 > window.innerWidth) left = Math.max(8, r.left - 364);
  if (top + 420 > window.innerHeight) top = Math.max(8, window.innerHeight - 428);
  pop.style.left = left + "px";
  pop.style.top = top + "px";
  pop.hidden = false;
}

function fieldInput(name, label, value, placeholder) {
  return (
    "<label>" +
    label +
    '</label><input name="' +
    name +
    '" value="' +
    escapeAttr(value || "") +
    '" placeholder="' +
    escapeAttr(placeholder || "") +
    '" />'
  );
}

function fieldTextarea(name, label, value, placeholder) {
  return (
    "<label>" +
    label +
    '</label><textarea name="' +
    name +
    '" rows="2" placeholder="' +
    escapeAttr(placeholder || "") +
    '">' +
    escapeAttr(value || "") +
    "</textarea>"
  );
}

function nodeIo(node) {
  const Core = globalThis.NetieConstructorCore;
  if (Core && typeof Core.nodeIo === "function") return Core.nodeIo(node);
  return { data_in: "in", data_out: "out" };
}

function ioBannerHtml(node, withTestId) {
  const io = nodeIo(node);
  return (
    '<p class="io"' +
    (withTestId ? ' data-testid="block-io"' : "") +
    "><span>IN</span> " +
    escapeAttr(io.data_in) +
    " <span>OUT</span> " +
    escapeAttr(io.data_out) +
    "</p>"
  );
}

function hintForKind(node) {
  const k = node.kind;
  if (k === "ingest") return "IN place/stream/db. OUT object rows. No write.";
  if (k === "connector") return "IN source bind. OUT typed feed. DMS places compile to Cortex, not a second SPA.";
  if (k === "trigger") return "IN webhook/schedule/message. OUT event. Live only on /cortex.";
  if (k === "ontology") return "IN object type. OUT schema + PK. Studio edits properties, links, actions.";
  if (k === "insight") return "IN object + ledger. OUT a claim. Region is a mock mark, not live CV.";
  if (k === "foundry") return "IN insights. OUT compiled Cortex app IR. Spark/Airflow-class jobs are Cortex DAG compile, not a product UI.";
  if (k === "app") return "IN compiled IR. OUT EMIT skin a stranger runs inside Cortex. Not a warehouse fetch.";
  if (k === "tool_call") return "IN object + action. OUT governed write. requires_confirm.";
  if (k === "enhance") return "IN owned image. OUT enhanced image. Ghost on Pages.";
  if (k === "audit") return "IN claim. OUT pass/fail gate. Not a second EMIT.";
  if (k === "agent") return "IN task. OUT AGENT_TASK. One worker.";
  if (k === "hypothesize") return "IN rows. OUT testable claim.";
  if (k === "improve") return "IN claim. OUT product edit.";
  return "";
}

function objectPickHtml(node, objectLabel, pointLabel) {
  const obj = node.object_type && OBJECTS[node.object_type] ? node.object_type : Object.keys(OBJECTS)[0];
  const points = OBJECTS[obj].points;
  const point = node.data_point && points[node.data_point] ? node.data_point : Object.keys(points)[0];
  const dtype = node.data_type || points[point];
  let html = fieldSelect("object_type", objectLabel, Object.keys(OBJECTS), obj);
  if (pointLabel) {
    html +=
      fieldSelect("data_point", pointLabel, Object.keys(points), point) +
      fieldSelect("data_type", "Data type", ["string", "number", "integer", "boolean", "date"], dtype);
  }
  return html;
}

function sourceBindHtml(node) {
  const sourceKind =
    node.source_kind && SOURCE_KINDS.indexOf(node.source_kind) >= 0 ? node.source_kind : "place";
  const sourceLabel = node.kind === "ingest" ? "Source place (hop 0)" : "Fetch / place";
  let html = fieldSelect("source_kind", "Source kind", SOURCE_KINDS, sourceKind);
  if (sourceKind === "cloud") {
    html +=
      '<p class="hint">Ghost cloud sign-in. No OAuth. No fetch on Pages.</p>' +
      '<button type="button" id="cloud-signin">Sign in (ghost)</button>';
  } else if (sourceKind === "database") {
    html += fieldInput("source_link", "Database link", node.source_link || "db.link", "owned.images or db.incidents");
  } else if (sourceKind === "local_model") {
    html += fieldInput("source_link", "Local model", node.source_link || "local://enhance", "local://enhance or a model path");
  } else if (sourceKind === "online_api") {
    html += fieldInput("source_link", "Online API", node.source_link || "api.enhance", "api.enhance (ghost, no fetch on Pages)");
  } else if (sourceKind === "stream") {
    html +=
      '<p class="hint">Open stream. Compiles to Cortex /dms/streams. Pages cannot stream.</p>' +
      fieldInput("source_link", "Stream id", node.source_link || "streams.open", "streams.open");
  } else {
    html += fieldSelect("fetch_from", sourceLabel, FETCH_PLACES, node.fetch_from || "warehouse.inventory");
  }
  return html;
}

function eventFieldsHtml(node) {
  const kind = node.kind;
  const persona = node.persona && PERSONAS.indexOf(node.persona) >= 0 ? node.persona : KINDS[kind].persona;
  const obj = node.object_type && OBJECTS[node.object_type] ? node.object_type : Object.keys(OBJECTS)[0];
  const allowed = actionsForObject(obj);
  const action = allowed.indexOf(node.action_type) >= 0 ? node.action_type : allowed[0];
  const skin = node.skin && SKINS.indexOf(node.skin) >= 0 ? node.skin : "constructor";
  let html = ioBannerHtml(node, true);
  if (kind === "ingest") {
    html += objectPickHtml(node, "Becomes object", "Data point") + sourceBindHtml(node);
    html += fieldSelect("stream", "Stream", ["false", "true"], node.stream ? "true" : "false");
    return html;
  }
  if (kind === "connector") {
    html += objectPickHtml(node, "Binds object", "Data point") + sourceBindHtml(node);
    html += fieldSelect("stream", "Stream", ["false", "true"], node.stream ? "true" : "false");
    return html;
  }
  if (kind === "trigger") {
    const tk =
      node.trigger_kind && TRIGGER_KINDS.indexOf(node.trigger_kind) >= 0 ? node.trigger_kind : "webhook";
    html += fieldSelect("trigger_kind", "Trigger", TRIGGER_KINDS, tk) + sourceBindHtml(node);
    return html;
  }
  if (kind === "ontology") {
    html += objectPickHtml(node, "Object type", "Primary key / point");
    return html;
  }
  if (kind === "insight") {
    html +=
      objectPickHtml(node, "Claim about object", null) +
      fieldTextarea("doing", "Claim", node.doing || node.note || "", "What you may say from the ledger") +
      fieldInput("region", "Region mark (mock)", node.region || "", "cx=62 cy=48 r=18 why=bent_particle");
    return html;
  }
  if (kind === "foundry") {
    html +=
      fieldSelect("skin", "Compile to skin", SKINS, skin) +
      fieldSelect("compute", "Compute", COMPUTE, node.compute === "cortex" ? "cortex" : "cortex") +
      '<p class="hint">Spark / Airflow-class work is a Cortex DAG. No Airflow UI here.</p>' +
      fieldSelect("action_type", "Handoff action", allowed, action);
    return html;
  }
  if (kind === "app") {
    html +=
      fieldSelect("skin", "App skin", SKINS, skin) +
      objectPickHtml(node, "Primary object on the app", null) +
      fieldTextarea("doing", "What a stranger can do", node.doing || node.note || "", "Emit inside Cortex. Not a fetch.");
    return html;
  }
  if (kind === "tool_call") {
    html +=
      objectPickHtml(node, "Object", "Data point") +
      fieldSelect("action_type", "Action", allowed, action) +
      '<p class="hint">requires_confirm. define block &lt;id&gt; adds a new action.</p>';
    return html;
  }
  if (kind === "enhance") {
    html += objectPickHtml(node, "Image object", "Data point") + sourceBindHtml(node);
    html += fieldSelect("action_type", "Action", ["image.enhance"], "image.enhance");
    return html;
  }
  if (kind === "audit") {
    html +=
      objectPickHtml(node, "Gate on object", null) +
      fieldTextarea("doing", "Gate", node.doing || node.note || "", "Pass / fail rule") +
      fieldInput("region", "Region mark (mock)", node.region || "", "cx=62 cy=48 r=18 why=false");
    return html;
  }
  if (kind === "agent") {
    html +=
      fieldSelect("persona", "Persona", PERSONAS, persona) +
      fieldTextarea("doing", "Task", node.doing || node.note || "", "One bounded AGENT_TASK") +
      objectPickHtml(node, "Works on object", null) +
      fieldSelect("tier", "Router tier", TIERS, TIERS.indexOf(node.tier) >= 0 ? node.tier : "T0");
    return html;
  }
  if (kind === "hypothesize") {
    html +=
      objectPickHtml(node, "Claim about object", null) +
      fieldTextarea("doing", "Hypothesis", node.doing || node.note || "", "Testable claim");
    return html;
  }
  if (kind === "improve") {
    html +=
      objectPickHtml(node, "Object", null) +
      fieldSelect("action_type", "Action", allowed, action) +
      fieldTextarea("doing", "Change", node.doing || node.note || "", "What to edit");
    return html;
  }
  html += fieldSelect("persona", "Persona", PERSONAS, persona);
  return html;
}

function parseRegion(spec) {
  const out = {};
  String(spec || "")
    .split(/\s+/)
    .forEach(function (part) {
      const i = part.indexOf("=");
      if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
    });
  return out;
}

function regionMarkHtml(spec) {
  const r = parseRegion(spec);
  const cx = Number(r.cx);
  const cy = Number(r.cy);
  const rad = Number(r.r);
  const why = r.why || "mark";
  return (
    '<div class="region-mark" data-testid="region-mark" title="' +
    escapeAttr(why) +
    '"><svg viewBox="0 0 100 70" width="120" height="84" aria-label="' +
    escapeAttr(why) +
    '"><rect x="0" y="0" width="100" height="70" fill="#111" stroke="rgba(255,255,255,0.12)"/><circle class="region-ring" cx="' +
    (isFinite(cx) ? cx : 62) +
    '" cy="' +
    (isFinite(cy) ? cy : 48) +
    '" r="' +
    (isFinite(rad) ? rad : 16) +
    '" fill="none" stroke="#f2a3a3" stroke-width="2"/><text x="4" y="12" fill="#f2a3a3" font-size="8">' +
    escapeAttr(why) +
    '</text></svg><p class="hint">Mock circle. Not a live CV/LLM judge on Pages.</p></div>'
  );
}

function showInspect() {
  const node = state.nodes.find((n) => n.id === selectedId);
  if (!node) {
    inspectJson.hidden = true;
    inspectForm.hidden = true;
    if (inspectCard) inspectCard.hidden = true;
    inspectEmpty.hidden = false;
    showDecision(null);
    return;
  }
  inspectEmpty.hidden = true;
  inspectForm.hidden = true;
  const meta = KINDS[node.kind] || { label: node.kind, icon: "", persona: "", color: "#888", note: "" };
  const persona = node.persona || meta.persona;
  if (inspectCard) {
    inspectCard.hidden = false;
    inspectCard.style.setProperty("--kind", meta.color);
    inspectCard.innerHTML =
      '<div class="inspect-card-head"><span class="ico">' +
      (meta.icon || "") +
      "</span><div><div class=\"eyebrow\">" +
      escapeAttr(persona) +
      "</div><h3>" +
      meta.label +
      "</h3></div></div>" +
      ioBannerHtml(node) +
      '<p class="doing">' +
      escapeAttr(node.doing || node.note || meta.note) +
      "</p>" +
      '<p class="hint">' +
      escapeAttr(hintForKind(node)) +
      "</p>" +
      (node.region ? regionMarkHtml(node.region) : "") +
      (node.kind === "ontology"
        ? '<p class="hint">' + escapeAttr(ontologySummary(node)) + "</p>" + objectChipsHtml(node)
        : "") +
      '<button type="button" id="press-decision">Edit node</button>' +
      (node.kind === "ontology"
        ? ' <button type="button" id="inspect-open-studio">Open Ontology Studio</button>'
        : "");
    const press = document.getElementById("press-decision");
    if (press) {
      press.addEventListener("click", function (event) {
        event.preventDefault();
        if (window.Constructor && window.Constructor.pressNode) window.Constructor.pressNode();
      });
    }
    const studioBtn = document.getElementById("inspect-open-studio");
    if (studioBtn) {
      studioBtn.addEventListener("click", function (event) {
        event.preventDefault();
        openOntologyStudio();
      });
    }
    inspectCard.querySelectorAll("[data-pick-object]").forEach(function (chip) {
      chip.addEventListener("click", function (event) {
        event.preventDefault();
        const id = chip.getAttribute("data-pick-object");
        if (event.altKey || event.detail === 2) {
          openOntologyStudio({ objectType: id });
          return;
        }
        patchSelected("object_type", id);
      });
    });
  }
  showDecision({ node: node, response: "local preview. Press to edit." });
}

/* Compact object browser for the ontology node: one chip per object type with its
   property and link counts. Click binds the node; double-click opens the studio there. */
function objectChipsHtml(node) {
  const ids = Object.keys(OBJECTS);
  if (!ids.length) return "";
  const O = ontologyModel();
  const chips = ids
    .map(function (id) {
      const nprops = Object.keys(OBJECTS[id].points || {}).length;
      const nlinks = LINKS.filter(function (l) {
        return l.from === id || l.to === id;
      }).length;
      const color = O && O.get().objectTypes[id] ? O.get().objectTypes[id].color : "";
      return (
        '<button type="button" class="obj-chip' +
        (node.object_type === id ? " on" : "") +
        '" data-pick-object="' +
        escapeAttr(id) +
        '" title="' +
        nprops +
        " properties · " +
        nlinks +
        ' links. Double-click opens the studio."' +
        (color ? ' style="--kind:' + escapeAttr(color) + '"' : "") +
        ">" +
        escapeAttr(id) +
        '<span class="obj-chip-n">' +
        nprops +
        "·" +
        nlinks +
        "</span></button>"
      );
    })
    .join("");
  return '<div class="obj-chips" aria-label="object types">' + chips + "</div>";
}

function fieldSelect(name, label, values, current) {
  return (
    "<label>" +
    label +
    '</label><select name="' +
    name +
    '">' +
    values
      .map(function (v) {
        return (
          '<option value="' +
          v +
          '"' +
          (v === current ? " selected" : "") +
          ">" +
          v +
          "</option>"
        );
      })
      .join("") +
    "</select>"
  );
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function patchSelected(field, value) {
  const node = state.nodes.find((n) => n.id === selectedId);
  if (!node) return false;
  if (field === "stream") node.stream = value === true || value === "true";
  else node[field] = value;
  if (field === "doing") node.note = value;
  if (field === "object_type" && OBJECTS[value]) {
    const first = Object.keys(OBJECTS[value].points)[0];
    node.data_point = first;
    node.data_type = OBJECTS[value].points[first];
  }
  if (field === "data_point" && OBJECTS[node.object_type] && OBJECTS[node.object_type].points[value]) {
    node.data_type = OBJECTS[node.object_type].points[value];
  }
  if (field === "source_kind") {
    if (value === "cloud") {
      node.fetch_from = "cloud.signed_in";
      if (!node.source_link) node.source_link = "";
    } else if (value === "database") {
      node.fetch_from = node.source_link || "db.link";
    } else if (value === "local_model") {
      node.fetch_from = "local.model";
      if (!node.source_link) node.source_link = "local://enhance";
    } else if (value === "online_api") {
      node.fetch_from = "api.enhance";
      if (!node.source_link) node.source_link = "api.enhance";
    } else if (value === "stream") {
      node.fetch_from = node.source_link || "streams.open";
      node.stream = true;
    } else if (
      node.fetch_from === "cloud.signed_in" ||
      node.fetch_from === "db.link" ||
      node.fetch_from === "local.model" ||
      node.fetch_from === "api.enhance" ||
      node.fetch_from === "streams.open"
    ) {
      node.fetch_from =
        node.object_type === "incidents"
          ? "db.incidents"
          : node.object_type === "images"
            ? "owned.images"
            : "warehouse.inventory";
    }
  }
  if (field === "source_link" && (node.source_kind === "database" || node.source_kind === "local_model" || node.source_kind === "online_api" || node.source_kind === "stream")) {
    if (node.source_kind === "database") node.fetch_from = value || "db.link";
    if (node.source_kind === "stream") node.fetch_from = value || "streams.open";
  }
  if (node.kind === "trigger" && (field === "trigger_kind" || field === "source_kind")) {
    node.doing =
      (node.trigger_kind || "webhook") +
      " trigger. Ghost on Pages. Live only on /cortex.";
    node.note = node.doing;
    node.stream = true;
  }
  if (node.kind === "ingest" && (field === "object_type" || field === "fetch_from" || field === "source_kind")) {
    node.doing =
      "Hop 0. Load " +
      (node.object_type || "object") +
      " rows from " +
      (node.fetch_from || "place") +
      ". No write.";
    node.note = node.doing;
  }
  if (node.kind === "enhance" && (field === "source_kind" || field === "source_link")) {
    node.doing =
      "Comfy-style enhance via " +
      (node.source_kind || "local_model") +
      " " +
      (node.source_link || node.fetch_from || "") +
      ". Ghost on Pages.";
    node.note = node.doing;
    node.action_type = "image.enhance";
  }
  save();
  render();
  if (calOpen) {
    const next = state.nodes.find((n) => n.id === selectedId);
    if (next) openCalPop(next, { response: "saved" });
  }
  return true;
}

inspectForm.addEventListener("change", (event) => {
  const el = event.target;
  if (!el || !el.name) return;
  patchSelected(el.name, el.value);
});

const eventForm = document.getElementById("event-form");
if (eventForm) {
  eventForm.addEventListener("submit", function (event) {
    event.preventDefault();
  });
  eventForm.addEventListener("change", function (event) {
    const el = event.target;
    if (!el || !el.name) return;
    patchSelected(el.name, el.value);
  });
  eventForm.addEventListener("click", function (event) {
    if (event.target && event.target.id === "open-studio-node") {
      event.preventDefault();
      openOntologyStudio();
      return;
    }
    if (!event.target || event.target.id !== "cloud-signin") return;
    event.preventDefault();
    const node = state.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    node.source_kind = "cloud";
    node.fetch_from = "cloud.signed_in";
    node.source_link = "signed-in";
    if (node.kind === "ingest") {
      node.doing =
        "Hop 0. Load " + (node.object_type || "object") + " rows from cloud.signed_in. No write.";
      node.note = node.doing;
    }
    save();
    render();
    openCalPop(node, { response: "cloud signed-in (ghost)" });
  });
}
const eventClose = document.getElementById("event-close");
if (eventClose) eventClose.addEventListener("click", closeCalPop);
document.addEventListener("pointerdown", function (event) {
  const pop = document.getElementById("cal-pop");
  if (!calOpen || !pop || pop.hidden) return;
  if (pop.contains(event.target)) return;
  if (event.target.closest && (event.target.closest(".node-edit") || event.target.closest("#press-decision"))) {
    return;
  }
  closeCalPop();
});

document.querySelectorAll("[data-add]").forEach((btn) => {
  const kind = btn.getAttribute("data-add");
  const meta = KINDS[kind];
  if (meta) {
    btn.style.setProperty("--kind", meta.color);
    btn.setAttribute("aria-label", meta.label);
    btn.innerHTML = '<span class="ico" aria-hidden="true">' + meta.icon + "</span>" + meta.label;
  }
  btn.addEventListener("click", () => {
    const node = seedNode(kind);
    state.nodes.push(node);
    selectedId = node.id;
    save();
    render();
    openCalPop(node);
  });
});

document.querySelectorAll("[data-seed]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    applySeed(btn.getAttribute("data-seed"));
    if (window.Constructor && window.Constructor.setGhost) window.Constructor.setGhost(true);
  });
});

nodesEl.addEventListener("pointerdown", (event) => {
  const nodeEl = event.target.closest(".node");
  if (!nodeEl) return;
  const port = event.target.closest(".port");
  const id = nodeEl.dataset.id;
  selectedId = id;

  const edit = event.target.closest("[data-edit]");
  if (event.detail === 2 && !port) {
    event.stopPropagation();
    showInspect();
    if (window.Constructor && window.Constructor.pressNode) window.Constructor.pressNode();
    return;
  }
  if (edit) {
    event.stopPropagation();
    showInspect();
    if (window.Constructor && window.Constructor.pressNode) window.Constructor.pressNode();
    return;
  }

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

  if (spaceDown || event.button === 1) return;

  const worldPt = screenToWorld(event.clientX, event.clientY);
  const node = state.nodes.find((n) => n.id === id);
  drag = {
    id,
    dx: worldPt.x - (node ? node.x : 0),
    dy: worldPt.y - (node ? node.y : 0),
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
  const worldPt = screenToWorld(event.clientX, event.clientY);
  node.x = Math.max(8, worldPt.x - drag.dx);
  node.y = Math.max(8, worldPt.y - drag.dy);
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
  const O = ontologyModel();
  const payload = Object.assign({}, state, { ontology: O ? O.get() : null });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
  currentLab = "sample";
  const p = playState();
  p.lab = "sample";
  p.insight = "";
  savePlay(p);
  localStorage.removeItem(STORAGE_KEY);
  save();
  render();
});

window.addEventListener("resize", drawWires);

(function bindPanZoom() {
  const stage = document.getElementById("stage");
  if (!stage) return;

  stage.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const oldK = pan.k;
      const next = Math.min(2.5, Math.max(0.35, oldK * (event.deltaY > 0 ? 0.92 : 1.08)));
      const wx = (mx - pan.x) / oldK;
      const wy = (my - pan.y) / oldK;
      pan.k = next;
      pan.x = mx - wx * next;
      pan.y = my - wy * next;
      applyPan();
    },
    { passive: false }
  );

  document.addEventListener("keydown", function (event) {
    if (event.code !== "Space" || event.repeat) return;
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
    event.preventDefault();
    spaceDown = true;
    stage.classList.add("panning");
  });
  document.addEventListener("keyup", function (event) {
    if (event.code !== "Space") return;
    spaceDown = false;
    if (!panning) stage.classList.remove("panning");
  });

  stage.addEventListener("pointerdown", function (event) {
    if (event.target.closest && event.target.closest(".node")) {
      if (event.button !== 1 && !spaceDown) return;
    }
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    panning = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    stage.classList.add("panning");
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", function (event) {
    if (!panning) return;
    pan.x = event.clientX - panning.x;
    pan.y = event.clientY - panning.y;
    applyPan();
  });
  stage.addEventListener("pointerup", function () {
    panning = null;
    if (!spaceDown) stage.classList.remove("panning");
  });
  stage.addEventListener("pointercancel", function () {
    panning = null;
    if (!spaceDown) stage.classList.remove("panning");
  });
})();

function cortexOrigin() {
  const Core = globalThis.NetieConstructorCore;
  if (Core && Core.cortexOriginFrom) {
    return Core.cortexOriginFrom(location.hostname, location.pathname);
  }
  const host = location.hostname;
  const path = location.pathname;
  if (host === "app.netie.ai" && path.indexOf("/cortex") === 0) return true;
  if ((host === "127.0.0.1" || host === "localhost") && path.indexOf("/cortex") === 0) {
    return true;
  }
  return false;
}

function addNode(kind, x, y) {
  if (!KINDS[kind]) return null;
  const node = seedNode(kind, x, y);
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
  if (ids && ids.length) {
    const p = playState();
    p.ticks += 1;
    savePlay(p);
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

function replaceGraph(nodes, edges) {
  if (!Array.isArray(nodes) || !nodes.length) return false;
  state.nodes = nodes;
  state.edges = Array.isArray(edges) ? edges : [];
  selectedId = state.nodes[0].id;
  save();
  render();
  fitView();
  return true;
}

(function bindFit() {
  const btn = document.getElementById("fit-view");
  if (btn) {
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      fitView();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key !== "f" || event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = (event.target && event.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
    if (window.OntologyStudio && window.OntologyStudio.isOpen && window.OntologyStudio.isOpen()) return;
    fitView();
  });
})();

function ensureKinds(kinds) {
  for (const kind of kinds) {
    if (!state.nodes.some((n) => n.kind === kind)) addNode(kind);
  }
}

function replaceCatalog(objects, actions, places) {
  const O = ontologyModel();
  if (O && typeof O.importJSON === "function") {
    const res = O.importJSON(
      JSON.stringify({ objects: objects || {}, actions: actions || [], fetch_places: places || [] })
    );
    if (res && res.ok) {
      syncCatalog();
      render();
      return;
    }
  }
  Object.keys(objects || {}).forEach(function (k) {
    OBJECTS[k] = objects[k];
  });
  if (Array.isArray(actions) && actions.length) {
    for (let i = 0; i < actions.length; i++) {
      if (ACTIONS.indexOf(actions[i]) < 0) ACTIONS.push(actions[i]);
    }
  }
  if (Array.isArray(places) && places.length) {
    for (let i = 0; i < places.length; i++) {
      if (FETCH_PLACES.indexOf(places[i]) < 0) FETCH_PLACES.push(places[i]);
    }
  }
  render();
}

function loadChatDock() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_DOCK_KEY) || "null");
    if (raw && (raw.snap === "bottom" || raw.snap === "right")) {
      return { open: !!raw.open, snap: raw.snap };
    }
  } catch (err) {}
  return { open: true, snap: "right" };
}

const chatDock = loadChatDock();

function applyChatDock() {
  document.body.classList.toggle("chat-open", chatDock.open);
  document.body.classList.toggle("chat-snap-right", chatDock.snap === "right");
  document.body.classList.toggle("chat-snap-bottom", chatDock.snap === "bottom");
  const fab = document.getElementById("chat-fab");
  const toggle = document.getElementById("chat-toggle");
  const bottom = document.getElementById("chat-snap-bottom");
  const right = document.getElementById("chat-snap-right");
  if (fab) fab.hidden = chatDock.open;
  if (toggle) {
    toggle.textContent = chatDock.open ? "Hide chat" : "Chat";
    toggle.classList.toggle("on", chatDock.open);
  }
  if (bottom) bottom.classList.toggle("on", chatDock.snap === "bottom");
  if (right) right.classList.toggle("on", chatDock.snap === "right");
  try {
    localStorage.setItem(CHAT_DOCK_KEY, JSON.stringify(chatDock));
  } catch (err) {}
  drawWires();
}

function setChatDock(next) {
  if (next.open != null) chatDock.open = !!next.open;
  if (next.snap === "bottom" || next.snap === "right") chatDock.snap = next.snap;
  applyChatDock();
  if (chatDock.open) {
    const input = document.getElementById("chat-input");
    if (input) input.focus();
  }
}

function toggleChatDock() {
  setChatDock({ open: !chatDock.open });
}

function ensureChatOpen() {
  if (!chatDock.open) setChatDock({ open: true });
}

(function bindChatDock() {
  applyChatDock();
  const fab = document.getElementById("chat-fab");
  const toggle = document.getElementById("chat-toggle");
  const close = document.getElementById("chat-close");
  const bottom = document.getElementById("chat-snap-bottom");
  const right = document.getElementById("chat-snap-right");
  if (fab) fab.addEventListener("click", toggleChatDock);
  if (toggle) toggle.addEventListener("click", toggleChatDock);
  if (close) close.addEventListener("click", function () { setChatDock({ open: false }); });
  if (bottom) bottom.addEventListener("click", function () { setChatDock({ open: true, snap: "bottom" }); });
  if (right) right.addEventListener("click", function () { setChatDock({ open: true, snap: "right" }); });
  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "/") {
      event.preventDefault();
      toggleChatDock();
      return;
    }
    if (event.key !== "Escape") return;
    if (calOpen) {
      closeCalPop();
      return;
    }
    if (chatDock.open) setChatDock({ open: false });
  });
})();

(function bindOntology() {
  const openBtn = document.getElementById("open-ontology");
  const hdrBtn = document.getElementById("ontology-btn");
  function onOpen(event) {
    event.preventDefault();
    if (!openOntologyStudio()) {
      const power = document.getElementById("power");
      if (power) power.textContent = "Ontology Studio did not load. Refresh the page.";
    }
  }
  if (openBtn) openBtn.addEventListener("click", onOpen);
  if (hdrBtn) hdrBtn.addEventListener("click", onOpen);
  const O = ontologyModel();
  if (!O || typeof O.subscribe !== "function") return;
  O.subscribe(function () {
    syncCatalog();
    for (const node of state.nodes) {
      if (node.object_type && !OBJECTS[node.object_type]) continue;
      if (
        node.object_type &&
        node.data_point &&
        OBJECTS[node.object_type] &&
        !OBJECTS[node.object_type].points[node.data_point]
      ) {
        const first = Object.keys(OBJECTS[node.object_type].points)[0];
        node.data_point = first || "";
        node.data_type = first ? OBJECTS[node.object_type].points[first] : "";
      }
    }
    save();
    render();
    if (calOpen) {
      const next = state.nodes.find((n) => n.id === selectedId);
      if (next) openCalPop(next, { response: "ontology rev " + O.get().revision });
    }
  });
})();

window.Constructor = {
  KINDS,
  OBJECTS,
  ACTIONS,
  FETCH_PLACES,
  LINKS,
  PERSONAS,
  ACTION_META,
  SOURCE_KINDS,
  TRIGGER_KINDS,
  SKINS,
  ghost: true,
  automate: false,
  getState: () => state,
  selected: () => state.nodes.find((n) => n.id === selectedId) || null,
  addNode,
  wire,
  setGhost,
  showAudit,
  showDecision,
  decisionText,
  openCalPop,
  closeCalPop,
  markGhostWalk,
  loadFoundryPath,
  replaceGraph,
  applySeed,
  ensureKinds,
  patchSelected,
  replaceCatalog,
  syncCatalog,
  openOntologyStudio,
  ontologySummary,
  fitView,
  selectedId: () => selectedId,
  render,
  save,
  setChatDock,
  toggleChatDock,
  ensureChatOpen,
};

const power = document.getElementById("power");
if (power) {
  power.textContent = cortexOrigin()
    ? "Powered by Cortex. Paste or issue an OpenVault ov_ key, then fetch / run all. Ghost is dry-run."
    : "Sketch (no fetch). Live run needs http://127.0.0.1:8010/cortex with OpenVault on :5000.";
}
const keyBox = document.getElementById("cortex-key");
if (keyBox && !cortexOrigin()) keyBox.hidden = true;

setGhost(true);
paintPlayHud();
render();
