# Governed Answer panel (2026-10-01)

Keywords: constructor, governed-answer, jsonl, withheld, forecast, no-fetch, example fixture
Main idea: Canvas panel classifies stored JSONL into governed / no-link / withheld. Predict stays refused unless a fitted model envelope says forecast. Example fixture only. No live model or Cortex call.

## Contract

- Governed: ontology link has table, key, and measure, and sql was executed. Show SQL, rows, source, badge `governed`.
- No link: model idea only. Values empty. Badge off.
- Any figure with no executed query: state WITHHELD. The number is not copied into the view.
- Predict: refused unless `model_envelope.fitted === true` and `task === "forecast"`. A forecast with no executed SQL is still WITHHELD.
- Refused chip reads `refusal_reason` exactly as stored. `GEN-01: insights_timeout` maps to `pacing (rate limit / no healthy key)`. A missing or unknown code stays `unlabelled`. Labels and near-misses are not guessed. Filter lists refusals by chip. `missing` and `would_answer` show only when the chip is truly missing data.
- The panel uses `netie.skin-state/1` (title only; answer stays withheld, badge off, values empty), the shared `.info-btn` / `.info-pop`, and the `:root` type scale. It does not copy those.

## Loader

`governed-answer.js` (schema `netie.governed-answer/1`, v0.2.0). No DOM. No fetch. The panel sits in the inspect column so it does not cover the canvas or the planner.
File picker uses FileReader in `app.js`.
URL load is `engine.js` `loadGovernedAnswerUrl`, gated on cortex origin, credentials omitted, and `urlLoadError` refuses `/cortex`, `app.netie.ai`, and model hosts.

Fixture: `tests/fixtures/governed-answer.example.jsonl`. Every row is labelled `example data, not a measured result`. Not a Sep 25 measured run.
