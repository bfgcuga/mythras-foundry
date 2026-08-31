import { applyHazardWoundConsequences, hazardWoundConsequenceRows
} from "./wound-consequences.js";
import { woundLevel } from "./hit-locations.js";
import { actorDisplayName, actorSpeaker } from "./document-names.js";
import { evaluateSystemRoll } from "./system-roll.js";

export const BURNING_STATUS_ID = "burning";
export const FIRE_FLAG = "fire";
export const FIRE_SCOPE = "mythras-foundry";
export const FIRE_PROFILES = Object.freeze({
  1: Object.freeze({ example: "candle", ignitionFormula: "1d4", damageFormula: "1d2",
    locationGuidance: "single" }),
  2: Object.freeze({ example: "torch", ignitionFormula: "1d3", damageFormula: "1d4",
    locationGuidance: "single" }),
  3: Object.freeze({ example: "campfire", ignitionFormula: "1d2", damageFormula: "1d6",
    locationGuidance: "several" }),
  4: Object.freeze({ example: "conflagration", ignitionFormula: "1d2", damageFormula: "2d6",
    locationGuidance: "several" }),
  5: Object.freeze({ example: "lava", ignitionFormula: "instant", damageFormula: "3d6",
    locationGuidance: "all" })
});

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function normalizeFireConfiguration(configuration = {}) {
  const intensity = Math.max(1, Math.min(5, Math.floor(Number(configuration.intensity) || 1)));
  const profile = FIRE_PROFILES[intensity];
  return Object.freeze({ intensity, formula: String(configuration.formula ?? profile.damageFormula).trim()
    || profile.damageFormula, locationIds: Array.from(new Set(configuration.locationIds ?? [])),
  keepBurning: configuration.keepBurning !== false });
}

export function fireDamageResult(damage, hitPoints) {
  const applied = Math.max(0, Math.floor(Number(damage) || 0));
  const before = Number(hitPoints) || 0;
  return Object.freeze({ damage: applied, hitPointsBefore: before, hitPointsAfter: before - applied });
}

export function fireEffect(actor) {
  return Array.from(actor?.effects ?? []).find((effect) => effect.statuses?.has?.(BURNING_STATUS_ID)
    || Array.from(effect.statuses ?? []).includes(BURNING_STATUS_ID)) ?? null;
}

export function fireEffectConfiguration(actor) {
  const effect = fireEffect(actor);
  const stored = effect?.getFlag?.(FIRE_SCOPE, FIRE_FLAG) ?? effect?.flags?.[FIRE_SCOPE]?.[FIRE_FLAG];
  return normalizeFireConfiguration(stored ?? {});
}

export async function setBurning(actor, configuration = {}) {
  const normalized = normalizeFireConfiguration(configuration);
  const matching = Array.from(actor?.effects ?? []).filter((effect) => effect.statuses?.has?.(BURNING_STATUS_ID)
    || Array.from(effect.statuses ?? []).includes(BURNING_STATUS_ID));
  const [effect, ...duplicates] = matching;
  if (duplicates.length) await actor.deleteEmbeddedDocuments("ActiveEffect", duplicates.map((entry) => entry.id));
  if (effect) {
    await effect.update({ name: game.i18n.localize("MYTHRASF.Status.Burning"),
      [`flags.${FIRE_SCOPE}.${FIRE_FLAG}`]: normalized });
    return effect;
  }
  const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: game.i18n.localize("MYTHRASF.Status.Burning"), img: "icons/svg/fire.svg",
    statuses: [BURNING_STATUS_ID], flags: { [FIRE_SCOPE]: { [FIRE_FLAG]: normalized } }
  }]);
  return created;
}

export async function extinguishFire(actor) {
  const ids = Array.from(actor?.effects ?? []).filter((effect) => effect.statuses?.has?.(BURNING_STATUS_ID)
    || Array.from(effect.statuses ?? []).includes(BURNING_STATUS_ID)).map((effect) => effect.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  return ids.length;
}

function validFormula(formula) {
  try {
    if (typeof Roll.validate === "function") return Roll.validate(formula);
    new Roll(formula); return true;
  } catch { return false; }
}

async function createFireChat(actor, token, configuration, results) {
  const profile = FIRE_PROFILES[configuration.intensity];
  const rows = results.map(({ location, roll, damage, hitPointsBefore, hitPointsAfter,
    woundBefore, woundAfter, woundConsequence }) => `<fieldset><legend>${escape(location.name)}</legend>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fire.DamageRoll"))} (${escape(configuration.formula)})</span><strong class="mythras-chat-roll-value">${damage}</strong></div>
      <div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Fire.HitPoints"))}</span><strong>${hitPointsBefore} → ${hitPointsAfter}</strong></div>
      ${woundBefore !== woundAfter ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Wound.${woundAfter}`))}</strong></div>` : ""}
      ${hazardWoundConsequenceRows(woundConsequence)}</fieldset>`).join("");
  return ChatMessage.create({ speaker: actorSpeaker(actor, token), rolls: results.flatMap(
    (entry) => [entry.roll, entry.woundConsequence?.enduranceRoll].filter(Boolean)),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.localize("MYTHRASF.Fire.ChatTitle"))}</div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fire.Target"))}</span><strong>${escape(actorDisplayName(actor))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fire.IntensityLabel"))}</span><strong>${configuration.intensity} — ${escape(game.i18n.localize(`MYTHRASF.Fire.Example.${profile.example}`))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fire.Ignition"))}</span><strong>${escape(profile.ignitionFormula === "instant" ? game.i18n.localize("MYTHRASF.Fire.Instant") : profile.ignitionFormula)}</strong></div>${rows}
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Status.Burning"))}</span><strong>${escape(game.i18n.localize(configuration.keepBurning ? "MYTHRASF.Yes" : "MYTHRASF.No"))}</strong></div></section>` });
}

export async function applyFireDamage(actor, configuration, { token = null, manual = false } = {}) {
  if (!actor || !["character", "npc"].includes(actor.type)) return null;
  const normalized = normalizeFireConfiguration(configuration);
  if (!validFormula(normalized.formula)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fire.InvalidFormula")); return null;
  }
  const locations = normalized.locationIds.map((id) => actor.items.get(id))
    .filter((item) => item?.type === "hitLocation");
  if (!locations.length || locations.length !== normalized.locationIds.length) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fire.SelectLocations")); return null;
  }
  const results = [];
  for (const location of locations) {
    const roll = await evaluateSystemRoll(normalized.formula, { manual });
    const woundBefore = woundLevel(location.system.currentHitPoints, location.system.maxHitPoints);
    const damage = fireDamageResult(roll.total, location.system.currentHitPoints);
    await location.update({ "system.currentHitPoints": damage.hitPointsAfter });
    const woundAfter = woundLevel(damage.hitPointsAfter, location.system.maxHitPoints);
    const woundConsequence = await applyHazardWoundConsequences(actor, location, woundBefore, woundAfter,
      { sourceStatus: "MYTHRASF.Status.Burning", manual });
    results.push({ location, roll, ...damage, woundBefore, woundAfter, woundConsequence });
  }
  if (normalized.keepBurning) await setBurning(actor, normalized);
  else await extinguishFire(actor);
  await createFireChat(actor, token, normalized, results);
  return { configuration: normalized, results: results.map(({ location, roll,
    woundConsequence, ...entry }) => ({ ...entry, locationId: location.id, roll: roll.toJSON(),
    woundConsequence: woundConsequence ? { ...woundConsequence,
      enduranceRoll: woundConsequence.enduranceRoll?.toJSON?.() ?? null } : null })) };
}

function locationGuidance(intensity) {
  return game.i18n.localize(`MYTHRASF.Fire.LocationGuidance.${FIRE_PROFILES[intensity].locationGuidance}`);
}

export async function openFireDialog({ actor = null, token = null, defaults = null,
  deferApply = false, manual = game.mythrasFoundry?.dice?.isManualGesture?.() ?? false } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fire.GMOnly")); return null;
  }
  if (!actor) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Fire.SelectOneToken")); return null;
    }
    token = controlled[0]; actor = token.actor;
  }
  const active = fireEffect(actor); const initial = normalizeFireConfiguration(defaults
    ?? (active ? fireEffectConfiguration(actor) : {}));
  const locations = actor.items.filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Fire.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fire.Target"))}</legend><div class="sheet-field-readonly">${escape(actorDisplayName(actor))}</div></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fire.IntensityLabel"))}</legend>${Object.entries(FIRE_PROFILES).map(([intensity, profile]) => `<label><input type="radio" class="sheet-state-box" name="intensity" value="${intensity}" ${Number(intensity) === initial.intensity ? "checked" : ""}><span>${intensity} — ${escape(game.i18n.localize(`MYTHRASF.Fire.Example.${profile.example}`))}: ${profile.damageFormula}, ${escape(game.i18n.localize("MYTHRASF.Fire.Ignition"))} ${escape(profile.ignitionFormula === "instant" ? game.i18n.localize("MYTHRASF.Fire.Instant") : profile.ignitionFormula)}</span></label>`).join("")}<p data-fire-guidance>${escape(locationGuidance(initial.intensity))}</p></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fire.DamageFormula"))}</legend><input class="sheet-field-editable" name="formula" value="${escape(initial.formula)}"></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fire.Locations"))}</legend>${locations.map((location) => `<label><input type="checkbox" class="sheet-state-box" name="location" value="${escape(location.id)}" ${initial.locationIds.includes(location.id) ? "checked" : ""}><span>${escape(location.name)}</span></label>`).join("")}</fieldset>
      <label><input type="checkbox" class="sheet-state-box" name="keepBurning" ${initial.keepBurning ? "checked" : ""}><span>${escape(game.i18n.localize("MYTHRASF.Fire.KeepBurning"))}</span></label></div>`,
    buttons: [{ action: "apply", label: game.i18n.localize("MYTHRASF.Fire.Apply"),
      icon: "fas fa-fire", default: true, callback: (event, button) => ({ action: "apply",
        intensity: Number(button.form.elements.intensity.value),
        formula: button.form.elements.formula.value.trim(),
        locationIds: Array.from(button.form.querySelectorAll("input[name='location']:checked"),
          (control) => control.value), keepBurning: button.form.elements.keepBurning.checked }) },
    ...(active ? [{ action: "extinguish", label: game.i18n.localize("MYTHRASF.Fire.Extinguish"),
      icon: "fas fa-fire-extinguisher", callback: () => ({ action: "extinguish" }) }] : []),
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times",
      callback: () => null }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form"); let previous = initial.intensity;
      form?.addEventListener("change", (change) => {
        if (change.target.name !== "intensity") return;
        const intensity = Number(change.target.value); const formula = form.elements.formula;
        if (formula.value.trim() === FIRE_PROFILES[previous].damageFormula) {
          formula.value = FIRE_PROFILES[intensity].damageFormula;
        }
        form.querySelector("[data-fire-guidance]").textContent = locationGuidance(intensity);
        previous = intensity;
      });
    }, rejectClose: false
  });
  if (!result || typeof result !== "object") return null;
  if (result.action === "extinguish") {
    if (deferApply) return result;
    await extinguishFire(actor); return result;
  }
  const configuration = normalizeFireConfiguration(result);
  if (!configuration.locationIds.length) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fire.SelectLocations")); return null;
  }
  if (!validFormula(configuration.formula)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fire.InvalidFormula")); return null;
  }
  return deferApply ? { action: "apply", ...configuration }
    : applyFireDamage(actor, configuration, { token, manual });
}

export function createFireApi() {
  return Object.freeze({ open: openFireDialog, apply: applyFireDamage,
    extinguish: extinguishFire });
}
