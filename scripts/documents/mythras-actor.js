import { worstWoundLevel } from "../rules/hit-locations.js";
import { automaticIncapacitatedCauses, INCAPACITATED_FLAG_SCOPE,
  INCAPACITATED_MANUAL_FLAG, INCAPACITATED_STATUS_ID,
  incapacitatedCauses } from "../rules/incapacitated.js";

function state(actor) {
  const woundLevel = worstWoundLevel(
    actor.items.filter((item) => item.type === "hitLocation")
  );
  const manual = Boolean(actor.getFlag(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG));
  return {
    fatigueKey: actor.system.fatigueLevel,
    woundLevel,
    manual,
    automatic: automaticIncapacitatedCauses({ fatigueKey: actor.system.fatigueLevel, woundLevel })
  };
}

export function actorIncapacitatedState(actor) {
  const current = state(actor);
  return { ...current, causes: incapacitatedCauses(current), active: incapacitatedCauses(current).length > 0 };
}

export async function syncIncapacitatedStatus(actor) {
  if (!actor || !["character", "npc"].includes(actor.type) || !actor.isOwner) return undefined;
  const { active } = actorIncapacitatedState(actor);
  const displayed = actor.statuses?.has(INCAPACITATED_STATUS_ID) ?? false;
  if (active === displayed) return undefined;
  return actor.toggleStatusEffect(INCAPACITATED_STATUS_ID, {
    active,
    mythrasAutomaticSync: true
  });
}

export class MythrasActor extends Actor {
  async toggleStatusEffect(statusId, options = {}) {
    if (statusId !== INCAPACITATED_STATUS_ID || options.mythrasAutomaticSync) {
      const forwarded = { ...options };
      delete forwarded.mythrasAutomaticSync;
      return super.toggleStatusEffect(statusId, forwarded);
    }

    const current = actorIncapacitatedState(this);
    const displayed = this.statuses?.has(statusId) ?? false;
    const activate = options.active ?? !displayed;
    if (!activate && current.automatic.length) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Status.IncapacitatedLocked"));
      return undefined;
    }

    if (activate !== current.manual) {
      await this.update({
        [`flags.${INCAPACITATED_FLAG_SCOPE}.${INCAPACITATED_MANUAL_FLAG}`]: activate
      });
    }
    return syncIncapacitatedStatus(this);
  }
}
