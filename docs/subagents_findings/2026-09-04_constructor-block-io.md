---
keywords: [constructor, block-io, app, ingest, palantir, n8n, skin, data_in, data_out]
main_idea: "Each kind has its own IN/OUT contract. App is EMIT skin, not warehouse fetch. Distill n8n/AP node params; do not clone Airflow/Spark/665."
models: [grok-4.6]
workflow: constructor-block-io
reuse: golden_rule
status: verified
cite: distill: docs/subagents_findings/2026-08-28_constructor-calendar-ingest-skin.md
repo: Constructor
date: 2026-09-04
---

# Constructor per-kind block IO (2026-09-04)

PREFLIGHT: HIT
reuse: constructor-calendar-ingest-skin, constructor-ontology-decision-card, constructor-labs-play
spawn: skip

## Expected vs actual

- Expected: Edit App is not the same form as Ingest. Each block has data in, action, data out. DAG layout one pipeline row.
- Actual: `Core.nodeIo` + kind-specific `eventFieldsHtml`. App = skin + primary object. Ingest = place + object. Foundry = skin + cortex compute. Spark/Airflow named only as Cortex DAG compile.

## Verify

```
cd D:\Constructor-ontology-studio
node scripts/check-laws.js
npm run test:unit
npx playwright test
```

41 unit. 21 e2e including "app edit is a skin, not a warehouse fetch".

## Invariants

- No n8n engine. No Activepieces 665. No Airflow UI. Palantir P1 parked.
- Pages zero fetch. Live run only on /cortex.
