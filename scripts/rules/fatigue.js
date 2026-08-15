import { combineConditionDifficulties, CONDITION_LEVELS, conditionDescriptors, conditionLevel,
  increaseConditionDifficulty, resolveConditions } from "./condition-resolver.js";

export const FATIGUE_LEVELS = CONDITION_LEVELS;

export function fatigueLevel(key) {
  return conditionLevel(key);
}

export function combinedConditionLevel(fatigueKey, woundLevel = "healthy", incapacitated = false) {
  return resolveConditions({ descriptors: conditionDescriptors({ fatigueKey, woundLevel,
    manuallyIncapacitated: incapacitated }) }).condition;
}

export function combineDifficulties(left = "standard", right = "standard") {
  return combineConditionDifficulties(left, right);
}

export function worsenDifficulty(difficulty = "standard", steps = 1) {
  return increaseConditionDifficulty(difficulty, steps);
}

export function applyFatigue(attributes, levelKey) {
  const level = fatigueLevel(levelKey);
  return { ...resolveConditions({ baseAttributes: attributes,
    descriptors: conditionDescriptors({ fatigueKey: level.key }) }).attributes, fatigue: level };
}
