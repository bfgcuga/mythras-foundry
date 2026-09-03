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
const { defaultArmorFactors, ensureActorMorphology, ensureCreatureHitLocations, ensureHumanHitLocations,
  hitLocationNameMigrationUpdate } = await import(
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
    { name: "Pecho", "system.nameKey": "chest", "system.locationKey": "chest",
      "system.morphologyKey": "humanoid" });
  assert.deepEqual(hitLocationNameMigrationUpdate({ type: "hitLocation", name: "Pecho",
    system: { ...system, nameKey: "chest" } }),
  { "system.locationKey": "chest", "system.morphologyKey": "humanoid" });
  assert.equal(hitLocationNameMigrationUpdate({ type: "hitLocation",
    name: "Pecho superior", system }), null);
  assert.deepEqual(hitLocationNameMigrationUpdate({ type: "hitLocation", name: "Head",
    system: { rangeStart: 16, rangeEnd: 20, category: "head", hpClass: "standard" } }),
  { name: "Cabeza", "system.nameKey": "head", "system.locationKey": "head",
    "system.morphologyKey": "humanoid" });
});

test("la reparación humana elimina duplicados, conserva referencias y repone huecos", async () => {
  const location = (id, name, start, end, armorPoints = 0) => ({ id, type: "hitLocation",
    name, system: { nameKey: "", rangeStart: start, rangeEnd: end, category: "limb",
      hpClass: "standard", armorPoints } });
  const rightEnglish = location("right-en", "Right Leg", 1, 3, 2);
  const rightSpanish = location("right-es", "Pierna derecha", 1, 3);
  const wing = location("wing", "Ala derecha", 1, 3);
  const armor = { id: "armor", type: "armor", system: { coveredLocationIds: ["right-es"] } };
  const actor = { type: "character", system: { constitution: 10, size: 10 },
    items: [rightEnglish, rightSpanish, wing, armor], batches: [],
    getFlag() { return 0; }, async setFlag(scope, key, value) { this.migrationVersion = value; },
    async updateEmbeddedDocuments(type, updates) { this.batches.push(["update", updates]);
      for (const update of updates) { const item = this.items.find((entry) => entry.id === update._id);
        if (item && update["system.coveredLocationIds"]) item.system.coveredLocationIds = update["system.coveredLocationIds"];
        if (item && update["system.nameKey"]) item.system.nameKey = update["system.nameKey"]; } },
    async deleteEmbeddedDocuments(type, ids) { this.batches.push(["delete", ids]); },
    async createEmbeddedDocuments(type, data) { this.batches.push(["create", data]); } };
  await ensureHumanHitLocations(actor);
  assert.deepEqual(actor.batches.find(([kind]) => kind === "delete")[1], ["right-es"]);
  assert.deepEqual(armor.system.coveredLocationIds, ["right-en"]);
  assert.equal(actor.batches.find(([kind]) => kind === "create")[1].length, 6);
  assert.equal(actor.migrationVersion, 1);
});

test("la reparación de criaturas restaura su anatomía y religa armas naturales", async () => {
  const weapon = { id: "sting", type: "weapon", system: { profileKey: "sting",
    linkedLocationId: "obsolete" } };
  const actor = { type: "npc", name: "Hormiga gigante",
    system: { identity: { species: "Hormiga gigante" } }, items: [weapon],
    getFlag() { return 0; }, async setFlag(scope, key, value) { this.migrationVersion = value; },
    async createEmbeddedDocuments(type, data) { return data.map((entry, index) => ({
      id: `location-${index}`, ...entry
    })); },
    async updateEmbeddedDocuments(type, updates) { this.updates = updates; } };
  await ensureCreatureHitLocations(actor);
  assert.equal(actor.updates.find((update) => update._id === "sting")["system.linkedLocationId"],
    "location-8");
  assert.equal(actor.migrationVersion, 1);
});

test("una anatomía ya reconciliada queda bajo control del usuario", async () => {
  let writes = 0;
  const actor = { type: "character", items: [], system: {}, getFlag: () => 1,
    createEmbeddedDocuments: async () => { writes += 1; } };
  await ensureHumanHitLocations(actor);
  assert.equal(writes, 0);
});

test("la migración tipa anatomías exactas sin reconstruirlas y deja ambiguas como custom", async () => {
  const locations = [{ id: "head", type: "hitLocation", name: "Cabeza", system: {
    rangeStart: 19, rangeEnd: 20, locationKey: "head" } }];
  const actor = { type: "npc", system: {}, items: locations, flags: {},
    getFlag: () => 0,
    async updateEmbeddedDocuments(type, updates) { this.itemUpdates = updates; },
    async update(update) { this.actorUpdate = update; },
    async setFlag(scope, key, value) { this.flags[key] = value; } };
  await ensureActorMorphology(actor);
  assert.deepEqual(actor.actorUpdate, { "system.morphologyKey": "custom" });
  assert.equal(actor.itemUpdates[0]["system.morphologyKey"], "custom");
  assert.equal(actor.flags.morphologyMigrationVersion, 1);
  assert.equal(actor.created, undefined);
});

test("el entrypoint solo invoca el coordinador de migraciones", async () => {
  const entrypoint = await readFile(
    new URL("../scripts/mythras-foundry.js", import.meta.url), "utf8"
  );
  assert.match(entrypoint, /runWorldMigrations/);
  assert.doesNotMatch(entrypoint, /function migrate[A-Z]/);
  assert.doesNotMatch(entrypoint, /function getLegacySkillUpdate/);
});
