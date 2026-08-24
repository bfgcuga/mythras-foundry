import { applyHazardWoundConsequences, hazardWoundConsequenceRows } from "./acid.js";
import { findHitLocation, woundLevel } from "./hit-locations.js";
import { actorDisplayName, actorSpeaker } from "./document-names.js";

export const COMBAT_ROUND_SECONDS = 5;

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function fallSizeDistanceReduction(size) {
  const value = Math.max(0, Math.floor(Number(size) || 0));
  if (value === 1) return 10;
  if (value <= 3 && value >= 2) return 8;
  if (value <= 5 && value >= 4) return 5;
  if (value <= 7 && value >= 6) return 3;
  if (value <= 9 && value >= 8) return 1;
  return 0;
}

export function fallDistanceProfile(distance) {
  const meters = Math.max(0, Number(distance) || 0);
  if (meters <= 1) return Object.freeze({ dice: 0, locations: 0 });
  const dice = Math.max(1, Math.ceil(meters / 5));
  return Object.freeze({ dice, locations: dice });
}

export function fallLargeSizeBonus(size) {
  return Math.max(0, Math.ceil((Number(size) - 20) / 10));
}

export function combinedFallDamage(fallDamage, dangerousSurfaceDamage = 0) {
  return Math.max(0, Math.floor(Number(fallDamage) || 0))
    + Math.max(0, Math.floor(Number(dangerousSurfaceDamage) || 0));
}

export function calculateFall(configuration = {}) {
  const kind = ["fall", "vehicle", "object"].includes(configuration.kind)
    ? configuration.kind : "fall";
  const actorSize = Math.max(1, Math.floor(Number(configuration.actorSize) || 1));
  const objectSize = Math.max(1, Math.floor(Number(configuration.objectSize) || 1));
  const speedPerRound = Math.max(0, Number(configuration.speedPerRound) || 0);
  const speedPerSecond = speedPerRound / COMBAT_ROUND_SECONDS;
  let referenceDistance = Math.max(0, Number(configuration.distance) || 0);
  if (kind === "vehicle") referenceDistance += speedPerRound / 2;
  if (configuration.softSurface) referenceDistance /= 2;
  const relevantSize = kind === "object" ? objectSize : actorSize;
  const acrobaticsReduction = kind !== "object" && configuration.acrobaticsSuccess ? 2 : 0;
  const effectiveDistance = Math.max(0, referenceDistance
    - fallSizeDistanceReduction(relevantSize) - acrobaticsReduction);
  const distanceProfile = fallDistanceProfile(effectiveDistance);
  const dice = kind === "object"
    ? Math.max(1, Math.ceil(objectSize / 6)) + distanceProfile.dice
    : distanceProfile.dice > 0 ? distanceProfile.dice + fallLargeSizeBonus(actorSize) : 0;
  const locations = kind === "object" ? 1 : distanceProfile.locations;
  return Object.freeze({ kind, actorSize, objectSize, distance: Math.max(0,
    Number(configuration.distance) || 0), speedPerRound, speedPerSecond, referenceDistance,
  effectiveDistance, dice, locations, formula: dice > 0 ? `${dice}d6` : "0",
  acrobaticsSuccess: Boolean(configuration.acrobaticsSuccess),
  softSurface: Boolean(configuration.softSurface),
  dangerousSurface: Boolean(configuration.dangerousSurface) });
}

function validFormula(formula) {
  try {
    if (String(formula).trim() === "0") return true;
    if (typeof Roll.validate === "function") return Roll.validate(formula);
    new Roll(formula); return true;
  } catch { return false; }
}

async function randomLocations(locations, count) {
  const selected = []; const rolls = [];
  const wanted = Math.min(Math.max(0, Math.floor(Number(count) || 0)), locations.length);
  while (selected.length < wanted) {
    const roll = await new Roll("1d20").evaluate(); rolls.push(roll);
    const location = findHitLocation(locations, Number(roll.total));
    if (location && !selected.some((entry) => entry.id === location.id)) selected.push(location);
    if (rolls.length > 100) break;
  }
  for (const location of locations) {
    if (selected.length >= wanted) break;
    if (!selected.some((entry) => entry.id === location.id)) selected.push(location);
  }
  return { selected, rolls };
}

async function createFallChat(actor, token, configuration, results, locationRolls) {
  const rows = results.map(({ location, roll, damage, before, after, woundBefore,
    woundAfter, fallDamage, dangerousRoll, dangerousDamage, woundConsequence }) => `<fieldset><legend>${escape(location.name)}</legend>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.DamageRoll"))} (${escape(configuration.formula)})</span><strong class="mythras-chat-roll-value">${fallDamage}</strong></div>
      ${dangerousRoll ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.DangerousSurfaceDamageRoll"))} (${escape(configuration.dangerousSurfaceFormula)})</span><strong class="mythras-chat-roll-value">${dangerousDamage}</strong></div>` : ""}
      ${dangerousRoll ? `<div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Fall.TotalDamage"))}</span><strong>${damage}</strong></div>` : ""}
      <div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Fall.HitPoints"))}</span><strong>${before} → ${after}</strong></div>
      ${woundBefore !== woundAfter ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Chat.Wound"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Wound.${woundAfter}`))}</strong></div>` : ""}
      ${hazardWoundConsequenceRows(woundConsequence)}</fieldset>`).join("");
  const safeLanding = configuration.acrobaticsSuccess
    && !results.some((entry) => ["serious", "major"].includes(entry.woundAfter));
  return ChatMessage.create({ speaker: actorSpeaker(actor, token),
    rolls: [...locationRolls, ...results.flatMap((entry) => [entry.roll,
      entry.dangerousRoll, entry.woundConsequence?.enduranceRoll].filter(Boolean))],
    content: `<section class="mythras-chat-card"><div class="mythras-chat-title">${escape(game.i18n.localize("MYTHRASF.Fall.ChatTitle"))}</div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.Target"))}</span><strong>${escape(actorDisplayName(actor))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.TypeLabel"))}</span><strong>${escape(game.i18n.localize(`MYTHRASF.Fall.Type.${configuration.kind}`))}</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.EffectiveDistance"))}</span><strong>${configuration.effectiveDistance} m</strong></div>
      <div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.ArmorIgnored"))}</span><strong>${escape(game.i18n.localize("MYTHRASF.Yes"))}</strong></div>
      ${configuration.kind === "vehicle" ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.VehicleSpeed"))}</span><strong>${configuration.speedPerRound} m/${escape(game.i18n.localize("MYTHRASF.Fall.Round"))} — ${configuration.speedPerSecond} m/s</strong></div>` : ""}
      ${rows || `<div class="mythras-chat-total"><span>${escape(game.i18n.localize("MYTHRASF.Fall.DamageRoll"))}</span><strong>${escape(game.i18n.localize("MYTHRASF.Fall.NoDamage"))}</strong></div>`}
      ${configuration.kind !== "object" ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.Landing"))}</span><strong>${escape(game.i18n.localize(safeLanding ? "MYTHRASF.Fall.SafeLanding" : "MYTHRASF.Fall.KnockdownApplies"))}</strong></div>` : ""}
      ${configuration.dangerousSurface ? `<div class="mythras-chat-row"><span>${escape(game.i18n.localize("MYTHRASF.Fall.DangerousSurface"))}</span><strong>${escape(configuration.dangerousSurfaceFormula)}</strong></div>` : ""}</section>` });
}

export async function applyFallDamage(actor, configuration, { token = null } = {}) {
  if (!actor || !["character", "npc"].includes(actor.type)) return null;
  const calculated = calculateFall({ ...configuration, actorSize: actor.system.size });
  const formula = String(configuration.formula ?? calculated.formula).trim() || calculated.formula;
  const dangerousSurfaceFormula = String(configuration.dangerousSurfaceFormula ?? "1d6").trim()
    || "1d6";
  const locationCount = Math.max(0, Math.floor(Number(configuration.locationCount
    ?? calculated.locations) || 0));
  if (!validFormula(formula) || (calculated.dangerousSurface
    && !validFormula(dangerousSurfaceFormula))) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fall.InvalidFormula")); return null;
  }
  const locations = actor.items.filter((item) => item.type === "hitLocation")
    .sort((left, right) => Number(left.system.rangeStart) - Number(right.system.rangeStart));
  if (formula !== "0" && (!locationCount || !locations.length)) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fall.InvalidLocations")); return null;
  }
  const { selected, rolls: locationRolls } = formula === "0"
    ? { selected: [], rolls: [] } : await randomLocations(locations, locationCount);
  const results = [];
  for (const location of selected) {
    const roll = await new Roll(formula).evaluate();
    const fallDamage = Math.max(0, Math.floor(Number(roll.total) || 0));
    const dangerousRoll = calculated.dangerousSurface
      ? await new Roll(dangerousSurfaceFormula).evaluate() : null;
    const dangerousDamage = Math.max(0, Math.floor(Number(dangerousRoll?.total) || 0));
    const damage = combinedFallDamage(fallDamage, dangerousDamage);
    const before = Number(location.system.currentHitPoints) || 0;
    const after = before - damage;
    const woundBefore = woundLevel(before, location.system.maxHitPoints);
    await location.update({ "system.currentHitPoints": after });
    const woundAfter = woundLevel(after, location.system.maxHitPoints);
    const woundConsequence = await applyHazardWoundConsequences(actor, location, woundBefore, woundAfter,
      { sourceStatus: "MYTHRASF.Fall.ChatTitle" });
    results.push({ location, roll, damage, fallDamage, dangerousRoll, dangerousDamage,
      before, after, woundBefore, woundAfter, woundConsequence });
  }
  const resolved = { ...calculated, formula, dangerousSurfaceFormula, locationCount };
  await createFallChat(actor, token, resolved, results, locationRolls);
  return { configuration: resolved, results: results.map(({ location, roll,
    dangerousRoll, woundConsequence, ...entry }) => ({ ...entry, locationId: location.id,
    roll: roll.toJSON(), dangerousRoll: dangerousRoll?.toJSON?.() ?? null,
    woundConsequence: woundConsequence ? { ...woundConsequence,
      enduranceRoll: woundConsequence.enduranceRoll?.toJSON?.() ?? null } : null })),
  locationRolls: locationRolls.map((roll) => roll.toJSON()) };
}

export async function openFallDialog({ actor = null, token = null } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Fall.GMOnly")); return null;
  }
  if (!actor) {
    const controlled = canvas.tokens?.controlled ?? [];
    if (controlled.length !== 1 || !["character", "npc"].includes(controlled[0]?.actor?.type)) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Fall.SelectOneToken")); return null;
    }
    token = controlled[0]; actor = token.actor;
  }
  const initial = calculateFall({ kind: "fall", actorSize: actor.system.size, distance: 2 });
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Fall.Title") },
    content: `<div class="mythras-foundry mythras-dialog"><fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fall.Target"))}</legend><div class="sheet-field-readonly">${escape(actorDisplayName(actor))} — TAM ${initial.actorSize}</div></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fall.TypeLabel"))}</legend>${["fall", "vehicle", "object"].map((kind) => `<label><input type="radio" class="sheet-state-box" name="kind" value="${kind}" ${kind === "fall" ? "checked" : ""}><span>${escape(game.i18n.localize(`MYTHRASF.Fall.Type.${kind}`))}</span></label>`).join("")}</fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fall.Parameters"))}</legend><label><span>${escape(game.i18n.localize("MYTHRASF.Fall.Distance"))}</span><input type="number" class="sheet-field-editable" name="distance" min="0" step="0.5" value="2"></label><label data-fall-vehicle hidden><span>${escape(game.i18n.localize("MYTHRASF.Fall.VehicleSpeed"))}</span><input type="number" class="sheet-field-editable" name="speedPerRound" min="0" step="1" value="0"></label><label data-fall-object hidden><span>${escape(game.i18n.localize("MYTHRASF.Fall.ObjectSize"))}</span><input type="number" class="sheet-field-editable" name="objectSize" min="1" step="1" value="6"></label><label><input type="checkbox" class="sheet-state-box" name="acrobaticsSuccess"><span>${escape(game.i18n.localize("MYTHRASF.Fall.AcrobaticsSuccess"))}</span></label><label><input type="checkbox" class="sheet-state-box" name="softSurface"><span>${escape(game.i18n.localize("MYTHRASF.Fall.SoftSurface"))}</span></label><label><input type="checkbox" class="sheet-state-box" name="dangerousSurface"><span>${escape(game.i18n.localize("MYTHRASF.Fall.DangerousSurface"))}</span></label><label data-fall-dangerous hidden><span>${escape(game.i18n.localize("MYTHRASF.Fall.DangerousSurfaceFormula"))}</span><input class="sheet-field-editable" name="dangerousSurfaceFormula" value="1d6"></label></fieldset>
      <fieldset><legend>${escape(game.i18n.localize("MYTHRASF.Fall.Damage"))}</legend><div data-fall-summary class="sheet-field-readonly"></div><label><span>${escape(game.i18n.localize("MYTHRASF.Fall.DamageFormula"))}</span><input class="sheet-field-editable" name="formula" value="${initial.formula}"></label><label><span>${escape(game.i18n.localize("MYTHRASF.Fall.LocationCount"))}</span><input type="number" class="sheet-field-editable" name="locationCount" min="0" step="1" value="${initial.locations}"></label></fieldset></div>`,
    buttons: [{ action: "apply", label: game.i18n.localize("MYTHRASF.Fall.Apply"),
      icon: "fas fa-person-falling", default: true, callback: (event, button) => ({
        kind: button.form.elements.kind.value,
        distance: Number(button.form.elements.distance.value),
        speedPerRound: Number(button.form.elements.speedPerRound.value),
        objectSize: Number(button.form.elements.objectSize.value),
        acrobaticsSuccess: button.form.elements.acrobaticsSuccess.checked,
        softSurface: button.form.elements.softSurface.checked,
        dangerousSurface: button.form.elements.dangerousSurface.checked,
        dangerousSurfaceFormula: button.form.elements.dangerousSurfaceFormula.value.trim(),
        formula: button.form.elements.formula.value.trim(),
        locationCount: Number(button.form.elements.locationCount.value)
      }) }, { action: "cancel", label: game.i18n.localize("MYTHRASF.Cancel"),
      icon: "fas fa-times", callback: () => null }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form"); let previous = initial;
      const refresh = () => {
        const current = calculateFall({ actorSize: actor.system.size,
          kind: form.elements.kind.value, distance: form.elements.distance.value,
          speedPerRound: form.elements.speedPerRound.value,
          objectSize: form.elements.objectSize.value,
          acrobaticsSuccess: form.elements.acrobaticsSuccess.checked,
          softSurface: form.elements.softSurface.checked,
          dangerousSurface: form.elements.dangerousSurface.checked });
        form.querySelector("[data-fall-vehicle]").hidden = current.kind !== "vehicle";
        form.querySelector("[data-fall-object]").hidden = current.kind !== "object";
        form.querySelector("[data-fall-dangerous]").hidden = !current.dangerousSurface;
        form.elements.acrobaticsSuccess.closest("label").hidden = current.kind === "object";
        if (form.elements.formula.value.trim() === previous.formula) form.elements.formula.value = current.formula;
        if (Number(form.elements.locationCount.value) === previous.locations) form.elements.locationCount.value = current.locations;
        form.querySelector("[data-fall-summary]").textContent = game.i18n.format("MYTHRASF.Fall.Summary", { distance: current.effectiveDistance, formula: current.formula, locations: current.locations });
        previous = current;
      };
      form?.addEventListener("change", refresh); form?.addEventListener("input", refresh); refresh();
    }, rejectClose: false
  });
  if (!result || typeof result !== "object") return null;
  return applyFallDamage(actor, result, { token });
}

export function createFallApi() {
  return Object.freeze({ open: openFallDialog, apply: applyFallDamage, calculate: calculateFall });
}
