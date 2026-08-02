import { effectiveModeProfileKey, nextModeKey, weaponModes } from "./weapon-modes.js";
const PHYSICAL_FIELDS = ["quantity", "weight", "value", "encumbrance", "armorPoints", "maxHitPoints", "currentHitPoints"];
export function weaponMergeCandidates(actors) {
  const groups = [];
  for (const actor of actors ?? []) {
    const profiles = new Map();
    for (const weapon of actor.items?.filter((item) => item.type === "weapon") ?? []) {
      const key = effectiveModeProfileKey(weapon, weaponModes(weapon)[0]);
      if (!key) continue;
      profiles.set(key, [...(profiles.get(key) ?? []), weapon]);
    }
    for (const [profileKey, weapons] of profiles) if (weapons.length > 1) groups.push({ actor, profileKey, weapons,
      conflicts: PHYSICAL_FIELDS.filter((field) => new Set(weapons.map((weapon) => String(weapon.system[field] ?? ""))).size > 1) });
  }
  return groups;
}
export function mergedWeaponModes(keeper, donors) {
  const modes = weaponModes(keeper).map((mode) => ({ ...mode }));
  for (const donor of donors) for (const source of weaponModes(donor)) {
    modes.push({ ...source, key: nextModeKey(modes, source.key) });
  }
  return modes;
}
