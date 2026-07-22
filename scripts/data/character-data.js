const { NumberField } = foundry.data.fields;

export class CharacterData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      strength: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 10,
        min: 1
      })
    };
  }

}