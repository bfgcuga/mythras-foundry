import { classifyContestRoll } from "./contest-rolls.js";
import { evaluateAnimatedRoll } from "./dice-animation.js";
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

const SCOPE = "mythras-foundry";
const SOCKET = "system.mythras-foundry";
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function periodicConditionEntries(combat) {
  const entries = [];
  for (const combatant of combat?.combatants ?? []) {
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

export async function applyFatigueLoss(actor, loss) {
  const before = actor.system.fatigueLevel ?? "fresh";
  const after = worsenFatigueLevel(before, loss);
  if (after !== before) await actor.update({ "system.fatigueLevel": after });
  return { before, after, loss };
}

export async function prepareRoundConsequences(combat) {
  const economy = combat.mythrasTurnEconomy;
  const queue = [...periodicConditionEntries(combat), ...passiveBlockEntries(combat)]
    .map((entry) => ({ ...entry, round: combat.round }));
  for (const entry of queue.filter((candidate) => candidate.automatic)) {
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
  return ChatMessage.create({ content: renderRoundConsequences(state),
    flags: { [SCOPE]: { roundConsequences: state } } });
}

export function renderRoundConsequences(state) {
  const rows = state.queue.filter((entry) => entry.key !== "passiveBlock").map((entry) => `<div class="mythras-chat-row"><span>${escape(
    game.i18n.localize(`MYTHRASF.Status.${entry.key === "exsanguinating" ? "Exsanguinating"
      : entry.key === "bleeding" ? "Bleeding" : entry.key === "passiveBlock"
        ? "PassiveBlock" : "Drowning"}`))}</span><strong>${escape(
    game.i18n.localize(`MYTHRASF.RoundConsequence.${entry.status}`))}</strong>${entry.status === "pending"
      ? entry.key === "passiveBlock"
        ? `<button type="button" data-round-action="block" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Declare"))}</button><button type="button" data-round-action="waive" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.PassiveBlock.Waive"))}</button>`
        : `<button type="button" data-round-action="roll" data-entry-id="${escape(entry.id)}">${escape(game.i18n.localize("MYTHRASF.Roll"))}</button><button type="button" data-round-action="manual" data-entry-id="${escape(entry.id)}" data-gm-only>${escape(game.i18n.localize("MYTHRASF.CombatEffect.ResolveManual"))}</button>` : entry.resolution ? entry.key === "passiveBlock"
          ? `<span>${escape(entry.resolution.waived ? game.i18n.localize("MYTHRASF.PassiveBlock.Waived") : entry.resolution.weaponName)}</span>`
          : `<span>${escape(game.i18n.format("MYTHRASF.RoundConsequence.Fatigue", { loss: entry.resolution.loss ?? 0 }))}</span>` : ""}</div>`).join("");
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
  return `<section class="mythras-round-card mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.format("MYTHRASF.RoundConsequence.Title", { round: state.round }))}</div>${rows}${blockPanel}</section>`;
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
    const lossRoll = result === "failure" ? await evaluateAnimatedRoll("1d2",
      { speaker: ChatMessage.getSpeaker({ actor }) })
      : result === "fumble" ? await evaluateAnimatedRoll("1d3",
        { speaker: ChatMessage.getSpeaker({ actor }) }) : null;
    resolution = { manual: false, target: Number(skill.system.total ?? 0), rawRoll: roll.total,
      serializedRoll: roll.toJSON(), result,
      loss: fatigueLossForResult(result, lossRoll?.total ?? 1),
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
    [`flags.${SCOPE}.roundConsequences`]: state });
  const combat = game.combats.get(state.combatId);
  if (combat && state.queue.every((candidate) => candidate.status === "resolved")) {
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
}
