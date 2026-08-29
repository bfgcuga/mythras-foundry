import { applyHazardWoundConsequences, hazardWoundConsequenceRows
} from "./wound-consequences.js";
import { evaluateAnimatedRoll } from "./dice-animation.js";
import { actorDisplayName, actorSpeaker } from "./document-names.js";
import { findHitLocation, woundLevel } from "./hit-locations.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function normalizeDirectDamageConfiguration(configuration = {}) {
  const mode = configuration.mode === "formula" ? "formula" : "fixed";
  return Object.freeze({ mode,
    amount: Math.max(0, Math.floor(Number(configuration.amount) || 0)),
    formula: String(configuration.formula ?? "1d6").trim() || "1d6",
    locationIds: Array.from(new Set(configuration.locationIds ?? [])),
    randomLocation: configuration.randomLocation === true });
}

export function directDamageResult(damage, hitPoints) {
  const applied = Math.max(0, Math.floor(Number(damage) || 0));
  const before = Number(hitPoints) || 0;
  return Object.freeze({ damage: applied, hitPointsBefore: before,
    hitPointsAfter: before - applied });
}

function validFormula(formula) {
  try {
    if (typeof Roll.validate === "function") return Roll.validate(formula);
    new Roll(formula); return true;
  } catch { return false; }
}

async function createDirectDamageChat(actor, token, configuration, results) {
  const rows = results.map(({ location, damageRoll, locationRoll, damage, hitPointsBefore,
    hitPointsAfter, woundBefore, woundAfter, woundConsequence }) => `<fieldset><legend>${escape(
    location.name)}</legend>
      ${locationRoll ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize(
        "MYTHRASF.Combat.LocationRoll"))} (1d20)</span><strong class="mythras-chat-roll-value">${Number(
        locationRoll.total)}</strong></div>` : ""}
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize(
        configuration.mode === "formula" ? "MYTHRASF.DirectDamage.FormulaRoll"
          : "MYTHRASF.DirectDamage.FixedDamage"))}${configuration.mode === "formula"
            ? ` (${escape(configuration.formula)})` : ""}</span><strong${damageRoll
              ? " class=\"mythras-chat-roll-value\"" : ""}>${damage}</strong></div>
      <div class="mythras-chat-total"><span>${escape(game.i18n.localize(
        "MYTHRASF.DirectDamage.HitPoints"))}</span><strong>${hitPointsBefore} → ${hitPointsAfter}</strong></div>
      ${woundBefore !== woundAfter ? `<div class="mythras-chat-row"><span>${escape(
        game.i18n.localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(game.i18n.localize(
          `MYTHRASF.Wound.${woundAfter}`))}</strong></div>` : ""}
      ${hazardWoundConsequenceRows(woundConsequence)}</fieldset>`).join("");
  return ChatMessage.create({ speaker: actorSpeaker(actor, token),
    rolls: results.flatMap((entry) => [entry.locationRoll, entry.damageRoll,
      entry.woundConsequence?.enduranceRoll].filter(Boolean)),
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(
      game.i18n.localize("MYTHRASF.DirectDamage.ChatTitle"))}</div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize(
        "MYTHRASF.DirectDamage.Target"))}</span><strong>${escape(actorDisplayName(actor))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize(
        "MYTHRASF.DirectDamage.Armor"))}</span><strong>${escape(game.i18n.localize(
          "MYTHRASF.DirectDamage.ArmorIgnored"))}</strong></div>${rows}</section>` });
}

export async function applyDirectDamage(actor, configuration, { token = null } = {}) {
  if (!actor || !["character", "npc"].includes(actor.type)) return null;
  const normalized = normalizeDirectDamageConfiguration(configuration);
  if (normalized.mode === "formula" && !validFormula(normalized.formula)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.DirectDamage.InvalidFormula"));
    return null;
  }
  const available = actor.items.filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  let locations = normalized.locationIds.map((id) => actor.items.get(id))
    .filter((item) => item?.type === "hitLocation");
  let locationRoll = null;
  if (normalized.randomLocation) {
    locationRoll = await evaluateAnimatedRoll("1d20", { speaker: actorSpeaker(actor, token) });
    locations = [findHitLocation(available, locationRoll.total)].filter(Boolean);
  }
  if (!locations.length || (!normalized.randomLocation
    && locations.length !== normalized.locationIds.length)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.DirectDamage.SelectLocations"));
    return null;
  }
  const results = [];
  for (const location of locations) {
    const damageRoll = normalized.mode === "formula"
      ? await evaluateAnimatedRoll(normalized.formula, { speaker: actorSpeaker(actor, token) }) : null;
    const woundBefore = woundLevel(location.system.currentHitPoints,
      location.system.maxHitPoints);
    const result = directDamageResult(damageRoll?.total ?? normalized.amount,
      location.system.currentHitPoints);
    await location.update({ "system.currentHitPoints": result.hitPointsAfter });
    const woundAfter = woundLevel(result.hitPointsAfter, location.system.maxHitPoints);
    const woundConsequence = await applyHazardWoundConsequences(actor, location,
      woundBefore, woundAfter, { sourceStatus: "MYTHRASF.DirectDamage.Source" });
    results.push({ location, locationRoll, damageRoll, ...result, woundBefore, woundAfter,
      woundConsequence });
  }
  await createDirectDamageChat(actor, token, normalized, results);
  return { configuration: normalized, results: results.map(({ location, locationRoll: hitRoll,
    damageRoll, woundConsequence, ...entry }) => ({ ...entry, locationId: location.id,
    locationRoll: hitRoll?.toJSON?.() ?? null, damageRoll: damageRoll?.toJSON?.() ?? null,
    woundConsequence: woundConsequence ? { ...woundConsequence,
      enduranceRoll: woundConsequence.enduranceRoll?.toJSON?.() ?? null } : null })) };
}

export async function openDirectDamageDialog({ actor = null, token = null } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.DirectDamage.GMOnly")); return null;
  }
  if (!actor) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.DirectDamage.SelectOneToken")); return null;
    }
    token = controlled[0]; actor = token.actor;
  }
  const locations = actor.items.filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.DirectDamage.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(
      game.i18n.localize("MYTHRASF.DirectDamage.Target"))}</legend><div class="sheet-field-readonly">${escape(
        actorDisplayName(actor))}</div></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.DirectDamage.Damage"))}</legend>
        <label><input type="radio" class="sheet-state-box" name="mode" value="fixed" checked><span>${escape(
          game.i18n.localize("MYTHRASF.DirectDamage.Mode.fixed"))}</span></label>
        <label data-direct-fixed><span>${escape(game.i18n.localize(
          "MYTHRASF.DirectDamage.Amount"))}</span><input type="number" class="sheet-field-editable" name="amount" min="0" step="1" value="1"></label>
        <label><input type="radio" class="sheet-state-box" name="mode" value="formula"><span>${escape(
          game.i18n.localize("MYTHRASF.DirectDamage.Mode.formula"))}</span></label>
        <label data-direct-formula hidden><span>${escape(game.i18n.localize(
          "MYTHRASF.DirectDamage.Formula"))}</span><input class="sheet-field-editable" name="formula" value="1d6"></label>
      </fieldset><fieldset><legend>${escape(game.i18n.localize(
        "MYTHRASF.DirectDamage.Locations"))}</legend>
        <label><input type="checkbox" class="sheet-state-box" name="randomLocation"><span>${escape(
          game.i18n.localize("MYTHRASF.DirectDamage.RandomLocation"))}</span></label>
        <div data-direct-locations>${locations.map((location) => `<label><input type="checkbox" class="sheet-state-box" name="location" value="${escape(
          location.id)}"><span>${escape(location.name)}</span></label>`).join("")}</div>
      </fieldset><p>${escape(game.i18n.localize("MYTHRASF.DirectDamage.ArmorHelp"))}</p></div>`,
    buttons: [{ action: "apply", label: game.i18n.localize("MYTHRASF.DirectDamage.Apply"),
      icon: "fas fa-heart-crack", default: true, callback: (event, button) => ({
        mode: button.form.elements.mode.value,
        amount: Number(button.form.elements.amount.value),
        formula: button.form.elements.formula.value.trim(),
        randomLocation: button.form.elements.randomLocation.checked,
        locationIds: Array.from(button.form.querySelectorAll("input[name='location']:checked"),
          (control) => control.value) }) },
    { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"), icon: "fas fa-times",
      callback: () => null }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      const refresh = () => {
        const formula = form.elements.mode.value === "formula";
        form.querySelector("[data-direct-fixed]").hidden = formula;
        form.querySelector("[data-direct-formula]").hidden = !formula;
        const random = form.elements.randomLocation.checked;
        form.querySelector("[data-direct-locations]").hidden = random;
      };
      form.addEventListener("change", refresh); refresh();
    }, rejectClose: false
  });
  if (!result) return null;
  const normalized = normalizeDirectDamageConfiguration(result);
  if (!normalized.randomLocation && !normalized.locationIds.length) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.DirectDamage.SelectLocations")); return null;
  }
  if (normalized.mode === "formula" && !validFormula(normalized.formula)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.DirectDamage.InvalidFormula")); return null;
  }
  return applyDirectDamage(actor, normalized, { token });
}

export function createDirectDamageApi() {
  return Object.freeze({ open: openDirectDamageDialog, apply: applyDirectDamage });
}
