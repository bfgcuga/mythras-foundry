import test from "node:test";
import assert from "node:assert/strict";
import { activeImpalements, extractionDamage, impalementConditionDescriptors,
  impalementPenalty, impalementsReachableBy } from "../scripts/rules/impalement.js";

const effect = (id, data) => ({ id, flags: { "mythras-foundry": {
  timedCondition: { key: "impaled", ...data } } } });

test("la tabla de empalamiento progresa por TAM de criatura y arma", () => {
  assert.deepEqual(impalementPenalty(10, "P"), {
    key: "formidable", difficultySteps: 2, incapacitated: false });
  assert.equal(impalementPenalty(20, "P").key, "hard");
  assert.equal(impalementPenalty(30, "P").key, "none");
  assert.equal(impalementPenalty(10, "M").key, "herculean");
  assert.equal(impalementPenalty(10, "G").incapacitated, true);
  assert.equal(impalementPenalty(60, "D").key, "hard");
});

test("varios empalamientos aplican solo la penalización más grave", () => {
  const actor = { effects: [effect("small", { difficultySteps: 1 }),
    effect("large", { difficultySteps: 3 })] };
  assert.equal(activeImpalements(actor).length, 2);
  const descriptors = impalementConditionDescriptors(actor);
  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].value, 3);
});

test("un empalamiento incapacitante prevalece y la extracción respeta Barbada", () => {
  const actor = { effects: [effect("hard", { difficultySteps: 3 }),
    effect("incapacitating", { incapacitated: true })] };
  assert.equal(impalementConditionDescriptors(actor)[0].value, "incapacitated");
  assert.equal(extractionDamage(7, false), 4);
  assert.equal(extractionDamage(7, true), 7);
});

test("solo las armas clavadas en rivales trabados están disponibles", () => {
  const owner = { uuid: "Actor.owner", effects: [] };
  const victim = { uuid: "Actor.victim", effects: [effect("spear", { weaponName: "Lanza" })] };
  const distant = { uuid: "Actor.distant", effects: [effect("javelin", { weaponName: "Jabalina" })] };
  const combatants = [{ id: "owner", actor: owner, name: "Dueño" },
    { id: "victim", actor: victim, name: "Víctima" },
    { id: "distant", actor: distant, name: "Lejano" }];
  combatants.get = (id) => combatants.find((entry) => entry.id === id);
  const combat = { combatants, getFlag: () => ({ relations: { engaged: {
    status: "engaged", sides: { owner: {}, victim: {} } } } }) };
  const choices = impalementsReachableBy(combat, owner);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].data.weaponName, "Lanza");
});
