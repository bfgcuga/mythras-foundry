import test from "node:test";
import assert from "node:assert/strict";
import { applyCombatCheckTransition } from "../scripts/rules/combat-check-runtime.js";

function effectCheckFixture(status = "pending") {
  const check = { id: "effect-attacker-0", source: "effect", actorSide: "defender",
    effectKey: "cegar-oponente", status };
  if (status === "rolled") check.resolution = { rawRoll: 60, winner: "right" };
  const current = { revision: 1, effects: { checks: [check], selections: [
    { key: "cegar-oponente", side: "attacker", slot: 0, stage: "beforeDamage",
      status: "pending" }] },
  attacker: { tokenUuid: "a" }, defender: { tokenUuid: "d" },
  damage: { status: "ready" } };
  const actor = { system: { resources: { luckPoints: { value: 2 } } },
    items: { get: () => null }, testUserPermission: () => true,
    async update(change) { this.system.resources.luckPoints.value =
      change["system.resources.luckPoints.value"]; } };
  const message = { getFlag: () => current,
    async update(change) { this.change = change; } };
  let consequences = 0;
  const dependencies = { clone: structuredClone, flagScope: "scope",
    resolveActor: async () => actor, userById: () => ({ id: "owner", isGM: false }),
    warn: assert.fail, localize: (key) => key, actorName: () => "Defensor",
    applyWoundConsequences: assert.fail,
    applyEffectConsequence: async () => { consequences += 1; },
    effectDependencies: () => ({}), render: () => "rendered",
    appendRolls: () => [] };
  return { actor, current, message, dependencies, get consequences() { return consequences; } };
}

test("una prueba de efecto espera Suerte y confirmación antes de aplicar la consecuencia", async () => {
  const initial = effectCheckFixture();
  await applyCombatCheckTransition(initial.message, { revision: 1, userId: "owner",
    checkId: "effect-attacker-0", resolution: { rawRoll: 55, winner: "right" } },
  initial.dependencies);
  assert.equal(initial.message.change["flags.scope.combat"].effects.checks[0].status, "rolled");
  assert.equal(initial.consequences, 0);

  const reroll = effectCheckFixture("rolled");
  await applyCombatCheckTransition(reroll.message, { revision: 1, userId: "owner",
    checkId: "effect-attacker-0", reroll: true,
    resolution: { rawRoll: 25, winner: "left" } }, reroll.dependencies);
  assert.equal(reroll.actor.system.resources.luckPoints.value, 1);
  assert.equal(reroll.message.change["flags.scope.combat"].effects.checks[0].status, "rolled");

  const finalized = effectCheckFixture("rolled");
  await applyCombatCheckTransition(finalized.message, { revision: 1, userId: "owner",
    checkId: "effect-attacker-0", finalize: true }, finalized.dependencies);
  assert.equal(finalized.message.change["flags.scope.combat"].effects.checks[0].status, "resolved");
  assert.equal(finalized.consequences, 1);
});
