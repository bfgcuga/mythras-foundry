import { defaultItemIcon } from "../data/item-icons.js";
import { equipmentIcon } from "../data/equipment.js";
import { TRAIT_SOURCES } from "../data/traits.js";
import { mergeWeaponProfiles } from "../rules/combat-style-weapons.js";
import { styleAbilityKey } from "../rules/background-generation.js";
import { mergeTraitReferences, parseLegacyTraitText, traitSlug } from "../rules/traits.js";
import { weaponModes } from "../rules/weapon-modes.js";

export async function runtimeTraitCatalog() {
  const officialPack = game.packs.get("mythras-foundry.traits");
  const official = officialPack ? await officialPack.getDocuments() : [];
  return [...official, ...game.items.filter((item) => item.type === "trait")];
}

export function traitSourceMatch(item) {
  const key = traitSlug(item.system?.key || item.name);
  return TRAIT_SOURCES.find((source) => source.buildKey === key
    || traitSlug(source.name) === traitSlug(item.name));
}

export async function migrateTraitData(item, catalog) {
  if (item.type === "trait") {
    const source = traitSourceMatch(item);
    const update = {};
    if (!item.system.key) update["system.key"] = source?.system.key || traitSlug(item.name);
    if (!item.system.source && source?.system.source) update["system.source"] = source.system.source;
    if ((!item.system.traitType || item.system.traitType === "other") && source?.system.traitType) {
      update["system.traitType"] = source.system.traitType;
    }
    if (source?.system.requiresAllGroupMembers && !item.system.requiresAllGroupMembers) {
      update["system.requiresAllGroupMembers"] = true;
    }
    if (Object.keys(update).length) await item.update(update);
    return;
  }
  if (!["combatStyle", "weapon"].includes(item.type)) return;
  const update = {};
  if (item.type === "combatStyle"
    && foundry.utils.hasProperty(item._source, "system.traits")) {
    update["system.-=traits"] = null;
  }
  if (item.type === "weapon") {
    let modesChanged = false;
    const rawModes = item._source.system?.modes ?? [];
    const modes = weaponModes(item).map((mode, index) => {
      const legacyTraits = rawModes[index]?.traits;
      const parsed = parseLegacyTraitText(legacyTraits, catalog);
      const modeMerged = mergeTraitReferences(mode.traitRefs, parsed.references);
      if (!modeMerged.added && legacyTraits === undefined) return mode;
      modesChanged = true;
      return { ...mode, traitRefs: modeMerged.references };
    });
    if (modesChanged) update["system.modes"] = modes;
  }
  if (Object.keys(update).length) await item.update(update);
}

export async function migrateEmbeddedItemIcons(actor) {
  const updates = actor.items.map(getLegacyItemIconUpdate).filter(Boolean);
  if (updates.length > 0) await actor.updateEmbeddedDocuments("Item", updates);
}

export function getLegacyItemIconUpdate(item) {
  if (item.type === "equipment") {
    const normalizedName = String(item.name ?? "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const rentedDwelling = normalizedName.includes("alquilad")
      && ["choza", "chabola", "cabana", "casa", "apartamento", "villa", "mansion"]
        .some((word) => normalizedName.includes(word));
    if (rentedDwelling) return { _id: item.id, img: equipmentIcon("property", true),
      "system.category": "property", "system.isContainer": true };
    if (item.system.category === "livestock"
      && item.img !== equipmentIcon("livestock")) {
      return { _id: item.id, img: equipmentIcon("livestock") };
    }
    if (item.system.category === "vehicle"
      && item.img !== equipmentIcon("vehicle")) {
      return { _id: item.id, img: equipmentIcon("vehicle") };
    }
    if (item.system.category === "property"
      && (item.img !== equipmentIcon("property", true) || !item.system.isContainer)) {
      return { _id: item.id, img: equipmentIcon("property", true),
        "system.isContainer": true };
    }
  }
  if (item.type === "armor" && ["icons/svg/breastplate.svg", "icons/svg/item-bag.svg",
    "icons/svg/mystery-man.svg"].includes(item.img)) {
    return { _id: item.id, img: defaultItemIcon("armor") };
  }
  if (item.type === "passion" && item.img === "icons/svg/heart.svg") {
    return { _id: item.id, img: defaultItemIcon("passion") };
  }
  if (item.type === "combatStyle" && item.img === "icons/svg/sword.svg") {
    return { _id: item.id, img: defaultItemIcon("combatStyle") };
  }
  return null;
}

export async function deduplicateBackgroundAbilities(actor) {
  const seen = new Map();
  const duplicates = [];
  for (const item of actor.items) {
    const flaggedKey = item.getFlag("mythras-foundry", "backgroundAbility")
      ?? item.getFlag("mythras-foundry", "backgroundDraftAbility");
    // A combat style is identified by its normalized name even when it predates
    // the background wizard or carries a stale phase flag.
    const key = item.type === "combatStyle"
      ? styleAbilityKey(item.name)
      : flaggedKey;
    if (!key) continue;
    const keeper = seen.get(key);
    if (!keeper) {
      seen.set(key, item);
      continue;
    }
    const pointFields = [
      "culturePoints", "professionPoints", "freePoints", "experiencePoints"
    ];
    const update = { _id: keeper.id };
    for (const field of pointFields) {
      update[`system.${field}`] = Math.max(
        Number(keeper.system[field] ?? 0),
        Number(item.system[field] ?? 0)
      );
    }
    update["system.trained"] = Boolean(keeper.system.trained || item.system.trained);
    update["system.fumbled"] = Boolean(keeper.system.fumbled || item.system.fumbled);
    const mergedProfiles = mergeWeaponProfiles(
      keeper.system.weaponProfiles, item.system.weaponProfiles ?? []
    );
    if (mergedProfiles.added) update["system.weaponProfiles"] = mergedProfiles.profiles;
    const mergedTraits = mergeTraitReferences(keeper.system.traitRefs, item.system.traitRefs);
    if (mergedTraits.added) update["system.traitRefs"] = mergedTraits.references;
    await actor.updateEmbeddedDocuments("Item", [update]);
    duplicates.push(item.id);
  }
  if (duplicates.length > 0) {
    await actor.deleteEmbeddedDocuments("Item", duplicates);
  }
}

export async function migrateLegacySkill(item) {
  const update = getLegacySkillUpdate(item);
  if (update) await item.update(update);
}

export function getLegacySkillUpdate(item) {
  const update = { _id: item.id };
  let changed = false;

  if (item.system.category === "standard") {
    update["system.category"] = "basic";
    changed = true;
  }

  if (!item.system.group) {
    update["system.group"] = getDefaultSkillGroup(item);
    changed = true;
  }

  if (foundry.utils.hasProperty(item._source, "system.used")) {
    update["system.-=used"] = null;
    update["system.fumbled"] = false;
    changed = true;
  }

  const legacyBonus = Number(foundry.utils.getProperty(item._source, "system.bonus") ?? 0);
  const assignedPoints = [
    item.system.culturePoints,
    item.system.professionPoints,
    item.system.freePoints,
    item.system.experiencePoints
  ].reduce((total, value) => total + Number(value ?? 0), 0);
  if (legacyBonus !== 0 && assignedPoints === 0) {
    update["system.freePoints"] = Math.max(0, legacyBonus);
  }
  if (legacyBonus !== 0) {
    update["system.bonus"] = 0;
    changed = true;
  }

  if (item.type === "combatStyle") {
    for (const field of ["weapons", "traits"]) {
      if (foundry.utils.hasProperty(item._source, `system.${field}`)) {
        update[`system.-=${field}`] = null;
        changed = true;
      }
    }
  }

  return changed ? update : null;
}

export function getDefaultSkillGroup(item) {
  if (["lengua-materna", "idioma"].includes(item.system.slug)) return "language";
  if (["aguante", "evadir", "musculo", "voluntad"].includes(item.system.slug)) {
    return "resistance";
  }
  return item.system.category === "professional" ? "professional" : "basic";
}
