import test from "node:test";
import assert from "node:assert/strict";

import {
  ANCIENT_ARMOR_SOURCES,
  ARMOR_SOURCES,
  FUTURISTIC_ARMOR_SOURCES,
  MODERN_ARMOR_SOURCES
} from "../scripts/data/armor.js";

test("el compendio contiene las veinte armaduras de muestra de Imperativo", () => {
  assert.equal(ANCIENT_ARMOR_SOURCES.length, 7);
  assert.equal(MODERN_ARMOR_SOURCES.length, 9);
  assert.equal(FUTURISTIC_ARMOR_SOURCES.length, 4);
  assert.equal(ARMOR_SOURCES.length, 20);
});

test("cada armadura tiene clave única, era y puntos de armadura", () => {
  assert.equal(new Set(ARMOR_SOURCES.map(({ buildKey }) => buildKey)).size, 20);
  for (const source of ARMOR_SOURCES) {
    assert.equal(source.type, "armor");
    assert.ok(["ancient", "modern", "futuristic"].includes(source.system.era));
    assert.ok(source.system.armorPoints > 0);
  }
});

test("el catálogo conserva los extremos de protección de la tabla", () => {
  assert.equal(ARMOR_SOURCES.find(({ buildKey }) => buildKey === "pieles-cueros").system.armorPoints, 1);
  assert.equal(ARMOR_SOURCES.find(({ buildKey }) => buildKey === "armadura-asalto-completa").system.armorPoints, 12);
});
