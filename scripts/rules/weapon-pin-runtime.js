import { activeGrabs, grabData } from "./grappling.js";
import { strengthContestAdjustment } from "./strength-contests.js";
import { PIN_SCOPE, pinnableWeapons, releaseWeaponSkills, resolveWeaponRelease, weaponPinData, weaponPins
} from "./weapon-pinning.js";
import { applyTimedCondition } from "./timed-condition-runtime.js";
import { currentActionPoints } from "./action-points.js";
import { classifyContestRoll } from "./contest-rolls.js";
import { resolveActorConditions, actorLoadState } from "./actor-conditions.js";
import { difficultyTarget } from "./combat.js";
import { evaluateSystemRoll } from "./system-roll.js";
import { appendSerializedRolls } from "./dice-animation.js";
import { recordAbilityFumble } from "./skills.js";
import { actorDisplayName } from "./document-names.js";

const localize = (key) => game.i18n.localize(`MYTHRASF.Pin.${key}`);
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const queues = new Map();
const restraints = (actor, kind) => kind === "grab" ? activeGrabs(actor) : weaponPins(actor);
const choiceName = (kind) => localize(kind === "grab" ? "Holder" : "ChooseWeapon");
const releaseName = (kind) => kind === "grab" ? game.i18n.localize("MYTHRASF.Grab.Release") : localize("Release");
const coordinator = () => game.users.filter((user) => user.active && user.isGM)
  .sort((a, b) => a.id.localeCompare(b.id))[0]?.id;
const entryFor = (combat, side) => side === "attacker" ? combat?.attacker : combat?.defender;
async function resolveActor(entry) {
  const token = entry?.tokenUuid ? await fromUuid(entry.tokenUuid) : null;
  return token?.actor ?? (entry?.actorUuid ? await fromUuid(entry.actorUuid) : null);
}

export function pinConsequenceHtml(entry, index) {
  if (entry.key !== "pinWeapon") return "";
  if (entry.status === "resolved") return `<div class="mythras-chat-total"><span>${escape(
    localize("Title"))}</span><strong>${escape(entry.weaponName
      ? game.i18n.format("MYTHRASF.Pin.Applied", { weapon: entry.weaponName })
      : localize("NoWeapon"))}</strong></div>`;
  return `<div><label>${escape(localize("ChooseWeapon"))}<select data-pin-weapon="${index}">${
    entry.weapons.map((weapon) => `<option value="${escape(weapon.id)}">${escape(weapon.name)}</option>`).join("")
  }</select></label><button type="button" data-pin-action="pin" data-pin-index="${index}" title="${
    escape(localize("Title"))}">${escape(localize("Title"))}</button></div>`;
}

export async function applyWeaponPin(actor, weaponId, source, messageUuid) {
  const weapon = pinnableWeapons(actor).find((item) => item.id === weaponId);
  if (!weapon || !source?.actorUuid) return false;
  await applyTimedCondition(actor, { key: "weaponPinned", statusId: "weaponPinned",
    name: `${localize("Title")} — ${weapon.name}`, img: "icons/svg/net.svg",
    source: { actorUuid: source.actorUuid, tokenUuid: source.tokenUuid,
      name: source.actorName, messageUuid }, duration: { unit: "manual", phase: "manual" },
    metadata: { weaponId: weapon.id } });
  return true;
}

export async function openWeaponPinAssignment(actor, kind = "weapon") {
  if (!game.user.isGM) return;
  const weapons = pinnableWeapons(actor);
  const candidates = [...new Map([
    ...Array.from(globalThis.canvas?.tokens?.placeables ?? []).map((token) => token.actor),
    ...Array.from(game.actors ?? [])].filter((entry) => entry && entry.uuid !== actor.uuid
      && ["character", "npc"].includes(entry.type)).map((entry) => [entry.uuid, entry])).values()];
  if ((kind !== "grab" && !weapons.length) || !candidates.length) return ui.notifications.warn(localize("NoWeapon"));
  const title = kind === "grab" ? game.i18n.localize("MYTHRASF.Status.Grabbed") : localize("Title");
  const choice = await foundry.applications.api.DialogV2.wait({ window: { title },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(title)}</legend><label ${kind === "grab" ? "hidden" : ""}>${escape(localize("ChooseWeapon"))}<select name="weapon">${weapons.map((weapon) => `<option value="${escape(weapon.id)}">${escape(weapon.name)}</option>`).join("")}</select></label><label>${escape(localize("Holder"))}<select name="holder">${candidates.map((entry) => `<option value="${escape(entry.uuid)}">${escape(actorDisplayName(entry))}</option>`).join("")}</select></label></fieldset></div>`,
    buttons: [{ action: "apply", label: title, callback: (event, button) => ({
      weaponId: button.form.elements.weapon.value, holderUuid: button.form.elements.holder.value }) },
      { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false });
  const holder = candidates.find((entry) => entry.uuid === choice?.holderUuid);
  if (holder && kind === "grab") return applyTimedCondition(actor, { key: "grabbed", statusId: "grabbed",
    name: game.i18n.localize("MYTHRASF.Status.Grabbed"), img: "icons/svg/net.svg",
    source: { actorUuid: holder.uuid, tokenUuid: holder.token?.uuid ?? "", name: actorDisplayName(holder) },
    duration: { unit: "manual", phase: "manual" } });
  if (holder) return applyWeaponPin(actor, choice.weaponId, { actorUuid: holder.uuid,
    actorName: actorDisplayName(holder), tokenUuid: holder.token?.uuid ?? "" }, "");
}

function renderRelease(state) {
  const rows = ["victim", "holder"].map((side) => {
    const entry = state[side]; const roll = entry.roll;
    return `<fieldset><legend>${escape(entry.name)}</legend>${roll
      ? `<div class="mythras-chat-row"><span>${escape(roll.abilityName)}${roll.strengthSteps ? ` — ${escape(game.i18n.format("MYTHRASF.Contest.StrengthPenalty", { steps: roll.strengthSteps }))}` : ""} (1d100 / ${roll.target}%)</span><strong class="mythras-chat-result--${roll.result}"><span class="mythras-chat-roll-value">${roll.rawRoll}</span> ${escape(game.i18n.localize(`MYTHRASF.RollResult.${roll.result}`))}</strong></div>`
      : `<button type="button" data-pin-action="roll" data-pin-side="${side}" title="${escape(localize("ChooseSkill"))}">${escape(localize("ChooseSkill"))}</button>`}</fieldset>`;
  }).join("");
  return `<section class="mythras-chat-card" data-pin-release><div class="mythras-chat-title">${escape(releaseName(state.kind))} — ${escape(state.weaponName)}</div><div class="mythras-chat-row"><span>${escape(localize("Cost"))}</span><strong>1</strong></div>${rows}${state.status === "resolved"
    ? `<div class="mythras-chat-total mythras-chat-result--${state.freed ? "success" : "failure"}"><span>${escape(localize("Outcome"))}</span><strong>${escape(state.kind === "grab" ? game.i18n.localize(`MYTHRASF.Grab.${state.freed ? "Freed" : "Held"}`) : localize(state.freed ? "Freed" : "Held"))}</strong></div>` : ""}</section>`;
}

export const requestGrabRelease = (actor) => requestWeaponRelease(actor, "grab");

export async function requestWeaponRelease(actor, kind = "weapon") {
  if (!actor?.isOwner && !game.user.isGM) return;
  const pins = restraints(actor, kind);
  if (!pins.length) return;
  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: releaseName(kind) },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(choiceName(kind))}</legend><select name="pin" aria-label="${escape(choiceName(kind))}">${pins.map((effect) => `<option value="${escape(effect.id)}">${escape(kind === "grab" ? grabData(effect).sourceName : actor.items.get(weaponPinData(effect).weaponId)?.name)}</option>`).join("")}</select></fieldset></div>`,
    buttons: [{ action: "start", label: releaseName(kind), callback: (event, button) => button.form.elements.pin.value },
      { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false });
  if (!selected) return;
  await submit({ operation: "start", kind, actorUuid: actor.uuid, effectId: selected,
    combatId: (game.combat ?? game.combats?.active)?.id });
}

async function submit(request) {
  if (!coordinator()) return ui.notifications.warn(localize("GMRequired"));
  request = { ...request, action: "weaponPin", userId: game.user.id };
  if (coordinator() === game.user.id) return enqueue(request);
  game.socket.emit(`system.${PIN_SCOPE}`, request);
}

async function startRelease(request, user) {
  const actor = await fromUuid(request.actorUuid);
  const combat = game.combats.get(request.combatId);
  const active = combat?.combatant;
  if (!actor || !combat?.started || active?.actor?.uuid !== actor.uuid
    || (!user.isGM && !actor.testUserPermission(user, "OWNER")) || currentActionPoints(actor) < 1) return;
  const kind = request.kind === "grab" ? "grab" : "weapon";
  const effect = restraints(actor, kind).find((entry) => entry.id === request.effectId);
  if (!effect) return;
  if (!resolveActorConditions(actor, { baseAttributes: actor.system.baseAttributes
    ?? actor.system.attributes ?? {} }).capabilities.canTakeProactiveTurn) return;
  const data = weaponPinData(effect);
  const holder = await resolveActor({ actorUuid: data.sourceActorUuid, tokenUuid: data.sourceTokenUuid });
  if (!holder || !releaseWeaponSkills(holder).length || !releaseWeaponSkills(actor).length) {
    return ui.notifications.warn(localize("MissingSkill"));
  }
  if (game.messages.some((message) => { const state = message.getFlag(PIN_SCOPE, "weaponRelease");
    return state?.status === "pending" && state.victim.actorUuid === actor.uuid
      && restraints(actor, state.kind).some((pin) => pin.id === state.effectId);
  })) return;
  const state = { revision: 0, status: "pending", kind, effectId: effect.id,
    weaponName: kind === "grab" ? actorDisplayName(holder) : actor.items.get(data.weaponId).name, combatId: combat.id,
    combatantId: active.id, round: combat.round, turn: combat.turn,
    victim: { actorUuid: actor.uuid, tokenUuid: actor.token?.uuid ?? "", name: actorDisplayName(actor) },
    holder: { actorUuid: holder.uuid, tokenUuid: data.sourceTokenUuid, name: actorDisplayName(holder) } };
  await actor.update({ "system.resources.actionPoints.value": currentActionPoints(actor) - 1 });
  try {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: renderRelease(state),
      flags: { [PIN_SCOPE]: { weaponRelease: state } } });
  } catch (error) {
    await actor.update({ "system.resources.actionPoints.value": currentActionPoints(actor) + 1 });
    throw error;
  }
}

export async function applyWeaponPinRequest(request) {
  const user = game.users.get(request.userId); if (!user) return;
  if (request.operation === "start") return startRelease(request, user);
  const message = game.messages.get(request.messageId); if (!message) return;
  if (request.operation === "pin") {
    const combat = foundry.utils.deepClone(message.getFlag(PIN_SCOPE, "combat"));
    const entry = combat?.consequences?.[request.index];
    if (!entry || entry.key !== "pinWeapon" || entry.status !== "pending"
      || combat.revision !== request.revision || combat.status === "cancelled") return;
    const source = entryFor(combat, entry.actorSide);
    const owner = await resolveActor(source); const victim = await resolveActor(entryFor(combat, entry.victimSide));
    if (!owner || !victim || (!user.isGM && !owner.testUserPermission(user, "OWNER"))) return;
    if (!entry.weapons.some((weapon) => weapon.id === request.weaponId)
      || !await applyWeaponPin(victim, request.weaponId, source, message.uuid)) return;
    entry.status = "resolved"; entry.weaponName = victim.items.get(request.weaponId).name;
    combat.consequencesApplied = true; combat.revision += 1;
    const { renderCombatExchange } = await import("./combat-chat-renderer.js");
    await message.update({ content: renderCombatExchange(combat), [`flags.${PIN_SCOPE}.combat`]: combat });
    return;
  }
  const state = foundry.utils.deepClone(message.getFlag(PIN_SCOPE, "weaponRelease"));
  if (!state || state.status !== "pending" || !Number.isInteger(request.revision)
    || request.revision < 0 || request.revision > state.revision
    || request.operation !== "roll" || !["victim", "holder"].includes(request.side)) return;
  const entry = state[request.side]; const actor = await resolveActor(entry);
  if (!actor || entry.roll || (!user.isGM && !actor.testUserPermission(user, "OWNER"))) return;
  const victimNow = await resolveActor(state.victim);
  if (!restraints(victimNow, state.kind).some((effect) => effect.id === state.effectId)) return;
  const skill = releaseWeaponSkills(actor).find((item) => item.id === request.skillId);
  if (!skill) return;
  const roll = await evaluateSystemRoll("1d100");
  const conditions = resolveActorConditions(actor, { baseAttributes: actor.system.baseAttributes
    ?? actor.system.attributes ?? {}, physical: true, loadState: actorLoadState(actor) });
  const other = await resolveActor(state[request.side === "victim" ? "holder" : "victim"]);
  const strength = strengthContestAdjustment({ abilitySlug: skill.system.slug,
    damageModifier: actor.system.attributes?.damageModifier, baseTarget: skill.system.total,
    difficulty: conditions.difficulty, target: difficultyTarget(skill.system.total, conditions.difficulty) },
  [{ damageModifier: other?.system.attributes?.damageModifier }]);
  const target = strength.target;
  const result = classifyContestRoll(roll.total, target);
  await recordAbilityFumble(skill, result);
  entry.roll = { rawRoll: roll.total, target, result, abilityName: skill.name,
    strengthSteps: strength.steps, strengthDifficulty: strength.difficulty };
  if (state.victim.roll && state.holder.roll) {
    const outcome = resolveWeaponRelease(state.victim.roll, state.holder.roll);
    state.freed = outcome.freed;
    state.victim.roll = outcome.victim; state.holder.roll = outcome.holder;
    const victim = await resolveActor(state.victim);
    if (state.freed && restraints(victim, state.kind).some((effect) => effect.id === state.effectId)) {
      await victim.deleteEmbeddedDocuments("ActiveEffect", [state.effectId]);
    }
    state.status = "resolved";
  }
  state.revision += 1;
  await message.update({ content: renderRelease(state), rolls: appendSerializedRolls(message, roll.toJSON()),
    [`flags.${PIN_SCOPE}.weaponRelease`]: state });
  const combat = game.combats.get(state.combatId);
  if (state.status === "resolved" && combat?.combatant?.id === state.combatantId
    && combat.round === state.round && combat.turn === state.turn) await combat.nextTurn();
}

function enqueue(request) {
  const key = request.actorUuid ?? request.messageId;
  const promise = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(() => applyWeaponPinRequest(request));
  queues.set(key, promise);
  return promise.finally(() => { if (queues.get(key) === promise) queues.delete(key); });
}

export function registerWeaponPinSocket() {
  game.socket.on(`system.${PIN_SCOPE}`, (request) => {
    if (request?.action === "weaponPin" && coordinator() === game.user.id) enqueue(request);
  });
}

export function activateWeaponPinCard(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  root?.querySelectorAll?.("[data-pin-action]").forEach(async (button) => {
    const release = message.getFlag(PIN_SCOPE, "weaponRelease");
    const combat = message.getFlag(PIN_SCOPE, "combat");
    const index = Number(button.dataset.pinIndex); const side = button.dataset.pinSide;
    const actorEntry = release?.[side] ?? entryFor(combat, combat?.consequences?.[index]?.actorSide);
    const actor = await resolveActor(actorEntry);
    button.hidden = !actor || (!game.user.isGM && !actor.isOwner);
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      if (button.dataset.pinAction === "pin") return submit({ operation: "pin", messageId: message.id,
        revision: combat.revision, index, weaponId: root.querySelector(`[data-pin-weapon="${index}"]`)?.value });
      const skills = releaseWeaponSkills(actor);
      const skillId = await foundry.applications.api.DialogV2.wait({ window: { title: localize("ChooseSkill") },
        content: `<div class="mythras-foundry mythras-dialog"><label>${escape(localize("ChooseSkill"))}<select name="skill">${skills.map((skill) => `<option value="${escape(skill.id)}">${escape(skill.name)} (${Number(skill.system.total ?? 0)}%)</option>`).join("")}</select></label></div>`,
        buttons: [{ action: "roll", label: game.i18n.localize("MYTHRASF.Roll"), callback: (event, control) => control.form.elements.skill.value },
          { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false });
      if (skillId) await submit({ operation: "roll", messageId: message.id, revision: release.revision, side, skillId });
    });
  });
}
