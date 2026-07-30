const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "actor-sheet", "character-sheet"],
    tag: "form",
    window: {
      resizable: true
    },
    position: {
      width: 720,
      height: 640
    },
    form: {
      handler: CharacterSheet._onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/mythras-foundry/templates/actor/character-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  static async _onSubmitForm(event, form, formData) {
    await this.actor.update(formData.object);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const items = [...this.actor.items];

    return foundry.utils.mergeObject(context, {
      actor: this.actor,
      editable: this.isEditable,
      skills: items.filter((item) => item.type === "skill"),
      equipment: items.filter((item) => item.type === "equipment"),
      weapons: items.filter((item) => item.type === "weapon")
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) {
      this.element.querySelectorAll("input[name], textarea[name], select[name]")
        .forEach((field) => { field.disabled = true; });
    }

    this.element.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", (event) => this.#activateTab(event));
    });
    this.element.querySelector("[data-action='confirm-characteristics']")
      ?.addEventListener("click", () => this.#confirmCharacteristics());
    this.element.querySelector("[data-action='generate-characteristics']")
      ?.addEventListener("click", () => this.#generateCharacteristics());
    this.element.querySelector("[data-action='edit-characteristics']")
      ?.addEventListener("click", () => this.#editCharacteristics());
    this.element.querySelectorAll("[data-action='create-item']").forEach((button) => {
      button.addEventListener("click", (event) => this.#createItem(event));
    });
    this.element.querySelectorAll("[data-action='edit-item']").forEach((button) => {
      button.addEventListener("click", (event) => this.#editItem(event));
    });
    this.element.querySelectorAll("[data-action='delete-item']").forEach((button) => {
      button.addEventListener("click", (event) => this.#deleteItem(event));
    });
    this.element.querySelectorAll("[data-action='roll-skill']").forEach((button) => {
      button.addEventListener("click", (event) => this.#rollSkill(event));
    });
  }

  #activateTab(event) {
    event.preventDefault();
    const tab = event.currentTarget.dataset.tab;
    this.element.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
    this.element.querySelectorAll("[data-tab-content]").forEach((section) => {
      section.classList.toggle("active", section.dataset.tabContent === tab);
    });
  }

  async #confirmCharacteristics() {
    if (!this.isEditable) return;
    await this.submit();

    const { attributes } = this.actor.system;
    await this.actor.update({
      "system.characteristicsGenerated": true,
      "system.resources.actionPoints.value": attributes.actionPointsMax,
      "system.resources.luckPoints.value": attributes.luckPointsMax,
      "system.resources.magicPoints.value": attributes.magicPointsMax
    });
  }

  async #generateCharacteristics() {
    if (!this.isEditable) return;

    const formulas = {
      strength: "3d6",
      constitution: "3d6",
      size: "2d6 + 6",
      dexterity: "3d6",
      intelligence: "2d6 + 6",
      power: "3d6",
      charisma: "3d6"
    };
    const update = {};

    for (const [key, formula] of Object.entries(formulas)) {
      const roll = await new Roll(formula).evaluate();
      update[`system.${key}`] = roll.total;
    }

    await this.actor.update(update);
  }

  async #editCharacteristics() {
    if (!this.isEditable) return;
    await this.actor.update({ "system.characteristicsGenerated": false });
  }

  async #createItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const type = event.currentTarget.dataset.type;
    const name = game.i18n.localize(`MYTHRASF.Item.New.${type}`);
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet.render(true);
  }

  #editItem(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.closest("[data-item-id]")?.dataset.itemId);
    item?.sheet.render(true);
  }

  async #deleteItem(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  async #rollSkill(event) {
    event.preventDefault();
    const row = event.currentTarget.closest("[data-item-id]");
    const item = this.actor.items.get(row?.dataset.itemId);
    const difficulty = row?.querySelector("[data-difficulty]")?.value ?? "standard";
    await item?.rollSkill({ difficulty });
  }
}
