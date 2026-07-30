import { CharacterData } from "./data/character-data.js";
import { ensureBasicSkills } from "./data/basic-skills.js";
import {
  BackgroundData,
  CombatStyleData,
  EquipmentData,
  PassionData,
  SkillData,
  WeaponData
} from "./data/item-data.js";
import { MythrasItem } from "./documents/mythras-item.js";
import { calculateDerivedAttributes } from "./rules/derived-attributes.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { MythrasItemSheet } from "./sheets/item-sheet.js";

const PARTIALS = [
  "systems/mythras-foundry/templates/actor/parts/background-wizard.hbs",
  "systems/mythras-foundry/templates/actor/parts/characteristics.hbs",
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
      types: ["skill", "combatStyle", "culture", "profession", "passion", "equipment", "weapon"],
      makeDefault: true,
      label: "MYTHRASF.Sheet.Item"
    }
  );

  await loadTemplates(PARTIALS);
});

Hooks.on("preUpdateActor", (actor, changed) => {
  if (actor.type !== "character") return;

  const expanded = foundry.utils.expandObject(changed);
  const candidate = foundry.utils.mergeObject(
    foundry.utils.deepClone(actor.system.toObject()),
    expanded.system ?? {},
    { inplace: false }
  );
  const attributes = calculateDerivedAttributes(candidate);

  clampResource(changed, candidate, "actionPoints", attributes.actionPointsMax);
  clampResource(changed, candidate, "luckPoints", attributes.luckPointsMax);
  clampResource(changed, candidate, "magicPoints", attributes.magicPointsMax);
});

Hooks.on("createActor", async (actor, options, userId) => {
  if (userId !== game.user.id) return;
  await ensureBasicSkills(actor);
  if (actor.type === "character") {
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
  }
});

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
