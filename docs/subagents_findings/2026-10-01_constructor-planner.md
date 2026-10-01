---
keywords: [constructor, planner, intent, answer-spec, ontology-proposal, prompt-registry, cortex-stub, synthetic]
main_idea: v0.3.0 plans every request in Constructor before Cortex. Offline router plus a Cortex stub that is not called. Proposals stay proposed. No merge.
date: 2026-10-01
---

# Constructor planner (2026-10-01)

PREFLIGHT: HIT - INDEX already records Cortex as the only engine, Pages zero-fetch, and ontology.js as the model/UI split.

## New vs already there

Already: canvas, chat compile, ghost dry-run, Ontology Studio, governed-answer panel on open PR #14 (left untouched).

New: `planner.js` + `planner-ui.js`. Intent router, goal plan, answer spec chips, ontology proposal cards, versioned prompt registry. Effort picker uses `planner-prices.json` (unknown price stays unknown). Build high/max is a Cursor cloud-agent stub that is not called. Synthetic fixtures. Draft PR only.

## Do not

- Paste n8n, LangChain, LangFlow, Crew, or Activepieces.
- Call the Cortex planner stub or a live model from tests.
- Auto-certify ontology proposals.
- Merge this PR. Do not merge landing.
