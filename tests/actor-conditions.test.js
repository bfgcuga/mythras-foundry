import test from "node:test";
import assert from "node:assert/strict";
import { actorConditionState, actorLoadState,
  resolveActorConditions } from "../scripts/rules/actor-conditions.js";

function actorFixture() {
  return {
    system: { strength: 10, fatigueLevel: "tired" },
    statuses: new Set(["prone"]),
    getFlag: () => false,
    items: [{ type: "equipment", system: { quantity: 1, weight: 25 } },
      { type: "armor", system: { equipped: true, baseEncumbrance: 5, material: "bronze" } },
      { type: "hitLocation", system: { currentHitPoints: 0, maxHitPoints: 5 } }]
  };
}

test("reúne una única instantánea de condiciones a partir de un Actor", () => {
  const actor = actorFixture();
  const state = actorConditionState(actor);
  assert.equal(state.fatigueKey, "tired");
  assert.equal(state.woundLevel, "serious");
  assert.equal(state.loadState.key, "loaded");
  assert.equal(state.armorPenalty, 1);
  assert.deepEqual(state.statuses.map(({ id }) => id), ["prone"]);
});

test("personajes y PNJ comparten carga y resolución contextual", () => {
  const actor = actorFixture();
  assert.equal(actorLoadState(actor).key, "loaded");
  const baseAttributes = { movementRate: 6, initiative: 12, actionPointsMax: 3 };
  const general = resolveActorConditions(actor, { baseAttributes });
  const physical = resolveActorConditions(actor, { baseAttributes, physical: true });
  const situational = resolveActorConditions(actor, { baseAttributes, situational: true });
  assert.equal(general.difficulty, "formidable");
  assert.equal(physical.difficulty, "herculean");
  assert.equal(situational.difficulty, "herculean");
  assert.equal(general.attributes.movementRate, 3);
  assert.equal(general.attributes.initiative, 11);
});

test("el estado Incapacitado heredado conserva el suelo aunque aún no tenga bandera", () => {
  const actor = actorFixture();
  actor.statuses = new Set(["incapacitated"]);
  actor.system.fatigueLevel = "fresh";
  actor.items = [];
  const baseAttributes = { movementRate: 6, initiative: 12, actionPointsMax: 3 };
  assert.equal(actorConditionState(actor).manuallyIncapacitated, true);
  assert.equal(resolveActorConditions(actor, { baseAttributes }).condition.key, "incapacitated");
});

test("la peor arma empalada aumenta una sola vez la dificultad general", () => {
  const actor = actorFixture();
  actor.system.fatigueLevel = "fresh"; actor.statuses = new Set(["impaled"]); actor.items = [];
  actor.effects = [{ flags: { "mythras-foundry": { timedCondition: {
    key: "impaled", difficultySteps: 1 } } } },
  { flags: { "mythras-foundry": { timedCondition: {
    key: "impaled", difficultySteps: 3 } } } }];
  assert.equal(resolveActorConditions(actor).difficulty, "herculean");
});
