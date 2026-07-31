export const PASSION_VERBS = Object.freeze([
  "love", "support", "torment", "seek", "trust", "despise", "destroy",
  "desire", "loyalty", "hate", "preserve", "protect", "renounce",
  "repudiate", "respect", "subvert", "fear", "other"
]);

export const PASSION_OBJECT_TYPES = Object.freeze([
  "person", "organization", "species", "place", "object", "ideal"
]);

export function calculatePassionBase(objectType, characteristics = {}) {
  const power = Number(characteristics.power ?? 0);
  const charisma = Number(characteristics.charisma ?? 0);
  const intelligence = Number(characteristics.intelligence ?? 0);
  switch (objectType) {
    case "person": return power + charisma;
    case "organization":
    case "place":
    case "ideal": return power + intelligence;
    case "species":
    case "object": return power * 2;
    default: return 0;
  }
}

export function calculatePassionValues(system = {}, characteristics = {}) {
  if (!system.structured) {
    const total = Math.max(0, Number(system.value ?? 0));
    return { base: 0, bonus: total, total, legacy: true };
  }
  const base = calculatePassionBase(system.objectType, characteristics);
  const bonus = [
    system.creationBonus,
    system.experiencePoints,
    system.manualAdjustment
  ].reduce((sum, value) => sum + Number(value ?? 0), 0);
  return { base, bonus, total: Math.max(0, base + bonus), legacy: false };
}
