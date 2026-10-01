const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const M = require("../../object-map.js");
const P = require("../../planner.js");
const S = require("../../skin-state.js");

const root = path.join(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mapFrom(tables) {
  let proposals = [];
  tables.forEach(function (table) {
    proposals = proposals.concat(P.proposeOntology({
      table: table.table,
      columns: table.columns,
      synthetic: true,
    }));
  });
  return M.build({ tables: tables, links: [], proposals: proposals, label: M.LABEL });
}

test("the same seed builds the same map and suggestions", () => {
  const golden = JSON.parse(read("tests/fixtures/object-map.golden.json"));
  const once = M.seed();
  const twice = M.seed();
  assert.deepEqual(once, golden);
  assert.deepEqual(twice, once);
  assert.equal(once.schema, "netie.object-map/1");
  assert.equal(once.label, "synthetic object map, not a live catalog");
  const orders = once.objects.filter(function (row) { return row.id === "orders"; })[0];
  assert.deepEqual(orders.columns, P.sampleSchema().columns.map(function (col) { return col.name; }));
  const proposed = P.proposeOntology(P.sampleSchema()).filter(function (card) {
    return card.role !== "object" && card.role !== "value-list";
  }).map(function (card) { return card.role + " " + card.name; }).sort();
  const fields = orders.fields.map(function (field) { return field.role + " " + field.name; }).sort();
  assert.deepEqual(fields, proposed);
  const ids = once.suggestions.map(function (row) { return row.id; });
  assert.deepEqual(ids, ["suppliers~vendors", "orders~purchase_orders"]);
  assert.equal(once.suggestions[0].confidence, 0.95);
  assert.equal(once.suggestions[0].confidence <= M.CONFIDENCE_CAP, true);
  assert.equal(once.suggestions[0].confidence < 1, true);
  assert.equal(once.suggestions[0].reason, "name similarity; overlapping key supplier_id; shared source table suppliers");
  assert.equal(once.suggestions[1].confidence, 0.8);
  assert.equal(once.suggestions[1].applied, false);
  assert.equal(once.suggestions[1].certified, false);
  assert.equal(ids.indexOf("orders~shipments") < 0, true);
  once.objects.forEach(function (row) {
    assert.equal(row.status, "proposed");
    assert.equal(row.certified, false);
  });
});

test("merge rules score name, keys, and source, and drop scores under 0.5", () => {
  const nameOnly = mapFrom([
    { table: "vendors", label: "Vendor", sourceTable: "vendors", columns: [{ name: "vendor_code", type: "string", primary: true }] },
    { table: "suppliers", label: "Supplier", sourceTable: "suppliers", columns: [{ name: "supplier_code", type: "string", primary: true }] },
  ]);
  assert.equal(nameOnly.suggestions.length, 1);
  assert.equal(nameOnly.suggestions[0].confidence, 0.5);
  assert.equal(nameOnly.suggestions[0].reason, "name similarity");

  const keysOnly = mapFrom([
    { table: "alpha", label: "Alpha", sourceTable: "alpha", columns: [{ name: "order_id", type: "string", primary: true }] },
    { table: "beta", label: "Beta", sourceTable: "beta", columns: [{ name: "order_id", type: "string", primary: true }] },
  ]);
  assert.equal(keysOnly.suggestions.length, 0);

  const sourceOnly = mapFrom([
    { table: "alpha", label: "Alpha", sourceTable: "shared", columns: [{ name: "alpha_id", type: "string", primary: true }] },
    { table: "beta", label: "Beta", sourceTable: "shared", columns: [{ name: "beta_id", type: "string", primary: true }] },
  ]);
  assert.equal(sourceOnly.suggestions.length, 0);
  assert.equal(M.nameSimilar("order", "purchaseorder"), true);
  assert.equal(M.nameSimilar("vendor", "supplier"), true);
  assert.equal(M.nameSimilar("shipment", "order"), false);
});

test("Try it proposals overlay status and cannot certify from the UI", () => {
  const accepted = P.acceptAllProposals(P.proposeOntology(P.sampleSchema()));
  const map = M.seed(accepted);
  const orders = map.objects.filter(function (row) { return row.id === "orders"; })[0];
  const supplier = map.objects.filter(function (row) { return row.id === "suppliers"; })[0];
  assert.equal(orders.status, "accepted");
  assert.equal(orders.certified, false);
  assert.equal(supplier.status, "proposed");
  assert.equal(map.objects.length, 5);
  const forged = accepted.map(function (card) {
    return Object.assign({}, card, { certified: true, certifiedBy: "ui" });
  });
  const blocked = M.seed(forged);
  const still = blocked.objects.filter(function (row) { return row.id === "orders"; })[0];
  assert.equal(still.status, "accepted");
  assert.equal(still.certified, false);
  const fromCortex = accepted.map(function (card) {
    if (card.id !== "orders.object.orders") return card;
    return Object.assign({}, card, { certified: true, certifiedBy: "cortex" });
  });
  const marked = M.seed(fromCortex);
  const certified = marked.objects.filter(function (row) { return row.id === "orders"; })[0];
  assert.equal(certified.status, "certified");
  assert.equal(certified.certified, true);
});

test("certified status is read only when Cortex set it", () => {
  const input = M.defaultInput();
  const card = input.proposals.filter(function (row) { return row.id === "orders.object.orders"; })[0];
  card.certified = true;
  delete card.certifiedBy;
  const stripped = M.build(input);
  const plain = stripped.objects.filter(function (row) { return row.id === "orders"; })[0];
  assert.equal(plain.status, "proposed");
  assert.equal(plain.certified, false);
  card.certified = true;
  card.certifiedBy = "cortex";
  const marked = M.build(input);
  const orders = marked.objects.filter(function (row) { return row.id === "orders"; })[0];
  assert.equal(orders.status, "certified");
  assert.equal(orders.certified, true);
  assert.equal(M.statusOf({ certified: true, certifiedBy: "studio" }), "proposed");
});

test("a merge click is a proposal and does not change the map", () => {
  S.set({ merges: [], proposals: [], request: "" });
  const before = M.seed();
  const saved = S.proposeMerge(Object.assign({}, before.suggestions[0], { applied: true, certified: true }));
  assert.equal(saved.merges[0].status, "proposed");
  assert.equal(saved.merges[0].applied, false);
  assert.equal(saved.merges[0].certified, false);
  assert.equal(saved.schema, "netie.skin-state/1");
  const kept = S.set({ request: "list open orders", proposals: [] });
  assert.equal(kept.merges.length, 1);
  assert.equal(kept.merges[0].applied, false);
  const dismissed = S.dismissMerge(kept.merges[0]);
  assert.equal(dismissed.merges[0].status, "dismissed");
  assert.equal(dismissed.merges[0].applied, false);
  assert.deepEqual(M.seed().objects, before.objects);
  const ui = read("object-map-ui.js");
  const model = read("object-map.js");
  assert.equal(/\bfetch\s*\(/.test(ui), false);
  assert.equal(/\bfetch\s*\(/.test(model), false);
  assert.equal(/\.certified\s*=/.test(ui), false);
  assert.equal(/certifiedBy\s*[:=]/.test(ui), false);
  assert.equal(/status\s*=\s*["']certified["']/.test(ui), false);
});

test("edge labels sit near the midpoint and do not overlap", () => {
  const map = M.seed();
  const nodes = map.objects.map(function (obj) {
    return { id: obj.id, x: obj.x, y: obj.y, w: 140, h: 56 };
  });
  function overlap(a, b, gap) {
    return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
  }
  const forOrder = map.links.filter(function (link) { return link.type === "for-order"; })[0];
  assert.ok(forOrder.label);
  map.links.forEach(function (link) {
    const box = link.label;
    assert.equal(box.x >= 2 && box.y >= 2 && box.x + box.w <= 638 && box.y + box.h <= 398, true, link.id);
    nodes.forEach(function (node) {
      assert.equal(overlap(box, node, 2), false, link.id + " overlaps " + node.id);
    });
    const from = map.objects.filter(function (obj) { return obj.id === link.from; })[0];
    const to = map.objects.filter(function (obj) { return obj.id === link.to; })[0];
    const mx = (from.x + 70 + to.x + 70) / 2;
    const my = (from.y + 28 + to.y + 28) / 2;
    const dist = Math.hypot(box.x + box.w / 2 - mx, box.y + box.h / 2 - my);
    assert.equal(dist <= 48, true, link.id + " is " + dist + "px from the midpoint");
  });
  for (let i = 0; i < map.links.length; i++) {
    for (let j = i + 1; j < map.links.length; j++) {
      assert.equal(overlap(map.links[i].label, map.links[j].label, 2), false);
    }
  }
  map.suggestions.forEach(function (row) {
    assert.equal(row.confidence <= 0.95, true);
    assert.equal(row.confidence < 1, true);
  });
});

test("object map css stays on the solid token scale", () => {
  const css = read("object-map.css");
  assert.equal(/backdrop-filter|filter\s*:\s*blur|@font-face|fonts\.google/.test(css), false);
  assert.match(css, /var\(--panel\)/);
  assert.match(css, /var\(--font\)/);
  assert.match(css, /margin-left:\s*8px/);
});
