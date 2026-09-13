# FDE runbook -- Constructor as a Cortex consumer skin

Three surfaces. Do not mix them. Cortex is the only engine. This repo is not n8n, not Activepieces, not a second orchestrator.

## 1. Pages sketch (no login)

- URL: https://netie-ai.github.io/constructor/
- Local: `npm start` then http://127.0.0.1:4173/
- HTTP 200. Zero `fetch` in `app.js` / `ontology.js` / `ontology-studio.js`. Zero keys.
- Ghost dry-run only. Default canvas is hop 0 ingest, then **connector -> ontology -> insight -> foundry -> app**.
- Ghost refuses a broken spine (`GRAPH_FDE_MISSING`, `GRAPH_FDE_ORDER`, dangling edges, banned kinds). Reasons show in chat + audit JSON.
- Do not invent `constructor.netie.ai`.

## 2. Local Cortex mount (live on this laptop)

Constructor-mount is **http://127.0.0.1:8012/cortex**. Any localhost `/cortex` path is an engine origin. `:8010` may be an older pack without constructor routes -- do not assume it serves this skin.

```
export CONSTRUCTOR_SKIN_DIR=/path/to/constructor
export PYTHONPATH=/path/to/cortex
export PACK=dms
python -m uvicorn CortexOS.api.main:app --host 127.0.0.1 --port 8012
```

PowerShell: `run-local.ps1` or `scripts/start-local.ps1` (default port 8012). POSIX: `scripts/start-local.sh`.

Live calls (`POST /cortex/constructor/run`, fetch, issue-key) run from `engine.js` only when the page origin is `/cortex`.

## 3. Live keys = OpenVault `ov_`

- OpenVault: http://127.0.0.1:5000 issues `ov_` keys.
- Paste the token in the skin (Cortex origin) or use Issue ov_ key.
- Never commit `ov_` strings. Demo `dms-demo-*` keys may 401 when `DMS_REFUSE_DEMO_KEYS=1`.
- No Supabase. No client service-role keys in this repo.

## 4. Prod Hyperlift gate (honest)

https://app.netie.ai/cortex is LiteSpeed 404 until a Hyperlift VM serves Cortex. Do not claim live. Pages cannot live-run. Ghost stays local.

## 5. Ontology Studio (DMS-shaped, no Cortex checkout)

- Model: `ontology.js`. UI: `ontology-studio.js`. Contract: `docs/ONTOLOGY_STUDIO.md`.
- Seed pack `dms`: inventory / suppliers / locations / shipments (plus CRM + owned-watchlist types). FK properties are `ref`, not silent strings.
- Native JSON (`schema: netie.ontology/1`) round-trips. Cortex catalog import is a **lossy view** (points/links/actions). Turtle and JSON-LD are export-only.
- Changelog `source` / `actor` are local-studio unless a `/cortex` pull sets `cortex-catalog`. Never imply Cortex wrote a Pages edit.

## 6. Demo script (5 minutes)

1. Open the sketch. Confirm 8 nodes and hop 1-5 on connector / ontology / insight / foundry / app.
2. Ontology studio: inventory, suppliers, locations, shipments. Badge `ok`.
3. Ghost Run: "Ghost run (no writes)." Brain `fde.ok`.
4. Delete the ontology node (or unwire it) and Ghost: "Ghost refused" + `GRAPH_FDE_*`.
5. Say aloud: live run is :8012 + ov_, prod cortex is 404 until Hyperlift.
