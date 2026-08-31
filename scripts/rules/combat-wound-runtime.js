import { findWeaponMode } from "./weapon-modes.js";
import { woundLocationKind } from "./hit-locations.js";
import { executeWoundConsequencePlan, woundConsequencePlan } from "./wound-consequences.js";

export function heldCombatItemChoices(actor) {
  return actor.items.filter((item) => {
    if (item.type !== "weapon" || !item.system.equipped) return false;
    const mode = findWeaponMode(item, item.system.activeModeKey);
    return Number(mode?.handsRequired ?? 1) > 0;
  }).map((item) => ({ id: item.id, name: item.name, img: item.img ?? "" }));
}

export async function applyCombatWoundConsequences(combat, defender, location,
  { afterEndurance = false, manual = false, evaluateRoll, addStatus, applyDying,
    applyDeath } = {}) {
  const wound = combat.damage.resultingWound;
  if (!["serious", "major"].includes(wound)) return false;
  const pseudoEffect = { side: "attacker", target: "opponent", slot: -1,
    key: `wound-${wound}` };
  const { extremity, arm, leg } = woundLocationKind(location);
  const check = (combat.effects?.checks ?? []).find((entry) => entry.source === "wound"
    && entry.id === `wound-${location.id}`);
  const enduranceSucceeded = check?.status === "resolved" && !check.resolution?.manual
    ? check.resolution?.winner === "left" : null;
  if (check?.resolution?.manual) combat.consequences = [...(combat.consequences ?? []), {
    key: "manualWoundOutcome", status: "pending", locationId: location.id,
    requiresConfirmation: true }];
  const planInput = { wound, locationKind: { extremity, arm, leg }, enduranceSucceeded,
    healingRate: defender.system.attributes?.healingRate,
    penetratingDamage: combat.damage.penetratingDamage };
  const plan = woundConsequencePlan(planInput);
  const baselineTypes = new Set(woundConsequencePlan({ ...planInput,
    enduranceSucceeded: null }).actions.map((action) => action.type));
  const executablePlan = afterEndurance ? { ...plan,
    actions: plan.actions.filter((action) => !baselineTypes.has(action.type)) } : plan;
  await executeWoundConsequencePlan(executablePlan, {
    stunned: async (action) => {
      const duration = await evaluateRoll(action.durationFormula, { manual });
      return addStatus(combat, pseudoEffect, { key: "stunned", statusId: "stunned",
        turns: duration.total, locationId: location.id });
    },
    disableLocation: () => location.update({ "system.disabled": true }),
    dropHeldItem: () => {
      combat.consequences = [...(combat.consequences ?? []), { key: "dropHeldItem",
        status: "pending", actorSide: "defender", locationId: location.id,
        locationName: location.name, itemChoices: heldCombatItemChoices(defender) }];
    },
    prone: () => addStatus(combat, pseudoEffect, { key: "prone", statusId: "prone",
      unit: "manual", locationId: location.id }),
    unconscious: (action) => addStatus(combat, pseudoEffect, { key: "unconscious",
      statusId: "unconscious", unit: "manual", locationId: location.id,
      metadata: action.durationNote ? { durationNote: action.durationNote } : undefined }),
    dying: (action) => applyDying(defender, { rounds: action.rounds, mode: action.mode,
      locationId: location.id, sourceName: location.name }),
    death: () => applyDeath(defender)
  });
  return true;
}
