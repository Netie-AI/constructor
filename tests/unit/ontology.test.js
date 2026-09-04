// Unit tests for ontology.js (pure model). Run: node --test tests/unit/
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const O = require(path.join(__dirname, "..", "..", "ontology.js"));

// app.js catalog the seed must mirror (ids only; keep in sync with app.js OBJECTS / LINKS / ACTION_META).
const APP_OBJECTS = ["inventory", "suppliers", "locations", "places", "venues", "contacts", "leads", "incidents", "images", "suspects", "matches"];
const APP_LINKS = [
  "inventory_supplier",
  "inventory_location",
  "venue_at_place",
  "contact_at_venue",
  "lead_of_contact",
  "incident_at_location",
  "image_at_location",
  "suspect_image",
  "match_of_image",
  "match_of_suspect",
];
const APP_ACTIONS = ["export_pptx", "item.intake", "agent.checked", "image.enhance", "suspect.match"];

function fresh() {
  const r = O.reset();
  assert.equal(r.ok, true, "reset ok");
  return O.get();
}

function codes(v) {
  return v.errors.map((e) => e.code);
}

test("seed validates with zero errors and zero warnings", () => {
  fresh();
  const v = O.validate();
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.warnings, []);
  assert.equal(v.ok, true);
});

test("toCatalog mirrors app.js objects, links, actions", () => {
  fresh();
  const cat = O.toCatalog();
  for (const id of APP_OBJECTS) assert.ok(cat.objects[id], "object " + id);
  assert.ok(Object.keys(cat.objects).length >= 11);
  assert.equal(cat.objects.inventory.points.sku, "string");
  assert.equal(cat.objects.inventory.points.quantity_kg, "number");
  assert.equal(cat.objects.inventory.points.is_hazardous, "boolean");
  assert.equal(cat.objects.inventory.points.last_restocked, "date");
  const linkIds = cat.links.map((l) => l.id);
  for (const id of APP_LINKS) assert.ok(linkIds.includes(id), "link " + id);
  for (const id of APP_ACTIONS) assert.ok(cat.actions.includes(id), "action " + id);
  assert.ok(cat.fetch_places.includes("warehouse.inventory"));
  assert.ok(cat.fetch_places.includes("owned.watchlist"));
  const meta = cat.action_meta.find((m) => m.id === "item.intake");
  assert.deepEqual(meta.objects, ["inventory"]);
  assert.equal(meta.label, "item.intake (inventory)");
});

test("catalog maps native-only types to Cortex types", () => {
  fresh();
  const cat = O.toCatalog();
  assert.equal(cat.objects.transactions.points.at, "date", "datetime -> date");
  O.addProperty("inventory", "geo_point", { type: "geo" });
  O.addProperty("inventory", "meta", { type: "json" });
  const next = O.toCatalog();
  assert.equal(next.objects.inventory.points.geo_point, "string");
  assert.equal(next.objects.inventory.points.meta, "string");
});

test("addProperty then propertyType; revision bumps; changelog appends", () => {
  const before = fresh().revision;
  const r = O.addProperty("inventory", "batch_no", { type: "string" });
  assert.equal(r.ok, true);
  assert.equal(O.propertyType("inventory", "batch_no"), "string");
  assert.equal(O.get().revision, before + 1);
  const last = O.get().changelog[O.get().changelog.length - 1];
  assert.equal(last.op, "add");
  assert.equal(last.path, "objectTypes.inventory.properties.batch_no");
  assert.equal(last.after.id, "batch_no");
});

test("removing the primary key yields OBJ_NO_PRIMARY_KEY as the only error", () => {
  fresh();
  const r = O.removeProperty("inventory", "sku");
  assert.equal(r.ok, true);
  const v = O.validate();
  assert.deepEqual(codes(v), ["OBJ_NO_PRIMARY_KEY"]);
  assert.match(v.errors[0].message, /inventory/);
  assert.equal(v.errors[0].path, "objectTypes.inventory");
});

test("dangling link endpoints and via are errors", () => {
  fresh();
  assert.equal(O.addLinkType("inventory_ghost", { from: "inventory", to: "ghosts", via: "ghost_id" }).ok, true);
  let v = O.validate();
  assert.ok(codes(v).includes("LINK_DANGLING_TO"));
  assert.ok(codes(v).includes("LINK_VIA_MISSING"));
  O.removeLinkType("inventory_ghost");
  assert.equal(O.addLinkType("ghost_inventory", { from: "ghosts", to: "inventory", via: "sku" }).ok, true);
  v = O.validate();
  assert.ok(codes(v).includes("LINK_DANGLING_FROM"));
});

test("via type mismatch is a warning, duplicate link is a warning", () => {
  fresh();
  O.updateProperty("inventory", "supplier_id", { type: "integer" });
  let v = O.validate();
  assert.ok(v.warnings.some((w) => w.code === "LINK_VIA_TYPE_MISMATCH"));
  O.undo();
  O.addLinkType("inventory_supplier_dup", { from: "inventory", to: "suppliers", via: "supplier_id" });
  v = O.validate();
  assert.ok(v.warnings.some((w) => w.code === "LINK_DUPLICATE"));
});

test("ref property must point at an existing object", () => {
  fresh();
  assert.equal(O.addProperty("inventory", "owner", { type: "ref", ref: "nobody" }).ok, true);
  assert.ok(codes(O.validate()).includes("PROP_REF_DANGLING"));
  O.updateProperty("inventory", "owner", { ref: "suppliers" });
  assert.equal(O.validate().ok, true);
});

test("invalid ids are rejected before commit", () => {
  const rev = fresh().revision;
  assert.equal(O.addObjectType("Bad Id", {}).ok, false);
  assert.equal(O.addObjectType("1abc", {}).ok, false);
  assert.equal(O.addProperty("inventory", "Bad-Prop", {}).ok, false);
  assert.equal(O.addLinkType("x y", { from: "inventory", to: "suppliers" }).ok, false);
  assert.equal(O.addActionType("nope!", {}).ok, false);
  assert.equal(O.addProperty("inventory", "sku", {}).ok, false, "duplicate property");
  assert.equal(O.addProperty("inventory", "weird", { type: "blob" }).ok, false, "bad type");
  assert.equal(O.get().revision, rev, "no revision bump on refusal");
});

test("addObjectType without properties gets an id primary key and validates", () => {
  fresh();
  const r = O.addObjectType("pallets", { label: "Pallets" });
  assert.equal(r.ok, true);
  const t = O.get().objectTypes.pallets;
  assert.equal(t.primaryKey, "id");
  assert.ok(t.properties.id);
  const v = O.validate();
  assert.equal(v.ok, true);
  assert.ok(v.infos.some((i) => i.code === "OBJ_ORPHAN" && i.path === "objectTypes.pallets"));
});

test("removeObjectType cascades links, actions, places, refs", () => {
  fresh();
  O.addProperty("shipments", "stock", { type: "ref", ref: "inventory" });
  assert.equal(O.removeObjectType("inventory").ok, true);
  const o = O.get();
  assert.equal(o.linkTypes.inventory_supplier, undefined);
  assert.equal(o.linkTypes.txn_sku, undefined);
  assert.equal(o.fetchPlaces["warehouse.inventory"], undefined);
  assert.ok(!o.actionTypes["item.intake"].objects.includes("inventory"));
  assert.equal(o.objectTypes.shipments.properties.stock.type, "string");
  assert.ok(codes(O.validate()).includes("ACTION_NO_OBJECTS"));
});

test("renameObjectType and renameProperty keep links and keys consistent", () => {
  fresh();
  assert.equal(O.renameObjectType("suppliers", "vendors").ok, true);
  assert.equal(O.get().linkTypes.inventory_supplier.to, "vendors");
  assert.equal(O.get().fetchPlaces["warehouse.suppliers"].object, "vendors");
  assert.equal(O.renameProperty("inventory", "supplier_id", "vendor_id").ok, true);
  assert.equal(O.get().linkTypes.inventory_supplier.via, "vendor_id");
  assert.equal(O.renameProperty("inventory", "sku", "code").ok, true);
  assert.equal(O.get().objectTypes.inventory.primaryKey, "code");
  assert.equal(O.validate().ok, true);
});

test("undo and redo restore revision and content", () => {
  const rev = fresh().revision;
  O.addProperty("inventory", "batch_no", { type: "string" });
  assert.equal(O.canUndo(), true);
  assert.equal(O.undo(), true);
  assert.equal(O.get().revision, rev);
  assert.equal(O.propertyType("inventory", "batch_no"), null);
  assert.equal(O.canRedo(), true);
  assert.equal(O.redo(), true);
  assert.equal(O.get().revision, rev + 1);
  assert.equal(O.propertyType("inventory", "batch_no"), "string");
  assert.equal(O.redo(), false);
});

test("diff detects add, remove, update", () => {
  fresh();
  const a = JSON.parse(O.exportJSON());
  O.addProperty("inventory", "batch_no", { type: "string" });
  O.removeLinkType("alert_sku");
  O.updateObjectType("suppliers", { label: "Vendors" });
  const b = O.get();
  const d = O.diff(a, b);
  assert.ok(d.some((x) => x.op === "add" && x.path === "objectTypes.inventory.properties.batch_no"));
  assert.ok(d.some((x) => x.op === "remove" && x.path === "linkTypes.alert_sku"));
  assert.ok(d.some((x) => x.op === "update" && x.path === "objectTypes.suppliers.label" && x.after === "Vendors"));
});

test("exportTurtle has one owl:Class per object plus links and properties", () => {
  fresh();
  const ttl = O.exportTurtle();
  assert.ok(ttl.includes("owl:Class"));
  assert.ok(ttl.includes("owl:DatatypeProperty"));
  assert.ok(ttl.includes("owl:ObjectProperty"));
  for (const id of APP_OBJECTS) assert.ok(ttl.includes("netie:" + id + " a owl:Class"), "class " + id);
  assert.ok(ttl.includes("rdfs:subClassOf netie:Locatable"));
  assert.ok(ttl.includes("netie:inventory_supplier a owl:ObjectProperty"));
});

test("exportJSONLD parses with @context and @graph", () => {
  fresh();
  const ld = JSON.parse(O.exportJSONLD());
  assert.ok(ld["@context"].netie);
  assert.ok(ld["@context"].owl);
  assert.equal(ld["@type"], "owl:Ontology");
  assert.ok(Array.isArray(ld["@graph"]));
  const cls = ld["@graph"].find((n) => n["@id"] === "netie:inventory");
  assert.equal(cls["@type"], "owl:Class");
  assert.equal(cls["netie:primaryKey"], "sku");
});

test("importJSON of exportJSON round-trips (ignoring changelog)", () => {
  fresh();
  O.addProperty("inventory", "batch_no", { type: "string", pii: true });
  const text = O.exportJSON();
  const before = JSON.parse(text);
  fresh();
  const r = O.importJSON(text);
  assert.equal(r.ok, true);
  const after = O.get();
  for (const col of ["objectTypes", "linkTypes", "actionTypes", "interfaces", "fetchPlaces"]) {
    assert.deepEqual(after[col], before[col], col);
  }
  assert.equal(after.name, before.name);
});

test("importJSON of a Cortex catalog works and keeps known links", () => {
  fresh();
  const catalog = {
    objects: {
      inventory: { points: { sku: "string", qty: "number" } },
      suppliers: { points: { supplier_id: "string", name: "string" } },
      widgets: { points: { widget_id: "string", size: "weird" } },
    },
    actions: ["export_pptx", "widget.spin"],
    fetch_places: ["warehouse.inventory", "warehouse.widgets"],
  };
  const r = O.importJSON(JSON.stringify(catalog));
  assert.equal(r.ok, true);
  const o = O.get();
  assert.deepEqual(Object.keys(o.objectTypes), ["inventory", "suppliers", "widgets"]);
  assert.equal(o.objectTypes.widgets.properties.size.type, "string", "unknown type -> string");
  assert.equal(o.objectTypes.inventory.primaryKey, "sku");
  assert.equal(o.linkTypes.inventory_location, undefined, "link to dropped object is gone");
  assert.equal(o.linkTypes.inventory_supplier.via, "supplier_id", "link with missing via still listed");
  assert.ok(o.actionTypes["widget.spin"]);
  assert.equal(o.fetchPlaces["warehouse.widgets"].object, "widgets");
  const v = O.validate();
  assert.ok(codes(v).includes("LINK_VIA_MISSING"), "via supplier_id missing after import is flagged");
  assert.equal(O.importJSON("{not json").ok, false);
  assert.equal(O.importJSON('{"hello":1}').ok, false);
});

test("subscribe fires with the change and unsubscribe stops it", () => {
  fresh();
  const seen = [];
  const off = O.subscribe((o, change) => seen.push(change.op + ":" + change.path));
  O.addProperty("inventory", "batch_no", { type: "string" });
  O.undo();
  off();
  O.addProperty("inventory", "batch_no", { type: "string" });
  assert.deepEqual(seen, ["add:objectTypes.inventory.properties.batch_no", "undo:"]);
});

test("actionsForObject and linksFor", () => {
  fresh();
  const acts = O.actionsForObject("inventory");
  assert.ok(acts.includes("item.intake"));
  assert.ok(acts.includes("export_pptx"));
  assert.ok(acts.includes("agent.checked"));
  assert.ok(!acts.includes("suspect.match"));
  const links = O.linksFor("suppliers").map((l) => l.id).sort();
  assert.deepEqual(links, ["inventory_supplier", "shipment_supplier"]);
});

test("interfaces: unimplemented and dangling are flagged", () => {
  fresh();
  O.updateObjectType("locations", { interfaces: ["Locatable", "Ghost"] });
  let v = O.validate();
  assert.ok(codes(v).includes("IFACE_DANGLING"));
  O.undo();
  O.removeProperty("places", "latitude");
  v = O.validate();
  assert.ok(v.warnings.some((w) => w.code === "IFACE_UNIMPLEMENTED"));
});

test("action with a tool but no confirm warns; setLayout does not bump revision", () => {
  fresh();
  O.updateActionType("item.intake", { requiresConfirm: false });
  assert.ok(O.validate().warnings.some((w) => w.code === "ACTION_WRITE_NO_CONFIRM"));
  const rev = O.get().revision;
  const n = O.get().changelog.length;
  assert.equal(O.setLayout("inventory", { x: 10.4, y: 20 }).ok, true);
  assert.deepEqual(O.get().objectTypes.inventory.layout, { x: 10, y: 20 });
  assert.equal(O.get().revision, rev);
  assert.equal(O.get().changelog.length, n);
});
