import test from "node:test";
import assert from "node:assert/strict";

import { criticalWoundOutcome, dyingConditionSource, dyingRounds,
  shouldReplaceDying } from "../scripts/rules/dying.js";

test("Agonizando calcula las tres duraciones permitidas", () => {
  assert.equal(dyingRounds({ mode: "custom", customRounds: 7, healingRate: 3 }), 7);
  assert.equal(dyingRounds({ mode: "healingRate2", healingRate: 3 }), 6);
  assert.equal(dyingRounds({ mode: "healingRate60", healingRate: 3 }), 180);
});

test("Agonizando solo se sustituye por un contador estrictamente menor", () => {
  assert.equal(shouldReplaceDying(3, 4), false);
  assert.equal(shouldReplaceDying(3, 3), false);
  assert.equal(shouldReplaceDying(3, 2), true);
});

test("todas las heridas críticas comparten el mismo criterio de desenlace", () => {
  assert.deepEqual(criticalWoundOutcome({ extremity: true, healingRate: 2 }),
    { outcome: "dying", mode: "healingRate60", rounds: 120 });
  assert.deepEqual(criticalWoundOutcome({ enduranceSucceeded: true, healingRate: 2 }),
    { outcome: "dying", mode: "healingRate2", rounds: 4 });
  assert.deepEqual(criticalWoundOutcome({ enduranceSucceeded: false, healingRate: 2 }),
    { outcome: "dead", mode: null, rounds: 0 });
});

test("Agonizando se descuenta al principio de cada asalto", () => {
  const condition = dyingConditionSource(3);
  assert.equal(condition.unit, "dyingRounds");
  assert.equal(condition.phase, "startRound");
  assert.equal(condition.remaining, 3);
});
