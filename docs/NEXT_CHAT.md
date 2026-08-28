Paste this as the first message in a NEW Cursor chat with workspace `D:\Constructor`. Recreate the goal with the same objective.

## Goal (keep intact, do not shrink)

Ship Constructor as a stranger-usable Cortex-powered workflow builder: ChatGPT control, ghost-mode dry-run, create/run/audit agentic workflows, show a few Cortex-benchmarked approaches, and a path from ontology -> insights -> foundry -> apps/connectors. No n8n, no Activepieces clone, no invented host, no client service-role key.

Do not mark the goal complete until a stranger can click OPEN CONSTRUCTOR on https://netie.ai/ and land on a working Constructor, AND live run works on https://app.netie.ai/cortex (key-gated), not only this laptop.

## Laws

- Cortex is the only engine. Constructor is a consumer skin.
- Pages `https://netie-ai.github.io/constructor/` : HTTP 200, zero `fetch` in `app.js`, zero keys. `engine.js` may fetch only when origin is `/cortex`.
- Engine URL: `https://app.netie.ai/cortex` and local `http://127.0.0.1:8010/cortex` or `http://127.0.0.1:8012/cortex`. Do not invent `constructor.netie.ai`.
- Do not merge landing from the Constructor repo.
- P1 / O6 / P17 parked. P16 WhatsApp send parked.
- Merge Constructor/Cortex PRs when required CI is green (`gh pr merge --squash`). Cortex writer branch was `cursor/constructor-cortex-mount`.

## What is already true (re-check, do not trust chat)

1. Pages sketch HTTP 200, cache `app.js?v=3`. Pages cannot live-run.
2. Local engine `http://127.0.0.1:8012/cortex` (Python 3.14, `CONSTRUCTOR_SKIN_DIR=D:\Constructor`, demo key `dms-demo-viewer-key`): fetch + `run all` via `POST /cortex/constructor/run`.
3. Cortex main has fetch/run via PR 54 merge `0cb485f`.
4. Live stranger CTA (2026-08-23 Playwright): click OPEN CONSTRUCTOR on https://netie.ai/ lands on https://netie-ai.github.io/constructor/. landing#8 and #9 closed.
5. Live patch is on addon docroot `/home/ffvtfuqcxb/netie.ai/index.html`: Pages href plus a `data-constructor-cta-fix` script that rewrites the React-hydrated `<button>` back to an `<a>`. `public_html` on this host is EMPTY. Do not FTP to `public_html`.
6. Web Hosting Essential for netie.ai is active (renews Dec 23, 2026). Server `server901.shared.spaceship.host`. Special FTP user `ffvtfuqcxb` (cPanel password, not shown in Configure FTP Client). 0 extra FTP accounts. GitHub `SPACESHIP_FTP_*` still empty.
7. Homepage workflow `Deploy homepage to Spaceship` mirrors to `public_html`. That is the wrong folder. Fix remote dir to `netie.ai` (or jail an FTP user to that dir and mirror to `.`) before dispatch. A Next export overlay will wipe the hydration script unless the built `out/index.html` already has a real `<a>`.

## What is false / blocked

1. `https://app.netie.ai/cortex` LiteSpeed 404. Shared Essential cannot run uvicorn. Need a VM (Spaceship Starlight) then point `app.netie.ai` / reverse-proxy `/cortex`. OpenVault `ov_` keys, not a client service-role.
2. Hosting expiry mail from Jul 2026 was stale; plan is active.
3. Local `8010` is the old pack (no constructor). Constructor-mount is `8012`.
4. Do not fake OpenClaw live scores. Cite G1 bakeoff DAG 4.1 vs OpenClaw 1.7 and DMS golden 36/36 only.

## Next

1. Human: start Spaceship Starlight Hyperlift **Large** (4 vCPU-class / 4 GiB, 7 days $0 then ~$26/mo). Empty today: no VM, no Hyperlift. Do not use Micro/Small. Shared Essential Python Selector exists (0 apps) but cannot host Cortex uvicorn.
2. After trial is live: Hyperlift should build merged `compose.constructor.yml` on Cortex main (PR 55 squash-merged). Auth on, `DMS_REFUSE_DEMO_KEYS=1`. Do not use `Dockerfile.core`. Pair OpenVault on loopback. Point `app.netie.ai` at the VM, serve `/cortex`.
3. Verify `run all` on https://app.netie.ai/cortex with an OpenVault key.
4. Durable homepage FTP (workflow still targets empty `public_html`) is secondary. CTA already live on addon docroot `netie.ai/`.
5. Goal stays open until step 3.

## Verify commands

```
curl.exe -s https://netie.ai/ | findstr /i "github.io/constructor data-constructor-cta-fix"
curl.exe -s -o NUL -w "pages=%{http_code}`n" https://netie-ai.github.io/constructor/
curl.exe -s -o NUL -w "prod_cortex=%{http_code}`n" https://app.netie.ai/cortex/
```

Local Cortex start (if 8012 is down):

```
$env:PYTHONPATH='D:\Cortex-constructor-mount'
$env:PACK='dms'
$env:CONSTRUCTOR_SKIN_DIR='D:\Constructor'
$env:DMS_API_KEYS='viewer:dms-demo-viewer-key;steward:dms-demo-steward-key;admin:dms-demo-admin-key'
python -m uvicorn CortexOS.api.main:app --host 127.0.0.1 --port 8012
```

Use `C:\Program Files\Python314\python.exe` if `D:\Cortex\.venv` hits openai types ImportError.
