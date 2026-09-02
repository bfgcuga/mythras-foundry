import { armorCoversLocation } from "./armor.js";
import { findHitLocation, hitLocationDisplayName, woundLevel } from "./hit-locations.js";
import { applyTimedCondition, timedEffects } from "./timed-condition-runtime.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "./timed-conditions.js";
import { actorDisplayName, actorSpeaker } from "./document-names.js";
import { evaluateAnimatedRoll } from "./dice-animation.js";
import { evaluateSystemRoll } from "./system-roll.js";
import { applyHazardWoundConsequences, hazardWoundConsequenceRows
} from "./wound-consequences.js";

export { applyHazardWoundConsequences, hazardWoundConsequenceRows
} from "./wound-consequences.js";

export const ACID_SPLASH_STATUS_ID = "acidSplash";
export const ACID_IMMERSION_STATUS_ID = "acidImmersion";
export const ACID_CONCENTRATIONS = Object.freeze({
  weak: Object.freeze({ damageFormula: "1d2", durationFormula: "1" }),
  strong: Object.freeze({ damageFormula: "1d4", durationFormula: "1d2" }),
  concentrated: Object.freeze({ damageFormula: "1d6", durationFormula: "1d3" })
});

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function acidDamageResult({ damage, armorPoints = 0, hitPoints = 0 } = {}) {
  const rolled = Math.max(0, Math.floor(Number(damage) || 0));
  const armorBefore = Math.max(0, Math.floor(Number(armorPoints) || 0));
  const absorbed = Math.min(rolled, armorBefore);
  const penetrating = rolled - absorbed;
  return Object.freeze({ damage: rolled, armorBefore, armorAfter: armorBefore - absorbed,
    absorbed, penetrating, hitPointsBefore: Number(hitPoints) || 0,
    hitPointsAfter: (Number(hitPoints) || 0) - penetrating });
}

export function acidArmorLayer(location, armors = []) {
  const worn = Array.from(armors).filter((armor) => armor?.type === "armor"
    && armor.system?.equipped && Number(armor.system?.armorPoints ?? 0) > 0
    && armorCoversLocation(armor, location))
    .sort((left, right) => Number(right.system.armorPoints) - Number(left.system.armorPoints)
      || String(left.id).localeCompare(String(right.id)));
  if (worn.length) return { kind: "worn", item: worn[0], armorPoints: Number(worn[0].system.armorPoints) };
  const natural = Math.max(0, Number(location?.system?.armorPoints ?? 0));
  return natural > 0 ? { kind: "natural", item: location, armorPoints: natural } : null;
}

export function acidExposureDuration({ exposure, rolledDuration }) {
  if (exposure === "immersion") return { applicationsRemaining: null, indefinite: true };
  const totalApplications = Math.max(1, Math.floor(Number(rolledDuration) || 1));
  return { totalApplications, applicationsRemaining: Math.max(0, totalApplications - 1),
    indefinite: false };
}

export function normalizeAcidConfiguration(configuration = {}) {
  const concentration = ACID_CONCENTRATIONS[configuration.concentration]
    ? configuration.concentration : "weak";
  const legacyLocation = configuration.locationId ? [configuration.locationId] : [];
  const locationIds = Array.from(new Set(configuration.locationIds ?? legacyLocation));
  return Object.freeze({ ...configuration, concentration,
    damageFormula: ACID_CONCENTRATIONS[concentration].damageFormula,
    durationFormula: ACID_CONCENTRATIONS[concentration].durationFormula,
    locationIds, randomLocation: configuration.randomLocation === undefined
      ? !locationIds.length : configuration.randomLocation === true });
}

export function acidCondition(effect) {
  return effect?.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG)
    ?? effect?.flags?.[TIMED_CONDITION_SCOPE]?.[TIMED_CONDITION_FLAG];
}

function concentrationLabel(key) {
  return game.i18n.localize(`MYTHRASF.Acid.Concentration.${key}`);
}

async function rollFormula(formula, manual = false) {
  const roll = await evaluateSystemRoll(formula, { manual });
  return { roll, total: Number(roll.total) };
}

async function createAcidChat(actor, token, condition, results) {
  const duration = condition.exposure === "immersion"
    ? game.i18n.localize("MYTHRASF.Acid.UntilRemoved")
    : game.i18n.format("MYTHRASF.Acid.Remaining", {
      count: Math.max(0, condition.applicationsRemaining ?? 0) });
  const rows = results.map(({ location, armorName, result, damageRoll, locationRoll,
    woundBefore, woundAfter, woundConsequence }) => `<fieldset><legend>${escape(hitLocationDisplayName(location))}</legend>
      ${locationRoll ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Combat.LocationRoll"))} (1d20)</span><strong class="mythras-chat-roll-value">${Number(locationRoll.total)}</strong></div>` : ""}
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Acid.DamageRoll"))} (${escape(condition.damageFormula)})</span><strong class="mythras-chat-roll-value">${result.damage}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Chat.Armor"))}</span><strong>${escape(armorName ?? "—")} — ${result.armorBefore} → ${result.armorAfter}</strong></div>
      <div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Chat.PenetratingDamage"))}</span><strong>${result.penetrating}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Acid.HitPoints"))}</span><strong>${result.hitPointsBefore} → ${result.hitPointsAfter}</strong></div>
      ${woundBefore !== woundAfter ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Wound.${woundAfter}`))}</strong></div>` : ""}
      ${hazardWoundConsequenceRows(woundConsequence)}</fieldset>`).join("");
  return ChatMessage.create({
    speaker: actorSpeaker(actor, token),
    rolls: results.flatMap(({ damageRoll, locationRoll, woundConsequence }) => [damageRoll,
      locationRoll, woundConsequence?.enduranceRoll].filter(Boolean)),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(
      game.i18n.localize("MYTHRASF.Acid.ChatTitle"))}</div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Acid.Target"))}</span><strong>${escape(actorDisplayName(actor))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Acid.ConcentrationLabel"))}</span><strong>${escape(concentrationLabel(condition.concentration))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Acid.ExposureLabel"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Acid.Exposure.${condition.exposure}`))}</strong></div>
      ${rows}
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Acid.Duration"))}</span><strong>${escape(duration)}</strong></div></section>`
  });
}

export async function applyAcidDamage(actor, condition, { token = null, manual = false } = {}) {
  if (!actor || !["character", "npc"].includes(actor.type)) return null;
  const normalized = normalizeAcidConfiguration(condition);
  const available = actor.items.filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  let locations = normalized.locationIds.map((id) => available.find((item) => item.id === id))
    .filter(Boolean);
  let randomRoll = null;
  if (normalized.randomLocation) {
    const rolled = await rollFormula("1d20", manual);
    randomRoll = rolled.roll; locations = [findHitLocation(available, rolled.total)].filter(Boolean);
  }
  if (!locations.length || (!normalized.randomLocation
    && locations.length !== normalized.locationIds.length)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Acid.SelectLocations")); return null;
  }
  const results = [];
  for (const location of locations) {
    const layer = acidArmorLayer(location, actor.items.filter((item) => item.type === "armor"));
    const damage = await rollFormula(normalized.damageFormula, manual);
    const woundBefore = woundLevel(location.system.currentHitPoints, location.system.maxHitPoints);
    const result = acidDamageResult({ damage: damage.total, armorPoints: layer?.armorPoints,
      hitPoints: location.system.currentHitPoints });
    if (layer?.kind === "worn") await layer.item.update({
      "system.armorPoints": result.armorAfter,
      ...(result.armorAfter === 0 ? { "system.equipped": false } : {})
    });
    else if (layer?.kind === "natural") await location.update({ "system.armorPoints": result.armorAfter });
    if (result.penetrating > 0) await location.update({ "system.currentHitPoints": result.hitPointsAfter });
    const woundAfter = woundLevel(result.hitPointsAfter, location.system.maxHitPoints);
    const woundConsequence = await applyHazardWoundConsequences(actor, location,
      woundBefore, woundAfter, { manual });
    const armorName = layer?.kind === "natural"
      ? game.i18n.localize("MYTHRASF.Acid.NaturalArmor") : layer?.item?.name;
    results.push({ location, armorName, layerKind: layer?.kind ?? "none",
      result, damageRoll: damage.roll,
      locationRoll: randomRoll, woundBefore, woundAfter, woundConsequence });
  }
  await createAcidChat(actor, token, normalized, results);
  return { configuration: normalized, locationIds: locations.map((location) => location.id),
    results: results.map(({ location, armorName, layerKind, result, damageRoll, locationRoll,
      woundBefore, woundAfter, woundConsequence }) => ({ locationId: location.id, armorName, ...result,
      layerKind, damageRoll: damageRoll.toJSON(),
      locationRoll: locationRoll?.toJSON?.() ?? null, woundBefore, woundAfter,
      woundConsequence: woundConsequence ? { ...woundConsequence,
        enduranceRoll: woundConsequence.enduranceRoll?.toJSON?.() ?? null } : null })) };
}

async function activeCombatForActor(actor) {
  return game.combats?.find((combat) => combat.started
    && combat.combatants.some((entry) => entry.actor?.uuid === actor.uuid)) ?? null;
}

export async function applyAcidExposure(actor, configuration, { token = null, manual = false } = {}) {
  const normalized = normalizeAcidConfiguration(configuration);
  const profile = ACID_CONCENTRATIONS[normalized.concentration];
  if (!profile) throw new Error("Invalid acid concentration");
  const durationRoll = normalized.exposure === "splash"
    ? await rollFormula(profile.durationFormula, manual) : null;
  const duration = acidExposureDuration({ exposure: normalized.exposure,
    rolledDuration: durationRoll?.total });
  const combat = await activeCombatForActor(actor);
  const condition = { concentration: normalized.concentration,
    exposure: normalized.exposure, damageFormula: profile.damageFormula,
    durationFormula: profile.durationFormula, locationIds: normalized.locationIds,
    randomLocation: normalized.randomLocation,
    applicationsRemaining: duration.applicationsRemaining, totalApplications: duration.totalApplications };
  const result = await applyAcidDamage(actor, condition, { token, manual });
  if (!result) return null;
  const statusId = normalized.exposure === "immersion"
    ? ACID_IMMERSION_STATUS_ID : ACID_SPLASH_STATUS_ID;
  await applyTimedCondition(actor, { name: game.i18n.localize(normalized.exposure === "immersion"
    ? "MYTHRASF.Status.AcidImmersion" : "MYTHRASF.Status.AcidSplash"),
    img: "icons/svg/acid.svg", key: statusId, statusId,
    combat: combat ? { uuid: combat.uuid, round: combat.round,
      cycle: combat.mythrasTurnEconomy?.cycle, turn: combat.turn } : null,
    duration: combat && normalized.exposure === "splash"
      && duration.applicationsRemaining === 0
      ? { unit: "round", phase: "endRound" }
      : { unit: "acidReview", phase: "startRound" }, locationId: result.locationIds[0] ?? "",
    metadata: { ...condition, applicationsRemaining: duration.applicationsRemaining } });
  return result;
}

export function acidEffects(actor) {
  return Array.from(actor?.effects ?? []).filter((effect) => [ACID_SPLASH_STATUS_ID,
    ACID_IMMERSION_STATUS_ID].some((statusId) => effect.statuses?.has?.(statusId)
      || Array.from(effect.statuses ?? []).includes(statusId)));
}

export function acidReviewConfiguration(effect) {
  const stored = acidCondition(effect) ?? {};
  const immersion = effect?.statuses?.has?.(ACID_IMMERSION_STATUS_ID)
    || Array.from(effect?.statuses ?? []).includes(ACID_IMMERSION_STATUS_ID);
  const exposure = stored.exposure ?? (immersion ? "immersion" : "splash");
  const concentration = ACID_CONCENTRATIONS[stored.concentration] ? stored.concentration : "weak";
  return { concentration, exposure, damageFormula: ACID_CONCENTRATIONS[concentration].damageFormula,
    durationFormula: ACID_CONCENTRATIONS[concentration].durationFormula,
    locationIds: Array.from(new Set(stored.locationIds ?? (stored.locationId ? [stored.locationId] : []))),
    randomLocation: stored.randomLocation === true || !(stored.locationIds?.length || stored.locationId),
    applicationsRemaining: exposure === "immersion" ? null
      : Math.max(1, Number(stored.applicationsRemaining ?? 1)) };
}

export async function removeAcidEffect(actor, effectId) {
  if (actor?.effects?.get?.(effectId) || acidEffects(actor).some((effect) => effect.id === effectId)) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]); return true;
  }
  return false;
}

export async function openAcidDialog({ actor = null, token = null, defaults = null,
  deferApply = false, fixedExposure = false,
  manual = game.mythrasFoundry?.dice?.isManualGesture?.() ?? false } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Acid.GMOnly")); return null;
  }
  if (!actor) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Acid.SelectOneToken")); return null;
    }
    token = controlled[0]; actor = token.actor;
  }
  const initial = normalizeAcidConfiguration({ concentration: defaults?.concentration ?? "weak",
    exposure: defaults?.exposure ?? "splash", locationIds: defaults?.locationIds,
    locationId: defaults?.locationId, randomLocation: defaults?.randomLocation });
  const locations = actor.items.filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Acid.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Acid.Target"))}</legend><div class="sheet-field-readonly">${escape(actorDisplayName(actor))}</div></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Acid.ConcentrationLabel"))}</legend>${Object.entries(ACID_CONCENTRATIONS).map(([key, profile]) => `<label><input type="radio" class="sheet-state-box" name="concentration" value="${key}" ${key === initial.concentration ? "checked" : ""} aria-label="${escape(concentrationLabel(key))}"><span>${escape(concentrationLabel(key))} — ${profile.damageFormula} / ${profile.durationFormula}</span></label>`).join("")}</fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Acid.ExposureLabel"))}</legend><label><input type="radio" class="sheet-state-box" name="exposure" value="splash" ${initial.exposure === "splash" ? "checked" : ""} ${fixedExposure ? "disabled" : ""}><span>${escape(game.i18n.localize("MYTHRASF.Acid.Exposure.splash"))}</span></label><label><input type="radio" class="sheet-state-box" name="exposure" value="immersion" ${initial.exposure === "immersion" ? "checked" : ""} ${fixedExposure ? "disabled" : ""}><span>${escape(game.i18n.localize("MYTHRASF.Acid.Exposure.immersion"))}</span></label><input type="hidden" name="fixedExposure" value="${initial.exposure}"></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Acid.Locations"))}</legend><label><input type="checkbox" class="sheet-state-box" name="randomLocation" ${initial.randomLocation ? "checked" : ""}><span>${escape(game.i18n.localize("MYTHRASF.Acid.RandomLocation"))}</span></label>${locations.map((location) => `<label><input type="checkbox" class="sheet-state-box" name="location" value="${escape(location.id)}" ${initial.locationIds.includes(location.id) ? "checked" : ""}><span>${escape(hitLocationDisplayName(location))}</span></label>`).join("")}</fieldset></div>`,
    buttons: [{ action: "apply", label: game.i18n.localize("MYTHRASF.Acid.Apply"),
      icon: "fas fa-flask", default: true, callback: (event, button) => ({
        concentration: button.form.elements.concentration.value,
        exposure: fixedExposure ? button.form.elements.fixedExposure.value
          : button.form.elements.exposure.value,
        locationIds: Array.from(button.form.querySelectorAll("input[name='location']:checked"),
          (control) => control.value),
        randomLocation: button.form.elements.randomLocation.checked
      }) }, { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"),
      icon: "fas fa-times", callback: () => null }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      form?.addEventListener("change", (change) => {
        if (change.target.name === "randomLocation" && change.target.checked) {
          form.querySelectorAll("input[name='location']").forEach((control) => { control.checked = false; });
        } else if (change.target.name === "location" && change.target.checked) {
          form.elements.randomLocation.checked = false;
        }
      });
    }, rejectClose: false
  });
  if (!result || typeof result !== "object") return null;
  const configuration = normalizeAcidConfiguration({ ...result,
    applicationsRemaining: defaults?.applicationsRemaining });
  if (!configuration.randomLocation && !configuration.locationIds.length) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Acid.SelectLocations")); return null;
  }
  return deferApply ? { action: "apply", ...configuration }
    : applyAcidExposure(actor, configuration, { token, manual });
}

export function createHazardsApi() {
  return Object.freeze({ acid: Object.freeze({ open: openAcidDialog, apply: applyAcidExposure }) });
}
