import { getTraitSource } from "./traits.js";
import { semanticLocationKey } from "../rules/morphologies.js";

const sourceFlags = { "mythras-foundry": { source: "mythras-imperative-srd" } };

const characteristicKeys = ["strength", "constitution", "size", "dexterity",
  "intelligence", "power", "charisma"];

export function npcSystem({ values, formulas, species, morphologyKey = "custom", instinct = false, actionPoints = 2,
  movement = 6, magicPoints = null, damageModifier = "", description = "",
  magicNotes = "Ninguna", armorNotes = "" }) {
  const system = Object.fromEntries(characteristicKeys.map((key) => [key, values[key] ?? 1]));
  system.characteristicFormulas = Object.fromEntries(
    characteristicKeys.map((key) => [key, formulas[key] ?? ""]));
  system.identity = { species };
  system.morphologyKey = morphologyKey;
  system.intelligenceKind = instinct ? "instinct" : "intelligence";
  system.description = description;
  system.magicNotes = magicNotes;
  system.armorNotes = armorNotes;
  system.fatigueLevel = "fresh";
  system.attributeOverrides = {
    actionPoints: { mode: "manual", value: actionPoints, formula: "" },
    initiative: { mode: "auto", value: 0, formula: "" },
    movementRate: { mode: "manual", value: movement, formula: "" },
    magicPoints: magicPoints === null
      ? { mode: "auto", value: 0, formula: "" }
      : { mode: "manual", value: magicPoints, formula: "" },
    luckPoints: { mode: "manual", value: 0, formula: "" },
    damageModifier: damageModifier
      ? { mode: "manual", formula: damageModifier }
      : { mode: "auto", formula: "" }
  };
  system.resources = {
    actionPoints: { value: actionPoints },
    luckPoints: { value: 0 },
    magicPoints: { value: magicPoints ?? values.power ?? 0 }
  };
  system.generatedInstance = false;
  return system;
}

export function location(buildKey, name, rangeStart, rangeEnd, armorPoints, maxHitPoints,
  category = "other", hpClass = "standard") {
  return { buildKey, name, type: "hitLocation", img: "icons/svg/blood.svg", system: {
    nameKey: ["rightLeg", "leftLeg", "abdomen", "chest", "rightArm", "leftArm", "head"]
      .includes(buildKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()))
      ? buildKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) : "",
    rangeStart, rangeEnd, category, hpClass, autoCalculate: false,
    maxHitPoints, maxHitPointsFormula: "", currentHitPoints: maxHitPoints,
    armorPoints, maxArmorPoints: armorPoints, armorPointsFormula: "", armorEncumbranceMultiplier: 1,
    armorCostPercentage: 10, armorFactorsVersion: 2, disabled: false, description: ""
  }, flags: sourceFlags };
}

export function skill(buildKey, name, value, group = "professional") {
  return { buildKey, name, type: "skill", img: "icons/svg/book.svg", system: {
    slug: buildKey, category: group === "basic" ? "basic" : "professional", group,
    characteristic1: "strength", characteristic2: "dexterity", baseBonus: 0,
    culturePoints: 0, professionPoints: 0, freePoints: 0, experiencePoints: 0,
    trained: true, fumbled: false, valueMode: "manual", manualValue: value,
    generationFormula: "", description: ""
  }, flags: sourceFlags };
}

export function style(buildKey, name, value, weaponKeys, traits = "") {
  return { buildKey, name, type: "combatStyle", img: "systems/mythras-foundry/assets/icons/combat-style.svg",
    system: { slug: buildKey, category: "professional", group: "combat",
      characteristic1: "strength", characteristic2: "dexterity", baseBonus: 0,
      culturePoints: 0, professionPoints: 0, freePoints: 0, experiencePoints: 0,
      trained: true, fumbled: false, valueMode: "manual", manualValue: value,
      generationFormula: "", weapons: weaponKeys.join(", "),
      weaponProfiles: weaponKeys.map((key) => ({ key, name: key })), traits, traitRefs: [],
      sourceType: "creature", description: "" }, flags: sourceFlags };
}

export function weapon(buildKey, name, { damage, size = "M", reach = "M", linkedLocationKey = "",
  ap = 0, hp = 0, effects = "", weaponType = "melee", damageModifierMode = "full",
  handsRequired = 0, range = "" }) {
  const modeKey = weaponType === "ranged" ? "ranged" : "melee";
  return { buildKey, linkedLocationKey, name, type: "weapon", img: "icons/svg/sword.svg", system: {
    quantity: 1, value: 0, equipped: true,
    profileKey: buildKey, activeModeKey: modeKey,
    maxHitPoints: hp, maxHitPointsFormula: "", currentHitPoints: hp,
    armorPoints: ap, armorPointsFormula: "", durabilitySource: linkedLocationKey
      ? "hitLocation" : "independent", linkedLocationId: "", encumbrance: 0,
    description: "", modes: [{ key: modeKey, name: "", profileKey: buildKey, weaponType,
      damage, damageModifierMode, size, reach, effects, grip: handsRequired ? `${handsRequired} mano${handsRequired > 1 ? "s" : ""}` : "Natural",
      traitRefs: [], handsRequired, range, reload: "", preferredCombatStyleId: "", familiarity: "similar" }]
  }, flags: sourceFlags };
}

export function traitItem(key, description = "") {
  const source = getTraitSource(key);
  return { ...source, system: { ...source.system,
    ...(description ? { description } : {}) }, flags: sourceFlags };
}

export function passion(buildKey, name, value) {
  return { buildKey, name, type: "passion", img: "systems/mythras-foundry/assets/icons/passion.svg",
    system: { structured: false, value, generationFormula: "", verb: "other", customVerb: "",
      objectType: "other", objectDescription: "", creationBonus: 0, experiencePoints: 0,
      manualAdjustment: 0, description: "" }, flags: sourceFlags };
}

export function creature(buildKey, name, system, items, img = "icons/svg/mystery-man.svg", flags = sourceFlags) {
  const preparedItems = items.map((item) => item.type !== "hitLocation" ? item : ({ ...item,
    system: { ...item.system, morphologyKey: system.morphologyKey,
      locationKey: semanticLocationKey(item, system.morphologyKey),
      nameKey: semanticLocationKey(item, system.morphologyKey) } }));
  return { buildKey, name, type: "npc", img, system, items: preparedItems.map((item) => ({ ...item, flags })), prototypeToken: {
    actorLink: false, name, texture: { src: img }, disposition: -1,
    displayName: 20, displayBars: 20, bar1: { attribute: "resources.actionPoints" },
    bar2: { attribute: "resources.magicPoints" }
  }, flags };
}
