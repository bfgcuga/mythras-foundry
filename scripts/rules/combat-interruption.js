import { currentActionPoints } from "./action-points.js";
import { resolveActorConditions } from "./actor-conditions.js";
import { combatantForActor } from "./engagement-runtime.js";
import { consumeActorWaiting, withActionPointLock } from "./combat-waiting.js";
import { actorDisplayName } from "./document-names.js";
import { delayIsValid } from "./combat-actions.js";
import { exchangeTerminal } from "./combat-exchange-state.js";

const SCOPE = "mythras-foundry";
const FLAG = "combatInterruption";
const SOCKET = `system.${SCOPE}`;
const livePhases = ["choosing", "resolving", "awaitingDecision"];
const queues = new Map();
const replies = new Map();
const localize = key => game.i18n.localize(key);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const values = collection => Array.from(collection?.values?.() ?? collection ?? []);

export function combatInterruption(combat) {
  const session = combat?.getFlag?.(SCOPE, FLAG);
  return livePhases.includes(session?.phase) ? session : null;
}

export function interruptionTurnIsCurrent(combat, session = combatInterruption(combat)) {
  return Boolean(session && combat?.started && combat.combatant?.id === session.interruptedCombatantId
    && Number(combat.round) === session.round
    && Number(combat.mythrasTurnEconomy?.cycle ?? 1) === session.cycle
    && Number(combat.mythrasTurnEconomy?.revision ?? 0) === session.turnRevision);
}

export function canStartProactiveAction(combat, combatant) {
  if (!combat?.started || !combatant) return false;
  const session = combatInterruption(combat);
  if (!session) return combat.combatant?.id === combatant.id;
  return interruptionTurnIsCurrent(combat, session) && session.phase === "choosing"
    && session.combatantId === combatant.id;
}

export function choosingInterruption(combat, combatantId) {
  const session = combatInterruption(combat);
  return session?.phase === "choosing" && session.combatantId === combatantId
    && interruptionTurnIsCurrent(combat, session) ? session : null;
}

export function interruptionBlocksMessage(message) {
  if (typeof message?.getFlag?.(SCOPE, "interruptionImpeded") === "string") return true;
  return values(globalThis.game?.combats).some(combat =>
    combatInterruption(combat)?.suspendedMessages?.includes(message?.uuid));
}

export function interruptionBlocksAction(combat, actionId) {
  return combatInterruption(combat)?.suspendedActions?.includes(actionId) ?? false;
}

function captureDeclaration(combat, combatantId) {
  const actions = Object.values(combat.getFlag(SCOPE, "combatActions")?.actions ?? {})
    .filter(action => action.combatantId === combatantId && action.type !== "reactive" && !action.interruptionId
      && (!["resolved", "cancelled"].includes(action.status)
        || (action.status === "resolved" && Number(action.round) === Number(combat.round)
          && Number(action.cycle) === Number(combat.mythrasTurnEconomy?.cycle ?? 1)
          && Number(action.turn) === Number(combat.turn))));
  const messages = values(game.messages).filter(message => {
    const exchange = message.getFlag?.(SCOPE, "combat");
    const reach = message.getFlag?.(SCOPE, "reachChange");
    const release = message.getFlag?.(SCOPE, "weaponRelease");
    const contest = message.getFlag?.(SCOPE, "contest");
    return (exchange?.turnEconomy?.combatId === combat.id && exchange.turnEconomy.combatantId === combatantId
      && !exchange.turnEconomy.turnAdvanced && exchange.status !== "cancelled")
      || (reach?.combatId === combat.id && reach.actorCombatantId === combatantId && reach.status === "awaitingResponse")
      || (release?.combatId === combat.id && release.combatantId === combatantId && release.status === "pending")
      || (contest?.actionContext?.combatId === combat.id && actions.some(action => action.id === contest.actionContext.actionId));
  });
  const paid = actions.some(action => action.spent && action.cost > 0) || messages.some(message => {
    const exchange = message.getFlag(SCOPE, "combat");
    return Boolean(exchange?.turnEconomy?.attackSpent || message.getFlag(SCOPE, "reachChange")
      || message.getFlag(SCOPE, "weaponRelease"));
  });
  return { suspendedActions: actions.map(action => action.id), suspendedMessages: [...new Set([...messages.map(message => message.uuid), ...actions.map(action => action.messageUuid).filter(Boolean)])],
    declarationPaid: paid, declarationName: actions[0] ? localize(`MYTHRASF.Action.${actions[0].key}`)
      : messages.length ? localize("MYTHRASF.Interruption.DeclaredAction") : localize("MYTHRASF.Interruption.NoDeclaration") };
}

export function interruptionCard(session) {
  const button = (operation, key) => `<button type="button" data-interruption-operation="${operation}">${escape(localize(key))}</button>`;
  const controls = session.phase === "choosing" ? button("cancel", "MYTHRASF.Cancel")
    : session.phase === "awaitingDecision" ? button("prevent", "MYTHRASF.Interruption.Prevent")
      + button("continue", "MYTHRASF.Interruption.Continue") : "";
  return `<section class="mythras-chat-card" data-interruption-card><h3 class="mythras-chat-title">${escape(localize("MYTHRASF.Action.interrupt"))}</h3>
    <div class="mythras-chat-row"><span>${escape(session.actorName)}</span><span>${escape(localize(`MYTHRASF.Interruption.Phase.${session.phase}`))}</span></div>
    <div class="mythras-chat-row"><span>${escape(session.interruptedName)}</span><span>${escape(session.declarationName)}</span></div>
    ${session.phase === "awaitingDecision" ? `<p>${escape(game.i18n.format("MYTHRASF.Interruption.Question", { actor: session.interruptedName }))}</p>` : ""}
    <div class="mythras-chat-actions">${controls}</div></section>`;
}

async function save(combat, session) {
  session.revision = Number(session.revision ?? 0) + 1;
  if (session.phase === "awaitingDecision" && !session.messageUuid) {
    const message = await ChatMessage.create({ content: interruptionCard(session),
      flags: { [SCOPE]: { interruption: { combatId: combat.id, sessionId: session.id } } } });
    session.messageUuid = message.uuid;
  }
  await combat.setFlag(SCOPE, FLAG, session);
  const message = session.messageUuid ? await fromUuid(session.messageUuid) : null;
  if (message) await message.update({ content: interruptionCard(session),
    [`flags.${SCOPE}.interruption`]: { combatId: combat.id, sessionId: session.id } });
  for (const uuid of session.suspendedMessages ?? []) {
    const suspended = await fromUuid(uuid);
    if (suspended) ui.chat?.updateMessage?.(suspended);
  }
}

async function resumeDeclaration(combat, session) {
  for (const id of session.suspendedActions) {
    if (!interruptionTurnIsCurrent(combat, session)) break;
    const action = combat.getFlag(SCOPE, "combatActions")?.actions?.[id];
    if (action?.status === "resolving") {
      const { executeAction } = await import("./combat-action-runtime.js");
      await executeAction(combat, action);
    } else if (action?.status === "resolved") {
      await combat.nextTurn({ skipCurrentActorConditions: action.actorTurnConditionsAdvanced });
    }
  }
  for (const uuid of session.suspendedMessages) {
    const message = await fromUuid(uuid);
    if (!message) continue;
    const exchange = message.getFlag(SCOPE, "combat");
    if (exchange?.turnEconomy && exchangeTerminal(exchange) && !exchange.turnEconomy.turnAdvanced) {
      const { advanceCombatExchange } = await import("./combat-exchange-runtime.js");
      const { renderCombatExchange } = await import("./combat-chat-renderer.js");
      await advanceCombatExchange(message, foundry.utils.deepClone(exchange), {
        combatById: id => game.combats.get(id), render: renderCombatExchange
      });
    }
    ui.chat?.updateMessage?.(message);
  }
}

async function actionFinished(combat, session, cancelled) {
  if (cancelled) {
    const actor = combat.combatants.get(session.combatantId)?.actor;
    if (!actor || currentActionPoints(actor) < session.pointsBeforeAction) return false;
  }
  const ref = session.actionReference;
  if (!ref) return cancelled || ["immediate", "general"].includes(session.actionKind);
  if (ref.kind === "general") {
    const action = combat.getFlag(SCOPE, "combatActions")?.actions?.[ref.actionId];
    return action?.combatantId === session.combatantId && ["resolved", "cancelled"].includes(action.status);
  }
  const message = await fromUuid(ref.messageUuid);
  if (!message) return false;
  if (ref.kind === "attack") {
    const exchange = message.getFlag(SCOPE, "combat");
    return exchange?.turnEconomy?.interruptionId === session.id && exchangeTerminal(exchange)
      && (!cancelled || exchange.status === "cancelled");
  }
  const state = message.getFlag(SCOPE, ref.kind === "reach" ? "reachChange" : "weaponRelease");
  return state?.status === "resolved";
}

async function restoreWaiting(combat, session) {
  const actor = combat.combatants.get(session.combatantId)?.actor;
  if (!actor || !interruptionTurnIsCurrent(combat, session)) return;
  const state = foundry.utils.deepClone(combat.getFlag(SCOPE, "combatActions") ?? {});
  state.delays ??= {};
  state.delays[session.combatantId] = { ...session.waiting };
  state.revision = Number(state.revision ?? 0) + 1;
  await combat.setFlag(SCOPE, "combatActions", state);
  await actor.createEmbeddedDocuments("ActiveEffect", [{ name: localize("MYTHRASF.Status.Waiting"),
    img: "icons/svg/clockwork.svg", statuses: ["waiting"],
    flags: { [SCOPE]: { waiting: { combatId: combat.id, combatantId: session.combatantId } } } }]);
}

async function impedeDeclaration(combat, session) {
  const state = foundry.utils.deepClone(combat.getFlag(SCOPE, "combatActions") ?? {});
  for (const id of session.suspendedActions) {
    const action = state.actions?.[id];
    if (action) Object.assign(action, { status: "cancelled", impeded: true, revision: Number(action.revision ?? 0) + 1 });
  }
  if (session.suspendedActions.length) await combat.setFlag(SCOPE, "combatActions", state);
  for (const uuid of session.suspendedMessages) {
    const message = await fromUuid(uuid);
    if (!message) continue;
    const updates = { [`flags.${SCOPE}.interruptionImpeded`]: session.id };
    for (const flag of ["combat", "reachChange", "weaponRelease", "contest"]) {
      const original = message.getFlag(SCOPE, flag);
      if (!original) continue;
      const data = foundry.utils.deepClone(original);
      Object.assign(data, { status: "cancelled", impeded: true, revision: Number(data.revision ?? 0) + 1 });
      if (data.turnEconomy) Object.assign(data.turnEconomy, { turnAdvanced: true, impeded: true });
      updates[`flags.${SCOPE}.${flag}`] = data;
    }
    updates.content = `<section class="mythras-chat-card"><h3 class="mythras-chat-title">${escape(localize("MYTHRASF.Interruption.Impeded"))}</h3><p>${escape(session.interruptedName)}</p></section>`;
    await message.update(updates);
  }
}

export async function applyInterruptionRequest(request) {
  const combat = game.combats.get(request.combatId);
  const user = game.users.get(request.userId);
  if (!combat || !user) return false;
  let session = combatInterruption(combat);
  if (request.operation === "begin") {
    const entry = combat.combatants.get(request.combatantId);
    const actor = entry?.actor;
    const waiting = combat.getFlag(SCOPE, "combatActions")?.delays?.[entry?.id];
    if (session || !combat.started || !combat.combatant || combat.combatant.id === entry?.id
      || !delayIsValid(waiting, { round: combat.round, cycle: combat.mythrasTurnEconomy?.cycle ?? 1 }) || !actor || currentActionPoints(actor) < 1
      || (!user.isGM && !actor.testUserPermission(user, "OWNER"))
      || !resolveActorConditions(actor).capabilities.canTakeProactiveTurn) return false;
    session = { schemaVersion: 1, id: foundry.utils.randomID(), revision: 0, phase: "choosing",
      combatantId: entry.id, interruptedCombatantId: combat.combatant.id,
      actorName: actorDisplayName(actor), interruptedName: actorDisplayName(combat.combatant.actor),
      round: Number(combat.round), cycle: Number(combat.mythrasTurnEconomy?.cycle ?? 1),
      turnRevision: Number(combat.mythrasTurnEconomy?.revision ?? 0),
      waiting: foundry.utils.deepClone(waiting), ...captureDeclaration(combat, combat.combatant.id) };
    await save(combat, session);
    return true;
  }
  if (!session || session.id !== request.sessionId) return false;
  if (!interruptionTurnIsCurrent(combat, session)) {
    session.phase = "stale"; await save(combat, session); return false;
  }
  const actor = combat.combatants.get(session.combatantId)?.actor;
  if (!actor || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return false;
  if (request.operation === "cancel" && session.phase === "choosing") {
    session.phase = "cancelled"; await save(combat, session);
    await resumeDeclaration(combat, session); return true;
  }
  if (request.operation === "claim" && session.phase === "choosing") {
    return withActionPointLock(actor, async () => {
      if (currentActionPoints(actor) < 1
        || combat.getFlag(SCOPE, "combatActions")?.delays?.[session.combatantId]?.status !== "reserved"
        || !resolveActorConditions(actor).capabilities.canTakeProactiveTurn) return false;
      session.pointsBeforeAction = currentActionPoints(actor);
      await actor.update({ "system.resources.actionPoints.value": session.pointsBeforeAction - 1 });
      await consumeActorWaiting(actor);
      session.phase = "resolving";
      session.actionKind = request.actionKind ?? "general";
      await save(combat, session);
      return true;
    });
  }
  if (request.operation === "bind" && session.phase === "resolving" && !session.actionReference) {
    session.actionReference = request.reference;
    await save(combat, session); return true;
  }
  if (request.operation === "finish" && session.phase === "resolving") {
    if (!await actionFinished(combat, session, request.cancelled)) return false;
    if (request.cancelled) {
      await restoreWaiting(combat, session);
      session.phase = "cancelled";
    } else session.phase = "awaitingDecision";
    await save(combat, session);
    if (request.cancelled) await resumeDeclaration(combat, session);
    return true;
  }
  if (["prevent", "continue"].includes(request.operation) && session.phase === "awaitingDecision" && user.isGM) {
    if (request.operation === "prevent") {
      const interrupted = combat.combatants.get(session.interruptedCombatantId)?.actor;
      if (!session.declarationPaid && interrupted) await withActionPointLock(interrupted, () =>
        interrupted.update({ "system.resources.actionPoints.value": Math.max(0, currentActionPoints(interrupted) - 1) }));
      await impedeDeclaration(combat, session);
    }
    session.phase = request.operation === "prevent" ? "prevented" : "continued";
    await save(combat, session);
    if (request.operation === "prevent") await combat.nextTurn();
    else await resumeDeclaration(combat, session);
    return true;
  }
  return false;
}

function enqueue(request) {
  const previous = queues.get(request.combatId) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(() => applyInterruptionRequest(request));
  queues.set(request.combatId, pending);
  return pending.finally(() => { if (queues.get(request.combatId) === pending) queues.delete(request.combatId); });
}

export async function submitInterruption(combat, operation, data = {}) {
  const request = { action: "combatInterruption", combatId: combat.id, operation,
    sessionId: combatInterruption(combat)?.id, userId: game.user.id, ...data };
  if (game.mythrasFoundry?.combat?.isCoordinator?.() ?? game.user.isGM) return enqueue(request);
  request.requestId = foundry.utils.randomID();
  return new Promise(resolve => {
    const timer = setTimeout(() => { replies.delete(request.requestId); resolve(false); }, 30000);
    replies.set(request.requestId, value => { clearTimeout(timer); resolve(value); });
    game.socket.emit(SOCKET, request);
  });
}

export async function interruptionActionPayment(actor, { reactive = false, actionKind = "general" } = {}) {
  const combat = game.combat ?? game.combats?.active;
  const session = combatInterruption(combat);
  const entry = combatantForActor(combat, actor, actor?.token?.uuid);
  if (!session || reactive) return null;
  if (!choosingInterruption(combat, entry?.id)) return false;
  return submitInterruption(combat, "claim", { actionKind });
}

export async function bindInterruptionAction(combat, combatantId, reference) {
  const session = combatInterruption(combat);
  if (session?.phase !== "resolving" || session.combatantId !== combatantId) return;
  return submitInterruption(combat, "bind", { reference });
}

export async function finishInterruptionAction(combat, combatantId, options = {}) {
  const session = combatInterruption(combat);
  if (session?.phase !== "resolving" || session.combatantId !== combatantId) return false;
  return submitInterruption(combat, "finish", options);
}

export async function clearCombatInterruption(combat) {
  const session = combatInterruption(combat);
  if (session) { session.phase = "cancelled"; await save(combat, session); }
}

export function activateInterruptionCard(message, html) {
  const ref = message.getFlag?.(SCOPE, "interruption");
  if (!ref) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const combat = game.combats.get(ref.combatId);
  const session = combatInterruption(combat);
  root?.querySelectorAll?.("[data-interruption-operation]").forEach(button => {
    const operation = button.dataset.interruptionOperation;
    const actor = combat?.combatants.get(session?.combatantId)?.actor;
    button.hidden = operation === "cancel" ? !game.user.isGM && !actor?.isOwner : !game.user.isGM;
    button.addEventListener("click", () => {
      if (combatInterruption(combat)?.id === ref.sessionId) return submitInterruption(combat, operation);
    });
  });
}

export function registerInterruptionSocket() {
  game.socket.on(SOCKET, async request => {
    if (request?.action === "combatInterruptionReply" && request.userId === game.user.id) {
      const reply = replies.get(request.requestId); replies.delete(request.requestId); reply?.(request.result); return;
    }
    if (request?.action !== "combatInterruption" || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    let result = false;
    try { result = await enqueue(request); }
    finally {
      if (request.requestId) game.socket.emit(SOCKET, { action: "combatInterruptionReply", requestId: request.requestId,
        userId: request.userId, result });
    }
  });
}
