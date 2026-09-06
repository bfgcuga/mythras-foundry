import test from "node:test";
import assert from "node:assert/strict";
import { activeGrabs, isGrabbed } from "../scripts/rules/grappling.js";
import { applyImmediateCombatEffects } from "../scripts/rules/combat-effect-runtime.js";
import { combatEffectEligible, combatEffectRule, initialCombatEffectStatus } from "../scripts/rules/combat-effects.js";
import { availableCombatActions } from "../scripts/rules/combat-actions.js";
import { applyWeaponPinRequest } from "../scripts/rules/weapon-pin-runtime.js";
import { calculateDamageModifier } from "../scripts/rules/derived-attributes.js";

function actor(id) {
  const items = ["musculo", "pelea"].map((slug) => ({ id: slug, name: slug, type: "skill", system: { slug, total: 60 } }));
  items.get = (id) => items.find((item) => item.id === id);
  return { id, uuid: `Actor.${id}`, name: id, effects: [], items, statuses: new Set(),
    system: { attributes: { damageModifier: calculateDamageModifier(21, 0) }, resources: { actionPoints: { value: 2 } } },
    testUserPermission: (user) => user.id === id,
    async update(changes) { this.system.resources.actionPoints.value = changes["system.resources.actionPoints.value"]; },
    async createEmbeddedDocuments(type, sources) {
      const added = sources.map((source, index) => ({ ...source, id: `grab-${this.effects.length + index}` }));
      this.effects.push(...added); return added;
    },
    async deleteEmbeddedDocuments(type, ids) { this.effects = this.effects.filter((effect) => !ids.includes(effect.id)); } };
}

test("Agarrar exige confirmación, guarda el captor y bloquea distancia y retirada solo a la víctima", async () => {
  const victim = actor("victim"); const holder = actor("holder");
  const effect = { key: "agarrar", side: "attacker", ...combatEffectRule({ key: "agarrar" }) };
  assert.equal(initialCombatEffectStatus(effect), "active");
  const state = { attacker: { actorUuid: holder.uuid, actorName: holder.name }, defender: { actorUuid: victim.uuid }, effects: { selections: [effect], checks: [] } };
  const deps = { resolveActor: async (token, uuid) => uuid === victim.uuid ? victim : holder, localize: (key) => key };
  await applyImmediateCombatEffects(state, { uuid: "Chat.m" }, deps);
  assert.equal(activeGrabs(victim).length, 0);
  effect.parameters = { grabConfirmed: true };
  await applyImmediateCombatEffects(state, { uuid: "Chat.m" }, deps);
  assert.equal(activeGrabs(victim).length, 1);
  assert.equal(activeGrabs(victim)[0].flags["mythras-foundry"].timedCondition.sourceActorUuid, holder.uuid);
  assert.equal(isGrabbed(holder), false);
  const available = availableCombatActions({ inCombat: true, isActive: true, actionPoints: 1, grabbed: true });
  assert.equal(available.releaseGrab, true); assert.equal(available.changeReach, false);
  assert.equal(availableCombatActions({ inCombat: true, isActive: false, actionPoints: 1, grabbed: true }).releaseGrab, false);
  for (const key of ["abrir-distancia", "cerrar-distancia", "retirada"]) {
    assert.equal(combatEffectEligible({ key, defensive: true }, { winner: "defender", grabbed: true }), false);
    const selected = { key, side: "defender", target: "self" };
    state.effects.selections = [selected];
    await applyImmediateCombatEffects(state, { uuid: "Chat.m" }, deps);
    assert.equal(selected.status, "notActivated");
  }
  victim.effects[0].disabled = true;
  assert.equal(isGrabbed(victim), false);
});

test("Liberarse valida turno y propietario, cobra una vez y retira únicamente el agarre elegido", async (t) => {
  const old = Object.fromEntries(["game", "foundry", "fromUuid", "ChatMessage", "Roll"].map((key) => [key, globalThis[key]]));
  t.after(() => Object.assign(globalThis, old));
  const victim = actor("victim"); const holder = actor("holder");
  const users = new Map(["victim", "holder", "outsider"].map((id) => [id, { id, isGM: false }]));
  const messages = new Map(); messages.some = (fn) => [...messages.values()].some(fn);
  globalThis.game = { user: users.get("victim"), users, messages,
    i18n: { localize: (key) => key, format: (key, data) => `${key} ${JSON.stringify(data)}` } };
  globalThis.foundry = { utils: { deepClone: structuredClone, escapeHTML: String } };
  globalThis.fromUuid = async (uuid) => uuid === victim.uuid ? victim : uuid === holder.uuid ? holder : null;
  let turns = 0;
  const combat = { id: "c", started: true, combatant: { id: "v", actor: victim }, round: 1, turn: 0, nextTurn: async () => { turns++; } };
  game.combats = new Map([["c", combat]]);
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async (data) => {
    const message = { ...data, getFlag: (scope, key) => message.flags[scope][key],
      update: async (changes) => { message.flags["mythras-foundry"].weaponRelease = changes["flags.mythras-foundry.weaponRelease"]; } };
    messages.set("m", message); return message;
  } };
  const dice = [50, 40];
  globalThis.Roll = class { async evaluate() { this.total = dice.shift(); return this; }
    toJSON() { return { total: this.total }; } static fromData(data) { return data; } };
  const source = (id, captor) => ({ id, flags: { "mythras-foundry": { timedCondition: { key: "grabbed", sourceActorUuid: captor } } } });
  victim.effects.push(source("first", holder.uuid), source("other", "Actor.third"));
  const request = { operation: "start", kind: "grab", actorUuid: victim.uuid, combatId: "c", effectId: "first", userId: "outsider" };
  await applyWeaponPinRequest(request); assert.equal(messages.size, 0);
  request.userId = "victim";
  combat.combatant.actor = holder;
  await applyWeaponPinRequest(request); assert.equal(messages.size, 0);
  combat.combatant.actor = victim;
  await applyWeaponPinRequest(request); await applyWeaponPinRequest(request);
  assert.equal(victim.system.resources.actionPoints.value, 1);
  await applyWeaponPinRequest({ operation: "roll", messageId: "m", revision: 0, side: "victim", skillId: "pelea", userId: "victim" });
  assert.equal(activeGrabs(victim).length, 2);
  await applyWeaponPinRequest({ operation: "roll", messageId: "m", revision: 0, side: "holder", skillId: "musculo", userId: "holder" });
  assert.deepEqual(activeGrabs(victim).map((effect) => effect.id), ["other"]);
  assert.equal(holder.system.resources.actionPoints.value, 2);
  assert.equal(turns, 1);
});
