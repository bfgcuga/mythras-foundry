const {
  BooleanField,
  HTMLField,
  NumberField,
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
      category: new StringField({
        required: true,
        nullable: false,
        initial: "standard",
        choices: ["standard", "professional"]
      }),
      characteristic1: textField("strength"),
      characteristic2: textField("dexterity"),
      bonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
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

export class WeaponData extends EquipmentData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      damage: textField(),
      size: textField(),
      reach: textField(),
      hitPoints: nonNegativeNumber(0, true),
      grip: textField()
    };
  }
}
