---
keywords: [constructor, ontology-studio, overlay, playwright, pages, issue-1, pr-3]
main_idea: "Studio overlay files were the session-limit gap. ontology-studio.js + ontology.css landed; 14 e2e + 22 unit + laws green; PR #3 squash-merged to landing-9-first-path; issue #1 closed."
models: [grok-4.6]
workflow: ontology-studio-finish
reuse: golden_rule
status: verified
cite: agent: constructor-ontology-studio-overlay
repo: Constructor
date: 2026-09-04
---

# Constructor Ontology Studio overlay (2026-09-04)

PREFLIGHT: PARTIAL
reuse: `docs/subagents_findings/2026-09-03_constructor-ontology-studio.md`
spawn: skip for studio write; Cortex ticket-runner in parallel

## Expected vs actual

- Expected: Foundry-style ontology editor inside Constructor; Pages still zero fetch / zero keys.
- Actual before this pass: branch `claude/ontology-interface-workflow-scale-l5ry3w` had model + integration + QA, but `ontology-studio.js` / `ontology.css` missing so index.html 404ed those assets.
- Actual after: overlay workbench (list, property table, graph, issues, changelog). Local: laws PASS, 22 unit, 14 Playwright e2e. Live browser open on :8126 showed studio over the canvas (Sketch, no fetch).

## Verify

```
cd D:\Constructor-ontology-studio
node scripts/check-laws.js
node --test tests/unit/
npx playwright test
```

14 passed. CI run 33845331166 test pass 7m40s. PR https://github.com/Netie-AI/constructor/pull/3 squash `43701ff`. Issue #1 closed.

## Invariants

- Do not merge landing into main. Merge feature PRs into `landing-9-first-path` so Pages deploys.
- `fetch(` stays out of app.js / ontology.js / ontology-studio.js.
- Cortex `POST /cortex/constructor/ontology` still missing; chat must not fake push success.

## Still open

- Live run on app.netie.ai/cortex (Hyperlift). GOLD/P1 parked.

## Pages (verified 2026-09-05)

`https://netie-ai.github.io/constructor/ontology-studio.js` HTTP 200. Studio overlay opens from `#open-ontology`: 14 objects, inventory editor, graph boxes, issues empty, badge `ok`. Session-limit dump from the cloud lanes is stale; do not rewrite model/studio/QA files.
