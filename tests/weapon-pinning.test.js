import test from "node:test";
import assert from "node:assert/strict";
import { clearWeaponPinsBetween, pinnableWeapons, resolveWeaponRelease,
  weaponIsPinned, weaponPins } from "../scripts/rules/weapon-pinning.js";
import { applyWeaponPin, applyWeaponPinRequest } from "../scripts/rules/weapon-pin-runtime.js";
import { availableCombatActions } from "../scripts/rules/combat-actions.js";
import { validateCombatResponse } from "../scripts/rules/combat-exchange-state.js";

function actor(id) {
  const items = [1, 2].map((n) => ({ id: `w${n}`, name: `Weapon ${n}`, type: "weapon",
    system: { equipped: true, modes: [{ key: "one", handsRequired: 1 }] } }));
  items.get = (key) => items.find((item) => item.id === key);
  return { uuid: `Actor.${id}`, items, effects: [], system: { strength: 12,
    resources: { actionPoints: { value: 2 } } }, statuses: new Set(),
  testUserPermission: () => false,
  async createEmbeddedDocuments(type, sources) {
    const added = sources.map((source, index) => ({ ...source, id: `pin${this.effects.length + index}` }));
    this.effects.push(...added); return added;
  },
  async deleteEmbeddedDocuments(type, ids) { this.effects = this.effects.filter((effect) => !ids.includes(effect.id)); } };
}
function globals() {
  globalThis.game = { i18n: { localize: (key) => key }, users: new Map([
    ["outsider", { id: "outsider", isGM: false }], ["gm", { id: "gm", isGM: true }]]) };
  globalThis.foundry = { utils: { deepClone: structuredClone } };
}

test("inmovilizar identifica solo el arma elegida sin desequiparla ni ocupar la otra", async () => {
  globals(); const victim = actor("victim");
  assert.equal(await applyWeaponPin(victim, "w1", { actorUuid: "Actor.holder" }, "message"), true);
  assert.equal(weaponIsPinned(victim.items[0], victim), true);
  assert.equal(weaponIsPinned(victim.items[1], victim), false);
  assert.equal(victim.items[0].system.equipped, true);
  assert.deepEqual(pinnableWeapons(victim).map((item) => item.id), ["w2"]);
  assert.equal(await applyWeaponPin(victim, "w1", { actorUuid: "Actor.holder" }, "message"), false);
  assert.equal(victim.effects.length, 1);
});

test("destrabarse libera ambas direcciones y conserva las inmovilizaciones de terceros", async () => {
  globals(); const left = actor("left"); const right = actor("right");
  await applyWeaponPin(left, "w1", { actorUuid: right.uuid }, "m");
  await applyWeaponPin(right, "w1", { actorUuid: left.uuid }, "m");
  await applyWeaponPin(left, "w2", { actorUuid: "Actor.third" }, "m");
  await clearWeaponPinsBetween(left, right);
  assert.equal(weaponPins(right).length, 0);
  assert.equal(weaponIsPinned(left.items[0], left), false);
  assert.equal(weaponIsPinned(left.items[1], left), true);
});

test("un efecto desactivado o un arma eliminada no mantiene el bloqueo", async () => {
  globals(); const victim = actor("victim");
  await applyWeaponPin(victim, "w1", { actorUuid: "Actor.holder" }, "m");
  victim.effects[0].disabled = true; assert.equal(weaponPins(victim).length, 0);
  victim.effects[0].disabled = false; victim.items.splice(0, 1);
  assert.equal(weaponPins(victim).length, 0);
});

test("liberar requiere turno, PA y un arma inmovilizada", () => {
  const context = { inCombat: true, isActive: true, actionPoints: 1, hasPinnedWeapon: true };
  assert.equal(availableCombatActions(context).releaseWeapon, true);
  for (const override of [{ isActive: false }, { actionPoints: 0 }, { hasPinnedWeapon: false },
    { canTakeProactiveTurn: false }]) assert.equal(availableCombatActions({ ...context, ...override }).releaseWeapon, false);
});

test("el servidor rechaza una parada con arma inmovilizada y permite la otra", async () => {
  globals(); const victim = actor("victim");
  await applyWeaponPin(victim, "w1", { actorUuid: "Actor.holder" }, "m");
  const combat = { status: "awaitingDefense", revision: 1 };
  const request = { revision: 1, userId: "gm", defense: { type: "parry", weaponId: "w1" } };
  assert.equal(validateCombatResponse(combat, request, { actor: victim, user: game.users.get("gm") }), "invalid");
  request.defense.weaponId = "w2";
  assert.equal(validateCombatResponse(combat, request, { actor: victim, user: game.users.get("gm") }), null);
});

test("la enfrentada libera solo al ganar, aplica porcentajes superiores a cien y conserva empates", () => {
  assert.equal(resolveWeaponRelease({ target: 60, rawRoll: 50 }, { target: 60, rawRoll: 40 }).freed, true);
  assert.equal(resolveWeaponRelease({ target: 60, rawRoll: 50 }, { target: 60, rawRoll: 50 }).freed, false);
  assert.equal(resolveWeaponRelease({ target: 60, rawRoll: 80 }, { target: 60, rawRoll: 70 }).freed, false);
  const result = resolveWeaponRelease({ target: 140, rawRoll: 80 }, { target: 80, rawRoll: 50 });
  assert.equal(result.holder.target, 40); assert.equal(result.freed, true);
});

test("una solicitud obsoleta o sin propiedad no inmoviliza documentos", async () => {
  globals(); const victim = actor("victim"); const holder = actor("holder");
  const state = { revision: 2, status: "resolved", attacker: { actorUuid: holder.uuid },
    defender: { actorUuid: victim.uuid }, consequences: [{ key: "pinWeapon", status: "pending",
      actorSide: "attacker", victimSide: "defender", weapons: [{ id: "w1" }] }] };
  game.messages = new Map([["m", { getFlag: () => state }]]);
  globalThis.fromUuid = async (uuid) => uuid === victim.uuid ? victim : holder;
  await applyWeaponPinRequest({ operation: "pin", messageId: "m", userId: "gm", revision: 1, index: 0, weaponId: "w1" });
  await applyWeaponPinRequest({ operation: "pin", messageId: "m", userId: "outsider", revision: 2, index: 0, weaponId: "w1" });
  assert.equal(victim.effects.length, 0);
});

test("liberar cobra un PA una sola vez y cada participante elige su habilidad antes de soltar el arma", async () => {
  globals(); const victim = actor("victim"); const holder = actor("holder");
  for (const participant of [victim, holder]) {
    participant.items.push({ id: "brawn", type: "skill", name: "Músculo", system: { slug: "musculo", total: 60 } },
      { id: "unarmed", type: "skill", name: "Pelea", system: { slug: "pelea", total: 60 } });
    participant.update = async (changes) => { participant.system.resources.actionPoints.value = changes["system.resources.actionPoints.value"]; };
  }
  game.user = game.users.get("gm");
  foundry.utils.escapeHTML = String;
  let turns = 0;
  const combat = { id: "combat", started: true, combatant: { id: "victim", actor: victim }, round: 1, turn: 0,
    nextTurn: async () => { turns += 1; } };
  game.combats = new Map([[combat.id, combat]]);
  game.messages = new Map(); game.messages.some = (fn) => [...game.messages.values()].some(fn);
  globalThis.fromUuid = async (uuid) => uuid === victim.uuid ? victim : holder;
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async (data) => {
    const message = { ...data, getFlag: (scope, flag) => message.flags[scope][flag],
      update: async (changes) => { message.flags["mythras-foundry"].weaponRelease = changes["flags.mythras-foundry.weaponRelease"]; } };
    game.messages.set("release", message); return message;
  } };
  const dice = [50, 40];
  globalThis.Roll = class {
    async evaluate() { this.total = dice.shift(); return this; }
    toJSON() { return { total: this.total }; }
    static fromData(data) { return data; }
  };
  await applyWeaponPin(victim, "w1", { actorUuid: holder.uuid }, "m");
  const start = { operation: "start", actorUuid: victim.uuid, combatId: combat.id, effectId: "pin0", userId: "gm" };
  await applyWeaponPinRequest(start); await applyWeaponPinRequest(start);
  assert.equal(victim.system.resources.actionPoints.value, 1);
  assert.equal(holder.system.resources.actionPoints.value, 2);
  await applyWeaponPinRequest({ operation: "roll", messageId: "release", revision: 0, side: "victim", skillId: "unarmed", userId: "gm" });
  assert.equal(weaponIsPinned(victim.items[0], victim), true);
  await applyWeaponPinRequest({ operation: "roll", messageId: "release", revision: 0, side: "holder", skillId: "brawn", userId: "gm" });
  const result = game.messages.get("release").getFlag("mythras-foundry", "weaponRelease");
  assert.equal(result.victim.roll.abilityName, "Pelea");
  assert.equal(result.holder.roll.abilityName, "Músculo");
  assert.equal(result.freed, true); assert.equal(weaponPins(victim).length, 0);
  assert.equal(turns, 1); assert.equal(victim.items[0].system.equipped, true);
});
