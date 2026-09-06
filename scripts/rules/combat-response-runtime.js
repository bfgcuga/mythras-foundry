import { combatAttackHits, resolveCombatExchange } from "./combat.js";
import { canonicalCombatEffectStage, combatEffectSlotsBySide,
  combatEffectSelectionsCompatible, combatRuseTargetEffects, initialCombatEffectStatus,
  validateEffectSelections, combatWeaponDamagePlan,
  combatEffectRequiresResistance } from "./combat-effects.js";
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

export async function applyChosenTargetTransition(message, current, { token, entry = null,
  userId, user, owner, clone, actorIdentity, tokenIdentity, tokenName, locationSnapshot, render,
  flagScope = "mythras-foundry" } = {}) {
  const actor = token?.actor;
  if (!actor || current.chosenTarget?.status !== "awaitingTarget"
    || !owner || !user || (!user.isGM && !owner.testUserPermission(user, "OWNER"))
    || current.chosenTarget.originalDefender?.actorUuid === actor.uuid) return false;
  const combat = clone(current);
  combat.chosenTarget = { ...combat.chosenTarget, status: "selected",
    target: { tokenUuid: tokenIdentity(token), actorUuid: actor.uuid,
      actorName: tokenName(token), selectedBy: userId, selectedAt: Date.now() } };
  combat.defender = { actorUuid: actor.uuid, actorId: actorIdentity(actor), actorName: tokenName(token),
    tokenUuid: tokenIdentity(token), defense: null, luckHistory: [], size: actor.system.size,
    targetType: "actor", targetWeaponId: "", locations: actor.items
      .filter((item) => item.type === "hitLocation").map(locationSnapshot) };
  if (combat.turnEconomy && entry) combat.turnEconomy.defenderCombatantId = entry.id;
  combat.effects = { selections: [], checks: [], confirmed: true };
  combat.resolution = { attack: { ...combat.resolution.attack, result: "success",
    automaticSuccess: true }, defense: { type: "none", result: "failure",
    automaticFailure: true, rawRoll: null, target: null }, advantage: 0, effects: 0, winner: null };
  combat.status = "resolved";
  combat.damage = { status: "ready" };
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
  applyImmediateEffects, immediateDependencies, triggerRuses, render, advance,
  actorIdentity, locationSnapshot,
  surrenderAuthorizedBy = "", penetrationAuthorizedBy = "", coverAuthorizedBy = "",
  chosenTargetAuthorizedBy = "" } = {}) {
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
    effects: catalog, context: await effectContext(combat, side) });
  const catalogByKey = new Map(catalog.map((effect) => [effect.key, effect]));
  const ruseTargets = new Set(combatRuseTargetEffects(catalog).map((effect) => effect.key));
  const invalidRuse = request.selections.some((selection) => selection.key === "ardid"
    && (!combat.turnEconomy || !ruseTargets.has(selection.parameters?.effectKey)));
  const invalidGrab = request.selections.some((selection) => !selection.waived
    && selection.key === "agarrar" && selection.parameters?.grabConfirmed !== true);
  const requestsSurrender = request.selections.some((selection) => !selection.waived
    && selection.key === "forzar-rendicion");
  const surrenderAuthorizer = surrenderAuthorizedBy ? userById(surrenderAuthorizedBy) : null;
  const requestsPenetration = request.selections.some((selection) => !selection.waived
    && selection.key === "potenciar-penetracion");
  const penetrationAuthorizer = penetrationAuthorizedBy ? userById(penetrationAuthorizedBy) : null;
  const requestsCoverBypass = request.selections.some((selection) => !selection.waived
    && selection.key === "sortear-cobertura");
  const coverAuthorizer = coverAuthorizedBy ? userById(coverAuthorizedBy) : null;
  const requestsChosenTarget = request.selections.some((selection) => !selection.waived
    && selection.key === "escoger-objetivo");
  const chosenTargetAuthorizer = chosenTargetAuthorizedBy ? userById(chosenTargetAuthorizedBy) : null;
  const combinedEffects = [...(combat.effects.selections ?? []).filter((entry) => !entry.waived),
    ...request.selections.filter((entry) => !entry.waived)
      .map((entry) => catalogByKey.get(entry.key)).filter(Boolean)];
  const combinedCounts = combinedEffects.reduce((counts, effect) => counts.set(effect.key,
    (counts.get(effect.key) ?? 0) + 1), new Map());
  const invalidCombinedStack = combinedEffects.some((effect) => !effect.stackable
    && combinedCounts.get(effect.key) > 1);
  if (!validation.valid || invalidRuse || invalidGrab
    || (requestsSurrender && !surrenderAuthorizer?.isGM)
    || (requestsPenetration && !penetrationAuthorizer?.isGM)
    || (requestsCoverBypass && !coverAuthorizer?.isGM)
    || (requestsChosenTarget && !chosenTargetAuthorizer?.isGM) || invalidCombinedStack
    || !combatEffectSelectionsCompatible(combinedEffects)) {
    warn(localize("MYTHRASF.CombatEffect.Invalid")); return false;
  }
  const sideSelections = request.selections.map((selection, index) => {
    if (selection.waived) return { slot: index, side, waived: true };
    const effect = catalogByKey.get(selection.key);
    return { slot: index, side, waived: false, ...effect,
      stage: canonicalCombatEffectStage(effect.stage),
      parameters: { grabConfirmed: selection.parameters?.grabConfirmed === true,
        armorType: ["natural", "worn"].includes(selection.parameters?.armorType)
          ? selection.parameters.armorType : "",
        locationId: String(selection.parameters?.locationId ?? ""),
        effectKey: String(selection.parameters?.effectKey ?? ""),
        note: String(selection.parameters?.note ?? "") },
      status: initialCombatEffectStatus(effect) };
  });
  const forceFailure = sideSelections.find((selection) => selection.key === "forzar-fallo");
  if (forceFailure) {
    const forced = sideSelections.find((selection) => selection !== forceFailure
      && combatEffectRequiresResistance(selection));
    forced.automaticSuccess = true;
    forced.automaticSource = { type: "forceFailure", sourceSlot: forceFailure.slot };
    forceFailure.status = "resolved";
    forceFailure.resolution = { effectKey: forced.key, effectSlot: forced.slot };
  }
  combat.effects.selections.push(...sideSelections);
  combat.effects.confirmations = { ...(combat.effects.confirmations ?? {}),
    [side]: { userId: user.id, confirmedAt: Date.now() } };
  if (side === "attacker" && combat.turnEconomy) {
    const matches = await triggerRuses?.(combat, sideSelections) ?? [];
    if (matches.length) {
      const blocked = new Set(matches.map((match) => match.selection));
      combat.effects.selections = combat.effects.selections.filter((selection) =>
        !blocked.has(selection));
      combat.effects.replacedSelections = [...(combat.effects.replacedSelections ?? []),
        ...matches.map((match) => ({ ...match.selection, status: "replaced",
          replacedByRuseId: match.ruse.id }))];
      combat.effects.pendingRuses = matches.map((match) => ({ ruseId: match.ruse.id,
        blockedEffectKey: match.selection.key, blockedEffectName: match.selection.name }));
      combat.effects.pendingSide = "defender";
      combat.effects.confirmed = false;
      combat.status = "awaitingRuse";
      combat.damage = { status: "blocked" };
      combat.revision += 1;
      await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
      return true;
    }
  }
  const nextSide = side === "attacker" && Number(combat.effects.sideSlots?.defender ?? 0) > 0
    ? "defender" : null;
  combat.effects.pendingSide = nextSide;
  combat.effects.confirmed = !nextSide;
  if (!nextSide) {
    combat.effects.confirmedBy = user.id;
    combat.effects.confirmedAt = Date.now();
    await applyImmediateEffects(combat, message, immediateDependencies());
    const chosenTargetEffect = combat.effects.selections.find((effect) =>
      !effect.waived && effect.key === "escoger-objetivo");
    if (chosenTargetEffect) {
      chosenTargetEffect.status = "resolved";
      combat.chosenTarget = { status: "awaitingTarget", originalDefender: clone(combat.defender),
        originalEffects: clone(combat.effects) };
      combat.status = "resolved";
      combat.damage = { status: "unavailable" };
      combat.revision += 1;
      await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
      return true;
    }
    const accidentalWoundEffect = combat.effects.selections.find((effect) =>
      !effect.waived && effect.key === "herida-accidental");
    if (accidentalWoundEffect) {
      accidentalWoundEffect.status = "resolved";
      const originalDefender = clone(combat.defender);
      const originalEffects = clone(combat.effects);
      const attacker = await resolveActor(combat.attacker.tokenUuid, combat.attacker.actorUuid);
      if (!attacker) return false;
      combat.accidentalWound = { status: "active", originalDefender, originalEffects,
        ignoresArmor: combat.attacker.modeSnapshot?.key === "unarmed"
          || !combat.attacker.weaponId };
      combat.defender = { actorUuid: attacker.uuid, actorId: actorIdentity(attacker),
        actorName: combat.attacker.actorName, tokenUuid: combat.attacker.tokenUuid,
        defense: null, luckHistory: [], size: attacker.system.size,
        targetType: "actor", targetWeaponId: "", locations: attacker.items
          .filter((item) => item.type === "hitLocation").map(locationSnapshot) };
      if (combat.turnEconomy) {
        combat.turnEconomy.defenderCombatantId = combat.turnEconomy.combatantId;
      }
      combat.effects = { selections: [], checks: [], confirmed: true };
      combat.resolution = { attack: { ...combat.resolution.attack, result: "success",
        automaticSuccess: true }, defense: { type: "none", result: "failure",
        automaticFailure: true, rawRoll: null, target: null }, advantage: 0,
      effects: 0, winner: null };
      combat.status = "resolved";
      combat.damage = { status: "ready" };
      combat.revision += 1;
      await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
      return true;
    }
    combat.status = "resolved";
    const attackHits = combatAttackHits(combat.resolution);
    const damagesWeapon = Boolean(combatWeaponDamagePlan(combat));
    const surrenderReplacesDamage = combat.effects.selections.some((effect) => !effect.waived
      && effect.key === "forzar-rendicion");
    combat.damage = { status: !surrenderReplacesDamage && (attackHits || damagesWeapon)
      ? "ready" : "unavailable" };
    if (!attackHits) combat.effects.selections.forEach((effect) => {
      if (effect.requiresWound) effect.status = "notActivated";
    });
  }
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  await advance(message, combat);
  return true;
}

export async function applyCombatRuseReplacementTransition(message, request, { clone, flagScope,
  resolveActor, userById, catalogDocuments, effectView, effectContext, replacementEffects,
  warn, localize, applyImmediateEffects, immediateDependencies, render, advance } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  const pending = combat?.effects?.pendingRuses ?? [];
  if (!combat || combat.status !== "awaitingRuse" || !pending.length
    || Number(request.revision) !== Number(combat.revision)
    || request.side !== "defender" || request.selections?.length !== pending.length) return false;
  const actor = await resolveActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  const user = userById(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return false;
  const catalog = (await catalogDocuments()).map(effectView);
  const eligible = replacementEffects(catalog, await effectContext(combat, "defender"));
  const eligibleByKey = new Map(eligible.map((effect) => [effect.key, effect]));
  const chosen = request.selections.map((selection) => eligibleByKey.get(selection.key));
  const combined = [...combat.effects.selections.filter((entry) => !entry.waived),
    ...chosen.filter(Boolean)];
  if (chosen.some((effect) => !effect) || !combatEffectSelectionsCompatible(combined)) {
    warn(localize("MYTHRASF.CombatEffect.Invalid")); return false;
  }
  const counts = combined.reduce((map, effect) => map.set(effect.key,
    (map.get(effect.key) ?? 0) + 1), new Map());
  if (combined.some((effect) => !effect.stackable && counts.get(effect.key) > 1)) {
    warn(localize("MYTHRASF.CombatEffect.Invalid")); return false;
  }
  let slot = Math.max(-1, ...combat.effects.selections.map((entry) => Number(entry.slot) || 0)) + 1;
  const replacements = chosen.map((effect, index) => ({ ...effect, slot: slot++, side: "defender",
    waived: false, stage: canonicalCombatEffectStage(effect.stage),
    parameters: { locationId: String(request.selections[index].parameters?.locationId ?? ""),
      note: "", effectKey: "" }, status: initialCombatEffectStatus(effect),
    automaticSuccess: true,
    automaticSource: { type: "ruse", ruseId: pending[index].ruseId,
      blockedEffectKey: pending[index].blockedEffectKey } }));
  combat.effects.selections.push(...replacements);
  combat.effects.pendingRuses = [];
  const normalDefenderSlots = Number(combat.effects.sideSlots?.defender ?? 0);
  const defenderAlreadyConfirmed = Boolean(combat.effects.confirmations?.defender);
  if (normalDefenderSlots > 0 && !defenderAlreadyConfirmed) {
    combat.status = "awaitingEffects";
    combat.effects.pendingSide = "defender";
  } else {
    combat.effects.pendingSide = null;
    combat.effects.confirmed = true;
    combat.effects.confirmedBy = user.id;
    combat.effects.confirmedAt = Date.now();
    await applyImmediateEffects(combat, message, immediateDependencies());
    combat.status = "resolved";
    const attackHits = combatAttackHits(combat.resolution);
    const damagesWeapon = Boolean(combatWeaponDamagePlan(combat));
    combat.damage = { status: attackHits || damagesWeapon ? "ready" : "unavailable" };
    if (!attackHits) combat.effects.selections.forEach((effect) => {
      if (effect.requiresWound) effect.status = "notActivated";
    });
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
