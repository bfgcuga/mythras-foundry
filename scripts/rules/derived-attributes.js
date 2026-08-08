export const CHARACTERISTIC_KEYS = [
  "strength",
  "constitution",
  "size",
  "dexterity",
  "intelligence",
  "power",
  "charisma"
];

function steppedValue(value, firstLimit, firstValue, step) {
  if (value <= firstLimit) return firstValue;
  return firstValue + Math.ceil((value - firstLimit) / step);
}

export function calculateActionPoints(intelligence, dexterity, rules = {}) {
  if (rules.method === "calculated") {
    const total = Math.max(0, Number(intelligence) || 0)
      + Math.max(0, Number(dexterity) || 0);
    return Math.max(1, Math.ceil(total / 12));
  }

  const fixedValue = Math.floor(Number(rules.fixedValue));
  return Number.isFinite(fixedValue) ? Math.max(1, fixedValue) : 2;
}

export function calculateExperienceModifier(charisma) {
  if (charisma <= 6) return -1;
  return steppedValue(charisma, 12, 0, 6);
}

export function calculateHealingRate(constitution) {
  return steppedValue(constitution, 6, 1, 6);
}

export function calculateLuckPoints(power) {
  return steppedValue(power, 6, 1, 6);
}

export function calculateInitiative(dexterity, intelligence) {
  return Math.ceil((dexterity + intelligence) / 2);
}

export function calculateMovementRate() {
  return 6;
}

export function calculateDamageModifier(strength, size) {
  const total = strength + size;
  const bands = [
    [5, -1, [[1, 8]]],
    [10, -1, [[1, 6]]],
    [15, -1, [[1, 4]]],
    [20, -1, [[1, 2]]],
    [25, 0, []],
    [30, 1, [[1, 2]]],
    [35, 1, [[1, 4]]],
    [40, 1, [[1, 6]]],
    [45, 1, [[1, 8]]],
    [50, 1, [[1, 10]]],
    [60, 1, [[1, 12]]],
    [70, 1, [[2, 6]]],
    [80, 1, [[1, 8], [1, 6]]],
    [90, 1, [[2, 8]]],
    [100, 1, [[1, 10], [1, 8]]],
    [110, 1, [[2, 10]]]
  ];

  const band = bands.find(([limit]) => total <= limit);
  if (band) return createDamageModifier(band[1], band[2]);

  const stepsAfterTwoD10 = Math.ceil((total - 110) / 10);
  const completeD10 = Math.floor(stepsAfterTwoD10 / 5);
  const remainder = stepsAfterTwoD10 % 5;
  const terms = [[2 + completeD10, 10]];
  if (remainder > 0) terms.push([1, remainder * 2]);
  return createDamageModifier(1, terms);
}

export function calculateDerivedAttributes(characteristics, actionPointRules) {
  return {
    actionPointsMax: calculateActionPoints(
      characteristics.intelligence,
      characteristics.dexterity,
      actionPointRules
    ),
    damageModifier: calculateDamageModifier(
      characteristics.strength,
      characteristics.size
    ),
    experienceModifier: calculateExperienceModifier(characteristics.charisma),
    healingRate: calculateHealingRate(characteristics.constitution),
    initiative: calculateInitiative(
      characteristics.dexterity,
      characteristics.intelligence
    ),
    luckPointsMax: calculateLuckPoints(characteristics.power),
    magicPointsMax: characteristics.power,
    movementRate: calculateMovementRate()
  };
}

function createDamageModifier(sign, terms) {
  const label = terms.length === 0
    ? "0"
    : `${sign > 0 ? "+" : "-"}${terms
      .map(([dice, faces]) => `${dice}d${faces}`)
      .join("+")}`;

  return {
    sign,
    terms: terms.map(([dice, faces]) => ({ dice, faces })),
    label
  };
}
