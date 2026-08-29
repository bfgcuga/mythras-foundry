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

export function resolvePendingExchangeSteps(combat, { note = "", userId = "",
  resolvedAt = Date.now() } = {}) {
  const manualResolution = { manual: true, note: String(note), userId, resolvedAt };
  for (const check of combat?.effects?.checks ?? []) {
    if (check.status !== "pending") continue;
    check.status = "resolved";
    check.resolution = { ...manualResolution };
  }
  for (const effect of combat?.effects?.selections ?? []) {
    if (effect.status !== "pending") continue;
    effect.status = "resolved";
    effect.resolution = { ...manualResolution };
  }
  for (const consequence of combat?.consequences ?? []) {
    if (consequence.status !== "pending") continue;
    Object.assign(consequence, { status: "resolved", note: String(note), userId, resolvedAt });
  }
  return combat;
}
