import test from "node:test";
import assert from "node:assert/strict";
import { calculateDamageModifier } from "../scripts/rules/derived-attributes.js";
import { strengthContestAdjustment, damageModifierGrade } from "../scripts/rules/strength-contests.js";
import { resolveContest, resolveConfiguredContest } from "../scripts/rules/contest-rolls.js";
import { resolveWeaponRelease } from "../scripts/rules/weapon-pinning.js";

const participant = (id, total, abilitySlug = "musculo") => ({ id, abilitySlug,
  damageModifier: calculateDamageModifier(total, 0), baseTarget: 90,
  target: 90, difficulty: "standard", rawRoll: 55 });

test("los grados de fuerza siguen la tabla real, incluidos modificadores negativos y grandes", () => {
  const totals = [1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 61, 71, 81, 91, 101, 111, 121, 131, 141, 151];
  totals.forEach((total, grade) => assert.equal(damageModifierGrade(calculateDamageModifier(total, 0)), grade));
  assert.equal(damageModifierGrade(null), null);
});

test("solo Músculo del rival más débil acumula grados sobre la dificultad existente", () => {
  const weak = participant("a", 21); const strong = participant("b", 31, "pelea");
  assert.deepEqual(strengthContestAdjustment(weak, [strong]), { steps: 2, difficulty: "formidable", target: 45 });
  assert.equal(strengthContestAdjustment({ ...weak, difficulty: "hard" }, [strong]).difficulty, "herculean");
  assert.equal(strengthContestAdjustment({ ...weak, abilitySlug: "pelea" }, [strong]).steps, 0);
  assert.equal(strengthContestAdjustment(strong, [weak]).steps, 0);
  assert.equal(strengthContestAdjustment(weak, [participant("b", 41)]).difficulty, "impossible");
});

test("la enfrentada general y liberar una presa resuelven la misma penalización antes de >100", () => {
  const victim = participant("victim", 21); const holder = { ...participant("holder", 31), rawRoll: 50 };
  const simple = resolveContest({ type: "opposed", initiatorId: victim.id, participants: [victim, holder] });
  assert.equal(simple.participants[0].target, 45);
  assert.equal(simple.comparisons[0].winnerId, "holder");
  assert.equal(resolveWeaponRelease(victim, holder).freed, false);
  const participants = [{ ...victim, baseTarget: 240, target: 240 }, { ...holder, baseTarget: 150, target: 150 }];
  const configured = resolveConfiguredContest({ resolutionMode: "opposed", participants,
    sides: { initiator: { participantIds: [victim.id] }, opponent: { participantIds: [holder.id] } } });
  assert.equal(configured.penalty, 50);
  assert.equal(configured.participants[0].target, 70);
  const unopposed = resolveConfiguredContest({ resolutionMode: "difficulty", participants: [victim],
    sides: { initiator: { participantIds: [victim.id] } } });
  assert.equal(unopposed.participants[0].target, 90);
});
