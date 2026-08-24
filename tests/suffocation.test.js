import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { breathHoldingSeconds, BREATH_CIRCUMSTANCES, SUFFOCATION_ROUND_SECONDS,
  prepareSuffocationEntry, suffocationTiming } from "../scripts/rules/suffocation.js";

test("el icono local de asfixia existe", () => {
  assert.equal(existsSync(new URL("../assets/icons/suffocation.svg", import.meta.url)), true);
});

test("la preparación y la actividad ajustan el tiempo de Aguante", () => {
  assert.deepEqual(BREATH_CIRCUMSTANCES, { prepared: 1, passive: 0.5, strenuous: 0.2 });
  assert.equal(breathHoldingSeconds(60, "prepared"), 60);
  assert.equal(breathHoldingSeconds(60, "passive"), 30);
  assert.equal(breathHoldingSeconds(60, "strenuous"), 12);
});

test("cada asalto consume cinco segundos y la tirada comienza al alcanzar el umbral", () => {
  assert.equal(SUFFOCATION_ROUND_SECONDS, 5);
  assert.equal(suffocationTiming({ endurance: 12, elapsedRounds: 2 }).checksRequired, false);
  const due = suffocationTiming({ endurance: 12, elapsedRounds: 3 });
  assert.equal(due.elapsedSeconds, 15);
  assert.equal(due.checksRequired, true);
});

test("las fracciones de segundo se conservan antes de convertir a asaltos", () => {
  const passive = suffocationTiming({ endurance: 35, circumstance: "passive",
    elapsedRounds: 3 });
  assert.equal(passive.thresholdSeconds, 17.5);
  assert.equal(passive.checksRequired, false);
  assert.equal(suffocationTiming({ endurance: 35, circumstance: "passive",
    elapsedRounds: 4 }).checksRequired, true);
});

test("la preparación del mismo asalto no avanza dos veces el contador", async () => {
  let condition = { key: "suffocating", statusId: "suffocating", endurance: 10,
    circumstance: "prepared", elapsedRounds: 0, combatUuid: "Combat.c",
    lastCountedRound: 1 };
  const effect = { id: "effect", statuses: new Set(["suffocating"]),
    getFlag: () => condition, update: async (change) => {
      condition = change["flags.mythras-foundry.timedCondition"];
    } };
  const actor = { id: "actor", uuid: "Actor.actor", name: "Hero", isToken: false,
    effects: [effect], items: [] };
  globalThis.game = { actors: { get: () => null } };
  const combatant = { id: "combatant", actor };
  const combat = { uuid: "Combat.c", round: 2 };
  assert.equal(await prepareSuffocationEntry(combat, combatant), null);
  assert.equal(condition.elapsedRounds, 1);
  assert.equal(await prepareSuffocationEntry(combat, combatant), null);
  assert.equal(condition.elapsedRounds, 1);
  combat.round = 3;
  const due = await prepareSuffocationEntry(combat, combatant);
  assert.equal(due.key, "suffocating");
  assert.equal(condition.elapsedRounds, 2);
  delete globalThis.game;
});
