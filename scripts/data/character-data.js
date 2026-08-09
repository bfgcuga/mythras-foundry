import {
  CHARACTERISTIC_KEYS,
  calculateDerivedAttributes
} from "../rules/derived-attributes.js";
import { applyFatigue, combinedConditionLevel, FATIGUE_LEVELS } from "../rules/fatigue.js";
import { worstWoundLevel } from "../rules/hit-locations.js";
import { getActionPointRules } from "../settings.js";
import { applyArmorInitiativePenalty } from "../rules/armor.js";

const {
  BooleanField,
  NumberField,
  SchemaField,
  StringField
} = foundry.data.fields;

const textField = () => new StringField({
  required: true,
  nullable: false,
  initial: "",
  blank: true
});

const backgroundSelectionField = () => new SchemaField({
  name: textField(),
  sourceUuid: textField()
});

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
      generationMethod: new StringField({
        required: true,
        nullable: false,
        initial: "",
        blank: true,
        choices: ["", "random", "randomSwap", "points"]
      }),
      backgroundComplete: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),
      backgroundCreationEnabled: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),
      backgroundDraft: new StringField({
        required: true,
        nullable: false,
        initial: "",
        blank: true
      }),
      fatigueLevel: new StringField({ required: true, nullable: false, initial: "fresh",
        choices: FATIGUE_LEVELS.map((level) => level.key) }),
      experienceRolls: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),
      ...characteristics,
      identity: new SchemaField({
        playerName: textField(),
        age: new NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
        ageCategory: textField(),
        socialClass: new SchemaField({
          key: textField(),
          name: textField(),
          titles: textField(),
          resources: textField(),
          moneyModifier: new NumberField({ required: true, nullable: false, initial: 1, min: 0 })
        }),
        culture: backgroundSelectionField(),
        profession: backgroundSelectionField()
      }),
      currency: new SchemaField({
        silver: new NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
        startingSilver: new NumberField({ required: true, nullable: false, initial: 0, min: 0 })
      }),
      resources: new SchemaField({
        actionPoints: resourceField(),
        luckPoints: resourceField(),
        magicPoints: resourceField()
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.baseAttributes = calculateDerivedAttributes(this, getActionPointRules());
    const locations = this.parent?.items?.filter((item) => item.type === "hitLocation") ?? [];
    this.conditionLevel = combinedConditionLevel(
      this.fatigueLevel, worstWoundLevel(locations));
    const conditioned = applyFatigue(this.baseAttributes, this.conditionLevel.key);
    const armors = this.parent?.items?.filter((item) => item.type === "armor") ?? [];
    this.attributes = applyArmorInitiativePenalty(conditioned, armors);
    this.resources.actionPoints.max = this.attributes.actionPointsMax;
    this.resources.luckPoints.max = this.attributes.luckPointsMax;
    this.resources.magicPoints.max = this.attributes.magicPointsMax;

    for (const resource of Object.values(this.resources)) {
      resource.value = Math.min(resource.value, resource.max);
    }
  }
}
