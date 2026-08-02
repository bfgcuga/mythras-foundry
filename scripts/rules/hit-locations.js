export const HUMAN_HIT_LOCATIONS = Object.freeze([
  { nameKey: "rightLeg", rangeStart: 1, rangeEnd: 3, category: "limb", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 15 },
  { nameKey: "leftLeg", rangeStart: 4, rangeEnd: 6, category: "limb", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 15 },
  { nameKey: "abdomen", rangeStart: 7, rangeEnd: 9, category: "abdomen", hpClass: "abdomen", armorEncumbranceMultiplier: 2, armorCostPercentage: 20 },
  { nameKey: "chest", rangeStart: 10, rangeEnd: 12, category: "chest", hpClass: "chest", armorEncumbranceMultiplier: 3, armorCostPercentage: 30 },
  { nameKey: "rightArm", rangeStart: 13, rangeEnd: 15, category: "limb", hpClass: "arm", armorEncumbranceMultiplier: 1, armorCostPercentage: 10 },
  { nameKey: "leftArm", rangeStart: 16, rangeEnd: 18, category: "limb", hpClass: "arm", armorEncumbranceMultiplier: 1, armorCostPercentage: 10 },
  { nameKey: "head", rangeStart: 19, rangeEnd: 20, category: "head", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 15 }
]);

export function calculateLocationHitPoints(constitution, size, hpClass = "standard") {
  const band = Math.max(1, Math.ceil((Number(constitution) + Number(size)) / 5));
  const offsets = { arm: -1, standard: 0, abdomen: 1, chest: 2 };
  return Math.max(1, band + (offsets[hpClass] ?? 0));
}

export function woundLevel(current, maximum) {
  const value = Number(current ?? 0);
  const max = Math.max(1, Number(maximum ?? 1));
  if (value >= max) return "healthy";
  if (value > 0) return "minor";
  if (value > -max) return "serious";
  return "major";
}

export function worstWoundLevel(locations) {
  const severity = { healthy: 0, minor: 1, serious: 2, major: 3 };
  return (locations ?? []).reduce((worst, location) => {
    const system = location?.system ?? location ?? {};
    const level = woundLevel(system.currentHitPoints, system.maxHitPoints);
    return severity[level] > severity[worst] ? level : worst;
  }, "healthy");
}

export function woundPenaltyKey(level) {
  if (level === "serious") return "situationalDifficulty";
  if (level === "major") return "incapacitated";
  return "none";
}

export function hasSeriousWound(locations) {
  return (locations ?? []).some((location) => {
    const system = location?.system ?? location ?? {};
    return woundLevel(system.currentHitPoints, system.maxHitPoints) === "serious";
  });
}

export function findHitLocation(locations, roll) {
  const value = Number(roll);
  return locations.find((location) => value >= Number(location.system.rangeStart)
    && value <= Number(location.system.rangeEnd)) ?? null;
}

export function humanHitLocationData(actorSystem, localize = (key) => key) {
  return HUMAN_HIT_LOCATIONS.map((location) => {
    const maximum = calculateLocationHitPoints(
      actorSystem?.constitution,
      actorSystem?.size,
      location.hpClass
    );
    return {
      name: localize(`MYTHRASF.HitLocation.Name.${location.nameKey}`),
      type: "hitLocation",
      system: {
        rangeStart: location.rangeStart,
        rangeEnd: location.rangeEnd,
        category: location.category,
        hpClass: location.hpClass,
        autoCalculate: true,
        maxHitPoints: maximum,
        currentHitPoints: maximum,
        armorPoints: 0,
        armorEncumbranceMultiplier: location.armorEncumbranceMultiplier,
        armorCostPercentage: location.armorCostPercentage,
        disabled: false
      }
    };
  });
}
