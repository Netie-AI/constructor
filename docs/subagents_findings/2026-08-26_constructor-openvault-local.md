```yaml
keywords: [constructor, openvault, ov_, cortex, fetch, run]
main_idea: "Local Constructor is workable on :8010 via Cortex mount + OpenVault ov_ keys; Pages still cannot live-run; app.netie.ai still empty."
models: [grok-4.6]
workflow: none
reuse: golden_rule
status: raw
cite: agent: constructor-openvault-local
repo: Constructor
date: 2026-08-26
```

# Constructor + OpenVault local mount

PREFLIGHT: MISS (no Constructor INDEX before this file)

## Main idea

- E:\Cortex had no constructor routes. Mount lives in `packs/dms/constructor_routes.py` plus compile/fetch helpers.
- OpenVault `:5000` `POST /api/apikeys` issues `ov_` keys. Cortex verifies then fetch/run.
- Local surface: `packs.dms.constructor_app:app` on `http://127.0.0.1:8010/cortex/constructor/` because full `CortexOS.api.main` needs litellm and the old Cortex venvs are broken.
- Proven: issue key, catalog 6 objects, run all actor `ov_*`, 7388 inventory rows, export_pptx write. Object picker is live ontology (inventory -> suppliers).
- Not proven: `https://app.netie.ai/cortex` (still host 404).

## Verify

```
E:\Cortex\.venv_constructor\Scripts\python.exe -m pytest tests/dms/test_constructor_graph.py -q
curl.exe -s -o NUL -w "skin=%{http_code}`n" http://127.0.0.1:8010/cortex/constructor/
```

## Do not

- Invent constructor.netie.ai
- Put fetch in Pages `app.js`
- Merge landing from this repo
