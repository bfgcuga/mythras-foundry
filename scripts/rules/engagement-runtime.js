import { engagementId, engagementRestriction, relationSnapshot, reachIndex,
  shiftedWeaponSize } from "./engagements.js";
import { findWeaponMode, weaponModes } from "./weapon-modes.js";
import { getSystemSetting, SETTING_KEYS } from "../settings.js";

const SCOPE = "mythras-foundry";
const FLAG = "tacticalState";
const SOCKET = "system.mythras-foundry";
export const TACTICAL_STATE_SCHEMA_VERSION = 1;

export function detailedReachEnabled() { return Boolean(getSystemSetting(SETTING_KEYS.detailedReach)); }
export function tacticalState(combat) {
  return combat?.getFlag?.(SCOPE, FLAG) ?? { schemaVersion: TACTICAL_STATE_SCHEMA_VERSION,
    revision: 0, relations: {}, passiveBlocks: {}, covers: {} };
}
export function combatantForActor(combat, actor, tokenUuid = "") {
  return combat?.combatants?.find((entry) => entry.token?.uuid === tokenUuid
    || entry.actor?.uuid === actor?.uuid) ?? null;
}
export function preparedMeleeWeapons(actor) {
  return actor?.items?.filter((item) => item.type === "weapon" && item.system.equipped)
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => ["melee", "shield"].includes(mode.weaponType))
      .map((mode) => ({ weapon, mode }))) ?? [];
}
export function longestPreparedWeapon(actor) {
  return preparedMeleeWeapons(actor).sort((a, b) => reachIndex(b.mode.reach) - reachIndex(a.mode.reach))[0] ?? null;
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
    if (!relation.sides?.[combatantId]) continue;
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
export async function removeRelation(combat, relationId) {
  const state = foundry.utils.deepClone(tacticalState(combat));
  if (!state.relations?.[relationId]) return false;
  delete state.relations[relationId]; state.revision += 1;
  await combat.setFlag(SCOPE, FLAG, state); return true;
}
export async function deactivatePassiveBlock(combat, combatantId, userId = game.user.id) {
  const state = foundry.utils.deepClone(tacticalState(combat));
  const block = state.passiveBlocks?.[combatantId];
  if (!block || block.status !== "active") return false;
  Object.assign(block, { status: "cancelled", reason: "gmCorrection", userId,
    updatedAt: Date.now(), revision: Number(block.revision ?? 0) + 1 });
  const actor = combat.combatants.get(combatantId)?.actor;
  if (actor && block.crouchEffectId && actor.effects.get(block.crouchEffectId)) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", [block.crouchEffectId]);
  }
  state.revision += 1; await combat.setFlag(SCOPE, FLAG, state); return true;
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

export function coverFor(combat, combatantId, locationId) {
  const cover = tacticalState(combat).covers?.[combatantId];
  return cover?.status === "active" && cover.locationIds?.includes(locationId) ? cover : null;
}

export async function openCoverDeclaration(actor) {
  const combat = game.combat ?? game.combats?.active;
  const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
  if (!combat?.started || !combatant || (!game.user.isGM && !actor?.isOwner)) {
    return ui.notifications.warn(game.i18n.localize("MYTHRASF.Ranged.CoverCombatOnly"));
  }
  const locations = actor.items.filter((item) => item.type === "hitLocation")
    .sort((a, b) => Number(a.system.rangeStart) - Number(b.system.rangeStart));
  const current = tacticalState(combat).covers?.[combatant.id];
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Ranged.DeclareCover") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${game.i18n.localize("MYTHRASF.Ranged.Cover")}</legend><label><span>${game.i18n.localize("MYTHRASF.Ranged.CoverSource")}</span><input name="source" value="${foundry.utils.escapeHTML(current?.source ?? "")}" required></label><label><span>${game.i18n.localize("MYTHRASF.Ranged.CoverProtection")}</span><input type="number" min="0" name="protection" value="${Number(current?.protection ?? 0)}"></label>${locations.map((location) => `<label class="checkbox"><input type="checkbox" class="sheet-state-box" name="location" value="${location.id}" ${current?.locationIds?.includes(location.id) ? "checked" : ""}>${foundry.utils.escapeHTML(location.name)}</label>`).join("")}<label class="checkbox"><input type="checkbox" class="sheet-state-box" name="complete" ${current?.complete ? "checked" : ""}>${game.i18n.localize("MYTHRASF.Ranged.CompleteCover")}</label></fieldset></div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.CombatEffect.Confirm"),
      callback: (event, button) => ({ source: button.form.elements.source.value.trim(),
        protection: Number(button.form.elements.protection.value), complete: button.form.elements.complete.checked,
        locationIds: Array.from(button.form.querySelectorAll("[name='location']:checked"), (entry) => entry.value) }) },
    { action: "remove", label: game.i18n.localize("MYTHRASF.Delete") },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel") }], rejectClose: false
  });
  if (!result) return;
  const request = { action: "tacticalCover", combatId: combat.id, combatantId: combatant.id,
    revision: Number(tacticalState(combat).revision ?? 0), userId: game.user.id, result };
  const activeGm = game.users.some((user) => user.active && user.isGM);
  if (game.user.isGM || (!activeGm && combat.isOwner)) await applyCoverDeclaration(request);
  else game.socket.emit(SOCKET, request);
}

async function applyCoverDeclaration(request) {
  const combat = game.combats.get(request.combatId); const state = tacticalState(combat);
  const combatant = combat?.combatants.get(request.combatantId); const user = game.users.get(request.userId);
  if (!combat || Number(state.revision ?? 0) !== Number(request.revision) || !combatant?.actor
    || !user || (!user.isGM && !combatant.actor.testUserPermission(user, "OWNER"))) return;
  const next = foundry.utils.deepClone(state); next.covers ??= {};
  const current = next.covers[combatant.id];
  if (request.result === "remove") delete next.covers[combatant.id];
  else next.covers[combatant.id] = { schemaVersion: 1, status: "active", ...request.result,
    actorUuid: combatant.actor.uuid, combatantId: combatant.id, userId: request.userId,
    revision: Number(current?.revision ?? 0) + 1, updatedAt: Date.now() };
  next.revision = Number(next.revision ?? 0) + 1; await combat.setFlag(SCOPE, FLAG, next);
}

export function registerTacticalSocket() {
  game.socket.on(SOCKET, async (request) => {
    const primary = game.users.filter((user) => user.active && user.isGM)
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    const combat = request?.combatId ? game.combats.get(request.combatId) : null;
    if (request?.action === "tacticalCover" && (primary?.id === game.user.id
      || (!primary && request.userId === game.user.id && combat?.isOwner))) {
      await applyCoverDeclaration(request);
    }
  });
}
