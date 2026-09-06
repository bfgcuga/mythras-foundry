import test from "node:test";
import assert from "node:assert/strict";

import { exsanguinationConditionSource } from "../scripts/rules/exsanguination.js";
import { periodicConditionEntries, prepareRoundConsequences } from "../scripts/rules/round-consequences.js";
import { applyCombatEffectCheckConsequence } from "../scripts/rules/combat-effect-runtime.js";
import { TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG, worsenFatigueLevel } from "../scripts/rules/timed-conditions.js";

test("Desangrándose es permanente y se procesa al inicio del asalto", () => {
  const condition = exsanguinationConditionSource();
  assert.equal(condition.key, "exsanguinating");
  assert.equal(condition.statusId, "exsanguinating");
  assert.equal(condition.unit, "manual");
  assert.equal(condition.phase, "startRound");
});

test("el estado nativo sin flags se procesa una vez y los efectos inactivos no cuentan", () => {
  const effect = { id: "native", statuses: new Set(["exsanguinating"]) };
  const actor = { id: "a", effects: [effect, { ...effect, id: "duplicate" }] };
  const combat = { combatants: [{ id: "c", actor }] };
  assert.equal(periodicConditionEntries(combat).length, 1);
  actor.effects = [{ ...effect, disabled: true }, { ...effect, isSuppressed: true }];
  assert.equal(periodicConditionEntries(combat).length, 0);
});

test("Desangrar pierde un nivel por asalto y anuncia víctima y Fatiga sin repetir la pérdida", async (t) => {
  const messages = [];
  const original = { game: globalThis.game, foundry: globalThis.foundry,
    ChatMessage: globalThis.ChatMessage };
  t.after(() => Object.assign(globalThis, original));
  globalThis.game = { i18n: { localize: (key) => key,
    format: (key, data) => `${key} ${JSON.stringify(data)}` } };
  globalThis.foundry = { utils: { escapeHTML: (value) => String(value) } };
  globalThis.ChatMessage = { create: async (data) => messages.push(data) };
  const actor = { id: "victim", uuid: "Actor.victim", name: "Víctima", type: "character",
    effects: [], statuses: new Set(), items: [],
    system: { fatigueLevel: "fresh", constitution: 100 },
    async update(data) { this.system.fatigueLevel = data["system.fatigueLevel"]; },
    async createEmbeddedDocuments(type, sources) {
      const effects = sources.map((source, index) => ({ ...source, id: `blood-${index}`,
        statuses: new Set(source.statuses), getFlag: (scope, key) => source.flags[scope]?.[key] }));
      this.effects.push(...effects);
      return effects;
    } };
  const combatant = { id: "c", actor, getFlag: () => null, setFlag: async () => {} };
  const tracker = { id: "combat", uuid: "Combat.combat", round: 1,
    combatants: [combatant], mythrasTurnEconomy: {},
    async setFlag(scope, key, value) { this.mythrasTurnEconomy = value; } };
  const effect = { key: "desangrar", side: "attacker", slot: 0 };
  await applyCombatEffectCheckConsequence({ attacker: { actorUuid: "Actor.attacker" },
    defender: { actorUuid: actor.uuid }, effects: { selections: [effect] } },
  { id: "check", effectKey: effect.key, effectSlot: 0, resolution: { winner: "right" } },
  actor, { resolveActor: async () => actor, localize: (key) => key });
  assert.equal(actor.effects[0].getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG).phase, "startRound");
  assert.equal(actor.system.fatigueLevel, "fresh");
  const queue = await prepareRoundConsequences(tracker);
  assert.equal(actor.system.fatigueLevel, worsenFatigueLevel("fresh", 1));
  assert.equal(queue[0].resolution.loss, 1);
  assert.equal(queue[0].status, "resolved");
  assert.match(messages[0].content, /Víctima/);
  assert.match(messages[0].content, /RoundConsequence.Fatigue.*loss.*1/);
  await prepareRoundConsequences(tracker);
  assert.equal(actor.system.fatigueLevel, worsenFatigueLevel("fresh", 1));
  tracker.round = 2;
  await prepareRoundConsequences(tracker);
  assert.equal(actor.system.fatigueLevel, worsenFatigueLevel("fresh", 2));
  actor.effects = [];
  tracker.round = 3;
  await prepareRoundConsequences(tracker);
  assert.equal(actor.system.fatigueLevel, worsenFatigueLevel("fresh", 2));
});

test("un Actor enlazado solo genera una pérdida automática por asalto", () => {
  const condition = exsanguinationConditionSource();
  const effect = { id: "blood", getFlag: () => condition };
  const actor = { id: "actor", isToken: false, uuid: "Actor.actor", effects: [effect],
    statuses: new Set() };
  const entries = periodicConditionEntries({ combatants: [
    { id: "one", actor }, { id: "two", actor }
  ] });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "exsanguinating");
  assert.equal(entries[0].automatic, true);
});
