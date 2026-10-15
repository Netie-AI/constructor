/* Shared skin state for the planner, Studio chip, canvas pipeline, and answer panel.
   No DOM. No fetch. An edit in one view writes here so the others can read it. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root && typeof root === "object") root.SkinState = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA = "netie.skin-state/1";
  const LANES = ["Cortex", "DMS SQL", "OpenVault FreeRoute model hop", "KB"];
  const listeners = [];
  let current = blank();

  function blank() {
    return {
      schema: SCHEMA,
      request: "",
      plan: null,
      proposals: [],
      pipeline: [],
      answer: { title: "Answer", state: "withheld", badge: false, values: [] },
      merges: [],
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emit() {
    const snap = get();
    listeners.slice().forEach(function (fn) {
      fn(snap);
    });
  }

  function get() {
    return clone(current);
  }

  function cleanMerge(row) {
    row = row || {};
    const confidence = typeof row.confidence === "number" && isFinite(row.confidence) ? row.confidence : 0;
    return {
      id: String(row.id || ""),
      status: row.status === "dismissed" ? "dismissed" : "proposed",
      applied: false,
      certified: false,
      left: String(row.left || ""),
      right: String(row.right || ""),
      reason: String(row.reason || ""),
      confidence: confidence,
    };
  }

  function set(next) {
    next = next || {};
    const merges = Array.isArray(next.merges) ? next.merges.map(cleanMerge) : clone(current.merges || []);
    current = {
      schema: SCHEMA,
      request: next.request || "",
      plan: next.plan || null,
      proposals: Array.isArray(next.proposals) ? clone(next.proposals) : [],
      pipeline: Array.isArray(next.pipeline) ? clone(next.pipeline) : [],
      answer: {
        title: (next.answer && next.answer.title) || "Answer",
        state: "withheld",
        badge: false,
        values: [],
      },
      merges: merges,
    };
    emit();
    return get();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function patchNode(id, patch) {
    const row = (current.pipeline || []).filter(function (n) { return n.id === id; })[0];
    if (!row || !patch) return get();
    if (patch.title != null) row.title = String(patch.title);
    if (patch.summary != null) row.summary = String(patch.summary);
    if (patch.lane != null) row.lane = String(patch.lane);
    if (patch.role != null) row.role = String(patch.role);
    if (row.role === "answer" && patch.title != null) current.answer.title = row.title;
    emit();
    return get();
  }

  function removeNode(id) {
    current.pipeline = (current.pipeline || []).filter(function (n) { return n.id !== id; });
    emit();
    return get();
  }

  function moveNode(id, dir) {
    const list = current.pipeline || [];
    const i = list.findIndex(function (n) { return n.id === id; });
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return get();
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    emit();
    return get();
  }

  function setProposals(cards) {
    current.proposals = clone(cards || []);
    emit();
    return get();
  }

  function writeMerge(row, status) {
    const item = cleanMerge(Object.assign({}, row, { status: status }));
    if (!item.id) return get();
    current.merges = (current.merges || []).filter(function (m) { return m.id !== item.id; });
    current.merges.push(item);
    current.merges.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    emit();
    return get();
  }

  function proposeMerge(row) {
    return writeMerge(row, "proposed");
  }

  function dismissMerge(row) {
    return writeMerge(row, "dismissed");
  }

  return {
    SCHEMA: SCHEMA,
    LANES: LANES.slice(),
    blank: blank,
    get: get,
    set: set,
    subscribe: subscribe,
    patchNode: patchNode,
    removeNode: removeNode,
    moveNode: moveNode,
    setProposals: setProposals,
    proposeMerge: proposeMerge,
    dismissMerge: dismissMerge,
  };
});
