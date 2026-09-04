const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("app.js never calls fetch (Pages sketch stays no-login)", () => {
  const src = read("app.js");
  assert.equal(/\bfetch\s*\(/.test(src), false);
});

test("engine.js fetch is gated on cortexOrigin", () => {
  const src = read("engine.js");
  assert.equal(/async function cortexPost/.test(src), true);
  assert.equal(/if \(!cortexOrigin\(\)\) return null;/.test(src), true);
  assert.equal(/POST \/cortex\/constructor\/run/.test(src), true);
});

test("no invented constructor.netie.ai host", () => {
  const files = ["README.md", "AGENTS.md", "index.html", "app.js", "engine.js", "core/constructor.js", "ontology.js", "ontology-studio.js"];
  for (const rel of files) {
    const src = read(rel);
    const uses = src.match(/https?:\/\/constructor\.netie\.ai/gi) || [];
    assert.equal(uses.length, 0, rel + " invented a host URL");
  }
});

test("README names real browse URLs and what this is not", () => {
  const src = read("README.md");
  assert.match(src, /https:\/\/netie-ai\.github\.io\/constructor\//);
  assert.match(src, /https:\/\/github\.com\/Netie-AI\/constructor/);
  assert.match(src, /landing#9/);
  assert.match(src, /CONSTRUCTOR-01/);
  assert.match(src, /Not n8n/i);
  assert.match(src, /Activepieces/i);
  assert.match(src, /Crew/i);
});

test("index.html loads core then canvas then engine", () => {
  const html = read("index.html");
  const coreAt = html.indexOf("core/constructor.js");
  const appAt = html.indexOf("app.js");
  const engineAt = html.indexOf("engine.js");
  assert.equal(coreAt >= 0, true);
  assert.equal(coreAt < appAt, true);
  assert.equal(appAt < engineAt, true);
  assert.match(html, /NETIE \/ CONSTRUCTOR/);
});

test("skin copy is Netie Constructor, not an n8n clone", () => {
  const html = read("index.html");
  assert.match(html, /Constructor — Netie/);
  assert.equal(/\bn8n\b/i.test(html) && /workflow automation platform/i.test(html), false);
});
