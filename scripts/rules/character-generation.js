export const POINT_ALLOCATION_TOTAL = 75;

export const CHARACTER_GENERATION_METHODS = Object.freeze([
  "random",
  "randomSwap",
  "points",
  "free"
]);

export const CHARACTERISTIC_MINIMUMS = {
  strength: 3,
  constitution: 3,
  size: 8,
  dexterity: 3,
  intelligence: 8,
  power: 3,
  charisma: 3
};

const THREE_D6_KEYS = new Set([
  "strength",
  "constitution",
  "dexterity",
  "power",
  "charisma"
]);
const TWO_D6_PLUS_SIX_KEYS = new Set(["size", "intelligence"]);

export function createMinimumAllocation() {
  return { ...CHARACTERISTIC_MINIMUMS };
}

export function initialAllocationForGenerationMethod(method, previousMethod = "") {
  if (method === "points") return createMinimumAllocation();
  if (method === "free" && !previousMethod) return createMinimumAllocation();
  return null;
}

export function calculateAllocationRemaining(characteristics) {
  const spent = Object.keys(CHARACTERISTIC_MINIMUMS)
    .reduce((total, key) => total + Number(characteristics[key] ?? 0), 0);
  return POINT_ALLOCATION_TOTAL - spent;
}

export function adjustPointAllocation(characteristics, key, delta) {
  const current = Number(characteristics[key] ?? 0);
  const minimum = CHARACTERISTIC_MINIMUMS[key];
  if (minimum === undefined) return current;

  if (delta < 0) return Math.max(minimum, current - 1);
  if (delta > 0 && calculateAllocationRemaining(characteristics) > 0) {
    return current + 1;
  }
  return current;
}

export function canSwapCharacteristics(first, second) {
  if (first === second) return false;
  return (
    (THREE_D6_KEYS.has(first) && THREE_D6_KEYS.has(second))
    || (TWO_D6_PLUS_SIX_KEYS.has(first) && TWO_D6_PLUS_SIX_KEYS.has(second))
  );
}
