const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "actor-sheet", "character-sheet"],

    tag: "form",

    position: {
      width: 600,
      height: 400
    },

    form: {
      handler: CharacterSheet._onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/mythras-foundry/templates/actor/character-sheet.hbs"
    }
  };

  static async _onSubmitForm(event, form, formData) {
    await this.actor.update(formData.object);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.actor = this.actor;

    return context;
  }

}