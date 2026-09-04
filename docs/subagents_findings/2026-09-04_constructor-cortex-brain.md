---
keywords: [constructor, cortex, mount, train, infer, retrain, labCompile, generateGraph, brain, run_dag]
main_idea: "Labs compile from generateGraph. Cortex mount accepts train/infer/retrain, serves nested skin files, and the UI shows Cortex DAG/run_dag as the brain."
models: [grok-4.6]
workflow: constructor-cortex-brain
reuse: golden_rule
status: verified
cite: distill: docs/subagents_findings/2026-09-04_constructor-train-loop-ui.md
repo: Constructor
date: 2026-09-04
---

# Constructor labs via generateGraph + Cortex brain (2026-09-04)

PREFLIGHT: HIT
reuse: constructor-train-loop-ui, constructor-openvault-local, constructor-ghost-honesty
spawn: skip

## Expected vs actual

- Expected: No hardcoded lab overlays. Same graph Constructor would chat-compile. When mounted at `/cortex`, auto-show Cortex internals (compile DAG, fetches, run_dag). Local machine build/run.
- Actual: `Core.labCompile` wraps `generateGraph` prompts. Train/infer/retrain/loop share the loop prompt (7 nodes + cycle wire). Cortex `constructor_graph` accepts those kinds, drops the cycle for the DAG, serves `core/constructor.js`, and exposes generate/decision. Inspect **Cortex brain** paints local compile on Pages and overlay ghost/run when origin is `/cortex`.

## Verify

```
node scripts/check-laws.js
npm run test:unit
npx playwright test tests/e2e/labs.spec.js tests/e2e/canvas.spec.js
# Cortex (from Cortex checkout, CONSTRUCTOR_SKIN_DIR=this repo):
PYTHONPATH=. pytest tests/dms/test_constructor_graph.py -q
```

## Invariants

- Default sample stays 8 nodes / 7 wires.
- Pages zero fetch. Live run only on /cortex.
- Cortex is the only engine. Do not merge landing.
- Cycle wire is a Constructor loop hint; Cortex DAG drops it.
