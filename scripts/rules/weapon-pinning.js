import { applyStrengthContestPenalties } from "./strength-contests.js";
import { weaponHandsRequired } from "./equipment.js";
import { applySharedOver100Penalty, compareOpposed } from "./contest-rolls.js";

export const PIN_SCOPE = "mythras-foundry";
export function weaponPinData(effect) {
  return effect?.getFlag?.(PIN_SCOPE, "timedCondition")
    ?? effect?.flags?.[PIN_SCOPE]?.timedCondition;
}
export function weaponPins(actor) {
  return Array.from(actor?.effects ?? []).filter((effect) => !effect.disabled
    && weaponPinData(effect)?.key === "weaponPinned"
    && actor.items?.get?.(weaponPinData(effect).weaponId)?.type === "weapon");
}
export function weaponIsPinned(weapon, actor = weapon?.actor ?? weapon?.parent) {
  return Boolean(weapon && weaponPins(actor).some((effect) =>
    weaponPinData(effect).weaponId === weapon.id));
}
export function pinnableWeapons(actor) {
  return actor?.items?.filter((item) => item.type === "weapon" && item.system.equipped
    && weaponHandsRequired(item) > 0 && !weaponIsPinned(item, actor)) ?? [];
}
export function releaseWeaponSkills(actor) {
  return actor?.items?.filter((item) => item.type === "skill"
    && ["musculo", "pelea"].includes(item.system.slug)) ?? [];
}
export function resolveWeaponRelease(victim, holder) {
  const adjusted = applySharedOver100Penalty(applyStrengthContestPenalties([{ ...victim, id: "victim" },
    { ...holder, id: "holder" }]));
  return { victim: adjusted.participants[0], holder: adjusted.participants[1],
    freed: compareOpposed(...adjusted.participants).winnerId === "victim" };
}
export async function clearWeaponPinsBetween(left, right) {
  if (!left || !right) return;
  for (const [actor, source] of [[left, right], [right, left]]) {
    const ids = weaponPins(actor).filter((effect) =>
      weaponPinData(effect).sourceActorUuid === source.uuid).map((effect) => effect.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
}
