import { combatAttackHits, damageModifierFormula, difficultyTarget,
  resolveCombatExchange, resolveWeaponStyle } from "./combat.js";
import { findWeaponMode, weaponModeDisplayName, weaponModes, weaponModeView } from "./weapon-modes.js";
import { resolveActorConditions, actorLoadState } from "./actor-conditions.js";
import { invertD100 } from "./skill-roll.js";
import { findHitLocation, hitLocationDisplayName, woundLocationKind } from "./hit-locations.js";
import { totalArmorPoints } from "./armor.js";
import { activateDelayedTooltips } from "../ui/tooltips.js";
import { classifyContestRoll } from "./contest-rolls.js";
import { canonicalCombatEffectStage, combatEffectCheckPhase, combatEffectRule,
  combatEffectSelectionHighlight, combatRuseTargetEffects, eligibleCombatEffects,
  eligibleCombatRuseReplacements, initialCombatEffectStatus,
  maximizeDamageFormulaDetails, mergeCombatEffectDocuments, opposedEffectWinner,
  selectedEffectCount, combatEffectSelectionsCompatible,
  combatWeaponDamagePlan } from "./combat-effects.js";
import { weaponCanEquip, weaponHasDurability } from "./weapon-durability.js";
import { currentActionPoints, effectiveActionPointMaximum } from "./action-points.js";
import { getActionPointRules, getSystemSetting, PERMANENT_WOUND_HIT_LOCATION_RULES,
  SETTING_KEYS } from "../settings.js";
import { normalizeCatalogConfig } from "./catalog.js";
import { applyTimedCondition, timedAttackRestriction,
  timedEffects } from "./timed-condition-runtime.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { consumeMatchingCombatRuses, consumePassiveBlock, coverFor, ensureEngagement,
  passiveBlockFor, registerCombatRuse, relationFor, tacticalState,
  validateReachAttack } from "./engagement-runtime.js";
import { engagementRestriction } from "./engagements.js";
import { ammunitionState, canFireAmmunition,
  isAccidentalMeleeHit, parseRangeProfile, rangedAttackProfile, reducePowerCategory
} from "./ranged-combat.js";
import { clearAim, readyAim } from "./ranged-actions.js";
import { appendSerializedRolls, evaluateAnimatedRoll } from "./dice-animation.js";
import { recordAbilityFumble } from "./skills.js";
import { actorDisplayName, actorSpeaker, tokenDisplayName } from "./document-names.js";
import { evaluatedDamageExpression } from "./combat-damage-display.js";
import { evaluateSystemRoll } from "./system-roll.js";
import { combatRollLuckAllowed } from "./combat-luck-availability.js";
import { openAttackRollDialog } from "../apps/skill-roll-dialog.js";
import { applyDying } from "./dying.js";
import { applyDeath } from "./death.js";
import { openCombatCheckHelp, renderCombatExchange,
  woundCheckOutcomeKey } from "./combat-chat-renderer.js";
import { exchangeTerminal, preferredCombatCoordinator, validateCombatResponse
} from "./combat-exchange-state.js";
import { registerCombatSocketRuntime } from "./combat-chat-runtime.js";
import { combatCanBeCancelled } from "./combat-cancellation.js";
import { applyCombatDamageLuck, applyMajorWoundLuck, applyProposedCombatDamage,
  applyRolledCombatDamage, refreshCombatDamageProposal } from "./combat-damage-runtime.js";
import { addManagedCombatStatus, applyAutomaticCombatEffectChecks, applyCombatEffectCheckConsequence,
  applyImmediateCombatEffects, combatSideEntry } from "./combat-effect-runtime.js";
import { advanceCombatExchange, applyCombatExchangeCancellation, applyDroppedCombatItem,
  closeTerminalCombatExchange, resolveCombatExchangeConsequence, resolveCombatExchangePending
} from "./combat-exchange-runtime.js";
import { applyAccidentalTargetTransition, applyCombatDefenseTransition, applyCombatEffectsTransition,
  applyCombatLuckTransition, applyCombatRuseReplacementTransition
} from "./combat-response-runtime.js";
import { applyCombatCheckTransition } from "./combat-check-runtime.js";
import { consumeSurpriseEffectBonus, consumeWeaponModeAmmunition, spendActorActionPoint,
  spendActorLuckPoint } from "./combat-resource-runtime.js";
import { applyCombatWoundConsequences, heldCombatItemChoices
} from "./combat-wound-runtime.js";

export { renderCombatExchange, woundCheckOutcomeKey } from "./combat-chat-renderer.js";
export { preferredCombatCoordinator, validateCombatResponse } from "./combat-exchange-state.js";

const FLAG_SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const SCHEMA_VERSION = 9;
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);
const actorIdentity = (actor) => actor?.parent?.actorId ?? actor?.token?.actorId ?? actor?.id ?? null;
const tokenUuid = (token) => token?.document?.uuid ?? token?.uuid ?? "";
const pendingAttackActors = new Set();

function combatEffectRuntimeDependencies() {
  return { resolveActor: combatActor, combatById: (id) => game.combats.get(id), localize,
    evaluateRoll: evaluateAnimatedRoll, registerRuse: registerCombatRuse };
}

function locationSnapshot(item) {
  return { id: item.id, name: item.name, nameKey: item.system.nameKey ?? "",
    rangeStart: item.system.rangeStart,
    rangeEnd: item.system.rangeEnd, category: item.system.category, hpClass: item.system.hpClass,
    permanentWound: foundry.utils.deepClone(item.system.permanentWound ?? {}) };
}

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
  return spendActorActionPoint(actor);
}

async function advanceCombatTurnForExchange(message, combat, { force = false } = {}) {
  return advanceCombatExchange(message, combat, { force,
    combatById: (id) => game.combats.get(id), render: renderCombatExchange,
    flagScope: FLAG_SCOPE });
}

async function combatEffectDocuments() {
  const configured = normalizeCatalogConfig(getSystemSetting(SETTING_KEYS.catalogSources));
  const packIds = [`${FLAG_SCOPE}.combat-effects`, ...configured.packIds];
  const groups = await Promise.all(packIds.map(async (packId) => {
    const pack = game.packs.get(packId);
    return pack ? pack.getDocuments() : [];
  }));
  return mergeCombatEffectDocuments(groups);
}

const effectView = (item) => {
  const defaults = combatEffectRule({ key: item.system.key });
  return {
    uuid: item.uuid, key: item.system.key, name: item.name,
    offensive: item.system.offensive, defensive: item.system.defensive,
    weaponRestriction: item.system.weaponRestriction, rollRestriction: item.system.rollRestriction,
    stackable: item.system.stackable, description: item.system.description,
    ...defaults,
    ruleKey: item.system.ruleKey,
    stage: canonicalCombatEffectStage(item.system.stage),
    requiresWound: Boolean(item.system.requiresWound),
    endurance: Boolean(item.system.endurance)
  };
};

function effectContext(combat, side = combat.effects?.pendingSide ?? combat.resolution?.winner) {
  return { winner: side,
    activeCombat: Boolean(combat.turnEconomy),
    attackResult: combat.resolution?.attack?.result,
    defenseResult: combat.resolution?.defense?.result,
    attackMode: combat.ranged ? "ranged" : "melee",
    weaponMode: combat.attacker.modeSnapshot,
    unarmed: combat.attacker.modeSnapshot?.key === "unarmed",
    surpriseAttack: Boolean(combat.surprise?.consumed), rangedBand: combat.ranged?.band,
    rangedTargetStationary: Boolean(combat.ranged?.targetStationary),
    rangedTargetUnaware: Boolean(combat.ranged?.targetUnaware),
    completeCover: Boolean(combat.ranged?.completeCover),
    defenseType: combat.defender.defense?.type,
    attackerWeaponDurable: Boolean(combat.attacker.weaponDurable),
    parryWeaponDurable: Boolean(combat.defender.defense?.weaponDurable) };
}

async function combatActor(uuid, actorUuid) {
  const token = uuid ? await fromUuid(uuid) : null;
  return token?.actor ?? (actorUuid ? await fromUuid(actorUuid) : null);
}

async function recordCombatResolutionFumbles(combat) {
  if (!combat?.resolution) return;
  const attacker = await combatActor(combat.attacker.tokenUuid, combat.attacker.actorUuid);
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  await recordAbilityFumble(attacker?.items.get(combat.attacker.styleId),
    combat.resolution.attack?.result);
  await recordAbilityFumble(defender?.items.get(combat.defender.defense?.abilityId
    ?? combat.defender.defense?.styleId), combat.resolution.defense?.result);
}

function visibleTargets(actor) {
  return Array.from(canvas?.tokens?.placeables ?? []).filter((token) => token.actor
    && token.visible !== false && token.actor !== actor && token.actor?.uuid !== actor.uuid);
}

function modeRangeProfile(mode) {
  const structured = { short: Number(mode?.rangeShort), effective: Number(mode?.rangeEffective),
    long: Number(mode?.rangeLong) };
  return structured.long > 0 ? parseRangeProfile(structured) : parseRangeProfile(mode?.range);
}

function rangedSetupFields(mode) {
  if (!["ranged", "siege"].includes(mode?.weaponType)) return "";
  return `<fieldset><legend>${escape(localize("MYTHRASF.Ranged.Attack"))}</legend>
    <label><span>${escape(localize("MYTHRASF.Ranged.Distance"))}</span><input type="number" min="0" step="1" name="distance" required></label>
    <label><span>${escape(localize("MYTHRASF.Ranged.Wind"))}</span><select name="wind"><option value="0">—</option><option value="1">${escape(localize("MYTHRASF.Ranged.LightGale"))}</option><option value="2">${escape(localize("MYTHRASF.Ranged.ModerateGale"))}</option><option value="3">${escape(localize("MYTHRASF.Ranged.StrongGale"))}</option><option value="4">${escape(localize("MYTHRASF.Ranged.Storm"))}</option></select></label>
    <label><span>${escape(localize("MYTHRASF.Ranged.Concealment"))}</span><select name="concealment"><option value="0">—</option><option value="1">${escape(localize("MYTHRASF.Ranged.Partial"))}</option><option value="2">${escape(localize("MYTHRASF.Ranged.Mostly"))}</option><option value="3">${escape(localize("MYTHRASF.Ranged.Complete"))}</option></select></label>
    <label><span>${escape(localize("MYTHRASF.Ranged.TargetMovement"))}</span><select name="targetMovement"><option value="0">—</option><option value="1">${escape(localize("MYTHRASF.Ranged.Run"))}</option><option value="2">${escape(localize("MYTHRASF.Ranged.Sprint"))}</option></select></label>
    <label><span>${escape(localize("MYTHRASF.Ranged.MeleePosition"))}</span><select name="meleePosition"><option value="none">—</option><option value="edge">${escape(localize("MYTHRASF.Ranged.Edge"))}</option><option value="inside">${escape(localize("MYTHRASF.Ranged.Inside"))}</option></select></label>
    <label><span>${escape(localize("MYTHRASF.Ranged.AttackerMovement"))}</span><select name="attackerMovement"><option value="stationary">${escape(localize("MYTHRASF.Ranged.Stationary"))}</option><option value="walk">${escape(localize("MYTHRASF.Ranged.Walk"))}</option><option value="run">${escape(localize("MYTHRASF.Ranged.Run"))}</option><option value="sprint">${escape(localize("MYTHRASF.Ranged.Sprint"))}</option></select></label>
    <label class="checkbox"><input type="checkbox" class="sheet-state-box" name="unstable">${escape(localize("MYTHRASF.Ranged.Unstable"))}</label>
    <label class="checkbox"><input type="checkbox" class="sheet-state-box" name="attackerProne">${escape(localize("MYTHRASF.Ranged.AttackerProne"))}</label>
    <label class="checkbox"><input type="checkbox" class="sheet-state-box" name="targetProne">${escape(localize("MYTHRASF.Ranged.TargetProne"))}</label>
    <label class="checkbox"><input type="checkbox" class="sheet-state-box" name="targetStationary">${escape(localize("MYTHRASF.Ranged.TargetStationary"))}</label>
    <label class="checkbox"><input type="checkbox" class="sheet-state-box" name="targetUnaware">${escape(localize("MYTHRASF.Ranged.TargetUnaware"))}</label>
  </fieldset>`;
}

function attackSetupFields(actor, suggestedTarget = null, mode = null) {
  const targets = visibleTargets(actor);
  if (!targets.length) return "";
  const suggestedUuid = tokenUuid(suggestedTarget);
  const options = targets.map((token) => `<option value="${escape(tokenUuid(token))}" ${tokenUuid(token) === suggestedUuid ? "selected" : ""}>${escape(tokenDisplayName(token))}</option>`).join("");
  return `<fieldset class="combat-attack-setup"><legend>${escape(localize("MYTHRASF.Combat.AttackSetup"))}</legend><label><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><select name="targetTokenUuid">${options}</select></label><label><span>${escape(localize("MYTHRASF.Combat.DefenseDeclaredBefore"))}</span><input type="checkbox" class="sheet-state-box" name="predeclared"></label><label><span>${escape(localize("MYTHRASF.Combat.ContainedBlow"))}</span><input type="checkbox" class="sheet-state-box" name="containedBlow"></label><label><span>${escape(localize("MYTHRASF.Combat.ExtraordinaryDamage"))}</span><input type="text" name="extraordinaryDamage" placeholder="0"></label></fieldset>${rangedSetupFields(mode)}`;
}

function collectAttackSetup(form) {
  return { targetTokenUuid: form.targetTokenUuid.value,
    predeclared: form.predeclared.checked,
    containedBlow: form.containedBlow.checked,
    extraordinaryDamage: form.extraordinaryDamage.value.trim() || "0",
    ranged: form.distance ? {
      distance: Number(form.distance.value), wind: Number(form.wind.value),
      concealment: Number(form.concealment.value),
      targetMovement: Number(form.targetMovement.value),
      meleePosition: form.meleePosition.value, attackerMovement: form.attackerMovement.value,
      unstable: form.unstable.checked, attackerProne: form.attackerProne.checked,
      targetProne: form.targetProne.checked, targetStationary: form.targetStationary.checked,
      targetUnaware: form.targetUnaware.checked
    } : null };
}

export async function createAttackMessage({ actor, weapon, mode, resolution, target = null,
  manual = false }) {
  if (!weaponCanEquip(weapon)) return ui.notifications.warn(
    localize("MYTHRASF.Weapon.BrokenCannotEquip"));
  if (pendingAttackActors.has(actor.uuid)) return null;
  pendingAttackActors.add(actor.uuid);
  try {
  const setupFields = attackSetupFields(actor, target, mode);
  if (!setupFields) return ui.notifications.warn(localize("MYTHRASF.Combat.NoAvailableTargets"));
  const rollAbility = { id: resolution.style?.id ?? "__combat_base__", actor,
    name: resolution.style?.name ?? (resolution.untrained
      ? localize("MYTHRASF.Combat.Untrained") : localize("MYTHRASF.Combat.BaseStyle")),
    system: { total: Number(resolution.target) || 0 } };
  const initialModifiers = resolution.difficulty !== "standard" ? [{
    source: localize("MYTHRASF.SkillRoll.ActorConditions"),
    effect: localize(`MYTHRASF.Difficulty.${resolution.difficulty}`), type: "penalty"
  }] : [];
  if (resolution.familiarity && !["included", "similar", "untrained"].includes(
    resolution.familiarity)) initialModifiers.push({
    source: localize("MYTHRASF.Combat.Familiarity"),
    effect: localize(`MYTHRASF.Familiarity.${resolution.familiarity}`), type: "penalty"
  });
  const configured = await openAttackRollDialog(rollAbility, {
    imposedDifficulty: resolution.difficulty, modifiers: initialModifiers,
    additionalContent: setupFields, collectAdditional: collectAttackSetup,
    title: game.i18n.format("MYTHRASF.Combat.AttackWith", { weapon: weapon.name })
  });
  if (!configured) return null;
  const setup = configured.additional;
  resolution.target = configured.targets.adjustedTarget;
  resolution.difficulty = configured.targets.difficulty;
  const targetToken = await fromUuid(setup.targetTokenUuid);
  const defender = targetToken?.actor;
  if (!defender) return ui.notifications.warn(localize("MYTHRASF.Combat.TargetUnavailable"));
  let ranged = null;
  if (["ranged", "siege"].includes(mode.weaponType)) {
    const ranges = modeRangeProfile(mode);
    if (!ranges) return ui.notifications.warn(localize("MYTHRASF.Ranged.InvalidRange"));
    if (!canFireAmmunition(mode)) return ui.notifications.warn(localize("MYTHRASF.Ranged.NotLoaded"));
    const skirmisher = (resolution.style?.system?.traitRefs ?? []).some((trait) =>
      trait.key === "hostigador");
    if (setup.ranged?.attackerMovement === "sprint"
      || (setup.ranged?.attackerMovement === "run" && !skirmisher)) {
      return ui.notifications.warn(localize("MYTHRASF.Ranged.CannotFireMoving"));
    }
    if (setup.ranged?.attackerMovement === "run" && skirmisher) {
      const athletics = actor.items.find((item) => item.type === "skill"
        && item.system.slug === "atletismo");
      if (!athletics) return ui.notifications.warn(localize("MYTHRASF.Ranged.AthleticsMissing"));
      resolution.target = Math.min(Number(resolution.target), Number(athletics.system.total ?? 0));
    }
    const situational = [
      { source: "wind", steps: setup.ranged.wind },
      { source: "concealment", steps: setup.ranged.concealment },
      { source: "targetMovement", steps: setup.ranged.targetMovement },
      { source: "melee", steps: setup.ranged.meleePosition === "edge" ? 1
        : setup.ranged.meleePosition === "inside" ? 2 : 0 },
      { source: "unstable", steps: setup.ranged.unstable ? 1 : 0 },
      { source: "attackerProne", steps: setup.ranged.attackerProne ? 3 : 0 },
      { source: "targetProne", steps: setup.ranged.targetProne ? 2 : 0 }
    ].filter((entry) => entry.steps);
    const activeTracker = activeCombatForActor(actor)?.combat;
    const defenderEntry = activeTracker?.combatants.find((entry) => entry.token?.uuid === setup.targetTokenUuid
      || entry.actor?.uuid === defender.uuid);
    const declaredCover = defenderEntry ? activeTracker.getFlag(FLAG_SCOPE, "tacticalState")
      ?.covers?.[defenderEntry.id] : null;
    if (declaredCover?.status === "active" && declaredCover.complete) {
      situational.push({ source: "completeCover", steps: 1 });
    }
    const aiming = readyAim(actor, { weaponId: weapon.id, modeKey: mode.key,
      targetTokenUuid: setup.targetTokenUuid, combat: activeCombatForActor(actor)?.combat });
    ranged = rangedAttackProfile({ distance: setup.ranged.distance, ranges,
      targetSize: defender.system.size, baseDifficulty: resolution.difficulty,
      modifiers: situational, aim: Boolean(aiming) });
    if (!ranged.valid) return ui.notifications.warn(localize(
      ranged.band === "beyond" ? "MYTHRASF.Ranged.BeyondRange" : "MYTHRASF.Ranged.InvalidRange"));
    Object.assign(ranged, setup.ranged, { modifiers: situational, aim: Boolean(aiming),
      completeCover: Boolean(declaredCover?.complete),
      normalTarget: Number(resolution.target), power: mode.size,
      effectivePower: ranged.band === "long" ? reducePowerCategory(mode.size) : mode.size });
    resolution.difficulty = ranged.difficulty;
  }
  const contextualRestriction = timedAttackRestriction(actor, { weaponType: mode.weaponType,
    targetActorUuid: defender.uuid });
  if (contextualRestriction) return ui.notifications.warn(localize(
    `MYTHRASF.Status.AttackRestricted.${contextualRestriction}`));
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
  let reachRule = { allowed: true };
  if (turnEconomy) reachRule = await validateReachAttack(game.combats.get(turnEconomy.combatId),
    actor, defender, weapon, mode);
  if (!reachRule.allowed) {
    const relation = turnEconomy ? await ensureEngagement(game.combats.get(turnEconomy.combatId),
      actor, defender, weapon, mode) : null;
    const ownId = turnEconomy?.combatantId;
    const targetSide = Object.entries(relation?.sides ?? {}).find(([id]) => id !== ownId)?.[1];
    const attackWeapon = targetSide?.weaponId && await foundry.applications.api.DialogV2.confirm({
      window: { title: localize("MYTHRASF.Reach.AttackWeapon") },
      content: `<div class="mythras-foundry mythras-dialog"><p>${escape(localize("MYTHRASF.Reach.TooShort"))}</p><p>${escape(targetSide.weaponName)}</p></div>` });
    if (!attackWeapon) return ui.notifications.warn(localize("MYTHRASF.Reach.TooShort"));
    setup.targetWeaponId = targetSide.weaponId;
  }
  if (resolution.difficulty === "automatic") {
    ui.notifications.info(localize("MYTHRASF.RollResult.automatic")); return null;
  }
  if (resolution.difficulty === "impossible") {
    ui.notifications.warn(localize("MYTHRASF.RollResult.impossible")); return null;
  }
  resolution.rollConfiguration = {
    baseTarget: configured.targets.baseTarget,
    adjustedTarget: configured.targets.adjustedTarget,
    limited: configured.limitedSkill ? { actorName: actorDisplayName(configured.limitedSkill.actor),
      abilityId: configured.limitedSkill.id, abilityName: configured.limitedSkill.name,
      target: Number(configured.limitedSkill.system.total ?? 0) } : null,
    reinforced: configured.reinforcedSkill ? { actorName: actorDisplayName(configured.reinforcedSkill.actor),
      abilityId: configured.reinforcedSkill.id, abilityName: configured.reinforcedSkill.name,
      target: Number(configured.reinforcedSkill.system.total ?? 0) } : null
  };
  if (turnEconomy && !await spendActionPoint(actor)) {
    return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.actionPoints"));
  }
  await clearAim(actor);
  let ammunition = null;
  if (ranged && mode.ammoTracking) {
    ammunition = await consumeWeaponModeAmmunition(weapon, mode);
  }
  if (turnEconomy) {
    turnEconomy.attackSpent = true;
    await consumePassiveBlock(game.combats.get(turnEconomy.combatId), turnEconomy.combatantId,
      weapon.id, "attack");
  }
  const roll = await evaluateSystemRoll("1d100", { manual });
  const targetValue = difficultyTarget(resolution.target, resolution.difficulty);
  await recordAbilityFumble(resolution.style, classifyContestRoll(roll.total, targetValue));
  const styleName = resolution.untrained ? localize("MYTHRASF.Combat.Untrained")
    : resolution.usesBase ? localize("MYTHRASF.Combat.BaseStyle") : resolution.style?.name ?? "";
  if (ranged) {
    ranged.modifiedTarget = targetValue;
    ranged.accidentalEligible = isAccidentalMeleeHit({ rawRoll: roll.total,
      modifiedTarget: targetValue, normalTarget: ranged.normalTarget,
      meleePosition: ranged.meleePosition });
    ranged.ammunition = ammunition ?? ammunitionState(mode);
  }
  const combat = { schemaVersion: SCHEMA_VERSION, revision: 0,
    status: ranged?.accidentalEligible ? "awaitingAccidentalTarget" : "awaitingDefense",
    authorUserId: game.user.id, predeclared: Boolean(setup.predeclared),
    declarations: { containedBlow: Boolean(setup.containedBlow),
      extraordinaryDamage: setup.extraordinaryDamage },
    attacker: { actorUuid: actor.uuid, actorId: actorIdentity(actor), actorName: actorDisplayName(actor),
      tokenUuid: actor.token?.uuid ?? "", weaponId: weapon.id, weaponName: weapon.name,
      weaponDurable: weaponHasDurability(weapon),
      modeKey: mode.key, modeName: mode.name, styleId: resolution.style?.id ?? "", styleName,
      difficulty: resolution.difficulty,
      baseTarget: resolution.rollConfiguration?.baseTarget ?? resolution.target,
      target: targetValue,
      rollConfiguration: resolution.rollConfiguration,
      damage: reachRule.pommel ? reachRule.damage : mode.damage,
      damageModifierMode: mode.damageModifierMode,
      weaponSize: reachRule.pommel ? reachRule.weaponSize : ranged?.effectivePower ?? mode.size,
      modeSnapshot: { key: mode.key, weaponType: mode.weaponType, size: mode.size,
        impalingSize: mode.impalingSize, handsRequired: mode.handsRequired, effects: mode.effects },
      rawRoll: roll.total, serializedRoll: roll.toJSON(), luckHistory: [] },
    defender: { actorUuid: defender.uuid, actorId: actorIdentity(defender), actorName: tokenDisplayName(target),
      tokenUuid: setup.targetTokenUuid, defense: null, luckHistory: [], size: defender.system.size,
      targetType: setup.targetWeaponId ? "weapon" : "actor", targetWeaponId: setup.targetWeaponId ?? "",
      locations: (setup.targetWeaponId ? defender.items.filter((item) => item.id === setup.targetWeaponId)
        : defender.items.filter((item) => item.type === "hitLocation")).map(locationSnapshot) },
    resolution: null, damage: { status: "unavailable" }, turnEconomy, ranged,
    surprise: surpriseOpportunity(defender, roll.total, targetValue) };
  if (!combat.predeclared) combat.attackClassification = resolveCombatExchange({
    attack: { target: targetValue, rawRoll: roll.total }, defense: { type: "none" }
  }).attack;
  const messageData = { speaker: actorSpeaker(actor), content: renderCombatExchange(combat),
    flags: { [FLAG_SCOPE]: { combat } }, rolls: [roll] };
  ChatMessage.applyRollMode?.(messageData, game.settings.get("core", "rollMode"));
  return ChatMessage.create(messageData);
  } finally { pendingAttackActors.delete(actor.uuid); }
}

export async function createResolvedReactionAttack({ tracker, attackerCombatantId,
  defenderCombatantId, weaponId, modeKey, attackTarget, attackRoll, evadeTarget, evadeRoll,
  authorUserId }) {
  const attackerEntry = tracker?.combatants.get(attackerCombatantId);
  const defenderEntry = tracker?.combatants.get(defenderCombatantId);
  const actor = attackerEntry?.actor; const defender = defenderEntry?.actor;
  const weapon = actor?.items.get(weaponId); const mode = weapon ? findWeaponMode(weapon, modeKey) : null;
  if (!actor || !defender || !weapon || !mode) return null;
  const defense = { type: "evade", target: evadeTarget, baseTarget: evadeTarget,
    rawRoll: evadeRoll, abilityName: localize("MYTHRASF.Combat.Evade") };
  const resolution = resolveCombatExchange({ attack: { target: attackTarget, rawRoll: attackRoll },
    defense });
  const sideSlots = combatEffectSlotsBySide({ winner: resolution.winner,
    differential: resolution.effects, surprise: 0 });
  const totalSlots = sideSlots.attacker + sideSlots.defender;
  const economy = tracker.mythrasTurnEconomy;
  const combat = { schemaVersion: SCHEMA_VERSION, revision: 0,
    status: totalSlots ? "awaitingEffects" : "resolved", authorUserId,
    predeclared: false, declarations: { containedBlow: false, extraordinaryDamage: "0" },
    attacker: { actorUuid: actor.uuid, actorId: actorIdentity(actor), actorName: actorDisplayName(actor),
      tokenUuid: attackerEntry.token?.uuid ?? "", weaponId: weapon.id, weaponName: weapon.name,
      weaponDurable: weaponHasDurability(weapon),
      modeKey: mode.key, modeName: mode.name, styleId: "", styleName: "",
      difficulty: "standard", baseTarget: attackTarget, target: attackTarget,
      damage: mode.damage, damageModifierMode: mode.damageModifierMode, weaponSize: mode.size,
      modeSnapshot: { key: mode.key, weaponType: mode.weaponType, size: mode.size,
        reach: mode.reach, impalingSize: mode.impalingSize, handsRequired: mode.handsRequired,
        effects: mode.effects }, rawRoll: attackRoll, serializedRoll: null, luckHistory: [] },
    defender: { actorUuid: defender.uuid, actorId: actorIdentity(defender), actorName: tokenDisplayName(defenderEntry.token),
      tokenUuid: defenderEntry.token?.uuid ?? "", defense, luckHistory: [], size: defender.system.size,
      locations: defender.items.filter((item) => item.type === "hitLocation").map(locationSnapshot) }, resolution,
    effects: { winner: resolution.winner, slots: totalSlots, sideSlots, surpriseSlots: 0,
      pendingSide: sideSlots.attacker ? "attacker" : sideSlots.defender ? "defender" : null,
      selections: [], confirmed: totalSlots === 0, checks: [] },
    damage: { status: totalSlots ? "blocked" : combatAttackHits(resolution) ? "ready" : "unavailable" },
    turnEconomy: { combatId: tracker.id, combatUuid: tracker.uuid,
      combatantId: defenderCombatantId, defenderCombatantId: attackerCombatantId,
      round: tracker.round, cycle: economy.cycle ?? 1, turn: tracker.turn,
      turnRevision: economy.revision ?? 0, attackSpent: true, defenseSpent: true,
      turnAdvanced: false }, reactionAttack: true };
  return ChatMessage.create({ speaker: actorSpeaker(actor),
    content: renderCombatExchange(combat), flags: { [FLAG_SCOPE]: { combat } } });
}

function effectiveDifficulty(actor, baseDifficulty = "standard") {
  return resolveActorConditions(actor, { baseAttributes: actor.system.baseAttributes ?? actor.system.attributes ?? {},
    baseDifficulty, physical: true, loadState: actorLoadState(actor) }).difficulty;
}

function parryChoices(actor, combatData = null) {
  const styles = actor.items.filter((item) => item.type === "combatStyle");
  const choices = actor.items.filter((item) => item.type === "weapon" && item.system.equipped
    && weaponCanEquip(item))
    .flatMap((weapon) => weaponModes(weapon).filter((mode) => mode.key === weapon.system.activeModeKey)
      .flatMap((mode) => styles.map((style) => {
        if (combatData?.ranged && mode.weaponType !== "shield") return null;
        const tracker = combatData?.turnEconomy ? game.combats.get(combatData.turnEconomy.combatId) : null;
        const relation = tracker ? relationFor(tracker, combatData.turnEconomy.combatantId,
          combatData.turnEconomy.defenderCombatantId) : null;
        const defenderId = combatData?.turnEconomy?.defenderCombatantId;
        if (engagementRestriction(relation, defenderId, mode.reach).pommel) return null;
        const resolved = resolveWeaponStyle({ weapon: weaponModeView(weapon, mode), styles,
          selectedStyleId: style.id, familiarity: mode.familiarity });
        if (!resolved.style && !resolved.usesBase) return null;
        const difficulty = effectiveDifficulty(actor, resolved.difficulty);
        if (difficulty === "impossible") return null;
        return { value: `${weapon.id}:${mode.key}:${resolved.style?.id ?? ""}`,
          weaponId: weapon.id, weaponName: weapon.name, weaponDurable: weaponHasDurability(weapon),
          modeKey: mode.key, damage: mode.damage, damageModifierMode: mode.damageModifierMode,
          modeName: weaponModeDisplayName(weapon, mode), styleId: resolved.style?.id ?? "",
          styleName: resolved.usesBase ? localize("MYTHRASF.Combat.BaseStyle") : resolved.style?.name ?? "",
          difficulty, baseTarget: resolved.target, target: difficultyTarget(resolved.target, difficulty),
          weaponSize: mode.size, weaponType: mode.weaponType };
      }).filter(Boolean)));
  return [...new Map(choices.map((choice) => [choice.value, choice])).values()];
}

function shieldResistanceChoices(actor) {
  const styles = actor.items.filter((item) => item.type === "combatStyle");
  return actor.items.filter((item) => item.type === "weapon" && item.system.equipped
    && weaponCanEquip(item))
    .flatMap((weapon) => weaponModes(weapon).filter((mode) =>
      mode.key === weapon.system.activeModeKey && mode.weaponType === "shield")
      .flatMap((mode) => styles.map((style) => {
        const resolved = resolveWeaponStyle({ weapon: weaponModeView(weapon, mode), styles,
          selectedStyleId: style.id, familiarity: mode.familiarity });
        if (!resolved.style) return null;
        const difficulty = effectiveDifficulty(actor, resolved.difficulty);
        if (difficulty === "impossible") return null;
        return { ability: resolved.style,
          name: `${resolved.style.name} — ${weaponModeDisplayName(weapon, mode)}`,
          target: difficultyTarget(resolved.target, difficulty) };
      }).filter(Boolean)));
}

export function preferredParryChoice(choices, passiveBlock) {
  if (passiveBlock?.status !== "active") return choices[0] ?? null;
  return choices.find((choice) => choice.weaponId !== passiveBlock.weaponId)
    ?? choices[0] ?? null;
}

export function selectedParryChoice(choices, selected) {
  return choices.find((choice) => choice.value === selected) ?? null;
}

async function defenseConfiguration(actor, type, combatData = null) {
  if (type === "none") return { type: "none" };
  if (type === "cover") {
    const tracker = combatData?.turnEconomy ? game.combats.get(combatData.turnEconomy.combatId) : null;
    const cover = tracker ? tracker.getFlag(FLAG_SCOPE, "tacticalState")?.covers?.[
      combatData.turnEconomy.defenderCombatantId] : null;
    if (!cover || cover.status !== "active") return ui.notifications.warn(
      localize("MYTHRASF.Ranged.NoCover"));
    return { type: "cover", source: cover.source, protection: cover.protection };
  }
  if (type === "evade") {
    const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === "evadir");
    if (!skill) return ui.notifications.warn(localize("MYTHRASF.Combat.EvadeMissing"));
    const difficulty = effectiveDifficulty(actor);
    if (difficulty === "impossible") return ui.notifications.warn(localize("MYTHRASF.Fatigue.NoActivity"));
    return { type, abilityId: skill.id, abilityName: skill.name, difficulty,
      baseTarget: Number(skill.system.total ?? 0), target: difficultyTarget(skill.system.total, difficulty) };
  }
  const choices = parryChoices(actor, combatData);
  if (!choices.length) return ui.notifications.warn(localize("MYTHRASF.Combat.NoParryAvailable"));
  const tracker = combatData?.turnEconomy ? game.combats.get(combatData.turnEconomy.combatId) : null;
  const declaredBlock = tracker && Number(tracker.round) === Number(combatData?.turnEconomy?.round)
    ? tacticalState(tracker).passiveBlocks?.[combatData.turnEconomy.defenderCombatantId] : null;
  const passiveBlock = Number(declaredBlock?.round) === Number(tracker?.round) ? declaredBlock : null;
  const preferred = preferredParryChoice(choices, passiveBlock);
  const { DialogV2 } = foundry.applications.api;
  const selected = await DialogV2.wait({ window: { title: localize("MYTHRASF.Combat.ChooseParry") },
    content: `<div class="mythras-foundry mythras-dialog combat-defense-dialog"><fieldset><legend>${escape(localize("MYTHRASF.Combat.Parry"))}</legend><label><span>${escape(localize("MYTHRASF.Combat.WeaponAndStyle"))}</span><select name="choice">${choices.map((choice) => `<option value="${escape(choice.value)}" ${choice.value === preferred?.value ? "selected" : ""}>${escape(choice.modeName)} — ${escape(choice.styleName)} (${choice.target}%)</option>`).join("")}</select></label></fieldset></div>`,
    buttons: [{ action: "roll", label: localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => button.form.elements.choice.value },
    { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times",
      callback: () => null }], rejectClose: false });
  const choice = selectedParryChoice(choices, selected);
  return choice ? { type, ...choice } : null;
}

async function respondToAttack(message, combat, type, manual = false) {
  const actor = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner)) return;
  if (["parry", "evade"].includes(type) && combat.turnEconomy
    && !combat.turnEconomy.defenseSpent
    && (effectiveActionPointMaximum(actor, getActionPointRules()) < 1
      || currentActionPoints(actor) < 1)) {
    return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.actionPoints"));
  }
  if (type !== "none" && !resolveActorConditions(actor, { baseAttributes:
    actor.system.baseAttributes ?? actor.system.attributes ?? {} }).capabilities.canDefend) {
    return ui.notifications.warn(localize("MYTHRASF.Status.CannotDefend"));
  }
  const defense = await defenseConfiguration(actor, type, combat);
  if (!defense) return;
  if (["parry", "evade"].includes(type)) await clearAim(actor);
  const roll = ["none", "cover"].includes(type) ? null
    : await evaluateSystemRoll("1d100", { manual });
  const request = { action: "combatDefense", messageId: message.id, revision: combat.revision,
    userId: game.user.id, defense: { ...defense, rawRoll: roll?.total ?? null,
      serializedRoll: roll?.toJSON?.() ?? null } };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyCombatDefense(message, request);
  else game.socket.emit(SOCKET, request);
}

async function chooseAccidentalTarget(message, combat) {
  if (!game.user.isGM || combat.status !== "awaitingAccidentalTarget") return;
  const candidates = visibleTargets({ uuid: combat.attacker.actorUuid }).filter((token) =>
    tokenUuid(token) !== combat.defender.tokenUuid && tokenUuid(token) !== combat.attacker.tokenUuid);
  if (!candidates.length) return ui.notifications.warn(localize("MYTHRASF.Ranged.NoAccidentalTarget"));
  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.Ranged.ChooseAccidentalTarget") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><select name="target">${candidates.map((token) => `<option value="${escape(tokenUuid(token))}">${escape(tokenDisplayName(token))}</option>`).join("")}</select></label></div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"),
      callback: (event, button) => button.form.elements.target.value },
    { action: "cancel", label: localize("MYTHRASF.Cancel") }], rejectClose: false
  });
  if (!selected) return;
  const token = await fromUuid(selected); const actor = token?.actor;
  if (!actor) return ui.notifications.warn(localize("MYTHRASF.Combat.TargetUnavailable"));
  const tracker = combat.turnEconomy ? game.combats.get(combat.turnEconomy.combatId) : null;
  const entry = tracker?.combatants.find((candidate) => candidate.token?.uuid === selected
    || candidate.actor?.uuid === actor.uuid);
  if (tracker && !entry) return ui.notifications.warn(localize("MYTHRASF.Tracker.Rejected.participation"));
  return applyAccidentalTargetTransition(message, combat, { token, entry, userId: game.user.id,
    clone: foundry.utils.deepClone, actorIdentity, tokenIdentity: tokenUuid,
    tokenName: tokenDisplayName, locationSnapshot, render: renderCombatExchange,
    flagScope: FLAG_SCOPE });
}

function surpriseOpportunity(defender, rawRoll, target) {
  const effect = timedEffects(defender).find((candidate) => {
    const condition = candidate.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
    return condition?.key === "surprised" && !condition.bonusConsumed;
  });
  const result = classifyContestRoll(rawRoll, target);
  return effect ? { eligible: ["success", "critical"].includes(result),
    effectId: effect.id, consumed: false } : null;
}

async function consumeSurpriseBonus(defender, combat) {
  return consumeSurpriseEffectBonus(defender, combat,
    { scope: TIMED_CONDITION_SCOPE, flag: TIMED_CONDITION_FLAG });
}

async function applyCombatDefense(message, request) {
  return applyCombatDefenseTransition(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    warn: (text) => ui.notifications.warn(text), localize,
    combatById: (id) => game.combats.get(id), actionPointRules: getActionPointRules,
    spendActionPoint, consumePassiveBlock, applyCondition: applyTimedCondition,
    recordFumbles: recordCombatResolutionFumbles, consumeSurprise: consumeSurpriseBonus,
    render: renderCombatExchange, appendRolls: appendSerializedRolls,
    advance: advanceCombatTurnForExchange });
}

async function chooseCombatEffects(message, combat) {
  const side = combat.effects?.pendingSide ?? combat.effects?.winner;
  const winnerEntry = side === "attacker" ? combat.attacker : combat.defender;
  const actor = await combatActor(winnerEntry?.tokenUuid, winnerEntry?.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner) || combat.status !== "awaitingEffects") return;
  const catalog = (await combatEffectDocuments()).map(effectView);
  const eligible = eligibleCombatEffects(catalog, effectContext(combat, side));
  const ruseTargetOptions = combatRuseTargetEffects(catalog).map((effect) =>
    `<option value="${escape(effect.key)}">${escape(effect.name)}</option>`).join("");
  const options = [`<option value="__waive__">${escape(localize("MYTHRASF.CombatEffect.Waive"))}</option>`,
    ...eligible.map((effect) => {
      const highlight = combatEffectSelectionHighlight(effect, side);
      const hint = highlight ? localize(`MYTHRASF.CombatEffect.Highlight.${highlight}`) : "";
      return `<option value="${escape(effect.key)}" ${highlight ? `class="combat-effect-option--${highlight}" title="${escape(hint)}"` : ""}>${escape(effect.name)}</option>`;
    })]
    .join("");
  const locationOptions = (combat.defender.locations ?? []).map((location) =>
    `<option value="${escape(location.id)}">${escape(hitLocationDisplayName(location))}</option>`).join("");
  const slots = combat.effects.sideSlots?.[side] ?? combat.effects.slots;
  const rows = Array.from({ length: slots }, (_, index) =>
    `<fieldset data-combat-effect-slot="${index}"><legend>${escape(game.i18n.format("MYTHRASF.CombatEffect.Slot", { slot: index + 1 }))}</legend>
      <label><span>${escape(localize("MYTHRASF.Item.Name"))}</span><select name="effect-${index}">${options}</select></label>
      <label class="combat-effect-location" hidden><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select name="location-${index}"><option value=""></option>${locationOptions}</select></label>
      <label class="combat-effect-ruse-target" hidden><span>${escape(localize("MYTHRASF.CombatEffect.Ruse.Target"))}</span><select name="ruse-${index}"><option value=""></option>${ruseTargetOptions}</select></label>
      <div class="combat-effect-choice-description"><span>${escape(localize("MYTHRASF.Item.Description"))}</span>
        ${eligible.map((effect) => `<p class="sheet-field-readonly combat-effect-description" data-effect-description="${escape(effect.key)}" hidden>${escape(effect.description)}</p>`).join("")}
      </div>
    </fieldset>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.CombatEffect.Select") },
    position: { width: 760 },
    content: `<div class="mythras-foundry mythras-dialog combat-effect-dialog"><h2 class="mythras-launcher-title">${escape(localize("MYTHRASF.CombatEffect.SelectionTitle"))}</h2>${rows}</div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.ConfirmSelection"),
      icon: "fas fa-check", default: true, callback: (event, button) =>
        Array.from({ length: slots }, (_, index) => ({
          key: button.form.elements[`effect-${index}`].value,
          locationId: button.form.elements[`location-${index}`].value,
          effectKey: button.form.elements[`ruse-${index}`].value,
          note: ""
        })) }, { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      const fixedEffects = (combat.effects?.selections ?? []).filter((entry) => !entry.waived);
      const refreshCompatibility = () => {
        const selects = [...(form?.querySelectorAll("select[name^='effect-']") ?? [])];
        const selectedKeys = selects.map((select) => select.value)
          .filter((key) => key !== "__waive__");
        for (const select of selects) {
          for (const option of select.options) {
            if (option.value === "__waive__" || option.value === select.value) continue;
            const candidates = [...fixedEffects,
              ...selectedKeys.filter((key) => key !== select.value)
                .map((key) => eligible.find((entry) => entry.key === key)).filter(Boolean),
              eligible.find((entry) => entry.key === option.value)].filter(Boolean);
            const incompatible = !combatEffectSelectionsCompatible(candidates);
            option.disabled = incompatible;
            option.title = incompatible
              ? localize("MYTHRASF.CombatEffect.Incompatible") : option.title;
          }
        }
      };
      const refreshSlot = (select) => {
        const slot = select.closest("[data-combat-effect-slot]");
        const effect = eligible.find((entry) => entry.key === select.value);
        const location = slot?.querySelector(".combat-effect-location");
        if (location) location.hidden = effect?.ruleKey !== "chooseLocation";
        const ruse = slot?.querySelector(".combat-effect-ruse-target");
        if (ruse) ruse.hidden = effect?.key !== "ardid";
        slot?.querySelectorAll("[data-effect-description]").forEach((description) => {
          description.hidden = description.dataset.effectDescription !== select.value;
        });
      };
      form?.querySelectorAll("select[name^='effect-']").forEach(refreshSlot);
      refreshCompatibility();
      form?.addEventListener("change", (change) => {
        if (change.target.matches("select[name^='effect-']")) {
          refreshSlot(change.target);
          refreshCompatibility();
        }
      });
    },
    rejectClose: false
  });
  if (!result) return;
  const selections = result.map((selected, index) => {
    if (selected.key === "__waive__") return { slot: index, waived: true };
    const effect = eligible.find((entry) => entry.key === selected.key);
    return { slot: index, waived: false, ...effect,
      parameters: { locationId: selected.locationId, effectKey: selected.effectKey,
        note: selected.note },
      status: initialCombatEffectStatus(effect) };
  });
  const request = { action: "combatEffects", messageId: message.id, revision: combat.revision,
    userId: game.user.id, side, selections };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatEffects(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function applyCombatEffects(message, request) {
  return applyCombatEffectsTransition(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    catalogDocuments: combatEffectDocuments, effectView, effectContext,
    warn: (text) => ui.notifications.warn(text), localize,
    triggerRuses: (combat, selections) => consumeMatchingCombatRuses(
      game.combats.get(combat.turnEconomy.combatId), {
        ownerCombatantId: combat.turnEconomy.defenderCombatantId,
        rivalCombatantId: combat.turnEconomy.combatantId, selections }),
    applyImmediateEffects: applyImmediateCombatEffects,
    immediateDependencies: combatEffectRuntimeDependencies, render: renderCombatExchange,
    advance: advanceCombatTurnForExchange });
}

async function chooseCombatRuseReplacement(message, combat) {
  const actor = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner) || combat.status !== "awaitingRuse") return;
  const catalog = (await combatEffectDocuments()).map(effectView);
  const eligible = eligibleCombatRuseReplacements(catalog, effectContext(combat, "defender"));
  const options = eligible.map((effect) =>
    `<option value="${escape(effect.key)}">${escape(effect.name)}</option>`).join("");
  const locationOptions = (combat.defender.locations ?? []).map((location) =>
    `<option value="${escape(location.id)}">${escape(hitLocationDisplayName(location))}</option>`).join("");
  const pending = combat.effects.pendingRuses ?? [];
  const rows = pending.map((entry, index) => `<fieldset data-combat-effect-slot="${index}">
    <legend>${escape(game.i18n.format("MYTHRASF.CombatEffect.Ruse.Blocked", {
      effect: entry.blockedEffectName }))}</legend>
    <label><span>${escape(localize("MYTHRASF.CombatEffect.Ruse.Replacement"))}</span>
      <select name="effect-${index}">${options}</select></label>
    <label class="combat-effect-location" hidden><span>${escape(localize(
      "MYTHRASF.Combat.HitLocation"))}</span><select name="location-${index}">
      <option value=""></option>${locationOptions}</select></label></fieldset>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.CombatEffect.Ruse.Title") },
    position: { width: 680 },
    content: `<div class="mythras-foundry mythras-dialog combat-effect-dialog"><h2 class="mythras-launcher-title">${escape(localize("MYTHRASF.CombatEffect.Ruse.AutomaticPrompt"))}</h2>${rows}</div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.ConfirmSelection"),
      icon: "fas fa-check", default: true, callback: (event, button) => pending.map((entry, index) => ({
        key: button.form.elements[`effect-${index}`].value,
        parameters: { locationId: button.form.elements[`location-${index}`].value }
      })) }, { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      const refresh = (select) => {
        const effect = eligible.find((entry) => entry.key === select.value);
        const location = select.closest("fieldset")?.querySelector(".combat-effect-location");
        if (location) location.hidden = effect?.ruleKey !== "chooseLocation";
      };
      form?.querySelectorAll("select[name^='effect-']").forEach(refresh);
      form?.addEventListener("change", (event) => {
        if (event.target.matches("select[name^='effect-']")) refresh(event.target);
      });
    }, rejectClose: false
  });
  if (!result) return;
  const request = { action: "combatRuseReplacement", messageId: message.id,
    revision: combat.revision, userId: game.user.id, side: "defender", selections: result };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatRuseReplacement(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function applyCombatRuseReplacement(message, request) {
  return applyCombatRuseReplacementTransition(message, request, {
    clone: foundry.utils.deepClone, flagScope: FLAG_SCOPE, resolveActor: combatActor,
    userById: (id) => game.users.get(id), catalogDocuments: combatEffectDocuments,
    effectView, effectContext, replacementEffects: eligibleCombatRuseReplacements,
    warn: (text) => ui.notifications.warn(text), localize,
    applyImmediateEffects: applyImmediateCombatEffects,
    immediateDependencies: combatEffectRuntimeDependencies, render: renderCombatExchange,
    advance: advanceCombatTurnForExchange
  });
}

async function addManagedStatus(combat, effect, { key, statusId, turns = null,
  unit = "actorTurn", phase = "endActorTurn", locationId = "", capabilities = {},
  metadata = {} } = {}) {
  return addManagedCombatStatus(combat, effect, { key, statusId, turns, unit, phase,
    locationId, capabilities, metadata }, combatEffectRuntimeDependencies());
}

async function cancelCombat(message, current, suppliedReason = "") {
  if (!game.user.isGM || !combatCanBeCancelled(current)) return;
  let reason = suppliedReason;
  if (!suppliedReason && ["awaitingEffects", "awaitingRuse"].includes(current.status)) {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: localize("MYTHRASF.Contest.Cancel") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.CombatEffect.Reason"))}</span><textarea name="reason" required></textarea></label></div>`,
      buttons: [{ action: "cancel", label: localize("MYTHRASF.Contest.Cancel"),
        callback: (event, button) => button.form.elements.reason.value.trim() },
      { action: "back", label: localize("MYTHRASF.Cancel") }], rejectClose: false
    });
    if (!result) return;
    reason = result;
  }
  return applyCombatExchangeCancellation(message, current, { reason, userId: game.user.id,
    clone: foundry.utils.deepClone, resolveActor: combatActor, render: renderCombatExchange,
    flagScope: FLAG_SCOPE });
}

async function closeCombatExchange(message, current) {
  if (!game.user.isGM || !current.turnEconomy || current.turnEconomy.turnAdvanced) return;
  if (exchangeTerminal(current)) {
    return closeTerminalCombatExchange(message, current, { clone: foundry.utils.deepClone,
      combatById: (id) => game.combats.get(id), render: renderCombatExchange,
      advance: advanceCombatTurnForExchange, flagScope: FLAG_SCOPE });
  }
  const resolution = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.Tracker.CloseExchange") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.CombatEffect.Reason"))}</span><textarea name="reason"></textarea></label></div>`,
    buttons: [{ action: "close", label: localize("MYTHRASF.Tracker.CloseExchange"),
      callback: (event, button) => ({ note: button.form.elements.reason.value.trim() }) },
    { action: "cancel", label: localize("MYTHRASF.Cancel"), callback: () => null }],
    rejectClose: false
  });
  if (!resolution) return;
  const combat = foundry.utils.deepClone(current);
  resolveCombatExchangePending(combat, { note: resolution.note, userId: game.user.id });
  return closeCombatExchange(message, combat);
}

async function resolveCombatConsequence(message, current, index) {
  if (!game.user.isGM) return;
  const consequence = current.consequences?.[Number(index)];
  if (!consequence || consequence.status !== "pending") return;
  const note = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.CombatEffect.ResolveManual") },
    content: `<div class="mythras-foundry mythras-dialog"><textarea name="note"></textarea></div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.ResolveManual"),
      callback: (event, button) => button.form.elements.note.value.trim() }], rejectClose: false });
  if (note == null) return;
  return resolveCombatExchangeConsequence(message, current, index, { note,
    userId: game.user.id, clone: foundry.utils.deepClone, render: renderCombatExchange,
    advance: advanceCombatTurnForExchange, flagScope: FLAG_SCOPE });
}

async function requestDropHeldItem(message, current, index, itemId) {
  const consequence = current.consequences?.[Number(index)];
  if (!consequence || consequence.key !== "dropHeldItem" || consequence.status !== "pending") return;
  const entry = combatSideEntry(current, consequence.actorSide ?? "defender");
  const actor = await combatActor(entry.tokenUuid, entry.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner)) return;
  const request = { action: "combatDropHeldItem", messageId: message.id,
    revision: current.revision, userId: game.user.id, consequenceIndex: Number(index),
    itemId: String(itemId ?? "") };
  if (preferredCombatCoordinator(game.users, current.authorUserId) === game.user.id) {
    await applyDropHeldItem(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function applyDropHeldItem(message, request) {
  return applyDroppedCombatItem(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    render: renderCombatExchange, advance: advanceCombatTurnForExchange });
}

async function spendCombatLuck(message, current, side, manual = false) {
  if (!combatRollLuckAllowed(current)) return;
  const entry = side === "attacker" ? current.attacker : current.defender;
  if (side === "defender" && !entry.defense?.rawRoll) return;
  const participants = await Promise.all(["attacker", "defender"].map(async (participantSide) => {
    const participant = participantSide === "attacker" ? current.attacker : current.defender;
    return { side: participantSide,
      actor: await combatActor(participant.tokenUuid, participant.actorUuid) };
  }));
  const spenders = participants.filter(({ actor }) => actor
    && (game.user.isGM || actor.isOwner)
    && Number(actor.system.resources?.luckPoints?.value ?? 0) > 0);
  if (!spenders.length) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  const currentRoll = side === "attacker" ? entry.rawRoll : entry.defense.rawRoll;
  const { DialogV2 } = foundry.applications.api;
  let spender = spenders[0];
  if (spenders.length > 1) {
    const luckSide = await DialogV2.wait({ window: { title: localize("MYTHRASF.Luck.Title") },
      content: `<div class="mythras-foundry mythras-dialog luck-spend-dialog"><label><span>${escape(localize("MYTHRASF.Luck.Spender"))}</span><select name="luckSide">${spenders.map((candidate) => `<option value="${candidate.side}">${escape(actorDisplayName(candidate.actor))} (${Number(candidate.actor.system.resources?.luckPoints?.value ?? 0)})</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "confirm", label: localize("MYTHRASF.Confirm"), icon: "fas fa-check",
        default: true, callback: (event, button) => button.form.elements.luckSide.value },
      { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }],
      rejectClose: false });
    if (!luckSide) return;
    spender = spenders.find((candidate) => candidate.side === luckSide);
    if (!spender) return;
  }
  const ownRoll = spender.side === side;
  const choice = await DialogV2.wait({ window: { title: localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog luck-spend-dialog"><div class="luck-spender-fixed"><span>${escape(localize("MYTHRASF.Luck.Spender"))}</span><strong>${escape(actorDisplayName(spender.actor))} (${Number(spender.actor.system.resources?.luckPoints?.value ?? 0)})</strong></div><p>${escape(localize(ownRoll ? "MYTHRASF.Luck.Confirm" : "MYTHRASF.Luck.ForceRerollConfirm"))}</p></div>`,
    buttons: [{ action: "reroll", label: localize(ownRoll
      ? "MYTHRASF.Luck.Reroll" : "MYTHRASF.Luck.ForceReroll"), icon: "fas fa-dice-d20" },
      ...(ownRoll ? [{ action: "invert", label: localize("MYTHRASF.Luck.Invert"),
        icon: "fas fa-arrow-right-arrow-left" }] : []),
      { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }], rejectClose: false });
  if (!choice) return;
  const roll = choice === "reroll" ? await evaluateSystemRoll("1d100", { manual }) : null;
  const rawRoll = roll?.total ?? invertD100(currentRoll);
  if (!await spendActorLuckPoint(spender.actor)) {
    return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  }
  const request = { action: "combatLuck", messageId: message.id, revision: current.revision,
    userId: game.user.id, side, mode: choice, luckSide: spender.side,
    rawRoll, serializedRoll: roll?.toJSON?.() ?? null,
    luckAlreadySpent: true };
  if (preferredCombatCoordinator(game.users, current.authorUserId) === game.user.id) await applyCombatLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyCombatLuck(message, request) {
  return applyCombatLuckTransition(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    warn: (text) => ui.notifications.warn(text), localize, actorName: actorDisplayName,
    recordFumble: recordAbilityFumble, recordFumbles: recordCombatResolutionFumbles,
    consumeSurprise: consumeSurpriseBonus, render: renderCombatExchange,
    appendRolls: appendSerializedRolls });
}

async function requestCombatDamage(message, combat, manual = false) {
  const weaponPlan = combatWeaponDamagePlan(combat);
  const sourceEntry = weaponPlan?.sourceEntry ?? combat.attacker;
  const actor = await combatActor(sourceEntry.tokenUuid, sourceEntry.actorUuid);
  const guidedPending = (combat.effects?.selections ?? []).some((effect) =>
    effect.status === "pending" && !effect.requiresWound);
  if (!actor || (!game.user.isGM && !actor.isOwner) || combat.damage?.status !== "ready"
    || guidedPending) return;
  const weaponId = weaponPlan?.sourceWeaponId ?? combat.attacker.weaponId;
  const modeKey = weaponPlan?.sourceModeKey ?? combat.attacker.modeKey;
  const weapon = actor.items.get(weaponId);
  const mode = weapon ? findWeaponMode(weapon, modeKey) : null;
  if (!weapon || !mode) return ui.notifications.warn(localize("MYTHRASF.Combat.SourceMissing"));
  if (!weaponCanEquip(weapon)) return ui.notifications.warn(
    localize("MYTHRASF.Weapon.BrokenCannotEquip"));
  const modifier = damageModifierFormula(actor.system.attributes?.damageModifier, mode.damageModifierMode) || "0";
  const extraordinary = weaponPlan?.sourceSide === "defender"
    ? "0" : combat.declarations?.extraordinaryDamage || "0";
  const maximizeCount = selectedEffectCount(combat.effects?.selections ?? [], "maximizeDamage");
  const maximizedDamage = maximizeDamageFormulaDetails(
    (weaponPlan?.sourceSide === "defender" ? mode.damage : combat.attacker.damage)
      || mode.damage || "0", maximizeCount);
  const weaponDamage = maximizedDamage.formula;
  const formula = `max(0, (${weaponDamage}) + (${modifier}) + (${extraordinary}))`;
  let roll;
  try { roll = await evaluateSystemRoll(formula, { manual }); }
  catch { return ui.notifications.warn(localize("MYTHRASF.Combat.InvalidDamageFormula")); }
  let alternateRoll = null;
  if (selectedEffectCount(combat.effects?.selections ?? [], "impale")) {
    alternateRoll = await evaluateSystemRoll(formula, { manual });
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
  const targetsWeapon = Boolean(weaponPlan) || combat.defender.targetType === "weapon";
  let chosenLocation = weaponPlan?.targetWeaponId
    ?? (combat.defender.targetType === "weapon" ? combat.defender.targetWeaponId
      : (combat.effects?.selections ?? []).find((entry) =>
        entry.ruleKey === "chooseLocation")?.parameters?.locationId);
  const locationRoll = chosenLocation ? null : await evaluateSystemRoll("1d20", { manual });
  const permanentWoundRule = getSystemSetting(SETTING_KEYS.permanentWoundHitLocationRule);
  const checkEveryMutilatedHit = permanentWoundRule
    === PERMANENT_WOUND_HIT_LOCATION_RULES.checkD3;
  let rolledLocationId = "";
  if (locationRoll && selectedEffectCount(combat.effects?.selections ?? [], "aimedShot")) {
    const locations = combat.defender.locations ?? [];
    const rolledLocation = findHitLocation(locations.map((entry) => ({ ...entry,
      system: { rangeStart: entry.rangeStart, rangeEnd: entry.rangeEnd,
        category: entry.category, hpClass: entry.hpClass,
        permanentWound: entry.permanentWound } })), locationRoll.total,
    { ignorePermanentWounds: checkEveryMutilatedHit });
    rolledLocationId = rolledLocation?.id ?? "";
    if (!rolledLocationId) {
      chosenLocation = "";
    } else {
    const index = locations.findIndex((entry) => entry.id === rolledLocationId);
    const adjacent = locations.filter((entry, candidate) => Math.abs(candidate - index) <= 1);
    chosenLocation = await foundry.applications.api.DialogV2.wait({
      window: { title: localize("MYTHRASF.CombatEffect.ChooseLocation") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select name="location">${adjacent.map((entry) => `<option value="${escape(entry.id)}" ${entry.id === rolledLocationId ? "selected" : ""}>${escape(hitLocationDisplayName(entry))}</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"),
        callback: (event, button) => button.form.elements.location.value }], rejectClose: false
    });
    if (!chosenLocation) return;
    }
  }
  const selectedLocation = (combat.defender.locations ?? []).find((entry) =>
    entry.id === chosenLocation) ?? (combat.defender.locations ?? []).find((entry) =>
    entry.id === rolledLocationId) ?? (locationRoll ? findHitLocation(
      (combat.defender.locations ?? []).map((entry) => ({ ...entry,
        system: { rangeStart: entry.rangeStart, rangeEnd: entry.rangeEnd,
          category: entry.category, hpClass: entry.hpClass,
          permanentWound: entry.permanentWound } })), locationRoll.total,
      { ignorePermanentWounds: checkEveryMutilatedHit }) : null);
  const selectedLocationModel = selectedLocation ? { ...selectedLocation,
    system: { category: selectedLocation.category, hpClass: selectedLocation.hpClass,
      permanentWound: selectedLocation.permanentWound } } : null;
  const chosenByEffect = Boolean(chosenLocation && !locationRoll);
  const requiresPermanentWoundRoll = !targetsWeapon
    && woundLocationKind(selectedLocationModel).extremity
    && Number(selectedLocation?.permanentWound?.severity ?? 0) > 0
    && (checkEveryMutilatedHit || chosenByEffect);
  const permanentWoundHitRoll = requiresPermanentWoundRoll
    ? await evaluateSystemRoll("1d3", { manual }) : null;
  const request = { action: "combatDamage", messageId: message.id, revision: combat.revision,
    userId: game.user.id, formula, weaponFormula: weaponDamage,
    weaponFormulaParts: maximizedDamage.parts,
    maximizedWeaponDice: maximizedDamage.maximizedDice, modifierFormula: modifier,
    extraordinaryFormula: extraordinary, resultExpression: roll.result,
    rollExpression: evaluatedDamageExpression(roll, [weaponDamage, modifier, extraordinary]),
    rawRoll: roll.total, serializedRoll: roll.toJSON(),
    alternateRoll: alternateRoll ? { rawRoll: alternateRoll.total,
      serializedRoll: alternateRoll.toJSON() } : null,
    locationRoll: locationRoll?.total ?? null, serializedLocationRoll: locationRoll?.toJSON?.() ?? null, rolledLocationId,
    permanentWoundHitRoll: permanentWoundHitRoll?.total ?? null,
    serializedPermanentWoundHitRoll: permanentWoundHitRoll?.toJSON?.() ?? null,
    locationId: chosenLocation ?? "" };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyCombatDamage(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyCombatDamage(message, request) {
  return applyRolledCombatDamage(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    permanentWoundRule: getSystemSetting(SETTING_KEYS.permanentWoundHitLocationRule),
    refreshProposal: refreshDamageProposal, render: renderCombatExchange,
    appendRolls: appendSerializedRolls, advance: advanceCombatTurnForExchange });
}

async function requestDamageLuck(message, combat, manual = false) {
  const source = combat.damage?.weaponTarget?.source ?? combat.attacker;
  const actor = await combatActor(source.tokenUuid, source.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner)
    || Number(actor.system.resources?.luckPoints?.value ?? 0) < 1
    || !["proposed", "stale"].includes(combat.damage?.status)) return;
  let roll;
  try { roll = await evaluateSystemRoll(combat.damage.formula, { manual }); }
  catch { return ui.notifications.warn(localize("MYTHRASF.Combat.InvalidDamageFormula")); }
  if (!await spendActorLuckPoint(actor)) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  const request = { action: "combatDamageLuck", messageId: message.id, revision: combat.revision,
    userId: game.user.id, rawRoll: roll.total, resultExpression: roll.result,
    rollExpression: evaluatedDamageExpression(roll, [combat.damage.weaponFormula,
      combat.damage.modifierFormula, combat.damage.extraordinaryFormula]),
    serializedRoll: roll.toJSON() };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyDamageLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyDamageLuck(message, request) {
  return applyCombatDamageLuck(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    refreshProposal: refreshDamageProposal, render: renderCombatExchange,
    appendRolls: appendSerializedRolls });
}

async function refreshDamageProposal(combat, requestedLocationId = null) {
  return refreshCombatDamageProposal(combat, requestedLocationId, { resolveActor: combatActor,
    combatById: (id) => game.combats.get(id), passiveBlockFor, coverFor });
}

async function requestApplyDamage(message, combat, locationId, manual = false) {
  const target = combat.damage?.weaponTarget?.target ?? combat.defender;
  const defender = await combatActor(target.tokenUuid, target.actorUuid);
  if (!defender || (!game.user.isGM && !defender.isOwner)) return;
  const request = { action: "combatApplyDamage", messageId: message.id, revision: combat.revision,
    userId: game.user.id, locationId, manual };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) await applyProposedDamage(message, request);
  else game.socket.emit(SOCKET, request);
}

async function requestCombatCheck(message, combat, checkId, manual = false) {
  const check = (combat.effects?.checks ?? []).find((entry) => entry.id === checkId);
  const firstPending = (combat.effects?.checks ?? []).find((entry) => entry.status === "pending");
  if (!check || check.status !== "pending" || firstPending?.id !== check.id) return;
  if (check.source === "wound" && (combat.effects?.selections ?? [])
    .some((effect) => effect.status === "pending")) return;
  const phase = combatEffectCheckPhase(check, combat.effects?.selections ?? []);
  const phaseReady = ["beforeDamage", "damage"].includes(phase)
    ? combat.damage?.status === "ready"
    : ["applied", "unavailable", "missedLocation"].includes(combat.damage?.status);
  if (!phaseReady) return;
  const actorEntry = combatSideEntry(combat, check.actorSide ?? "defender");
  const defender = await combatActor(actorEntry.tokenUuid, actorEntry.actorUuid);
  if (!defender || (!game.user.isGM && !defender.isOwner)) return;
  let resolution;
  const silentDeath = check.source === "wound" && timedEffects(defender).some((effect) =>
    effect.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG)?.key === "silenced");
  if (silentDeath) {
    resolution = { manual: false, automaticFailure: true, result: "failure",
      winner: "right", opposed: { rawRoll: combat.resolution.attack.rawRoll,
        target: combat.resolution.attack.target, result: combat.resolution.attack.result } };
  } else {
    const skills = defender.items.filter((item) => item.type === "skill"
      && (check.abilitySlugs ?? ["aguante"]).includes(item.system.slug)).map((skill) => ({
      ability: skill, name: skill.name, target: Number(skill.system.total ?? 0)
    }));
    const shieldStyles = check.allowsShieldStyle ? shieldResistanceChoices(defender) : [];
    const choices = [...new Map([...skills, ...shieldStyles].filter((choice) => choice.ability)
      .map((choice) => [choice.ability.id, choice])).values()];
    if (!choices.length) return ui.notifications.warn(localize("MYTHRASF.Combat.SourceMissing"));
    let selected = choices[0];
    if (choices.length > 1) {
      const abilityId = await foundry.applications.api.DialogV2.wait({
        window: { title: localize("MYTHRASF.Combat.CheckChooseAbility") },
        content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(localize(
          "MYTHRASF.Combat.CheckTest"))}</legend><label><span>${escape(localize(
            "MYTHRASF.Combat.CheckAbility"))}</span><select name="ability">${choices.map((choice) =>
              `<option value="${escape(choice.ability.id)}">${escape(choice.name)} (${choice.target}%)</option>`).join("")}</select></label></fieldset></div>`,
        buttons: [{ action: "roll", label: localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20",
          default: true, callback: (event, button) => button.form.elements.ability.value },
        { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times",
          callback: () => null }], rejectClose: false
      });
      if (!abilityId) return;
      selected = choices.find((choice) => choice.ability.id === abilityId);
    }
    const skill = selected.ability;
    const roll = await evaluateAnimatedRoll("1d100", { manual });
    const target = selected.target;
    await recordAbilityFumble(skill, classifyContestRoll(roll.total, target));
    resolution = { manual: false, abilityId: skill.id, abilityName: skill.name,
      target, rawRoll: roll.total, serializedRoll: roll.toJSON(),
      result: classifyContestRoll(roll.total, target) };
    const opposed = check.opposedSide === "defender"
      ? combat.resolution.defense : combat.resolution.attack;
    resolution.opposed = { rawRoll: opposed.rawRoll, target: opposed.target,
      result: opposed.result };
    resolution.winner = opposedEffectWinner(resolution, resolution.opposed);
  }
  const request = { action: "combatCheck", messageId: message.id, revision: combat.revision,
    userId: game.user.id, checkId, resolution, manual };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatCheck(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function requestCombatCheckLuck(message, combat, checkId, manual = false) {
  const check = (combat.effects?.checks ?? []).find((entry) => entry.id === checkId);
  const actorEntry = check ? combatSideEntry(combat, check.actorSide ?? "defender") : null;
  const actor = actorEntry ? await combatActor(actorEntry.tokenUuid, actorEntry.actorUuid) : null;
  if (!check || check.status !== "rolled"
    || check.resolution?.automaticFailure || !actor
    || (!game.user.isGM && !actor.isOwner)) return;
  const points = Number(actor.system.resources?.luckPoints?.value ?? 0);
  if (points < 1) return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><p>${escape(localize(
      "MYTHRASF.Combat.CheckLuckRerollConfirm"))}</p></div>`,
    yes: { label: localize("MYTHRASF.Combat.CheckLuckReroll") },
    no: { label: localize("MYTHRASF.Cancel") }
  });
  if (!confirmed) return;
  const roll = await evaluateAnimatedRoll("1d100", { manual });
  const target = Number(check.resolution.target ?? 0);
  const result = classifyContestRoll(roll.total, target);
  const skill = actor.items.get(check.resolution.abilityId);
  if (skill) await recordAbilityFumble(skill, result);
  const opposed = check.resolution.opposed;
  const resolution = { ...check.resolution, rawRoll: roll.total, serializedRoll: roll.toJSON(),
    result, winner: opposedEffectWinner({ result, rawRoll: roll.total, target }, opposed) };
  const request = { action: "combatCheck", messageId: message.id, revision: combat.revision,
    userId: game.user.id, checkId, reroll: true, resolution };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatCheck(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function requestConfirmCombatCheck(message, combat, checkId) {
  const request = { action: "combatCheck", messageId: message.id, revision: combat.revision,
    userId: game.user.id, checkId, finalize: true };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatCheck(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function requestWoundLuck(message, combat, checkId) {
  const check = (combat.effects?.checks ?? []).find((entry) => entry.id === checkId);
  const firstPending = (combat.effects?.checks ?? []).find((entry) => entry.status === "pending");
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  if (!check || check.id !== firstPending?.id || check.status !== "pending"
    || check.source !== "wound" || check.woundSeverity !== "major" || !defender
    || (combat.effects?.selections ?? []).some((effect) => effect.status === "pending")
    || (!game.user.isGM && !defender.isOwner)) return;
  if (Number(defender.system.resources?.luckPoints?.value ?? 0) < 1) {
    return ui.notifications.warn(localize("MYTHRASF.Luck.None"));
  }
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><p>${escape(localize(
      "MYTHRASF.Combat.WoundCheck.LuckConfirm"))}</p></div>`,
    yes: { label: localize("MYTHRASF.Combat.WoundCheck.Luck") },
    no: { label: localize("MYTHRASF.Cancel") }
  });
  if (!confirmed) return;
  const request = { action: "combatWoundLuck", messageId: message.id,
    revision: combat.revision, userId: game.user.id, checkId };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyWoundLuck(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function applyWoundLuck(message, request) {
  return applyMajorWoundLuck(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    warn: (text) => ui.notifications.warn(text), localize, render: renderCombatExchange });
}

async function applyCombatCheck(message, request) {
  return applyCombatCheckTransition(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    warn: (text) => ui.notifications.warn(text), localize, actorName: actorDisplayName,
    applyWoundConsequences, applyEffectConsequence: applyCombatEffectCheckConsequence,
    effectDependencies: combatEffectRuntimeDependencies, render: renderCombatExchange,
    appendRolls: appendSerializedRolls });
}

async function applyProposedDamage(message, request) {
  return applyProposedCombatDamage(message, request, { clone: foundry.utils.deepClone,
    flagScope: FLAG_SCOPE, resolveActor: combatActor, userById: (id) => game.users.get(id),
    armorPoints: (location, defender, targetType) => targetType === "weapon"
      ? Number(location.system.armorPoints ?? 0) : totalArmorPoints(location,
        defender.items.filter((item) => item.type === "armor")),
    refreshProposal: refreshDamageProposal, render: renderCombatExchange,
    evaluateRoll: evaluateAnimatedRoll, format: game.i18n.format.bind(game.i18n),
    applyWoundConsequences,
    applyAutomaticEffectChecks: (combat) => applyAutomaticCombatEffectChecks(
      combat, combatEffectRuntimeDependencies()),
    combatById: (id) => game.combats.get(id), consumePassiveBlock,
    advance: advanceCombatTurnForExchange });
}

function heldItemChoices(actor) {
  return heldCombatItemChoices(actor);
}

async function applyWoundConsequences(combat, defender, location,
  { afterEndurance = false, manual = false } = {}) {
  return applyCombatWoundConsequences(combat, defender, location, { afterEndurance, manual,
    evaluateRoll: evaluateAnimatedRoll, addStatus: addManagedStatus, applyDying, applyDeath });
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
  combatActor(combat.defender.tokenUuid, combat.defender.actorUuid).then((actor) => {
    const lacksActionPoints = Boolean(combat.turnEconomy && !combat.turnEconomy.defenseSpent
      && actor && (effectiveActionPointMaximum(actor, getActionPointRules()) < 1
        || currentActionPoints(actor) < 1));
    card.querySelectorAll("[data-combat-action='parry'],[data-combat-action='evade'],[data-combat-action='cover'],[data-combat-action='none']").forEach((button) => {
      const lacksPermission = !game.user.isGM && !actor?.isOwner;
      button.hidden = lacksPermission || (lacksActionPoints
        && ["parry", "evade"].includes(button.dataset.combatAction));
    });
    if (lacksActionPoints) {
      const noDefense = card.querySelector("[data-combat-action='none']");
      if (noDefense) {
        const label = localize("MYTHRASF.Combat.NoActionPoints");
        noDefense.textContent = label;
        noDefense.title = label;
      }
    }
  });
  const pendingEffectSide = combat.effects?.pendingSide ?? combat.effects?.winner;
  const winnerEntry = pendingEffectSide === "attacker" ? combat.attacker : combat.defender;
  combatActor(winnerEntry?.tokenUuid, winnerEntry?.actorUuid).then((actor) =>
    card.querySelectorAll("[data-combat-action='choose-effects']").forEach((button) => {
      button.hidden = !game.user.isGM && !actor?.isOwner;
    }));
  combatActor(combat.defender.tokenUuid, combat.defender.actorUuid).then((actor) =>
    card.querySelectorAll("[data-combat-action='choose-ruse-replacement']").forEach((button) => {
      button.hidden = !game.user.isGM && !actor?.isOwner;
    }));
  card.querySelectorAll("[data-combat-action='drop-held-item']").forEach(async (button) => {
    const consequence = combat.consequences?.[Number(button.dataset.consequenceIndex)];
    const entry = combatSideEntry(combat, consequence?.actorSide ?? "defender");
    const actor = await combatActor(entry?.tokenUuid, entry?.actorUuid);
    button.hidden = !game.user.isGM && !actor?.isOwner;
  });
  card.querySelectorAll("[data-gm-only]").forEach((button) => { button.hidden = !game.user.isGM; });
  const gm = card.querySelector("[data-combat-gm-actions]"); if (gm) gm.hidden = !game.user.isGM;
  card.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-combat-action]"); if (!button) return;
    const action = button.dataset.combatAction;
    const manual = event.shiftKey;
    if (["parry", "evade", "cover", "none"].includes(action)) return respondToAttack(message, combat, action, manual);
    if (action === "accidental-target") return chooseAccidentalTarget(message, combat);
    if (action === "cancel") return cancelCombat(message, combat);
    if (action === "close-exchange") return closeCombatExchange(message, combat);
    if (action === "resolve-consequence") return resolveCombatConsequence(message, combat,
      button.dataset.consequenceIndex);
    if (action === "drop-held-item") return requestDropHeldItem(message, combat,
      button.dataset.consequenceIndex, card.querySelector(
        `[data-drop-held-item="${button.dataset.consequenceIndex}"]`)?.value);
    if (action === "luck" && button.dataset.side === "damage") return requestDamageLuck(message, combat, manual);
    if (action === "luck") return spendCombatLuck(message, combat, button.dataset.side, manual);
    if (action === "choose-effects") return chooseCombatEffects(message, combat);
    if (action === "choose-ruse-replacement") return chooseCombatRuseReplacement(message, combat);
    if (action === "open-effect") {
      const effect = await fromUuid(button.dataset.effectUuid).catch(() => null);
      return effect?.sheet?.render({ force: true });
    }
    if (action === "check-help") {
      const check = (combat.effects?.checks ?? []).find((entry) => entry.id === button.dataset.checkId);
      if (check) return openCombatCheckHelp(check, combat);
    }
    if (action === "resolve-check") return requestCombatCheck(message, combat, button.dataset.checkId, manual);
    if (action === "check-luck") return requestCombatCheckLuck(message, combat, button.dataset.checkId, manual);
    if (action === "confirm-check") return requestConfirmCombatCheck(message, combat,
      button.dataset.checkId);
    if (action === "wound-luck") return requestWoundLuck(message, combat, button.dataset.checkId);
    if (action === "roll-damage") return requestCombatDamage(message, combat, manual);
    if (action === "apply-damage") return requestApplyDamage(message, combat,
      combat.damage.locationId, manual);
  });
}

export function registerCombatSocket() {
  registerCombatSocketRuntime({ socket: game.socket, messages: game.messages, users: game.users,
    currentUserId: game.user.id, coordinator: preferredCombatCoordinator,
    handlers: {
      combatDefense: applyCombatDefense, combatLuck: applyCombatLuck,
      combatEffects: applyCombatEffects, combatDamage: applyCombatDamage,
      combatRuseReplacement: applyCombatRuseReplacement,
      combatDamageLuck: applyDamageLuck, combatApplyDamage: applyProposedDamage,
      combatCheck: applyCombatCheck, combatWoundLuck: applyWoundLuck,
      combatDropHeldItem: applyDropHeldItem
    }
  });
}
