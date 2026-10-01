# Constructor planner (v0.3.0)

Every request becomes a plan in Constructor before Cortex runs. Cortex is the only engine. This layer does not call a model and does not call Cortex.

## Files

| File | Role |
|------|------|
| `planner.js` | Model. Intent router, goal plan, answer spec, ontology proposals, prompt registry. No DOM. No fetch. |
| `planner-ui.js` | Canvas panel. Chips, proposal cards, JSON export. No fetch. |
| `planner.css` | Panel styles. |
| `planner-prices.json` | Versioned price table and estimator profile. Null price means unknown. |
| `tests/fixtures/planner-intents.synthetic.json` | Labelled synthetic requests. Not measured traffic. |
| `tests/fixtures/planner-table.synthetic.json` | Synthetic table schema plus distinct values. Not a live table. |

`engine.js` builds the plan at the start of `handleChat`, then keeps the existing command path. An unclear free-text request asks one question and does not compile a graph. Known commands (`check`, `run`, `rsf sample`, and the rest) still run after the plan is attached.

## Intent router

Exactly one of: `knowledge`, `database`, `insight`, `build-code`, `build-model`, `app-prompt`, `unclear`.

Each signal has an id, an intent, and a weight. The plan records the signals that counted and any signal dropped because a more specific intent already matched.

Confidence is `winner / (winner + runner-up)`. It is low, and the intent becomes `unclear`, when the winning score is under 2, or a runner-up exists and the winner is not more than twice that runner-up. Unclear asks one question.

`build-model` covers train and fit. Predict stays refused until a fitted model envelope says forecast. That gate is on the plan. This PR does not fit a model.

## Goal plan

Schema `netie.plan/1`. Fields: goal, success check, steps, lane per step, prompt mode plus reason, request budget, governance gates, prompt log.

Lanes: `Cortex`, `DMS SQL`, `OpenVault FreeRoute model hop`, `KB`.

Prompt modes: `one-shot`, `few-shot`, `multi-step`.

Budget, as a stop rule: about 20 requests a minute, a paid call stops at $0.02, a run stops at $5. Max effort stops at $30.

## Effort and cost

Every plan offers low, medium, high, and max before a prompt is sent. Each level shows the deliverable, the request count from the estimator profile, the token range, the cost range, and the client or lane it is wired to.

The estimator is `step count x the per-lane request profile x the provider price table` (`planner-prices.json`, version 1). Token sizes in that file are null, so the token range and the cost stay `unknown` until a sourced price and a sourced token profile exist. A null price is never replaced with a guess. `estimate` accepts another estimator. The light LLM estimator is not called.

Low, medium, and high keep the $0.02 call stop and the $5 run stop. Max stops at $30. High and max stay blocked until the user confirms. Confirmation does not send a prompt.

## Build lane

`build-code`, `build-model`, and `app-prompt` at high or max wire to the outsourced coding lane. The adapter is a Cursor cloud agent stub and it is not called. The brief is diff-first: target repo, affected paths from the supplied diff list, acceptance tests, and a budget. The whole tree is not ingested. Knowledge, database, and insight stay on the Cortex governed lane at every level.

After a run, `costCalibration` stores predicted against actual. Actual stays null in this version. Schema `netie.planner-cost-calibration/1`.

Governance uses the answer contract `netie.governed-answer/1`:

- Linked goes to SQL with rows, source, and a governed badge.
- No link gives an idea with values empty and the badge off.
- No executed query means withheld.
- Predict stays refused until a fitted model envelope says forecast.

## Answer spec

Schema `netie.answer-spec/1`. Database and insight plans carry it before any SQL: columns, grain (one row per what), filters, sort, limit. The canvas shows chips. Export is JSON for DMS to validate later. DMS is not in this repo.

A limit is set only when the request writes a number (`top 10`, `limit 10`).

## Ontology proposals

`proposeOntology` reads a table schema plus sampled distinct values. It emits cards for the object, key, measure, dimension, and low-cardinality value lists. Every card starts `proposed` with `certified: false`. A person accepts one card at a time. Export sends accepted items as `netie.ontology-proposal/1` with `certified: false` for Cortex. There is no certify function.

Low cardinality is the fixture flag `cardinality: "low"` or `lowCardinality: true`, or a distinct list whose length equals `distinctCount` and is at most 12.

## Prompt registry

Templates have id, version, mode, and a fixed prefix. The prefix is the whole instruction, including any fixed example, and it is written first. The request is appended after it so a provider can cache the prefix later. Each plan logs the template id and version it used. `reviseTemplate` throws. Prompts do not edit themselves in this version.

## Planner interface

`createPlanner(adapter)` binds `plan`. The default adapter is `offline-deterministic` and only runs the rules. `cortexPlannerStub()` describes `POST /cortex/constructor/plan` and counts `send` calls. `plan` does not call `send`.

## Out of scope

Not in this version, and not claimed: JEPA-style world models, RL loops that run forever, auto-deploy, and A2A orchestration beyond the stub lanes.
