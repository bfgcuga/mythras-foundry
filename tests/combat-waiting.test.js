import test from "node:test";
import assert from "node:assert/strict";
import { settleWaiting, clearCombatWaiting } from "../scripts/rules/combat-waiting.js";
import { spendActorActionPoint } from "../scripts/rules/combat-resource-runtime.js";
import { availableCombatActions, combatActionPresentation } from "../scripts/rules/combat-actions.js";
import { executeAction, migrateCombatWaiting } from "../scripts/rules/combat-action-runtime.js";

function fixture(t, points = 2, payment = "onReaction") {
  let state = { schemaVersion: 2, revision: 0, delays: { c: { status: "reserved", payment } }, actions: {} };
  const actor = { id: "a", uuid: "Actor.a", system: { resources: { actionPoints: { value: points } } },
    effects: [{ id: "effect", flags: { "mythras-foundry": { waiting: { combatId: "combat", combatantId: "c" } } } }],
    async update(change) { this.system.resources.actionPoints.value = change["system.resources.actionPoints.value"]; },
    async createEmbeddedDocuments(type, entries) { this.effects.push(...entries); },
    async deleteEmbeddedDocuments(type, ids) { this.effects = this.effects.filter(e => !ids.includes(e.id)); } };
  const entry = { id: "c", actor };
  const combat = { id: "combat", round: 1, combatants: new Map([["c", entry]]),
    getFlag: () => structuredClone(state), async setFlag(scope, key, value) { state = structuredClone(value); },
    advanced: 0, async nextTurn() { this.advanced++; } };
  const globals = { game: { combats: new Map([[combat.id, combat]]), i18n: { localize: x => x } },
    foundry: { utils: { deepClone: structuredClone } }, Hooks: { callAll() {} } };
  for (const [key, value] of Object.entries(globals)) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key]);
  }
  return { actor, entry, combat, state: () => state };
}

test("Retrasar es gratuito pero exige PA y turno propio; no habilita acciones activas", () => {
  const context = { inCombat: true, isActive: true, actionPoints: 2 };
  assert.equal(combatActionPresentation(context).delay.cost, 0);
  assert.equal(availableCombatActions(context).delay, true);
  assert.equal(availableCombatActions({ ...context, actionPoints: 0 }).delay, false);
  const waiting = availableCombatActions({ ...context, isActive: false, hasDelay: true });
  assert.equal(waiting.move, false);
  assert.equal(waiting.counterspell, true);
  assert.equal(waiting.interrupt, true);
});

test("una reacción paga una vez y retira Esperando; la siguiente paga normalmente", async t => {
  const { actor, state } = fixture(t);
  assert.equal(await spendActorActionPoint(actor, { reactive: true }), true);
  assert.equal(actor.system.resources.actionPoints.value, 1);
  assert.equal(actor.effects.length, 0);
  assert.equal(state().delays.c.status, "consumed");
  await spendActorActionPoint(actor, { reactive: true });
  assert.equal(actor.system.resources.actionPoints.value, 0);
});

test("caducidad repetida o concurrente cobra solo una vez", async t => {
  const { actor, combat, entry, state } = fixture(t);
  await Promise.all([settleWaiting(combat, entry), settleWaiting(combat, entry)]);
  assert.equal(actor.system.resources.actionPoints.value, 1);
  assert.equal(state().delays.c.status, "expired");
  assert.equal(actor.effects.length, 0);
});

test("la reacción compite con la caducidad sin doble cobro por espera", async t => {
  const { actor, combat, entry } = fixture(t);
  await Promise.all([spendActorActionPoint(actor, { reactive: true }), settleWaiting(combat, entry)]);
  assert.equal(actor.system.resources.actionPoints.value, 1);
});

test("una reacción rechazada conserva la espera y caducar no produce PA negativos", async t => {
  const { actor, combat, entry, state } = fixture(t, 0);
  assert.equal(await spendActorActionPoint(actor, { reactive: true }), false);
  assert.equal(state().delays.c.status, "reserved");
  await settleWaiting(combat, entry);
  assert.equal(actor.system.resources.actionPoints.value, 0);
});

test("las reservas antiguas y la limpieza de combate no cobran PA", async t => {
  const { actor, combat, entry } = fixture(t, 2, undefined);
  // Explicit legacy reservation without deferred-payment marker.
  const state = combat.getFlag(); delete state.delays.c.payment;
  await combat.setFlag(null, null, state);
  await settleWaiting(combat, entry);
  await clearCombatWaiting(combat, { charge: false });
  assert.equal(actor.system.resources.actionPoints.value, 2);
});

test("resolver Retrasar aplica Esperando y avanza exactamente un turno", async t => {
  const { actor, combat } = fixture(t);
  actor.effects = [];
  const action = { id: "delay", key: "delay", type: "proactive", combatantId: "c", status: "resolving", revision: 0 };
  await combat.setFlag(null, null, { actions: { delay: action }, delays: {} });
  combat.combatant = { id: "c" };
  await executeAction(combat, action);
  await executeAction(combat, action);
  assert.equal(actor.system.resources.actionPoints.value, 2);
  assert.equal(actor.effects.length, 1);
  assert.deepEqual(actor.effects[0].statuses, ["waiting"]);
  assert.equal(combat.advanced, 1);
});

test("el turno que caduca el último PA se omite sin alterar el orden de iniciativa", async t => {
  const { actor, entry, combat, state } = fixture(t, 1);
  const old = Object.getOwnPropertyDescriptor(globalThis, "Combat");
  globalThis.Combat = class {};
  t.after(() => old ? Object.defineProperty(globalThis, "Combat", old) : delete globalThis.Combat);
  const { MythrasCombat } = await import("../scripts/documents/mythras-combat.js");
  const tracker = new MythrasCombat();
  actor.type = "character";
  const otherActor = { ...actor, id: "b", uuid: "Actor.b", effects: [],
    system: { resources: { actionPoints: { value: 2 } } } };
  const other = { id: "other", actor: otherActor };
  const users = [{ id: "gm", active: true, isGM: true }];
  game.user = users[0]; game.users = users; game.messages = [];
  tracker.id = combat.id; tracker.round = 1; tracker.turn = 1;
  tracker.turns = [entry, other]; tracker.combatants = new Map([[entry.id, entry], [other.id, other]]);
  let economy = { cycle: 1, revision: 0 };
  tracker.getFlag = (scope, key) => key === "turnEconomy" ? economy : state();
  tracker.setFlag = combat.setFlag;
  Object.defineProperty(tracker, "combatant", { get: () => tracker.turns[tracker.turn] });
  tracker.update = async change => {
    if (change.turn !== undefined) tracker.turn = change.turn;
    economy = change["flags.mythras-foundry.turnEconomy"] ?? economy;
  };
  await tracker.nextTurn();
  assert.equal(actor.system.resources.actionPoints.value, 0);
  assert.equal(tracker.combatant.id, "other");
  assert.equal(tracker.mythrasTurnEconomy.cycle, 2);
  assert.equal(state().delays.c.status, "expired");
});

test("el cierre manual de ronda liquida la espera antes de restaurar PA", async t => {
  const { actor, entry, combat, state } = fixture(t, 2);
  const old = Object.getOwnPropertyDescriptor(globalThis, "Combat");
  globalThis.Combat = class {};
  t.after(() => old ? Object.defineProperty(globalThis, "Combat", old) : delete globalThis.Combat);
  const { MythrasCombat } = await import("../scripts/documents/mythras-combat.js");
  const tracker = new MythrasCombat();
  const gm = { id: "gm", active: true, isGM: true };
  game.user = gm; game.users = [gm];
  tracker.id = combat.id; tracker.round = 1;
  tracker.combatants = new Map([[entry.id, entry]]);
  tracker.getFlag = combat.getFlag; tracker.setFlag = combat.setFlag;
  const stop = new Error("stop after checking restoration order");
  tracker.restoreActionPoints = async () => {
    assert.equal(actor.system.resources.actionPoints.value, 1);
    assert.equal(state().delays.c.status, "expired");
    assert.equal(actor.effects.length, 0);
    throw stop;
  };
  await assert.rejects(tracker.nextRound(), error => error === stop);
});

test("migrar reservas prepagadas retira la espera y conserva confirmaciones guiadas", async t => {
  const { actor, combat, state } = fixture(t);
  await combat.setFlag(null, null, { ...state(), schemaVersion: 1,
    actions: { old: { id: "old", key: "charge", revision: 0, status: "awaitingInterrupts", interruptCandidates: [{}] } } });
  await migrateCombatWaiting(combat);
  assert.equal(state().schemaVersion, 2);
  assert.equal(state().actions.old.status, "awaitingConfirmation");
  assert.deepEqual(state().actions.old.interruptCandidates, []);
  assert.equal(actor.system.resources.actionPoints.value, 2);
  assert.equal(actor.effects.length, 0);
  await migrateCombatWaiting(combat);
  assert.equal(actor.system.resources.actionPoints.value, 2);
});
