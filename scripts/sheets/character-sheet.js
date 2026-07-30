import { CHARACTERISTIC_KEYS } from "../rules/derived-attributes.js";
import {
  CHARACTERISTIC_MINIMUMS,
  adjustPointAllocation,
  calculateAllocationRemaining,
  canSwapCharacteristics,
  createMinimumAllocation
} from "../rules/character-generation.js";
import { calculateResourceValue } from "../rules/resources.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SKILL_GROUP_LABELS = {
  basic: "MYTHRASF.Skill.GroupBasic",
  professional: "MYTHRASF.Skill.GroupProfessional",
  resistance: "MYTHRASF.Skill.GroupResistance",
  magic: "MYTHRASF.Skill.GroupMagic",
  language: "MYTHRASF.Skill.GroupLanguage"
};

export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["mythras-foundry", "actor-sheet", "character-sheet"],
    tag: "form",
    window: {
      resizable: true
    },
    position: {
      width: 960,
      height: 760
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
    const skills = items.filter((item) => item.type === "skill");
    const skillGroups = Object.entries(SKILL_GROUP_LABELS).map(([key, label]) => ({
      key,
      label,
      skills: skills.filter((item) => (
        item.system.group || item.system.category
      ) === key)
    }));
    const basicSkillGroup = skillGroups.find((group) => group.key === "basic");
    const secondarySkillGroups = skillGroups.filter((group) => group.key !== "basic");
    const characteristicRows = CHARACTERISTIC_KEYS.map((key) => ({
      key,
      label: game.i18n.localize(`MYTHRASF.Characteristic.${key}`),
      value: this.actor.system[key],
      swapChoices: CHARACTERISTIC_KEYS
        .filter((candidate) => canSwapCharacteristics(key, candidate))
        .map((candidate) => ({
          key: candidate,
          label: game.i18n.localize(`MYTHRASF.Characteristic.${candidate}`)
        }))
    }));
    const characteristicsGenerated = this.actor.system.characteristicsGenerated;
    const generationMethod = this.actor.system.generationMethod;
    const generationMethods = ["random", "randomSwap", "points"].map((key) => ({
      key,
      label: game.i18n.localize(`MYTHRASF.Character.Method.${key}`),
      active: generationMethod === key
    }));
    return foundry.utils.mergeObject(context, {
      actor: this.actor,
      editable: this.isEditable,
      characteristicRows,
      characteristicsEditing: Boolean(this._characteristicsEditing),
      generationMethod,
      generationMethods,
      isPointAllocation: !characteristicsGenerated && generationMethod === "points",
      allocationRemaining: calculateAllocationRemaining(this.actor.system),
      showCharacteristicAdjustments: this.isEditable && (
        (!characteristicsGenerated && generationMethod === "points")
        || (characteristicsGenerated && this._characteristicsEditing)
      ),
      showCharacteristicSwaps: this.isEditable
        && !characteristicsGenerated
        && generationMethod === "randomSwap",
      skillGroups,
      basicSkillGroup,
      secondarySkillGroups,
      passions: items.filter((item) => item.type === "passion"),
      equipment: items.filter((item) => item.type === "equipment"),
      weapons: items.filter((item) => item.type === "weapon")
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) {
      this.element.querySelectorAll(
        "input[name], textarea[name], select[name], [data-skill-field], "
        + "[data-passion-field], [data-resource-action]"
      )
        .forEach((field) => { field.disabled = true; });
    }

    this.element.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", (event) => this.#activateTab(event));
    });
    this.element.querySelector("[data-action='confirm-characteristics']")
      ?.addEventListener("click", () => this.#confirmCharacteristics());
    this.element.querySelectorAll("[data-generation-method]").forEach((button) => {
      button.addEventListener("click", (event) => this.#selectGenerationMethod(event));
    });
    this.element.querySelector("[data-action='toggle-characteristics-edit']")
      ?.addEventListener("click", () => this.#toggleCharacteristicsEdit());
    this.element.querySelectorAll("[data-action='adjust-characteristic']").forEach((button) => {
      button.addEventListener("click", (event) => this.#adjustCharacteristic(event));
    });
    this.element.querySelectorAll("[data-swap-characteristic]").forEach((select) => {
      select.addEventListener("change", (event) => this.#swapCharacteristic(event));
    });
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
    this.element.querySelectorAll("[data-action='add-skill-from-pack']").forEach((button) => {
      button.addEventListener("click", (event) => this.#addSkillFromPack(event));
    });
    this.element.querySelectorAll("[data-resource-action]").forEach((button) => {
      button.addEventListener("click", (event) => this.#adjustResource(event));
    });
    this.element.querySelectorAll("[data-skill-field]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updateSkillField(event));
    });
    this.element.querySelectorAll("[data-passion-field]").forEach((field) => {
      field.addEventListener("change", (event) => this.#updatePassionField(event));
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
    const method = this.actor.system.generationMethod;
    if (!method) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Character.ChooseMethod"));
      return;
    }
    if (
      method === "points"
      && calculateAllocationRemaining(this.actor.system) !== 0
    ) {
      ui.notifications.warn(game.i18n.localize("MYTHRASF.Character.SpendAllPoints"));
      return;
    }

    const { attributes } = this.actor.system;
    this._characteristicsEditing = false;
    await this.actor.update({
      "system.characteristicsGenerated": true,
      "system.resources.actionPoints.value": attributes.actionPointsMax,
      "system.resources.luckPoints.value": attributes.luckPointsMax,
      "system.resources.magicPoints.value": attributes.magicPointsMax
    });
  }

  async #selectGenerationMethod(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const method = event.currentTarget.dataset.generationMethod;
    if (method === "points") {
      const allocation = createMinimumAllocation();
      const update = { "system.generationMethod": method };
      for (const [key, value] of Object.entries(allocation)) {
        update[`system.${key}`] = value;
      }
      await this.actor.update(update);
      return;
    }

    const formulas = {
      strength: "3d6",
      constitution: "3d6",
      size: "2d6 + 6",
      dexterity: "3d6",
      intelligence: "2d6 + 6",
      power: "3d6",
      charisma: "3d6"
    };
    const update = { "system.generationMethod": method };

    for (const [key, formula] of Object.entries(formulas)) {
      const roll = await new Roll(formula).evaluate();
      update[`system.${key}`] = roll.total;
    }

    await this.actor.update(update);
  }

  async #toggleCharacteristicsEdit() {
    if (!this.isEditable) return;
    this._characteristicsEditing = !this._characteristicsEditing;
    await this.render({ force: true });
  }

  async #adjustCharacteristic(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const key = event.currentTarget.dataset.characteristic;
    const delta = Number(event.currentTarget.dataset.delta);
    const generated = this.actor.system.characteristicsGenerated;
    let value = Number(this.actor.system[key]);

    if (!generated && this.actor.system.generationMethod === "points") {
      value = adjustPointAllocation(this.actor.system, key, delta);
    } else if (generated && this._characteristicsEditing) {
      value = Math.max(CHARACTERISTIC_MINIMUMS[key], value + delta);
    } else {
      return;
    }

    await this.actor.update({ [`system.${key}`]: value });
  }

  async #swapCharacteristic(event) {
    if (!this.isEditable || this.actor.system.characteristicsGenerated) return;

    const first = event.currentTarget.dataset.swapCharacteristic;
    const second = event.currentTarget.value;
    if (!canSwapCharacteristics(first, second)) return;

    await this.actor.update({
      [`system.${first}`]: this.actor.system[second],
      [`system.${second}`]: this.actor.system[first]
    });
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

  async #addSkillFromPack(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const group = event.currentTarget.dataset.skillGroup;
    const pack = game.packs.get("mythras-foundry.skills");
    if (!pack) {
      ui.notifications.error(game.i18n.localize("MYTHRASF.Skill.PackMissing"));
      return;
    }

    const existingSlugs = new Set(
      this.actor.items
        .filter((item) => item.type === "skill")
        .map((item) => item.system.slug)
        .filter(Boolean)
    );
    const documents = await pack.getDocuments({ type: "skill" });
    const available = documents
      .filter((item) => (item.system.group || item.system.category) === group)
      .filter((item) => !existingSlugs.has(item.system.slug))
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));

    if (available.length === 0) {
      ui.notifications.info(game.i18n.localize("MYTHRASF.Skill.NoneAvailable"));
      return;
    }

    const options = available.map((item) => (
      `<option value="${item.id}">${foundry.utils.escapeHTML(item.name)}</option>`
    )).join("");
    const skillId = await DialogV2.input({
      window: {
        title: game.i18n.format("MYTHRASF.Skill.AddDialogTitle", {
          group: game.i18n.localize(SKILL_GROUP_LABELS[group])
        })
      },
      content: `
        <label class="skill-pack-picker">
          <span>${game.i18n.localize("MYTHRASF.Skill.ChooseFromPack")}</span>
          <select name="skillId" autofocus>${options}</select>
        </label>
      `,
      ok: {
        label: game.i18n.localize("MYTHRASF.Add"),
        icon: "fas fa-plus",
        callback: (event, button) => button.form.elements.skillId.value
      }
    });
    if (!skillId) return;

    const source = available.find((item) => item.id === skillId);
    if (!source) return;

    try {
      const sourceData = source.toObject();
      delete sourceData._id;
      delete sourceData._key;
      delete sourceData.folder;
      await this.actor.createEmbeddedDocuments("Item", [sourceData]);
      await this.render({ force: true });
      ui.notifications.info(game.i18n.format("MYTHRASF.Skill.Added", {
        name: source.name
      }));
    } catch (error) {
      console.error("Mythras Foundry | Error adding skill from compendium", error);
      ui.notifications.error(game.i18n.localize("MYTHRASF.Skill.AddFailed"));
    }
  }

  async #adjustResource(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const button = event.currentTarget;
    const key = button.dataset.resource;
    const action = button.dataset.resourceAction;
    const resource = this.actor.system.resources[key];
    const maximum = this.actor.system.attributes[`${key}Max`];
    if (!resource || maximum === undefined) return;

    const value = calculateResourceValue(resource.value, maximum, action);
    await this.actor.update({ [`system.resources.${key}.value`]: value });
  }

  async #updateSkillField(event) {
    if (!this.isEditable) return;

    const field = event.currentTarget;
    const itemId = field.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const value = field.type === "checkbox"
      ? field.checked
      : Math.max(0, Number.parseInt(field.value, 10) || 0);
    await item.update({ [`system.${field.dataset.skillField}`]: value });
  }

  async #updatePassionField(event) {
    if (!this.isEditable) return;

    const field = event.currentTarget;
    const itemId = field.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item || item.type !== "passion") return;

    const value = Math.max(0, Number.parseInt(field.value, 10) || 0);
    await item.update({ [`system.${field.dataset.passionField}`]: value });
  }
}
