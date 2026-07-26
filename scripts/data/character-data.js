const { NumberField, BooleanField } = foundry.data.fields;

export class CharacterData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      characteristicsGenerated: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),

      strength: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      }),

      constitution: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      }),

      size: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      }),

      dexterity: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      }),

      intelligence: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      }),

      power: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      }),

      charisma: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      })
    };
  }

}