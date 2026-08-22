import test from "node:test";
import assert from "node:assert/strict";
import { evaluatedDamageExpression } from "../scripts/rules/combat-damage-display.js";

test("muestra los resultados individuales de arma y bonificador", () => {
  const roll = { dice: [
    { results: [{ result: 6, active: true }] },
    { results: [{ result: 2, active: true }] }
  ] };
  assert.equal(evaluatedDamageExpression(roll, ["1d8 + 1", "-1d2", "0"]), "6 + 1 - 2");
});

test("expande varios dados y conserva el daño extraordinario", () => {
  const roll = { dice: [
    { results: [{ result: 3 }, { result: 5 }] },
    { results: [{ result: 2 }] }
  ] };
  assert.equal(evaluatedDamageExpression(roll, ["2d6", "0", "1d4 + 1"]),
    "(3 + 5) + 0 + 2 + 1");
});
