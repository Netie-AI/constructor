```yaml
keywords: [constructor, 8040, decision, overlay, control, no-n8n]
main_idea: "8040 Control launches Constructor at /constructor/. Chat compiles DAG. Double-click opens Cortex decision overlay. No n8n/xyflow license strip."
models: [grok-4.6]
workflow: none
reuse: golden_rule
status: raw
cite: agent: constructor-8040-decision-overlay
repo: Constructor
date: 2026-08-27
```

# Constructor on Control 8040 + decision overlay

PREFLIGHT: HIT constructor-generative-decision, constructor-ontology-decision-card

## Main idea

- Do not clone n8n or xyflow. Do not strip licenses.
- Control `:8040` stays plane 4. `GET /constructor/` launches the Constructor sketch.
- Live engine remains `http://127.0.0.1:8010/cortex/constructor/`.
- Double-click / Press opens a Cortex decision-layer dialog (kind, EMIT, confirm, write).

## Verify

```
curl.exe -s -o NUL -w "ctor=%{http_code}`n" http://127.0.0.1:8040/constructor/
```

Chat `export inventory and supplier risk as pptx`, click a node, press Cortex decision.

## Do not

- Clone n8n / xyflow and remove LICENSE
- Replace Control `/` with an engine
- Put fetch in Pages `app.js`
