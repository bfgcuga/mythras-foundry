import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePassionBase,
  calculatePassionValues
} from "../scripts/rules/passions.js";

const actor = { power: 12, charisma: 9, intelligence: 14 };

test("cada tipo de objeto aplica la base de pasión correcta", () => {
  assert.equal(calculatePassionBase("person", actor), 53);
  assert.equal(calculatePassionBase("person", actor, 15), 57);
  assert.equal(calculatePassionBase("organization", actor), 56);
  assert.equal(calculatePassionBase("species", actor), 54);
  assert.equal(calculatePassionBase("place", actor), 56);
  assert.equal(calculatePassionBase("object", actor), 54);
  assert.equal(calculatePassionBase("ideal", actor), 56);
});

test("la pasión separa base, creación, experiencia y ajuste manual", () => {
  assert.deepEqual(calculatePassionValues({
    structured: true,
    objectType: "person",
    targetCharisma: 11,
    creationBonus: 10,
    experiencePoints: 3,
    manualAdjustment: -2
  }, actor), { base: 53, bonus: 11, total: 64, legacy: false });
});

test("una pasión antigua conserva exactamente su porcentaje", () => {
  assert.deepEqual(calculatePassionValues({ structured: false, value: 73 }, actor), {
    base: 0,
    bonus: 73,
    total: 73,
    legacy: true
  });
});
