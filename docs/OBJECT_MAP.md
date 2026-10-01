# Object map

Constructor skin view. Objects are nodes. Links are typed edges. Layout is a fixed circle, so the same tables always land in the same places. Pan and zoom move the view only.

Seed is the labelled synthetic orders fixture from `Planner.sampleSchema`, plus companion tables held in `object-map.js` (Pages cannot load a fixture over the network). Try it proposals overlay matching card ids. The label is `synthetic object map, not a live catalog`.

Status on a node is `proposed`, `accepted`, or `certified`. `certified` is shown only when the card already has `certifiedBy` set to `cortex`. The map UI never writes that field.

Merge suggestions use three fixed scores: name or synonym similarity 0.5, overlapping key names 0.3, shared source table 0.2. A pair is listed only at 0.5 or above. The stored score is capped at 0.95 and the chip shows a percentage, so a rule match is never shown as certain. Merge and dismiss are clicks. The click writes `netie.skin-state/1` with `applied` false and `certified` false. The object graph is unchanged.

No layout library. No fetch.
