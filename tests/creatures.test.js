import test from "node:test";
import assert from "node:assert/strict";

import { CREATURE_SOURCES } from "../scripts/data/creatures.js";
import { TRAIT_SOURCES } from "../scripts/data/traits.js";
import { deterministicPackId } from "../scripts/dev/pack-ids.mjs";
import { readFileSync } from "node:fs";

test("el bestiario incluye las cinco criaturas solicitadas", () => {
  assert.deepEqual(CREATURE_SOURCES.map((source) => source.name).sort(),
    ["Hombre lagarto", "Hormiga gigante", "Mantícora", "Oso", "Xenomorfo"].sort());
  assert.ok(CREATURE_SOURCES.every((source) => source.type === "npc"
    && source.prototypeToken.actorLink === false));
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
