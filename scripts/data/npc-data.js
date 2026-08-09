import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import { applyFatigue, combinedConditionLevel, FATIGUE_LEVELS } from "../rules/fatigue.js";
import { worstWoundLevel } from "../rules/hit-locations.js";
import { calculateNpcAttributes, NPC_OVERRIDE_KEYS } from "../rules/npc.js";
import { applyArmorInitiativePenalty } from "../rules/armor.js";

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
