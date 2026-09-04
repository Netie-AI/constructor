# Constructor

Consumer skin for the Cortex engine. Ticket: [landing#9](https://github.com/Netie-AI/landing/issues/9).

- Sketch (no login, no `fetch`): https://netie-ai.github.io/constructor/
- Engine target (keys required): https://app.netie.ai/cortex -- HTTP 404 until Hyperlift; do not claim live. Local: http://127.0.0.1:8010/cortex
- Not a new hostname. Do not use constructor.netie.ai.

ChatGPT-style box compiles the canvas. Ghost mode dry-runs (no writes). Propose 3 ranks Cortex coordination patterns. Maximize applies the winner. Default graph is connector -> ontology -> insight -> foundry -> app.

Ontology Studio (rail `Ontology studio`, header `Ontology`, chat `ontology`) edits object types, properties, link types, action types, interfaces and fetch places in place, with an SVG graph, validation issues, changelog, undo/redo, and export as native JSON, Cortex catalog, JSON-LD, or Turtle. Contract: `docs/ONTOLOGY_STUDIO.md`. Tests: `npm test` (laws, unit, Playwright e2e with screenshots).

Do not merge landing. Do not clone n8n/Activepieces.
