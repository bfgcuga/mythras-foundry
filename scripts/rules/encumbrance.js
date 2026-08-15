import { armorPieceEncumbrance } from "./armor.js";
import { inventoryCarried } from "./inventory.js";
import { encumbranceDescriptors, resolveConditions } from "./condition-resolver.js";

export const ENCUMBRANCE_STATES = Object.freeze({
  unencumbered: { key: "unencumbered", difficultySteps: 0, movement: "none", effort: "none" },
  loaded: { key: "loaded", difficultySteps: 1, movement: "subtract", effort: "moderate" },
  overloaded: { key: "overloaded", difficultySteps: 2, movement: "half", effort: "strenuous" },
  excess: { key: "excess", difficultySteps: 2, movement: "half", effort: "strenuous" }
});

export function itemEncumbrance(item) {
  const quantity = Math.max(0, Number(item?.system?.quantity ?? 1));
  if (item?.type === "armor") {
    return armorPieceEncumbrance(item) * (item.system?.equipped ? 0.5 : 1) * quantity;
  }
  const unit = item?.type === "weapon"
    ? Number(item.system?.encumbrance ?? item.system?.weight ?? 0)
    : Number(item?.system?.weight ?? item?.system?.encumbrance ?? 0);
  return Math.max(0, unit) * quantity;
}

export function totalCarriedEncumbrance(items = []) {
  const carried = items.filter((item) => inventoryCarried(item, items));
  const positive = carried.reduce((total, item) => total + itemEncumbrance(item), 0);
  const zeroItems = carried.reduce((total, item) => itemEncumbrance(item) === 0
    ? total + Math.max(0, Number(item.system?.quantity ?? 1)) : total, 0);
  return positive + Math.floor(zeroItems / 20);
}

export function encumbranceState(encumbrance, strength) {
  const total = Math.max(0, Number(encumbrance ?? 0));
  const str = Math.max(0, Number(strength ?? 0));
  const maximum = str * 4;
  const state = total > maximum ? ENCUMBRANCE_STATES.excess
    : total > str * 3 ? ENCUMBRANCE_STATES.overloaded
      : total > str * 2 ? ENCUMBRANCE_STATES.loaded
        : ENCUMBRANCE_STATES.unencumbered;
  return { ...state, total, easyLimit: str * 2, overloadedLimit: str * 3, maximum };
}

export function applyEncumbrance(attributes, state) {
  return { ...resolveConditions({ baseAttributes: attributes,
    descriptors: encumbranceDescriptors(state) }).attributes, encumbrance: state };
}

export function skillUsesStrengthOrDexterity(skill) {
  if (skill?.type === "combatStyle") return true;
  return [skill?.system?.characteristic1, skill?.system?.characteristic2]
    .some((key) => ["strength", "dexterity"].includes(key));
}
