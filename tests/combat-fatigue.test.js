import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { advanceCombatFatigue, combatFatigueInterval,
  combatFatigueLoss } from "../scripts/rules/combat-fatigue.js";
import { roundEnduranceTarget } from "../scripts/rules/round-consequences.js";

test("calcula el intervalo de fatiga de combate redondeando CON hacia arriba", () => {
  assert.equal(combatFatigueInterval(1), 1);
  assert.equal(combatFatigueInterval(5), 1);
  assert.equal(combatFatigueInterval(6), 2);
  assert.equal(combatFatigueInterval(10), 2);
  assert.equal(combatFatigueInterval(11), 3);
});

test("solo cuenta asaltos terminados y conserva el vencimiento al repetir la preparación", () => {
  const start = advanceCombatFatigue(null, { combatId: "c1", round: 0, interval: 2 });
  assert.equal(start.due, false);
  assert.equal(start.state.roundsElapsed, 0);
  const first = advanceCombatFatigue(start.state, { combatId: "c1", round: 1, interval: 2 });
  assert.equal(first.due, false);
  const second = advanceCombatFatigue(first.state, { combatId: "c1", round: 2, interval: 2 });
  assert.equal(second.due, true);
  const repeated = advanceCombatFatigue(second.state, { combatId: "c1", round: 2, interval: 2 });
  assert.equal(repeated.due, true);
  assert.deepEqual(repeated.state, second.state);
  const third = advanceCombatFatigue(second.state, { combatId: "c1", round: 3, interval: 2 });
  assert.equal(third.due, false);
});

test("vence al completar los asaltos correspondientes a CON", () => {
  let con12 = advanceCombatFatigue(null, { combatId: "c1", round: 0, interval: 3 });
  con12 = advanceCombatFatigue(con12.state, { combatId: "c1", round: 1, interval: 3 });
  assert.equal(con12.due, false);
  con12 = advanceCombatFatigue(con12.state, { combatId: "c1", round: 2, interval: 3 });
  assert.equal(con12.due, false);
  con12 = advanceCombatFatigue(con12.state, { combatId: "c1", round: 3, interval: 3 });
  assert.equal(con12.due, true);

  const con4 = advanceCombatFatigue(null, { combatId: "c2", round: 1, interval: 1 });
  assert.equal(con4.due, true);
});

test("la tirada periódica solo pierde un nivel al fallar", () => {
  assert.equal(combatFatigueLoss("critical"), 0);
  assert.equal(combatFatigueLoss("success"), 0);
  assert.equal(combatFatigueLoss("failure"), 1);
  assert.equal(combatFatigueLoss("fumble"), 1);
});

test("Aguante periódico aplica fatiga y las demás condiciones de habilidad", () => {
  globalThis.game = { i18n: { localize: (key) => key,
    format: (key) => key } };
  const skill = { type: "skill", system: { slug: "aguante", total: 75,
    characteristic1: "constitution", characteristic2: "constitution" } };
  const actor = { items: [skill], statuses: new Set(),
    system: { fatigueLevel: "winded", strength: 10 }, getFlag: () => false };
  assert.deepEqual({ ...roundEnduranceTarget(actor, skill), modifiers: undefined }, {
    baseTarget: 75, difficulty: "hard", target: 50, modifiers: undefined
  });
  actor.statuses.add("blinded");
  assert.deepEqual({ ...roundEnduranceTarget(actor, skill), modifiers: undefined }, {
    baseTarget: 75, difficulty: "herculean", target: 15, modifiers: undefined
  });
});

test("la Suerte de fatiga distingue tirada propia y rival y recalcula la pérdida", () => {
  const source = readFileSync(new URL("../scripts/rules/round-consequences.js", import.meta.url),
    "utf8");
  assert.match(source, /context\.ownRoll \? "MYTHRASF\.Luck\.Confirm" : "MYTHRASF\.Luck\.ForceRerollConfirm"/);
  assert.match(source, /\.\.\.\(context\.ownRoll \? \[\{ action: "invert"/);
  assert.match(source, /const loss = combatFatigueLoss\(result\)/);
  assert.match(source, /const endurance = roundEnduranceTarget\(actor, skill\)/);
  assert.match(source, /worsenFatigueLevel\(entry\.resolution\.before, loss\)/);
});
