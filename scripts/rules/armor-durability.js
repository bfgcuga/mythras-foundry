import { armorCoversLocation } from "./armor.js";

export function armorMaximumPoints(armor) {
  const system = armor?.system ?? armor ?? {};
  return Math.max(0, Number(system.maxArmorPoints ?? 0))
    || Math.max(0, Number(system.armorPoints ?? 0));
}

export function armorDurabilityState(armor) {
  const system = armor?.system ?? armor ?? {};
  const current = Math.max(0, Number(system.armorPoints ?? 0));
  const maximum = armorMaximumPoints(system);
  if (maximum > 0 && current <= 0) return "broken";
  if (maximum > 0 && current < maximum) return "damaged";
  return "intact";
}

export function armorCanEquip(armor) {
  return armorDurabilityState(armor) !== "broken";
}

export function armorSunderLayer(location, armors = []) {
  const worn = Array.from(armors).filter((armor) => armor?.type === "armor"
    && armor.system?.equipped && Number(armor.system?.armorPoints ?? 0) > 0
    && armorCoversLocation(armor, location))
    .sort((left, right) => Number(right.system.armorPoints) - Number(left.system.armorPoints)
      || String(left.id).localeCompare(String(right.id)));
  if (worn.length) return { kind: "worn", item: worn[0] };
  return Number(location?.system?.armorPoints ?? 0) > 0
    ? { kind: "natural", item: location } : null;
}

export function armorSunderResult({ damage = 0, protectionPoints = 0, armorPoints = 0 } = {}) {
  const applied = Math.max(0, Math.floor(Number(damage) || 0));
  const protection = Math.max(0, Math.floor(Number(protectionPoints) || 0));
  const before = Math.max(0, Math.floor(Number(armorPoints) || 0));
  const excess = Math.max(0, applied - protection);
  const armorDamage = Math.min(before, excess);
  const after = before - armorDamage;
  return Object.freeze({ damage: applied, protectionPoints: protection, excess,
    armorBefore: before, armorDamage, armorAfter: after,
    penetratingDamage: Math.max(0, excess - armorDamage) });
}
