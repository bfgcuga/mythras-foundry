import test from "node:test";
import assert from "node:assert/strict";

import {
  MELEE_WEAPON_SOURCES,
  RANGED_WEAPON_SOURCES,
  SHIELD_SOURCES,
  WEAPON_SOURCES
} from "../scripts/data/weapons.js";

test("el compendio contiene todas las armas y escudos de muestra de Imperativo", () => {
  assert.equal(SHIELD_SOURCES.length, 5);
  assert.equal(MELEE_WEAPON_SOURCES.length, 14);
  assert.equal(RANGED_WEAPON_SOURCES.length, 11);
  assert.equal(WEAPON_SOURCES.length, 30);
});

test("cada entrada tiene identificador de compilación y perfil reutilizable", () => {
  assert.equal(new Set(WEAPON_SOURCES.map((source) => source.buildKey)).size, 30);
  for (const source of WEAPON_SOURCES) {
    assert.equal(source.type, "weapon");
    assert.ok(source.buildKey);
    assert.ok(source.system.profileKey);
    assert.ok(source.system.damage);
    assert.equal(source.system.currentHitPoints, source.system.maxHitPoints);
    assert.ok(source.system.handsRequired >= 0 && source.system.handsRequired <= 2);
    assert.ok(source.system.modes.length >= 1);
    assert.ok(source.system.modes.some((mode) => mode.key === source.system.activeModeKey));
  }
});

test("las empuñaduras del compendio consumen las manos esperadas", () => {
  assert.equal(WEAPON_SOURCES.find(({ buildKey }) => buildKey === "punyo-patada").system.handsRequired, 0);
  assert.equal(WEAPON_SOURCES.find(({ buildKey }) => buildKey === "rodela").system.handsRequired, 1);
  assert.equal(WEAPON_SOURCES.find(({ buildKey }) => buildKey === "espada-ancha").system.handsRequired, 1);
  assert.equal(WEAPON_SOURCES.find(({ buildKey }) => buildKey === "espada-larga").system.handsRequired, 2);
});

test("los dos modos de la daga comparten perfil sin colisionar en el compendio", () => {
  const daggers = WEAPON_SOURCES.filter((source) => source.system.profileKey === "daga");
  assert.equal(daggers.length, 1);
  assert.deepEqual(daggers[0].system.modes.map((mode) => mode.key), ["melee", "thrown"]);
  assert.deepEqual(daggers[0].system.modes.map((mode) => mode.name), ["", "Arrojar"]);
  assert.deepEqual(new Set(daggers[0].system.modes.map((mode) => mode.weaponType)), new Set(["melee", "ranged"]));
});

test("las armas a distancia respetan el uso del modificador de daño", () => {
  const bow = RANGED_WEAPON_SOURCES.find((source) => source.buildKey === "arco");
  const rifle = RANGED_WEAPON_SOURCES.find((source) => source.buildKey === "rifle");
  assert.equal(bow.system.damageModifierMode, "full");
  assert.equal(rifle.system.damageModifierMode, "none");
});
