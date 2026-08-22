# Constructor agent notes

- Ticket: Netie-AI/landing#9. Parent: landing#8.
- Law: Cortex is the only engine. Constructor is a consumer skin.
- GitHub Pages (`https://netie-ai.github.io/constructor/`) is a no-login sketch. Keep HTTP 200. Zero `fetch`. Zero keys.
- ChatGPT-style control, ghost dry-run, and 3 Cortex pattern scores live in `engine.js`. Pages still has zero `fetch`. Live `POST /api/engine/run` only on `127.0.0.1:8010`.
- Cortex writer branch: `cursor/constructor-cortex-mount`. Do not attach held Cortex PRs.
- No Supabase. No n8n. Do not merge landing from this repo.
- P1 / O6 / P17 stay parked.
