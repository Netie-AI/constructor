---
keywords: [constructor, rsf-05, certified, consume, constructor-run, n8n, hyperlift, ghost]
main_idea: "Constructor consumes CERTIFIED RSF into ghost/run. POST /cortex/constructor/run from engine.js when origin is /cortex. n8n/LC/LF BAN. Hyperlift absent stays ghost. Cortex mount is a patch note only."
models: [grok-4.6]
workflow: constructor-rsf-05
reuse: golden_rule
status: verified
cite: distill: docs/subagents_findings/2026-09-05_constructor-brain-notify.md
repo: Constructor
date: 2026-09-06
---

# Constructor RSF-05 consume (2026-09-06)

PREFLIGHT: HIT
reuse: constructor-brain-notify, constructor-ghost-honesty, constructor-openvault-local
spawn: skip (Constructor writer seated here)

## Expected vs actual

- Expected: CERTIFIED RSF (dms_core.rsf wire) accepted into Constructor run/dry-run; n8n/LC/LF refused; Hyperlift absent = ghost, no invented live success; MAY show chosen option/route; no live Cortex dual-seat.
- Actual: `core/constructor.js` `consumeRsf` + `engine.js` `consumeRsfChat` / `constructorRunBody().rsf`. Chat `rsf sample` / `rsf ban` / paste JSON. Cortex note in `docs/patches/cortex-constructor-run-rsf.md`.

## Verify

```
npm test
```

## Invariants

- Engine stays `cortex`. Distill options may be listed. Never product_engine.
- Pages: zero `fetch` in app.js / ontology*. `engine.js` fetch only on `/cortex`.
- `live` is never true in `consumeRsf` itself. Live only after Cortex `remote.ok` on POST `/cortex/constructor/run`.
- Do not dual-seat Cortex. Do not merge landing.
