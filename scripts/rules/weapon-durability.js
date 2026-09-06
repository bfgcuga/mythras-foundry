export function weaponDurabilityState(weapon) {
  const system = weapon?.system ?? weapon ?? {};
  const maximum = Math.max(0, Number(system.maxHitPoints) || 0);
  const current = Math.max(0, Number(system.currentHitPoints) || 0);
  if (maximum <= 0) return "indestructible";
  if (current <= 0) return "broken";
  if (current < maximum) return "damaged";
  return "intact";
}

export function weaponHasDurability(weapon) {
  return Math.max(0, Number((weapon?.system ?? weapon)?.maxHitPoints) || 0) > 0;
}

export function weaponCanEquip(weapon) {
  const system = weapon?.system ?? weapon ?? {};
  return Boolean(weapon) && !system.inoperable && weaponDurabilityState(system) !== "broken";
}

export function weaponDamageResult({ currentHitPoints = 0, armorPoints = 0, damage = 0 } = {}) {
  const before = Math.max(0, Number(currentHitPoints) || 0);
  const armor = Math.max(0, Number(armorPoints) || 0);
  const rolled = Math.max(0, Number(damage) || 0);
  const penetratingDamage = Math.max(0, rolled - armor);
  const afterHitPoints = Math.max(0, before - penetratingDamage);
  return Object.freeze({ armorPoints: armor, penetratingDamage,
    beforeHitPoints: before, afterHitPoints,
    result: afterHitPoints <= 0 ? "broken"
      : afterHitPoints < before ? "damaged" : "unharmed" });
}
