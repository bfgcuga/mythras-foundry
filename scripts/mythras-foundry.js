import { CharacterData } from "./data/character-data.js";
import { ensureBasicSkills } from "./data/basic-skills.js";
import { defaultItemIcon } from "./data/item-icons.js";
import {
  BackgroundData,
  ArmorData,
  CombatStyleData,
  EquipmentData,
  HitLocationData,
  PassionData,
  SkillData,
  WeaponData
} from "./data/item-data.js";
import { MythrasItem } from "./documents/mythras-item.js";
import { calculateLocationHitPoints, humanHitLocationData,
  worstWoundLevel } from "./rules/hit-locations.js";
import { normalizeWeaponProfile, parseWeaponProfileReferences } from "./rules/combat.js";
import { calculateDerivedAttributes } from "./rules/derived-attributes.js";
import { styleAbilityKey } from "./rules/background-generation.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { MythrasItemSheet } from "./sheets/item-sheet.js";
import { activateCombatCard } from "./rules/combat-chat.js";
import { weaponHandsRequired } from "./rules/equipment.js";
import { legacyWeaponMode, weaponModes } from "./rules/weapon-modes.js";
import { WeaponModeMergeTool } from "./apps/weapon-mode-merge-tool.js";
import { applyFatigue, combinedConditionLevel } from "./rules/fatigue.js";

const PARTIALS = [
  "systems/mythras-foundry/templates/actor/parts/background-wizard.hbs",
  "systems/mythras-foundry/templates/actor/parts/characteristics.hbs",
  "systems/mythras-foundry/templates/actor/parts/combat-tab.hbs",
  "systems/mythras-foundry/templates/actor/parts/inventory-list.hbs",
  "systems/mythras-foundry/templates/actor/parts/skill-overview.hbs"
];

Hooks.once("init", async () => {
  console.log("Mythras Foundry | Inicializando sistema");

  CONFIG.Actor.dataModels.character = CharacterData;
  CONFIG.Item.documentClass = MythrasItem;
  CONFIG.Item.dataModels.skill = SkillData;
  CONFIG.Item.dataModels.combatStyle = CombatStyleData;
  CONFIG.Item.dataModels.culture = BackgroundData;
  CONFIG.Item.dataModels.profession = BackgroundData;
  CONFIG.Item.dataModels.equipment = EquipmentData;
  CONFIG.Item.dataModels.passion = PassionData;
  CONFIG.Item.dataModels.weapon = WeaponData;
  CONFIG.Item.dataModels.armor = ArmorData;
  CONFIG.Item.dataModels.hitLocation = HitLocationData;
  game.settings.registerMenu("mythras-foundry", "weaponModeMerge", {
    name: "MYTHRASF.Weapon.MergeTool", label: "MYTHRASF.Weapon.MergeTool",
    hint: "MYTHRASF.Weapon.MergeHelp", icon: "fas fa-object-group",
    type: WeaponModeMergeTool, restricted: true
  });

  foundry.documents.collections.Actors.registerSheet(
    "mythras-foundry",
    CharacterSheet,
    {
      types: ["character"],
      makeDefault: true,
      label: "MYTHRASF.Sheet.Character"
    }
  );

  foundry.documents.collections.Items.registerSheet(
    "mythras-foundry",
    MythrasItemSheet,
    {
      types: ["skill", "combatStyle", "culture", "profession", "passion", "equipment", "weapon", "armor", "hitLocation"],
      makeDefault: true,
      label: "MYTHRASF.Sheet.Item"
    }
  );

  await loadTemplates(PARTIALS);
});

Hooks.on("renderChatMessageHTML", (message, html) => activateCombatCard(message, html));
Hooks.on("renderChatMessage", (message, html) => activateCombatCard(message, html));

Hooks.on("preUpdateActor", (actor, changed) => {
  if (actor.type !== "character") return;

  const expanded = foundry.utils.expandObject(changed);
  const candidate = foundry.utils.mergeObject(
    foundry.utils.deepClone(actor.system.toObject()),
    expanded.system ?? {},
    { inplace: false }
  );
  const baseAttributes = calculateDerivedAttributes(candidate);
  const condition = combinedConditionLevel(candidate.fatigueLevel,
    worstWoundLevel(actor.items.filter((item) => item.type === "hitLocation")));
  const attributes = applyFatigue(baseAttributes, condition.key);

  clampResource(changed, candidate, "actionPoints", attributes.actionPointsMax);
  clampResource(changed, candidate, "luckPoints", attributes.luckPointsMax);
  clampResource(changed, candidate, "magicPoints", attributes.magicPointsMax);
});

Hooks.on("updateItem", async (item, changed, options, userId) => {
  const actor = item.parent;
  if (userId !== game.user.id || item.type !== "hitLocation" || actor?.type !== "character") return;
  const baseAttributes = calculateDerivedAttributes(actor.system);
  const condition = combinedConditionLevel(actor.system.fatigueLevel,
    worstWoundLevel(actor.items.filter((candidate) => candidate.type === "hitLocation")));
  const maximum = applyFatigue(baseAttributes, condition.key).actionPointsMax;
  const current = Number(actor.system.resources.actionPoints.value ?? 0);
  if (current > maximum) {
    await actor.update({ "system.resources.actionPoints.value": maximum });
  }
});

Hooks.on("preCreateItem", (item, data) => {
  const current = String(data.img ?? item.img ?? "");
  if (!current || ["icons/svg/item-bag.svg", "icons/svg/mystery-man.svg"].includes(current)) {
    item.updateSource({ img: defaultItemIcon(data.type ?? item.type) });
  }
  const type = data.type ?? item.type;
  const system = data.system ?? item.system ?? {};
  if (type === "combatStyle" && !(system.weaponProfiles?.length) && system.weapons) {
    item.updateSource({ "system.weaponProfiles": parseWeaponProfileReferences(system.weapons) });
  }
  if (type === "weapon" && !system.profileKey) {
    item.updateSource({ "system.profileKey": normalizeWeaponProfile(data.name ?? item.name) });
  }
  if (type === "weapon" && !(system.modes?.length)) {
    const mode = legacyWeaponMode({ name: data.name ?? item.name, system });
    item.updateSource({ "system.modes": [mode], "system.activeModeKey": mode.key });
  }
  if (type === "armor") {
    item.updateSource({
      "system.profileKey": system.profileKey || normalizeWeaponProfile(data.name ?? item.name),
      "system.profileName": system.profileName || data.name || item.name,
      "system.coverageMigrated": true
    });
  }
});

Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "armor" || item.parent?.type !== "character") return;
  if ((item.system.coveredLocationIds?.length ?? 0) === 0) item.sheet?.render(true);
});

Hooks.on("createActor", async (actor, options, userId) => {
  if (userId !== game.user.id) return;
  await ensureBasicSkills(actor);
  if (actor.type === "character") {
    await ensureHumanHitLocations(actor);
    await actor.update({ "system.backgroundCreationEnabled": true });
  }
});

Hooks.once("ready", async () => {
  if (!isPrimaryActiveGM()) return;

  const legacyWorldSkills = game.items.filter(
    (item) => item.type === "skill"
  );
  for (const item of legacyWorldSkills) {
    await migrateLegacySkill(item);
  }
  for (const item of game.items.filter((candidate) => ["combatStyle", "weapon"].includes(candidate.type))) {
    await migrateWorldCombatItem(item);
  }
  for (const item of game.items.filter((candidate) => candidate.type === "armor")) {
    await migrateWorldArmor(item);
  }

  for (const actor of game.actors.filter((candidate) => candidate.type === "character")) {
    const legacyEmbeddedSkills = actor.items.filter(
      (item) => item.type === "skill"
    );
    const legacyUpdates = legacyEmbeddedSkills
      .map(getLegacySkillUpdate)
      .filter(Boolean);
    if (legacyUpdates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", legacyUpdates);
    }
    await ensureBasicSkills(actor);
    await deduplicateBackgroundAbilities(actor);
    await migrateEmbeddedItemIcons(actor);
    await migrateCombatItems(actor);
    await ensureHumanHitLocations(actor);
    await migrateActorArmor(actor);
  }
  const worldIconUpdates = game.items
    .map(getLegacyItemIconUpdate)
    .filter(Boolean);
  if (worldIconUpdates.length > 0) {
    await Item.updateDocuments(worldIconUpdates);
  }
});

Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (userId !== game.user.id || actor.type !== "character") return;
  if (!foundry.utils.hasProperty(changed, "system.constitution")
    && !foundry.utils.hasProperty(changed, "system.size")) return;
  const updates = actor.items.filter((item) => item.type === "hitLocation"
    && item.system.autoCalculate).map((item) => {
      const maximum = calculateLocationHitPoints(
        actor.system.constitution, actor.system.size, item.system.hpClass
      );
      const previousMaximum = Number(item.system.maxHitPoints ?? maximum);
      const current = Number(item.system.currentHitPoints ?? previousMaximum);
      return {
        _id: item.id,
        "system.maxHitPoints": maximum,
        "system.currentHitPoints": current === previousMaximum ? maximum : current
      };
    });
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
});

async function ensureHumanHitLocations(actor) {
  if (actor.type !== "character" || actor.items.some((item) => item.type === "hitLocation")) return;
  await actor.createEmbeddedDocuments("Item", humanHitLocationData(
    actor.system,
    (key) => game.i18n.localize(key)
  ));
}

function defaultArmorFactors(location) {
  if (location.system.category === "chest") return { encumbrance: 3, cost: 30 };
  if (location.system.category === "abdomen") return { encumbrance: 2, cost: 20 };
  if (location.system.category === "head") return { encumbrance: 1.5, cost: 15 };
  if (location.system.hpClass === "arm") return { encumbrance: 1, cost: 10 };
  return { encumbrance: 1.5, cost: 15 };
}

async function migrateActorArmor(actor) {
  const updates = [];
  for (const item of actor.items) {
    if (item.type === "hitLocation"
      && (!foundry.utils.hasProperty(item._source, "system.armorEncumbranceMultiplier")
        || !foundry.utils.hasProperty(item._source, "system.armorCostPercentage"))) {
      const factors = defaultArmorFactors(item);
      updates.push({
        _id: item.id,
        "system.armorEncumbranceMultiplier": factors.encumbrance,
        "system.armorCostPercentage": factors.cost
      });
    }
    if (item.type === "armor"
      && !foundry.utils.hasProperty(item._source, "system.coverageMigrated")) {
      updates.push({
        _id: item.id,
        "system.profileKey": normalizeWeaponProfile(item.name),
        "system.profileName": item.name,
        "system.coveredLocationIds": [],
        "system.coverageMigrated": true,
        "system.coverage": "",
        "system.equipped": false
      });
    }
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

async function migrateWorldArmor(item) {
  if (foundry.utils.hasProperty(item._source, "system.coverageMigrated")) return;
  await item.update({
    "system.profileKey": normalizeWeaponProfile(item.name),
    "system.profileName": item.name,
    "system.coveredLocationIds": [],
    "system.coverageMigrated": true,
    "system.coverage": "",
    "system.equipped": false
  });
}

async function migrateCombatItems(actor) {
  const updates = [];
  for (const item of actor.items) {
    if (item.type === "combatStyle" && (item.system.weaponProfiles?.length ?? 0) === 0
      && item.system.weapons) {
      updates.push({ _id: item.id,
        "system.weaponProfiles": parseWeaponProfileReferences(item.system.weapons) });
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
      const legacy = Number(item.system.hitPoints ?? 0);
      if (!item.system.maxHitPoints && legacy) {
        update["system.maxHitPoints"] = legacy;
        update["system.currentHitPoints"] = legacy;
        changed = true;
      }
      const requiredHands = weaponHandsRequired(item);
      if (!foundry.utils.hasProperty(item._source, "system.handsRequired")
        || Number(item.system.handsRequired) !== requiredHands) {
        update["system.handsRequired"] = requiredHands;
        changed = true;
      }
      if (changed) updates.push(update);
    }
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

async function migrateWorldCombatItem(item) {
  if (item.type === "combatStyle" && (item.system.weaponProfiles?.length ?? 0) === 0
    && item.system.weapons) {
    await item.update({ "system.weaponProfiles": parseWeaponProfileReferences(item.system.weapons) });
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
  const legacy = Number(item.system.hitPoints ?? 0);
  if (!item.system.maxHitPoints && legacy) {
    update["system.maxHitPoints"] = legacy;
    update["system.currentHitPoints"] = legacy;
  }
  const requiredHands = weaponHandsRequired(item);
  if (!foundry.utils.hasProperty(item._source, "system.handsRequired")
    || Number(item.system.handsRequired) !== requiredHands) {
    update["system.handsRequired"] = requiredHands;
  }
  if (Object.keys(update).length) await item.update(update);
}

async function migrateEmbeddedItemIcons(actor) {
  const updates = actor.items.map(getLegacyItemIconUpdate).filter(Boolean);
  if (updates.length > 0) await actor.updateEmbeddedDocuments("Item", updates);
}

function getLegacyItemIconUpdate(item) {
  if (item.type === "passion" && item.img === "icons/svg/heart.svg") {
    return { _id: item.id, img: defaultItemIcon("passion") };
  }
  if (item.type === "combatStyle" && item.img === "icons/svg/sword.svg") {
    return { _id: item.id, img: defaultItemIcon("combatStyle") };
  }
  return null;
}

async function deduplicateBackgroundAbilities(actor) {
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
    if (!keeper.system.weapons && item.system.weapons) {
      update["system.weapons"] = item.system.weapons;
    }
    if (!keeper.system.traits && item.system.traits) {
      update["system.traits"] = item.system.traits;
    }
    await actor.updateEmbeddedDocuments("Item", [update]);
    duplicates.push(item.id);
  }
  if (duplicates.length > 0) {
    await actor.deleteEmbeddedDocuments("Item", duplicates);
  }
}

function isPrimaryActiveGM() {
  const primaryGM = game.users
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  return primaryGM?.id === game.user.id;
}

async function migrateLegacySkill(item) {
  const update = getLegacySkillUpdate(item);
  if (update) await item.update(update);
}

function getLegacySkillUpdate(item) {
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

  const legacyBonus = Number(item.system.bonus ?? 0);
  const assignedPoints = [
    item.system.culturePoints,
    item.system.professionPoints,
    item.system.freePoints,
    item.system.experiencePoints
  ].reduce((total, value) => total + Number(value ?? 0), 0);
  if (legacyBonus !== 0 && assignedPoints === 0) {
    update["system.freePoints"] = Math.max(0, legacyBonus);
    update["system.bonus"] = 0;
    changed = true;
  }

  return changed ? update : null;
}

function getDefaultSkillGroup(item) {
  if (["lengua-materna", "idioma"].includes(item.system.slug)) return "language";
  if (["aguante", "evadir", "musculo", "voluntad"].includes(item.system.slug)) {
    return "resistance";
  }
  return item.system.category === "professional" ? "professional" : "basic";
}

function clampResource(changed, candidate, key, maximum) {
  const current = Number(candidate.resources?.[key]?.value ?? 0);
  if (current <= maximum) return;
  foundry.utils.setProperty(changed, `system.resources.${key}.value`, maximum);
}
