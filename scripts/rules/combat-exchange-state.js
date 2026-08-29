export function preferredCombatCoordinator(users, authorUserId) {
  const gm = Array.from(users ?? []).filter((user) => user.active && user.isGM)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
  return gm?.id ?? Array.from(users ?? []).find((user) =>
    user.id === authorUserId && user.active)?.id ?? null;
}

export function validateCombatResponse(combat, request, { actor, user }) {
  if (!["awaitingDefense", "awaitingAccidentalDefense"].includes(combat.status)) return "state";
  if (Number(request.revision) !== Number(combat.revision)) return "revision";
  if (!user || user.id !== request.userId
    || (!user.isGM && !actor?.testUserPermission(user, "OWNER"))) return "ownership";
  if (!["parry", "evade", "cover", "none"].includes(request.defense?.type)) return "invalid";
  return null;
}

export function exchangeTerminal(combat) {
  if (combat.status === "cancelled") return true;
  if (combat.status !== "resolved") return false;
  if ((combat.effects?.checks ?? []).some((entry) => entry.status === "pending")) return false;
  if ((combat.effects?.selections ?? []).some((entry) => entry.status === "pending")) return false;
  if ((combat.consequences ?? []).some((entry) => entry.status === "pending")) return false;
  return ["unavailable", "applied", "missedLocation"].includes(combat.damage?.status);
}
