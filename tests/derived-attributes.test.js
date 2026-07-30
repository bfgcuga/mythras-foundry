import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateActionPoints,
  calculateDamageModifier,
  calculateExperienceModifier,
  calculateHealingRate,
  calculateInitiative,
  calculateLuckPoints,
  calculateMovementRate
} from "../scripts/rules/derived-attributes.js";

test("Mythras Imperativo concede siempre dos puntos de acción", () => {
  assert.equal(calculateActionPoints(), 2);
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

test("el ritmo de movimiento humano de Imperativo es seis", () => {
  assert.equal(calculateMovementRate(), 6);
});

test("modificador de daño conserva estructura y etiqueta", () => {
  assert.deepEqual(calculateDamageModifier(10, 10), {
    sign: -1,
    terms: [{ dice: 1, faces: 2 }],
    label: "-1d2"
  });
  assert.deepEqual(calculateDamageModifier(13, 12), {
    sign: 0,
    terms: [],
    label: "0"
  });
  assert.deepEqual(calculateDamageModifier(15, 15), {
    sign: 1,
    terms: [{ dice: 1, faces: 2 }],
    label: "+1d2"
  });
  assert.equal(calculateDamageModifier(35, 36).label, "+1d8+1d6");
  assert.equal(calculateDamageModifier(55, 56).label, "+2d10+1d2");
  assert.equal(calculateDamageModifier(60, 61).label, "+2d10+1d4");
});
