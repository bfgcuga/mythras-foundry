const FINAL_DAMAGE_STATES = new Set(["rolled", "proposed", "stale", "applying", "applied"]);

export function combatRollLuckAllowed(combat) {
  if (!["awaitingDefense", "awaitingEffects", "resolved"].includes(combat?.status)) return false;
  if ((combat.effects?.selections?.length ?? 0) > 0) return false;
  return !FINAL_DAMAGE_STATES.has(combat.damage?.status);
}
