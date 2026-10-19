// One interpretation of health for damage, conditions and presentation.
export function usesGlobalHitPoints(value) {
  const actor = value?.actor ?? (value?.parent?.type === "npc" ? value.parent : value);
  return actor?.system?.hitPointMode === "global";
}

export function characteristicAbsent(system, key) {
  return (system?.absentCharacteristics ?? []).includes(key);
}

export function characteristicValue(system, key) {
  return characteristicAbsent(system, key) ? null : system?.[key];
}

export function woundLevel(current, maximum) {
  const value = Number(current ?? 0);
  const max = Math.max(1, Number(maximum ?? 1));
  if (value >= max) return "healthy";
  if (value > 0) return "minor";
  if (value > -max) return "serious";
  return "major";
}

export function healthWoundLevel(actor, location, current = location?.system?.currentHitPoints) {
  return usesGlobalHitPoints(actor ?? location)
    ? (Number(current) < Number(location?.system?.maxHitPoints) ? "minor" : "healthy")
    : woundLevel(current, location?.system?.maxHitPoints);
}

export function healthHitPoints(actor, value) {
  return usesGlobalHitPoints(actor) ? Math.max(0, Number(value) || 0) : value;
}

export function globalHealthState(actor) {
  if (!usesGlobalHitPoints(actor)) return null;
  const body = Array.from(actor.items ?? []).find((item) => item.type === "hitLocation");
  return { current: Math.max(0, Number(body?.system?.currentHitPoints) || 0),
    maximum: Number(body?.system?.maxHitPoints) || 0,
    exhausted: Number(body?.system?.currentHitPoints ?? 0) <= 0 };
}

export function globalHealthConfigurationValid(system, items = []) {
  if (system?.hitPointMode !== "global") return true;
  const locations = Array.from(items).filter((item) => item.type === "hitLocation");
  return locations.length === 1 && Number(locations[0].system?.rangeStart) === 1
    && Number(locations[0].system?.rangeEnd) === 20
    && !locations[0].system?.autoCalculate && Number(locations[0].system?.maxHitPoints) >= 1
    && !locations[0].system?.disabled && !Number(locations[0].system?.permanentWound?.severity ?? 0);
}

export const NPC_ATTRIBUTE_DEPENDENCIES = Object.freeze({
  actionPoints: ["intelligence", "dexterity"], initiative: ["dexterity", "intelligence"],
  movementRate: [], magicPoints: ["power"], luckPoints: ["power"],
  damageModifier: ["strength", "size"]
});

export function npcAttributeRequiresManual(system, key) {
  return (NPC_ATTRIBUTE_DEPENDENCIES[key] ?? []).some((entry) => characteristicAbsent(system, entry));
}

export function normalizeAbsentCharacteristics(system) {
  for (const key of system.absentCharacteristics ?? []) {
    if (system.characteristicFormulas) system.characteristicFormulas[key] = "";
  }
  system.attributeOverrides ??= {};
  for (const key of Object.keys(NPC_ATTRIBUTE_DEPENDENCIES)) {
    if (!npcAttributeRequiresManual(system, key)) continue;
    const override = system.attributeOverrides[key] ??= {};
    if (override.mode !== "manual") Object.assign(override, {
      mode: "manual", ...(key === "damageModifier" ? { formula: "0" } : { value: 0, formula: "" })
    });
  }
  return system;
}
