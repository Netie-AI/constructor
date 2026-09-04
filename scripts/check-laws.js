#!/usr/bin/env node
/* Law checks for the Constructor skin. Exit 1 on any violation, PASS lines otherwise.
   Laws: Pages never fetch (only engine.js may). No keys in the repo. index.html only
   references files that exist. pages.yml copies every file index.html needs. */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NO_FETCH_FILES = ["app.js", "ontology.js", "ontology-studio.js"];
const SKIP_DIRS = new Set([".git", "node_modules", "test-results", "playwright-report", ".cursor"]);
const TEXT_EXT = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".css", ".html", ".md", ".yml", ".yaml", ".json",
  ".ps1", ".py", ".txt", ".svg", ".sh", ".env", ".toml", ".ini", ".cfg",
]);
const KEY_RE = /ov_[A-Za-z0-9]{16,}/;

let failures = 0;
function pass(msg) { console.log("PASS " + msg); }
function warn(msg) { console.log("WARN " + msg); }
function fail(msg) { failures += 1; console.log("FAIL " + msg); }
function abs(rel) { return path.join(ROOT, rel); }
function exists(rel) { return fs.existsSync(abs(rel)); }
function read(rel) { return fs.readFileSync(abs(rel), "utf8"); }

// Law 1: zero `fetch(` in the Pages-side files.
function checkNoFetch() {
  const skipped = [];
  for (const rel of NO_FETCH_FILES) {
    if (!exists(rel)) { skipped.push(rel); continue; }
    const hits = [];
    read(rel).split(/\r?\n/).forEach((line, i) => {
      if (line.indexOf("fetch(") >= 0) hits.push(rel + ":" + (i + 1) + ": " + line.trim());
    });
    if (hits.length) {
      fail("`fetch(` found in " + rel + " (Pages never fetch; only engine.js may, on a /cortex origin):\n  " + hits.join("\n  "));
    } else {
      pass("no `fetch(` in " + rel);
    }
  }
  if (skipped.length) console.log("SKIP no-fetch check, file not present yet: " + skipped.join(", "));
}

// index.html -> local script/css references (query strings stripped, remote URLs ignored).
function indexRefs() {
  const html = read("index.html");
  const refs = [];
  const re = /<(script|link)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const isScript = m[1].toLowerCase() === "script";
    if (!isScript && !/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const a = tag.match(isScript ? /\bsrc\s*=\s*["']([^"']+)["']/i : /\bhref\s*=\s*["']([^"']+)["']/i);
    if (!a) continue;
    const raw = a[1].trim();
    if (/^(https?:)?\/\//i.test(raw) || /^data:/i.test(raw)) continue;
    refs.push({ kind: isScript ? "script" : "stylesheet", file: raw.split(/[?#]/)[0].replace(/^\.\//, "") });
  }
  return refs;
}

// Law 2: every local script/css referenced by index.html exists.
function checkIndexRefs(refs) {
  if (!refs.length) { fail("index.html references no local script/css; parser found nothing"); return; }
  const missing = refs.filter((r) => !exists(r.file));
  if (missing.length) {
    fail("index.html references files that do not exist: " + missing.map((r) => r.file + " (" + r.kind + ")").join(", "));
  } else {
    pass("index.html references exist: " + refs.map((r) => r.file).join(", "));
  }
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name), out);
    } else if (ent.isFile()) {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

function isTextFile(file) {
  const base = path.basename(file);
  const ext = path.extname(base).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  return ext === "" && base.startsWith(".") === true; // .gitignore and friends
}

// Law 3: no OpenVault-looking key (ov_ + 16+ alphanumerics) anywhere in source.
function checkNoKeys() {
  const files = walk(ROOT, []).filter(isTextFile);
  const hits = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = line.match(KEY_RE);
      if (m) hits.push(rel + ":" + (i + 1) + ": " + m[0].slice(0, 8) + "...");
    });
  }
  if (hits.length) {
    fail("OpenVault-looking key strings in source (never commit ov_ keys):\n  " + hits.join("\n  "));
  } else {
    pass("no ov_ key strings in " + files.length + " source files");
  }
}

// Law 4: pages.yml copy step includes index.html plus every .js/.css/.html it references.
function checkPagesCp(refs) {
  const rel = ".github/workflows/pages.yml";
  if (!exists(rel)) { fail(rel + " is missing"); return; }
  const line = read(rel).split(/\r?\n/).find((l) => /\bcp\s+/.test(l) && /_site/.test(l));
  if (!line) { fail(rel + " has no `cp ... _site` copy step"); return; }
  const tokens = [];
  const re = /\bcp\s+(.+?)\s+_site(?:\/[^\s]*)?/g;
  let m;
  while ((m = re.exec(line))) {
    m[1].trim().split(/\s+/).forEach(function (t) {
      if (t && t !== "&&") tokens.push(t);
    });
  }
  const need = ["index.html"].concat(refs.map((r) => r.file).filter((f) => /\.(js|css|html)$/i.test(f)));
  const missing = need.filter((f) => tokens.indexOf(f) < 0);
  if (missing.length) {
    fail("pages.yml copy step misses files index.html needs: " + missing.join(", ") + "\n  copy: " + line.trim());
  } else {
    pass("pages.yml copy step includes " + need.join(", "));
  }
  const absent = tokens.filter((t) => !exists(t));
  if (absent.length) warn("pages.yml copy step names files not present yet (cp will fail on deploy until they land): " + absent.join(", "));
}

checkNoFetch();
const refs = indexRefs();
checkIndexRefs(refs);
checkNoKeys();
checkPagesCp(refs);

if (failures) {
  console.log(failures + " law violation(s). Fix before pushing.");
  process.exit(1);
}
console.log("PASS all laws");
