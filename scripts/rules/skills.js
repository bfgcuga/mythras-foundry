export function calculateSkillValues(system, characteristics = {}) {
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
    total: base + bonus
  };
}
