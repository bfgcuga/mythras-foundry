import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSkillRollConditions } from "../scripts/rules/skill-roll-resolution.js";

const localize = (key) => key;
const format = (key, data) => `${key}:${data.level}`;
const location = (current, maximum = 5) => ({ type: "hitLocation",
  system: { currentHitPoints: current, maxHitPoints: maximum } });
const actor = ({ fatigueLevel = "fresh", locations = [], statuses = [], manual = false } = {}) => ({
  system: { fatigueLevel, strength: 10, baseAttributes: {} },
  items: locations,
  statuses: new Set(statuses),
  getFlag: () => manual
});
const skill = (physical = false) => ({ type: "skill", system: physical
  ? { characteristic1: "strength", characteristic2: "dexterity" }
  : { characteristic1: "power", characteristic2: "charisma" } });

test("personaje y PNJ pueden resolver todos los modificadores en una sola operación", () => {
  const result = resolveSkillRollConditions(actor({ fatigueLevel: "wearied",
    locations: [location(-1)], statuses: ["blinded"], manual: true }), skill(true), {
    woundImpact: { seriousPenalty: true },
    loadState: { key: "overloaded", difficultySteps: 2 }, localize, format
  });
  assert.equal(result.difficulty, "impossible");
  assert.deepEqual(result.modifiers.map((entry) => entry.source), [
    "MYTHRASF.SkillRoll.FatigueSource:MYTHRASF.Fatigue.Level.wearied",
    "MYTHRASF.Status.IncapacitatedManual", "MYTHRASF.Status.Blinded",
    "MYTHRASF.SkillRoll.EncumbranceSource", "MYTHRASF.Wound.serious"
  ]);
});

test("la herida crítica se informa sin duplicar la fatiga fresca", () => {
  const result = resolveSkillRollConditions(actor({ locations: [location(-5)] }), skill(), {
    loadState: { key: "unencumbered", difficultySteps: 0 }, localize, format
  });
  assert.equal(result.difficulty, "herculean");
  assert.deepEqual(result.modifiers, [{ source: "MYTHRASF.Wound.major",
    effect: "MYTHRASF.Difficulty.herculean", type: "penalty" }]);
});

test("la decisión sobre miembro inutilizado prevalece sin ocultar su procedencia", () => {
  const result = resolveSkillRollConditions(actor(), skill(), {
    woundImpact: { unusableMember: true },
    loadState: { key: "unencumbered", difficultySteps: 0 }, localize, format
  });
  assert.equal(result.difficulty, "impossible");
  assert.equal(result.modifiers.at(-1).source, "MYTHRASF.Wound.UnusableMember");
});

test("la dificultad base se combina una sola vez con la carga física", () => {
  const result = resolveSkillRollConditions(actor(), skill(true), {
    baseDifficulty: "hard", loadState: { key: "burdened", difficultySteps: 1 },
    localize, format
  });
  assert.equal(result.difficulty, "formidable");
});

test("las dos hojas delegan la tirada de habilidad en el resolvedor común", () => {
  for (const path of ["character-sheet.js", "npc-sheet.js"]) {
    const source = readFileSync(new URL(`../scripts/sheets/${path}`, import.meta.url), "utf8");
    assert.match(source, /resolveSkillRollConditions\(this\.actor, item/);
  }
});
