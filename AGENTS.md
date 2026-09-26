# Constructor agent notes

- Ticket: landing#9/#8 closed 2026-08-23 (live OPEN CONSTRUCTOR -> Pages). Remaining: live run on https://app.netie.ai/cortex.
- Law (rewritten 2026-09-26, founder decision): this repo holds two apps with separate purposes.
  - The Constructor skin (repo root: canvas, Ontology Studio, `engine.js`) is a consumer. Cortex is its answer/execution engine.
  - Netie Graph (`graph/`, Python) is the graph/ontology build service: ingest, extraction, knowledge graph, ontology (OWL/SHACL), reasoning, provenance. It is a fork of Semantica (MIT); keep `graph/LICENSE` unchanged and record changes in `graph/NOTICE`.
  - Netie Graph never imports Cortex and talks to it over HTTP only. Model calls belong to Cortex (keys in OpenVault, PII masking); do not give Netie Graph provider keys until its `netiegraph.llms` module goes through Cortex.
  - Cortex stays the only answer engine, ledger and key holder. Netie Graph does not answer end-user questions on its own.
- GitHub Pages (`https://netie-ai.github.io/constructor/`) is a no-login sketch. Keep HTTP 200. Zero `fetch`. Zero keys.
- Engine URL (existing host): `https://app.netie.ai/cortex` (HTTP 404 until Hyperlift; do not claim live) and local constructor-mount `http://127.0.0.1:8012/cortex`. Any localhost `/cortex` path is the engine origin (`:8010` may be an older pack). Key-gated (`X-API-Key` or `/cortex/session` cookie). OpenVault on `http://127.0.0.1:5000` issues `ov_` keys. Do not invent `constructor.netie.ai`.
- Live run is `POST /cortex/constructor/run` from `engine.js` only when origin is `/cortex`. Ghost dry-run stays local and refuses invalid FDE graphs. RSF-05: Constructor consumes CERTIFIED RSF into that path. Cortex mount note: `docs/patches/cortex-constructor-run-rsf.md`. FDE runbook: `docs/FDE_RUNBOOK.md`. Do not dual-seat Cortex (CREW-BELT-CLAIM).
- Cortex writer branch: `cursor/constructor-cortex-mount`. Do not attach held Cortex PRs.
- Our PRs: when required CI/CD is green, merge (`gh pr merge --squash`). Do not wait to be asked. Do not merge landing.
- No Supabase. No n8n. Do not merge landing from this repo.
- P1 / O6 / P17 stay parked.
- Ontology Studio lives in `ontology.js` (model, no DOM, Node-testable) and `ontology-studio.js` (UI). Contract in `docs/ONTOLOGY_STUDIO.md`. `app.js` catalog arrays are in-place views over `window.Ontology`; mutate through the API, never the arrays. New static files must be added to the `cp` line in `.github/workflows/pages.yml`; `scripts/check-laws.js` fails otherwise.
- `graph/` CI is `.github/workflows/graph.yml` (pytest, `-m "not integration"`, runs on changes under `graph/`). `scripts/check-laws.js` still scans `graph/` for `ov_` keys.
- CI (`.github/workflows/ci.yml`) runs `npm test`: laws, `node --test tests/unit/`, Playwright e2e with screenshots uploaded as artifacts. Pages deploy stays on push to `landing-9-first-path`.
