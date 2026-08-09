import test from "node:test";
import assert from "node:assert/strict";

import { MYTHRAS_REVISED_SOURCE } from "../scripts/data/sources.js";
import {
  MELEE_WEAPON_SOURCES,
  RANGED_WEAPON_SOURCES,
  SHIELD_SOURCES,
  SIEGE_WEAPON_SOURCES,
  WEAPON_SOURCES
} from "../scripts/data/weapons.js";

test("el compendio contiene exclusivamente las 63 armas y escudos del documento", () => {
  assert.equal(SHIELD_SOURCES.length, 8);
  assert.equal(MELEE_WEAPON_SOURCES.length, 35);
  assert.equal(SIEGE_WEAPON_SOURCES.length, 6);
  assert.equal(RANGED_WEAPON_SOURCES.length, 14);
  assert.equal(WEAPON_SOURCES.length, 63);
  assert.equal(new Set(WEAPON_SOURCES.map((entry) => entry.buildKey)).size, 63);
});

test("todas las entradas conservan fuente, coste, época y perfil reutilizable", () => {
  for (const entry of WEAPON_SOURCES) {
    assert.equal(entry.type, "weapon");
    assert.equal(entry.system.source, MYTHRAS_REVISED_SOURCE);
    assert.equal(entry.flags["mythras-foundry"].source, "mythras-basic-revised");
    assert.ok(entry.buildKey && entry.system.profileKey);
    assert.ok(entry.system.era);
    assert.ok(entry.system.value >= 0);
    assert.equal(entry.system.currentHitPoints, entry.system.maxHitPoints);
    assert.ok(entry.system.modes.some((mode) => mode.key === entry.system.activeModeKey));
  }
});

test("los siete objetos con varios usos reúnen sus modos en una sola entrada", () => {
  const multimode = WEAPON_SOURCES.filter((entry) => entry.system.modes.length > 1);
  assert.deepEqual(multimode.map((entry) => entry.buildKey).sort(), [
    "daga", "espada-larga", "hacha-batalla", "hachuela", "lanza-corta", "red", "tridente"
  ]);
  assert.deepEqual(WEAPON_SOURCES.find((entry) => entry.buildKey === "daga")
    .system.modes.map((entry) => entry.weaponType), ["melee", "ranged"]);
});

test("las columnas especiales de distancia y asedio quedan estructuradas", () => {
  const bow = WEAPON_SOURCES.find((entry) => entry.buildKey === "arco-largo");
  assert.equal(bow.system.damageModifierMode, "full");
  assert.equal(bow.system.modes[0].impalingSize, "P");
  const crossbow = WEAPON_SOURCES.find((entry) => entry.buildKey === "ballesta-pesada");
  assert.equal(crossbow.system.damageModifierMode, "none");
  const atlatl = WEAPON_SOURCES.find((entry) => entry.buildKey === "atlatl");
  assert.equal(atlatl.system.modes[0].powerModifier, 1);
  assert.equal(atlatl.system.range, "+0/+25/+75");
  const ballista = WEAPON_SOURCES.find((entry) => entry.buildKey === "balista");
  assert.deepEqual([
    ballista.system.modes[0].crewMinimum,
    ballista.system.modes[0].crewMaximum
  ], [2, 4]);
  assert.equal(ballista.system.handsRequired, 0);
});

test("los escudos conservan sus localizaciones de bloqueo pasivo", () => {
  assert.match(SHIELD_SOURCES.find((entry) => entry.buildKey === "rodela").system.traits,
    /2 Localizaciones/);
  assert.match(SHIELD_SOURCES.find((entry) => entry.buildKey === "scutum-paves").system.traits,
    /5 Localizaciones/);
});
