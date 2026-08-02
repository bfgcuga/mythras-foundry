export const WEAPON_MODE_TYPES = Object.freeze(["melee", "ranged", "shield"]);

export function normalizeModeKey(value, fallback = "mode") {
  const normalized = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function legacyWeaponMode(weapon) {
  const system = weapon?.system ?? weapon ?? {};
  const type = WEAPON_MODE_TYPES.includes(system.weaponType) ? system.weaponType : "melee";
  return {
    key: normalizeModeKey(type === "ranged" ? "ranged" : type === "shield" ? "shield" : "melee"),
    name: "",
    profileKey: "",
    weaponType: type,
    damage: system.damage ?? "",
    damageModifierMode: system.damageModifierMode ?? "full",
    size: system.size ?? "",
    reach: system.reach ?? "",
    effects: system.effects ?? "",
    grip: system.grip ?? "",
    handsRequired: Number(system.effectiveHandsRequired ?? system.handsRequired ?? 1),
    range: system.range ?? "",
    reload: system.reload ?? "",
    preferredCombatStyleId: system.preferredCombatStyleId ?? "",
    familiarity: system.familiarity ?? "similar"
  };
}

export function weaponModes(weapon) {
  const modes = weapon?.system?.modes ?? weapon?.modes;
  return Array.isArray(modes) && modes.length ? modes : [legacyWeaponMode(weapon)];
}

export function findWeaponMode(weapon, modeKey = "") {
  const modes = weaponModes(weapon);
  const requested = modeKey || weapon?.system?.activeModeKey || weapon?.activeModeKey;
  return modes.find((mode) => mode.key === requested) ?? modes[0] ?? null;
}

export function effectiveModeProfileKey(weapon, mode) {
  return String(mode?.profileKey || weapon?.system?.profileKey || weapon?.profileKey || "");
}

export function weaponModeView(weapon, modeOrKey = "") {
  const mode = typeof modeOrKey === "object" ? modeOrKey : findWeaponMode(weapon, modeOrKey);
  if (!mode) return null;
  return {
    id: weapon?.id,
    name: weaponModeDisplayName(weapon, mode),
    actor: weapon?.actor,
    parentWeapon: weapon,
    mode,
    system: {
      ...mode,
      profileKey: effectiveModeProfileKey(weapon, mode),
      armorPoints: weapon?.system?.armorPoints ?? 0,
      maxHitPoints: weapon?.system?.maxHitPoints ?? 0,
      currentHitPoints: weapon?.system?.currentHitPoints ?? 0,
      equipped: Boolean(weapon?.system?.equipped)
    }
  };
}

export function weaponModeDisplayName(weapon, mode) {
  const name = String(weapon?.name ?? "").trim();
  const suffix = String(mode?.name ?? "").trim();
  return suffix ? `${name} - ${suffix}` : name;
}

export function nextModeKey(modes, seed = "mode") {
  const base = normalizeModeKey(seed);
  const keys = new Set((modes ?? []).map((mode) => mode.key));
  if (!keys.has(base)) return base;
  let suffix = 2;
  while (keys.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function modeKeysAreUnique(modes) {
  const keys = (modes ?? []).map((mode) => normalizeModeKey(mode.key));
  return keys.length === new Set(keys).size;
}
