import test from "node:test";
import assert from "node:assert/strict";
import { applyAccidentalTargetTransition, applyChosenTargetTransition, applyCombatEffectsTransition,
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

test("Escoger Objetivo cambia libremente la víctima y prepara un impacto automático sin efectos", async () => {
  const current = { revision: 7, attacker: { actorUuid: "Actor.attacker" },
    defender: { actorUuid: "Actor.original", actorName: "Original" },
    chosenTarget: { status: "awaitingTarget",
      originalDefender: { actorUuid: "Actor.original", actorName: "Original" },
      originalEffects: { selections: [{ key: "escoger-objetivo" }] } },
    resolution: { attack: { result: "fumble", rawRoll: 100, target: 60 },
      defense: { result: "success" }, winner: "defender", effects: 1 },
    effects: { selections: [{ key: "escoger-objetivo" }], checks: [] },
    damage: { status: "unavailable" }, turnEconomy: { defenderCombatantId: "original" } };
  const actor = { uuid: "Actor.attacker", id: "attacker", system: { size: 11 },
    items: [{ id: "chest", name: "Pecho", type: "hitLocation", system: {} }] };
  const token = { uuid: "Token.bystander", name: "Transeúnte", actor };
  const owner = { testUserPermission: () => true };
  const message = { async update(change) { this.change = change; } };
  const applied = await applyChosenTargetTransition(message, current, { token, entry: null,
    userId: "player", user: { id: "player", isGM: false }, owner,
    clone: structuredClone, actorIdentity: (entry) => entry.id,
    tokenIdentity: (entry) => entry.uuid, tokenName: (entry) => entry.name,
    locationSnapshot: (item) => ({ id: item.id, name: item.name }),
    render: () => "rendered", flagScope: "scope" });
  const saved = message.change["flags.scope.combat"];
  assert.equal(applied, true);
  assert.equal(saved.defender.actorUuid, "Actor.attacker");
  assert.equal(saved.turnEconomy.defenderCombatantId, "original");
  assert.equal(saved.resolution.attack.result, "success");
  assert.equal(saved.resolution.attack.automaticSuccess, true);
  assert.equal(saved.resolution.defense.type, "none");
  assert.equal(saved.damage.status, "ready");
  assert.deepEqual(saved.effects.selections, []);
  assert.equal(saved.chosenTarget.originalEffects.selections[0].key, "escoger-objetivo");
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

test("Forzar Rendición exige autorización real del DJ y sustituye el daño", async () => {
  const effect = { key: "forzar-rendicion", name: "Forzar Rendición", offensive: true,
    defensive: false, stackable: false, weaponRestriction: "", rollRestriction: "",
    ruleKey: "guided", stage: "beforeDamage", target: "opponent", replacesDamage: true };
  let stored = { status: "awaitingEffects", revision: 1, authorUserId: "author",
    attacker: { actorUuid: "Actor.a", tokenUuid: "Token.a" },
    defender: { actorUuid: "Actor.d", tokenUuid: "Token.d" },
    resolution: { winner: "attacker", effects: 1,
      attack: { result: "success" }, defense: { result: "failure" } },
    effects: { winner: "attacker", slots: 1, sideSlots: { attacker: 1, defender: 0 },
      pendingSide: "attacker", selections: [], checks: [], confirmed: false },
    damage: { status: "blocked" } };
  const message = { uuid: "ChatMessage.surrender", getFlag: () => stored,
    async update(change) { stored = change["flags.scope.combat"] ?? stored; } };
  const dependencies = { clone: structuredClone, flagScope: "scope",
    resolveActor: async () => ({ testUserPermission: () => true }),
    userById: (id) => id === "gm" ? { id, isGM: true } : { id, isGM: false },
    catalogDocuments: async () => [effect], effectView: (entry) => entry,
    effectContext: () => ({ winner: "attacker" }), warn: () => {}, localize: (key) => key,
    render: () => "rendered", advance: async () => {}, triggerRuses: async () => [],
    immediateDependencies: () => ({}), applyImmediateEffects: async () => {} };
  const request = { revision: 1, side: "attacker", userId: "player",
    selections: [{ key: effect.key, parameters: {} }] };
  assert.equal(await applyCombatEffectsTransition(message, request, dependencies), false);
  assert.equal(stored.status, "awaitingEffects");
  assert.equal(await applyCombatEffectsTransition(message, request,
    { ...dependencies, surrenderAuthorizedBy: "gm" }), true);
  assert.equal(stored.status, "resolved");
  assert.equal(stored.damage.status, "unavailable");
});

test("Forzar Fallo convierte en automático el único efecto compañero resistido", async () => {
  const force = { key: "forzar-fallo", name: "Forzar Fallo", offensive: true,
    defensive: true, stackable: false, weaponRestriction: "", rollRestriction: "opponentFumble",
    ruleKey: "guided", stage: "beforeDamage", target: "opponent" };
  const trip = { key: "derribar-oponente", name: "Derribar Oponente", offensive: true,
    defensive: true, stackable: false, weaponRestriction: "", rollRestriction: "",
    ruleKey: "guided", stage: "beforeDamage", target: "opponent" };
  let stored = { status: "awaitingEffects", revision: 1,
    attacker: { actorUuid: "Actor.a", tokenUuid: "Token.a" },
    defender: { actorUuid: "Actor.d", tokenUuid: "Token.d" },
    resolution: { winner: "attacker", effects: 2,
      attack: { result: "success" }, defense: { result: "fumble" } },
    effects: { winner: "attacker", slots: 2, sideSlots: { attacker: 2, defender: 0 },
      pendingSide: "attacker", selections: [], checks: [], confirmed: false } };
  const message = { uuid: "ChatMessage.force-failure", getFlag: () => stored,
    async update(change) { stored = change["flags.scope.combat"] ?? stored; } };
  let applied = [];
  const result = await applyCombatEffectsTransition(message, { revision: 1, side: "attacker",
    userId: "player", selections: [{ key: force.key }, { key: trip.key }] }, {
    clone: structuredClone, flagScope: "scope",
    resolveActor: async () => ({ testUserPermission: () => true }),
    userById: () => ({ id: "player", isGM: false }),
    catalogDocuments: async () => [force, trip], effectView: (entry) => entry,
    effectContext: () => ({ winner: "attacker", attackResult: "success",
      defenseResult: "fumble" }), warn: () => {}, localize: (key) => key,
    render: () => "rendered", advance: async () => {}, triggerRuses: async () => [],
    immediateDependencies: () => ({}),
    applyImmediateEffects: async (combat) => { applied = combat.effects.selections; }
  });
  assert.equal(result, true);
  assert.equal(applied.find((entry) => entry.key === "forzar-fallo").status, "resolved");
  const forced = applied.find((entry) => entry.key === "derribar-oponente");
  assert.equal(forced.automaticSuccess, true);
  assert.deepEqual(forced.automaticSource, { type: "forceFailure", sourceSlot: 0 });
});

test("Potenciar Penetración exige autorización real del DJ", async () => {
  const effect = { key: "potenciar-penetracion", name: "Potenciar Penetración",
    offensive: true, defensive: false, stackable: false, weaponRestriction: "ranged",
    rollRestriction: "winnerCritical", ruleKey: "guided", stage: "afterPenetration",
    damageTarget: "opponent" };
  let stored = { status: "awaitingEffects", revision: 1,
    attacker: { actorUuid: "Actor.a", tokenUuid: "Token.a" },
    defender: { actorUuid: "Actor.d", tokenUuid: "Token.d" },
    resolution: { winner: "attacker", effects: 1,
      attack: { result: "critical" }, defense: { result: "failure" } },
    effects: { winner: "attacker", slots: 1, sideSlots: { attacker: 1, defender: 0 },
      pendingSide: "attacker", selections: [], checks: [] } };
  const message = { getFlag: () => stored, async update(change) {
    stored = change["flags.scope.combat"] ?? stored;
  } };
  const deps = { clone: structuredClone, flagScope: "scope",
    resolveActor: async () => ({ testUserPermission: () => true }),
    userById: (id) => ({ id, isGM: id === "gm" }), catalogDocuments: async () => [effect],
    effectView: (entry) => entry, effectContext: () => ({ winner: "attacker",
      attackResult: "critical", defenseResult: "failure", attackMode: "ranged",
      weaponMode: { weaponType: "ranged" } }), warn: () => {}, localize: (key) => key,
    render: () => "rendered", advance: async () => {}, triggerRuses: async () => [],
    immediateDependencies: () => ({}), applyImmediateEffects: async () => {} };
  const request = { revision: 1, side: "attacker", userId: "player",
    selections: [{ key: effect.key }] };
  assert.equal(await applyCombatEffectsTransition(message, request, deps), false);
  assert.equal(await applyCombatEffectsTransition(message, request,
    { ...deps, penetrationAuthorizedBy: "gm" }), true);
});

test("Sortear Cobertura exige autorización real del DJ", async () => {
  const effect = { key: "sortear-cobertura", name: "Sortear Cobertura", offensive: true,
    defensive: false, stackable: false, weaponRestriction: "ranged", rollRestriction: "",
    ruleKey: "guided", stage: "beforeArmor", damageTarget: "opponent" };
  let stored = { status: "awaitingEffects", revision: 1,
    attacker: { actorUuid: "Actor.a", tokenUuid: "Token.a" },
    defender: { actorUuid: "Actor.d", tokenUuid: "Token.d" },
    resolution: { winner: "attacker", effects: 1,
      attack: { result: "success" }, defense: { result: "failure" } },
    effects: { winner: "attacker", slots: 1, sideSlots: { attacker: 1, defender: 0 },
      pendingSide: "attacker", selections: [], checks: [] } };
  const message = { getFlag: () => stored, async update(change) {
    stored = change["flags.scope.combat"] ?? stored;
  } };
  const deps = { clone: structuredClone, flagScope: "scope",
    resolveActor: async () => ({ testUserPermission: () => true }),
    userById: (id) => ({ id, isGM: id === "gm" }), catalogDocuments: async () => [effect],
    effectView: (entry) => entry, effectContext: () => ({ winner: "attacker",
      attackResult: "success", defenseResult: "failure", attackMode: "ranged",
      weaponMode: { weaponType: "ranged" } }), warn: () => {}, localize: (key) => key,
    render: () => "rendered", advance: async () => {}, triggerRuses: async () => [],
    immediateDependencies: () => ({}), applyImmediateEffects: async () => {} };
  const request = { revision: 1, side: "attacker", userId: "player",
    selections: [{ key: effect.key }] };
  assert.equal(await applyCombatEffectsTransition(message, request, deps), false);
  assert.equal(await applyCombatEffectsTransition(message, request,
    { ...deps, coverAuthorizedBy: "gm" }), true);
});

test("Escoger Objetivo exige autorización del DJ y aplaza el daño hasta elegir víctima", async () => {
  const effect = { key: "escoger-objetivo", name: "Escoger Objetivo", offensive: false,
    defensive: true, stackable: false, weaponRestriction: "", rollRestriction: "attackerFumble",
    ruleKey: "guided", stage: "beforeDamage", target: "opponent" };
  let stored = { status: "awaitingEffects", revision: 1,
    attacker: { actorUuid: "Actor.a", tokenUuid: "Token.a" },
    defender: { actorUuid: "Actor.d", tokenUuid: "Token.d", actorName: "Defensor" },
    resolution: { winner: "defender", effects: 1,
      attack: { result: "fumble" }, defense: { result: "success" } },
    effects: { winner: "defender", slots: 1, sideSlots: { attacker: 0, defender: 1 },
      pendingSide: "defender", selections: [], checks: [] }, damage: { status: "blocked" } };
  const message = { getFlag: () => stored, async update(change) {
    stored = change["flags.scope.combat"] ?? stored;
  } };
  const deps = { clone: structuredClone, flagScope: "scope",
    resolveActor: async () => ({ testUserPermission: () => true }),
    userById: (id) => ({ id, isGM: id === "gm" }), catalogDocuments: async () => [effect],
    effectView: (entry) => entry, effectContext: () => ({ winner: "defender",
      attackResult: "fumble", defenseResult: "success" }), warn: () => {},
    localize: (key) => key, render: () => "rendered", advance: async () => {},
    triggerRuses: async () => [], immediateDependencies: () => ({}),
    applyImmediateEffects: async () => {} };
  const request = { revision: 1, side: "defender", userId: "player",
    selections: [{ key: effect.key }] };
  assert.equal(await applyCombatEffectsTransition(message, request, deps), false);
  assert.equal(stored.status, "awaitingEffects");
  assert.equal(await applyCombatEffectsTransition(message, request,
    { ...deps, chosenTargetAuthorizedBy: "gm" }), true);
  assert.equal(stored.chosenTarget.status, "awaitingTarget");
  assert.equal(stored.chosenTarget.originalDefender.actorUuid, "Actor.d");
  assert.equal(stored.damage.status, "unavailable");
});

test("Herida Accidental convierte al atacante desarmado en víctima y prepara el daño", async () => {
  const effect = { key: "herida-accidental", name: "Herida Accidental", offensive: false,
    defensive: true, stackable: false, weaponRestriction: "", rollRestriction: "attackerFumble",
    ruleKey: "guided", stage: "beforeDamage", damageTarget: "opponent" };
  const locations = [{ id: "head", name: "Cabeza", type: "hitLocation", system: {} }];
  let stored = { status: "awaitingEffects", revision: 2,
    attacker: { actorUuid: "Actor.a", actorId: "a", actorName: "Atacante",
      tokenUuid: "Token.a", weaponId: "", modeSnapshot: { key: "unarmed" } },
    defender: { actorUuid: "Actor.d", actorName: "Defensor", tokenUuid: "Token.d" },
    resolution: { winner: "defender", effects: 1,
      attack: { result: "fumble", rawRoll: 100 }, defense: { result: "success" } },
    effects: { winner: "defender", slots: 1, sideSlots: { attacker: 0, defender: 1 },
      pendingSide: "defender", selections: [], checks: [] }, damage: { status: "blocked" },
    turnEconomy: { combatantId: "attacker", defenderCombatantId: "defender" } };
  const message = { getFlag: () => stored, async update(change) {
    stored = change["flags.scope.combat"] ?? stored;
  } };
  const attacker = { uuid: "Actor.a", id: "a", system: { size: 10 }, items: locations };
  const applied = await applyCombatEffectsTransition(message, { revision: 2, side: "defender",
    userId: "player", selections: [{ key: effect.key }] }, {
    clone: structuredClone, flagScope: "scope", resolveActor: async (tokenUuid) =>
      tokenUuid === "Token.a" ? attacker : { testUserPermission: () => true },
    userById: () => ({ id: "player", isGM: false }), catalogDocuments: async () => [effect],
    effectView: (entry) => entry, effectContext: () => ({ winner: "defender",
      attackResult: "fumble", defenseResult: "success" }), warn: () => {},
    localize: (key) => key, render: () => "rendered", advance: async () => {},
    triggerRuses: async () => [], immediateDependencies: () => ({}),
    applyImmediateEffects: async () => {}, actorIdentity: (actor) => actor.id,
    locationSnapshot: (item) => ({ id: item.id, name: item.name }) });
  assert.equal(applied, true);
  assert.equal(stored.defender.actorUuid, "Actor.a");
  assert.equal(stored.accidentalWound.ignoresArmor, true);
  assert.equal(stored.turnEconomy.defenderCombatantId, "attacker");
  assert.equal(stored.damage.status, "ready");
  assert.deepEqual(stored.effects.selections, []);
});
