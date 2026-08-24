import test from "node:test";
import assert from "node:assert/strict";

import { exsanguinationConditionSource } from "../scripts/rules/exsanguination.js";
import { periodicConditionEntries } from "../scripts/rules/round-consequences.js";

test("Desangrándose es permanente y se procesa al inicio del asalto", () => {
  const condition = exsanguinationConditionSource();
  assert.equal(condition.key, "exsanguinating");
  assert.equal(condition.statusId, "exsanguinating");
  assert.equal(condition.unit, "manual");
  assert.equal(condition.phase, "startRound");
});

test("un Actor enlazado solo genera una pérdida automática por asalto", () => {
  const condition = exsanguinationConditionSource();
  const effect = { id: "blood", getFlag: () => condition };
  const actor = { id: "actor", isToken: false, uuid: "Actor.actor", effects: [effect],
    statuses: new Set() };
  const entries = periodicConditionEntries({ combatants: [
    { id: "one", actor }, { id: "two", actor }
  ] });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "exsanguinating");
  assert.equal(entries[0].automatic, true);
});
