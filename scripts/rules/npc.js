import { calculateDerivedAttributes } from "./derived-attributes.js";

export const NPC_OVERRIDE_KEYS = Object.freeze([
  "actionPoints",
  "initiative",
  "movementRate",
  "magicPoints",
  "luckPoints"
]);

const ATTRIBUTE_KEYS = Object.freeze({
  actionPoints: "actionPointsMax",
  initiative: "initiative",
  movementRate: "movementRate",
  magicPoints: "magicPointsMax",
  luckPoints: "luckPointsMax"
});

export function npcIntelligenceKey(value) {
  return value === "instinct" ? "instinct" : "intelligence";
}

export function calculateNpcAttributes(system = {}) {
  const attributes = calculateDerivedAttributes(system);
  const overrides = system.attributeOverrides ?? {};

  for (const key of NPC_OVERRIDE_KEYS) {
    const override = overrides[key] ?? {};
    if (override.mode !== "manual") continue;
    attributes[ATTRIBUTE_KEYS[key]] = Math.max(0, Number(override.value ?? 0));
  }

  const damageModifier = overrides.damageModifier ?? {};
  if (damageModifier.mode === "manual") {
    attributes.damageModifier = String(damageModifier.formula || "0");
  }

  return attributes;
}

export function npcAttributeReference(system, key) {
  const override = system?.attributeOverrides?.[key];
  if (override?.mode === "manual") return Number(override.value ?? 0);
  return calculateNpcAttributes(system)[ATTRIBUTE_KEYS[key]];
}

export function npcWeaponDurability(weapon, locations = []) {
  const system = weapon?.system ?? weapon ?? {};
  if (system.durabilitySource === "hitLocation") {
    const location = locations.find((candidate) => {
      const id = candidate?.id ?? candidate?._id;
      return id === system.linkedLocationId;
    });
    if (location) {
      const locationSystem = location.system ?? location;
      return {
        source: "hitLocation",
        location,
        armorPoints: Number(locationSystem.armorPoints ?? 0),
        currentHitPoints: Number(locationSystem.currentHitPoints ?? 0),
        maxHitPoints: Number(locationSystem.maxHitPoints ?? 0)
      };
    }
  }
  return {
    source: "independent",
    location: null,
    armorPoints: Number(system.armorPoints ?? 0),
    currentHitPoints: Number(system.currentHitPoints ?? 0),
    maxHitPoints: Number(system.maxHitPoints ?? 0)
  };
}
