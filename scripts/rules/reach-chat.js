import { classifyContestRoll } from "./contest-rolls.js";
import { evaluateAnimatedRoll } from "./dice-animation.js";
import { opposedEffectWinner } from "./combat-effects.js";
import { currentActionPoints } from "./action-points.js";
import { engagementId, initialReachPosition, relationSituationReach } from "./engagements.js";
import { combatantForActor, deactivatePassiveBlock, ensureEngagement, longestPreparedWeapon,
  preparedMeleeWeapons, removeRelation,
  consumePassiveBlock, detailedReachEnabled, reactivatePassiveBlock, setRelationPosition,
  setRelationWeapons, submitCoverDeclaration, tacticalState } from "./engagement-runtime.js";
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
const coverDrafts = new Map();
function combatCoverDrafts(combat) {
  if (!coverDrafts.has(combat.id)) coverDrafts.set(combat.id, new Set());
  return coverDrafts.get(combat.id);
}
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
    const disabled = game.user?.isGM ? "" : "disabled";
    return `<tr data-relation-row="${escape(relationId)}"><td>${escape(names[0])}</td><td>${escape(names[1])}</td><td>${game.user?.isGM ? `<select name="rowRelationStatus"><option value="engaged" ${relation.status === "engaged" ? "selected" : ""}>engaged</option><option value="disengaged" ${relation.status === "disengaged" ? "selected" : ""}>disengaged</option></select>` : escape(incomplete ? game.i18n.localize("MYTHRASF.Reach.Incomplete") : relation.status)}</td><td>${game.user?.isGM ? `<div class="tactical-relation-weapons"><select name="rowLeftWeapon">${weaponOptions(combat, sides[0]?.combatantId, chosen(sides[0]))}</select><select name="rowRightWeapon">${weaponOptions(combat, sides[1]?.combatantId, chosen(sides[1]))}</select></div>` : escape(sides.map((side) => `${side.weaponName} (${side.reach})`).join(" / "))}</td><td>${game.user?.isGM ? `<div class="tactical-relation-position"><select name="rowRelationPosition"><option value="longer" ${relation.position === "longer" ? "selected" : ""}>longer</option><option value="shorter" ${relation.position === "shorter" ? "selected" : ""}>shorter</option><option value="neutral" ${relation.position === "neutral" ? "selected" : ""}>neutral</option></select><span>${escape(relationSituationReach(relation))}</span></div>` : `${escape(relation.position)} (${escape(relationSituationReach(relation))})`}</td><td><div class="tactical-row-actions"><button type="button" class="sheet-icon-button" data-tactical-action="save-relation-row" data-relation-id="${escape(relationId)}" title="${escape(game.i18n.localize("MYTHRASF.Save"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Save"))}" ${disabled}><i class="fas fa-floppy-disk" aria-hidden="true"></i></button><button type="button" class="sheet-icon-button" data-tactical-action="remove-relation" data-relation-id="${escape(relationId)}" title="${escape(game.i18n.localize("MYTHRASF.Reach.RemoveRelation"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Reach.RemoveRelation"))}" ${disabled}><i class="fas fa-trash" aria-hidden="true"></i></button></div></td></tr>`;
  }).join("");
  const blocks = Object.values(state.passiveBlocks ?? {}).map((block) => { const combatant = combat.combatants.get(block.combatantId);
    const canManage = Boolean(game.user?.isGM || combatant?.actor?.isOwner);
    return `<tr><td>${escape(combatantDisplayName(combatant))}</td><td>${escape(block.weaponName)}</td><td>${escape(
    block.locationIds?.map((id) => combat.combatants.get(block.combatantId)?.actor?.items.get(id)?.name)
      .filter(Boolean).join(", "))}</td><td>${escape(block.status)}</td><td><div class="tactical-row-actions"><button type="button" data-tactical-action="deactivate-block" data-combatant-id="${escape(block.combatantId)}" ${canManage && block.status === "active" ? "" : "disabled"}>${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Cancel"))}</button><button type="button" data-tactical-action="reactivate-block" data-combatant-id="${escape(block.combatantId)}" ${canManage && block.status !== "active" ? "" : "disabled"}>${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Reactivate"))}</button><button type="button" data-tactical-action="modify-block" data-combatant-id="${escape(block.combatantId)}" ${canManage ? "" : "disabled"}>${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Modify"))}</button></div></td></tr>`; }).join("");
  const drafts = combatCoverDrafts(combat);
  const coverCombatants = combatants.filter((entry) => state.covers?.[entry.id]?.status === "active"
    || drafts.has(entry.id));
  const covers = coverCombatants.map((combatant) => { const storedCover = state.covers?.[combatant.id];
    const cover = storedCover?.status === "active" ? storedCover : null;
    const draft = !cover && drafts.has(combatant.id);
    const canManage = Boolean(game.user?.isGM || combatant.actor?.isOwner);
    const locationNames = cover?.locationIds?.map((id) => combatant.actor.items.get(id)?.name).filter(Boolean).join(", ") ?? "";
    return `<tr data-cover-row="${escape(combatant.id)}"><td>${draft ? `<select name="rowCoverCombatant">${combatants.filter((entry) => (game.user?.isGM || entry.actor?.isOwner) && (state.covers?.[entry.id]?.status !== "active" || entry.id === combatant.id)).map((entry) => `<option value="${escape(entry.id)}" ${entry.id === combatant.id ? "selected" : ""}>${escape(combatantDisplayName(entry))}</option>`).join("")}</select>` : escape(combatantDisplayName(combatant))}</td><td>${canManage ? `<input name="rowCoverSource" value="${escape(cover?.source)}">` : escape(cover?.source)}</td><td><div class="tactical-cover-location-cell"><span>${escape(locationNames)}</span>${canManage ? `<button type="button" class="sheet-icon-button" data-tactical-action="edit-cover-locations" data-combatant-id="${escape(combatant.id)}" title="${escape(game.i18n.localize("MYTHRASF.Ranged.EditCoverLocations"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Ranged.EditCoverLocations"))}"><i class="fas fa-list-check" aria-hidden="true"></i></button>` : ""}</div></td><td>${canManage ? `<input type="number" min="0" name="rowCoverProtection" value="${Number(cover?.protection ?? 0)}">` : Number(cover?.protection ?? 0)}</td><td>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverStatusActive"))}</td><td>${canManage ? `<input type="checkbox" class="sheet-state-box" name="rowCoverComplete" ${cover?.complete ? "checked" : ""}>` : cover?.complete ? escape(game.i18n.localize("MYTHRASF.Yes")) : escape(game.i18n.localize("MYTHRASF.No"))}</td><td><div class="tactical-row-actions"><button type="button" class="sheet-icon-button" data-tactical-action="save-cover-row" data-combatant-id="${escape(combatant.id)}" title="${escape(game.i18n.localize("MYTHRASF.Save"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Save"))}" ${canManage ? "" : "disabled"}><i class="fas fa-floppy-disk" aria-hidden="true"></i></button><button type="button" class="sheet-icon-button" data-tactical-action="remove-cover-row" data-combatant-id="${escape(combatant.id)}" title="${escape(game.i18n.localize("MYTHRASF.Ranged.RemoveCoverCorrection"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Ranged.RemoveCoverCorrection"))}" ${canManage ? "" : "disabled"}><i class="fas fa-trash" aria-hidden="true"></i></button></div></td></tr>`; }).join("");
  const title = (key) => `<h3 class="tactical-table-title">${escape(game.i18n.localize(key))}</h3>`;
  const addButton = (action, label) => { const enabled = game.user?.isGM || (action === "add-cover"
    && combatants.some((entry) => entry.actor?.isOwner && state.covers?.[entry.id]?.status !== "active"));
    return `<button type="button" class="sheet-add-button" data-tactical-action="${action}" title="${escape(label)}" aria-label="${escape(label)}" ${enabled ? "" : "disabled"}><i class="fas fa-plus" aria-hidden="true"></i></button>`; };
  return `<div class="mythras-foundry mythras-dialog">${title("MYTHRASF.Reach.RelationsTable")}<table><thead><tr><th>A</th><th>B</th><th>${escape(game.i18n.localize("MYTHRASF.Reach.Engagement"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Weapon.Reach"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Reach.Position"))}</th><th>${addButton("add-relation", game.i18n.localize("MYTHRASF.Reach.CreateRelation"))}</th></tr></thead><tbody>${rows}</tbody></table>${title("MYTHRASF.PassiveBlock.Table")}<table><thead><tr><th>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</th><th>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Contest.StatusLabel"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Edit"))}</th></tr></thead><tbody>${blocks}</tbody></table>${title("MYTHRASF.Ranged.CoversTable")}<table class="tactical-cover-table"><thead><tr><th>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverSource"))}</th><th>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverProtection"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Contest.StatusLabel"))}</th><th><span>CCP</span><button type="button" class="sheet-icon-button tactical-help-button" data-tactical-action="explain-complete-cover" title="${escape(game.i18n.localize("MYTHRASF.Ranged.CompleteCover"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Ranged.CompleteCover"))}">?</button></th><th>${addButton("add-cover", game.i18n.localize("MYTHRASF.Ranged.DeclareCover"))}</th></tr></thead><tbody>${covers}</tbody></table>${renderReachReference()}</div>`;
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
async function createRelationFromDialog(combat) {
  const combatants = combat.combatants.filter((entry) => entry.actor); if (combatants.length < 2) return;
  const combatantOptions = (selected) => combatants.map((entry) => `<option value="${escape(entry.id)}" ${entry.id === selected ? "selected" : ""}>${escape(combatantDisplayName(entry))}</option>`).join("");
  const left = combatants[0]; const right = combatants[1];
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Reach.CreateRelation") },
    content: `<div class="mythras-foundry mythras-dialog"><div class="tactical-control-row"><select name="newLeft">${combatantOptions(left.id)}</select><select name="newLeftWeapon">${weaponOptions(combat, left.id)}</select></div><div class="tactical-control-row"><select name="newRight">${combatantOptions(right.id)}</select><select name="newRightWeapon">${weaponOptions(combat, right.id)}</select></div></div>`,
    render: (event, dialog) => { const form = dialog.element.querySelector("form");
      for (const [combatantName, weaponName] of [["newLeft", "newLeftWeapon"], ["newRight", "newRightWeapon"]]) {
        form.elements[combatantName].addEventListener("change", () => {
          form.elements[weaponName].innerHTML = weaponOptions(combat, form.elements[combatantName].value);
        });
      } },
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.Reach.CreateRelation"),
      callback: (event, button) => ({ left: selection(button.form.elements.newLeft.value,
        button.form.elements.newLeftWeapon.value), right: selection(button.form.elements.newRight.value,
        button.form.elements.newRightWeapon.value) }) }], rejectClose: false
  });
  if (!result || result.left.combatantId === result.right.combatantId
    || !result.left.weaponId || !result.right.weaponId) return;
  const leftCombatant = combat.combatants.get(result.left.combatantId);
  const rightCombatant = combat.combatants.get(result.right.combatantId);
  const weapon = leftCombatant.actor.items.get(result.left.weaponId);
  const mode = findWeaponMode(weapon, result.left.modeKey);
  const rightWeapon = rightCombatant.actor.items.get(result.right.weaponId);
  const rightMode = findWeaponMode(rightWeapon, result.right.modeKey);
  const relation = await ensureEngagement(combat, leftCombatant.actor, rightCombatant.actor, weapon, mode);
  if (relation && rightMode) {
    await setRelationWeapons(combat, relation.id, { [result.left.combatantId]: result.left,
      [result.right.combatantId]: result.right });
    await setRelationPosition(combat, relation.id, initialReachPosition(mode.reach, rightMode.reach),
      { status: "engaged", reason: "gmCreation" });
  }
}
function tacticalMenuContent(combat) { return renderTacticalOverview(combat); }
function activateTacticalMenu(dialog, combat) {
  const menu = dialog.window.content.querySelector(".tactical-overview-menu");
  const form = menu?.closest("form"); if (!menu || !form) return;
  const refresh = () => { const referenceOpen = menu.querySelector(".tactical-reach-reference")?.open;
    menu.innerHTML = tacticalMenuContent(combat);
    const reference = menu.querySelector(".tactical-reach-reference"); if (reference) reference.open = referenceOpen;
    activateTacticalMenu(dialog, combat); };
  for (const select of menu.querySelectorAll("[name='rowCoverCombatant']")) select.addEventListener("change", () => {
    const oldId = select.closest("[data-cover-row]").dataset.coverRow; const drafts = combatCoverDrafts(combat);
    drafts.delete(oldId); drafts.add(select.value); refresh();
  });
  const handleAction = async (event) => {
    event.preventDefault(); event.stopPropagation();
    const button = event.currentTarget;
    button.disabled = true;
    const action = button.dataset.tacticalAction;
    if (action === "add-relation") await createRelationFromDialog(combat);
    if (action === "add-cover") {
      const existing = new Set(Object.values(tacticalState(combat).covers ?? {})
        .filter((cover) => cover.status === "active").map((cover) => cover.combatantId));
      const candidate = combat.combatants.find((entry) => entry.actor
        && (game.user?.isGM || entry.actor.isOwner) && !existing.has(entry.id)
        && !combatCoverDrafts(combat).has(entry.id));
      if (candidate) combatCoverDrafts(combat).add(candidate.id);
    }
    if (action === "explain-complete-cover") await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MYTHRASF.Ranged.CompleteCover") },
      content: `<div class="mythras-foundry mythras-dialog"><p>${escape(game.i18n.localize(
        "MYTHRASF.Ranged.CompleteCoverExplanation"))}</p></div>`,
      buttons: [{ action: "close", label: game.i18n.localize("MYTHRASF.Close") }], rejectClose: false
    });
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
      const storedCover = tacticalState(combat).covers?.[combatantId];
      const current = storedCover?.status === "active" ? storedCover : null;
      await submitCoverDeclaration(combat, combatantId, { source: row.querySelector("[name='rowCoverSource']").value,
        protection: row.querySelector("[name='rowCoverProtection']").value,
        status: "active",
        complete: row.querySelector("[name='rowCoverComplete']").checked,
        locationIds: locationIds ?? current?.locationIds ?? [] });
      combatCoverDrafts(combat).delete(combatantId); };
    if (action === "save-cover-row") await saveCoverRow(button.dataset.combatantId);
    if (action === "edit-cover-locations") {
      const combatantId = button.dataset.combatantId; const storedCover = tacticalState(combat).covers?.[combatantId];
      const current = storedCover?.status === "active" ? storedCover : null;
      const result = await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize("MYTHRASF.Ranged.EditCoverLocations") },
        content: `<div class="mythras-foundry mythras-dialog tactical-cover-locations">${coverLocationControls(combat,
          combatantId, current?.locationIds)}</div>`, buttons: [{ action: "confirm",
          label: game.i18n.localize("MYTHRASF.CombatEffect.Confirm"), callback: (event, dialogButton) =>
            Array.from(dialogButton.form.querySelectorAll("[name='coverLocation']:checked"),
              (control) => control.value) }], rejectClose: false });
      if (result) await saveCoverRow(combatantId, result);
    }
    if (action === "remove-cover-row") {
      combatCoverDrafts(combat).delete(button.dataset.combatantId);
      await submitCoverDeclaration(combat, button.dataset.combatantId, "remove");
    }
    refresh();
  };
  for (const button of menu.querySelectorAll("[data-tactical-action]")) {
    button.addEventListener("click", handleAction);
  }
}
export async function openTacticalOverview() { const combat = game.combat; if (!combat) return;
  await foundry.applications.api.DialogV2.wait({ window: {
    title: game.i18n.localize("MYTHRASF.Reach.Overview"), resizable: true },
    position: { width: 480 },
    content: `<div class="mythras-foundry mythras-dialog tactical-overview-menu">${tacticalMenuContent(combat)}</div>`,
    buttons: [{ action: "close", label: game.i18n.localize("MYTHRASF.Close") }],
    render: (event, dialog) => activateTacticalMenu(dialog, combat), rejectClose: false });
}
