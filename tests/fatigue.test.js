import test from "node:test";
import assert from "node:assert/strict";
import { applyFatigue, combineDifficulties, fatigueLevel, FATIGUE_LEVELS } from "../scripts/rules/fatigue.js";

const attributes = { movementRate: 6, initiative: 12, actionPointsMax: 2 };

test("la tabla contiene los diez niveles de fatiga en orden", () => {
  assert.deepEqual(FATIGUE_LEVELS.map((level) => level.key), ["fresh", "winded", "tired", "wearied", "exhausted", "debilitated", "incapacitated", "semiConscious", "comatose", "dead"]);
});

test("la fatiga aplica movimiento, iniciativa y puntos de acción", () => {
  assert.deepEqual(applyFatigue(attributes, "wearied"), { ...attributes, movementRate: 4, initiative: 10, actionPointsMax: 2, fatigue: fatigueLevel("wearied") });
  assert.equal(applyFatigue(attributes, "exhausted").movementRate, 3);
  assert.equal(applyFatigue(attributes, "exhausted").actionPointsMax, 1);
  assert.equal(applyFatigue(attributes, "incapacitated").movementRate, 0);
});

test("los niveles sin actividad anulan los atributos operativos", () => {
  const result = applyFatigue(attributes, "semiConscious");
  assert.equal(result.movementRate, 0); assert.equal(result.initiative, 0); assert.equal(result.actionPointsMax, 0);
});

test("la dificultad de fatiga nunca mejora una dificultad existente", () => {
  assert.equal(combineDifficulties("easy", "hard"), "hard");
  assert.equal(combineDifficulties("formidable", "hard"), "formidable");
  assert.equal(combineDifficulties("standard", "impossible"), "impossible");
});
