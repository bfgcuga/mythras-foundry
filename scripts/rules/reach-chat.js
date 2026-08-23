import { classifyContestRoll } from "./contest-rolls.js";
import { evaluateAnimatedRoll } from "./dice-animation.js";
import { opposedEffectWinner } from "./combat-effects.js";
import { currentActionPoints } from "./action-points.js";
import { engagementId, initialReachPosition, relationSituationReach } from "./engagements.js";
import { combatantForActor, deactivatePassiveBlock, ensureEngagement, longestPreparedWeapon,
  preparedMeleeWeapons, removeCoverCorrection, removeRelation, setCoverCorrection,
  consumePassiveBlock, detailedReachEnabled, reactivatePassiveBlock, setRelationPosition,
  setRelationWeapons, tacticalState } from "./engagement-runtime.js";
import { openPassiveBlockCorrection } from "./round-consequences.js";
import { findWeaponMode, weaponModes } from "./weapon-modes.js";
import { difficultyTarget, resolveWeaponStyle } from "./combat.js";
import { createResolvedReactionAttack } from "./combat-chat.js";
import { recordAbilityFumble } from "./skills.js";
import { actorDisplayName, tokenDisplayName } from "./document-names.js";

const SCOPE = "mythras-foundry"; const SOCKET = "system.mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const coordinator = () => game.mythrasFoundry?.combat?.isCoordinator?.();
const pendingActors = new Set();
function combatantDisplayName(combatant) {
  if (!combatant?.actor) return combatant?.name ?? "";
  return combatant.actor.type === "character" ? actorDisplayName(combatant.actor)
    : tokenDisplayName(combatant.token) || actorDisplayName(combatant.actor) || combatant.name || "";
}
async function spend(actor) { const value = currentActionPoints(actor); if (value < 1) return false;
  await actor.update({ "system.resources.actionPoints.value": value - 1 }); return true; }

function evade(actor) { return actor.items.find((item) => item.type === "skill" && item.system.slug === "evadir"); }
function render(state) {
  const result = state.status === "resolved" ? `<div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Reach.Result"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Reach.Outcome.${state.outcome}`))}</strong></div>` : "";
  const buttons = state.status === "awaitingResponse" ? `<button data-reach-action="evade">${escape(game.i18n.localize("MYTHRASF.Reach.OpposeEvade"))}</button><button data-reach-action="attack">${escape(game.i18n.localize("MYTHRASF.Reach.ResponseAttack"))}</button><button data-reach-action="none">${escape(game.i18n.localize("MYTHRASF.Combat.NoDefense"))}</button>` : "";
  return `<section class="mythras-reach-card mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.localize("MYTHRASF.Reach.Change"))}</div><div class="mythras-chat-row"><span>${escape(state.actorName)}</span><strong>${escape(state.targetName)}</strong></div><div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Reach.IntentLabel"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Reach.Intent.${state.intent}`))}</strong></div>${buttons}${result}</section>`;
}

export async function requestReachChange(actor) {
  if (!detailedReachEnabled()) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Reach.Disabled"));
  if (pendingActors.has(actor.uuid)) return;
  pendingActors.add(actor.uuid);
  try {
  const combat = game.combat; const active = combatantForActor(combat, actor, actor.token?.uuid);
  if (!combat?.started || combat.combatant?.id !== active?.id || currentActionPoints(actor) < 1) return;
  const opponents = combat.combatants.filter((entry) => entry.id !== active.id && entry.actor);
  const weapons = actor.items.filter((item) => item.type === "weapon" && item.system.equipped)
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => ["melee", "shield"].includes(mode.weaponType))
      .map((mode) => ({ weapon, mode })));
  if (!opponents.length || !weapons.length || !evade(actor)) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Combat.SourceMissing"));
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Reach.Change") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</span><select name="target">${opponents.map((entry) => `<option value="${entry.id}">${escape(combatantDisplayName(entry))}</option>`).join("")}</select></label><label><span>${escape(game.i18n.localize("MYTHRASF.Reach.IntentLabel"))}</span><select name="intent"><option value="shorter">${escape(game.i18n.localize("MYTHRASF.Reach.Intent.shorter"))}</option><option value="longer">${escape(game.i18n.localize("MYTHRASF.Reach.Intent.longer"))}</option><option value="disengage">${escape(game.i18n.localize("MYTHRASF.Reach.Intent.disengage"))}</option></select></label><label><span>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weapons.map(({ weapon, mode }) => `<option value="${escape(`${weapon.id}:${mode.key}`)}">${escape(weapon.name)} (${escape(mode.reach)})</option>`).join("")}</select></label></div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.Reach.Change"),
      callback: (event, button) => ({ targetId: button.form.elements.target.value,
        intent: button.form.elements.intent.value, weapon: button.form.elements.weapon.value }) }], rejectClose: false });
  if (!result || !await spend(actor)) return;
  const target = combat.combatants.get(result.targetId); const [weaponId, modeKey] = result.weapon.split(":");
  const weapon = actor.items.get(weaponId); const mode = findWeaponMode(weapon, modeKey);
  const relation = await ensureEngagement(combat, actor, target.actor, weapon, mode);
  const skill = evade(actor); const roll = await new Roll("1d100").evaluate();
  const evadeResult = classifyContestRoll(roll.total, Number(skill.system.total ?? 0));
  await recordAbilityFumble(skill, evadeResult);
  const state = { schemaVersion: 1, revision: 0, status: "awaitingResponse", combatId: combat.id,
    relationId: relation?.id ?? engagementId(active.id, target.id), actorCombatantId: active.id,
    targetCombatantId: target.id, actorUuid: actor.uuid, actorName: combatantDisplayName(active),
    targetUuid: target.actor.uuid, targetName: combatantDisplayName(target), intent: result.intent,
    weaponId, modeKey, evade: { target: Number(skill.system.total ?? 0), rawRoll: roll.total,
      result: evadeResult }, authorUserId: game.user.id };
  const messageData = { speaker: ChatMessage.getSpeaker({ actor }), content: render(state),
    rolls: [roll], flags: { [SCOPE]: { reachChange: state } } };
  ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
  } finally { pendingActors.delete(actor.uuid); }
}

async function respond(message, state, type) {
  const combat = game.combats.get(state.combatId); const target = combat?.combatants.get(state.targetCombatantId);
  const actor = target?.actor; if (!actor || (!game.user.isGM && !actor.isOwner)) return;
  let response = { type };
  if (type !== "none") {
    if (type === "evade") {
      const skill = evade(actor); if (!skill) return;
      const roll = await evaluateAnimatedRoll("1d100", { speaker: ChatMessage.getSpeaker({ actor }) });
      const result = classifyContestRoll(roll.total, Number(skill.system.total ?? 0));
      await recordAbilityFumble(skill, result);
      response = { type, target: Number(skill.system.total ?? 0), rawRoll: roll.total, result };
    } else {
      const selected = longestPreparedWeapon(actor); if (!selected) return;
      const styles = actor.items.filter((item) => item.type === "combatStyle");
      const resolved = resolveWeaponStyle({ weapon: { id: selected.weapon.id, name: selected.weapon.name,
        system: selected.mode }, styles, selectedStyleId: selected.mode.preferredCombatStyleId,
      familiarity: selected.mode.familiarity });
      const targetValue = difficultyTarget(resolved.target, resolved.difficulty);
      const roll = await evaluateAnimatedRoll("1d100", { speaker: ChatMessage.getSpeaker({ actor }) });
      const result = classifyContestRoll(roll.total, targetValue);
      await recordAbilityFumble(resolved.style, result);
      response = { type, weaponId: selected.weapon.id, modeKey: selected.mode.key,
        target: targetValue, rawRoll: roll.total, result };
      await consumePassiveBlock(combat, target.id, selected.weapon.id, "reactionAttack");
    }
  }
  const request = { action: "reachResponse", messageId: message.id, revision: state.revision,
    userId: game.user.id, response };
  if (coordinator()) await apply(message, request); else game.socket.emit(SOCKET, request);
}

async function apply(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "reachChange"));
  const combat = game.combats.get(state?.combatId); const target = combat?.combatants.get(state?.targetCombatantId);
  const user = game.users.get(request.userId);
  if (!state || state.status !== "awaitingResponse" || state.revision !== request.revision || !user
    || (!user.isGM && !target?.actor?.testUserPermission(user, "OWNER"))) return;
  const response = request.response; let succeeds = response.type === "none"; let winner = null;
  if (response.type !== "none" && !await spend(target.actor)) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.Tracker.Rejected.actionPoints"));
  if (response.type !== "none") {
    winner = opposedEffectWinner({ leftResult: state.evade.result, leftRoll: state.evade.rawRoll,
      rightResult: response.result, rightRoll: response.rawRoll });
    succeeds = response.type === "attack" || winner === "left";
  }
  if (succeeds) await setRelationPosition(combat, state.relationId,
    state.intent === "disengage" ? "neutral" : state.intent, { userId: user.id,
      reason: "changeReach", status: state.intent === "disengage" ? "disengaged" : "engaged" });
  state.status = "resolved"; state.response = response; state.winner = winner;
  state.outcome = response.type === "attack" && winner === "right" ? "changedAndHit"
    : succeeds ? "changed" : "resisted"; state.revision += 1;
  await message.update({ content: render(state), [`flags.${SCOPE}.reachChange`]: state });
  if (response.type === "attack" && winner === "right") {
    await createResolvedReactionAttack({ tracker: combat,
      attackerCombatantId: state.targetCombatantId, defenderCombatantId: state.actorCombatantId,
      weaponId: response.weaponId, modeKey: response.modeKey, attackTarget: response.target,
      attackRoll: response.rawRoll, evadeTarget: state.evade.target, evadeRoll: state.evade.rawRoll,
      authorUserId: request.userId });
  } else if (combat.combatant?.id === state.actorCombatantId) await combat.nextTurn();
}

export function activateReachCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0]; const card = root?.querySelector?.(".mythras-reach-card") ?? root;
  const state = message.getFlag?.(SCOPE, "reachChange"); if (!card?.classList?.contains("mythras-reach-card") || !state) return;
  card.addEventListener("click", (event) => { const button = event.target.closest("[data-reach-action]");
    if (button) respond(message, state, button.dataset.reachAction); });
}
export function registerReachSocket() { game.socket.on(SOCKET, async (request) => {
  if (request?.action !== "reachResponse" || !coordinator()) return;
  const message = game.messages.get(request.messageId); if (message) await apply(message, request);
}); }

function renderReachReference() {
  const categories = ["T", "C", "M", "L", "ML"].map((key) => `<tr><td><strong>${key}</strong></td><td>${escape(
    game.i18n.localize(`MYTHRASF.Reach.Category${key}`))}</td><td>${escape(
    game.i18n.localize(`MYTHRASF.Reach.Category${key}Hint`))}</td></tr>`).join("");
  return `<details class="tactical-reach-reference"><summary>${escape(game.i18n.localize(
    "MYTHRASF.Reach.ReferenceTitle"))}</summary><table><thead><tr><th>${escape(game.i18n.localize(
    "MYTHRASF.Reach.Code"))}</th><th>${escape(game.i18n.localize(
    "MYTHRASF.Reach.Description"))}</th><th>${escape(game.i18n.localize(
    "MYTHRASF.Reach.Explanation"))}</th></tr></thead><tbody>${categories}</tbody></table><div class="tactical-reach-rules"><section><h4>${escape(
    game.i18n.localize("MYTHRASF.Reach.ReferenceLonger"))}</h4><p>${escape(game.i18n.localize(
    "MYTHRASF.Reach.ReferenceLongerHint"))}</p></section><section><h4>${escape(game.i18n.localize(
    "MYTHRASF.Reach.ReferenceShorter"))}</h4><p>${escape(game.i18n.localize(
    "MYTHRASF.Reach.ReferenceShorterHint"))}</p></section><section><h4>${escape(game.i18n.localize(
    "MYTHRASF.Reach.ReferenceNeutral"))}</h4><p>${escape(game.i18n.localize(
    "MYTHRASF.Reach.ReferenceNeutralHint"))}</p></section></div></details>`;
}

export function renderTacticalOverview(combat) {
  const state = tacticalState(combat); const combatants = Array.from(
    combat.combatants.values?.() ?? combat.combatants);
  const rows = Object.entries(state.relations ?? {})
    .filter(([, relation]) => relation.status !== "removed").map(([relationId, relation]) => {
    const sides = Object.values(relation.sides ?? {});
    const incomplete = sides.some((side) => {
      const weapon = combat.combatants.get(side.combatantId)?.actor?.items.get(side.weaponId);
      return !weapon || !weapon.system.equipped
        || !weaponModes(weapon).some((mode) => mode.key === side.modeKey);
    });
    const names = sides.map((side) => combatantDisplayName(
      combat.combatants.get(side.combatantId)) || side.actorName);
    const chosen = (side) => `${side.weaponId}|${side.modeKey}`;
    return `<tr data-relation-row="${escape(relationId)}"><td>${escape(names[0])}</td><td>${escape(names[1])}</td><td>${game.user?.isGM ? `<select name="rowRelationStatus"><option value="engaged" ${relation.status === "engaged" ? "selected" : ""}>engaged</option><option value="disengaged" ${relation.status === "disengaged" ? "selected" : ""}>disengaged</option></select>` : escape(incomplete ? game.i18n.localize("MYTHRASF.Reach.Incomplete") : relation.status)}</td><td>${game.user?.isGM ? `<select name="rowLeftWeapon">${weaponOptions(combat, sides[0]?.combatantId, chosen(sides[0]))}</select><select name="rowRightWeapon">${weaponOptions(combat, sides[1]?.combatantId, chosen(sides[1]))}</select>` : escape(sides.map((side) => `${side.weaponName} (${side.reach})`).join(" / "))}</td><td>${game.user?.isGM ? `<select name="rowRelationPosition"><option value="longer" ${relation.position === "longer" ? "selected" : ""}>longer</option><option value="shorter" ${relation.position === "shorter" ? "selected" : ""}>shorter</option><option value="neutral" ${relation.position === "neutral" ? "selected" : ""}>neutral</option></select><span>${escape(relationSituationReach(relation))}</span>` : `${escape(relation.position)} (${escape(relationSituationReach(relation))})`}</td><td class="tactical-actions-column">${game.user?.isGM ? `<button type="button" class="sheet-icon-button" data-tactical-action="save-relation-row" data-relation-id="${escape(relationId)}" title="${escape(game.i18n.localize("MYTHRASF.Save"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Save"))}"><i class="fas fa-floppy-disk" aria-hidden="true"></i></button><button type="button" class="sheet-icon-button" data-tactical-action="remove-relation" data-relation-id="${escape(relationId)}" title="${escape(game.i18n.localize("MYTHRASF.Reach.RemoveRelation"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Reach.RemoveRelation"))}"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ""}</td></tr>`;
  }).join("");
  const blocks = Object.values(state.passiveBlocks ?? {}).map((block) => { const combatant = combat.combatants.get(block.combatantId);
    const canManage = Boolean(game.user?.isGM || combatant?.actor?.isOwner);
    return `<tr><td>${escape(combatantDisplayName(combatant))}</td><td>${escape(block.weaponName)}</td><td>${escape(
    block.locationIds?.map((id) => combat.combatants.get(block.combatantId)?.actor?.items.get(id)?.name)
      .filter(Boolean).join(", "))}</td><td>${escape(block.status)}</td><td><div class="tactical-row-actions"><button type="button" data-tactical-action="deactivate-block" data-combatant-id="${escape(block.combatantId)}" ${canManage && block.status === "active" ? "" : "disabled"}>${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Cancel"))}</button><button type="button" data-tactical-action="reactivate-block" data-combatant-id="${escape(block.combatantId)}" ${canManage && block.status !== "active" ? "" : "disabled"}>${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Reactivate"))}</button><button type="button" data-tactical-action="modify-block" data-combatant-id="${escape(block.combatantId)}" ${canManage ? "" : "disabled"}>${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Modify"))}</button></div></td></tr>`; }).join("");
  const coverCombatants = game.user?.isGM ? combatants.filter((entry) => entry.actor)
    : combatants.filter((entry) => state.covers?.[entry.id]);
  const covers = coverCombatants.map((combatant) => { const cover = state.covers?.[combatant.id];
    const locationNames = cover?.locationIds?.map((id) => combatant.actor.items.get(id)?.name).filter(Boolean).join(", ") ?? "";
    return `<tr data-cover-row="${escape(combatant.id)}"><td>${escape(combatantDisplayName(combatant))}</td><td>${game.user?.isGM ? `<input name="rowCoverSource" value="${escape(cover?.source)}">` : escape(cover?.source)}</td><td>${escape(locationNames)}${game.user?.isGM ? `<button type="button" class="sheet-icon-button" data-tactical-action="edit-cover-locations" data-combatant-id="${escape(combatant.id)}" title="${escape(game.i18n.localize("MYTHRASF.Ranged.EditCoverLocations"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Ranged.EditCoverLocations"))}"><i class="fas fa-list-check" aria-hidden="true"></i></button>` : ""}</td><td>${game.user?.isGM ? `<input type="number" min="0" name="rowCoverProtection" value="${Number(cover?.protection ?? 0)}">` : Number(cover?.protection ?? 0)}</td><td>${game.user?.isGM ? `<select name="rowCoverStatus"><option value="active" ${cover?.status !== "cancelled" ? "selected" : ""}>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverStatusActive"))}</option><option value="cancelled" ${cover?.status === "cancelled" ? "selected" : ""}>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverStatusCancelled"))}</option></select>` : escape(game.i18n.localize(`MYTHRASF.Ranged.CoverStatus${cover?.status === "active" ? "Active" : "Cancelled"}`))}</td><td>${game.user?.isGM ? `<input type="checkbox" class="sheet-state-box" name="rowCoverComplete" ${cover?.complete ? "checked" : ""}>` : cover?.complete ? escape(game.i18n.localize("MYTHRASF.Yes")) : escape(game.i18n.localize("MYTHRASF.No"))}</td><td class="tactical-actions-column">${game.user?.isGM ? `<button type="button" class="sheet-icon-button" data-tactical-action="save-cover-row" data-combatant-id="${escape(combatant.id)}" title="${escape(game.i18n.localize("MYTHRASF.Save"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Save"))}"><i class="fas fa-floppy-disk" aria-hidden="true"></i></button>${cover ? `<button type="button" class="sheet-icon-button" data-tactical-action="remove-cover-row" data-combatant-id="${escape(combatant.id)}" title="${escape(game.i18n.localize("MYTHRASF.Ranged.RemoveCoverCorrection"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Ranged.RemoveCoverCorrection"))}"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ""}` : ""}</td></tr>`; }).join("");
  const title = (key) => `<h3 class="tactical-table-title">${escape(game.i18n.localize(key))}</h3>`;
  return `<div class="mythras-foundry mythras-dialog">${title("MYTHRASF.Reach.RelationsTable")}<table><thead><tr><th>A</th><th>B</th><th>${escape(game.i18n.localize("MYTHRASF.Reach.Engagement"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Weapon.Reach"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Reach.Position"))}</th><th class="tactical-actions-column"></th></tr></thead><tbody>${rows}</tbody></table>${title("MYTHRASF.PassiveBlock.Table")}<table><thead><tr><th>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</th><th>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Contest.StatusLabel"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Edit"))}</th></tr></thead><tbody>${blocks}</tbody></table>${title("MYTHRASF.Ranged.CoversTable")}<table><thead><tr><th>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverSource"))}</th><th>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverProtection"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Contest.StatusLabel"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Ranged.CompleteCover"))}</th><th class="tactical-actions-column"></th></tr></thead><tbody>${covers}</tbody></table>${renderReachReference()}</div>`;
}
function weaponOptions(combat, combatantId, selected = "") {
  const combatant = combat.combatants.get(combatantId);
  const longest = longestPreparedWeapon(combatant?.actor);
  const effectiveSelection = selected || (longest ? `${longest.weapon.id}|${longest.mode.key}` : "");
  return preparedMeleeWeapons(combatant?.actor).map(({ weapon, mode }) => {
    const value = `${weapon.id}|${mode.key}`;
    return `<option value="${escape(value)}" ${value === effectiveSelection ? "selected" : ""}>${escape(
      weapon.name)} (${escape(mode.reach)})</option>`;
  }).join("");
}
function selection(combatantId, value) {
  const [weaponId, modeKey] = String(value ?? "").split("|");
  return { combatantId, weaponId, modeKey };
}
function coverLocationControls(combat, combatantId, selected = []) {
  const locations = combat.combatants.get(combatantId)?.actor?.items
    .filter((item) => item.type === "hitLocation")
    .sort((a, b) => Number(a.system.rangeStart) - Number(b.system.rangeStart)) ?? [];
  return locations.map((location) => `<label class="checkbox"><input type="checkbox" class="sheet-state-box" name="coverLocation" value="${escape(location.id)}" ${selected.includes(location.id)
    ? "checked" : ""}>${escape(location.name)}</label>`).join("");
}
function renderTacticalControls(combat) {
  const combatants = combat.combatants.filter((entry) => entry.actor);
  const newLeft = combatants[0]; const newRight = combatants[1] ?? combatants[0];
  const optionsFor = (selectedId) => combatants.map((entry) =>
    `<option value="${escape(entry.id)}" ${entry.id === selectedId ? "selected" : ""}>${escape(combatantDisplayName(entry))}</option>`).join("");
  const create = game.user.isGM ? `<fieldset class="tactical-create"><legend>${escape(game.i18n.localize("MYTHRASF.Reach.CreateRelation"))}</legend><div class="tactical-control-row"><select name="newLeft">${optionsFor(newLeft?.id)}</select><select name="newLeftWeapon">${weaponOptions(combat, newLeft?.id)}</select><select name="newRight">${optionsFor(newRight?.id)}</select><select name="newRightWeapon">${weaponOptions(combat, newRight?.id)}</select><button type="button" data-tactical-action="create">${escape(game.i18n.localize("MYTHRASF.Reach.CreateRelation"))}</button></div></fieldset>` : "";
  return create;
}
function tacticalMenuContent(combat) { return `${renderTacticalControls(combat)}${renderTacticalOverview(combat)}`; }
function activateTacticalMenu(dialog, combat) {
  const menu = dialog.window.content.querySelector(".tactical-overview-menu");
  const form = menu?.closest("form"); if (!menu || !form) return;
  const refresh = () => { const referenceOpen = menu.querySelector(".tactical-reach-reference")?.open;
    menu.innerHTML = tacticalMenuContent(combat);
    const reference = menu.querySelector(".tactical-reach-reference"); if (reference) reference.open = referenceOpen;
    activateTacticalMenu(dialog, combat); };
  for (const [combatantName, weaponName] of [["newLeft", "newLeftWeapon"], ["newRight", "newRightWeapon"]]) {
    form.elements[combatantName]?.addEventListener("change", () => {
      form.elements[weaponName].innerHTML = weaponOptions(combat, form.elements[combatantName].value);
    });
  }
  const handleAction = async (event) => {
    event.preventDefault(); event.stopPropagation();
    const button = event.currentTarget;
    button.disabled = true;
    const action = button.dataset.tacticalAction;
    if (action === "remove-relation") {
      const removed = await removeRelation(combat, button.dataset.relationId);
      const notification = removed ? "info" : "warn";
      ui.notifications[notification](game.i18n.localize(removed
        ? "MYTHRASF.Reach.RelationRemoved" : "MYTHRASF.Reach.RelationNotFound"));
    }
    if (action === "deactivate-block") await deactivatePassiveBlock(combat, button.dataset.combatantId);
    if (action === "reactivate-block") await reactivatePassiveBlock(combat, button.dataset.combatantId);
    if (action === "modify-block") await openPassiveBlockCorrection(combat, button.dataset.combatantId);
    if (action === "save-relation-row") {
      const relationId = button.dataset.relationId; const relation = tacticalState(combat).relations?.[relationId];
      const row = button.closest("[data-relation-row]"); const sides = Object.values(relation?.sides ?? {});
      if (row && sides.length >= 2) {
        const left = selection(sides[0].combatantId, row.querySelector("[name='rowLeftWeapon']").value);
        const right = selection(sides[1].combatantId, row.querySelector("[name='rowRightWeapon']").value);
        await setRelationWeapons(combat, relationId, { [left.combatantId]: left, [right.combatantId]: right });
        await setRelationPosition(combat, relationId, row.querySelector("[name='rowRelationPosition']").value,
          { status: row.querySelector("[name='rowRelationStatus']").value, reason: "gmCorrection" });
      }
    }
    const saveCoverRow = async (combatantId, locationIds = null) => { const row = menu.querySelector(
      `[data-cover-row="${CSS.escape(combatantId)}"]`); if (!row) return;
      const current = tacticalState(combat).covers?.[combatantId];
      await setCoverCorrection(combat, combatantId, { source: row.querySelector("[name='rowCoverSource']").value,
        protection: row.querySelector("[name='rowCoverProtection']").value,
        status: row.querySelector("[name='rowCoverStatus']").value,
        complete: row.querySelector("[name='rowCoverComplete']").checked,
        locationIds: locationIds ?? current?.locationIds ?? [] }); };
    if (action === "save-cover-row") await saveCoverRow(button.dataset.combatantId);
    if (action === "edit-cover-locations") {
      const combatantId = button.dataset.combatantId; const current = tacticalState(combat).covers?.[combatantId];
      const result = await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize("MYTHRASF.Ranged.EditCoverLocations") },
        content: `<div class="mythras-foundry mythras-dialog tactical-cover-locations">${coverLocationControls(combat,
          combatantId, current?.locationIds)}</div>`, buttons: [{ action: "confirm",
          label: game.i18n.localize("MYTHRASF.CombatEffect.Confirm"), callback: (event, dialogButton) =>
            Array.from(dialogButton.form.querySelectorAll("[name='coverLocation']:checked"),
              (control) => control.value) }], rejectClose: false });
      if (result) await saveCoverRow(combatantId, result);
    }
    if (action === "remove-cover-row") await removeCoverCorrection(combat, button.dataset.combatantId);
    if (action === "create") {
      const left = selection(form.elements.newLeft.value, form.elements.newLeftWeapon.value);
      const right = selection(form.elements.newRight.value, form.elements.newRightWeapon.value);
      if (left.combatantId !== right.combatantId && left.weaponId && right.weaponId) {
        const leftCombatant = combat.combatants.get(left.combatantId);
        const rightCombatant = combat.combatants.get(right.combatantId);
        const weapon = leftCombatant.actor.items.get(left.weaponId); const mode = findWeaponMode(weapon, left.modeKey);
        const rightWeapon = rightCombatant.actor.items.get(right.weaponId); const rightMode = findWeaponMode(rightWeapon, right.modeKey);
        const relation = await ensureEngagement(combat, leftCombatant.actor, rightCombatant.actor, weapon, mode);
        if (relation && rightMode) { await setRelationWeapons(combat, relation.id,
          { [left.combatantId]: left, [right.combatantId]: right });
          await setRelationPosition(combat, relation.id, initialReachPosition(mode.reach, rightMode.reach),
            { status: "engaged", reason: "gmCreation" }); }
      }
    }
    refresh();
  };
  for (const button of menu.querySelectorAll("[data-tactical-action]")) {
    button.addEventListener("click", handleAction);
  }
}
export async function openTacticalOverview() { const combat = game.combat; if (!combat) return;
  await foundry.applications.api.DialogV2.wait({ window: { title: game.i18n.localize("MYTHRASF.Reach.Overview") },
    content: `<div class="mythras-foundry mythras-dialog tactical-overview-menu">${tacticalMenuContent(combat)}</div>`,
    buttons: [{ action: "close", label: game.i18n.localize("MYTHRASF.Close") }],
    render: (event, dialog) => { const bounds = dialog.element.getBoundingClientRect();
      dialog.setPosition({ width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) });
      activateTacticalMenu(dialog, combat); }, rejectClose: false });
}
