import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import { applyFatigue, combinedConditionLevel, combineDifficulties,
  FATIGUE_LEVELS } from "../rules/fatigue.js";
import { worstWoundLevel } from "../rules/hit-locations.js";
import { calculateNpcAttributes, NPC_OVERRIDE_KEYS } from "../rules/npc.js";
import { applyArmorInitiativePenalty } from "../rules/armor.js";
import { INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG,
  INCAPACITATED_STATUS_ID } from "../rules/incapacitated.js";
import { applyStatusAttributes, statusSkillDifficulty,
  UNCONSCIOUS_STATUS_ID } from "../rules/statuses.js";

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
    const incapacitated = Boolean(this.parent?.statuses?.has(INCAPACITATED_STATUS_ID)
      || this.parent?.getFlag?.(INCAPACITATED_FLAG_SCOPE, INCAPACITATED_MANUAL_FLAG));
    this.conditionLevel = combinedConditionLevel(
      this.fatigueLevel, worstWoundLevel(locations), incapacitated);
    this.skillDifficulty = combineDifficulties(
      this.conditionLevel.skillDifficulty,
      statusSkillDifficulty(this.parent?.statuses)
    );
    const conditioned = applyFatigue(this.baseAttributes, this.conditionLevel.key);
    const armors = this.parent?.items?.filter((item) => item.type === "armor") ?? [];
    this.attributes = applyStatusAttributes(
      applyArmorInitiativePenalty(conditioned, armors), this.parent?.statuses);
    this.resources.actionPoints.max = this.attributes.actionPointsMax;
    this.resources.luckPoints.max = this.attributes.luckPointsMax;
    this.resources.magicPoints.max = this.attributes.magicPointsMax;
    const unconscious = this.parent?.statuses?.has(UNCONSCIOUS_STATUS_ID);
    for (const resource of Object.values(this.resources)) {
      if (!unconscious) resource.value = Math.min(resource.value, resource.max);
    }
  }
}
