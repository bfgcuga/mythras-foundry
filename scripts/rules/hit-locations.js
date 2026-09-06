export const HUMAN_HIT_LOCATIONS = Object.freeze([
  { nameKey: "rightLeg", name: "Pierna derecha", rangeStart: 1, rangeEnd: 3, category: "limb", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 15 },
  { nameKey: "leftLeg", name: "Pierna izquierda", rangeStart: 4, rangeEnd: 6, category: "limb", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 15 },
  { nameKey: "abdomen", name: "Abdomen", rangeStart: 7, rangeEnd: 9, category: "abdomen", hpClass: "abdomen", armorEncumbranceMultiplier: 2, armorCostPercentage: 20 },
  { nameKey: "chest", name: "Pecho", rangeStart: 10, rangeEnd: 12, category: "chest", hpClass: "chest", armorEncumbranceMultiplier: 3, armorCostPercentage: 25 },
  { nameKey: "rightArm", name: "Brazo derecho", rangeStart: 13, rangeEnd: 15, category: "limb", hpClass: "arm", armorEncumbranceMultiplier: 1, armorCostPercentage: 7.5 },
  { nameKey: "leftArm", name: "Brazo izquierdo", rangeStart: 16, rangeEnd: 18, category: "limb", hpClass: "arm", armorEncumbranceMultiplier: 1, armorCostPercentage: 7.5 },
  { nameKey: "head", name: "Cabeza", rangeStart: 19, rangeEnd: 20, category: "head", hpClass: "standard", armorEncumbranceMultiplier: 1.5, armorCostPercentage: 10 }
]);

export const HUMAN_HIT_LOCATION_KEYS = Object.freeze(
  HUMAN_HIT_LOCATIONS.map((location) => location.nameKey)
);

const HUMAN_HIT_LOCATION_ALIASES = Object.freeze({
  rightLeg: ["pierna derecha", "right leg"],
  leftLeg: ["pierna izquierda", "left leg"],
  abdomen: ["abdomen"],
  chest: ["pecho", "chest"],
  rightArm: ["brazo derecho", "right arm"],
  leftArm: ["brazo izquierdo", "left arm"],
  head: ["cabeza", "head"]
});

const normalizedLocationName = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function genericHitLocationKey(location) {
  const storedKey = String(location?.system?.nameKey ?? location?.nameKey ?? "");
  if (HUMAN_HIT_LOCATION_KEYS.includes(storedKey)) return storedKey;
  const normalized = normalizedLocationName(location?.name);
  return HUMAN_HIT_LOCATION_KEYS.find((key) => HUMAN_HIT_LOCATION_ALIASES[key]
    .some((alias) => normalizedLocationName(alias) === normalized)) ?? null;
}

export function humanArmorFactors(location) {
  const system = location?.system ?? location ?? {};
  return HUMAN_HIT_LOCATIONS.find((candidate) =>
    Number(system.rangeStart) === candidate.rangeStart
    && Number(system.rangeEnd) === candidate.rangeEnd
    && system.category === candidate.category
    && system.hpClass === candidate.hpClass) ?? null;
}

export function humanHitLocationKey(location) {
  const human = humanArmorFactors(location);
  if (!human) return null;
  return genericHitLocationKey(location) === human.nameKey ? human.nameKey : null;
}

export function hitLocationDisplayName(location, localize = (key) => game.i18n.localize(key)) {
  const key = String(location?.system?.locationKey ?? location?.locationKey
    ?? location?.system?.nameKey ?? location?.nameKey ?? "");
  return key
    ? localize(`MYTHRASF.HitLocation.Name.${key}`)
    : String(location?.name ?? "");
}

export function hitLocationNameEditUpdate(location, submittedName,
  localize = (key) => game.i18n.localize(key)) {
  const submitted = String(submittedName ?? "");
  if (!location?.system?.locationKey && !location?.system?.nameKey) return { name: submitted };
  if (submitted === hitLocationDisplayName(location, localize)) {
    return { name: String(location.name ?? "") };
  }
  return { name: submitted, "system.nameKey": "", "system.locationKey": "",
    "system.morphologyKey": "custom" };
}

export function canonicalHumanHitLocationName(location) {
  const human = humanArmorFactors(location);
  if (!human) return null;
  return humanHitLocationKey(location) ? human.name : null;
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

export function isLocationDisabled(location) {
  const system = location?.system ?? location ?? {};
  return Boolean(system.disabled);
}

export function isLocationCrippled(location) {
  const system = location?.system ?? location ?? {};
  return Number(system.permanentWound?.severity ?? 0) > 0;
}

export function locationWoundState(location) {
  const system = location?.system ?? location ?? {};
  return woundLevel(system.currentHitPoints, system.maxHitPoints);
}

export function recoversDisabledLocation(location, nextHitPoints) {
  const system = location?.system ?? location ?? {};
  return isLocationDisabled(location)
    && Number(nextHitPoints) > Number(system.currentHitPoints ?? 0)
    && woundLevel(nextHitPoints, system.maxHitPoints) === "minor";
}

export function worstWoundLevel(locations) {
  const severity = { healthy: 0, minor: 1, serious: 2, major: 3 };
  return (locations ?? []).reduce((worst, location) => {
    const level = locationWoundState(location);
    return severity[level] > severity[worst] ? level : worst;
  }, "healthy");
}

export function woundPenaltyKey(level) {
  if (level === "serious") return "situationalDifficulty";
  if (level === "major") return "incapacitated";
  return "none";
}

export function hasSeriousWound(locations) {
  return (locations ?? []).some((location) => locationWoundState(location) === "serious");
}

export function permanentWoundHitCheck(location, roll) {
  const system = location?.system ?? location ?? {};
  const severity = Math.max(0, Math.min(3,
    Math.floor(Number(system.permanentWound?.severity) || 0)));
  if (!severity || !woundLocationKind(location).extremity) return true;
  return Number(roll) > severity;
}

export function findHitLocation(locations, roll, { ignorePermanentWounds = false } = {}) {
  const value = Number(roll);
  return locations.find((location) => {
    const system = location?.system ?? location ?? {};
    const range = ignorePermanentWounds
      ? { start: Number(system.rangeStart), end: Number(system.rangeEnd) }
      : effectiveHitLocationRange(location);
    return value >= range.start && value <= range.end;
  }) ?? null;
}

export function humanHitLocationData(actorSystem) {
  return HUMAN_HIT_LOCATIONS.map((location) => {
    const maximum = calculateLocationHitPoints(
      actorSystem?.constitution,
      actorSystem?.size,
      location.hpClass
    );
    return {
      name: location.name,
      type: "hitLocation",
      system: {
        morphologyKey: "humanoid",
        locationKey: location.nameKey,
        nameKey: location.nameKey,
        rangeStart: location.rangeStart,
        rangeEnd: location.rangeEnd,
        category: location.category,
        hpClass: location.hpClass,
        autoCalculate: true,
        maxHitPoints: maximum,
        currentHitPoints: maximum,
        armorPoints: 0,
        maxArmorPoints: 0,
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

export function hasBrokenHitLocationReference(item, locations = []) {
  const locationIds = new Set((locations ?? [])
    .filter((location) => location?.type === "hitLocation")
    .map((location) => location.id ?? location._id).filter(Boolean));
  const system = item?.system ?? {};
  if (item?.type === "armor") {
    return Array.from(system.coveredLocationIds ?? [])
      .some((locationId) => Boolean(locationId) && !locationIds.has(locationId));
  }
  return item?.type === "weapon" && system.durabilitySource === "hitLocation"
    && Boolean(system.linkedLocationId) && !locationIds.has(system.linkedLocationId);
}

export function restoredHumanHitLocationData(actorSystem, existingLocations = []) {
  const sources = humanHitLocationData(actorSystem);
  for (const source of sources) {
    const candidates = (existingLocations ?? []).filter((location) =>
      genericHitLocationKey(location) === source.system.nameKey);
    const wounded = candidates.sort((left, right) =>
      Number(right.system?.permanentWound?.severity ?? 0)
      - Number(left.system?.permanentWound?.severity ?? 0))[0];
    const severity = Number(wounded?.system?.permanentWound?.severity ?? 0);
    if (!severity) continue;
    const previous = wounded.system.permanentWound ?? {};
    const wound = permanentWoundState(source, {
      severity,
      roll: previous.roll,
      description: previous.description
    });
    source.system.permanentWound = wound;
    source.system.maxHitPoints = wound.effectiveMaxHitPoints;
    source.system.currentHitPoints = Math.min(
      Number(wounded.system.currentHitPoints ?? wound.effectiveMaxHitPoints),
      wound.effectiveMaxHitPoints
    );
    source.system.disabled = Boolean(wounded.system.disabled);
  }
  return sources;
}
