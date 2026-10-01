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

Budget rate stays about 20 requests a minute. Dollar caps are user settings. Empty means unlimited.

## Effort and cost

Every plan offers low, medium, high, and max before a prompt is sent. The default mode is `auto`. Auto picks one level per request from the router plus the estimator, shows that level and the predicted cost on the plan, and appends a log row. Auto does not ask for confirmation.

Router pick, before a cap steps it down: `unclear` is low, `knowledge` / `database` / `insight` are medium, and `build-code` / `build-model` / `app-prompt` are high. If the predicted max is over a user cap, auto steps down. If the prediction is unknown and a cap is set, auto stays at low and does not invent a dollar amount. Empty caps leave the router pick in place.

Each level shows the deliverable, the request count from the estimator profile, the token range, the cost range, the caps that apply, and the client or lane it is wired to. The remaining per-call, per-run, and max-level budget stays on the plan. A numeric logged spend is the only amount subtracted. Unknown predictions are not subtracted. `spentUsd` stays null until a numeric cost is logged.

The estimator is `step count x the per-lane request profile x the provider price table` (`planner-prices.json`, version 1). Token sizes in that file are null, so the token range and the cost stay `unknown` until a sourced price and a sourced token profile exist. A null price is never replaced with a guess. `estimate` accepts another estimator. The light LLM estimator is not called.

## Settings

Schema `netie.planner-settings/1`. The JSON Schema is `planner-settings.schema.json`. Fields: effort mode (`auto`, `low`, `medium`, `high`, `max`), confirmation, per-call cap, per-run cap, max-level budget. Defaults: auto, confirmation off, caps empty. The Settings panel on the planner edits the Constructor copy. `localStorage` key `netie.constructor.planner.settings` stores that copy. The choice log is `netie.constructor.planner.log` (`netie.planner-effort-log/1`). There is no settings server. This repo does not implement DMS.

Users can set the same object in DMS. The planner reads one active source:

1. An injected `dmsSettings` object on the plan call, or `window.NETIE_PLANNER_DMS_SETTINGS` when Constructor is embedded.
2. A `postMessage` whose `type` is `netie.planner-settings` and whose `settings` field is the object.
3. The URL query `netiePlannerSettings`, a JSON string of the same object, when Constructor is embedded.
4. The Constructor copy in `localStorage`.

A valid DMS object takes precedence. The plan shows `settings source DMS` or `settings source Constructor`. Auto, confirmation, and caps behave the same either way. A DMS object is valid only when `schema` is `netie.planner-settings/1` and the fields match the schema. An invalid DMS object is not applied. The plan falls back to the Constructor copy and shows the warning `DMS settings were rejected`. Saving in the panel updates the Constructor copy only. It does not replace an active DMS object.

A number from the active source is enforced: the shown cost stops at the tightest remaining cap, and start refuses a level whose predicted max is over that cap. An empty cap does not clamp. Confirmation, when on, blocks a manual high or max until the user confirms. Auto still does not ask. Confirmation does not send a prompt.

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
