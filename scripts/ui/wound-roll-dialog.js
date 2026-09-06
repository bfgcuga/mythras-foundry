import { hitLocationDisplayName, isLocationDisabled,
  locationWoundState } from "../rules/hit-locations.js";
import { activeEntanglements, entanglementData } from "../rules/entanglement.js";

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

export function woundRollRisks(actor) {
  const locations = actor?.items?.filter((item) => item.type === "hitLocation") ?? [];
  const serious = locations.filter((location) => locationWoundState(location) === "serious");
  const unusable = locations.filter(isLocationDisabled);
  const entangled = activeEntanglements(actor).map((effect) => ({ effect,
    data: entanglementData(effect),
    location: actor.items?.get?.(entanglementData(effect).locationId) }))
    .filter((entry) => entry.location && entry.data.kind === "arm");
  return Object.freeze({ serious, unusable, entangled });
}

export async function askWoundRollImpact(actor) {
  const risks = woundRollRisks(actor);
  if (!risks.serious.length && !risks.unusable.length && !risks.entangled.length) {
    return Object.freeze({ seriousPenalty: false, unusableMember: false,
      entangledMember: false });
  }
  const serious = risks.serious.map((location) => `<label class="wound-roll-impact-option"><input type="checkbox" class="sheet-state-box" name="seriousPenalty"><span>${escape(game.i18n.format("MYTHRASF.Wound.SelectivePenalty", { location: hitLocationDisplayName(location) }))}</span></label>`).join("");
  const unusable = risks.unusable.map((location) => `<label class="wound-roll-impact-option"><input type="checkbox" class="sheet-state-box" name="unusableMember"><span>${escape(game.i18n.format("MYTHRASF.Wound.SelectiveUnusable", { location: hitLocationDisplayName(location) }))}</span></label>`).join("");
  const entangled = risks.entangled.map(({ location }) => `<label class="wound-roll-impact-option"><input type="checkbox" class="sheet-state-box" name="entangledMember"><span>${escape(game.i18n.format("MYTHRASF.Entangle.SelectiveBlocked", { location: hitLocationDisplayName(location) }))}</span></label>`).join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("MYTHRASF.Wound.RollImpactTitle") },
    content: `<div class="mythras-foundry mythras-dialog wound-roll-impact"><p>${escape(game.i18n.localize("MYTHRASF.Wound.RollImpactPrompt"))}</p>${serious}${unusable}${entangled}</div>`,
    buttons: [{ action: "confirm", label: game.i18n.localize("MYTHRASF.Confirm"),
      callback: (event, button) => ({
        seriousPenalty: Boolean(button.form.querySelector("input[name='seriousPenalty']:checked")),
        unusableMember: Boolean(button.form.querySelector("input[name='unusableMember']:checked")),
        entangledMember: Boolean(button.form.querySelector("input[name='entangledMember']:checked"))
      }) }], close: () => ({ seriousPenalty: false, unusableMember: false,
        entangledMember: false }), rejectClose: false
  }) ?? Object.freeze({ seriousPenalty: false, unusableMember: false,
    entangledMember: false });
}
