import { armorInitiativePenalty } from "./armor.js";
import { conditionDescriptors, resolveConditions } from "./condition-resolver.js";
import { encumbranceState, totalCarriedEncumbrance } from "./encumbrance.js";
import { worstWoundLevel } from "./hit-locations.js";
import { INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG,
  INCAPACITATED_STATUS_ID } from "./incapacitated.js";
import { activeStatusRules } from "./statuses.js";

const actorItems = (actor) => Array.from(actor?.items ?? []);

export function actorLoadState(actor) {
  const inventory = actorItems(actor).filter((item) =>
    ["equipment", "weapon", "armor"].includes(item.type));
  return encumbranceState(totalCarriedEncumbrance(inventory), actor?.system?.strength);
}

export function actorConditionState(actor, { fatigueKey = actor?.system?.fatigueLevel ?? "fresh",
  loadState = actorLoadState(actor) } = {}) {
  const items = actorItems(actor);
  const armors = items.filter((item) => item.type === "armor" && item.system?.equipped);
  return Object.freeze({
    fatigueKey,
    woundLevel: worstWoundLevel(items.filter((item) => item.type === "hitLocation")),
    manuallyIncapacitated: Boolean(actor?.getFlag?.(
      INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG)
      || actor?.statuses?.has?.(INCAPACITATED_STATUS_ID)),
    loadState,
    armorPenalty: armorInitiativePenalty(armors),
    statuses: activeStatusRules(actor?.statuses)
  });
}

export function resolveActorConditions(actor, { baseAttributes = actor?.system?.baseAttributes ?? {},
  baseDifficulty = "standard", physical = false, situational = false,
  fatigueKey = actor?.system?.fatigueLevel ?? "fresh", loadState } = {}) {
  const state = actorConditionState(actor, { fatigueKey,
    ...(loadState ? { loadState } : {}) });
  return resolveConditions({ baseAttributes, baseDifficulty, context: { physical, situational },
    descriptors: conditionDescriptors(state) });
}
