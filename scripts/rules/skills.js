export function calculateSkillValues(system, characteristics = {}) {
  if (system.valueMode === "manual") {
    const total = Math.max(0, Number(system.manualValue ?? 0));
    return {
      base: total,
      bonus: 0,
      total,
      experienceImprovementBonus: system.fumbled ? 1 : 0
    };
  }

  const first = Number(characteristics[system.characteristic1] ?? 0);
  const second = Number(characteristics[system.characteristic2] ?? 0);
  const base = first + second + Number(system.baseBonus ?? 0);
  const bonus = [
    system.culturePoints,
    system.professionPoints,
    system.freePoints,
    system.experiencePoints
  ].reduce((total, value) => total + Number(value ?? 0), 0);

  return {
    base,
    bonus,
    total: base + bonus,
    experienceImprovementBonus: system.fumbled ? 1 : 0
  };
}

export function resolveExperienceImprovement({
  skillTotal,
  intelligence,
  checkRoll,
  improvementRoll = 0,
  fumbled = false
}) {
  const modifiedRoll = Number(checkRoll) + Number(intelligence ?? 0);
  const succeeded = modifiedRoll >= Number(skillTotal);
  const rolledIncrease = succeeded ? Number(improvementRoll) + 1 : 1;
  const fumbleBonus = fumbled ? 1 : 0;

  return {
    modifiedRoll,
    succeeded,
    rolledIncrease,
    fumbleBonus,
    increase: rolledIncrease + fumbleBonus
  };
}

export const NEW_SKILL_EXPERIENCE_COST = 3;

export function skillAcquisition({ experienceRolls, editMode = false }) {
  const cost = editMode ? 0 : NEW_SKILL_EXPERIENCE_COST;
  const available = Math.max(0, Number(experienceRolls ?? 0));
  return {
    cost,
    available,
    allowed: editMode || available >= cost
  };
}

export function fumbledSkillUpdatesAtZero(experienceRolls, items = []) {
  if (Number(experienceRolls ?? 0) !== 0) return [];
  return items
    .filter((item) => ["skill", "combatStyle"].includes(item.type) && item.system?.fumbled)
    .map((item) => ({ _id: item.id, "system.fumbled": false }));
}
