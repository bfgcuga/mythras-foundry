import { combatAttackHits, damageModifierFormula, difficultyTarget, evasionWinner, parryReduction,
  resolveCombatExchange, resolveDamage, resolveWeaponStyle } from "./combat.js";
import { findWeaponMode, weaponModeDisplayName, weaponModes, weaponModeView } from "./weapon-modes.js";
import { resolveActorConditions, actorLoadState } from "./actor-conditions.js";
import { invertD100 } from "./skill-roll.js";
import { findHitLocation, woundLevel } from "./hit-locations.js";
import { totalArmorPoints } from "./armor.js";
import { activateDelayedTooltips } from "../ui/tooltips.js";
import { classifyContestRoll } from "./contest-rolls.js";
import { combatEffectRule, eligibleCombatEffects, maximizeDamageFormula,
  opposedEffectWinner, selectedEffectCount, validateEffectSelections } from "./combat-effects.js";
import { currentActionPoints, effectiveActionPointMaximum } from "./action-points.js";
import { getActionPointRules } from "../settings.js";

const FLAG_SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const SCHEMA_VERSION = 5;
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);
const actorIdentity = (actor) => actor?.parent?.actorId ?? actor?.token?.actorId ?? actor?.id ?? null;
const tokenUuid = (token) => token?.document?.uuid ?? token?.uuid ?? "";
const pendingAttackActors = new Set();

function activeCombatForActor(actor) {
  const combat = game.combat ?? game.combats?.active;
  if (!combat?.started) return null;
  const candidates = combat.combatants.filter((entry) => entry.actor?.uuid === actor?.uuid
    || (actor?.token?.id && entry.tokenId === actor.token.id));
  if (candidates.length !== 1) return { combat, invalid: "participation" };
  return { combat, combatant: candidates[0] };
}

function combatTurnContext(actor) {
  const active = activeCombatForActor(actor);
  if (!active) return null;
  if (active.invalid) return { invalid: active.invalid };
  const { combat, combatant } = active;
  const simultaneousCombats = game.combats.filter((entry) => entry.started
    && entry.combatants.some((candidate) => candidate.actor?.uuid === actor.uuid));
  if (simultaneousCombats.length > 1) return { invalid: "multipleCombats" };
  if (combat.combatant?.id !== combatant.id) return { invalid: "turn" };
  if (effectiveActionPointMaximum(actor, getActionPointRules()) < 1
    || currentActionPoints(actor) < 1) return { invalid: "actionPoints" };
  const economy = combat.getFlag(FLAG_SCOPE, "turnEconomy") ?? {};
  return { combatUuid: combat.uuid, combatId: combat.id, combatantId: combatant.id,
    round: combat.round, cycle: economy.cycle ?? 1, turn: combat.turn,
    turnRevision: economy.revision ?? 0, attackSpent: false, defenseSpent: false,
    turnAdvanced: false };
}

async function spendActionPoint(actor) {
  const points = currentActionPoints(actor);
  if (points < 1) return false;
  await actor.update({ "system.resources.actionPoints.value": points - 1 });
  return true;
}

function exchangeTerminal(combat) {
  if (combat.status === "cancelled") return true;
  if (combat.status !== "resolved") return false;
  if ((combat.effects?.checks ?? []).some((entry) => entry.status === "pending")) return false;
  if ((combat.effects?.selections ?? []).some((entry) => entry.status === "pending")) return false;
  return ["unavailable", "applied"].includes(combat.damage?.status);
}

async function advanceCombatTurnForExchange(message, combat) {
  if (!combat.turnEconomy || combat.turnEconomy.turnAdvanced || !exchangeTerminal(combat)) return;
  const tracker = game.combats.get(combat.turnEconomy.combatId);
  if (!tracker?.started || tracker.combatant?.id !== combat.turnEconomy.combatantId
    || Number(tracker.round) !== Number(combat.turnEconomy.round)) return;
  combat.turnEconomy.turnAdvanced = true;
  combat.turnEconomy.advancedAt = Date.now();
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat),
    [`flags.${FLAG_SCOPE}.combat`]: combat });
  await tracker.nextTurn();
}

async function combatEffectDocuments() {
  const pack = game.packs.get(`${FLAG_SCOPE}.combat-effects`);
  if (!pack) return [];
  return pack.getDocuments();
}

const effectView = (item) => ({
  uuid: item.uuid, key: item.system.key, name: item.name,
  offensive: item.system.offensive, defensive: item.system.defensive,
  weaponRestriction: item.system.weaponRestriction, rollRestriction: item.system.rollRestriction,
  stackable: item.system.stackable, description: item.system.description,
  ...combatEffectRule({ key: item.system.key })
});

function effectContext(combat) {
  return { winner: combat.resolution?.winner,
    attackResult: combat.resolution?.attack?.result,
    defenseResult: combat.resolution?.defense?.result,
    weaponMode: combat.attacker.modeSnapshot,
    unarmed: combat.attacker.modeSnapshot?.key === "unarmed" };
}

async function combatActor(uuid, actorUuid) {
  const token = uuid ? await fromUuid(uuid) : null;
  return token?.actor ?? (actorUuid ? await fromUuid(actorUuid) : null);
}

function visibleTargets(actor) {
  return Array.from(canvas?.tokens?.placeables ?? []).filter((token) => token.actor
    && token.visible !== false && token.actor !== actor && token.actor?.uuid !== actor.uuid);
}

async function chooseAttackSetup(actor, suggestedTarget = null) {
  const targets = visibleTargets(actor);
  if (!targets.length) return ui.notifications.warn(localize("MYTHRASF.Combat.NoAvailableTargets"));
  const suggestedUuid = tokenUuid(suggestedTarget);
  const options = targets.map((token) => `<option value="${escape(tokenUuid(token))}" ${tokenUuid(token) === suggestedUuid ? "selected" : ""}>${escape(token.name)}</option>`).join("");
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.wait({ window: { title: localize("MYTHRASF.Combat.AttackSetup") },
    content: `<div class="mythras-foundry mythras-dialog combat-attack-setup"><fieldset><legend>${escape(localize("MYTHRASF.Combat.AttackSetup"))}</legend><label><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><select name="targetTokenUuid">${options}</select></label><label><span>${escape(localize("MYTHRASF.Combat.DefenseDeclaredBefore"))}</span><input type="checkbox" class="sheet-state-box" name="predeclared"></label><label><span>${escape(localize("MYTHRASF.Combat.ContainedBlow"))}</span><input type="checkbox" class="sheet-state-box" name="containedBlow"></label><label><span>${escape(localize("MYTHRASF.Combat.ExtraordinaryDamage"))}</span><input type="text" name="extraordinaryDamage" placeholder="0"></label></fieldset></div>`,
    buttons: [{ action: "attack", label: localize("MYTHRASF.Combat.Attack"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => ({ targetTokenUuid: button.form.elements.targetTokenUuid.value,
        predeclared: button.form.elements.predeclared.checked,
        containedBlow: button.form.elements.containedBlow.checked,
        extraordinaryDamage: button.form.elements.extraordinaryDamage.value.trim() || "0" }) },
    { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }], rejectClose: false });
}

export function preferredCombatCoordinator(users, authorUserId) {
  const gm = Array.from(users ?? []).filter((user) => user.active && user.isGM)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
  return gm?.id ?? Array.from(users ?? []).find((user) => user.id === authorUserId && user.active)?.id ?? null;
}

export async function createAttackMessage({ actor, weapon, mode, resolution, target = null }) {
  if (pendingAttackActors.has(actor.uuid)) return null;
  pendingAttackActors.add(actor.uuid);
  try {
  const setup = await chooseAttackSetup(actor, target);
  if (!setup) return null;
  const targetToken = await fromUuid(setup.targetTokenUuid);
  const defender = targetToken?.actor;
  if (!defender) return ui.notifications.warn(localize("MYTHRASF.Combat.TargetUnavailable"));
  const turnEconomy = combatTurnContext(actor);
  if (turnEconomy?.invalid) return ui.notifications.warn(localize(
    `MYTHRASF.Tracker.Rejected.${turnEconomy.invalid}`));
  if (turnEconomy) {
    const defenderEntry = game.combats.get(turnEconomy.combatId)?.combatants.find((entry) =>
      entry.token?.uuid === setup.targetTokenUuid || entry.actor?.uuid === defender.uuid);
    if (!defenderEntry) return ui.notifications.warn(localize(
      "MYTHRASF.Tracker.Rejected.participation"));
    turnEconomy.defenderCombatantId = defenderEntry.id;
  }
  if (turnEconomy && !await spendActionPoint(actor)) {
    return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.actionPoints"));
  }
  if (turnEconomy) {
    turnEconomy.attackSpent = true;
  }
  const roll = await new Roll("1d100").evaluate();
  const targetValue = difficultyTarget(resolution.target, resolution.difficulty);
  const styleName = resolution.untrained ? localize("MYTHRASF.Combat.Untrained")
    : resolution.usesBase ? localize("MYTHRASF.Combat.BaseStyle") : resolution.style?.name ?? "";
  const combat = { schemaVersion: SCHEMA_VERSION, revision: 0, status: "awaitingDefense",
    authorUserId: game.user.id, predeclared: Boolean(setup.predeclared),
    declarations: { containedBlow: Boolean(setup.containedBlow),
      extraordinaryDamage: setup.extraordinaryDamage },
    attacker: { actorUuid: actor.uuid, actorId: actorIdentity(actor), actorName: actor.name,
      tokenUuid: actor.token?.uuid ?? "", weaponId: weapon.id, weaponName: weapon.name,
      modeKey: mode.key, modeName: mode.name, styleId: resolution.style?.id ?? "", styleName,
      difficulty: resolution.difficulty, baseTarget: resolution.target, target: targetValue,
      damage: mode.damage, damageModifierMode: mode.damageModifierMode, weaponSize: mode.size,
      modeSnapshot: { key: mode.key, weaponType: mode.weaponType, size: mode.size,
        impalingSize: mode.impalingSize, handsRequired: mode.handsRequired, effects: mode.effects },
      rawRoll: roll.total, serializedRoll: roll.toJSON(), luckHistory: [] },
    defender: { actorUuid: defender.uuid, actorId: actorIdentity(defender), actorName: defender.name,
      tokenUuid: setup.targetTokenUuid, defense: null, luckHistory: [], size: defender.system.size,
      locations: defender.items.filter((item) => item.type === "hitLocation").map((item) => ({
        id: item.id, name: item.name, rangeStart: item.system.rangeStart, rangeEnd: item.system.rangeEnd
      })) }, resolution: null, damage: { status: "unavailable" }, turnEconomy };
  if (!combat.predeclared) combat.attackClassification = resolveCombatExchange({
    attack: { target: targetValue, rawRoll: roll.total }, defense: { type: "none" }
  }).attack;
  const messageData = { speaker: ChatMessage.getSpeaker({ actor }), content: renderCombatExchange(combat),
    flags: { [FLAG_SCOPE]: { combat } }, rolls: [roll] };
  ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
  } finally { pendingAttackActors.delete(actor.uuid); }
}

function effectiveDifficulty(actor, baseDifficulty = "standard") {
  return resolveActorConditions(actor, { baseAttributes: actor.system.baseAttributes ?? actor.system.attributes ?? {},
    baseDifficulty, physical: true, loadState: actorLoadState(actor) }).difficulty;
}

function parryChoices(actor) {
  const styles = actor.items.filter((item) => item.type === "combatStyle");
  const choices = actor.items.filter((item) => item.type === "weapon" && item.system.equipped)
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => mode.key === weapon.system.activeModeKey)
      .flatMap((mode) => styles.map((style) => {
        const resolved = resolveWeaponStyle({ weapon: weaponModeView(weapon, mode), styles,
          selectedStyleId: style.id, familiarity: mode.familiarity });
        if (!resolved.style && !resolved.usesBase) return null;
        const difficulty = effectiveDifficulty(actor, resolved.difficulty);
        if (difficulty === "impossible") return null;
        return { value: `${weapon.id}:${mode.key}:${resolved.style?.id ?? ""}`,
          weaponId: weapon.id, weaponName: weapon.name, modeKey: mode.key,
          modeName: weaponModeDisplayName(weapon, mode), styleId: resolved.style?.id ?? "",
          styleName: resolved.usesBase ? localize("MYTHRASF.Combat.BaseStyle") : resolved.style?.name ?? "",
          difficulty, baseTarget: resolved.target, target: difficultyTarget(resolved.target, difficulty),
          weaponSize: mode.size };
      }).filter(Boolean)));
  return [...new Map(choices.map((choice) => [choice.value, choice])).values()];
}

async function defenseConfiguration(actor, type) {
  if (type === "none") return { type: "none" };
  if (type === "evade") {
    const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === "evadir");
    if (!skill) return ui.notifications.warn(localize("MYTHRASF.Combat.EvadeMissing"));
    const difficulty = effectiveDifficulty(actor);
    if (difficulty === "impossible") return ui.notifications.warn(localize("MYTHRASF.Fatigue.NoActivity"));
    return { type, abilityId: skill.id, abilityName: skill.name, difficulty,
      baseTarget: Number(skill.system.total ?? 0), target: difficultyTarget(skill.system.total, difficulty) };
  }
  const choices = parryChoices(actor);
  if (!choices.length) return ui.notifications.warn(localize("MYTHRASF.Combat.NoParryAvailable"));
  const { DialogV2 } = foundry.applications.api;
  const selected = await DialogV2.wait({ window: { title: localize("MYTHRASF.Combat.ChooseParry") },
    content: `<div class="mythras-foundry mythras-dialog combat-defense-dialog"><fieldset><legend>${escape(localize("MYTHRASF.Combat.Parry"))}</legend><label><span>${escape(localize("MYTHRASF.Combat.WeaponAndStyle"))}</span><select name="choice">${choices.map((choice) => `<option value="${escape(choice.value)}">${escape(choice.modeName)} — ${escape(choice.styleName)} (${choice.target}%)</option>`).join("")}</select></label></fieldset></div>`,
    buttons: [{ action: "roll", label: localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => button.form.elements.choice.value },
    { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }], rejectClose: false });
  return selected ? { type, ...choices.find((choice) => choice.value === selected) } : null;
}

export function validateCombatResponse(combat, request, { actor, user }) {
  if (combat.status !== "awaitingDefense") return "state";
  if (Number(request.revision) !== Number(combat.revision)) return "revision";
  if (!user || user.id !== request.userId || (!user.isGM && !actor?.testUserPermission(user, "OWNER"))) return "ownership";
  if (!["parry", "evade", "none"].includes(request.defense?.type)) return "invalid";
  return null;
}

async function respondToAttack(message, combat, type) {
  const actor = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner)) return;
  const defense = await defenseConfiguration(actor, type);
  if (!defense) return;
  const roll = type === "none" ? null : await new Roll("1d100").evaluate();
  const request = { action: "combatDefense", messageId: message.id, revision: combat.revision,
    userId: game.user.id, defense: { ...defense, rawRoll: roll?.total ?? null,
      serializedRoll: roll?.toJSON?.() ?? null } };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyCombatDefense(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyCombatDefense(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  const actor = await combatActor(combat?.defender?.tokenUuid, combat?.defender?.actorUuid);
  const invalid = combat && validateCombatResponse(combat, request, { actor, user: game.users.get(request.userId) });
  if (!combat || invalid) return ui.notifications.warn(localize(`MYTHRASF.Combat.Rejected.${invalid ?? "state"}`));
  if (request.defense.type !== "none" && combat.turnEconomy && !combat.turnEconomy.defenseSpent) {
    const tracker = game.combats.get(combat.turnEconomy.combatId);
    const defenderEntry = tracker?.combatants.get(combat.turnEconomy.defenderCombatantId);
    if (!tracker?.started || defenderEntry?.actor?.uuid !== actor.uuid) {
      return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.participation"));
    }
    if (effectiveActionPointMaximum(actor, getActionPointRules()) < 1
      || !await spendActionPoint(actor)) {
      return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.actionPoints"));
    }
    combat.turnEconomy.defenseSpent = true;
    combat.turnEconomy.defenseSpentBy = request.userId;
  }
  combat.defender.defense = request.defense;
  combat.resolution = resolveCombatExchange({ predeclared: combat.predeclared,
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll }, defense: request.defense });
  combat.effects = { winner: combat.resolution.winner, slots: combat.resolution.effects,
    selections: [], confirmed: combat.resolution.effects === 0, checks: [] };
  combat.status = combat.resolution.effects > 0 ? "awaitingEffects" : "resolved";
  combat.damage = { status: combat.resolution.effects > 0 ? "blocked"
    : combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

async function chooseCombatEffects(message, combat) {
  const winnerEntry = combat.effects?.winner === "attacker" ? combat.attacker : combat.defender;
  const actor = await combatActor(winnerEntry?.tokenUuid, winnerEntry?.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner) || combat.status !== "awaitingEffects") return;
  const catalog = (await combatEffectDocuments()).map(effectView);
  const eligible = eligibleCombatEffects(catalog, effectContext(combat));
  const options = [`<option value="__waive__">${escape(localize("MYTHRASF.CombatEffect.Waive"))}</option>`,
    ...eligible.map((effect) => `<option value="${escape(effect.key)}">${escape(effect.name)}</option>`)]
    .join("");
  const locationOptions = (combat.defender.locations ?? []).map((location) =>
    `<option value="${escape(location.id)}">${escape(location.name)}</option>`).join("");
  const rows = Array.from({ length: combat.effects.slots }, (_, index) =>
    `<fieldset><legend>${escape(game.i18n.format("MYTHRASF.CombatEffect.Slot", { slot: index + 1 }))}</legend><select name="effect-${index}">${options}</select><label><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select name="location-${index}">${locationOptions}</select></label><label><span>${escape(localize("MYTHRASF.CombatEffect.Parameters"))}</span><textarea name="note-${index}"></textarea></label></fieldset>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.CombatEffect.Select") },
    content: `<div class="mythras-foundry mythras-dialog combat-effect-dialog">${rows}</div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"),
      icon: "fas fa-check", default: true, callback: (event, button) =>
        Array.from({ length: combat.effects.slots }, (_, index) => ({
          key: button.form.elements[`effect-${index}`].value,
          locationId: button.form.elements[`location-${index}`].value,
          note: button.form.elements[`note-${index}`].value.trim()
        })) }, { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }],
    rejectClose: false
  });
  if (!result) return;
  const selections = result.map((selected, index) => {
    if (selected.key === "__waive__") return { slot: index, waived: true };
    const effect = eligible.find((entry) => entry.key === selected.key);
    return { slot: index, waived: false, ...effect,
      parameters: { locationId: selected.locationId, note: selected.note },
      status: effect.requiresWound ? "conditional" : effect.ruleKey === "guided" ? "pending" : "active" };
  });
  const request = { action: "combatEffects", messageId: message.id, revision: combat.revision,
    userId: game.user.id, selections };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatEffects(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function applyCombatEffects(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || combat.status !== "awaitingEffects"
    || Number(request.revision) !== Number(combat.revision)) return;
  const winnerEntry = combat.effects.winner === "attacker" ? combat.attacker : combat.defender;
  const actor = await combatActor(winnerEntry.tokenUuid, winnerEntry.actorUuid);
  const user = game.users.get(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  const catalog = (await combatEffectDocuments()).map(effectView);
  const validation = validateEffectSelections({ slots: combat.effects.slots,
    selections: request.selections, effects: catalog, context: effectContext(combat) });
  if (!validation.valid) return ui.notifications.warn(localize("MYTHRASF.CombatEffect.Invalid"));
  const catalogByKey = new Map(catalog.map((effect) => [effect.key, effect]));
  combat.effects.selections = request.selections.map((selection, index) => {
    if (selection.waived) return { slot: index, waived: true };
    const effect = catalogByKey.get(selection.key);
    return { slot: index, waived: false, ...effect,
      parameters: { locationId: String(selection.parameters?.locationId ?? ""),
        note: String(selection.parameters?.note ?? "") },
      status: effect.requiresWound ? "conditional"
        : effect.ruleKey === "guided" ? "pending" : "active" };
  });
  combat.effects.confirmed = true;
  combat.effects.confirmedBy = user.id;
  combat.effects.confirmedAt = Date.now();
  combat.status = "resolved";
  combat.damage = { status: combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

async function cancelCombat(message, current) {
  if (!game.user.isGM || !["awaitingDefense", "awaitingEffects"].includes(current.status)) return;
  const combat = foundry.utils.deepClone(current);
  if (current.status === "awaitingEffects") {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: localize("MYTHRASF.Contest.Cancel") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.CombatEffect.Reason"))}</span><textarea name="reason" required></textarea></label></div>`,
      buttons: [{ action: "cancel", label: localize("MYTHRASF.Contest.Cancel"),
        callback: (event, button) => button.form.elements.reason.value.trim() },
      { action: "back", label: localize("MYTHRASF.Cancel") }], rejectClose: false
    });
    if (!result) return;
    combat.cancelReason = result;
    combat.cancelledBy = game.user.id;
  }
  combat.status = "cancelled"; combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

async function closeCombatExchange(message, current) {
  if (!game.user.isGM || !current.turnEconomy || current.turnEconomy.turnAdvanced) return;
  const reason = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.Tracker.CloseExchange") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.CombatEffect.Reason"))}</span><textarea name="reason" required></textarea></label></div>`,
    buttons: [{ action: "close", label: localize("MYTHRASF.Tracker.CloseExchange"),
      callback: (event, button) => button.form.elements.reason.value.trim() },
    { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false
  });
  if (!reason) return;
  const combat = foundry.utils.deepClone(current);
  combat.status = "cancelled";
  combat.cancelReason = reason;
  combat.cancelledBy = game.user.id;
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat),
    [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

async function spendCombatLuck(message, current, side) {
  const entry = side === "attacker" ? current.attacker : current.defender;
  const actor = await combatActor(entry.tokenUuid, entry.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner) || Number(actor.system.resources?.luckPoints?.value ?? 0) < 1)
    return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  if (side === "defender" && !entry.defense?.rawRoll) return;
  const currentRoll = side === "attacker" ? entry.rawRoll : entry.defense.rawRoll;
  const { DialogV2 } = foundry.applications.api;
  const choice = await DialogV2.wait({ window: { title: localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><p>${escape(localize("MYTHRASF.Luck.Confirm"))}</p></div>`,
    buttons: [{ action: "reroll", label: localize("MYTHRASF.Luck.Reroll"), icon: "fas fa-dice-d20" },
      { action: "invert", label: localize("MYTHRASF.Luck.Invert"), icon: "fas fa-arrow-right-arrow-left" },
      { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }], rejectClose: false });
  if (!choice) return;
  const rawRoll = choice === "reroll" ? (await new Roll("1d100").evaluate()).total : invertD100(currentRoll);
  await actor.update({ "system.resources.luckPoints.value": Number(actor.system.resources.luckPoints.value) - 1 });
  const request = { action: "combatLuck", messageId: message.id, revision: current.revision,
    userId: game.user.id, side, rawRoll, luckAlreadySpent: true };
  if (preferredCombatCoordinator(game.users, current.authorUserId) === game.user.id) await applyCombatLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyCombatLuck(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)
    || !["awaitingDefense", "awaitingEffects", "resolved"].includes(combat.status)
    || (combat.status === "resolved" && combat.effects?.confirmed)
    || !["attacker", "defender"].includes(request.side)) return;
  const entry = request.side === "attacker" ? combat.attacker : combat.defender;
  const actor = await combatActor(entry.tokenUuid, entry.actorUuid);
  const user = game.users.get(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  if (request.side === "defender" && !entry.defense?.rawRoll) return;
  if (!request.luckAlreadySpent) {
    const points = Number(actor.system.resources?.luckPoints?.value ?? 0);
    if (points < 1) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
    await actor.update({ "system.resources.luckPoints.value": points - 1 });
  }
  const currentRoll = request.side === "attacker" ? entry.rawRoll : entry.defense.rawRoll;
  entry.luckHistory = [...(entry.luckHistory ?? []), currentRoll];
  if (request.side === "attacker") entry.rawRoll = Number(request.rawRoll);
  else entry.defense.rawRoll = Number(request.rawRoll);
  if (["resolved", "awaitingEffects"].includes(combat.status)) combat.resolution = resolveCombatExchange({ predeclared: combat.predeclared,
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll }, defense: combat.defender.defense });
  else if (!combat.predeclared) combat.attackClassification = resolveCombatExchange({
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll }, defense: { type: "none" } }).attack;
  if (combat.status === "awaitingEffects") {
    combat.effects = { winner: combat.resolution.winner, slots: combat.resolution.effects,
      selections: [], confirmed: combat.resolution.effects === 0, checks: [] };
    if (!combat.resolution.effects) {
      combat.status = "resolved";
      combat.damage = { status: combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
    }
  }
  combat.revision += 1;
  if (combat.status === "resolved" && ["ready", "unavailable"].includes(combat.damage?.status)) {
    combat.damage = { status: combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  }
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
}

async function requestCombatDamage(message, combat) {
  const actor = await combatActor(combat.attacker.tokenUuid, combat.attacker.actorUuid);
  const guidedPending = (combat.effects?.selections ?? []).some((effect) =>
    effect.status === "pending" && !effect.requiresWound);
  if (!actor || (!game.user.isGM && !actor.isOwner) || combat.damage?.status !== "ready"
    || guidedPending) return;
  const weapon = actor.items.get(combat.attacker.weaponId);
  const mode = weapon ? findWeaponMode(weapon, combat.attacker.modeKey) : null;
  if (!weapon || !mode) return ui.notifications.warn(localize("MYTHRASF.Combat.SourceMissing"));
  const modifier = damageModifierFormula(actor.system.attributes?.damageModifier, mode.damageModifierMode) || "0";
  const extraordinary = combat.declarations?.extraordinaryDamage || "0";
  const maximizeCount = selectedEffectCount(combat.effects?.selections ?? [], "maximizeDamage");
  const weaponDamage = maximizeDamageFormula(mode.damage || "0", maximizeCount);
  const formula = `max(0, (${weaponDamage}) + (${modifier}) + (${extraordinary}))`;
  let roll;
  try { roll = await new Roll(formula).evaluate(); }
  catch { return ui.notifications.warn(localize("MYTHRASF.Combat.InvalidDamageFormula")); }
  let alternateRoll = null;
  if (selectedEffectCount(combat.effects?.selections ?? [], "impale")) {
    alternateRoll = await new Roll(formula).evaluate();
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: localize("MYTHRASF.CombatEffect.ImpaleChoice") },
      content: `<div class="mythras-foundry mythras-dialog"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.CombatEffect.FirstRoll"))}</span><strong class="mythras-chat-roll-value">${roll.total}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.CombatEffect.SecondRoll"))}</span><strong class="mythras-chat-roll-value">${alternateRoll.total}</strong></div></div>`,
      buttons: [{ action: "first", label: `${localize("MYTHRASF.CombatEffect.FirstRoll")}: ${roll.total}` },
        { action: "second", label: `${localize("MYTHRASF.CombatEffect.SecondRoll")}: ${alternateRoll.total}` }],
      rejectClose: false
    });
    if (!choice) return;
    if (choice === "second") [roll, alternateRoll] = [alternateRoll, roll];
  }
  let chosenLocation = (combat.effects?.selections ?? []).find((entry) =>
    entry.ruleKey === "chooseLocation")?.parameters?.locationId;
  const locationRoll = chosenLocation ? null : await new Roll("1d20").evaluate();
  let rolledLocationId = "";
  if (locationRoll && selectedEffectCount(combat.effects?.selections ?? [], "aimedShot")) {
    const locations = combat.defender.locations ?? [];
    const rolledLocation = findHitLocation(locations.map((entry) => ({ ...entry,
      system: { rangeStart: entry.rangeStart, rangeEnd: entry.rangeEnd } })), locationRoll.total);
    rolledLocationId = rolledLocation?.id ?? "";
    const index = locations.findIndex((entry) => entry.id === rolledLocationId);
    const adjacent = locations.filter((entry, candidate) => Math.abs(candidate - index) <= 1);
    chosenLocation = await foundry.applications.api.DialogV2.wait({
      window: { title: localize("MYTHRASF.CombatEffect.ChooseLocation") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select name="location">${adjacent.map((entry) => `<option value="${escape(entry.id)}" ${entry.id === rolledLocationId ? "selected" : ""}>${escape(entry.name)}</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"),
        callback: (event, button) => button.form.elements.location.value }], rejectClose: false
    });
    if (!chosenLocation) return;
  }
  const request = { action: "combatDamage", messageId: message.id, revision: combat.revision,
    userId: game.user.id, formula, rawRoll: roll.total, serializedRoll: roll.toJSON(),
    alternateRoll: alternateRoll ? { rawRoll: alternateRoll.total,
      serializedRoll: alternateRoll.toJSON() } : null,
    locationRoll: locationRoll?.total ?? null, rolledLocationId,
    locationId: chosenLocation ?? "" };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyCombatDamage(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyCombatDamage(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || combat.damage?.status !== "ready" || Number(request.revision) !== Number(combat.revision)) return;
  const actor = await combatActor(combat.attacker.tokenUuid, combat.attacker.actorUuid);
  const user = game.users.get(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  const location = request.locationId ? (combat.defender.locations ?? []).find((entry) =>
    entry.id === request.locationId) : findHitLocation((combat.defender.locations ?? []).map((entry) => ({
    id: entry.id, name: entry.name, system: { rangeStart: entry.rangeStart, rangeEnd: entry.rangeEnd }
  })), request.locationRoll);
  combat.damage = { status: "rolled", formula: request.formula, rawRoll: Number(request.rawRoll),
    serializedRoll: request.serializedRoll, alternateRoll: request.alternateRoll,
    luckHistory: [], locationRoll: request.locationRoll == null ? null : Number(request.locationRoll),
    rolledLocationId: request.rolledLocationId ?? "",
    locationId: location?.id ?? "" };
  combat.revision += 1;
  await refreshDamageProposal(combat);
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
}

async function requestDamageLuck(message, combat) {
  const actor = await combatActor(combat.attacker.tokenUuid, combat.attacker.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner)
    || Number(actor.system.resources?.luckPoints?.value ?? 0) < 1
    || !["proposed", "stale"].includes(combat.damage?.status)) return;
  let roll;
  try { roll = await new Roll(combat.damage.formula).evaluate(); }
  catch { return ui.notifications.warn(localize("MYTHRASF.Combat.InvalidDamageFormula")); }
  await actor.update({ "system.resources.luckPoints.value": Number(actor.system.resources.luckPoints.value) - 1 });
  const request = { action: "combatDamageLuck", messageId: message.id, revision: combat.revision,
    userId: game.user.id, rawRoll: roll.total, serializedRoll: roll.toJSON() };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyDamageLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyDamageLuck(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || !["proposed", "stale"].includes(combat.damage?.status)
    || Number(request.revision) !== Number(combat.revision)) return;
  const actor = await combatActor(combat.attacker.tokenUuid, combat.attacker.actorUuid);
  const user = game.users.get(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  combat.damage.luckHistory = [...(combat.damage.luckHistory ?? []), combat.damage.rawRoll];
  combat.damage.rawRoll = Number(request.rawRoll);
  combat.damage.serializedRoll = request.serializedRoll;
  combat.effects.checks = [];
  for (const effect of combat.effects.selections ?? []) {
    if (effect.requiresWound) effect.status = "conditional";
  }
  await refreshDamageProposal(combat);
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
}

async function refreshDamageProposal(combat, requestedLocationId = null) {
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  const locationId = requestedLocationId ?? combat.damage.locationId;
  const location = defender?.items.get(locationId);
  if (!defender || !location || location.type !== "hitLocation") {
    combat.damage.status = "stale";
    return;
  }
  const armor = totalArmorPoints(location,
    defender.items.filter((item) => item.type === "armor"));
  const defense = combat.defender.defense;
  let parry = defense?.type === "parry" && ["success", "critical"].includes(combat.resolution.defense.result)
    ? parryReduction(combat.attacker.weaponSize, defense.weaponSize) : { type: "none" };
  if (selectedEffectCount(combat.effects?.selections ?? [], "improveParry")) parry = { type: "full" };
  if (selectedEffectCount(combat.effects?.selections ?? [], "bypassParry")) parry = { type: "none" };
  const effectiveArmor = selectedEffectCount(combat.effects?.selections ?? [], "bypassArmor") ? 0 : armor;
  const calculation = resolveDamage({ rolledDamage: combat.damage.rawRoll,
    containedBlow: combat.declarations?.containedBlow, parry, armorPoints: effectiveArmor,
    targetSize: defender.system.size });
  const before = Number(location.system.currentHitPoints ?? 0);
  const after = before - calculation.penetratingDamage;
  if (!selectedEffectCount(combat.effects?.selections ?? [], "bash")) {
    calculation.push = { triggered: false, excess: 0, distance: 0 };
  }
  const resulting = woundLevel(after, location.system.maxHitPoints);
  const previousChecks = new Map((combat.effects?.checks ?? []).map((check) => [check.id, check]));
  const checks = [];
  (combat.effects?.selections ?? []).forEach((effect, order) => {
    if (effect.requiresWound) effect.status = calculation.penetratingDamage > 0
      ? effect.status === "resolved" ? "resolved" : "pending" : "notActivated";
    if (effect.endurance && calculation.penetratingDamage > 0) checks.push({
      id: `effect-${effect.slot}`, source: "effect", order, effectKey: effect.key,
      label: effect.name, status: previousChecks.get(`effect-${effect.slot}`)?.status ?? "pending",
      resolution: previousChecks.get(`effect-${effect.slot}`)?.resolution
    });
  });
  if (["serious", "major"].includes(resulting)) checks.push({ id: `wound-${location.id}`,
    source: "wound", order: checks.length, label: resulting,
    status: previousChecks.get(`wound-${location.id}`)?.status ?? "pending",
    resolution: previousChecks.get(`wound-${location.id}`)?.resolution });
  combat.effects.checks = checks;
  Object.assign(combat.damage, calculation, { status: "proposed", locationId: location.id,
    locationName: location.name, armorSnapshot: armor, beforeHitPoints: before,
    maxHitPoints: Number(location.system.maxHitPoints ?? 1), afterHitPoints: after,
    previousWound: woundLevel(before, location.system.maxHitPoints),
    resultingWound: resulting });
}

async function requestApplyDamage(message, combat, locationId) {
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  if (!defender || (!game.user.isGM && !defender.isOwner)) return;
  const request = { action: "combatApplyDamage", messageId: message.id, revision: combat.revision,
    userId: game.user.id, locationId };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyProposedDamage(message, request);
  else game.socket.emit(SOCKET, request);
}

async function requestCombatCheck(message, combat, checkId, manual = false) {
  const check = (combat.effects?.checks ?? []).find((entry) => entry.id === checkId);
  const firstPending = (combat.effects?.checks ?? []).find((entry) => entry.status === "pending");
  if (!check || check.status !== "pending" || firstPending?.id !== check.id) return;
  if (check.source === "wound" && (combat.effects?.selections ?? [])
    .some((effect) => effect.status === "pending")) return;
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  if (!defender || (!game.user.isGM && !defender.isOwner)) return;
  if (manual && !game.user.isGM) return;
  let resolution = { manual: true };
  if (manual) {
    const note = await foundry.applications.api.DialogV2.wait({
      window: { title: check.label },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.CombatEffect.ResolutionNote"))}</span><textarea name="note" required></textarea></label></div>`,
      buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.ResolveManual"),
        callback: (event, button) => button.form.elements.note.value.trim() },
      { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false
    });
    if (!note) return;
    resolution.note = note;
  }
  if (!manual) {
    const skill = defender.items.find((item) => item.type === "skill" && item.system.slug === "aguante");
    if (!skill) return ui.notifications.warn(localize("MYTHRASF.Combat.SourceMissing"));
    const roll = await new Roll("1d100").evaluate();
    const target = Number(skill.system.total ?? 0);
    resolution = { manual: false, abilityId: skill.id, abilityName: skill.name,
      target, rawRoll: roll.total, serializedRoll: roll.toJSON(),
      result: classifyContestRoll(roll.total, target) };
    resolution.opposed = { rawRoll: combat.resolution.attack.rawRoll,
      target: combat.resolution.attack.target, result: combat.resolution.attack.result };
    resolution.winner = opposedEffectWinner(resolution, resolution.opposed);
  }
  const request = { action: "combatCheck", messageId: message.id, revision: combat.revision,
    userId: game.user.id, checkId, resolution };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatCheck(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function requestResolveEffect(message, combat, slot) {
  const effect = (combat.effects?.selections ?? []).find((entry) => Number(entry.slot) === Number(slot));
  if (!effect || effect.status !== "pending") return;
  if ((combat.effects?.checks ?? []).some((check) => check.effectKey === effect.key
    && check.status === "pending")) return;
  const selfSide = combat.effects.winner;
  const affectedSide = effect.target === "self" ? selfSide
    : selfSide === "attacker" ? "defender" : "attacker";
  const affectedEntry = affectedSide === "attacker" ? combat.attacker : combat.defender;
  const affected = await combatActor(affectedEntry.tokenUuid, affectedEntry.actorUuid);
  if (!game.user.isGM && !affected?.isOwner) return;
  const note = await foundry.applications.api.DialogV2.wait({
    window: { title: effect.name },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.CombatEffect.ResolutionNote"))}</span><textarea name="note">${escape(effect.parameters?.note ?? "")}</textarea></label></div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.ResolveManual"),
      callback: (event, button) => button.form.elements.note.value.trim() },
    { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false
  });
  if (note == null) return;
  const request = { action: "combatResolveEffect", messageId: message.id,
    revision: combat.revision, userId: game.user.id, slot: effect.slot, note };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyResolvedEffect(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function applyResolvedEffect(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)) return;
  const user = game.users.get(request.userId);
  if (!user) return;
  const effect = (combat.effects?.selections ?? []).find((entry) =>
    Number(entry.slot) === Number(request.slot));
  if (!effect || effect.status !== "pending") return;
  const selfSide = combat.effects.winner;
  const affectedSide = effect.target === "self" ? selfSide
    : selfSide === "attacker" ? "defender" : "attacker";
  const affectedEntry = affectedSide === "attacker" ? combat.attacker : combat.defender;
  const affected = await combatActor(affectedEntry.tokenUuid, affectedEntry.actorUuid);
  if (!affected || (!user.isGM && !affected.testUserPermission(user, "OWNER"))) return;
  if ((combat.effects?.checks ?? []).some((check) => check.effectKey === effect.key
    && check.status === "pending")) return;
  effect.status = "resolved";
  effect.resolution = { manual: true, note: String(request.note ?? ""),
    userId: user.id, resolvedAt: Date.now() };
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
}

async function applyCombatCheck(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)) return;
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  const user = game.users.get(request.userId);
  if (!defender || !user || (!user.isGM && !defender.testUserPermission(user, "OWNER"))) return;
  const check = (combat.effects?.checks ?? []).find((entry) => entry.id === request.checkId);
  const firstPending = (combat.effects?.checks ?? []).find((entry) => entry.status === "pending");
  if (!check || check.status !== "pending" || firstPending?.id !== check.id
    || (request.resolution?.manual && !user.isGM)) return;
  if (check.source === "wound" && (combat.effects?.selections ?? [])
    .some((effect) => effect.status === "pending")) return;
  check.status = "resolved";
  check.resolution = { ...request.resolution, userId: user.id, resolvedAt: Date.now() };
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
}

async function applyProposedDamage(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || !["proposed", "stale"].includes(combat.damage?.status)
    || Number(request.revision) !== Number(combat.revision)) return;
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  const user = game.users.get(request.userId);
  if (!defender || !user || (!user.isGM && !defender.testUserPermission(user, "OWNER"))) return;
  if (!damageLocationChoices(combat).some((location) => location.id === request.locationId)) return;
  if (request.locationId !== combat.damage.locationId) {
    combat.effects.checks = [];
    for (const effect of combat.effects.selections ?? []) {
      if (effect.requiresWound) effect.status = "conditional";
    }
    await refreshDamageProposal(combat, request.locationId);
    combat.revision += 1;
    return message.update({ content: renderCombatExchange(combat),
      [`flags.${FLAG_SCOPE}.combat`]: combat });
  }
  if ((combat.effects?.checks ?? []).some((check) => check.status === "pending")) return;
  if ((combat.effects?.selections ?? []).some((effect) => effect.status === "pending")) return;
  if (combat.damage.status === "stale") {
    await refreshDamageProposal(combat, request.locationId);
    combat.revision += 1;
    return message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  }
  const selectedLocation = defender.items.get(request.locationId);
  const sameProposal = request.locationId === combat.damage.locationId;
  const expectedHitPoints = combat.damage.beforeHitPoints;
  const currentArmor = selectedLocation ? totalArmorPoints(selectedLocation,
    defender.items.filter((item) => item.type === "armor")) : null;
  if (!selectedLocation || (sameProposal
    && (Number(selectedLocation.system.currentHitPoints) !== Number(expectedHitPoints)
      || Number(currentArmor) !== Number(combat.damage.armorSnapshot)))) {
    combat.damage.status = "stale";
    combat.revision += 1;
    return message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  }
  await refreshDamageProposal(combat, request.locationId);
  const location = defender.items.get(combat.damage.locationId);
  combat.damage.status = "applying";
  combat.revision += 1;
  await message.update({ [`flags.${FLAG_SCOPE}.combat`]: combat });
  try { await location.update({ "system.currentHitPoints": combat.damage.afterHitPoints }); }
  catch (error) {
    combat.damage.status = "proposed";
    await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
    throw error;
  }
  combat.damage.status = "applied";
  combat.damage.appliedBy = user.id;
  combat.damage.appliedAt = Date.now();
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

const resultLabel = (result) => result ? localize(`MYTHRASF.RollResult.${result}`) : localize("MYTHRASF.Combat.PendingClassification");

function damageLocationChoices(combat) {
  const locations = combat.defender.locations ?? [];
  if (selectedEffectCount(combat.effects?.selections ?? [], "chooseLocation")) {
    return locations.filter((location) => location.id === combat.damage?.locationId);
  }
  if (!selectedEffectCount(combat.effects?.selections ?? [], "aimedShot")) return locations;
  return locations.filter((location) => location.id === combat.damage?.locationId);
}

export function renderCombatExchange(combat) {
  const resolved = ["resolved", "awaitingEffects"].includes(combat.status) ? combat.resolution : null;
  const attack = resolved?.attack ?? combat.attackClassification;
  const defense = resolved?.defense;
  const defenseName = combat.defender.defense?.type ? localize(`MYTHRASF.Combat.Defense.${combat.defender.defense.type}`) : localize("MYTHRASF.Combat.PendingDefense");
  const defenseActions = combat.status === "awaitingDefense" ? `<div class="combat-defense-actions"><button type="button" data-combat-action="parry" title="${escape(localize("MYTHRASF.Combat.Parry"))}">${escape(localize("MYTHRASF.Combat.Parry"))}</button><button type="button" data-combat-action="evade" title="${escape(localize("MYTHRASF.Combat.Evade"))}">${escape(localize("MYTHRASF.Combat.Evade"))}</button><button type="button" data-combat-action="none" title="${escape(localize("MYTHRASF.Combat.NoDefense"))}">${escape(localize("MYTHRASF.Combat.NoDefense"))}</button></div>` : "";
  const evadeWinner = resolved?.defense?.type === "evade" ? evasionWinner(resolved) : undefined;
  const outcome = resolved ? `<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Combat.Advantage"))}</span><strong>${resolved.advantage > 0 ? "+" : ""}${resolved.advantage}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Effects"))}</span><strong>${resolved.effects} — ${escape(resolved.winner ? localize(`MYTHRASF.Combat.Winner.${resolved.winner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>${evadeWinner !== undefined ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.EvasionOutcome"))}</span><strong>${escape(evadeWinner ? localize(`MYTHRASF.Combat.Winner.${evadeWinner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>` : ""}` : "";
  const penalty = resolved?.sharedPenalty ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Over100Penalty"))}</span><strong class="skill-roll-modifier-effect--penalty">−${resolved.sharedPenalty}</strong></div>` : "";
  const luck = (side) => `<button type="button" class="sheet-icon-button mythras-chat-luck-button" data-combat-action="luck" data-side="${side}" title="${escape(localize("MYTHRASF.Luck.Use"))}" aria-label="${escape(localize("MYTHRASF.Luck.Use"))}"><i class="fas fa-clover" aria-hidden="true"></i></button>`;
  const rollLuckAllowed = !combat.effects?.confirmed && !["rolled", "proposed", "stale", "applying", "applied"]
    .includes(combat.damage?.status);
  const locationOptions = damageLocationChoices(combat).map((location) => `<option value="${escape(location.id)}" ${location.id === combat.damage?.locationId ? "selected" : ""}>${escape(location.name)}</option>`).join("");
  let damageHtml = "";
  const guidedBeforeDamage = (combat.effects?.selections ?? []).some((effect) =>
    effect.status === "pending" && !effect.requiresWound);
  if (combat.damage?.status === "ready" && !guidedBeforeDamage) damageHtml = `<button type="button" data-combat-action="roll-damage" title="${escape(localize("MYTHRASF.Combat.RollDamage"))}">${escape(localize("MYTHRASF.Combat.RollDamage"))}</button>`;
  if (["rolled", "proposed", "stale", "applying", "applied"].includes(combat.damage?.status)) {
    const damage = combat.damage;
    damageHtml = `<fieldset class="combat-damage-panel"><legend>${escape(localize("MYTHRASF.Chat.Damage"))}</legend><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageRoll"))} (${escape(damage.formula)})</span><strong class="mythras-chat-roll-value">${damage.rawRoll}</strong>${["proposed", "stale"].includes(damage.status) ? luck("damage") : ""}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span><strong>${damage.afterContainedBlow ?? "—"}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span><strong>${escape(localize(`MYTHRASF.Combat.ParryType.${damage.parryType ?? "none"}`))}: ${damage.afterParry ?? "—"}</strong></div><label><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select data-damage-location ${damage.status === "applied" ? "disabled" : ""}>${locationOptions}</select></label><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span><strong>${damage.armorPoints ?? "—"}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.PenetratingDamage"))}</span><strong>${damage.penetratingDamage ?? "—"}</strong></div>${damage.push?.triggered ? `<div class="combat-card-warning">${escape(game.i18n.format("MYTHRASF.Combat.PushSummary", { distance: damage.push.distance, excess: damage.push.excess }))}</div>` : ""}${damage.status === "stale" ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.DamageStale"))}</p>` : ""}${damage.status === "applied" ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AppliedHitPoints"))}</span><strong>${damage.beforeHitPoints} → ${damage.afterHitPoints}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(localize(`MYTHRASF.Wound.${damage.resultingWound}`))}</strong></div>${["serious", "major"].includes(damage.resultingWound) ? `<p class="combat-card-warning">${escape(localize(`MYTHRASF.Combat.WoundWarning.${damage.resultingWound}`))}</p>` : ""}` : `<button type="button" data-combat-action="apply-damage" title="${escape(localize("MYTHRASF.Combat.ApplyDamage"))}">${escape(localize("MYTHRASF.Combat.ApplyDamage"))}</button>`}</fieldset>`;
    if (damage.alternateRoll) damageHtml = damageHtml.replace("</fieldset>",
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.CombatEffect.ImpaleDiscarded"))}</span><strong class="mythras-chat-roll-value">${damage.alternateRoll.rawRoll}</strong></div></fieldset>`);
  }
  const selectedEffects = (combat.effects?.selections ?? []).map((effect) => effect.waived
    ? `<li>${escape(localize("MYTHRASF.CombatEffect.Waive"))}</li>`
    : `<li><button type="button" class="sheet-icon-button" data-combat-action="open-effect" data-effect-uuid="${escape(effect.uuid)}" title="${escape(localize("MYTHRASF.CombatEffect.Open"))}"><i class="fas fa-book-open" aria-hidden="true"></i></button> ${escape(effect.name)}${effect.status === "pending" ? ` — ${escape(localize("MYTHRASF.CombatEffect.Guided"))} <button type="button" data-combat-action="resolve-effect" data-effect-slot="${effect.slot}" title="${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}">${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : ""}</li>`).join("");
  const effectsHtml = combat.status === "awaitingEffects"
    ? `<fieldset class="combat-effects-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.Pending"))}</legend><button type="button" data-combat-action="choose-effects" title="${escape(localize("MYTHRASF.CombatEffect.Select"))}">${escape(localize("MYTHRASF.CombatEffect.Select"))}</button><button type="button" data-combat-action="cancel" data-gm-only title="${escape(localize("MYTHRASF.Contest.Cancel"))}">${escape(localize("MYTHRASF.Contest.Cancel"))}</button></fieldset>`
    : selectedEffects ? `<fieldset class="combat-effects-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.Selected"))}</legend><ol>${selectedEffects}</ol></fieldset>` : "";
  const checksHtml = (combat.effects?.checks ?? []).length ? `<fieldset class="combat-checks-panel"><legend>${escape(localize("MYTHRASF.CombatEffect.Guided"))}</legend>${combat.effects.checks.map((check) => `<div class="mythras-chat-row"><span>${escape(check.label)}</span><strong>${check.resolution?.result ? escape(resultLabel(check.resolution.result)) : check.status}</strong>${check.status === "pending" ? `<button type="button" data-combat-action="resolve-check" data-check-id="${escape(check.id)}" title="${escape(localize("MYTHRASF.Roll"))}">${escape(localize("MYTHRASF.Roll"))}</button><button type="button" data-combat-action="resolve-check-manual" data-check-id="${escape(check.id)}" title="${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}">${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : ""}</div>`).join("")}</fieldset>` : "";
  const tracker = combat.turnEconomy ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Tracker.Position"))}</span><strong>${escape(game.i18n.format("MYTHRASF.Tracker.RoundCycle", { round: combat.turnEconomy.round, cycle: combat.turnEconomy.cycle }))}</strong></div>` : "";
  const close = combat.turnEconomy && !combat.turnEconomy.turnAdvanced
    ? `<button type="button" data-combat-action="close-exchange" data-gm-only title="${escape(localize("MYTHRASF.Tracker.CloseExchange"))}">${escape(localize("MYTHRASF.Tracker.CloseExchange"))}</button>` : "";
  return `<section class="mythras-combat-card mythras-chat-card" data-combat-revision="${combat.revision}"><div class="mythras-chat-title">${escape(localize("MYTHRASF.Combat.ExchangeTitle"))}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.StatusLabel"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Status.${combat.status}`))}</strong></div>${tracker}<div class="mythras-chat-details"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Attacker"))}</span><strong>${escape(combat.attacker.actorName)}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><strong>${escape(combat.defender.actorName)}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.WeaponAndStyle"))}</span><strong>${escape(`${combat.attacker.weaponName} — ${combat.attacker.styleName}`)}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DeclarationMoment"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Declaration.${combat.predeclared ? "before" : "after"}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ContainedBlow"))}</span><strong>${escape(localize(combat.declarations?.containedBlow ? "MYTHRASF.Yes" : "MYTHRASF.No"))}</strong></div></div><div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.AttackRoll"))} (${attack?.target ?? combat.attacker.target}%)</span><strong><span class="mythras-chat-roll-value">${combat.attacker.rawRoll}</span> ${escape(resultLabel(attack?.result))}</strong>${rollLuckAllowed ? luck("attacker") : ""}</div></div><div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(defenseName)}${defense?.target != null ? ` (${defense.target}%)` : ""}</span><strong>${defense?.rawRoll == null ? "—" : `<span class="mythras-chat-roll-value">${defense.rawRoll}</span> ${escape(resultLabel(defense.result))}`}</strong>${defense?.rawRoll != null && rollLuckAllowed ? luck("defender") : ""}</div></div>${penalty}${outcome}${effectsHtml}${damageHtml}${checksHtml}${defenseActions}<div data-combat-gm-actions>${combat.status === "awaitingDefense" ? `<button type="button" data-combat-action="cancel" title="${escape(localize("MYTHRASF.Contest.Cancel"))}">${escape(localize("MYTHRASF.Contest.Cancel"))}</button>` : ""}${close}</div></section>`;
}

export function activateCombatCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  activateDelayedTooltips(root);
  const messageElement = root?.matches?.(".chat-message") ? root : root?.closest?.(".chat-message");
  if (root?.matches?.(".mythras-chat-card") || root?.querySelector?.(".mythras-chat-card")) {
    messageElement?.classList.add("mythras-chat-message");
  }
  const card = root?.matches?.(".mythras-combat-card") ? root : root?.querySelector?.(".mythras-combat-card");
  const combat = message.getFlag?.(FLAG_SCOPE, "combat");
  if (!card || !combat || combat.schemaVersion !== SCHEMA_VERSION || card.dataset.combatActive) return;
  card.dataset.combatActive = "true";
  combatActor(combat.defender.tokenUuid, combat.defender.actorUuid).then((actor) => card.querySelectorAll("[data-combat-action='parry'],[data-combat-action='evade'],[data-combat-action='none']").forEach((button) => { button.hidden = !game.user.isGM && !actor?.isOwner; }));
  const winnerEntry = combat.effects?.winner === "attacker" ? combat.attacker : combat.defender;
  combatActor(winnerEntry?.tokenUuid, winnerEntry?.actorUuid).then((actor) =>
    card.querySelectorAll("[data-combat-action='choose-effects']").forEach((button) => {
      button.hidden = !game.user.isGM && !actor?.isOwner;
    }));
  card.querySelectorAll("[data-combat-action='resolve-check-manual']").forEach((button) => {
    button.hidden = !game.user.isGM;
  });
  card.querySelectorAll("[data-gm-only]").forEach((button) => { button.hidden = !game.user.isGM; });
  card.querySelectorAll("[data-combat-action='resolve-effect']").forEach(async (button) => {
    const effect = (combat.effects?.selections ?? []).find((entry) =>
      Number(entry.slot) === Number(button.dataset.effectSlot));
    const selfSide = combat.effects?.winner;
    const affectedSide = effect?.target === "self" ? selfSide
      : selfSide === "attacker" ? "defender" : "attacker";
    const entry = affectedSide === "attacker" ? combat.attacker : combat.defender;
    const actor = await combatActor(entry?.tokenUuid, entry?.actorUuid);
    button.hidden = !game.user.isGM && !actor?.isOwner;
  });
  const gm = card.querySelector("[data-combat-gm-actions]"); if (gm) gm.hidden = !game.user.isGM;
  card.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-combat-action]"); if (!button) return;
    const action = button.dataset.combatAction;
    if (["parry", "evade", "none"].includes(action)) return respondToAttack(message, combat, action);
    if (action === "cancel") return cancelCombat(message, combat);
    if (action === "close-exchange") return closeCombatExchange(message, combat);
    if (action === "luck" && button.dataset.side === "damage") return requestDamageLuck(message, combat);
    if (action === "luck") return spendCombatLuck(message, combat, button.dataset.side);
    if (action === "choose-effects") return chooseCombatEffects(message, combat);
    if (action === "open-effect") {
      const effect = await fromUuid(button.dataset.effectUuid).catch(() => null);
      return effect?.sheet?.render({ force: true });
    }
    if (action === "resolve-check") return requestCombatCheck(message, combat, button.dataset.checkId);
    if (action === "resolve-check-manual") return requestCombatCheck(message, combat,
      button.dataset.checkId, true);
    if (action === "resolve-effect") return requestResolveEffect(message, combat,
      button.dataset.effectSlot);
    if (action === "roll-damage") return requestCombatDamage(message, combat);
    if (action === "apply-damage") return requestApplyDamage(message, combat,
      card.querySelector("[data-damage-location]")?.value ?? combat.damage.locationId);
  });
}

export function registerCombatSocket() {
  game.socket.on(SOCKET, async (request) => {
    if (!["combatDefense", "combatLuck", "combatEffects", "combatDamage", "combatDamageLuck",
      "combatApplyDamage", "combatCheck", "combatResolveEffect"].includes(request?.action)) return;
    const message = game.messages.get(request.messageId);
    const combat = message?.getFlag(FLAG_SCOPE, "combat");
    if (!combat || preferredCombatCoordinator(game.users, combat.authorUserId) !== game.user.id) return;
    if (request.action === "combatLuck") await applyCombatLuck(message, request);
    else if (request.action === "combatEffects") await applyCombatEffects(message, request);
    else if (request.action === "combatDamage") await applyCombatDamage(message, request);
    else if (request.action === "combatDamageLuck") await applyDamageLuck(message, request);
    else if (request.action === "combatApplyDamage") await applyProposedDamage(message, request);
    else if (request.action === "combatCheck") await applyCombatCheck(message, request);
    else if (request.action === "combatResolveEffect") await applyResolvedEffect(message, request);
    else await applyCombatDefense(message, request);
  });
}
