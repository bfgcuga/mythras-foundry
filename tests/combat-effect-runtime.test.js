import test from "node:test";
import assert from "node:assert/strict";
import { combatEffectRule, initialCombatEffectStatus } from "../scripts/rules/combat-effects.js";
import { addManagedCombatStatus, applyCombatEffectCheckConsequence,
  applyAutomaticCombatEffectChecks, applyImmediateCombatEffects, applyPostDamageCombatEffects,
  combatEffectAffectedSide
} from "../scripts/rules/combat-effect-runtime.js";

function combat(selections = []) {
  return { attacker: { actorUuid: "Actor.attacker", tokenUuid: "Token.attacker",
    actorName: "Atacante" }, defender: { actorUuid: "Actor.defender",
    tokenUuid: "Token.defender", actorName: "Defensor" },
  turnEconomy: { combatId: "combat", combatantId: "a", defenderCombatantId: "d" },
  effects: { selections, checks: [] }, damage: { locationId: "head", penetratingDamage: 3 } };
}

test("Alzarse elimina Derribado del defensor, conserva otros estados y se resuelve antes del daño", async () => {
  const effect = { key: "alzarse", side: "defender", slot: 0,
    ...combatEffectRule({ key: "alzarse" }) };
  assert.equal(initialCombatEffectStatus(effect), "active");
  assert.equal(effect.stage, "beforeDamage");
  const state = combat([effect]);
  const actor = { effects: [
    { id: "prone-one", statuses: new Set(["prone"]) },
    { id: "prone-two", statuses: new Set(["prone"]) },
    { id: "blinded", statuses: new Set(["blinded"]) }
  ], async deleteEmbeddedDocuments(type, ids) {
    assert.equal(type, "ActiveEffect");
    this.effects = this.effects.filter((entry) => !ids.includes(entry.id));
  } };
  const deps = { resolveActor: async (tokenUuid, actorUuid) => {
    assert.equal(tokenUuid, "Token.defender");
    assert.equal(actorUuid, "Actor.defender");
    return actor;
  } };
  await applyImmediateCombatEffects(state, { uuid: "ChatMessage.message" }, deps);
  assert.deepEqual(actor.effects.map((entry) => entry.id), ["blinded"]);
  assert.equal(effect.status, "resolved");
  assert.equal(state.consequencesApplied, true);
  assert.deepEqual(state.effects.checks, []);
  delete state.consequencesApplied;
  await applyImmediateCombatEffects(state, { uuid: "ChatMessage.message" }, deps);
  assert.equal(state.consequencesApplied, undefined);
  assert.equal(effect.status, "resolved");
});

function dependencies({ conditions = [], positions = [] } = {}) {
  const actors = { "Actor.attacker": { uuid: "Actor.attacker" },
    "Actor.defender": { uuid: "Actor.defender" } };
  return { resolveActor: async (tokenUuid, actorUuid) => actors[actorUuid],
    combatById: () => ({ uuid: "Combat.combat", round: 2, turn: 1,
      mythrasTurnEconomy: { cycle: 3 }, combatant: { actor: actors["Actor.defender"] } }),
  localize: (key) => key, applyCondition: async (actor, condition) => {
    conditions.push({ actor, condition });
  }, engagementKey: (left, right) => `${left}:${right}`,
  setPosition: async (...args) => { positions.push(args); },
  evaluateRoll: async () => ({ total: 2 }) };
}

test("el lado afectado distingue efectos propios y contra el oponente", () => {
  assert.equal(combatEffectAffectedSide({ side: "attacker", target: "self" }), "attacker");
  assert.equal(combatEffectAffectedSide({ side: "attacker" }), "defender");
  assert.equal(combatEffectAffectedSide({ side: "defender" }), "attacker");
});

test("un estado gestionado conserva origen, combate y duración", async () => {
  const conditions = [];
  const state = combat();
  state.messageUuid = "ChatMessage.message";
  await addManagedCombatStatus(state, { side: "attacker" },
    { key: "pressed", statusId: "pressed", turns: 1 }, dependencies({ conditions }));
  assert.equal(conditions.length, 1);
  assert.equal(conditions[0].actor.uuid, "Actor.defender");
  assert.equal(conditions[0].condition.source.messageUuid, "ChatMessage.message");
  assert.equal(conditions[0].condition.combat.cycle, 3);
  assert.equal(conditions[0].condition.duration.skipCurrentTurn, true);
  assert.equal(state.consequencesApplied, true);
});

test("los efectos inmediatos aplican estados, alcance y pruebas pendientes", async () => {
  const conditions = [];
  const positions = [];
  const selections = [
    { key: "aprovechar-la-ventaja", side: "attacker", slot: 0 },
    { key: "desequilibrar-oponente", side: "attacker", slot: 1 },
    { key: "desequilibrar-oponente", side: "attacker", slot: 2 },
    { key: "retirada", side: "defender", slot: 3 },
    { key: "cegar-oponente", name: "Cegar", side: "attacker", slot: 4 },
    { key: "disparo-de-supresion", name: "Supresión", side: "attacker", slot: 5 },
    { key: "ignorado", side: "attacker", slot: 6, waived: true }
  ];
  const state = combat(selections);
  await applyImmediateCombatEffects(state, { uuid: "ChatMessage.message" },
    dependencies({ conditions, positions }));
  assert.equal(state.messageUuid, "ChatMessage.message");
  assert.deepEqual(conditions.map((entry) => entry.condition.duration.value), [1, 2]);
  assert.equal(positions.length, 1);
  assert.deepEqual(positions[0].slice(1, 3), ["a:d", "neutral"]);
  assert.equal(positions[0][3].status, "disengaged");
  assert.deepEqual(state.effects.checks.map((entry) => entry.abilitySlugs),
    [["evadir"], ["voluntad"]]);
  assert.equal(selections[4].status, "pending");
  assert.equal(selections[5].status, "pending");
});

test("una prueba de efecto no resistida ejecuta su consecuencia", async () => {
  const conditions = [];
  const effect = { key: "cegar-oponente", side: "attacker", slot: 2 };
  const state = combat([effect]);
  const check = { id: "check", effectKey: effect.key, effectSlot: 2,
    resolution: { winner: "right" } };
  await applyCombatEffectCheckConsequence(state, check, { uuid: "Actor.defender" },
    { ...dependencies({ conditions }), manual: true });
  assert.equal(effect.status, "resolved");
  assert.equal(effect.resolution.resisted, false);
  assert.equal(conditions[0].condition.key, "blinded");
  assert.equal(conditions[0].condition.duration.value, 2);
});

test("una prueba resistida resuelve el efecto sin aplicar documentos", async () => {
  const conditions = [];
  const effect = { key: "tumbar-oponente", side: "attacker", slot: 1 };
  const state = combat([effect]);
  await applyCombatEffectCheckConsequence(state, { id: "check", effectKey: effect.key,
    effectSlot: 1, resolution: { winner: "left" } }, { uuid: "Actor.defender" },
  dependencies({ conditions }));
  assert.equal(effect.resolution.resisted, true);
  assert.equal(conditions.length, 0);
});

test("el éxito automático hace fallar la resistencia sin tirar", async () => {
  const conditions = [];
  const effect = { key: "cegar-oponente", name: "Cegar", side: "defender", slot: 4,
    automaticSuccess: true };
  const state = combat([effect]);
  await applyImmediateCombatEffects(state, { uuid: "ChatMessage.message" },
    dependencies({ conditions }));
  const check = state.effects.checks[0];
  assert.equal(check.automaticFailure, true);
  assert.equal(check.status, "resolved");
  assert.equal(check.resolution.automaticFailure, true);
  assert.equal(effect.resolution.resisted, false);
  assert.equal(conditions[0].condition.key, "blinded");
});

test("las resistencias automáticas condicionadas esperan su fase", async () => {
  const conditions = [];
  const effect = { key: "tumbar-oponente", side: "defender", slot: 2,
    automaticSuccess: true };
  const state = combat([effect]);
  state.effects.checks = [{ id: "effect-defender-2", source: "effect",
    effectKey: effect.key, effectSide: "defender", effectSlot: 2,
    actorSide: "attacker", status: "pending", automaticFailure: true }];
  await applyAutomaticCombatEffectChecks(state, dependencies({ conditions }));
  assert.equal(state.effects.checks[0].status, "resolved");
  assert.equal(conditions[0].condition.statusId, "incapacitated");
});


test("Marcar Enemigo se resuelve como narración sin pruebas ni cambios en documentos", async () => {
  const effect = { key: "marcar-enemigo", side: "attacker", slot: 0,
    ...combatEffectRule({ key: "marcar-enemigo" }) };
  assert.equal(initialCombatEffectStatus(effect), "active");
  const state = combat([effect]);
  await applyImmediateCombatEffects(state, { uuid: "message" }, { resolveActor: assert.fail });
  assert.equal(effect.status, "resolved");
  assert.deepEqual(state.effects.checks, []);
  assert.equal(state.consequencesApplied, undefined);
});

test("Enredar aplica a la localización impactada y bloquea el objeto elegido en un brazo", async () => {
  const effects = [];
  const sword = { id: "sword", type: "weapon", system: { equipped: true, handsRequired: 1 } };
  const arm = { id: "arm", type: "hitLocation", system: { category: "limb", hpClass: "arm" } };
  const items = new Map([[sword.id, sword], [arm.id, arm]]);
  items[Symbol.iterator] = items.values.bind(items);
  const defender = { uuid: "Actor.defender", items, effects,
    async createEmbeddedDocuments(type, sources) { effects.push(...sources.map((source, index) => ({
      id: `effect-${index}`, ...source, getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
    }))); } };
  const state = combat([{ key: "enredar", side: "attacker", slot: 0, status: "active" }]);
  state.damage.locationId = arm.id;
  await applyPostDamageCombatEffects(state, { resolveActor: async (token, uuid) =>
    uuid === defender.uuid ? defender : { uuid }, localize: (key) => key,
  chooseEntangledItem: async () => sword.id });
  const data = effects[0].getFlag("mythras-foundry", "timedCondition");
  assert.equal(data.key, "entangled");
  assert.equal(data.kind, "arm");
  assert.equal(data.weaponId, sword.id);
  assert.equal(data.locationId, arm.id);
  assert.equal(state.effects.selections[0].status, "resolved");
});
