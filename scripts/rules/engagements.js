export const ENGAGEMENT_SCHEMA_VERSION = 1;
export const REACH_ORDER = Object.freeze(["T", "C", "M", "L", "ML"]);

export function reachIndex(reach) { return REACH_ORDER.indexOf(String(reach ?? "").toUpperCase()); }
export function reachDifference(left, right) {
  const a = reachIndex(left); const b = reachIndex(right);
  return a < 0 || b < 0 ? null : Math.abs(a - b);
}
export function engagementId(leftId, rightId) {
  return [String(leftId), String(rightId)].sort().join("::");
}
export function initialReachPosition(leftReach, rightReach) {
  const a = reachIndex(leftReach); const b = reachIndex(rightReach);
  if (a < 0 || b < 0 || Math.abs(a - b) < 2) return "neutral";
  return "longer";
}
export function relationSituationReach(relation) {
  const reaches = Object.values(relation?.sides ?? {}).map((side) => side.reach)
    .filter((reach) => reachIndex(reach) >= 0).sort((a, b) => reachIndex(a) - reachIndex(b));
  if (!reaches.length || relation?.position === "neutral") return "—";
  return relation.position === "longer" ? reaches.at(-1) : reaches[0];
}
export function engagementRestriction(relation, actorId, weaponReach) {
  if (!relation || relation.status !== "engaged" || relation.position === "neutral") return { allowed: true };
  const own = relation.sides?.[actorId];
  const other = Object.entries(relation.sides ?? {}).find(([id]) => id !== actorId)?.[1];
  const difference = reachDifference(weaponReach ?? own?.reach, other?.reach);
  if (!own || !other || difference == null || difference < 2) return { allowed: true };
  const ownLonger = reachIndex(weaponReach ?? own.reach) > reachIndex(other.reach);
  if (relation.position === "longer" && !ownLonger) return { allowed: false, reason: "tooShort", difference };
  if (relation.position === "shorter" && ownLonger) return { allowed: true, pommel: true,
    difference, effectiveSizeSteps: difference };
  return { allowed: true, difference };
}
export function shiftedWeaponSize(size, steps) {
  const sizes = ["P", "M", "G", "E", "D"];
  const index = sizes.indexOf(String(size ?? "").toUpperCase());
  return index < 0 ? size : sizes[Math.max(0, index - Math.max(0, Number(steps) || 0))];
}
export function relationSnapshot({ left, right, userId = "", reason = "automatic" }) {
  return { schemaVersion: ENGAGEMENT_SCHEMA_VERSION, id: engagementId(left.combatantId, right.combatantId),
    revision: 0, status: "engaged", position: initialReachPosition(left.reach, right.reach),
    sides: { [left.combatantId]: { ...left }, [right.combatantId]: { ...right } },
    userId, reason, updatedAt: Date.now() };
}
