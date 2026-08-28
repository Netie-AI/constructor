# constructor-pan-automate

Date: 2026-08-28
Keywords: constructor, pan, zoom, automate, react-flow, ghost, run_dag, ov_

## Main idea

World transform (wheel zoom toward cursor, empty-pane / Space / middle-drag pan) plus Automate (15s ghost loop, not live run_dag) is the React Flow-shaped skin. Do not clone xyflow. Live `POST /cortex/constructor/run` works for ingest->app with an OpenVault `ov_` key; a graph with `tool_call`/`export_pptx` can hang past 90s. DuckDB fetch collides when two Cortex processes share `dms_demo.duckdb`.

## Evidence (2026-08-28)

- Skin `http://127.0.0.1:8780/` (bind 127.0.0.1; IPv6-only 8778 is unreachable from 127.0.0.1).
- Browser: Automate on -> power `Automate #1 (15s ghost). Ghost run (no writes). 8 steps.` Wheel -> `translate(...) scale(1.08)`. Chat compiled ingest->app. Calendar popover opened on Edit node.
- `POST /cortex/constructor/generate` + `/ghost` HTTP 200 with `ov_` key. Demo `dms-demo-viewer-key` 401 on this 8010 process.
- `POST /cortex/constructor/run` ingest->app HTTP 200; fetch error if DuckDB locked by PID 6268 (:8012).
- Pages still `app.js?v=3`. `https://netie.ai/` has no OPEN CONSTRUCTOR. `https://app.netie.ai/cortex` 404.

## Cite

distill: skin world transform, not xyflow. Cortex remains the only engine.
