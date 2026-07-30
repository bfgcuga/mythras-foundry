const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

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
    await this.item.update(formData.object);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      item: this.item,
      editable: this.isEditable,
      isSkill: this.item.type === "skill",
      isEquipment: this.item.type === "equipment",
      isWeapon: this.item.type === "weapon",
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
