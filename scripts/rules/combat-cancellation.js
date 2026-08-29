export function combatCanBeCancelled(combat) {
  if (!combat || combat.status === "cancelled" || combat.consequencesApplied) return false;
  return !["applying", "applied"].includes(combat.damage?.status);
}
