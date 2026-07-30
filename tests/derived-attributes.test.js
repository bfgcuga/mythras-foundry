import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateActionPoints,
  calculateDamageModifier,
  calculateExperienceModifier,
  calculateHealingRate,
  calculateInitiative,
  calculateLuckPoints
} from "../scripts/rules/derived-attributes.js";

test("puntos de acción respetan los límites de tramo", () => {
  assert.equal(calculateActionPoints(6, 6), 1);
  assert.equal(calculateActionPoints(7, 6), 2);
  assert.equal(calculateActionPoints(12, 12), 2);
  assert.equal(calculateActionPoints(13, 12), 3);
});

test("modificador de experiencia respeta los límites de tramo", () => {
  assert.equal(calculateExperienceModifier(6), -1);
  assert.equal(calculateExperienceModifier(7), 0);
  assert.equal(calculateExperienceModifier(12), 0);
  assert.equal(calculateExperienceModifier(13), 1);
});

test("curación y suerte comparten progresión por tramos", () => {
  for (const calculate of [calculateHealingRate, calculateLuckPoints]) {
    assert.equal(calculate(6), 1);
    assert.equal(calculate(7), 2);
    assert.equal(calculate(12), 2);
    assert.equal(calculate(13), 3);
  }
});

test("iniciativa redondea hacia arriba", () => {
  assert.equal(calculateInitiative(12, 12), 12);
  assert.equal(calculateInitiative(12, 13), 13);
});

test("modificador de daño conserva estructura y etiqueta", () => {
  assert.deepEqual(calculateDamageModifier(10, 10), {
    sign: -1,
    dice: 1,
    faces: 2,
    label: "-1d2"
  });
  assert.deepEqual(calculateDamageModifier(13, 12), {
    sign: 0,
    dice: 0,
    faces: 0,
    label: "0"
  });
  assert.deepEqual(calculateDamageModifier(15, 15), {
    sign: 1,
    dice: 1,
    faces: 2,
    label: "+1d2"
  });
});
