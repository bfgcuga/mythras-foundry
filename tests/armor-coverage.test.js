import test from "node:test";
import assert from "node:assert/strict";

import { applyArmorInitiativePenalty, armorFitsWearer, armorInitiativePenalty,
  armorLocationForReference,
  armorMaterialModifier, armorPhysicalTotals, armorPieceValue, totalArmorEncumbrance,
  totalArmorPoints, wornArmorPoints } from "../scripts/rules/armor.js";

const location = (id, armorPoints = 0) => ({ id, system: { armorPoints } });
const piece = (id, armorPoints, coveredLocationIds, options = {}) => ({ id, system: {
  armorPoints, coveredLocationIds, equipped: true, baseEncumbrance: 4, baseValue: 500,
  material: "bronze", referenceLocation: "chest", ...options
} });

test("las piezas normales resuelven automáticamente su localización humana", () => {
  const locations = [
    { id: "leg", system: { rangeStart: 1, rangeEnd: 3 } },
    { id: "chest", system: { rangeStart: 10, rangeEnd: 12 } },
    { id: "head", system: { rangeStart: 19, rangeEnd: 20 } }
  ];
  assert.equal(armorLocationForReference("chest", locations)?.id, "chest");
  assert.equal(armorLocationForReference("head", locations)?.id, "head");
  assert.equal(armorLocationForReference("special", locations), null);
});

test("varias capas aplican solo el PA más alto y conservan la armadura natural", () => {
  const chest = location("chest", 1);
  const padding = piece("padding", 2, ["chest"]);
  const plate = piece("plate", 5, ["chest"]);
  assert.equal(wornArmorPoints(chest, [padding, plate]), 5);
  assert.equal(totalArmorPoints(chest, [padding, plate]), 6);
});

test("la CRG de todas las piezas equipadas se acumula y penaliza iniciativa hacia arriba", () => {
  const pieces = [
    piece("one", 5, ["chest"], { baseEncumbrance: 4 }),
    piece("two", 2, ["chest"], { baseEncumbrance: 2, material: "leather" })
  ];
  assert.equal(totalArmorEncumbrance(pieces), 8);
  assert.equal(armorInitiativePenalty(pieces), 2);
  assert.deepEqual(applyArmorInitiativePenalty({ initiative: 13, movementRate: 6 }, pieces), {
    initiative: 11, movementRate: 6, armorEncumbrance: 8, armorInitiativePenalty: 2
  });
});

test("los materiales modifican la CRG y no los PA", () => {
  const steel = piece("steel", 5, ["head"], { material: "steel" });
  assert.equal(armorMaterialModifier(steel), 0.75);
  assert.deepEqual(armorPhysicalTotals(steel, []), {
    encumbranceFactor: 0.75, costPercentage: 100, encumbrance: 3, value: 500
  });
});

test("la pieza especial usa el coste más alto configurado", () => {
  const special = piece("special", 4, ["tail"], {
    referenceLocation: "special", baseValue: 20,
    locationValues: { head: 30, chest: 50, rightArm: 10 }
  });
  assert.equal(armorPieceValue(special), 50);
});

test("las armaduras flexibles admiten ±1 TAM y las rígidas exigen el TAM exacto", () => {
  const wearer = { system: { size: 12 } };
  assert.equal(armorFitsWearer({ system: { construction: "flexible", designedSize: 11 } }, wearer), true);
  assert.equal(armorFitsWearer({ system: { construction: "flexible", designedSize: 10 } }, wearer), false);
  assert.equal(armorFitsWearer({ system: { construction: "rigid", designedSize: 11 } }, wearer), false);
  assert.equal(armorFitsWearer({ system: { construction: "rigid", designedSize: 12 } }, wearer), true);
});
