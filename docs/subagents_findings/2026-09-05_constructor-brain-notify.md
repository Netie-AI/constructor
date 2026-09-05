---
keywords: [constructor, cortex-brain, notify, draft_email, draft_whatsapp, pr-7, rsf-05, branches]
main_idea: "Port Cortex brain onto landing 8-node labs. Email/WhatsApp compile to drafts. Close dirty PR7. RSF-05 stays unseated until Platform/Hyperlift."
models: [grok-4.6]
workflow: constructor-brain-notify
reuse: golden_rule
status: verified
cite: distill: docs/subagents_findings/2026-09-04_constructor-labs-play.md
repo: Constructor
date: 2026-09-05
---

# Constructor Cortex brain + notify drafts (2026-09-05)

PREFLIGHT: HIT
reuse: constructor-labs-play, constructor-ghost-honesty, constructor-ontology-studio-overlay
spawn: skip (Constructor writer seated here)

## Expected vs actual

- Expected: open Constructor tickets/PRs solved; merged feature branches deleted; GOLD/P1/RSF-05 not fake-closed.
- Actual: PR #7 was dirty against landing (7-node generateGraph loop vs #5 8-node labs). Unique Cortex brain panel ported. Notify flow was uncommitted on chat-pipeline. Issue #2 RSF-05 still `DO NOT SEAT until Platform slot`.

## Verify

```
cd D:\Constructor-ontology-studio
node scripts/check-laws.js
node --test tests/unit/ tests/constructor.test.js
npx playwright test
```

## Invariants

- Labs stay 8 nodes / 7 wires. Do not revive PR7's 7-node loop.
- `fetch(` stays out of app.js / ontology.js / ontology-studio.js.
- Email/WhatsApp are drafts. Refuse baileys / whatsapp-web. P16 send stays parked.
- Do not merge landing into main. Merge this PR into `landing-9-first-path`.
- RSF-05 is not done: Hyperlift + RSF consume path. `POST /cortex/constructor/run` already exists for local /cortex.

## Still open

- Constructor #2 RSF-05 (Platform/Hyperlift).
- D:\Constructor worktree still has uncommitted Palantir-chrome WIP on `cursor/train-loop-ui-5407`. Do not delete that worktree until that WIP is committed or discarded.
- Cortex GOLD-01 / EPIC-010 / C7 are founder-gated; not this repo.
