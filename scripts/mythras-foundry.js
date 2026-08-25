import { ensureBasicSkills } from "./data/basic-skills.js";
import { defaultItemIcon } from "./data/item-icons.js";
import { DEFAULT_HOME_DATA, equipmentIcon } from "./data/equipment.js";
import { actorIncapacitatedState, syncIncapacitatedStatus
} from "./documents/mythras-actor.js";
import { calculateLocationHitPoints, humanArmorFactors, humanHitLocationData,
  permanentWoundState, worstWoundLevel } from "./rules/hit-locations.js";
import { normalizeWeaponProfile, parseWeaponProfileReferences } from "./rules/combat.js";
import { mergeWeaponProfiles } from "./rules/combat-style-weapons.js";
import { calculateDerivedAttributes } from "./rules/derived-attributes.js";
import { styleAbilityKey } from "./rules/background-generation.js";
import { legacyWeaponMode, weaponModes } from "./rules/weapon-modes.js";
import { conditionDescriptors, resolveConditions } from "./rules/condition-resolver.js";
import { configureNewArmorPiece } from "./apps/armor-piece-configurator.js";
import { ARMOR_MATERIAL_MODIFIERS, armorLocationForReference,
  armorPieceTypeForLocation } from "./rules/armor.js";
import { isGenericItemName, nextNumberedItemName } from "./rules/item-names.js";
import { fumbledSkillUpdatesAtZero } from "./rules/skills.js";
import { managedMacroUpdate } from "./data/macros.js";
import { TRAIT_SOURCES } from "./data/traits.js";
import { mergeTraitReferences, parseLegacyTraitText, traitSlug } from "./rules/traits.js";
import { calculateNpcAttributes } from "./rules/npc.js";
import { regenerateNpcActor } from "./rules/npc-token.js";
import { getActionPointRules } from "./settings.js";
import { INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG,
  INCAPACITATED_STATUS_ID } from "./rules/incapacitated.js";
import { registerSystemInitialization } from "./system/registration.js";
import { registerUiHooks } from "./system/ui-hooks.js";
import { removeRecoveredLocationConditions } from "./rules/timed-condition-runtime.js";
import { clearAim } from "./rules/ranged-actions.js";
import { parseRangeProfile } from "./rules/ranged-combat.js";
import { resolveActorConditions } from "./rules/actor-conditions.js";
import { synchronizeFatigueDeath } from "./rules/death.js";

registerSystemInitialization();
registerUiHooks();

Hooks.on("updateToken", (token, changed, options, userId) => {
  if (userId === game.user.id && (Object.hasOwn(changed, "x") || Object.hasOwn(changed, "y") || Object.hasOwn(changed, "elevation"))
    && token.actor) clearAim(token.actor);
});

Hooks.on("createActiveEffect", (effect, options, userId) => {
  const actor = effect.parent;
  if (userId === game.user.id && isCombatActor(actor) && !resolveActorConditions(actor, {
    baseAttributes: actor.system.baseAttributes ?? actor.system.attributes ?? {}
  }).capabilities.canAttack) clearAim(actor);
});

Hooks.once("setup", () => {
  // Character documents were first prepared before world settings became
  // readable. Re-run their derived data now so configured rules take effect.
  game.actors?.forEach((actor) => {
    if (actor.type === "character") actor.prepareData();
  });
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
  const changedManualCause = foundry.utils.getProperty(
    changed, `flags.${INCAPACITATED_FLAG_SCOPE}.${INCAPACITATED_MANUAL_FLAG}`
  );
  const manuallyIncapacitated = changedManualCause ?? actor.getFlag(
    INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG
  );
  const attributes = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: candidate.fatigueLevel,
    woundLevel: worstWoundLevel(actor.items.filter((item) => item.type === "hitLocation")),
    manuallyIncapacitated: Boolean(manuallyIncapacitated
      || actor.statuses?.has(INCAPACITATED_STATUS_ID))
  }) }).attributes;

  clampResource(changed, candidate, "actionPoints", attributes.actionPointsMax);
  clampResource(changed, candidate, "luckPoints", attributes.luckPointsMax);
  clampResource(changed, candidate, "magicPoints", attributes.magicPointsMax);
});

Hooks.on("updateItem", async (item, changed, options, userId) => {
  const actor = item.parent;
  if (userId === game.user.id && item.type === "weapon" && isCombatActor(actor)
    && (foundry.utils.hasProperty(changed, "system.equipped")
      || foundry.utils.hasProperty(changed, "system.activeModeKey"))) await clearAim(actor);
  if (userId !== game.user.id || item.type !== "hitLocation" || !isCombatActor(actor)) return;
  const baseAttributes = actor.type === "npc"
    ? calculateNpcAttributes(actor.system)
    : calculateDerivedAttributes(actor.system, getActionPointRules());
  const maximum = resolveConditions({ baseAttributes, descriptors: conditionDescriptors({
    fatigueKey: actor.system.fatigueLevel,
    woundLevel: worstWoundLevel(actor.items.filter((candidate) => candidate.type === "hitLocation")),
    manuallyIncapacitated: Boolean(actor.getFlag(
      INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG)
      || actor.statuses?.has(INCAPACITATED_STATUS_ID))
  }) }).attributes.actionPointsMax;
  const current = Number(actor.system.resources.actionPoints.value ?? 0);
  if (current > maximum) {
    await actor.update({ "system.resources.actionPoints.value": maximum });
  }
  await syncIncapacitatedStatus(actor);
  await removeRecoveredLocationConditions(actor, item);
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
  if (type === "trait" && !system.key) {
    item.updateSource({ "system.key": traitSlug(data.name ?? item.name) });
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
  await syncIncapacitatedStatus(actor);
});

Hooks.once("ready", async () => {
  if (!isPrimaryActiveGM()) return;

  const traitCatalog = await runtimeTraitCatalog();

  const macroUpdates = game.macros.map(managedMacroUpdate).filter(Boolean);
  if (macroUpdates.length) await Macro.updateDocuments(macroUpdates);

  const legacyWorldSkills = game.items.filter(
    (item) => item.type === "skill"
  );
  for (const item of legacyWorldSkills) {
    await migrateLegacySkill(item);
  }
  for (const item of game.items.filter((candidate) => ["trait", "combatStyle", "weapon"].includes(candidate.type))) {
    await migrateTraitData(item, traitCatalog);
    await migrateWorldCombatItem(item);
  }
  for (const item of game.items.filter((candidate) => candidate.type === "armor")) {
    await migrateWorldArmor(item);
  }
  for (const item of game.items.filter((candidate) => candidate.type === "hitLocation")) {
    await migratePermanentWoundItem(item);
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
    for (const item of actor.items.filter((candidate) =>
      ["trait", "combatStyle", "weapon"].includes(candidate.type))) {
      await migrateTraitData(item, traitCatalog);
    }
    await migrateCombatItems(actor);
    await migrateActorPermanentWounds(actor);
    if (actor.type === "character") await ensureHumanHitLocations(actor);
    if (actor.type === "character") await ensureDefaultHome(actor);
    await migrateActorArmor(actor);
    await syncIncapacitatedStatus(actor);
    await synchronizeFatigueDeath(actor);
  }
  const worldIconUpdates = game.items
    .map(getLegacyItemIconUpdate)
    .filter(Boolean);
  if (worldIconUpdates.length > 0) {
    await Item.updateDocuments(worldIconUpdates);
  }
});

async function runtimeTraitCatalog() {
  const officialPack = game.packs.get("mythras-foundry.traits");
  const official = officialPack ? await officialPack.getDocuments() : [];
  return [...official, ...game.items.filter((item) => item.type === "trait")];
}

function traitSourceMatch(item) {
  const key = traitSlug(item.system?.key || item.name);
  return TRAIT_SOURCES.find((source) => source.buildKey === key
    || traitSlug(source.name) === traitSlug(item.name));
}

async function migrateTraitData(item, catalog) {
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

Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (userId !== game.user.id || !isCombatActor(actor)) return;
  if (actor.type === "character" && foundry.utils.hasProperty(changed, "system.experienceRolls")
    && Number(actor.system.experienceRolls ?? 0) === 0) {
    const fumbleUpdates = fumbledSkillUpdatesAtZero(actor.system.experienceRolls, actor.items);
    if (fumbleUpdates.length) await actor.updateEmbeddedDocuments("Item", fumbleUpdates);
  }
  await syncIncapacitatedStatus(actor);
  if (foundry.utils.hasProperty(changed, "system.fatigueLevel")) {
    await synchronizeFatigueDeath(actor);
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
      const severity = Number(item.system.permanentWound?.severity ?? 0);
      const wound = severity ? permanentWoundState({ ...item, system: { ...item.system,
        maxHitPoints: maximum, permanentWound: { ...item.system.permanentWound,
          originalMaxHitPoints: maximum } } }, { severity,
        roll: item.system.permanentWound.roll,
        description: item.system.permanentWound.description }) : null;
      const effectiveMaximum = wound?.effectiveMaxHitPoints ?? maximum;
      return {
        _id: item.id,
        "system.maxHitPoints": effectiveMaximum,
        "system.currentHitPoints": current === previousMaximum ? effectiveMaximum
          : Math.min(current, effectiveMaximum),
        ...(wound ? { "system.permanentWound": wound } : {})
      };
    });
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
});

Hooks.on("createItem", async (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "hitLocation" || !isCombatActor(item.parent)) return;
  await syncIncapacitatedStatus(item.parent);
});

Hooks.on("deleteItem", async (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "hitLocation" || !isCombatActor(item.parent)) return;
  await syncIncapacitatedStatus(item.parent);
});

function incapacitatedEffectActor(effect) {
  const actor = effect.parent;
  return actor?.documentName === "Actor"
    && effect.statuses?.has(INCAPACITATED_STATUS_ID) ? actor : null;
}

function protectedIncapacitatedEffect(effect) {
  const actor = incapacitatedEffectActor(effect);
  return Boolean(actor && actorIncapacitatedState(actor).automatic.length);
}

Hooks.on("preDeleteActiveEffect", (effect, options, userId) => {
  if (!protectedIncapacitatedEffect(effect)) return true;
  if (userId === game.user.id) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Status.IncapacitatedManaged"));
  }
  return false;
});

Hooks.on("preUpdateActiveEffect", (effect, changed, options, userId) => {
  if (changed.disabled !== true || !protectedIncapacitatedEffect(effect)) return true;
  if (userId === game.user.id) {
    ui.notifications.warn(game.i18n.localize("MYTHRASF.Status.IncapacitatedManaged"));
  }
  return false;
});

async function clearDeletedManualIncapacitated(effect, userId) {
  const actor = incapacitatedEffectActor(effect);
  if (userId !== game.user.id || !actor
    || !actor.getFlag(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG)) return;
  await actor.unsetFlag(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG);
}

Hooks.on("deleteActiveEffect", clearDeletedManualIncapacitated);
Hooks.on("updateActiveEffect", async (effect, changed, options, userId) => {
  if (changed.disabled === true) await clearDeletedManualIncapacitated(effect, userId);
});

async function ensureHumanHitLocations(actor) {
  if (actor.type !== "character" || actor.items.some((item) => item.type === "hitLocation")) return;
  await actor.createEmbeddedDocuments("Item", humanHitLocationData(
    actor.system,
    (key) => game.i18n.localize(key)
  ));
}

function permanentWoundMigrationUpdate(item) {
  if (item.type !== "hitLocation") return null;
  const hasLegacy = foundry.utils.hasProperty(item._source, "system.amputated");
  const legacy = Boolean(foundry.utils.getProperty(item._source, "system.amputated"));
  const storedSeverity = Number(item._source.system?.permanentWound?.severity ?? 0);
  if (!hasLegacy && storedSeverity >= 0
    && item._source.system?.permanentWound !== undefined) return null;
  const update = {};
  if (legacy && storedSeverity === 0) {
    const wound = permanentWoundState(item, { severity: 3, roll: 3,
      description: game.i18n.localize("MYTHRASF.PermanentWound.LegacyDescription") });
    update["system.permanentWound"] = wound;
    update["system.maxHitPoints"] = wound.effectiveMaxHitPoints;
    update["system.currentHitPoints"] = Math.min(Number(item.system.currentHitPoints),
      wound.effectiveMaxHitPoints);
  }
  if (hasLegacy) update["system.-=amputated"] = null;
  return Object.keys(update).length ? update : null;
}

async function migratePermanentWoundItem(item) {
  const update = permanentWoundMigrationUpdate(item);
  if (update) await item.update(update);
}

async function migrateActorPermanentWounds(actor) {
  const updates = actor.items.filter((item) => item.type === "hitLocation")
    .map((item) => {
      const update = permanentWoundMigrationUpdate(item);
      return update ? { _id: item.id, ...update } : null;
    }).filter(Boolean);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
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

async function migrateWorldCombatItem(item) {
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

function appendObsoleteWeaponFieldRemovals(item, update) {
  let changed = false;
  for (const field of OBSOLETE_WEAPON_FIELDS) {
    if (!foundry.utils.hasProperty(item._source, `system.${field}`)) continue;
    update[`system.-=${field}`] = null;
    changed = true;
  }
  return changed;
}

function siegeModeMigration(item) {
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
