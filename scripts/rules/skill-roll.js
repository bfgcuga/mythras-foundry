import { combineDifficulties } from "./fatigue.js";
import { difficultyTarget } from "./combat.js";

export function supportingSkillAdjustment(baseTarget, supportingTarget, mode = "none") {
  const base = Math.max(0, Number(baseTarget) || 0);
  const support = Math.max(0, Number(supportingTarget) || 0);
  if (mode === "limited") return Math.min(base, support);
  if (mode === "reinforced") return base + Math.ceil(support * 0.2);
  return base;
}

export function resolveSkillRollTargets({ baseTarget, difficulty = "standard",
  imposedDifficulty = "standard", limited = false, limitedTarget = 0,
  reinforced = false, reinforcedTarget = 0 } = {}) {
  let adjustedTarget = Math.max(0, Number(baseTarget) || 0);
  if (limited) adjustedTarget = supportingSkillAdjustment(adjustedTarget, limitedTarget, "limited");
  if (reinforced) {
    adjustedTarget = supportingSkillAdjustment(adjustedTarget, reinforcedTarget, "reinforced");
  }
  const effectiveDifficulty = combineDifficulties(difficulty, imposedDifficulty);
  const target = difficultyTarget(adjustedTarget, effectiveDifficulty);
  return {
    baseTarget: Math.max(0, Number(baseTarget) || 0),
    adjustedTarget,
    difficulty: effectiveDifficulty,
    target,
    criticalTarget: Math.max(1, Math.ceil(target / 10))
  };
}

export function invertD100(value) {
  const normalized = Math.max(1, Math.min(100, Math.trunc(Number(value) || 1)));
  const digits = normalized === 100 ? "00" : String(normalized).padStart(2, "0");
  const inverted = Number(`${digits[1]}${digits[0]}`);
  return inverted === 0 ? 100 : inverted;
}
