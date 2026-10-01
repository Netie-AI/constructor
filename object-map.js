/* Ontology object map. Objects are nodes, links are typed edges.
   Deterministic layout and merge suggestions. No DOM. No fetch.
   Certified is only read when certifiedBy is cortex. This file never sets it. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && typeof root === "object") root.ObjectMap = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = "netie.object-map/1";
  const LABEL = "synthetic object map, not a live catalog";
  const SYNONYMS = [
    ["vendor", "supplier"],
    ["order", "purchaseorder"],
  ];
  const ROLE_ORDER = { key: 0, measure: 1, dimension: 2 };

  const COMPANION = [
    {
      table: "suppliers",
      label: "Supplier",
      sourceTable: "suppliers",
      columns: [
        { name: "supplier_id", type: "string", primary: true },
        { name: "name", type: "string" },
        { name: "region", type: "string", cardinality: "low", distinctCount: 2, distinct: ["north", "south"] },
      ],
    },
    {
      table: "shipments",
      label: "Shipment",
      sourceTable: "shipments",
      columns: [
        { name: "shipment_id", type: "string", primary: true },
        { name: "order_id", type: "string" },
        { name: "status", type: "string", cardinality: "low", distinctCount: 2, distinct: ["open", "closed"] },
      ],
    },
    {
      table: "vendors",
      label: "Vendor",
      sourceTable: "suppliers",
      columns: [
        { name: "vendor_id", type: "string" },
        { name: "supplier_id", type: "string" },
        { name: "name", type: "string" },
      ],
    },
    {
      table: "purchase_orders",
      label: "PurchaseOrder",
      sourceTable: "purchase_orders",
      columns: [
        { name: "order_id", type: "string", primary: true },
        { name: "amount", type: "number" },
      ],
    },
  ];

  const LINKS = [
    { id: "purchase_orders.same-key.orders", from: "purchase_orders", to: "orders", type: "same-key", via: "order_id" },
    { id: "shipments.for-order.orders", from: "shipments", to: "orders", type: "for-order", via: "order_id" },
    { id: "vendors.same-party.suppliers", from: "vendors", to: "suppliers", type: "same-party", via: "supplier_id" },
  ];

  function plannerApi() {
    if (typeof require === "function") {
      try { return require("./planner.js"); } catch (err) { /* browser script */ }
    }
    return typeof window !== "undefined" ? window.Planner : null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function nameSimilar(a, b) {
    const left = normalizeName(a);
    const right = normalizeName(b);
    if (!left || !right) return false;
    if (left === right) return true;
    const short = left.length <= right.length ? left : right;
    const long = left.length <= right.length ? right : left;
    if (short.length >= 4 && long.indexOf(short) >= 0) return true;
    for (let i = 0; i < SYNONYMS.length; i++) {
      const group = SYNONYMS[i];
      if (group.indexOf(left) >= 0 && group.indexOf(right) >= 0) return true;
    }
    return false;
  }

  function statusOf(card) {
    if (card && card.certified === true && card.certifiedBy === "cortex") return "certified";
    if (card && card.status === "accepted") return "accepted";
    return "proposed";
  }

  function indexCards(cards) {
    const byId = {};
    (cards || []).forEach(function (card) {
      if (!card || !card.id) return;
      const next = clone(card);
      if (!(next.certified === true && next.certifiedBy === "cortex")) {
        next.certified = false;
        delete next.certifiedBy;
      }
      byId[next.id] = next;
    });
    return byId;
  }

  function layoutOf(ids) {
    const sorted = ids.slice().sort();
    const n = sorted.length || 1;
    const out = {};
    sorted.forEach(function (id, i) {
      const angle = (-90 + (i / n) * 360) * Math.PI / 180;
      out[id] = {
        x: Math.round(320 + 150 * Math.cos(angle) - 70),
        y: Math.round(200 + 150 * Math.sin(angle) - 28),
      };
    });
    return out;
  }

  function tableInput(spec) {
    return {
      table: spec.table,
      label: spec.objectLabel || spec.label,
      sourceTable: spec.sourceTable || spec.table,
      columns: spec.columns || [],
    };
  }

  function defaultInput() {
    const P = plannerApi();
    if (!P || typeof P.sampleSchema !== "function" || typeof P.proposeOntology !== "function") {
      throw new Error("Planner.sampleSchema is required to seed the object map");
    }
    const orders = P.sampleSchema();
    const tables = [{
      table: orders.table,
      label: "Order",
      sourceTable: orders.table,
      columns: orders.columns,
    }].concat(COMPANION.map(function (row) {
      return {
        table: row.table,
        label: row.label,
        sourceTable: row.sourceTable,
        columns: row.columns,
      };
    }));
    let proposals = [];
    tables.forEach(function (table) {
      proposals = proposals.concat(P.proposeOntology({
        table: table.table,
        columns: table.columns,
        label: orders.label,
        synthetic: true,
      }));
    });
    return {
      label: LABEL,
      ordersLabel: orders.label,
      tables: tables,
      links: LINKS.map(clone),
      proposals: proposals,
    };
  }

  function suggestionsFor(objects) {
    const rows = [];
    const list = objects.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const reasons = [];
        let points = 0;
        if (nameSimilar(a.label, b.label) || nameSimilar(a.id, b.id)) {
          points += 50;
          reasons.push("name similarity");
        }
        const keys = a.keys.filter(function (name) { return b.keys.indexOf(name) >= 0; }).sort();
        if (keys.length) {
          points += 30;
          reasons.push("overlapping key " + keys.join(", "));
        }
        if (a.sourceTable && a.sourceTable === b.sourceTable) {
          points += 20;
          reasons.push("shared source table " + a.sourceTable);
        }
        if (points < 50) continue;
        rows.push({
          id: a.id + "~" + b.id,
          left: a.id,
          right: b.id,
          leftLabel: a.label,
          rightLabel: b.label,
          reason: reasons.join("; "),
          confidence: points / 100,
          applied: false,
          certified: false,
        });
      }
    }
    rows.sort(function (a, b) {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return rows;
  }

  function build(input) {
    const src = input || defaultInput();
    const cards = indexCards(src.proposals);
    const tables = (src.tables || []).map(tableInput);
    const positions = layoutOf(tables.map(function (table) { return table.table; }));
    const objects = tables.map(function (table) {
      const objectCard = cards[table.table + ".object." + table.table];
      const fields = Object.keys(cards).sort().map(function (id) { return cards[id]; }).filter(function (card) {
        return card.object === table.table && card.role !== "object" && card.role !== "value-list";
      }).map(function (card) {
        return { name: card.name, role: card.role, status: statusOf(card) };
      }).sort(function (a, b) {
        const ra = ROLE_ORDER[a.role] == null ? 9 : ROLE_ORDER[a.role];
        const rb = ROLE_ORDER[b.role] == null ? 9 : ROLE_ORDER[b.role];
        if (ra !== rb) return ra - rb;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
      const keys = fields.filter(function (field) { return field.role === "key"; }).map(function (field) { return field.name; });
      const valueLists = Object.keys(cards).sort().map(function (id) { return cards[id]; }).filter(function (card) {
        return card.object === table.table && card.role === "value-list";
      }).map(function (card) {
        return { name: card.name, values: Array.isArray(card.values) ? card.values.slice() : [] };
      }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      const pos = positions[table.table];
      return {
        id: table.table,
        label: table.label || table.table,
        status: statusOf(objectCard),
        certified: statusOf(objectCard) === "certified",
        sourceTable: table.sourceTable,
        columns: (table.columns || []).map(function (col) { return col.name; }),
        keys: keys,
        fields: fields,
        valueLists: valueLists,
        x: pos.x,
        y: pos.y,
      };
    }).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    const links = (src.links || []).map(clone).sort(function (a, b) {
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return {
      schema: SCHEMA,
      label: src.label || LABEL,
      objects: objects,
      links: links,
      suggestions: suggestionsFor(objects),
    };
  }

  function seed(proposals) {
    const input = defaultInput();
    if (Array.isArray(proposals) && proposals.length) {
      const byId = indexCards(input.proposals);
      proposals.forEach(function (card) {
        if (!card || !card.id) return;
        const prev = byId[card.id] || {};
        const next = Object.assign({}, prev, clone(card));
        if (!(next.certified === true && next.certifiedBy === "cortex")) {
          next.certified = false;
          delete next.certifiedBy;
        }
        byId[next.id] = next;
      });
      input.proposals = Object.keys(byId).sort().map(function (id) { return byId[id]; });
    }
    return build(input);
  }

  return {
    SCHEMA: SCHEMA,
    LABEL: LABEL,
    SYNONYMS: SYNONYMS.map(function (group) { return group.slice(); }),
    companion: function () { return clone(COMPANION); },
    links: function () { return clone(LINKS); },
    defaultInput: defaultInput,
    build: build,
    seed: seed,
    statusOf: statusOf,
    nameSimilar: nameSimilar,
  };
});
