export const FATIGUE_LEVELS = Object.freeze([
  { key: "fresh", skillDifficulty: "standard", movement: "none", movementPenalty: 0, initiativePenalty: 0, actionPointPenalty: 0, recovery: "none" },
  { key: "winded", skillDifficulty: "hard", movement: "none", movementPenalty: 0, initiativePenalty: 0, actionPointPenalty: 0, recovery: "15minutes" },
  { key: "tired", skillDifficulty: "hard", movement: "subtract", movementPenalty: 1, initiativePenalty: 0, actionPointPenalty: 0, recovery: "3hours" },
  { key: "wearied", skillDifficulty: "formidable", movement: "subtract", movementPenalty: 2, initiativePenalty: 2, actionPointPenalty: 0, recovery: "6hours" },
  { key: "exhausted", skillDifficulty: "formidable", movement: "half", movementPenalty: 0, initiativePenalty: 4, actionPointPenalty: 1, recovery: "12hours" },
  { key: "debilitated", skillDifficulty: "herculean", movement: "half", movementPenalty: 0, initiativePenalty: 6, actionPointPenalty: 2, recovery: "18hours" },
  { key: "incapacitated", skillDifficulty: "herculean", movement: "immobile", movementPenalty: 0, initiativePenalty: 8, actionPointPenalty: 3, recovery: "24hours" },
  { key: "semiConscious", skillDifficulty: "impossible", movement: "impossible", movementPenalty: 0, initiativePenalty: 0, actionPointPenalty: 0, recovery: "36hours" },
  { key: "comatose", skillDifficulty: "impossible", movement: "impossible", movementPenalty: 0, initiativePenalty: 0, actionPointPenalty: 0, recovery: "48hours" },
  { key: "dead", skillDifficulty: "impossible", movement: "impossible", movementPenalty: 0, initiativePenalty: 0, actionPointPenalty: 0, recovery: "never" }
]);

const DIFFICULTY_ORDER = ["automatic", "veryEasy", "easy", "standard", "hard", "formidable", "herculean", "impossible"];

export function fatigueLevel(key) {
  return FATIGUE_LEVELS.find((level) => level.key === key) ?? FATIGUE_LEVELS[0];
}

export function combinedConditionLevel(fatigueKey, woundLevel = "healthy", incapacitated = false) {
  const fatigueIndex = Math.max(0, FATIGUE_LEVELS.findIndex((level) => level.key === fatigueKey));
  const woundIndex = woundLevel === "major" || incapacitated
    ? FATIGUE_LEVELS.findIndex((level) => level.key === "incapacitated")
    : 0;
  return FATIGUE_LEVELS[Math.max(fatigueIndex, woundIndex)] ?? FATIGUE_LEVELS[0];
}

export function combineDifficulties(left = "standard", right = "standard") {
  return DIFFICULTY_ORDER[Math.max(DIFFICULTY_ORDER.indexOf(left), DIFFICULTY_ORDER.indexOf(right))] ?? "standard";
}

export function worsenDifficulty(difficulty = "standard", steps = 1) {
  const index = Math.max(0, DIFFICULTY_ORDER.indexOf(difficulty));
  return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1,
    index + Math.max(0, Number(steps) || 0))];
}

export function applyFatigue(attributes, levelKey) {
  const level = fatigueLevel(levelKey);
  const impossible = level.movement === "impossible";
  const movementRate = level.movement === "half" ? Math.floor(attributes.movementRate / 2)
    : level.movement === "subtract" ? Math.max(0, attributes.movementRate - level.movementPenalty)
      : ["immobile", "impossible"].includes(level.movement) ? 0 : attributes.movementRate;
  return { ...attributes,
    movementRate,
    initiative: impossible ? 0 : Math.max(0, attributes.initiative - level.initiativePenalty),
    actionPointsMax: impossible ? 0 : Math.max(0, attributes.actionPointsMax - level.actionPointPenalty),
    fatigue: level };
}
