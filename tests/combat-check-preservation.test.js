import test from "node:test";
import assert from "node:assert/strict";
import { applyImmediateCombatEffects } from "../scripts/rules/combat-effect-runtime.js";
import { prepareDamageChecks } from "../scripts/rules/combat-damage.js";
import { applyCombatDamageLuck, applyProposedCombatDamage } from "../scripts/rules/combat-damage-runtime.js";

const location = { id: "arm", name: "Arm", system: { category: "arm" } };
async function fixture(status) {
  const keys = ["arrebatar-arma", "derribar-oponente", "desarmar-oponente",
    "cegar-oponente", "disparo-de-supresion"];
  const combat = { revision: 1, attacker: { actorUuid: "a" },
    defender: { actorUuid: "d", locations: [{ id: "arm" }, { id: "head" }] },
    effects: { selections: keys.map((key, slot) => ({ key, slot,
      side: slot % 2 ? "defender" : "attacker", name: key })), checks: [] },
    damage: { status: "proposed", locationId: "arm", rawRoll: 7 } };
  const actor = { system: { strength: 10 }, items: [
    { id: "sword", type: "weapon", name: "Sword", system: { equipped: true, handsRequired: 1 } }
  ], testUserPermission: () => true };
  await applyImmediateCombatEffects(combat, { uuid: "message" }, { resolveActor: async () => actor });
  for (const check of combat.effects.checks) {
    check.status = status;
    if (status !== "pending") check.resolution = { winner: "left", biped: false,
      weaponId: "sword", rawRoll: 42, luckHistory: [{ rawRoll: 90 }] };
    if (status === "resolved") check.consequence = { key: "resisted" };
  }
  const saved = structuredClone(combat.effects.checks);
  const message = { getFlag: () => combat, update: async (change) => { message.change = change; } };
  const deps = { clone: structuredClone, flagScope: "scope", resolveActor: async () => actor,
    userById: () => ({ isGM: true }), render: () => "", appendRolls: () => [],
    refreshProposal: async (state) => {
      assert.deepEqual(state.effects.checks, saved);
      prepareDamageChecks(state, { location, resultingWound: "serious", penetratingDamage: 3 });
    } };
  return { combat, saved, message, deps };
}

test("preparar daño conserva las cinco resistencias independientes en todos sus estados", async () => {
  for (const status of ["pending", "rolled", "resolved"]) {
    const { combat, saved } = await fixture(status);
    for (const damage of [{ penetratingDamage: 3, resultingWound: "serious" },
      { penetratingDamage: 0, resultingWound: "healthy" },
      { penetratingDamage: 3, resultingWound: "healthy", weaponTarget: true }]) {
      prepareDamageChecks(combat, { location, ...damage });
      assert.deepEqual(combat.effects.checks.filter((check) => check.source === "effect"), saved);
      assert.equal(new Set(combat.effects.checks.map((check) => check.id)).size, combat.effects.checks.length);
    }
  }
});

test("Suerte de daño y cambio de localización conservan resistencias y descartan pruebas de heridas anteriores", async () => {
  for (const status of ["pending", "rolled", "resolved"]) for (const action of ["luck", "location"]) {
    const { combat, saved, message, deps } = await fixture(status);
    combat.effects.selections.push({ key: "desangrar", side: "attacker", slot: 5,
      ruleKey: "guided", endurance: true, requiresWound: true, status: "pending" });
    combat.effects.checks.push({ id: "effect-attacker-5", source: "effect", status: "rolled",
      resolution: { winner: "left" } }, { id: "wound-head", source: "wound", status: "pending" });
    const request = { revision: 1, userId: "gm", locationId: "head", rawRoll: 5 };
    assert.equal(await (action === "luck" ? applyCombatDamageLuck : applyProposedCombatDamage)(
      message, request, deps), true);
    const result = message.change["flags.scope.combat"];
    assert.deepEqual(result.effects.checks.slice(0, saved.length), saved);
    assert.equal(result.effects.checks.some((check) => check.id === "wound-head"), false);
    const bleed = result.effects.checks.find((check) => check.id === "effect-attacker-5");
    assert.equal(bleed.status, "pending");
    assert.equal(bleed.resolution, undefined);
  }
});
