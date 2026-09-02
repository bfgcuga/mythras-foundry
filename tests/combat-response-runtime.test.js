import test from "node:test";
import assert from "node:assert/strict";
import { applyAccidentalTargetTransition, applyCombatEffectsTransition,
  applyCombatRuseReplacementTransition } from "../scripts/rules/combat-response-runtime.js";

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

test("Ardid sustituye la selección atacante y concede un efecto automático", async () => {
  const attackEffect = { key: "desarmar-oponente", name: "Desarmar", offensive: true,
    defensive: false, stackable: false, weaponRestriction: "", rollRestriction: "",
    ruleKey: "guided", stage: "beforeDamage", target: "opponent" };
  const replacement = { key: "mejorar-parada", name: "Mejorar parada", offensive: false,
    defensive: true, stackable: false, weaponRestriction: "", rollRestriction: "",
    ruleKey: "improveParry", stage: "beforeDamage", target: "self" };
  let stored = { status: "awaitingEffects", revision: 4, authorUserId: "author",
    attacker: { actorUuid: "Actor.a", tokenUuid: "Token.a" },
    defender: { actorUuid: "Actor.d", tokenUuid: "Token.d" },
    resolution: { winner: "attacker", effects: 1,
      attack: { result: "success" }, defense: { result: "failure" } },
    turnEconomy: { combatId: "combat", combatantId: "a", defenderCombatantId: "d" },
    effects: { winner: "attacker", slots: 1, sideSlots: { attacker: 1, defender: 0 },
      pendingSide: "attacker", selections: [], checks: [], confirmed: false },
    damage: { status: "blocked" } };
  const message = { uuid: "ChatMessage.test", getFlag: () => stored,
    async update(change) { stored = change["flags.scope.combat"] ?? stored; } };
  const common = { clone: structuredClone, flagScope: "scope",
    resolveActor: async () => ({ testUserPermission: () => true }),
    userById: () => ({ id: "player", isGM: false }),
    catalogDocuments: async () => [attackEffect, replacement], effectView: (effect) => effect,
    effectContext: (combat, side) => ({ winner: side, activeCombat: true }),
    warn: () => {}, localize: (key) => key, render: (combat) => combat.status,
    advance: async () => {}, immediateDependencies: () => ({}),
    applyImmediateEffects: async () => {} };
  const intercepted = await applyCombatEffectsTransition(message, {
    revision: 4, side: "attacker", userId: "player",
    selections: [{ key: attackEffect.key, parameters: {} }]
  }, { ...common, triggerRuses: async (combat, selections) => [{
    ruse: { id: "ruse-1" }, selection: selections[0]
  }] });
  assert.equal(intercepted, true);
  assert.equal(stored.status, "awaitingRuse");
  assert.equal(stored.effects.selections.length, 0);
  assert.equal(stored.effects.replacedSelections[0].key, attackEffect.key);
  assert.equal(stored.effects.pendingRuses[0].ruseId, "ruse-1");

  const resolved = await applyCombatRuseReplacementTransition(message, {
    revision: stored.revision, side: "defender", userId: "player",
    selections: [{ key: replacement.key, parameters: {} }]
  }, { ...common, replacementEffects: (catalog) => catalog.filter((effect) => effect.defensive) });
  assert.equal(resolved, true);
  assert.equal(stored.status, "resolved");
  assert.equal(stored.effects.selections[0].key, replacement.key);
  assert.equal(stored.effects.selections[0].automaticSuccess, true);
  assert.equal(stored.effects.selections[0].automaticSource.ruseId, "ruse-1");
});
