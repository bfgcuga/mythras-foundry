import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePassionBase,
  calculatePassionValues
} from "../scripts/rules/passions.js";

const actor = { power: 12, charisma: 9, intelligence: 14 };

test("cada tipo de objeto aplica la base de pasión correcta", () => {
  assert.equal(calculatePassionBase("person", actor), 21);
  assert.equal(calculatePassionBase("organization", actor), 26);
  assert.equal(calculatePassionBase("species", actor), 24);
  assert.equal(calculatePassionBase("place", actor), 26);
  assert.equal(calculatePassionBase("object", actor), 24);
  assert.equal(calculatePassionBase("ideal", actor), 26);
});

test("la pasión separa base, creación, experiencia y ajuste manual", () => {
  assert.deepEqual(calculatePassionValues({
    structured: true,
    objectType: "person",
    creationBonus: 40,
    experiencePoints: 3,
    manualAdjustment: -2
  }, actor), { base: 21, bonus: 41, total: 62, legacy: false });
});

test("una pasión antigua conserva exactamente su porcentaje", () => {
  assert.deepEqual(calculatePassionValues({ structured: false, value: 73 }, actor), {
    base: 0,
    bonus: 73,
    total: 73,
    legacy: true
  });
});
