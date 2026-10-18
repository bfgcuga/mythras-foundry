import { UNARMED_WEAPON_SOURCE } from "../data/weapons.js";
import { styleIncludesWeapon } from "./combat.js";
import { hasTrait } from "./traits.js";
import { relationSituationReach, reachIndex } from "./engagements.js";

export const UNARMED_PROFILE = "puno-patada";
export function hasIntrinsicUnarmed(actor) {
  return ["character", "npc"].includes(actor?.type) && actor.system?.morphologyKey === "humanoid";
}
export function intrinsicUnarmedWeapon(actor, name = UNARMED_WEAPON_SOURCE.name) {
  if (!hasIntrinsicUnarmed(actor)) return null;
  const system = structuredClone(UNARMED_WEAPON_SOURCE.system);
  return { id: "", type: "weapon", intrinsicKey: UNARMED_PROFILE, name, actor,
    system: { ...system, equipped: true, activeModeKey: "unarmed" } };
}
export function unarmedAbilities(actor) {
  const weapon = intrinsicUnarmedWeapon(actor);
  if (!weapon) return [];
  const items = Array.from(actor.items ?? []);
  const styles = items.filter((item) => item.type === "combatStyle" && styleIncludesWeapon(item, weapon))
    .sort((a, b) => Number(b.system.total ?? 0) - Number(a.system.total ?? 0));
  return [...styles, ...items.filter((item) => item.type === "skill" && item.system.slug === "pelea")];
}
export function resolveUnarmedAbility(actor, selectedId) {
  const choices = unarmedAbilities(actor);
  const ability = selectedId ? choices.find((entry) => entry.id === selectedId) : choices[0];
  return { ability, style: ability?.type === "combatStyle" ? ability : null,
    target: Number(ability?.system.total ?? 0), difficulty: "standard",
    matching: choices.filter((entry) => entry.type === "combatStyle"),
    usesBase: ability?.type === "skill", familiarity: "included" };
}
export function unarmedParrySize(ability) {
  return ability?.type === "combatStyle" && hasTrait(ability, "maestria-sin-armas") ? "M" : "P";
}
// A neutral relationship describes no precise distance. Never infer Toque from it.
export function unarmedTouchState(relation, enabled = true) {
  if (!enabled || !relation || relation.status === "removed") return "unknown";
  if (relation.status !== "engaged") return "blocked";
  const sides = Object.values(relation.sides ?? {});
  if (sides.length !== 2 || sides.some((side) => reachIndex(side.reach) < 0)) return "unknown";
  const reach = relationSituationReach(relation);
  return reach === "T" ? "allowed" : reach === "—" ? "unknown" : "blocked";
}
