export const HUMAN_HIT_LOCATIONS = Object.freeze([
  { nameKey: "rightLeg", rangeStart: 1, rangeEnd: 3, category: "limb", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 15 },
  { nameKey: "leftLeg", rangeStart: 4, rangeEnd: 6, category: "limb", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 15 },
  { nameKey: "abdomen", rangeStart: 7, rangeEnd: 9, category: "abdomen", hpClass: "abdomen", armorEncumbranceMultiplier: 2, armorCostPercentage: 20 },
  { nameKey: "chest", rangeStart: 10, rangeEnd: 12, category: "chest", hpClass: "chest", armorEncumbranceMultiplier: 3, armorCostPercentage: 25 },
  { nameKey: "rightArm", rangeStart: 13, rangeEnd: 15, category: "limb", hpClass: "arm", armorEncumbranceMultiplier: 1, armorCostPercentage: 7.5 },
  { nameKey: "leftArm", rangeStart: 16, rangeEnd: 18, category: "limb", hpClass: "arm", armorEncumbranceMultiplier: 1, armorCostPercentage: 7.5 },
  { nameKey: "head", rangeStart: 19, rangeEnd: 20, category: "head", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 10 }
]);

export function humanArmorFactors(location) {
  const system = location?.system ?? location ?? {};
  return HUMAN_HIT_LOCATIONS.find((candidate) =>
    Number(system.rangeStart) === candidate.rangeStart
    && Number(system.rangeEnd) === candidate.rangeEnd
    && system.category === candidate.category
    && system.hpClass === candidate.hpClass) ?? null;
}

export function woundLocationKind(location) {
  const human = humanArmorFactors(location);
  if (human) {
    const leg = human.nameKey.endsWith("Leg");
    const arm = human.nameKey.endsWith("Arm");
    return Object.freeze({ extremity: arm || leg, arm, leg,
      vital: ["abdomen", "chest", "head"].includes(human.nameKey) });
  }
  const system = location?.system ?? location ?? {};
  const description = `${system.category ?? ""} ${system.hpClass ?? ""}`.toLowerCase();
  const arm = /arm|brazo/.test(description);
  const leg = /leg|pierna/.test(description);
  const extremity = arm || leg || /limb|extremidad/.test(description);
  return Object.freeze({ extremity, arm, leg, vital: !extremity });
}

export function permanentWoundSeverity(previousSeverity = 0, roll = 0) {
  const previous = Math.max(0, Math.min(3, Math.floor(Number(previousSeverity) || 0)));
  if (previous >= 3) return 3;
  return Math.max(previous + 1, Math.max(1, Math.min(3, Math.floor(Number(roll) || 1))));
}

export function permanentWoundMaximum(originalMaximum, severity = 0) {
  const original = Math.max(1, Math.floor(Number(originalMaximum) || 1));
  const grade = Math.max(0, Math.min(3, Math.floor(Number(severity) || 0)));
  if (grade === 1) return Math.max(1, Math.ceil(original * 2 / 3));
  if (grade === 2) return Math.max(1, Math.ceil(original / 3));
  if (grade === 3) return 1;
  return original;
}

export function permanentWoundLostHitResults(location, severity = 0) {
  if (!woundLocationKind(location).extremity) return 0;
  const system = location?.system ?? location ?? {};
  const width = Math.max(0, Number(system.rangeEnd) - Number(system.rangeStart) + 1);
  const grade = Math.max(0, Math.min(3, Math.floor(Number(severity) || 0)));
  return grade ? Math.min(width, Math.ceil(width * grade / 3)) : 0;
}

export function permanentWoundState(location, { severity, roll = 0, description = "" } = {}) {
  const system = location?.system ?? location ?? {};
  const previous = system.permanentWound ?? {};
  const grade = permanentWoundSeverity(previous.severity, severity ?? roll);
  const original = Math.max(1, Number(previous.originalMaxHitPoints)
    || Number(system.maxHitPoints) || 1);
  const effective = permanentWoundMaximum(original, grade);
  return Object.freeze({ severity: grade, roll: Math.max(0, Math.min(3, Number(roll) || 0)),
    originalMaxHitPoints: original, effectiveMaxHitPoints: effective,
    lostHitResults: permanentWoundLostHitResults(location, grade),
    description: String(description || previous.description || "") });
}

export function effectiveHitLocationRange(location) {
  const system = location?.system ?? location ?? {};
  const lost = Math.max(0, Number(system.permanentWound?.lostHitResults) || 0);
  return Object.freeze({ start: Number(system.rangeStart) + lost, end: Number(system.rangeEnd) });
}

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

export function recoversDisabledLocation(location, nextHitPoints) {
  const system = location?.system ?? location ?? {};
  return Boolean(system.disabled)
    && Number(nextHitPoints) > Number(system.currentHitPoints ?? 0)
    && woundLevel(nextHitPoints, system.maxHitPoints) === "minor";
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
  return locations.find((location) => {
    const range = effectiveHitLocationRange(location);
    return value >= range.start && value <= range.end;
  }) ?? null;
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
        armorFactorsVersion: 2,
        disabled: false,
        permanentWound: { severity: 0, roll: 0, originalMaxHitPoints: 0,
          effectiveMaxHitPoints: 0, lostHitResults: 0, description: "" }
      }
    };
  });
}
