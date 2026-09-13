---
keywords: [constructor, fde, ontology, provenance, ghost-refuse, 8012, hyperlift, dms]
main_idea: "FDE saleability: DMS ref FKs + changelog source/actor, ghost refuses a broken connector->ontology->insight->foundry->app spine, local :8012 runbook, prod cortex stays Hyperlift 404."
models: [grok-4.6]
workflow: fde-studio-ir
reuse: golden_rule
status: verified
cite: agent: constructor-fde-saleability
repo: Constructor
date: 2026-09-13
---

# Constructor FDE saleability (2026-09-13)

PREFLIGHT: HIT
reuse: constructor-ontology-studio, constructor-ghost-honesty, constructor-openvault-local, constructor-v0-scaffold

## Expected vs actual

- Expected: stranger-usable Cortex skin with Studio honesty, default FDE path, ghost refuse, local :8012 notes. No invented host. No Pages fetch.
- Actual before: Studio existed; FKs were strings; changelog had no source/actor; Turtle import was accepted then failed as JSON; ghost walked any graph; README said :8010 only; infer lab skipped ontology on the spine.
- Actual after: ref FKs on DMS core; provenance fields; roundTrip native/cortex; ghost `GRAPH_*` refuse; infer rewired onto ontology; `docs/FDE_RUNBOOK.md`; :8012 constructor-mount copy.

## Verify

```
node scripts/check-laws.js
node --test tests/*.test.js tests/unit/*.test.js
npx playwright test
```

## Invariants

- `fetch(` stays out of app.js / ontology.js / ontology-studio.js.
- Do not claim https://app.netie.ai/cortex live. Hyperlift 404.
- OpenVault `ov_` is the live-key source. No keys in repo.
- Do not merge landing from this repo.
