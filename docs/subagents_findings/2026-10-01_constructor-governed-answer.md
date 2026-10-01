# Governed Answer panel (2026-10-01)

Keywords: constructor, governed-answer, jsonl, withheld, forecast, no-fetch, example fixture
Main idea: Canvas panel classifies stored JSONL into governed / no-link / withheld. Predict stays refused unless a fitted model envelope says forecast. Example fixture only. No live model or Cortex call.

## Contract

- Governed: ontology link has table, key, and measure, and sql was executed. Show SQL, rows, source, badge `governed`.
- No link: model idea only. Values empty. Badge off.
- Any figure with no executed query: state WITHHELD. The number is not copied into the view.
- Predict: refused unless `model_envelope.fitted === true` and `task === "forecast"`. A forecast with no executed SQL is still WITHHELD.
- Refused chip comes only from `refusal_reason`: pacing, not yet an approved query, wrong level of detail, truly missing data. Absent or unknown stays `unlabelled`. Filter lists refusals by that chip. Truly missing data also shows stored `missing` and `would_answer`.

## Loader

`governed-answer.js` (schema `netie.governed-answer/1`, v0.2.0). No DOM. No fetch.
File picker uses FileReader in `app.js`.
URL load is `engine.js` `loadGovernedAnswerUrl`, gated on cortex origin, credentials omitted, and `urlLoadError` refuses `/cortex`, `app.netie.ai`, and model hosts.

Fixture: `tests/fixtures/governed-answer.example.jsonl`. Every row is labelled `example data, not a measured result`. Not a Sep 25 measured run.
