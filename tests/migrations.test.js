import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

globalThis.foundry = {
  utils: {
    getProperty: (object, path) => path.split(".").reduce(
      (value, key) => value?.[key], object
    ),
    hasProperty: (object, path) => path.split(".").reduce(
      (value, key) => value?.[key], object
    ) !== undefined
  }
};

const {
  getDefaultSkillGroup,
  getLegacySkillUpdate
} = await import("../scripts/migrations/content-migrations.js");
const { defaultArmorFactors, hitLocationNameMigrationUpdate } = await import(
  "../scripts/migrations/actor-migrations.js");

test("la migración de habilidades conserva su transformación idempotente", () => {
  const legacy = {
    id: "skill-1",
    type: "skill",
    system: {
      category: "standard",
      group: "",
      slug: "aguante",
      bonus: 8,
      culturePoints: 0,
      professionPoints: 0,
      freePoints: 0,
      experiencePoints: 0
    },
    _source: { system: { used: true, bonus: 8 } }
  };

  assert.deepEqual(getLegacySkillUpdate(legacy), {
    _id: "skill-1",
    "system.category": "basic",
    "system.group": "resistance",
    "system.-=used": null,
    "system.fumbled": false,
    "system.freePoints": 8,
    "system.bonus": 0
  });

  const current = {
    ...legacy,
    system: { ...legacy.system, category: "basic", group: "resistance", bonus: 0 },
    _source: { system: { bonus: 0 } }
  };
  assert.equal(getLegacySkillUpdate(current), null);
});

test("los valores por defecto migrados se resuelven por dominio", () => {
  assert.equal(getDefaultSkillGroup({ system: { slug: "idioma" } }), "language");
  assert.deepEqual(defaultArmorFactors({ system: { category: "chest" } }),
    { encumbrance: 3, cost: 25 });
});

test("la migración traduce localizaciones humanas estándar y conserva nombres complejos", () => {
  const system = { rangeStart: 10, rangeEnd: 12, category: "chest", hpClass: "chest" };
  assert.deepEqual(hitLocationNameMigrationUpdate({ type: "hitLocation", name: "Chest", system }),
    { name: "Pecho", "system.nameKey": "chest" });
  assert.deepEqual(hitLocationNameMigrationUpdate({ type: "hitLocation", name: "Pecho",
    system: { ...system, nameKey: "chest" } }), null);
  assert.equal(hitLocationNameMigrationUpdate({ type: "hitLocation",
    name: "Pecho superior", system }), null);
});

test("el entrypoint solo invoca el coordinador de migraciones", async () => {
  const entrypoint = await readFile(
    new URL("../scripts/mythras-foundry.js", import.meta.url), "utf8"
  );
  assert.match(entrypoint, /runWorldMigrations/);
  assert.doesNotMatch(entrypoint, /function migrate[A-Z]/);
  assert.doesNotMatch(entrypoint, /function getLegacySkillUpdate/);
});
