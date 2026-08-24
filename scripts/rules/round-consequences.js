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
import { tacticalState } from "./engagement-runtime.js";
import { actorDisplayName } from "./document-names.js";
import { ACID_IMMERSION_STATUS_ID, ACID_SPLASH_STATUS_ID, acidCondition, acidEffects,
  acidReviewConfiguration, applyAcidDamage, openAcidDialog, removeAcidEffect } from "./acid.js";
import { applyFireDamage, extinguishFire, fireEffectConfiguration,
  openFireDialog } from "./fire.js";
import { uniqueActorEntries } from "./combat-turns.js";
import { prepareSuffocationEntry } from "./suffocation.js";
import { advanceCombatFatigue, COMBAT_FATIGUE_FLAG, COMBAT_FATIGUE_SCOPE,
  combatFatigueInterval, combatFatigueLoss } from "./combat-fatigue.js";
import { prepareDyingEntry } from "./dying.js";

const SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

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

export function passiveBlockEntries(combat) {
  const entries = [];
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor; if (!actor || combatant.isDefeated) continue;
    const prepared = actor.items.filter((item) => item.type === "weapon" && item.system.equipped)
      .map((weapon) => ({ weapon, mode: findWeaponMode(weapon) }))
      .filter(({ mode }) => Boolean(mode));
    const dualWield = prepared.filter(({ mode }) => !isNaturalWeaponMode(mode)
      && ["melee", "shield"].includes(mode.weaponType) && Number(mode.handsRequired) === 1).length >= 2;
    const choices = prepared.filter(({ mode }) => passiveBlockCapacity(mode, { dualWield }) > 0)
        .map(({ weapon, mode }) => ({ weaponId: weapon.id, weaponName: weapon.name, modeKey: mode.key,
          modeName: mode.name, weaponSize: mode.size, weaponType: mode.weaponType,
          capacity: passiveBlockCapacity(mode, { dualWield }) }));
    if (!choices.length) continue;
    entries.push({ id: `${combatant.id}:passive-block`, combatantId: combatant.id,
      actorUuid: actor.uuid, actorName: actorDisplayName(actor), key: "passiveBlock",
      automatic: false, status: "pending",
      choices, locations: actor.items.filter((item) => item.type === "hitLocation")
        .sort((a, b) => Number(a.system.rangeStart) - Number(b.system.rangeStart))
        .map((item) => ({ id: item.id, name: item.name, rangeStart: item.system.rangeStart,
          category: item.system.category, hpClass: item.system.hpClass })) });
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

async function prepareCombatFatigueEntries(combat, previous) {
  const entries = [];
  const showNpcChecks = Boolean(getSystemSetting(SETTING_KEYS.showNpcCombatFatigueChecks));
  for (const combatant of uniqueActorEntries(combat?.combatants)) {
    const actor = combatant.actor;
    if (!actor || combatant.isDefeated || !["character", "npc"].includes(actor.type)) continue;
    const interval = combatFatigueInterval(actor.system.constitution);
    const currentState = combatant.getFlag?.(COMBAT_FATIGUE_SCOPE, COMBAT_FATIGUE_FLAG);
    const advanced = advanceCombatFatigue(currentState,
      { combatId: combat.id, round: combat.round, interval });
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
    if (Number(currentState?.resolvedRound) === Number(combat.round)) {
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
    const target = Number(skill.system.total ?? 0);
    const result = classifyContestRoll(roll.total, target);
    await recordAbilityFumble(skill, result);
    const loss = combatFatigueLoss(result);
    const fatigue = await applyFatigueLoss(actor, loss);
    entry.status = "resolved";
    entry.resolution = { target, rawRoll: roll.total, serializedRoll: roll.toJSON(), result,
      loss, before: fatigue.before, after: fatigue.after };
    await combatant.setFlag(COMBAT_FATIGUE_SCOPE, COMBAT_FATIGUE_FLAG, {
      ...advanced.state, resolvedRound: combat.round, resolution: entry.resolution
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
  const combatFatigue = await prepareCombatFatigueEntries(combat, previous);
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
  if (queue.length) await createRoundMessage(combat, queue);
  return queue;
}

async function createRoundMessage(combat, queue) {
  const state = { schemaVersion: 1, combatId: combat.id, combatUuid: combat.uuid,
    round: combat.round, revision: 0, queue };
  const rolls = queue.flatMap((entry) => entry.resolution?.serializedRoll
    ? [Roll.fromData(entry.resolution.serializedRoll)] : []);
  return ChatMessage.create({ content: renderRoundConsequences(state), rolls,
    flags: { [SCOPE]: { roundConsequences: state } } });
}

export function renderRoundConsequences(state) {
  const rows = state.queue.filter((entry) => !["passiveBlock", "burning", "acidReview"].includes(entry.key)).map((entry) => `<div class="mythras-chat-row"><span>${escape(
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
  const blocks = state.queue.filter((entry) => entry.key === "passiveBlock").map((entry) => {
    const status = entry.status === "pending" ? game.i18n.localize("MYTHRASF.PassiveBlock.Pending")
      : entry.resolution?.waived ? game.i18n.localize("MYTHRASF.PassiveBlock.Passed")
        : game.i18n.localize("MYTHRASF.PassiveBlock.Declared");
    const locationNames = (entry.resolution?.locationIds ?? []).map((id) =>
      entry.locations.find((location) => location.id === id)?.name).filter(Boolean);
    const detail = entry.resolution && !entry.resolution.waived
      ? ` — ${entry.resolution.weaponName}: ${locationNames.join(", ")}` : "";
    const actions = entry.status === "pending"
      ? `<button type="button" data-round-action="block" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Declare"))}</button><button type="button" data-round-action="waive" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Waive"))}</button>` : "";
    return `<div class="mythras-chat-row"><span>${escape(entry.actorName)}</span><strong>${escape(status + detail)}</strong>${actions}</div>`;
  }).join("");
  const blockPanel = blocks ? `<fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Status.PassiveBlock"))}</legend>${blocks}</fieldset>` : "";
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
  return `<section class="mythras-round-card mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.format("MYTHRASF.RoundConsequence.Title", { round: state.round }))}</div>${rows}${acidPanel}${firePanel}${blockPanel}</section>`;
}

async function requestAcidResolution(message, state, entryId, action) {
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
    entryId, userId: game.user.id, resolution };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyAcidResolution(message, request);
  else game.socket.emit(SOCKET, request);
}

async function requestBurningResolution(message, state, entryId, action) {
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
    entryId, userId: game.user.id, resolution };
  if (game.mythrasFoundry?.combat?.isCoordinator?.()) await applyBurningResolution(message, request);
  else game.socket.emit(SOCKET, request);
}

async function requestResolution(message, state, entryId, manual) {
  const entry = state.queue.find((candidate) => candidate.id === entryId);
  const actor = entry ? await fromUuid(entry.actorUuid).catch(() => null) : null;
  if (!entry || (!actor && !manual) || (!game.user.isGM && !actor?.isOwner)) return;
  let resolution;
  if (manual) {
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
    const roll = await evaluateAnimatedRoll("1d100", { speaker: ChatMessage.getSpeaker({ actor }) });
    const result = classifyContestRoll(roll.total, Number(skill.system.total ?? 0));
    await recordAbilityFumble(skill, result);
    const lossRoll = entry.key !== "combatFatigue" && result === "failure" ? await evaluateAnimatedRoll("1d2",
      { speaker: ChatMessage.getSpeaker({ actor }) })
      : entry.key !== "combatFatigue" && result === "fumble" ? await evaluateAnimatedRoll("1d3",
        { speaker: ChatMessage.getSpeaker({ actor }) }) : null;
    resolution = { manual: false, target: Number(skill.system.total ?? 0), rawRoll: roll.total,
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

async function requestPassiveBlock(message, state, entryId, waive = false) {
  const entry = state.queue.find((candidate) => candidate.id === entryId);
  const actor = entry ? await fromUuid(entry.actorUuid).catch(() => null) : null;
  if (!entry || entry.key !== "passiveBlock" || (!game.user.isGM && !actor?.isOwner)) return;
  let resolution = { waived: true };
  if (!waive) {
    const weaponOptions = entry.choices.map((choice) => `<option value="${escape(`${choice.weaponId}:${choice.modeKey}`)}">${escape(choice.weaponName)} (${choice.capacity})</option>`).join("");
    const locations = entry.locations.map((location) => `<label><input type="checkbox" name="location" value="${escape(location.id)}"> ${escape(location.name)}</label>`).join("");
    resolution = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("MYTHRASF.PassiveBlock.Declare") },
      content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weaponOptions}</select></label><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</legend>${locations}</fieldset><label><input type="checkbox" name="crouched"> ${escape(game.i18n.localize("MYTHRASF.Status.CrouchedBehindShield"))}</label></div>`,
      buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.CombatEffect.Confirm"),
        callback: (event, button) => ({ waived: false, weapon: button.form.elements.weapon.value,
          locationIds: Array.from(button.form.querySelectorAll("input[name='location']:checked")).map((control) => control.value),
          crouched: button.form.elements.crouched.checked }) }], rejectClose: false });
    if (!resolution) return;
  }
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
  return requestPassiveBlock(message, state, entry.id, false);
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
  const locations = entry.locations.map((location) => `<label><input type="checkbox" class="sheet-state-box" name="location" value="${escape(location.id)}" ${current.locationIds?.includes(location.id) ? "checked" : ""}> ${escape(location.name)}</label>`).join("");
  const resolution = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.PassiveBlock.Modify") },
    content: `<div class="mythras-foundry mythras-dialog"><label><span>${escape(game.i18n.localize("MYTHRASF.Weapon.Name"))}</span><select name="weapon">${weaponOptions}</select></label><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.HitLocations"))}</legend>${locations}</fieldset><label><input type="checkbox" class="sheet-state-box" name="crouched" ${current.crouched ? "checked" : ""}> ${escape(game.i18n.localize("MYTHRASF.Status.CrouchedBehindShield"))}</label></div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.CombatEffect.Confirm"),
      callback: (event, button) => ({ weapon: button.form.elements.weapon.value,
        locationIds: Array.from(button.form.querySelectorAll("input[name='location']:checked"),
          (control) => control.value), crouched: button.form.elements.crouched.checked }) }],
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
    const locations = entry.locations; const valid = validatePassiveBlock({ mode, locations,
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
  if (state.queue.every((candidate) => candidate.status === "resolved")) {
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
  if (combat && state.queue.every((candidate) => candidate.status === "resolved")) {
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
    const applied = await applyFireDamage(actor, request.resolution, { token: combatant.token });
    if (!applied) return;
  } else if (action === "extinguish") await extinguishFire(actor);
  entry.status = "resolved"; entry.resolution = { action, userId: user.id,
    resolvedAt: Date.now() }; state.revision += 1;
  await message.update({ content: renderRoundConsequences(state),
    [`flags.${SCOPE}.roundConsequences`]: state });
  if (state.queue.every((candidate) => candidate.status === "resolved")) {
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
    damage = await applyAcidDamage(actor, configuration, { token: combatant.token });
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
  if (state.queue.every((candidate) => candidate.status === "resolved")) {
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
  card.addEventListener("click", (event) => {
    const button = event.target.closest("[data-round-action]"); if (!button) return;
    if (["block", "waive"].includes(button.dataset.roundAction)) requestPassiveBlock(message,
      state, button.dataset.entryId, button.dataset.roundAction === "waive");
    else if (button.dataset.roundAction.startsWith("fire-")) requestBurningResolution(message,
      state, button.dataset.entryId, button.dataset.roundAction.slice(5));
    else if (button.dataset.roundAction.startsWith("acid-")) requestAcidResolution(message,
      state, button.dataset.entryId, button.dataset.roundAction.slice(5));
    else requestResolution(message, state, button.dataset.entryId, button.dataset.roundAction === "manual");
  });
}

export function registerRoundConsequenceSocket() {
  game.socket.on(SOCKET, async (request) => {
    if (request?.action !== "roundConsequence" || !game.mythrasFoundry?.combat?.isCoordinator?.()) return;
    const message = game.messages.get(request.messageId); if (message) await applyResolution(message, request);
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
