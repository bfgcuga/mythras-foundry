import { findWeaponMode } from "./weapon-modes.js";

export const HAND_CAPACITY = 2;

export function inferWeaponHands(weapon, mode = null) {
  const system = mode ?? weapon?.system ?? weapon ?? {};
  if (system.profileKey === "desarmado") return 0;
  const grip = String(system.grip ?? "").toLocaleLowerCase("es");
  if (/2|dos/.test(grip)) return 2;
  return 1;
}

export function weaponHandsRequired(weapon, modeOrKey = null) {
  const mode = modeOrKey && typeof modeOrKey === "object" ? modeOrKey
    : (modeOrKey || weapon?.system?.modes?.length ? findWeaponMode(weapon, modeOrKey ?? "") : null);
  const source = mode ?? weapon?.system ?? weapon ?? {};
  const inferred = inferWeaponHands(weapon, source);
  if (inferred === 2 || inferred === 0) return inferred;
  const value = Number(source.handsRequired);
  return Number.isFinite(value) ? Math.max(0, Math.min(HAND_CAPACITY, Math.trunc(value))) : inferred;
}

export function equippedHandsUsed(weapons, excludedId = null) {
  return weapons.reduce((total, weapon) => (
    weapon.id !== excludedId && weapon.system?.equipped
      ? total + weaponHandsRequired(weapon)
      : total
  ), 0);
}

export function assessWeaponEquip(weapon, weapons, modeKey = "") {
  const required = weaponHandsRequired(weapon, modeKey);
  const used = equippedHandsUsed(weapons, weapon.id);
  return {
    required,
    used,
    available: Math.max(0, HAND_CAPACITY - used),
    allowed: used + required <= HAND_CAPACITY
  };
}
