import { calculateDerivedAttributes } from "./derived-attributes.js";
import { calculateNpcAttributes } from "./npc.js";
import { resolveActorConditions } from "./actor-conditions.js";

export function effectiveActionPointMaximum(actor, actionPointRules = {}) {
  if (!actor || !["character", "npc"].includes(actor.type)) return 0;
  const baseAttributes = actor.type === "npc"
    ? calculateNpcAttributes(actor.system)
    : calculateDerivedAttributes(actor.system, actionPointRules);
  return Math.max(0, Number(resolveActorConditions(actor, { baseAttributes })
    .attributes.actionPointsMax ?? 0));
}

export function currentActionPoints(actor) {
  return Math.max(0, Number(actor?.system?.resources?.actionPoints?.value ?? 0));
}

export function combatantActionPointState(combatant, maximum) {
  const defeated = Boolean(combatant?.isDefeated ?? combatant?.defeated);
  const effectiveMaximum = defeated ? 0 : Math.max(0, Number(maximum) || 0);
  return Object.freeze({ maximum: effectiveMaximum,
    current: defeated ? 0 : currentActionPoints(combatant?.actor),
    eligible: effectiveMaximum > 0 && !defeated });
}
