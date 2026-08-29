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

export function prepareDamageChecks(combat, { location, resultingWound,
  penetratingDamage, weaponTarget = false } = {}) {
  const previousChecks = new Map((combat.effects?.checks ?? []).map((check) => [check.id, check]));
  const checks = [];
  (weaponTarget ? [] : combat.effects?.selections ?? []).forEach((effect, order) => {
    if (effect.requiresWound) effect.status = penetratingDamage > 0
      ? effect.status === "resolved" ? "resolved" : "pending" : "notActivated";
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
