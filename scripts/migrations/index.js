import { ensureBasicSkills } from "../data/basic-skills.js";
import { managedMacroUpdate } from "../data/macros.js";
import { syncIncapacitatedStatus } from "../documents/mythras-actor.js";
import { synchronizeFatigueDeath } from "../rules/death.js";
import {
  ensureDefaultHome,
  ensureHumanHitLocations,
  migrateHitLocationName,
  migrateActorArmor,
  migrateActorPermanentWounds,
  migratePermanentWoundItem,
  migrateWorldArmor
} from "./actor-migrations.js";
import { migrateCombatItems, migrateWorldCombatItem } from "./combat-item-migrations.js";
import {
  deduplicateBackgroundAbilities,
  getLegacyItemIconUpdate,
  getLegacySkillUpdate,
  migrateEmbeddedItemIcons,
  migrateLegacySkill,
  migrateTraitData,
  runtimeTraitCatalog
} from "./content-migrations.js";

export function isPrimaryActiveGM() {
  const primaryGM = game.users
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  return primaryGM?.id === game.user.id;
}

export async function initializeCreatedActor(actor) {
  await ensureBasicSkills(actor);
  if (actor.type === "character") {
    await ensureHumanHitLocations(actor);
    await ensureDefaultHome(actor);
    await actor.update({ "system.backgroundCreationEnabled": true });
  }
  await syncIncapacitatedStatus(actor);
}

export async function runWorldMigrations() {
  const traitCatalog = await runtimeTraitCatalog();

  const macroUpdates = game.macros.map(managedMacroUpdate).filter(Boolean);
  if (macroUpdates.length) await Macro.updateDocuments(macroUpdates);

  for (const item of game.items.filter((candidate) => candidate.type === "skill")) {
    await migrateLegacySkill(item);
  }
  for (const item of game.items.filter((candidate) =>
    ["trait", "combatStyle", "weapon"].includes(candidate.type))) {
    await migrateTraitData(item, traitCatalog);
    await migrateWorldCombatItem(item);
  }
  for (const item of game.items.filter((candidate) => candidate.type === "armor")) {
    await migrateWorldArmor(item);
  }
  for (const item of game.items.filter((candidate) => candidate.type === "hitLocation")) {
    await migrateHitLocationName(item);
    await migratePermanentWoundItem(item);
  }

  for (const actor of game.actors.filter((candidate) =>
    ["character", "npc"].includes(candidate.type))) {
    const legacyUpdates = actor.items.filter((item) => item.type === "skill")
      .map(getLegacySkillUpdate)
      .filter(Boolean);
    if (legacyUpdates.length) await actor.updateEmbeddedDocuments("Item", legacyUpdates);
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
    if (actor.type === "character") {
      await ensureHumanHitLocations(actor);
      await ensureDefaultHome(actor);
    }
    await migrateActorArmor(actor);
    await syncIncapacitatedStatus(actor);
    await synchronizeFatigueDeath(actor);
  }

  const worldIconUpdates = game.items.map(getLegacyItemIconUpdate).filter(Boolean);
  if (worldIconUpdates.length) await Item.updateDocuments(worldIconUpdates);
}
