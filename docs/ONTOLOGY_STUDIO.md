# Ontology Studio contract

Constructor's ontology editor. Distills Palantir Foundry Ontology Manager (object types, properties, link types, action types, interfaces), n8n-style direct canvas editing, and Semantica's ontology layer (validation shapes, provenance changelog, OWL/JSON-LD export). It does not clone any of them.

Laws (unchanged): Cortex is the only engine. Pages has zero `fetch` in `app.js`, `ontology.js`, `ontology-studio.js`. Only `engine.js` may fetch, only on a `/cortex` origin. No keys in the repo. No n8n, no Activepieces.

## Files and ownership

| File | Owner | Role |
|------|-------|------|
| `ontology.js` | model lane | Pure data model, mutations, validation, diff, undo, import/export. UMD: `module.exports` under Node, `window.Ontology` in the browser. No DOM. |
| `ontology-studio.js` | studio lane | Workbench UI. Builds its own DOM (`#ontology-studio`) at load. Talks only to `window.Ontology` and `window.Constructor`. |
| `ontology.css` | studio lane | Studio styles. Reuses tokens from `styles.css` (`--panel`, `--border`, `--muted`, `--text`). |
| `app.js`, `engine.js`, `index.html`, `styles.css` | integration lane | Canvas, chat, Cortex bridge. `OBJECTS` / `LINKS` / `ACTION_META` / `FETCH_PLACES` become views over `Ontology`. |
| `tests/unit/*.test.js` | model lane | `node --test`. |
| `tests/e2e/*.spec.js`, `playwright.config.js`, `package.json`, `scripts/check-laws.js`, `.github/workflows/ci.yml` | qa lane | Playwright e2e with screenshots, law checks, CI. |

Script order in `index.html`: `ontology.js` -> `app.js` -> `ontology-studio.js` -> `engine.js`. `pages.yml` must copy every new file.

## Data model (native shape)

```js
{
  schema: "netie.ontology/1",
  name: "dms",
  revision: 12,                      // bumps on every committed mutation
  objectTypes: {
    inventory: {
      id: "inventory",
      label: "Inventory",
      description: "Warehouse stock rows.",
      color: "#7eb8ff",
      primaryKey: "sku",
      titleKey: "sku_name",
      interfaces: ["Locatable"],
      properties: {
        sku:        { id: "sku", type: "string", required: true,  pii: false, description: "" },
        quantity_kg:{ id: "quantity_kg", type: "number", required: false, pii: false, unit: "kg" },
        location_id:{ id: "location_id", type: "ref", ref: "locations" }
      },
      layout: { x: 120, y: 80 }      // studio graph position, optional
    }
  },
  linkTypes: {
    inventory_location: {
      id: "inventory_location",
      label: "stored at",
      from: "inventory",
      to: "locations",
      via: "location_id",             // property on `from` that holds the `to` primary key
      cardinality: "many_to_one",     // one_to_one | many_to_one | one_to_many | many_to_many
      inverse: "holds",
      description: ""
    }
  },
  actionTypes: {
    "item.intake": {
      id: "item.intake",
      label: "Item intake",
      objects: ["inventory"],         // "*" means any object
      params: [{ id: "quantity_kg", type: "number", required: true }],
      requiresConfirm: true,
      cortexTool: "item.intake",      // F8 tool name, or null for read-only
      description: ""
    }
  },
  interfaces: {
    Locatable: {
      id: "Locatable",
      label: "Locatable",
      properties: { latitude: { id: "latitude", type: "number" }, longitude: { id: "longitude", type: "number" } }
    }
  },
  fetchPlaces: {
    "warehouse.inventory": { id: "warehouse.inventory", object: "inventory", kind: "place" }
  },
  changelog: [
    { rev: 12, at: "2026-09-03T08:00:00Z", op: "update", path: "objectTypes.inventory.properties.sku", before: {...}, after: {...} }
  ]
}
```

Property `type` is one of `string | number | integer | boolean | date | datetime | geo | json | ref`. `ref` requires `ref: <objectTypeId>`.

## `window.Ontology` API (also `module.exports`)

```js
Ontology.get()                                  // live ontology object; treat as read-only outside ontology.js
Ontology.seed()                                 // default DMS ontology (mirrors current OBJECTS/LINKS/ACTION_META/FETCH_PLACES in app.js)
Ontology.reset()                                // replace with seed(), commit
Ontology.load(obj)                              // replace with a native-shape object -> { ok, errors }
Ontology.importJSON(text)                       // native JSON or Cortex catalog JSON -> { ok, errors }
Ontology.fromCatalog(catalog)                   // Cortex GET /cortex/constructor/ontology shape -> native (does not commit)
Ontology.toCatalog()                            // -> { objects:{id:{points:{k:type}}}, links:[{id,from,to,via}], actions:[id], action_meta:[{id,objects,label}], fetch_places:[id] }
Ontology.exportJSON()                           // native JSON string
Ontology.exportCortex()                         // toCatalog() as JSON string
Ontology.exportJSONLD()                         // JSON-LD with @context (schema.org-ish + netie vocab)
Ontology.exportTurtle()                         // OWL-lite Turtle: owl:Class per object type, owl:DatatypeProperty per property, owl:ObjectProperty per link

Ontology.addObjectType(id, patch)    Ontology.updateObjectType(id, patch)    Ontology.removeObjectType(id)    Ontology.renameObjectType(oldId, newId)
Ontology.addProperty(objId, propId, patch)   Ontology.updateProperty(objId, propId, patch)   Ontology.removeProperty(objId, propId)
Ontology.addLinkType(id, patch)      Ontology.updateLinkType(id, patch)      Ontology.removeLinkType(id)
Ontology.addActionType(id, patch)    Ontology.updateActionType(id, patch)    Ontology.removeActionType(id)
Ontology.addInterface(id, patch)     Ontology.updateInterface(id, patch)     Ontology.removeInterface(id)
Ontology.addFetchPlace(id, patch)    Ontology.removeFetchPlace(id)
Ontology.setLayout(objId, {x, y})               // does not bump revision, does not log

Ontology.validate()                             // -> { ok, errors:[issue], warnings:[issue], infos:[issue] }
                                                // issue = { level, code, path, message, fix? }
Ontology.diff(a, b)                             // -> [{ op:"add"|"remove"|"update", path, before, after }]
Ontology.undo() / Ontology.redo() / Ontology.canUndo() / Ontology.canRedo()
Ontology.subscribe(fn)                          // fn(ontology, change) after every commit; returns unsubscribe
Ontology.save() / Ontology.restore()            // localStorage key "netie.constructor.ontology.v1" (browser only, try/catch)
Ontology.actionsForObject(objId)                // -> [actionId]  (replaces app.js actionsForObject)
Ontology.linksFor(objId)                        // -> [linkType]
Ontology.propertyType(objId, propId)            // -> type string or null
```

Every mutation returns `{ ok, errors }`, validates ids (`^[a-z][a-z0-9_.]*$` for objects/properties/links/places, `^[a-z][a-z0-9_.]*$` for actions), commits, bumps `revision`, appends to `changelog`, pushes undo, notifies subscribers, and saves.

## Validation codes (Semantica-style shapes)

| Code | Level | Meaning |
|------|-------|---------|
| `OBJ_NO_PRIMARY_KEY` | error | object type has no `primaryKey` or it names a missing property |
| `OBJ_NO_PROPERTIES` | error | object type has zero properties |
| `OBJ_TITLE_KEY_MISSING` | warn | `titleKey` names a missing property |
| `OBJ_ORPHAN` | info | object type has no links and no fetch place |
| `PROP_BAD_TYPE` | error | property type not in the allowed set |
| `PROP_REF_DANGLING` | error | `ref` type points at a missing object type |
| `PROP_ID_COLLIDES_INTERFACE` | warn | property type differs from the interface's declaration |
| `LINK_DANGLING_FROM` / `LINK_DANGLING_TO` | error | link endpoint object missing |
| `LINK_VIA_MISSING` | error | `via` property not on `from` object |
| `LINK_VIA_TYPE_MISMATCH` | warn | `via` property type differs from `to` primary key type |
| `LINK_DUPLICATE` | warn | two links with same from/to/via |
| `ACTION_NO_OBJECTS` | error | action applies to nothing |
| `ACTION_OBJECT_DANGLING` | error | action names a missing object type |
| `ACTION_WRITE_NO_CONFIRM` | warn | `cortexTool` set but `requiresConfirm` false |
| `IFACE_UNIMPLEMENTED` | warn | object declares an interface but lacks one of its properties |
| `IFACE_DANGLING` | error | object declares a missing interface |
| `PLACE_OBJECT_DANGLING` | error | fetch place names a missing object type |
| `ID_INVALID` | error | any id fails the id regex |

## `window.OntologyStudio` API

```js
OntologyStudio.open({ objectType?: id, tab?: "objects"|"links"|"actions"|"interfaces"|"places" })
OntologyStudio.close()
OntologyStudio.isOpen()
OntologyStudio.select(kind, id)
OntologyStudio.render()
```

Layout (single overlay `section#ontology-studio[data-testid=ontology-studio]`, hidden by default):

- Head: title, `revision`, validation badge (`data-testid=os-badge`, text like `2 errors · 1 warning`), search (`os-search`), buttons Validate (`os-validate`), Undo (`os-undo`), Redo (`os-redo`), Import (`os-import`, hidden file input `os-import-file`), Export (`os-export` menu: native / Cortex / JSON-LD / Turtle; each item `os-export-<fmt>`), Reset (`os-reset`), Close (`os-close`, Esc).
- Left rail: tabs `os-tab-objects`, `os-tab-links`, `os-tab-actions`, `os-tab-interfaces`, `os-tab-places`; list `os-list` with rows `[data-id]`; New button `os-new`.
- Center editor `os-editor`: object form (id, label, description, color, primary key select, title key select, interfaces multi-select); properties table `os-props` with rows `[data-prop]` (id input, type select, required, pii, description, delete `os-prop-del`), add row `os-prop-add`; links touching this object with quick add `os-link-add`; actions applying to this object with quick add `os-action-add`. Link editor: from/to/via/cardinality/inverse. Action editor: objects multi, params table, requiresConfirm, cortexTool. Interface editor: properties table. Place editor: object, kind.
- Right graph `os-graph`: SVG. Object types as boxes (`[data-obj]`) with property count, link types as labelled edges. Pan (drag empty), zoom (wheel), drag boxes (writes `Ontology.setLayout`), click selects. Auto-layout button `os-layout`.
- Bottom: Issues `os-issues` (rows `[data-code]`, click selects the offending item) and Changelog `os-changelog` (latest first).

Direct editing writes through the API immediately (n8n-style, no Save button). Undo/redo cover everything.

## Integration points

- `app.js`: on load, `const catalog = Ontology.toCatalog()`; `OBJECTS`, `LINKS`, `ACTION_META`, `ACTIONS`, `FETCH_PLACES` are refreshed from it on every `Ontology.subscribe` callback, then `render()`. Ontology nodes show `objects · links · actions` counts as the subtitle. Node popover for an ontology node has `Open Ontology Studio`. Rail gets `#open-ontology`. Header gets `#ontology-btn`. Export JSON includes `ontology`.
- `engine.js`: chat `ontology` opens the studio; `add object <id>`, `add property <obj>.<prop> <type>`, `add link <a> to <b> via <prop>`, `add action <id> on <obj>`, `validate ontology`, `export ontology <fmt>`. On `/cortex` origin `loadOntology()` feeds `Ontology.importJSON(JSON.stringify(remote))`; `push ontology` POSTs `Ontology.toCatalog()` to `/cortex/constructor/ontology` only on `/cortex` origin. `compileIR` gains `ontology: { name, revision, objects: n, links: n, actions: n }`.
- `styles.css`: nothing studio-specific; the studio owns `ontology.css`.

## Test ids and e2e expectations

- Canvas: `.node[data-kind=ontology]` exists in the sample; its subtitle mentions `objects`.
- `#open-ontology` click -> `[data-testid=ontology-studio]` visible; `os-list` has >= 11 rows on the objects tab.
- Add property via `os-prop-add`, set id `batch_no`, type `string`; `Ontology.get().objectTypes.<obj>.properties.batch_no` exists; canvas Data point select offers `batch_no`.
- Remove the primary key property -> badge shows `1 error`, issues has `OBJ_NO_PRIMARY_KEY`; undo clears it.
- Export Turtle contains `owl:Class`.
- Reload keeps the change (localStorage).
- Law check: `grep -c "fetch(" app.js ontology.js ontology-studio.js` is 0.
