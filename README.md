# Constructor v0.1.0

Netie-native flow constructor. Ticket: [landing#9](https://github.com/Netie-AI/landing/issues/9) / CONSTRUCTOR-01.

Cortex is the only engine. This repo is a consumer skin: a stranger-usable canvas that compiles ingest -> ontology -> insight -> foundry -> app graphs, ghosts them locally, and live-runs only when mounted at a Cortex origin.

## What this is

- A Netie Constructor canvas (blocks, wires, inspect, chat compile).
- A small IR core (`core/constructor.js`) that maps Constructor kinds onto Cortex node kinds (`DOCUMENT_REF`, `AGENT_TASK`, `TOOL_CALL`, `EMIT`).
- Ghost dry-run on GitHub Pages (no login, no `fetch` from `app.js`).
- Live `POST /cortex/constructor/run` only when the page origin is `/cortex`.

## What this is not

- Not n8n. Not a pasted n8n UX or engine.
- Not Activepieces / Cortex `activeflow`. Do not import that tree.
- Not CrewAI dual. Not LangChain / LangFlow as runtime.
- Those names may appear later only as distill-as-options (export hints). Never as the engine.
- Not a new hostname. Do not invent `constructor.netie.ai`.

## Browse (real URLs only)

No invented public host. This PR does not mint one.

- Sketch (GitHub Pages, HTTP 200, no login): https://netie-ai.github.io/constructor/
- Repo: https://github.com/Netie-AI/constructor
- Engine target (keys required): https://app.netie.ai/cortex -- HTTP 404 until Hyperlift; do not claim live. Local: http://127.0.0.1:8010/cortex or http://127.0.0.1:8012/cortex

Until this branch is merged, the Pages sketch still reflects the default branch (`landing-9-first-path`). This feature branch is PR-browsable on GitHub.

## Layout

```
core/constructor.js   Netie IR: compile, topo, ghost walk, refuse, chat graph
ontology.js           Ontology Studio model (objects/links/actions). Distill Foundry, do not clone.
app.js                Canvas / inspect / chat dock (Pages-safe, no fetch)
engine.js             Cortex consumer: ghost, rank, live run when origin is /cortex
index.html            Shell
tests/                node:test core + unit; Playwright e2e on Ontology Studio
.github/workflows/    pages.yml, ci.yml (laws/unit/e2e), test.yml (core IR)
```

## Run

Sketch locally: `npm start` then open http://127.0.0.1:4173/

Cortex-mounted (engine + this skin): set `CORTEX_DIR` to a Cortex checkout on `cursor/constructor-cortex-mount`, then `./scripts/run-cortex-local.sh`. Open http://127.0.0.1:8012/cortex/login with an `ov_` key. Cortex must accept `train` / `infer` / `retrain` kinds and serve `core/constructor.js`.

Tests: `npm test` (laws + node:test unit including `core/constructor.js` + Playwright e2e). Sketch-only: `npm run test:unit`.

ChatGPT-style box compiles the canvas. Ghost mode dry-runs (no writes). Propose 3 ranks Cortex coordination patterns. Maximize applies the winner. Default graph is connector -> ontology -> insight -> foundry -> app.

Loop labs (Loop / 1 Train / 2 Infer / 3 Retrain) compile from `generateGraph("ingest train set then train then infer then retrain")`, not hardcoded overlays. Voice / image / warehouse labs use the same compiler with their prompts. On a `/cortex` origin, `engine.js` POSTs that graph to Cortex `ghost` / `run` / `generate` / `decision` and paints **Cortex brain** (compiled DAG, dropped cycle wires, fetches, run_dag outputs). Pages stay local compile, zero fetch.

Live fit/score still Cortex-only. Ghost on Pages is a mock ledger, not GPU.

Local mount: Cortex branch `cursor/constructor-cortex-mount`, `CONSTRUCTOR_SKIN_DIR` = this repo, uvicorn on `:8012`, OpenVault on `:5000`. Linux: `CORTEX_DIR=/path/to/Cortex ./scripts/run-cortex-local.sh`. Windows: `run-local.ps1`.

Ontology Studio (rail `Ontology studio`, header `Ontology`, chat `ontology`) edits object types, properties, link types, action types, interfaces and fetch places in place, with an SVG graph, validation issues, changelog, undo/redo, and export as native JSON, Cortex catalog, JSON-LD, or Turtle. Contract: `docs/ONTOLOGY_STUDIO.md`. Tests: `npm test` (laws, unit, Playwright e2e with screenshots).

Do not merge landing. Do not clone n8n/Activepieces.
