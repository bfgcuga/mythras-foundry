import { woundLocationKind } from "./hit-locations.js";

export const ENTANGLEMENT_SCOPE = "mythras-foundry";

export function entanglementData(effect) {
  const condition = effect?.getFlag?.(ENTANGLEMENT_SCOPE, "timedCondition")
    ?? effect?.flags?.[ENTANGLEMENT_SCOPE]?.timedCondition;
  return condition?.key === "entangled" ? condition : null;
}

export function activeEntanglements(actor) {
  return Array.from(actor?.effects ?? []).filter((effect) =>
    !effect.disabled && Boolean(entanglementData(effect)));
}

export function entanglementKind(location) {
  const kind = woundLocationKind(location);
  const identity = `${location?.system?.locationKey ?? ""} ${location?.system?.nameKey ?? ""} ${
    location?.name ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (kind.arm) return "arm";
  if (kind.leg) return "leg";
  if (/arm|brazo/.test(identity)) return "arm";
  if (/leg|pierna/.test(identity)) return "leg";
  return "vital";
}

export function entangledLocationIds(actor) {
  return new Set(activeEntanglements(actor).map((effect) =>
    entanglementData(effect).locationId).filter(Boolean));
}

export function entangledWeapons(actor) {
  const ids = new Set(activeEntanglements(actor).map((effect) =>
    entanglementData(effect).weaponId).filter(Boolean));
  return Array.from(ids).map((id) => actor?.items?.get?.(id)).filter((item) =>
    item?.type === "weapon" || item?.type === "equipment");
}

export function weaponIsEntangled(weapon, actor = weapon?.actor ?? weapon?.parent) {
  return Boolean(weapon && activeEntanglements(actor).some((effect) =>
    entanglementData(effect).weaponId === weapon.id));
}

export function actorIsRooted(actor) {
  return activeEntanglements(actor).some((effect) => entanglementData(effect).kind === "leg");
}

export function actorHasVitalEntanglement(actor) {
  return activeEntanglements(actor).some((effect) => entanglementData(effect).kind === "vital");
}

export function entanglementSources(actor) {
  return activeEntanglements(actor).map((effect) => ({ effect,
    ...entanglementData(effect) }));
}

export function entanglementsHeldBy(source, actors = []) {
  return actors.flatMap((actor) => entanglementSources(actor)
    .filter((entry) => entry.sourceActorUuid === source?.uuid)
    .map((entry) => ({ ...entry, actor })));
}

export async function clearEntanglements(actor, predicate = () => true) {
  const ids = entanglementSources(actor).filter(predicate).map(({ effect }) => effect.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  return ids.length;
}

export async function clearEntanglementsBetween(victim, source) {
  return clearEntanglements(victim, (entry) => entry.sourceActorUuid === source?.uuid);
}

export async function clearEntanglementsFromWeapon(victim, source, weaponId) {
  return clearEntanglements(victim, (entry) => entry.sourceActorUuid === source?.uuid
    && (!weaponId || entry.sourceWeaponId === weaponId));
}
