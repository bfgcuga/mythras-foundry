import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_STYLE_SOURCES } from "../scripts/data/combat-styles.js";
import { COMBAT_STYLE_TRAIT_SOURCES } from "../scripts/data/traits.js";
import { WEAPON_SOURCES } from "../scripts/data/weapons.js";

const weaponKeys = new Set(WEAPON_SOURCES.map((weapon) => weapon.system.profileKey));
const traitKeys = new Set(COMBAT_STYLE_TRAIT_SOURCES.map((trait) => trait.system.key));

test("el compendio incluye los diez estilos de ejemplo del manual", () => {
  assert.equal(COMBAT_STYLE_SOURCES.length, 10);
  assert.equal(new Set(COMBAT_STYLE_SOURCES.map((style) => style.buildKey)).size, 10);
  assert.ok(COMBAT_STYLE_SOURCES.every((style) => (
    style.type === "combatStyle"
    && style.system.source === "Mythras básico revisado"
    && style.flags["mythras-foundry"].source === "mythras-basic-revised"
  )));
});

test("todas las armas y rasgos de los estilos apuntan a entradas existentes", () => {
  for (const style of COMBAT_STYLE_SOURCES) {
    assert.ok(style.system.weaponProfiles.length > 0, style.name);
    assert.ok(style.system.traitRefs.length > 0, style.name);
    for (const profile of style.system.weaponProfiles) {
      assert.ok(weaponKeys.has(profile.key), `${style.name}: arma ${profile.key}`);
    }
    for (const reference of style.system.traitRefs) {
      assert.ok(traitKeys.has(reference.key), `${style.name}: rasgo ${reference.key}`);
    }
  }
});

test("las alternativas del cuadro se conservan completas", () => {
  const keys = (styleKey, field) => new Set(COMBAT_STYLE_SOURCES
    .find((style) => style.buildKey === styleKey).system[field].map((entry) => entry.key));
  assert.deepEqual(keys("asesino", "traitRefs"),
    new Set(["asesinato", "punteria-de-tirador"]));
  assert.deepEqual(keys("gladiador", "traitRefs"), new Set(["apresador", "temerario"]));
  assert.deepEqual(keys("marinero-pirata", "weaponProfiles"),
    new Set(["alfanje", "estoque", "clava", "main-gauche"]));
});
