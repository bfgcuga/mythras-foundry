import test from "node:test";
import assert from "node:assert/strict";

import { calculateSkillValues } from "../scripts/rules/skills.js";

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
    total: 51
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
    total: 66
  });
});
