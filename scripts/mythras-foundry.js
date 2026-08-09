import { CharacterData } from "./data/character-data.js";
import { NpcData } from "./data/npc-data.js";
import { ensureBasicSkills } from "./data/basic-skills.js";
import { defaultItemIcon } from "./data/item-icons.js";
import { DEFAULT_HOME_DATA, equipmentIcon } from "./data/equipment.js";
import {
  BackgroundData,
  ArmorData,
  CombatStyleData,
  EquipmentData,
  HitLocationData,
  PassionData,
  SkillData,
  TraitData,
  WeaponData
} from "./data/item-data.js";
import { MythrasItem } from "./documents/mythras-item.js";
import { calculateLocationHitPoints, humanArmorFactors, humanHitLocationData,
  worstWoundLevel } from "./rules/hit-locations.js";
import { normalizeWeaponProfile, parseWeaponProfileReferences } from "./rules/combat.js";
import { calculateDerivedAttributes } from "./rules/derived-attributes.js";
import { styleAbilityKey } from "./rules/background-generation.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { NpcSheet } from "./sheets/npc-sheet.js";
import { MythrasItemSheet } from "./sheets/item-sheet.js";
import { activateCombatCard } from "./rules/combat-chat.js";
import { weaponHandsRequired } from "./rules/equipment.js";
import { legacyWeaponMode, weaponModes } from "./rules/weapon-modes.js";
import { WeaponModeMergeTool } from "./apps/weapon-mode-merge-tool.js";
import { PartyManager } from "./apps/party-manager.js";
import { createPartyApi } from "./api/party-api.js";
import { applyFatigue, combinedConditionLevel } from "./rules/fatigue.js";
import { configureNewArmorPiece } from "./apps/armor-piece-configurator.js";
import { ARMOR_MATERIAL_MODIFIERS, armorLocationForReference,
  armorPieceTypeForLocation } from "./rules/armor.js";
import { isGenericItemName, nextNumberedItemName } from "./rules/item-names.js";
import { activateDelayedTooltips } from "./ui/tooltips.js";
import { fumbledSkillUpdatesAtZero } from "./rules/skills.js";
import { managedMacroUpdate } from "./data/macros.js";
import { calculateNpcAttributes } from "./rules/npc.js";
import { regenerateNpcActor } from "./rules/npc-token.js";
import { activateActionPointSettingVisibility, getActionPointRules,
  getSystemSetting, registerSystemSettings, SETTING_KEYS } from "./settings.js";

const PARTIALS = [
  "systems/mythras-foundry/templates/actor/parts/background-wizard.hbs",
  "systems/mythras-foundry/templates/actor/parts/characteristics.hbs",
  "systems/mythras-foundry/templates/actor/parts/combat-tab.hbs",
  "systems/mythras-foundry/templates/actor/parts/inventory-list.hbs",
  "systems/mythras-foundry/templates/actor/parts/inventory-tree.hbs",
  "systems/mythras-foundry/templates/actor/parts/skill-overview.hbs"
];

Hooks.once("init", async () => {
  console.log("Mythras Foundry | Inicializando sistema");

  CONFIG.Actor.dataModels.character = CharacterData;
  CONFIG.Actor.dataModels.npc = NpcData;
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
  CONFIG.Item.dataModels.trait = TraitData;
  registerSystemSettings();
  game.settings.registerMenu("mythras-foundry", "partyManager", {
    name: "MYTHRASF.Party.Manager", label: "MYTHRASF.Party.ManagerOpen",
    hint: "MYTHRASF.Party.ManagerHint", icon: "fas fa-users",
    type: PartyManager, restricted: true
  });
  game.settings.registerMenu("mythras-foundry", "weaponModeMerge", {
    name: "MYTHRASF.Weapon.MergeTool", label: "MYTHRASF.Weapon.MergeTool",
    hint: "MYTHRASF.Weapon.MergeHelp", icon: "fas fa-object-group",
    type: WeaponModeMergeTool, restricted: true
  });
  game.mythrasFoundry = {
    ...(game.mythrasFoundry ?? {}),
    party: createPartyApi({
      getConfig: () => getSystemSetting(SETTING_KEYS.parties),
      getActors: () => game.actors,
      openManager: () => {
        if (!game.user.isGM) return null;
        const manager = new PartyManager();
        manager.render({ force: true });
        return manager;
      }
    })
  };

  foundry.documents.collections.Actors.registerSheet(
    "mythras-foundry",
    CharacterSheet,
    {
      types: ["character"],
      makeDefault: true,
      label: "MYTHRASF.Sheet.Character"
    }
  );

  foundry.documents.collections.Actors.registerSheet(
    "mythras-foundry",
    NpcSheet,
    {
      types: ["npc"],
      makeDefault: true,
      label: "MYTHRASF.Sheet.Npc"
    }
  );

  foundry.documents.collections.Items.registerSheet(
    "mythras-foundry",
    MythrasItemSheet,
    {
      types: ["skill", "combatStyle", "culture", "profession", "passion", "equipment", "weapon", "armor", "hitLocation", "trait"],
      makeDefault: true,
      label: "MYTHRASF.Sheet.Item"
    }
  );

  await loadTemplates(PARTIALS);
});

Hooks.once("setup", () => {
  // Character documents were first prepared before world settings became
  // readable. Re-run their derived data now so configured rules take effect.
  game.actors?.forEach((actor) => {
    if (actor.type === "character") actor.prepareData();
  });
});

Hooks.on("renderChatMessageHTML", (message, html) => activateCombatCard(message, html));
Hooks.on("renderChatMessage", (message, html) => activateCombatCard(message, html));
Hooks.on("renderApplicationV2", (application, element) => {
  activateDelayedTooltips(element);
  activateActionPointSettingVisibility(element);
});
Hooks.on("renderApplication", (application, html) => {
  activateDelayedTooltips(html);
  activateActionPointSettingVisibility(html);
});

Hooks.on("preUpdateActor", (actor, changed) => {
  if (!isCombatActor(actor)) return;

  const expanded = foundry.utils.expandObject(changed);
  const candidate = foundry.utils.mergeObject(
    foundry.utils.deepClone(actor.system.toObject()),
    expanded.system ?? {},
    { inplace: false }
  );
  const baseAttributes = actor.type === "npc"
    ? calculateNpcAttributes(candidate)
    : calculateDerivedAttributes(candidate, getActionPointRules());
  const condition = combinedConditionLevel(candidate.fatigueLevel,
    worstWoundLevel(actor.items.filter((item) => item.type === "hitLocation")));
  const attributes = applyFatigue(baseAttributes, condition.key);

  clampResource(changed, candidate, "actionPoints", attributes.actionPointsMax);
  clampResource(changed, candidate, "luckPoints", attributes.luckPointsMax);
  clampResource(changed, candidate, "magicPoints", attributes.magicPointsMax);
});

Hooks.on("updateItem", async (item, changed, options, userId) => {
  const actor = item.parent;
  if (userId !== game.user.id || item.type !== "hitLocation" || !isCombatActor(actor)) return;
  const baseAttributes = actor.type === "npc"
    ? calculateNpcAttributes(actor.system)
    : calculateDerivedAttributes(actor.system, getActionPointRules());
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
  if (isGenericItemName(data.name ?? item.name, type, (key) => game.i18n.localize(key))) {
    const documents = item.parent?.items ?? game.items ?? [];
    item.updateSource({ name: nextNumberedItemName(
      type, documents, (key) => game.i18n.localize(key)
    ) });
  }
  if (type === "combatStyle" && !(system.weaponProfiles?.length) && system.weapons) {
    item.updateSource({ "system.weaponProfiles": parseWeaponProfileReferences(system.weapons) });
  }
  if (type === "weapon" && !system.profileKey) {
    item.updateSource({ "system.profileKey": normalizeWeaponProfile(data.name ?? item.name) });
  }
  if (type === "weapon" && Number(system.hitPoints ?? 0) > 0
    && !Number(system.maxHitPoints ?? 0)) {
    item.updateSource({
      "system.maxHitPoints": Number(system.hitPoints),
      "system.currentHitPoints": Number(system.hitPoints)
    });
  }
  if (type === "weapon" && !(system.modes?.length)) {
    const mode = legacyWeaponMode({ name: data.name ?? item.name, system });
    item.updateSource({ "system.modes": [mode], "system.activeModeKey": mode.key });
  }
  if (type === "armor") {
    const referenceLocation = system.referenceLocation || "special";
    const material = system.material || "leather";
    item.updateSource({
      "system.profileKey": system.profileKey || normalizeWeaponProfile(data.name ?? item.name),
      "system.profileName": system.profileName || data.name || item.name,
      "system.pieceType": armorPieceTypeForLocation(referenceLocation),
      "system.referenceLocation": referenceLocation,
      "system.material": material,
      "system.materialModifier": ARMOR_MATERIAL_MODIFIERS[material] ?? 1,
      "system.coveredLocationIds": Array.from(system.coveredLocationIds ?? []).slice(0, 1),
      "system.coverageMigrated": true,
      "system.armorRulesVersion": 4
    });
  }
});

Hooks.on("createItem", async (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "armor" || !isCombatActor(item.parent)) return;
  if ((item.system.coveredLocationIds?.length ?? 0) > 0) return;
  if (item.system.referenceLocation === "special") {
    configureNewArmorPiece(item).catch((error) => {
      console.error("Mythras Foundry | Error configuring armor piece", error);
      ui.notifications.error(game.i18n.localize("MYTHRASF.Armor.Piece.ConfigureError"));
    });
    return;
  }
  const locations = item.parent.items.filter((candidate) => candidate.type === "hitLocation");
  const location = armorLocationForReference(item.system.referenceLocation, locations);
  if (location) {
    await item.update({ "system.coveredLocationIds": [location.id], "system.equipped": false });
  } else {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Armor.ReferenceLocationMissing"));
  }
});

Hooks.on("preCreateActor", (actor, data) => {
  if ((data.type ?? actor.type) !== "npc") return;
  actor.updateSource({ "prototypeToken.actorLink": false });
});

Hooks.on("createToken", async (token, options, userId) => {
  if (userId !== game.user.id || token.actorLink || token.isLinked) return;
  const actor = token.actor;
  if (actor?.type !== "npc" || actor.system.generatedInstance) return;
  await regenerateNpcActor(actor, { notify: false });
});

Hooks.on("createActor", async (actor, options, userId) => {
  if (userId !== game.user.id) return;
  await ensureBasicSkills(actor);
  if (actor.type === "character") {
    await ensureHumanHitLocations(actor);
    await ensureDefaultHome(actor);
    await actor.update({ "system.backgroundCreationEnabled": true });
  }
});

Hooks.once("ready", async () => {
  if (!isPrimaryActiveGM()) return;

  const macroUpdates = game.macros.map(managedMacroUpdate).filter(Boolean);
  if (macroUpdates.length) await Macro.updateDocuments(macroUpdates);

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

  for (const actor of game.actors.filter((candidate) => isCombatActor(candidate))) {
    const legacyEmbeddedSkills = actor.items.filter(
      (item) => item.type === "skill"
    );
    const legacyUpdates = legacyEmbeddedSkills
      .map(getLegacySkillUpdate)
      .filter(Boolean);
    if (legacyUpdates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", legacyUpdates);
    }
    if (actor.type === "character") {
      await ensureBasicSkills(actor);
      await deduplicateBackgroundAbilities(actor);
    }
    await migrateEmbeddedItemIcons(actor);
    await migrateCombatItems(actor);
    if (actor.type === "character") await ensureHumanHitLocations(actor);
    if (actor.type === "character") await ensureDefaultHome(actor);
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
  if (userId !== game.user.id || !isCombatActor(actor)) return;
  if (actor.type === "character" && foundry.utils.hasProperty(changed, "system.experienceRolls")
    && Number(actor.system.experienceRolls ?? 0) === 0) {
    const fumbleUpdates = fumbledSkillUpdatesAtZero(actor.system.experienceRolls, actor.items);
    if (fumbleUpdates.length) await actor.updateEmbeddedDocuments("Item", fumbleUpdates);
  }
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

async function ensureDefaultHome(actor) {
  if (actor.type !== "character"
    || actor.getFlag("mythras-foundry", "inventoryInitialized")) return;
  if (actor.items.some((item) => (
    item.type === "equipment" && (item.getFlag("mythras-foundry", "defaultHome")
      || (item.system.category === "property" && item.name === "Casa"))
  ))) {
    await actor.setFlag("mythras-foundry", "inventoryInitialized", true);
    return;
  }
  await actor.createEmbeddedDocuments("Item", [{
    ...DEFAULT_HOME_DATA,
    flags: { ...DEFAULT_HOME_DATA.flags,
      "mythras-foundry": { ...DEFAULT_HOME_DATA.flags["mythras-foundry"], defaultHome: true } }
  }]);
  await actor.setFlag("mythras-foundry", "inventoryInitialized", true);
}

function defaultArmorFactors(location) {
  if (location.system.category === "chest") return { encumbrance: 3, cost: 25 };
  if (location.system.category === "abdomen") return { encumbrance: 2, cost: 20 };
  if (location.system.category === "head") return { encumbrance: 1.5, cost: 10 };
  if (location.system.hpClass === "arm") return { encumbrance: 1, cost: 7.5 };
  return { encumbrance: 1.5, cost: 15 };
}

async function migrateActorArmor(actor) {
  const updates = [];
  const obsoleteArmorIds = [];
  for (const item of actor.items) {
    if (item.type === "hitLocation"
      && Number(item._source.system?.armorFactorsVersion ?? 0) < 2) {
      const humanFactors = humanArmorFactors(item);
      const factors = humanFactors ? {
        encumbrance: humanFactors.armorEncumbranceMultiplier,
        cost: humanFactors.armorCostPercentage
      } : {
        encumbrance: Number(item.system.armorEncumbranceMultiplier
          ?? defaultArmorFactors(item).encumbrance),
        cost: Number(item.system.armorCostPercentage ?? defaultArmorFactors(item).cost)
      };
      updates.push({
        _id: item.id,
        "system.armorEncumbranceMultiplier": factors.encumbrance,
        "system.armorCostPercentage": factors.cost,
        "system.armorFactorsVersion": 2
      });
    }
    if (item.type === "armor"
      && Number(item._source.system?.armorRulesVersion ?? 0) < 4) obsoleteArmorIds.push(item.id);
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (obsoleteArmorIds.length) await actor.deleteEmbeddedDocuments("Item", obsoleteArmorIds);
}

async function migrateWorldArmor(item) {
  if (Number(item._source.system?.armorRulesVersion ?? 0) >= 4) return;
  const referenceLocation = item.system.referenceLocation || "special";
  const material = item.system.material || "leather";
  await item.update({
    "system.profileKey": normalizeWeaponProfile(item.name),
    "system.profileName": item.name,
    "system.coveredLocationIds": Array.from(item.system.coveredLocationIds ?? []).slice(0, 1),
    "system.referenceLocation": referenceLocation,
    "system.pieceType": armorPieceTypeForLocation(referenceLocation),
    "system.material": material,
    "system.materialModifier": ARMOR_MATERIAL_MODIFIERS[material] ?? 1,
    "system.baseEncumbrance": Number(item.system.baseEncumbrance ?? item.system.weight ?? 0),
    "system.baseValue": Number(item.system.baseValue ?? item.system.value ?? 0),
    "system.armorRulesVersion": 4,
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
  const hasLegacyHitPoints = foundry.utils.hasProperty(item._source, "system.hitPoints");
  const legacy = Number(foundry.utils.getProperty(item._source, "system.hitPoints") ?? 0);
  if (!item.system.maxHitPoints && legacy) {
    update["system.maxHitPoints"] = legacy;
    update["system.currentHitPoints"] = legacy;
  }
  if (hasLegacyHitPoints) update["system.-=hitPoints"] = null;
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

function isCombatActor(actor) {
  return Boolean(actor && ["character", "npc"].includes(actor.type));
}
