import { CharacterData } from "./data/character-data.js";
import {
  EquipmentData,
  SkillData,
  WeaponData
} from "./data/item-data.js";
import { MythrasItem } from "./documents/mythras-item.js";
import { calculateDerivedAttributes } from "./rules/derived-attributes.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { MythrasItemSheet } from "./sheets/item-sheet.js";

const PARTIALS = [
  "systems/mythras-foundry/templates/actor/parts/characteristics.hbs",
  "systems/mythras-foundry/templates/actor/parts/inventory-list.hbs"
];

Hooks.once("init", async () => {
  console.log("Mythras Foundry | Inicializando sistema");

  CONFIG.Actor.dataModels.character = CharacterData;
  CONFIG.Item.documentClass = MythrasItem;
  CONFIG.Item.dataModels.skill = SkillData;
  CONFIG.Item.dataModels.equipment = EquipmentData;
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
      types: ["skill", "equipment", "weapon"],
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

function clampResource(changed, candidate, key, maximum) {
  const current = Number(candidate.resources?.[key]?.value ?? 0);
  if (current <= maximum) return;
  foundry.utils.setProperty(changed, `system.resources.${key}.value`, maximum);
}
