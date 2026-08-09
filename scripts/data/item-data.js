import { weaponHandsRequired } from "../rules/equipment.js";

const {
  ArrayField,
  BooleanField,
  HTMLField,
  NumberField,
  SchemaField,
  StringField
} = foundry.data.fields;

const textField = (initial = "") => new StringField({
  required: true,
  nullable: false,
  initial,
  blank: true
});

const nonNegativeNumber = (initial = 0, integer = false) => new NumberField({
  required: true,
  nullable: false,
  initial,
  integer,
  min: 0
});

const descriptionField = () => new HTMLField({
  required: true,
  nullable: false,
  initial: ""
});

const weaponModeField = () => new SchemaField({
  key: textField("mode"),
  name: textField(),
  profileKey: textField(),
  weaponType: new StringField({ required: true, nullable: false, initial: "melee",
    choices: ["melee", "ranged", "shield"] }),
  damage: textField(),
  damageModifierMode: new StringField({ required: true, nullable: false, initial: "full",
    choices: ["full", "half", "none"] }),
  size: textField(),
  reach: textField(),
  effects: textField(),
  grip: textField(),
  handsRequired: new NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0, max: 2 }),
  range: textField(),
  reload: textField(),
  preferredCombatStyleId: textField(),
  familiarity: new StringField({ required: true, nullable: false, initial: "similar",
    choices: ["similar", "broadlySimilar", "reasonablyDifferent", "substantiallyDifferent"] })
});

export class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      slug: textField(),
      templateSlug: textField(),
      source: textField(),
      specialization: textField(),
      category: new StringField({
        required: true,
        nullable: false,
        initial: "basic",
        // "standard" is retained temporarily so actors created by v0.0.10 can
        // load safely before the ready-hook migration renames it to "basic".
        choices: ["basic", "standard", "professional"]
      }),
      group: new StringField({
        required: true,
        nullable: false,
        initial: "",
        blank: true,
        choices: ["", "basic", "professional", "resistance", "magic", "language"]
      }),
      characteristic1: textField("strength"),
      characteristic2: textField("dexterity"),
      // Legacy v0.0.10 field. Migrated to freePoints during the ready hook.
      bonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      baseBonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      culturePoints: nonNegativeNumber(0, true),
      professionPoints: nonNegativeNumber(0, true),
      freePoints: nonNegativeNumber(0, true),
      experiencePoints: nonNegativeNumber(0, true),
      trained: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),
      fumbled: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),
      description: descriptionField(),
      valueMode: new StringField({
        required: true,
        nullable: false,
        initial: "derived",
        choices: ["derived", "manual"]
      }),
      manualValue: nonNegativeNumber(0, true),
      generationFormula: textField()
    };
  }
}

export class CombatStyleData extends SkillData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      category: new StringField({
        required: true,
        nullable: false,
        initial: "professional",
        choices: ["professional"]
      }),
      group: new StringField({
        required: true,
        nullable: false,
        initial: "combat",
        choices: ["combat"]
      }),
      weapons: textField(),
      weaponProfiles: new ArrayField(new SchemaField({
        key: textField(),
        name: textField()
      }), { required: true, nullable: false, initial: [] }),
      traits: textField(),
      sourceType: textField()
    };
  }
}

export class BackgroundData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      key: textField(),
      source: textField(),
      rules: textField("{}"),
      description: descriptionField()
    };
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: nonNegativeNumber(1, true),
      quantityFormula: textField(),
      weight: nonNegativeNumber(),
      value: nonNegativeNumber(),
      location: textField(),
      equipped: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),
      description: descriptionField()
    };
  }
}

export class PassionData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      structured: new BooleanField({ required: true, nullable: false, initial: false }),
      verb: textField("other"),
      customVerb: textField(),
      objectType: textField(),
      objectDescription: textField(),
      creationBonus: new NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
      experiencePoints: new NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
      manualAdjustment: new NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
      // Legacy total retained so existing actors keep exactly the same value.
      value: nonNegativeNumber(0, true),
      generationFormula: textField(),
      description: descriptionField()
    };
  }
}

export class WeaponData extends EquipmentData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      profileKey: textField(),
      activeModeKey: textField(),
      modes: new ArrayField(weaponModeField(), { required: true, nullable: false, initial: [] }),
      weaponType: new StringField({ required: true, nullable: false, initial: "melee",
        choices: ["melee", "ranged", "shield"] }),
      damage: textField(),
      damageModifierMode: new StringField({ required: true, nullable: false, initial: "full",
        choices: ["full", "half", "none"] }),
      size: textField(),
      reach: textField(),
      maxHitPoints: nonNegativeNumber(0, true),
      maxHitPointsFormula: textField(),
      currentHitPoints: nonNegativeNumber(0, true),
      armorPoints: nonNegativeNumber(0, true),
      armorPointsFormula: textField(),
      durabilitySource: new StringField({ required: true, nullable: false, initial: "independent",
        choices: ["independent", "hitLocation"] }),
      linkedLocationId: textField(),
      encumbrance: nonNegativeNumber(),
      effects: textField(),
      grip: textField(),
      handsRequired: new NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0, max: 2 }),
      range: textField(),
      reload: textField(),
      preferredCombatStyleId: textField(),
      familiarity: new StringField({ required: true, nullable: false, initial: "similar",
        choices: ["similar", "broadlySimilar", "reasonablyDifferent", "substantiallyDifferent"] })
    };
  }

  get effectiveHandsRequired() {
    return weaponHandsRequired(this);
  }
}

export class ArmorData extends EquipmentData {
  static defineSchema() {
    const locationValues = Object.fromEntries([
      "rightLeg", "leftLeg", "abdomen", "chest", "rightArm", "leftArm", "head"
    ].map((key) => [key, nonNegativeNumber()]));
    return {
      ...super.defineSchema(),
      source: textField(),
      profileKey: textField(),
      profileName: textField(),
      pieceType: new StringField({ required: true, nullable: false, initial: "other",
        choices: ["helmet", "cuirass", "skirt", "greaves", "bracers", "other"] }),
      construction: new StringField({ required: true, nullable: false, initial: "flexible",
        choices: ["flexible", "rigid"] }),
      material: new StringField({ required: true, nullable: false, initial: "leather",
        choices: ["steel", "bronze", "shell", "leather", "iron", "bone", "linen",
          "ivory", "stone", "chitin", "silk"] }),
      materialModifier: nonNegativeNumber(1),
      referenceLocation: new StringField({ required: true, nullable: false, initial: "special",
        choices: ["rightLeg", "leftLeg", "abdomen", "chest", "rightArm", "leftArm",
          "head", "special"] }),
      designedSize: nonNegativeNumber(0, true),
      designedBuild: textField(),
      armorPoints: nonNegativeNumber(0, true),
      armorPointsFormula: textField(),
      baseEncumbrance: nonNegativeNumber(),
      baseValue: nonNegativeNumber(),
      locationValues: new SchemaField(locationValues),
      armorRulesVersion: nonNegativeNumber(4, true),
      coveredLocationIds: new ArrayField(textField(), {
        required: true, nullable: false, initial: []
      }),
      coverageMigrated: new BooleanField({ required: true, nullable: false, initial: false }),
      penalty: nonNegativeNumber(0, true),
      era: new StringField({ required: true, nullable: false, initial: "ancient",
        choices: ["all", "ancient-medieval", "ancient-renaissance", "medieval-industrial",
          "ancient", "modern", "futuristic"] }),
      coverage: textField()
    };
  }
}

export class HitLocationData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rangeStart: new NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 1, max: 20 }),
      rangeEnd: new NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 1, max: 20 }),
      category: new StringField({ required: true, nullable: false, initial: "other",
        choices: ["limb", "head", "chest", "abdomen", "other"] }),
      hpClass: new StringField({ required: true, nullable: false, initial: "standard",
        choices: ["arm", "standard", "abdomen", "chest"] }),
      autoCalculate: new BooleanField({ required: true, nullable: false, initial: false }),
      maxHitPoints: nonNegativeNumber(1, true),
      maxHitPointsFormula: textField(),
      currentHitPoints: new NumberField({ required: true, nullable: false, integer: true, initial: 1 }),
      armorPoints: nonNegativeNumber(0, true),
      armorPointsFormula: textField(),
      armorEncumbranceMultiplier: nonNegativeNumber(1),
      armorCostPercentage: nonNegativeNumber(10),
      armorFactorsVersion: nonNegativeNumber(0, true),
      disabled: new BooleanField({ required: true, nullable: false, initial: false }),
      description: descriptionField()
    };
  }
}

export class TraitData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: descriptionField()
    };
  }
}
