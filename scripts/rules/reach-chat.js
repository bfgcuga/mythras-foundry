import { classifyContestRoll } from "./contest-rolls.js";
import { opposedEffectWinner } from "./combat-effects.js";
import { currentActionPoints } from "./action-points.js";
import { engagementId } from "./engagements.js";
import { combatantForActor, ensureEngagement, longestPreparedWeapon,
  consumePassiveBlock, detailedReachEnabled, setRelationPosition,
  tacticalState } from "./engagement-runtime.js";
import { findWeaponMode, weaponModes } from "./weapon-modes.js";
import { difficultyTarget, resolveWeaponStyle } from "./combat.js";
import { createResolvedReactionAttack } from "./combat-chat.js";

const SCOPE = "mythras-foundry"; const SOCKET = "system.mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const coordinator = () => game.mythrasFoundry?.combat?.isCoordinator?.();
const pendingActors = new Set();
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
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</span><select name="target">${opponents.map((entry) => `<option value="${entry.id}">${escape(entry.name)}</option>`).join("")}</select></label><label><span>${escape(game.i18n.localize("MYTHRASF.Reach.IntentLabel"))}</span><select name="intent"><option value="shorter">${escape(game.i18n.localize("MYTHRASF.Reach.Intent.shorter"))}</option><option value="longer">${escape(game.i18n.localize("MYTHRASF.Reach.Intent.longer"))}</option><option value="disengage">${escape(game.i18n.localize("MYTHRASF.Reach.Intent.disengage"))}</option></select></label><label><span>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weapons.map(({ weapon, mode }) => `<option value="${escape(`${weapon.id}:${mode.key}`)}">${escape(weapon.name)} (${escape(mode.reach)})</option>`).join("")}</select></label></div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.Reach.Change"),
      callback: (event, button) => ({ targetId: button.form.elements.target.value,
        intent: button.form.elements.intent.value, weapon: button.form.elements.weapon.value }) }], rejectClose: false });
  if (!result || !await spend(actor)) return;
  const target = combat.combatants.get(result.targetId); const [weaponId, modeKey] = result.weapon.split(":");
  const weapon = actor.items.get(weaponId); const mode = findWeaponMode(weapon, modeKey);
  const relation = await ensureEngagement(combat, actor, target.actor, weapon, mode);
  const skill = evade(actor); const roll = await new Roll("1d100").evaluate();
  const state = { schemaVersion: 1, revision: 0, status: "awaitingResponse", combatId: combat.id,
    relationId: relation?.id ?? engagementId(active.id, target.id), actorCombatantId: active.id,
    targetCombatantId: target.id, actorUuid: actor.uuid, actorName: actor.name,
    targetUuid: target.actor.uuid, targetName: target.name, intent: result.intent,
    weaponId, modeKey, evade: { target: Number(skill.system.total ?? 0), rawRoll: roll.total,
      result: classifyContestRoll(roll.total, Number(skill.system.total ?? 0)) }, authorUserId: game.user.id };
  return ChatMessage.create({ content: render(state), flags: { [SCOPE]: { reachChange: state } } });
  } finally { pendingActors.delete(actor.uuid); }
}

async function respond(message, state, type) {
  const combat = game.combats.get(state.combatId); const target = combat?.combatants.get(state.targetCombatantId);
  const actor = target?.actor; if (!actor || (!game.user.isGM && !actor.isOwner)) return;
  let response = { type };
  if (type !== "none") {
    if (type === "evade") {
      const skill = evade(actor); if (!skill) return;
      const roll = await new Roll("1d100").evaluate(); response = { type, target: Number(skill.system.total ?? 0),
        rawRoll: roll.total, result: classifyContestRoll(roll.total, Number(skill.system.total ?? 0)) };
    } else {
      const selected = longestPreparedWeapon(actor); if (!selected) return;
      const styles = actor.items.filter((item) => item.type === "combatStyle");
      const resolved = resolveWeaponStyle({ weapon: { id: selected.weapon.id, name: selected.weapon.name,
        system: selected.mode }, styles, selectedStyleId: selected.mode.preferredCombatStyleId,
      familiarity: selected.mode.familiarity });
      const targetValue = difficultyTarget(resolved.target, resolved.difficulty); const roll = await new Roll("1d100").evaluate();
      response = { type, weaponId: selected.weapon.id, modeKey: selected.mode.key,
        target: targetValue, rawRoll: roll.total, result: classifyContestRoll(roll.total, targetValue) };
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

export function renderTacticalOverview(combat) {
  const state = tacticalState(combat); const rows = Object.values(state.relations ?? {}).map((relation) => {
    const sides = Object.values(relation.sides ?? {});
    const incomplete = sides.some((side) => {
      const weapon = combat.combatants.get(side.combatantId)?.actor?.items.get(side.weaponId);
      return !weapon || !weapon.system.equipped
        || !weaponModes(weapon).some((mode) => mode.key === side.modeKey);
    });
    return `<tr><td>${escape(sides[0]?.actorName)}</td><td>${escape(sides[1]?.actorName)}</td><td>${escape(incomplete ? game.i18n.localize("MYTHRASF.Reach.Incomplete") : relation.status)}</td><td>${escape(sides.map((side) => `${side.weaponName} (${side.reach})`).join(" / "))}</td><td>${escape(relation.position)}</td></tr>`;
  }).join("");
  const blocks = Object.values(state.passiveBlocks ?? {}).map((block) => `<tr><td>${escape(
    combat.combatants.get(block.combatantId)?.name)}</td><td>${escape(block.weaponName)}</td><td>${escape(
    block.locationIds?.map((id) => combat.combatants.get(block.combatantId)?.actor?.items.get(id)?.name)
      .filter(Boolean).join(", "))}</td><td>${escape(block.status)}</td></tr>`).join("");
  const covers = Object.values(state.covers ?? {}).map((cover) => `<tr><td>${escape(
    combat.combatants.get(cover.combatantId)?.name)}</td><td>${escape(cover.source)}</td><td>${escape(
    cover.locationIds?.map((id) => combat.combatants.get(cover.combatantId)?.actor?.items.get(id)?.name)
      .filter(Boolean).join(", "))}</td><td>${Number(cover.protection ?? 0)}</td></tr>`).join("");
  return `<div class="mythras-foundry mythras-dialog"><table><thead><tr><th>A</th><th>B</th><th>${escape(game.i18n.localize("MYTHRASF.Reach.Engagement"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Weapon.Reach"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Reach.Position"))}</th></tr></thead><tbody>${rows}</tbody></table><table><thead><tr><th>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</th><th>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Contest.StatusLabel"))}</th></tr></thead><tbody>${blocks}</tbody></table><table><thead><tr><th>${escape(game.i18n.localize("MYTHRASF.Combat.Defender"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverSource"))}</th><th>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</th><th>${escape(game.i18n.localize("MYTHRASF.Ranged.CoverProtection"))}</th></tr></thead><tbody>${covers}</tbody></table></div>`;
}
export async function openTacticalOverview() { const combat = game.combat; if (!combat) return;
  const relations = Object.values(tacticalState(combat).relations ?? {});
  const combatantOptions = combat.combatants.filter((entry) => entry.actor).map((entry) =>
    `<option value="${escape(entry.id)}">${escape(entry.name)}</option>`).join("");
  const edit = game.user.isGM && relations.length ? `<fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Reach.GmCorrection"))}</legend><select name="relation">${relations.map((entry) => `<option value="${escape(entry.id)}">${escape(Object.values(entry.sides).map((side) => side.actorName).join(" / "))}</option>`).join("")}</select><select name="position"><option value="longer">longer</option><option value="shorter">shorter</option><option value="neutral">neutral</option></select><select name="status"><option value="engaged">engaged</option><option value="disengaged">disengaged</option></select></fieldset>` : "";
  const create = game.user.isGM ? `<fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Reach.CreateRelation"))}</legend><select name="newLeft">${combatantOptions}</select><select name="newRight">${combatantOptions}</select></fieldset>` : "";
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Reach.Overview") },
    content: `${renderTacticalOverview(combat)}${edit}${create}`, buttons: [
      ...(game.user.isGM && relations.length ? [{ action: "correct",
        label: game.i18n.localize("MYTHRASF.Reach.ApplyCorrection"),
        callback: (event, button) => ({ relationId: button.form.elements.relation.value,
          position: button.form.elements.position.value, status: button.form.elements.status.value }) }] : []),
      ...(game.user.isGM ? [{ action: "create", label: game.i18n.localize("MYTHRASF.Reach.CreateRelation"),
        callback: (event, button) => ({ create: true, leftId: button.form.elements.newLeft.value,
          rightId: button.form.elements.newRight.value }) }] : []),
      { action: "close", label: game.i18n.localize("MYTHRASF.Close") }], rejectClose: false });
  if (result?.relationId) await setRelationPosition(combat, result.relationId, result.position,
    { status: result.status, reason: "gmCorrection" });
  if (result?.create && result.leftId !== result.rightId) {
    const left = combat.combatants.get(result.leftId); const right = combat.combatants.get(result.rightId);
    const selected = longestPreparedWeapon(left?.actor);
    if (left?.actor && right?.actor && selected) await ensureEngagement(combat, left.actor,
      right.actor, selected.weapon, selected.mode);
  }
}
