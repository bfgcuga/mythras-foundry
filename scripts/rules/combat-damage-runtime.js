import { findHitLocation, hitLocationDisplayName, permanentWoundHitCheck, permanentWoundState, woundLevel,
  woundLocationKind } from "./hit-locations.js";
import { damageLocationChoices, independentCombatEffectChecks, majorWoundLuckAdjustment,
  prepareDamageChecks } from "./combat-damage.js";
import { parryReduction, resolveDamage } from "./combat.js";
import { bypassArmorProtection } from "./combat-bypass-armor.js";
import { totalArmorPoints } from "./armor.js";
import { combatWeaponDamagePlan, selectedEffectCount } from "./combat-effects.js";
import { applyLongRangeDamage } from "./ranged-combat.js";
import { clearEntanglementsFromWeapon } from "./entanglement.js";
import { weaponCanEquip, weaponDamageResult } from "./weapon-durability.js";

export function combatDamageDocumentIsCurrent({ location, damage, armorPoints }) {
  if (!location || !damage) return false;
  return Number(location.system.currentHitPoints) === Number(damage.beforeHitPoints)
    && Number(armorPoints) === Number(damage.armorSnapshot);
}

export async function applyCombatDamageDocument({ location, damage, targetType = "actor",
  manual = false, evaluateRoll, format }) {
  if (!location?.update || !damage || typeof evaluateRoll !== "function"
    || typeof format !== "function") throw new TypeError("invalid-combat-damage-runtime");
  const appliedDamage = { ...damage };
  const finalHitPoints = targetType === "weapon"
    ? Math.max(0, Number(appliedDamage.afterHitPoints) || 0) : appliedDamage.afterHitPoints;
  appliedDamage.afterHitPoints = finalHitPoints;
  const locationUpdate = { "system.currentHitPoints": finalHitPoints };
  if (targetType === "weapon" && finalHitPoints <= 0) locationUpdate["system.equipped"] = false;
  let serializedPermanentWoundRoll = null;

  if (targetType !== "weapon" && appliedDamage.resultingWound === "major"
    && Number(location.system.permanentWound?.severity ?? 0) < 3) {
    const permanentRoll = await evaluateRoll("1d3", { manual });
    const currentSeverity = Number(location.system.permanentWound?.severity ?? 0);
    const effectiveSeverity = Math.max(permanentRoll.total, currentSeverity + 1);
    const kind = woundLocationKind(location);
    const description = format(
      `MYTHRASF.PermanentWound.Suggested.${kind.extremity ? "extremity" : "other"}`,
      { location: hitLocationDisplayName(location), severity: effectiveSeverity });
    const permanentWound = permanentWoundState(location,
      { severity: effectiveSeverity, roll: permanentRoll.total, description });
    locationUpdate["system.permanentWound"] = permanentWound;
    locationUpdate["system.maxHitPoints"] = permanentWound.effectiveMaxHitPoints;
    locationUpdate["system.currentHitPoints"] = Math.min(appliedDamage.afterHitPoints,
      permanentWound.effectiveMaxHitPoints);
    appliedDamage.afterHitPoints = locationUpdate["system.currentHitPoints"];
    appliedDamage.permanentWound = permanentWound;
    appliedDamage.permanentWoundRoll = permanentRoll.total;
    serializedPermanentWoundRoll = permanentRoll.toJSON?.() ?? null;
  }

  await location.update(locationUpdate);
  return { damage: appliedDamage, serializedPermanentWoundRoll };
}

export async function applyProposedCombatDamage(message, request, { clone, flagScope,
  resolveActor, userById, armorPoints, refreshProposal, render, evaluateRoll, format,
  applyWoundConsequences, applyAutomaticEffectChecks, combatById, consumePassiveBlock,
  applyPostDamageEffects, advance } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || !["proposed", "stale"].includes(combat.damage?.status)
    || Number(request.revision) !== Number(combat.revision)) return false;
  const targetEntry = combat.damage?.weaponTarget?.target ?? combat.defender;
  const defender = await resolveActor(targetEntry.tokenUuid, targetEntry.actorUuid);
  const user = userById(request.userId);
  if (!defender || !user || (!user.isGM && !defender.testUserPermission(user, "OWNER"))) {
    return false;
  }
  if (combat.damage?.targetType !== "weapon"
    && !damageLocationChoices(combat).some((location) => location.id === request.locationId)) {
    return false;
  }
  if (request.locationId !== combat.damage.locationId) {
    delete combat.damage.woundLuck;
    combat.effects.checks = independentCombatEffectChecks(combat);
    for (const effect of combat.effects.selections ?? []) {
      if (effect.requiresWound) effect.status = "conditional";
    }
    await refreshProposal(combat, request.locationId);
    combat.revision += 1;
    await message.update({ content: render(combat),
      [`flags.${flagScope}.combat`]: combat });
    return true;
  }
  if (combat.damage.status === "stale") {
    await refreshProposal(combat, request.locationId);
    combat.revision += 1;
    await message.update({ content: render(combat),
      [`flags.${flagScope}.combat`]: combat });
    return true;
  }
  const selectedLocation = defender.items.get(request.locationId);
  const targetType = combat.damage?.targetType ?? combat.defender.targetType;
  const currentArmor = selectedLocation
    ? armorPoints(selectedLocation, defender, targetType) : null;
  if (!selectedLocation || !combatDamageDocumentIsCurrent({
    location: selectedLocation, damage: combat.damage, armorPoints: currentArmor })) {
    combat.damage.status = "stale";
    combat.revision += 1;
    await message.update({ content: render(combat),
      [`flags.${flagScope}.combat`]: combat });
    return true;
  }
  await refreshProposal(combat, request.locationId);
  const location = defender.items.get(combat.damage.locationId);
  combat.damage.status = "applying";
  combat.revision += 1;
  await message.update({ [`flags.${flagScope}.combat`]: combat });
  let damageApplication;
  try {
    damageApplication = await applyCombatDamageDocument({ location, damage: combat.damage,
      targetType, manual: request.manual, evaluateRoll, format });
  } catch (error) {
    combat.damage.status = "proposed";
    await message.update({ content: render(combat),
      [`flags.${flagScope}.combat`]: combat });
    throw error;
  }
  combat.damage = damageApplication.damage;
  combat.damage.status = "applied";
  if (targetType === "weapon") {
    const otherEntry = [combat.attacker, combat.defender].find((entry) =>
      entry?.actorUuid && entry.actorUuid !== defender.uuid);
    const victim = otherEntry ? await resolveActor(otherEntry.tokenUuid, otherEntry.actorUuid) : null;
    await clearEntanglementsFromWeapon(victim, defender, location.id);
  }
  if (combat.damage.passiveBlock && combat.turnEconomy) {
    await consumePassiveBlock(combatById(combat.turnEconomy.combatId),
      combat.turnEconomy.defenderCombatantId, combat.damage.passiveBlock.weaponId,
      "damage");
  }
  if (targetType !== "weapon") {
    await applyWoundConsequences(combat, defender, location, { manual: request.manual });
    await applyPostDamageEffects?.(combat);
  }
  await applyAutomaticEffectChecks?.(combat);
  combat.damage.appliedBy = user.id;
  combat.damage.appliedAt = Date.now();
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  await advance(message, combat);
  return true;
}

export async function refreshCombatDamageProposal(combat, requestedLocationId = null,
  { resolveActor, combatById, passiveBlockFor, coverFor } = {}) {
  const targetEntry = combat.damage?.weaponTarget?.target ?? combat.defender;
  const defender = await resolveActor(targetEntry.tokenUuid, targetEntry.actorUuid);
  const locationId = requestedLocationId ?? combat.damage.locationId;
  const location = defender?.items.get(locationId);
  const weaponTarget = combat.damage?.targetType === "weapon"
    || combat.defender.targetType === "weapon";
  if (!defender || !location || (!weaponTarget && location.type !== "hitLocation")
    || (weaponTarget && location.type !== "weapon")) {
    combat.damage.status = "stale";
    return false;
  }
  const armor = weaponTarget ? Number(location.system.armorPoints ?? 0) : totalArmorPoints(location,
    defender.items.filter((item) => item.type === "armor"));
  const defense = combat.defender.defense;
  const activeParry = defense?.type === "parry"
    && ["success", "critical"].includes(combat.resolution.defense.result);
  let parry = weaponTarget ? { type: "none" } : activeParry
    ? parryReduction(combat.attacker.weaponSize, defense.weaponSize) : { type: "none" };
  const improveParry = selectedEffectCount(combat.effects?.selections ?? [], "improveParry");
  const bypassParry = selectedEffectCount(combat.effects?.selections ?? [], "bypassParry");
  if (improveParry) parry = { type: "full" };
  if (bypassParry) parry = { type: "none" };
  const tracker = combat.turnEconomy ? combatById(combat.turnEconomy.combatId) : null;
  const passive = !weaponTarget && tracker ? passiveBlockFor(tracker,
    combat.turnEconomy.defenderCombatantId, location.id) : null;
  let passiveParry = { type: "none" };
  if (!bypassParry && parry.type !== "full" && Number(combat.damage.rawRoll) > 0 && passive) {
    passiveParry = parryReduction(combat.attacker.weaponSize, passive.weaponSize);
    combat.damage.passiveBlock = { weaponId: passive.weaponId, weaponName: passive.weaponName,
      weaponSize: passive.weaponSize, locationId: location.id };
  } else delete combat.damage.passiveBlock;
  const protection = weaponTarget ? null : bypassArmorProtection(location,
    defender.items.filter((item) => item.type === "armor"), combat.effects?.selections ?? []);
  const effectiveArmor = protection?.effective ?? armor;
  combat.damage.ignoredArmorTypes = protection?.ignored ?? [];
  const rangeAdjustedDamage = weaponTarget && combat.damage?.weaponTarget?.sourceSide === "defender"
    ? Number(combat.damage.rawRoll) : applyLongRangeDamage(combat.damage.rawRoll, combat.ranged?.band);
  const cover = !weaponTarget && defense?.type === "cover" && tracker ? coverFor(tracker,
    combat.turnEconomy.defenderCombatantId, location.id) : null;
  const coverProtection = Math.max(0, Number(cover?.protection ?? 0));
  const calculation = resolveDamage({ rolledDamage: rangeAdjustedDamage,
    containedBlow: weaponTarget && combat.damage?.weaponTarget?.sourceSide === "defender"
      ? false : combat.declarations?.containedBlow,
    parry, passiveBlock: passiveParry,
    coverPoints: coverProtection,
    armorPoints: effectiveArmor, targetSize: defender.system.size });
  calculation.activeParry = activeParry && !bypassParry;
  calculation.beforeRange = Number(combat.damage.rawRoll);
  calculation.afterRange = rangeAdjustedDamage;
  calculation.cover = cover ? { source: cover.source, protection: coverProtection,
    absorbed: Math.min(coverProtection, calculation.afterPassiveBlock) } : null;
  const before = Number(location.system.currentHitPoints ?? 0);
  let after = weaponTarget
    ? weaponDamageResult({ currentHitPoints: before, armorPoints: effectiveArmor,
      damage: rangeAdjustedDamage }).afterHitPoints
    : before - calculation.penetratingDamage;
  if (!selectedEffectCount(combat.effects?.selections ?? [], "bash")) {
    calculation.push = { triggered: false, excess: 0, distance: 0 };
  }
  let resulting = combat.damage?.targetType === "weapon"
    ? (after <= 0 ? "broken" : after < before ? "damaged" : "unharmed")
    : weaponTarget ? "healthy"
    : woundLevel(after, location.system.maxHitPoints);
  if (!weaponTarget && combat.damage.woundLuck?.locationId === location.id
    && resulting === "major") {
    const adjustment = majorWoundLuckAdjustment({ beforeHitPoints: before,
      maxHitPoints: location.system.maxHitPoints,
      penetratingDamage: calculation.penetratingDamage });
    if (adjustment) {
      calculation.penetratingDamage = adjustment.penetratingDamage;
      after = adjustment.afterHitPoints;
      resulting = adjustment.resultingWound;
    }
  }
  prepareDamageChecks(combat, { location, resultingWound: resulting,
    penetratingDamage: calculation.penetratingDamage, weaponTarget });
  Object.assign(combat.damage, calculation, { status: "proposed", locationId: location.id,
    locationName: hitLocationDisplayName(location), armorSnapshot: armor, beforeHitPoints: before,
    maxHitPoints: Number(location.system.maxHitPoints ?? 1), afterHitPoints: after,
    previousWound: weaponTarget ? "healthy" : woundLevel(before, location.system.maxHitPoints),
    resultingWound: resulting });
  return true;
}

export async function applyRolledCombatDamage(message, request, { clone, flagScope,
  resolveActor, userById, permanentWoundRule = "checkD3", refreshProposal, render,
  appendRolls, advance } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || combat.damage?.status !== "ready"
    || Number(request.revision) !== Number(combat.revision)) return false;
  const weaponPlan = combatWeaponDamagePlan(combat);
  const sourceEntry = weaponPlan?.sourceEntry ?? combat.attacker;
  const actor = await resolveActor(sourceEntry.tokenUuid, sourceEntry.actorUuid);
  const user = userById(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return false;
  if (weaponPlan && !weaponCanEquip(actor.items.get(weaponPlan.sourceWeaponId))) return false;
  const checkEveryMutilatedHit = permanentWoundRule !== "reduceD20Range";
  let selectedLocation = request.locationId ? (combat.defender.locations ?? []).find((entry) =>
    entry.id === request.locationId) : findHitLocation((combat.defender.locations ?? []).map((entry) => ({
    id: entry.id, name: entry.name, system: { rangeStart: entry.rangeStart,
      rangeEnd: entry.rangeEnd, category: entry.category, hpClass: entry.hpClass,
      permanentWound: entry.permanentWound }
  })), request.locationRoll, { ignorePermanentWounds: checkEveryMutilatedHit });
  if (weaponPlan) {
    const targetActor = await resolveActor(weaponPlan.targetEntry.tokenUuid,
      weaponPlan.targetEntry.actorUuid);
    const targetWeapon = targetActor?.items.get(weaponPlan.targetWeaponId);
    if (!targetWeapon || targetWeapon.type !== "weapon" || !weaponCanEquip(targetWeapon)
      || Number(targetWeapon.system.maxHitPoints ?? 0) <= 0) return false;
    selectedLocation = { id: targetWeapon.id, name: targetWeapon.name,
      armorPoints: Number(targetWeapon.system.armorPoints ?? 0),
      currentHitPoints: Number(targetWeapon.system.currentHitPoints ?? 0),
      maxHitPoints: Number(targetWeapon.system.maxHitPoints ?? 0) };
  }
  const selectedLocationSystem = selectedLocation?.system ?? selectedLocation ?? {};
  const selectedLocationModel = selectedLocation ? { ...selectedLocation,
    system: selectedLocationSystem } : null;
  const chosenByEffect = selectedEffectCount(combat.effects?.selections ?? [], "chooseLocation") > 0;
  const requiresPermanentWoundRoll = !weaponPlan && combat.defender.targetType !== "weapon"
    && woundLocationKind(selectedLocationModel).extremity
    && Number(selectedLocationSystem.permanentWound?.severity ?? 0) > 0
    && (checkEveryMutilatedHit || chosenByEffect);
  if (requiresPermanentWoundRoll && request.permanentWoundHitRoll == null) return false;
  const permanentWoundHit = !requiresPermanentWoundRoll
    || permanentWoundHitCheck(selectedLocationModel, request.permanentWoundHitRoll);
  const location = permanentWoundHit ? selectedLocation : null;
  combat.damage = { status: "rolled", formula: request.formula,
    weaponFormula: request.weaponFormula, weaponFormulaParts: request.weaponFormulaParts,
    maximizedWeaponDice: Number(request.maximizedWeaponDice) || 0,
    modifierFormula: request.modifierFormula,
    extraordinaryFormula: request.extraordinaryFormula, resultExpression: request.resultExpression,
    rollExpression: request.rollExpression, rawRoll: Number(request.rawRoll),
    serializedRoll: request.serializedRoll, alternateRoll: request.alternateRoll,
    luckHistory: [], locationRoll: request.locationRoll == null ? null : Number(request.locationRoll),
    rolledLocationId: request.rolledLocationId ?? "", locationId: location?.id ?? "",
    permanentWoundHitRoll: !requiresPermanentWoundRoll
      ? null : Number(request.permanentWoundHitRoll),
    permanentWoundLocationName: !requiresPermanentWoundRoll
      ? "" : hitLocationDisplayName(selectedLocation),
    permanentWoundSeverity: !requiresPermanentWoundRoll
      ? 0 : Number(selectedLocationSystem.permanentWound?.severity ?? 0),
    permanentWoundHit,
    ...(weaponPlan ? { targetType: "weapon", weaponTarget: {
      sourceSide: weaponPlan.sourceSide,
      source: { actorUuid: weaponPlan.sourceEntry.actorUuid,
        tokenUuid: weaponPlan.sourceEntry.tokenUuid, weaponId: weaponPlan.sourceWeaponId,
        weaponName: weaponPlan.sourceSide === "attacker" ? combat.attacker.weaponName
          : combat.defender.defense.weaponName },
      target: { actorUuid: weaponPlan.targetEntry.actorUuid,
        tokenUuid: weaponPlan.targetEntry.tokenUuid, weaponId: weaponPlan.targetWeaponId,
        weaponName: selectedLocation.name } } } : {}) };
  const rolls = appendRolls(message, request.serializedRoll,
    request.alternateRoll?.serializedRoll, request.serializedLocationRoll,
    request.serializedPermanentWoundHitRoll);
  if (!location && !weaponPlan && combat.defender.targetType !== "weapon") {
    combat.damage.status = "missedLocation";
    combat.revision += 1;
    await message.update({ content: render(combat), rolls, [`flags.${flagScope}.combat`]: combat });
    await advance(message, combat);
    return true;
  }
  combat.revision += 1;
  await refreshProposal(combat);
  await message.update({ content: render(combat), rolls, [`flags.${flagScope}.combat`]: combat });
  return true;
}

export async function applyCombatDamageLuck(message, request, { clone, flagScope,
  resolveActor, userById, refreshProposal, render, appendRolls } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || !["proposed", "stale"].includes(combat.damage?.status)
    || Number(request.revision) !== Number(combat.revision)) return false;
  const source = combat.damage?.weaponTarget?.source ?? combat.attacker;
  const actor = await resolveActor(source.tokenUuid, source.actorUuid);
  const user = userById(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return false;
  combat.damage.luckHistory = [...(combat.damage.luckHistory ?? []), combat.damage.rawRoll];
  Object.assign(combat.damage, { rawRoll: Number(request.rawRoll),
    resultExpression: request.resultExpression, rollExpression: request.rollExpression,
    serializedRoll: request.serializedRoll });
  delete combat.damage.woundLuck;
  combat.effects.checks = independentCombatEffectChecks(combat);
  for (const effect of combat.effects.selections ?? []) {
    if (effect.requiresWound) effect.status = "conditional";
  }
  await refreshProposal(combat);
  combat.revision += 1;
  await message.update({ content: render(combat),
    rolls: appendRolls(message, request.serializedRoll), [`flags.${flagScope}.combat`]: combat });
  return true;
}

export async function applyMajorWoundLuck(message, request, { clone, flagScope,
  resolveActor, userById, warn, localize, render } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)
    || combat.damage?.status !== "proposed") return false;
  const check = (combat.effects?.checks ?? []).find((entry) => entry.id === request.checkId);
  const firstPending = (combat.effects?.checks ?? []).find((entry) => entry.status === "pending");
  if (!check || check.id !== firstPending?.id || check.status !== "pending"
    || check.source !== "wound" || check.woundSeverity !== "major"
    || (combat.effects?.selections ?? []).some((effect) => effect.status === "pending")) return false;
  const defender = await resolveActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  const user = userById(request.userId);
  const location = defender?.items.get(check.locationId);
  if (!defender || !location || !user
    || (!user.isGM && !defender.testUserPermission(user, "OWNER"))) return false;
  const points = Number(defender.system.resources?.luckPoints?.value ?? 0);
  if (points < 1) { warn(localize("MYTHRASF.Luck.None")); return false; }
  const adjustment = majorWoundLuckAdjustment({ beforeHitPoints: combat.damage.beforeHitPoints,
    maxHitPoints: combat.damage.maxHitPoints,
    penetratingDamage: combat.damage.penetratingDamage });
  if (!adjustment
    || Number(location.system.currentHitPoints) !== Number(combat.damage.beforeHitPoints)) return false;
  await defender.update({ "system.resources.luckPoints.value": points - 1 });
  Object.assign(combat.damage, adjustment, { woundLuck: { userId: user.id,
    spentAt: Date.now(), locationId: location.id } });
  prepareDamageChecks(combat, { location, resultingWound: "serious",
    penetratingDamage: adjustment.penetratingDamage });
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  return true;
}
