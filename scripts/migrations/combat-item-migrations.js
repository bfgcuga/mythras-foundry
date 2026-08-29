import { normalizeWeaponProfile, parseWeaponProfileReferences } from "../rules/combat.js";
import { legacyWeaponMode, weaponModes } from "../rules/weapon-modes.js";
import { parseRangeProfile } from "../rules/ranged-combat.js";

export async function migrateCombatItems(actor) {
  const updates = [];
  for (const item of actor.items) {
    const legacyWeapons = foundry.utils.getProperty(item._source, "system.weapons");
    if (item.type === "combatStyle" && (item.system.weaponProfiles?.length ?? 0) === 0
      && legacyWeapons) {
      updates.push({ _id: item.id,
        "system.weaponProfiles": parseWeaponProfileReferences(legacyWeapons) });
    }
    if (item.type === "combatStyle") {
      const update = updates.find((candidate) => candidate._id === item.id) ?? { _id: item.id };
      const legacyBonus = Number(foundry.utils.getProperty(item._source, "system.bonus") ?? 0);
      const assigned = ["culturePoints", "professionPoints", "freePoints", "experiencePoints"]
        .reduce((total, field) => total + Number(item.system[field] ?? 0), 0);
      if (legacyBonus && assigned === 0) update["system.freePoints"] = Math.max(0, legacyBonus);
      if (legacyBonus !== 0) update["system.bonus"] = 0;
      for (const field of ["weapons", "traits"]) {
        if (foundry.utils.hasProperty(item._source, `system.${field}`)) {
          update[`system.-=${field}`] = null;
        }
      }
      if (Object.keys(update).length > 1 && !updates.includes(update)) updates.push(update);
    }
    if (item.type === "weapon") {
      const update = { _id: item.id };
      let changed = false;
      if (!(item.system.modes?.length)) {
        const mode = legacyWeaponMode(item);
        update["system.modes"] = [mode];
        update["system.activeModeKey"] = mode.key;
        changed = true;
      } else if (!weaponModes(item).some((mode) => mode.key === item.system.activeModeKey)) {
        update["system.activeModeKey"] = weaponModes(item)[0].key;
        changed = true;
      }
      if (!item.system.profileKey) {
        update["system.profileKey"] = normalizeWeaponProfile(item.name);
        changed = true;
      }
      const hasLegacyHitPoints = foundry.utils.hasProperty(item._source, "system.hitPoints");
      const legacy = Number(foundry.utils.getProperty(item._source, "system.hitPoints") ?? 0);
      if (!item.system.maxHitPoints && legacy) {
        update["system.maxHitPoints"] = legacy;
        update["system.currentHitPoints"] = legacy;
        changed = true;
      }
      if (hasLegacyHitPoints) {
        update["system.-=hitPoints"] = null;
        changed = true;
      }
      const normalizedModes = siegeModeMigration(item);
      if (normalizedModes) {
        update["system.modes"] = normalizedModes;
        changed = true;
      }
      const migrationBaseModes = normalizedModes ?? weaponModes(item);
      const rangedModes = migrationBaseModes.map((mode) => {
        if (!["ranged", "siege"].includes(mode.weaponType) || Number(mode.rangeLong) > 0) return mode;
        const profile = parseRangeProfile(mode.range); if (!profile) return mode;
        return { ...mode, rangeShort: profile.short, rangeEffective: profile.effective,
          rangeLong: profile.long, reloadActions: Math.max(0, Number(mode.reload) || 0),
          ammoTracking: false, ammoCapacity: 1, ammoLoaded: 0, ammoReserve: 0,
          reloadProgress: 0 };
      });
      if (rangedModes.some((mode, index) => mode !== migrationBaseModes[index])) {
        update["system.modes"] = rangedModes; changed = true;
      }
      if (appendObsoleteWeaponFieldRemovals(item, update)) changed = true;
      if (changed) updates.push(update);
    }
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

export async function migrateWorldCombatItem(item) {
  const legacyWeapons = foundry.utils.getProperty(item._source, "system.weapons");
  if (item.type === "combatStyle" && (item.system.weaponProfiles?.length ?? 0) === 0
    && legacyWeapons) {
    await item.update({ "system.weaponProfiles": parseWeaponProfileReferences(legacyWeapons) });
  }
  if (item.type === "combatStyle") {
    const update = {};
    const legacyBonus = Number(foundry.utils.getProperty(item._source, "system.bonus") ?? 0);
    const assigned = ["culturePoints", "professionPoints", "freePoints", "experiencePoints"]
      .reduce((total, field) => total + Number(item.system[field] ?? 0), 0);
    if (legacyBonus && assigned === 0) update["system.freePoints"] = Math.max(0, legacyBonus);
    if (legacyBonus !== 0) update["system.bonus"] = 0;
    for (const field of ["weapons", "traits"]) {
      if (foundry.utils.hasProperty(item._source, `system.${field}`)) {
        update[`system.-=${field}`] = null;
      }
    }
    if (Object.keys(update).length) await item.update(update);
    return;
  }
  if (item.type !== "weapon") return;
  const update = {};
  if (!(item.system.modes?.length)) {
    const mode = legacyWeaponMode(item);
    update["system.modes"] = [mode];
    update["system.activeModeKey"] = mode.key;
  } else if (!weaponModes(item).some((mode) => mode.key === item.system.activeModeKey)) {
    update["system.activeModeKey"] = weaponModes(item)[0].key;
  }
  if (!item.system.profileKey) update["system.profileKey"] = normalizeWeaponProfile(item.name);
  const hasLegacyHitPoints = foundry.utils.hasProperty(item._source, "system.hitPoints");
  const legacy = Number(foundry.utils.getProperty(item._source, "system.hitPoints") ?? 0);
  if (!item.system.maxHitPoints && legacy) {
    update["system.maxHitPoints"] = legacy;
    update["system.currentHitPoints"] = legacy;
  }
  if (hasLegacyHitPoints) update["system.-=hitPoints"] = null;
  const normalizedModes = siegeModeMigration(item);
  if (normalizedModes) update["system.modes"] = normalizedModes;
  const migrationBaseModes = normalizedModes ?? weaponModes(item);
  const rangedModes = migrationBaseModes.map((mode) => {
    if (!["ranged", "siege"].includes(mode.weaponType) || Number(mode.rangeLong) > 0) return mode;
    const profile = parseRangeProfile(mode.range); if (!profile) return mode;
    return { ...mode, rangeShort: profile.short, rangeEffective: profile.effective,
      rangeLong: profile.long, reloadActions: Math.max(0, Number(mode.reload) || 0),
      ammoTracking: false, ammoCapacity: 1, ammoLoaded: 0, ammoReserve: 0,
      reloadProgress: 0 };
  });
  if (rangedModes.some((mode, index) => mode !== migrationBaseModes[index])) {
    update["system.modes"] = rangedModes;
  }
  appendObsoleteWeaponFieldRemovals(item, update);
  if (Object.keys(update).length) await item.update(update);
}

const OBSOLETE_WEAPON_FIELDS = Object.freeze([
  "weight", "location", "quantityFormula", "weaponType", "damage", "damageModifierMode", "size", "reach", "effects",
  "traits", "traitRefs", "grip", "handsRequired", "range", "reload", "impalingSize",
  "powerModifier", "crewMinimum", "crewMaximum", "preferredCombatStyleId", "familiarity"
]);

export function appendObsoleteWeaponFieldRemovals(item, update) {
  let changed = false;
  for (const field of OBSOLETE_WEAPON_FIELDS) {
    if (!foundry.utils.hasProperty(item._source, `system.${field}`)) continue;
    update[`system.-=${field}`] = null;
    changed = true;
  }
  return changed;
}

export function siegeModeMigration(item) {
  let changed = false;
  const modes = weaponModes(item).map((mode) => {
    if (mode.weaponType === "siege" || (
      mode.key !== "siege" && Number(mode.crewMaximum ?? 0) <= 0
    )) return mode;
    changed = true;
    return { ...mode, weaponType: "siege" };
  });
  return changed ? modes : null;
}
