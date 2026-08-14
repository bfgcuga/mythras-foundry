import { applyEncumbrance } from "./encumbrance.js";
import { applyFatigue, combinedConditionLevel, combineDifficulties, fatigueLevel,
  worsenDifficulty } from "./fatigue.js";

export function penaltySummary({ baseAttributes = {}, fatigueKey = "fresh",
  woundLevel = "healthy", manuallyIncapacitated = false, skillStatuses = [],
  activeStatuses = skillStatuses, loadState = {}, armorPenalty = 0, unconscious = false } = {}) {
  const fatigue = fatigueLevel(fatigueKey);
  const condition = combinedConditionLevel(fatigue.key, woundLevel, manuallyIncapacitated);
  const fatigueAttributes = applyFatigue(baseAttributes, fatigue.key);
  const conditionedAttributes = applyFatigue(baseAttributes, condition.key);
  const loadedAttributes = applyEncumbrance(conditionedAttributes, loadState);
  const loadSteps = Math.max(0, Number(loadState.difficultySteps) || 0);
  const seriousWoundSteps = woundLevel === "serious" ? 1 : 0;
  const generalDifficulty = skillStatuses.reduce(
    (difficulty, status) => combineDifficulties(difficulty, status.skillDifficulty),
    condition.skillDifficulty
  );
  const physicalDifficulty = worsenDifficulty(generalDifficulty, loadSteps);
  const situationalDifficulty = worsenDifficulty(generalDifficulty, seriousWoundSteps);
  const combinedDifficulty = worsenDifficulty(physicalDifficulty, seriousWoundSteps);
  const initiative = Math.max(0,
    Number(conditionedAttributes.initiative ?? 0) - Math.max(0, Number(armorPenalty) || 0));

  return {
    rows: {
      fatigue: {
        difficulty: fatigue.skillDifficulty,
        movement: fatigue.movement,
        movementPenalty: fatigue.movementPenalty,
        movementEffective: fatigueAttributes.movementRate,
        initiativePenalty: fatigue.initiativePenalty,
        actionPointPenalty: fatigue.actionPointPenalty
      },
      wounds: {
        level: woundLevel,
        situationalSteps: seriousWoundSteps,
        incapacitated: woundLevel === "major"
      },
      encumbrance: {
        key: loadState.key ?? "unencumbered",
        difficultySteps: loadSteps,
        movement: loadState.movement ?? "none"
      },
      armor: { initiativePenalty: Math.max(0, Number(armorPenalty) || 0) },
      status: { manuallyIncapacitated, skillStatuses, activeStatuses }
    },
    totals: {
      difficulties: {
        general: generalDifficulty,
        physical: physicalDifficulty,
        situational: situationalDifficulty,
        combined: combinedDifficulty,
        hasPhysicalVariant: physicalDifficulty !== generalDifficulty,
        hasSituationalVariant: situationalDifficulty !== generalDifficulty
      },
      movement: {
        base: Number(baseAttributes.movementRate ?? 0),
        effective: unconscious ? 0 : Number(loadedAttributes.movementRate ?? 0)
      },
      initiative: {
        base: Number(baseAttributes.initiative ?? 0),
        effective: unconscious ? 0 : initiative
      },
      actionPoints: {
        base: Number(baseAttributes.actionPointsMax ?? 0),
        effective: unconscious ? 0 : Number(conditionedAttributes.actionPointsMax ?? 0)
      }
    }
  };
}
