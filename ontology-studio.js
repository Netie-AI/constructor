/* Ontology Studio workbench. Plain ES2018. No fetch, no imports, no build.
   Contract: docs/ONTOLOGY_STUDIO.md. Talks only to window.Ontology and window.Constructor. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var TABS = ["objects", "links", "actions", "interfaces", "places"];
  var TYPES = ["string", "number", "integer", "boolean", "date", "datetime", "geo", "json", "ref"];
  var CARDINALITIES = ["one_to_one", "many_to_one", "one_to_many", "many_to_many"];
  var PLACE_KINDS = ["place", "cloud", "database", "local_model", "online_api"];
  var BOX_W = 150;
  var BOX_H = 52;

  var root = null;
  var tab = "objects";
  var selectedId = null;
  var query = "";
  var view = { x: 24, y: 24, k: 1 };
  var pan = null;
  var boxDrag = null;
  var unsub = null;
  var exportOpen = false;
  var fileInput = null;

  function O() {
    return window.Ontology || null;
  }

  function C() {
    return window.Constructor || null;
  }

  function esc(s) {
    return s == null ? "" : String(s);
  }

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "className") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "checked" || k === "hidden" || k === "disabled" || k === "selected" || k === "multiple") node[k] = !!v;
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, String(v));
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function svg(tag, attrs, kids) {
    var node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] == null || attrs[k] === false) return;
        node.setAttribute(k, String(attrs[k]));
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid) node.appendChild(kid);
    });
    return node;
  }

  function tid(name) {
    return root.querySelector('[data-testid="' + name + '"]');
  }

  function keys(obj) {
    return obj ? Object.keys(obj) : [];
  }

  function mapOf(tabName, onto) {
    if (!onto) return {};
    if (tabName === "objects") return onto.objectTypes || {};
    if (tabName === "links") return onto.linkTypes || {};
    if (tabName === "actions") return onto.actionTypes || {};
    if (tabName === "interfaces") return onto.interfaces || {};
    return onto.fetchPlaces || {};
  }

  function uniqueId(map, prefix) {
    if (!map[prefix]) return prefix;
    var i = 2;
    while (map[prefix + "_" + i] || map[prefix + i]) i += 1;
    return prefix + "_" + i;
  }

  function badgeText(v) {
    var nE = (v.errors || []).length;
    var nW = (v.warnings || []).length;
    var parts = [];
    if (nE) parts.push(nE + (nE === 1 ? " error" : " errors"));
    if (nW) parts.push(nW + (nW === 1 ? " warning" : " warnings"));
    return parts.length ? parts.join(" · ") : "ok";
  }

  function issuesFor(path) {
    var v = O() ? O().validate() : { errors: [], warnings: [] };
    var all = (v.errors || []).concat(v.warnings || []);
    return all.filter(function (iss) {
      return iss.path === path || (iss.path && iss.path.indexOf(path + ".") === 0);
    });
  }

  function dot(path) {
    var hits = issuesFor(path);
    if (!hits.length) return null;
    var first = hits[0];
    return el("span", { className: "os-dot", title: first.code + " " + first.message });
  }

  function isField(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName;
    return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  }

  function captureFocus() {
    var ae = document.activeElement;
    if (!ae || !root || !root.contains(ae)) return null;
    return {
      focus: ae.getAttribute("data-focus"),
      start: typeof ae.selectionStart === "number" ? ae.selectionStart : null,
      end: typeof ae.selectionEnd === "number" ? ae.selectionEnd : null,
    };
  }

  function restoreFocus(snap) {
    if (!snap || !snap.focus) return;
    var node = root.querySelector('[data-focus="' + snap.focus + '"]');
    if (!node) return;
    node.focus();
    try {
      if (snap.start != null && node.setSelectionRange) node.setSelectionRange(snap.start, snap.end);
    } catch (err) {}
  }

  function flash(msg) {
    var n = tid("os-flash");
    if (n) n.textContent = msg || "";
  }

  function ok(res) {
    if (!res) return false;
    if (res.ok) {
      flash("");
      return true;
    }
    flash((res.errors || []).join("; ") || "rejected");
    return false;
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function usageCount(objId) {
    var ctor = C();
    if (!ctor || typeof ctor.getState !== "function") return 0;
    var st = ctor.getState() || { nodes: [] };
    return (st.nodes || []).filter(function (n) {
      return n.object_type === objId;
    }).length;
  }

  function ensureSelected(onto) {
    var m = mapOf(tab, onto);
    var ids = keys(m);
    if (selectedId && m[selectedId]) return;
    selectedId = ids[0] || null;
  }

  function setTab(next, id) {
    tab = TABS.indexOf(next) >= 0 ? next : "objects";
    selectedId = id || null;
    exportOpen = false;
    render();
  }

  function filterIds(map) {
    var q = query.trim().toLowerCase();
    return keys(map).filter(function (id) {
      if (!q) return true;
      var row = map[id] || {};
      return (
        id.toLowerCase().indexOf(q) >= 0 ||
        String(row.label || "").toLowerCase().indexOf(q) >= 0
      );
    });
  }

  function build() {
    if (root) return;
    root = el("section", {
      id: "ontology-studio",
      className: "ontology-studio",
      "data-testid": "ontology-studio",
      hidden: true,
    });
    root.innerHTML =
      '<div class="os-head">' +
      "<h2>Ontology Studio</h2>" +
      '<span class="os-rev" data-testid="os-rev"></span>' +
      '<span class="os-badge" data-testid="os-badge"></span>' +
      '<span class="os-empty" data-testid="os-flash"></span>' +
      '<input class="os-search" data-testid="os-search" type="search" placeholder="Search types  /" />' +
      '<button type="button" data-testid="os-validate">Validate</button>' +
      '<button type="button" data-testid="os-undo">Undo</button>' +
      '<button type="button" data-testid="os-redo">Redo</button>' +
      '<button type="button" data-testid="os-import">Import</button>' +
      '<input data-testid="os-import-file" type="file" accept=".json,.ttl,.txt,application/json,text/turtle" hidden />' +
      '<div class="os-export-wrap"><button type="button" data-testid="os-export">Export</button>' +
      '<div class="os-export-menu" data-testid="os-export-menu" hidden>' +
      '<button type="button" data-testid="os-export-native">Native JSON</button>' +
      '<button type="button" data-testid="os-export-cortex">Cortex catalog</button>' +
      '<button type="button" data-testid="os-export-jsonld">JSON-LD</button>' +
      '<button type="button" data-testid="os-export-turtle">Turtle</button>' +
      "</div></div>" +
      '<button type="button" data-testid="os-reset">Reset</button>' +
      '<button type="button" data-testid="os-close">Close</button>' +
      "</div>" +
      '<aside class="os-rail"><div class="os-tabs" data-testid="os-tabs"></div>' +
      '<div class="os-list" data-testid="os-list"></div>' +
      '<button type="button" class="os-new" data-testid="os-new">New</button></aside>' +
      '<div class="os-editor" data-testid="os-editor"></div>' +
      '<div class="os-graph" data-testid="os-graph">' +
      '<div class="os-graph-tools"><button type="button" data-testid="os-layout">Auto layout</button></div>' +
      "</div>" +
      '<div class="os-issues" data-testid="os-issues"></div>' +
      '<div class="os-changelog" data-testid="os-changelog"></div>';
    document.body.appendChild(root);

    fileInput = tid("os-import-file");
    tid("os-search").addEventListener("input", function (ev) {
      query = ev.target.value;
      renderList();
    });
    tid("os-validate").addEventListener("click", function () {
      render();
    });
    tid("os-undo").addEventListener("click", function () {
      if (O()) O().undo();
    });
    tid("os-redo").addEventListener("click", function () {
      if (O()) O().redo();
    });
    tid("os-import").addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", onImport);
    tid("os-export").addEventListener("click", function () {
      exportOpen = !exportOpen;
      tid("os-export-menu").hidden = !exportOpen;
    });
    tid("os-export-native").addEventListener("click", function () {
      if (!O()) return;
      download("ontology.json", O().exportJSON(), "application/json");
      exportOpen = false;
      tid("os-export-menu").hidden = true;
    });
    tid("os-export-cortex").addEventListener("click", function () {
      if (!O()) return;
      download("ontology.cortex.json", O().exportCortex(), "application/json");
      exportOpen = false;
      tid("os-export-menu").hidden = true;
    });
    tid("os-export-jsonld").addEventListener("click", function () {
      if (!O()) return;
      download("ontology.jsonld", O().exportJSONLD(), "application/ld+json");
      exportOpen = false;
      tid("os-export-menu").hidden = true;
    });
    tid("os-export-turtle").addEventListener("click", function () {
      if (!O()) return;
      download("ontology.ttl", O().exportTurtle(), "text/turtle");
      exportOpen = false;
      tid("os-export-menu").hidden = true;
    });
    tid("os-reset").addEventListener("click", function () {
      if (!O()) return;
      if (window.confirm("Reset ontology to the seed catalog?")) O().reset();
    });
    tid("os-close").addEventListener("click", close);
    tid("os-new").addEventListener("click", onNew);
    tid("os-layout").addEventListener("click", autoLayout);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", function (ev) {
      if (!exportOpen) return;
      var wrap = root.querySelector(".os-export-wrap");
      if (wrap && !wrap.contains(ev.target)) {
        exportOpen = false;
        tid("os-export-menu").hidden = true;
      }
    });
    if (O() && typeof O().subscribe === "function") {
      unsub = O().subscribe(function () {
        if (isOpen()) render();
      });
    }
  }

  function onImport(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file || !O()) return;
    var reader = new FileReader();
    reader.onload = function () {
      ok(O().importJSON(String(reader.result || "")));
    };
    reader.readAsText(file);
  }

  function onNew() {
    var onto = O() && O().get();
    if (!onto) return;
    var id;
    if (tab === "objects") {
      id = uniqueId(onto.objectTypes, "object");
      if (ok(O().addObjectType(id, { label: id }))) selectedId = id;
    } else if (tab === "links") {
      var objs = keys(onto.objectTypes);
      id = uniqueId(onto.linkTypes, "link");
      if (ok(O().addLinkType(id, { from: objs[0] || "object", to: objs[1] || objs[0] || "object", via: "" }))) selectedId = id;
    } else if (tab === "actions") {
      id = uniqueId(onto.actionTypes, "action");
      if (ok(O().addActionType(id, { objects: selectedId && tab === "objects" ? [selectedId] : ["*"] }))) selectedId = id;
    } else if (tab === "interfaces") {
      id = uniqueId(onto.interfaces, "Iface");
      if (ok(O().addInterface(id, {}))) selectedId = id;
    } else {
      id = uniqueId(onto.fetchPlaces, "place.custom");
      var firstObj = keys(onto.objectTypes)[0] || "";
      if (ok(O().addFetchPlace(id, { object: firstObj, kind: "place" }))) selectedId = id;
    }
  }

  function onKey(ev) {
    if (!isOpen()) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      close();
      return;
    }
    var meta = ev.ctrlKey || ev.metaKey;
    if (meta && (ev.key === "z" || ev.key === "Z")) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.shiftKey) {
        if (O()) O().redo();
      } else if (O()) O().undo();
      return;
    }
    if (meta && (ev.key === "y" || ev.key === "Y")) {
      ev.preventDefault();
      if (O()) O().redo();
      return;
    }
    if (ev.key === "/" && !isField(ev.target)) {
      ev.preventDefault();
      var s = tid("os-search");
      if (s) s.focus();
    }
  }

  function renderTabs() {
    var box = tid("os-tabs");
    box.textContent = "";
    TABS.forEach(function (name) {
      box.appendChild(
        el(
          "button",
          {
            type: "button",
            "data-testid": "os-tab-" + name,
            "aria-selected": name === tab ? "true" : "false",
            onclick: function () {
              setTab(name, null);
            },
          },
          [name]
        )
      );
    });
  }

  function renderList() {
    var onto = O() && O().get();
    var list = tid("os-list");
    list.textContent = "";
    if (!onto) {
      list.appendChild(el("p", { className: "os-empty", text: "Ontology model not loaded." }));
      return;
    }
    var map = mapOf(tab, onto);
    filterIds(map).forEach(function (id) {
      var row = map[id];
      var sub = row.label && row.label !== id ? row.label : "";
      if (tab === "objects") sub = keys(row.properties).length + " props · used " + usageCount(id);
      if (tab === "links") sub = (row.from || "") + " → " + (row.to || "");
      var btn = el("button", {
        type: "button",
        "data-id": id,
        className: id === selectedId ? "is-on" : "",
        onclick: function () {
          selectedId = id;
          render();
        },
      });
      btn.appendChild(el("div", { className: "os-row-id", text: id }));
      if (sub) btn.appendChild(el("div", { className: "os-row-sub", text: sub }));
      list.appendChild(btn);
    });
  }

  function selectOpts(values, current, includeEmpty) {
    var out = [];
    if (includeEmpty) out.push(el("option", { value: "", text: "—" }));
    values.forEach(function (v) {
      out.push(el("option", { value: v, text: v, selected: v === current }));
    });
    return out;
  }

  function labeled(label, path, control) {
    var lab = el("label", null, [label]);
    var d = dot(path);
    if (d) lab.appendChild(d);
    return [lab, control];
  }

  function input(attrs) {
    attrs = attrs || {};
    attrs.type = attrs.type || "text";
    return el("input", attrs);
  }

  function renderEditor() {
    var box = tid("os-editor");
    box.textContent = "";
    var onto = O() && O().get();
    if (!onto || !selectedId) {
      box.appendChild(el("p", { className: "os-empty", text: "Select a type, or press New." }));
      return;
    }
    if (tab === "objects") renderObjectEditor(box, onto);
    else if (tab === "links") renderLinkEditor(box, onto);
    else if (tab === "actions") renderActionEditor(box, onto);
    else if (tab === "interfaces") renderInterfaceEditor(box, onto);
    else renderPlaceEditor(box, onto);
  }

  function renderObjectEditor(box, onto) {
    var t = onto.objectTypes[selectedId];
    if (!t) {
      box.appendChild(el("p", { className: "os-empty", text: "Missing object type." }));
      return;
    }
    var path = "objectTypes." + t.id;
    var propIds = keys(t.properties);
    var objIds = keys(onto.objectTypes);
    var ifaceIds = keys(onto.interfaces);
    box.appendChild(el("h3", { text: "Object type" }));
    var form = el("div", { className: "os-form" });
    var idIn = input({ value: t.id, "data-focus": "obj-id" });
    idIn.addEventListener("blur", function () {
      var next = idIn.value.trim();
      if (next && next !== t.id) ok(O().renameObjectType(t.id, next)) && (selectedId = next);
    });
    labeled("Id", path, idIn).forEach(function (n) {
      form.appendChild(n);
    });
    var labIn = input({ value: t.label || "", "data-focus": "obj-label" });
    labIn.addEventListener("change", function () {
      ok(O().updateObjectType(t.id, { label: labIn.value }));
    });
    labeled("Label", path, labIn).forEach(function (n) {
      form.appendChild(n);
    });
    var desc = el("textarea", { "data-focus": "obj-desc" });
    desc.value = t.description || "";
    desc.addEventListener("change", function () {
      ok(O().updateObjectType(t.id, { description: desc.value }));
    });
    labeled("Description", path, desc).forEach(function (n) {
      form.appendChild(n);
    });
    var col = input({ type: "color", value: /^#[0-9a-fA-F]{6}$/.test(t.color || "") ? t.color : "#7eb8ff", "data-focus": "obj-color" });
    col.addEventListener("change", function () {
      ok(O().updateObjectType(t.id, { color: col.value }));
    });
    labeled("Color", path, col).forEach(function (n) {
      form.appendChild(n);
    });
    var pk = el("select", { "data-focus": "obj-pk" }, selectOpts(propIds, t.primaryKey, true));
    pk.addEventListener("change", function () {
      ok(O().updateObjectType(t.id, { primaryKey: pk.value }));
    });
    labeled("Primary key", path, pk).forEach(function (n) {
      form.appendChild(n);
    });
    var tk = el("select", { "data-focus": "obj-tk" }, selectOpts(propIds, t.titleKey, true));
    tk.addEventListener("change", function () {
      ok(O().updateObjectType(t.id, { titleKey: tk.value }));
    });
    labeled("Title key", path, tk).forEach(function (n) {
      form.appendChild(n);
    });
    var ifs = el("select", { multiple: true, "data-focus": "obj-ifaces" });
    ifaceIds.forEach(function (iid) {
      ifs.appendChild(el("option", { value: iid, text: iid, selected: (t.interfaces || []).indexOf(iid) >= 0 }));
    });
    ifs.addEventListener("change", function () {
      var picked = [];
      for (var i = 0; i < ifs.options.length; i++) if (ifs.options[i].selected) picked.push(ifs.options[i].value);
      ok(O().updateObjectType(t.id, { interfaces: picked }));
    });
    labeled("Interfaces", path, ifs).forEach(function (n) {
      form.appendChild(n);
    });
    box.appendChild(form);

    box.appendChild(el("h3", { text: "Properties" }));
    box.appendChild(propTable(t, path));
    box.appendChild(
      el("button", {
        type: "button",
        "data-testid": "os-prop-add",
        onclick: function () {
          var pid = uniqueId(t.properties, "prop");
          ok(O().addProperty(t.id, pid, { type: "string" }));
        },
        text: "Add property",
      })
    );

    box.appendChild(el("h3", { text: "Links touching this object" }));
    var links = O().linksFor(t.id);
    box.appendChild(miniList(links, function (l) {
      return l.id + "  " + l.from + " → " + l.to;
    }, function (l) {
      setTab("links", l.id);
    }));
    box.appendChild(
      el("button", {
        type: "button",
        "data-testid": "os-link-add",
        onclick: function () {
          var lid = uniqueId(onto.linkTypes, t.id + "_link");
          var other = objIds.filter(function (x) { return x !== t.id; })[0] || t.id;
          if (ok(O().addLinkType(lid, { from: t.id, to: other, via: t.primaryKey || "" }))) setTab("links", lid);
        },
        text: "Quick add link",
      })
    );

    box.appendChild(el("h3", { text: "Actions applying" }));
    var acts = O().actionsForObject(t.id).map(function (id) { return onto.actionTypes[id]; }).filter(Boolean);
    box.appendChild(miniList(acts, function (a) {
      return a.id;
    }, function (a) {
      setTab("actions", a.id);
    }));
    box.appendChild(
      el("button", {
        type: "button",
        "data-testid": "os-action-add",
        onclick: function () {
          var aid = uniqueId(onto.actionTypes, t.id + ".act");
          if (ok(O().addActionType(aid, { objects: [t.id] }))) setTab("actions", aid);
        },
        text: "Quick add action",
      })
    );

    box.appendChild(
      el("button", {
        type: "button",
        onclick: function () {
          if (!window.confirm("Delete object type " + t.id + "?")) return;
          ok(O().removeObjectType(t.id));
          selectedId = null;
        },
        text: "Delete object",
      })
    );
  }

  function propTable(t, path) {
    var table = el("table", { className: "os-table", "data-testid": "os-props" });
    table.appendChild(el("thead", null, [el("tr", null, ["id", "type", "req", "pii", "description", ""].map(function (h) {
      return el("th", { text: h });
    }))]));
    var body = el("tbody");
    keys(t.properties).forEach(function (pid) {
      var p = t.properties[pid];
      var ppath = path + ".properties." + pid;
      var tr = el("tr", { "data-prop": pid });
      var idIn = input({ value: pid, "data-focus": "prop-" + pid + "-id" });
      idIn.addEventListener("blur", function () {
        var next = idIn.value.trim();
        if (next && next !== pid) ok(O().renameProperty(t.id, pid, next));
      });
      var typeSel = el("select", { "data-focus": "prop-" + pid + "-type" }, selectOpts(TYPES, p.type, false));
      typeSel.addEventListener("change", function () {
        var patch = { type: typeSel.value };
        if (typeSel.value === "ref" && !p.ref) patch.ref = keys(O().get().objectTypes)[0] || "";
        ok(O().updateProperty(t.id, pid, patch));
      });
      var req = input({ type: "checkbox", checked: !!p.required, "data-focus": "prop-" + pid + "-req" });
      req.addEventListener("change", function () {
        ok(O().updateProperty(t.id, pid, { required: req.checked }));
      });
      var pii = input({ type: "checkbox", checked: !!p.pii, "data-focus": "prop-" + pid + "-pii" });
      pii.addEventListener("change", function () {
        ok(O().updateProperty(t.id, pid, { pii: pii.checked }));
      });
      var desc = input({ value: p.description || "", "data-focus": "prop-" + pid + "-desc" });
      desc.addEventListener("change", function () {
        ok(O().updateProperty(t.id, pid, { description: desc.value }));
      });
      var del = el("button", {
        type: "button",
        "data-testid": "os-prop-del",
        text: "Del",
        onclick: function () {
          if (!window.confirm("Delete property " + pid + "?")) return;
          ok(O().removeProperty(t.id, pid));
        },
      });
      [idIn, typeSel, req, pii, desc, del].forEach(function (cell, i) {
        var td = el("td");
        td.appendChild(cell);
        if (i === 0) {
          var d = dot(ppath);
          if (d) td.appendChild(d);
        }
        tr.appendChild(td);
      });
      if (p.type === "ref") {
        var extra = el("tr");
        var td = el("td", { colspan: "6" });
        var refSel = el("select", { "data-focus": "prop-" + pid + "-ref" }, selectOpts(keys(O().get().objectTypes), p.ref, true));
        refSel.addEventListener("change", function () {
          ok(O().updateProperty(t.id, pid, { ref: refSel.value }));
        });
        td.appendChild(document.createTextNode("ref "));
        td.appendChild(refSel);
        extra.appendChild(td);
        body.appendChild(tr);
        body.appendChild(extra);
        return;
      }
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function miniList(rows, labelFn, onClick) {
    var wrap = el("div");
    if (!rows.length) wrap.appendChild(el("p", { className: "os-empty", text: "None." }));
    rows.forEach(function (row) {
      wrap.appendChild(
        el("button", {
          type: "button",
          "data-id": row.id,
          text: labelFn(row),
          onclick: function () {
            onClick(row);
          },
        })
      );
    });
    return wrap;
  }

  function renderLinkEditor(box, onto) {
    var l = onto.linkTypes[selectedId];
    if (!l) {
      box.appendChild(el("p", { className: "os-empty", text: "Missing link type." }));
      return;
    }
    var path = "linkTypes." + l.id;
    var objIds = keys(onto.objectTypes);
    var fromProps = onto.objectTypes[l.from] ? keys(onto.objectTypes[l.from].properties) : [];
    box.appendChild(el("h3", { text: "Link type" }));
    var form = el("div", { className: "os-form" });
    var idIn = input({ value: l.id, "data-focus": "link-id" });
    idIn.addEventListener("blur", function () {
      flash("Link id is immutable; delete and recreate to rename.");
    });
    labeled("Id", path, idIn).forEach(function (n) { form.appendChild(n); });
    var lab = input({ value: l.label || "", "data-focus": "link-label" });
    lab.addEventListener("change", function () { ok(O().updateLinkType(l.id, { label: lab.value })); });
    labeled("Label", path, lab).forEach(function (n) { form.appendChild(n); });
    var from = el("select", { "data-focus": "link-from" }, selectOpts(objIds, l.from, false));
    from.addEventListener("change", function () { ok(O().updateLinkType(l.id, { from: from.value })); });
    labeled("From", path, from).forEach(function (n) { form.appendChild(n); });
    var to = el("select", { "data-focus": "link-to" }, selectOpts(objIds, l.to, false));
    to.addEventListener("change", function () { ok(O().updateLinkType(l.id, { to: to.value })); });
    labeled("To", path, to).forEach(function (n) { form.appendChild(n); });
    var via = el("select", { "data-focus": "link-via" }, selectOpts(fromProps, l.via, true));
    via.addEventListener("change", function () { ok(O().updateLinkType(l.id, { via: via.value })); });
    labeled("Via", path, via).forEach(function (n) { form.appendChild(n); });
    var card = el("select", { "data-focus": "link-card" }, selectOpts(CARDINALITIES, l.cardinality, false));
    card.addEventListener("change", function () { ok(O().updateLinkType(l.id, { cardinality: card.value })); });
    labeled("Cardinality", path, card).forEach(function (n) { form.appendChild(n); });
    var inv = input({ value: l.inverse || "", "data-focus": "link-inv" });
    inv.addEventListener("change", function () { ok(O().updateLinkType(l.id, { inverse: inv.value })); });
    labeled("Inverse", path, inv).forEach(function (n) { form.appendChild(n); });
    box.appendChild(form);
    box.appendChild(el("button", {
      type: "button",
      text: "Delete link",
      onclick: function () {
        if (!window.confirm("Delete link " + l.id + "?")) return;
        ok(O().removeLinkType(l.id));
        selectedId = null;
      },
    }));
  }

  function renderActionEditor(box, onto) {
    var a = onto.actionTypes[selectedId];
    if (!a) {
      box.appendChild(el("p", { className: "os-empty", text: "Missing action type." }));
      return;
    }
    var path = "actionTypes." + a.id;
    var objIds = ["*"].concat(keys(onto.objectTypes));
    box.appendChild(el("h3", { text: "Action type" }));
    var form = el("div", { className: "os-form" });
    form.appendChild(el("label", { text: "Id" }));
    form.appendChild(el("div", { text: a.id, className: "os-row-id" }));
    var lab = input({ value: a.label || "", "data-focus": "act-label" });
    lab.addEventListener("change", function () { ok(O().updateActionType(a.id, { label: lab.value })); });
    labeled("Label", path, lab).forEach(function (n) { form.appendChild(n); });
    var objs = el("select", { multiple: true, "data-focus": "act-objs" });
    objIds.forEach(function (id) {
      objs.appendChild(el("option", { value: id, text: id, selected: (a.objects || []).indexOf(id) >= 0 }));
    });
    objs.addEventListener("change", function () {
      var picked = [];
      for (var i = 0; i < objs.options.length; i++) if (objs.options[i].selected) picked.push(objs.options[i].value);
      ok(O().updateActionType(a.id, { objects: picked.length ? picked : ["*"] }));
    });
    labeled("Objects", path, objs).forEach(function (n) { form.appendChild(n); });
    var tool = input({ value: a.cortexTool || "", "data-focus": "act-tool" });
    tool.addEventListener("change", function () { ok(O().updateActionType(a.id, { cortexTool: tool.value || null })); });
    labeled("Cortex tool", path, tool).forEach(function (n) { form.appendChild(n); });
    var conf = input({ type: "checkbox", checked: !!a.requiresConfirm, "data-focus": "act-confirm" });
    conf.addEventListener("change", function () { ok(O().updateActionType(a.id, { requiresConfirm: conf.checked })); });
    labeled("Confirm", path, conf).forEach(function (n) { form.appendChild(n); });
    var desc = el("textarea", { "data-focus": "act-desc" });
    desc.value = a.description || "";
    desc.addEventListener("change", function () { ok(O().updateActionType(a.id, { description: desc.value })); });
    labeled("Description", path, desc).forEach(function (n) { form.appendChild(n); });
    box.appendChild(form);

    box.appendChild(el("h3", { text: "Params" }));
    var table = el("table", { className: "os-table" });
    table.appendChild(el("thead", null, [el("tr", null, ["id", "type", "req", ""].map(function (h) { return el("th", { text: h }); }))]));
    var body = el("tbody");
    (a.params || []).forEach(function (p, idx) {
      var tr = el("tr");
      var idIn = input({ value: p.id || "", "data-focus": "ap-" + idx + "-id" });
      var ty = el("select", { "data-focus": "ap-" + idx + "-type" }, selectOpts(TYPES, p.type, false));
      var req = input({ type: "checkbox", checked: !!p.required });
      function commit() {
        var params = (O().get().actionTypes[a.id].params || []).map(function (row, j) {
          return j === idx ? { id: idIn.value.trim(), type: ty.value, required: req.checked } : row;
        });
        ok(O().updateActionType(a.id, { params: params }));
      }
      idIn.addEventListener("blur", commit);
      ty.addEventListener("change", commit);
      req.addEventListener("change", commit);
      var del = el("button", {
        type: "button",
        text: "Del",
        onclick: function () {
          var params = (O().get().actionTypes[a.id].params || []).filter(function (_, j) { return j !== idx; });
          ok(O().updateActionType(a.id, { params: params }));
        },
      });
      [idIn, ty, req, del].forEach(function (c) {
        var td = el("td");
        td.appendChild(c);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    box.appendChild(table);
    box.appendChild(el("button", {
      type: "button",
      text: "Add param",
      onclick: function () {
        var params = (O().get().actionTypes[a.id].params || []).slice();
        params.push({ id: "param", type: "string", required: false });
        ok(O().updateActionType(a.id, { params: params }));
      },
    }));
    box.appendChild(el("button", {
      type: "button",
      text: "Delete action",
      onclick: function () {
        if (!window.confirm("Delete action " + a.id + "?")) return;
        ok(O().removeActionType(a.id));
        selectedId = null;
      },
    }));
  }

  function renderInterfaceEditor(box, onto) {
    var it = onto.interfaces[selectedId];
    if (!it) {
      box.appendChild(el("p", { className: "os-empty", text: "Missing interface." }));
      return;
    }
    var path = "interfaces." + it.id;
    box.appendChild(el("h3", { text: "Interface" }));
    var form = el("div", { className: "os-form" });
    form.appendChild(el("label", { text: "Id" }));
    form.appendChild(el("div", { text: it.id }));
    var lab = input({ value: it.label || "", "data-focus": "if-label" });
    lab.addEventListener("change", function () { ok(O().updateInterface(it.id, { label: lab.value })); });
    labeled("Label", path, lab).forEach(function (n) { form.appendChild(n); });
    box.appendChild(form);
    box.appendChild(el("h3", { text: "Properties" }));
    var table = el("table", { className: "os-table" });
    table.appendChild(el("thead", null, [el("tr", null, ["id", "type", ""].map(function (h) { return el("th", { text: h }); }))]));
    var body = el("tbody");
    keys(it.properties).forEach(function (pid) {
      var p = it.properties[pid];
      var tr = el("tr");
      var idIn = input({ value: pid });
      var ty = el("select", null, selectOpts(TYPES, p.type, false));
      function commit(remove) {
        var next = {};
        keys(O().get().interfaces[it.id].properties).forEach(function (k) {
          if (remove && k === pid) return;
          var cur = O().get().interfaces[it.id].properties[k];
          var nid = k === pid ? idIn.value.trim() || k : k;
          next[nid] = { id: nid, type: k === pid ? ty.value : cur.type };
        });
        ok(O().updateInterface(it.id, { properties: next }));
      }
      idIn.addEventListener("blur", function () { commit(false); });
      ty.addEventListener("change", function () { commit(false); });
      var del = el("button", { type: "button", text: "Del", onclick: function () { commit(true); } });
      [idIn, ty, del].forEach(function (c) {
        var td = el("td");
        td.appendChild(c);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    box.appendChild(table);
    box.appendChild(el("button", {
      type: "button",
      text: "Add property",
      onclick: function () {
        var props = Object.assign({}, O().get().interfaces[it.id].properties);
        var pid = uniqueId(props, "prop");
        props[pid] = { id: pid, type: "string" };
        ok(O().updateInterface(it.id, { properties: props }));
      },
    }));
    box.appendChild(el("button", {
      type: "button",
      text: "Delete interface",
      onclick: function () {
        if (!window.confirm("Delete interface " + it.id + "?")) return;
        ok(O().removeInterface(it.id));
        selectedId = null;
      },
    }));
  }

  function renderPlaceEditor(box, onto) {
    var p = onto.fetchPlaces[selectedId];
    if (!p) {
      box.appendChild(el("p", { className: "os-empty", text: "Missing fetch place." }));
      return;
    }
    var path = "fetchPlaces." + p.id;
    var form = el("div", { className: "os-form" });
    box.appendChild(el("h3", { text: "Fetch place" }));
    form.appendChild(el("label", { text: "Id" }));
    form.appendChild(el("div", { text: p.id, className: "os-row-id" }));
    var obj = el("select", { "data-focus": "place-obj" }, selectOpts(keys(onto.objectTypes), p.object, false));
    obj.addEventListener("change", function () { ok(O().updateFetchPlace(p.id, { object: obj.value })); });
    labeled("Object", path, obj).forEach(function (n) { form.appendChild(n); });
    var kind = el("select", { "data-focus": "place-kind" }, selectOpts(PLACE_KINDS, p.kind, false));
    kind.addEventListener("change", function () { ok(O().updateFetchPlace(p.id, { kind: kind.value })); });
    labeled("Kind", path, kind).forEach(function (n) { form.appendChild(n); });
    box.appendChild(form);
    box.appendChild(el("button", {
      type: "button",
      text: "Delete place",
      onclick: function () {
        if (!window.confirm("Delete place " + p.id + "?")) return;
        ok(O().removeFetchPlace(p.id));
        selectedId = null;
      },
    }));
  }

  function layouts(onto) {
    var ids = keys(onto.objectTypes);
    var out = {};
    ids.forEach(function (id, i) {
      var t = onto.objectTypes[id];
      if (t.layout && typeof t.layout.x === "number") out[id] = { x: t.layout.x, y: t.layout.y };
      else out[id] = { x: (i % 3) * 180 + 16, y: Math.floor(i / 3) * 90 + 16 };
    });
    return out;
  }

  function autoLayout() {
    var onto = O() && O().get();
    if (!onto) return;
    keys(onto.objectTypes).forEach(function (id, i) {
      O().setLayout(id, { x: (i % 3) * 180 + 16, y: Math.floor(i / 3) * 90 + 16 });
    });
    renderGraph();
  }

  function renderGraph() {
    var host = tid("os-graph");
    var tools = host.querySelector(".os-graph-tools");
    var old = host.querySelector("svg");
    if (old) old.remove();
    var onto = O() && O().get();
    var svgRoot = svg("svg", { "aria-label": "ontology graph" });
    if (!onto) {
      host.appendChild(svgRoot);
      return;
    }
    var pos = layouts(onto);
    var world = svg("g", { "data-world": "1" });
    world.setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.k + ")");
    keys(onto.linkTypes).forEach(function (lid) {
      var l = onto.linkTypes[lid];
      var a = pos[l.from];
      var b = pos[l.to];
      if (!a || !b) return;
      var x1 = a.x + BOX_W / 2;
      var y1 = a.y + BOX_H / 2;
      var x2 = b.x + BOX_W / 2;
      var y2 = b.y + BOX_H / 2;
      world.appendChild(svg("line", { class: "os-edge", x1: x1, y1: y1, x2: x2, y2: y2 }));
      world.appendChild(svg("text", {
        class: "os-edge-label",
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2 - 4,
      }, [document.createTextNode(l.label || l.id)]));
    });
    keys(onto.objectTypes).forEach(function (id) {
      var t = onto.objectTypes[id];
      var p = pos[id];
      var g = svg("g", {
        class: "os-box",
        "data-obj": id,
        transform: "translate(" + p.x + "," + p.y + ")",
      });
      g.appendChild(svg("rect", {
        width: BOX_W,
        height: BOX_H,
        rx: 8,
        fill: "#121212",
        stroke: t.color || "#ececec",
        "stroke-width": id === selectedId && tab === "objects" ? 2 : 1,
      }));
      g.appendChild(svg("text", { x: 8, y: 20 }, [document.createTextNode(t.label || id)]));
      g.appendChild(svg("text", { x: 8, y: 38, class: "os-box-sub" }, [document.createTextNode(keys(t.properties).length + " props")]));
      g.addEventListener("mousedown", function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        boxDrag = { id: id, x: ev.clientX, y: ev.clientY, ox: p.x, oy: p.y, moved: false };
      });
      world.appendChild(g);
    });
    svgRoot.appendChild(world);
    svgRoot.addEventListener("mousedown", function (ev) {
      if (ev.target.closest && ev.target.closest("[data-obj]")) return;
      pan = { x: ev.clientX, y: ev.clientY, ox: view.x, oy: view.y };
      svgRoot.classList.add("is-grabbing");
    });
    svgRoot.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var factor = ev.deltaY < 0 ? 1.08 : 0.92;
      view.k = Math.max(0.35, Math.min(2.4, view.k * factor));
      world.setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.k + ")");
    }, { passive: false });
    host.insertBefore(svgRoot, tools.nextSibling);
  }

  function onMove(ev) {
    if (pan && root && !root.hidden) {
      view.x = pan.ox + (ev.clientX - pan.x);
      view.y = pan.oy + (ev.clientY - pan.y);
      var world = root.querySelector("[data-world]");
      if (world) world.setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.k + ")");
    }
    if (boxDrag && root && !root.hidden) {
      var dx = (ev.clientX - boxDrag.x) / view.k;
      var dy = (ev.clientY - boxDrag.y) / view.k;
      if (Math.abs(dx) + Math.abs(dy) > 3) boxDrag.moved = true;
      var g = root.querySelector('[data-obj="' + boxDrag.id + '"]');
      if (g) g.setAttribute("transform", "translate(" + (boxDrag.ox + dx) + "," + (boxDrag.oy + dy) + ")");
    }
  }

  function onUp(ev) {
    if (boxDrag) {
      var dx = (ev.clientX - boxDrag.x) / view.k;
      var dy = (ev.clientY - boxDrag.y) / view.k;
      if (boxDrag.moved) {
        O().setLayout(boxDrag.id, { x: boxDrag.ox + dx, y: boxDrag.oy + dy });
        renderGraph();
      } else {
        selectedId = boxDrag.id;
        tab = "objects";
        render();
      }
    }
    boxDrag = null;
    pan = null;
    if (root) {
      var svgRoot = root.querySelector(".os-graph svg");
      if (svgRoot) svgRoot.classList.remove("is-grabbing");
    }
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  function renderIssues() {
    var box = tid("os-issues");
    box.textContent = "";
    box.appendChild(el("h3", { text: "Issues" }));
    var v = O() ? O().validate() : { errors: [], warnings: [], infos: [] };
    var rows = (v.errors || []).concat(v.warnings || [], v.infos || []);
    if (!rows.length) {
      box.appendChild(el("p", { className: "os-empty", text: "No issues." }));
      return;
    }
    rows.forEach(function (iss) {
      var cls = iss.level === "error" ? "" : iss.level === "warn" ? "is-warn" : "is-info";
      var btn = el("button", {
        type: "button",
        "data-code": iss.code,
        className: cls,
        onclick: function () {
          jumpPath(iss.path);
        },
      });
      btn.appendChild(el("span", { className: "os-code", text: iss.code }));
      btn.appendChild(document.createTextNode(iss.message || iss.path || ""));
      box.appendChild(btn);
    });
  }

  function jumpPath(path) {
    var p = String(path || "");
    if (p.indexOf("objectTypes.") === 0) {
      tab = "objects";
      selectedId = p.split(".")[1];
    } else if (p.indexOf("linkTypes.") === 0) {
      tab = "links";
      selectedId = p.split(".")[1];
    } else if (p.indexOf("actionTypes.") === 0) {
      tab = "actions";
      selectedId = p.split(".")[1];
    } else if (p.indexOf("interfaces.") === 0) {
      tab = "interfaces";
      selectedId = p.split(".")[1];
    } else if (p.indexOf("fetchPlaces.") === 0) {
      tab = "places";
      selectedId = p.split(".")[1];
    }
    render();
  }

  function renderChangelog() {
    var box = tid("os-changelog");
    box.textContent = "";
    box.appendChild(el("h3", { text: "Changelog" }));
    var onto = O() && O().get();
    var log = ((onto && onto.changelog) || []).slice().reverse();
    if (!log.length) {
      box.appendChild(el("p", { className: "os-empty", text: "No commits yet." }));
      return;
    }
    var ul = el("ul");
    log.slice(0, 40).forEach(function (row) {
      var li = el("li");
      li.appendChild(el("div", { className: "os-when", text: "rev " + row.rev + "  " + (row.at || "") }));
      li.appendChild(el("div", { text: (row.op || "") + "  " + (row.path || "") }));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function renderChrome() {
    var onto = O() && O().get();
    var v = O() ? O().validate() : { ok: true, errors: [], warnings: [] };
    tid("os-rev").textContent = onto ? "rev " + onto.revision : "rev —";
    var badge = tid("os-badge");
    badge.textContent = badgeText(v);
    badge.className = "os-badge " + (v.errors && v.errors.length ? "is-error" : v.warnings && v.warnings.length ? "is-warn" : "is-ok");
    tid("os-undo").disabled = !(O() && O().canUndo && O().canUndo());
    tid("os-redo").disabled = !(O() && O().canRedo && O().canRedo());
    var search = tid("os-search");
    if (document.activeElement !== search) search.value = query;
    tid("os-export-menu").hidden = !exportOpen;
  }

  function render() {
    if (!root) return;
    var snap = captureFocus();
    var onto = O() && O().get();
    if (onto) ensureSelected(onto);
    renderChrome();
    renderTabs();
    renderList();
    renderEditor();
    renderGraph();
    renderIssues();
    renderChangelog();
    restoreFocus(snap);
  }

  function open(opts) {
    build();
    opts = opts || {};
    if (opts.tab) tab = TABS.indexOf(opts.tab) >= 0 ? opts.tab : tab;
    if (opts.objectType) {
      tab = "objects";
      selectedId = opts.objectType;
    }
    root.hidden = false;
    render();
  }

  function close() {
    if (!root) return;
    root.hidden = true;
    exportOpen = false;
  }

  function isOpen() {
    return !!(root && !root.hidden);
  }

  function select(kind, id) {
    setTab(kind, id);
  }

  window.OntologyStudio = {
    open: open,
    close: close,
    isOpen: isOpen,
    select: select,
    render: render,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
