import { selectedEffectCount } from "./combat-effects.js";
import { woundLocationKind } from "./hit-locations.js";

export function damageLocationChoices(combat) {
  const locations = combat.defender.locations ?? [];
  if (selectedEffectCount(combat.effects?.selections ?? [], "chooseLocation")) {
    return locations.filter((location) => location.id === combat.damage?.locationId);
  }
  if (!selectedEffectCount(combat.effects?.selections ?? [], "aimedShot")) return locations;
  return locations.filter((location) => location.id === combat.damage?.locationId);
}

export function majorWoundLuckAdjustment({ beforeHitPoints, maxHitPoints,
  penetratingDamage } = {}) {
  const maximum = Math.max(1, Number(maxHitPoints) || 1);
  const before = Number(beforeHitPoints) || 0;
  const seriousHitPoints = 1 - maximum;
  const reducedDamage = Math.max(0, before - seriousHitPoints);
  if (reducedDamage >= Number(penetratingDamage) || before - Number(penetratingDamage) > -maximum) {
    return null;
  }
  return Object.freeze({ afterHitPoints: seriousHitPoints,
    penetratingDamage: reducedDamage, resultingWound: "serious" });
}

export function prepareDamageChecks(combat, { location, resultingWound,
  penetratingDamage, weaponTarget = false } = {}) {
  const previousChecks = new Map((combat.effects?.checks ?? []).map((check) => [check.id, check]));
  const checks = [];
  (weaponTarget ? [] : combat.effects?.selections ?? []).forEach((effect, order) => {
    if (effect.requiresWound) {
      const guided = !effect.ruleKey || effect.ruleKey === "guided";
      const activatedStatus = guided && effect.status !== "resolved"
        ? "pending" : "resolved";
      effect.status = penetratingDamage > 0 ? activatedStatus : "notActivated";
    }
    const checkId = `effect-${effect.side ?? combat.effects.winner}-${effect.slot}`;
    if (effect.endurance && penetratingDamage > 0) checks.push({
      id: checkId, source: "effect", order, effectKey: effect.key,
      effectSide: effect.side ?? combat.effects.winner, effectSlot: effect.slot,
      actorSide: "defender", abilitySlugs: ["aguante"], opposedSide: "attacker",
      label: effect.name, status: previousChecks.get(checkId)?.status ?? "pending",
      resolution: previousChecks.get(checkId)?.resolution
    });
  });
  if (!weaponTarget && ["serious", "major"].includes(resultingWound)) checks.push({
    id: `wound-${location.id}`, source: "wound", order: checks.length,
    label: resultingWound, woundSeverity: resultingWound, locationId: location.id,
    locationName: location.name, locationKind: woundLocationKind(location),
    actorSide: "defender", abilitySlugs: ["aguante"], opposedSide: "attacker",
    status: previousChecks.get(`wound-${location.id}`)?.status ?? "pending",
    resolution: previousChecks.get(`wound-${location.id}`)?.resolution
  });
  combat.effects.checks = checks;
  return checks;
}
