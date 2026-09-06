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
import { actorDisplayName } from "./document-names.js";
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
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);

export function combatActionState(combat) {
  return normalizeCombatActionState(combat?.getFlag?.(SCOPE, FLAG) ?? emptyCombatActionState());
}

function activeContext(actor, { allowInterrupt = false } = {}) {
  const combat = game.combat ?? game.combats?.active;
  const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
  if (!combat?.started || !combatant) return null;
  const state = combatActionState(combat);
  const interrupting = Object.values(state.actions).some((action) => action.status === "resolvingInterrupt"
    && action.interruptingCombatantId === combatant.id);
  if (combat.combatant?.id !== combatant.id && !(allowInterrupt && interrupting)) return null;
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
    isActive: combat?.combatant?.id === combatant?.id, actionPoints: currentActionPoints(actor),
    canTakeProactiveTurn: conditions.capabilities.canTakeProactiveTurn,
    canAttack: conditions.capabilities.canAttack,
    engaged: isEngaged(tacticalState(combat).relations, combatant?.id),
    prone: actor?.statuses?.has?.("prone"), hasRangedWeapon: modes.some((mode) =>
      ["ranged", "siege"].includes(mode.weaponType)), hasPreparedWeapon: modes.length > 0,
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
  root?.querySelectorAll?.("[data-combat-action-key]").forEach((button) => {
    const key = button.dataset.combatActionKey;
    const state = presentation[key] ?? { available: false, cost: 1, reason: "unavailable" };
    button.hidden = (key === "releaseWeapon" && !weaponPins(actor).length)
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
  const current = currentActionPoints(actor);
  if (current < cost) return false;
  await actor.update({ "system.resources.actionPoints.value": current - cost });
  return true;
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
  if (!combat?.started || combat.combatant?.id !== combatant?.id || !actor || !user || !rollsValid
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
  await combat.nextTurn();
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
  if (!resistance || !await spend(actor, 1)) return;
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
  await context.combat.nextTurn();
}

function eligibleDelays(combat, state, actorCombatantId) {
  return combat.turns.filter((entry) => entry.id !== actorCombatantId
    && state.delays[entry.id]?.status === "reserved" && entry.actor
    && currentActionPoints(entry.actor) >= 0).map((entry) => ({ combatantId: entry.id,
      actorUuid: entry.actor.uuid, name: entry.name, initiative: Number(entry.initiative ?? -Infinity) }));
}

function actionCard(action) {
  const responses = action.interruptCandidates?.map((candidate) => {
    const response = action.interruptResponses?.[candidate.combatantId];
    const controls = !response && action.status === "awaitingInterrupts"
      ? `<span><button type="button" data-action-transaction="interrupt" data-combatant-id="${escape(candidate.combatantId)}">${escape(localize("MYTHRASF.Action.Interrupt"))}</button><button type="button" data-action-transaction="pass" data-combatant-id="${escape(candidate.combatantId)}">${escape(localize("MYTHRASF.Action.PassInterrupt"))}</button></span>`
      : `<span>${escape(response ?? localize("MYTHRASF.Action.Pending"))}</span>`;
    return `<div class="mythras-chat-row"><span>${escape(candidate.name)}</span>${controls}</div>`;
  }).join("") ?? "";
  const confirmation = action.status === "awaitingConfirmation"
    ? `<div class="mythras-chat-actions"><button type="button" data-action-transaction="confirm">${escape(localize("MYTHRASF.CombatEffect.Confirm"))}</button><button type="button" data-action-transaction="cancel">${escape(localize("MYTHRASF.Cancel"))}</button></div>` : "";
  return `<section class="mythras-chat-card" data-combat-action-card><h3 class="mythras-chat-title">${escape(localize(`MYTHRASF.Action.${action.key}`))}</h3><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Action.Actor"))}</span><span>${escape(action.actorName)}</span></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Action.StatusLabel"))}</span><span>${escape(localize(`MYTHRASF.Action.Status.${action.status}`))}</span></div>${responses}${action.note ? `<p>${escape(action.note)}</p>` : ""}${confirmation}</section>`;
}

async function save(combat, state) {
  state.revision = Number(state.revision ?? 0) + 1;
  await combat.setFlag(SCOPE, FLAG, state);
}

async function createTransaction(context, key, parameters = {}) {
  const definition = COMBAT_ACTIONS[key];
  if (!definition || !await spend(context.combatant.actor, definition.cost)) {
    ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.actionPoints")); return null;
  }
  const id = foundry.utils.randomID(); const candidates = definition.observable
    ? eligibleDelays(context.combat, context.state, context.combatant.id) : [];
  const action = { schemaVersion: 1, id, revision: 0, key, type: definition.type,
    actorUuid: context.combatant.actor.uuid, actorName: context.combatant.name,
    tokenUuid: context.combatant.token?.uuid ?? "", combatantId: context.combatant.id,
    combatId: context.combat.id, round: context.combat.round,
    cycle: context.combat.mythrasTurnEconomy?.cycle ?? 1, turn: context.combat.turn,
    cost: definition.cost, spent: true, parameters, userId: game.user.id,
    coordinatorUserId: game.users.filter((user) => user.active && user.isGM)
      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? game.user.id,
    status: candidates.length ? "awaitingInterrupts"
      : definition.guided ? "awaitingConfirmation" : "resolving",
    note: parameters.note ?? "", interruptCandidates: candidates,
    interruptResponses: {}, createdAt: Date.now() };
  context.state.actions[id] = action; await save(context.combat, context.state);
  const message = await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: context.combatant.actor }),
    content: actionCard(action), flags: { [SCOPE]: { combatAction: { combatId: context.combat.id,
      actionId: id, revision: action.revision } } } });
  action.messageUuid = message.uuid; await save(context.combat, context.state);
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

async function executeAction(combat, action) {
  const state = combatActionState(combat); const current = state.actions[action.id];
  if (!current || current.status === "resolved") return;
  const combatant = combat.combatants.get(current.combatantId); const actor = combatant?.actor;
  if (!actor) { current.status = "awaitingConfirmation"; current.note = localize("MYTHRASF.Action.MissingActor"); }
  else if (current.key === "delay") {
    state.delays[combatant.id] = { status: "reserved", actionId: current.id,
      declaredRound: combat.round, declaredCycle: combat.mythrasTurnEconomy?.cycle ?? 1,
      expiresRound: combat.round, expiresCycle: (combat.mythrasTurnEconomy?.cycle ?? 1) + 1,
      userId: current.userId }; current.status = "resolved";
  } else if (current.key === "move") {
    state.movements[combatant.id] = movementDeclaration({ ...current.parameters,
      round: combat.round, cycle: combat.mythrasTurnEconomy?.cycle ?? 1,
      previous: state.movements[combatant.id], userId: current.userId });
    delete state.braces[combatant.id]; current.status = "resolved";
  } else if (current.key === "brace") {
    state.braces[combatant.id] = { status: "active", round: combat.round,
      weaponId: current.parameters.weaponId ?? "", userId: current.userId, updatedAt: Date.now() };
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
    await advanceActorTurnConditions(actor, [], { consumeCurrent: true });
    current.status = "resolved";
    current.actorTurnConditionsAdvanced = true;
  }
  else current.status = "awaitingConfirmation";
  current.resolvedAt = current.status === "resolved" ? Date.now() : null;
  current.revision += 1; await save(combat, state); await updateCard(current);
  Hooks.callAll("mythrasCombatActionResolved", combat, current);
  if (current.status === "resolved" && combat.combatant?.id === current.combatantId) {
    await combat.nextTurn({ skipCurrentActorConditions: current.actorTurnConditionsAdvanced });
  }
}

async function updateCard(action) {
  const message = action.messageUuid ? await fromUuid(action.messageUuid) : null;
  if (message) await message.update({ content: actionCard(action),
    [`flags.${SCOPE}.combatAction.revision`]: action.revision });
}

export async function requestCombatAction(actor, key) {
  const context = activeContext(actor, { allowInterrupt: true });
  if (!context || (!game.user.isGM && !actor.isOwner) || !actionAvailability(actor)[key]) {
    return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.turn"));
  }
  let parameters = {};
  if (key === "releaseGrab") return requestGrabRelease(actor);
  if (key === "recoverImpaledWeapon") return requestRecoverImpaledWeapon(actor);
  if (key === "releaseWeapon") return requestWeaponRelease(actor);
  if (key === "releaseEntangle") return requestEntangleRelease(actor);
  if (key === "entangleTrip") return requestEntangleTrip(actor);
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
  const action = await createTransaction(context, key, parameters); if (!action) return;
  Hooks.callAll("mythrasCombatActionDeclared", context.combat, action);
  if (action.status === "resolving") await executeAction(context.combat, action);
}

async function applyCardRequest(request) {
  const combat = game.combats.get(request.combatId); const state = combatActionState(combat);
  const action = state.actions[request.actionId]; const user = game.users.get(request.userId);
  if (!combat || !action || !user || Number(action.revision) !== Number(request.revision)) return;
  if (["interrupt", "pass"].includes(request.operation)) {
    const candidate = action.interruptCandidates.find((entry) => entry.combatantId === request.combatantId);
    const actor = combat.combatants.get(request.combatantId)?.actor;
    if (!candidate || action.interruptResponses[request.combatantId]
      || (!user.isGM && !actor?.testUserPermission(user, "OWNER"))) return;
    action.interruptResponses[request.combatantId] = request.operation;
    const complete = action.interruptCandidates.every((entry) => action.interruptResponses[entry.combatantId]);
    if (complete) {
      const interrupter = action.interruptCandidates.filter((entry) =>
        action.interruptResponses[entry.combatantId] === "interrupt")
        .sort((left, right) => right.initiative - left.initiative)[0];
      if (interrupter) {
        state.delays[interrupter.combatantId].status = "consumed";
        action.interruptingCombatantId = interrupter.combatantId;
        action.status = "awaitingConfirmation";
        action.note = game.i18n.format("MYTHRASF.Action.InterruptWinner", { actor: interrupter.name });
      } else action.status = COMBAT_ACTIONS[action.key].guided ? "awaitingConfirmation" : "resolving";
    }
  } else if (["confirm", "cancel"].includes(request.operation)) {
    const actor = combat.combatants.get(action.combatantId)?.actor;
    if (!user.isGM && !actor?.testUserPermission(user, "OWNER")) return;
    action.status = request.operation === "confirm" ? "resolved" : "cancelled";
    action.note = request.note ?? action.note; action.resolvedAt = Date.now();
  }
  action.revision += 1; await save(combat, state); await updateCard(action);
  if (action.status === "resolving") await executeAction(combat, action);
  if (["resolved", "cancelled"].includes(action.status)
    && combat.combatant?.id === action.combatantId) await combat.nextTurn();
}

export function activateCombatActionCard(message, html) {
  const reference = message.getFlag?.(SCOPE, "combatAction"); if (!reference) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
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
    if (request?.action === "combatAction" && game.mythrasFoundry?.combat?.isCoordinator?.()) {
      await applyCardRequest(request);
    }
  });
}

export async function expireCombatActionTurn(combat, combatantId) {
  if (!combat || !combatantId) return;
  const state = combatActionState(combat); const delay = state.delays[combatantId];
  if (delay?.status === "reserved") { delay.status = "expired"; delay.expiredAt = Date.now(); await save(combat, state); }
}
