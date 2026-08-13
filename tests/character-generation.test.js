import test from "node:test";
import assert from "node:assert/strict";

import {
  CHARACTER_GENERATION_METHODS,
  adjustPointAllocation,
  calculateAllocationRemaining,
  canSwapCharacteristics,
  createMinimumAllocation
} from "../scripts/rules/character-generation.js";

test("ofrece asignación libre junto a los tres métodos existentes", () => {
  assert.deepEqual(CHARACTER_GENERATION_METHODS, [
    "random", "randomSwap", "points", "free"
  ]);
  assert.deepEqual(createMinimumAllocation(), {
    strength: 3,
    constitution: 3,
    size: 8,
    dexterity: 3,
    intelligence: 8,
    power: 3,
    charisma: 3
  });
});

test("la asignación parte de los mínimos y dispone de 44 puntos", () => {
  const allocation = createMinimumAllocation();
  assert.equal(calculateAllocationRemaining(allocation), 44);
  assert.equal(allocation.size, 8);
  assert.equal(allocation.intelligence, 8);
});

test("la asignación no baja de mínimos ni supera 75 puntos", () => {
  const allocation = createMinimumAllocation();
  assert.equal(adjustPointAllocation(allocation, "strength", -1), 3);

  allocation.strength += 44;
  assert.equal(calculateAllocationRemaining(allocation), 0);
  assert.equal(adjustPointAllocation(allocation, "dexterity", 1), 3);
});

test("solo se intercambian características obtenidas con los mismos dados", () => {
  assert.equal(canSwapCharacteristics("strength", "charisma"), true);
  assert.equal(canSwapCharacteristics("size", "intelligence"), true);
  assert.equal(canSwapCharacteristics("strength", "size"), false);
  assert.equal(canSwapCharacteristics("size", "size"), false);
});
