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

test("el equipo inicial acepta perfiles de cualquier modo y respeta clase y dotación", async () => {
  const { startingEquipmentWeapons } = await import('../scripts/rules/starting-equipment.js');
  const source=(buildKey,profileKey,modes,crewMinimum=0)=>({buildKey,system:{profileKey,modes,crewMinimum}});
  const items=[{type:'combatStyle',system:{weaponProfiles:[{name:'Lanza'},{key:'arco'}]}},{type:'equipment',system:{weaponProfiles:[{key:'espada'}]}}];
  const sources=[source('lanza-corta','lanza',[{key:'melee'}]),source('mixta','espada',[{key:'one'},{key:'two',profileKey:'arco'}]),source('espada','espada',[{key:'one'}]),source('asedio','arco',[{key:'one'}],2)];
  assert.deepEqual(startingEquipmentWeapons(sources,items,{weaponTier:'any'}).map(s=>s.buildKey),['lanza-corta','mixta']);
  assert.deepEqual(startingEquipmentWeapons(sources,items,{weaponTier:'simple'}).map(s=>s.buildKey),['lanza-corta']);
  assert.deepEqual(startingEquipmentWeapons(sources,[],{weaponTier:'any'}),[]);
});
