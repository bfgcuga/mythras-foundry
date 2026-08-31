import test from "node:test";
import assert from "node:assert/strict";
import { advanceActorTurnDuration, advanceRoundDuration, expiresAtRoundEnd, fatigueLossForResult,
  timedConditionSource, worsenFatigueLevel } from "../scripts/rules/timed-conditions.js";

test("las duraciones configurables por asaltos se reducen hasta expirar", () => {
  const condition = timedConditionSource({ key: "prone", combat: { uuid: "Combat.a" },
    duration: { unit: "round", phase: "endRound", value: 2 } });
  const first = advanceRoundDuration(condition, "Combat.a");
  assert.equal(first.action, "update");
  assert.equal(first.condition.remaining, 1);
  assert.equal(advanceRoundDuration(first.condition, "Combat.a").action, "expire");
  assert.equal(advanceRoundDuration(condition, "Combat.other").action, "keep");
});

test("una condición aplicada durante el turno actual se arma sin descontarse", () => {
  const condition = timedConditionSource({ key: "pressed",
    duration: { unit: "actorTurn", value: 1, skipCurrentTurn: true } });
  const armed = advanceActorTurnDuration(condition);
  assert.equal(armed.action, "update");
  assert.equal(armed.condition.remaining, 1);
  assert.equal(armed.condition.skipCurrentTurn, false);
  assert.equal(advanceActorTurnDuration(armed.condition).action, "expire");
});

test("Titubear consume incluso la condición aplicada durante el turno actual", () => {
  const condition = timedConditionSource({ key: "blinded",
    duration: { unit: "actorTurn", value: 1, skipCurrentTurn: true } });
  const result = advanceActorTurnDuration(condition, { consumeCurrent: true });
  assert.equal(result.action, "expire");
  assert.equal(result.condition.remaining, 0);
  assert.equal(result.condition.skipCurrentTurn, false);
});

test("varios turnos solo descuentan uno por final de turno propio", () => {
  const condition = timedConditionSource({ key: "offBalance",
    duration: { unit: "actorTurn", value: 3 } });
  const result = advanceActorTurnDuration(condition);
  assert.equal(result.action, "update");
  assert.equal(result.condition.remaining, 2);
});

test("las duraciones de asalto solo vencen en su combate", () => {
  const condition = timedConditionSource({ key: "silenced", source: { combatUuid: "Combat.a" },
    duration: { unit: "round", phase: "endRound" } });
  assert.equal(expiresAtRoundEnd(condition, "Combat.a"), true);
  assert.equal(expiresAtRoundEnd(condition, "Combat.b"), false);
});

test("la matriz periódica y la fatiga respetan sus límites", () => {
  assert.equal(fatigueLossForResult("critical"), 0);
  assert.equal(fatigueLossForResult("success"), 1);
  assert.equal(fatigueLossForResult("failure", 2), 2);
  assert.equal(fatigueLossForResult("fumble", 3), 3);
  assert.equal(worsenFatigueLevel("fresh", 2), "tired");
  assert.equal(worsenFatigueLevel("dead", 3), "dead");
});
