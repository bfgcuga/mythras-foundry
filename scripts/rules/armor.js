import { armorDescriptors, resolveConditions } from "./condition-resolver.js";

export const ARMOR_REFERENCE_LOCATIONS = Object.freeze([
  "rightLeg", "leftLeg", "abdomen", "chest", "rightArm", "leftArm", "head", "special"
]);

const HUMAN_ARMOR_LOCATION_RANGES = Object.freeze({
  rightLeg: [1, 3],
  leftLeg: [4, 6],
  abdomen: [7, 9],
  chest: [10, 12],
  rightArm: [13, 15],
  leftArm: [16, 18],
  head: [19, 20]
});

export function armorLocationForReference(referenceLocation, locations = []) {
  const semantic = locations.find((location) =>
    location.system?.morphologyKey === "humanoid"
    && [location.system?.locationKey, location.system?.nameKey].includes(referenceLocation));
  if (semantic) return semantic;
  const range = HUMAN_ARMOR_LOCATION_RANGES[referenceLocation];
  if (!range) return null;
  return locations.find((location) => ["", "humanoid"].includes(
    String(location.system?.morphologyKey ?? ""))
    && Number(location.system?.rangeStart) === range[0]
    && Number(location.system?.rangeEnd) === range[1]) ?? null;
}

export const ARMOR_MATERIAL_MODIFIERS = Object.freeze({
  steel: 0.75,
  bronze: 1,
  shell: 2,
  leather: 2,
  iron: 1,
  bone: 1.5,
  linen: 1,
  ivory: 1.25,
  stone: 3,
  chitin: 0.75,
  silk: 0.75
});

export function armorPieceTypeForLocation(referenceLocation) {
  if (referenceLocation === "head") return "helmet";
  if (referenceLocation === "chest") return "cuirass";
  if (referenceLocation === "abdomen") return "skirt";
  if (["rightLeg", "leftLeg"].includes(referenceLocation)) return "greaves";
  if (["rightArm", "leftArm"].includes(referenceLocation)) return "bracers";
  return "other";
}

export function armorMaterialModifier(armor) {
  const system = armor?.system ?? armor ?? {};
  return ARMOR_MATERIAL_MODIFIERS[system.material]
    ?? Math.max(0, Number(system.materialModifier ?? 1));
}

export function armorCoversLocation(armor, location) {
  if (!armor?.system?.equipped) return false;
  const locationId = location?.id ?? location?._id;
  return Array.from(armor.system.coveredLocationIds ?? []).slice(0, 1).includes(locationId);
}

export function armorCoverageLocations(armor, locations) {
  const id = Array.from(armor?.system?.coveredLocationIds ?? [])[0];
  return id ? (locations ?? []).filter((location) => (location.id ?? location._id) === id) : [];
}

export function armorPieceEncumbrance(armor) {
  const system = armor?.system ?? armor ?? {};
  return Math.max(0, Number(system.baseEncumbrance ?? system.encumbrance ?? 0))
    * armorMaterialModifier(system);
}

function configuredLocationValues(system) {
  return Object.values(system.locationValues ?? {}).map(Number).filter((value) => value > 0);
}

export function armorPieceValue(armor) {
  const system = armor?.system ?? armor ?? {};
  const baseValue = Math.max(0, Number(system.baseValue ?? system.value ?? 0));
  const values = system.locationValues ?? {};
  if (system.referenceLocation === "special") {
    return Math.max(baseValue, ...configuredLocationValues(system), 0);
  }
  return Math.max(0, Number(values[system.referenceLocation] ?? 0)) || baseValue;
}

export function armorPhysicalTotals(armor, locations = []) {
  return {
    encumbranceFactor: armorMaterialModifier(armor),
    costPercentage: 100,
    encumbrance: armorPieceEncumbrance(armor),
    value: armorPieceValue(armor)
  };
}

// Mythras permite vestir varias capas en una localización. La CRG de todas se acumula,
// pero solo protege el valor de PA más alto.
export function armorEquipConflicts() {
  return [];
}

export function wornArmorPoints(location, armors = []) {
  return armors.reduce((highest, armor) => armorCoversLocation(armor, location)
    ? Math.max(highest, Math.max(0, Number(armor.system.armorPoints ?? 0)))
    : highest, 0);
}

export function totalArmorPoints(location, armors) {
  const natural = Math.max(0, Number(location?.system?.armorPoints ?? 0));
  return natural + wornArmorPoints(location, armors);
}

export function totalArmorEncumbrance(armors = []) {
  return armors.reduce((total, armor) => armor?.system?.equipped
    ? total + armorPieceEncumbrance(armor)
    : total, 0);
}

export function armorInitiativePenalty(armors = []) {
  const encumbrance = totalArmorEncumbrance(armors);
  return encumbrance > 0 ? Math.ceil(encumbrance / 5) : 0;
}

export function applyArmorInitiativePenalty(attributes, armors = []) {
  const penalty = armorInitiativePenalty(armors);
  return {
    ...resolveConditions({ baseAttributes: attributes,
      descriptors: armorDescriptors(penalty) }).attributes,
    armorEncumbrance: totalArmorEncumbrance(armors),
    armorInitiativePenalty: penalty
  };
}

export function armorFitsWearer(armor, wearer) {
  const system = armor?.system ?? armor ?? {};
  const designedSize = Math.max(0, Number(system.designedSize ?? 0));
  if (!designedSize) return true;
  const wearerSize = Math.max(0, Number(wearer?.system?.size ?? wearer?.size ?? 0));
  if (!wearerSize) return true;
  if (system.construction === "rigid" && wearerSize !== designedSize) return false;
  return Math.abs(wearerSize - designedSize) <= 1;
}
