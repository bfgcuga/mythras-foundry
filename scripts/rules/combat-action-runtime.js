import { canStartProactiveAction, choosingInterruption, combatInterruption, submitInterruption,
  bindInterruptionAction, finishInterruptionAction, interruptionBlocksAction } from "./combat-interruption.js";
import { settleWaiting, clearCombatWaiting } from "./combat-waiting.js";
import { spendActorActionPoint } from "./combat-resource-runtime.js";
import { ruleHelpButton, openRuleHelp } from "../ui/rule-help.js";
import { unarmedAbilities } from "./unarmed-combat.js";
import { isGrabbed } from "./grappling.js";
import { currentActionPoints } from "./action-points.js";
import { weaponPins, weaponIsPinned } from "./weapon-pinning.js";
import { requestEntangleRelease, requestGrabRelease, requestWeaponRelease } from "./weapon-pin-runtime.js";
import { activeEntanglements, actorIsRooted, entanglementsHeldBy } from "./entanglement.js";
import { chooseTripResistance } from "./combat-trip.js";
import { evaluateSystemRoll } from "./system-roll.js";
import { classifyContestRoll } from "./contest-rolls.js";
import { opposedEffectWinner } from "./combat-effects.js";
import { applyTimedCondition } from "./timed-condition-runtime.js";
import { actorDisplayName, actorSpeaker, tokenDisplayName } from "./document-names.js";
import { resolveActorConditions } from "./actor-conditions.js";
import { combatantForActor, tacticalState } from "./engagement-runtime.js";
import { weaponModes } from "./weapon-modes.js";
import { advanceActorTurnConditions } from "./timed-condition-runtime.js";
import { weaponCanEquip } from "./weapon-durability.js";
import { impalementsReachableBy, extractionDamage } from "./impalement.js";
import { applyStrengthContestPenalties } from "./strength-contests.js";
import { difficultyTarget } from "./combat.js";
import { COMBAT_ACTIONS, emptyCombatActionState, isEngaged,
  chargeEligibility, chargeModifiers, movementDeclaration,
  normalizeCombatActionState, combatActionPresentation } from "./combat-actions.js";

const SCOPE = "mythras-foundry";
const FLAG = "combatActions";
const SOCKET = "system.mythras-foundry";
const pendingManeuverRequests = new Set();
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);

export function combatActionState(combat) {
  return normalizeCombatActionState(combat?.getFlag?.(SCOPE, FLAG) ?? emptyCombatActionState());
}

function activeContext(actor, { reactive = false } = {}) {
  const combat = game.combat ?? game.combats?.active;
  const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
  if (!combat?.started || !combatant) return null;
  const state = combatActionState(combat);
  if (!canStartProactiveAction(combat, combatant) && !reactive) return null;
  return { combat, combatant, state };
}

function restraintEffects(actor) {
  return actor?.effects?.filter((effect) => {
    const timed = effect.getFlag?.(SCOPE, "timedCondition") ?? {};
    return ["grabbed", "entangled", "weaponPinned", "agarrar", "enredar",
      "inmovilizar-arma"].includes(timed.key ?? effect.getFlag?.(SCOPE, "combatEffect")?.key);
  }) ?? [];
}

export function actionAvailability(actor) {
  return Object.freeze(Object.fromEntries(Object.entries(actionPresentation(actor))
    .map(([key, value]) => [key, value.available])));
}

export function actionPresentation(actor) {
  const combat = game.combat ?? game.combats?.active;
  const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
  const state = combatActionState(combat);
  const conditions = resolveActorConditions(actor, { baseAttributes:
    actor?.system?.baseAttributes ?? actor?.system?.attributes ?? {} });
  const modes = actor?.items?.filter((item) => item.type === "weapon" && item.system.equipped
    && weaponCanEquip(item) && !weaponIsPinned(item, actor))
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => mode.key === weapon.system.activeModeKey)) ?? [];
  const heldEntanglements = entanglementsHeldBy(actor,
    Array.from(combat?.combatants ?? []).map((entry) => entry.actor).filter(Boolean))
    .filter((entry) => Number(combat?.round) > Number(entry.appliedRound)
      || Number(combat?.turn) !== Number(entry.appliedTurn));
  return combatActionPresentation({ inCombat: Boolean(combat?.started && combatant),
    isActive: canStartProactiveAction(combat, combatant)
      && (state.delays[combatant?.id]?.status !== "reserved" || Boolean(choosingInterruption(combat, combatant?.id))),
    isOwnTurn: combat?.combatant?.id === combatant?.id,
    hasInterruption: Boolean(combatInterruption(combat)), interrupting: Boolean(choosingInterruption(combat, combatant?.id)), actionPoints: currentActionPoints(actor),
    canTakeProactiveTurn: conditions.capabilities.canTakeProactiveTurn
      && !Object.values(state.actions).some((action) => action.combatantId === combatant?.id && action.status === "awaitingContest"),
    canAttack: conditions.capabilities.canAttack,
    canDefend: conditions.capabilities.canDefend,
    engaged: isEngaged(tacticalState(combat).relations, combatant?.id),
    prone: actor?.statuses?.has?.("prone"), hasRangedWeapon: modes.some((mode) =>
      ["ranged", "siege"].includes(mode.weaponType)), hasPreparedWeapon: modes.length > 0, hasUnarmedAttack: unarmedAbilities(actor).length > 0,
    hasRestraint: restraintEffects(actor).length > 0,
    grabbed: isGrabbed(actor),
    entangled: activeEntanglements(actor).length > 0,
    holdsEntanglement: heldEntanglements.length > 0,
    rooted: actorIsRooted(actor),
    hasPinnedWeapon: weaponPins(actor).length > 0,
    hasDelay: state.delays[combatant?.id]?.status === "reserved",
    hasReachableImpaledWeapon: impalementsReachableBy(combat, actor).length > 0,
    canCharge: chargeEligibility(state.movements[combatant?.id], combat?.round).eligible });
}

export function decorateCombatActionButtons(actor, root) {
  const presentation = actionPresentation(actor);
  const combat = game.combat ?? game.combats?.active;
  const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
  const choosing = Boolean(choosingInterruption(combat, combatant?.id));
  const hint = root?.querySelector?.("[data-interruption-hint]");
  if (hint) { hint.hidden = !choosing; hint.textContent = localize("MYTHRASF.Interruption.Phase.choosing"); }
  const cancel = root?.querySelector?.("[data-interruption-cancel]");
  if (cancel) { cancel.hidden = !choosing; cancel.onclick = () => submitInterruption(combat, "cancel"); }
  root?.querySelectorAll?.("[data-combat-action-key]").forEach((button) => {
    const key = button.dataset.combatActionKey;
    const state = presentation[key] ?? { available: false, cost: 1, reason: "unavailable" };
    button.hidden = state.visible === false || (key === "releaseWeapon" && !weaponPins(actor).length)
      || (key === "recoverImpaledWeapon" && !presentation.recoverImpaledWeapon?.available)
      || (key === "releaseGrab" && !isGrabbed(actor))
      || (key === "releaseEntangle" && !activeEntanglements(actor).length)
      || (key === "entangleTrip" && !presentation.entangleTrip?.available);
    button.disabled = !state.available;
    button.setAttribute("aria-disabled", String(!state.available));
    const reason = state.reason ? localize(`MYTHRASF.Action.Unavailable.${state.reason}`) : "";
    const cost = localize("MYTHRASF.Action.Cost").replace("{cost}", state.cost);
    button.title = reason ? `${cost} · ${reason}` : cost;
    const wrapper = button.closest("[data-action-presentation]");
    if (wrapper) wrapper.dataset.mythrasTooltip = button.title;
    if (!button.dataset.action) button.onclick = () => requestCombatAction(actor, key);
  });
}

async function spend(actor, cost = 1) {
  return cost === 0 || spendActorActionPoint(actor);
}

async function requestRecoverImpaledWeapon(actor) {
  const context = activeContext(actor);
  if (!context || currentActionPoints(actor) < 1) return;
  const choices = impalementsReachableBy(context.combat, actor);
  if (!choices.length) return;
  const chosen = choices.length === 1 ? choices[0]
    : await foundry.applications.api.DialogV2.wait({
      window: { title: localize("MYTHRASF.Action.recoverImpaledWeapon") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize(
        "MYTHRASF.Impale.Weapon"))}</span><select name="choice">${choices.map((entry, index) =>
        `<option value="${index}">${escape(entry.data.weaponName)} — ${escape(entry.victimName)}</option>`)
      .join("")}</select></label></div>`,
      buttons: [{ action: "confirm", label: localize("MYTHRASF.Confirm"), default: true,
        callback: (event, button) => choices[Number(button.form.elements.choice.value)] },
      { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false });
  if (!chosen) return;
  const resisted = await foundry.applications.api.DialogV2.confirm({
    window: { title: localize("MYTHRASF.Impale.ResistanceTitle") },
    content: `<p>${escape(game.i18n.format("MYTHRASF.Impale.ResistancePrompt", {
      victim: chosen.victimName }))}</p>` });
  const ownSkill = actor.items.find((item) => item.type === "skill" && item.system.slug === "musculo");
  const rivalSkill = chosen.victim.items.find((item) => item.type === "skill"
    && item.system.slug === "musculo");
  if (!ownSkill || (resisted && !rivalSkill)) return;
  const ownRoll = await evaluateSystemRoll("1d100");
  const rivalRoll = resisted ? await evaluateSystemRoll("1d100") : null;
  const request = { action: "combatImpaleRecovery", combatId: context.combat.id,
    combatantId: context.combatant.id, victimCombatantId: chosen.victimCombatantId,
    effectId: chosen.effect.id, resisted, ownRoll: ownRoll.total,
    rivalRoll: rivalRoll?.total ?? null, serializedOwnRoll: ownRoll.toJSON(),
    serializedRivalRoll: rivalRoll?.toJSON?.() ?? null, userId: game.user.id };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) {
    await applyImpaledWeaponRecoveryRequest(request);
  } else game.socket.emit(SOCKET, request);
}

export async function applyImpaledWeaponRecoveryRequest(request) {
  const combat = game.combats.get(request.combatId);
  const combatant = combat?.combatants.get(request.combatantId);
  const actor = combatant?.actor; const user = game.users.get(request.userId);
  const rollsValid = Number.isInteger(Number(request.ownRoll)) && Number(request.ownRoll) >= 1
    && Number(request.ownRoll) <= 100 && (!request.resisted
      || (Number.isInteger(Number(request.rivalRoll)) && Number(request.rivalRoll) >= 1
        && Number(request.rivalRoll) <= 100));
  if (!combat?.started || !canStartProactiveAction(combat, combatant) || !actor || !user || !rollsValid
    || (!user.isGM && !actor.testUserPermission(user, "OWNER"))
    || currentActionPoints(actor) < 1) return false;
  const chosen = impalementsReachableBy(combat, actor).find((entry) =>
    entry.victimCombatantId === request.victimCombatantId && entry.effect.id === request.effectId);
  if (!chosen) return false;
  const ownSkill = actor.items.find((item) => item.type === "skill" && item.system.slug === "musculo");
  const rivalSkill = chosen.victim.items.find((item) => item.type === "skill"
    && item.system.slug === "musculo");
  if (!ownSkill || (request.resisted && !rivalSkill)) return false;
  const participant = (id, subject, skill) => {
    const difficulty = resolveActorConditions(subject, { baseDifficulty: "standard",
      physical: true }).difficulty;
    return { id, abilitySlug: "musculo", difficulty, baseTarget: Number(skill.system.total ?? 0),
      target: difficultyTarget(skill.system.total, difficulty),
      damageModifier: subject.system.attributes?.damageModifier };
  };
  const participants = applyStrengthContestPenalties([participant("recoverer", actor, ownSkill),
    ...(request.resisted ? [participant("victim", chosen.victim, rivalSkill)] : [])]);
  const own = participants[0]; const rival = participants[1];
  const ownResult = { result: classifyContestRoll(request.ownRoll, own.target),
    rawRoll: Number(request.ownRoll) };
  const rivalResult = rival ? { result: classifyContestRoll(request.rivalRoll, rival.target),
    rawRoll: Number(request.rivalRoll) } : null;
  const recovered = rivalResult ? opposedEffectWinner(ownResult, rivalResult) === "left"
    : ["success", "critical"].includes(ownResult.result);
  if (!await spend(actor, 1)) return false;
  let dealt = 0; let damageRoll = null;
  if (recovered) {
    const weaponData = foundry.utils.deepClone(chosen.data.weaponData);
    weaponData.system = { ...weaponData.system, equipped: false };
    const created = await actor.createEmbeddedDocuments("Item", [weaponData]);
    try {
      await chosen.victim.deleteEmbeddedDocuments("ActiveEffect", [chosen.effect.id]);
    } catch (error) {
      await actor.deleteEmbeddedDocuments("Item", created.map((item) => item.id));
      throw error;
    }
    damageRoll = await evaluateSystemRoll(chosen.data.damageFormula || "0");
    dealt = extractionDamage(damageRoll.total, chosen.data.barbed);
    const location = chosen.victim.items.get(chosen.data.locationId);
    if (location) await location.update({ "system.currentHitPoints":
      Number(location.system.currentHitPoints ?? 0) - dealt });
  }
  const rolls = [Roll.fromData(request.serializedOwnRoll),
    ...(request.serializedRivalRoll ? [Roll.fromData(request.serializedRivalRoll)] : []),
    ...(damageRoll ? [damageRoll] : [])];
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), rolls,
    content: `<section class="mythras-chat-card"><h3 class="mythras-chat-title">${escape(localize(
      "MYTHRASF.Action.recoverImpaledWeapon"))}</h3><div class="mythras-chat-row"><span>${escape(
      ownSkill.name)} (${own.target}%)</span><strong class="mythras-chat-roll-value">${request.ownRoll}</strong></div>${rivalResult
      ? `<div class="mythras-chat-row"><span>${escape(rivalSkill.name)} (${rival.target}%)</span><strong class="mythras-chat-roll-value">${request.rivalRoll}</strong></div>` : ""}<div class="mythras-chat-total"><span>${escape(localize(
      "MYTHRASF.Pin.Outcome"))}</span><strong>${escape(localize(recovered
        ? "MYTHRASF.Impale.Recovered" : "MYTHRASF.Impale.Stuck"))}</strong></div>${recovered
      ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Damage"))}</span><strong>${dealt}</strong></div>` : ""}</section>` });
  if (!await finishInterruptionAction(combat, combatant.id)) await combat.nextTurn();
  return true;
}

async function requestEntangleTrip(actor) {
  const context = activeContext(actor);
  if (!context || currentActionPoints(actor) < 1) return;
  const candidates = entanglementsHeldBy(actor,
    Array.from(context.combat.combatants ?? []).map((entry) => entry.actor).filter(Boolean))
    .filter((entry) => Number(context.combat.round) > Number(entry.appliedRound)
      || Number(context.combat.turn) !== Number(entry.appliedTurn));
  if (!candidates.length) return;
  const chosen = candidates.length === 1 ? candidates[0] : await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.Entangle.Trip") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize(
      "MYTHRASF.Combat.Defender"))}</span><select name="target">${candidates.map((entry, index) =>
      `<option value="${index}">${escape(actorDisplayName(entry.actor))}</option>`).join("")}</select></label></div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.Confirm"), default: true,
      callback: (event, button) => candidates[Number(button.form.elements.target.value)] }],
    close: () => null, rejectClose: false
  });
  if (!chosen) return;
  const resistance = await chooseTripResistance(chosen.actor, "standard", {
    Dialog: foundry.applications.api.DialogV2, localize, escape });
  if (!resistance || !activeContext(actor) || !await spend(actor, 1)) return;
  const roll = await evaluateSystemRoll("1d100");
  const right = { result: classifyContestRoll(roll.total, resistance.target), rawRoll: roll.total };
  const left = { result: chosen.sourceResult ?? "success", rawRoll: chosen.sourceRoll };
  const tripped = opposedEffectWinner(left, right) === "left";
  if (tripped) await applyTimedCondition(chosen.actor, { key: "prone", statusId: "prone",
    name: localize("MYTHRASF.Status.Prone"), img: "icons/svg/falling.svg",
    source: { actorUuid: actor.uuid, name: actorDisplayName(actor) },
    duration: { unit: "manual", phase: "manual" } });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `<section class="mythras-chat-card"><h3 class="mythras-chat-title">${escape(localize(
      "MYTHRASF.Entangle.Trip"))}</h3><div class="mythras-chat-row"><span>${escape(
      resistance.name)}</span><strong class="mythras-chat-result--${tripped ? "failure" : "success"}"><span class="mythras-chat-roll-value">${roll.total}</span></strong></div><div class="mythras-chat-total"><span>${escape(localize(
      "MYTHRASF.Pin.Outcome"))}</span><strong>${escape(localize(tripped
        ? "MYTHRASF.Entangle.Tripped" : "MYTHRASF.Entangle.Resisted"))}</strong></div></section>`,
    rolls: [roll] });
  if (!await finishInterruptionAction(context.combat, context.combatant.id)) await context.combat.nextTurn();
}

export function actionCard(action) {
  const responses = action.interruptCandidates?.map((candidate) => {
    const response = action.interruptResponses?.[candidate.combatantId];
    const controls = !response && action.status === "awaitingInterrupts"
      ? `<span><button type="button" data-action-transaction="interrupt" data-combatant-id="${escape(candidate.combatantId)}">${escape(localize("MYTHRASF.Action.Interrupt"))}</button><button type="button" data-action-transaction="pass" data-combatant-id="${escape(candidate.combatantId)}">${escape(localize("MYTHRASF.Action.PassInterrupt"))}</button></span>`
      : `<span>${escape(response ?? localize("MYTHRASF.Action.Pending"))}</span>`;
    return `<div class="mythras-chat-row"><span>${escape(candidate.name)}</span>${controls}</div>`;
  }).join("") ?? "";
  const confirmation = action.status === "awaitingConfirmation"
    ? `<div class="mythras-chat-actions"><button type="button" data-action-transaction="confirm">${escape(localize("MYTHRASF.CombatEffect.Confirm"))}</button><button type="button" data-action-transaction="cancel">${escape(localize("MYTHRASF.Cancel"))}</button></div>` : "";
  const help = COMBAT_ACTIONS[action.key]
    ? ruleHelpButton(`data-action-help="${escape(action.key)}"`) : "";
  const outcome = action.key === "hesitate" && action.status === "resolved"
    ? `<p>${escape(localize("MYTHRASF.Action.HesitateResult"))}</p>` : "";
  return `<section class="mythras-chat-card" data-combat-action-card><h3 class="mythras-chat-title">${escape(localize(`MYTHRASF.Action.${action.key}`))}</h3><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Action.Actor"))}</span><span>${escape(actorDisplayName(game.combats?.get(action.combatId)?.combatants.get(action.combatantId)?.actor) || action.actorName)}</span></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Action.StatusLabel"))}</span><span>${escape(localize(`MYTHRASF.Action.Status.${action.status}`))} ${help}</span></div>${outcome}${responses}${action.note ? `<p>${escape(action.note)}</p>` : ""}${confirmation}</section>`;
}

async function save(combat, state) {
  state.revision = Number(state.revision ?? 0) + 1;
  await combat.setFlag(SCOPE, FLAG, state);
}

async function createTransaction(context, key, parameters = {}) {
  if (key === "maneuver") {
    const { validateManeuverSelection } = await import("./maneuver-runtime.js");
    if (!activeContext(context.combatant.actor) || !await validateManeuverSelection(context.combat,
      context.combatant.actor, context.combatant.token?.uuid, parameters, game.user)) {
      ui.notifications.warn(localize("MYTHRASF.Maneuver.InvalidParticipants")); return null;
    }
  }
  const definition = COMBAT_ACTIONS[key];
  if (!definition || !(definition.cost === 0 || (definition.type === "reactive"
    ? await spendActorActionPoint(context.combatant.actor, { reactive: true })
    : await spend(context.combatant.actor, definition.cost)))) {
    ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.actionPoints")); return null;
  }
  const id = foundry.utils.randomID(); const candidates = [];
  context.state = combatActionState(context.combat);
  const interruptionId = combatInterruption(context.combat)?.phase === "resolving"
    && combatInterruption(context.combat).combatantId === context.combatant.id ? combatInterruption(context.combat).id : null;
  const action = { schemaVersion: 1, id, interruptionId, requestId: context.requestId, revision: 0, key, type: definition.type,
    actorUuid: context.combatant.actor.uuid, actorName: actorDisplayName(context.combatant.actor),
    tokenUuid: context.combatant.token?.uuid ?? "", combatantId: context.combatant.id,
    combatId: context.combat.id, round: context.combat.round,
    cycle: context.combat.mythrasTurnEconomy?.cycle ?? 1, turn: context.combat.turn,
    cost: definition.cost, spent: definition.cost > 0, parameters, userId: context.userId ?? game.user.id,
    coordinatorUserId: game.users.filter((user) => user.active && user.isGM)
      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? game.user.id,
    status: candidates.length ? "awaitingInterrupts"
      : definition.guided ? "awaitingConfirmation" : "resolving",
    note: parameters.note ?? "", interruptCandidates: candidates,
    interruptResponses: {}, createdAt: Date.now() };
  context.state.actions[id] = action; await save(context.combat, context.state);
  const message = await ChatMessage.create({ speaker: actorSpeaker(context.combatant.actor),
    content: actionCard(action), flags: { [SCOPE]: { combatAction: { combatId: context.combat.id,
      actionId: id, revision: action.revision } } } });
  action.messageUuid = message.uuid; await save(context.combat, context.state);
  if (action.type === "proactive") {
    await bindInterruptionAction(context.combat, context.combatant.id, { kind: "general", actionId: id });
  }
  return action;
}

async function chooseMovement(context) {
  return foundry.applications.api.DialogV2.wait({ window: { title: localize("MYTHRASF.Action.move") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Action.MovementMode"))}</span><select name="mode"><option value="stationary">${escape(localize("MYTHRASF.Action.Movement.stationary"))}</option><option value="walk">${escape(localize("MYTHRASF.Action.Movement.walk"))}</option><option value="run">${escape(localize("MYTHRASF.Action.Movement.run"))}</option><option value="sprint">${escape(localize("MYTHRASF.Action.Movement.sprint"))}</option></select></label><label><span>${escape(localize("MYTHRASF.Action.Direction"))}</span><input name="direction"></label></div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"),
      callback: (event, button) => ({ mode: button.form.elements.mode.value,
        direction: button.form.elements.direction.value.trim() }) },
    { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false });
}

async function chooseReadyWeapon(actor) {
  const weapons = actor.items.filter((item) => item.type === "weapon" && weaponCanEquip(item)
    && !weaponIsPinned(item, actor));
  if (!weapons.length) return null;
  return foundry.applications.api.DialogV2.wait({ window: { title: localize("MYTHRASF.Action.readyWeapon") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weapons.map((weapon) => `<option value="${weapon.id}">${escape(weapon.name)}</option>`).join("")}</select></label><label><span>${escape(localize("MYTHRASF.Action.ReadyOperation"))}</span><select name="operation"><option value="ready">${escape(localize("MYTHRASF.Action.Ready"))}</option><option value="stow">${escape(localize("MYTHRASF.Action.Stow"))}</option><option value="pickup">${escape(localize("MYTHRASF.Action.Pickup"))}</option></select></label></div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"), callback: (event, button) => ({
      weaponId: button.form.elements.weapon.value, operation: button.form.elements.operation.value }) },
    { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false });
}

export async function executeAction(combat, action) {
  const state = combatActionState(combat); const current = state.actions[action.id];
  if (!current || interruptionBlocksAction(combat, current.id)
    || ["resolved", "cancelled", "awaitingContest"].includes(current.status)) return;
  const combatant = combat.combatants.get(current.combatantId); const actor = combatant?.actor;
  if (!actor) { current.status = "awaitingConfirmation"; current.note = localize("MYTHRASF.Action.MissingActor"); }
  else if (current.key === "delay") {
    state.delays[combatant.id] = { status: "reserved", payment: "onReaction", actionId: current.id,
      declaredRound: combat.round, declaredCycle: combat.mythrasTurnEconomy?.cycle ?? 1,
      expiresRound: combat.round, expiresCycle: (combat.mythrasTurnEconomy?.cycle ?? 1) + 1,
      userId: current.userId };
    await actor.createEmbeddedDocuments("ActiveEffect", [{ name: localize("MYTHRASF.Status.Waiting"),
      img: "icons/svg/clockwork.svg", statuses: ["waiting"],
      flags: { [SCOPE]: { waiting: { combatId: combat.id, combatantId: combatant.id } } } }]);
    current.status = "resolved";
  } else if (current.key === "move") {
    state.movements[combatant.id] = movementDeclaration({ ...current.parameters,
      round: combat.round, cycle: combat.mythrasTurnEconomy?.cycle ?? 1,
      previous: state.movements[combatant.id], userId: current.userId });
    const braced = actor.effects.filter((effect) => effect.statuses?.has?.("braced"));
    if (braced.length) await actor.deleteEmbeddedDocuments("ActiveEffect", braced.map((effect) => effect.id));
    delete state.braces[combatant.id]; current.status = "resolved";
  } else if (current.key === "maneuver") {
    const { startManeuverContest } = await import("./maneuver-runtime.js");
    current.status = "awaitingContest";
    current.revision += 1; await save(combat, state);
    try { await startManeuverContest(combat, current, actor); }
    catch (error) {
      current.status = "awaitingConfirmation"; current.note = error.message;
      await save(combat, state); await updateCard(current);
      ui.notifications.warn(error.message);
    }
    return;
  } else if (current.key === "brace") {
    if (!actor.statuses?.has?.("braced")) await applyTimedCondition(actor, {
      key: "braced", statusId: "braced", name: localize("MYTHRASF.Status.Braced"),
      img: "icons/svg/shield.svg", source: { actorUuid: actor.uuid, name: actorDisplayName(actor) },
      duration: { unit: "manual", phase: "manual" },
      metadata: { weaponId: current.parameters.weaponId ?? "" } });
    delete state.braces[combatant.id];
    current.status = "resolved";
  } else if (current.key === "readyWeapon") {
    const weapon = actor.items.get(current.parameters.weaponId);
    if (!weapon || weaponIsPinned(weapon, actor)) { current.status = "awaitingConfirmation"; current.note = localize("MYTHRASF.Action.MissingWeapon"); }
    else if (!weaponCanEquip(weapon) && current.parameters.operation !== "stow") {
      current.status = "awaitingConfirmation";
      current.note = localize("MYTHRASF.Weapon.BrokenCannotEquip");
    }
    else if (current.parameters.operation === "pickup") {
      const progress = Number(state.readyProgress[combatant.id]?.progress ?? 0) + 1;
      state.readyProgress[combatant.id] = { weaponId: weapon.id, progress, required: 2 };
      if (progress >= 2) { await weapon.update({ "system.equipped": true }); delete state.readyProgress[combatant.id]; }
      current.status = "resolved";
    } else { await weapon.update({ "system.equipped": current.parameters.operation === "ready" }); current.status = "resolved"; }
  } else if (current.key === "stand" && !isEngaged(tacticalState(combat).relations, combatant.id)) {
    const prone = actor.effects.filter((effect) => effect.statuses?.has?.("prone"));
    if (prone.length) await actor.deleteEmbeddedDocuments("ActiveEffect", prone.map((effect) => effect.id));
    current.status = "resolved";
  } else if (current.key === "hesitate") {
    if (!combatInterruption(combat)) await advanceActorTurnConditions(actor, [], { consumeCurrent: true });
    current.status = "resolved";
    current.actorTurnConditionsAdvanced = true;
  }
  else current.status = "awaitingConfirmation";
  current.resolvedAt = current.status === "resolved" ? Date.now() : null;
  current.revision += 1; await save(combat, state); await updateCard(current);
  Hooks.callAll("mythrasCombatActionResolved", combat, current);
  if (current.status === "resolved" && current.type !== "reactive"
    && await finishInterruptionAction(combat, current.combatantId)) return;
  if (current.status === "resolved" && current.type !== "reactive" && combat.combatant?.id === current.combatantId) {
    await combat.nextTurn({ skipCurrentActorConditions: current.actorTurnConditionsAdvanced });
  }
}

async function updateCard(action) {
  if (action.key === "maneuver" && action.status === "awaitingContest") return;
  const message = action.messageUuid ? await fromUuid(action.messageUuid) : null;
  if (message) await message.update({ content: actionCard(action),
    [`flags.${SCOPE}.combatAction.revision`]: action.revision });
}

const declarationQueues = new Map();
export async function declareCombatAction(request) {
  const previous = declarationQueues.get(request.combatId) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    const combat = game.combats.get(request.combatId);
    const actor = combat?.combatants.get(request.combatantId)?.actor;
    const user = game.users.get(request.userId);
    if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
    if (request.requestId && Object.values(combatActionState(combat).actions)
      .some(action => action.requestId === request.requestId)) return;
    if (!actionAvailability(actor)[request.key]) return;
    const context = activeContext(actor, { reactive: COMBAT_ACTIONS[request.key]?.type === "reactive" });
    if (!context || context.combat.id !== combat.id) return;
    context.userId = user.id;
    context.requestId = request.requestId;
    const action = await createTransaction(context, request.key, request.parameters ?? {});
    if (!action) return;
    Hooks.callAll("mythrasCombatActionDeclared", combat, action);
    if (action.status === "resolving") await executeAction(combat, action);
  });
  declarationQueues.set(request.combatId, pending);
  try { return await pending; }
  finally { if (declarationQueues.get(request.combatId) === pending) declarationQueues.delete(request.combatId); }
}

export async function requestCombatAction(actor, key) {
  if (key === "interrupt") {
    const combat = game.combat ?? game.combats?.active;
    const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
    if (combatant) return submitInterruption(combat, "begin", { combatantId: combatant.id });
    return;
  }
  const context = activeContext(actor, { reactive: COMBAT_ACTIONS[key]?.type === "reactive" });
  if (!context || (!game.user.isGM && !actor.isOwner) || !actionAvailability(actor)[key]) {
    return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.turn"));
  }
  if (key === "maneuver" && pendingManeuverRequests.has(actor.uuid)) return;
  if (key === "maneuver") pendingManeuverRequests.add(actor.uuid);
  try {
  let parameters = {};
  if (key === "releaseGrab") return requestGrabRelease(actor);
  if (key === "recoverImpaledWeapon") return requestRecoverImpaledWeapon(actor);
  if (key === "releaseWeapon") return requestWeaponRelease(actor);
  if (key === "releaseEntangle") return requestEntangleRelease(actor);
  if (key === "entangleTrip") return requestEntangleTrip(actor);
  if (key === "maneuver") {
    const { chooseManeuverRivals } = await import("./maneuver-runtime.js");
    parameters = await chooseManeuverRivals(actor, context.combatant.token?.uuid);
    if (!parameters) return;
  }
  if (key === "move") { parameters = await chooseMovement(context); if (!parameters) return; }
  if (key === "readyWeapon") { parameters = await chooseReadyWeapon(actor); if (!parameters) return; }
  if (["mount", "retainMagic", "useMagic", "counterspell"].includes(key)) {
    const note = await foundry.applications.api.DialogV2.prompt({ window: { title: localize(`MYTHRASF.Action.${key}`) },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Action.Note"))}</span><textarea name="note"></textarea></label></div>`,
      ok: { callback: (event, button) => button.form.elements.note.value.trim() } });
    if (note == null) return; parameters.note = note;
  }
  if (key === "brace") {
    const weapon = actor.items.find((item) => item.type === "weapon" && item.system.equipped
      && weaponCanEquip(item));
    parameters.weaponId = weapon?.id ?? "";
  }
  if (key === "charge") {
    const locomotion = await foundry.applications.api.DialogV2.wait({
      window: { title: localize("MYTHRASF.Action.charge") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Action.Locomotion"))}</span><select name="locomotion"><option value="biped">${escape(localize("MYTHRASF.Action.Biped"))}</option><option value="quadruped">${escape(localize("MYTHRASF.Action.Quadruped"))}</option></select></label></div>`,
      buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"),
        callback: (event, button) => button.form.elements.locomotion.value },
      { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false });
    if (!locomotion) return; parameters.locomotion = locomotion;
    parameters.modifiers = chargeModifiers({ locomotion });
  }
  const request = { action: "declareCombatAction", requestId: foundry.utils.randomID(), combatId: context.combat.id,
    combatantId: context.combatant.id, key, parameters, userId: game.user.id };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await declareCombatAction(request);
  else game.socket.emit(SOCKET, request);
  } finally { if (key === "maneuver") pendingManeuverRequests.delete(actor.uuid); }
}

async function applyCardRequest(request) {
  const combat = game.combats.get(request.combatId); const state = combatActionState(combat);
  const action = state.actions[request.actionId]; const user = game.users.get(request.userId);
  if (!combat || !action || interruptionBlocksAction(combat, action.id) || !user || Number(action.revision) !== Number(request.revision)) return;
  if (["interrupt", "pass"].includes(request.operation)) return;
  if (["confirm", "cancel"].includes(request.operation)) {
    if (action.status !== "awaitingConfirmation") return;
    const actor = combat.combatants.get(action.combatantId)?.actor;
    if (!user.isGM && !actor?.testUserPermission(user, "OWNER")) return;
    if (action.key === "maneuver" && action.status !== "awaitingConfirmation") return;
    action.status = request.operation === "confirm" ? (action.key === "maneuver" ? "resolving" : "resolved") : "cancelled";
    action.note = request.note ?? action.note; action.resolvedAt = Date.now();
  }
  action.revision += 1; await save(combat, state); await updateCard(action);
  if (action.status === "resolving") await executeAction(combat, action);
  if (["resolved", "cancelled"].includes(action.status) && action.type !== "reactive"
    && await finishInterruptionAction(combat, action.combatantId)) return;
  if (["resolved", "cancelled"].includes(action.status)
    && action.type !== "reactive" && combat.combatant?.id === action.combatantId) await combat.nextTurn();
}

export function activateCombatActionCard(message, html) {
  const reference = message.getFlag?.(SCOPE, "combatAction"); if (!reference) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  root?.querySelectorAll?.("[data-action-help]").forEach((button) => {
    const key = button.dataset.actionHelp;
    button.addEventListener("click", () => {
      const action = combatActionState(game.combats.get(reference.combatId)).actions[reference.actionId];
      const description = key === "brace" ? localize("MYTHRASF.Status.Description.braced")
        : key === "maneuver" ? localize("MYTHRASF.Status.Description.maneuverProtected")
          : localize(`MYTHRASF.Action.Description.${key}`);
      const details = [description];
      if (action) {
        details.push(`${localize("MYTHRASF.Action.StatusLabel")}: ${localize(`MYTHRASF.Action.Status.${action.status}`)}`);
        details.push(localize("MYTHRASF.Action.Cost").replace("{cost}", action.cost ?? COMBAT_ACTIONS[key].cost));
        if (action.parameters?.mode) details.push(localize(`MYTHRASF.Action.Movement.${action.parameters.mode}`));
        if (action.note) details.push(action.note);
      }
      return openRuleHelp(localize(`MYTHRASF.Action.${key}`), details.join("\n\n"));
    });
  });
  root?.querySelectorAll?.("[data-action-transaction]").forEach((button) => {
    const candidateId = button.dataset.combatantId;
    const candidateActor = candidateId
      ? game.combats.get(reference.combatId)?.combatants.get(candidateId)?.actor : null;
    if (candidateId && !game.user.isGM && !candidateActor?.isOwner) { button.hidden = true; return; }
    button.addEventListener("click", async () => {
      const combat = game.combats.get(reference.combatId); const action = combatActionState(combat).actions[reference.actionId];
      if (!action) return;
      const request = { action: "combatAction", operation: button.dataset.actionTransaction,
        combatId: reference.combatId, actionId: reference.actionId, revision: action.revision,
        combatantId: button.dataset.combatantId ?? action.combatantId, userId: game.user.id };
      if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyCardRequest(request);
      else game.socket.emit(SOCKET, request);
    });
  });
}

export function registerCombatActionSocket() {
  game.socket.on(SOCKET, async (request) => {
    if (request?.action === "combatImpaleRecovery"
      && game.mythrasFoundry?.combat?.isCoordinator?.()) {
      await applyImpaledWeaponRecoveryRequest(request);
    }
    if (request?.action === "declareCombatAction" && game.mythrasFoundry?.combat?.isCoordinator?.()) {
      await declareCombatAction(request);
    }
    if (request?.action === "combatAction" && game.mythrasFoundry?.combat?.isCoordinator?.()) {
      await applyCardRequest(request);
    }
  });
}

export async function expireCombatActionTurn(combat, combatantId) {
  if (!combat || !combatantId) return;
  await settleWaiting(combat, combat.combatants.get(combatantId));
}

export async function migrateCombatWaiting(combat) {
  const raw = combat.getFlag(SCOPE, FLAG);
  if (!raw || Number(raw.schemaVersion ?? 1) >= 2) return;
  await clearCombatWaiting(combat, { charge: false });
  const state = combatActionState(combat);
  state.schemaVersion = 2;
  const resume = [];
  for (const action of Object.values(state.actions)) {
    if (["awaitingInterrupts", "resolvingInterrupt"].includes(action.status)
      || (action.interruptingCombatantId && action.status === "awaitingConfirmation")) {
      action.interruptCandidates = [];
      action.interruptResponses = {};
      delete action.interruptingCombatantId;
      action.status = COMBAT_ACTIONS[action.key]?.guided ? "awaitingConfirmation" : "resolving";
      action.revision += 1;
      resume.push(action);
    }
  }
  await save(combat, state);
  for (const action of resume) {
    await updateCard(action);
    if (action.status === "resolving") await executeAction(combat, action);
  }
}


export async function finishManeuverAction(combat, actionId) {
  const state = combatActionState(combat); const action = state.actions[actionId];
  if (!action || action.key !== "maneuver" || action.status !== "awaitingContest") return;
  action.status = "resolved"; action.resolvedAt = Date.now(); action.revision += 1;
  await save(combat, state);
  Hooks.callAll("mythrasCombatActionResolved", combat, action);
  if (!await finishInterruptionAction(combat, action.combatantId)
    && combat.combatant?.id === action.combatantId) await combat.nextTurn();
}
