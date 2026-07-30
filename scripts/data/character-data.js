import {
  CHARACTERISTIC_KEYS,
  calculateDerivedAttributes
} from "../rules/derived-attributes.js";

const {
  BooleanField,
  NumberField,
  SchemaField
} = foundry.data.fields;

const characteristicField = () => new NumberField({
  required: true,
  nullable: false,
  integer: true,
  initial: 10,
  min: 1
});

const resourceField = () => new SchemaField({
  value: new NumberField({
    required: true,
    nullable: false,
    integer: true,
    initial: 0,
    min: 0
  })
});

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const characteristics = Object.fromEntries(
      CHARACTERISTIC_KEYS.map((key) => [key, characteristicField()])
    );

    return {
      characteristicsGenerated: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),
      ...characteristics,
      resources: new SchemaField({
        actionPoints: resourceField(),
        luckPoints: resourceField(),
        magicPoints: resourceField()
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.attributes = calculateDerivedAttributes(this);
    this.resources.actionPoints.max = this.attributes.actionPointsMax;
    this.resources.luckPoints.max = this.attributes.luckPointsMax;
    this.resources.magicPoints.max = this.attributes.magicPointsMax;

    for (const resource of Object.values(this.resources)) {
      resource.value = Math.min(resource.value, resource.max);
    }
  }
}
