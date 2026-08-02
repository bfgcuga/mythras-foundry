export const HAND_CAPACITY = 2;

export function inferWeaponHands(weapon) {
  const system = weapon?.system ?? weapon ?? {};
  if (system.profileKey === "desarmado") return 0;
  const grip = String(system.grip ?? "").toLocaleLowerCase("es");
  if (/2|dos/.test(grip)) return 2;
  return 1;
}

export function weaponHandsRequired(weapon) {
  const value = Number(weapon?.system?.handsRequired ?? weapon?.handsRequired);
  return Number.isFinite(value) ? Math.max(0, Math.min(HAND_CAPACITY, Math.trunc(value))) : inferWeaponHands(weapon);
}

export function equippedHandsUsed(weapons, excludedId = null) {
  return weapons.reduce((total, weapon) => (
    weapon.id !== excludedId && weapon.system?.equipped
      ? total + weaponHandsRequired(weapon)
      : total
  ), 0);
}

export function assessWeaponEquip(weapon, weapons) {
  const required = weaponHandsRequired(weapon);
  const used = equippedHandsUsed(weapons, weapon.id);
  return {
    required,
    used,
    available: Math.max(0, HAND_CAPACITY - used),
    allowed: used + required <= HAND_CAPACITY
  };
}
