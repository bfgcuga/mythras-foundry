import test from "node:test";
import assert from "node:assert/strict";
import { applyManualCombatEffectResolution } from "../scripts/rules/combat-check-runtime.js";

test("la resolución manual valida propietario y persiste una única transición", async () => {
  const current = { revision: 3, effects: { winner: "attacker", selections: [
    { slot: 0, side: "attacker", target: "opponent", status: "pending" }] },
    attacker: { tokenUuid: "a" }, defender: { tokenUuid: "d" } };
  const message = { getFlag: () => current,
    async update(change) { this.change = change; } };
  const actor = { testUserPermission: () => true };
  const result = await applyManualCombatEffectResolution(message, { revision: 3, slot: 0,
    userId: "owner", note: "Resuelto" }, { clone: structuredClone, flagScope: "scope",
    resolveActor: async (uuid) => uuid === "d" ? actor : null,
    userById: () => ({ id: "owner", isGM: false }), render: () => "resolved" });
  const saved = message.change["flags.scope.combat"];
  assert.equal(result, true);
  assert.equal(saved.effects.selections[0].status, "resolved");
  assert.equal(saved.effects.selections[0].resolution.note, "Resuelto");
  assert.equal(saved.revision, 4);
  assert.equal(current.effects.selections[0].status, "pending");
});
