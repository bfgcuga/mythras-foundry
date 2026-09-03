import test from "node:test";
import assert from "node:assert/strict";

const { MORPHOLOGIES, MORPHOLOGY_KEYS, identifyMorphology, morphologyLocationData,
  semanticLocationKey } = await import("../scripts/rules/morphologies.js");
const { prepareMorphologyReplacement, remapLocationReferences, replaceActorMorphology } = await import(
  "../scripts/rules/morphology-replacement.js");
const { CREATURE_SOURCES } = await import("../scripts/data/creatures.js");
const { findHitLocation } = await import("../scripts/rules/hit-locations.js");
const { damageLocationChoices, prepareDamageChecks } = await import(
  "../scripts/rules/combat-damage.js");

test("el catálogo contiene humanoide, trece morfologías no humanas y custom", () => {
  assert.equal(Object.keys(MORPHOLOGIES).length, 14);
  assert.equal(MORPHOLOGY_KEYS.length, 15);
  assert.equal(MORPHOLOGY_KEYS[0], "custom");
});

test("todas las plantillas cubren 1–20 sin huecos ni solapamientos", () => {
  for (const [key, template] of Object.entries(MORPHOLOGIES)) {
    const rolls = template.flatMap(({ rangeStart, rangeEnd }) =>
      Array.from({ length: rangeEnd - rangeStart + 1 }, (_, index) => rangeStart + index));
    assert.deepEqual(rolls, Array.from({ length: 20 }, (_, index) => index + 1), key);
    assert.equal(new Set(template.map((entry) => entry.locationKey)).size, template.length, key);
  }
});

test("las localizaciones derivan PV y factores anatómicos de forma coherente", () => {
  const locations = morphologyLocationData({ constitution: 10, size: 10 }, "wingedBiped");
  const wing = locations.find((entry) => entry.system.locationKey === "rightWing");
  assert.deepEqual({ category: wing.system.category, hpClass: wing.system.hpClass,
    encumbrance: wing.system.armorEncumbranceMultiplier,
    cost: wing.system.armorCostPercentage },
  { category: "limb", hpClass: "arm", encumbrance: 1, cost: 7.5 });
  const humanoid = morphologyLocationData({ constitution: 10, size: 10 }, "humanoid");
  assert.deepEqual(humanoid.map((entry) => entry.system.armorCostPercentage),
    [15, 15, 20, 25, 7.5, 7.5, 10]);
});

test("la identificación solo tipa anatomías exactas", () => {
  const insect = MORPHOLOGIES.insect.map((entry) => ({ name: entry.name, system: entry }));
  assert.equal(identifyMorphology(insect), "insect");
  insect[0].name = "Pata trasera herida";
  insect[0].system = { ...insect[0].system, locationKey: "", nameKey: "" };
  assert.equal(identifyMorphology(insect), "custom");
  assert.equal(semanticLocationKey({ name: "Metatórax", system: {} }), "metathorax");
});

test("las criaturas oficiales tipadas coinciden exactamente con su plantilla", () => {
  for (const creature of CREATURE_SOURCES) {
    const locations = creature.items.filter((item) => item.type === "hitLocation");
    const identified = identifyMorphology(locations);
    if (creature.system.morphologyKey === "custom") assert.equal(identified, "custom", creature.name);
    else assert.equal(identified, creature.system.morphologyKey, creature.name);
  }
});

test("una herida permanente incompatible bloquea el reemplazo", () => {
  const wing = { id: "wing", name: "Ala adicional", system: { locationKey: "",
    nameKey: "", permanentWound: { severity: 2 } } };
  const result = prepareMorphologyReplacement({ constitution: 10, size: 10,
    morphologyKey: "custom" }, "humanoid", [wing]);
  assert.equal(result.valid, false);
  assert.deepEqual(result.incompatibleWounds, [wing]);
});

test("el reemplazo conserva heridas y armadura natural de zonas equivalentes", () => {
  const head = { id: "head", name: "Cabeza", system: { locationKey: "head",
    currentHitPoints: -1, disabled: true, armorPoints: 3,
    permanentWound: { severity: 2, roll: 2, description: "Cicatriz" } } };
  const result = prepareMorphologyReplacement({ constitution: 12, size: 13,
    morphologyKey: "humanoid" }, "wingedBiped", [head]);
  const replacement = result.sources.find((entry) => entry.system.locationKey === "head");
  assert.equal(result.valid, true);
  assert.equal(replacement.system.permanentWound.description, "Cicatriz");
  assert.equal(replacement.system.currentHitPoints, -1);
  assert.equal(replacement.system.disabled, true);
  assert.equal(replacement.system.armorPoints, 3);
});

test("las referencias anidadas conservan IDs ajenos y eliminan destinos borrados", () => {
  const value = { locationId: "old", other: { locationId: "external",
    locationIds: ["old", "missing", "gone"] } };
  assert.deepEqual(remapLocationReferences(value,
    new Map([["old", "new"], ["gone", ""]])), {
    locationId: "new", other: { locationId: "external", locationIds: ["new", "missing"] }
  });
});

test("daño y Elegir localización consumen sin supuestos humanos una morfología no humana", () => {
  globalThis.game = { i18n: { localize: (key) => key } };
  const locations = morphologyLocationData({ constitution: 10, size: 10 }, "serpentine")
    .map((entry, index) => ({ id: `serpent-${index}`, name: entry.name, ...entry.system,
      system: entry.system }));
  assert.equal(findHitLocation(locations, 12)?.system.locationKey, "middleCentralSection");
  const chosen = locations.find((entry) => entry.system.locationKey === "tailTip");
  const combat = { defender: { locations }, damage: { locationId: chosen.id },
    effects: { selections: [{ key: "elegir-localizacion", ruleKey: "chooseLocation",
      side: "attacker", slot: 0 }], checks: [] } };
  assert.deepEqual(damageLocationChoices(combat).map((entry) => entry.id), [chosen.id]);
  const checks = prepareDamageChecks(combat, { location: chosen,
    resultingWound: "serious", penetratingDamage: 2 });
  assert.equal(checks.at(-1).locationId, chosen.id);
  assert.equal(checks.at(-1).locationKind.extremity, true);
});

test("al aplicar una anatomía no humana solo la pieza genérica conserva cobertura", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  const head = { id: "old-head", type: "hitLocation", name: "Cabeza", system: {
    morphologyKey: "humanoid", locationKey: "head", currentHitPoints: 5,
    armorPoints: 0, disabled: false, permanentWound: { severity: 0 } } };
  const helmet = { id: "helmet", type: "armor", system: { referenceLocation: "head",
    coveredLocationIds: [head.id], equipped: true } };
  const special = { id: "special", type: "armor", system: { referenceLocation: "special",
    coveredLocationIds: [head.id], equipped: true } };
  const actor = { uuid: "Actor.test", system: { constitution: 10, size: 10,
    morphologyKey: "wingedBiped" }, items: [head, helmet, special], effects: [],
    async createEmbeddedDocuments(type, sources) { return sources.map((source, index) => ({
      id: `new-${index}`, ...source })); },
    async updateEmbeddedDocuments(type, updates) { this.updates = updates; },
    async deleteEmbeddedDocuments(type, ids) { this.deleted = ids; } };
  await replaceActorMorphology(actor, "wingedBiped", { combats: [] });
  const helmetUpdate = actor.updates.find((entry) => entry._id === helmet.id);
  const specialUpdate = actor.updates.find((entry) => entry._id === special.id);
  assert.deepEqual(helmetUpdate["system.coveredLocationIds"], []);
  assert.equal(helmetUpdate["system.equipped"], false);
  assert.equal(specialUpdate["system.coveredLocationIds"].length, 1);
  assert.deepEqual(actor.deleted, [head.id]);
});
