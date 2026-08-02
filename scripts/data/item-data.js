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

export class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      slug: textField(),
      templateSlug: textField(),
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
      description: descriptionField()
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
      rules: textField("{}"),
      description: descriptionField()
    };
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: nonNegativeNumber(1, true),
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
      description: descriptionField()
    };
  }
}

export class WeaponData extends EquipmentData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      profileKey: textField(),
      weaponType: new StringField({ required: true, nullable: false, initial: "melee",
        choices: ["melee", "ranged", "shield"] }),
      damage: textField(),
      damageModifierMode: new StringField({ required: true, nullable: false, initial: "full",
        choices: ["full", "half", "none"] }),
      size: textField(),
      reach: textField(),
      hitPoints: nonNegativeNumber(0, true),
      maxHitPoints: nonNegativeNumber(0, true),
      currentHitPoints: nonNegativeNumber(0, true),
      armorPoints: nonNegativeNumber(0, true),
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
}

export class ArmorData extends EquipmentData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      armorPoints: nonNegativeNumber(0, true),
      penalty: nonNegativeNumber(0, true),
      era: new StringField({ required: true, nullable: false, initial: "ancient",
        choices: ["ancient", "modern", "futuristic"] }),
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
      currentHitPoints: new NumberField({ required: true, nullable: false, integer: true, initial: 1 }),
      armorPoints: nonNegativeNumber(0, true),
      description: descriptionField()
    };
  }
}
