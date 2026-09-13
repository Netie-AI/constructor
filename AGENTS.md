# Constructor agent notes

- Ticket: landing#9/#8 closed 2026-08-23 (live OPEN CONSTRUCTOR -> Pages). Remaining: live run on https://app.netie.ai/cortex.
- Law: Cortex is the only engine. Constructor is a consumer skin.
- GitHub Pages (`https://netie-ai.github.io/constructor/`) is a no-login sketch. Keep HTTP 200. Zero `fetch`. Zero keys.
- Engine URL (existing host): `https://app.netie.ai/cortex` (HTTP 404 until Hyperlift; do not claim live) and local constructor-mount `http://127.0.0.1:8012/cortex`. Any localhost `/cortex` path is the engine origin (`:8010` may be an older pack). Key-gated (`X-API-Key` or `/cortex/session` cookie). OpenVault on `http://127.0.0.1:5000` issues `ov_` keys. Do not invent `constructor.netie.ai`.
- Live run is `POST /cortex/constructor/run` from `engine.js` only when origin is `/cortex`. Ghost dry-run stays local and refuses invalid FDE graphs. RSF-05: Constructor consumes CERTIFIED RSF into that path. Cortex mount note: `docs/patches/cortex-constructor-run-rsf.md`. FDE runbook: `docs/FDE_RUNBOOK.md`. Do not dual-seat Cortex (CREW-BELT-CLAIM).
- Cortex writer branch: `cursor/constructor-cortex-mount`. Do not attach held Cortex PRs.
- Our PRs: when required CI/CD is green, merge (`gh pr merge --squash`). Do not wait to be asked. Do not merge landing.
- No Supabase. No n8n. Do not merge landing from this repo.
- P1 / O6 / P17 stay parked.
- Ontology Studio lives in `ontology.js` (model, no DOM, Node-testable) and `ontology-studio.js` (UI). Contract in `docs/ONTOLOGY_STUDIO.md`. `app.js` catalog arrays are in-place views over `window.Ontology`; mutate through the API, never the arrays. New static files must be added to the `cp` line in `.github/workflows/pages.yml`; `scripts/check-laws.js` fails otherwise.
- CI (`.github/workflows/ci.yml`) runs `npm test`: laws, `node --test tests/unit/`, Playwright e2e with screenshots uploaded as artifacts. Pages deploy stays on push to `landing-9-first-path`.
