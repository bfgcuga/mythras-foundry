import { woundLevel } from "../rules/hit-locations.js";
import { TIMED_CONDITION_FLAG, TIMED_CONDITION_SCOPE } from "../rules/timed-conditions.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function woundRollRisks(actor) {
  const locations = actor?.items?.filter((item) => item.type === "hitLocation") ?? [];
  const serious = locations.filter((location) =>
    woundLevel(location.system.currentHitPoints, location.system.maxHitPoints) === "serious");
  const timedIds = new Set(Array.from(actor?.effects ?? []).flatMap((effect) => {
    if (effect.disabled) return [];
    const condition = effect.getFlag?.(TIMED_CONDITION_SCOPE, TIMED_CONDITION_FLAG);
    return condition?.locationId && condition?.untilPositiveHitPoints
      ? [condition.locationId] : [];
  }));
  const unusable = locations.filter((location) => location.system.disabled
    || location.system.amputated || timedIds.has(location.id));
  return Object.freeze({ serious, unusable });
}

export async function askWoundRollImpact(actor, { physical = false } = {}) {
  if (!physical) return Object.freeze({ seriousPenalty: false, unusableMember: false });
  const risks = woundRollRisks(actor);
  if (!risks.serious.length && !risks.unusable.length) {
    return Object.freeze({ seriousPenalty: false, unusableMember: false });
  }
  const serious = risks.serious.length ? `<label><input type="checkbox" class="sheet-state-box" name="seriousPenalty"><span>${escape(game.i18n.format("MYTHRASF.Wound.SelectivePenalty", { locations: risks.serious.map((item) => item.name).join(", ") }))}</span></label>` : "";
  const unusable = risks.unusable.length ? `<label><input type="checkbox" class="sheet-state-box" name="unusableMember"><span>${escape(game.i18n.format("MYTHRASF.Wound.SelectiveUnusable", { locations: risks.unusable.map((item) => item.name).join(", ") }))}</span></label>` : "";
  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Wound.RollImpactTitle") },
    content: `<div class="mythras-foundry mythras-dialog wound-roll-impact"><p>${escape(game.i18n.localize("MYTHRASF.Wound.RollImpactPrompt"))}</p>${serious}${unusable}</div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.Confirm"),
      callback: (event, button) => ({
        seriousPenalty: Boolean(button.form.elements.seriousPenalty?.checked),
        unusableMember: Boolean(button.form.elements.unusableMember?.checked)
      }) }], close: () => ({ seriousPenalty: false, unusableMember: false }), rejectClose: false
  }) ?? Object.freeze({ seriousPenalty: false, unusableMember: false });
}
