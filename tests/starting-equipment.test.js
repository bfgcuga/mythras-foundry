import test from "node:test";
import assert from "node:assert/strict";

import { replaceFormula, startingEquipmentRule, validateStartingEquipment }
  from "../scripts/rules/starting-equipment.js";

test("las seis clases sociales tienen reglas de equipo inicial", () => {
  for (const key of ["outcast", "slave", "freeman", "burgher", "aristocrat", "ruler"]) {
    assert.ok(startingEquipmentRule(key).clothing);
  }
});

test("la tirada de ropa sustituye la fórmula en la descripción", () => {
  const rule = startingEquipmentRule("burgher");
  assert.equal(replaceFormula(rule.clothing, rule.clothingFormula, 5),
    "5 mudas de ropa, hechas de tela de buena calidad y un nivel modesto de adornos.");
});

test("las elecciones exigen cantidades exactas y localizaciones de armadura únicas", () => {
  const rolls = { weaponCount: 2, armorLocations: 2, transportRequired: true };
  assert.equal(validateStartingEquipment({
    weapons: ["daga", "lanza"], armor: ["head", "chest"], transport: "Carro"
  }, rolls), true);
  assert.equal(validateStartingEquipment({
    weapons: ["daga", "lanza"], armor: ["head", "head"], transport: "Carro"
  }, rolls), false);
});
