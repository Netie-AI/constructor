/* Ontology model for the Constructor skin.
   Object types, properties, link types, action types, interfaces, fetch places.
   Pure data: no DOM, no fetch. UMD: module.exports under Node, window.Ontology in the browser.
   Contract: docs/ONTOLOGY_STUDIO.md. Cortex stays the only engine; this file only models. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && typeof root === "object") root.Ontology = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = "netie.ontology/1";
  const STORAGE_KEY = "netie.constructor.ontology.v1";
  const TYPES = ["string", "number", "integer", "boolean", "date", "datetime", "geo", "json", "ref"];
  const CATALOG_TYPES = ["string", "number", "integer", "boolean", "date"];
  const CARDINALITIES = ["one_to_one", "many_to_one", "one_to_many", "many_to_many"];
  const PLACE_KINDS = ["place", "cloud", "database", "local_model", "online_api"];
  const ID_RE = /^[a-z][a-z0-9_.]*$/;
  const PROP_RE = /^[a-z][a-z0-9_]*$/;
  const IFACE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
  const UNDO_LIMIT = 100;
  const CHANGELOG_LIMIT = 500;
  const PALETTE = ["#7eb8ff", "#9ad7c2", "#d4b4ff", "#f0c36d", "#e8a07a", "#8ec8f0", "#b7e08a", "#c9c27a", "#c4a0e8", "#9fd0e8", "#d0d0d0", "#f2a3a3", "#ffb3d9", "#a3f2e6"];

  let current = null;
  const undoStack = [];
  const redoStack = [];
  const subscribers = [];

  function clone(x) {
    return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function titleCase(id) {
    return String(id)
      .replace(/[_.]+/g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function result(errors) {
    return { ok: !errors.length, errors: errors };
  }

  /* ---------- seed ---------- */

  function props(list) {
    const out = {};
    list.forEach(function (row) {
      const p = { id: row[0], type: row[1] || "string", required: !!row[2], pii: !!row[3], description: row[4] || "" };
      if (row[5]) p.unit = row[5];
      if (p.type === "ref" && row[6]) p.ref = row[6];
      out[row[0]] = p;
    });
    return out;
  }

  function obj(id, label, description, color, pk, titleKey, interfaces, propList) {
    return {
      id: id,
      label: label,
      description: description,
      color: color,
      primaryKey: pk,
      titleKey: titleKey,
      interfaces: interfaces || [],
      properties: props(propList),
    };
  }

  function link(id, label, from, to, via, cardinality, inverse, description) {
    return {
      id: id,
      label: label,
      from: from,
      to: to,
      via: via,
      cardinality: cardinality || "many_to_one",
      inverse: inverse || "",
      description: description || "",
    };
  }

  function action(id, label, objects, params, requiresConfirm, cortexTool, description) {
    return {
      id: id,
      label: label,
      objects: objects,
      params: params || [],
      requiresConfirm: !!requiresConfirm,
      cortexTool: cortexTool || null,
      description: description || "",
    };
  }

  function place(id, object, kind) {
    return { id: id, object: object, kind: kind || "place" };
  }

  function seed() {
    const objectTypes = {};
    [
      obj("inventory", "Inventory", "Warehouse stock rows from warehouse.inventory.", "#7eb8ff", "sku", "sku_name", [], [
        ["sku", "string", true, false, "Stock keeping unit."],
        ["sku_name", "string", false, false, "Human name."],
        ["category", "string"],
        ["supplier_id", "string", false, false, "Supplier primary key."],
        ["location_id", "string", false, false, "Location primary key."],
        ["storage_bin", "string"],
        ["quantity_kg", "number", false, false, "On hand.", "kg"],
        ["reorder_level_kg", "number", false, false, "Reorder threshold.", "kg"],
        ["unit_cost_myr", "number", false, false, "Unit cost.", "MYR"],
        ["last_restocked", "date"],
        ["expiry_date", "date"],
        ["is_hazardous", "boolean"],
      ]),
      obj("suppliers", "Suppliers", "Vendors that restock inventory.", "#9ad7c2", "supplier_id", "supplier_name", [], [
        ["supplier_id", "string", true],
        ["supplier_name", "string"],
        ["country", "string"],
        ["lead_time_days", "integer", false, false, "", "days"],
        ["payment_terms", "string"],
        ["last_audit_date", "date"],
        ["risk_score", "number"],
      ]),
      obj("locations", "Locations", "Warehouses, bins, and sites.", "#f0c36d", "location_id", "location_name", ["Locatable"], [
        ["location_id", "string", true],
        ["location_name", "string"],
        ["city", "string"],
        ["latitude", "number"],
        ["longitude", "number"],
      ]),
      obj("places", "Places", "Map places by lat/lng.", "#e8a07a", "place_id", "name", ["Locatable"], [
        ["place_id", "string", true],
        ["name", "string"],
        ["locality", "string"],
        ["latitude", "number"],
        ["longitude", "number"],
      ]),
      obj("venues", "Venues", "Venues at a place.", "#8ec8f0", "venue_id", "name", [], [
        ["venue_id", "string", true],
        ["name", "string"],
        ["category", "string"],
        ["place_id", "string"],
        ["website", "string"],
      ]),
      obj("contacts", "Contacts", "People at venues. Owned CRM rows only.", "#b7e08a", "contact_id", "name", [], [
        ["contact_id", "string", true],
        ["name", "string", false, true],
        ["role", "string"],
        ["venue_id", "string"],
        ["email", "string", false, true],
      ]),
      obj("leads", "Leads", "Sales leads from contacts.", "#c9c27a", "lead_id", "account", [], [
        ["lead_id", "string", true],
        ["account", "string"],
        ["status", "string"],
        ["contact_id", "string"],
      ]),
      obj("incidents", "Incidents", "Owned case rows. Not a scrape.", "#c4a0e8", "incident_id", "summary", [], [
        ["incident_id", "string", true],
        ["opened_at", "date"],
        ["status", "string"],
        ["location_id", "string"],
        ["summary", "string"],
      ]),
      obj("images", "Images", "Owned images (station archive or operator upload).", "#9fd0e8", "image_id", "asset_uri", [], [
        ["image_id", "string", true],
        ["captured_at", "date"],
        ["location_id", "string"],
        ["asset_uri", "string"],
        ["quality", "number"],
      ]),
      obj("suspects", "Suspects", "Owned watchlist rows. Steward reviews.", "#d0d0d0", "suspect_id", "name", [], [
        ["suspect_id", "string", true],
        ["name", "string", false, true],
        ["watchlist", "string"],
        ["image_id", "string"],
        ["notes", "string", false, true],
      ]),
      obj("matches", "Matches", "Image to watchlist matches. A score is a claim.", "#f2a3a3", "match_id", "match_id", ["Reviewable"], [
        ["match_id", "string", true],
        ["image_id", "string"],
        ["suspect_id", "string"],
        ["score", "number"],
        ["reviewed", "boolean"],
      ]),
      obj("shipments", "Shipments", "Inbound consignments.", "#d4b4ff", "shipment_id", "carrier", [], [
        ["shipment_id", "string", true],
        ["supplier_id", "string"],
        ["location_id", "string"],
        ["carrier", "string"],
        ["eta", "date"],
        ["status", "string"],
      ]),
      obj("transactions", "Transactions", "Stock movements.", "#ffb3d9", "txn_id", "txn_id", [], [
        ["txn_id", "string", true],
        ["sku", "string"],
        ["location_id", "string"],
        ["quantity_kg", "number", false, false, "", "kg"],
        ["kind", "string"],
        ["at", "datetime"],
      ]),
      obj("alerts", "Alerts", "Threshold alerts on stock.", "#a3f2e6", "alert_id", "message", [], [
        ["alert_id", "string", true],
        ["sku", "string"],
        ["location_id", "string"],
        ["level", "string"],
        ["message", "string"],
        ["raised_at", "datetime"],
        ["acknowledged", "boolean"],
      ]),
    ].forEach(function (o) {
      objectTypes[o.id] = o;
    });

    const linkTypes = {};
    [
      link("inventory_supplier", "supplied by", "inventory", "suppliers", "supplier_id", "many_to_one", "supplies"),
      link("inventory_location", "stored at", "inventory", "locations", "location_id", "many_to_one", "holds"),
      link("venue_at_place", "at place", "venues", "places", "place_id", "many_to_one", "venues"),
      link("contact_at_venue", "works at", "contacts", "venues", "venue_id", "many_to_one", "contacts"),
      link("lead_of_contact", "lead of", "leads", "contacts", "contact_id", "many_to_one", "leads"),
      link("incident_at_location", "at location", "incidents", "locations", "location_id", "many_to_one", "incidents"),
      link("image_at_location", "captured at", "images", "locations", "location_id", "many_to_one", "images"),
      link("suspect_image", "reference image", "suspects", "images", "image_id", "many_to_one", "suspects"),
      link("match_of_image", "matched image", "matches", "images", "image_id", "many_to_one", "matches"),
      link("match_of_suspect", "matched suspect", "matches", "suspects", "suspect_id", "many_to_one", "matches"),
      link("shipment_supplier", "shipped by", "shipments", "suppliers", "supplier_id", "many_to_one", "shipments"),
      link("shipment_location", "bound for", "shipments", "locations", "location_id", "many_to_one", "inbound"),
      link("txn_sku", "moves", "transactions", "inventory", "sku", "many_to_one", "movements"),
      link("txn_location", "at location", "transactions", "locations", "location_id", "many_to_one", "movements"),
      link("alert_sku", "about", "alerts", "inventory", "sku", "many_to_one", "alerts"),
      link("alert_location", "at location", "alerts", "locations", "location_id", "many_to_one", "alerts"),
    ].forEach(function (l) {
      linkTypes[l.id] = l;
    });

    const actionTypes = {};
    [
      action("export_pptx", "Export PPTX", ["*"], [{ id: "title", type: "string", required: false }], true, "export_pptx", "F8 governed export. The only real tool on this pack."),
      action("item.intake", "Item intake", ["inventory"], [{ id: "quantity_kg", type: "number", required: true }, { id: "storage_bin", type: "string", required: false }], true, "item.intake", "Book inbound stock."),
      action("agent.checked", "Agent checked", ["*"], [], false, null, "Ledger note. Read only."),
      action("image.enhance", "Image enhance", ["images", "matches"], [{ id: "model", type: "string", required: false }], true, "image.enhance", "Comfy-style enhance on owned images."),
      action("suspect.match", "Suspect match", ["suspects", "matches", "images"], [{ id: "threshold", type: "number", required: false }], true, "suspect.match", "Match against owned.watchlist. Steward reviews."),
    ].forEach(function (a) {
      actionTypes[a.id] = a;
    });

    const interfaces = {
      Locatable: {
        id: "Locatable",
        label: "Locatable",
        description: "Has a lat/lng point.",
        properties: props([["latitude", "number"], ["longitude", "number"]]),
      },
      Reviewable: {
        id: "Reviewable",
        label: "Reviewable",
        description: "A steward can mark it reviewed.",
        properties: props([["reviewed", "boolean"]]),
      },
    };

    const fetchPlaces = {};
    [
      place("warehouse.inventory", "inventory"),
      place("warehouse.suppliers", "suppliers"),
      place("warehouse.locations", "locations"),
      place("warehouse.shipments", "shipments"),
      place("warehouse.transactions", "transactions"),
      place("warehouse.alerts", "alerts"),
      place("maps.places", "places"),
      place("maps.venues", "venues"),
      place("crm.contacts", "contacts"),
      place("crm.leads", "leads"),
      place("cloud.signed_in", "inventory", "cloud"),
      place("db.link", "incidents", "database"),
      place("db.incidents", "incidents", "database"),
      place("owned.images", "images", "database"),
      place("owned.watchlist", "suspects", "database"),
      place("owned.matches", "matches", "database"),
      place("local.model", "images", "local_model"),
      place("api.enhance", "images", "online_api"),
    ].forEach(function (p) {
      fetchPlaces[p.id] = p;
    });

    return {
      schema: SCHEMA,
      name: "dms",
      revision: 0,
      objectTypes: objectTypes,
      linkTypes: linkTypes,
      actionTypes: actionTypes,
      interfaces: interfaces,
      fetchPlaces: fetchPlaces,
      changelog: [],
    };
  }

  /* ---------- normalize / load ---------- */

  function normalize(raw) {
    const errors = [];
    if (!raw || typeof raw !== "object") return { ok: false, errors: ["ontology must be an object"] };
    const o = {
      schema: SCHEMA,
      name: typeof raw.name === "string" && raw.name ? raw.name : "dms",
      revision: Number.isFinite(raw.revision) ? raw.revision : 0,
      objectTypes: {},
      linkTypes: {},
      actionTypes: {},
      interfaces: {},
      fetchPlaces: {},
      changelog: Array.isArray(raw.changelog) ? clone(raw.changelog) : [],
    };
    const ot = raw.objectTypes && typeof raw.objectTypes === "object" ? raw.objectTypes : {};
    Object.keys(ot).forEach(function (id) {
      const src = ot[id] || {};
      const p = {};
      const sp = src.properties && typeof src.properties === "object" ? src.properties : {};
      Object.keys(sp).forEach(function (pid) {
        const s = sp[pid] || {};
        const row = {
          id: pid,
          type: TYPES.indexOf(s.type) >= 0 ? s.type : "string",
          required: !!s.required,
          pii: !!s.pii,
          description: typeof s.description === "string" ? s.description : "",
        };
        if (s.unit) row.unit = String(s.unit);
        if (s.ref) row.ref = String(s.ref);
        if (Array.isArray(s.enum)) row.enum = s.enum.slice();
        if (s.label) row.label = String(s.label);
        p[pid] = row;
      });
      const item = {
        id: id,
        label: typeof src.label === "string" && src.label ? src.label : titleCase(id),
        description: typeof src.description === "string" ? src.description : "",
        color: typeof src.color === "string" && src.color ? src.color : pickColor(id),
        primaryKey: typeof src.primaryKey === "string" ? src.primaryKey : null,
        titleKey: typeof src.titleKey === "string" ? src.titleKey : null,
        interfaces: Array.isArray(src.interfaces) ? src.interfaces.slice() : [],
        properties: p,
      };
      if (src.layout && typeof src.layout === "object" && Number.isFinite(src.layout.x) && Number.isFinite(src.layout.y)) {
        item.layout = { x: src.layout.x, y: src.layout.y };
      }
      if (!item.primaryKey && Object.keys(p).length) item.primaryKey = Object.keys(p)[0];
      o.objectTypes[id] = item;
    });
    const lt = raw.linkTypes && typeof raw.linkTypes === "object" ? raw.linkTypes : {};
    Object.keys(lt).forEach(function (id) {
      const s = lt[id] || {};
      o.linkTypes[id] = {
        id: id,
        label: typeof s.label === "string" ? s.label : titleCase(id),
        from: String(s.from || ""),
        to: String(s.to || ""),
        via: String(s.via || ""),
        cardinality: CARDINALITIES.indexOf(s.cardinality) >= 0 ? s.cardinality : "many_to_one",
        inverse: typeof s.inverse === "string" ? s.inverse : "",
        description: typeof s.description === "string" ? s.description : "",
      };
    });
    const at = raw.actionTypes && typeof raw.actionTypes === "object" ? raw.actionTypes : {};
    Object.keys(at).forEach(function (id) {
      const s = at[id] || {};
      o.actionTypes[id] = {
        id: id,
        label: typeof s.label === "string" ? s.label : titleCase(id),
        objects: Array.isArray(s.objects) ? s.objects.map(String) : [],
        params: Array.isArray(s.params)
          ? s.params.map(function (pr) {
              return { id: String(pr.id || ""), type: TYPES.indexOf(pr.type) >= 0 ? pr.type : "string", required: !!pr.required };
            })
          : [],
        requiresConfirm: !!s.requiresConfirm,
        cortexTool: s.cortexTool ? String(s.cortexTool) : null,
        description: typeof s.description === "string" ? s.description : "",
      };
    });
    const it = raw.interfaces && typeof raw.interfaces === "object" ? raw.interfaces : {};
    Object.keys(it).forEach(function (id) {
      const s = it[id] || {};
      const p = {};
      const sp = s.properties && typeof s.properties === "object" ? s.properties : {};
      Object.keys(sp).forEach(function (pid) {
        const x = sp[pid] || {};
        p[pid] = { id: pid, type: TYPES.indexOf(x.type) >= 0 ? x.type : "string", required: !!x.required, description: typeof x.description === "string" ? x.description : "" };
      });
      o.interfaces[id] = { id: id, label: typeof s.label === "string" ? s.label : id, description: typeof s.description === "string" ? s.description : "", properties: p };
    });
    const fp = raw.fetchPlaces && typeof raw.fetchPlaces === "object" ? raw.fetchPlaces : {};
    Object.keys(fp).forEach(function (id) {
      const s = fp[id] || {};
      o.fetchPlaces[id] = { id: id, object: String(s.object || ""), kind: PLACE_KINDS.indexOf(s.kind) >= 0 ? s.kind : "place" };
    });
    if (!Object.keys(o.objectTypes).length) errors.push("ontology has no object types");
    return { ok: !errors.length, errors: errors, value: o };
  }

  function pickColor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  /* ---------- Cortex catalog bridge ---------- */

  function catalogType(t) {
    if (t === "datetime") return "date";
    if (CATALOG_TYPES.indexOf(t) >= 0) return t;
    return "string";
  }

  function toCatalog() {
    const o = current;
    const objects = {};
    Object.keys(o.objectTypes).forEach(function (id) {
      const points = {};
      const t = o.objectTypes[id];
      Object.keys(t.properties).forEach(function (pid) {
        points[pid] = catalogType(t.properties[pid].type);
      });
      objects[id] = { points: points };
    });
    const links = Object.keys(o.linkTypes).map(function (id) {
      const l = o.linkTypes[id];
      return { id: id, from: l.from, to: l.to, via: l.via };
    });
    const actions = Object.keys(o.actionTypes);
    const action_meta = actions.map(function (id) {
      const a = o.actionTypes[id];
      const objs = a.objects.length ? a.objects.slice() : ["*"];
      return { id: id, objects: objs, label: id + " (" + (objs[0] === "*" ? "any object" : objs.join("/")) + ")" };
    });
    return { objects: objects, links: links, actions: actions, action_meta: action_meta, fetch_places: Object.keys(o.fetchPlaces) };
  }

  function guessPlaceObject(placeId, objectIds) {
    const tail = placeId.split(".").pop();
    if (objectIds.indexOf(tail) >= 0) return tail;
    const known = { link: "incidents", signed_in: "inventory", watchlist: "suspects", model: "images", enhance: "images" };
    if (known[tail] && objectIds.indexOf(known[tail]) >= 0) return known[tail];
    return objectIds[0] || "";
  }

  function fromCatalog(catalog) {
    const base = current ? clone(current) : seed();
    const out = {
      schema: SCHEMA,
      name: (catalog && catalog.name) || base.name || "dms",
      revision: base.revision || 0,
      objectTypes: {},
      linkTypes: {},
      actionTypes: {},
      interfaces: clone(base.interfaces || {}),
      fetchPlaces: {},
      changelog: base.changelog || [],
    };
    const objs = (catalog && catalog.objects) || {};
    const objectIds = Object.keys(objs);
    objectIds.forEach(function (id) {
      const points = (objs[id] && objs[id].points) || {};
      const prev = base.objectTypes[id];
      const properties = {};
      Object.keys(points).forEach(function (pid) {
        const prevProp = prev && prev.properties[pid];
        const type = TYPES.indexOf(points[pid]) >= 0 ? points[pid] : "string";
        properties[pid] = prevProp && catalogType(prevProp.type) === catalogType(type) ? clone(prevProp) : { id: pid, type: type, required: false, pii: false, description: "" };
      });
      const pk = prev && prev.primaryKey && properties[prev.primaryKey] ? prev.primaryKey : Object.keys(properties)[0] || null;
      out.objectTypes[id] = {
        id: id,
        label: prev ? prev.label : titleCase(id),
        description: prev ? prev.description : "",
        color: prev ? prev.color : pickColor(id),
        primaryKey: pk,
        titleKey: prev && prev.titleKey && properties[prev.titleKey] ? prev.titleKey : null,
        interfaces: prev ? prev.interfaces.slice() : [],
        properties: properties,
      };
      if (prev && prev.layout) out.objectTypes[id].layout = clone(prev.layout);
    });
    const links = catalog && Array.isArray(catalog.links) ? catalog.links : null;
    if (links) {
      links.forEach(function (l) {
        if (!l || !l.id) return;
        const prev = base.linkTypes[l.id];
        out.linkTypes[l.id] = Object.assign(
          { id: l.id, label: titleCase(l.id), cardinality: "many_to_one", inverse: "", description: "" },
          prev || {},
          { from: String(l.from || ""), to: String(l.to || ""), via: String(l.via || "") }
        );
      });
    } else {
      /* Keep links whose endpoints survive. A missing via is not dropped silently;
         validate() flags it as LINK_VIA_MISSING so the degradation shows. */
      Object.keys(base.linkTypes).forEach(function (id) {
        const l = base.linkTypes[id];
        if (out.objectTypes[l.from] && out.objectTypes[l.to]) out.linkTypes[id] = clone(l);
      });
    }
    const actions = catalog && Array.isArray(catalog.actions) ? catalog.actions : Object.keys(base.actionTypes);
    const meta = {};
    ((catalog && catalog.action_meta) || []).forEach(function (m) {
      if (m && m.id) meta[m.id] = m;
    });
    actions.forEach(function (id) {
      const prev = base.actionTypes[id];
      const m = meta[id];
      const objects = m && Array.isArray(m.objects) ? m.objects.slice() : prev ? prev.objects.slice() : ["*"];
      out.actionTypes[id] = prev
        ? Object.assign(clone(prev), { objects: objects })
        : { id: id, label: titleCase(id), objects: objects, params: [], requiresConfirm: id !== "agent.checked", cortexTool: id === "agent.checked" ? null : id, description: "" };
    });
    const places = catalog && Array.isArray(catalog.fetch_places) ? catalog.fetch_places : Object.keys(base.fetchPlaces);
    places.forEach(function (id) {
      const prev = base.fetchPlaces[id];
      if (prev && out.objectTypes[prev.object]) out.fetchPlaces[id] = clone(prev);
      else out.fetchPlaces[id] = { id: id, object: guessPlaceObject(id, Object.keys(out.objectTypes)), kind: prev ? prev.kind : "place" };
    });
    return out;
  }

  /* ---------- validation ---------- */

  function issue(level, code, path, message, fix) {
    const row = { level: level, code: code, path: path, message: message };
    if (fix) row.fix = fix;
    return row;
  }

  function validate() {
    const o = current;
    const errors = [];
    const warnings = [];
    const infos = [];
    function err(code, path, message, fix) {
      errors.push(issue("error", code, path, message, fix));
    }
    function warn(code, path, message, fix) {
      warnings.push(issue("warn", code, path, message, fix));
    }
    function info(code, path, message, fix) {
      infos.push(issue("info", code, path, message, fix));
    }
    const linkedObjects = {};
    Object.keys(o.linkTypes).forEach(function (id) {
      linkedObjects[o.linkTypes[id].from] = true;
      linkedObjects[o.linkTypes[id].to] = true;
    });
    const placedObjects = {};
    Object.keys(o.fetchPlaces).forEach(function (id) {
      placedObjects[o.fetchPlaces[id].object] = true;
    });

    Object.keys(o.objectTypes).forEach(function (id) {
      const t = o.objectTypes[id];
      const base = "objectTypes." + id;
      if (!ID_RE.test(id)) err("ID_INVALID", base, "object id " + id + " must match " + ID_RE);
      const propIds = Object.keys(t.properties);
      if (!propIds.length) err("OBJ_NO_PROPERTIES", base, id + " has no properties", "add a property");
      if (!t.primaryKey || !t.properties[t.primaryKey]) {
        err("OBJ_NO_PRIMARY_KEY", base, id + " has no primary key" + (t.primaryKey ? " (" + t.primaryKey + " is missing)" : ""), "pick a primary key property");
      }
      if (t.titleKey && !t.properties[t.titleKey]) warn("OBJ_TITLE_KEY_MISSING", base, id + " title key " + t.titleKey + " is not a property");
      if (!linkedObjects[id] && !placedObjects[id]) info("OBJ_ORPHAN", base, id + " has no links and no fetch place");
      propIds.forEach(function (pid) {
        const p = t.properties[pid];
        const pbase = base + ".properties." + pid;
        if (!PROP_RE.test(pid)) err("ID_INVALID", pbase, "property id " + pid + " must match " + PROP_RE);
        if (TYPES.indexOf(p.type) < 0) err("PROP_BAD_TYPE", pbase, id + "." + pid + " type " + p.type + " is not one of " + TYPES.join(", "));
        if (p.type === "ref" && (!p.ref || !o.objectTypes[p.ref])) err("PROP_REF_DANGLING", pbase, id + "." + pid + " refs missing object " + (p.ref || "(none)"));
      });
      (t.interfaces || []).forEach(function (iid) {
        const iface = o.interfaces[iid];
        if (!iface) {
          err("IFACE_DANGLING", base, id + " declares missing interface " + iid);
          return;
        }
        Object.keys(iface.properties).forEach(function (pid) {
          const want = iface.properties[pid];
          const have = t.properties[pid];
          if (!have) warn("IFACE_UNIMPLEMENTED", base, id + " implements " + iid + " but lacks " + pid, "add property " + pid + " " + want.type);
          else if (have.type !== want.type) warn("PROP_ID_COLLIDES_INTERFACE", base + ".properties." + pid, id + "." + pid + " is " + have.type + " but " + iid + " declares " + want.type);
        });
      });
    });

    const seen = {};
    Object.keys(o.linkTypes).forEach(function (id) {
      const l = o.linkTypes[id];
      const base = "linkTypes." + id;
      if (!ID_RE.test(id)) err("ID_INVALID", base, "link id " + id + " must match " + ID_RE);
      const from = o.objectTypes[l.from];
      const to = o.objectTypes[l.to];
      if (!from) err("LINK_DANGLING_FROM", base, id + " from missing object " + l.from);
      if (!to) err("LINK_DANGLING_TO", base, id + " to missing object " + l.to);
      if (from && !from.properties[l.via]) err("LINK_VIA_MISSING", base, id + " via " + l.via + " is not a property of " + l.from);
      if (from && to && from.properties[l.via] && to.primaryKey && to.properties[to.primaryKey]) {
        const vt = from.properties[l.via].type;
        const pt = to.properties[to.primaryKey].type;
        if (vt !== "ref" && vt !== pt) warn("LINK_VIA_TYPE_MISMATCH", base, id + " via " + l.via + " is " + vt + " but " + l.to + "." + to.primaryKey + " is " + pt);
      }
      if (CARDINALITIES.indexOf(l.cardinality) < 0) warn("LINK_DUPLICATE", base, id + " cardinality " + l.cardinality + " unknown");
      const key = l.from + ">" + l.to + ">" + l.via;
      if (seen[key]) warn("LINK_DUPLICATE", base, id + " duplicates " + seen[key] + " (" + key + ")");
      else seen[key] = id;
    });

    Object.keys(o.actionTypes).forEach(function (id) {
      const a = o.actionTypes[id];
      const base = "actionTypes." + id;
      if (!ID_RE.test(id)) err("ID_INVALID", base, "action id " + id + " must match " + ID_RE);
      if (!a.objects.length) err("ACTION_NO_OBJECTS", base, id + " applies to no object");
      a.objects.forEach(function (oid) {
        if (oid !== "*" && !o.objectTypes[oid]) err("ACTION_OBJECT_DANGLING", base, id + " names missing object " + oid);
      });
      if (a.cortexTool && !a.requiresConfirm) warn("ACTION_WRITE_NO_CONFIRM", base, id + " has tool " + a.cortexTool + " but requiresConfirm is off", "turn requiresConfirm on");
      a.params.forEach(function (p, i) {
        if (!PROP_RE.test(p.id || "")) err("ID_INVALID", base + ".params." + i, id + " param " + (p.id || "(empty)") + " must match " + PROP_RE);
        if (TYPES.indexOf(p.type) < 0) err("PROP_BAD_TYPE", base + ".params." + i, id + " param " + p.id + " type " + p.type);
      });
    });

    Object.keys(o.interfaces).forEach(function (id) {
      const base = "interfaces." + id;
      if (!IFACE_RE.test(id)) err("ID_INVALID", base, "interface id " + id + " must match " + IFACE_RE);
      Object.keys(o.interfaces[id].properties).forEach(function (pid) {
        const p = o.interfaces[id].properties[pid];
        if (!PROP_RE.test(pid)) err("ID_INVALID", base + ".properties." + pid, "interface property id " + pid + " must match " + PROP_RE);
        if (TYPES.indexOf(p.type) < 0) err("PROP_BAD_TYPE", base + ".properties." + pid, id + "." + pid + " type " + p.type);
      });
    });

    Object.keys(o.fetchPlaces).forEach(function (id) {
      const base = "fetchPlaces." + id;
      if (!ID_RE.test(id)) err("ID_INVALID", base, "place id " + id + " must match " + ID_RE);
      if (!o.objectTypes[o.fetchPlaces[id].object]) err("PLACE_OBJECT_DANGLING", base, id + " names missing object " + o.fetchPlaces[id].object);
    });

    return { ok: !errors.length, errors: errors, warnings: warnings, infos: infos, issues: errors.concat(warnings, infos) };
  }

  /* ---------- diff ---------- */

  const COLLECTIONS = ["objectTypes", "linkTypes", "actionTypes", "interfaces", "fetchPlaces"];

  function diffValues(path, a, b, out) {
    if (a === undefined && b === undefined) return;
    if (a === undefined) {
      out.push({ op: "add", path: path, before: undefined, after: clone(b) });
      return;
    }
    if (b === undefined) {
      out.push({ op: "remove", path: path, before: clone(a), after: undefined });
      return;
    }
    const ao = a && typeof a === "object" && !Array.isArray(a);
    const bo = b && typeof b === "object" && !Array.isArray(b);
    if (ao && bo) {
      const keys = {};
      Object.keys(a).forEach(function (k) {
        keys[k] = true;
      });
      Object.keys(b).forEach(function (k) {
        keys[k] = true;
      });
      Object.keys(keys).forEach(function (k) {
        if (k === "layout") return;
        diffValues(path + "." + k, a[k], b[k], out);
      });
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ op: "update", path: path, before: clone(a), after: clone(b) });
  }

  function diff(a, b) {
    const out = [];
    COLLECTIONS.forEach(function (col) {
      const ca = (a && a[col]) || {};
      const cb = (b && b[col]) || {};
      const keys = {};
      Object.keys(ca).forEach(function (k) {
        keys[k] = true;
      });
      Object.keys(cb).forEach(function (k) {
        keys[k] = true;
      });
      Object.keys(keys).forEach(function (k) {
        diffValues(col + "." + k, ca[k], cb[k], out);
      });
    });
    if (a && b && a.name !== b.name) out.push({ op: "update", path: "name", before: a.name, after: b.name });
    return out;
  }

  /* ---------- commit / undo / persistence ---------- */

  function notify(change) {
    subscribers.slice().forEach(function (fn) {
      try {
        fn(current, change);
      } catch (err) {
        /* a bad subscriber must not break the model */
      }
    });
  }

  function save() {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return true;
    } catch (err) {
      return false;
    }
  }

  function restore() {
    try {
      if (typeof localStorage === "undefined") return false;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schema !== SCHEMA) return false;
      const n = normalize(parsed);
      if (!n.ok) return false;
      current = n.value;
      return true;
    } catch (err) {
      return false;
    }
  }

  function snapshot() {
    undoStack.push(clone(current));
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;
  }

  function commit(op, path, before, after) {
    current.revision = (current.revision || 0) + 1;
    const entry = { rev: current.revision, at: nowIso(), op: op, path: path };
    if (before !== undefined) entry.before = clone(before);
    if (after !== undefined) entry.after = clone(after);
    current.changelog.push(entry);
    if (current.changelog.length > CHANGELOG_LIMIT) current.changelog.splice(0, current.changelog.length - CHANGELOG_LIMIT);
    save();
    notify(entry);
    return { ok: true, errors: [], change: entry };
  }

  function mutate(op, path, fn) {
    const before = clone(current);
    const errors = fn(current) || [];
    if (errors.length) {
      current = before;
      return result(errors);
    }
    undoStack.push(before);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;
    const beforeItem = readPath(before, path);
    const afterItem = readPath(current, path);
    return commit(op, path, beforeItem, afterItem);
  }

  function readPath(o, path) {
    if (!path) return undefined;
    let cur = o;
    const parts = path.split(".");
    for (let i = 0; i < parts.length; i++) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(clone(current));
    current = undoStack.pop();
    save();
    notify({ rev: current.revision, at: nowIso(), op: "undo", path: "" });
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(clone(current));
    current = redoStack.pop();
    save();
    notify({ rev: current.revision, at: nowIso(), op: "redo", path: "" });
    return true;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    subscribers.push(fn);
    return function () {
      const i = subscribers.indexOf(fn);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }

  /* ---------- load / import ---------- */

  function load(raw) {
    const n = normalize(raw);
    if (!n.ok) return result(n.errors);
    snapshot();
    const prevRev = current ? current.revision : 0;
    current = n.value;
    current.revision = Math.max(prevRev, current.revision || 0);
    return commit("load", "", undefined, { name: current.name, objects: Object.keys(current.objectTypes).length });
  }

  function reset() {
    return load(seed());
  }

  function importJSON(text) {
    let parsed;
    try {
      parsed = typeof text === "string" ? JSON.parse(text) : text;
    } catch (err) {
      return result(["not JSON: " + String(err && err.message ? err.message : err)]);
    }
    if (!parsed || typeof parsed !== "object") return result(["import must be a JSON object"]);
    if (parsed.schema === SCHEMA || parsed.objectTypes) return load(parsed);
    if (parsed.objects && typeof parsed.objects === "object") return load(fromCatalog(parsed));
    return result(["unknown shape: expected schema " + SCHEMA + " or a Cortex catalog with objects"]);
  }

  /* ---------- mutations: object types ---------- */

  function addObjectType(id, patch) {
    patch = patch || {};
    return mutate("add", "objectTypes." + id, function (o) {
      if (!ID_RE.test(String(id))) return ["object id must match " + ID_RE];
      if (o.objectTypes[id]) return ["object " + id + " already exists"];
      const properties = {};
      const src = patch.properties && typeof patch.properties === "object" ? patch.properties : null;
      if (src) {
        Object.keys(src).forEach(function (pid) {
          properties[pid] = Object.assign({ id: pid, type: "string", required: false, pii: false, description: "" }, src[pid], { id: pid });
        });
      }
      if (!Object.keys(properties).length) properties.id = { id: "id", type: "string", required: true, pii: false, description: "Primary key." };
      const pk = patch.primaryKey && properties[patch.primaryKey] ? patch.primaryKey : Object.keys(properties)[0];
      o.objectTypes[id] = {
        id: id,
        label: patch.label || titleCase(id),
        description: patch.description || "",
        color: patch.color || pickColor(id),
        primaryKey: pk,
        titleKey: patch.titleKey && properties[patch.titleKey] ? patch.titleKey : null,
        interfaces: Array.isArray(patch.interfaces) ? patch.interfaces.slice() : [],
        properties: properties,
      };
      if (patch.layout) o.objectTypes[id].layout = { x: Number(patch.layout.x) || 0, y: Number(patch.layout.y) || 0 };
      return [];
    });
  }

  function updateObjectType(id, patch) {
    patch = patch || {};
    return mutate("update", "objectTypes." + id, function (o) {
      const t = o.objectTypes[id];
      if (!t) return ["object " + id + " not found"];
      const errors = [];
      if (patch.label !== undefined) t.label = String(patch.label);
      if (patch.description !== undefined) t.description = String(patch.description);
      if (patch.color !== undefined) t.color = String(patch.color);
      if (patch.primaryKey !== undefined) {
        if (patch.primaryKey && !t.properties[patch.primaryKey]) errors.push("primary key " + patch.primaryKey + " is not a property of " + id);
        else t.primaryKey = patch.primaryKey || null;
      }
      if (patch.titleKey !== undefined) {
        if (patch.titleKey && !t.properties[patch.titleKey]) errors.push("title key " + patch.titleKey + " is not a property of " + id);
        else t.titleKey = patch.titleKey || null;
      }
      if (patch.interfaces !== undefined) {
        if (!Array.isArray(patch.interfaces)) errors.push("interfaces must be an array");
        else t.interfaces = patch.interfaces.map(String);
      }
      if (patch.layout !== undefined) t.layout = { x: Number(patch.layout.x) || 0, y: Number(patch.layout.y) || 0 };
      return errors;
    });
  }

  function removeObjectType(id) {
    return mutate("remove", "objectTypes." + id, function (o) {
      if (!o.objectTypes[id]) return ["object " + id + " not found"];
      delete o.objectTypes[id];
      Object.keys(o.linkTypes).forEach(function (lid) {
        if (o.linkTypes[lid].from === id || o.linkTypes[lid].to === id) delete o.linkTypes[lid];
      });
      Object.keys(o.actionTypes).forEach(function (aid) {
        o.actionTypes[aid].objects = o.actionTypes[aid].objects.filter(function (x) {
          return x !== id;
        });
      });
      Object.keys(o.fetchPlaces).forEach(function (pid) {
        if (o.fetchPlaces[pid].object === id) delete o.fetchPlaces[pid];
      });
      Object.keys(o.objectTypes).forEach(function (oid) {
        Object.keys(o.objectTypes[oid].properties).forEach(function (pid) {
          const p = o.objectTypes[oid].properties[pid];
          if (p.type === "ref" && p.ref === id) {
            p.type = "string";
            delete p.ref;
          }
        });
      });
      return [];
    });
  }

  function renameObjectType(oldId, newId) {
    return mutate("rename", "objectTypes." + newId, function (o) {
      if (!o.objectTypes[oldId]) return ["object " + oldId + " not found"];
      if (!ID_RE.test(String(newId))) return ["object id must match " + ID_RE];
      if (o.objectTypes[newId]) return ["object " + newId + " already exists"];
      const rebuilt = {};
      Object.keys(o.objectTypes).forEach(function (k) {
        if (k === oldId) {
          rebuilt[newId] = Object.assign(o.objectTypes[oldId], { id: newId });
        } else rebuilt[k] = o.objectTypes[k];
      });
      o.objectTypes = rebuilt;
      Object.keys(o.linkTypes).forEach(function (lid) {
        if (o.linkTypes[lid].from === oldId) o.linkTypes[lid].from = newId;
        if (o.linkTypes[lid].to === oldId) o.linkTypes[lid].to = newId;
      });
      Object.keys(o.actionTypes).forEach(function (aid) {
        o.actionTypes[aid].objects = o.actionTypes[aid].objects.map(function (x) {
          return x === oldId ? newId : x;
        });
      });
      Object.keys(o.fetchPlaces).forEach(function (pid) {
        if (o.fetchPlaces[pid].object === oldId) o.fetchPlaces[pid].object = newId;
      });
      Object.keys(o.objectTypes).forEach(function (oid) {
        Object.keys(o.objectTypes[oid].properties).forEach(function (pid) {
          const p = o.objectTypes[oid].properties[pid];
          if (p.type === "ref" && p.ref === oldId) p.ref = newId;
        });
      });
      return [];
    });
  }

  /* ---------- mutations: properties ---------- */

  function addProperty(objId, propId, patch) {
    patch = patch || {};
    return mutate("add", "objectTypes." + objId + ".properties." + propId, function (o) {
      const t = o.objectTypes[objId];
      if (!t) return ["object " + objId + " not found"];
      if (!PROP_RE.test(String(propId))) return ["property id must match " + PROP_RE];
      if (t.properties[propId]) return ["property " + objId + "." + propId + " already exists"];
      const type = patch.type === undefined ? "string" : patch.type;
      if (TYPES.indexOf(type) < 0) return ["type must be one of " + TYPES.join(", ")];
      const p = { id: propId, type: type, required: !!patch.required, pii: !!patch.pii, description: patch.description ? String(patch.description) : "" };
      if (patch.unit) p.unit = String(patch.unit);
      if (patch.label) p.label = String(patch.label);
      if (type === "ref") p.ref = patch.ref ? String(patch.ref) : "";
      if (Array.isArray(patch.enum)) p.enum = patch.enum.slice();
      t.properties[propId] = p;
      if (!t.primaryKey) t.primaryKey = propId;
      return [];
    });
  }

  function updateProperty(objId, propId, patch) {
    patch = patch || {};
    return mutate("update", "objectTypes." + objId + ".properties." + propId, function (o) {
      const t = o.objectTypes[objId];
      if (!t) return ["object " + objId + " not found"];
      const p = t.properties[propId];
      if (!p) return ["property " + objId + "." + propId + " not found"];
      if (patch.type !== undefined) {
        if (TYPES.indexOf(patch.type) < 0) return ["type must be one of " + TYPES.join(", ")];
        p.type = patch.type;
        if (patch.type !== "ref") delete p.ref;
        else if (p.ref === undefined) p.ref = "";
      }
      if (patch.ref !== undefined) p.ref = String(patch.ref);
      if (patch.required !== undefined) p.required = !!patch.required;
      if (patch.pii !== undefined) p.pii = !!patch.pii;
      if (patch.description !== undefined) p.description = String(patch.description);
      if (patch.label !== undefined) p.label = String(patch.label);
      if (patch.unit !== undefined) {
        if (patch.unit) p.unit = String(patch.unit);
        else delete p.unit;
      }
      if (patch.enum !== undefined) {
        if (Array.isArray(patch.enum) && patch.enum.length) p.enum = patch.enum.slice();
        else delete p.enum;
      }
      return [];
    });
  }

  function renameProperty(objId, oldId, newId) {
    return mutate("rename", "objectTypes." + objId + ".properties." + newId, function (o) {
      const t = o.objectTypes[objId];
      if (!t) return ["object " + objId + " not found"];
      if (!t.properties[oldId]) return ["property " + objId + "." + oldId + " not found"];
      if (!PROP_RE.test(String(newId))) return ["property id must match " + PROP_RE];
      if (oldId === newId) return [];
      if (t.properties[newId]) return ["property " + objId + "." + newId + " already exists"];
      const rebuilt = {};
      Object.keys(t.properties).forEach(function (k) {
        if (k === oldId) rebuilt[newId] = Object.assign(t.properties[oldId], { id: newId });
        else rebuilt[k] = t.properties[k];
      });
      t.properties = rebuilt;
      if (t.primaryKey === oldId) t.primaryKey = newId;
      if (t.titleKey === oldId) t.titleKey = newId;
      Object.keys(o.linkTypes).forEach(function (lid) {
        if (o.linkTypes[lid].from === objId && o.linkTypes[lid].via === oldId) o.linkTypes[lid].via = newId;
      });
      return [];
    });
  }

  function removeProperty(objId, propId) {
    return mutate("remove", "objectTypes." + objId + ".properties." + propId, function (o) {
      const t = o.objectTypes[objId];
      if (!t) return ["object " + objId + " not found"];
      if (!t.properties[propId]) return ["property " + objId + "." + propId + " not found"];
      delete t.properties[propId];
      if (t.primaryKey === propId) t.primaryKey = null;
      if (t.titleKey === propId) t.titleKey = null;
      return [];
    });
  }

  /* ---------- mutations: links ---------- */

  function addLinkType(id, patch) {
    patch = patch || {};
    return mutate("add", "linkTypes." + id, function (o) {
      if (!ID_RE.test(String(id))) return ["link id must match " + ID_RE];
      if (o.linkTypes[id]) return ["link " + id + " already exists"];
      if (!patch.from || !patch.to) return ["link needs from and to"];
      if (patch.cardinality && CARDINALITIES.indexOf(patch.cardinality) < 0) return ["cardinality must be one of " + CARDINALITIES.join(", ")];
      o.linkTypes[id] = {
        id: id,
        label: patch.label || titleCase(id),
        from: String(patch.from),
        to: String(patch.to),
        via: patch.via ? String(patch.via) : "",
        cardinality: patch.cardinality || "many_to_one",
        inverse: patch.inverse ? String(patch.inverse) : "",
        description: patch.description ? String(patch.description) : "",
      };
      return [];
    });
  }

  function updateLinkType(id, patch) {
    patch = patch || {};
    return mutate("update", "linkTypes." + id, function (o) {
      const l = o.linkTypes[id];
      if (!l) return ["link " + id + " not found"];
      if (patch.cardinality !== undefined && CARDINALITIES.indexOf(patch.cardinality) < 0) return ["cardinality must be one of " + CARDINALITIES.join(", ")];
      ["label", "from", "to", "via", "cardinality", "inverse", "description"].forEach(function (k) {
        if (patch[k] !== undefined) l[k] = String(patch[k]);
      });
      return [];
    });
  }

  function removeLinkType(id) {
    return mutate("remove", "linkTypes." + id, function (o) {
      if (!o.linkTypes[id]) return ["link " + id + " not found"];
      delete o.linkTypes[id];
      return [];
    });
  }

  /* ---------- mutations: actions ---------- */

  function normParams(params) {
    if (!Array.isArray(params)) return null;
    const out = [];
    for (let i = 0; i < params.length; i++) {
      const p = params[i] || {};
      out.push({ id: String(p.id || ""), type: TYPES.indexOf(p.type) >= 0 ? p.type : "string", required: !!p.required });
    }
    return out;
  }

  function addActionType(id, patch) {
    patch = patch || {};
    return mutate("add", "actionTypes." + id, function (o) {
      if (!ID_RE.test(String(id))) return ["action id must match " + ID_RE];
      if (o.actionTypes[id]) return ["action " + id + " already exists"];
      o.actionTypes[id] = {
        id: id,
        label: patch.label || titleCase(id),
        objects: Array.isArray(patch.objects) && patch.objects.length ? patch.objects.map(String) : ["*"],
        params: normParams(patch.params) || [],
        requiresConfirm: patch.requiresConfirm === undefined ? true : !!patch.requiresConfirm,
        cortexTool: patch.cortexTool ? String(patch.cortexTool) : null,
        description: patch.description ? String(patch.description) : "",
      };
      return [];
    });
  }

  function updateActionType(id, patch) {
    patch = patch || {};
    return mutate("update", "actionTypes." + id, function (o) {
      const a = o.actionTypes[id];
      if (!a) return ["action " + id + " not found"];
      if (patch.label !== undefined) a.label = String(patch.label);
      if (patch.description !== undefined) a.description = String(patch.description);
      if (patch.objects !== undefined) {
        if (!Array.isArray(patch.objects)) return ["objects must be an array"];
        a.objects = patch.objects.map(String);
      }
      if (patch.params !== undefined) {
        const p = normParams(patch.params);
        if (!p) return ["params must be an array"];
        a.params = p;
      }
      if (patch.requiresConfirm !== undefined) a.requiresConfirm = !!patch.requiresConfirm;
      if (patch.cortexTool !== undefined) a.cortexTool = patch.cortexTool ? String(patch.cortexTool) : null;
      return [];
    });
  }

  function removeActionType(id) {
    return mutate("remove", "actionTypes." + id, function (o) {
      if (!o.actionTypes[id]) return ["action " + id + " not found"];
      delete o.actionTypes[id];
      return [];
    });
  }

  /* ---------- mutations: interfaces ---------- */

  function addInterface(id, patch) {
    patch = patch || {};
    return mutate("add", "interfaces." + id, function (o) {
      if (!IFACE_RE.test(String(id))) return ["interface id must match " + IFACE_RE];
      if (o.interfaces[id]) return ["interface " + id + " already exists"];
      const properties = {};
      const src = patch.properties && typeof patch.properties === "object" ? patch.properties : {};
      Object.keys(src).forEach(function (pid) {
        properties[pid] = { id: pid, type: TYPES.indexOf(src[pid].type) >= 0 ? src[pid].type : "string", required: !!src[pid].required, description: src[pid].description || "" };
      });
      o.interfaces[id] = { id: id, label: patch.label || id, description: patch.description || "", properties: properties };
      return [];
    });
  }

  function updateInterface(id, patch) {
    patch = patch || {};
    return mutate("update", "interfaces." + id, function (o) {
      const it = o.interfaces[id];
      if (!it) return ["interface " + id + " not found"];
      if (patch.label !== undefined) it.label = String(patch.label);
      if (patch.description !== undefined) it.description = String(patch.description);
      if (patch.properties !== undefined) {
        if (!patch.properties || typeof patch.properties !== "object") return ["properties must be an object"];
        const properties = {};
        Object.keys(patch.properties).forEach(function (pid) {
          const s = patch.properties[pid] || {};
          properties[pid] = { id: pid, type: TYPES.indexOf(s.type) >= 0 ? s.type : "string", required: !!s.required, description: s.description || "" };
        });
        it.properties = properties;
      }
      return [];
    });
  }

  function removeInterface(id) {
    return mutate("remove", "interfaces." + id, function (o) {
      if (!o.interfaces[id]) return ["interface " + id + " not found"];
      delete o.interfaces[id];
      Object.keys(o.objectTypes).forEach(function (oid) {
        o.objectTypes[oid].interfaces = o.objectTypes[oid].interfaces.filter(function (x) {
          return x !== id;
        });
      });
      return [];
    });
  }

  /* ---------- mutations: fetch places ---------- */

  function addFetchPlace(id, patch) {
    patch = patch || {};
    return mutate("add", "fetchPlaces." + id, function (o) {
      if (!ID_RE.test(String(id))) return ["place id must match " + ID_RE];
      if (o.fetchPlaces[id]) return ["place " + id + " already exists"];
      if (patch.kind && PLACE_KINDS.indexOf(patch.kind) < 0) return ["kind must be one of " + PLACE_KINDS.join(", ")];
      o.fetchPlaces[id] = { id: id, object: patch.object ? String(patch.object) : Object.keys(o.objectTypes)[0] || "", kind: patch.kind || "place" };
      return [];
    });
  }

  function updateFetchPlace(id, patch) {
    patch = patch || {};
    return mutate("update", "fetchPlaces." + id, function (o) {
      const p = o.fetchPlaces[id];
      if (!p) return ["place " + id + " not found"];
      if (patch.kind !== undefined && PLACE_KINDS.indexOf(patch.kind) < 0) return ["kind must be one of " + PLACE_KINDS.join(", ")];
      if (patch.object !== undefined) p.object = String(patch.object);
      if (patch.kind !== undefined) p.kind = patch.kind;
      return [];
    });
  }

  function removeFetchPlace(id) {
    return mutate("remove", "fetchPlaces." + id, function (o) {
      if (!o.fetchPlaces[id]) return ["place " + id + " not found"];
      delete o.fetchPlaces[id];
      return [];
    });
  }

  function setLayout(objId, pos) {
    const t = current.objectTypes[objId];
    if (!t || !pos) return result(["object " + objId + " not found"]);
    t.layout = { x: Math.round(Number(pos.x) || 0), y: Math.round(Number(pos.y) || 0) };
    save();
    return result([]);
  }

  /* ---------- queries ---------- */

  function actionsForObject(objId) {
    const o = current;
    return Object.keys(o.actionTypes).filter(function (id) {
      const objs = o.actionTypes[id].objects;
      return objs.indexOf("*") >= 0 || objs.indexOf(objId) >= 0;
    });
  }

  function linksFor(objId) {
    const o = current;
    return Object.keys(o.linkTypes)
      .filter(function (id) {
        return o.linkTypes[id].from === objId || o.linkTypes[id].to === objId;
      })
      .map(function (id) {
        return clone(o.linkTypes[id]);
      });
  }

  function propertyType(objId, propId) {
    const t = current.objectTypes[objId];
    if (!t || !t.properties[propId]) return null;
    return t.properties[propId].type;
  }

  /* ---------- exports ---------- */

  const NS = "https://netie.ai/ontology#";
  const XSD = { string: "xsd:string", number: "xsd:decimal", integer: "xsd:integer", boolean: "xsd:boolean", date: "xsd:date", datetime: "xsd:dateTime", geo: "netie:GeoPoint", json: "xsd:string", ref: null };

  function ttlStr(s) {
    return '"' + String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
  }

  function exportJSON() {
    return JSON.stringify(current, null, 2);
  }

  function exportCortex() {
    return JSON.stringify(toCatalog(), null, 2);
  }

  function exportJSONLD() {
    const o = current;
    const graph = [];
    Object.keys(o.interfaces).forEach(function (id) {
      const it = o.interfaces[id];
      graph.push({
        "@id": "netie:" + id,
        "@type": "owl:Class",
        "rdfs:label": it.label,
        "rdfs:comment": it.description,
        "netie:interface": true,
        "netie:requires": Object.keys(it.properties).map(function (pid) {
          return { "@id": "netie:" + id + "." + pid, "@type": "owl:DatatypeProperty", "rdfs:range": XSD[it.properties[pid].type] || "xsd:string" };
        }),
      });
    });
    Object.keys(o.objectTypes).forEach(function (id) {
      const t = o.objectTypes[id];
      const cls = {
        "@id": "netie:" + id,
        "@type": "owl:Class",
        "rdfs:label": t.label,
        "rdfs:comment": t.description,
        "netie:primaryKey": t.primaryKey,
        "netie:titleKey": t.titleKey,
        "netie:color": t.color,
      };
      if (t.interfaces.length) {
        cls["rdfs:subClassOf"] = t.interfaces.map(function (iid) {
          return { "@id": "netie:" + iid };
        });
      }
      graph.push(cls);
      Object.keys(t.properties).forEach(function (pid) {
        const p = t.properties[pid];
        const node = {
          "@id": "netie:" + id + "." + pid,
          "@type": p.type === "ref" ? "owl:ObjectProperty" : "owl:DatatypeProperty",
          "rdfs:label": p.label || pid,
          "rdfs:comment": p.description,
          "rdfs:domain": { "@id": "netie:" + id },
          "rdfs:range": p.type === "ref" ? { "@id": "netie:" + (p.ref || "") } : XSD[p.type] || "xsd:string",
          "netie:required": !!p.required,
          "netie:pii": !!p.pii,
        };
        if (p.unit) node["netie:unit"] = p.unit;
        graph.push(node);
      });
    });
    Object.keys(o.linkTypes).forEach(function (id) {
      const l = o.linkTypes[id];
      graph.push({
        "@id": "netie:" + id,
        "@type": "owl:ObjectProperty",
        "rdfs:label": l.label,
        "rdfs:comment": l.description,
        "rdfs:domain": { "@id": "netie:" + l.from },
        "rdfs:range": { "@id": "netie:" + l.to },
        "netie:via": { "@id": "netie:" + l.from + "." + l.via },
        "netie:cardinality": l.cardinality,
        "netie:inverse": l.inverse,
      });
    });
    Object.keys(o.actionTypes).forEach(function (id) {
      const a = o.actionTypes[id];
      graph.push({
        "@id": "netie:" + id,
        "@type": "netie:ActionType",
        "rdfs:label": a.label,
        "rdfs:comment": a.description,
        "netie:appliesTo": a.objects.map(function (x) {
          return x === "*" ? { "@id": "owl:Thing" } : { "@id": "netie:" + x };
        }),
        "netie:params": a.params.map(function (p) {
          return { "netie:id": p.id, "rdfs:range": XSD[p.type] || "xsd:string", "netie:required": !!p.required };
        }),
        "netie:requiresConfirm": !!a.requiresConfirm,
        "netie:cortexTool": a.cortexTool,
      });
    });
    Object.keys(o.fetchPlaces).forEach(function (id) {
      const p = o.fetchPlaces[id];
      graph.push({ "@id": "netie:place/" + id, "@type": "netie:FetchPlace", "netie:object": { "@id": "netie:" + p.object }, "netie:kind": p.kind });
    });
    return JSON.stringify(
      {
        "@context": {
          netie: NS,
          owl: "http://www.w3.org/2002/07/owl#",
          rdfs: "http://www.w3.org/2000/01/rdf-schema#",
          xsd: "http://www.w3.org/2001/XMLSchema#",
          schema: "https://schema.org/",
        },
        "@id": "netie:" + o.name,
        "@type": "owl:Ontology",
        "rdfs:label": o.name,
        "netie:revision": o.revision,
        "netie:engine": "cortex",
        "@graph": graph,
      },
      null,
      2
    );
  }

  function exportTurtle() {
    const o = current;
    const lines = [
      "@prefix netie: <" + NS + "> .",
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
      "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
      "",
      "netie:" + o.name + " a owl:Ontology ;",
      "  rdfs:label " + ttlStr(o.name) + " ;",
      "  netie:revision " + (o.revision || 0) + " ;",
      "  netie:engine " + ttlStr("cortex") + " .",
      "",
    ];
    Object.keys(o.interfaces).forEach(function (id) {
      const it = o.interfaces[id];
      lines.push("netie:" + id + " a owl:Class ;");
      lines.push("  rdfs:label " + ttlStr(it.label) + " ;");
      if (it.description) lines.push("  rdfs:comment " + ttlStr(it.description) + " ;");
      lines.push("  netie:interface true .");
      Object.keys(it.properties).forEach(function (pid) {
        lines.push("netie:" + id + "." + pid + " a owl:DatatypeProperty ; rdfs:domain netie:" + id + " ; rdfs:range " + (XSD[it.properties[pid].type] || "xsd:string") + " .");
      });
      lines.push("");
    });
    Object.keys(o.objectTypes).forEach(function (id) {
      const t = o.objectTypes[id];
      lines.push("netie:" + id + " a owl:Class ;");
      lines.push("  rdfs:label " + ttlStr(t.label) + " ;");
      if (t.description) lines.push("  rdfs:comment " + ttlStr(t.description) + " ;");
      t.interfaces.forEach(function (iid) {
        lines.push("  rdfs:subClassOf netie:" + iid + " ;");
      });
      if (t.titleKey) lines.push("  netie:titleKey " + ttlStr(t.titleKey) + " ;");
      lines.push("  netie:primaryKey " + ttlStr(t.primaryKey || "") + " .");
      Object.keys(t.properties).forEach(function (pid) {
        const p = t.properties[pid];
        const range = p.type === "ref" ? "netie:" + (p.ref || "owl:Thing") : XSD[p.type] || "xsd:string";
        lines.push(
          "netie:" + id + "." + pid + " a " + (p.type === "ref" ? "owl:ObjectProperty" : "owl:DatatypeProperty") + " ;"
        );
        lines.push("  rdfs:label " + ttlStr(p.label || pid) + " ;");
        if (p.description) lines.push("  rdfs:comment " + ttlStr(p.description) + " ;");
        lines.push("  rdfs:domain netie:" + id + " ;");
        lines.push("  rdfs:range " + range + " ;");
        if (p.unit) lines.push("  netie:unit " + ttlStr(p.unit) + " ;");
        lines.push("  netie:required " + (p.required ? "true" : "false") + " ;");
        lines.push("  netie:pii " + (p.pii ? "true" : "false") + " .");
      });
      lines.push("");
    });
    Object.keys(o.linkTypes).forEach(function (id) {
      const l = o.linkTypes[id];
      lines.push("netie:" + id + " a owl:ObjectProperty ;");
      lines.push("  rdfs:label " + ttlStr(l.label) + " ;");
      if (l.description) lines.push("  rdfs:comment " + ttlStr(l.description) + " ;");
      lines.push("  rdfs:domain netie:" + l.from + " ;");
      lines.push("  rdfs:range netie:" + l.to + " ;");
      lines.push("  netie:via netie:" + l.from + "." + l.via + " ;");
      if (l.inverse) lines.push("  netie:inverse " + ttlStr(l.inverse) + " ;");
      lines.push("  netie:cardinality " + ttlStr(l.cardinality) + " .");
    });
    lines.push("");
    Object.keys(o.actionTypes).forEach(function (id) {
      const a = o.actionTypes[id];
      lines.push("netie:" + id + " a netie:ActionType ;");
      lines.push("  rdfs:label " + ttlStr(a.label) + " ;");
      if (a.description) lines.push("  rdfs:comment " + ttlStr(a.description) + " ;");
      a.objects.forEach(function (x) {
        lines.push("  netie:appliesTo " + (x === "*" ? "owl:Thing" : "netie:" + x) + " ;");
      });
      a.params.forEach(function (p) {
        lines.push("  netie:param [ netie:id " + ttlStr(p.id) + " ; rdfs:range " + (XSD[p.type] || "xsd:string") + " ; netie:required " + (p.required ? "true" : "false") + " ] ;");
      });
      if (a.cortexTool) lines.push("  netie:cortexTool " + ttlStr(a.cortexTool) + " ;");
      lines.push("  netie:requiresConfirm " + (a.requiresConfirm ? "true" : "false") + " .");
    });
    lines.push("");
    Object.keys(o.fetchPlaces).forEach(function (id) {
      const p = o.fetchPlaces[id];
      lines.push("netie:place\\/" + id.replace(/\./g, "\\.") + " a netie:FetchPlace ; netie:object netie:" + p.object + " ; netie:kind " + ttlStr(p.kind) + " .");
    });
    return lines.join("\n") + "\n";
  }

  /* ---------- boot ---------- */

  if (!restore()) current = seed();

  return {
    SCHEMA: SCHEMA,
    STORAGE_KEY: STORAGE_KEY,
    TYPES: TYPES.slice(),
    CARDINALITIES: CARDINALITIES.slice(),
    PLACE_KINDS: PLACE_KINDS.slice(),
    get: function () {
      return current;
    },
    seed: seed,
    reset: reset,
    load: load,
    importJSON: importJSON,
    fromCatalog: fromCatalog,
    toCatalog: toCatalog,
    exportJSON: exportJSON,
    exportCortex: exportCortex,
    exportJSONLD: exportJSONLD,
    exportTurtle: exportTurtle,
    addObjectType: addObjectType,
    updateObjectType: updateObjectType,
    removeObjectType: removeObjectType,
    renameObjectType: renameObjectType,
    addProperty: addProperty,
    updateProperty: updateProperty,
    renameProperty: renameProperty,
    removeProperty: removeProperty,
    addLinkType: addLinkType,
    updateLinkType: updateLinkType,
    removeLinkType: removeLinkType,
    addActionType: addActionType,
    updateActionType: updateActionType,
    removeActionType: removeActionType,
    addInterface: addInterface,
    updateInterface: updateInterface,
    removeInterface: removeInterface,
    addFetchPlace: addFetchPlace,
    updateFetchPlace: updateFetchPlace,
    removeFetchPlace: removeFetchPlace,
    setLayout: setLayout,
    validate: validate,
    diff: diff,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    subscribe: subscribe,
    save: save,
    restore: restore,
    actionsForObject: actionsForObject,
    linksFor: linksFor,
    propertyType: propertyType,
  };
});
