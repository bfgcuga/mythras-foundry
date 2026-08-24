import test from "node:test";
import assert from "node:assert/strict";

import { advanceCombatFatigue, combatFatigueInterval,
  combatFatigueLoss } from "../scripts/rules/combat-fatigue.js";

test("calcula el intervalo de fatiga de combate redondeando CON hacia arriba", () => {
  assert.equal(combatFatigueInterval(1), 1);
  assert.equal(combatFatigueInterval(5), 1);
  assert.equal(combatFatigueInterval(6), 2);
  assert.equal(combatFatigueInterval(10), 2);
  assert.equal(combatFatigueInterval(11), 3);
});

test("cuenta cada asalto una sola vez y conserva el vencimiento al repetir la preparación", () => {
  const first = advanceCombatFatigue(null, { combatId: "c1", round: 1, interval: 2 });
  assert.equal(first.due, false);
  const second = advanceCombatFatigue(first.state, { combatId: "c1", round: 2, interval: 2 });
  assert.equal(second.due, true);
  const repeated = advanceCombatFatigue(second.state, { combatId: "c1", round: 2, interval: 2 });
  assert.equal(repeated.due, true);
  assert.deepEqual(repeated.state, second.state);
  const third = advanceCombatFatigue(second.state, { combatId: "c1", round: 3, interval: 2 });
  assert.equal(third.due, false);
});

test("la tirada periódica solo pierde un nivel al fallar", () => {
  assert.equal(combatFatigueLoss("critical"), 0);
  assert.equal(combatFatigueLoss("success"), 0);
  assert.equal(combatFatigueLoss("failure"), 1);
  assert.equal(combatFatigueLoss("fumble"), 1);
});
