---
keywords: [constructor, planner, intent, answer-spec, ontology-proposal, prompt-registry, cortex-stub, synthetic]
main_idea: v0.3.0 plans every request in Constructor before Cortex. Offline router plus a Cortex stub that is not called. Proposals stay proposed. No merge.
date: 2026-10-01
---

# Constructor planner (2026-10-01)

PREFLIGHT: HIT - INDEX already records Cortex as the only engine, Pages zero-fetch, and ontology.js as the model/UI split.

## New vs already there

Already: canvas, chat compile, ghost dry-run, Ontology Studio, governed-answer panel on open PR #14 (left untouched).

New: `planner.js` + `planner-ui.js`. Intent router, goal plan, answer spec chips, ontology proposal cards, versioned prompt registry. Effort picker uses `planner-prices.json` (unknown price stays unknown). Defaults are auto mode, confirmation off, and empty caps. A valid DMS settings object (inject, postMessage, or `netiePlannerSettings`) overrides localStorage. Invalid DMS settings fall back to the Constructor copy with a warning. Schema file: `planner-settings.schema.json`. Build high/max is a Cursor cloud-agent stub that is not called. Synthetic fixtures. Draft PR only. No DMS code in this repo.

UX pass: cards show a title, one line, and a chip. Detail is an i button (hover, pin, Esc). Solid tokens, no blur. Try it runs the offline pipeline. `skin-state.js` shares plan, proposals, pipeline, and the withheld answer. Accept all suggested never sets certified.

## Do not

- Paste n8n, LangChain, LangFlow, Crew, or Activepieces.
- Call the Cortex planner stub or a live model from tests.
- Auto-certify ontology proposals.
- Merge this PR. Do not merge landing.
