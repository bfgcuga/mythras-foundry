import test from "node:test";
import assert from "node:assert/strict";

import { armorCoversLocation, armorCoverageFactor, armorEquipConflicts,
  armorPhysicalTotals, totalArmorPoints, wornArmorPoints } from "../scripts/rules/armor.js";

const location = (name, category, armorPoints = 0) => ({ name, system: { category, armorPoints } });
const legacyArmor = (armorPoints, coverage = "", equipped = true) =>
  ({ system: { armorPoints, coverage, equipped } });
const piece = (id, armorPoints, coveredLocationIds, equipped = true) => ({
  id,
  system: { armorPoints, coveredLocationIds, coverageMigrated: true, equipped,
    baseEncumbrance: 2, baseValue: 10 }
});

test("la cobertura heredada se conserva hasta su migración", () => {
  assert.equal(armorCoversLocation(legacyArmor(2), location("Cabeza", "head")), true);
});

test("la cobertura heredada puede seleccionar nombres y categorías", () => {
  const helmet = legacyArmor(3, "Cabeza");
  const limbArmor = legacyArmor(1, "limb");
  assert.equal(armorCoversLocation(helmet, location("Cabeza", "head")), true);
  assert.equal(armorCoversLocation(helmet, location("Pecho", "chest")), false);
  assert.equal(armorCoversLocation(limbArmor, location("Brazo derecho", "limb")), true);
});

test("la armadura no equipada no protege", () => {
  assert.equal(wornArmorPoints(location("Pecho", "chest"), [legacyArmor(4, "", false)]), 0);
});

test("una pieza nueva solo protege las localizaciones seleccionadas", () => {
  const head = { id: "head", name: "Cabeza", system: { category: "head", armorPoints: 1 } };
  const chest = { id: "chest", name: "Pecho", system: { category: "chest", armorPoints: 0 } };
  const helmet = piece("helmet", 4, ["head"]);
  assert.equal(totalArmorPoints(head, [helmet]), 5);
  assert.equal(totalArmorPoints(chest, [helmet]), 0);
});

test("carga y precio suman los multiplicadores de las localizaciones cubiertas", () => {
  const locations = [
    { id: "left-leg", system: { armorMultiplier: 1.5 } },
    { id: "right-leg", system: { armorMultiplier: 1.5 } },
    { id: "chest", system: { armorMultiplier: 3 } }
  ];
  const greaves = piece("greaves", 6, ["left-leg", "right-leg"]);
  assert.equal(armorCoverageFactor(greaves, locations), 3);
  assert.deepEqual(armorPhysicalTotals(greaves, locations), {
    factor: 3, encumbrance: 6, value: 30
  });
});

test("se detecta el solapamiento entre piezas equipadas", () => {
  const helmet = piece("helmet", 4, ["head"], false);
  const hood = piece("hood", 1, ["head"], true);
  const greaves = piece("greaves", 4, ["left-leg", "right-leg"], true);
  assert.deepEqual(armorEquipConflicts(helmet, [helmet, hood, greaves]), ["head"]);
});
