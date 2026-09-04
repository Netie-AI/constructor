---
keywords: [constructor, labs, play, trigger, webhook, stream, train, infer, retrain, define-block, airflow, n8n]
main_idea: "Three mock labs (train / infer+judge / retrain DAG) plus trigger+stream compile, play ticks, and define block. Not Airflow/n8n/plugin store. Pages still ghost-only."
models: [grok-4.6]
workflow: constructor-labs-play
reuse: golden_rule
status: verified
cite: distill: docs/subagents_findings/2026-08-28_constructor-ghost-honesty.md
repo: Constructor
date: 2026-09-04
---

# Constructor labs play (2026-09-04)

PREFLIGHT: HIT
reuse: constructor-ghost-honesty, constructor-activepieces-skip (distill webhook/schedule only; skip AP/Airflow clone)
spawn: skip

## Expected vs actual

- Expected: Playable labs with mock datasets; webhook/stream compile; DMS as Cortex place; new block = define action, not a marketplace; same 8-kind pipeline for voice and image-gen.
- Actual: Labs `train` / `infer` / `retrain` / `voice` / `image` / `warehouse` keep 8 nodes. Infer has trigger + mock region circle (bent_particle). Retrain notes Cortex DAG, not Airflow UI. `define block <id>` calls Ontology.addActionType + tool_call. Ticks count ghost walks. Zero `fetch(` in app.js.

## Verify

```
cd D:\Constructor-ontology-studio
node scripts/check-laws.js
npm run test:unit
npx playwright test
```

Laws PASS. 22 unit. 20 Playwright e2e (7 canvas + 6 labs + 7 studio).

## Invariants

- Default sample stays 8 nodes / 7 wires for canvas e2e.
- Live webhook/stream/run only on `/cortex`. Pages ghost.
- No n8n, no Activepieces 665, no Apache Airflow product UI.
- Do not merge landing into main.
