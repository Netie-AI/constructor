---
keywords: [constructor, palantir, aip-logic, workshop, pipeline-builder, chrome, preview, object-explorer]
main_idea: "Distill Palantir AIP Logic / Workshop / Pipeline Builder chrome onto generateGraph labs. Preview+Run header, Object Set rail, property table inspect, Engine DAG panel. Do not clone Foundry. P1 parked. n8n banned."
models: [grok-4.6]
workflow: constructor-palantir-chrome
reuse: golden_rule
status: verified
cite: distill: docs/subagents_findings/2026-09-04_constructor-cortex-brain.md
repo: Constructor
date: 2026-09-04
---

# Constructor Palantir-distilled chrome (2026-09-04)

PREFLIGHT: PARTIAL
reuse: constructor-cortex-brain, constructor-quiet-chrome, constructor-ontology-decision-card, TAS-PALANTIR, TAS-CONSTRUCTOR

## Distill (not clone)

| Analog | Keep | Refuse |
|---|---|---|
| AIP Logic | Inputs/blocks on left, Run panel on right, Preview then Run | Foundry runtime, Logic product |
| Pipeline Builder | DAG canvas + schema/preview table | Spark jobs, Palantir datasets |
| Workshop | Module header with 3 verbs | Widget layout system |
| Semantica | Object+property density in inspect | Hosted ontology hub |
| n8n | Left color stripe already on nodes | Engine, piece catalog, copy |

## Shipped

- Labs still `Core.labCompile` -> `generateGraph`. Venue/Watchlist seeds use the same compiler.
- Header is Preview / Run / Chat / Help / More. No ? spam, no play HUD in the brand.
- Inspect is Object + properties + Action + Run phases + Engine (Cortex brain JSON, `pages-sketch` on Pages).
- Ghost toggle label is Preview / Live. Chat says the same.
- Cortex write stays the existing patch on `cursor/constructor-cortex-mount`.

## Verify

```
node scripts/check-laws.js
npm run test:unit
npx playwright test tests/e2e/labs.spec.js tests/e2e/canvas.spec.js
```

## Do not

- Unpark P1 / vendor Foundry / copy n8n
- Fetch on GitHub Pages
- Merge landing
