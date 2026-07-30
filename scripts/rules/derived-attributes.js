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

export function calculateActionPoints(intelligence, dexterity) {
  return steppedValue(intelligence + dexterity, 12, 1, 12);
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

export function calculateDamageModifier(strength, size) {
  const total = strength + size;
  const bands = [
    [5, -1, 1, 8],
    [10, -1, 1, 6],
    [15, -1, 1, 4],
    [20, -1, 1, 2],
    [25, 0, 0, 0],
    [30, 1, 1, 2],
    [35, 1, 1, 4],
    [40, 1, 1, 6],
    [45, 1, 1, 8],
    [50, 1, 1, 10],
    [60, 1, 1, 12]
  ];

  const band = bands.find(([limit]) => total <= limit);
  if (band) return createDamageModifier(...band.slice(1));

  const dice = 1 + Math.ceil((total - 60) / 10);
  return createDamageModifier(1, dice, 6);
}

export function calculateDerivedAttributes(characteristics) {
  return {
    actionPointsMax: calculateActionPoints(
      characteristics.intelligence,
      characteristics.dexterity
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
    magicPointsMax: characteristics.power
  };
}

function createDamageModifier(sign, dice, faces) {
  const label = dice === 0
    ? "0"
    : `${sign > 0 ? "+" : "-"}${dice}d${faces}`;

  return { sign, dice, faces, label };
}
