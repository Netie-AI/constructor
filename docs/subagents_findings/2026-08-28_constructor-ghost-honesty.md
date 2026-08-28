---
keywords: [constructor, ghost, honesty, 404, n8n]
main_idea: README now says app.netie.ai/cortex is 404 until Hyperlift. Cortex pytest covers ghost dry-run (no run_dag) and skin 404 honesty. Goal open.
date: 2026-08-28
---

# Constructor ghost honesty (2026-08-28)

PREFLIGHT: HIT - compile test existed; live-engine claim in README was false.

## New vs already there

Already: `engine.js` maps !res.ok to `{ok:false, status}` and ghostRun says blocked. `test_ghost_compiles_with_viewer_key`.

New: README 404 line. Cortex tests for 401, no run_dag/fetch, skin honesty.

Do not clone n8n. Do not claim live if 404.
