import { engagementId, engagementRestriction, relationSnapshot, reachIndex,
  shiftedWeaponSize } from "./engagements.js";
import { findWeaponMode, weaponModes } from "./weapon-modes.js";
import { getSystemSetting, SETTING_KEYS } from "../settings.js";

const SCOPE = "mythras-foundry";
const FLAG = "tacticalState";
export const TACTICAL_STATE_SCHEMA_VERSION = 1;

export function detailedReachEnabled() { return Boolean(getSystemSetting(SETTING_KEYS.detailedReach)); }
export function tacticalState(combat) {
  return combat?.getFlag?.(SCOPE, FLAG) ?? { schemaVersion: TACTICAL_STATE_SCHEMA_VERSION,
    revision: 0, relations: {}, passiveBlocks: {} };
}
export function combatantForActor(combat, actor, tokenUuid = "") {
  return combat?.combatants?.find((entry) => entry.token?.uuid === tokenUuid
    || entry.actor?.uuid === actor?.uuid) ?? null;
}
function meleeModes(actor) {
  return actor?.items?.filter((item) => item.type === "weapon" && item.system.equipped)
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => ["melee", "shield"].includes(mode.weaponType))
      .map((mode) => ({ weapon, mode }))) ?? [];
}
export function longestPreparedWeapon(actor) {
  return meleeModes(actor).sort((a, b) => reachIndex(b.mode.reach) - reachIndex(a.mode.reach))[0] ?? null;
}
function side(combatant, weapon, mode) {
  return { combatantId: combatant.id, actorUuid: combatant.actor?.uuid ?? "",
    tokenUuid: combatant.token?.uuid ?? "", actorName: combatant.name,
    weaponId: weapon?.id ?? "", weaponName: weapon?.name ?? "",
    modeKey: mode?.key ?? "", modeName: mode?.name ?? "", reach: mode?.reach ?? "" };
}
export async function ensureEngagement(combat, attacker, defender, weapon, mode, userId = game.user.id) {
  if (!detailedReachEnabled() || !combat?.started || !["melee", "shield"].includes(mode?.weaponType)) return null;
  const left = combatantForActor(combat, attacker, attacker.token?.uuid);
  const right = combatantForActor(combat, defender, defender.token?.uuid);
  if (!left || !right) return null;
  const id = engagementId(left.id, right.id); const state = foundry.utils.deepClone(tacticalState(combat));
  if (state.relations[id]) return state.relations[id];
  const defending = longestPreparedWeapon(defender);
  const relation = relationSnapshot({ left: side(left, weapon, mode),
    right: side(right, defending?.weapon, defending?.mode), userId });
  state.relations[id] = relation; state.revision += 1;
  await combat.setFlag(SCOPE, FLAG, state);
  return relation;
}
export function relationFor(combat, leftCombatantId, rightCombatantId) {
  return tacticalState(combat).relations?.[engagementId(leftCombatantId, rightCombatantId)] ?? null;
}
export async function validateReachAttack(combat, attacker, defender, weapon, mode) {
  if (!detailedReachEnabled() || !combat?.started || !["melee", "shield"].includes(mode?.weaponType)) return { allowed: true };
  const relation = await ensureEngagement(combat, attacker, defender, weapon, mode);
  const own = combatantForActor(combat, attacker, attacker.token?.uuid);
  const restriction = engagementRestriction(relation, own?.id, mode.reach);
  return restriction.pommel ? { ...restriction, damage: "1d3+1",
    weaponSize: shiftedWeaponSize(mode.size, restriction.effectiveSizeSteps) } : restriction;
}
export async function setRelationPosition(combat, relationId, position, { userId = game.user.id,
  reason = "manual", status = "engaged" } = {}) {
  const state = foundry.utils.deepClone(tacticalState(combat)); const relation = state.relations?.[relationId];
  if (!relation) return null;
  Object.assign(relation, { position, status, userId, reason, updatedAt: Date.now(),
    revision: Number(relation.revision ?? 0) + 1 }); state.revision += 1;
  await combat.setFlag(SCOPE, FLAG, state); return relation;
}
export async function setRelationWeapons(combat, relationId, selections, userId = game.user.id) {
  const state = foundry.utils.deepClone(tacticalState(combat)); const relation = state.relations?.[relationId];
  if (!relation) return null;
  for (const [combatantId, selection] of Object.entries(selections ?? {})) {
    const combatant = combat.combatants.get(combatantId);
    const weapon = combatant?.actor?.items.get(selection.weaponId);
    const mode = weapon ? findWeaponMode(weapon, selection.modeKey) : null;
    if (!weapon?.system.equipped || !mode) continue;
    relation.sides[combatantId] = side(combatant, weapon, mode);
  }
  relation.userId = userId; relation.reason = "gmWeaponCorrection";
  relation.updatedAt = Date.now(); relation.revision = Number(relation.revision ?? 0) + 1;
  state.revision += 1; await combat.setFlag(SCOPE, FLAG, state); return relation;
}
export async function consumePassiveBlock(combat, combatantId, weaponId, reason) {
  if (!combat) return;
  const state = foundry.utils.deepClone(tacticalState(combat)); const block = state.passiveBlocks?.[combatantId];
  if (!block || block.status !== "active" || block.weaponId !== weaponId) return;
  block.status = "consumed"; block.reason = reason; block.updatedAt = Date.now(); state.revision += 1;
  const actor = combat.combatants.get(combatantId)?.actor;
  if (actor && block.crouchEffectId && actor.effects.get(block.crouchEffectId)) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", [block.crouchEffectId]);
  }
  await combat.setFlag(SCOPE, FLAG, state);
}
export function passiveBlockFor(combat, combatantId, locationId) {
  const block = tacticalState(combat).passiveBlocks?.[combatantId];
  return block?.status === "active" && Number(block.round) === Number(combat.round)
    && block.locationIds?.includes(locationId) ? block : null;
}
