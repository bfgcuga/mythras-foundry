import { currentActionPoints } from "./action-points.js";
import { combatCanBeCancelled } from "./combat-cancellation.js";
import { exchangeTerminal, resolvePendingExchangeSteps } from "./combat-exchange-state.js";
import { combatSideEntry } from "./combat-effect-runtime.js";
import { disarmHasFreeHand } from "./combat-disarm.js";

export async function advanceCombatExchange(message, combat, { force = false, combatById,
  render, flagScope = "mythras-foundry" } = {}) {
  if (!combat.turnEconomy || combat.turnEconomy.turnAdvanced || !exchangeTerminal(combat)
    || (!force && combatCanBeCancelled(combat))) return false;
  const tracker = combatById(combat.turnEconomy.combatId);
  if (!tracker?.started || tracker.combatant?.id !== combat.turnEconomy.combatantId
    || Number(tracker.round) !== Number(combat.turnEconomy.round)) return false;
  combat.turnEconomy.turnAdvanced = true;
  combat.turnEconomy.advancedAt = Date.now();
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  await tracker.nextTurn();
  return true;
}

export async function closeTerminalCombatExchange(message, current, { clone, combatById,
  render, advance, flagScope = "mythras-foundry" } = {}) {
  if (!current.turnEconomy || current.turnEconomy.turnAdvanced || !exchangeTerminal(current)) {
    return false;
  }
  const combat = clone(current);
  const tracker = combatById(combat.turnEconomy.combatId);
  if (tracker?.started && tracker.combatant?.id === combat.turnEconomy.combatantId
    && Number(tracker.round) === Number(combat.turnEconomy.round)) {
    await advance(message, combat, { force: true });
  } else {
    combat.turnEconomy.turnAdvanced = true;
    combat.turnEconomy.advancedAt = Date.now();
    combat.revision += 1;
    await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  }
  return true;
}

export async function refundCombatExchangeActionPoints(combat, { resolveActor } = {}) {
  const economy = combat.turnEconomy;
  for (const [spentKey, refundedKey, entry] of [
    ["attackSpent", "attackRefunded", combat.attacker],
    ["defenseSpent", "defenseRefunded", combat.defender]
  ]) {
    if (!economy?.[spentKey]) continue;
    const actor = await resolveActor(entry.tokenUuid, entry.actorUuid);
    if (actor) await actor.update({ "system.resources.actionPoints.value":
      currentActionPoints(actor) + 1 });
    economy[spentKey] = false;
    economy[refundedKey] = true;
  }
}

export async function applyCombatExchangeCancellation(message, current, { reason = "", userId,
  clone, resolveActor, render, flagScope = "mythras-foundry" } = {}) {
  if (!combatCanBeCancelled(current)) return false;
  const combat = clone(current);
  combat.cancelReason = reason;
  combat.cancelledBy = userId;
  await refundCombatExchangeActionPoints(combat, { resolveActor });
  combat.status = "cancelled";
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  return true;
}

export function resolveCombatExchangePending(combat, { note = "", userId = "" } = {}) {
  return resolvePendingExchangeSteps(combat, { note, userId });
}

export async function resolveCombatExchangeConsequence(message, current, index, { note = "",
  userId, clone, render, advance, flagScope = "mythras-foundry" } = {}) {
  const combat = clone(current);
  const consequence = combat.consequences?.[Number(index)];
  if (!consequence || consequence.status !== "pending") return false;
  Object.assign(consequence, { status: "resolved", note, userId, resolvedAt: Date.now() });
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  await advance(message, combat);
  return true;
}

export async function applyDroppedCombatItem(message, request, { clone, flagScope,
  resolveActor, userById, render, advance } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)) return false;
  const consequence = combat.consequences?.[Number(request.consequenceIndex)];
  if (!consequence || consequence.key !== "dropHeldItem" || consequence.status !== "pending") {
    return false;
  }
  const entry = combatSideEntry(combat, consequence.actorSide ?? "defender");
  const actor = await resolveActor(entry.tokenUuid, entry.actorUuid);
  const user = userById(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return false;
  const itemId = String(request.itemId ?? "");
  const choice = (consequence.itemChoices ?? []).find((item) => item.id === itemId);
  if (itemId && !choice) return false;
  const item = itemId ? actor.items.get(itemId) : null;
  if (itemId && (!item || item.type !== "weapon")) return false;
  if (item?.system.equipped) await item.update({ "system.equipped": false });
  Object.assign(consequence, { status: "resolved", itemId, itemName: choice?.name ?? "",
    resolvedBy: user.id, resolvedAt: Date.now() });
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  await advance(message, combat);
  return true;
}

export async function applyDisarmChoice(message, request, { clone, flagScope,
  resolveActor, userById, render, advance } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)
    || !["take", "throw"].includes(request.choice)) return false;
  const consequence = combat.consequences?.[Number(request.consequenceIndex)];
  if (!consequence || consequence.key !== "disarmChoice" || consequence.status !== "pending") {
    return false;
  }
  const takerEntry = combatSideEntry(combat, consequence.actorSide);
  const victimEntry = combatSideEntry(combat, consequence.victimSide);
  const taker = await resolveActor(takerEntry.tokenUuid, takerEntry.actorUuid);
  const victim = await resolveActor(victimEntry.tokenUuid, victimEntry.actorUuid);
  const user = userById(request.userId);
  if (!taker || !victim || !user || (!user.isGM && !taker.testUserPermission(user, "OWNER"))) {
    return false;
  }
  const weapon = victim.items.get(consequence.weaponId);
  if (!weapon || weapon.type !== "weapon") return false;
  if (request.choice === "take") {
    if (!disarmHasFreeHand(taker)) return false;
    const data = weapon.toObject();
    delete data._id;
    data.system = { ...data.system, equipped: true };
    await taker.createEmbeddedDocuments("Item", [data]);
    await victim.deleteEmbeddedDocuments("Item", [weapon.id]);
  }
  Object.assign(consequence, { status: "resolved", choice: request.choice,
    key: request.choice === "take" ? "disarmTaken" : "disarmThrown",
    resolvedBy: user.id, resolvedAt: Date.now() });
  const check = (combat.effects?.checks ?? []).find((entry) =>
    entry.consequence?.key === "disarmChoice"
    && entry.consequence.weaponId === consequence.weaponId);
  if (check) check.consequence = { ...consequence };
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  await advance(message, combat);
  return true;
}
