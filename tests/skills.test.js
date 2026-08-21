import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateSkillValues,
  fumbledSkillUpdatesAtZero,
  recordAbilityFumble,
  NEW_SKILL_EXPERIENCE_COST,
  resolveExperienceImprovement,
  skillAcquisition
} from "../scripts/rules/skills.js";

test("separa la base de las mejoras por fase", () => {
  const result = calculateSkillValues({
    characteristic1: "strength",
    characteristic2: "dexterity",
    baseBonus: 0,
    culturePoints: 10,
    professionPoints: 5,
    freePoints: 7,
    experiencePoints: 3
  }, {
    strength: 12,
    dexterity: 14
  });

  assert.deepEqual(result, {
    base: 26,
    bonus: 25,
    total: 51,
    experienceImprovementBonus: 0
  });
});

test("admite característica duplicada y bonificación inicial fija", () => {
  const result = calculateSkillValues({
    characteristic1: "intelligence",
    characteristic2: "intelligence",
    baseBonus: 40,
    culturePoints: 0,
    professionPoints: 0,
    freePoints: 0,
    experiencePoints: 0
  }, {
    intelligence: 13
  });

  assert.deepEqual(result, {
    base: 66,
    bonus: 0,
    total: 66,
    experienceImprovementBonus: 0
  });
});

test("una pifia concede un +1 a la futura mejora de experiencia", () => {
  const result = calculateSkillValues({
    characteristic1: "power",
    characteristic2: "charisma",
    fumbled: true
  }, {
    power: 11,
    charisma: 12
  });

  assert.equal(result.experienceImprovementBonus, 1);
  assert.equal(result.total, 23);
});

test("la mejora usa 1d4+1 cuando 1d100+INT alcanza la habilidad", () => {
  assert.deepEqual(resolveExperienceImprovement({
    skillTotal: 63,
    intelligence: 13,
    checkRoll: 50,
    improvementRoll: 3
  }), {
    modifiedRoll: 63,
    succeeded: true,
    rolledIncrease: 4,
    fumbleBonus: 0,
    increase: 4
  });
});

test("la mejora es +1 si falla y suma otro +1 por pifia", () => {
  const result = resolveExperienceImprovement({
    skillTotal: 64,
    intelligence: 13,
    checkRoll: 50,
    improvementRoll: 4,
    fumbled: true
  });

  assert.equal(result.succeeded, false);
  assert.equal(result.rolledIncrease, 1);
  assert.equal(result.fumbleBonus, 1);
  assert.equal(result.increase, 2);
});

test("adquirir una habilidad o estilo de combate cuesta tres tiradas de experiencia", () => {
  assert.equal(NEW_SKILL_EXPERIENCE_COST, 3);
  assert.deepEqual(skillAcquisition({ experienceRolls: 2 }), {
    cost: 3,
    available: 2,
    allowed: false
  });
  assert.equal(skillAcquisition({ experienceRolls: 3 }).allowed, true);
});

test("el modo de edición permite adquirir habilidades y estilos sin coste", () => {
  assert.deepEqual(skillAcquisition({ experienceRolls: 0, editMode: true }), {
    cost: 0,
    available: 0,
    allowed: true
  });
});

test("al llegar a cero se limpian las pifias de habilidades y estilos", () => {
  const items = [
    { id: "skill", type: "skill", system: { fumbled: true } },
    { id: "style", type: "combatStyle", system: { fumbled: true } },
    { id: "clean", type: "skill", system: { fumbled: false } },
    { id: "weapon", type: "weapon", system: { fumbled: true } }
  ];
  assert.deepEqual(fumbledSkillUpdatesAtZero(0, items), [
    { _id: "skill", "system.fumbled": false },
    { _id: "style", "system.fumbled": false }
  ]);
  assert.deepEqual(fumbledSkillUpdatesAtZero(1, items), []);
});

test("una pifia marca automáticamente la habilidad o estilo que ha tirado", async () => {
  const updates = [];
  const skill = { type: "skill", system: { fumbled: false },
    update: async (change) => updates.push(change) };
  assert.equal(await recordAbilityFumble(skill, "fumble"), true);
  assert.deepEqual(updates, [{ "system.fumbled": true }]);
  assert.equal(await recordAbilityFumble(skill, "failure"), false);
  assert.equal(await recordAbilityFumble({ ...skill, type: "passion" }, "fumble"), false);
});

test("una pifia de personaje actualiza la habilidad del Actor fuente", async () => {
  const updates = [];
  const sourceItem = { id: "skill", type: "skill", system: { fumbled: false },
    update: async (change) => updates.push(change) };
  globalThis.game = { actors: new Map([["source", { items: new Map([["skill", sourceItem]]) }]]) };
  const tokenItem = { ...sourceItem, actor: { id: "synthetic", type: "character",
    token: { actorId: "source" } }, update: async () => assert.fail("must update source item") };
  assert.equal(await recordAbilityFumble(tokenItem, "fumble"), true);
  assert.deepEqual(updates, [{ "system.fumbled": true }]);
});
