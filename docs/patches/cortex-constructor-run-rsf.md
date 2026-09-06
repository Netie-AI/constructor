# Cortex patch note (RSF-05) -- not a live Cortex writer

Constructor already POSTs optional `rsf` + `rsf_trace` on `POST /cortex/constructor/run` (and ghost) when a CERTIFIED artifact was consumed. Extra JSON fields are ignored by the current Pydantic `ConstructorRunBody` (`nodes`, `edges`, `run_id` only).

Do **not** land this from the Constructor repo. CREW-BELT-CLAIM is the Cortex writer. One writer per branch.

## Suggested Cortex mount (packs/dms/constructor_routes.py)

1. Add optional fields on `ConstructorRunBody`:

```python
rsf: dict[str, Any] | None = None
rsf_trace: list[dict[str, Any]] | None = None
```

2. In `constructor_run` (and optionally `constructor_ghost`), if `body.rsf` is present:

- `from CortexOS.rsf import parse_rsf_artifact, RsfConsumerError`
- `parse_rsf_artifact(body.rsf)` -- invent-green CERTIFIED (no `chosen_option` / no evidence) is 400
- If `chosen_option` (or a `route_trace[].chosen`) is `n8n` / `myn8n` / `langchain` / `langflow` / `langgraph`: HTTP 400 BAN. Distill-only. Never `run_dag`.
- Product engine stays Cortex `compile_constructor_graph` -> `run_dag`. `gencfsm_dag` as a chosen option is learn/bake-off via existing `CortexOS.execution.gen_cfsm` -> `dag_runner`, not a third orchestrator.

3. Do not vendor n8n / LangChain / LangFlow. Do not paste an upstream engine. Constructor skin remains a consumer.

## Already true on Cortex main (do not re-seat)

- `POST /cortex/constructor/run` exists (`packs/dms/constructor_routes.py`).
- Banned canvas kinds: `n8n`, `myn8n`, `langchain`, `langflow`, `gencfsm_dag` (`CortexOS/constructor_graph.py`).
- RSF-01 registry: `CortexOS/execution/distill_options.py`.
- RSF-02 consumer: `CortexOS/rsf.py` `parse_rsf_artifact`.

## Constructor client (this repo)

- Pages / non-`/cortex` origin: `consumeRsf(..., { cortexOrigin: false })` ghosts. `live` stays false.
- `/cortex` origin + ghost off: `engine.js` POSTs `constructorRunBody()` including `rsf`.
- 404 / offline Cortex: existing `ok: false` path. No invented live success.
