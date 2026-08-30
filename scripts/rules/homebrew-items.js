import { COMBAT_EFFECT_ROLL_RESTRICTIONS,
  COMBAT_EFFECT_WEAPON_RESTRICTIONS } from "./combat-effects.js";

export const HOMEBREW_ITEM_TYPES = Object.freeze([
  "equipment", "weapon", "armor", "skill", "combatStyle",
  "trait", "combatEffect", "culture", "profession", "passion", "hitLocation"
]);

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const integer = (value, fallback = 0) => Math.trunc(number(value, fallback));
const checked = (value) => value === true || value === "true" || value === "on" || value === "1";

export function homebrewSlug(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function homebrewPackName(label, fallback = "mythras-homebrew") {
  return homebrewSlug(label) || fallback;
}

export function buildHomebrewItem(type, fields = {}) {
  if (!HOMEBREW_ITEM_TYPES.includes(type)) throw new Error("invalid-type");
  const name = String(fields.name ?? "").trim();
  if (!name) throw new Error("missing-name");
  const source = String(fields.source ?? "").trim();
  const description = String(fields.description ?? "").trim();
  const img = String(fields.img ?? "").trim();
  const common = { name, type, ...(img ? { img } : {}) };

  if (type === "skill") return { ...common, system: {
    slug: homebrewSlug(name), source, description,
    category: fields.category || "professional",
    group: fields.group || (fields.category === "basic" ? "basic" : "professional"),
    characteristic1: fields.characteristic1 || "strength",
    characteristic2: fields.characteristic2 || "dexterity",
    baseBonus: integer(fields.baseBonus)
  } };

  if (type === "combatStyle") return { ...common, system: {
    slug: homebrewSlug(name), source, description, category: "professional", group: "combat",
    characteristic1: fields.characteristic1 || "strength",
    characteristic2: fields.characteristic2 || "dexterity",
    baseBonus: integer(fields.baseBonus), weaponProfiles: [], traitRefs: [],
    sourceType: String(fields.sourceType ?? "homebrew")
  } };

  if (["culture", "profession"].includes(type)) {
    const rules = String(fields.rules ?? "{}").trim() || "{}";
    const parsed = JSON.parse(rules);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("invalid-rules");
    }
    return { ...common, system: {
      key: homebrewSlug(fields.key || name), source, description,
      rules: JSON.stringify(parsed)
    } };
  }

  if (type === "passion") return { ...common, system: {
    structured: true, verb: fields.verb || "other",
    customVerb: String(fields.customVerb ?? ""), objectType: fields.objectType || "ideal",
    objectDescription: String(fields.objectDescription ?? ""),
    targetCharisma: Math.max(1, integer(fields.targetCharisma, 11)),
    creationBonus: integer(fields.creationBonus), description
  } };

  if (type === "equipment") {
    const isContainer = checked(fields.isContainer);
    return { ...common, system: {
      source, description, category: fields.category || "item",
      era: String(fields.era ?? ""), quantity: Math.max(0, integer(fields.quantity, 1)),
      // Equipment predates the system-wide `encumbrance` name. Keep the persisted
      // field for compatibility while presenting it as encumbrance in every UI.
      weight: Math.max(0, number(fields.encumbrance ?? fields.weight)),
      value: Math.max(0, number(fields.value)),
      currency: fields.currency || "silver", isContainer,
      capacityEncumbrance: isContainer ? Math.max(0, number(fields.capacityEncumbrance)) : 0
    } };
  }

  if (type === "weapon") {
    const modeType = fields.weaponType || "melee";
    const modeKey = homebrewSlug(fields.modeKey || modeType) || "mode";
    const maxHitPoints = Math.max(0, integer(fields.maxHitPoints));
    return { ...common, system: {
      source, description, era: String(fields.era ?? ""),
      profileKey: homebrewSlug(fields.profileKey || name), activeModeKey: modeKey,
      value: Math.max(0, number(fields.value)), currency: fields.currency || "silver",
      encumbrance: Math.max(0, number(fields.encumbrance)),
      armorPoints: Math.max(0, integer(fields.armorPoints)), maxHitPoints,
      currentHitPoints: maxHitPoints,
      modes: [{
        key: modeKey, name: String(fields.modeName ?? ""), profileKey: "",
        weaponType: modeType, damage: String(fields.damage ?? ""),
        damageModifierMode: fields.damageModifierMode || "full",
        size: String(fields.size ?? ""), impalingSize: "", powerModifier: 0,
        reach: String(fields.reach ?? ""), effects: String(fields.effects ?? ""),
        traitRefs: [], handsRequired: Math.max(0, Math.min(2, integer(fields.handsRequired, 1))),
        grip: "", range: String(fields.range ?? ""), reload: String(fields.reload ?? ""),
        crewMinimum: 0, crewMaximum: 0, preferredCombatStyleId: "", familiarity: "similar"
      }]
    } };
  }

  if (type === "armor") return { ...common, system: {
    source, description, profileKey: homebrewSlug(fields.profileKey || name),
    profileName: String(fields.profileName || name),
    referenceLocation: fields.referenceLocation || "special",
    construction: fields.construction || "flexible", material: fields.material || "leather",
    armorPoints: Math.max(0, integer(fields.armorPoints)),
    baseEncumbrance: Math.max(0, number(fields.baseEncumbrance)),
    baseValue: Math.max(0, number(fields.baseValue)),
    designedSize: Math.max(0, integer(fields.designedSize)),
    era: fields.era || "ancient", quantity: 1, equipped: false
  } };

  if (type === "hitLocation") {
    const maximum = Math.max(1, integer(fields.maxHitPoints, 1));
    return { ...common, system: {
      rangeStart: Math.max(1, Math.min(20, integer(fields.rangeStart, 1))),
      rangeEnd: Math.max(1, Math.min(20, integer(fields.rangeEnd, 1))),
      category: fields.category || "other", hpClass: fields.hpClass || "standard",
      autoCalculate: checked(fields.autoCalculate), maxHitPoints: maximum,
      currentHitPoints: maximum, armorPoints: Math.max(0, integer(fields.armorPoints)),
      armorEncumbranceMultiplier: Math.max(0, number(fields.armorEncumbranceMultiplier, 1)),
      armorCostPercentage: Math.max(0, number(fields.armorCostPercentage, 10)), description
    } };
  }

  if (type === "combatEffect") {
    const weaponRestriction = String(fields.weaponRestriction ?? "");
    const rollRestriction = String(fields.rollRestriction ?? "");
    if (!COMBAT_EFFECT_WEAPON_RESTRICTIONS.includes(weaponRestriction)
      || !COMBAT_EFFECT_ROLL_RESTRICTIONS.includes(rollRestriction)) {
      throw new Error("invalid-combat-effect-restriction");
    }
    return { ...common, system: {
      key: homebrewSlug(fields.key || name), source, description,
      offensive: checked(fields.offensive), defensive: checked(fields.defensive),
      weaponRestriction, rollRestriction, stackable: checked(fields.stackable),
      ruleKey: "guided", stage: "afterEffect", requiresWound: checked(fields.requiresWound),
      endurance: checked(fields.endurance), tableColumns: [], tableRows: [], tableNote: ""
    } };
  }

  return { ...common, system: {
    key: homebrewSlug(fields.key || name), source, description,
    traitType: fields.traitType || "other",
    requiresAllGroupMembers: checked(fields.requiresAllGroupMembers),
    ruleKey: String(fields.ruleKey ?? "").trim(), ruleParameters: []
  } };
}
