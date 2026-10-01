const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const S = require("../../skin-state.js");

test("skin state keeps the answer withheld and shares node edits", () => {
  const snap = S.set({
    request: "list open orders",
    proposals: [{ id: "a", status: "proposed", certified: false }],
    pipeline: [
      { id: "n1", role: "ingest", title: "Ingest", lane: "DMS SQL" },
      { id: "n2", role: "answer", title: "Answer", lane: "Cortex" },
    ],
    answer: { title: "Answer", state: "linked", badge: true, values: ["nope"] },
  });
  assert.equal(snap.schema, "netie.skin-state/1");
  assert.equal(snap.answer.state, "withheld");
  assert.equal(snap.answer.badge, false);
  assert.deepEqual(snap.answer.values, []);
  const renamed = S.patchNode("n2", { title: "Ledger", lane: "KB" });
  assert.equal(renamed.answer.title, "Ledger");
  assert.equal(renamed.pipeline[1].lane, "KB");
  const moved = S.moveNode("n2", -1);
  assert.equal(moved.pipeline[0].id, "n2");
  assert.equal(moved.pipeline[1].id, "n1");
  const removed = S.removeNode("n2");
  assert.equal(removed.pipeline.length, 1);
  assert.equal(removed.pipeline[0].role, "ingest");
  let seen = 0;
  const off = S.subscribe(function () { seen += 1; });
  S.setProposals([{ id: "a", status: "accepted", certified: false }]);
  assert.equal(seen, 1);
  assert.equal(S.get().proposals[0].certified, false);
  off();
});

test("design tokens are solid and have no blur", () => {
  const css = ["styles.css", "planner.css", "ontology.css"].map(function (name) {
    return fs.readFileSync(path.join(__dirname, "..", "..", name), "utf8");
  }).join("\n");
  assert.equal(/backdrop-filter/.test(css), false);
  assert.equal(/filter\s*:\s*blur/.test(css), false);
  assert.equal(/is-blur/.test(css), false);
  assert.match(css, /--font:\s*system-ui/);
  assert.match(css, /--fs-1:\s*12px/);
  assert.match(css, /--fs-5:\s*28px/);
  assert.match(css, /--fw-regular:\s*400/);
  assert.match(css, /--fw-strong:\s*600/);
  assert.match(css, /--lh:\s*1\.5/);
  assert.match(css, /--space-1:\s*8px/);
  assert.match(css, /--measure:\s*70ch/);
  assert.equal(/fonts\.google|@font-face/.test(css), false);
});
