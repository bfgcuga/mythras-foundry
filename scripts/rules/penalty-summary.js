import { conditionDescriptors, conditionLevel, resolveConditions } from "./condition-resolver.js";

export function penaltySummary({ baseAttributes = {}, fatigueKey = "fresh",
  woundLevel = "healthy", manuallyIncapacitated = false, skillStatuses = [],
  activeStatuses = skillStatuses, loadState = {}, armorPenalty = 0, unconscious = false } = {}) {
  const fatigue = conditionLevel(fatigueKey);
  const loadSteps = Math.max(0, Number(loadState.difficultySteps) || 0);
  const seriousWoundSteps = woundLevel === "serious" ? 1 : 0;
  const statusRules = activeStatuses.map((status) => ({ ...status,
    zeroAttributes: status.zeroAttributes || (unconscious && status.id === "unconscious") }));
  if (unconscious && !statusRules.some((status) => status.id === "unconscious")) {
    statusRules.push({ id: "unconscious", skillDifficulty: "impossible", zeroAttributes: true,
      canAttack: false });
  }
  const descriptors = conditionDescriptors({ fatigueKey: fatigue.key, woundLevel,
    manuallyIncapacitated, loadState, armorPenalty, statuses: statusRules.length
      ? statusRules : skillStatuses });
  const resolution = resolveConditions({ baseAttributes, descriptors });
  const fatigueResolution = resolveConditions({ baseAttributes,
    descriptors: conditionDescriptors({ fatigueKey: fatigue.key }) });

  return {
    rows: {
      fatigue: {
        difficulty: fatigue.skillDifficulty,
        movement: fatigue.movement,
        movementPenalty: fatigue.movementPenalty,
        movementEffective: fatigueResolution.attributes.movementRate,
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
        ...resolution.difficulties,
        hasPhysicalVariant: resolution.difficulties.physical !== resolution.difficulties.general,
        hasSituationalVariant: resolution.difficulties.situational !== resolution.difficulties.general
      },
      movement: {
        base: Number(baseAttributes.movementRate ?? 0),
        effective: Number(resolution.attributes.movementRate ?? 0)
      },
      initiative: {
        base: Number(baseAttributes.initiative ?? 0),
        effective: Number(resolution.attributes.initiative ?? 0)
      },
      actionPoints: {
        base: Number(baseAttributes.actionPointsMax ?? 0),
        effective: Number(resolution.attributes.actionPointsMax ?? 0)
      }
    }
  };
}
