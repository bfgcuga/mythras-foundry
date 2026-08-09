import test from "node:test";
import assert from "node:assert/strict";

import { ARMOR_PROFILES, ARMOR_SOURCES, armorDefaultName } from "../scripts/data/armor.js";
import { ARMOR_REFERENCE_LOCATIONS, armorPieceEncumbrance } from "../scripts/rules/armor.js";

test("el compendio contiene una pieza por perfil y localización", () => {
  assert.equal(ARMOR_PROFILES.length, 8);
  assert.equal(ARMOR_REFERENCE_LOCATIONS.length, 8);
  assert.equal(ARMOR_SOURCES.length, 64);
  assert.equal(new Set(ARMOR_SOURCES.map(({ buildKey }) => buildKey)).size, 64);
  assert.equal(new Set(ARMOR_SOURCES.map(({ name }) => name)).size, 64);
});

test("todas las piezas proceden de Mythras básico revisado y cubren una sola localización", () => {
  for (const source of ARMOR_SOURCES) {
    assert.equal(source.type, "armor");
    assert.equal(source.system.source, "Mythras básico revisado");
    assert.ok(ARMOR_REFERENCE_LOCATIONS.includes(source.system.referenceLocation));
    assert.deepEqual(source.system.coveredLocationIds, []);
    assert.equal(source.system.armorRulesVersion, 4);
  }
});

test("los nombres predeterminados combinan localización y perfil, no material", () => {
  assert.equal(armorDefaultName("head", "Armadura de escamas"),
    "Yelmo de armadura de escamas");
  assert.equal(armorDefaultName("chest", "Armadura laminada"),
    "Peto de armadura laminada");
  assert.equal(armorDefaultName("rightArm", "Armadura de mallas"),
    "Brazal derecho de armadura de mallas");
  assert.equal(armorDefaultName("leftLeg", "Armadura de coraza"),
    "Greba izquierda de armadura de coraza");
  assert.equal(armorDefaultName("special", "Armadura de escamas"),
    "Pieza de armadura (Armadura de escamas)");
});

test("cada perfil crea ocho piezas con su material predeterminado", () => {
  for (const profile of ARMOR_PROFILES) {
    const pieces = ARMOR_SOURCES.filter((source) => source.system.profileKey === profile.key);
    assert.equal(pieces.length, 8);
    assert.ok(pieces.every((piece) => piece.system.material === profile.material));
  }
});

test("los perfiles reproducen la tabla de PA, CRG y coste por localización", () => {
  assert.deepEqual(ARMOR_PROFILES.map(({ armorPoints, encumbrance, value }) =>
    [armorPoints, encumbrance, value]), [
    [1, 2, 20], [2, 1, 80], [3, 2, 180], [4, 3, 320],
    [5, 4, 500], [6, 5, 900], [7, 6, 1400], [8, 7, 2400]
  ]);
  for (const profile of ARMOR_PROFILES) {
    const piece = ARMOR_SOURCES.find((source) => source.system.profileKey === profile.key);
    assert.equal(armorPieceEncumbrance(piece), profile.encumbrance);
  }
});
