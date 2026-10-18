import { currentActionPoints } from "./action-points.js";

const SCOPE = "mythras-foundry";
const queues = new Map();

export async function withActionPointLock(actor, operation) {
  const key = actor.uuid ?? actor.id;
  const previous = queues.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(operation);
  queues.set(key, pending);
  try { return await pending; }
  finally { if (queues.get(key) === pending) queues.delete(key); }
}

export async function removeWaitingEffect(combat, combatant) {
  const actor = combatant?.actor;
  const effects = Array.from(actor?.effects ?? []).filter(effect => {
    const ref = effect.getFlag?.(SCOPE, "waiting") ?? effect.flags?.[SCOPE]?.waiting;
    return ref?.combatId === combat.id && ref.combatantId === combatant.id;
  });
  if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(effect => effect.id));
}

// Caller holds the actor lock. Only successful paid reactions use this path.
export async function consumeActorWaiting(actor) {
  for (const combat of Array.from(game.combats?.values?.() ?? game.combats ?? [])) {
    for (const entry of Array.from(combat.combatants?.values?.() ?? combat.combatants ?? [])) {
      if (entry.actor?.uuid !== actor.uuid) continue;
      const state = foundry.utils.deepClone(combat.getFlag(SCOPE, "combatActions") ?? {});
      const delay = state.delays?.[entry.id];
      if (delay?.status !== "reserved") continue;
      delay.status = "consumed";
      delay.consumedAt = Date.now();
      state.revision = Number(state.revision ?? 0) + 1;
      await combat.setFlag(SCOPE, "combatActions", state);
      await removeWaitingEffect(combat, entry);
    }
  }
}

export async function settleWaiting(combat, combatant, { charge = true } = {}) {
  if (!combatant?.actor) return;
  return withActionPointLock(combatant.actor, async () => {
    const state = foundry.utils.deepClone(combat.getFlag(SCOPE, "combatActions") ?? {});
    const delay = state.delays?.[combatant.id];
    if (delay?.status === "reserved") {
      // Legacy reservations were already paid when declared.
      if (charge && delay.payment === "onReaction") {
        await combatant.actor.update({ "system.resources.actionPoints.value":
          Math.max(0, currentActionPoints(combatant.actor) - 1) });
      }
      delay.status = "expired";
      delay.expiredAt = Date.now();
      state.revision = Number(state.revision ?? 0) + 1;
      await combat.setFlag(SCOPE, "combatActions", state);
    }
    await removeWaitingEffect(combat, combatant);
  });
}

export async function clearCombatWaiting(combat, options = {}) {
  for (const entry of Array.from(combat.combatants?.values?.() ?? combat.combatants ?? [])) await settleWaiting(combat, entry, options);
}
