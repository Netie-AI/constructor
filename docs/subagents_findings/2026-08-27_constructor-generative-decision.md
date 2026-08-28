```yaml
keywords: [constructor, generate, decision, chat, cortex, no-n8n]
main_idea: "Chat compiles Cortex nodes+wires; press-in shows decision layer. No n8n/xyflow license strip."
models: [grok-4.6]
workflow: none
reuse: golden_rule
status: raw
cite: agent: constructor-generative-decision
repo: Constructor
date: 2026-08-27
```

# Generative chat + Cortex decision layer

PREFLIGHT: HIT constructor-openvault-local

## Main idea

- Do not clone n8n or strip licenses. Constructor stays a Cortex skin.
- `generate_constructor_graph(prompt)` compiles ontology-aware nodes and wires.
- `POST /cortex/constructor/generate` and `/decision`. Pages uses the same compiler locally (zero fetch).
- Press a node or type `why` for Cortex kind / EMIT / confirm / write / pattern.

## Verify

```
pytest tests/dms/test_constructor_graph.py::test_generate_inventory_pptx_is_foundry_path -q
```

Live 8010: generate 200 orchestrator_subagent; decision 200 EMIT.

## Do not

- Clone n8n / xyflow and remove LICENSE or origin
- Invent a second engine
