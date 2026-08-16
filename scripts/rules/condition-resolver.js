const DIFFICULTY_ORDER = Object.freeze([
  "automatic", "veryEasy", "easy", "standard", "hard", "formidable", "herculean",
  "impossible"
]);

export const CONDITION_LEVELS = Object.freeze([
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

const conditionIndex = (key) => Math.max(0,
  CONDITION_LEVELS.findIndex((level) => level.key === key));

export function conditionLevel(key) {
  return CONDITION_LEVELS.find((level) => level.key === key) ?? CONDITION_LEVELS[0];
}

export function combineConditionDifficulties(left = "standard", right = "standard") {
  return DIFFICULTY_ORDER[Math.max(DIFFICULTY_ORDER.indexOf(left),
    DIFFICULTY_ORDER.indexOf(right))] ?? "standard";
}

export function increaseConditionDifficulty(difficulty = "standard", steps = 1) {
  const index = Math.max(0, DIFFICULTY_ORDER.indexOf(difficulty));
  return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1,
    index + Math.max(0, Number(steps) || 0))];
}

function descriptor(data) {
  return Object.freeze({ ...data, contexts: Object.freeze([...(data.contexts ?? [])]) });
}

export function fatigueDescriptor(fatigueKey = "fresh") {
  return descriptor({ id: `fatigue:${conditionLevel(fatigueKey).key}`, source: "fatigue",
    sourceKey: conditionLevel(fatigueKey).key, scope: "condition", operation: "floor",
    value: conditionLevel(fatigueKey).key });
}

export function woundDescriptors(woundLevel = "healthy") {
  if (woundLevel === "major") return [
    descriptor({ id: "wound:major", source: "wound", sourceKey: "major",
      scope: "condition", operation: "floor", value: "incapacitated" }),
    descriptor({ id: "wound:major:actions", source: "wound", sourceKey: "major",
      scope: "attribute", target: "actionPointsMax", operation: "zero", value: true }),
    descriptor({ id: "wound:major:attack", source: "wound", sourceKey: "major",
      scope: "capability", target: "canAttack", operation: "block", value: true })
  ];
  if (woundLevel === "serious") return [descriptor({ id: "wound:serious", source: "wound",
    sourceKey: "serious", scope: "difficulty", operation: "increase", value: 1,
    contexts: ["situational"] })];
  return [];
}

export function manualIncapacitatedDescriptors(active = false) {
  return active ? [descriptor({ id: "status:incapacitated-manual", source: "status",
    sourceKey: "incapacitatedManual", scope: "condition", operation: "floor",
    value: "incapacitated" }), descriptor({ id: "status:incapacitated-manual:actions",
    source: "status", sourceKey: "incapacitatedManual", scope: "attribute",
    target: "actionPointsMax", operation: "zero", value: true }),
  descriptor({ id: "status:incapacitated-manual:attack", source: "status",
    sourceKey: "incapacitatedManual", scope: "capability", target: "canAttack",
    operation: "block", value: true })] : [];
}

export function encumbranceDescriptors(loadState = {}) {
  const descriptors = [];
  const steps = Math.max(0, Number(loadState.difficultySteps) || 0);
  if (steps) descriptors.push(descriptor({ id: `encumbrance:${loadState.key ?? "loaded"}:difficulty`,
    source: "encumbrance", sourceKey: loadState.key ?? "loaded", scope: "difficulty",
    operation: "increase", value: steps, contexts: ["physical"] }));
  if (loadState.movement && loadState.movement !== "none") {
    descriptors.push(descriptor({ id: `encumbrance:${loadState.key ?? "loaded"}:movement`,
      source: "encumbrance", sourceKey: loadState.key ?? "loaded", scope: "attribute",
      target: "movementRate", operation: loadState.movement, value: 2 }));
  }
  return descriptors;
}

export function armorDescriptors(penalty = 0) {
  const value = Math.max(0, Number(penalty) || 0);
  return value ? [descriptor({ id: "armor:initiative", source: "armor", sourceKey: "equipped",
    scope: "attribute", target: "initiative", operation: "subtract", value })] : [];
}

export function statusDescriptors(statuses = []) {
  return Array.from(statuses).flatMap((status) => {
    const rules = [];
    if (status.skillDifficulty) rules.push(descriptor({ id: `status:${status.id}:difficulty`,
      source: "status", sourceKey: status.id, name: status.name, scope: "difficulty",
      operation: "floor", value: status.skillDifficulty }));
    if (status.zeroAttributes) rules.push(descriptor({ id: `status:${status.id}:attributes`,
      source: "status", sourceKey: status.id, name: status.name, scope: "attribute",
      operation: "zero", value: true }));
    if (status.zeroActionPoints) rules.push(descriptor({ id: `status:${status.id}:actions`,
      source: "status", sourceKey: status.id, name: status.name, scope: "attribute",
      target: "actionPointsMax", operation: "zero", value: true }));
    if (status.initiativePenalty) rules.push(descriptor({ id: `status:${status.id}:initiative`,
      source: "status", sourceKey: status.id, name: status.name, scope: "attribute",
      target: "initiative", operation: "subtract", value: status.initiativePenalty }));
    if (status.canAttack === false) rules.push(descriptor({ id: `status:${status.id}:attack`,
      source: "status", sourceKey: status.id, name: status.name, scope: "capability",
      target: "canAttack", operation: "block", value: true }));
    if (status.canDefend === false) rules.push(descriptor({ id: `status:${status.id}:defend`,
      source: "status", sourceKey: status.id, name: status.name, scope: "capability",
      target: "canDefend", operation: "block", value: true }));
    if (status.canTakeProactiveTurn === false) rules.push(descriptor({
      id: `status:${status.id}:proactive`, source: "status", sourceKey: status.id,
      name: status.name, scope: "capability", target: "canTakeProactiveTurn",
      operation: "block", value: true }));
    if (!rules.length) rules.push(descriptor({ id: `status:${status.id}:informational`,
      source: "status", sourceKey: status.id, name: status.name, scope: "information",
      operation: "none", value: null }));
    return rules;
  });
}

export function conditionDescriptors({ fatigueKey = "fresh", woundLevel = "healthy",
  manuallyIncapacitated = false, loadState = {}, armorPenalty = 0, statuses = [] } = {}) {
  return Object.freeze([
    fatigueDescriptor(fatigueKey),
    ...woundDescriptors(woundLevel),
    ...manualIncapacitatedDescriptors(manuallyIncapacitated),
    ...encumbranceDescriptors(loadState),
    ...armorDescriptors(armorPenalty),
    ...statusDescriptors(statuses)
  ]);
}

function contextApplies(rule, context) {
  return rule.contexts.length === 0 || rule.contexts.every((key) => Boolean(context[key]));
}

function applyMovement(value, rule) {
  if (rule.operation === "half") return Math.floor(value / 2);
  if (rule.operation === "subtract") return Math.max(0, value - Math.max(0, Number(rule.value) || 0));
  if (["immobile", "impossible"].includes(rule.operation)) return 0;
  return value;
}

function applyConditionAttributes(baseAttributes, level) {
  const impossible = level.movement === "impossible";
  const attributes = { ...baseAttributes };
  if (Object.hasOwn(baseAttributes, "movementRate")) attributes.movementRate =
    level.movement === "half" ? Math.floor(Number(baseAttributes.movementRate ?? 0) / 2)
      : level.movement === "subtract" ? Math.max(0,
        Number(baseAttributes.movementRate ?? 0) - level.movementPenalty)
        : ["immobile", "impossible"].includes(level.movement) ? 0
          : Number(baseAttributes.movementRate ?? 0);
  if (Object.hasOwn(baseAttributes, "initiative")) attributes.initiative = impossible ? 0
    : Math.max(0, Number(baseAttributes.initiative ?? 0) - level.initiativePenalty);
  if (Object.hasOwn(baseAttributes, "actionPointsMax")) attributes.actionPointsMax = impossible ? 0
    : Math.max(0, Number(baseAttributes.actionPointsMax ?? 0) - level.actionPointPenalty);
  return attributes;
}

export function resolveConditions({ baseAttributes = {}, descriptors = [], context = {},
  baseDifficulty = "standard" } = {}) {
  const active = descriptors.filter((rule) => contextApplies(rule, context));
  const conditionRules = descriptors.filter((rule) => rule.scope === "condition");
  const effectiveCondition = conditionRules.reduce((level, rule) =>
    conditionIndex(rule.value) > conditionIndex(level.key) ? conditionLevel(rule.value) : level,
  conditionLevel("fresh"));
  const difficultyFloor = descriptors.filter((rule) => rule.scope === "difficulty"
    && rule.operation === "floor").reduce((difficulty, rule) =>
    combineConditionDifficulties(difficulty, rule.value), effectiveCondition.skillDifficulty);
  const difficulty = active.filter((rule) => rule.scope === "difficulty"
    && rule.operation === "increase").reduce((value, rule) =>
    increaseConditionDifficulty(value, rule.value),
  combineConditionDifficulties(baseDifficulty, difficultyFloor));

  let attributes = applyConditionAttributes(baseAttributes, effectiveCondition);
  for (const rule of descriptors.filter((entry) => entry.scope === "attribute"
    && entry.operation !== "zero")) {
    if (rule.target === "movementRate") attributes.movementRate = applyMovement(
      Number(attributes.movementRate ?? 0), rule);
    if (rule.operation === "subtract" && rule.target !== "movementRate") {
      attributes[rule.target] = Math.max(0,
        Number(attributes[rule.target] ?? 0) - Math.max(0, Number(rule.value) || 0));
    }
  }
  if (descriptors.some((rule) => rule.scope === "attribute" && rule.operation === "zero"
    && !rule.target)) {
    attributes = Object.fromEntries(Object.entries(attributes).map(([key, value]) => {
      if (key === "damageModifier") return [key, typeof value === "string"
        ? "0" : { sign: 0, terms: [], label: "0" }];
      return [key, typeof value === "number" ? 0 : value];
    }));
  }
  for (const rule of descriptors.filter((entry) => entry.scope === "attribute"
    && entry.operation === "zero" && entry.target)) attributes[rule.target] = 0;

  return Object.freeze({
    descriptors: Object.freeze([...descriptors]), applied: Object.freeze([...active]),
    condition: effectiveCondition, attributes: Object.freeze({ ...attributes }), difficulty,
    difficulties: Object.freeze({
      general: difficultyForBase(descriptors, effectiveCondition, baseDifficulty, {}),
      physical: difficultyForBase(descriptors, effectiveCondition, baseDifficulty, { physical: true }),
      situational: difficultyForBase(descriptors, effectiveCondition, baseDifficulty, { situational: true }),
      combined: difficultyForBase(descriptors, effectiveCondition, baseDifficulty,
        { physical: true, situational: true })
    }),
    capabilities: Object.freeze(Object.fromEntries(["canAttack", "canDefend",
      "canTakeProactiveTurn"].map((capability) => [capability, !descriptors.some((rule) =>
      rule.scope === "capability" && rule.target === capability
      && rule.operation === "block")])))
  });
}

function difficultyForBase(descriptors, effectiveCondition, baseDifficulty, context) {
  const floor = descriptors.filter((rule) => rule.scope === "difficulty"
    && rule.operation === "floor").reduce((difficulty, rule) =>
    combineConditionDifficulties(difficulty, rule.value), effectiveCondition.skillDifficulty);
  return descriptors.filter((rule) => rule.scope === "difficulty"
    && rule.operation === "increase" && contextApplies(rule, context)).reduce((difficulty, rule) =>
    increaseConditionDifficulty(difficulty, rule.value), combineConditionDifficulties(baseDifficulty, floor));
}
