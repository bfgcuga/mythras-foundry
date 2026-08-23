import { combatAttackHits, damageModifierFormula, difficultyTarget, evasionWinner, parryReduction,
  resolveCombatExchange, resolveDamage, resolveWeaponStyle } from "./combat.js";
import { findWeaponMode, weaponModeDisplayName, weaponModes, weaponModeView } from "./weapon-modes.js";
import { resolveActorConditions, actorLoadState } from "./actor-conditions.js";
import { invertD100 } from "./skill-roll.js";
import { findHitLocation, woundLevel, woundLocationKind } from "./hit-locations.js";
import { totalArmorPoints } from "./armor.js";
import { activateDelayedTooltips } from "../ui/tooltips.js";
import { classifyContestRoll } from "./contest-rolls.js";
import { combatEffectRule, combatEffectSlotsBySide, eligibleCombatEffects, maximizeDamageFormula,
  opposedEffectWinner, selectedEffectCount, validateEffectSelections } from "./combat-effects.js";
import { currentActionPoints, effectiveActionPointMaximum } from "./action-points.js";
import { getActionPointRules } from "../settings.js";
import { applyTimedCondition, timedAttackRestriction,
  timedEffects } from "./timed-condition-runtime.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { consumePassiveBlock, coverFor, ensureEngagement, passiveBlockFor,
  relationFor, setRelationPosition, validateReachAttack } from "./engagement-runtime.js";
import { engagementId, engagementRestriction } from "./engagements.js";
import { ammunitionState, applyLongRangeDamage, canFireAmmunition, consumeAmmunition,
  isAccidentalMeleeHit, parseRangeProfile, rangedAttackProfile, reducePowerCategory
} from "./ranged-combat.js";
import { clearAim, readyAim } from "./ranged-actions.js";
import { appendSerializedRolls, evaluateAnimatedRoll } from "./dice-animation.js";
import { recordAbilityFumble } from "./skills.js";
import { actorDisplayName, actorSpeaker, tokenDisplayName } from "./document-names.js";
import { evaluatedDamageExpression } from "./combat-damage-display.js";
import { combatRollLuckAllowed } from "./combat-luck-availability.js";
import { openAttackRollDialog } from "../apps/skill-roll-dialog.js";

const FLAG_SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const SCHEMA_VERSION = 8;
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const localize = (key) => game.i18n.localize(key);
const actorIdentity = (actor) => actor?.parent?.actorId ?? actor?.token?.actorId ?? actor?.id ?? null;
const tokenUuid = (token) => token?.document?.uuid ?? token?.uuid ?? "";
const pendingAttackActors = new Set();

function combatEntryDisplayName(entry) {
  if (!entry) return "";
  const token = entry.tokenUuid && globalThis.fromUuidSync?.(entry.tokenUuid);
  if (token) return tokenDisplayName(token);
  const actor = entry.actorUuid && globalThis.fromUuidSync?.(entry.actorUuid)
    || game.actors.get(entry.actorId);
  return actorDisplayName(actor) || entry.actorName || "";
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
  if ((combat.consequences ?? []).some((entry) => entry.status === "pending")) return false;
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

function effectContext(combat, side = combat.effects?.pendingSide ?? combat.resolution?.winner) {
  return { winner: side,
    attackResult: combat.resolution?.attack?.result,
    defenseResult: combat.resolution?.defense?.result,
    weaponMode: combat.attacker.modeSnapshot,
    unarmed: combat.attacker.modeSnapshot?.key === "unarmed",
    surpriseAttack: Boolean(combat.surprise?.consumed), rangedBand: combat.ranged?.band,
    rangedTargetStationary: Boolean(combat.ranged?.targetStationary),
    rangedTargetUnaware: Boolean(combat.ranged?.targetUnaware),
    completeCover: Boolean(combat.ranged?.completeCover) };
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

async function chooseAttackSetup(actor, suggestedTarget = null, mode = null) {
  const targets = visibleTargets(actor);
  if (!targets.length) return ui.notifications.warn(localize("MYTHRASF.Combat.NoAvailableTargets"));
  const suggestedUuid = tokenUuid(suggestedTarget);
  const options = targets.map((token) => `<option value="${escape(tokenUuid(token))}" ${tokenUuid(token) === suggestedUuid ? "selected" : ""}>${escape(tokenDisplayName(token))}</option>`).join("");
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.wait({ window: { title: localize("MYTHRASF.Combat.AttackSetup") },
    content: `<div class="mythras-foundry mythras-dialog combat-attack-setup"><fieldset><legend>${escape(localize("MYTHRASF.Combat.AttackSetup"))}</legend><label><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><select name="targetTokenUuid">${options}</select></label><label><span>${escape(localize("MYTHRASF.Combat.DefenseDeclaredBefore"))}</span><input type="checkbox" class="sheet-state-box" name="predeclared"></label><label><span>${escape(localize("MYTHRASF.Combat.ContainedBlow"))}</span><input type="checkbox" class="sheet-state-box" name="containedBlow"></label><label><span>${escape(localize("MYTHRASF.Combat.ExtraordinaryDamage"))}</span><input type="text" name="extraordinaryDamage" placeholder="0"></label></fieldset>${rangedSetupFields(mode)}</div>`,
    buttons: [{ action: "attack", label: localize("MYTHRASF.Combat.Attack"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => ({ targetTokenUuid: button.form.elements.targetTokenUuid.value,
        predeclared: button.form.elements.predeclared.checked,
        containedBlow: button.form.elements.containedBlow.checked,
        extraordinaryDamage: button.form.elements.extraordinaryDamage.value.trim() || "0",
        ranged: button.form.elements.distance ? {
          distance: Number(button.form.elements.distance.value),
          wind: Number(button.form.elements.wind.value),
          concealment: Number(button.form.elements.concealment.value),
          targetMovement: Number(button.form.elements.targetMovement.value),
          meleePosition: button.form.elements.meleePosition.value,
          attackerMovement: button.form.elements.attackerMovement.value,
          unstable: button.form.elements.unstable.checked,
          attackerProne: button.form.elements.attackerProne.checked,
          targetProne: button.form.elements.targetProne.checked
          ,targetStationary: button.form.elements.targetStationary.checked,
          targetUnaware: button.form.elements.targetUnaware.checked
        } : null }) },
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
  const setup = await chooseAttackSetup(actor, target, mode);
  if (!setup) return null;
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
  const rollModifiers = [];
  if (resolution.difficulty !== "standard") rollModifiers.push({
    source: localize("MYTHRASF.SkillRoll.ActorConditions"),
    effect: localize(`MYTHRASF.Difficulty.${resolution.difficulty}`), type: "penalty"
  });
  if (resolution.familiarity && resolution.familiarity !== "similar") rollModifiers.push({
    source: localize("MYTHRASF.Combat.Familiarity"),
    effect: localize(`MYTHRASF.Familiarity.${resolution.familiarity}`), type: "penalty"
  });
  if (ranged) {
    rollModifiers.push({ source: localize("MYTHRASF.Ranged.Distance"),
      effect: `${ranged.distance} m — ${localize(`MYTHRASF.Difficulty.${ranged.difficulty}`)}`,
      type: ranged.steps < 0 ? "bonus" : "penalty" });
    if (ranged.aim) rollModifiers.push({ source: localize("MYTHRASF.Ranged.Aim"),
      effect: localize("MYTHRASF.SkillRoll.OneDifficultyStep"), type: "bonus" });
  }
  const rollAbility = { id: resolution.style?.id ?? "__combat_base__", actor,
    name: resolution.style?.name ?? (resolution.untrained
      ? localize("MYTHRASF.Combat.Untrained") : localize("MYTHRASF.Combat.BaseStyle")),
    system: { total: Number(resolution.target) || 0 } };
  const configured = await openAttackRollDialog(rollAbility, {
    imposedDifficulty: resolution.difficulty, modifiers: rollModifiers,
    title: game.i18n.format("MYTHRASF.Combat.AttackWith", { weapon: weapon.name })
  });
  if (!configured) return null;
  if (configured.targets.difficulty === "automatic") {
    ui.notifications.info(localize("MYTHRASF.RollResult.automatic")); return null;
  }
  if (configured.targets.difficulty === "impossible") {
    ui.notifications.warn(localize("MYTHRASF.RollResult.impossible")); return null;
  }
  resolution.target = configured.targets.adjustedTarget;
  resolution.difficulty = configured.targets.difficulty;
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
    ammunition = consumeAmmunition(mode);
    const modes = weaponModes(weapon).map((entry) => entry.key === mode.key ? { ...entry,
      ammoLoaded: ammunition.loaded, ammoReserve: ammunition.reserve,
      reloadProgress: ammunition.reloadProgress } : { ...entry });
    await weapon.update({ "system.modes": modes });
  }
  if (turnEconomy) {
    turnEconomy.attackSpent = true;
    await consumePassiveBlock(game.combats.get(turnEconomy.combatId), turnEconomy.combatantId,
      weapon.id, "attack");
  }
  const roll = await new Roll("1d100").evaluate();
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
        : defender.items.filter((item) => item.type === "hitLocation")).map((item) => ({
        id: item.id, name: item.name, rangeStart: item.system.rangeStart, rangeEnd: item.system.rangeEnd
      })) }, resolution: null, damage: { status: "unavailable" }, turnEconomy, ranged,
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
      modeKey: mode.key, modeName: mode.name, styleId: "", styleName: "",
      difficulty: "standard", baseTarget: attackTarget, target: attackTarget,
      damage: mode.damage, damageModifierMode: mode.damageModifierMode, weaponSize: mode.size,
      modeSnapshot: { key: mode.key, weaponType: mode.weaponType, size: mode.size,
        reach: mode.reach, impalingSize: mode.impalingSize, handsRequired: mode.handsRequired,
        effects: mode.effects }, rawRoll: attackRoll, serializedRoll: null, luckHistory: [] },
    defender: { actorUuid: defender.uuid, actorId: actorIdentity(defender), actorName: tokenDisplayName(defenderEntry.token),
      tokenUuid: defenderEntry.token?.uuid ?? "", defense, luckHistory: [], size: defender.system.size,
      locations: defender.items.filter((item) => item.type === "hitLocation").map((item) => ({
        id: item.id, name: item.name, rangeStart: item.system.rangeStart,
        rangeEnd: item.system.rangeEnd })) }, resolution,
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
  const choices = actor.items.filter((item) => item.type === "weapon" && item.system.equipped)
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
          weaponId: weapon.id, weaponName: weapon.name, modeKey: mode.key,
          modeName: weaponModeDisplayName(weapon, mode), styleId: resolved.style?.id ?? "",
          styleName: resolved.usesBase ? localize("MYTHRASF.Combat.BaseStyle") : resolved.style?.name ?? "",
          difficulty, baseTarget: resolved.target, target: difficultyTarget(resolved.target, difficulty),
          weaponSize: mode.size };
      }).filter(Boolean)));
  return [...new Map(choices.map((choice) => [choice.value, choice])).values()];
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
  const { DialogV2 } = foundry.applications.api;
  const selected = await DialogV2.wait({ window: { title: localize("MYTHRASF.Combat.ChooseParry") },
    content: `<div class="mythras-foundry mythras-dialog combat-defense-dialog"><fieldset><legend>${escape(localize("MYTHRASF.Combat.Parry"))}</legend><label><span>${escape(localize("MYTHRASF.Combat.WeaponAndStyle"))}</span><select name="choice">${choices.map((choice) => `<option value="${escape(choice.value)}">${escape(choice.modeName)} — ${escape(choice.styleName)} (${choice.target}%)</option>`).join("")}</select></label></fieldset></div>`,
    buttons: [{ action: "roll", label: localize("MYTHRASF.Roll"), icon: "fas fa-dice-d20", default: true,
      callback: (event, button) => button.form.elements.choice.value },
    { action: "cancel", label: localize("MYTHRASF.Cancel"), icon: "fas fa-times" }], rejectClose: false });
  return selected ? { type, ...choices.find((choice) => choice.value === selected) } : null;
}

export function validateCombatResponse(combat, request, { actor, user }) {
  if (!["awaitingDefense", "awaitingAccidentalDefense"].includes(combat.status)) return "state";
  if (Number(request.revision) !== Number(combat.revision)) return "revision";
  if (!user || user.id !== request.userId || (!user.isGM && !actor?.testUserPermission(user, "OWNER"))) return "ownership";
  if (!["parry", "evade", "cover", "none"].includes(request.defense?.type)) return "invalid";
  return null;
}

async function respondToAttack(message, combat, type) {
  const actor = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner)) return;
  if (type !== "none" && !resolveActorConditions(actor, { baseAttributes:
    actor.system.baseAttributes ?? actor.system.attributes ?? {} }).capabilities.canDefend) {
    return ui.notifications.warn(localize("MYTHRASF.Status.CannotDefend"));
  }
  const defense = await defenseConfiguration(actor, type, combat);
  if (!defense) return;
  if (["parry", "evade"].includes(type)) await clearAim(actor);
  const roll = ["none", "cover"].includes(type) ? null : await new Roll("1d100").evaluate();
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
  combat.ranged.originalDefender = { ...combat.defender };
  combat.ranged.accidentalTarget = { tokenUuid: selected, actorUuid: actor.uuid,
    actorName: tokenDisplayName(token), selectedBy: game.user.id, selectedAt: Date.now() };
  combat.defender = { actorUuid: actor.uuid, actorId: actorIdentity(actor), actorName: tokenDisplayName(token),
    tokenUuid: selected, defense: null, luckHistory: [], size: actor.system.size,
    targetType: "actor", targetWeaponId: "", locations: actor.items
      .filter((item) => item.type === "hitLocation").map((item) => ({ id: item.id,
        name: item.name, rangeStart: item.system.rangeStart, rangeEnd: item.system.rangeEnd })) };
  if (combat.turnEconomy) combat.turnEconomy.defenderCombatantId = entry.id;
  combat.attacker.target = combat.ranged.normalTarget;
  combat.attacker.difficulty = "standard";
  combat.attackClassification = resolveCombatExchange({ attack: { target: combat.attacker.target,
    rawRoll: combat.attacker.rawRoll }, defense: { type: "none" } }).attack;
  combat.status = "awaitingAccidentalDefense"; combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
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
  if (!combat.surprise?.eligible || combat.surprise.consumed) return 0;
  const effect = defender.effects.get(combat.surprise.effectId);
  const condition = effect?.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
  if (!effect || condition?.bonusConsumed) return 0;
  await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: {
    ...condition, bonusConsumed: true } });
  combat.surprise.consumed = true;
  return 1;
}

async function applyCombatDefense(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  const actor = await combatActor(combat?.defender?.tokenUuid, combat?.defender?.actorUuid);
  const invalid = combat && validateCombatResponse(combat, request, { actor, user: game.users.get(request.userId) });
  if (!combat || invalid) return ui.notifications.warn(localize(`MYTHRASF.Combat.Rejected.${invalid ?? "state"}`));
  if (!["none", "cover"].includes(request.defense.type) && combat.turnEconomy && !combat.turnEconomy.defenseSpent) {
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
  if (request.defense.type === "parry" && combat.turnEconomy) {
    await consumePassiveBlock(game.combats.get(combat.turnEconomy.combatId),
      combat.turnEconomy.defenderCombatantId, request.defense.weaponId, "parry");
  }
  combat.defender.defense = request.defense;
  if (request.defense.type === "evade" && !actor.statuses?.has?.("prone")) {
    await applyTimedCondition(actor, { key: "prone", statusId: "prone",
      name: localize("MYTHRASF.Status.Prone"), img: "icons/svg/falling.svg",
      source: { messageUuid: message.uuid, sourceName: combat.attacker.actorName,
        sourceActorUuid: combat.attacker.actorUuid, sourceTokenUuid: combat.attacker.tokenUuid },
      combat: combat.turnEconomy ? game.combats.get(combat.turnEconomy.combatId) : null,
      duration: { unit: "manual", phase: "manual" } });
  }
  combat.resolution = resolveCombatExchange({ predeclared: combat.predeclared,
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll }, defense: request.defense });
  await recordCombatResolutionFumbles(combat);
  const surpriseSlots = await consumeSurpriseBonus(actor, combat);
  const sideSlots = combatEffectSlotsBySide({ winner: combat.resolution.winner,
    differential: combat.resolution.effects, surprise: surpriseSlots });
  combat.effects = { winner: combat.resolution.winner,
    slots: sideSlots.attacker + sideSlots.defender, sideSlots,
    surpriseSlots,
    selections: [], confirmed: combat.resolution.effects === 0, checks: [] };
  const totalSlots = combat.effects.sideSlots.attacker + combat.effects.sideSlots.defender;
  combat.effects.pendingSide = combat.effects.sideSlots.attacker ? "attacker"
    : combat.effects.sideSlots.defender ? "defender" : null;
  combat.effects.confirmed = totalSlots === 0;
  combat.status = totalSlots > 0 ? "awaitingEffects" : "resolved";
  combat.damage = { status: totalSlots > 0 ? "blocked"
    : combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat),
    rolls: appendSerializedRolls(message, request.defense.serializedRoll),
    [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

async function chooseCombatEffects(message, combat) {
  const side = combat.effects?.pendingSide ?? combat.effects?.winner;
  const winnerEntry = side === "attacker" ? combat.attacker : combat.defender;
  const actor = await combatActor(winnerEntry?.tokenUuid, winnerEntry?.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner) || combat.status !== "awaitingEffects") return;
  const catalog = (await combatEffectDocuments()).map(effectView);
  const eligible = eligibleCombatEffects(catalog, effectContext(combat, side));
  const options = [`<option value="__waive__">${escape(localize("MYTHRASF.CombatEffect.Waive"))}</option>`,
    ...eligible.map((effect) => `<option value="${escape(effect.key)}" ${effect.ruleKey === "chooseLocation" ? "data-location-choice" : ""}>${escape(effect.name)}</option>`)]
    .join("");
  const locationOptions = (combat.defender.locations ?? []).map((location) =>
    `<option value="${escape(location.id)}">${escape(location.name)}</option>`).join("");
  const slots = combat.effects.sideSlots?.[side] ?? combat.effects.slots;
  const rows = Array.from({ length: slots }, (_, index) =>
    `<fieldset><legend>${escape(game.i18n.format("MYTHRASF.CombatEffect.Slot", { slot: index + 1 }))}</legend><select name="effect-${index}">${options}</select><label class="combat-effect-location"><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select name="location-${index}"><option value=""></option>${locationOptions}</select></label><label><span>${escape(localize("MYTHRASF.CombatEffect.Parameters"))}</span><textarea name="note-${index}"></textarea></label></fieldset>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.CombatEffect.Select") },
    content: `<div class="mythras-foundry mythras-dialog combat-effect-dialog">${rows}</div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.Confirm"),
      icon: "fas fa-check", default: true, callback: (event, button) =>
        Array.from({ length: slots }, (_, index) => ({
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
    userId: game.user.id, side, selections };
  if (preferredCombatCoordinator(game.users, combat.authorUserId) === game.user.id) {
    await applyCombatEffects(message, request);
  } else game.socket.emit(SOCKET, request);
}

async function applyCombatEffects(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || combat.status !== "awaitingEffects"
    || Number(request.revision) !== Number(combat.revision)) return;
  const side = combat.effects.pendingSide ?? combat.effects.winner;
  if (request.side !== side) return;
  const winnerEntry = side === "attacker" ? combat.attacker : combat.defender;
  const actor = await combatActor(winnerEntry.tokenUuid, winnerEntry.actorUuid);
  const user = game.users.get(request.userId);
  if (!actor || !user || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  const catalog = (await combatEffectDocuments()).map(effectView);
  const slots = combat.effects.sideSlots?.[side] ?? combat.effects.slots;
  const validation = validateEffectSelections({ slots,
    selections: request.selections, effects: catalog, context: effectContext(combat, side) });
  if (!validation.valid) return ui.notifications.warn(localize("MYTHRASF.CombatEffect.Invalid"));
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
    await applyImmediateEffectConsequences(combat, message);
    combat.status = "resolved";
    combat.damage = { status: combatAttackHits(combat.resolution) ? "ready" : "unavailable" };
  }
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

function sideEntry(combat, side) { return side === "attacker" ? combat.attacker : combat.defender; }

function affectedSideForEffect(effect) {
  if (effect.target === "self") return effect.side;
  return effect.side === "attacker" ? "defender" : "attacker";
}

async function addManagedStatus(combat, effect, { key, statusId, turns = null,
  unit = "actorTurn", phase = "endActorTurn", locationId = "", capabilities = {},
  metadata = {} } = {}) {
  const affectedSide = affectedSideForEffect(effect);
  const affectedEntry = sideEntry(combat, affectedSide);
  const sourceEntry = sideEntry(combat, effect.side);
  const actor = await combatActor(affectedEntry.tokenUuid, affectedEntry.actorUuid);
  const tracker = combat.turnEconomy ? game.combats.get(combat.turnEconomy.combatId) : null;
  if (!actor) return false;
  await applyTimedCondition(actor, { key, statusId, name: localize(`MYTHRASF.Status.${
    statusId[0].toUpperCase()}${statusId.slice(1)}`), img: "icons/svg/daze.svg",
    source: { messageUuid: combat.messageUuid ?? "", name: sourceEntry.actorName,
      actorUuid: sourceEntry.actorUuid,
      tokenUuid: sourceEntry.tokenUuid },
    combat: tracker ? { uuid: tracker.uuid, round: tracker.round,
      cycle: tracker.mythrasTurnEconomy?.cycle, turn: tracker.turn } : null,
    duration: { unit, phase, value: turns,
      skipCurrentTurn: unit === "actorTurn" && tracker?.combatant?.actor?.uuid === actor.uuid },
    locationId, capabilities, metadata });
  return true;
}

async function applyImmediateEffectConsequences(combat, message) {
  combat.messageUuid = message.uuid;
  const selections = combat.effects.selections.filter((effect) => !effect.waived);
  for (const effect of selections) {
    if (effect.key === "aprovechar-la-ventaja") {
      await addManagedStatus(combat, effect, { key: "pressed", statusId: "pressed", turns: 1 });
      effect.status = "resolved";
    }
    if (effect.key === "muerte-silenciosa") {
      await addManagedStatus(combat, effect, { key: "silenced", statusId: "silenced",
        unit: "round", phase: "endRound" }); effect.status = "resolved";
    }
    if (["abrir-distancia", "cerrar-distancia", "retirada"].includes(effect.key)
      && combat.turnEconomy) {
      const tracker = game.combats.get(combat.turnEconomy.combatId);
      const relationId = engagementId(combat.turnEconomy.combatantId,
        combat.turnEconomy.defenderCombatantId);
      await setRelationPosition(tracker, relationId,
        effect.key === "cerrar-distancia" ? "shorter" : effect.key === "abrir-distancia"
          ? "longer" : "neutral", { reason: `effect:${effect.key}`,
          status: effect.key === "retirada" ? "disengaged" : "engaged" });
      effect.status = "resolved";
    }
  }
  const offBalance = selections.filter((effect) => effect.key === "desequilibrar-oponente");
  if (offBalance.length) {
    await addManagedStatus(combat, offBalance[0], { key: "offBalance",
      statusId: "offBalance", turns: offBalance.length });
    offBalance.forEach((effect) => { effect.status = "resolved"; });
  }
  for (const effect of selections.filter((entry) => ["cegar-oponente",
    "disparo-de-supresion"].includes(entry.key))) {
    const actorSide = affectedSideForEffect(effect);
    combat.effects.checks.push({ id: `effect-${effect.side}-${effect.slot}`,
      source: "effect", order: combat.effects.checks.length, effectKey: effect.key,
      effectSide: effect.side, effectSlot: effect.slot, actorSide,
      abilitySlugs: effect.key === "cegar-oponente" ? ["evadir"] : ["voluntad"],
      opposedSide: effect.side, label: effect.name, status: "pending" });
    effect.status = "pending";
  }
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

async function resolveCombatConsequence(message, current, index) {
  if (!game.user.isGM) return;
  const combat = foundry.utils.deepClone(current);
  const consequence = combat.consequences?.[Number(index)];
  if (!consequence || consequence.status !== "pending") return;
  const note = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("MYTHRASF.CombatEffect.ResolveManual") },
    content: `<div class="mythras-foundry mythras-dialog"><textarea name="note" required></textarea></div>`,
    buttons: [{ action: "confirm", label: localize("MYTHRASF.CombatEffect.ResolveManual"),
      callback: (event, button) => button.form.elements.note.value.trim() }], rejectClose: false });
  if (!note) return;
  Object.assign(consequence, { status: "resolved", note, userId: game.user.id,
    resolvedAt: Date.now() });
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat),
    [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

async function spendCombatLuck(message, current, side) {
  if (!combatRollLuckAllowed(current)) return;
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
  const roll = choice === "reroll" ? await new Roll("1d100").evaluate() : null;
  const rawRoll = roll?.total ?? invertD100(currentRoll);
  await actor.update({ "system.resources.luckPoints.value": Number(actor.system.resources.luckPoints.value) - 1 });
  const request = { action: "combatLuck", messageId: message.id, revision: current.revision,
    userId: game.user.id, side, rawRoll, serializedRoll: roll?.toJSON?.() ?? null,
    luckAlreadySpent: true };
  if (preferredCombatCoordinator(game.users, current.authorUserId) === game.user.id) await applyCombatLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyCombatLuck(message, request) {
  const combat = foundry.utils.deepClone(message.getFlag(FLAG_SCOPE, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)
    || !combatRollLuckAllowed(combat)
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
  const ability = request.side === "attacker" ? actor.items.get(entry.styleId)
    : actor.items.get(entry.defense.abilityId ?? entry.defense.styleId);
  const target = request.side === "attacker" ? entry.target : entry.defense.target;
  await recordAbilityFumble(ability, classifyContestRoll(request.rawRoll, target));
  if (request.side === "attacker" && combat.surprise && !combat.surprise.consumed) {
    const result = classifyContestRoll(entry.rawRoll, entry.target);
    combat.surprise.eligible = ["success", "critical"].includes(result);
    if (combat.status === "awaitingEffects" && combat.surprise.eligible) {
      const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
      if (defender) combat.effects.surpriseSlots += await consumeSurpriseBonus(defender, combat);
    }
  }
  if (["resolved", "awaitingEffects"].includes(combat.status)) combat.resolution = resolveCombatExchange({ predeclared: combat.predeclared,
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll }, defense: combat.defender.defense });
  else if (!combat.predeclared) combat.attackClassification = resolveCombatExchange({
    attack: { target: combat.attacker.target, rawRoll: combat.attacker.rawRoll }, defense: { type: "none" } }).attack;
  await recordCombatResolutionFumbles(combat);
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
  await message.update({ content: renderCombatExchange(combat),
    rolls: appendSerializedRolls(message, request.serializedRoll),
    [`flags.${FLAG_SCOPE}.combat`]: combat });
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
  const weaponDamage = maximizeDamageFormula(combat.attacker.damage || mode.damage || "0", maximizeCount);
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
  let chosenLocation = combat.defender.targetType === "weapon" ? combat.defender.targetWeaponId
    : (combat.effects?.selections ?? []).find((entry) =>
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
    userId: game.user.id, formula, weaponFormula: weaponDamage, modifierFormula: modifier,
    extraordinaryFormula: extraordinary, resultExpression: roll.result,
    rollExpression: evaluatedDamageExpression(roll, [weaponDamage, modifier, extraordinary]),
    rawRoll: roll.total, serializedRoll: roll.toJSON(),
    alternateRoll: alternateRoll ? { rawRoll: alternateRoll.total,
      serializedRoll: alternateRoll.toJSON() } : null,
    locationRoll: locationRoll?.total ?? null, serializedLocationRoll: locationRoll?.toJSON?.() ?? null, rolledLocationId,
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
  combat.damage = { status: "rolled", formula: request.formula,
    weaponFormula: request.weaponFormula, modifierFormula: request.modifierFormula,
    extraordinaryFormula: request.extraordinaryFormula, resultExpression: request.resultExpression,
    rollExpression: request.rollExpression,
    rawRoll: Number(request.rawRoll),
    serializedRoll: request.serializedRoll, alternateRoll: request.alternateRoll,
    luckHistory: [], locationRoll: request.locationRoll == null ? null : Number(request.locationRoll),
    rolledLocationId: request.rolledLocationId ?? "",
    locationId: location?.id ?? "" };
  combat.revision += 1;
  await refreshDamageProposal(combat);
  await message.update({ content: renderCombatExchange(combat),
    rolls: appendSerializedRolls(message, request.serializedRoll,
      request.alternateRoll?.serializedRoll, request.serializedLocationRoll),
    [`flags.${FLAG_SCOPE}.combat`]: combat });
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
    userId: game.user.id, rawRoll: roll.total, resultExpression: roll.result,
    rollExpression: evaluatedDamageExpression(roll, [combat.damage.weaponFormula,
      combat.damage.modifierFormula, combat.damage.extraordinaryFormula]),
    serializedRoll: roll.toJSON() };
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
  combat.damage.resultExpression = request.resultExpression;
  combat.damage.rollExpression = request.rollExpression;
  combat.damage.serializedRoll = request.serializedRoll;
  combat.effects.checks = [];
  for (const effect of combat.effects.selections ?? []) {
    if (effect.requiresWound) effect.status = "conditional";
  }
  await refreshDamageProposal(combat);
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat),
    rolls: appendSerializedRolls(message, request.serializedRoll),
    [`flags.${FLAG_SCOPE}.combat`]: combat });
}

async function refreshDamageProposal(combat, requestedLocationId = null) {
  const defender = await combatActor(combat.defender.tokenUuid, combat.defender.actorUuid);
  const locationId = requestedLocationId ?? combat.damage.locationId;
  const location = defender?.items.get(locationId);
  const weaponTarget = combat.defender.targetType === "weapon";
  if (!defender || !location || (!weaponTarget && location.type !== "hitLocation")
    || (weaponTarget && location.type !== "weapon")) {
    combat.damage.status = "stale";
    return;
  }
  const armor = weaponTarget ? Number(location.system.armorPoints ?? 0) : totalArmorPoints(location,
    defender.items.filter((item) => item.type === "armor"));
  const defense = combat.defender.defense;
  let parry = defense?.type === "parry" && ["success", "critical"].includes(combat.resolution.defense.result)
    ? parryReduction(combat.attacker.weaponSize, defense.weaponSize) : { type: "none" };
  const tracker = combat.turnEconomy ? game.combats.get(combat.turnEconomy.combatId) : null;
  const passive = !weaponTarget && tracker ? passiveBlockFor(tracker,
    combat.turnEconomy.defenderCombatantId, location.id) : null;
  if (passive) {
    parry = parryReduction(combat.attacker.weaponSize, passive.weaponSize);
    combat.damage.passiveBlock = { weaponId: passive.weaponId, weaponName: passive.weaponName,
      weaponSize: passive.weaponSize, locationId: location.id };
  } else delete combat.damage.passiveBlock;
  if (selectedEffectCount(combat.effects?.selections ?? [], "improveParry")) parry = { type: "full" };
  if (selectedEffectCount(combat.effects?.selections ?? [], "bypassParry")) parry = { type: "none" };
  const effectiveArmor = selectedEffectCount(combat.effects?.selections ?? [], "bypassArmor") ? 0 : armor;
  const rangeAdjustedDamage = applyLongRangeDamage(combat.damage.rawRoll, combat.ranged?.band);
  const cover = !weaponTarget && defense?.type === "cover" && tracker ? coverFor(tracker,
    combat.turnEconomy.defenderCombatantId, location.id) : null;
  const coverProtection = Math.max(0, Number(cover?.protection ?? 0));
  const calculation = resolveDamage({ rolledDamage: rangeAdjustedDamage,
    containedBlow: combat.declarations?.containedBlow, parry, coverPoints: coverProtection,
    armorPoints: effectiveArmor,
    targetSize: defender.system.size });
  calculation.beforeRange = Number(combat.damage.rawRoll);
  calculation.afterRange = rangeAdjustedDamage;
  calculation.cover = cover ? { source: cover.source, protection: coverProtection,
    absorbed: Math.min(coverProtection, calculation.afterParry) } : null;
  const before = Number(location.system.currentHitPoints ?? 0);
  const after = before - calculation.penetratingDamage;
  if (!selectedEffectCount(combat.effects?.selections ?? [], "bash")) {
    calculation.push = { triggered: false, excess: 0, distance: 0 };
  }
  const resulting = weaponTarget ? "healthy" : woundLevel(after, location.system.maxHitPoints);
  const previousChecks = new Map((combat.effects?.checks ?? []).map((check) => [check.id, check]));
  const checks = [];
  (weaponTarget ? [] : combat.effects?.selections ?? []).forEach((effect, order) => {
    if (effect.requiresWound) effect.status = calculation.penetratingDamage > 0
      ? effect.status === "resolved" ? "resolved" : "pending" : "notActivated";
    const checkId = `effect-${effect.side ?? combat.effects.winner}-${effect.slot}`;
    if (effect.endurance && calculation.penetratingDamage > 0) checks.push({
      id: checkId, source: "effect", order, effectKey: effect.key,
      effectSide: effect.side ?? combat.effects.winner, effectSlot: effect.slot,
      actorSide: "defender", abilitySlugs: ["aguante"], opposedSide: "attacker",
      label: effect.name, status: previousChecks.get(checkId)?.status ?? "pending",
      resolution: previousChecks.get(checkId)?.resolution
    });
  });
  if (!weaponTarget && ["serious", "major"].includes(resulting)) checks.push({ id: `wound-${location.id}`,
    source: "wound", order: checks.length, label: resulting,
    actorSide: "defender", abilitySlugs: ["aguante"], opposedSide: "attacker",
    status: previousChecks.get(`wound-${location.id}`)?.status ?? "pending",
    resolution: previousChecks.get(`wound-${location.id}`)?.resolution });
  combat.effects.checks = checks;
  Object.assign(combat.damage, calculation, { status: "proposed", locationId: location.id,
    locationName: location.name, armorSnapshot: armor, beforeHitPoints: before,
    maxHitPoints: Number(location.system.maxHitPoints ?? 1), afterHitPoints: after,
    previousWound: weaponTarget ? "healthy" : woundLevel(before, location.system.maxHitPoints),
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
  const actorEntry = sideEntry(combat, check.actorSide ?? "defender");
  const defender = await combatActor(actorEntry.tokenUuid, actorEntry.actorUuid);
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
    const silentDeath = check.source === "wound" && timedEffects(defender).some((effect) =>
      effect.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG)?.key === "silenced");
    if (silentDeath) {
      resolution = { manual: false, automaticFailure: true, result: "failure",
        winner: "right", opposed: { rawRoll: combat.resolution.attack.rawRoll,
          target: combat.resolution.attack.target, result: combat.resolution.attack.result } };
    } else {
    const skill = defender.items.find((item) => item.type === "skill"
      && (check.abilitySlugs ?? ["aguante"]).includes(item.system.slug));
    if (!skill) return ui.notifications.warn(localize("MYTHRASF.Combat.SourceMissing"));
    const roll = await evaluateAnimatedRoll("1d100", { speaker: ChatMessage.getSpeaker({ actor: defender }) });
    const target = Number(skill.system.total ?? 0);
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
  const selfSide = effect.side ?? combat.effects.winner;
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
  const selfSide = effect.side ?? combat.effects.winner;
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
  const pendingCheck = combat?.effects?.checks?.find((entry) => entry.id === request.checkId);
  const actorEntry = pendingCheck ? sideEntry(combat, pendingCheck.actorSide ?? "defender") : null;
  const defender = actorEntry ? await combatActor(actorEntry.tokenUuid, actorEntry.actorUuid) : null;
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
  await applyCheckConsequence(combat, check, defender);
  combat.revision += 1;
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
}

async function applyCheckConsequence(combat, check, actor) {
  if (check.resolution?.manual || !actor) return;
  const resisted = check.resolution?.winner === "left";
  const effect = (combat.effects?.selections ?? []).find((entry) =>
    entry.key === check.effectKey && Number(entry.slot) === Number(check.effectSlot ?? entry.slot)
    && (!check.effectSide || entry.side === check.effectSide));
  if (!effect) return;
  effect.resolution = { checkId: check.id, resisted, resolvedAt: Date.now() };
  effect.status = "resolved";
  if (resisted) return;
  if (effect.key === "cegar-oponente") {
    const duration = await evaluateAnimatedRoll("1d3",
      { speaker: ChatMessage.getSpeaker({ actor }) });
    await addManagedStatus(combat, effect, { key: "blinded", statusId: "blinded",
      turns: duration.total });
  }
  if (effect.key === "disparo-de-supresion") {
    const sourceActorUuid = sideEntry(combat, effect.side).actorUuid;
    const existing = timedEffects(actor).find((candidate) => {
      const condition = candidate.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
      return condition?.key === "suppressed" && condition.sourceActorUuid === sourceActorUuid;
    });
    if (existing) {
      const condition = existing.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
      await existing.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: {
        ...condition, original: Number(condition.original ?? 1) + 1,
        remaining: Number(condition.remaining ?? 1) + 1 } });
    } else await addManagedStatus(combat, effect, { key: "suppressed",
      statusId: "suppressed", turns: 1 });
  }
  if (effect.key === "desangrar") {
    await addManagedStatus(combat, effect, { key: "exsanguinating",
      statusId: "exsanguinating", unit: "manual" });
  }
  if (effect.key === "tumbar-oponente") {
    await addManagedStatus(combat, effect, { key: "incapacitated",
      statusId: "incapacitated", unit: "manual" });
  }
  if (effect.key === "aturdir-localizacion") {
    const location = actor.items.get(combat.damage.locationId);
    const turns = Math.max(1, Number(combat.damage.penetratingDamage ?? 1));
    const category = location?.system.category ?? location?.system.hpClass;
    const statusId = category === "head" ? "unconscious"
      : ["chest", "abdomen", "torso"].includes(category) ? "stunnedTorso" : "stunnedLocation";
    await addManagedStatus(combat, effect, { key: statusId, statusId, turns,
      locationId: location?.id ?? "" });
  }
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
  const currentArmor = selectedLocation ? combat.defender.targetType === "weapon"
    ? Number(selectedLocation.system.armorPoints ?? 0) : totalArmorPoints(selectedLocation,
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
  if (combat.defender.targetType !== "weapon") await applyWoundConsequences(combat, defender, location);
  combat.damage.appliedBy = user.id;
  combat.damage.appliedAt = Date.now();
  await message.update({ content: renderCombatExchange(combat), [`flags.${FLAG_SCOPE}.combat`]: combat });
  await advanceCombatTurnForExchange(message, combat);
}

async function applyWoundConsequences(combat, defender, location) {
  const wound = combat.damage.resultingWound;
  if (!['serious', 'major'].includes(wound)) return;
  const pseudoEffect = { side: "attacker", target: "opponent", slot: -1,
    key: `wound-${wound}` };
  const { extremity, leg } = woundLocationKind(location);
  const check = (combat.effects?.checks ?? []).find((entry) => entry.source === "wound"
    && entry.id === `wound-${location.id}`);
  const failed = check?.resolution?.manual ? null : check?.resolution?.winner !== "left";
  if (failed == null) combat.consequences = [...(combat.consequences ?? []), {
    key: "manualWoundOutcome", status: "pending", locationId: location.id,
    requiresConfirmation: true }];
  if (wound === "serious") {
    const duration = await evaluateAnimatedRoll("1d3",
      { speaker: ChatMessage.getSpeaker({ actor: defender }) });
    await addManagedStatus(combat, pseudoEffect, { key: "seriousWound",
      statusId: "seriousWound", turns: duration.total, locationId: location.id });
    if (failed && extremity) {
      await addManagedStatus(combat, pseudoEffect, { key: "stunnedLocation",
        statusId: "stunnedLocation", unit: "manual", locationId: location.id,
        metadata: { untilPositiveHitPoints: true } });
      if (leg) await addManagedStatus(combat, pseudoEffect, { key: "prone",
        statusId: "prone", unit: "manual", locationId: location.id });
      else combat.consequences = [...(combat.consequences ?? []), { key: "dropHeldItem",
        status: "pending", locationId: location.id, requiresConfirmation: true }];
    }
    if (failed && !extremity) await addManagedStatus(combat, pseudoEffect, {
      key: "unconscious", statusId: "unconscious", unit: "manual", locationId: location.id,
      metadata: { durationNote: `${Math.max(1, Number(combat.damage.penetratingDamage))} minutes` } });
  }
  if (wound === "major") {
    if (extremity) {
      await addManagedStatus(combat, pseudoEffect, { key: "prone", statusId: "prone",
        unit: "manual", locationId: location.id });
      combat.consequences = [...(combat.consequences ?? []), { key: "destroyedExtremity",
        status: "pending", locationId: location.id, requiresConfirmation: true },
      { key: "treatmentDeadline", status: "pending", requiresConfirmation: true,
        note: "healingRate × 5 minutes" }];
      if (failed) await addManagedStatus(combat, pseudoEffect, { key: "unconscious",
        statusId: "unconscious", unit: "manual", locationId: location.id });
    } else {
      await addManagedStatus(combat, pseudoEffect, { key: "unconscious",
        statusId: "unconscious", unit: "manual", locationId: location.id });
      if (failed != null) combat.consequences = [...(combat.consequences ?? []), {
        key: failed ? "immediateDeath" : "treatmentDeadline", status: "pending",
        requiresConfirmation: true, note: failed ? "" : "2 × healingRate rounds" }];
    }
  }
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
  const defenseActions = ["awaitingDefense", "awaitingAccidentalDefense"].includes(combat.status) ? `<div class="combat-defense-actions"><button type="button" data-combat-action="parry" title="${escape(localize("MYTHRASF.Combat.Parry"))}">${escape(localize("MYTHRASF.Combat.Parry"))}</button><button type="button" data-combat-action="evade" title="${escape(localize("MYTHRASF.Combat.Evade"))}">${escape(localize("MYTHRASF.Combat.Evade"))}</button>${combat.ranged ? `<button type="button" data-combat-action="cover" title="${escape(localize("MYTHRASF.Ranged.Cover"))}">${escape(localize("MYTHRASF.Ranged.Cover"))}</button>` : ""}<button type="button" data-combat-action="none" title="${escape(localize("MYTHRASF.Combat.NoDefense"))}">${escape(localize("MYTHRASF.Combat.NoDefense"))}</button></div>` : "";
  const evadeWinner = resolved?.defense?.type === "evade" ? evasionWinner(resolved) : undefined;
  const outcome = resolved ? `<div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Combat.Advantage"))}</span><strong>${resolved.advantage > 0 ? "+" : ""}${resolved.advantage}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Effects"))}</span><strong>${resolved.effects} — ${escape(resolved.winner ? localize(`MYTHRASF.Combat.Winner.${resolved.winner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>${evadeWinner !== undefined ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.EvasionOutcome"))}</span><strong>${escape(evadeWinner ? localize(`MYTHRASF.Combat.Winner.${evadeWinner}`) : localize("MYTHRASF.Combat.NoWinner"))}</strong></div>` : ""}` : "";
  const penalty = resolved?.sharedPenalty ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.Over100Penalty"))}</span><strong class="skill-roll-modifier-effect--penalty">−${resolved.sharedPenalty}</strong></div>` : "";
  const luck = (side) => `<button type="button" class="sheet-icon-button mythras-chat-luck-button" data-combat-action="luck" data-side="${side}" title="${escape(localize("MYTHRASF.Luck.Use"))}" aria-label="${escape(localize("MYTHRASF.Luck.Use"))}"><i class="fas fa-clover" aria-hidden="true"></i></button>`;
  const rollLuckAllowed = combatRollLuckAllowed(combat);
  const locationOptions = damageLocationChoices(combat).map((location) => `<option value="${escape(location.id)}" ${location.id === combat.damage?.locationId ? "selected" : ""}>${escape(location.name)}</option>`).join("");
  let damageHtml = "";
  const guidedBeforeDamage = (combat.effects?.selections ?? []).some((effect) =>
    effect.status === "pending" && !effect.requiresWound);
  if (combat.damage?.status === "ready" && !guidedBeforeDamage) damageHtml = `<button type="button" data-combat-action="roll-damage" title="${escape(localize("MYTHRASF.Combat.RollDamage"))}">${escape(localize("MYTHRASF.Combat.RollDamage"))}</button>`;
  if (["rolled", "proposed", "stale", "applying", "applied"].includes(combat.damage?.status)) {
    const damage = combat.damage;
    const extraordinary = damage.extraordinaryFormula && damage.extraordinaryFormula !== "0"
      ? ` + ${escape(localize("MYTHRASF.Combat.DamageExtraordinary"))} (${escape(damage.extraordinaryFormula)})` : "";
    damageHtml = `<fieldset class="combat-damage-panel"><legend>${escape(localize("MYTHRASF.Chat.Damage"))}</legend><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageBreakdown"))}</span><strong>${escape(localize("MYTHRASF.Combat.DamageWeapon"))} (${escape(damage.weaponFormula ?? "0")}) + ${escape(localize("MYTHRASF.Combat.DamageBonus"))} (${escape(damage.modifierFormula ?? "0")})${extraordinary}</strong>${["proposed", "stale"].includes(damage.status) ? luck("damage") : ""}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DamageDice"))}</span><strong>${escape(damage.rollExpression ?? damage.resultExpression ?? damage.rawRoll)}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.Result"))}</span><strong>${damage.rawRoll}</strong></div>${damage.locationRoll != null ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.LocationRoll"))} (1d20)</span><strong class="mythras-chat-roll-value">${damage.locationRoll}</strong></div>` : ""}<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span><strong>${damage.afterContainedBlow ?? "—"}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span><strong>${escape(localize(`MYTHRASF.Combat.ParryType.${damage.parryType ?? "none"}`))}: ${damage.afterParry ?? "—"}</strong></div><label><span>${escape(localize("MYTHRASF.Combat.HitLocation"))}</span><select data-damage-location ${damage.status === "applied" ? "disabled" : ""}>${locationOptions}</select></label><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span><strong>${damage.armorPoints ?? "—"}</strong></div><div class="mythras-chat-total"><span>${escape(localize("MYTHRASF.Chat.PenetratingDamage"))}</span><strong>${damage.penetratingDamage ?? "—"}</strong></div>${damage.push?.triggered ? `<div class="combat-card-warning">${escape(game.i18n.format("MYTHRASF.Combat.PushSummary", { distance: damage.push.distance, excess: damage.push.excess }))}</div>` : ""}${damage.status === "stale" ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Combat.DamageStale"))}</p>` : ""}${damage.status === "applied" ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AppliedHitPoints"))}</span><strong>${damage.beforeHitPoints} → ${damage.afterHitPoints}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(localize(`MYTHRASF.Wound.${damage.resultingWound}`))}</strong></div>${["serious", "major"].includes(damage.resultingWound) ? `<p class="combat-card-warning">${escape(localize(`MYTHRASF.Combat.WoundWarning.${damage.resultingWound}`))}</p>` : ""}` : `<button type="button" data-combat-action="apply-damage" title="${escape(localize("MYTHRASF.Combat.ApplyDamage"))}">${escape(localize("MYTHRASF.Combat.ApplyDamage"))}</button>`}</fieldset>`;
    if (damage.passiveBlock) damageHtml = damageHtml.replace(
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span>`,
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Status.PassiveBlock"))}</span><strong>${escape(damage.passiveBlock.weaponName)} (${escape(damage.passiveBlock.weaponSize)})</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ParryReduction"))}</span>`);
    if (combat.ranged?.band === "long") damageHtml = damageHtml.replace(
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span>`,
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.LongRangeDamage"))}</span><strong>${damage.beforeRange} → ${damage.afterRange}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.AfterContainedBlow"))}</span>`);
    if (damage.cover) damageHtml = damageHtml.replace(
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span>`,
      `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Cover"))}</span><strong>${escape(damage.cover.source)}: −${damage.cover.absorbed}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Armor"))}</span>`);
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
  const consequencesHtml = (combat.consequences ?? []).length ? `<fieldset><legend>${escape(localize("MYTHRASF.Combat.Consequences"))}</legend>${combat.consequences.map((entry, index) => `<div class="mythras-chat-row"><span>${escape(localize(`MYTHRASF.Combat.Consequence.${entry.key}`))}</span><strong>${escape(entry.status)}</strong>${entry.status === "pending" ? `<button type="button" data-combat-action="resolve-consequence" data-consequence-index="${index}" data-gm-only>${escape(localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : ""}</div>`).join("")}</fieldset>` : "";
  const tracker = combat.turnEconomy ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Tracker.Position"))}</span><strong>${escape(game.i18n.format("MYTHRASF.Tracker.RoundCycle", { round: combat.turnEconomy.round, cycle: combat.turnEconomy.cycle }))}</strong></div>` : "";
  const close = combat.turnEconomy && !combat.turnEconomy.turnAdvanced
    ? `<button type="button" data-combat-action="close-exchange" data-gm-only title="${escape(localize("MYTHRASF.Tracker.CloseExchange"))}">${escape(localize("MYTHRASF.Tracker.CloseExchange"))}</button>` : "";
  const rangedHtml = combat.ranged ? `<fieldset><legend>${escape(localize("MYTHRASF.Ranged.Attack"))}</legend><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Distance"))}</span><strong>${combat.ranged.distance} m</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.BandLabel"))}</span><strong>${escape(localize(`MYTHRASF.Ranged.Band.${combat.ranged.band}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Difficulty"))}</span><strong>${escape(localize(`MYTHRASF.Difficulty.${combat.ranged.difficulty}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Power"))}</span><strong>${escape(combat.ranged.power)} → ${escape(combat.ranged.effectivePower)}</strong></div>${combat.ranged.ammunition?.tracking ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Ranged.Ammunition"))}</span><strong>${combat.ranged.ammunition.loaded}/${combat.ranged.ammunition.reserve}</strong></div>` : ""}${combat.ranged.accidentalEligible ? `<p class="combat-card-warning">${escape(localize("MYTHRASF.Ranged.AccidentalPending"))}</p>` : ""}</fieldset>` : "";
  const rollConfiguration = combat.attacker.rollConfiguration;
  const adjustmentHtml = rollConfiguration ? `<fieldset><legend>${escape(localize("MYTHRASF.SkillRoll.Modifiers"))}</legend>
    <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.Difficulty"))}</span><strong>${escape(localize(`MYTHRASF.Difficulty.${combat.attacker.difficulty}`))}</strong></div>
    <div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.BaseTarget"))}</span><strong>${rollConfiguration.baseTarget}%</strong></div>
    ${["limited", "reinforced"].filter((key) => rollConfiguration[key]).map((key) => {
      const value = rollConfiguration[key];
      return `<div class="mythras-chat-row"><span>${escape(localize(`MYTHRASF.SkillRoll.${key === "limited" ? "Limited" : "Reinforced"}`))}</span><strong>${escape(value.abilityName)} (${escape(value.actorName)}, ${value.target}%)</strong></div>`;
    }).join("")}
    ${combat.attacker.target !== rollConfiguration.baseTarget ? `<div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.EffectiveTarget"))}</span><strong>${combat.attacker.target}%</strong></div>` : ""}</fieldset>` : "";
  const accidental = combat.status === "awaitingAccidentalTarget" ? `<button type="button" data-combat-action="accidental-target" data-gm-only title="${escape(localize("MYTHRASF.Ranged.ChooseAccidentalTarget"))}">${escape(localize("MYTHRASF.Ranged.ChooseAccidentalTarget"))}</button>` : "";
  return `<section class="mythras-combat-card mythras-chat-card" data-combat-revision="${combat.revision}"><div class="mythras-chat-title">${escape(localize("MYTHRASF.Combat.ExchangeTitle"))}</div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Contest.StatusLabel"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Status.${combat.status}`))}</strong></div>${tracker}<div class="mythras-chat-details"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Attacker"))}</span><strong>${escape(combatEntryDisplayName(combat.attacker))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.Defender"))}</span><strong>${escape(combatEntryDisplayName(combat.defender))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.WeaponAndStyle"))}</span><strong>${escape(`${combat.attacker.weaponName} — ${combat.attacker.styleName}`)}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.DeclarationMoment"))}</span><strong>${escape(localize(`MYTHRASF.Combat.Declaration.${combat.predeclared ? "before" : "after"}`))}</strong></div><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Combat.ContainedBlow"))}</span><strong>${escape(localize(combat.declarations?.containedBlow ? "MYTHRASF.Yes" : "MYTHRASF.No"))}</strong></div></div>${rangedHtml}${adjustmentHtml}<div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(localize("MYTHRASF.Chat.AttackRoll"))} (${attack?.target ?? combat.attacker.target}%)</span><strong><span class="mythras-chat-roll-value">${combat.attacker.rawRoll}</span> ${escape(resultLabel(attack?.result))}</strong>${rollLuckAllowed ? luck("attacker") : ""}</div></div><div class="combat-exchange-side"><div class="mythras-chat-row"><span>${escape(defenseName)}${defense?.target != null ? ` (${defense.target}%)` : ""}</span><strong>${defense?.rawRoll == null ? "—" : `<span class="mythras-chat-roll-value">${defense.rawRoll}</span> ${escape(resultLabel(defense.result))}`}</strong>${defense?.rawRoll != null && rollLuckAllowed ? luck("defender") : ""}</div></div>${penalty}${outcome}${effectsHtml}${damageHtml}${checksHtml}${consequencesHtml}${defenseActions}${accidental}<div data-combat-gm-actions>${combat.status === "awaitingDefense" ? `<button type="button" data-combat-action="cancel" title="${escape(localize("MYTHRASF.Contest.Cancel"))}">${escape(localize("MYTHRASF.Contest.Cancel"))}</button>` : ""}${close}</div></section>`;
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
  combatActor(combat.defender.tokenUuid, combat.defender.actorUuid).then((actor) => card.querySelectorAll("[data-combat-action='parry'],[data-combat-action='evade'],[data-combat-action='cover'],[data-combat-action='none']").forEach((button) => { button.hidden = !game.user.isGM && !actor?.isOwner; }));
  const pendingEffectSide = combat.effects?.pendingSide ?? combat.effects?.winner;
  const winnerEntry = pendingEffectSide === "attacker" ? combat.attacker : combat.defender;
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
    const selfSide = effect?.side ?? combat.effects?.winner;
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
    if (["parry", "evade", "cover", "none"].includes(action)) return respondToAttack(message, combat, action);
    if (action === "accidental-target") return chooseAccidentalTarget(message, combat);
    if (action === "cancel") return cancelCombat(message, combat);
    if (action === "close-exchange") return closeCombatExchange(message, combat);
    if (action === "resolve-consequence") return resolveCombatConsequence(message, combat,
      button.dataset.consequenceIndex);
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
