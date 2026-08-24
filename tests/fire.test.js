import test from "node:test";
import assert from "node:assert/strict";
import { FIRE_PROFILES, fireDamageResult, normalizeFireConfiguration }
  from "../scripts/rules/fire.js";
import { burningEntries } from "../scripts/rules/round-consequences.js";

test("las cinco intensidades conservan daño, ignición y ejemplo", () => {
  assert.deepEqual(Object.values(FIRE_PROFILES).map((profile) => ({
    damage: profile.damageFormula, ignition: profile.ignitionFormula, example: profile.example
  })), [
    { damage: "1d2", ignition: "1d4", example: "candle" },
    { damage: "1d4", ignition: "1d3", example: "torch" },
    { damage: "1d6", ignition: "1d2", example: "campfire" },
    { damage: "2d6", ignition: "1d2", example: "conflagration" },
    { damage: "3d6", ignition: "instant", example: "lava" }
  ]);
});

test("la configuración permite fórmula propia y localizaciones libres sin duplicados", () => {
  assert.deepEqual(normalizeFireConfiguration({ intensity: 4, formula: "2d8+1",
    locationIds: ["head", "arm", "head"], keepBurning: false }), {
    intensity: 4, formula: "2d8+1", locationIds: ["head", "arm"], keepBurning: false
  });
  assert.equal(normalizeFireConfiguration({ intensity: 9 }).formula, "3d6");
});

test("el fuego resta el daño completo sin consultar armadura", () => {
  assert.deepEqual(fireDamageResult(6, 4), {
    damage: 6, hitPointsBefore: 4, hitPointsAfter: -2
  });
});

test("la cola deduplica actores enlazados y conserva PNJ sintéticos", (context) => {
  const actor = { id: "hero", uuid: "Actor.hero", name: "Hero", isToken: false,
    statuses: new Set(["burning"]), effects: [] };
  const npcA = { id: "npc", uuid: "Scene.s.Token.a.Actor.npc", name: "A", isToken: true,
    statuses: new Set(["burning"]), effects: [] };
  const npcB = { ...npcA, uuid: "Scene.s.Token.b.Actor.npc", name: "B" };
  globalThis.game = { actors: { get: () => null } };
  context.after(() => { delete globalThis.game; });
  const entries = burningEntries({ combatants: [
    { id: "one", actor }, { id: "two", actor }, { id: "a", actor: npcA }, { id: "b", actor: npcB }
  ] });
  assert.deepEqual(entries.map((entry) => entry.combatantId), ["one", "a", "b"]);
  assert.ok(entries.every((entry) => entry.status === "pending"));
});
