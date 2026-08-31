import { combatSideEntry } from "./combat-effect-runtime.js";

export async function applyManualCombatEffectResolution(message, request, { clone, flagScope,
  resolveActor, userById, render } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)) return false;
  const user = userById(request.userId);
  if (!user) return false;
  const effect = (combat.effects?.selections ?? []).find((entry) =>
    Number(entry.slot) === Number(request.slot));
  if (!effect || effect.status !== "pending"
    || !["applied", "unavailable", "missedLocation"].includes(combat.damage?.status)) return false;
  const selfSide = effect.side ?? combat.effects.winner;
  const affectedSide = effect.target === "self" ? selfSide
    : selfSide === "attacker" ? "defender" : "attacker";
  const affectedEntry = combatSideEntry(combat, affectedSide);
  const affected = await resolveActor(affectedEntry.tokenUuid, affectedEntry.actorUuid);
  if (!affected || (!user.isGM && !affected.testUserPermission(user, "OWNER"))) return false;
  if ((combat.effects?.checks ?? []).some((check) => check.effectKey === effect.key
    && check.status === "pending")) return false;
  effect.status = "resolved";
  effect.resolution = { manual: true, note: String(request.note ?? ""),
    userId: user.id, resolvedAt: Date.now() };
  combat.revision += 1;
  await message.update({ content: render(combat), [`flags.${flagScope}.combat`]: combat });
  return true;
}

export async function applyCombatCheckTransition(message, request, { clone, flagScope,
  resolveActor, userById, warn, localize, actorName, applyWoundConsequences,
  applyEffectConsequence, effectDependencies, render, appendRolls } = {}) {
  const combat = clone(message.getFlag(flagScope, "combat"));
  if (!combat || Number(request.revision) !== Number(combat.revision)) return false;
  const pendingCheck = combat?.effects?.checks?.find((entry) => entry.id === request.checkId);
  const actorEntry = pendingCheck
    ? combatSideEntry(combat, pendingCheck.actorSide ?? "defender") : null;
  const defender = actorEntry ? await resolveActor(actorEntry.tokenUuid, actorEntry.actorUuid) : null;
  const user = userById(request.userId);
  if (!defender || !user || (!user.isGM && !defender.testUserPermission(user, "OWNER"))) {
    return false;
  }
  const check = (combat.effects?.checks ?? []).find((entry) => entry.id === request.checkId);
  const firstPending = (combat.effects?.checks ?? []).find((entry) => entry.status === "pending");
  if (!check || (request.finalize || request.reroll
    ? check.status !== "rolled" : check.status !== "pending" || firstPending?.id !== check.id)
    || (request.resolution?.manual && !user.isGM)) return false;
  if (check.source === "wound" && (combat.effects?.selections ?? [])
    .some((effect) => effect.status === "pending")) return false;
  if (request.reroll) {
    if (check.resolution?.automaticFailure) return false;
    const points = Number(defender.system.resources?.luckPoints?.value ?? 0);
    if (points < 1) { warn(localize("MYTHRASF.Luck.None")); return false; }
    await defender.update({ "system.resources.luckPoints.value": points - 1 });
    check.resolution = { ...request.resolution,
      luckHistory: [...(check.resolution?.luckHistory ?? []), {
        rawRoll: check.resolution?.rawRoll, spenderName: actorName(defender) }],
      userId: user.id, rolledAt: Date.now() };
  } else if (request.finalize) {
    check.status = "resolved";
    check.resolution = { ...check.resolution, userId: user.id, resolvedAt: Date.now() };
  } else {
    check.status = "rolled";
    check.resolution = { ...request.resolution, userId: user.id, rolledAt: Date.now() };
  }
  if (request.finalize && check.source === "wound" && combat.damage?.status === "applied") {
    const location = defender.items.get(check.locationId);
    if (location) await applyWoundConsequences(combat, defender, location,
      { afterEndurance: true, manual: request.manual });
  } else if (request.finalize && check.source !== "wound") {
    await applyEffectConsequence(combat, check, defender,
      { manual: request.manual, ...effectDependencies() });
  }
  combat.revision += 1;
  await message.update({ content: render(combat),
    rolls: appendRolls(message, request.resolution?.serializedRoll),
    [`flags.${flagScope}.combat`]: combat });
  return true;
}
