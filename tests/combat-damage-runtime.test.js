import test from "node:test";
import assert from "node:assert/strict";
import { applyCombatDamageDocument, applyProposedCombatDamage, combatDamageDocumentIsCurrent
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
  assert.deepEqual(target.updates, [{ "system.currentHitPoints": -2 }]);
});

function proposedDamageFixture({ currentHitPoints = 4, updateError = null } = {}) {
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
  effects: { selections: [], checks: [] }, damage: { status: "proposed", locationId: "arm",
    beforeHitPoints: 4, armorSnapshot: 2, afterHitPoints: 1, resultingWound: "serious" } };
  const updates = [];
  const message = { getFlag: () => combat, update: async (change) => {
    updates.push(structuredClone(change));
  } };
  const calls = { wound: 0, advance: 0 };
  const dependencies = { clone: structuredClone, flagScope: "mythras-foundry",
    resolveActor: async () => defender, userById: () => ({ id: "gm", isGM: true }),
    armorPoints: () => 2, refreshProposal: async () => {},
    render: (state) => state.damage.status, evaluateRoll: async () => assert.fail("no debe tirar"),
    format: () => "", applyWoundConsequences: async () => { calls.wound += 1; },
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
