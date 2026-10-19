import test from "node:test";
import assert from "node:assert/strict";

import { CREATURE_SOURCES } from "../scripts/data/creatures.js";
import { TRAIT_SOURCES } from "../scripts/data/traits.js";
import { REVISED_CREATURE_PROFILES } from "../scripts/data/revised-creature-profiles.js";
import { calculateNpcAttributes } from "../scripts/rules/npc.js";
import { deterministicPackId } from "../scripts/dev/pack-ids.mjs";
import { readFileSync } from "node:fs";

test("el bestiario conserva las criaturas originales e incluye los perfiles del revisado", () => {
  assert.equal(CREATURE_SOURCES.length, 116);
  const names = new Set(CREATURE_SOURCES.map((source) => source.name));
  for (const name of ["Hombre lagarto", "Hormiga gigante", "Mantícora", "Oso", "Xenomorfo",
    ...REVISED_CREATURE_PROFILES.map((profile) => profile.name), "Ofidio"]) assert.ok(names.has(name), name);
  assert.ok(CREATURE_SOURCES.every((source) => source.type === "npc"
    && source.prototypeToken.actorLink === false));
});

test("los perfiles conservan atributos, habilidades, PA/PG y fuente del revisado", () => {
  for (const profile of REVISED_CREATURE_PROFILES) {
    const source = CREATURE_SOURCES.find((entry) => entry.buildKey === profile.key);
    assert.equal(source.flags["mythras-foundry"].source, "mythras-basic-revised", profile.name);
    assert.equal(source.flags["mythras-foundry"].sourcePage, profile.page, profile.name);
    assert.match(source.system.description, /Mythras básico revisado/);
    const attributes = calculateNpcAttributes(source.system);
    assert.equal(attributes.actionPointsMax, profile.actionPoints, profile.name);
    assert.equal(attributes.initiative, profile.initiative, profile.name);
    assert.equal(attributes.magicPointsMax, profile.magicPoints, profile.name);
    assert.equal(attributes.damageModifier, profile.damageModifier, profile.name);
    const locations = source.items.filter((item) => item.type === "hitLocation");
    assert.deepEqual(locations.map((item) => [item.system.rangeStart, item.system.rangeEnd,
      item.name, item.system.armorPoints, item.system.maxHitPoints]), profile.locations, profile.name);
    for (const [name, value] of profile.skills) {
      assert.equal(source.items.find((item) => item.type === "skill" && item.name === name)
        ?.system.manualValue, value, `${profile.name}: ${name}`);
    }
    assert.equal(source.items.filter((item) => item.type === "weapon").length, profile.weapons.length);
    assert.ok(source.items.every((item) => item.flags["mythras-foundry"].source === "mythras-basic-revised"));
    assert.equal(new Set(source.items.map((item) => `${item.type}:${item.buildKey}`)).size,
      source.items.length, `${profile.name}: claves de Items únicas`);
  }
});

test("los ataques distinguen daño base, daño total, alcance a distancia y efectos manuales", () => {
  const weapon = (creature, name) => CREATURE_SOURCES.find((entry) => entry.name === creature)
    .items.find((item) => item.type === "weapon" && item.name === name).system.modes[0];
  assert.deepEqual([weapon("Oso", "Garra").damage, weapon("Oso", "Garra").damageModifierMode], ["1d8", "full"]);
  assert.deepEqual([weapon("Dragón", "Arrollar").damage, weapon("Dragón", "Arrollar").damageModifierMode], ["4d8", "none"]);
  assert.deepEqual([weapon("Serpiente gigante", "Constricción").damage,
    weapon("Serpiente gigante", "Constricción").damageModifierMode], ["2d6", "none"]);
  assert.deepEqual([weapon("Babuino", "Mordisco").damage,
    weapon("Babuino", "Mordisco").damageModifierMode], ["1d4", "full"]);
  assert.equal(weapon("Mantícora", "Púas arrojadizas").weaponType, "ranged");
  assert.equal(weapon("Mantícora", "Púas arrojadizas").effects, "Veneno");
  assert.deepEqual([weapon("Elfo", "Arco largo").rangeShort, weapon("Elfo", "Arco largo").rangeEffective,
    weapon("Elfo", "Arco largo").rangeLong], [15, 125, 250]);
  assert.equal(weapon("Esqueleto", "Escudo pelta").weaponType, "shield");
  assert.deepEqual([weapon("Quimera", "Aliento de cabra").damage,
    weapon("Quimera", "Aliento de cabra").effects], ["0", "Fuego"]);
  assert.equal(weapon("Zombi", "Mordisco").damage, "1");
});

test("las anatomías excepcionales y la variante ofidia conservan sus diferencias", () => {
  const find = (name) => CREATURE_SOURCES.find((entry) => entry.name === name);
  for (const [name, morphology] of [["Araña gigante", "arachnid"], ["Hormiga gigante", "insect"],
    ["Iqari", "wingedBiped"], ["Mamut", "pachyderm"], ["Mantis gigante", "wingedInsect"],
    ["Acéfalo", "custom"], ["Quimera", "custom"], ["Serpiente gigante", "custom"]])
    assert.equal(find(name).system.morphologyKey, morphology, name);
  assert.equal(find("Wyrm").items.filter((item) => item.type === "hitLocation").length, 6);
  assert.equal(find("Wyvern").items.filter((item) => item.type === "hitLocation").length, 8);
  const ophidian = find("Ofidio");
  assert.deepEqual([ophidian.system.strength, ophidian.system.power, ophidian.system.size,
    ophidian.system.intelligence], [11, 16, 13, 16]);
  assert.ok(ophidian.items.filter((item) => item.type === "hitLocation").every((item) => item.system.armorPoints === 1));
  assert.ok(ophidian.items.some((item) => item.type === "trait" && item.name === "Venenoso"));
  assert.equal(calculateNpcAttributes(ophidian.system).magicPointsMax, 16);
  assert.equal(calculateNpcAttributes(ophidian.system).actionPointsMax, 3);
});

test("cada criatura cubre exactamente el d20 y conserva anatomía propia", () => {
  for (const creature of CREATURE_SOURCES) {
    const locations = creature.items.filter((item) => item.type === "hitLocation");
    const covered = locations.flatMap((item) => {
      const values = [];
      for (let value = item.system.rangeStart; value <= item.system.rangeEnd; value += 1) values.push(value);
      return values;
    }).sort((left, right) => left - right);
    assert.deepEqual(covered, Array.from({ length: 20 }, (_, index) => index + 1), creature.name);
  }
});

test("las localizaciones genéricas de criaturas usan claves traducibles", () => {
  const expected = new Set(["rightLeg", "leftLeg", "abdomen", "chest", "rightArm",
    "leftArm", "head"]);
  for (const creature of CREATURE_SOURCES) {
    for (const location of creature.items.filter((item) => item.type === "hitLocation")) {
      if (expected.has(location.buildKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()))) {
        assert.ok(location.system.nameKey, `${creature.name}: ${location.name}`);
      }
    }
  }
});

test("las fórmulas de características usan solo dados y aritmética", () => {
  for (const creature of CREATURE_SOURCES) {
    for (const formula of Object.values(creature.system.characteristicFormulas).filter(Boolean)) {
      assert.match(formula, /^[0-9dD+\-*/() ]+$/);
      assert.doesNotMatch(formula, /@/);
    }
  }
});

test("todas las armas naturales vinculadas apuntan a una localización existente", () => {
  for (const creature of CREATURE_SOURCES) {
    const locationKeys = new Set(creature.items.filter((item) => item.type === "hitLocation")
      .map((item) => item.buildKey));
    for (const weapon of creature.items.filter((item) => item.type === "weapon"
      && item.system.durabilitySource === "hitLocation")) {
      assert.ok(locationKeys.has(weapon.linkedLocationKey), `${creature.name}: ${weapon.name}`);
    }
  }
});

test("el compendio de rasgos contiene claves únicas y cubre todas las referencias", () => {
  assert.equal(TRAIT_SOURCES.length, 83);
  assert.equal(new Set(TRAIT_SOURCES.map((source) => source.buildKey)).size, TRAIT_SOURCES.length);
  const names = new Set(TRAIT_SOURCES.map((source) => source.name));
  for (const creature of CREATURE_SOURCES) {
    for (const trait of creature.items.filter((item) => item.type === "trait")) {
      assert.ok(names.has(trait.name), `${creature.name}: ${trait.name}`);
    }
  }
});

test("el manifiesto registra los tipos y compendios nuevos", () => {
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.ok(manifest.documentTypes.Actor.npc);
  assert.ok(manifest.documentTypes.Item.trait);
  assert.equal(manifest.packs.find((pack) => pack.name === "creatures")?.type, "Actor");
  assert.equal(manifest.packs.find((pack) => pack.name === "traits")?.type, "Item");
});

test("los identificadores de compendio son deterministas y únicos", () => {
  const ids = CREATURE_SOURCES.map((source) =>
    deterministicPackId(`creature.${source.buildKey}`));
  assert.equal(new Set(ids).size, CREATURE_SOURCES.length);
  assert.equal(deterministicPackId("creature.bear"), "f673c1d2f9385bf1");
});
