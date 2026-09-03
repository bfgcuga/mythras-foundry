import { classifyContestRoll } from "./contest-rolls.js";
import { appendSerializedRolls, evaluateAnimatedRoll } from "./dice-animation.js";
import { recordAbilityFumble } from "./skills.js";
import { fatigueLossForResult, worsenFatigueLevel, TIMED_CONDITION_FLAG,
  TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { timedEffects } from "./timed-condition-runtime.js";
import { applyTimedCondition } from "./timed-condition-runtime.js";
import { isNaturalWeaponMode, passiveBlockCapacity, validatePassiveBlock } from "./passive-block.js";
import { getSystemSetting, SETTING_KEYS } from "../settings.js";
import { findWeaponMode } from "./weapon-modes.js";
import { weaponCanEquip } from "./weapon-durability.js";
import { tacticalState } from "./engagement-runtime.js";
import { actorDisplayName } from "./document-names.js";
import { ACID_IMMERSION_STATUS_ID, ACID_SPLASH_STATUS_ID, acidCondition, acidEffects,
  acidReviewConfiguration, applyAcidDamage, openAcidDialog, removeAcidEffect } from "./acid.js";
import { applyFireDamage, extinguishFire, fireEffectConfiguration,
  openFireDialog } from "./fire.js";
import { uniqueActorEntries } from "./combat-turns.js";
import { hitLocationDisplayName } from "./hit-locations.js";
import { prepareSuffocationEntry } from "./suffocation.js";
import { advanceCombatFatigue, COMBAT_FATIGUE_FLAG, COMBAT_FATIGUE_SCOPE,
  combatFatigueInterval, combatFatigueLoss } from "./combat-fatigue.js";
import { prepareDyingEntry } from "./dying.js";
import { invertD100 } from "./skill-roll.js";
import { difficultyTarget } from "./combat.js";
import { resolveSkillRollConditions } from "./skill-roll-resolution.js";

const SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const actorIdentity = (actor) => actor?.parent?.actorId ?? actor?.token?.actorId ?? actor?.id ?? null;

async function roundConsequenceActor(entry) {
  if (!entry?.actorUuid) return null;
  const document = await fromUuid(entry.actorUuid).catch(() => null);
  return document?.actor ?? document;
}

async function roundFatigueLuckContext(user, state, entryId, { requirePoints = true } = {}) {
  const entry = state?.queue?.find((candidate) => candidate.id === entryId
    && candidate.key === "combatFatigue" && candidate.resolution?.rawRoll != null);
  const rolledActor = await roundConsequenceActor(entry);
  if (!entry || !rolledActor || !user) return { ownRoll: false, spenders: [] };
  const partyIds = new Set(game.mythrasFoundry?.party?.getActiveParty?.()?.memberIds ?? []);
  const entries = state.queue.filter((candidate) => candidate.key === "combatFatigue");
  const actors = (await Promise.all(entries.map(roundConsequenceActor))).filter(Boolean);
  const seen = new Set();
  const eligible = actors.filter((actor) => {
    const identity = actorIdentity(actor);
    if (!identity || seen.has(identity) || !partyIds.has(identity)) return false;
    seen.add(identity);
    return (!requirePoints || Number(actor.system.resources?.luckPoints?.value ?? 0) > 0)
      && (user.isGM || actor.isOwner);
  });
  const ownRoll = eligible.find((actor) => actorIdentity(actor) === actorIdentity(rolledActor));
  return ownRoll ? { ownRoll: true, spenders: [ownRoll] }
    : { ownRoll: false, spenders: eligible };
}

export function periodicConditionEntries(combat) {
  const entries = [];
  for (const combatant of uniqueActorEntries(combat?.combatants)) {
    const actor = combatant.actor; if (!actor) continue;
    for (const effect of timedEffects(actor)) {
      const condition = effect.getFlag(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
      if (condition.key === "exsanguinating") entries.push({ id: `${combatant.id}:${effect.id}`,
        combatantId: combatant.id, actorUuid: actor.uuid, effectId: effect.id,
        key: condition.key, automatic: true, status: "pending" });
    }
    for (const key of ["bleeding", "drowning"]) {
      if (actor.statuses?.has(key)) entries.push({ id: `${combatant.id}:${key}`,
        combatantId: combatant.id, actorUuid: actor.uuid, key, automatic: false,
        status: "pending" });
    }
  }
  return entries;
}

export function passiveBlockLocations(actor) {
  return Array.from(actor?.items ?? [])
    .filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart))
    .map((item) => ({ id: item.id, name: item.name, nameKey: item.system.nameKey,
      rangeStart: item.system.rangeStart, rangeEnd: item.system.rangeEnd,
      category: item.system.category, hpClass: item.system.hpClass }));
}

export function passiveBlockEntries(combat) {
  const entries = [];
  const previousBlocks = tacticalState(combat).passiveBlocks ?? {};
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor; if (!actor || combatant.isDefeated) continue;
    const prepared = actor.items.filter((item) => item.type === "weapon" && item.system.equipped
      && weaponCanEquip(item))
      .map((weapon) => ({ weapon, mode: findWeaponMode(weapon) }))
      .filter(({ mode }) => Boolean(mode));
    const dualWield = prepared.filter(({ mode }) => !isNaturalWeaponMode(mode)
      && ["melee", "shield"].includes(mode.weaponType) && Number(mode.handsRequired) === 1).length >= 2;
    const choices = prepared.filter(({ mode }) => passiveBlockCapacity(mode, { dualWield }) > 0)
        .map(({ weapon, mode }) => ({ weaponId: weapon.id, weaponName: weapon.name, modeKey: mode.key,
          modeName: mode.name, weaponSize: mode.size, weaponType: mode.weaponType,
          capacity: passiveBlockCapacity(mode, { dualWield }) }))
        .sort((left, right) => Number(right.weaponType === "shield")
          - Number(left.weaponType === "shield"));
    if (!choices.length) continue;
    const previous = previousBlocks[combatant.id];
    const previousChoice = choices.find((choice) => choice.weaponId === previous?.weaponId
      && choice.modeKey === previous?.modeKey);
    const locationIds = (previous?.locationIds ?? []).filter((id) =>
      actor.items.get?.(id)?.type === "hitLocation"
      || actor.items.some?.((item) => item.id === id && item.type === "hitLocation"));
    const previousSelection = Number(combat.round) > 1
      && Number(previous?.round) === Number(combat.round) - 1 && previousChoice
      && locationIds.length === previous.locationIds?.length
      ? { weapon: `${previous.weaponId}:${previous.modeKey}`, weaponId: previous.weaponId,
        modeKey: previous.modeKey, locationIds, crouched: Boolean(previous.crouched) } : null;
    entries.push({ id: `${combatant.id}:passive-block`, combatantId: combatant.id,
      actorUuid: actor.uuid, actorName: actorDisplayName(actor), key: "passiveBlock",
      automatic: false, status: "pending", previousSelection,
      choices, locations: passiveBlockLocations(actor) });
  }
  return entries;
}

export function burningEntries(combat) {
  return uniqueActorEntries(combat?.combatants).flatMap((combatant) => {
    const actor = combatant.actor;
    if (!actor?.statuses?.has?.("burning")) return [];
    return [{ id: `${combatant.id}:burning`, combatantId: combatant.id,
      actorUuid: actor.uuid, actorName: actorDisplayName(actor), key: "burning",
      automatic: false, status: "pending", defaults: fireEffectConfiguration(actor) }];
  });
}

export function acidReviewEntries(combat) {
  return uniqueActorEntries(combat?.combatants).flatMap((combatant) => {
    const actor = combatant.actor;
    return acidEffects(actor).map((effect) => ({ id: `${combatant.id}:acid:${effect.id}`,
      combatantId: combatant.id, actorUuid: actor.uuid, actorName: actorDisplayName(actor),
      effectId: effect.id, key: "acidReview", automatic: false, status: "pending",
      defaults: acidReviewConfiguration(effect) }));
  });
}

export async function applyFatigueLoss(actor, loss) {
  const before = actor.system.fatigueLevel ?? "fresh";
  const after = worsenFatigueLevel(before, loss);
  if (after !== before) await actor.update({ "system.fatigueLevel": after });
  return { before, after, loss };
}

export function roundEnduranceTarget(actor, skill) {
  const baseTarget = Number(skill?.system?.total ?? 0);
  const conditions = resolveSkillRollConditions(actor, skill);
  return Object.freeze({ baseTarget, difficulty: conditions.difficulty,
    target: difficultyTarget(baseTarget, conditions.difficulty),
    modifiers: conditions.modifiers });
}

async function prepareCombatFatigueEntries(combat, previous, completedRound) {
  const entries = [];
  const showNpcChecks = Boolean(getSystemSetting(SETTING_KEYS.showNpcCombatFatigueChecks));
  for (const combatant of uniqueActorEntries(combat?.combatants)) {
    const actor = combatant.actor;
    if (!actor || combatant.isDefeated || !["character", "npc"].includes(actor.type)) continue;
    const interval = combatFatigueInterval(actor.system.constitution);
    const currentState = combatant.getFlag?.(COMBAT_FATIGUE_SCOPE, COMBAT_FATIGUE_FLAG);
    const advanced = advanceCombatFatigue(currentState,
      { combatId: combat.id, round: completedRound, interval });
    if (advanced.state !== currentState) {
      await combatant.setFlag(COMBAT_FATIGUE_SCOPE, COMBAT_FATIGUE_FLAG, advanced.state);
    }
    if (!advanced.due) continue;
    const entry = { id: `${combatant.id}:combat-fatigue`, combatantId: combatant.id,
      actorUuid: actor.uuid, actorName: actorDisplayName(actor), key: "combatFatigue",
      automatic: false, status: "pending", interval };
    const prior = previous.get(entry.id);
    if (prior) {
      entries.push({ ...entry, status: prior.status, resolution: prior.resolution });
      continue;
    }
    if (Number(currentState?.resolvedRound) === Number(completedRound)) {
      entry.status = "resolved";
      entry.resolution = currentState.resolution;
      if (Number(entry.resolution?.loss) > 0 || showNpcChecks) entries.push(entry);
      continue;
    }
    if (actor.type === "character") {
      entries.push(entry);
      continue;
    }
    const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === "aguante");
    if (!skill) continue;
    const roll = await new Roll("1d100").evaluate();
    const endurance = roundEnduranceTarget(actor, skill);
    const target = endurance.target;
    const result = classifyContestRoll(roll.total, target);
    await recordAbilityFumble(skill, result);
    const loss = combatFatigueLoss(result);
    const fatigue = await applyFatigueLoss(actor, loss);
    entry.status = "resolved";
    entry.resolution = { ...endurance, rawRoll: roll.total, serializedRoll: roll.toJSON(), result,
      loss, before: fatigue.before, after: fatigue.after };
    await combatant.setFlag(COMBAT_FATIGUE_SCOPE, COMBAT_FATIGUE_FLAG, {
      ...advanced.state, resolvedRound: completedRound, resolution: entry.resolution
    });
    if (loss > 0 || showNpcChecks) entries.push(entry);
  }
  return entries;
}

export async function prepareRoundConsequences(combat) {
  const economy = combat.mythrasTurnEconomy;
  const previous = new Map((economy.roundQueue ?? []).filter((entry) =>
    ["burning", "acidReview", "suffocating", "combatFatigue", "exsanguinating", "dying",
      "bleeding", "drowning"].includes(entry.key)
      && Number(entry.round) === Number(combat.round))
    .map((entry) => [entry.id, entry]));
  const suffocation = [];
  for (const combatant of uniqueActorEntries(combat?.combatants)) {
    const entry = await prepareSuffocationEntry(combat, combatant);
    if (entry) suffocation.push(entry);
  }
  const combatFatigue = await prepareCombatFatigueEntries(combat, previous,
    Math.max(0, Number(combat.round) - 1));
  const dying = [];
  for (const combatant of uniqueActorEntries(combat?.combatants)) {
    const entry = await prepareDyingEntry(combat, combatant);
    if (entry) dying.push(entry);
  }
  const queue = [...periodicConditionEntries(combat), ...suffocation, ...combatFatigue, ...dying,
    ...acidReviewEntries(combat),
    ...burningEntries(combat),
    ...passiveBlockEntries(combat)]
    .map((entry) => {
      const prior = previous.get(entry.id);
      return prior ? { ...entry, round: combat.round, status: prior.status,
        resolution: prior.resolution } : { ...entry, round: combat.round };
    });
  for (const entry of queue.filter((candidate) => candidate.automatic
    && candidate.status === "pending")) {
    const actor = await fromUuid(entry.actorUuid);
    entry.resolution = actor ? await applyFatigueLoss(actor, 1) : { missing: true };
    entry.status = actor ? "resolved" : "pending";
  }
  await combat.setFlag(SCOPE, "turnEconomy", { ...economy,
    roundQueue: queue, roundPreparing: queue.some((entry) => entry.status === "pending") });
  if (queue.length) await createRoundMessage(combat, queue, { blocksRoundPreparation: true });
  return queue;
}

async function createRoundMessage(combat, queue, { blocksRoundPreparation = false,
  round = combat.round } = {}) {
  const state = { schemaVersion: 1, combatId: combat.id, combatUuid: combat.uuid,
    round, revision: 0, blocksRoundPreparation, queue };
  const rolls = queue.flatMap((entry) => entry.resolution?.serializedRoll
    ? [Roll.fromData(entry.resolution.serializedRoll)] : []);
  return ChatMessage.create({ content: renderRoundConsequences(state), rolls,
    flags: { [SCOPE]: { roundConsequences: state } } });
}

export async function prepareCombatEndFatigue(combat) {
  const completedRound = Math.max(0, Number(combat?.round) || 0);
  if (!completedRound) return [];
  const entries = await prepareCombatFatigueEntries(combat, new Map(), completedRound);
  const queue = entries.map((entry) => ({ ...entry, round: completedRound }));
  if (queue.length) await createRoundMessage(combat, queue, { round: completedRound });
  return queue;
}

export function renderRoundConsequences(state) {
  const rows = state.queue.filter((entry) => !["passiveBlock", "burning", "acidReview", "combatFatigue"].includes(entry.key)).map((entry) => `<div class="mythras-chat-row"><span>${escape(
    game.i18n.localize(`MYTHRASF.Status.${entry.key === "exsanguinating" ? "Exsanguinating"
      : entry.key === "bleeding" ? "Bleeding" : entry.key === "passiveBlock"
        ? "PassiveBlock" : entry.key === "suffocating" ? "Suffocating"
          : entry.key === "combatFatigue" ? "CombatFatigue"
            : entry.key === "dying" ? "Dying" : "Drowning"}`))}${["suffocating", "combatFatigue", "dying"].includes(entry.key) ? ` — ${escape(entry.actorName)}` : ""}</span><strong>${escape(
    game.i18n.localize(`MYTHRASF.RoundConsequence.${entry.status}`))}</strong>${entry.status === "pending"
      ? entry.key === "passiveBlock"
        ? `<button type="button" data-round-action="block" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Declare"))}</button><button type="button" data-round-action="waive" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Waive"))}</button>`
        : `<button type="button" data-round-action="roll" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.Roll"))}</button><button type="button" data-round-action="manual" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : entry.resolution ? entry.key === "passiveBlock"
          ? `<span>${escape(entry.resolution.waived ? game.i18n.localize("MYTHRASF.PassiveBlock.Waived") : entry.resolution.weaponName)}</span>`
          : entry.key === "dying" ? `<span>${escape(entry.resolution.dead
            ? game.i18n.localize("MYTHRASF.Dying.Death")
            : game.i18n.format("MYTHRASF.Dying.RoundsRemainingValue", {
              remaining: entry.resolution.remaining }))}</span>`
            : `<span>${entry.resolution.rawRoll != null ? `${escape(game.i18n.localize("MYTHRASF.Suffocation.Endurance"))}: <strong class="mythras-chat-roll-value">${Number(entry.resolution.rawRoll)}</strong> / ${Number(entry.resolution.target)} — ${escape(game.i18n.localize(`MYTHRASF.RollResult.${entry.resolution.result}`))}; ` : ""}${escape(game.i18n.format("MYTHRASF.RoundConsequence.Fatigue", { loss: entry.resolution.loss ?? 0 }))}</span>` : ""}</div>`).join("");
  const fatigueRows = state.queue.filter((entry) => entry.key === "combatFatigue").map((entry) => {
    const actions = entry.status === "pending"
      ? `<div class="mythras-round-entry-actions"><button type="button" data-round-action="roll" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.Roll"))}</button><button type="button" data-round-action="manual" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual"))}</button></div>` : "";
    const roll = entry.resolution?.rawRoll != null
      ? `<strong class="combat-roll-outcome mythras-chat-result--${escape(entry.resolution.result)}"><span class="mythras-chat-roll-value">${Number(entry.resolution.rawRoll)}</span> ${escape(game.i18n.localize(`MYTHRASF.RollResult.${entry.resolution.result}`))}</strong>` : "";
    const luck = entry.resolution?.rawRoll != null
      ? `<button type="button" class="sheet-icon-button mythras-chat-luck-button" data-round-action="luck" data-entry-id="${escape(entry.id)}" title="${escape(game.i18n.localize("MYTHRASF.Luck.Use"))}" aria-label="${escape(game.i18n.localize("MYTHRASF.Luck.Use"))}"><i class="fas fa-clover" aria-hidden="true"></i></button>` : "";
    const luckHistory = (entry.resolution?.luckHistory ?? []).map((attempt) =>
      `<small class="mythras-chat-luck-spent">${Number(attempt.value)} — ${escape(game.i18n.format("MYTHRASF.Luck.SpentBy", { actor: attempt.spenderName }))}</small>`).join("");
    const resolution = entry.resolution
      ? `<div class="mythras-round-fatigue-result">${entry.resolution.rawRoll != null ? `<span>${escape(game.i18n.localize("MYTHRASF.Suffocation.Endurance"))}: ${Number(entry.resolution.target)}</span><span class="mythras-round-fatigue-roll">${roll}${luck}</span>${luckHistory}` : ""}<span>${escape(game.i18n.format("MYTHRASF.RoundConsequence.Fatigue", { loss: entry.resolution.loss ?? 0 }))}</span>${entry.resolution.note ? `<span>${escape(entry.resolution.note)}</span>` : ""}</div>` : "";
    return `<div class="mythras-round-fatigue-entry"><strong class="mythras-round-actor-name">${escape(entry.actorName)}</strong>${actions}${resolution}</div>`;
  }).join("");
  const fatiguePanel = fatigueRows ? `<fieldset class="mythras-round-fatigue-panel"><legend>${escape(game.i18n.localize("MYTHRASF.Status.CombatFatigue"))}</legend>${fatigueRows}</fieldset>` : "";
  const blocks = state.queue.filter((entry) => entry.key === "passiveBlock").map((entry) => {
    const locationNames = (entry.resolution?.locationIds ?? []).map((id) =>
      entry.locations.find((location) => location.id === id)).filter(Boolean)
      .map((location) => hitLocationDisplayName(location));
    const actions = entry.status === "pending"
      ? `<div class="mythras-round-entry-actions"><button type="button" data-round-action="block" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Declare"))}</button>${entry.previousSelection ? `<button type="button" data-round-action="repeat-block" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Repeat"))}</button>` : ""}<button type="button" data-round-action="waive" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Waive"))}</button></div>` : "";
    const resolution = entry.resolution
      ? entry.resolution.waived
        ? `<strong class="mythras-round-block-status">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Passed"))}</strong>`
        : `<strong class="mythras-round-block-weapon">${escape(entry.resolution.weaponName)}</strong><div class="mythras-round-block-locations"><span>${escape(game.i18n.localize("MYTHRASF.RoundConsequence.Locations"))}</span><strong>${escape(locationNames.join(", "))}</strong></div>` : "";
    return `<div class="mythras-round-block-entry"><strong class="mythras-round-actor-name">${escape(entry.actorName)}</strong>${actions}${resolution}</div>`;
  }).join("");
  const blockPanel = blocks ? `<fieldset class="mythras-round-block-panel"><legend>${escape(game.i18n.localize("MYTHRASF.Status.PassiveBlock"))}</legend>${blocks}</fieldset>` : "";
  const fires = state.queue.filter((entry) => entry.key === "burning").map((entry) => {
    const resolution = entry.resolution?.action
      ? game.i18n.localize(`MYTHRASF.Fire.Round.${entry.resolution.action}`)
      : game.i18n.localize("MYTHRASF.RoundConsequence.pending");
    const actions = entry.status === "pending"
      ? `<button type="button" data-round-action="fire-apply" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.Fire.Apply"))}</button><button type="button" data-round-action="fire-skip" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.Fire.SkipRound"))}</button><button type="button" data-round-action="fire-extinguish" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.Fire.Extinguish"))}</button>` : "";
    return `<div class="mythras-chat-row"><span>${escape(entry.actorName)}</span><strong>${escape(resolution)}</strong>${actions}</div>`;
  }).join("");
  const firePanel = fires ? `<fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Status.Burning"))}</legend>${fires}</fieldset>` : "";
  const acids = state.queue.filter((entry) => entry.key === "acidReview").map((entry) => {
    const resolution = entry.resolution?.action
      ? game.i18n.localize(`MYTHRASF.Acid.Round.${entry.resolution.action}`)
      : game.i18n.localize("MYTHRASF.RoundConsequence.pending");
    const exposure = game.i18n.localize(`MYTHRASF.Acid.Exposure.${entry.defaults.exposure}`);
    const actions = entry.status === "pending"
      ? `<button type="button" data-round-action="acid-apply" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.Acid.Apply"))}</button><button type="button" data-round-action="acid-skip" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.Acid.SkipRound"))}</button><button type="button" data-round-action="acid-remove" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.Acid.Remove"))}</button>` : "";
    return `<div class="mythras-chat-row"><span>${escape(entry.actorName)} — ${escape(exposure)}</span><strong>${escape(resolution)}</strong>${actions}</div>`;
  }).join("");
  const acidPanel = acids ? `<fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Status.Acid"))}</legend>${acids}</fieldset>` : "";
  return `<section class="mythras-round-card mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.format("MYTHRASF.RoundConsequence.Title", { round: state.round }))}</div>${rows}${fatiguePanel}${acidPanel}${firePanel}${blockPanel}</section>`;
}

async function requestAcidResolution(message, state, entryId, action, manual = false) {
  if (!game.user.isGM) return;
  const entry = state.queue.find((candidate) => candidate.id === entryId
    && candidate.key === "acidReview");
  const combat = game.combats.get(state.combatId);
  const combatant = combat?.combatants.get(entry?.combatantId);
  if (!entry || !combatant?.actor || entry.status !== "pending") return;
  let resolution = { action };
  if (action === "apply") {
    resolution = await openAcidDialog({ actor: combatant.actor, token: combatant.token,
      defaults: entry.defaults, deferApply: true, fixedExposure: true });
    if (!resolution) return;
  }
  const request = { action: "roundAcid", messageId: message.id, revision: state.revision,
    entryId, userId: game.user.id, resolution, manual };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyAcidResolution(message, request);
  else game.socket.emit(SOCKET, request);
}

async function requestBurningResolution(message, state, entryId, action, manual = false) {
  if (!game.user.isGM) return;
  const entry = state.queue.find((candidate) => candidate.id === entryId && candidate.key === "burning");
  const combat = game.combats.get(state.combatId);
  const combatant = combat?.combatants.get(entry?.combatantId);
  if (!entry || !combatant?.actor || entry.status !== "pending") return;
  let resolution = { action };
  if (action === "apply") {
    resolution = await openFireDialog({ actor: combatant.actor, token: combatant.token,
      defaults: entry.defaults, deferApply: true });
    if (!resolution) return;
  }
  const request = { action: "roundFire", messageId: message.id, revision: state.revision,
    entryId, userId: game.user.id, resolution, manual };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyBurningResolution(message, request);
  else game.socket.emit(SOCKET, request);
}

async function requestResolution(message, state, entryId, forceManual, manualRoll = false) {
  const entry = state.queue.find((candidate) => candidate.id === entryId);
  const actor = entry ? await fromUuid(entry.actorUuid).catch(() => null) : null;
  if (!entry || (!actor && !forceManual) || (!game.user.isGM && !actor?.isOwner)) return;
  let resolution;
  if (forceManual) {
    if (!game.user.isGM) return;
    resolution = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.RoundConsequence.Loss"))}</span><input type="number" name="loss" min="0" value="0"></label><textarea name="note" required></textarea></div>`,
      buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual"),
        callback: (event, button) => ({ manual: true,
          loss: Math.max(0, Number(button.form.elements.loss.value) || 0),
          note: button.form.elements.note.value.trim() }) }], rejectClose: false });
  } else {
    const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === "aguante");
    if (!skill) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Combat.SourceMissing"));
    const roll = await evaluateAnimatedRoll("1d100", { manual: manualRoll });
    const endurance = roundEnduranceTarget(actor, skill);
    const result = classifyContestRoll(roll.total, endurance.target);
    await recordAbilityFumble(skill, result);
    const lossRoll = entry.key !== "combatFatigue" && result === "failure" ? await evaluateAnimatedRoll("1d2",
      { manual: manualRoll })
      : entry.key !== "combatFatigue" && result === "fumble" ? await evaluateAnimatedRoll("1d3",
        { manual: manualRoll }) : null;
    resolution = { manual: false, ...endurance, rawRoll: roll.total,
      serializedRoll: roll.toJSON(), result,
      loss: entry.key === "combatFatigue" ? combatFatigueLoss(result)
        : fatigueLossForResult(result, lossRoll?.total ?? 1),
      lossRoll: lossRoll?.toJSON?.() ?? null };
  }
  if (!resolution) return;
  const request = { action: "roundConsequence", messageId: message.id,
    revision: state.revision, entryId, userId: game.user.id, resolution };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyResolution(message, request);
  else game.socket.emit(SOCKET, request);
}

async function requestRoundFatigueLuck(message, state, entryId, manual = false) {
  const entry = state.queue.find((candidate) => candidate.id === entryId
    && candidate.key === "combatFatigue");
  const rolledActor = await roundConsequenceActor(entry);
  const context = await roundFatigueLuckContext(game.user, state, entryId);
  if (!entry || !rolledActor || !context.spenders.length) {
    return ui.notifications.warn(game.i18n.localize("MYTHRASF.Luck.None"));
  }
  if (rolledActor.system.fatigueLevel !== entry.resolution.after) {
    return ui.notifications.warn(game.i18n.localize("MYTHRASF.Luck.FatigueChanged"));
  }
  const spenderControl = context.spenders.length === 1
    ? `<div class="luck-spender-fixed"><span>${escape(game.i18n.localize("MYTHRASF.Luck.Spender"))}</span><strong>${escape(actorDisplayName(context.spenders[0]))} (${Number(context.spenders[0].system.resources?.luckPoints?.value ?? 0)})</strong><input type="hidden" name="luckActorUuid" value="${escape(context.spenders[0].uuid)}"></div>`
    : `<label><span>${escape(game.i18n.localize("MYTHRASF.Luck.Spender"))}</span><select name="luckActorUuid">${context.spenders.map((actor) => `<option value="${escape(actor.uuid)}">${escape(actorDisplayName(actor))} (${Number(actor.system.resources?.luckPoints?.value ?? 0)})</option>`).join("")}</select></label>`;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Luck.Title") },
    content: `<div class="mythras-foundry mythras-dialog luck-spend-dialog"><p>${escape(game.i18n.localize(context.ownRoll ? "MYTHRASF.Luck.Confirm" : "MYTHRASF.Luck.ForceRerollConfirm"))}</p>${spenderControl}</div>`,
    buttons: [{ action: "reroll", label: game.i18n.localize(context.ownRoll
      ? "MYTHRASF.Luck.Reroll" : "MYTHRASF.Luck.ForceReroll"), icon: "fas fa-dice-d20",
    callback: (event, button) => ({ mode: "reroll",
      luckActorUuid: button.form.elements.luckActorUuid.value }) },
    ...(context.ownRoll ? [{ action: "invert", label: game.i18n.localize("MYTHRASF.Luck.Invert"),
      icon: "fas fa-arrow-right-arrow-left", callback: (event, button) => ({ mode: "invert",
        luckActorUuid: button.form.elements.luckActorUuid.value }) }] : []),
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times" }],
    rejectClose: false
  });
  if (!choice) return;
  const luckActor = await fromUuid(choice.luckActorUuid).catch(() => null);
  const spender = luckActor?.actor ?? luckActor;
  const points = Number(spender?.system.resources?.luckPoints?.value ?? 0);
  if (!spender || !context.spenders.some((actor) => actor.uuid === spender.uuid) || points < 1) {
    return ui.notifications.warn(game.i18n.localize("MYTHRASF.Luck.None"));
  }
  const roll = choice.mode === "reroll" ? await evaluateAnimatedRoll("1d100", { manual }) : null;
  const request = { action: "roundConsequenceLuck", messageId: message.id,
    revision: state.revision, entryId, userId: game.user.id, luckActorUuid: spender.uuid,
    rawRoll: roll?.total ?? invertD100(entry.resolution.rawRoll),
    serializedRoll: roll?.toJSON?.() ?? null };
  if (game.user.isGM || spender.isOwner) {
    await spender.update({ "system.resources.luckPoints.value": points - 1 });
    request.luckAlreadySpent = true;
  }
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyRoundFatigueLuck(message, request);
  else game.socket.emit(SOCKET, request);
}

async function applyRoundFatigueLuck(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "roundConsequences"));
  const entry = state?.queue?.find((candidate) => candidate.id === request.entryId
    && candidate.key === "combatFatigue" && candidate.resolution?.rawRoll != null);
  if (!entry || Number(request.revision) !== Number(state.revision)) return;
  const actor = await roundConsequenceActor(entry);
  const luckDocument = await fromUuid(request.luckActorUuid).catch(() => null);
  const luckActor = luckDocument?.actor ?? luckDocument;
  const user = game.users.get(request.userId);
  const context = await roundFatigueLuckContext(user, state, entry.id, { requirePoints: false });
  if (!actor || !luckActor || !user
    || !context.spenders.some((candidate) => candidate.uuid === luckActor.uuid)
    || actor.system.fatigueLevel !== entry.resolution.after) return;
  if (!request.luckAlreadySpent) {
    const points = Number(luckActor.system.resources?.luckPoints?.value ?? 0);
    if (points < 1) return ui.notifications.warn(game.i18n.localize("MYTHRASF.Luck.None"));
    await luckActor.update({ "system.resources.luckPoints.value": points - 1 });
  }
  const result = classifyContestRoll(Number(request.rawRoll), Number(entry.resolution.target));
  const loss = combatFatigueLoss(result);
  const after = worsenFatigueLevel(entry.resolution.before, loss);
  if (after !== actor.system.fatigueLevel) await actor.update({ "system.fatigueLevel": after });
  const skill = actor.items.find((item) => item.type === "skill" && item.system.slug === "aguante");
  await recordAbilityFumble(skill, result);
  entry.resolution = { ...entry.resolution,
    luckHistory: [...(entry.resolution.luckHistory ?? []), {
      value: entry.resolution.rawRoll, spenderName: actorDisplayName(luckActor) }],
    rawRoll: Number(request.rawRoll), serializedRoll: request.serializedRoll,
    result, loss, after };
  state.revision += 1;
  await message.update({ content: renderRoundConsequences(state),
    rolls: appendSerializedRolls(message, request.serializedRoll),
    [`flags.${SCOPE}.roundConsequences`]: state });
}

async function requestPassiveBlock(message, state, entryId, { waive = false, repeat = false } = {}) {
  const entry = state.queue.find((candidate) => candidate.id === entryId);
  const actor = entry ? await roundConsequenceActor(entry) : null;
  if (!entry || entry.key !== "passiveBlock" || (!game.user.isGM && !actor?.isOwner)) return;
  let resolution = repeat && entry.previousSelection
    ? { waived: false, ...entry.previousSelection } : { waived: true };
  if (repeat && !entry.previousSelection) return;
  if (!waive) {
    if (repeat) return sendPassiveBlockRequest(message, state, entryId, resolution);
    const defaults = entry.previousSelection;
    const weaponOptions = entry.choices.map((choice) => {
      const value = `${choice.weaponId}:${choice.modeKey}`;
      return `<option value="${escape(value)}" ${value === defaults?.weapon ? "selected" : ""}>${escape(choice.weaponName)} (${choice.capacity})</option>`;
    }).join("");
    const locations = passiveBlockLocations(actor).map((location) => `<label><input type="checkbox" class="sheet-state-box" name="location" value="${escape(location.id)}" ${defaults?.locationIds.includes(location.id) ? "checked" : ""}> ${escape(hitLocationDisplayName(location))}</label>`).join("");
    resolution = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MYTHRASF.PassiveBlock.Declare") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weaponOptions}</select></label><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</legend>${locations}</fieldset><label><input type="checkbox" class="sheet-state-box" name="crouched" ${defaults?.crouched ? "checked" : ""}> ${escape(game.i18n.localize("MYTHRASF.Status.CrouchedBehindShield"))}</label></div>`,
      buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.PassiveBlock.Accept"),
        callback: (event, button) => ({ waived: false, weapon: button.form.elements.weapon.value,
          locationIds: Array.from(button.form.querySelectorAll("input[name='location']:checked")).map((control) => control.value),
          crouched: button.form.elements.crouched.checked }) },
      { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel") }], rejectClose: false });
    if (!resolution) return;
  }
  return sendPassiveBlockRequest(message, state, entryId, resolution);
}

async function sendPassiveBlockRequest(message, state, entryId, resolution) {
  const request = { action: "roundPassiveBlock", messageId: message.id, revision: state.revision,
    entryId, userId: game.user.id, resolution };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyPassiveBlock(message, request);
  else game.socket.emit(SOCKET, request);
}

export async function openPassiveBlockDeclaration(actor) {
  const combat = game.combat;
  const combatant = combat?.combatants.find((entry) => entry.actor?.uuid === actor?.uuid);
  const message = game.messages?.find((candidate) => {
    const state = candidate.getFlag?.(SCOPE, "roundConsequences");
    return state?.combatId === combat?.id && Number(state.round) === Number(combat.round)
      && state.queue.some((entry) => entry.combatantId === combatant?.id
        && entry.key === "passiveBlock" && entry.status === "pending");
  });
  const state = message?.getFlag(SCOPE, "roundConsequences");
  const entry = state?.queue.find((candidate) => candidate.combatantId === combatant?.id
    && candidate.key === "passiveBlock" && candidate.status === "pending");
  if (!message || !entry) return ui.notifications.warn(
    game.i18n.localize("MYTHRASF.PassiveBlock.NoPendingDeclaration"));
  return requestPassiveBlock(message, state, entry.id);
}

export async function openPassiveBlockCorrection(combat, combatantId) {
  const entry = passiveBlockEntries(combat).find((candidate) => candidate.combatantId === combatantId);
  const actor = combat?.combatants.get(combatantId)?.actor;
  const current = tacticalState(combat).passiveBlocks?.[combatantId];
  if ((!game.user.isGM && !actor?.isOwner) || !entry || !actor || !current) return false;
  const weaponOptions = entry.choices.map((choice) => {
    const value = `${choice.weaponId}:${choice.modeKey}`;
    return `<option value="${escape(value)}" ${choice.weaponId === current.weaponId
      && choice.modeKey === current.modeKey ? "selected" : ""}>${escape(choice.weaponName)} (${choice.capacity})</option>`;
  }).join("");
  const locations = entry.locations.map((location) => `<label><input type="checkbox" class="sheet-state-box" name="location" value="${escape(location.id)}" ${current.locationIds?.includes(location.id) ? "checked" : ""}> ${escape(hitLocationDisplayName(location))}</label>`).join("");
  const resolution = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.PassiveBlock.Modify") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weaponOptions}</select></label><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</legend>${locations}</fieldset><label><input type="checkbox" class="sheet-state-box" name="crouched" ${current.crouched ? "checked" : ""}> ${escape(game.i18n.localize("MYTHRASF.Status.CrouchedBehindShield"))}</label></div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.PassiveBlock.Accept"),
      callback: (event, button) => ({ weapon: button.form.elements.weapon.value,
        locationIds: Array.from(button.form.querySelectorAll("input[name='location']:checked"),
          (control) => control.value), crouched: button.form.elements.crouched.checked }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel") }],
    rejectClose: false
  });
  if (!resolution) return false;
  const [weaponId, modeKey] = resolution.weapon.split(":");
  const weapon = actor.items.get(weaponId); const mode = weapon ? findWeaponMode(weapon, modeKey) : null;
  const choice = entry.choices.find((candidate) => candidate.weaponId === weaponId
    && candidate.modeKey === modeKey);
  resolution.crouched = Boolean(resolution.crouched && mode?.weaponType === "shield");
  const valid = validatePassiveBlock({ mode, locations: entry.locations,
    selectedIds: resolution.locationIds, crouched: resolution.crouched,
    baseCapacity: choice?.capacity ?? 0,
    checkContiguity: Boolean(getSystemSetting(SETTING_KEYS.passiveBlockContiguity)) });
  if (!weapon?.system.equipped || !choice || !valid.valid) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.PassiveBlock.Invalid")); return false;
  }
  if (current.crouchEffectId && actor.effects.get(current.crouchEffectId)) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", [current.crouchEffectId]);
  }
  let crouchEffectId = "";
  if (resolution.crouched) {
    const [effect] = await applyTimedCondition(actor, { key: "crouchedBehindShield",
      statusId: "crouchedBehindShield", name: game.i18n.localize("MYTHRASF.Status.CrouchedBehindShield"),
      img: "icons/svg/shield.svg", combat: { uuid: combat.uuid, round: combat.round },
      duration: { unit: "round", phase: "endRound" } });
    crouchEffectId = effect?.id ?? "";
  }
  const tactical = foundry.utils.deepClone(tacticalState(combat));
  tactical.passiveBlocks[combatantId] = { ...current, status: "active", round: combat.round,
    weaponId, modeKey, weaponName: weapon.name, weaponSize: mode.size, capacity: valid.capacity,
    locationIds: resolution.locationIds, crouched: resolution.crouched, crouchEffectId,
    reason: "gmCorrection", userId: game.user.id, updatedAt: Date.now(),
    revision: Number(current.revision ?? 0) + 1 };
  tactical.revision += 1; await combat.setFlag(SCOPE, "tacticalState", tactical); return true;
}

async function applyPassiveBlock(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "roundConsequences"));
  const entry = state?.queue.find((candidate) => candidate.id === request.entryId);
  const combat = state ? game.combats.get(state.combatId) : null;
  const combatant = combat?.combatants.get(entry?.combatantId); const actor = combatant?.actor;
  const user = game.users.get(request.userId);
  if (!state || !entry || entry.status !== "pending" || state.revision !== request.revision
    || !user || (!user.isGM && !actor?.testUserPermission(user, "OWNER"))) return;
  let resolution = { ...request.resolution };
  if (!resolution.waived) {
    const [weaponId, modeKey] = String(resolution.weapon).split(":");
    const weapon = actor.items.get(weaponId); const mode = weapon ? findWeaponMode(weapon, modeKey) : null;
    resolution.crouched = Boolean(resolution.crouched && mode?.weaponType === "shield");
    const choice = entry.choices?.find((candidate) => candidate.weaponId === weaponId
      && candidate.modeKey === modeKey);
    const locations = passiveBlockLocations(actor);
    entry.locations = locations;
    const valid = validatePassiveBlock({ mode, locations,
      selectedIds: resolution.locationIds ?? [], crouched: resolution.crouched,
      baseCapacity: choice?.capacity ?? 0,
      checkContiguity: Boolean(getSystemSetting(SETTING_KEYS.passiveBlockContiguity)) });
    if (!weapon?.system.equipped || !choice || !valid.valid) return ui.notifications.warn(
      game.i18n.localize("MYTHRASF.PassiveBlock.Invalid"));
    let crouchEffectId = "";
    if (resolution.crouched) {
      const [effect] = await applyTimedCondition(actor, { key: "crouchedBehindShield",
        statusId: "crouchedBehindShield", name: game.i18n.localize("MYTHRASF.Status.CrouchedBehindShield"),
        img: "icons/svg/shield.svg", combat: { uuid: combat.uuid, round: combat.round },
        duration: { unit: "round", phase: "endRound" } });
      crouchEffectId = effect?.id ?? "";
    }
    resolution = { ...resolution, weaponId, modeKey, weaponName: weapon.name,
      weaponSize: mode.size, capacity: valid.capacity, crouchEffectId };
    const tactical = foundry.utils.deepClone(tacticalState(combat));
    tactical.passiveBlocks[entry.combatantId] = { schemaVersion: 1, status: "active",
      round: combat.round, combatantId: entry.combatantId, actorUuid: actor.uuid,
      ...resolution, declaredBy: user.id, declaredAt: Date.now() };
    tactical.revision += 1; await combat.setFlag(SCOPE, "tacticalState", tactical);
  }
  entry.status = "resolved"; entry.resolution = resolution; state.revision += 1;
  await message.update({ content: renderRoundConsequences(state),
    rolls: appendSerializedRolls(message, request.resolution.serializedRoll,
      request.resolution.lossRoll),
    [`flags.${SCOPE}.roundConsequences`]: state });
  if (state.blocksRoundPreparation !== false
    && state.queue.every((candidate) => candidate.status === "resolved")) {
    await combat.completeRoundPreparation(state.queue);
  }
}

async function applyResolution(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "roundConsequences"));
  const entry = state?.queue.find((candidate) => candidate.id === request.entryId);
  if (!state || !entry || entry.status !== "pending" || state.revision !== request.revision) return;
  const actor = await fromUuid(entry.actorUuid).catch(() => null);
  const user = game.users.get(request.userId);
  if (!user || (!actor && !request.resolution.manual)
    || (actor && !user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  const fatigue = actor ? await applyFatigueLoss(actor, request.resolution.loss)
    : { before: null, after: null, loss: request.resolution.loss, missing: true };
  entry.status = "resolved"; entry.resolution = { ...request.resolution, ...fatigue,
    userId: user.id, resolvedAt: Date.now() }; state.revision += 1;
  await message.update({ content: renderRoundConsequences(state),
    rolls: appendSerializedRolls(message, request.resolution.serializedRoll,
      request.resolution.lossRoll),
    [`flags.${SCOPE}.roundConsequences`]: state });
  const combat = game.combats.get(state.combatId);
  if (combat && state.blocksRoundPreparation !== false
    && state.queue.every((candidate) => candidate.status === "resolved")) {
    await combat.completeRoundPreparation(state.queue);
  }
}

async function applyBurningResolution(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "roundConsequences"));
  const entry = state?.queue.find((candidate) => candidate.id === request.entryId
    && candidate.key === "burning");
  const combat = state ? game.combats.get(state.combatId) : null;
  const combatant = combat?.combatants.get(entry?.combatantId); const actor = combatant?.actor;
  const user = game.users.get(request.userId); const action = request.resolution?.action;
  if (!state || !entry || entry.status !== "pending" || state.revision !== request.revision
    || !actor || !user?.isGM || !["apply", "skip", "extinguish"].includes(action)) return;
  if (action === "apply") {
    const applied = await applyFireDamage(actor, request.resolution,
      { token: combatant.token, manual: request.manual });
    if (!applied) return;
  } else if (action === "extinguish") await extinguishFire(actor);
  entry.status = "resolved"; entry.resolution = { action, userId: user.id,
    resolvedAt: Date.now() }; state.revision += 1;
  await message.update({ content: renderRoundConsequences(state),
    [`flags.${SCOPE}.roundConsequences`]: state });
  if (state.blocksRoundPreparation !== false
    && state.queue.every((candidate) => candidate.status === "resolved")) {
    await combat.completeRoundPreparation(state.queue);
  }
}

async function applyAcidResolution(message, request) {
  const state = foundry.utils.deepClone(message.getFlag(SCOPE, "roundConsequences"));
  const entry = state?.queue.find((candidate) => candidate.id === request.entryId
    && candidate.key === "acidReview");
  const combat = state ? game.combats.get(state.combatId) : null;
  const combatant = combat?.combatants.get(entry?.combatantId); const actor = combatant?.actor;
  const effect = actor?.effects?.get?.(entry?.effectId)
    ?? acidEffects(actor).find((candidate) => candidate.id === entry?.effectId);
  const user = game.users.get(request.userId); const action = request.resolution?.action;
  if (!state || !entry || entry.status !== "pending" || state.revision !== request.revision
    || !actor || !effect || !user?.isGM || !["apply", "skip", "remove"].includes(action)) return;
  const current = acidReviewConfiguration(effect);
  const { action: _requestedAction, ...requestedConfiguration } = request.resolution;
  let configuration = action === "apply" ? { ...current, ...requestedConfiguration } : current;
  let damage = null;
  const next = current.exposure === "immersion" ? null
    : Math.max(0, Number(current.applicationsRemaining) - 1);
  configuration = { ...configuration, applicationsRemaining: next };
  if (action === "apply") {
    damage = await applyAcidDamage(actor, configuration,
      { token: combatant.token, manual: request.manual });
    if (!damage) return;
    configuration.locationIds = damage.configuration.locationIds;
    configuration.randomLocation = damage.configuration.randomLocation;
  }
  if (action === "remove" || (current.exposure === "splash" && next <= 0)) {
    await removeAcidEffect(actor, effect.id);
  } else if (action !== "remove") {
    const stored = acidCondition(effect) ?? { schemaVersion: 1,
      key: current.exposure === "immersion" ? ACID_IMMERSION_STATUS_ID : ACID_SPLASH_STATUS_ID,
      statusId: current.exposure === "immersion" ? ACID_IMMERSION_STATUS_ID : ACID_SPLASH_STATUS_ID,
      unit: "acidReview", phase: "startRound" };
    await effect.update({ [`flags.${TIMED_CONDITION_SCOPE}.${TIMED_CONDITION_FLAG}`]: {
      ...stored, ...configuration, combatUuid: combat.uuid, lastReviewedRound: combat.round
    } });
  }
  entry.status = "resolved"; entry.resolution = { action, damage,
    userId: user.id, resolvedAt: Date.now() }; state.revision += 1;
  await message.update({ content: renderRoundConsequences(state),
    [`flags.${SCOPE}.roundConsequences`]: state });
  if (state.blocksRoundPreparation !== false
    && state.queue.every((candidate) => candidate.status === "resolved")) {
    await combat.completeRoundPreparation(state.queue);
  }
}

export function activateRoundConsequenceCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.matches?.(".mythras-round-card") ? root : root?.querySelector?.(".mythras-round-card");
  const state = message.getFlag?.(SCOPE, "roundConsequences");
  if (!card || !state || card.dataset.active) return;
  card.dataset.active = "true";
  card.querySelectorAll("[data-gm-only]").forEach((button) => { button.hidden = !game.user.isGM; });
  for (const button of card.querySelectorAll("[data-round-action='roll']")) {
    const entry = state.queue.find((candidate) => candidate.id === button.dataset.entryId);
    if (!entry) continue;
    fromUuid(entry.actorUuid).then((actor) => { button.hidden = !game.user.isGM && !actor?.isOwner; });
  }
  for (const button of card.querySelectorAll("[data-round-action='luck']")) {
    roundFatigueLuckContext(game.user, state, button.dataset.entryId, { requirePoints: false })
      .then((context) => { button.hidden = !context.spenders.length; });
  }
  card.addEventListener("click", (event) => {
    const button = event.target.closest("[data-round-action]"); if (!button) return;
    if (button.dataset.roundAction === "luck") requestRoundFatigueLuck(message, state,
      button.dataset.entryId, event.shiftKey);
    else if (["block", "repeat-block", "waive"].includes(button.dataset.roundAction)) requestPassiveBlock(message,
      state, button.dataset.entryId, { waive: button.dataset.roundAction === "waive",
        repeat: button.dataset.roundAction === "repeat-block" });
    else if (button.dataset.roundAction.startsWith("fire-")) requestBurningResolution(message,
      state, button.dataset.entryId, button.dataset.roundAction.slice(5), event.shiftKey);
    else if (button.dataset.roundAction.startsWith("acid-")) requestAcidResolution(message,
      state, button.dataset.entryId, button.dataset.roundAction.slice(5), event.shiftKey);
    else requestResolution(message, state, button.dataset.entryId,
      button.dataset.roundAction === "manual", event.shiftKey);
  });
}

export function registerRoundConsequenceSocket() {
  game.socket.on(SOCKET, async (request) => {
    if (!["roundConsequence", "roundConsequenceLuck"].includes(request?.action)
      || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    const message = game.messages.get(request.messageId);
    if (!message) return;
    if (request.action === "roundConsequenceLuck") await applyRoundFatigueLuck(message, request);
    else await applyResolution(message, request);
  });
  game.socket.on(SOCKET, async (request) => {
    if (request?.action !== "roundPassiveBlock" || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    const message = game.messages.get(request.messageId); if (message) await applyPassiveBlock(message, request);
  });
  game.socket.on(SOCKET, async (request) => {
    if (request?.action !== "roundFire" || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    const message = game.messages.get(request.messageId);
    if (message) await applyBurningResolution(message, request);
  });
  game.socket.on(SOCKET, async (request) => {
    if (request?.action !== "roundAcid" || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    const message = game.messages.get(request.messageId);
    if (message) await applyAcidResolution(message, request);
  });
}
