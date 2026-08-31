import test from "node:test";
import assert from "node:assert/strict";
import { applyAccidentalTargetTransition } from "../scripts/rules/combat-response-runtime.js";

test("el blanco accidental sustituye al defensor y persiste la transición", async () => {
  const current = { status: "awaitingAccidentalTarget", revision: 2,
    attacker: { target: 40, rawRoll: 35, difficulty: "hard" },
    defender: { actorUuid: "old" }, ranged: { normalTarget: 60 },
    turnEconomy: { defenderCombatantId: "old-entry" } };
  const actor = { uuid: "Actor.new", id: "new", system: { size: 12 },
    items: [{ id: "loc", name: "Pecho", type: "hitLocation", system: {} }] };
  const token = { uuid: "Token.new", name: "Nuevo", actor };
  const message = { async update(change) { this.change = change; } };
  const result = await applyAccidentalTargetTransition(message, current, { token,
    entry: { id: "new-entry" }, userId: "gm", clone: structuredClone,
    actorIdentity: (entry) => entry.id, tokenIdentity: (entry) => entry.uuid,
    tokenName: (entry) => entry.name,
    locationSnapshot: (item) => ({ id: item.id, name: item.name }),
    render: (combat) => combat.status, flagScope: "scope" });
  const saved = message.change["flags.scope.combat"];
  assert.equal(result, true);
  assert.equal(saved.defender.actorUuid, "Actor.new");
  assert.equal(saved.turnEconomy.defenderCombatantId, "new-entry");
  assert.equal(saved.status, "awaitingAccidentalDefense");
  assert.equal(saved.revision, 3);
  assert.equal(current.defender.actorUuid, "old");
});
