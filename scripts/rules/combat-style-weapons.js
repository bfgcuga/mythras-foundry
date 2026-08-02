import { normalizeWeaponProfile, parseWeaponProfileReferences } from "./combat.js";
import { effectiveModeProfileKey, weaponModeDisplayName, weaponModes } from "./weapon-modes.js";

export function weaponProfileOptions(weapon) {
  const profiles = new Map();
  for (const mode of weaponModes(weapon)) {
    const key = normalizeWeaponProfile(effectiveModeProfileKey(weapon, mode));
    if (!key) continue;
    if (profiles.has(key)) {
      profiles.get(key).name = weapon.name || key;
      continue;
    }
    profiles.set(key, { key, name: weaponModeDisplayName(weapon, mode) || weapon.name || key });
  }
  return [...profiles.values()];
}

export function mergeWeaponProfiles(current, incoming) {
  const profiles = (current ?? []).map((profile) => ({ key: profile.key, name: profile.name }));
  const keys = new Set(profiles.map((profile) => normalizeWeaponProfile(profile.key)));
  let added = 0;
  let duplicates = 0;
  for (const candidate of incoming ?? []) {
    const key = normalizeWeaponProfile(candidate.key || candidate.name);
    if (!key) continue;
    if (keys.has(key)) {
      duplicates += 1;
      continue;
    }
    profiles.push({ key, name: String(candidate.name || key).trim() });
    keys.add(key);
    added += 1;
  }
  return { profiles, added, duplicates };
}

export function manualWeaponProfiles(value) {
  return parseWeaponProfileReferences(value);
}

export function removeWeaponProfile(profiles, key) {
  const normalized = normalizeWeaponProfile(key);
  return (profiles ?? []).filter((profile) => normalizeWeaponProfile(profile.key) !== normalized)
    .map((profile) => ({ key: profile.key, name: profile.name }));
}
