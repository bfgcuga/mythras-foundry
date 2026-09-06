import test from "node:test";
import assert from "node:assert/strict";
import { applyCombatDamageDocument, applyProposedCombatDamage, applyRolledCombatDamage,
  applyPenetrationTargetTransition, combatDamageDocumentIsCurrent, refreshCombatDamageProposal
} from "../scripts/rules/combat-damage-runtime.js";

function location(overrides = {}) {
  const updates = [];
  return { id: "arm", name: "Brazo", system: { currentHitPoints: 4, maxHitPoints: 5,
    category: "arm", permanentWound: { severity: 0 }, ...overrides }, updates,
  async update(change) { updates.push(change); } };
}

test("la aplicación documental comprueba la instantánea de PG y armadura", () => {
  const target = location();
  const damage = { beforeHitPoints: 4, armorSnapshot: 2 };
  assert.equal(combatDamageDocumentIsCurrent({ location: target, damage, armorPoints: 2 }), true);
  assert.equal(combatDamageDocumentIsCurrent({ location: target, damage, armorPoints: 3 }), false);
  target.system.currentHitPoints = 3;
  assert.equal(combatDamageDocumentIsCurrent({ location: target, damage, armorPoints: 2 }), false);
});

test("el daño ordinario actualiza únicamente los PG de la localización", async () => {
  const target = location();
  const damage = { afterHitPoints: 1, resultingWound: "serious" };
  const result = await applyCombatDamageDocument({ location: target, damage,
    evaluateRoll: async () => assert.fail("no debe tirar"), format: () => "" });
  assert.deepEqual(target.updates, [{ "system.currentHitPoints": 1 }]);
  assert.deepEqual(result.damage, damage);
});

test("Hender actualiza la armadura, conserva su máximo y desequipa la destruida", async () => {
  const target = location();
  const armor = { id: "plate", system: { armorPoints: 5, maxArmorPoints: 0, equipped: true },
    updates: [], async update(change) { this.updates.push(change); } };
  const damage = { afterHitPoints: 2, resultingWound: "minor", sunderArmor: {
    kind: "worn", before: 5, after: 0, maximum: 5 } };
  await applyCombatDamageDocument({ location: target, armorTarget: armor, damage,
    evaluateRoll: async () => assert.fail("no debe tirar"), format: () => "" });
  assert.deepEqual(armor.updates, [{ "system.armorPoints": 0,
    "system.maxArmorPoints": 5, "system.equipped": false }]);
  assert.deepEqual(target.updates, [{ "system.currentHitPoints": 2 }]);
});

test("una herida crítica consolida la lesión permanente en la misma escritura", async () => {
  const target = location();
  const roll = { total: 2, toJSON: () => ({ formula: "1d3", total: 2 }) };
  const result = await applyCombatDamageDocument({ location: target,
    damage: { afterHitPoints: -3, resultingWound: "major" }, manual: true,
    evaluateRoll: async (formula, options) => {
      assert.equal(formula, "1d3"); assert.deepEqual(options, { manual: true }); return roll;
    }, format: (key, data) => `${key}:${data.location}:${data.severity}` });
  assert.equal(target.updates.length, 1);
  assert.equal(target.updates[0]["system.permanentWound"].severity, 2);
  assert.equal(target.updates[0]["system.maxHitPoints"], 2);
  assert.equal(result.damage.permanentWoundRoll, 2);
  assert.deepEqual(result.serializedPermanentWoundRoll, { formula: "1d3", total: 2 });
});

test("el daño a un arma no crea lesiones permanentes", async () => {
  const target = location();
  await applyCombatDamageDocument({ location: target,
    damage: { afterHitPoints: -2, resultingWound: "major" }, targetType: "weapon",
    evaluateRoll: async () => assert.fail("no debe tirar"), format: () => "" });
  assert.deepEqual(target.updates, [{ "system.currentHitPoints": 0,
    "system.equipped": false }]);
});

function proposedDamageFixture({ currentHitPoints = 4, updateError = null,
  passiveBlock = null } = {}) {
  const target = location({ currentHitPoints, permanentWound: { severity: 3 } });
  target.update = async (change) => {
    if (updateError) throw updateError;
    target.updates.push(change);
  };
  const items = [target];
  items.get = (id) => items.find((item) => item.id === id);
  const defender = { items, testUserPermission: () => true };
  const combat = { revision: 1, defender: { actorUuid: "Actor.defender", tokenUuid: "",
    targetType: "actor", locations: [{ id: "arm", name: "Brazo" }] },
  effects: { selections: [], checks: [] },
  turnEconomy: { combatId: "combat", defenderCombatantId: "defender" },
  damage: { status: "proposed", locationId: "arm", passiveBlock,
    beforeHitPoints: 4, armorSnapshot: 2, afterHitPoints: 1, resultingWound: "serious" } };
  const updates = [];
  const message = { getFlag: () => combat, update: async (change) => {
    updates.push(structuredClone(change));
  } };
  const calls = { wound: 0, advance: 0, consumed: [] };
  const dependencies = { clone: structuredClone, flagScope: "mythras-foundry",
    resolveActor: async () => defender, userById: () => ({ id: "gm", isGM: true }),
    armorPoints: () => 2, refreshProposal: async () => {},
    render: (state) => state.damage.status, evaluateRoll: async () => assert.fail("no debe tirar"),
    format: () => "", applyWoundConsequences: async () => { calls.wound += 1; },
    combatById: () => ({ id: "combat" }),
    consumePassiveBlock: async (...args) => { calls.consumed.push(args); },
    advance: async () => { calls.advance += 1; } };
  return { combat, target, message, updates, calls, dependencies };
}

test("la transición de daño marca applying y applied alrededor de la escritura", async () => {
  const fixture = proposedDamageFixture();
  const applied = await applyProposedCombatDamage(fixture.message,
    { revision: 1, userId: "gm", locationId: "arm", manual: false }, fixture.dependencies);
  assert.equal(applied, true);
  assert.deepEqual(fixture.updates.map((change) =>
    change["flags.mythras-foundry.combat"].damage.status), ["applying", "applied"]);
  assert.deepEqual(fixture.target.updates, [{ "system.currentHitPoints": 1 }]);
  assert.equal(fixture.calls.wound, 1);
  assert.equal(fixture.calls.advance, 1);
});

test("Potenciar Penetración espera al segundo blanco solo si atraviesa al primero", async () => {
  const fixture = proposedDamageFixture();
  fixture.combat.attacker = { actorUuid: "Actor.attacker", tokenUuid: "Token.attacker" };
  fixture.combat.effects.selections = [{ key: "potenciar-penetracion", status: "active" }];
  Object.assign(fixture.combat.damage, { rawRoll: 10, afterRange: 8, penetratingDamage: 3,
    formula: "1d10" });
  await applyProposedCombatDamage(fixture.message,
    { revision: 1, userId: "gm", locationId: "arm" }, fixture.dependencies);
  const saved = fixture.updates.at(-1)["flags.mythras-foundry.combat"];
  assert.equal(saved.penetration.status, "awaitingTarget");
  assert.equal(saved.penetration.primaryDamage.penetratingDamage, 3);
  assert.equal(saved.effects.selections[0].status, "resolved");
  assert.equal(fixture.calls.advance, 0);
});

test("el segundo blanco recibe la mitad y no hereda efectos de combate", async () => {
  const hit = location({ currentHitPoints: 6, maxHitPoints: 6 });
  const items = [hit]; items.get = (id) => items.find((item) => item.id === id);
  const actor = { uuid: "Actor.second", id: "second", system: { size: 12 }, items };
  const attacker = { testUserPermission: () => true };
  let state = { revision: 3, attacker: { actorUuid: "Actor.attacker",
    tokenUuid: "Token.attacker" }, defender: {}, turnEconomy: { combatId: "combat" },
  penetration: { status: "awaitingTarget", primaryDefender: { actorUuid: "Actor.first",
    actorName: "Primero" }, primaryDamage: { rawRoll: 10, afterRange: 7, formula: "1d10" },
    primaryEffects: { selections: [{ key: "potenciar-penetracion" }] } },
  effects: { selections: [{ key: "potenciar-penetracion" }], checks: [] }, damage: {} };
  const message = { getFlag: () => state, async update(change) {
    state = change["flags.scope.combat"] ?? state;
  } };
  const appended = [];
  const result = await applyPenetrationTargetTransition(message, { revision: 3, userId: "player",
    tokenUuid: "Token.second", locationRoll: 5, serializedLocationRoll: { formula: "1d20" } }, {
    clone: structuredClone, flagScope: "scope", resolveToken: async () => ({ actor,
      uuid: "Token.second", name: "Segundo" }), resolveActor: async () => attacker,
    userById: () => ({ id: "player", isGM: false }), actorIdentity: (entry) => entry.id,
    tokenIdentity: (token) => token.uuid, tokenName: (token) => token.name,
    locationSnapshot: (entry) => ({ id: entry.id, name: entry.name }),
    findLocation: () => hit, combatantFor: () => ({ id: "second-combatant" }),
    refreshProposal: async (combat) => { combat.damage.status = "proposed"; },
    render: () => "rendered", appendRolls: async (entry, rolls) => appended.push(...rolls)
  });
  assert.equal(result, true);
  assert.equal(state.damage.rawRoll, 4);
  assert.equal(state.damage.status, "proposed");
  assert.deepEqual(state.effects.selections, []);
  assert.equal(state.penetration.secondaryCombatantId, "second-combatant");
  assert.equal(appended.length, 1);
});

test("una instantánea documental distinta deja la propuesta obsoleta", async () => {
  const fixture = proposedDamageFixture({ currentHitPoints: 3 });
  const applied = await applyProposedCombatDamage(fixture.message,
    { revision: 1, userId: "gm", locationId: "arm" }, fixture.dependencies);
  assert.equal(applied, true);
  assert.equal(fixture.updates.length, 1);
  assert.equal(fixture.updates[0]["flags.mythras-foundry.combat"].damage.status, "stale");
  assert.equal(fixture.target.updates.length, 0);
});

test("un fallo documental restaura la propuesta sin avanzar", async () => {
  const fixture = proposedDamageFixture({ updateError: new Error("fallo-documental") });
  await assert.rejects(() => applyProposedCombatDamage(fixture.message,
    { revision: 1, userId: "gm", locationId: "arm" }, fixture.dependencies),
  /fallo-documental/);
  assert.deepEqual(fixture.updates.map((change) =>
    change["flags.mythras-foundry.combat"].damage.status), ["applying", "proposed"]);
  assert.equal(fixture.calls.advance, 0);
});

test("el bloqueo pasivo se consume únicamente al aplicar el daño que ha mitigado", async () => {
  const block = { weaponId: "shield", weaponName: "Escudo", weaponSize: "large" };
  const fixture = proposedDamageFixture({ passiveBlock: block });
  await applyProposedCombatDamage(fixture.message,
    { revision: 1, userId: "gm", locationId: "arm" }, fixture.dependencies);
  assert.deepEqual(fixture.calls.consumed, [[{ id: "combat" }, "defender", "shield", "damage"]]);

  const failed = proposedDamageFixture({ passiveBlock: block,
    updateError: new Error("fallo-documental") });
  await assert.rejects(() => applyProposedCombatDamage(failed.message,
    { revision: 1, userId: "gm", locationId: "arm" }, failed.dependencies));
  assert.deepEqual(failed.calls.consumed, []);
});

function mutilatedHitFixture({ selections = [] } = {}) {
  const combat = { revision: 1, attacker: { actorUuid: "Actor.attacker", tokenUuid: "" },
    defender: { targetType: "actor", locations: [{ id: "arm", name: "Brazo",
      rangeStart: 13, rangeEnd: 15, category: "limb", hpClass: "arm",
      permanentWound: { severity: 1, lostHitResults: 1 } }] },
    effects: { selections }, damage: { status: "ready" } };
  const updates = [];
  const message = { getFlag: () => combat, update: async (change) => updates.push(change) };
  const calls = { refreshed: 0, advanced: 0 };
  const dependencies = { clone: structuredClone, flagScope: "mythras-foundry",
    resolveActor: async () => ({ testUserPermission: () => true }),
    userById: () => ({ id: "gm", isGM: true }),
    refreshProposal: async () => { calls.refreshed += 1; }, render: () => "rendered",
    appendRolls: () => [], advance: async () => { calls.advanced += 1; } };
  const request = { revision: 1, userId: "gm", rawRoll: 4, locationRoll: 13,
    serializedRoll: {}, serializedLocationRoll: {} };
  return { message, request, dependencies, updates, calls };
}

test("la regla alternativa conserva el d20 y aplica después el 1d3", async () => {
  const fixture = mutilatedHitFixture();
  const applied = await applyRolledCombatDamage(fixture.message,
    { ...fixture.request, permanentWoundHitRoll: 2,
      weaponFormulaParts: [{ text: "8", maximized: true }], maximizedWeaponDice: 1,
      serializedPermanentWoundHitRoll: { formula: "1d3", total: 2 } },
    { ...fixture.dependencies, permanentWoundRule: "checkD3" });
  assert.equal(applied, true);
  assert.equal(fixture.calls.refreshed, 1);
  assert.equal(fixture.updates[0]["flags.mythras-foundry.combat"].damage.locationId, "arm");
  assert.deepEqual(fixture.updates[0]["flags.mythras-foundry.combat"].damage.weaponFormulaParts,
    [{ text: "8", maximized: true }]);
  assert.equal(fixture.updates[0]["flags.mythras-foundry.combat"].damage.maximizedWeaponDice, 1);
});

test("la regla alternativa convierte en fallo un 1d3 insuficiente", async () => {
  const fixture = mutilatedHitFixture();
  await applyRolledCombatDamage(fixture.message,
    { ...fixture.request, permanentWoundHitRoll: 1,
      serializedPermanentWoundHitRoll: { formula: "1d3", total: 1 } },
    { ...fixture.dependencies, permanentWoundRule: "checkD3" });
  const damage = fixture.updates[0]["flags.mythras-foundry.combat"].damage;
  assert.equal(damage.status, "missedLocation");
  assert.equal(damage.permanentWoundHit, false);
  assert.equal(fixture.calls.advanced, 1);
});

test("Elegir Localización exige el 1d3 incluso con la regla oficial", async () => {
  const fixture = mutilatedHitFixture({ selections: [{ key: "choose-location",
    ruleKey: "chooseLocation" }] });
  const applied = await applyRolledCombatDamage(fixture.message,
    { ...fixture.request, locationId: "arm", locationRoll: null },
    { ...fixture.dependencies, permanentWoundRule: "reduceD20Range" });
  assert.equal(applied, false);
  assert.equal(fixture.updates.length, 0);
});

function mitigationProposalFixture(defenseWeaponSize) {
  const target = location({ currentHitPoints: 12, maxHitPoints: 12 });
  target.type = "hitLocation";
  const items = [target];
  items.get = (id) => items.find((item) => item.id === id);
  const combat = { attacker: { weaponSize: "large" },
    defender: { targetType: "actor", defense: { type: "parry",
      weaponSize: defenseWeaponSize } }, resolution: { defense: { result: "success" } },
    declarations: {}, effects: { selections: [], checks: [] },
    turnEconomy: { combatId: "combat", defenderCombatantId: "defender" },
    damage: { rawRoll: 12, locationId: "arm" } };
  const dependencies = { resolveActor: async () => ({ items, system: { size: 10 } }),
    combatById: () => ({}), passiveBlockFor: () => ({ weaponId: "shield",
      weaponName: "Escudo", weaponSize: "large" }), coverFor: () => null };
  return { combat, dependencies };
}

test("una parada parcial permite aplicar después el bloqueo pasivo", async () => {
  const { combat, dependencies } = mitigationProposalFixture("medium");
  await refreshCombatDamageProposal(combat, null, dependencies);
  assert.equal(combat.damage.afterParry, 6);
  assert.equal(combat.damage.afterPassiveBlock, 0);
  assert.equal(combat.damage.passiveBlock.weaponName, "Escudo");
});

test("una parada completa no aplica ni marca el bloqueo pasivo", async () => {
  const { combat, dependencies } = mitigationProposalFixture("large");
  await refreshCombatDamageProposal(combat, null, dependencies);
  assert.equal(combat.damage.afterParry, 0);
  assert.equal(combat.damage.passiveBlock, undefined);
});

test("Sortear Cobertura elimina únicamente su protección del cálculo", async () => {
  const target = location({ currentHitPoints: 12, maxHitPoints: 12, armorPoints: 2 });
  target.type = "hitLocation";
  const items = [target]; items.get = (id) => items.find((item) => item.id === id);
  const combat = { attacker: { weaponSize: "large" }, defender: { targetType: "actor",
    defense: { type: "cover" } }, resolution: { defense: { result: "success" } },
  declarations: {}, effects: { selections: [{ key: "sortear-cobertura" }], checks: [] },
  turnEconomy: { combatId: "combat", defenderCombatantId: "defender" },
  damage: { rawRoll: 10, locationId: "arm" } };
  await refreshCombatDamageProposal(combat, null, {
    resolveActor: async () => ({ items, system: { size: 10 } }), combatById: () => ({}),
    passiveBlockFor: () => null,
    coverFor: () => ({ source: "Muro", protection: 6 }) });
  assert.equal(combat.damage.cover, null);
  assert.equal(combat.damage.armorPoints, 2);
  assert.equal(combat.damage.penetratingDamage, 8);
});

test("Herida Accidental desarmada ignora armadura, cobertura y bloqueo pasivo", async () => {
  const target = location({ currentHitPoints: 12, maxHitPoints: 12, armorPoints: 3 });
  target.type = "hitLocation";
  const plate = { id: "plate", type: "armor", system: { equipped: true,
    armorPoints: 5, coveredLocationIds: ["arm"] } };
  const items = [target, plate]; items.get = (id) => items.find((item) => item.id === id);
  const combat = { accidentalWound: { status: "active", ignoresArmor: true },
    attacker: { weaponSize: "small" }, defender: { targetType: "actor",
      defense: { type: "cover" } }, resolution: { defense: { result: "success" } },
    declarations: {}, effects: { selections: [], checks: [] },
    turnEconomy: { combatId: "combat", defenderCombatantId: "attacker" },
    damage: { rawRoll: 9, locationId: "arm" } };
  await refreshCombatDamageProposal(combat, null, {
    resolveActor: async () => ({ items, system: { size: 10 } }), combatById: () => ({}),
    passiveBlockFor: () => ({ weaponId: "shield", weaponSize: "large" }),
    coverFor: () => ({ source: "Muro", protection: 20 }) });
  assert.equal(combat.damage.armorPoints, 0);
  assert.deepEqual(combat.damage.ignoredArmorTypes, ["worn", "natural"]);
  assert.equal(combat.damage.cover, null);
  assert.equal(combat.damage.passiveBlock, undefined);
  assert.equal(combat.damage.penetratingDamage, 9);
});

test("Herida Accidental con arma conserva la protección de la localización", async () => {
  const target = location({ currentHitPoints: 12, maxHitPoints: 12, armorPoints: 3 });
  target.type = "hitLocation";
  const items = [target]; items.get = (id) => items.find((item) => item.id === id);
  const combat = { accidentalWound: { status: "active", ignoresArmor: false },
    attacker: { weaponSize: "medium" }, defender: { targetType: "actor", defense: null },
    resolution: { defense: { result: "failure" } }, declarations: {},
    effects: { selections: [], checks: [] }, damage: { rawRoll: 9, locationId: "arm" } };
  await refreshCombatDamageProposal(combat, null, {
    resolveActor: async () => ({ items, system: { size: 10 } }), combatById: () => null,
    passiveBlockFor: () => null, coverFor: () => null });
  assert.equal(combat.damage.armorPoints, 3);
  assert.equal(combat.damage.penetratingDamage, 6);
});

test("Hender Armadura prepara el daño a la capa y solo traspasa el sobrante final", async () => {
  const target = location({ currentHitPoints: 12, maxHitPoints: 12, armorPoints: 1 });
  target.type = "hitLocation";
  const plate = { id: "plate", name: "Coraza", type: "armor", system: {
    equipped: true, armorPoints: 5, maxArmorPoints: 5, coveredLocationIds: ["arm"] } };
  const items = [target, plate];
  items.get = (id) => items.find((item) => item.id === id);
  const combat = { attacker: { weaponSize: "large" }, defender: { targetType: "actor",
    defense: { type: "none" } }, resolution: { defense: { result: "failure" } },
  declarations: {}, effects: { selections: [{ key: "hender-armadura" }], checks: [] },
  damage: { rawRoll: 14, locationId: "arm" } };
  await refreshCombatDamageProposal(combat, null, {
    resolveActor: async () => ({ items, system: { size: 10 } }), combatById: () => null,
    passiveBlockFor: () => null, coverFor: () => null });
  assert.deepEqual(combat.damage.sunderArmor, { kind: "worn", itemId: "plate",
    itemName: "Coraza", before: 5, after: 0, maximum: 5, damage: 5, excess: 8,
    state: "broken" });
  assert.equal(combat.damage.penetratingDamage, 3);
  assert.equal(combat.damage.afterHitPoints, 9);
});

test("la propuesta contra un arma usa su instancia, PA y limita sus PG a cero", async () => {
  const weapon = location({ currentHitPoints: 5, maxHitPoints: 8, armorPoints: 3 });
  weapon.id = "shield";
  weapon.name = "Escudo";
  weapon.type = "weapon";
  const items = [weapon];
  items.get = (id) => items.find((item) => item.id === id);
  const combat = { attacker: { weaponSize: "medium" },
    defender: { targetType: "actor", defense: { type: "parry" } },
    resolution: { defense: { result: "success" } }, declarations: {},
    effects: { selections: [], checks: [] }, damage: { rawRoll: 11,
      locationId: "shield", targetType: "weapon", weaponTarget: {
        sourceSide: "attacker", target: { actorUuid: "Actor.defender",
          tokenUuid: "", weaponId: "shield" } } } };
  await refreshCombatDamageProposal(combat, null, {
    resolveActor: async () => ({ items, system: { size: 10 } }),
    combatById: () => null, passiveBlockFor: () => null, coverFor: () => null
  });
  assert.equal(combat.damage.armorPoints, 3);
  assert.equal(combat.damage.penetratingDamage, 8);
  assert.equal(combat.damage.afterHitPoints, 0);
  assert.equal(combat.damage.resultingWound, "broken");
});
