const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
import {
  PASSION_OBJECT_TYPES,
  PASSION_VERBS,
  calculatePassionBase
} from "../rules/passions.js";

export class MythrasItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "item-sheet"],
    tag: "form",
    window: {
      resizable: true
    },
    position: {
      width: 520,
      height: 560
    },
    form: {
      handler: MythrasItemSheet._onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/mythras-foundry/templates/item/item-sheet.hbs",
      scrollable: [".item-sheet-content"]
    }
  };

  static async _onSubmitForm(event, form, formData) {
    const update = formData.object;
    if (this.item.type === "passion" && update.system?.structured) {
      if (!this.item.system.structured) {
        const base = calculatePassionBase(
          update.system.objectType,
          this.item.actor?.system
        );
        update.system.manualAdjustment = Number(this.item.system.value ?? 0)
          - base
          - Number(update.system.creationBonus ?? 0)
          - Number(update.system.experiencePoints ?? 0);
      }
      const verb = update.system.verb === "other"
        ? update.system.customVerb.trim()
        : game.i18n.localize(`MYTHRASF.Passion.Verb.${update.system.verb}`);
      const object = update.system.objectDescription.trim();
      if (verb && object) update.name = `${verb} (${object})`;
    }
    await this.item.update(update);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      item: this.item,
      editable: this.isEditable,
      isSkill: this.item.type === "skill",
      isSkillLike: ["skill", "combatStyle"].includes(this.item.type),
      isCombatStyle: this.item.type === "combatStyle",
      isBackground: ["culture", "profession"].includes(this.item.type),
      isPassion: this.item.type === "passion",
      isCustomPassionVerb: this.item.type === "passion" && this.item.system.verb === "other",
      isEquipment: this.item.type === "equipment",
      isWeapon: this.item.type === "weapon",
      groupChoices: [
        ["", "MYTHRASF.Skill.GroupAutomatic"],
        ["basic", "MYTHRASF.Skill.GroupBasic"],
        ["professional", "MYTHRASF.Skill.GroupProfessional"],
        ["resistance", "MYTHRASF.Skill.GroupResistance"],
        ["magic", "MYTHRASF.Skill.GroupMagic"],
        ["language", "MYTHRASF.Skill.GroupLanguage"],
        ["combat", "MYTHRASF.Skill.GroupCombat"]
      ].map(([value, key]) => ({
        value,
        label: game.i18n.localize(key)
      })),
      characteristicChoices: [
        "strength",
        "constitution",
        "size",
        "dexterity",
        "intelligence",
        "power",
        "charisma"
      ].map((value) => ({
        value,
        label: game.i18n.localize(`MYTHRASF.Characteristic.${value}`)
      })),
      passionVerbChoices: PASSION_VERBS.map((value) => ({
        value,
        label: game.i18n.localize(`MYTHRASF.Passion.Verb.${value}`)
      })),
      passionObjectChoices: PASSION_OBJECT_TYPES.map((value) => ({
        value,
        label: game.i18n.localize(`MYTHRASF.Passion.Object.${value}`)
      }))
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) {
      this.element.querySelectorAll("input[name], textarea[name], select[name]")
        .forEach((field) => { field.disabled = true; });
    }
  }
}
