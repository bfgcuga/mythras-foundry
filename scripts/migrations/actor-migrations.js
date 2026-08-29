import { DEFAULT_HOME_DATA } from "../data/equipment.js";
import { humanArmorFactors, humanHitLocationData,
  permanentWoundState } from "../rules/hit-locations.js";
import { normalizeWeaponProfile } from "../rules/combat.js";
import { ARMOR_MATERIAL_MODIFIERS, armorPieceTypeForLocation } from "../rules/armor.js";

export async function ensureHumanHitLocations(actor) {
  if (actor.type !== "character" || actor.items.some((item) => item.type === "hitLocation")) return;
  await actor.createEmbeddedDocuments("Item", humanHitLocationData(
    actor.system,
    (key) => game.i18n.localize(key)
  ));
}

export function permanentWoundMigrationUpdate(item) {
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

export async function migratePermanentWoundItem(item) {
  const update = permanentWoundMigrationUpdate(item);
  if (update) await item.update(update);
}

export async function migrateActorPermanentWounds(actor) {
  const updates = actor.items.filter((item) => item.type === "hitLocation")
    .map((item) => {
      const update = permanentWoundMigrationUpdate(item);
      return update ? { _id: item.id, ...update } : null;
    }).filter(Boolean);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

export async function ensureDefaultHome(actor) {
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

export function defaultArmorFactors(location) {
  if (location.system.category === "chest") return { encumbrance: 3, cost: 25 };
  if (location.system.category === "abdomen") return { encumbrance: 2, cost: 20 };
  if (location.system.category === "head") return { encumbrance: 1.5, cost: 10 };
  if (location.system.hpClass === "arm") return { encumbrance: 1, cost: 7.5 };
  return { encumbrance: 1.5, cost: 15 };
}

export async function migrateActorArmor(actor) {
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

export async function migrateWorldArmor(item) {
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
