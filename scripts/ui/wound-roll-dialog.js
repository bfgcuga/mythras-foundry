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
    || Number(location.system.permanentWound?.severity ?? 0) > 0 || timedIds.has(location.id));
  return Object.freeze({ serious, unusable });
}

export async function askWoundRollImpact(actor, { physical = false } = {}) {
  if (!physical) return Object.freeze({ seriousPenalty: false, unusableMember: false });
  const risks = woundRollRisks(actor);
  if (!risks.serious.length && !risks.unusable.length) {
    return Object.freeze({ seriousPenalty: false, unusableMember: false });
  }
  const serious = risks.serious.map((location) => `<label class="wound-roll-impact-option"><input type="checkbox" class="sheet-state-box" name="seriousPenalty"><span>${escape(game.i18n.format("MYTHRASF.Wound.SelectivePenalty", { location: location.name }))}</span></label>`).join("");
  const unusable = risks.unusable.map((location) => `<label class="wound-roll-impact-option"><input type="checkbox" class="sheet-state-box" name="unusableMember"><span>${escape(game.i18n.format("MYTHRASF.Wound.SelectiveUnusable", { location: location.name }))}</span></label>`).join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Wound.RollImpactTitle") },
    content: `<div class="mythras-foundry mythras-dialog wound-roll-impact"><p>${escape(game.i18n.localize("MYTHRASF.Wound.RollImpactPrompt"))}</p>${serious}${unusable}</div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.Confirm"),
      callback: (event, button) => ({
        seriousPenalty: Boolean(button.form.querySelector("input[name='seriousPenalty']:checked")),
        unusableMember: Boolean(button.form.querySelector("input[name='unusableMember']:checked"))
      }) }], close: () => ({ seriousPenalty: false, unusableMember: false }), rejectClose: false
  }) ?? Object.freeze({ seriousPenalty: false, unusableMember: false });
}
