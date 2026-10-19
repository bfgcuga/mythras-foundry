import { hazardActors, hazardProfile, resolveHazardContest } from "./hazard-items.js";
import { evaluateSystemRoll } from "./system-roll.js";
import { openSkillRollDialog } from "../apps/skill-roll-dialog.js";
import { resolveSkillRollConditions } from "./skill-roll-resolution.js";
import { recordAbilityFumble } from "./skills.js";
import { actorDisplayName, actorSpeaker } from "./document-names.js";
import { applyDirectDamage } from "./direct-damage.js";
import { findHitLocation, hitLocationDisplayName } from "./hit-locations.js";
import { totalArmorPoints } from "./armor.js";
import { renderRollResult, rollThresholdRanges } from "../documents/mythras-item.js";

const localize = (key) => game.i18n.localize(`MYTHRASF.Hazard.${key}`);
const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const row = (label, value, css = "") => `<div class="mythras-chat-row"><span>${escape(label)}</span><strong class="${css}">${escape(value)}</strong></div>`;
const actors = () => hazardActors(Array.from(game.actors ?? []), globalThis.canvas?.tokens?.placeables ?? []);
const allowed = (item) => item?.visible !== false && ["trap", "poison", "disease"].includes(item?.type);

export async function applyHazardStatus(item, actor) {
  if (!allowed(item) || !actor?.isOwner || !["character", "npc"].includes(actor.type)) return null;
  const statusId = item.type === "poison" ? "poison" : item.type === "disease" ? "disease" : null;
  if (!statusId) return null;
  if (!actor.statuses?.has(statusId)) await actor.toggleStatusEffect(statusId, { active: true });
  return statusId;
}

export async function openHazardApplication(item) {
  if (!allowed(item) || !["poison", "disease"].includes(item.type)) return null;
  const available = actors();
  if (!available.length) { ui.notifications.warn(localize("NoActor")); return null; }
  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: `${item.name}: ${localize("Apply")}` },
    content: `<div class="mythras-foundry mythras-dialog"><label>${escape(localize("Target"))}<select name="actor">${available.map((actor, index) => `<option value="${index}">${escape(actorDisplayName(actor))}</option>`).join("")}</select></label><p>${escape(localize("StatusAutomation"))}</p></div>`,
    buttons: [{ action: "apply", label: localize("Apply"), default: true,
      callback: (event, button) => Number(button.form.elements.actor.value) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false
  });
  if (selected == null) return null;
  const actor = available[selected];
  const statusId = await applyHazardStatus(item, actor);
  if (!statusId) return null;
  await ChatMessage.create({ speaker: actorSpeaker(actor),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(item.name)}</div>${row(localize("Target"), actorDisplayName(actor))}${row(localize("StatusApplied"), game.i18n.localize(`MYTHRASF.Status.${statusId === "poison" ? "Poisoned" : "Diseased"}`))}<p>${escape(localize("ManualConsequences"))}</p></section>` });
  return statusId;
}

function profileOptions(item) {
  return [{ value: -1, name: localize("Base") }, ...(item.system.variants ?? [])
    .map((variant, index) => ({ value: index, name: variant.name }))]
    .map(({ value, name }) => `<option value="${value}">${escape(name)}</option>`).join("");
}

function profileRows(profile) {
  const fields = ["resistance", "onset", "duration", "conditions", "effect", "cure", "notes"]
    .filter((key) => profile[key]).map((key) => row(localize(key), profile[key])).join("");
  const stages = (profile.stages ?? []).filter((stage) => !profile.name || !stage.variant || stage.variant === profile.name)
    .map((stage) => `<fieldset><legend>${escape(stage.name || localize("Stage"))}</legend>${["variant", "onset", "interval", "conditions", "effect"]
      .filter((key) => stage[key]).map((key) => row(localize(key), stage[key])).join("")}</fieldset>`).join("");
  return fields + stages;
}

export async function rollHazardCheck(item, action = "resist", { manual = false } = {}) {
  if (!allowed(item) || !["detect", "disarm", "resist"].includes(action)) return null;
  const available = actors();
  const abilities = available.flatMap((actor) => actor.items.filter((ability) =>
    ["skill", "combatStyle"].includes(ability.type)).map((ability) => ({ actor, ability })));
  if (!abilities.length) { ui.notifications.warn(localize("NoActor")); return null; }
  const defaultSlug = action === "detect" ? "percepcion" : action === "disarm"
    ? "mecanismos" : item.system.resistanceSkill;
  const selection = await foundry.applications.api.DialogV2.wait({
    window: { title: `${item.name}: ${localize(action)}` },
    content: `<div class="mythras-foundry mythras-dialog"><label>${escape(localize("Variant"))}<select name="variant">${profileOptions(item)}</select></label>
      <label>${escape(localize("Ability"))}<select name="ability">${abilities.map(({ actor, ability }, index) =>
        `<option value="${index}" ${ability.system.slug === defaultSlug ? "selected" : ""}>${escape(actorDisplayName(actor))} — ${escape(ability.name)} (${Number(ability.system.total)}%)</option>`).join("")}</select></label>
      <p>${escape(item.system.resistance)}</p><p>${escape(localize("ManualConsequences"))}</p></div>`,
    buttons: [{ action: "roll", label: localize("Roll"), default: true,
      callback: (event, button) => ({ ability: Number(button.form.elements.ability.value),
        variant: Number(button.form.elements.variant.value) }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false
  });
  if (!selection) return null;
  const chosen = abilities[selection.ability];
  if (!chosen?.actor.isOwner) return null;
  const { actor, ability } = chosen;
  const profile = hazardProfile(item, selection.variant);
  const conditions = resolveSkillRollConditions(actor, ability);
  const configured = await openSkillRollDialog(ability, { includeContest: false,
    title: `${item.name}: ${localize(action)}`,
    defaultDifficulty: action === "resist" ? profile.resistanceDifficulty || "standard" : "standard",
    imposedDifficulty: conditions.difficulty,
    modifiers: conditions.modifiers,
    additionalContent: `<p>${escape(profile.resistance)}</p>${profileRows(profile)}` });
  if (!configured || !actor.isOwner) return null;
  if (["automatic", "impossible"].includes(configured.targets.difficulty)) {
    ui.notifications.info(game.i18n.localize(`MYTHRASF.RollResult.${configured.targets.difficulty}`));
    return null;
  }
  const actorRoll = await evaluateSystemRoll("1d100", { manual });
  const hazardRoll = await evaluateSystemRoll("1d100", { manual });
  const resolution = resolveHazardContest({ actorTarget: configured.targets.target,
    hazardTarget: item.type === "trap" ? item.system.difficulty : item.system.potency,
    actorRoll: actorRoll.total, hazardRoll: hazardRoll.total });
  const [participant, hazard] = resolution.participants;
  const comparison = resolution.comparisons[0];
  await recordAbilityFumble(ability, participant.result);
  const outcome = comparison.repeatable ? "Repeat" : comparison.winnerId === "actor" ? "Success" : "Failure";
  const statusId = action === "resist" && !comparison.repeatable && comparison.winnerId === "hazard"
    ? await applyHazardStatus(item, actor) : null;
  await ChatMessage.create({ speaker: actorSpeaker(actor), rolls: [actorRoll, hazardRoll],
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(item.name)}: ${escape(localize(action))}</div>
      ${selection.variant >= 0 ? row(localize("Variant"), profile.name) : ""}
      ${row(localize("Ability"), `${ability.name}: ${configured.targets.baseTarget}% → ${participant.target}%`)}
      ${row(game.i18n.localize("MYTHRASF.Chat.Difficulty"), game.i18n.localize(`MYTHRASF.Difficulty.${configured.targets.difficulty}`))}
      ${row(localize("SharedPenalty"), `-${resolution.penalty}%`)}
      ${row(`${ability.name} (1d100)`, actorRoll.total, "mythras-chat-roll-value")}
      ${renderRollResult(participant.result, rollThresholdRanges(participant.target, participant.criticalTarget))}
      ${row(localize(item.type === "trap" ? "difficulty" : "potency"), `${hazard.targetBeforeContest}% → ${hazard.target}%`)}
      ${row(`${item.name} (1d100)`, hazardRoll.total, "mythras-chat-roll-value")}
      ${renderRollResult(hazard.result, rollThresholdRanges(hazard.target, hazard.criticalTarget))}
      <div class="mythras-chat-total">${escape(localize(outcome))}</div>${statusId ? row(localize("StatusApplied"), game.i18n.localize(`MYTHRASF.Status.${statusId === "poison" ? "Poisoned" : "Diseased"}`)) : ""}${profileRows(profile)}
      <p>${escape(localize("ManualConsequences"))}</p></section>` });
  return resolution;
}

export async function rollHazardDamage(item, { manual = false } = {}) {
  if (!allowed(item)) return null;
  const available = actors();
  const selection = await foundry.applications.api.DialogV2.wait({
    window: { title: `${item.name}: ${localize("Damage")}` },
    content: `<div class="mythras-foundry mythras-dialog"><label>${escape(localize("Variant"))}<select name="variant">${profileOptions(item)}</select></label>
      <label>${escape(localize("Target"))}<select name="actor"><option value="">${escape(localize("RollOnly"))}</option>${game.user.isGM ? available.map((actor, index) => `<option value="${index}">${escape(actorDisplayName(actor))}</option>`).join("") : ""}</select></label>
      <p>${escape(localize("DamageHelp"))}</p></div>`,
    buttons: [{ action: "roll", label: localize("Roll"), default: true, callback: (event, button) => ({
      variant: Number(button.form.elements.variant.value), actor: button.form.elements.actor.value }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false
  });
  if (!selection) return null;
  const profile = hazardProfile(item, selection.variant);
  if (!profile.damage || !Roll.validate(profile.damage)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.DirectDamage.InvalidFormula")); return null;
  }
  const actor = selection.actor === "" ? null : available[Number(selection.actor)];
  if (actor && (!game.user.isGM || !actor.isOwner)) return null;
  const damageRoll = await evaluateSystemRoll(profile.damage, { manual });
  let locationRoll = null;
  let location = null;
  if (actor) {
    locationRoll = await evaluateSystemRoll("1d20", { manual });
    location = findHitLocation(actor.items.filter((entry) => entry.type === "hitLocation"), locationRoll.total);
  }
  const armor = actor && location && !profile.armorIgnored
    ? totalArmorPoints(location, actor.items.filter((entry) => entry.type === "armor")) : 0;
  await ChatMessage.create({ speaker: actor ? actorSpeaker(actor) : {},
    rolls: [damageRoll, locationRoll].filter(Boolean),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(item.name)}</div>
      ${row(`${localize("Damage")} (${profile.damage})`, damageRoll.total, "mythras-chat-roll-value")}
      ${location ? row(localize("Location"), hitLocationDisplayName(location)) : ""}
      ${locationRoll ? row(`${localize("Location")} (1d20)`, locationRoll.total, "mythras-chat-roll-value") : ""}
      ${row(localize("armorIgnored"), game.i18n.localize(profile.armorIgnored ? "MYTHRASF.Yes" : "MYTHRASF.No"))}
      ${profileRows(profile)}</section>` });
  if (!actor || !location) return { damageRoll };
  // Confirm only after rolling: shield parries and other protections require
  // a GM decision. The final fixed amount delegates wounds to direct damage.
  const amount = await foundry.applications.api.DialogV2.wait({
    window: { title: localize("ApplyDamage") },
    content: `<div class="mythras-foundry mythras-dialog">${row(localize("Target"), actorDisplayName(actor))}${row(localize("Location"), hitLocationDisplayName(location))}
      ${row(localize("Damage"), damageRoll.total)}${row(localize("Armor"), armor)}
      <p>${escape(localize("ProtectionHelp"))}</p><label>${escape(localize("FinalDamage"))}<input name="amount" type="number" min="0" step="1" value="${Math.max(0, damageRoll.total - armor)}"></label></div>`,
    buttons: [{ action: "apply", label: localize("ApplyDamage"), callback: (event, button) => Number(button.form.elements.amount.value) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), callback: () => null }], rejectClose: false
  });
  if (amount == null || !Number.isFinite(amount) || amount < 0 || !game.user.isGM || !actor.isOwner) return null;
  const result = await applyDirectDamage(actor, { mode: "fixed", amount, locationIds: [location.id] }, { manual });
  if (result != null) await applyHazardStatus(item, actor);
  return result;
}
