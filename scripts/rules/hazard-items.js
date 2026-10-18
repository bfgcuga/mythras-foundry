import { resolveContest } from "./contest-rolls.js";

export const HAZARD_ITEM_TYPES = Object.freeze(["trap", "poison", "disease"]);
export const TRAP_DAMAGE_TABLE = Object.freeze([
  [1, 10, "1d2", "P"], [11, 20, "1d4", "P"],
  [21, 30, "1d6", "M"], [31, 40, "1d8", "M"],
  [41, 50, "1d10", "G"], [51, 60, "2d6", "G"],
  [61, 70, "1d8+1d6", "E"], [71, 80, "2d8", "E"],
  [81, 90, "1d10+1d8", "D"], [91, 100, "2d10", "D"]
]);

// This table is a reference, never a clamp: traps above 100% and unusual
// effects remain editable rather than inventing rules beyond the source.
export function trapDamageReference(skill) {
  return TRAP_DAMAGE_TABLE.find(([minimum, maximum]) => skill >= minimum && skill <= maximum) ?? null;
}

export function resolveHazardContest({ actorTarget, hazardTarget, actorRoll, hazardRoll }) {
  return resolveContest({ type: "opposed", initiatorId: "actor", participants: [
    { id: "actor", target: actorTarget, rawRoll: actorRoll },
    { id: "hazard", target: hazardTarget, rawRoll: hazardRoll }
  ] });
}

export function hazardProfile(item, variantIndex = -1) {
  const system = item.system ?? {};
  const variant = system.variants?.[variantIndex];
  return variant ? { ...system, ...variant, stages: system.stages ?? [] } : system;
}

export function hazardActors(worldActors = [], tokens = []) {
  const candidates = [...tokens.map((token) => token.actor), ...worldActors];
  return [...new Map(candidates.filter((actor) => actor
    && ["character", "npc"].includes(actor.type) && actor.isOwner)
    .map((actor) => [actor.uuid, actor])).values()];
}
