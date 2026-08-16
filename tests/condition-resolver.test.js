import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conditionDescriptors, encumbranceDescriptors, resolveConditions,
  statusDescriptors, woundDescriptors } from "../scripts/rules/condition-resolver.js";

const baseAttributes = { movementRate: 7, initiative: 12, actionPointsMax: 3,
  luckPointsMax: 2, magicPointsMax: 11,
  damageModifier: { sign: 1, terms: ["1d2"], label: "+1d2" } };

test("los productores omiten efectos neutros y conservan estados informativos", () => {
  assert.deepEqual(woundDescriptors("healthy"), []);
  assert.deepEqual(encumbranceDescriptors({ key: "unencumbered", difficultySteps: 0,
    movement: "none" }), []);
  const [unknown] = statusDescriptors([{ id: "module-status", name: "Module status" }]);
  assert.equal(unknown.scope, "information");
  assert.equal(unknown.operation, "none");
});

test("herida crítica e incapacitación manual establecen el suelo de condición", () => {
  const wounded = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: "tired", woundLevel: "major" }) });
  const manual = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: "fresh", manuallyIncapacitated: true }) });
  assert.equal(wounded.condition.key, "incapacitated");
  assert.equal(manual.condition.key, "incapacitated");
  assert.equal(wounded.attributes.movementRate, 0);
});

test("una fatiga peor prevalece sobre los suelos de incapacitación", () => {
  const result = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: "comatose", woundLevel: "major", manuallyIncapacitated: true }) });
  assert.equal(result.condition.key, "comatose");
  assert.equal(result.difficulty, "impossible");
});

test("los suelos se combinan antes de los incrementos contextuales", () => {
  const descriptors = conditionDescriptors({ fatigueKey: "winded", woundLevel: "serious",
    loadState: { key: "loaded", difficultySteps: 1, movement: "subtract" },
    statuses: [{ id: "prone", skillDifficulty: "formidable" }] });
  const result = resolveConditions({ baseAttributes, descriptors });
  assert.deepEqual(result.difficulties, {
    general: "formidable", physical: "herculean", situational: "herculean",
    combined: "impossible"
  });
  assert.equal(resolveConditions({ baseAttributes, descriptors,
    context: { physical: true, situational: false } }).difficulty, "herculean");
});

test("combina transformaciones de fatiga, carga y armadura en orden", () => {
  const result = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: "exhausted",
    loadState: { key: "overloaded", difficultySteps: 2, movement: "half" },
    armorPenalty: 2
  }) });
  assert.equal(result.attributes.movementRate, 1);
  assert.equal(result.attributes.initiative, 6);
  assert.equal(result.attributes.actionPointsMax, 2);
});

test("inconsciente anula atributos y junto con aturdido bloquea ataques", () => {
  const result = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    statuses: [
      { id: "unconscious", skillDifficulty: "impossible", zeroAttributes: true,
        canAttack: false },
      { id: "stunned", canAttack: false }
    ]
  }) });
  assert.equal(result.attributes.initiative, 0);
  assert.equal(result.attributes.magicPointsMax, 0);
  assert.deepEqual(result.attributes.damageModifier, { sign: 0, terms: [], label: "0" });
  assert.equal(result.capabilities.canAttack, false);
});

test("una herida crítica anula PA y ataque aunque el máximo base sea superior a tres", () => {
  const result = resolveConditions({ baseAttributes: { ...baseAttributes, actionPointsMax: 6 },
    descriptors: conditionDescriptors({ woundLevel: "major" }) });
  assert.equal(result.attributes.actionPointsMax, 0);
  assert.equal(result.capabilities.canAttack, false);
  assert.equal(result.attributes.initiative, 4);
});

test("el contexto decide carga y herida grave sin mutar descriptores", () => {
  const descriptors = conditionDescriptors({ woundLevel: "serious",
    loadState: { key: "loaded", difficultySteps: 1, movement: "subtract" } });
  assert.equal(resolveConditions({ baseAttributes, descriptors }).difficulty, "standard");
  assert.equal(resolveConditions({ baseAttributes, descriptors,
    context: { physical: true } }).difficulty, "hard");
  assert.equal(resolveConditions({ baseAttributes, descriptors,
    context: { situational: true } }).difficulty, "hard");
  assert.equal(resolveConditions({ baseAttributes, descriptors,
    context: { physical: true, situational: true } }).difficulty, "formidable");
  assert.equal(Object.isFrozen(descriptors), true);
  assert.equal(Object.isFrozen(descriptors[0]), true);
});

test("los modelos y hojas de personaje y PNJ consumen el resolvedor compartido", () => {
  for (const path of [
    "scripts/data/character-data.js", "scripts/data/npc-data.js",
    "scripts/sheets/character-sheet.js", "scripts/sheets/npc-sheet.js"
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /resolveActorConditions/);
  }
  const npcData = readFileSync(new URL("../scripts/data/npc-data.js", import.meta.url), "utf8");
  const npcSheet = readFileSync(new URL("../scripts/sheets/npc-sheet.js", import.meta.url), "utf8");
  assert.match(npcData, /actorLoadState/);
  assert.match(npcData, /loadState: this\.loadState/);
  assert.match(npcSheet, /skillUsesStrengthOrDexterity/);
  assert.match(npcSheet, /physical: true/);
  assert.match(npcSheet, /preparePenaltySummary\(penaltySummary/);
});
