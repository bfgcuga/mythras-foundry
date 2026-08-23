import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import { FATIGUE_LEVELS } from "../rules/fatigue.js";
import { calculateNpcAttributes, NPC_OVERRIDE_KEYS } from "../rules/npc.js";
import { actorLoadState, resolveActorConditions } from "../rules/actor-conditions.js";
import { UNCONSCIOUS_STATUS_ID } from "../rules/statuses.js";

const { BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

const textField = () => new StringField({
  required: true, nullable: false, initial: "", blank: true
});

const characteristicField = () => new NumberField({
  required: true, nullable: false, integer: true, initial: 10, min: 1
});

const resourceField = () => new SchemaField({
  value: new NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 })
});

const numberOverrideField = () => new SchemaField({
  mode: new StringField({ required: true, nullable: false, initial: "auto",
    choices: ["auto", "manual"] }),
  value: new NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
  formula: textField()
});

export class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const characteristics = Object.fromEntries(
      CHARACTERISTIC_KEYS.map((key) => [key, characteristicField()])
    );
    const characteristicFormulas = Object.fromEntries(
      CHARACTERISTIC_KEYS.map((key) => [key, textField()])
    );
    const attributeOverrides = Object.fromEntries(
      NPC_OVERRIDE_KEYS.map((key) => [key, numberOverrideField()])
    );

    return {
      ...characteristics,
      characteristicFormulas: new SchemaField(characteristicFormulas),
      identity: new SchemaField({ species: textField() }),
      intelligenceKind: new StringField({ required: true, nullable: false, initial: "intelligence",
        choices: ["intelligence", "instinct"] }),
      description: new HTMLField({ required: true, nullable: false, initial: "" }),
      magicNotes: new HTMLField({ required: true, nullable: false, initial: "" }),
      armorNotes: textField(),
      currency: new SchemaField({
        copper: new NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
        silver: new NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
        gold: new NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
        startingSilver: new NumberField({ required: true, nullable: false, initial: 0, min: 0 })
      }),
      fatigueLevel: new StringField({ required: true, nullable: false, initial: "fresh",
        choices: FATIGUE_LEVELS.map((level) => level.key) }),
      attributeOverrides: new SchemaField({
        ...attributeOverrides,
        damageModifier: new SchemaField({
          mode: new StringField({ required: true, nullable: false, initial: "auto",
            choices: ["auto", "manual"] }),
          formula: textField()
        })
      }),
      resources: new SchemaField({
        actionPoints: resourceField(),
        luckPoints: resourceField(),
        magicPoints: resourceField()
      }),
      generatedInstance: new BooleanField({ required: true, nullable: false, initial: false })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.baseAttributes = calculateNpcAttributes(this);
    this.loadState = actorLoadState(this.parent);
    const condition = resolveActorConditions(this.parent, { baseAttributes: this.baseAttributes,
      fatigueKey: this.fatigueLevel, loadState: this.loadState });
    this.conditionLevel = condition.condition;
    this.skillDifficulty = condition.difficulties.general;
    this.attributes = condition.attributes;
    this.resources.actionPoints.max = this.attributes.actionPointsMax;
    this.resources.luckPoints.max = this.attributes.luckPointsMax;
    this.resources.magicPoints.max = this.attributes.magicPointsMax;
    const unconscious = this.parent?.statuses?.has(UNCONSCIOUS_STATUS_ID);
    for (const resource of Object.values(this.resources)) {
      if (!unconscious) resource.value = Math.min(resource.value, resource.max);
    }
  }
}
