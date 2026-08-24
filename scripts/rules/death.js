export function defeatedStatusId(config = globalThis.CONFIG) {
  return config?.specialStatusEffects?.DEFEATED ?? "dead";
}

export async function applyDeath(actor) {
  if (!actor) return false;
  const statusId = defeatedStatusId();
  if (!actor.statuses?.has?.(statusId)) {
    await actor.toggleStatusEffect(statusId, { active: true, overlay: true });
  }
  for (const combat of game.combats?.filter?.((entry) => entry.started) ?? []) {
    for (const combatant of combat.combatants ?? []) {
      if (combatant.actor?.uuid === actor.uuid && !combatant.isDefeated) {
        await combatant.update({ defeated: true });
      }
    }
  }
  return true;
}

export async function synchronizeFatigueDeath(actor) {
  if (actor?.system?.fatigueLevel !== "dead") return false;
  return applyDeath(actor);
}
