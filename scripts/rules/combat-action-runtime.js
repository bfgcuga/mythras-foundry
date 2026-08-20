import { currentActionPoints } from "./action-points.js";
import { resolveActorConditions } from "./actor-conditions.js";
import { combatantForActor, tacticalState } from "./engagement-runtime.js";
import { weaponModes } from "./weapon-modes.js";
import { availableCombatActions, COMBAT_ACTIONS, emptyCombatActionState, isEngaged,
  chargeEligibility, chargeModifiers, movementDeclaration,
  normalizeCombatActionState } from "./combat-actions.js";

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
  const combat = game.combat ?? game.combats?.active;
  const combatant = combatantForActor(combat, actor, actor?.token?.uuid);
  const state = combatActionState(combat);
  const conditions = resolveActorConditions(actor, { baseAttributes:
    actor?.system?.baseAttributes ?? actor?.system?.attributes ?? {} });
  const modes = actor?.items?.filter((item) => item.type === "weapon" && item.system.equipped)
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => mode.key === weapon.system.activeModeKey)) ?? [];
  return availableCombatActions({ inCombat: Boolean(combat?.started && combatant),
    isActive: combat?.combatant?.id === combatant?.id, actionPoints: currentActionPoints(actor),
    canTakeProactiveTurn: conditions.capabilities.canTakeProactiveTurn,
    canAttack: conditions.capabilities.canAttack,
    engaged: isEngaged(tacticalState(combat).relations, combatant?.id),
    prone: actor?.statuses?.has?.("prone"), hasRangedWeapon: modes.some((mode) =>
      ["ranged", "siege"].includes(mode.weaponType)), hasPreparedWeapon: modes.length > 0,
    hasRestraint: restraintEffects(actor).length > 0,
    hasDelay: state.delays[combatant?.id]?.status === "reserved",
    canCharge: chargeEligibility(state.movements[combatant?.id], combat?.round).eligible });
}

export function decorateCombatActionButtons(actor, root) {
  const availability = actionAvailability(actor);
  root?.querySelectorAll?.("[data-combat-action-key]").forEach((button) => {
    const key = button.dataset.combatActionKey;
    button.hidden = !availability[key];
    button.disabled = !availability[key];
    button.onclick = () => requestCombatAction(actor, key);
  });
}

async function spend(actor, cost = 1) {
  const current = currentActionPoints(actor);
  if (current < cost) return false;
  await actor.update({ "system.resources.actionPoints.value": current - cost });
  return true;
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
  const weapons = actor.items.filter((item) => item.type === "weapon");
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
    if (!weapon) { current.status = "awaitingConfirmation"; current.note = localize("MYTHRASF.Action.MissingWeapon"); }
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
  } else if (current.key === "hesitate") current.status = "resolved";
  else current.status = "awaitingConfirmation";
  current.resolvedAt = current.status === "resolved" ? Date.now() : null;
  current.revision += 1; await save(combat, state); await updateCard(current);
  Hooks.callAll("mythrasCombatActionResolved", combat, current);
  if (current.status === "resolved" && combat.combatant?.id === current.combatantId) await combat.nextTurn();
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
  if (key === "move") { parameters = await chooseMovement(context); if (!parameters) return; }
  if (key === "readyWeapon") { parameters = await chooseReadyWeapon(actor); if (!parameters) return; }
  if (["mount", "retainMagic", "useMagic", "counterspell"].includes(key)) {
    const note = await foundry.applications.api.DialogV2.prompt({ window: { title: localize(`MYTHRASF.Action.${key}`) },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Action.Note"))}</span><textarea name="note"></textarea></label></div>`,
      ok: { callback: (event, button) => button.form.elements.note.value.trim() } });
    if (note == null) return; parameters.note = note;
  }
  if (key === "brace") {
    const weapon = actor.items.find((item) => item.type === "weapon" && item.system.equipped);
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
