import test from "node:test";
import assert from "node:assert/strict";

import { armorCoversLocation, totalArmorPoints, wornArmorPoints } from "../scripts/rules/armor.js";

const location = (name, category, armorPoints = 0) => ({ name, system: { category, armorPoints } });
const armor = (armorPoints, coverage = "", equipped = true) => ({ system: { armorPoints, coverage, equipped } });

test("una cobertura vacía representa una armadura de cuerpo completo", () => {
  assert.equal(armorCoversLocation(armor(2), location("Cabeza", "head")), true);
});

test("la cobertura puede seleccionar nombres y categorías", () => {
  const helmet = armor(3, "Cabeza");
  const limbArmor = armor(1, "limb");
  assert.equal(armorCoversLocation(helmet, location("Cabeza", "head")), true);
  assert.equal(armorCoversLocation(helmet, location("Pecho", "chest")), false);
  assert.equal(armorCoversLocation(limbArmor, location("Brazo derecho", "limb")), true);
});

test("la armadura no equipada no protege", () => {
  assert.equal(wornArmorPoints(location("Pecho", "chest"), [armor(4, "", false)]), 0);
});

test("la protección total suma armadura natural y todas las capas aplicables", () => {
  const chest = location("Pecho", "chest", 2);
  assert.equal(totalArmorPoints(chest, [armor(3), armor(1, "Pecho"), armor(5, "Cabeza")]), 6);
});
