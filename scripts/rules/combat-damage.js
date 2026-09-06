import { combatEffectIsAutomated, selectedEffectCount } from "./combat-effects.js";
import { hitLocationDisplayName, woundLocationKind } from "./hit-locations.js";

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

export function independentCombatEffectChecks(combat) {
  const ids = new Set((combat.effects?.selections ?? [])
    .filter((effect) => !effect.waived && !effect.requiresWound)
    .map((effect) => `effect-${effect.side ?? combat.effects.winner}-${effect.slot}`));
  return (combat.effects?.checks ?? []).filter((check) =>
    check.source === "effect" && ids.has(check.id));
}

export function prepareDamageChecks(combat, { location, resultingWound,
  penetratingDamage, weaponTarget = false } = {}) {
  const previousChecks = new Map((combat.effects?.checks ?? []).map((check) => [check.id, check]));
  const independentChecks = new Map(independentCombatEffectChecks(combat)
    .map((check) => [check.id, check]));
  const checks = [];
  (combat.effects?.selections ?? []).forEach((effect, order) => {
    if (effect.waived) return;
    if (effect.requiresWound) {
      const checkedAutomatically = combatEffectIsAutomated(effect) && effect.endurance;
      const activatedStatus = checkedAutomatically && effect.status !== "resolved"
        ? "pending" : combatEffectIsAutomated(effect) ? "resolved" : "notAutomated";
      effect.status = !weaponTarget && penetratingDamage > 0 ? activatedStatus : "notActivated";
    }
    const checkId = `effect-${effect.side ?? combat.effects.winner}-${effect.slot}`;
    if (independentChecks.has(checkId)) {
      checks.push({ allowsShieldStyle: effect.key === "cegar-oponente",
        ...independentChecks.get(checkId) });
      return;
    }
    const unconditionalCheck = ["cegar-oponente", "disparo-de-supresion"].includes(effect.key);
    if (unconditionalCheck || (!weaponTarget && combatEffectIsAutomated(effect)
      && effect.endurance && penetratingDamage > 0)) checks.push({
      id: checkId, source: "effect", order, effectKey: effect.key,
      effectSide: effect.side ?? combat.effects.winner, effectSlot: effect.slot,
      actorSide: unconditionalCheck
        ? effect.target === "self" ? effect.side
          : effect.side === "attacker" ? "defender" : "attacker"
        : "defender",
      abilitySlugs: effect.key === "cegar-oponente" ? ["evadir"]
        : effect.key === "disparo-de-supresion" ? ["voluntad"] : ["aguante"],
      allowsShieldStyle: effect.key === "cegar-oponente",
      opposedSide: effect.side ?? "attacker",
      label: effect.name, status: previousChecks.get(checkId)?.status ?? "pending",
      automaticFailure: Boolean(effect.automaticSuccess),
      resolution: previousChecks.get(checkId)?.resolution,
      consequence: previousChecks.get(checkId)?.consequence
    });
  });
  if (!weaponTarget && ["serious", "major"].includes(resultingWound)) checks.push({
    id: `wound-${location.id}`, source: "wound", order: checks.length,
    label: resultingWound, woundSeverity: resultingWound, locationId: location.id,
    locationName: hitLocationDisplayName(location), locationKind: woundLocationKind(location),
    actorSide: "defender", abilitySlugs: ["aguante"], opposedSide: "attacker",
    status: previousChecks.get(`wound-${location.id}`)?.status ?? "pending",
    resolution: previousChecks.get(`wound-${location.id}`)?.resolution
  });
  combat.effects.checks = checks;
  return checks;
}
