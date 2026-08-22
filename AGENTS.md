# Constructor agent notes

- Ticket: Netie-AI/landing#9. Parent: landing#8.
- Law: Cortex is the only engine. Constructor is a consumer skin.
- GitHub Pages (`https://netie-ai.github.io/constructor/`) is a no-login sketch. Keep HTTP 200. Zero `fetch`. Zero keys.
- Engine URL (existing host): `https://app.netie.ai/cortex` and local `http://127.0.0.1:8010/cortex`. Any localhost `/cortex` path is the engine origin. Key-gated (`X-API-Key` or `/cortex/session` cookie). Do not invent `constructor.netie.ai`.
- Live run is `POST /cortex/constructor/run` from `engine.js` only when origin is `/cortex`. Ghost dry-run stays local.
- Cortex writer branch: `cursor/constructor-cortex-mount`. Do not attach held Cortex PRs.
- No Supabase. No n8n. Do not merge landing from this repo.
- P1 / O6 / P17 stay parked.
