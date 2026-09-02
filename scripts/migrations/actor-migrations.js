import { DEFAULT_HOME_DATA } from "../data/equipment.js";
import { CREATURE_SOURCES } from "../data/creatures.js";
import { HUMAN_HIT_LOCATIONS, humanArmorFactors, humanHitLocationData,
  genericHitLocationKey, permanentWoundState } from "../rules/hit-locations.js";
import { normalizeWeaponProfile } from "../rules/combat.js";
import { ARMOR_MATERIAL_MODIFIERS, armorPieceTypeForLocation } from "../rules/armor.js";

const LOCATION_MIGRATION_SCOPE = "mythras-foundry";
const LOCATION_MIGRATION_FLAG = "hitLocationMigrationVersion";
const LOCATION_MIGRATION_VERSION = 1;

const locationMigrationComplete = (actor) => Number(
  actor.getFlag?.(LOCATION_MIGRATION_SCOPE, LOCATION_MIGRATION_FLAG) ?? 0
) >= LOCATION_MIGRATION_VERSION;

const markLocationMigrationComplete = (actor) => actor.setFlag?.(
  LOCATION_MIGRATION_SCOPE, LOCATION_MIGRATION_FLAG, LOCATION_MIGRATION_VERSION
);

export async function ensureHumanHitLocations(actor) {
  if (actor.type !== "character" || locationMigrationComplete(actor)) return;
  const defaults = humanHitLocationData(actor.system);
  const locations = actor.items.filter((item) => item.type === "hitLocation");
  const used = new Set();
  const presentKeys = new Set();
  const updates = [];
  const deletions = [];
  const replacements = new Map();
  for (const expected of defaults) {
    const candidates = locations.filter((item) => !used.has(item.id)
      && genericHitLocationKey(item) === expected.system.nameKey);
    if (!candidates.length) continue;
    presentKeys.add(expected.system.nameKey);
    const survivor = candidates.sort((left, right) => locationPreservationScore(right)
      - locationPreservationScore(left))[0];
    used.add(survivor.id);
    updates.push({ _id: survivor.id, name: expected.name,
      "system.nameKey": expected.system.nameKey });
    for (const duplicate of candidates.slice(1)) {
      used.add(duplicate.id);
      replacements.set(duplicate.id, survivor.id);
      deletions.push(duplicate.id);
    }
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (replacements.size) await remapLocationReferences(actor, replacements);
  if (deletions.length) await actor.deleteEmbeddedDocuments("Item", deletions);
  const missing = defaults.filter((item) => !presentKeys.has(item.system.nameKey));
  if (missing.length) await actor.createEmbeddedDocuments("Item", missing);
  await markLocationMigrationComplete(actor);
}

export async function ensureCreatureHitLocations(actor) {
  if (actor.type !== "npc" || locationMigrationComplete(actor)) return;
  const identity = String(actor.system.identity?.species ?? "").trim().toLocaleLowerCase();
  const actorName = String(actor.name ?? "").trim().toLocaleLowerCase();
  const source = CREATURE_SOURCES.find((candidate) => [candidate.name,
    candidate.system.identity?.species].map((value) => String(value ?? "").trim()
    .toLocaleLowerCase()).some((value) => value === identity || value === actorName));
  if (!source) {
    await markLocationMigrationComplete(actor);
    return;
  }
  const existing = actor.items.filter((item) => item.type === "hitLocation");
  const sourceLocations = source.items.filter((item) => item.type === "hitLocation");
  const missing = sourceLocations.filter((candidate) => !existing.some((item) =>
    Number(item.system.rangeStart) === candidate.system.rangeStart
    && Number(item.system.rangeEnd) === candidate.system.rangeEnd));
  const created = missing.length ? await actor.createEmbeddedDocuments("Item", missing.map((item) => ({
    name: item.name, type: item.type, img: item.img, system: structuredClone(item.system),
    flags: structuredClone(item.flags)
  }))) : [];
  const locationsByKey = new Map();
  for (const [index, item] of missing.entries()) locationsByKey.set(item.buildKey, created[index]);
  for (const item of existing) {
    const candidate = sourceLocations.find((entry) =>
      Number(item.system.rangeStart) === entry.system.rangeStart
      && Number(item.system.rangeEnd) === entry.system.rangeEnd);
    if (candidate) locationsByKey.set(candidate.buildKey, item);
  }
  const sourceWeapons = new Map(source.items.filter((item) => item.type === "weapon")
    .map((item) => [item.buildKey, item]));
  const weaponUpdates = actor.items.filter((item) => item.type === "weapon")
    .map((item) => {
      const sourceWeapon = sourceWeapons.get(item.system.profileKey);
      const location = locationsByKey.get(sourceWeapon?.linkedLocationKey);
      return sourceWeapon?.linkedLocationKey && location
        && item.system.linkedLocationId !== location.id
        ? { _id: item.id, "system.linkedLocationId": location.id } : null;
    }).filter(Boolean);
  if (weaponUpdates.length) await actor.updateEmbeddedDocuments("Item", weaponUpdates);
  await markLocationMigrationComplete(actor);
}

function locationPreservationScore(location) {
  return (Number(location.system.armorPoints ?? 0) * 20)
    + (location.system.disabled ? 10 : 0)
    + Number(location.system.permanentWound?.severity ?? 0) * 10
    + Math.max(0, Number(location.system.maxHitPoints ?? 0)
      - Number(location.system.currentHitPoints ?? 0))
    + (location.system.nameKey ? 1 : 0);
}

async function remapLocationReferences(actor, replacements) {
  const updates = [];
  for (const item of actor.items) {
    if (item.type === "weapon" && replacements.has(item.system.linkedLocationId)) {
      updates.push({ _id: item.id,
        "system.linkedLocationId": replacements.get(item.system.linkedLocationId) });
    }
    if (item.type === "armor") {
      const current = Array.from(item.system.coveredLocationIds ?? []);
      const remapped = [...new Set(current.map((id) => replacements.get(id) ?? id))];
      if (remapped.some((id, index) => id !== current[index]) || remapped.length !== current.length) {
        updates.push({ _id: item.id, "system.coveredLocationIds": remapped });
      }
    }
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

export function hitLocationNameMigrationUpdate(item) {
  if (item.type !== "hitLocation") return null;
  const nameKey = genericHitLocationKey(item);
  if (!nameKey) return null;
  const name = HUMAN_HIT_LOCATIONS.find((entry) => entry.nameKey === nameKey).name;
  const update = {};
  if (name !== item.name) update.name = name;
  if (item.system?.nameKey !== nameKey) update["system.nameKey"] = nameKey;
  return Object.keys(update).length ? update : null;
}

export async function migrateHitLocationName(item) {
  const update = hitLocationNameMigrationUpdate(item);
  if (update) await item.update(update);
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

export async function ensureCharacterPrototypeTokenLink(actor) {
  if (actor.type !== "character" || actor.prototypeToken?.actorLink) return;
  await actor.update({ "prototypeToken.actorLink": true });
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
      const update = { _id: item.id,
        "system.armorEncumbranceMultiplier": factors.encumbrance,
        "system.armorCostPercentage": factors.cost,
        "system.armorFactorsVersion": 2
      };
      updates.push(update);
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
