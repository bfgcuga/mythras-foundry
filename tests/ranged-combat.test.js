import test from "node:test";
import assert from "node:assert/strict";
import { advanceReload, applyLongRangeDamage, combineRangedDifficulty, consumeAmmunition,
  distanceSizeSteps, isAccidentalMeleeHit, parseRangeProfile, rangedAttackProfile,
  rangedBand, reducePowerCategory } from "../scripts/rules/ranged-combat.js";

test("parses and classifies numeric range profiles", () => {
  assert.deepEqual(parseRangeProfile("15/100/200"), { short: 15, effective: 100, long: 200 });
  assert.equal(parseRangeProfile("Larga"), null);
  assert.equal(rangedBand(15, "15/100/200"), "short");
  assert.equal(rangedBand(101, "15/100/200"), "long");
  assert.equal(rangedBand(201, "15/100/200"), "beyond");
});

test("continues the distance and size progression", () => {
  assert.equal(distanceSizeSteps(10, 10), 0);
  assert.equal(distanceSizeSteps(30, 10), 1);
  assert.equal(distanceSizeSteps(10, 40), -1);
  assert.equal(distanceSizeSteps(141, 20), 4);
});

test("accumulates ranged difficulty and aim removes one adverse step", () => {
  assert.equal(combineRangedDifficulty("standard", [1, 2], false).difficulty, "herculean");
  assert.equal(combineRangedDifficulty("standard", [1, 2], true).difficulty, "formidable");
  const profile = rangedAttackProfile({ distance: 30, ranges: "15/100/200", targetSize: 10,
    modifiers: [{ steps: 1 }], aim: true });
  assert.equal(profile.band, "effective");
  assert.equal(profile.difficulty, "hard");
  assert.equal(combineRangedDifficulty("standard", [-2], false).difficulty, "veryEasy");
});

test("long range damage rounds upward and power drops", () => {
  assert.equal(applyLongRangeDamage(7, "long"), 4);
  assert.equal(applyLongRangeDamage(7, "effective"), 7);
  assert.equal(reducePowerCategory("G"), "M");
});

test("optional ammunition consumes and reloads by actions", () => {
  assert.equal(consumeAmmunition({ ammoTracking: false }).loaded, 0);
  assert.equal(consumeAmmunition({ ammoTracking: true, ammoLoaded: 1 }).loaded, 0);
  const first = advanceReload({ ammoTracking: true, ammoCapacity: 1, ammoLoaded: 0,
    ammoReserve: 3, reloadActions: 2 });
  assert.equal(first.completed, false);
  const second = advanceReload({ ...first, ammoTracking: true });
  assert.equal(second.completed, true);
  assert.equal(second.loaded, 1); assert.equal(second.reserve, 2);
});

test("detects an accidental melee target only inside the margin", () => {
  assert.equal(isAccidentalMeleeHit({ rawRoll: 55, modifiedTarget: 50,
    normalTarget: 70, meleePosition: "inside" }), true);
  assert.equal(isAccidentalMeleeHit({ rawRoll: 71, modifiedTarget: 50,
    normalTarget: 70, meleePosition: "inside" }), false);
});
