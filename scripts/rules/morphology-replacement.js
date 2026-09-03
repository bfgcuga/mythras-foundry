import { permanentWoundState } from "./hit-locations.js";
import { MORPHOLOGIES, morphologyLocationData, semanticLocationKey } from "./morphologies.js";

export function prepareMorphologyReplacement(actorSystem, morphologyKey, existingLocations = []) {
  const sources = morphologyLocationData(actorSystem, morphologyKey);
  if (!MORPHOLOGIES[morphologyKey]) return { valid: false, sources: [], incompatibleWounds: [] };
  const sourceKeys = new Set(sources.map((source) => source.system.locationKey));
  const incompatibleWounds = existingLocations.filter((location) =>
    Number(location.system?.permanentWound?.severity ?? 0) > 0
    && !sourceKeys.has(semanticLocationKey(location, actorSystem?.morphologyKey)));
  if (incompatibleWounds.length) return { valid: false, sources, incompatibleWounds };

  for (const source of sources) {
    const matches = existingLocations.filter((location) =>
      semanticLocationKey(location, actorSystem?.morphologyKey) === source.system.locationKey);
    const previous = matches.sort((left, right) =>
      Number(right.system?.permanentWound?.severity ?? 0)
      - Number(left.system?.permanentWound?.severity ?? 0))[0];
    if (!previous) continue;
    source.system.armorPoints = Math.max(0, Number(previous.system.armorPoints ?? 0));
    const woundData = previous.system.permanentWound ?? {};
    const severity = Number(woundData.severity ?? 0);
    if (severity) {
      const wound = permanentWoundState(source, { severity, roll: woundData.roll,
        description: woundData.description });
      source.system.permanentWound = wound;
      source.system.maxHitPoints = wound.effectiveMaxHitPoints;
    }
    source.system.currentHitPoints = Math.min(Number(previous.system.currentHitPoints
      ?? source.system.maxHitPoints), source.system.maxHitPoints);
    source.system.disabled = Boolean(previous.system.disabled);
  }
  return { valid: true, sources, incompatibleWounds: [] };
}

export function remapLocationReferences(value, replacements) {
  if (Array.isArray(value)) return value.map((entry) => remapLocationReferences(entry, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (key === "locationId" && typeof entry === "string") {
      return [key, replacements.has(entry) ? replacements.get(entry) : entry];
    }
    if (key === "locationIds" && Array.isArray(entry)) {
      return [key, [...new Set(entry.map((id) => replacements.has(id)
        ? replacements.get(id) : id).filter(Boolean))]];
    }
    return [key, remapLocationReferences(entry, replacements)];
  }));
}

export async function replaceActorMorphology(actor, morphologyKey, { combats = game.combats } = {}) {
  const existing = actor.items.filter((item) => item.type === "hitLocation");
  const prepared = prepareMorphologyReplacement(actor.system, morphologyKey, existing);
  if (!prepared.valid) return prepared;
  const created = await actor.createEmbeddedDocuments("Item", prepared.sources);
  const createdByKey = new Map(created.map((location) =>
    [location.system.locationKey, location]));
  const replacements = new Map(existing.map((location) => [location.id,
    createdByKey.get(semanticLocationKey(location, actor.system.morphologyKey))?.id ?? ""]));
  const itemUpdates = actor.items.map((item) => {
    if (item.type === "armor") {
      const ids = Array.from(item.system.coveredLocationIds ?? []);
      const humanPieceOnNonHuman = morphologyKey !== "humanoid"
        && item.system.referenceLocation !== "special";
      let coveredLocationIds = humanPieceOnNonHuman ? []
        : [...new Set(ids.map((id) => replacements.get(id)).filter(Boolean))];
      if (!coveredLocationIds.length && morphologyKey === "humanoid") {
        const referenced = createdByKey.get(item.system.referenceLocation);
        if (referenced) coveredLocationIds = [referenced.id];
      }
      return { _id: item.id, "system.coveredLocationIds": coveredLocationIds,
        ...(!coveredLocationIds.length && item.system.equipped
          ? { "system.equipped": false } : {}) };
    }
    if (item.type === "weapon" && item.system.durabilitySource === "hitLocation") {
      return { _id: item.id,
        "system.linkedLocationId": replacements.get(item.system.linkedLocationId) ?? "" };
    }
    return null;
  }).filter(Boolean);
  if (itemUpdates.length) await actor.updateEmbeddedDocuments("Item", itemUpdates);

  const effectUpdates = actor.effects.map((effect) => {
    const flags = remapLocationReferences(foundry.utils.deepClone(effect.flags), replacements);
    return JSON.stringify(flags) === JSON.stringify(effect.flags) ? null : { _id: effect.id, flags };
  }).filter(Boolean);
  if (effectUpdates.length) await actor.updateEmbeddedDocuments("ActiveEffect", effectUpdates);

  for (const combat of combats ?? []) {
    const combatantIds = combat.combatants.filter((combatant) => combatant.actor?.uuid === actor.uuid)
      .map((combatant) => combatant.id);
    if (!combatantIds.length) continue;
    const current = combat.getFlag?.("mythras-foundry", "tacticalState");
    if (!current) continue;
    const tactical = foundry.utils.deepClone(current);
    for (const collection of [tactical.passiveBlocks, tactical.covers]) {
      for (const combatantId of combatantIds) {
        if (!collection?.[combatantId]) continue;
        collection[combatantId] = remapLocationReferences(collection[combatantId], replacements);
        if (!collection[combatantId].locationIds.length) collection[combatantId].status = "cancelled";
      }
    }
    tactical.revision = Number(tactical.revision ?? 0) + 1;
    await combat.setFlag("mythras-foundry", "tacticalState", tactical);
  }
  if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing.map((item) => item.id));
  return { ...prepared, created, replacements };
}
