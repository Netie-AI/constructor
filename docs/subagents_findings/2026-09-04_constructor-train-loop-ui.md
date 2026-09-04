---
keywords: [constructor, loop, train, infer, retrain, ingest, help, chips, ui, langflow, n8n]
main_idea: "Walkable ingest->train->infer->retrain loop with first-class blocks, ? help marks, and chat chips. Distill Langflow/n8n chrome; do not clone."
models: [grok-4.6]
workflow: constructor-train-loop-ui
reuse: golden_rule
status: verified
cite: distill: docs/subagents_findings/2026-09-04_constructor-labs-play.md
repo: Constructor
date: 2026-09-04
---

# Constructor train loop + help UI (2026-09-04)

PREFLIGHT: HIT
reuse: constructor-labs-play, constructor-block-io, constructor-calendar-ingest-skin
spawn: skip

## Expected vs actual

- Expected: Stranger can work ingest -> train -> infer -> retrain as one cycle; ugly chrome gets help `?` + press/type suggestions; more blocks interactive and prettier.
- Actual: `lab loop` is an 8-node cycle (ingest/train/infer/audit/retrain/ontology/foundry/app) with a retrain->train wire. Run walks phases. `train`/`infer`/`retrain` are addable kinds with IN/OUT edit. `?` opens press/type help. Chat chips send `lab loop` / `run` / `add train`. Distill Langflow header bar + n8n palette help; not a clone. Existing 1/2/3 labs stay 8 nodes.

## Verify

```
node scripts/check-laws.js
npm run test:unit
npx playwright test
```

## Invariants

- Default sample stays 8 nodes / 7 wires.
- Pages zero fetch. Live fit/score/run only on /cortex.
- No n8n / Activepieces / Airflow product UI.
- Do not merge landing.
