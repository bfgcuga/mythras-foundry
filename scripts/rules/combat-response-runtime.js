import { combatAttackHits, resolveCombatExchange } from "./combat.js";
import { combatEffectSlotsBySide, validateEffectSelections } from "./combat-effects.js";
import { effectiveActionPointMaximum } from "./action-points.js";
import { validateCombatResponse } from "./combat-exchange-state.js";
import { combatRollLuckAllowed } from "./combat-luck-availability.js";
import { classifyContestRoll } from "./contest-rolls.js";

export async function applyAccidentalTargetTransition(message, current, { token, entry = null,
  userId, clone, actorIdentity, tokenIdentity, tokenName, locationSnapshot, render,
  flagScope = "mythras-foundry" } = {}) {
  const actor = token?.actor;
  if (!actor || current.status !== "awaitingAccidentalTarget") return false;
  const combat = clone(current);
  combat.ranged.originalDefender = { ...combat.defender };
  combat.ranged.accidentalTarget = { tokenUuid: tokenIdentity(token), actorUuid: actor.uuid,
    actorName: tokenName(token), selectedBy: userId, selectedAt: Date.now() };
  combat.defender = { actorUuid: actor.uuid, actorId: actorIdentity(actor), actorName: tokenName(token),
    tokenUuid: tokenIdentity(token), defense: null, luckHistory: [], size: actor.system.size,
    targetType: "actor", targetWeaponId: "", locations: actor.items
      .filter((item) => item.type === "hitLocation").map(locationSnapshot) };
  if (combat.turnEconomy) combat.turnEconomy.defenderCombatantId = entry.id;
  combat.attacker.target = combat.ranged.normalTarget;
  combat.attacker.difficulty = "standard";
  combat.attackClassification = resolveCombatExchange({ attack: { target: combat.attacker.target,
    rawRoll: combat.attacker.rawRoll }, defense: { type: "none" } }).attack;
  combat.status = "awaitingAccidentalDefense";
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  return true;
}

export async function applyCombatDefenseTransition(message, request, { clone, flagScope,
  resolveActor, userById, warn, localize, combatById, actionPointRules, spendActionPoint,
  consumePassiveBlock, applyCondition, recordFumbles, consumeSurprise, render, appendRolls,
  advance } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  const actor = await resolveActor(combat?.defender?.tokenUuid, combat?.defender?.actorUuid);
  const invalid = combat && validateCombatResponse(combat, request,
    { actor, user: userById(request.userId) });
  if (!combat || invalid) {
    warn(localize(`MYTHRASF.Combat.Rejected.${invalid ?? "state"}`));
    return false;
  }
  if (!["none", "cover"].includes(request.defense.type) && combat.turnEconomy
    && !combat.turnEconomy.defenseSpent) {
    const tracker = combatById(combat.turnEconomy.combatId);
    const defenderEntry = tracker?.combatants.get(combat.turnEconomy.defenderCombatantId);
    if (!tracker?.started || defenderEntry?.actor?.uuid !== actor.uuid) {
      warn(localize("MYTHRASF.Tracker.Rejected.participation")); return false;
    }
    if (effectiveActionPointMaximum(actor, actionPointRules()) < 1
      || !await spendActionPoint(actor)) {
      warn(localize("MYTHRASF.Tracker.Rejected.actionPoints")); return false;
    }
    combat.turnEconomy.defenseSpent = true;
    combat.turnEconomy.defenseSpentBy = request.userId;
  }
  if (request.defense.type === "parry" && combat.turnEconomy) {
    await consumePassiveBlock(combatById(combat.turnEconomy.combatId),
      combat.turnEconomy.defenderCombatantId, request.defense.weaponId, "parry");
  }
  combat.defender.defense = request.defense;
  if (request.defense.type === "evade" && !actor.statuses?.has?.("prone")) {
    await applyCondition(actor, { key: "prone", statusId: "prone",
      name: localize("MYTHRASF.Status.Prone"), img: "icons/svg/falling.svg",
      source: { messageUuid: message.uuid, sourceName: combat.attacker.actorName,
        sourceActorUuid: combat.attacker.actorUuid, sourceTokenUuid: combat.attacker.tokenUuid },
      combat: combat.turnEconomy ? combatById(combat.turnEconomy.combatId) : null,
      duration: { unit: "manual", phase: "manual" } });
  }
  combat.resolution = resolveCombatExchange({ predeclared: combat.predeclared,
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll },
    defense: request.defense });
  await recordFumbles(combat);
  const surpriseSlots = await consumeSurprise(actor, combat);
  const sideSlots = combatEffectSlotsBySide({ winner: combat.resolution.winner,
    differential: combat.resolution.effects, surprise: surpriseSlots });
  const totalSlots = sideSlots.attacker + sideSlots.defender;
  combat.effects = { winner: combat.resolution.winner, slots: totalSlots, sideSlots,
    surpriseSlots, pendingSide: sideSlots.attacker ? "attacker"
      : sideSlots.defender ? "defender" : null,
    selections: [], confirmed: totalSlots === 0, checks: [] };
  combat.status = totalSlots > 0 ? "awaitingEffects" : "resolved";
  combat.damage = { status: totalSlots > 0 ? "blocked"
    : combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  combat.revision += 1;
  await message.update({ content: render(combat),
    rolls: appendRolls(message, request.defense.serializedRoll),
    [`flags.${flagScope}.combat`]: combat });
  await advance(message, combat);
  return true;
}

export async function applyCombatEffectsTransition(message, request, { clone, flagScope,
  resolveActor, userById, catalogDocuments, effectView, effectContext, warn, localize,
  applyImmediateEffects, immediateDependencies, render, advance } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || combat.status !== "awaitingEffects"
    || Number(request.revision) !== Number(combat.revision)) return false;
  const side = combat.effects.pendingSide ?? combat.effects.winner;
  if (request.side !== side) return false;
  const winnerEntry = side === "attacker" ? combat.attacker : combat.defender;
  const actor = await resolveActor(winnerEntry.tokenUuid, winnerEntry.actorUuid);
  const user = userById(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return false;
  const catalog = (await catalogDocuments()).map(effectView);
  const slots = combat.effects.sideSlots?.[side] ?? combat.effects.slots;
  const validation = validateEffectSelections({ slots, selections: request.selections,
    effects: catalog, context: effectContext(combat, side) });
  if (!validation.valid) {
    warn(localize("MYTHRASF.CombatEffect.Invalid")); return false;
  }
  const catalogByKey = new Map(catalog.map((effect) => [effect.key, effect]));
  const sideSelections = request.selections.map((selection, index) => {
    if (selection.waived) return { slot: index, side, waived: true };
    const effect = catalogByKey.get(selection.key);
    return { slot: index, side, waived: false, ...effect,
      parameters: { locationId: String(selection.parameters?.locationId ?? ""),
        note: String(selection.parameters?.note ?? "") },
      status: effect.requiresWound ? "conditional"
        : effect.ruleKey === "guided" ? "pending" : "active" };
  });
  combat.effects.selections.push(...sideSelections);
  combat.effects.confirmations = { ...(combat.effects.confirmations ?? {}),
    [side]: { userId: user.id, confirmedAt: Date.now() } };
  const nextSide = side === "attacker" && Number(combat.effects.sideSlots?.defender ?? 0) > 0
    ? "defender" : null;
  combat.effects.pendingSide = nextSide;
  combat.effects.confirmed = !nextSide;
  if (!nextSide) {
    combat.effects.confirmedBy = user.id;
    combat.effects.confirmedAt = Date.now();
    await applyImmediateEffects(combat, message, immediateDependencies());
    combat.status = "resolved";
    combat.damage = { status: combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  }
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  await advance(message, combat);
  return true;
}

export async function applyCombatLuckTransition(message, request, { clone, flagScope,
  resolveActor, userById, warn, localize, actorName, recordFumble, recordFumbles,
  consumeSurprise, render, appendRolls } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)
    || !combatRollLuckAllowed(combat) || !["attacker", "defender"].includes(request.side)) {
    return false;
  }
  const entry = request.side === "attacker" ? combat.attacker : combat.defender;
  const actor = await resolveActor(entry.tokenUuid, entry.actorUuid);
  const spenderEntries = await Promise.all(["attacker", "defender"].map(async (side) => {
    const participant = side === "attacker" ? combat.attacker : combat.defender;
    return { side, actor: await resolveActor(participant.tokenUuid, participant.actorUuid) };
  }));
  const spender = spenderEntries.find((candidate) => candidate.side === request.luckSide);
  const user = userById(request.userId);
  const ownRoll = spender?.side === request.side;
  if (!actor || !spender?.actor || !user
    || (!user.isGM && !spender.actor.testUserPermission(user, "OWNER"))
    || !["reroll", "invert"].includes(request.mode)
    || (!ownRoll && request.mode !== "reroll")) return false;
  if (request.side === "defender" && !entry.defense?.rawRoll) return false;
  if (!request.luckAlreadySpent) {
    const points = Number(spender.actor.system.resources?.luckPoints?.value ?? 0);
    if (points < 1) { warn(localize("MYTHRASF.Luck.None")); return false; }
    await spender.actor.update({ "system.resources.luckPoints.value": points - 1 });
  }
  const currentRoll = request.side === "attacker" ? entry.rawRoll : entry.defense.rawRoll;
  entry.luckHistory = [...(entry.luckHistory ?? []), currentRoll];
  entry.luckSpendHistory = [...(entry.luckSpendHistory ?? []), { value: currentRoll,
    spenderId: spender.actor.id, spenderUuid: spender.actor.uuid,
    spenderName: actorName(spender.actor), mode: request.mode }];
  if (request.side === "attacker") entry.rawRoll = Number(request.rawRoll);
  else entry.defense.rawRoll = Number(request.rawRoll);
  const ability = request.side === "attacker" ? actor.items.get(entry.styleId)
    : actor.items.get(entry.defense.abilityId ?? entry.defense.styleId);
  const target = request.side === "attacker" ? entry.target : entry.defense.target;
  await recordFumble(ability, classifyContestRoll(request.rawRoll, target));
  if (request.side === "attacker" && combat.surprise && !combat.surprise.consumed) {
    const result = classifyContestRoll(entry.rawRoll, entry.target);
    combat.surprise.eligible = ["success", "critical"].includes(result);
    if (combat.status === "awaitingEffects" && combat.surprise.eligible) {
      const defender = await resolveActor(combat.defender.tokenUuid, combat.defender.actorUuid);
      if (defender) combat.effects.surpriseSlots += await consumeSurprise(defender, combat);
    }
  }
  if (["resolved", "awaitingEffects"].includes(combat.status)) {
    combat.resolution = resolveCombatExchange({ predeclared: combat.predeclared,
      attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll },
      defense: combat.defender.defense });
  } else if (!combat.predeclared) combat.attackClassification = resolveCombatExchange({
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll },
    defense: { type: "none" } }).attack;
  await recordFumbles(combat);
  if (combat.status === "awaitingEffects") {
    const surpriseSlots = Number(combat.effects?.surpriseSlots ?? 0);
    const sideSlots = combatEffectSlotsBySide({ winner: combat.resolution.winner,
      differential: combat.resolution.effects, surprise: surpriseSlots });
    const totalSlots = sideSlots.attacker + sideSlots.defender;
    combat.effects = { winner: combat.resolution.winner, slots: totalSlots, sideSlots,
      surpriseSlots, pendingSide: sideSlots.attacker ? "attacker"
        : sideSlots.defender ? "defender" : null,
      selections: [], confirmed: totalSlots === 0, checks: [] };
    if (!totalSlots) {
      combat.status = "resolved";
      combat.damage = { status: combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
    }
  }
  combat.revision += 1;
  if (combat.status === "resolved" && ["ready", "unavailable"].includes(combat.damage?.status)) {
    combat.damage = { status: combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  }
  await message.update({ content: render(combat),
    rolls: appendRolls(message, request.serializedRoll), [`flags.${flagScope}.combat`]: combat });
  return true;
}
